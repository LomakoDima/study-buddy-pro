from __future__ import annotations

import base64
import hashlib
import io
import re
from dataclasses import dataclass
from pathlib import Path

import pymupdf
from docx import Document
from docx.oxml.ns import qn
from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE


SUPPORTED_EXTENSIONS = {".pdf": "PDF", ".docx": "DOCX", ".pptx": "PPTX"}
MAX_VISUALS = 8
MAX_IMAGE_DIMENSION = 1600
MAX_IMAGE_BYTES = 500_000
MIN_IMAGE_WIDTH = 180
MIN_IMAGE_HEIGHT = 120


@dataclass(frozen=True)
class VisualAsset:
    source: str
    mime_type: str
    data_base64: str
    context: str = ""

    def to_dict(self) -> dict[str, str]:
        return {
            "source": self.source,
            "mimeType": self.mime_type,
            "dataBase64": self.data_base64,
            "context": self.context,
        }


@dataclass(frozen=True)
class ParsedDocument:
    text: str
    unit_count: int
    file_type: str
    visuals: tuple[VisualAsset, ...] = ()
    table_count: int = 0


def _clean(value: str) -> str:
    value = value.replace("\x00", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def _table_markdown(rows: list[list[str | None]], source: str, number: int) -> str:
    normalized: list[list[str]] = []
    width = max((len(row) for row in rows), default=0)
    if not width:
        return ""
    for row in rows[:60]:
        cells = []
        for value in row[:20]:
            cell = _clean(str(value or "")).replace("|", "\\|").replace("\n", " ")
            cells.append(cell[:500])
        cells.extend([""] * (min(width, 20) - len(cells)))
        normalized.append(cells)
    if not any(any(cell for cell in row) for row in normalized):
        return ""

    headers = normalized[0]
    if not any(headers):
        headers = [f"Column {index + 1}" for index in range(len(headers))]
    body = normalized[1:]
    lines = [
        f"[Table {number} — {source}]",
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in body)
    if len(rows) > 60:
        lines.append(f"[Omitted {len(rows) - 60} additional rows]")
    return "\n".join(lines)


def _compress_image(blob: bytes, source: str, context: str = "") -> VisualAsset | None:
    try:
        with Image.open(io.BytesIO(blob)) as opened:
            image = ImageOps.exif_transpose(opened)
            if image.width < MIN_IMAGE_WIDTH or image.height < MIN_IMAGE_HEIGHT:
                return None
            if image.width * image.height < MIN_IMAGE_WIDTH * MIN_IMAGE_HEIGHT:
                return None
            if image.mode not in {"RGB", "L"}:
                background = Image.new("RGB", image.size, "white")
                if "A" in image.getbands():
                    background.paste(image, mask=image.getchannel("A"))
                else:
                    background.paste(image.convert("RGB"))
                image = background
            else:
                image = image.convert("RGB")
            image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)

            output = io.BytesIO()
            for quality in (82, 72, 62, 52):
                output.seek(0)
                output.truncate(0)
                image.save(output, format="JPEG", quality=quality, optimize=True)
                if output.tell() <= MAX_IMAGE_BYTES:
                    break
            while output.tell() > MAX_IMAGE_BYTES and max(image.size) > 640:
                image = image.resize(
                    (max(1, int(image.width * 0.8)), max(1, int(image.height * 0.8))),
                    Image.Resampling.LANCZOS,
                )
                output.seek(0)
                output.truncate(0)
                image.save(output, format="JPEG", quality=52, optimize=True)
            encoded = base64.b64encode(output.getvalue()).decode("ascii")
            return VisualAsset(
                source=source,
                mime_type="image/jpeg",
                data_base64=encoded,
                context=_clean(context)[:1600],
            )
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError):
        return None


def _select_evenly(items: list[int], limit: int) -> list[int]:
    if len(items) <= limit:
        return items
    if limit <= 1:
        return [items[0]]
    indexes = {round(index * (len(items) - 1) / (limit - 1)) for index in range(limit)}
    return [items[index] for index in sorted(indexes)]


def _parse_pdf(content: bytes) -> tuple[list[str], list[VisualAsset], int, int]:
    with pymupdf.open(stream=content, filetype="pdf") as document:
        units: list[str] = []
        visual_pages: list[int] = []
        page_context: dict[int, str] = {}
        table_count = 0

        for index, page in enumerate(document):
            source = f"Page {index + 1}"
            page_text = _clean(page.get_text("text"))
            blocks = [f"[{source}]", page_text] if page_text else [f"[{source}]"]
            try:
                tables = page.find_tables().tables
            except Exception:
                tables = []
            for table in tables:
                rendered = _table_markdown(table.extract(), source, table_count + 1)
                if rendered:
                    table_count += 1
                    blocks.append(rendered)
            unit = _clean("\n".join(blocks))
            if unit and (page_text or len(blocks) > 1):
                units.append(unit)
            page_context[index] = page_text

            try:
                image_count = len(page.get_images(full=True))
                drawing_count = len(page.get_drawings())
            except Exception:
                image_count = 0
                drawing_count = 0
            if not page_text or image_count > 0 or drawing_count >= 8:
                visual_pages.append(index)

        visuals: list[VisualAsset] = []
        for index in _select_evenly(visual_pages, MAX_VISUALS):
            page = document[index]
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
            asset = _compress_image(
                pixmap.tobytes("png"),
                f"Page {index + 1}",
                page_context.get(index, ""),
            )
            if asset:
                visuals.append(asset)
        return units, visuals, table_count, len(document)


