"""Atomic, shared admission control. Stores counters and keyed UID hashes, never captures.

A reservation charges the entire invocation timeout BEFORE image processing. Settlement
refunds unused seconds exactly once. If a worker dies or storage fails, the reservation
stays charged. This bounds admitted OCR work; it is not an Azure billing hard cap.
"""

import hashlib
import hmac
import math
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from .config import ATTEMPT_RESERVATION_SECONDS, Settings
from .errors import VerificationError


@dataclass
class Snapshot:
    data: dict
    etag: str | None = None


@dataclass
class Change:
    snapshot: Snapshot
    delete: bool = False


class Conflict(Exception):
    pass


class QuotaStore(Protocol):
    def get(self, partition: str, row: str) -> Snapshot: ...
    def commit(self, changes: list[Change]) -> None: ...


@dataclass(frozen=True)
class Reservation:
    partition: str
    row: str


class UsageLimiter:
    def __init__(self, store: QuotaStore, settings: Settings):
        self.store = store
        self.settings = settings

    def reserve(self, uid: str, now: datetime | None = None) -> Reservation:
        now = now or datetime.now(UTC)
        partition = now.strftime("%Y-%m")
        day = now.strftime("%Y-%m-%d")
        tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        next_month = (now.replace(day=28) + timedelta(days=4)).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        daily_retry = math.ceil((tomorrow - now).total_seconds())
        monthly_retry = math.ceil((next_month - now).total_seconds())
        user_key = hmac.new(
            self.settings.quota_hmac_key, f"{partition}:{uid}".encode(), hashlib.sha256
        ).hexdigest()
        reservation = Reservation(partition, f"r_{uuid.uuid4().hex}")
        for _ in range(4):
            global_row = self.store.get(partition, "global")
            user_row = self.store.get(partition, f"u_{user_key}")
            global_data, user_data = global_row.data, user_row.data
            daily = user_data.get("DailyAttempts", 0) if user_data.get("Day") == day else 0
            if daily >= self.settings.daily_user_attempts:
                raise VerificationError("daily_limit", 429, retry_after=daily_retry)
            if user_data.get("Attempts", 0) >= self.settings.monthly_user_attempts:
                raise VerificationError("user_limit", 429, retry_after=monthly_retry)
            seconds = global_data.get("Seconds", 0) + ATTEMPT_RESERVATION_SECONDS
            if (
                global_data.get("Attempts", 0) >= self.settings.monthly_attempts
                or seconds > self.settings.monthly_compute_seconds
            ):
                raise VerificationError("monthly_limit", 429, retry_after=monthly_retry)
            global_data.update(Attempts=global_data.get("Attempts", 0) + 1, Seconds=seconds)
            user_data.update(
                Attempts=user_data.get("Attempts", 0) + 1, DailyAttempts=daily + 1, Day=day
            )
            lease = Snapshot(
                {
                    "PartitionKey": partition,
                    "RowKey": reservation.row,
                    "Seconds": ATTEMPT_RESERVATION_SECONDS,
                }
            )
            try:
                self.store.commit([Change(global_row), Change(user_row), Change(lease)])
                return reservation
            except Conflict:
                continue
        raise VerificationError("busy", 429, retry_after=5)

    def settle(self, reservation: Reservation, elapsed: float) -> None:
        charged = min(ATTEMPT_RESERVATION_SECONDS, max(1, math.ceil(elapsed + 2)))
        for _ in range(4):
            lease = self.store.get(reservation.partition, reservation.row)
            if lease.etag is None:
                return  # Already settled, or no reservation was committed.
            global_row = self.store.get(reservation.partition, "global")
            if global_row.etag is None:
                return  # Never recreate a missing global counter during settlement.
            global_row.data["Seconds"] += charged - lease.data["Seconds"]
            try:
                self.store.commit([Change(global_row), Change(lease, delete=True)])
                return
            except Conflict:
                continue
        # Leaving all reserved seconds charged is the conservative fallback.


class TableQuotaStore:
    def __init__(self, settings: Settings):
        from azure.data.tables import TableClient
        from azure.identity import DefaultAzureCredential

        options = {"retry_total": 0, "connection_timeout": 2, "read_timeout": 3}
        if settings.table_connection_string:
            self.client = TableClient.from_connection_string(
                settings.table_connection_string, settings.table_name, **options
            )
        else:
            self.client = TableClient(
                settings.table_endpoint,
                settings.table_name,
                credential=DefaultAzureCredential(),
                **options,
            )

    def get(self, partition: str, row: str) -> Snapshot:
        from azure.core.exceptions import AzureError, ResourceNotFoundError

        try:
            entity = self.client.get_entity(partition, row)
            return Snapshot(dict(entity), entity.metadata["etag"])
        except ResourceNotFoundError as error:
            # A missing TABLE is a configuration failure, not an empty allowance.
            if str(error.error_code) not in (
                "ResourceNotFound",
                "TableErrorCode.RESOURCE_NOT_FOUND",
            ):
                raise VerificationError("service_unavailable", 503, retry_after=60) from None
            return Snapshot({"PartitionKey": partition, "RowKey": row})
        except AzureError:
            raise VerificationError("service_unavailable", 503, retry_after=60) from None

    def commit(self, changes: list[Change]) -> None:
        from azure.core import MatchConditions
        from azure.core.exceptions import AzureError, HttpResponseError
        from azure.data.tables import UpdateMode

        operations = []
        for change in changes:
            snapshot = change.snapshot
            if change.delete or snapshot.etag is not None:
                options = {
                    "etag": snapshot.etag,
                    "match_condition": MatchConditions.IfNotModified,
                }
                if change.delete:
                    operations.append(("delete", snapshot.data, options))
                else:
                    operations.append(
                        ("update", snapshot.data, {**options, "mode": UpdateMode.REPLACE})
                    )
            else:
                operations.append(("create", snapshot.data))
        try:
            self.client.submit_transaction(operations)
        except HttpResponseError as error:
            if error.status_code in (409, 412):
                raise Conflict from None
            raise VerificationError("service_unavailable", 503, retry_after=60) from None
        except AzureError:
            raise VerificationError("service_unavailable", 503, retry_after=60) from None
