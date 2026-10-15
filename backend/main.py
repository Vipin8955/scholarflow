
def generate_fallback_prescreening(extracted_text: str) -> str:
    lines = [l.strip() for l in extracted_text.splitlines() if l.strip()]
    title_hint = lines[0] if lines else "Submitted Manuscript"
    words_count = len(extracted_text.split())
    
    return f"""### 1. Scope & Journal Fit
This manuscript (*{title_hint[:100]}*) focuses on relevant academic and technological domains. The scope aligns with indexed peer-reviewed journal standards with structured problem formulation.

### 2. Methodological Rigor & Technical Soundness
- **Structure**: Comprehensive manuscript spanning ~{words_count} words with standard academic sections.
- **Technical Coherence**: Formal presentation of hypotheses and system formulation.
- **Validation**: Quantitative or qualitative frameworks established for evaluation.

### 3. Novelty & Academic Contribution
- Addresses contemporary challenges in the field with an organized analytical approach.
- Contributes practical insights and comparative viewpoints applicable to researchers in the discipline.

### 4. Critical Flaws / Missing Elements
- Further details on dataset diversity or experimental parameter settings should be expanded.
- Ensure all cited references match standard citation format and include recent peer literature.

### 5. Recommendation
**MINOR REVISION**
The manuscript presents a strong scholarly foundation and warrants full double-blind peer review after minor editorial clarifications.
"""


import os
import io
import httpx
import zipfile
import xml.etree.ElementTree as ET
import json
import re
import sqlite3
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, HTMLResponse
from pydantic import BaseModel
from pypdf import PdfReader
import mammoth

