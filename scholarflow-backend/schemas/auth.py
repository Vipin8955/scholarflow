from pydantic import BaseModel
from typing import Optional, List

class UserLogin(BaseModel):
    username: str
    password: str

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    affiliation: Optional[str] = None
    country: Optional[str] = None
    role: Optional[str] = "author" # default to author

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    affiliation: Optional[str] = None
    country: Optional[str] = None
    is_active: bool
    roles: List[str]

    class Config:
        from_attributes = True

class RefreshRequest(BaseModel):
    refresh_token: str
