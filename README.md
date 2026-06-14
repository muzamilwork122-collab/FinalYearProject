# 📱 ScreenScan — Mobile Screen Damage AI

AI-powered phone-screen damage detection. Upload a photo of a cracked screen and get a
severity score, an annotated damage overlay, a repairable/replace verdict, repair-cost
estimates (Original vs. aftermarket), and real repair shops near you.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python) + SQLAlchemy
- **Database**: PostgreSQL
- **AI**: OpenAI GPT-4o (vision) for damage analysis and the chat assistant
- **Maps**: OpenStreetMap (Nominatim + Overpass) and Leaflet — no map API key required
- **Deployment**: Docker Compose + Nginx

> The running server is **OpenAI-only** — it does not load local PyTorch models. The
> `ml_training/` notebooks and `requirements-ml.txt` are optional/legacy and are **not**
> needed to run the app.

---

## Prerequisites

Install these before you start:

| Tool | Minimum version | Notes |
|------|-----------------|-------|
| **Python** | 3.10+ | 3.11 recommended |
| **Node.js** | 18+ | Includes `npm` |
| **PostgreSQL** | 14+ | Local install or Docker |
| **OpenAI API key** | — | Required — get one at <https://platform.openai.com/api-keys> |

---

## Local Setup (step by step)

### 1. Clone the repository

```bash
git clone <repository-url>
cd FYP
```

### 2. Create the PostgreSQL database

Make sure PostgreSQL is running, then create the database (default name `damage_ai`):

```bash
# Using psql (adjust the user if yours isn't "postgres")
psql -U postgres -c "CREATE DATABASE damage_ai;"
```

The backend auto-creates all tables on first startup — you only need the empty database.

### 3. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
# Windows (PowerShell):
venv\Scripts\Activate.ps1
# Windows (cmd):
# venv\Scripts\activate.bat
# macOS/Linux:
# source venv/bin/activate

# Install runtime dependencies
pip install -r requirements.txt

# Create your environment file from the template, then edit it
copy .env.example .env        # Windows
# cp .env.example .env        # macOS/Linux
```

Open `backend/.env` and set at minimum:

- `DATABASE_URL` — your Postgres connection string, e.g.
  `postgresql://postgres:YOUR_PASSWORD@localhost:5432/damage_ai`
- `OPENAI_API_KEY` — your OpenAI key (`sk-...`)

Then start the server:

```bash
uvicorn app.main:app --reload --port 8000
```

- API base: <http://localhost:8000>
- Health check: <http://localhost:8000/health> → `{"status":"ok"}`
- Interactive API docs (Swagger): <http://localhost:8000/docs>

### 4. Frontend

In a **new terminal**:

```bash
cd frontend

npm install

# Optional: only needed if the backend isn't on http://localhost:8000
# or to enable Google Sign-In
copy .env.example .env        # Windows  (cp .env.example .env on macOS/Linux)

npm run dev
```

