from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Callable
from typing import Any

from openai import AsyncOpenAI

from .config import Settings
from .parsers import logical_chunks


logger = logging.getLogger(__name__)

MODE_GUIDANCE = {
    "quick": "Give a concise 60-second gist. Use 3-6 key points, no key terms, and one short overview section.",
    "notes": "Create structured study notes with 5-10 key points, important terms, and 2-6 clear sections.",
    "exam": "Prepare the student for an exam with core points, key terms, structured explanations, and 5-10 likely question-and-answer pairs.",
}


class Summarizer:
    def __init__(self, config: Settings):
        self.config = config
        self.client = (
            AsyncOpenAI(api_key=config.ai_api_key, base_url=config.ai_base_url)
            if config.ai_api_key
            else None
        )

    @property
    def configured(self) -> bool:
        return self.client is not None

    async def _completion(
        self, system: str, user: str, json_mode: bool = False, max_tokens: int = 2200
    ) -> str:
        if not self.client:
            raise RuntimeError("AI_API_KEY is not configured on the backend")
        options: dict[str, Any] = {
            "model": self.config.ai_model,
            "temperature": 0.2,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_mode:
            options["response_format"] = {"type": "json_object"}
        response = await self.client.chat.completions.create(
            **options,
        )
        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("The AI provider returned an empty response")
        return content

    async def _analyze_visual(self, filename: str, asset: dict[str, str]) -> dict[str, str] | None:
        if not self.client or not asset.get("dataBase64") or not asset.get("mimeType"):
            return None
        source = asset.get("source") or "Document visual"
        context = asset.get("context") or "No nearby text was extracted."
        response = await self.client.chat.completions.create(
            model=self.config.ai_vision_model,
            temperature=0.1,
            max_tokens=650,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Analyze visuals from study documents faithfully. Distinguish meaningful "
                        "charts, diagrams, formulas, screenshots and educational illustrations from "
                        "logos, backgrounds and decoration. Return JSON with relevant (boolean), "
                        "title (short string), and summary (2-5 concise sentences). Explain the main "
                        "relationship, process or conclusion and preserve visible labels, values and "
                        "units. Use the document's language when it is identifiable. Do not invent "
                        "unreadable details."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"Document: {filename}\nSource: {source}\n"
                                f"Nearby extracted text:\n{context}"
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": (
                                    f"data:{asset['mimeType']};base64,{asset['dataBase64']}"
                                ),
                                "detail": "auto",
                            },
                        },
                    ],
                },
            ],
        )
        content = response.choices[0].message.content
        if not content:
            return None
        payload = json.loads(content)
        if payload.get("relevant") is not True:
            return None
        title = str(payload.get("title") or "Visual insight").strip()
        summary = str(payload.get("summary") or "").strip()
        if not summary:
            return None
        return {"source": source, "title": title[:120], "summary": summary[:1800]}

    async def _analyze_visuals(
        self,
        filename: str,
        visuals: list[dict[str, str]],
        on_progress: Callable[[int], None] | None,
    ) -> list[dict[str, str]]:
        semaphore = asyncio.Semaphore(2)
        completed = 0

        async def analyze(asset: dict[str, str]) -> dict[str, str] | None:
            nonlocal completed
            try:
                async with semaphore:
                    return await self._analyze_visual(filename, asset)
            except Exception as exc:
                logger.warning(
                    "Visual analysis failed for %s: %s",
                    asset.get("source"),
                    str(exc)[:300],
                )
                return None
            finally:
                completed += 1
                if on_progress:
                    on_progress(5 + int(20 * completed / max(1, len(visuals))))

        analyzed = await asyncio.gather(*(analyze(asset) for asset in visuals))
        return [item for item in analyzed if item]

    async def summarize(
        self,
        filename: str,
        text: str,
        mode: str,
        on_progress: Callable[[int], None] | None = None,
        visuals: list[dict[str, str]] | None = None,
    ) -> dict[str, Any]:
        selected_visuals = (visuals or [])[: 3 if mode == "quick" else 8]
        visual_notes = await self._analyze_visuals(filename, selected_visuals, on_progress)
        chunks = logical_chunks(text, self.config.max_chunk_chars)
        source = text
        if len(chunks) > 1:
            semaphore = asyncio.Semaphore(3)
            completed = 0

            async def condense(index: int, chunk: str) -> tuple[int, str]:
                nonlocal completed
                async with semaphore:
                    result = await self._completion(
                        "You extract faithful study material. Preserve facts, definitions, arguments, examples, equations and headings. Do not add outside information.",
                        f"Condense this part of {filename} into no more than 900 words of dense source notes for a later summarization pass:\n\n{chunk}",
                        max_tokens=1400,
                    )
                completed += 1
                if on_progress:
                    on_progress(30 + int(35 * completed / len(chunks)))
                return index, result

            condensed = await asyncio.gather(
                *(condense(index, chunk) for index, chunk in enumerate(chunks))
            )
            source = "\n\n".join(
                f"[Part {index + 1}]\n{content}" for index, content in sorted(condensed)
            )
            while len(source) > self.config.max_chunk_chars * 3:
                reduction_chunks = logical_chunks(source, self.config.max_chunk_chars)
                reduced: list[str] = []
                for index in range(0, len(reduction_chunks), 3):
                    batch = "\n\n".join(reduction_chunks[index : index + 3])
                    reduced.append(
                        await self._completion(
                            "Merge source notes faithfully. Retain distinct facts, definitions, examples and equations; remove repetition only.",
                            f"Compress these notes into no more than 900 words:\n\n{batch}",
                            max_tokens=1400,
                        )
                    )
                source = "\n\n".join(reduced)
        elif on_progress:
            on_progress(60)

        if visual_notes:
            rendered_visuals = "\n\n".join(
                f"[Visual analysis — {item['source']}]\n{item['title']}: {item['summary']}"
                for item in visual_notes
            )
            source = f"{source}\n\n{rendered_visuals}".strip()
        if not source:
            raise RuntimeError(
                "The document contains images, but the configured AI model could not analyze them. "
                "Use a model with vision support or upload a document with readable text."
            )

        if on_progress:
            on_progress(75)
        guidance = MODE_GUIDANCE[mode]
        raw = await self._completion(
            """You are an accurate study-note editor. Use only the provided document. Return valid JSON with exactly these fields:
title (short string), tags (array of 2-5 short strings), key_points (array of strings), terms (array of short strings), sections (array of objects with heading and text), qa (array of objects with q and a), visuals (array of objects with source, title and summary).
Use table rows and visual analyses as first-class source material. Put up to 8 important image, chart, diagram or table findings in visuals and preserve their Page, Slide, Table or Document image source. Incorporate their important conclusions into key_points or sections as appropriate. Write in the dominant language of the source document. Never wrap JSON in markdown. Keep explanations clear, specific and useful to a student. If the mode does not need a field, return an empty array.""",
            f"Document: {filename}\nMode: {mode}\nInstructions: {guidance}\n\nSource material:\n{source}",
            json_mode=True,
        )
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise RuntimeError("The AI provider returned invalid JSON") from exc
        if isinstance(payload, dict):
            payload.setdefault("visuals", [])
        self._validate_payload(payload)
        if mode == "quick":
            payload["terms"] = []
            payload["qa"] = []
        elif mode != "exam":
            payload["qa"] = []
        if on_progress:
            on_progress(95)
        return payload

    @staticmethod
    def _validate_payload(payload: Any) -> None:
        if not isinstance(payload, dict):
            raise RuntimeError("The AI response has an invalid structure")
        for key in ("title", "tags", "key_points", "terms", "sections", "qa", "visuals"):
            if key not in payload:
                raise RuntimeError(f"The AI response is missing '{key}'")
        if not isinstance(payload["title"], str) or not payload["title"].strip():
            raise RuntimeError("The AI response is missing a title")
        for key in ("tags", "key_points", "terms", "sections", "qa", "visuals"):
            if not isinstance(payload[key], list):
                raise RuntimeError(f"The AI response field '{key}' must be a list")
        for key in ("tags", "key_points", "terms"):
            if any(not isinstance(item, str) or not item.strip() for item in payload[key]):
                raise RuntimeError(f"The AI response contains an invalid item in '{key}'")
        if any(not isinstance(item, dict) or not item.get("heading") or not item.get("text") for item in payload["sections"]):
            raise RuntimeError("The AI response contains an invalid section")
        if any(not isinstance(item, dict) or not item.get("q") or not item.get("a") for item in payload["qa"]):
            raise RuntimeError("The AI response contains an invalid question")
        if any(
            not isinstance(item, dict)
            or not item.get("source")
            or not item.get("title")
            or not item.get("summary")
            for item in payload["visuals"]
        ):
            raise RuntimeError("The AI response contains an invalid visual or table insight")
