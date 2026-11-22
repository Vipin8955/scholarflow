import os

class Settings:
    PROJECT_NAME: str = "ScholarFlow Publishing Platform"
    VERSION: str = "2.0.0"
    API_V2_PREFIX: str = "/api/v2"
    
    # Security
    SECRET_KEY: str = os.getenv("SCHOLARFLOW_SECRET_KEY", "scholarflow_ultra_secure_jwt_secret_key_2026_academic_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./scholarflow_core.db")
    
    # File Storage
    STORAGE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "storage"))
    MANUSCRIPTS_DIR: str = os.path.join(STORAGE_DIR, "manuscripts")

settings = Settings()
os.makedirs(settings.MANUSCRIPTS_DIR, exist_ok=True)
