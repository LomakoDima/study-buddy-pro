import asyncio
import base64
import io
import json
import sqlite3
from types import SimpleNamespace

from docx import Document
from docx.shared import Inches as DocxInches
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw
import pymupdf
from pptx import Presentation
from pptx.util import Inches as PptxInches

from app.auth import AuthUser
from app.ai import Summarizer
from app.config import Settings
from app.db import Database
from app.parsers import logical_chunks, parse_document
from app.services import SummaryService


class TestSummarizer:
    configured = True

    async def summarize(self, filename, text, mode, on_progress=None, visuals=None):
        assert filename == "lecture.docx"
        assert "retrieval practice" in text
        assert "[Table 1 — Document]" in text
        assert mode == "notes"
        assert visuals and visuals[0]["source"] == "Document image 1"
        if on_progress:
            on_progress(70)
        return {
            "title": "Memory and Retrieval",
            "tags": ["Memory", "Learning"],
            "key_points": ["Retrieval practice improves long-term recall."],
            "terms": ["Retrieval practice"],
            "sections": [{"heading": "Overview", "text": "Active recall strengthens memory."}],
            "qa": [],
            "visuals": [
                {
                    "source": "Document image 1",
                    "title": "Retention chart",
                    "summary": "The chart compares learning retention over time.",
                }
            ],
        }


def make_image() -> bytes:
    image = Image.new("RGB", (640, 360), "white")
    drawing = ImageDraw.Draw(image)
    drawing.rectangle((90, 180, 190, 310), fill="#5146e5")
    drawing.rectangle((270, 110, 370, 310), fill="#756cf0")
    drawing.rectangle((450, 50, 550, 310), fill="#2e286f")
    stream = io.BytesIO()
    image.save(stream, format="PNG")
    return stream.getvalue()


def make_docx() -> bytes:
    document = Document()
    document.add_heading("Learning Science", level=1)
    document.add_paragraph("Spacing and retrieval practice improve long-term learning and recall.")
    table = document.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Method"
    table.cell(0, 1).text = "Retention"
    table.cell(1, 0).text = "Retrieval practice"
    table.cell(1, 1).text = "High"
    document.add_picture(io.BytesIO(make_image()), width=DocxInches(4))
    stream = io.BytesIO()
    document.save(stream)
    return stream.getvalue()


def test_upload_to_summary_library_and_delete(tmp_path):
    database = Database(tmp_path / "test.db")
    service = SummaryService(database, TestSummarizer())
    content = make_docx()
    parsed = parse_document("lecture.docx", content)
    user = AuthUser(42, "Ava", "ava")

    document = service.create_document(user, "lecture.docx", len(content), parsed)
    summary = service.create_summary(user, document["id"], "notes")
    asyncio.run(service.generate_summary(summary["id"]))

    ready = service.get_summary(user.id, summary["id"])
    assert ready["status"] == "ready"
    assert ready["payload"]["title"] == "Memory and Retrieval"
    assert service.list_summaries(user.id)[0]["id"] == summary["id"]

    service.delete_summary(user.id, summary["id"])
    assert service.list_summaries(user.id) == []


def test_logical_chunks_keep_all_text():
    source = "First section.\n\n" + ("A" * 30) + "\n\nLast section."
    chunks = logical_chunks(source, 20)
    assert len(chunks) >= 3
    assert "First section." in "\n\n".join(chunks)
    assert "Last section." in "\n\n".join(chunks)


