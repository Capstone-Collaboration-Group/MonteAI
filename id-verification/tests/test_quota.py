from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from verification.config import ATTEMPT_RESERVATION_SECONDS
from verification.errors import VerificationError
from verification.quota import UsageLimiter

NOW = datetime(2026, 11, 16, 10, tzinfo=UTC)


def test_settlement_is_single_use_and_failures_still_count(store, settings):
    limiter = UsageLimiter(store, settings)
    reservation = limiter.reserve("uid", NOW)
    assert store.get("2026-11", "global").data["Seconds"] == ATTEMPT_RESERVATION_SECONDS
    limiter.settle(reservation, 3.2)
    limiter.settle(reservation, 0)
    global_row = store.get("2026-11", "global").data
    assert global_row["Attempts"] == 1
    assert global_row["Seconds"] == 6


def test_daily_and_monthly_user_limits(store, settings):
    limiter = UsageLimiter(store, replace(settings, daily_user_attempts=2, monthly_user_attempts=3))
    limiter.reserve("uid", NOW)
    limiter.reserve("uid", NOW)
    with pytest.raises(VerificationError, match="daily_limit"):
        limiter.reserve("uid", NOW)
    limiter.reserve("uid", NOW + timedelta(days=1))
    with pytest.raises(VerificationError, match="user_limit"):
        limiter.reserve("uid", NOW + timedelta(days=2))
    # A new UTC month has an independent allowance, even on the same worker.
    limiter.reserve("uid", NOW.replace(month=12))


def test_cold_workers_share_monthly_compute_reservations(store, settings):
    limited = replace(settings, monthly_compute_seconds=60)
    UsageLimiter(store, limited).reserve("one", NOW)
    UsageLimiter(store, limited).reserve("two", NOW)
    with pytest.raises(VerificationError, match="monthly_limit"):
        UsageLimiter(store, limited).reserve("three", NOW)
    assert store.get("2026-11", "global").data["Attempts"] == 2


def test_parallel_workers_cannot_over_admit(store, settings):
    limited = replace(settings, monthly_attempts=5)

    def attempt(index):
        try:
            UsageLimiter(store, limited).reserve(f"uid-{index}", NOW)
            return True
        except VerificationError:
            return False

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(attempt, range(40)))
    assert sum(results) == 5
    assert store.get("2026-11", "global").data["Attempts"] == 5
    assert store.get("2026-11", "global").data["Seconds"] == 150


def test_failed_storage_never_falls_back_to_unlimited_usage(store, settings, monkeypatch):
    def unavailable(*args):
        raise VerificationError("service_unavailable", 503)

    monkeypatch.setattr(store, "commit", unavailable)
    with pytest.raises(VerificationError, match="service_unavailable"):
        UsageLimiter(store, settings).reserve("uid", NOW)
    assert not store.rows


def test_quota_rows_contain_only_counters_and_period_keyed_hashes(store, settings):
    limiter = UsageLimiter(store, settings)
    limiter.reserve("raw-firebase-identity", NOW)
    serialized = str(store.rows)
    assert "raw-firebase-identity" not in serialized
    assert "image" not in serialized.lower()
    assert "email" not in serialized.lower()
    old_keys = {key[1] for key in store.rows if key[1].startswith("u_")}
    limiter.reserve("raw-firebase-identity", NOW.replace(month=12))
    new_keys = {key[1] for key in store.rows if key[0] == "2026-12" and key[1].startswith("u_")}
    assert old_keys.isdisjoint(new_keys)
