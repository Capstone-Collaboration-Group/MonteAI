import base64
import json
import time

import jwt
import pytest

from verification.auth import FirebaseIdentity
from verification.receipts import RECEIPT_TYPE, ReceiptSigner


def decode(receipt, settings, signing_key):
    return jwt.decode(
        receipt,
        signing_key.public_key(),
        algorithms=["RS256"],
        issuer=settings.issuer,
        audience=settings.audience,
    )


def test_receipt_is_signed_bound_short_lived_and_unique(settings, signing_key, student):
    signer = ReceiptSigner(settings)
    user = FirebaseIdentity("uid-1", "student@example.com")
    first, expires = signer.issue(user, student, "cdm-front-v1")
    second, _ = signer.issue(user, student, "cdm-front-v1")
    claims = decode(first, settings, signing_key)
    assert jwt.get_unverified_header(first) == {
        "alg": "RS256",
        "kid": "test-key-1",
        "typ": RECEIPT_TYPE,
    }
    assert claims["sub"] == user.uid
    assert claims["email"] == user.email
    assert claims["student_number"] == "00-00123"
    assert claims["name_key"] == student.name_key
    assert claims["purpose"] == "student-registration"
    assert claims["template_id"] == "cdm-front-v1"
    assert claims["exp"] == expires
    assert claims["exp"] - claims["iat"] == 600
    assert claims["jti"] != decode(second, settings, signing_key)["jti"]
    assert "image" not in claims and "ocr" not in claims


def test_expired_receipt_is_rejected(settings, signing_key, student, monkeypatch):
    with monkeypatch.context() as context:
        context.setattr("verification.receipts.time.time", lambda: 1)
        receipt, _ = ReceiptSigner(settings).issue(
            FirebaseIdentity("uid-1", "student@example.com"), student, "cdm-front-v1"
        )
    assert time.time() > 601
    with pytest.raises(jwt.ExpiredSignatureError):
        decode(receipt, settings, signing_key)


def test_changed_student_number_invalidates_signature(settings, signing_key, student):
    receipt, _ = ReceiptSigner(settings).issue(
        FirebaseIdentity("uid-1", "student@example.com"), student, "cdm-front-v1"
    )
    header, _, signature = receipt.split(".")
    claims = decode(receipt, settings, signing_key)
    claims["student_number"] = "00-00999"
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    with pytest.raises(jwt.InvalidSignatureError):
        decode(f"{header}.{payload}.{signature}", settings, signing_key)
