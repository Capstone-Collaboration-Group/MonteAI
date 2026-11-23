import base64
import json
from types import SimpleNamespace

import pytest

from verification.auth import FirebaseIdentity
from verification.config import MAX_BODY_BYTES
from verification.errors import VerificationError, retake
from verification.quota import UsageLimiter
from verification.service import VerificationService, parse_request


@pytest.fixture
def body(student_dict):
    return json.dumps(
        {
            "student": student_dict,
            "imageBase64": base64.b64encode(b"private capture").decode(),
        }
    ).encode()


def service(settings, store, **overrides):
    defaults = {
        "authenticator": SimpleNamespace(
            verify=lambda _: FirebaseIdentity("uid", "student@example.com")
        ),
        "limiter": UsageLimiter(store, settings),
        "pipeline": SimpleNamespace(verify=lambda *_: "cdm-front-v1"),
    }
    return VerificationService(settings, **{**defaults, **overrides})


@pytest.mark.parametrize("outcome", ["success", "retake", "exception"])
def test_image_is_cleared_for_all_processing_outcomes(settings, store, body, outcome):
    held = []

    def verify(raw, student):
        held.append(raw)
        if outcome == "retake":
            raise retake("image_quality")
        if outcome == "exception":
            raise RuntimeError("private capture details must not be logged")
        return "cdm-front-v1"

    app = service(settings, store, pipeline=SimpleNamespace(verify=verify))
    response = app.handle("POST", {"Content-Type": "application/json"}, body)
    assert response.status == {"success": 200, "retake": 422, "exception": 503}[outcome]
    assert held and held[0] == bytearray(len(b"private capture"))
    assert "private capture" not in json.dumps(response.body)
    assert response.headers["Cache-Control"].startswith("no-store")


def test_unverified_email_never_reaches_ocr_or_quota(settings, store, body):
    def deny(_):
        raise VerificationError("email_unverified", 403)

    def no_ocr(*args):
        pytest.fail("Unauthenticated input reached OCR")

    app = service(
        settings,
        store,
        authenticator=SimpleNamespace(verify=deny),
        pipeline=SimpleNamespace(verify=no_ocr),
    )
    assert app.handle("POST", {"Content-Type": "application/json"}, body).status == 403
    assert not store.rows


def test_cors_preflight_is_cheap_and_denies_other_origins(settings, store):
    app = service(settings, store)
    response = app.handle("OPTIONS", {"Origin": "http://localhost:8080"}, b"")
    assert response.status == 204
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:8080"
    denied = app.handle("OPTIONS", {"Origin": "https://untrusted.example"}, b"")
    assert denied.status == 403
    assert "Access-Control-Allow-Origin" not in denied.headers
    assert not store.rows


def test_oversized_request_and_duplicate_json_keys(settings, store, body):
    app = service(settings, store)
    assert (
        app.handle("POST", {"Content-Type": "application/json"}, b"x" * (MAX_BODY_BYTES + 1)).status
        == 413
    )
    with pytest.raises(VerificationError, match="invalid_request"):
        parse_request(b'{"student": {}, "student": {}, "imageBase64": "eA=="}')
    assert not store.rows


def test_failure_logs_do_not_contain_request_or_exception(settings, store, body, caplog):
    def fail(*args):
        raise RuntimeError("private capture details must not be logged")

    with caplog.at_level("INFO"):
        response = service(settings, store, pipeline=SimpleNamespace(verify=fail)).handle(
            "POST", {"Content-Type": "application/json"}, body
        )
    assert response.status == 503
    assert "private capture" not in caplog.text
    assert "student@example.com" not in caplog.text


def test_kill_switch_prevents_new_reservations(settings, store, body, monkeypatch):
    monkeypatch.setenv("IDV_ENABLED", "false")
    response = service(settings, store).handle("POST", {"Content-Type": "application/json"}, body)
    assert response.body["code"] == "verification_disabled"
    assert not store.rows


def test_invalid_base64_is_charged_but_never_processed(settings, store, body):
    data = json.loads(body)
    data["imageBase64"] = "invalid base64!"

    def no_ocr(*args):
        pytest.fail("Invalid base64 reached OCR")

    response = service(settings, store, pipeline=SimpleNamespace(verify=no_ocr)).handle(
        "POST", {"Content-Type": "application/json"}, json.dumps(data).encode()
    )
    assert response.status == 400
    assert sum(row.data.get("Attempts", 0) for row in store.rows.values()) == 2


def test_cleanup_also_runs_when_python_invocation_is_cancelled(settings, store, body):
    class Cancelled(BaseException):
        pass

    held = []

    def cancel(raw, _):
        held.append(raw)
        raise Cancelled

    app = service(settings, store, pipeline=SimpleNamespace(verify=cancel))
    with pytest.raises(Cancelled):
        app.handle("POST", {"Content-Type": "application/json"}, body)
    assert held[0] == bytearray(len(b"private capture"))


def test_settlement_failure_keeps_full_reservation(settings, store, body, monkeypatch):
    limiter = UsageLimiter(store, settings)

    def unavailable(*args):
        raise VerificationError("service_unavailable", 503)

    monkeypatch.setattr(limiter, "settle", unavailable)
    response = service(settings, store, limiter=limiter).handle(
        "POST", {"Content-Type": "application/json"}, body
    )
    assert response.status == 200
    globals_ = [row.data for key, row in store.rows.items() if key[1] == "global"]
    assert globals_[0]["Seconds"] == 30
