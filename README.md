# MacroMinds

A machine learning-driven macroeconomic analytics dashboard that nowcasts inflation and predicts short-term unemployment trends.

## Team
- **Jinyi Lian** — Lead Data Engineering & Architect
- **Napat Sammacheep** — Lead Full-Stack Developer

## Tech Stack
- **Backend:** Python, Flask, PostgreSQL
- **ML Models:** XGBoost, ARIMA, Random Forest
- **Data Sources:** FRED API, BLS API, World Bank API
- **Frontend:** Flask Templates, Plotly

## Setup
1. Clone the repo
2. Copy `.env.example` to `.env` and add your API keys
3. Install dependencies: `pip install -r requirements.txt`
4. Set up PostgreSQL (see `backend/db/schema.sql`)
5. Run the app: `python backend/app.py`
