import base64
import binascii
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from .auth import FirebaseVerifier
from .config import MAX_BODY_BYTES, MAX_IMAGE_BYTES, Settings
from .errors import MESSAGES, VerificationError
from .identity import StudentIdentity
from .pipeline import VerificationPipeline
from .quota import TableQuotaStore, UsageLimiter
from .receipts import ReceiptSigner

logger = logging.getLogger("id_verification")


@dataclass(repr=False)
class Response:
    status: int
    body: dict | None
    headers: dict[str, str]


def parse_request(body: bytes) -> tuple[StudentIdentity, str]:
    def unique_keys(pairs):
        data = {}
        for key, value in pairs:
            if key in data:
                raise ValueError("Duplicate JSON key")
            data[key] = value
        return data

    try:
        data = json.loads(body, object_pairs_hook=unique_keys)
        if not isinstance(data, dict) or set(data) != {"student", "imageBase64"}:
            raise ValueError("Invalid envelope")
        student = StudentIdentity.from_dict(data["student"])
        encoded = data["imageBase64"]
        if (
            not isinstance(encoded, str)
            or not encoded
            or len(encoded) > (MAX_IMAGE_BYTES + 2) // 3 * 4
        ):
            raise ValueError("Invalid encoded image")
        return student, encoded
    except (ValueError, TypeError, RecursionError):
        raise VerificationError("invalid_request") from None


class VerificationService:
    def __init__(
        self, settings: Settings, *, authenticator=None, limiter=None, pipeline=None, signer=None
    ):
        self.settings = settings
        self.authenticator = authenticator or FirebaseVerifier(settings.firebase_project_id)
        self.limiter = limiter or UsageLimiter(TableQuotaStore(settings), settings)
        self.pipeline = pipeline or VerificationPipeline()
        self.signer = signer or ReceiptSigner(settings)

    def handle(self, method: str, headers: dict[str, str], body: bytes) -> Response:
        started = time.monotonic()
        request_id = str(uuid.uuid4())
        headers = {key.lower(): value for key, value in headers.items()}
        result_headers = {
            "Cache-Control": "no-store, max-age=0",
            "Pragma": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "Vary": "Origin",
            "Access-Control-Expose-Headers": "Retry-After",
        }
        raw = None
        encoded = None
        reservation = None
        code = "service_unavailable"
        try:
            origin = headers.get("origin")
            if origin:
                if origin not in self.settings.allowed_origins:
                    raise VerificationError("origin_not_allowed", 403)
                result_headers["Access-Control-Allow-Origin"] = origin
            if method == "OPTIONS":
                result_headers.update(
                    {
                        "Access-Control-Allow-Methods": "POST, OPTIONS",
                        "Access-Control-Allow-Headers": "Authorization, Content-Type",
                        "Access-Control-Max-Age": "600",
                    }
                )
                code = "preflight"
                return Response(204, None, result_headers)
            if method != "POST":
                result_headers["Allow"] = "POST, OPTIONS"
                raise VerificationError("invalid_request", 405)
            if os.environ.get("IDV_ENABLED", "true").lower() != "true":
                raise VerificationError("verification_disabled", 503, retry_after=3600)
            if headers.get("content-type", "").split(";")[0].strip().lower() != "application/json":
                raise VerificationError("invalid_request", 415)
            if len(body) > MAX_BODY_BYTES:
                raise VerificationError("image_too_large", 413)
            user = self.authenticator.verify(headers.get("authorization", ""))
            student, encoded = parse_request(body)
            body = b""
            reservation = self.limiter.reserve(user.uid)
            try:
                raw = bytearray(base64.b64decode(encoded, validate=True))
            except (ValueError, binascii.Error):
                raise VerificationError("invalid_request") from None
            finally:
                encoded = None
            template_id = self.pipeline.verify(raw, student)
            receipt, expires = self.signer.issue(user, student, template_id)
            code = "verified"
            return Response(
                200,
                {
                    "outcome": "verified",
                    "receipt": receipt,
                    "expiresAt": datetime.fromtimestamp(expires, UTC).isoformat(),
                    "templateId": template_id,
                    "requestId": request_id,
                },
                result_headers,
            )
        except VerificationError as error:
            code = error.code
            if error.retry_after is not None:
                result_headers["Retry-After"] = str(error.retry_after)
            return Response(
                error.status,
                {
                    "outcome": error.outcome,
                    "code": code,
                    "message": MESSAGES[code],
                    "requestId": request_id,
                },
                result_headers,
            )
        except Exception:
            # Never log exceptions from decoders/OCR/HTTP with request contents or tokens.
            code = "service_unavailable"
            return Response(
                503,
                {
                    "outcome": "error",
                    "code": code,
                    "message": MESSAGES[code],
                    "requestId": request_id,
                },
                {**result_headers, "Retry-After": "60"},
            )
        finally:
            if raw is not None:
                raw[:] = b"\0" * len(raw)
            raw = encoded = None
            body = b""
            if reservation is not None:
                try:
                    self.limiter.settle(reservation, time.monotonic() - started)
                except Exception:
                    # Retain the full debit if storage is unavailable. Do not retry OCR.
                    logger.warning("idv_quota_settlement_deferred request_id=%s", request_id)
            logger.info(
                "idv_result request_id=%s code=%s elapsed_ms=%d",
                request_id,
                code,
                int((time.monotonic() - started) * 1000),
            )
