# MacroMinds

A machine learning-driven macroeconomic analytics dashboard that nowcasts inflation and predicts short-term unemployment trends using real-time data from FRED, BLS, and World Bank APIs.

## Team
- **Jinyi Lian** — Lead Data Engineering & Architect
- **Napat Sammacheep** — Lead Full-Stack Developer
- **Advisor:** Dr. Xumin Zhang

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, Flask, PostgreSQL |
| ML Models | XGBoost, Prophet, ARIMA |
| Data Sources | FRED API, BLS API, World Bank API |
| Frontend | React, TypeScript, Vite, Tailwind CSS, Recharts, shadcn/ui |
| Deployment | Railway (single Docker service) |

## Architecture

The entire app runs as a single Railway service. Flask serves both the REST API (`/api/*`) and the compiled React frontend (catch-all static file handler). There is no separate frontend host — no CORS required in production.

```
macrominds/
├── backend/
│   ├── app.py                    # Flask entry point + static file serving
│   ├── config.py                 # Environment config
│   ├── data/
│   │   ├── ingestion.py          # FRED / BLS / World Bank → PostgreSQL
│   │   └── preprocessing.py      # Feature engineering
│   ├── db/
│   │   ├── schema.sql            # PostgreSQL table definitions
│   │   ├── db_utils.py           # SQLAlchemy engine factory
│   │   └── model_storage.py      # Persist/load models in DB as BYTEA
│   ├── models/
│   │   ├── unemployment_model.py # XGBoost nowcast — unemployment
│   │   └── inflation_model.py    # XGBoost nowcast — inflation
│   └── routes/
│       └── api.py                # REST API blueprint
├── frontend/
│   ├── app/
│   │   ├── App.tsx               # Root dashboard component
│   │   ├── components/           # MetricCard, EconomicChart, AIPredictions, …
│   │   └── services/api.ts       # Typed fetch wrappers
│   ├── main.tsx                  # React entry point
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── Dockerfile                    # Multi-stage: Node build → Python runtime
├── requirements.txt
└── .env.example
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/predictions` | Latest XGBoost unemployment & inflation nowcast |
| GET | `/api/historical` | Historical economic data (`?start_date=2022-01-01`) |
| GET | `/api/forecast` | Prophet/ARIMA multi-step forecast (`?months=6`) |
| GET | `/api/backtest` | Model accuracy vs actuals (`?start_date=2023-01-01`) |
| GET | `/api/simulate` | What-if scenario (`?claims=…&inflation=…&income=…&prev_unemployment=…`) |
| POST | `/api/refresh` | Pull latest data from FRED/BLS/World Bank |
| POST | `/api/train` | Retrain XGBoost models and persist to DB |
| POST | `/api/migrate` | Apply schema.sql to the database |
| POST | `/api/init` | Seed DB + train models if empty |
| GET | `/health` | Health check |

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL

### 1. Clone the repo
```bash
git clone git@github.com:Napooot/macrominds.git
cd macrominds
```

### 2. Configure environment
```bash
cp .env.example .env
```
Edit `.env`:
```
FRED_API_KEY=your_key_here
BLS_API_KEY=your_key_here
DB_USER=your_username
DB_PASS=
DB_HOST=localhost
DB_PORT=5432
DB_NAME=macrominds
```

### 3. Install backend dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up the database
```bash
createdb macrominds
psql macrominds < backend/db/schema.sql
```

### 5. Ingest data and train models
```bash
python -m backend.data.ingestion
python -m backend.models.unemployment_model
python -m backend.models.inflation_model
```

### 6. Run the backend
```bash
python -m backend.app
# API available at http://localhost:5001
```

### 7. Run the frontend (separate terminal)
```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173
```

> In local dev the frontend runs on port 5173 (Vite dev server) and proxies API calls to `localhost:5001`. In production both are served from the same Flask process on Railway.

## Deployment (Railway)

The `Dockerfile` uses a multi-stage build:
1. **Stage 1** — Node 20 compiles the React app into `frontend/dist/`
2. **Stage 2** — Python 3.11 image installs dependencies, copies source and built frontend

Railway auto-deploys on every push to `main`. Required environment variables in Railway:

```
DATABASE_URL      # Provided automatically by Railway PostgreSQL plugin
FRED_API_KEY
BLS_API_KEY
PORT              # Injected automatically by Railway
```

After a fresh deploy, seed the database:
```bash
curl -X POST https://<your-railway-url>/api/init
```