def test_existing_database_adds_visual_assets_column(tmp_path):
    path = tmp_path / "legacy.db"
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        CREATE TABLE users (
            id BIGINT PRIMARY KEY, first_name TEXT NOT NULL, username TEXT,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE documents (
            id TEXT PRIMARY KEY,
            user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            filename TEXT NOT NULL, title TEXT NOT NULL, file_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL, unit_count INTEGER NOT NULL,
            extracted_text TEXT NOT NULL, created_at TEXT NOT NULL
        );
        """
    )
    connection.close()

    Database(path)
    with sqlite3.connect(path) as migrated_connection:
        columns = migrated_connection.execute("PRAGMA table_info(documents)").fetchall()
    assert "visual_assets" in {row[1] for row in columns}


def test_pdf_and_pptx_parsers():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_text((72, 72), "Cell membranes regulate transport and signaling.")
    x_positions = [72, 260, 450]
    y_positions = [110, 150, 190]
    for x_position in x_positions:
        page.draw_line((x_position, y_positions[0]), (x_position, y_positions[-1]))
    for y_position in y_positions:
        page.draw_line((x_positions[0], y_position), (x_positions[-1], y_position))
    page.insert_text((82, 137), "Transport")
    page.insert_text((270, 137), "Direction")
    page.insert_text((82, 177), "Diffusion")
    page.insert_text((270, 177), "Down gradient")
    parsed_pdf = parse_document("cells.pdf", pdf.tobytes())
    assert parsed_pdf.file_type == "PDF"
    assert "Cell membranes" in parsed_pdf.text
    assert "[Table 1 — Page 1]" in parsed_pdf.text
    assert parsed_pdf.table_count == 1

    scanned_pdf = pymupdf.open()
    scanned_page = scanned_pdf.new_page(width=640, height=360)
    scanned_page.insert_image(scanned_page.rect, stream=make_image())
    parsed_scan = parse_document("scan.pdf", scanned_pdf.tobytes())
    assert parsed_scan.text == ""
    assert len(parsed_scan.visuals) == 1

    presentation = Presentation()
    slide = presentation.slides.add_slide(presentation.slide_layouts[1])
    slide.shapes.title.text = "Supply and demand"
    slide.placeholders[1].text = "Equilibrium occurs where quantities are equal."
    table = slide.shapes.add_table(2, 2, PptxInches(1), PptxInches(3), PptxInches(4), PptxInches(1)).table
    table.cell(0, 0).text = "Price"
    table.cell(0, 1).text = "Demand"
    table.cell(1, 0).text = "$10"
    table.cell(1, 1).text = "100"
    slide.shapes.add_picture(io.BytesIO(make_image()), PptxInches(5.2), PptxInches(2), width=PptxInches(3))
    stream = io.BytesIO()
    presentation.save(stream)
    parsed_pptx = parse_document("economics.pptx", stream.getvalue())
    assert parsed_pptx.file_type == "PPTX"
    assert "Equilibrium" in parsed_pptx.text
    assert "[Table 1 — Slide 1]" in parsed_pptx.text
    assert parsed_pptx.table_count == 1
    assert len(parsed_pptx.visuals) == 1


def test_http_upload_to_summary_workflow(tmp_path):
    from app import main

    database = Database(tmp_path / "api.db")
    summarizer = TestSummarizer()
    main.database = database
    main.summarizer = summarizer
    main.service = SummaryService(database, summarizer)
    user = AuthUser(77, "Local Student", "local")
    main.app.dependency_overrides[main.current_user] = lambda: user

    try:
        with TestClient(main.app) as client:
            upload = client.post(
                "/api/documents",
                files={
                    "file": (
                        "lecture.docx",
                        make_docx(),
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                },
            )
            assert upload.status_code == 201

            create = client.post(
                f"/api/documents/{upload.json()['id']}/summaries",
                json={"mode": "notes"},
            )
            assert create.status_code == 202
            summary_id = create.json()["id"]

            stored = client.get(f"/api/summaries/{summary_id}")
            assert stored.status_code == 200
            assert stored.json()["status"] == "ready"
            assert client.get("/api/summaries").json()[0]["id"] == summary_id
    finally:
        main.app.dependency_overrides.clear()


def test_multimodal_summary_uses_embedded_image():
    calls = []

    class FakeCompletions:
        async def create(self, **kwargs):
            calls.append(kwargs)
            user_content = kwargs["messages"][1]["content"]
            if isinstance(user_content, list):
                payload = {
                    "relevant": True,
                    "title": "Retention comparison",
                    "summary": "The bars show retention increasing across the three methods.",
                }
            else:
                payload = {
                    "title": "Learning methods",
                    "tags": ["Learning", "Retention"],
                    "key_points": ["Retrieval practice produces the strongest retention."],
                    "terms": ["Retrieval practice"],
                    "sections": [{"heading": "Overview", "text": "Practice improves recall."}],
                    "qa": [],
                    "visuals": [
                        {
                            "source": "Page 2",
                            "title": "Retention comparison",
                            "summary": "The chart compares retention across three methods.",
                        }
                    ],
                }
            return SimpleNamespace(
                choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(payload)))]
            )

    summarizer = Summarizer(Settings(ai_api_key="test-key"))
    summarizer.client = SimpleNamespace(
        chat=SimpleNamespace(completions=FakeCompletions())
    )
    result = asyncio.run(
        summarizer.summarize(
            "lecture.pdf",
            "Retrieval practice improves long-term retention across the semester.",
            "notes",
            visuals=[
                {
                    "source": "Page 2",
                    "mimeType": "image/jpeg",
                    "dataBase64": base64.b64encode(make_image()).decode("ascii"),
                    "context": "Comparison of three study methods.",
                }
            ],
        )
    )

    image_part = calls[0]["messages"][1]["content"][1]
    assert image_part["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert result["visuals"][0]["source"] == "Page 2"
