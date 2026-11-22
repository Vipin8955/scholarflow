import os
import sys

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from core.database import engine, Base, SessionLocal
from core.security import get_password_hash
from models.user import User, UserRole, ReviewerExpertise
from models.journal import Journal, JournalSection

def seed():
    print("Creating all database tables in scholarflow_core.db...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(User).filter(User.username == "admin").first():
            print("Database already contains users. Skipping seed.")
            return

        print("Seeding core roles & accounts (admin, editor, author, reviewer)...")
        users_data = [
            {
                "username": "admin",
                "email": "admin@scholarflow.org",
                "full_name": "Platform Super Administrator",
                "affiliation": "ScholarFlow Governance Board",
                "country": "United States",
                "role": "super_admin",
            },
            {
                "username": "editor",
                "email": "editor@scholarflow.org",
                "full_name": "Dr. Sarah Mitchell",
                "affiliation": "Department of Computer Science, MIT",
                "country": "United States",
                "role": "associate_editor",
            },
            {
                "username": "author",
                "email": "author@scholarflow.org",
                "full_name": "Prof. David Chen",
                "affiliation": "Institute for Genomic Biology, Stanford University",
                "country": "United States",
                "role": "author",
            },
            {
                "username": "reviewer",
                "email": "reviewer@scholarflow.org",
                "full_name": "Dr. Elena Rostova",
                "affiliation": "Centre for Computational Intelligence, Oxford",
                "country": "United Kingdom",
                "role": "reviewer",
                "expertise": ["Deep Learning", "Bioinformatics", "Cancer Genomics", "Cloud Computing"]
            },
        ]

        for u in users_data:
            user = User(
                username=u["username"],
                email=u["email"],
                full_name=u["full_name"],
                affiliation=u["affiliation"],
                country=u["country"],
                hashed_password=get_password_hash("password123"),
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            db.add(UserRole(user_id=user.id, role_name=u["role"]))
            
            if "expertise" in u:
                for exp in u["expertise"]:
                    db.add(ReviewerExpertise(user_id=user.id, topic=exp, keywords=exp.lower()))
            db.commit()
            print(f" -> Created user: {u['username']} ({u['role']})")

        print("Seeding hosted journals...")
        journals_data = [
            {
                "title": "My Test Journal",
                "acronym": "TEST",
                "path": "test",
                "description": "A test journal for exploring and developing ScholarFlow locally.",
                "issn": "2834-192X",
                "sections": ["Articles", "Review Papers", "Short Communications"]
            },
            {
                "title": "Journal of Computer Science and Cybersecurity",
                "acronym": "JCS",
                "path": "jcs",
                "description": "An international journal focusing on high-impact research in artificial intelligence, cryptography, cloud computing, and cyber defense.",
                "issn": "2710-5842",
                "sections": ["Full Research Articles", "System Architectures", "Security Briefs"]
            },
            {
                "title": "Journal of Advanced Science and Technology",
                "acronym": "JAST",
                "path": "jast",
                "description": "Cross-disciplinary publications spanning applied physics, material sciences, and nanotechnologies.",
                "issn": "2693-4109",
                "sections": ["Original Research", "Methodologies"]
            },
            {
                "title": "Journal of Biomedical Science and Engineering",
                "acronym": "JBMS",
                "path": "jbms",
                "description": "Dedicated to biomedical instrumentation, genomic sequencing methodologies, and computational biology.",
                "issn": "2581-9921",
                "sections": ["Clinical Studies", "Bio-Algorithms", "Datasets"]
            }
        ]

        for jd in journals_data:
            journal = Journal(
                title=jd["title"],
                acronym=jd["acronym"],
                path=jd["path"],
                description=jd["description"],
                issn=jd["issn"],
                is_active=True
            )
            db.add(journal)
            db.commit()
            db.refresh(journal)

            for s_title in jd["sections"]:
                db.add(JournalSection(journal_id=journal.id, title=s_title))
            db.commit()
            print(f" -> Created journal: {jd['title']} (/{jd['path']})")

        print("Database seeded successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
