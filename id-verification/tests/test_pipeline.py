import io
import json
from types import SimpleNamespace

import cv2
import numpy as np
import pytest
from PIL import Image

from verification.config import ROOT
from verification.errors import VerificationError
from verification.images import color_anchor_candidates, decode_image
from verification.ocr import TextLine
from verification.pipeline import VerificationPipeline, artwork_similarity, match_fields


@pytest.fixture
def template():
    return json.loads((ROOT / "templates/cdm-front-v1.json").read_text())


@pytest.fixture
def fields():
    return {
        "school": [TextLine("COLEGIO DE MONTALBAN", 0.99, 0.5, 0.3)],
        "name": [TextLine("MARIA SOFIA C. DELA CRUZ", 0.99, 0.5, 0.5)],
        "number": [TextLine("STUDENT NUMBER: 00-00123", 0.99, 0.5, 0.5)],
    }


def test_exact_fields_and_address_line(student, fields, template):
    fields["school"].append(TextLine("ADDRESS TEXT", 0.4, 0.5, 0.9))
    match_fields(fields, student, template)


@pytest.mark.parametrize(
    ("field", "text", "confidence", "code"),
    [
        ("number", "STUDENT NUMBER: 00-00999", 0.99, "student_number_mismatch"),
        ("number", "STUDENT NUMBER: 00-OO123", 0.99, "number_unreadable"),
        ("number", "STUDENT NUMBER: 00-00123 00-00999", 0.99, "number_unreadable"),
        ("number", "STUDENT NUMBER: 00-00123", 0.7, "number_unreadable"),
        ("name", "MARIA SOFIA G DELA CRUZ", 0.99, "student_name_mismatch"),
        ("name", "MARIA SOFIA C DELA CRUZ", 0.7, "name_unreadable"),
        ("name", "MARIA SOFIA C DELA CRUZ", float("nan"), "name_unreadable"),
        ("school", "COLEGIO DE SOMETHING", 0.99, "school_unreadable"),
    ],
)
def test_uncertain_and_mismatched_fields_do_not_verify(
    student, fields, template, field, text, confidence, code
):
    fields[field] = [TextLine(text, confidence, 0.5, 0.5)]
    with pytest.raises(VerificationError) as error:
        match_fields(fields, student, template)
    assert error.value.code == code


def test_rejects_non_image_and_oversized_decompression():
    with pytest.raises(VerificationError, match="unsupported_image"):
        decode_image(b"not a picture")
    with io.BytesIO() as stream, Image.new("1", (5000, 2500)) as image:
        image.save(stream, "PNG")
        with pytest.raises(VerificationError, match="image_too_large"):
            decode_image(stream.getvalue())


def test_artwork_cannot_match_blank_patch():
    reference = cv2.imread(str(ROOT / "templates/assets/cdm-logo.png"))
    assert artwork_similarity(np.full((160, 160, 3), 255, np.uint8), reference) == 0


def test_color_anchors_find_card_on_white_background():
    image = np.full((1600, 1100, 3), 245, np.uint8)
    # A white-on-white card with fixed header and program strip, no personal content.
    cv2.rectangle(image, (190, 180), (910, 390), (40, 90, 35), -1)
    cv2.rectangle(image, (190, 891), (910, 981), (20, 220, 230), -1)
    candidates = color_anchor_candidates(image)
    assert candidates
    assert any(np.linalg.norm(points[0] - [190, 180]) < 20 for points in candidates)


def test_pipeline_overwrites_request_arrays_when_quality_fails(student, monkeypatch):
    decoded = np.full((1200, 800, 3), 220, np.uint8)
    card = np.full((1120, 720, 3), 220, np.uint8)
    monkeypatch.setattr("verification.pipeline.decode_image", lambda _: decoded)
    monkeypatch.setattr("verification.pipeline.locate_card", lambda *args: card)
    with pytest.raises(VerificationError, match="image_quality"):
        VerificationPipeline().verify(bytearray(b"image"), student)
    assert not decoded.any()
    assert not card.any()


@pytest.mark.parametrize("outcome", ["success", "timeout", "exception"])
def test_late_pipeline_outcomes_release_arrays_and_worker_lock(
    student, fields, monkeypatch, outcome
):
    decoded = np.full((1200, 800, 3), 220, np.uint8)
    card = np.full((1120, 720, 3), 220, np.uint8)
    clock = [0.0]

    def read(_):
        if outcome == "timeout":
            clock[0] = 19
        if outcome == "exception":
            raise RuntimeError("decoder failure")
        # Full-card detections, sliced per region by the pipeline.
        return [
            TextLine("COLEGIO DE MONTALBAN", 0.99, 0.5, 0.03),
            TextLine("MARIA SOFIA C. DELA CRUZ", 0.99, 0.5, 0.5),
            TextLine("STUDENT NUMBER: 00-00123", 0.99, 0.5, 0.58),
        ]

    monkeypatch.setattr("verification.pipeline.decode_image", lambda _: decoded)
    monkeypatch.setattr("verification.pipeline.locate_card", lambda *args: card)
    monkeypatch.setattr("verification.pipeline.quality_score", lambda *args: 100)
    monkeypatch.setattr("verification.pipeline.artwork_similarity", lambda *args: 1)
    monkeypatch.setattr("verification.pipeline.time.monotonic", lambda: clock[0])
    pipeline = VerificationPipeline()
    pipeline.template["colors"] = []
    pipeline._reader = SimpleNamespace(read=read)
    if outcome == "success":
        assert pipeline.verify(b"image", student) == "cdm-front-v1"
    elif outcome == "timeout":
        with pytest.raises(VerificationError, match="verification_timeout"):
            pipeline.verify(b"image", student)
    else:
        with pytest.raises(RuntimeError):
            pipeline.verify(b"image", student)
    assert not decoded.any()
    assert not card.any()
    assert not pipeline._lock.locked()
