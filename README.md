# 📱 ScreenScan — Mobile Screen Damage AI

AI-powered phone-screen damage detection. Upload a photo of a cracked screen and get a
severity score, an annotated damage overlay, a repairable/replace verdict, repair-cost
estimates (Original vs. aftermarket), and real repair shops near you.

The platform also includes a **shopkeeper module** (repair shops register, get admin approval,
and appear with priority on the map) and **live chat** between customers and approved shops.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python) + SQLAlchemy
- **Database**: PostgreSQL
- **AI**: OpenAI GPT-4o (vision) for damage analysis and the chat assistant
- **Maps**: OpenStreetMap (Nominatim + Overpass) and Leaflet — no map API key required
- **Shopkeeper & live chat**: REST API + HTTP polling (no WebSocket server)
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

### 5. Admin panel (optional)

After the backend has started at least once, sign in at <http://localhost:5173/admin> with the
default credentials from `backend/.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`). The admin account is
seeded on first startup and can then be edited from the panel (name, email, profile picture,
password). Changing `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` later does **not** overwrite an
existing admin row — update credentials through the panel instead.

---

## Modules

### Shopkeepers

- **Registration** (`/shop/register`): three-step flow — account → shop details → verification document (stored inline as base64).
- **Review**: applications start as `pending`; an admin approves or rejects (with reason) at `/admin/shops`.
- **Map listing**: approved, active shops are returned by `/api/shops/nearby` and shown **ahead of** OpenStreetMap results in the repair locator.
- **Dashboard** (`/shop`): shopkeepers sign in with email/password and view status, shop info, and messages.

Auth uses stateless HMAC tokens: `shop:{uuid}.{signature}`.

### Live chat (customer ↔ shopkeeper)

- One conversation thread per user–shop pair (`conversations` + `messages` tables).
- Same REST endpoints for both parties; the token (`user` or `shop:`) determines the role.
- **Real-time delivery**: HTTP polling (threads every ~5s, open thread messages every ~3s) — no WebSocket server, which keeps deployment simple (including serverless frontends like Vercel).
- **Notifications**: header bell with unread dropdown; optional desktop alerts via the Web Notifications API.
- **UI**: `/messages` for customers; Messages tab on `/shop` for shopkeepers.

Unread counts use `read_by_user` / `read_by_shop` flags on each message.

### Admin panel

