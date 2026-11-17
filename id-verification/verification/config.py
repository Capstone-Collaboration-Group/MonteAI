import base64
import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MAX_BODY_BYTES = 4 * 1024 * 1024
MAX_IMAGE_BYTES = 3 * 1024 * 1024
MAX_PIXELS = 12_000_000
ATTEMPT_RESERVATION_SECONDS = 30  # Must cover host.json's functionTimeout.
PIPELINE_TIMEOUT_SECONDS = 18
RECEIPT_TTL_SECONDS = 600


@dataclass(frozen=True, repr=False)
class Settings:
    firebase_project_id: str
    allowed_origins: tuple[str, ...]
    issuer: str
    audience: str
    key_id: str
    private_key: bytes
    quota_hmac_key: bytes
    table_endpoint: str
    table_connection_string: str
    table_name: str
    monthly_attempts: int = 6000
    monthly_compute_seconds: int = 40000
    daily_user_attempts: int = 8
    monthly_user_attempts: int = 20

    @classmethod
    def from_env(cls) -> "Settings":
        def required(name: str) -> str:
            value = os.environ.get(name, "").strip()
            if not value:
                raise ValueError(f"Missing setting: {name}")
            return value

        def positive(name: str, default: int, maximum: int) -> int:
            value = int(os.environ.get(name, str(default)))
            if value < 1 or value > maximum:
                raise ValueError(f"Invalid setting: {name}")
            return value

        origins = tuple(x.strip() for x in required("IDV_ALLOWED_ORIGINS").split(","))
        for origin in origins:
            parsed = urlparse(origin)
            if (
                not origin
                or origin == "*"
                or parsed.scheme not in ("http", "https")
                or not parsed.netloc
                or parsed.path
                or parsed.query
                or parsed.fragment
                or parsed.username
                or (parsed.scheme == "http" and parsed.hostname not in ("localhost", "127.0.0.1"))
            ):
                raise ValueError("Invalid IDV_ALLOWED_ORIGINS")

        private_key = base64.b64decode(required("IDV_RECEIPT_PRIVATE_KEY_B64"), validate=True)
        quota_key = base64.b64decode(required("IDV_QUOTA_HMAC_KEY_B64"), validate=True)
        if len(quota_key) < 32:
            raise ValueError("IDV_QUOTA_HMAC_KEY_B64 needs at least 32 random bytes")
        connection = os.environ.get("IDV_TABLE_CONNECTION_STRING", "")
        endpoint = os.environ.get("IDV_TABLE_ENDPOINT", "")
        if not connection and not endpoint:
            raise ValueError("Configure quota table storage")
        if os.environ.get("WEBSITE_INSTANCE_ID") and connection:
            raise ValueError("Use managed identity for Azure quota storage")

        return cls(
            firebase_project_id=required("IDV_FIREBASE_PROJECT_ID"),
            allowed_origins=origins,
            issuer=required("IDV_RECEIPT_ISSUER").rstrip("/"),
            audience=os.environ.get("IDV_RECEIPT_AUDIENCE", "monteai-registration"),
            key_id=required("IDV_RECEIPT_KEY_ID"),
            private_key=private_key,
            quota_hmac_key=quota_key,
            table_endpoint=endpoint,
            table_connection_string=connection,
            table_name=os.environ.get("IDV_QUOTA_TABLE", "IdVerificationQuota"),
            monthly_attempts=positive("IDV_MONTHLY_ATTEMPTS", 6000, 6000),
            monthly_compute_seconds=positive("IDV_MONTHLY_COMPUTE_SECONDS", 40000, 40000),
            daily_user_attempts=positive("IDV_DAILY_USER_ATTEMPTS", 8, 8),
            monthly_user_attempts=positive("IDV_MONTHLY_USER_ATTEMPTS", 20, 20),
        )
