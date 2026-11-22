import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from core.database import get_db
from core.config import settings
from core.deps import get_current_user, require_roles
from models.user import User
from models.journal import Journal
from models.manuscript import Manuscript, ManuscriptFile, ManuscriptAuthor

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