- **Routes**: `/admin` (dashboard), `/admin/users`, `/admin/shops`.
- **Capabilities**: review shop applications, suspend/reactivate users and shops, view user detail and stats.
- Auth uses `admin:{email}.{signature}` tokens backed by a single `admin_accounts` row.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | `postgresql://postgres:password@localhost:5432/damage_ai` | PostgreSQL connection string |
| `OPENAI_API_KEY` | ✅ | — | OpenAI key used for analysis + chat |
| `OPENAI_ONLY_MODE` | — | `true` | Skip local ML models (keep `true`) |
| `GOOGLE_CLIENT_ID` | — | — | Google OAuth client ID (blank disables Google Sign-In) |
| `SECRET_KEY` | — | `dev-secret-change-me-in-production` | Signs stateless auth tokens |
| `ADMIN_EMAIL` | — | `admin@dashboard.com` | Seeds the admin account on first run (visit `/admin`) |
| `ADMIN_PASSWORD` | — | `Admin@123!` | Seeds the admin password on first run |
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
├── frontend/              # React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/          # ConversationsPanel, NotificationBell, ChatNotifier
│   │   │   └── …              # UploadSection, RepairShopLocator, Header, …
│   │   ├── context/           # AuthContext, PreferencesContext (theme)
│   │   ├── hooks/             # useChatThreads, useChatNotifications
│   │   ├── pages/
│   │   │   ├── admin/         # AdminLayout, AdminOverview, AdminUsers, AdminShops
│   │   │   ├── Dashboard.tsx, Messages.tsx, ShopRegister.tsx, ShopDashboard.tsx, …
│   │   └── lib/
│   │       ├── shopApi.ts     # Shopkeeper + admin API client
│   │       ├── chatApi.ts     # Live chat API client
│   │       └── repairShops.ts # OSM geocode + shop lookup
│   └── .env.example
├── backend/               # FastAPI server
│   ├── app/
│   │   ├── api/routes/
│   │   │   ├── predict.py, auth.py, chat.py      # Analysis, users, AI assistant
│   │   │   ├── shopkeeper.py                     # Shop registration, login, nearby shops
│   │   │   ├── admin.py                          # Admin auth, review, user/shop management
│   │   │   └── chat_threads.py                   # Customer ↔ shopkeeper messaging
│   │   ├── core/              # config, logging
│   │   ├── db/                # SQLAlchemy models (User, Shopkeeper, Conversation, …)
│   │   └── main.py            # App entry + router registration
│   ├── tests/
│   ├── requirements.txt       # Runtime deps (OpenAI-only mode)
│   ├── requirements-ml.txt    # Optional ML/training deps
│   └── .env.example
├── ml_training/           # Optional Jupyter notebooks (legacy, not required)
└── deployment/            # docker-compose.yml + nginx.conf
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
| `POST` | `/api/shopkeepers/register` · `/api/shopkeepers/login` | Shop partner sign-up / sign-in |
| `GET` | `/api/shopkeepers/me` | Shop application status |
| `GET` | `/api/shops/nearby` | Approved partner shops near a location (priority on the map) |
| `POST` | `/api/admin/login` | Admin sign-in |
| `GET` · `PATCH` | `/api/admin/profile` | View / edit admin profile (name, email, avatar) |
| `POST` | `/api/admin/change-password` | Change the admin password |
| `GET` | `/api/admin/stats` · `/api/admin/users` · `/api/admin/users/{id}` · `/api/admin/shopkeepers` | Admin dashboard / users / shops data |
| `POST` | `/api/admin/shopkeepers/{id}/approve` · `/reject` · `/active` | Review applications, suspend / reactivate shops |
| `POST` | `/api/admin/users/{id}/active` | Suspend / reactivate a user account |
| `POST` | `/api/chat/threads/start` | Customer opens a chat with an approved shop |
| `GET` | `/api/chat/threads` | List the caller's conversations (user or shop token) |
| `GET` · `POST` | `/api/chat/threads/{id}/messages` | Fetch / send messages in a thread |
| `GET` | `/api/chat/unread` | Total unread count (powers the notification badge) |
| `GET` | `/health` | Health check |

> **Note:** `/api/chat` is the AI repair assistant (GPT). `/api/chat/threads/*` is live messaging between users and shopkeepers.

---

## Key frontend routes

| Route | Who | Purpose |
|-------|-----|---------|
| `/` | Public | Landing / upload |
| `/dashboard` | User | Analysis history, links to messages |
| `/messages` | User | Live chat with shops |
| `/shop/register` | Public | Shopkeeper registration |
| `/shop` | Shopkeeper | Shop dashboard + messages |
| `/admin` | Admin | Dashboard overview |
| `/admin/users` | Admin | User management |
| `/admin/shops` | Admin | Shop application review |

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
- **Admin profile save fails on email** — the admin account skips DNS/MX deliverability checks;
  use a valid-looking email format. Default `admin@dashboard.com` is supported.
- **Chat feels delayed** — live chat uses polling, not WebSockets. Expect up to a few seconds
  before new messages appear unless you refresh or wait for the next poll.

---

## Optional: Training Models

The app does not require trained local models. If you want to experiment with the legacy
training notebooks:

```bash
pip install -r backend/requirements-ml.txt
```

Then run the notebooks in `ml_training/` (`segmentation_train.ipynb`, `detection_train.ipynb`,
`severity_train.ipynb`). Weights would go in `backend/models_weights/`.
