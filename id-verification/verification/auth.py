import re
import threading
import time
from dataclasses import dataclass

import jwt
import requests
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import rsa

from .errors import VerificationError

CERTIFICATES_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
)


@dataclass(frozen=True, repr=False)
class FirebaseIdentity:
    uid: str
    email: str


class FirebaseVerifier:
    """Verify Firebase ID tokens using Google's pinned issuer and public certificate endpoint.

    No Firebase service-account secret or emulator authentication bypass is needed.
    Only public certificates are fetched/cached; tokens are never sent to another service.
    """

    def __init__(self, project_id: str):
        self.project_id = project_id
        self._keys: dict[str, rsa.RSAPublicKey] = {}
        self._expires = 0.0
        self._last_refresh = float("-inf")
        self._lock = threading.Lock()
        self._session = requests.Session()

    def _key(self, kid: str) -> rsa.RSAPublicKey:
        with self._lock:
            now = time.monotonic()
            if now < self._expires and kid in self._keys:
                return self._keys[kid]
            # Unknown attacker-controlled kids cannot cause unbounded outbound fetches.
            if now - self._last_refresh >= 60:
                self._last_refresh = now
                try:
                    with self._session.get(CERTIFICATES_URL, timeout=(2, 3)) as response:
                        response.raise_for_status()
                        certificates = response.json()
                        if not isinstance(certificates, dict) or not 1 <= len(certificates) <= 10:
                            raise ValueError("Invalid certificates")
                        keys = {}
                        for key_id, pem in certificates.items():
                            if not isinstance(pem, str) or len(pem) > 16384:
                                raise ValueError("Invalid certificate")
                            key = x509.load_pem_x509_certificate(pem.encode()).public_key()
                            if not isinstance(key, rsa.RSAPublicKey) or key.key_size < 2048:
                                raise ValueError("Invalid certificate key")
                            keys[key_id] = key
                        match = re.search(
                            r"max-age=(\d+)", response.headers.get("Cache-Control", "")
                        )
                        ttl = min(int(match.group(1)) if match else 3600, 21600)
                        self._keys = keys
                        self._expires = now + ttl
                except (requests.RequestException, ValueError, TypeError):
                    raise VerificationError("service_unavailable", 503, retry_after=60) from None
            if now >= self._expires:
                raise VerificationError("service_unavailable", 503, retry_after=60)
            if kid not in self._keys:
                raise VerificationError("authentication_required", 401)
            return self._keys[kid]

    def verify(self, authorization: str) -> FirebaseIdentity:
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer" or len(parts[1]) > 8192:
            raise VerificationError("authentication_required", 401)
        token = parts[1]
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            if (
                header.get("alg") != "RS256"
                or not isinstance(kid, str)
                or not 1 <= len(kid) <= 128
            ):
                raise ValueError("Invalid token header")
            claims = jwt.decode(
                token,
                self._key(kid),
                algorithms=["RS256"],
                audience=self.project_id,
                issuer=f"https://securetoken.google.com/{self.project_id}",
                leeway=30,
                options={
                    "require": ["sub", "iat", "exp", "auth_time", "iss", "aud"],
                    "strict_aud": True,
                },
            )
            uid = claims["sub"]
            email = claims.get("email")
            auth_time = claims["auth_time"]
            if (
                not isinstance(uid, str)
                or not 1 <= len(uid) <= 128
                or type(auth_time) is not int
                or not 0 < auth_time <= time.time() + 30
                or type(claims["iat"]) is not int
                or type(claims["exp"]) is not int
                or claims["iat"] > claims["exp"]
                or not isinstance(email, str)
                or len(email) > 254
                or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email)
            ):
                raise ValueError("Invalid identity claims")
            firebase = claims.get("firebase", {})
            if not isinstance(firebase, dict) or firebase.get("tenant"):
                raise ValueError("Unsupported Firebase tenant")
            if firebase.get("sign_in_provider") == "anonymous":
                raise ValueError("Anonymous identity")
            if claims.get("email_verified") is not True:
                raise VerificationError("email_unverified", 403)
            return FirebaseIdentity(uid, email.strip().lower())
        except (jwt.PyJWTError, ValueError, TypeError, KeyError):
            raise VerificationError("authentication_required", 401) from None