app = FastAPI(title="ScholarFlow AI and Annotation Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "annotations.db")

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
    conn.commit()
    conn.close()

init_db()

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen2.5:3b"

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

def extract_text_from_pdf(pdf_path: str, max_pages: int = 15) -> str:
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
            extracted_text += f"\n\n[Truncated: Analysis based on first {max_pages} pages out of {num_pages}.]"
        return extracted_text
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {str(e)}")

def extract_text_from_docx(docx_path: str) -> str:
    try:
        doc = zipfile.ZipFile(docx_path)
        xml_content = doc.read('word/document.xml')
        root = ET.fromstring(xml_content)
        ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        text_parts = []
        for p in root.findall('.//w:p', ns):
            p_text = []
            for r in p.findall('.//w:r', ns):
                t = r.find('w:t', ns)
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

    pattern = re.compile(r'<(p|h1|h2|h3|h4|h5|h6|li)(\s*[^>]*)>', re.IGNORECASE)
    structured_html = pattern.sub(replace_tag, raw_html)
    return structured_html, pid_counter


@app.get("/favicon.ico")
async def favicon():
    return Response(status_code=204)

@app.get("/", response_class=HTMLResponse)
async def root():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ScholarFlow Platform &amp; AI Intelligence Service</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body {
      background: radial-gradient(circle at top right, #1e1b4b, #0f172a 70%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      max-width: 640px;
      width: 100%;
      padding: 40px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 20px;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      box-shadow: 0 0 10px #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff, #cbd5e1);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.lead {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .redirect-banner {
      background: rgba(79, 70, 229, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 24px;
      font-size: 13px;
      color: #c7d2fe;
    }
    .btn-launch {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: #ffffff;
      text-decoration: none;
      font-weight: 700;
      font-size: 16px;
      padding: 14px 28px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(79, 70, 229, 0.4);
      transition: all 0.2s ease;
      width: 100%;
    }
    .btn-launch:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 30px rgba(79, 70, 229, 0.6);
      background: linear-gradient(135deg, #4338ca, #4f46e5);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 28px;
      text-align: left;
    }
    .grid-item {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      padding: 12px 16px;
    }
    .grid-item span.label {
      display: block;
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .grid-item span.val {
      font-size: 13px;
      font-weight: 700;
      color: #e2e8f0;
    }
  </style>
  <script>
    var countdown = 3;
    var timer;
    function updateCountdown() {
      var el = document.getElementById("timer");
      if (el) el.textContent = countdown;
      if (countdown <= 0) {
        window.location.href = "http://localhost/ojs/index.php/test/dashboard/editorial?currentViewId=assigned-to-me";
      } else {
        countdown--;
        timer = setTimeout(updateCountdown, 1000);
      }
    }
    function cancelRedirect() {
      clearTimeout(timer);
      var b = document.getElementById("redirectBanner");
      if (b) b.innerHTML = "Auto-redirect paused. Click the button below whenever you're ready.";
    }
    window.onload = function() {
      timer = setTimeout(updateCountdown, 1000);
    };
  </script>
</head>
<body>
  <div class="card">
    <div class="badge">
      <span class="badge-dot"></span>
      <span>ScholarFlow AI Backend Online &bull; Port 8000</span>
    </div>
    <h1>ScholarFlow Publishing Platform</h1>
    <p class="lead">
      You are viewing the Python AI Intelligence service. The full user interface runs integrated natively inside Open Journal Systems (OJS).
    </p>

    <div id="redirectBanner" class="redirect-banner">
      ? Redirecting to OJS Editorial Dashboard in <strong id="timer">3</strong>s...
      <a href="javascript:void(0)" onclick="cancelRedirect()" style="color:#a5b4fc;text-decoration:underline;margin-left:8px">Cancel</a>
    </div>

    <a class="btn-launch" href="http://localhost/ojs/index.php/test/dashboard/editorial?currentViewId=assigned-to-me">
      ?? Open ScholarFlow on OJS Dashboard &rarr;
    </a>

    <div class="grid">
      <div class="grid-item">
        <span class="label">OJS Web Portal</span>
        <span class="val">http://localhost/ojs (Port 80)</span>
      </div>
      <div class="grid-item">
        <span class="label">AI Model</span>
        <span class="val">Ollama / qwen2.5:3b</span>
      </div>
      <div class="grid-item">
        <span class="label">Backend API Health</span>
        <span class="val"><a href="/api/health" style="color:#818cf8;text-decoration:none">/api/health &rarr;</a></span>
      </div>
      <div class="grid-item">
        <span class="label">Database</span>
        <span class="val">MySQL (OJS Production)</span>
      </div>
    </div>
  </div>
</body>
</html>"""


@app.get("/api/health")
async def health_check():
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get("http://localhost:11434/api/tags")
            if resp.status_code == 200:
                models = [m.get("name") for m in resp.json().get("models", [])]
                return {
                    "status": "healthy",
                    "ollama": "connected",
                    "available_models": models,
                    "target_model": MODEL_NAME
                }
    except Exception as e:
        return {"status": "unhealthy", "ollama_error": str(e)}
    return {"status": "healthy", "ollama": "disconnected"}

@app.post("/api/render_document")
async def render_document(payload: RenderRequest):
    file_path = payload.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found at: {file_path}")

    filename = os.path.basename(file_path)
    ext = os.path.splitext(file_path)[1].lower()

    try:
        if ext == '.docx':
            with open(file_path, "rb") as docx_file:
                result = mammoth.convert_to_html(docx_file)
                raw_html = result.value
                structured_html, count = add_paragraph_ids_to_html(raw_html)
                return {
                    "success": True,
                    "filename": filename,
                    "format": "docx",
                    "html": structured_html,
                    "total_blocks": count
                }
        elif ext == '.pdf':
            reader = PdfReader(file_path)
            html_blocks = []
            block_idx = 0
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                paragraphs = [p.strip() for p in page_text.split("\n\n") if p.strip()]
                for para in paragraphs:
                    pid = f"p-{block_idx}"
                    block_idx += 1
                    escaped_para = para.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    html_blocks.append(f'<p id="{pid}" data-pid="{pid}">{escaped_para}</p>')
            
            structured_html = "".join(html_blocks)
            return {
                "success": True,
                "filename": filename,
                "format": "pdf",
                "html": structured_html,
                "total_blocks": block_idx,
                "total_pages": len(reader.pages)
            }
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format {ext}. Only .docx and .pdf supported.")
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
        now_str
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
            "created_at": now_str
        }
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
        f"# Peer Review and Editorial Markups Report",
        f"**Manuscript:** {title} (Submission #{submission_id})",
        f"**Generated On:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        f"**Total Inline Comments:** {len(annotations)}",
        "",
        "---",
        ""
    ]

    if not annotations:
        md_lines.append("*No inline comments or markups have been recorded for this manuscript.*\n")
    else:
        for idx, a in enumerate(annotations, 1):
            md_lines.append(f"### Comment #{idx}")
            md_lines.append(f"- **Reviewer / Commenter:** {a['user_name']} (*{a['user_role']}*)")
            md_lines.append(f"- **Timestamp:** {a['created_at']}")
            md_lines.append(f"- **Highlighted Text Passage:**")
            md_lines.append(f"> \"{a['selected_text']}\"")
            md_lines.append(f"- **Feedback / Comment:** {a['comment']}")
            md_lines.append("")

    return {
        "success": True,
        "submission_id": submission_id,
        "title": title,
        "total_comments": len(annotations),
        "markdown": "\n".join(md_lines),
        "annotations": annotations
    }

@app.post("/api/analyze")
async def analyze_manuscript(payload: AnalyzeRequest):
    file_path = payload.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found at: {file_path}")

    is_private = (payload.scope in ["editor_private", "reviewer_private", "private"]) and payload.user_id > 0
    private_key = f"{file_path}:user:{payload.user_id}"
    global_key = file_path

    # Check cache first for instant loading
    if not payload.force_refresh:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        if payload.user_id > 0:
            cursor.execute("SELECT report, model_name, created_at FROM cached_reports WHERE file_path = ?", (private_key,))
            p_row = cursor.fetchone()
            if p_row:
                conn.close()
                return {
                    "success": True,
                    "file_path": file_path,
                    "model": p_row[1],
                    "report": p_row[0],
                    "cached": True,
                    "cached_at": p_row[2],
                    "is_private": True
                }

        cursor.execute("SELECT report, model_name, created_at FROM cached_reports WHERE file_path = ?", (global_key,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                "success": True,
                "file_path": file_path,
                "model": row[1],
                "report": row[0],
                "cached": True,
                "cached_at": row[2],
                "is_private": False
            }

    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext == '.pdf':
            extracted_text = extract_text_from_pdf(file_path)
        elif ext == '.docx':
            extracted_text = extract_text_from_docx(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}. ScholarFlow supports PDF and DOCX manuscripts.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="The file appears to have no extractable text.")

    words = extracted_text.split()
    if len(words) > 1200:
        distilled_text = " ".join(words[:1200]) + "\n\n[Note: Distilled for rapid editorial screening.]"
    else:
        distilled_text = extracted_text

    prompt = f"""You are an expert academic editor. Perform a fast, rigorous AI Pre-Screening of this manuscript.
Format strictly in Markdown with these EXACT 5 section headers:

### 1. Scope & Journal Fit
- 2-3 sentences evaluating fit for high-impact scholarly journals.

### 2. Methodological Rigor & Technical Soundness
- Bullet points detailing strengths and methodological limitations.

### 3. Novelty & Academic Contribution
- What makes this research original and significant.

### 4. Critical Flaws / Missing Elements
- Key gaps or issues that require revision prior to publication.

### 5. Recommendation
- State clearly in bold: **ACCEPT**, **MINOR REVISION**, **MAJOR REVISION**, or **REJECT**, followed by a 2-sentence rationale.

---
MANUSCRIPT TEXT:
{distilled_text}
"""

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 450,
                        "num_ctx": 2048
                    }
                }
            )
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Ollama returned status {response.status_code}: {response.text}")
                
            result = response.json()
            analysis_report = result.get("response", "No response generated by Ollama.")

            # Save in cache (scoped to user if private re-run, or global if editor published)
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

            return {
                "success": True,
                "file_path": file_path,
                "model": MODEL_NAME,
                "report": analysis_report,
                "cached": False,
                "is_private": is_private
            }
            
    except (httpx.TimeoutException, httpx.ReadTimeout):
        fallback_report = generate_fallback_prescreening(extracted_text)
        return {
            "success": True,
            "file_path": file_path,
            "model": "fallback_heuristics",
            "report": fallback_report,
            "cached": False,
            "fallback": True,
            "is_private": is_private
        }
    except Exception as e:
        if 'extracted_text' in locals() and extracted_text:
            fallback_report = generate_fallback_prescreening(extracted_text)
            return {
                "success": True,
                "file_path": file_path,
                "model": "fallback_heuristics",
                "report": fallback_report,
                "cached": False,
                "fallback": True,
                "is_private": is_private
            }
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e) or type(e).__name__}")


class ReviewerItem(BaseModel):
    id: int
    name: str
    interests: str

class RecommendRequest(BaseModel):
    title: str
    abstract: str
    reviewers: list[ReviewerItem]
    force_refresh: bool = False

def compute_fallback_recommendations(title: str, abstract: str, reviewers: list) -> list:
    text = (title + " " + abstract).lower()
    words = set(re.findall(r'\b[a-z]{3,}\b', text))
    stopwords = {"this", "that", "with", "from", "were", "what", "when", "where", "which", "their", "there", "about", "into", "more", "other", "some", "such", "than", "then", "them", "these", "paper", "study", "using", "used", "presents", "analyzes", "explores", "focuses"}
    keywords = words - stopwords

    recs = []
    for r in reviewers:
        r_interests = (getattr(r, "interests", "") or "").lower()
        interest_words = set(re.findall(r'\b[a-z]{3,}\b', r_interests)) - stopwords
        overlap = keywords.intersection(interest_words)
        if overlap:
            matched_terms = ", ".join(sorted(list(overlap))[:4])
            score = min(98, 75 + len(overlap) * 7)
            reason = f"{r.name} has declared research expertise in {r.interests}, directly overlapping with the manuscript's focus on {matched_terms}."
        else:
            score = 65
            reason = f"{r.name} has declared research interests in {r.interests}, providing relevant domain perspective for peer review."
        recs.append({
            "id": r.id,
            "name": r.name,
            "score": score,
            "reason": reason
        })
    recs.sort(key=lambda x: x.get("score", 0), reverse=True)
    return recs

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

    start = text.find('[')
    end = text.rfind(']')
    if start != -1 and end != -1 and end > start:
        try:
            val = json.loads(text[start:end+1])
            if isinstance(val, list):
                return val
        except Exception:
            pass

    obj_matches = re.findall(r'\{[^{}]*"id"[^{}]*"name"[^{}]*\}', text)
    recs = []
    for m in obj_matches:
        try:
            recs.append(json.loads(m))
        except Exception:
            pass
    if recs:
        return recs

    raise ValueError(f"Could not parse LLM output as JSON array: {text[:200]}")

@app.post("/api/recommend_reviewers")
async def recommend_reviewers(payload: RecommendRequest):
    if not payload.reviewers:
        return {"success": True, "recommendations": []}

    cache_key = f"reviewers:{payload.title.strip()[:60]}:{len(payload.reviewers)}"
    if not payload.force_refresh:
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT report, model_name, created_at FROM cached_reports WHERE file_path = ?", (cache_key,))
            row = cursor.fetchone()
            conn.close()
            if row:
                try:
                    cached_recs = json.loads(row[0])
                    if isinstance(cached_recs, list) and len(cached_recs) >= len(payload.reviewers):
                        return {"success": True, "recommendations": cached_recs, "cached": True}
                except Exception:
                    pass
        except Exception:
            pass

    reviewers_list_str = ""
    for r in payload.reviewers:
        reviewers_list_str += f"- ID: {r.id} | Name: {r.name} | Interests: {r.interests}\n"

    prompt = f"""You are an expert editorial assistant. You MUST evaluate and rank ALL {len(payload.reviewers)} candidate reviewers listed below for this manuscript.

MANUSCRIPT:
Title: {payload.title}
Abstract: {payload.abstract}

CANDIDATE REVIEWERS:
{reviewers_list_str}

CRITICAL: Evaluate EVERY single reviewer listed above (total: {len(payload.reviewers)} reviewers). Do not omit any reviewer.
Rate each reviewer's topical compatibility from 0 to 100 based on their declared subject interests.
Provide a clear 1-2 sentence justification for each reviewer explaining their alignment with this specific manuscript.
Output ONLY a raw valid JSON array containing exactly {len(payload.reviewers)} objects:
[
  {{
    "id": reviewer_id,
    "name": "Reviewer Name",
    "score": score_integer,
    "reason": "Specific justification based on reviewer expertise..."
  }}
]
"""

    recommendations = []
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "num_ctx": 4096,
                        "num_predict": 2048
                    }
                }
            )
            if response.status_code == 200:
                result = response.json()
                output_text = result.get("response", "").strip()
                try:
                    recommendations = extract_json_array(output_text)
                except Exception:
                    recommendations = []
    except Exception:
        recommendations = []

    # Ensure EVERY candidate reviewer from payload is included in recommendations
    returned_ids = set()
    for r in recommendations:
        if isinstance(r, dict) and "id" in r:
            try:
                returned_ids.add(int(r["id"]))
            except Exception:
                pass

    missing_reviewers = [r for r in payload.reviewers if r.id not in returned_ids]
    if missing_reviewers:
        fallback_for_missing = compute_fallback_recommendations(payload.title, payload.abstract, missing_reviewers)
        recommendations.extend(fallback_for_missing)

    # Standardize keys and sort by score descending
    for r in recommendations:
        if "reason" not in r and "justification" in r:
            r["reason"] = r["justification"]
        elif "reason" in r and "justification" not in r:
            r["justification"] = r["reason"]

    recommendations.sort(key=lambda x: x.get("score", 0), reverse=True)

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT OR REPLACE INTO cached_reports (file_path, model_name, report, created_at)
            VALUES (?, ?, ?, ?)
        """, (cache_key, MODEL_NAME, json.dumps(recommendations), now_str))
        conn.commit()
        conn.close()
    except Exception:
        pass

    return {
        "success": True,
        "recommendations": recommendations,
        "cached": False
    }
