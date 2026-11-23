import time
import uuid

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from .auth import FirebaseIdentity
from .config import RECEIPT_TTL_SECONDS, Settings
from .identity import StudentIdentity

RECEIPT_TYPE = "monteai-idv+jwt"
RECEIPT_VERSION = 1


class ReceiptSigner:
    def __init__(self, settings: Settings):
        self.settings = settings
        key = serialization.load_pem_private_key(settings.private_key, password=None)
        if not isinstance(key, rsa.RSAPrivateKey) or key.key_size < 2048:
            raise ValueError("A 2048-bit or stronger RSA signing key is required")
        self._key = key

    def issue(
        self, user: FirebaseIdentity, student: StudentIdentity, template_id: str
    ) -> tuple[str, int]:
        now = int(time.time())
        expires = now + RECEIPT_TTL_SECONDS
        receipt = jwt.encode(
            {
                "iss": self.settings.issuer,
                "aud": self.settings.audience,
                "sub": user.uid,
                "email": user.email,
                "email_verified": True,
                "iat": now,
                "nbf": now,
                "exp": expires,
                "jti": str(uuid.uuid4()),
                "purpose": "student-registration",
                "version": RECEIPT_VERSION,
                "name_normalization": "latin-v1",
                "student_number": student.student_number,
                "name_key": student.name_key,
                "template_id": template_id,
            },
            self._key,
            algorithm="RS256",
            headers={"kid": self.settings.key_id, "typ": RECEIPT_TYPE},
        )
        return receipt, expires