Open the URL Vite prints (default <http://localhost:5173>).

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://postgres:password@localhost:5432/damage_ai` | PostgreSQL connection string |
| `OPENAI_API_KEY` | ✅ | — | OpenAI key used for analysis + chat |
| `OPENAI_ONLY_MODE` | — | `true` | Skip local ML models (keep `true`) |
| `GOOGLE_CLIENT_ID` | — | — | Google OAuth client ID (blank disables Google Sign-In) |
| `APP_NAME` | — | `mobile-damage-ai` | App name |
| `DEBUG` | — | `false` | Verbose logging |
| `CONFIDENCE_THRESHOLD` | — | `0.5` | Detection confidence floor |
| `MAX_IMAGE_SIZE_MB` | — | `10` | Max upload size |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE_URL` | — | `http://localhost:8000` | Backend base URL |
| `VITE_GOOGLE_CLIENT_ID` | — | — | Google OAuth client ID (must match backend) |

> Never commit real `.env` files — they're git-ignored. Commit only the `.env.example` templates.

---

## Run with Docker (alternative)

Runs Postgres, the backend, and an Nginx server for the built frontend.

```bash
# 1. Provide backend secrets
cp backend/.env.example backend/.env   # then edit OPENAI_API_KEY etc.

# 2. Build the frontend (Nginx serves frontend/dist)
cd frontend && npm install && npm run build && cd ..

# 3. Start everything (DB_PASSWORD is used for the Postgres container)
DB_PASSWORD=password docker-compose -f deployment/docker-compose.yml up --build
```

- App (via Nginx): <http://localhost>
- Backend API: <http://localhost:8000>

> In `backend/.env`, point `DATABASE_URL` at the compose DB host:
> `postgresql://postgres:password@db:5432/damage_ai`.

---

## Project Structure

```
FYP/
├── frontend/         # React + Vite SPA
│   ├── src/
│   │   ├── components/   # UI (UploadSection, RepairShopLocator, auth, …)
│   │   ├── context/      # AuthContext, PreferencesContext (theme)
│   │   ├── pages/        # Index, Dashboard, Assistant, Settings, …
│   │   └── lib/          # repairShops.ts (OSM geocode + shop lookup), utils
│   └── .env.example
├── backend/          # FastAPI server
│   ├── app/
│   │   ├── api/routes/   # predict, chat, auth, insights
│   │   ├── core/         # config, logging
│   │   ├── db/           # SQLAlchemy models + session
│   │   ├── schemas/      # Pydantic schemas
│   │   └── main.py       # App entry + router registration
│   ├── tests/
│   ├── requirements.txt      # Runtime deps (OpenAI-only mode)
│   ├── requirements-ml.txt   # Optional ML/training deps
│   └── .env.example
├── ml_training/      # Optional Jupyter notebooks (legacy, not required)
└── deployment/       # docker-compose.yml + nginx.conf
```

---

## API Overview

All routes are prefixed with `/api`. Full, always-current docs at `/docs` (Swagger).

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/predict` | Upload an image → damage analysis (severity, bboxes, costs, shops) |
| `GET` | `/api/history` | List the signed-in user's past analyses |
| `DELETE` | `/api/history/{id}` | Delete one analysis |
| `GET` | `/api/report/{id}` | Fetch a saved report |
| `POST` | `/api/chat` | Chat assistant (GPT-4o) |
| `POST` | `/api/auth/signup` · `/api/auth/login` · `/api/auth/google` | Authentication |
| `PATCH` | `/api/auth/profile` | Update name |
| `POST` | `/api/auth/change-password` · `/api/auth/delete-account` | Account management |
| `GET` | `/health` | Health check |

---

## Running Tests

```bash
cd backend
# Windows: set TESTING=true   |   macOS/Linux: export TESTING=true
pytest tests/ -v
```

`TESTING=true` disables rate limiting during the test run.

---

## Troubleshooting

- **`connection refused` / DB errors on startup** — PostgreSQL isn't running or
  `DATABASE_URL` is wrong. Confirm the service is up and the `damage_ai` database exists.
- **`OpenAI analysis failed` / 500 on `/api/predict`** — `OPENAI_API_KEY` is missing,
  invalid, or out of quota.
- **Frontend can't reach the API / CORS errors** — the backend isn't running on the URL in
  `VITE_API_BASE_URL`. CORS is fully permissive server-side, so a "CORS error" usually means
  the backend is down or crashed — check its terminal.
- **Port already in use (8000)** — another process holds the port. Stop it, or run uvicorn on
  a different `--port` and update `VITE_API_BASE_URL` accordingly.

---

## Optional: Training Models

The app does not require trained local models. If you want to experiment with the legacy
training notebooks:

```bash
pip install -r backend/requirements-ml.txt
```

Then run the notebooks in `ml_training/` (`segmentation_train.ipynb`, `detection_train.ipynb`,
`severity_train.ipynb`). Weights would go in `backend/models_weights/`.
