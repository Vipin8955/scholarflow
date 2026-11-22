from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class ReviewAssignment(Base):
    __tablename__ = "review_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    manuscript_id = Column(Integer, ForeignKey("manuscripts.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    editor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Status: pending, accepted, declined, completed, released
    status = Column(String(50), default="pending", index=True)
    
    invited_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    responded_at = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    reviewer = relationship("User", foreign_keys=[reviewer_id], backref="review_assignments")
    editor = relationship("User", foreign_keys=[editor_id])
    review = relationship("Review", uselist=False, backref="assignment", cascade="all, delete-orphan")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("review_assignments.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    # Recommendation: accept, minor_revisions, major_revisions, reject
    recommendation = Column(String(50), nullable=False)
    comments_for_author = Column(Text, nullable=True)
    confidential_comments_for_editor = Column(Text, nullable=True)
    
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class EditorialDecision(Base):
    __tablename__ = "editorial_decisions"
    
    id = Column(Integer, primary_key=True, index=True)
    manuscript_id = Column(Integer, ForeignKey("manuscripts.id", ondelete="CASCADE"), nullable=False, index=True)
    editor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Decision: accept, request_revisions, decline
    decision = Column(String(50), nullable=False)
    decision_letter = Column(Text, nullable=True)
    decided_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    editor = relationship("User", foreign_keys=[editor_id])
