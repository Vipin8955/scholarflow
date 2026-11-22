import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from core.database import get_db
from core.config import settings
from core.deps import get_current_user, require_roles
from models.user import User, UserRole, ReviewerExpertise
from models.journal import Journal
from models.manuscript import Manuscript, ManuscriptFile, ManuscriptAuthor, Annotation, ScreeningReport
from models.review import ReviewAssignment
from core.document import render_file_to_blocks
from core.ai import prescreen_manuscript, match_reviewers

router = APIRouter(prefix="/manuscripts", tags=["Manuscripts Management"])

class AuthorItem(BaseModel):
    full_name: str
    email: str
    affiliation: Optional[str] = None
    is_corresponding: Optional[int] = 0

class ManuscriptCreate(BaseModel):
    journal_id: int
    section_id: Optional[int] = None
    title: str
    abstract: Optional[str] = None
    keywords: Optional[str] = None
    co_authors: Optional[List[AuthorItem]] = []

class FileResponse(BaseModel):
    id: int
    original_filename: str
    file_type: str
    file_size: Optional[int] = None
    version: int

    class Config:
        from_attributes = True

class ManuscriptResponse(BaseModel):
    id: int
    journal_id: int
    title: str
    abstract: Optional[str] = None
    keywords: Optional[str] = None
    status: str
    author_id: int
    created_at: str
    files: List[FileResponse] = []

    class Config:
        from_attributes = True

