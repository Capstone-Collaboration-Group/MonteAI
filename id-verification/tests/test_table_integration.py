"""Real SDK/HTTP transaction tests against an explicitly enabled LOCAL Azurite instance."""

import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import UTC, datetime
from urllib.parse import urlparse

import pytest

from verification.errors import VerificationError
from verification.quota import Change, Conflict, Snapshot, TableQuotaStore, UsageLimiter

pytestmark = pytest.mark.integration
NOW = datetime(2026, 11, 16, tzinfo=UTC)


@pytest.fixture
def table_settings(settings):
    connection = os.environ.get("IDV_TEST_TABLE_CONNECTION_STRING", "")
    if not connection:
        pytest.skip("Set IDV_TEST_TABLE_CONNECTION_STRING to run local Azurite tests")
    configured = replace(
        settings, table_connection_string=connection, table_name=f"IdvTest{uuid.uuid4().hex}"
    )
    store = TableQuotaStore(configured)
    if urlparse(store.client.url).hostname not in ("localhost", "127.0.0.1"):
        pytest.fail("Integration tests require a local Azurite endpoint")
    store.client.create_table()
    try:
        yield configured
    finally:
        store.client.delete_table()
        store.client.close()


@pytest.fixture
def table_store(table_settings):
    store = TableQuotaStore(table_settings)
    try:
        yield store
    finally:
        store.client.close()


def test_real_table_reservation_and_idempotent_settlement(table_store, table_settings):
    limiter = UsageLimiter(table_store, table_settings)
    reservation = limiter.reserve("synthetic-uid", NOW)
    assert table_store.get("2026-11", "global").data["Seconds"] == 30
    limiter.settle(reservation, 3.2)
    limiter.settle(reservation, 0)
    result = table_store.get("2026-11", "global")
    assert (result.data["Attempts"], result.data["Seconds"]) == (1, 6)
    assert table_store.get(reservation.partition, reservation.row).etag is None


def test_etag_conflict_rolls_back_every_operation(table_store):
    empty = table_store.get("2026-11", "global")
    empty.data["Attempts"] = 1
    table_store.commit([Change(empty)])
    stale = table_store.get("2026-11", "global")
    current = table_store.get("2026-11", "global")
    current.data["Attempts"] = 2
    table_store.commit([Change(current)])
    stale.data["Attempts"] = 3
    lease = Snapshot({"PartitionKey": "2026-11", "RowKey": "uncommitted", "Seconds": 30})
    with pytest.raises(Conflict):
        table_store.commit([Change(lease), Change(stale)])
    assert table_store.get("2026-11", "uncommitted").etag is None
    assert table_store.get("2026-11", "global").data["Attempts"] == 2


def test_cold_sdk_clients_share_atomic_limits(table_settings, table_store):
    limited = replace(table_settings, monthly_attempts=3)

    def attempt(index):
        store = TableQuotaStore(limited)
        try:
            UsageLimiter(store, limited).reserve(f"synthetic-{index}", NOW)
            return True
        except VerificationError as error:
            assert error.code in ("busy", "monthly_limit")
            return False
        finally:
            store.client.close()

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(attempt, range(8)))
    assert sum(results) == 3
    assert table_store.get("2026-11", "global").data["Seconds"] == 90


def test_missing_table_is_a_service_failure(table_settings):
    store = TableQuotaStore(replace(table_settings, table_name=f"Missing{uuid.uuid4().hex}"))
    try:
        with pytest.raises(VerificationError, match="service_unavailable"):
            UsageLimiter(store, table_settings).reserve("synthetic-uid", NOW)
    finally:
        store.client.close()
