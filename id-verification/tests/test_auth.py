import json
import time
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

import jwt
import pytest
import requests
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization

from verification.auth import CERTIFICATES_URL, FirebaseVerifier
from verification.errors import VerificationError


def token(signing_key, **overrides):
    now = int(time.time())
    claims = {
        "iss": "https://securetoken.google.com/test-project",
        "aud": "test-project",
        "sub": "firebase-uid",
        "email": "student@example.com",
        "email_verified": True,
        "iat": now,
        "exp": now + 3600,
        "auth_time": now,
        "firebase": {"sign_in_provider": "password"},
        **overrides,
    }
    return "Bearer " + jwt.encode(claims, signing_key, algorithm="RS256", headers={"kid": "known"})


@pytest.fixture
def verifier(signing_key):
    instance = FirebaseVerifier("test-project")
    instance._keys = {"known": signing_key.public_key()}
    instance._expires = time.monotonic() + 3600
    instance._last_refresh = time.monotonic()
    return instance


def test_accepts_verified_personal_email(verifier, signing_key):
    result = verifier.verify(token(signing_key, email="Student@Example.com"))
    assert (result.uid, result.email) == ("firebase-uid", "student@example.com")


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "another-project"},
        {"aud": ["test-project", "another-project"]},
        {"iss": "https://attacker.example"},
        {"exp": 1},
        {"exp": str(int(time.time()) + 3600)},
        {"iat": True},
        {"auth_time": int(time.time()) + 600},
        {"auth_time": True},
        {"sub": ""},
        {"email": "not-an-email"},
        {"firebase": {"tenant": "another-tenant"}},
        {"firebase": {"sign_in_provider": "anonymous"}},
    ],
)
def test_rejects_invalid_token_bindings(verifier, signing_key, overrides):
    with pytest.raises(VerificationError) as error:
        verifier.verify(token(signing_key, **overrides))
    assert error.value.status == 401


@pytest.mark.parametrize("verified", [False, "true", 1, None])
def test_requires_boolean_verified_email(verifier, signing_key, verified):
    with pytest.raises(VerificationError) as error:
        verifier.verify(token(signing_key, email_verified=verified))
    assert error.value.code == "email_unverified"


def test_rejects_tampered_signature(verifier, signing_key):
    header, payload, signature = token(signing_key)[7:].split(".")
    replacement = ("a" if signature[0] != "a" else "b") + signature[1:]
    with pytest.raises(VerificationError):
        verifier.verify(f"Bearer {header}.{payload}.{replacement}")


def test_unknown_key_does_not_fetch_per_request(verifier, signing_key, monkeypatch):
    def no_network(*args, **kwargs):
        pytest.fail("Unknown keys within the refresh cooldown must not fetch certificates")

    monkeypatch.setattr(verifier._session, "get", no_network)
    value = jwt.encode({"sub": "user"}, signing_key, algorithm="RS256", headers={"kid": "unknown"})
    for _ in range(5):
        with pytest.raises(VerificationError):
            verifier.verify("Bearer " + value)


def test_fetches_x509_public_keys_and_reuses_them(signing_key, monkeypatch):
    now = datetime.now(UTC)
    subject = x509.Name([x509.NameAttribute(x509.NameOID.COMMON_NAME, "test-certificate")])
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(signing_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=1))
        .sign(signing_key, hashes.SHA256())
    )
    response = requests.Response()
    response.status_code = 200
    response.headers["Cache-Control"] = "public, max-age=3600"
    response._content = json.dumps(
        {"known": certificate.public_bytes(serialization.Encoding.PEM).decode()}
    ).encode()
    response.close = lambda: None
    get = MagicMock(return_value=response)
    verifier = FirebaseVerifier("test-project")
    monkeypatch.setattr(verifier._session, "get", get)

    for _ in range(2):
        assert verifier.verify(token(signing_key)).uid == "firebase-uid"
    get.assert_called_once_with(CERTIFICATES_URL, timeout=(2, 3))
    assert 3500 < verifier._expires - time.monotonic() <= 3601


def test_expired_keys_fail_closed_when_certificate_service_is_down(
    verifier, signing_key, monkeypatch
):
    verifier._expires = 0
    verifier._last_refresh = float("-inf")
    get = MagicMock(side_effect=requests.Timeout)
    monkeypatch.setattr(verifier._session, "get", get)
    for _ in range(2):
        with pytest.raises(VerificationError) as error:
            verifier.verify(token(signing_key))
        assert error.value.code == "service_unavailable"
        assert error.value.status == 503
    assert get.call_count == 1