def _parse_docx(content: bytes) -> tuple[list[str], list[VisualAsset], int, int]:
    document = Document(io.BytesIO(content))
    units = [paragraph.text for paragraph in document.paragraphs if paragraph.text.strip()]
    table_count = 0
    for table in document.tables:
        rows = [[cell.text for cell in row.cells] for row in table.rows]
        rendered = _table_markdown(rows, "Document", table_count + 1)
        if rendered:
            table_count += 1
            units.append(rendered)

    candidates: list[tuple[bytes, str]] = []
    seen_rel_ids: set[str] = set()
    seen_images: set[str] = set()
    paragraphs = list(document.paragraphs)
    for index, paragraph in enumerate(paragraphs):
        nearby = " ".join(
            item.text for item in paragraphs[max(0, index - 1) : index + 2] if item.text.strip()
        )
        for blip in paragraph._element.xpath(".//a:blip"):
            rel_id = blip.get(qn("r:embed"))
            if not rel_id or rel_id in seen_rel_ids:
                continue
            seen_rel_ids.add(rel_id)
            relation = document.part.rels.get(rel_id)
            if not relation or not hasattr(relation.target_part, "blob"):
                continue
            blob = relation.target_part.blob
            digest = hashlib.sha256(blob).hexdigest()
            if digest in seen_images:
                continue
            seen_images.add(digest)
            candidates.append((blob, nearby))

    visuals: list[VisualAsset] = []
    for candidate_index in _select_evenly(list(range(len(candidates))), MAX_VISUALS):
        blob, nearby = candidates[candidate_index]
        asset = _compress_image(
            blob,
            f"Document image {len(visuals) + 1}",
            nearby,
        )
        if asset:
            visuals.append(asset)
    unit_count = max(1, len(units))
    return units, visuals, table_count, unit_count


def _parse_pptx(content: bytes) -> tuple[list[str], list[VisualAsset], int, int]:
    presentation = Presentation(io.BytesIO(content))
    units: list[str] = []
    picture_candidates: list[tuple[bytes, str, str]] = []
    seen_images: set[str] = set()
    table_count = 0

    for index, slide in enumerate(presentation.slides):
        source = f"Slide {index + 1}"
        texts = [
            shape.text
            for shape in slide.shapes
            if hasattr(shape, "text") and shape.text.strip() and not shape.has_table
        ]
        blocks = [f"[{source}]", *texts]
        for shape in slide.shapes:
            if shape.has_table:
                rows = [[cell.text for cell in row.cells] for row in shape.table.rows]
                rendered = _table_markdown(rows, source, table_count + 1)
                if rendered:
                    table_count += 1
                    blocks.append(rendered)
        units.append("\n".join(blocks))

        context = "\n".join(texts)
        for shape in slide.shapes:
            if shape.shape_type != MSO_SHAPE_TYPE.PICTURE:
                continue
            blob = shape.image.blob
            digest = hashlib.sha256(blob).hexdigest()
            if digest in seen_images:
                continue
            seen_images.add(digest)
            picture_candidates.append((blob, source, context))

    visuals: list[VisualAsset] = []
    selected = _select_evenly(list(range(len(picture_candidates))), MAX_VISUALS)
    for candidate_index in selected:
        blob, source, context = picture_candidates[candidate_index]
        asset = _compress_image(blob, source, context)
        if asset:
            visuals.append(asset)
    return units, visuals, table_count, len(presentation.slides)


def parse_document(filename: str, content: bytes) -> ParsedDocument:
    extension = Path(filename).suffix.lower()
    file_type = SUPPORTED_EXTENSIONS.get(extension)
    if not file_type:
        raise HTTPException(status_code=415, detail="Only PDF, DOCX and PPTX files are supported")
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")

    try:
        if extension == ".pdf":
            units, visuals, table_count, unit_count = _parse_pdf(content)
        elif extension == ".docx":
            units, visuals, table_count, unit_count = _parse_docx(content)
        else:
            units, visuals, table_count, unit_count = _parse_pptx(content)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="The document is damaged or could not be read") from exc

    cleaned_units = [_clean(unit) for unit in units if _clean(unit)]
    text = "\n\n".join(cleaned_units)
    if len(text) < 20 and not visuals:
        raise HTTPException(
            status_code=422,
            detail="No readable text, tables or images were found in this document.",
        )
    return ParsedDocument(
        text=text,
        unit_count=unit_count,
        file_type=file_type,
        visuals=tuple(visuals),
        table_count=table_count,
    )


def logical_chunks(text: str, max_chars: int) -> list[str]:
    blocks = [block.strip() for block in text.split("\n\n") if block.strip()]
    chunks: list[str] = []
    current: list[str] = []
    current_length = 0

    for block in blocks:
        if len(block) > max_chars:
            paragraphs = [block[i : i + max_chars] for i in range(0, len(block), max_chars)]
        else:
            paragraphs = [block]
        for paragraph in paragraphs:
            extra = len(paragraph) + (2 if current else 0)
            if current and current_length + extra > max_chars:
                chunks.append("\n\n".join(current))
                current = []
                current_length = 0
            current.append(paragraph)
            current_length += len(paragraph) + (2 if len(current) > 1 else 0)
    if current:
        chunks.append("\n\n".join(current))
    return chunks
