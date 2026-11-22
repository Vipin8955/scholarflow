from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from core.database import Base

class Manuscript(Base):
    __tablename__ = "manuscripts"
    
    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey("journals.id"), nullable=False, index=True)
    section_id = Column(Integer, ForeignKey("journal_sections.id"), nullable=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    title = Column(String(500), nullable=False)
    abstract = Column(Text, nullable=True)
    keywords = Column(String(500), nullable=True)
    
    # Status: submitted, under_review, revisions_requested, accepted, rejected, published
    status = Column(String(50), default="submitted", index=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    author = relationship("User", foreign_keys=[author_id], backref="submitted_manuscripts")
    files = relationship("ManuscriptFile", backref="manuscript", cascade="all, delete-orphan")
    authors = relationship("ManuscriptAuthor", backref="manuscript", cascade="all, delete-orphan")
    assignments = relationship("ReviewAssignment", backref="manuscript", cascade="all, delete-orphan")
    decisions = relationship("EditorialDecision", backref="manuscript", cascade="all, delete-orphan")
    annotations = relationship("Annotation", backref="manuscript", cascade="all, delete-orphan")
    screening_reports = relationship("ScreeningReport", backref="manuscript", cascade="all, delete-orphan")

class ManuscriptFile(Base):
    __tablename__ = "manuscript_files"
    
    id = Column(Integer, primary_key=True, index=True)
    manuscript_id = Column(Integer, ForeignKey("manuscripts.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String(500), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False) # pdf, docx
    file_size = Column(Integer, nullable=True)
    version = Column(Integer, default=1)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ManuscriptAuthor(Base):
    __tablename__ = "manuscript_authors"
    
    id = Column(Integer, primary_key=True, index=True)
    manuscript_id = Column(Integer, ForeignKey("manuscripts.id", ondelete="CASCADE"), nullable=False)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    affiliation = Column(String(255), nullable=True)
    is_corresponding = Column(Integer, default=0)

class Annotation(Base):
    __tablename__ = "annotations"
    
    id = Column(Integer, primary_key=True, index=True)
    manuscript_id = Column(Integer, ForeignKey("manuscripts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_name = Column(String(255), nullable=False)
    user_role = Column(String(50), nullable=False)
    selected_text = Column(Text, nullable=False)
    comment = Column(Text, nullable=False)
    color = Column(String(50), default="yellow")
    paragraph_id = Column(String(100), nullable=True)
    confidential_to_editor = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")

class ScreeningReport(Base):
    __tablename__ = "screening_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    manuscript_id = Column(Integer, ForeignKey("manuscripts.id", ondelete="CASCADE"), nullable=False, index=True)
    model_name = Column(String(100), default="qwen2.5:3b")
    recommendation = Column(String(100), nullable=True)
    report = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