@router.post("", response_model=dict)
def submit_manuscript(data: ManuscriptCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    journal = db.query(Journal).filter(Journal.id == data.journal_id, Journal.is_active == True).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal not found")
        
    manuscript = Manuscript(
        journal_id=data.journal_id,
        section_id=data.section_id,
        author_id=current_user.id,
        title=data.title,
        abstract=data.abstract,
        keywords=data.keywords,
        status="submitted"
    )
    db.add(manuscript)
    db.commit()
    db.refresh(manuscript)
    
    # Add primary author
    primary_author = ManuscriptAuthor(
        manuscript_id=manuscript.id,
        full_name=current_user.full_name,
        email=current_user.email,
        affiliation=current_user.affiliation,
        is_corresponding=1
    )
    db.add(primary_author)
    
    # Add any co-authors
    if data.co_authors:
        for ca in data.co_authors:
            db.add(ManuscriptAuthor(
                manuscript_id=manuscript.id,
                full_name=ca.full_name,
                email=ca.email,
                affiliation=ca.affiliation,
                is_corresponding=ca.is_corresponding or 0
            ))
            
    db.commit()
    
    return {
        "message": "Manuscript created successfully",
        "manuscript_id": manuscript.id,
        "title": manuscript.title,
        "status": manuscript.status
    }

@router.post("/{manuscript_id}/files")
def upload_manuscript_file(
    manuscript_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    manuscript = db.query(Manuscript).filter(Manuscript.id == manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")
        
    user_roles = [r.role_name for r in current_user.roles]
    if manuscript.author_id != current_user.id and "super_admin" not in user_roles and "associate_editor" not in user_roles:
        raise HTTPException(status_code=403, detail="Not authorized to upload files to this manuscript")
        
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ["pdf", "docx"]:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are allowed")
        
    target_dir = os.path.join(settings.MANUSCRIPTS_DIR, str(manuscript.journal_id), str(manuscript.id))
    os.makedirs(target_dir, exist_ok=True)
    
    # Determine version
    current_version = len(manuscript.files) + 1
    safe_filename = f"v{current_version}_{file.filename}"
    target_path = os.path.join(target_dir, safe_filename)
    
    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    file_size = os.path.getsize(target_path)
    
    mfile = ManuscriptFile(
        manuscript_id=manuscript.id,
        file_path=target_path,
        original_filename=file.filename,
        file_type=ext,
        file_size=file_size,
        version=current_version
    )
    db.add(mfile)
    db.commit()
    db.refresh(mfile)
    
    return {
        "message": "File uploaded successfully",
        "file_id": mfile.id,
        "filename": file.filename,
        "version": current_version,
        "size_bytes": file_size
    }

@router.get("")
def list_manuscripts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_roles = [r.role_name for r in current_user.roles]
    
    if "super_admin" in user_roles or "associate_editor" in user_roles:
        # Editors and admins see all manuscripts
        manuscripts = db.query(Manuscript).order_by(Manuscript.created_at.desc()).all()
    else:
        # Authors only see their own manuscripts! Strict isolation!
        manuscripts = db.query(Manuscript).filter(Manuscript.author_id == current_user.id).order_by(Manuscript.created_at.desc()).all()
        
    return [
        {
            "id": m.id,
            "journal_id": m.journal_id,
            "journal_title": m.journal.title if m.journal else None,
            "journal_path": m.journal.path if m.journal else None,
            "title": m.title,
            "abstract": m.abstract,
            "keywords": m.keywords,
            "status": m.status,
            "author_id": m.author_id,
            "author_name": m.author.full_name if m.author else None,
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "files_count": len(m.files)
        }
        for m in manuscripts
    ]

@router.get("/{manuscript_id}")
def get_manuscript(manuscript_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    manuscript = db.query(Manuscript).filter(Manuscript.id == manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")
        
    user_roles = [r.role_name for r in current_user.roles]
    # Check permissions: Author of this paper, or reviewer assigned, or editor/admin
    if manuscript.author_id != current_user.id and "super_admin" not in user_roles and "associate_editor" not in user_roles:
        # Check if user is an assigned reviewer
        is_assigned = any(a.reviewer_id == current_user.id for a in manuscript.assignments)
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Access denied to this manuscript")
            
    return {
        "id": manuscript.id,
        "journal_id": manuscript.journal_id,
        "journal_title": manuscript.journal.title if manuscript.journal else None,
        "title": manuscript.title,
        "abstract": manuscript.abstract,
        "keywords": manuscript.keywords,
        "status": manuscript.status,
        "author": {
            "id": manuscript.author.id,
            "name": manuscript.author.full_name,
            "email": manuscript.author.email,
            "affiliation": manuscript.author.affiliation
        } if manuscript.author else None,
        "co_authors": [
            {"name": ca.full_name, "email": ca.email, "affiliation": ca.affiliation}
            for ca in manuscript.authors
        ],
        "files": [
            {
                "id": f.id,
                "filename": f.original_filename,
                "file_type": f.file_type,
                "file_size": f.file_size,
                "version": f.version
            }
            for f in manuscript.files
        ],
        "created_at": manuscript.created_at.isoformat() if manuscript.created_at else None
    }

class AnnotationInput(BaseModel):
    selected_text: str
    comment: str
    color: Optional[str] = "yellow"
    paragraph_id: Optional[str] = None
    confidential_to_editor: Optional[bool] = False

@router.get("/{manuscript_id}/document")
def get_manuscript_document(manuscript_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    manuscript = db.query(Manuscript).filter(Manuscript.id == manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")
        
    user_roles = [r.role_name for r in current_user.roles]
    if manuscript.author_id != current_user.id and "super_admin" not in user_roles and "associate_editor" not in user_roles:
        is_assigned = any(a.reviewer_id == current_user.id for a in manuscript.assignments)
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Access denied")

    # If there is an uploaded file, render it
    latest_file = manuscript.files[-1] if manuscript.files else None
    if latest_file and os.path.exists(latest_file.file_path):
        try:
            rendered = render_file_to_blocks(latest_file.file_path)
        except Exception as e:
            rendered = {
                "success": False,
                "error": str(e),
                "html": f"<p id='p-0' data-pid='p-0'><strong>{manuscript.title}</strong></p><p id='p-1' data-pid='p-1'>{manuscript.abstract or ''}</p>",
                "total_blocks": 2
            }
    else:
        # Fallback generated HTML from manuscript metadata
        rendered = {
            "success": True,
            "filename": "Abstract_Preview",
            "format": "html",
            "html": f"<h1 id='p-0' data-pid='p-0'>{manuscript.title}</h1><p id='p-1' data-pid='p-1'><strong>Abstract:</strong> {manuscript.abstract or 'No abstract provided.'}</p><p id='p-2' data-pid='p-2'><strong>Keywords:</strong> {manuscript.keywords or 'N/A'}</p>",
            "total_blocks": 3
        }

    # Fetch annotations
    annots = db.query(Annotation).filter(Annotation.manuscript_id == manuscript_id).all()
    # Filter confidential comments if current user is author
    filtered_annots = []
    for a in annots:
        if a.confidential_to_editor and "super_admin" not in user_roles and "associate_editor" not in user_roles:
            continue
        filtered_annots.append({
            "id": a.id,
            "manuscript_id": a.manuscript_id,
            "user_id": a.user_id,
            "user_name": a.user_name,
            "user_role": a.user_role,
            "selected_text": a.selected_text,
            "comment": a.comment,
            "color": a.color,
            "paragraph_id": a.paragraph_id,
            "confidential_to_editor": bool(a.confidential_to_editor),
            "created_at": a.created_at.isoformat() if a.created_at else None
        })

    return {
        "success": True,
        "manuscript_id": manuscript.id,
        "title": manuscript.title,
        "rendered": rendered,
        "annotations": filtered_annots
    }

@router.get("/{manuscript_id}/annotations")
def list_annotations(manuscript_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_roles = [r.role_name for r in current_user.roles]
    annots = db.query(Annotation).filter(Annotation.manuscript_id == manuscript_id).all()
    res = []
    for a in annots:
        if a.confidential_to_editor and "super_admin" not in user_roles and "associate_editor" not in user_roles:
            continue
        res.append({
            "id": a.id,
            "manuscript_id": a.manuscript_id,
            "user_id": a.user_id,
            "user_name": a.user_name,
            "user_role": a.user_role,
            "selected_text": a.selected_text,
            "comment": a.comment,
            "color": a.color,
            "paragraph_id": a.paragraph_id,
            "confidential_to_editor": bool(a.confidential_to_editor),
            "created_at": a.created_at.isoformat() if a.created_at else None
        })
    return res

@router.post("/{manuscript_id}/annotations")
def add_annotation(manuscript_id: int, payload: AnnotationInput, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    manuscript = db.query(Manuscript).filter(Manuscript.id == manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")

    user_roles = [r.role_name for r in current_user.roles]
    primary_role = user_roles[0] if user_roles else "author"

    annot = Annotation(
        manuscript_id=manuscript_id,
        user_id=current_user.id,
        user_name=current_user.full_name,
        user_role=primary_role,
        selected_text=payload.selected_text,
        comment=payload.comment,
        color=payload.color or "yellow",
        paragraph_id=payload.paragraph_id,
        confidential_to_editor=1 if payload.confidential_to_editor else 0
    )
    db.add(annot)
    db.commit()
    db.refresh(annot)
    return {
        "success": True,
        "annotation": {
            "id": annot.id,
            "manuscript_id": annot.manuscript_id,
            "user_id": annot.user_id,
            "user_name": annot.user_name,
            "user_role": annot.user_role,
            "selected_text": annot.selected_text,
            "comment": annot.comment,
            "color": annot.color,
            "paragraph_id": annot.paragraph_id,
            "confidential_to_editor": bool(annot.confidential_to_editor),
            "created_at": annot.created_at.isoformat() if annot.created_at else None
        }
    }

@router.delete("/{manuscript_id}/annotations/{annotation_id}")
def delete_annotation(manuscript_id: int, annotation_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    annot = db.query(Annotation).filter(Annotation.id == annotation_id, Annotation.manuscript_id == manuscript_id).first()
    if not annot:
        raise HTTPException(status_code=404, detail="Annotation not found")
        
    user_roles = [r.role_name for r in current_user.roles]
    if annot.user_id != current_user.id and "super_admin" not in user_roles and "associate_editor" not in user_roles:
        raise HTTPException(status_code=403, detail="Cannot delete other users' annotations")
        
    db.delete(annot)
    db.commit()
    return {"success": True, "deleted_id": annotation_id}

@router.post("/{manuscript_id}/screen")
async def screen_manuscript(manuscript_id: int, current_user: User = Depends(require_roles(["super_admin", "associate_editor"])), db: Session = Depends(get_db)):
    manuscript = db.query(Manuscript).filter(Manuscript.id == manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")

    # Check if a screening report already exists
    existing = db.query(ScreeningReport).filter(ScreeningReport.manuscript_id == manuscript_id).first()
    if existing:
        return {
            "success": True,
            "cached": True,
            "model": existing.model_name,
            "recommendation": existing.recommendation,
            "report": existing.report,
            "created_at": existing.created_at.isoformat() if existing.created_at else None
        }

    # Run AI screening via Ollama
    authors_str = ", ".join([a.full_name for a in manuscript.authors]) if manuscript.authors else (manuscript.author.full_name if manuscript.author else "")
    result = await prescreen_manuscript(
        title=manuscript.title,
        abstract=manuscript.abstract or "",
        keywords=manuscript.keywords or "",
        authors=authors_str
    )

    # Save report in DB
    report_entry = ScreeningReport(
        manuscript_id=manuscript_id,
        model_name=result.get("model", "qwen2.5:3b"),
        recommendation=result.get("recommendation", "PROCEED TO PEER REVIEW"),
        report=result.get("report", "")
    )
    db.add(report_entry)
    db.commit()
    db.refresh(report_entry)

    return {
        "success": True,
        "cached": False,
        "model": report_entry.model_name,
        "recommendation": report_entry.recommendation,
        "report": report_entry.report,
        "created_at": report_entry.created_at.isoformat() if report_entry.created_at else None
    }

@router.post("/{manuscript_id}/recommend-reviewers")
async def recommend_reviewers(manuscript_id: int, current_user: User = Depends(require_roles(["super_admin", "associate_editor"])), db: Session = Depends(get_db)):
    manuscript = db.query(Manuscript).filter(Manuscript.id == manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")

    # Get all active reviewers
    reviewers = db.query(User).join(UserRole).filter(UserRole.role_name == "reviewer", User.is_active == True).all()
    reviewer_candidates = []
    for r in reviewers:
        # Don't recommend the author of the manuscript
        if r.id == manuscript.author_id:
            continue
        expertise = [f"{e.topic} ({e.keywords})" if e.keywords else e.topic for e in r.expertise]
        active_cnt = db.query(ReviewAssignment).filter(ReviewAssignment.reviewer_id == r.id, ReviewAssignment.status.in_(["assigned", "accepted"])).count()
        completed_cnt = db.query(ReviewAssignment).filter(ReviewAssignment.reviewer_id == r.id, ReviewAssignment.status == "completed").count()
        
        reviewer_candidates.append({
            "id": r.id,
            "name": r.full_name,
            "affiliation": r.affiliation or "",
            "interests": ", ".join(expertise) if expertise else "General Scholarly Research",
            "active_reviews": active_cnt,
            "completed_reviews": completed_cnt
        })

    authors_str = ", ".join([a.full_name for a in manuscript.authors]) if manuscript.authors else (manuscript.author.full_name if manuscript.author else "")
    
    # Run Ollama AI batch matchmaking
    ranked = await match_reviewers(
        title=manuscript.title,
        abstract=manuscript.abstract or "",
        authors=authors_str,
        keywords=manuscript.keywords or "",
        reviewers=reviewer_candidates
    )

    return {
        "success": True,
        "manuscript_id": manuscript.id,
        "total_evaluated": len(ranked),
        "recommendations": ranked
    }

