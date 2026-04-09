# MacroMinds

A machine learning-driven macroeconomic analytics dashboard that nowcasts inflation and predicts short-term unemployment trends using real-time data from FRED, BLS, and World Bank APIs.

## Team
- **Jinyi Lian** — Lead Data Engineering & Architect
- **Napat Sammacheep** — Lead Full-Stack Developer
- **Advisor:** Dr. Xumin Zhang

## Tech Stack
- **Backend:** Python, Flask, PostgreSQL
- **ML Models:** XGBoost, ARIMA, Random Forest
- **Data Sources:** FRED API, BLS API, World Bank API
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts, shadcn/ui

## Setup

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 17
- Homebrew (macOS)

### 1. Clone the Repo
```bash
git clone git@github.com:Napooot/macrominds.git
cd macrominds
```

### 2. Set Up the Database
```bash
brew install postgresql@17
brew services start postgresql@17
createdb macrominds
psql macrominds < backend/db/schema.sql
```

### 3. Configure Environment
```bash
cp .env.example .env
```
Edit `.env` and add your API keys:
```
FRED_API_KEY=your_key_here
BLS_API_KEY=your_key_here
DB_USER=your_mac_username
DB_PASS=
DB_HOST=localhost
DB_PORT=5432
DB_NAME=macrominds
```

### 4. Install Backend Dependencies
```bash
pip install -r requirements.txt
brew install libomp  # Required for XGBoost on macOS
```

### 5. Ingest Data
```bash
python -m backend.data.ingestion
```
This pulls data from FRED, BLS, and World Bank APIs into PostgreSQL.

### 6. Train Models
```bash
python -m backend.models.unemployment_model
python -m backend.models.inflation_model
```

### 7. Start the Backend API
```bash
FLASK_PORT=5001 python -m backend.app
```
The API runs at `http://localhost:5001`. Available endpoints:
- `GET /api/predictions` — Latest unemployment and inflation nowcast
- `GET /api/historical?start_date=2022-01-01` — Historical economic data
- `GET /api/forecast?months=6` — Multi-step forward nowcast
- `GET /api/backtest?start_date=2023-01-01` — Model accuracy vs actual values
- `GET /api/simulate?claims=600000&inflation=5.0&income=-2.0&prev_unemployment=4.0` — What-if scenarios

### 8. Start the Frontend
```bash
npm install
npm run dev
```
The dashboard runs at `http://localhost:5173`.

**Note:** Both the backend (Step 7) and frontend (Step 8) must be running simultaneously in separate terminal tabs.

## Project Structure
```
macrominds/
├── backend/
│   ├── app.py                    # Flask entry point
│   ├── data/
│   │   ├── ingestion.py          # FRED/BLS/World Bank → PostgreSQL
│   │   └── preprocessing.py      # DB → feature engineering → model-ready data
│   ├── db/
│   │   ├── schema.sql            # PostgreSQL table definitions
│   │   └── db_utils.py           # Database connection utility
│   ├── models/
│   │   ├── unemployment_model.py # XGBoost + ARIMA training & prediction
│   │   ├── inflation_model.py    # XGBoost training & prediction
│   │   ├── unemployment_xgb.pkl  # Trained unemployment model
│   │   └── inflation_xgb.pkl     # Trained inflation model
│   └── routes/
│       └── api.py                # REST API endpoints
├── frontend/
│   ├── app/
│   │   ├── App.tsx               # Main dashboard component
│   │   ├── components/           # React components
│   │   └── services/
│   │       └── api.ts            # API client (fetch functions + types)
│   ├── main.tsx                  # React entry point
│   └── styles/                   # Tailwind + theme CSS
├── .env.example                  # Environment variable template
├── requirements.txt              # Python dependencies
├── package.json                  # Node.js dependencies
└── vite.config.ts                # Vite build config
```

## GitHub Link
https://github.com/Napooot/macrominds
