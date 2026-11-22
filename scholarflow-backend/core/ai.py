import os
import json
import re
import httpx
from typing import List, Optional

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
OLLAMA_TAGS_URL = os.getenv("OLLAMA_TAGS_URL", "http://127.0.0.1:11434/api/tags")
MODEL_NAME = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")

async def call_ollama(prompt: str, options: Optional[dict] = None, timeout: float = 120.0) -> str:
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "options": options or {"temperature": 0.2, "num_ctx": 4096, "num_predict": 900},
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
        if resp.status_code != 200:
            raise RuntimeError(f"Ollama HTTP {resp.status_code}: {resp.text[:200]}")
        data = resp.json()
        return data.get("response", "").strip()

async def prescreen_manuscript(title: str, abstract: str, keywords: str = "", authors: str = "") -> dict:
    prompt = f"""You are an expert academic editor. Perform a concise, rigorous editorial pre-screening of this manuscript based strictly on its submitted title, abstract, and metadata.
STRICT PRIVACY POLICY: You have zero access to the full paper, manuscript files, or journal contents. Your pre-screening evaluation is conducted strictly and solely on the basis of the abstract and submitted metadata beyond the paper (Title, Authors, Keywords). Evaluate readiness for peer review based on the submitted research scope, objectives, and abstract.
Format strictly in Markdown with these EXACT 5 section headers:

### 1. Scope & Journal Fit
- 2-3 sentences evaluating topic alignment and relevance for peer-reviewed academic publication.

### 2. Methodological Rigor & Technical Soundness
- Bullet points detailing strengths and methodological validity outlined in the abstract and metadata.

### 3. Novelty & Academic Contribution
- What makes this research significant and original based on the declared objectives and abstract.

### 4. Critical Flaws / Missing Elements
- Potential gaps, missing parameters, or clarifications needed prior to peer review based on the abstract.

### 5. Recommendation
- State clearly in bold one of: **PROCEED TO PEER REVIEW**, **MINOR REVISION**, **MAJOR REVISION**, or **DESK REJECT**, followed by a 2-sentence rationale.

---
MANUSCRIPT SUBMISSION METADATA:
Title: {title or 'Not specified'}
Authors: {authors or 'Not declared'}
Keywords: {keywords or 'Not declared'}
Abstract:
{abstract or 'No abstract provided'}
"""
    report = await call_ollama(prompt, options={"temperature": 0.2, "num_predict": 900, "num_ctx": 4096})
    
    # Extract recommendation
    rec = "UNDER REVIEW"
    up = report.upper()
    if "PROCEED TO PEER REVIEW" in up:
        rec = "PROCEED TO PEER REVIEW"
    elif "DESK REJECT" in up:
        rec = "DESK REJECT"
    elif "MAJOR REVISION" in up:
        rec = "MAJOR REVISION"
    elif "MINOR REVISION" in up:
        rec = "MINOR REVISION"

    return {
        "success": True,
        "model": MODEL_NAME,
        "recommendation": rec,
        "report": report
    }

async def match_reviewers(title: str, abstract: str, authors: str, keywords: str, reviewers: List[dict]) -> List[dict]:
    if not reviewers:
        return []

    reviewers_list_str = "\n".join(
        f"- ID: {r['id']} | Name: {r['name']} | Affiliation: {r.get('affiliation', 'Not listed')} | Active Reviews: {r.get('active_reviews', 0)} | Completed Reviews: {r.get('completed_reviews', 0)} | Declared Interests: {r.get('interests', 'None declared')}"
        for r in reviewers
    )

    prompt = f"""You are an expert academic editorial assistant. Evaluate and rank ALL {len(reviewers)} candidate peer reviewers below for this manuscript.
STRICT PRIVACY POLICY: You have zero access to the journal, full paper body, or manuscript files. Reviewer matchmaking must be conducted strictly and solely on the basis of the knowledge provided by the Abstract and the submitted metadata beyond the paper (Title, Authors, Keywords) matched against each candidate reviewer's declared research interests, expertise, and workload.

MANUSCRIPT METADATA:
Title: {title}
Authors: {authors or 'Not listed'}
Keywords: {keywords or 'Not listed'}
Abstract:
{abstract or 'No abstract provided'}

CANDIDATE REVIEWERS:
{reviewers_list_str}

INSTRUCTIONS:
1. Evaluate EVERY SINGLE reviewer listed above (total: {len(reviewers)} reviewers). Do not omit any ID.
2. Score topical compatibility from 0 to 100 based strictly on their declared interests and expertise relative to the manuscript abstract and metadata.
3. Also consider reviewer workload (active reviews) and any apparent author/affiliation conflict of interest in your reasoning. If a candidate is one of the manuscript authors, assign score 0 and flag the Conflict of Interest clearly.
4. Provide a concise 1-2 sentence justification specific to each reviewer explaining the topical alignment between their declared knowledge and the manuscript abstract.
5. Output ONLY a raw valid JSON array containing exactly {len(reviewers)} objects:
[
  {{
    "id": reviewer_id_integer,
    "name": "Reviewer Name",
    "score": score_integer,
    "reason": "Specific justification..."
  }}
]
"""
    raw_response = await call_ollama(prompt, options={"temperature": 0.1, "num_predict": 1200, "num_ctx": 4096})
    
    # Parse JSON array
    clean_text = re.sub(r"^```json\s*", "", raw_response.strip(), flags=re.IGNORECASE)
    clean_text = re.sub(r"\s*```$", "", clean_text, flags=re.IGNORECASE).strip()
    
    try:
        results = json.loads(clean_text)
        if isinstance(results, dict) and "recommendations" in results:
            results = results["recommendations"]
        if not isinstance(results, list):
            results = []
    except Exception:
        # Fallback parsing
        match = re.search(r"\[\s*\{.*\}\s*\]", raw_response, re.DOTALL)
        if match:
            try:
                results = json.loads(match.group(0))
            except Exception:
                results = []
        else:
            results = []

    # Map back with metadata
    res_map = {r.get("id"): r for r in results if isinstance(r, dict) and "id" in r}
    merged = []
    for cand in reviewers:
        cid = cand["id"]
        ev = res_map.get(cid, {})
        merged.append({
            "id": cid,
            "name": cand["name"],
            "affiliation": cand.get("affiliation", ""),
            "interests": cand.get("interests", ""),
            "active_reviews": cand.get("active_reviews", 0),
            "completed_reviews": cand.get("completed_reviews", 0),
            "score": ev.get("score", 60),
            "reason": ev.get("reason", "Topical alignment with manuscript subject scope.")
        })

    # Sort descending by score
    merged.sort(key=lambda x: x["score"], reverse=True)
    return merged
