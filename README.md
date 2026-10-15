# ScholarFlow 🎓🤖
> **Next-Generation AI Editorial Assistant & Reviewer Matchmaking for Open Journal Systems (OJS)**

ScholarFlow extends Open Journal Systems with an intelligent, privacy-first local AI microservice that automates manuscript pre-screening, streamlines semantic reviewer matchmaking, and provides an interactive inline markup and annotation workspace.

---

## 🚀 Key Features

### 1. 🤖 Dynamic AI Pre-Screening
- **Deep Manuscript Audit**: Evaluates research scope, methodology rigor, academic novelty, and ethical compliance from scratch for any selected journal manuscript.
- **Asymptotic Multi-Phase Progress Loader**: Visual SVG circular ring tracker, linear gradient animation, and real-time step status indicators (`0% → 100%`).
- **Editorial Decision Scorecard**: Formulates structured recommendations (*Proceed to Peer Review*, *Revisions Required*, or *Desk Reject*) with detailed rationales.

### 2. 👥 Intelligent Reviewer Matchmaking
- **Semantic Expertise Alignment**: Compares manuscript title and abstract against the journal's candidate reviewer pool.
- **Workload & Quota Awareness**: Ranks candidate reviewers with a compatibility percentage score and provides editorial justifications.
- **Integrated Actions**: One-click direct assignment in OJS and quick quota-release controls.
- **Interactive Percentage Loader**: Live phase tracker auditing reviewer interests, workload, and conflicts of interest.

### 3. 📖 Document Viewer & Real-Time Markups
- **Multi-Color Text Highlights**: Highlight manuscript passages in Yellow, Green, Blue, or Pink.
- **Role-Gated Feedback**: Add general review comments or confidential "Editor-Only" notes.
- **Export Capabilities**: Export annotations and reviewer markups into clean markdown and HTML summary reports.

---

## 🎯 Streamlined Dashboard Focus
To make the editorial interface faster and more user-friendly, two legacy features were removed from the AI dashboard:
- **Revision Analysis**: Removed revision diff tracking and version comparison tabs to eliminate interface clutter.
- **AI Review Assistant**: Removed the standalone guidance questionnaire in favor of direct inline document markups and automated pre-screening.

The workspace is now streamlined into 3 core pillars:
1. 📖 **Document & Markups**
2. 🤖 **AI Pre-Screening** (with real-time percentage loader)
3. 👥 **Reviewer Matchmaking** (with real-time percentage loader)

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), Modern CSS3 Glassmorphism, SVG Micro-animations.
- **OJS Core**: PHP 8.2, Open Journal Systems 3.5, MySQL / MariaDB.
- **AI Microservice**: Python 3.13, FastAPI, Uvicorn, SQLite caching.
- **Local LLM Engine**: Ollama running `qwen2.5:3b` (100% private and on-premise).

---

## 📁 Repository Structure

```
scholarflow/
├── backend/
│   ├── main.py                  # FastAPI server with Ollama integration & caching
│   └── requirements.txt         # Python dependencies
├── plugin/
│   ├── ScholarFlowPlugin.php    # OJS plugin registration & template injection
│   ├── ScholarFlowHandler.php   # OJS controller & proxy API endpoints
│   ├── version.xml              # OJS plugin version metadata
│   ├── css/
│   │   └── scholarflow.css      # Core styles & animations
│   └── js/
│       └── scholarflow.js       # Editorial workspace, annotations & progress loaders
├── scripts/
│   ├── setup_journals_and_reviewers.php  # Automated multi-journal & reviewer setup
│   ├── seed_submissions_all_journals.php # Diverse manuscript seed data
│   └── manage_test_data.php              # Database inspection utility
├── start_scholarflow.bat        # Automated one-click full-stack launcher
├── .gitignore                   # Ignore rules for virtualenvs, caches, and DBs
└── README.md                    # Project documentation
```

---

## ⚡ Quick Start & Local Execution

### Prerequisites
- [XAMPP](https://www.apachefriends.org/) (Apache & MySQL)
- [Python 3.10+](https://www.python.org/)
- [Ollama](https://ollama.ai/) with `qwen2.5:3b` pulled (`ollama pull qwen2.5:3b`)

### 1. Launch Services
Run the all-in-one launcher script:
```bat
start_scholarflow.bat
```
Or start each service individually:
1. **MySQL**: Port `3306`
2. **Apache (OJS)**: Port `80` (`http://localhost/ojs/`)
3. **Ollama**: Port `11434` (`ollama serve`)
4. **FastAPI AI Backend**: Port `8000`
   ```bash
   cd backend
   python -m uvicorn main:app --host 127.0.0.1 --port 8000
   ```

### 2. Default Test Credentials
All pre-configured test accounts use password: `password123`

| Username | Role | Specialization |
| :--- | :--- | :--- |
| `admin` | Site Administrator | Full platform control |
| `editor` | Journal Editor | Editorial oversight & review management |
| `marcus_reviewer` | Peer Reviewer | Smart Grid Stability, Power Inverters |
| `priya_reviewer` | Peer Reviewer | Solar Cell Efficiency, Renewable Policy |
| `clara_reviewer` | Peer Reviewer | Molecular Genetics, CRISPR Editing |
| `author` | Author | Manuscript submissions & personal revisions |

---

## 🔒 Privacy & Local Processing
All manuscript text analysis and reviewer evaluations are executed **100% locally** on your machine via Ollama. No proprietary research data, unpublished drafts, or reviewer information are sent to external third-party cloud APIs.
