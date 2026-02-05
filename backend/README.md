# MercuryDesk Backend

## Running

```powershell
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

## Env

The backend uses SQLite by default (`backend/mercurydesk.db`).

Optional env vars:

- `MERCURYDESK_DATABASE_URL` (e.g. `postgresql+psycopg://...`)
- `MERCURYDESK_SECRET_KEY` (JWT signing key)
- `MERCURYDESK_FERNET_KEY` (encrypt stored OAuth tokens)
- `MERCURYDESK_CORS_ORIGINS` (comma-separated)

