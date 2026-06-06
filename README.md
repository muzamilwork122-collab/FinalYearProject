# 📱 mobile-damage-ai

AI-powered mobile device damage detection and severity assessment.

## Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI (Python)
- **AI Models**: PyTorch (segmentation + detection) + scikit-learn (severity)
- **Deployment**: Docker Compose + Nginx

---

## Quick Start

### Option A — Docker (recommended)
```bash
docker-compose -f deployment/docker-compose.yml up --build
```
Open http://localhost

### Option B — Local Dev

**Backend**
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

---

## Project Structure
```
mobile-damage-ai/
├── frontend/        # React SPA
├── backend/         # FastAPI inference server
├── ml_training/     # Jupyter notebooks for training
└── deployment/      # Docker Compose + Nginx
```

## Training Models
1. Prepare your dataset (images + masks/annotations)
2. Run notebooks in `ml_training/` in order:
   - `segmentation_train.ipynb`
   - `detection_train.ipynb`
   - `severity_train.ipynb`
3. Saved weights go to `backend/models_weights/`

## API
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/predict` | Upload image, get damage analysis |
| GET | `/api/reports/{id}` | Retrieve saved report |
| GET | `/health` | Health check |

## Running Tests
```bash
cd backend
pytest tests/ -v
```
