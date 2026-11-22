import copy
import threading

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from verification.config import Settings
from verification.identity import StudentIdentity
from verification.quota import Conflict, Snapshot


@pytest.fixture(scope="session")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture
def settings(signing_key):
    return Settings(
        firebase_project_id="test-project",
        allowed_origins=("http://localhost:8080",),
        issuer="https://idv.example.test",
        audience="monteai-registration",
        key_id="test-key-1",
        private_key=signing_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ),
        quota_hmac_key=b"q" * 32,
        table_endpoint="",
        table_connection_string="UseDevelopmentStorage=true",
        table_name="IdVerificationQuota",
    )


@pytest.fixture
def student_dict():
    return {
        "studentNumber": "00-00123",
        "firstName": "Maria Sofia",
        "middleInitial": "C",
        "lastName": "Dela Cruz",
        "suffix": "",
    }


@pytest.fixture
def student(student_dict):
    return StudentIdentity.from_dict(student_dict)


class AtomicStore:
    """Test-only Table Storage semantics: copies, conditional writes, atomic batches."""

    def __init__(self):
        self.rows = {}
        self.lock = threading.Lock()
        self.version = 0

    def get(self, partition, row):
        with self.lock:
            return copy.deepcopy(
                self.rows.get(
                    (partition, row), Snapshot({"PartitionKey": partition, "RowKey": row})
                )
            )

    def commit(self, changes):
        with self.lock:
            for change in changes:
                snapshot = change.snapshot
                key = (snapshot.data["PartitionKey"], snapshot.data["RowKey"])
                current = self.rows.get(key)
                if (current.etag if current else None) != snapshot.etag:
                    raise Conflict
            for change in changes:
                snapshot = change.snapshot
                key = (snapshot.data["PartitionKey"], snapshot.data["RowKey"])
                if change.delete:
                    self.rows.pop(key, None)
                else:
                    self.version += 1
                    self.rows[key] = Snapshot(copy.deepcopy(snapshot.data), str(self.version))


@pytest.fixture
def store():
    return AtomicStore()
