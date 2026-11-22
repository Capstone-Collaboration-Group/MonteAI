"""Test-only signer handoff. Invoke through the .NET contract test's redirected pipes, never logs.

Uses synthetic identities and an ephemeral RSA key by default. The explicitly enabled
local-settings check reads the existing development signer without replacing it.
No captures, OCR, storage writes, or network.
"""

import base64
import json
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from verification.auth import FirebaseIdentity
from verification.config import Settings
from verification.identity import StudentIdentity
from verification.receipts import ReceiptSigner


def signing_settings(source: dict) -> Settings:
    if source.get("useLocalSettings") is True:
        if os.environ.get("MONTEAI_IDV_CONTRACT_LOCAL_SETTINGS") != "1":
            raise ValueError("Local signer checks require explicit test opt-in")
        values = json.loads(
            (Path(__file__).resolve().parents[1] / "local.settings.json").read_text(
                encoding="utf-8-sig"
            )
        )["Values"]
        os.environ.update(
            {name: value for name, value in values.items() if name.startswith("IDV_")}
        )
        return Settings.from_env()

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return Settings(
        firebase_project_id="contract-test-project",
        allowed_origins=("http://localhost:8080",),
        issuer=source["issuer"],
        audience=source["audience"],
        key_id=source["keyId"],
        private_key=key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ),
        quota_hmac_key=b"unused-test-only-hmac-key-32-bytes",
        table_endpoint="",
        table_connection_string="",
        table_name="unused-contract-test",
    )


def main() -> None:
    if sys.stdin.isatty() or sys.stdout.isatty():
        raise SystemExit("Use the automated registration contract test with redirected pipes.")
    source = json.load(sys.stdin)
    settings = signing_settings(source)
    student = StudentIdentity.from_dict(source["student"])
    receipt, expires = ReceiptSigner(settings).issue(
        FirebaseIdentity(source["uid"], source["email"]), student, "cdm-front-v1"
    )
    key = serialization.load_pem_private_key(settings.private_key, password=None)
    if not isinstance(key, rsa.RSAPrivateKey):
        raise ValueError("Invalid contract signing key")
    # stdout is captured inside the .NET process, never attached to a console or test output.
    json.dump(
        {
            "receipt": receipt,
            "expiresAt": expires,
            "issuer": settings.issuer,
            "audience": settings.audience,
            "keyId": settings.key_id,
            "publicKeyPemBase64": base64.b64encode(
                key.public_key().public_bytes(
                    serialization.Encoding.PEM,
                    serialization.PublicFormat.SubjectPublicKeyInfo,
                )
            ).decode("ascii"),
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
