from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from core.database import get_db
from core.deps import get_current_user, require_roles
from models.user import User
from models.journal import Journal, JournalSection

router = APIRouter(prefix="/journals", tags=["Journals Management"])

class SectionSchema(BaseModel):
    id: int
    title: str
    policy: Optional[str] = None

    class Config:
        from_attributes = True

class JournalResponse(BaseModel):
    id: int
    title: str
    acronym: str
    path: str
    description: Optional[str] = None
    issn: Optional[str] = None
    is_active: bool
    sections: List[SectionSchema] = []

    class Config:
        from_attributes = True

class JournalCreate(BaseModel):
    title: str
    acronym: str
    path: str
    description: Optional[str] = None
    issn: Optional[str] = None
    sections: Optional[List[str]] = ["Articles"]

@router.get("", response_model=List[JournalResponse])
def list_journals(db: Session = Depends(get_db)):
    journals = db.query(Journal).filter(Journal.is_active == True).all()
    return journals

@router.get("/{identifier}", response_model=JournalResponse)
def get_journal(identifier: str, db: Session = Depends(get_db)):
    if identifier.isdigit():
        j = db.query(Journal).filter(Journal.id == int(identifier)).first()
    else:
        j = db.query(Journal).filter(Journal.path == identifier).first()
        
    if not j:
        raise HTTPException(status_code=404, detail="Journal not found")
    return j

@router.post("", response_model=JournalResponse, dependencies=[Depends(require_roles(["super_admin"]))])
def create_journal(data: JournalCreate, db: Session = Depends(get_db)):
    existing = db.query(Journal).filter(Journal.path == data.path).first()
    if existing:
        raise HTTPException(status_code=400, detail="Journal path already taken")
        
    journal = Journal(
        title=data.title,
        acronym=data.acronym.upper(),
        path=data.path.lower(),
        description=data.description,
        issn=data.issn,
        is_active=True
    )
    db.add(journal)
    db.commit()
    db.refresh(journal)
    
    if data.sections:
        for s_title in data.sections:
            db.add(JournalSection(journal_id=journal.id, title=s_title))
        db.commit()
        db.refresh(journal)
        
    return journal
