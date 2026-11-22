import json
import logging
import threading
import time

import azure.functions as func

from verification.config import Settings
from verification.errors import MESSAGES
from verification.service import VerificationService

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
_service = None
_initialization_lock = threading.Lock()
_retry_initialization_at = 0.0


def get_service() -> VerificationService:
    global _service, _retry_initialization_at
    with _initialization_lock:
        if _service is None:
            if time.monotonic() < _retry_initialization_at:
                raise RuntimeError("Service initialization deferred")
            _retry_initialization_at = time.monotonic() + 60
            _service = VerificationService(Settings.from_env())
        return _service


@app.route(route="v1/id-verification", methods=["POST", "OPTIONS"])
def verify_student_id(req: func.HttpRequest) -> func.HttpResponse:
    # ANONYMOUS is the Azure host setting only: the service requires a signed,
    # email-verified Firebase ID token before admitting image processing.
    try:
        response = get_service().handle(req.method, dict(req.headers), req.get_body())
        return func.HttpResponse(
            json.dumps(response.body) if response.body is not None else "",
            status_code=response.status,
            headers=response.headers,
            mimetype="application/json",
        )
    except Exception:
        logging.error("idv_initialization_unavailable")
        return func.HttpResponse(
            json.dumps(
                {
                    "outcome": "error",
                    "code": "service_unavailable",
                    "message": MESSAGES["service_unavailable"],
                }
            ),
            status_code=503,
            headers={"Cache-Control": "no-store", "Retry-After": "60"},
            mimetype="application/json",
        )
