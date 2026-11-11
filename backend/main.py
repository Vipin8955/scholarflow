import os
import re
import json
import uuid
import time
import zipfile
import sqlite3
import asyncio
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional, List

import httpx
import mammoth
from pypdf import PdfReader
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, HTMLResponse
from pydantic import BaseModel

app = FastAPI(title="ScholarFlow AI and Annotation Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "annotations.db")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
OLLAMA_TAGS_URL = os.getenv("OLLAMA_TAGS_URL", "http://127.0.0.1:11434/api/tags")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
OJS_DASHBOARD_URL = os.getenv(
    "SCHOLARFLOW_OJS_URL",
    "http://localhost/ojs/index.php/test/dashboard/editorial?currentViewId=active",
)

# In-memory live progress job store for real-time LLM streaming tracking
JOBS: dict[str, dict] = {}


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS annotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            submission_id INTEGER NOT NULL,
            user_id INTEGER,
            user_name TEXT NOT NULL,
            user_role TEXT NOT NULL,
            selected_text TEXT NOT NULL,
            comment TEXT NOT NULL,
            color TEXT DEFAULT 'yellow',
            paragraph_id TEXT,
            confidential_to_editor INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cached_reports (
            file_path TEXT PRIMARY KEY,
            model_name TEXT NOT NULL,
            report TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS released_reviewers (
            submission_id INTEGER NOT NULL,
            reviewer_id INTEGER NOT NULL,
            reviewer_name TEXT NOT NULL,
            released_by TEXT DEFAULT '',
            released_at TEXT NOT NULL,
            PRIMARY KEY (submission_id, reviewer_id)
        )
    """)
    conn.commit()
    conn.close()


init_db()


# ── Pydantic Models ──────────────────────────────────────────────────────────
class AnalyzeRequest(BaseModel):
    file_path: str
    force_refresh: bool = False
    user_id: int = 0
    scope: str = "global"


class RenderRequest(BaseModel):
    file_path: str


class AnnotationCreate(BaseModel):
    submission_id: int
    user_id: int = 0
    user_name: str
    user_role: str
    selected_text: str
    comment: str
    color: str = "yellow"
    paragraph_id: str = ""
    confidential_to_editor: bool = False


class ExportRequest(BaseModel):
    submission_id: int
    title: str = "Manuscript"


class ReviewerItem(BaseModel):
    id: int
    name: str
    interests: str = ""
    affiliation: str = ""
    active_reviews: int = 0
    completed_reviews: int = 0


class RecommendRequest(BaseModel):
    submission_id: int = 0
    title: str
    abstract: str
    authors: str = ""
    reviewers: List[ReviewerItem]
    force_refresh: bool = False


class DraftAuthorLetterRequest(BaseModel):
    submission_id: int
    title: str
    source_label: str
    editor_name: str = "Editorial Board"
    annotations: List[dict]


class DraftReleaseLetterRequest(BaseModel):
    submission_id: int
    title: str
    reviewer_name: str
    editor_name: str = "Editorial Board"


class ReleaseReviewerCreate(BaseModel):
    submission_id: int
    reviewer_id: int
    reviewer_name: str
    released_by: str = ""


class DashboardStatusItem(BaseModel):
    submission_id: int
    file_path: str = ""


class DashboardStatusesRequest(BaseModel):
    items: List[DashboardStatusItem]


# ── Helpers: Document Text Extraction ────────────────────────────────────────
def extract_text_from_pdf(pdf_path: str, max_pages: int = 40) -> tuple[str, int]:
    try:
        reader = PdfReader(pdf_path)
        text_parts = []
        num_pages = len(reader.pages)
        pages_to_read = min(num_pages, max_pages)
        for i in range(pages_to_read):
            page_text = reader.pages[i].extract_text()
            if page_text:
                text_parts.append(page_text)
        extracted_text = "\n\n".join(text_parts)
        if num_pages > max_pages:
            extracted_text += f"\n\n[Note: Extracted first {max_pages} of {num_pages} pages.]"
        return extracted_text, num_pages
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {str(e)}")


def extract_text_from_docx(docx_path: str) -> str:
    try:
        doc = zipfile.ZipFile(docx_path)
        xml_content = doc.read("word/document.xml")
        root = ET.fromstring(xml_content)
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        text_parts = []
        for p in root.findall(".//w:p", ns):
            p_text = []
            for r in p.findall(".//w:r", ns):
                t = r.find("w:t", ns)
                if t is not None and t.text:
                    p_text.append(t.text)
            if p_text:
                text_parts.append("".join(p_text))
        return "\n".join(text_parts)
    except Exception as e:
        raise ValueError(f"Failed to parse DOCX file: {str(e)}")


def add_paragraph_ids_to_html(raw_html: str) -> tuple[str, int]:
    pid_counter = 0

    def replace_tag(match):
        nonlocal pid_counter
        tag_name = match.group(1)
        attrs = match.group(2) or ""
        pid = f"p-{pid_counter}"
        pid_counter += 1
        return f'<{tag_name} id="{pid}" data-pid="{pid}" {attrs}>'

    pattern = re.compile(r"<(p|h1|h2|h3|h4|h5|h6|li)(\s*[^>]*)>", re.IGNORECASE)
    structured_html = pattern.sub(replace_tag, raw_html)
    return structured_html, pid_counter


def extract_json_array(text: str) -> list:
    clean_text = re.sub(r"^```json\s*", "", text.strip(), flags=re.IGNORECASE)
    clean_text = re.sub(r"\s*```$", "", clean_text, flags=re.IGNORECASE).strip()
    try:
        val = json.loads(clean_text)
        if isinstance(val, list):
            return val
        if isinstance(val, dict):
            if "recommendations" in val and isinstance(val["recommendations"], list):
                return val["recommendations"]
            if "id" in val:
                return [val]
    except Exception:
        pass

    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1 and end > start:
        try:
            val = json.loads(text[start : end + 1])
            if isinstance(val, list):
                return val
        except Exception:
            pass

    obj_matches = re.findall(r'\{[^{}]*"id"[^{}]*"score"[^{}]*\}', text)
    recs = []
    for m in obj_matches:
        try:
            recs.append(json.loads(m))
        except Exception:
            pass
    if recs:
        return recs

    raise ValueError(f"Could not parse LLM output as JSON array: {text[:240]}")


def parse_verdict_from_report(report_md: str) -> str:
    if not report_md:
        return "NOT SCREENED"
    up = report_md.upper()
    if "DESK REJECT" in up:
        return "DESK REJECT"
    if "PROCEED TO PEER REVIEW" in up or "ACCEPT FOR PEER REVIEW" in up:
        return "PROCEED TO PEER REVIEW"
    if "MINOR REVISION" in up:
        return "MINOR REVISION"
    if "MAJOR REVISION" in up:
        return "MAJOR REVISION"
    # Check section 5 specifically for ACCEPT vs REJECT
    sec5_idx = up.find("5. RECOMMENDATION")
    tail = up[sec5_idx:] if sec5_idx != -1 else up[-400:]
    if re.search(r"\bREJECT\b", tail):
        return "REJECT"
    if re.search(r"\bACCEPT\b", tail):
        return "ACCEPT"
    if "REVISION" in tail:
        return "REVISIONS REQUIRED"
    return "SCREENED"


# ── Real Ollama Streaming Helper ─────────────────────────────────────────────
async def stream_ollama(
    prompt: str,
    options: Optional[dict] = None,
    on_progress=None,
    timeout: float = 180.0,
) -> tuple[str, int]:
    """Stream tokens live from Ollama and report real token counts to on_progress."""
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": True,
        "options": options or {"temperature": 0.2, "num_ctx": 4096, "num_predict": 900},
    }
    full_parts: list[str] = []
    tokens = 0
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", OLLAMA_URL, json=payload) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise RuntimeError(
                    f"Ollama HTTP {resp.status_code}: {body.decode('utf-8', errors='ignore')[:200]}"
                )
            async for line in resp.aiter_lines():
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                except Exception:
                    continue
                tok = chunk.get("response", "")
                if tok:
                    full_parts.append(tok)
                    tokens += 1
                    if on_progress:
                        on_progress(tokens, "".join(full_parts))
                if chunk.get("done"):
                    break
    output = "".join(full_parts).strip()
    if not output:
        raise RuntimeError(f"Ollama ({MODEL_NAME}) returned an empty response.")
    return output, tokens


def cleanup_old_jobs(max_age_sec: float = 900.0):
    now = time.time()
    stale = [jid for jid, j in JOBS.items() if now - j.get("updated_at", now) > max_age_sec]
    for jid in stale:
        JOBS.pop(jid, None)


def create_job(kind: str, stage: str) -> str:
    cleanup_old_jobs()
    jid = uuid.uuid4().hex
    JOBS[jid] = {
        "job_id": jid,
        "kind": kind,
        "status": "running",
        "percent": 5,
        "stage": stage,
        "tokens": 0,
        "model": MODEL_NAME,
        "result": None,
        "error": None,
        "updated_at": time.time(),
    }
    return jid


def update_job(jid: str, **kwargs):
    if jid in JOBS:
        JOBS[jid].update(kwargs)
        JOBS[jid]["updated_at"] = time.time()


# ── Health & Root ────────────────────────────────────────────────────────────
@app.get("/favicon.ico")
async def favicon():
    return Response(status_code=204)


@app.get("/", response_class=HTMLResponse)
async def root():
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ScholarFlow Platform &amp; AI Intelligence Service</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }}
    body {{ background: radial-gradient(circle at top right, #1e1b4b, #0f172a 70%); color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }}
    .card {{ background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 20px; max-width: 640px; width: 100%; padding: 40px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); text-align: center; }}
    .badge {{ display: inline-flex; align-items: center; gap: 6px; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 700; margin-bottom: 20px; }}
    .badge-dot {{ width: 8px; height: 8px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 10px #22c55e; }}
    h1 {{ font-size: 28px; font-weight: 800; margin-bottom: 12px; color: #ffffff; }}
    p.lead {{ color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 28px; }}
    .btn-launch {{ display: inline-flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, #4f46e5, #6366f1); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 28px; border-radius: 12px; width: 100%; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="badge-dot"></span><span>ScholarFlow AI Backend Online &bull; Ollama ({MODEL_NAME})</span></div>
    <h1>ScholarFlow Publishing Platform</h1>
    <p class="lead">Python AI Intelligence service powered 100% by local Ollama LLM ({MODEL_NAME}). Open the OJS Editorial Dashboard to use ScholarFlow.</p>
    <a class="btn-launch" href="{OJS_DASHBOARD_URL}">Open ScholarFlow on OJS Dashboard &rarr;</a>
  </div>
</body>
</html>"""


@app.get("/api/health")
async def health_check():
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(OLLAMA_TAGS_URL)
            if resp.status_code == 200:
                models = [m.get("name") for m in resp.json().get("models", [])]
                return {
                    "status": "healthy",
                    "ollama": "connected",
                    "available_models": models,
                    "target_model": MODEL_NAME,
                }
    except Exception as e:
        return {"status": "unhealthy", "ollama_error": str(e), "target_model": MODEL_NAME}
    return {"status": "healthy", "ollama": "disconnected", "target_model": MODEL_NAME}


@app.get("/api/job/{job_id}")
async def get_job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return job


# ── Document Rendering & Annotations ─────────────────────────────────────────
@app.post("/api/render_document")
async def render_document(payload: RenderRequest):
    file_path = payload.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found at: {file_path}")

    filename = os.path.basename(file_path)
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == ".docx":
            with open(file_path, "rb") as docx_file:
                result = mammoth.convert_to_html(docx_file)
                raw_html = result.value
                structured_html, count = add_paragraph_ids_to_html(raw_html)
                return {
                    "success": True,
                    "filename": filename,
                    "format": "docx",
                    "html": structured_html,
                    "total_blocks": count,
                }
        elif ext == ".pdf":
            reader = PdfReader(file_path)
            html_blocks = []
            block_idx = 0
            for page in reader.pages:
                page_text = page.extract_text() or ""
                paragraphs = [p.strip() for p in page_text.split("\n\n") if p.strip()]
                for para in paragraphs:
                    pid = f"p-{block_idx}"
                    block_idx += 1
                    escaped_para = para.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    html_blocks.append(f'<p id="{pid}" data-pid="{pid}">{escaped_para}</p>')

            return {
                "success": True,
                "filename": filename,
                "format": "pdf",
                "html": "".join(html_blocks),
                "total_blocks": block_idx,
                "total_pages": len(reader.pages),
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format {ext}. Only .docx and .pdf supported.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render document: {str(e)}")


@app.get("/api/annotations")
async def get_annotations(submission_id: int = Query(...)):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, submission_id, user_id, user_name, user_role, selected_text, comment, color, paragraph_id, confidential_to_editor, created_at
        FROM annotations
        WHERE submission_id = ?
        ORDER BY id ASC
    """, (submission_id,))
    rows = cursor.fetchall()
    annotations = [dict(row) for row in rows]
    for a in annotations:
        a["confidential_to_editor"] = bool(a.get("confidential_to_editor", 0))
    conn.close()
    return {"success": True, "annotations": annotations}


@app.post("/api/annotations")
async def create_annotation(payload: AnnotationCreate):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    is_conf = 1 if payload.confidential_to_editor else 0
    cursor.execute("""
        INSERT INTO annotations (submission_id, user_id, user_name, user_role, selected_text, comment, color, paragraph_id, confidential_to_editor, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        payload.submission_id,
        payload.user_id,
        payload.user_name,
        payload.user_role,
        payload.selected_text,
        payload.comment,
        payload.color,
        payload.paragraph_id,
        is_conf,
        now_str,
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "success": True,
        "annotation": {
            "id": new_id,
            "submission_id": payload.submission_id,
            "user_id": payload.user_id,
            "user_name": payload.user_name,
            "user_role": payload.user_role,
            "selected_text": payload.selected_text,
            "comment": payload.comment,
            "color": payload.color,
            "paragraph_id": payload.paragraph_id,
            "confidential_to_editor": bool(payload.confidential_to_editor),
            "created_at": now_str,
        },
    }


@app.delete("/api/annotations/{annotation_id}")
async def delete_annotation(annotation_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM annotations WHERE id = ?", (annotation_id,))
    deleted = cursor.rowcount
    conn.commit()
    conn.close()
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Annotation not found")
    return {"success": True, "deleted_id": annotation_id}


@app.post("/api/export_annotations")
async def export_annotations(payload: ExportRequest):
    submission_id = payload.submission_id
    title = payload.title or f"Submission #{submission_id}"

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, submission_id, user_name, user_role, selected_text, comment, color, paragraph_id, created_at
        FROM annotations
        WHERE submission_id = ? AND (confidential_to_editor = 0 OR confidential_to_editor IS NULL)
        ORDER BY id ASC
    """, (submission_id,))
    rows = cursor.fetchall()
    annotations = [dict(row) for row in rows]
    conn.close()

    md_lines = [
        "# Peer Review and Editorial Markups Report",
        f"**Manuscript:** {title} (Submission #{submission_id})",
        f"**Generated On:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"**Total Inline Comments:** {len(annotations)}",
        "",
    ]

    if annotations:
        comments_block = "\n".join(
            f"- [{a['user_role']}] {a['user_name']} on \"{a['selected_text'][:180]}\": {a['comment']}"
            for a in annotations
        )
        summary_prompt = f"""You are a senior academic journal editor. Summarize the following {len(annotations)} inline peer-review comments on the manuscript "{title}" into a concise 3-4 bullet Executive Summary highlighting the main revision themes and editorial priorities. Output clean Markdown bullets only.

COMMENTS:
{comments_block}
"""
        try:
            summary_md, _ = await stream_ollama(
                summary_prompt,
                options={"temperature": 0.2, "num_ctx": 4096, "num_predict": 350},
                timeout=90.0,
            )
            md_lines.append(f"## AI Executive Summary ({MODEL_NAME})")
            md_lines.append(summary_md)
            md_lines.append("")
        except Exception as e:
            md_lines.append(f"## AI Executive Summary Unavailable ({str(e)})")
            md_lines.append("")

    md_lines.extend(["---", ""])

    if not annotations:
        md_lines.append("*No inline comments or markups have been recorded for this manuscript.*\n")
    else:
        for idx, a in enumerate(annotations, 1):
            md_lines.append(f"### Comment #{idx}")
            md_lines.append(f"- **Reviewer / Commenter:** {a['user_name']} (*{a['user_role']}*)")
            md_lines.append(f"- **Timestamp:** {a['created_at']}")
            md_lines.append("- **Highlighted Text Passage:**")
            md_lines.append(f"> \"{a['selected_text']}\"")
            md_lines.append(f"- **Feedback / Comment:** {a['comment']}")
            md_lines.append("")

    return {
        "success": True,
        "submission_id": submission_id,
        "title": title,
        "total_comments": len(annotations),
        "markdown": "\n".join(md_lines),
        "annotations": annotations,
    }


# ── AI Manuscript Pre-Screening (100% LLM + Real Live Progress) ──────────────
async def execute_prescreening(payload: AnalyzeRequest, job_id: Optional[str] = None) -> dict:
    file_path = payload.file_path
    if not os.path.exists(file_path):
        raise ValueError(f"File not found at: {file_path}")

    is_private = (payload.scope in ["editor_private", "reviewer_private", "private"]) and payload.user_id > 0
    private_key = f"{file_path}:user:{payload.user_id}"
    global_key = file_path

    if job_id:
        update_job(job_id, percent=8, stage="Checking cached LLM reports...")

    if not payload.force_refresh:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        if payload.user_id > 0:
            cursor.execute(
                "SELECT report, model_name, created_at FROM cached_reports WHERE file_path = ?",
                (private_key,),
            )
            p_row = cursor.fetchone()
            if p_row:
                conn.close()
                res = {
                    "success": True,
                    "file_path": file_path,
                    "model": p_row[1],
                    "report": p_row[0],
                    "cached": True,
                    "cached_at": p_row[2],
                    "is_private": True,
                }
                if job_id:
                    update_job(job_id, status="done", percent=100, stage="Loaded cached LLM evaluation.", result=res)
                return res

        cursor.execute(
            "SELECT report, model_name, created_at FROM cached_reports WHERE file_path = ?",
            (global_key,),
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            res = {
                "success": True,
                "file_path": file_path,
                "model": row[1],
                "report": row[0],
                "cached": True,
                "cached_at": row[2],
                "is_private": False,
            }
            if job_id:
                update_job(job_id, status="done", percent=100, stage="Loaded cached LLM evaluation.", result=res)
            return res

    if job_id:
        update_job(job_id, percent=14, stage="Parsing manuscript file and extracting full text...")

    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        extracted_text, num_pages = extract_text_from_pdf(file_path, max_pages=40)
        parse_note = f"{num_pages} pages"
    elif ext == ".docx":
        extracted_text = extract_text_from_docx(file_path)
        parse_note = "DOCX"
    else:
        raise ValueError(f"Unsupported file format: {ext}. ScholarFlow supports PDF and DOCX manuscripts.")

    if not extracted_text.strip():
        raise ValueError("The file appears to have no extractable text.")

    words = extracted_text.split()
    max_words = 3500
    if len(words) > max_words:
        distilled_text = " ".join(words[:max_words]) + f"\n\n[Truncated at {max_words} of {len(words)} words to fit model context.]"
    else:
        distilled_text = extracted_text

    if job_id:
        update_job(
            job_id,
            percent=22,
            stage=f"Extracted {len(words)} words ({parse_note}). Sending prompt to {MODEL_NAME}...",
        )

    prompt = f"""You are an expert academic editor. Perform a thorough, rigorous AI Pre-Screening of this manuscript.
Format strictly in Markdown with these EXACT 5 section headers:

### 1. Scope & Journal Fit
- 2-3 sentences evaluating fit for high-impact scholarly journals.

### 2. Methodological Rigor & Technical Soundness
- Bullet points detailing strengths and methodological limitations grounded directly in the manuscript text.

### 3. Novelty & Academic Contribution
- What makes this research original and significant based on the manuscript.

### 4. Critical Flaws / Missing Elements
- Specific technical gaps, missing controls, or issues requiring revision prior to publication.

### 5. Recommendation
- State clearly in bold one of: **PROCEED TO PEER REVIEW**, **MINOR REVISION**, **MAJOR REVISION**, or **DESK REJECT**, followed by a 2-sentence rationale.

---
MANUSCRIPT TEXT:
{distilled_text}
"""

    def on_tok(tokens: int, partial: str):
        if not job_id:
            return
        up = partial.upper()
        if "5. RECOMMENDATION" in up:
            base, msg = 84, f"Drafting Section 5/5: Editorial Recommendation ({tokens} tokens)..."
        elif "4. CRITICAL FLAWS" in up:
            base, msg = 70, f"Drafting Section 4/5: Critical Flaws & Missing Elements ({tokens} tokens)..."
        elif "3. NOVELTY" in up:
            base, msg = 56, f"Drafting Section 3/5: Novelty & Academic Contribution ({tokens} tokens)..."
        elif "2. METHODOLOGICAL RIGOR" in up:
            base, msg = 40, f"Drafting Section 2/5: Methodological Rigor & Soundness ({tokens} tokens)..."
        elif "1. SCOPE" in up:
            base, msg = 28, f"Drafting Section 1/5: Scope & Journal Fit ({tokens} tokens)..."
        else:
            base, msg = 24, f"{MODEL_NAME} streaming evaluation ({tokens} tokens)..."
        pct = min(97, base + min(12, tokens // 40))
        update_job(job_id, percent=pct, stage=msg, tokens=tokens)

    analysis_report, total_tokens = await stream_ollama(
        prompt,
        options={"temperature": 0.2, "num_predict": 900, "num_ctx": 8192},
        on_progress=on_tok,
        timeout=180.0,
    )

    save_key = private_key if is_private else global_key
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT OR REPLACE INTO cached_reports (file_path, model_name, report, created_at)
        VALUES (?, ?, ?, ?)
    """, (save_key, MODEL_NAME, analysis_report, now_str))
    if not is_private and payload.user_id > 0:
        cursor.execute("DELETE FROM cached_reports WHERE file_path = ?", (private_key,))
    conn.commit()
    conn.close()

    res = {
        "success": True,
        "file_path": file_path,
        "model": MODEL_NAME,
        "report": analysis_report,
        "tokens": total_tokens,
        "cached": False,
        "is_private": is_private,
    }
    if job_id:
        update_job(job_id, status="done", percent=100, stage=f"LLM evaluation complete ({total_tokens} tokens).", tokens=total_tokens, result=res)
    return res


@app.post("/api/analyze/start")
async def start_analyze_manuscript(payload: AnalyzeRequest):
    if not os.path.exists(payload.file_path):
        raise HTTPException(status_code=404, detail=f"File not found at: {payload.file_path}")
    job_id = create_job("analyze", f"Queued manuscript pre-screening for {MODEL_NAME}...")

    async def runner():
        try:
            await execute_prescreening(payload, job_id=job_id)
        except Exception as e:
            update_job(job_id, status="error", error=str(e), stage=f"LLM error: {str(e)}")

    asyncio.create_task(runner())
    return {"success": True, "job_id": job_id, "model": MODEL_NAME}


@app.post("/api/analyze")
async def analyze_manuscript(payload: AnalyzeRequest):
    try:
        return await execute_prescreening(payload, job_id=None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Real-time Ollama LLM execution failed: {str(e)}")


# ── AI Reviewer Matchmaking (100% LLM Batched + Live Progress, Zero Fallback) ─
async def evaluate_reviewer_batch_with_llm(
    title: str,
    abstract: str,
    authors: str,
    batch: List[ReviewerItem],
    batch_idx: int,
    total_batches: int,
    job_id: Optional[str] = None,
    base_pct: int = 15,
    span_pct: int = 80,
) -> list[dict]:
    reviewers_list_str = "\n".join(
        f"- ID: {r.id} | Name: {r.name} | Affiliation: {r.affiliation or 'Not listed'} | Active Reviews: {r.active_reviews} | Completed Reviews: {r.completed_reviews} | Declared Interests: {r.interests or 'None declared'}"
        for r in batch
    )
    prompt = f"""You are an expert academic editorial assistant. Evaluate and rank ALL {len(batch)} candidate peer reviewers below for this manuscript using ONLY the provided metadata.

MANUSCRIPT:
Title: {title}
Authors: {authors or 'Not listed'}
Abstract: {abstract}

CANDIDATE REVIEWERS (Batch {batch_idx + 1}/{total_batches}):
{reviewers_list_str}

INSTRUCTIONS:
1. Evaluate EVERY SINGLE reviewer listed above (total: {len(batch)} reviewers). Do not omit any ID.
2. Score topical compatibility from 0 to 100 based on their declared interests relative to the manuscript title and abstract.
3. Also consider reviewer workload (active reviews) and any apparent author/affiliation conflict of interest in your reasoning. If a candidate is one of the manuscript authors, assign score 0 and flag the Conflict of Interest clearly.
4. Provide a concise 1-2 sentence justification specific to each reviewer.
5. Output ONLY a raw valid JSON array containing exactly {len(batch)} objects:
[
  {{
    "id": reviewer_id_integer,
    "name": "Reviewer Name",
    "score": score_integer,
    "reason": "Specific justification..."
  }}
]
"""

    def on_tok(tokens: int, partial: str):
        if not job_id:
            return
        pct = min(96, base_pct + int((batch_idx / max(1, total_batches)) * span_pct) + min(int(span_pct / max(1, total_batches)) - 2, tokens // 25))
        update_job(
            job_id,
            percent=pct,
            stage=f"{MODEL_NAME} evaluating reviewers batch {batch_idx + 1}/{total_batches} ({tokens} tokens)...",
            tokens=tokens,
        )

    output_text, _ = await stream_ollama(
        prompt,
        options={"temperature": 0.1, "num_ctx": 4096, "num_predict": 1400},
        on_progress=on_tok,
        timeout=150.0,
    )
    return extract_json_array(output_text)


async def execute_recommend_reviewers(payload: RecommendRequest, job_id: Optional[str] = None) -> dict:
    if not payload.reviewers:
        res = {"success": True, "recommendations": [], "model": MODEL_NAME, "cached": False}
        if job_id:
            update_job(job_id, status="done", percent=100, stage="No candidate reviewers available.", result=res)
        return res

    cache_key = f"reviewers_v2:{payload.title.strip()[:60]}:{len(payload.reviewers)}"
    if job_id:
        update_job(job_id, percent=8, stage="Checking cached LLM matchmaking results...")

    if not payload.force_refresh:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT report, model_name, created_at FROM cached_reports WHERE file_path = ?", (cache_key,))
        row = cursor.fetchone()
        conn.close()
        if row:
            try:
                cached_recs = json.loads(row[0])
                if isinstance(cached_recs, list) and len(cached_recs) >= len(payload.reviewers):
                    res = {
                        "success": True,
                        "recommendations": cached_recs,
                        "model": row[1],
                        "cached": True,
                    }
                    if job_id:
                        update_job(job_id, status="done", percent=100, stage="Loaded cached LLM reviewer matchmaking.", result=res)
                    return res
            except Exception:
                pass

    batch_size = 5
    batches = [payload.reviewers[i : i + batch_size] for i in range(0, len(payload.reviewers), batch_size)]
    total_batches = len(batches)

    if job_id:
        update_job(
            job_id,
            percent=14,
            stage=f"Sending {len(payload.reviewers)} candidate profiles across {total_batches} LLM batch(es) to {MODEL_NAME}...",
        )

    recommendations: list[dict] = []
    for b_idx, batch in enumerate(batches):
        batch_recs = await evaluate_reviewer_batch_with_llm(
            payload.title,
            payload.abstract,
            payload.authors,
            batch,
            b_idx,
            total_batches,
            job_id=job_id,
        )
        recommendations.extend(batch_recs)

        # Retry missing IDs from this batch once with the LLM (never hardcoded fallback)
        returned_ids = {int(r["id"]) for r in recommendations if isinstance(r, dict) and str(r.get("id", "")).isdigit()}
        missing = [r for r in batch if r.id not in returned_ids]
        if missing:
            if job_id:
                update_job(job_id, stage=f"Re-querying {MODEL_NAME} for {len(missing)} remaining candidate(s)...")
            retry_recs = await evaluate_reviewer_batch_with_llm(
                payload.title,
                payload.abstract,
                payload.authors,
                missing,
                b_idx,
                total_batches,
                job_id=job_id,
            )
            recommendations.extend(retry_recs)

    # Deduplicate by reviewer id and verify LLM evaluated entries
    by_id: dict[int, dict] = {}
    name_map = {r.id: r.name for r in payload.reviewers}
    for r in recommendations:
        if not isinstance(r, dict) or "id" not in r:
            continue
        try:
            rid = int(r["id"])
        except Exception:
            continue
        if rid not in name_map:
            continue
        reason = r.get("reason") or r.get("justification") or ""
        try:
            score = int(round(float(r.get("score", 0))))
        except Exception:
            score = 0
        score = max(0, min(100, score))
        by_id[rid] = {
            "id": rid,
            "name": r.get("name") or name_map[rid],
            "score": score,
            "reason": reason,
            "justification": reason,
        }

    if not by_id:
        raise RuntimeError(f"Ollama ({MODEL_NAME}) did not return valid reviewer evaluations.")

    final_recs = sorted(by_id.values(), key=lambda x: x["score"], reverse=True)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT OR REPLACE INTO cached_reports (file_path, model_name, report, created_at)
        VALUES (?, ?, ?, ?)
    """, (cache_key, MODEL_NAME, json.dumps(final_recs), now_str))
    conn.commit()
    conn.close()

    res = {
        "success": True,
        "recommendations": final_recs,
        "model": MODEL_NAME,
        "cached": False,
    }
    if job_id:
        update_job(job_id, status="done", percent=100, stage=f"Matched {len(final_recs)} candidates via {MODEL_NAME}.", result=res)
    return res


@app.post("/api/recommend_reviewers/start")
async def start_recommend_reviewers(payload: RecommendRequest):
    job_id = create_job("recommend_reviewers", f"Preparing {len(payload.reviewers)} candidates for {MODEL_NAME}...")

    async def runner():
        try:
            await execute_recommend_reviewers(payload, job_id=job_id)
        except Exception as e:
            update_job(job_id, status="error", error=str(e), stage=f"LLM matchmaking failed: {str(e)}")

    asyncio.create_task(runner())
    return {"success": True, "job_id": job_id, "model": MODEL_NAME}


@app.post("/api/recommend_reviewers")
async def recommend_reviewers(payload: RecommendRequest):
    try:
        return await execute_recommend_reviewers(payload, job_id=None)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM Reviewer Matchmaking failed: {str(e)}")


# ── LLM Letter Drafting & Released Reviewer Persistence ──────────────────────
@app.post("/api/draft_author_letter")
async def draft_author_letter(payload: DraftAuthorLetterRequest):
    if not payload.annotations:
        raise HTTPException(status_code=400, detail="No feedback comments provided to synthesize.")

    notes_str = "\n".join(
        f"{idx}. Excerpt: \"{a.get('selected_text', '(General)')}\"\n   Comment: {a.get('comment', '')}"
        for idx, a in enumerate(payload.annotations, 1)
    )
    prompt = f"""You are an academic journal editor ({payload.editor_name}). Draft a clear, courteous, well-structured email letter to the author(s) of the manuscript "{payload.title}" (Submission #{payload.submission_id}) conveying the feedback from {payload.source_label}.

INLINE FEEDBACK TO INCLUDE:
{notes_str}

INSTRUCTIONS:
- Write a cohesive professional decision/feedback letter addressed to "Dear Author(s),".
- Preserve every numbered markup item clearly (quoting each manuscript excerpt and the feedback point).
- Conclude with clear revision and point-by-point response instructions signed by {payload.editor_name}.
- Output ONLY the plain-text email letter ready to send.
"""
    try:
        letter_text, tokens = await stream_ollama(
            prompt,
            options={"temperature": 0.3, "num_ctx": 4096, "num_predict": 900},
            timeout=120.0,
        )
        return {"success": True, "letter": letter_text, "model": MODEL_NAME, "tokens": tokens}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM letter generation failed: {str(e)}")


@app.post("/api/draft_release_letter")
async def draft_release_letter(payload: DraftReleaseLetterRequest):
    prompt = f"""You are an academic journal editor ({payload.editor_name}). Draft a courteous, appreciative plain-text email to reviewer Dr. {payload.reviewer_name} regarding the manuscript "{payload.title}" (Submission #{payload.submission_id}).

CONTEXT:
The journal has already received the required quota of peer reviews for this submission round, so Dr. {payload.reviewer_name} is kindly released from completing their review.

INSTRUCTIONS:
- Keep it warm, concise, and professional.
- Clearly reference the manuscript title and thank them for their willingness to serve.
- Sign off as {payload.editor_name}.
- Output ONLY the plain-text email body.
"""
    try:
        letter_text, tokens = await stream_ollama(
            prompt,
            options={"temperature": 0.3, "num_ctx": 2048, "num_predict": 400},
            timeout=90.0,
        )
        return {"success": True, "letter": letter_text, "model": MODEL_NAME, "tokens": tokens}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM release email generation failed: {str(e)}")


@app.get("/api/released_reviewers")
async def get_released_reviewers(submission_id: int = Query(...)):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        "SELECT submission_id, reviewer_id, reviewer_name, released_by, released_at FROM released_reviewers WHERE submission_id = ?",
        (submission_id,),
    )
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"success": True, "released": rows}


@app.post("/api/released_reviewers")
async def mark_released_reviewer(payload: ReleaseReviewerCreate):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT OR REPLACE INTO released_reviewers (submission_id, reviewer_id, reviewer_name, released_by, released_at)
        VALUES (?, ?, ?, ?, ?)
    """, (payload.submission_id, payload.reviewer_id, payload.reviewer_name, payload.released_by, now_str))
    conn.commit()
    conn.close()
    return {"success": True, "submission_id": payload.submission_id, "reviewer_id": payload.reviewer_id}


# ── Real Cached AI Status Lookup for OJS Dashboard ───────────────────────────
@app.post("/api/dashboard_statuses")
async def get_dashboard_statuses(payload: DashboardStatusesRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    statuses = {}
    for item in payload.items:
        sid = str(item.submission_id)
        fp = item.file_path
        if not fp:
            statuses[sid] = {"screened": False, "verdict": "NOT SCREENED", "model": ""}
            continue
        # Match exact path or normalized separator variant
        norm_fwd = fp.replace("\\", "/")
        norm_back = fp.replace("/", "\\")
        cursor.execute(
            "SELECT report, model_name, created_at FROM cached_reports WHERE file_path IN (?, ?, ?) LIMIT 1",
            (fp, norm_fwd, norm_back),
        )
        row = cursor.fetchone()
        if row:
            statuses[sid] = {
                "screened": True,
                "verdict": parse_verdict_from_report(row[0]),
                "model": row[1],
                "cached_at": row[2],
            }
        else:
            statuses[sid] = {"screened": False, "verdict": "NOT SCREENED", "model": ""}
    conn.close()
    return {"success": True, "statuses": statuses, "model": MODEL_NAME}
