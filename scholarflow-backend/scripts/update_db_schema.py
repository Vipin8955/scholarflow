import os
import sys

# Ensure root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import engine, Base
import models

def main():
    Base.metadata.create_all(bind=engine)
    print("Database tables created / verified successfully.")

if __name__ == "__main__":
    main()
