import os
import re
import mammoth
from pypdf import PdfReader

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

def render_file_to_blocks(file_path: str) -> dict:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    filename = os.path.basename(file_path)
    ext = os.path.splitext(file_path)[1].lower()

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
        # Fallback text rendering
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        html_blocks = []
        for i, line in enumerate(lines):
            line = line.strip()
            if line:
                pid = f"p-{i}"
                escaped = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                html_blocks.append(f'<p id="{pid}" data-pid="{pid}">{escaped}</p>')
        return {
            "success": True,
            "filename": filename,
            "format": "text",
            "html": "".join(html_blocks),
            "total_blocks": len(html_blocks),
        }
