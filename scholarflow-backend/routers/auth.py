from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from core.deps import get_current_user, require_roles
from models.user import User, UserRole
from schemas.auth import UserLogin, UserRegister, TokenResponse, UserResponse, RefreshRequest

router = APIRouter(prefix="/auth", tags=["Authentication & RBAC"])

@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        (User.username == credentials.username) | (User.email == credentials.username)
    ).first()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
        
    roles = [r.role_name for r in user.roles]
    access_token = create_access_token(subject=user.username, roles=roles)
    refresh_token = create_refresh_token(subject=user.username)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "roles": roles
        }
    }

@router.post("/register", response_model=TokenResponse)
def register(data: UserRegister, db: Session = Depends(get_db)):
    # Check if username or email already exists
    existing = db.query(User).filter((User.username == data.username) | (User.email == data.email)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    user = User(
        username=data.username,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        affiliation=data.affiliation,
        country=data.country,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Assign default role (author)
    assigned_role = data.role if data.role in ["author", "reviewer"] else "author"
    user_role = UserRole(user_id=user.id, role_name=assigned_role)
    db.add(user_role)
    db.commit()
    
    roles = [assigned_role]
    access_token = create_access_token(subject=user.username, roles=roles)
    refresh_token = create_refresh_token(subject=user.username)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "roles": roles
        }
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    roles = [r.role_name for r in current_user.roles]
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "affiliation": current_user.affiliation,
        "country": current_user.country,
        "is_active": current_user.is_active,
        "roles": roles
    }

@router.post("/refresh")
def refresh_token_endpoint(data: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    username = payload.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
        
    roles = [r.role_name for r in user.roles]
    new_access = create_access_token(subject=user.username, roles=roles)
    return {"access_token": new_access, "token_type": "bearer"}

@router.get("/users", dependencies=[Depends(require_roles(["super_admin"]))])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "roles": [r.role_name for r in u.roles],
            "is_active": u.is_active
        }
        for u in users
    ]
