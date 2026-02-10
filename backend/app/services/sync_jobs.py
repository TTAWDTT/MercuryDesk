from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from threading import Lock
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from app import crud
from app.db import create_session
from app.settings import settings
from app.sync import sync_account

_FEED_PROVIDERS = {"rss", "bilibili", "x", "douyin", "xiaohongshu", "weibo"}
_JOBS_RETENTION = timedelta(hours=6)
_jobs_lock = Lock()
_jobs_executor = ThreadPoolExecutor(
    max_workers=max(1, int(settings.sync_job_max_workers)),
    thread_name_prefix="sync-job",
)


@dataclass(slots=True)
class SyncJob:
    job_id: str
    user_id: int
    account_id: int
    force_full: bool
    status: str = "queued"  # queued | running | succeeded | failed
    inserted: int | None = None
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    started_at: datetime | None = None
    finished_at: datetime | None = None


_jobs: dict[str, SyncJob] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cleanup_expired_jobs(now: datetime) -> None:
    stale_ids = [
        job_id
        for job_id, job in _jobs.items()
        if job.finished_at is not None and now - job.finished_at > _JOBS_RETENTION
    ]
    for job_id in stale_ids:
        _jobs.pop(job_id, None)


def _should_run_inline() -> bool:
    """
    In-memory SQLite uses a shared single connection in tests.
    Running background sync jobs on a separate thread can race with request
    sessions and produce flaky rowcount/stale-data errors.
    """
    db = create_session()
    try:
        bind = db.get_bind()
        if bind is None:
            return False
        if bind.dialect.name != "sqlite":
            return False
        db_name = (getattr(bind.url, "database", None) or "").strip().lower()
        return db_name in {"", ":memory:"} or db_name.startswith("file::memory:")
    finally:
        db.close()


def _set_running(job: SyncJob) -> None:
    job.status = "running"
    job.started_at = _now()
    job.error = None


def _set_succeeded(job: SyncJob, inserted: int) -> None:
    job.status = "succeeded"
    job.inserted = int(inserted)
    job.finished_at = _now()
    job.error = None


def _set_failed(job: SyncJob, error: str) -> None:
    job.status = "failed"
    job.inserted = None
    job.finished_at = _now()
    job.error = error


def _run_sync_job(job_id: str) -> None:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        _set_running(job)

    db = create_session()
    try:
        account = crud.get_account(db, user_id=job.user_id, account_id=job.account_id)
        if account is None:
            raise ValueError("Account not found")

        # Self-healing: keep behavior consistent with the request-time sync path.
        if account.provider in _FEED_PROVIDERS and not account.feed_config:
            crud.ensure_feed_account_config(db, account_id=account.id)
            db.refresh(account)

        inserted = sync_account(db, account=account, force_full=job.force_full)
    except Exception as exc:
        with _jobs_lock:
            current = _jobs.get(job_id)
            if current is not None:
                _set_failed(current, str(exc) or "Sync failed")
        return
    finally:
        db.close()

    with _jobs_lock:
        current = _jobs.get(job_id)
        if current is not None:
            _set_succeeded(current, inserted)


def enqueue_sync_job(*, user_id: int, account_id: int, force_full: bool) -> SyncJob:
    created_at = _now()
    job = SyncJob(
        job_id=uuid4().hex,
        user_id=user_id,
        account_id=account_id,
        force_full=force_full,
        created_at=created_at,
    )
    with _jobs_lock:
        _cleanup_expired_jobs(created_at)
        _jobs[job.job_id] = job
    if _should_run_inline():
        _run_sync_job(job.job_id)
    else:
        _jobs_executor.submit(_run_sync_job, job.job_id)
    return replace(job)


def get_sync_job(*, job_id: str, user_id: int) -> SyncJob | None:
    with _jobs_lock:
        _cleanup_expired_jobs(_now())
        job = _jobs.get(job_id)
        if job is None or job.user_id != user_id:
            return None
        return replace(job)
