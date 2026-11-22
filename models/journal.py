from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class Journal(Base):
    __tablename__ = "journals"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    acronym = Column(String(50), nullable=False)
    path = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    issn = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    sections = relationship("JournalSection", backref="journal", cascade="all, delete-orphan")
    manuscripts = relationship("Manuscript", backref="journal")

class JournalSection(Base):
    __tablename__ = "journal_sections"
    
    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(Integer, ForeignKey("journals.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    policy = Column(Text, nullable=True)
