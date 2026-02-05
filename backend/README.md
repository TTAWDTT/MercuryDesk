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
- `MERCURYDESK_FERNET_KEY` (encrypt stored secrets: OAuth tokens / IMAP passwords)
- `MERCURYDESK_CORS_ORIGINS` (comma-separated)
- `MERCURYDESK_MEDIA_DIR` (where uploaded avatars are stored; default `./media`)
