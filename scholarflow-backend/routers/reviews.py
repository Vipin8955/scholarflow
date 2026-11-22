from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from core.database import get_db
from core.deps import get_current_user, require_roles
from models.user import User, UserRole, ReviewerExpertise
from models.manuscript import Manuscript
from models.review import ReviewAssignment, Review, EditorialDecision

router = APIRouter(prefix="/reviews", tags=["Peer Review & Editorial Workflow"])

class AssignReviewerRequest(BaseModel):
    manuscript_id: int
    reviewer_id: int
    due_days: Optional[int] = 21

class RespondInvitationRequest(BaseModel):
    accept: Optional[bool] = None
    decision: Optional[str] = None # accepted or declined

class SubmitReviewRequest(BaseModel):
    score: Optional[int] = 8
    recommendation: str # accept, minor_revisions, major_revisions, reject
    comments_for_author: str
    confidential_comments_for_editor: Optional[str] = None
    confidential_comments: Optional[str] = None

class EditorialDecisionRequest(BaseModel):
    manuscript_id: int
    decision: str # accept, request_revisions, decline
    decision_letter: Optional[str] = None
    comments: Optional[str] = None

@router.get("/candidates")
def list_reviewer_candidates(
    current_user: User = Depends(require_roles(["super_admin", "associate_editor"])),
    db: Session = Depends(get_db)
):
    # Find all users with reviewer role
    reviewer_roles = db.query(UserRole).filter(UserRole.role_name == "reviewer").all()
    reviewer_ids = [r.user_id for r in reviewer_roles]
    reviewers = db.query(User).filter(User.id.in_(reviewer_ids), User.is_active == True).all()
    
    candidates = []
    for rev in reviewers:
        # Calculate active assignments
        active_count = db.query(ReviewAssignment).filter(
            ReviewAssignment.reviewer_id == rev.id,
            ReviewAssignment.status.in_(["pending", "accepted"])
        ).count()
        
        completed_count = db.query(ReviewAssignment).filter(
            ReviewAssignment.reviewer_id == rev.id,
            ReviewAssignment.status == "completed"
        ).count()
        
        expertise_topics = [e.topic for e in rev.expertise]
        
        candidates.append({
            "id": rev.id,
            "full_name": rev.full_name,
            "email": rev.email,
            "affiliation": rev.affiliation,
            "country": rev.country,
            "interests": expertise_topics,
            "active_reviews": active_count,
            "completed_reviews": completed_count
        })
        
    return candidates

@router.post("/assign")
def assign_reviewer(
    data: AssignReviewerRequest,
    current_user: User = Depends(require_roles(["super_admin", "associate_editor"])),
    db: Session = Depends(get_db)
):
    manuscript = db.query(Manuscript).filter(Manuscript.id == data.manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")
        
    reviewer = db.query(User).filter(User.id == data.reviewer_id, User.is_active == True).first()
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")
        
    # Prevent assigning the author to their own paper!
    if manuscript.author_id == reviewer.id:
        raise HTTPException(status_code=400, detail="Cannot assign author as reviewer to their own paper")
        
    # Check if already assigned
    existing = db.query(ReviewAssignment).filter(
        ReviewAssignment.manuscript_id == data.manuscript_id,
        ReviewAssignment.reviewer_id == data.reviewer_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Reviewer already assigned to this manuscript")
        
    assignment = ReviewAssignment(
        manuscript_id=data.manuscript_id,
        reviewer_id=data.reviewer_id,
        editor_id=current_user.id,
        status="pending",
        invited_at=datetime.now(timezone.utc)
    )
    db.add(assignment)
    
    # Update manuscript status if still 'submitted'
    if manuscript.status == "submitted":
        manuscript.status = "under_review"
        
    db.commit()
    db.refresh(assignment)
    
    return {
        "message": f"Reviewer {reviewer.full_name} assigned successfully",
        "assignment_id": assignment.id,
        "status": assignment.status
    }

@router.get("/my-assignments")
def get_my_review_assignments(
    current_user: User = Depends(require_roles(["reviewer"])),
    db: Session = Depends(get_db)
):
    # Reviewer only sees their own assigned manuscripts! Strict isolation!
    assignments = db.query(ReviewAssignment).filter(
        ReviewAssignment.reviewer_id == current_user.id
    ).all()
    
    return [
        {
            "id": a.id,
            "assignment_id": a.id,
            "manuscript_id": a.manuscript_id,
            "manuscript_title": a.manuscript.title if a.manuscript else None,
            "journal_title": a.manuscript.journal.title if (a.manuscript and a.manuscript.journal) else "General",
            "status": a.status,
            "invited_at": a.invited_at.isoformat() if a.invited_at else None,
            "responded_at": a.responded_at.isoformat() if a.responded_at else None,
            "due_date": a.due_date.isoformat() if a.due_date else None,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            "has_review": a.review is not None
        }
        for a in assignments
    ]

@router.post("/{assignment_id}/respond")
def respond_to_invitation(
    assignment_id: int,
    data: RespondInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignment = db.query(ReviewAssignment).filter(ReviewAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if assignment.reviewer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")
        
    is_accepted = data.accept if data.accept is not None else (data.decision == "accepted")
    assignment.responded_at = datetime.now(timezone.utc)
    assignment.status = "accepted" if is_accepted else "declined"
    db.commit()
    
    return {
        "assignment_id": assignment.id,
        "status": assignment.status,
        "message": "Invitation accepted" if is_accepted else "Invitation declined"
    }

@router.post("/{assignment_id}/submit")
def submit_review(
    assignment_id: int,
    data: SubmitReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignment = db.query(ReviewAssignment).filter(ReviewAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
        
    if assignment.reviewer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your assignment")
        
    if assignment.review:
        raise HTTPException(status_code=400, detail="Review already submitted for this assignment")
        
    conf_comments = data.confidential_comments_for_editor or data.confidential_comments
    review = Review(
        assignment_id=assignment.id,
        recommendation=data.recommendation,
        comments_for_author=data.comments_for_author,
        confidential_comments_for_editor=conf_comments,
        submitted_at=datetime.now(timezone.utc)
    )
    db.add(review)
    assignment.status = "completed"
    assignment.completed_at = datetime.now(timezone.utc)
    db.commit()
    
    return {
        "message": "Peer review submitted successfully",
        "review_id": review.id,
        "recommendation": review.recommendation
    }

@router.post("/decision")
def record_editorial_decision(
    data: EditorialDecisionRequest,
    current_user: User = Depends(require_roles(["super_admin", "associate_editor"])),
    db: Session = Depends(get_db)
):
    manuscript = db.query(Manuscript).filter(Manuscript.id == data.manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found")
        
    final_letter = data.decision_letter or data.comments
    decision = EditorialDecision(
        manuscript_id=data.manuscript_id,
        editor_id=current_user.id,
        decision=data.decision,
        decision_letter=final_letter,
        decided_at=datetime.now(timezone.utc)
    )
    db.add(decision)
    
    # Update manuscript status
    status_map = {
        "accept": "accepted",
        "request_revisions": "revisions_requested",
        "decline": "rejected"
    }
    manuscript.status = status_map.get(data.decision, manuscript.status)
    db.commit()
    
    return {
        "message": f"Editorial decision recorded: {data.decision}",
        "manuscript_id": manuscript.id,
        "status": manuscript.status,
        "new_status": manuscript.status
    }
