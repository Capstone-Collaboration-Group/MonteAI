"""Create local, gitignored signing material. Never prints private keys."""

import argparse
import base64
import json
import os
import secrets

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from verification.config import ROOT


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key-id", default="idv-2026-01")
    args = parser.parse_args()
    directory = ROOT / ".secrets"
    directory.mkdir(mode=0o700, exist_ok=True)
    path = directory / "signing-settings.json"
    public_path = directory / "receipt-public.pem"
    if path.exists() or public_path.exists():
        raise SystemExit("Signing material already exists. Use a reviewed key-rotation procedure.")
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    settings = {
        "IDV_RECEIPT_KEY_ID": args.key_id,
        "IDV_RECEIPT_PRIVATE_KEY_B64": base64.b64encode(private).decode(),
        "IDV_QUOTA_HMAC_KEY_B64": base64.b64encode(secrets.token_bytes(32)).decode(),
    }
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(settings, output, indent=2)
    with public_path.open("xb") as output:
        output.write(
            key.public_key().public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        )
    print("Created .secrets/signing-settings.json and .secrets/receipt-public.pem")


if __name__ == "__main__":
    main()
