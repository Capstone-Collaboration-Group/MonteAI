import json
import math
import re
import threading
import time
from pathlib import Path

import cv2
import numpy as np

from .config import PIPELINE_TIMEOUT_SECONDS, ROOT
from .errors import VerificationError, retake, unmatched
from .identity import DASHES, StudentIdentity, normalize_name, normalize_number
from .images import crop, decode_image, locate_card, quality_score
from .ocr import OcrReader, TextLine


def artwork_similarity(image: np.ndarray, reference: np.ndarray) -> float:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    ref = cv2.equalizeHist(cv2.cvtColor(reference, cv2.COLOR_BGR2GRAY))
    best = 0.0
    try:
        if gray.std() < 12:
            return best
        for scale in (0.65, 0.8, 0.9, 1.0, 1.1, 1.2, 1.35):
            resized = cv2.resize(ref, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            if resized.shape[0] > gray.shape[0] or resized.shape[1] > gray.shape[1]:
                continue
            correlation = cv2.matchTemplate(gray, resized, cv2.TM_CCOEFF_NORMED)
            score = float(cv2.minMaxLoc(correlation)[1])
            if np.isfinite(score):
                best = max(best, score)
        return best
    finally:
        gray.fill(0)


def joined_text(lines: list[TextLine]) -> str:
    # Reading order within a single narrow field, allowing words split by the detector.
    return " ".join(
        line.text for line in sorted(lines, key=lambda line: (line.y, line.x))
    )


def text_rows(lines: list[TextLine]) -> list[list[TextLine]]:
    rows: list[list[TextLine]] = []
    for line in sorted(lines, key=lambda item: item.y):
        if not rows or abs(line.y - rows[-1][0].y) > 0.22:
            rows.append([line])
        else:
            rows[-1].append(line)
    return rows


def region_lines(lines: list[TextLine], box: list[float]) -> list[TextLine]:
    """Keep OCR lines whose normalized coordinates fall inside a region box."""
    x1, y1, x2, y2 = box
    return [line for line in lines if x1 <= line.x <= x2 and y1 <= line.y <= y2]


def match_fields(
    fields: dict[str, list[TextLine]], student: StudentIdentity, template: dict
) -> None:
    thresholds = template["minimum_confidence"]

    def confident(lines: list[TextLine], field: str) -> bool:
        return bool(lines) and all(
            math.isfinite(line.confidence) and thresholds[field] <= line.confidence <= 1
            for line in lines
        )

    school_name = template["school_name"]
    # The address may also be visible inside the school region and share the
    # row, so accept any row that contains a heading line starting with the
    # school name; the heading line's own confidence must clear the floor.
    heading_rows = [
        row
        for row in text_rows(fields["school"])
        if any(normalize_name(line.text).startswith(school_name) for line in row)
    ]
    heading_confidences = [
        max(
            line.confidence
            for line in row
            if normalize_name(line.text).startswith(school_name)
        )
        for row in heading_rows
    ]
    if not heading_confidences or not any(
        confidence >= thresholds["school"] for confidence in heading_confidences
    ):
        raise retake("school_unreadable")
    for field in ("name", "number"):
        lines = fields[field]
        if not confident(lines, field):
            raise retake(f"{field}_unreadable")

    number_text = joined_text(fields["number"]).translate(DASHES)
    # Tolerate OCR noise around the "STUDENT NUMBER" label; the structured
    # pattern below is the source of truth for what was actually read.
    if not re.search(r"\d{2}\s*-\s*\d{5}", number_text):
        raise retake("number_unreadable")
    numbers = {
        normalize_number(match.group())
        for match in re.finditer(r"(?<![\w-])[0-9]{2}\s*-\s*[0-9]{5}(?![\w-])", number_text)
    }
    if len(numbers) != 1:
        raise retake("number_unreadable")
    if student.student_number not in numbers:
        raise unmatched("student_number_mismatch")
    if not student.matches_printed_name(joined_text(fields["name"])):
        raise unmatched("student_name_mismatch")


class VerificationPipeline:
    def __init__(self, template_path: Path = ROOT / "templates" / "cdm-front-v1.json"):
        self.template = json.loads(template_path.read_text())
        self.artwork = {}
        for name, definition in self.template["artwork"].items():
            image = cv2.imread(str(template_path.parent / definition["file"]))
            if image is None:
                raise ValueError("Missing sanitized template artwork")
            self.artwork[name] = image
        self._reader = None
        self._lock = threading.Lock()

    def verify(
        self, raw: bytes | bytearray, student: StudentIdentity, metrics: dict | None = None
    ) -> str:
        # Holding only one decoded capture per worker also bounds CPU and memory usage.
        if not self._lock.acquire(blocking=False):
            raise VerificationError("busy", 429, retry_after=5)
        image = card = None
        fields = {}
        metrics = metrics if metrics is not None else {}
        started = time.monotonic()

        def deadline() -> None:
            if time.monotonic() - started > PIPELINE_TIMEOUT_SECONDS:
                raise VerificationError("verification_timeout", 503, retry_after=5)

        try:
            image = decode_image(raw)
            card = locate_card(image, self.template["width"], self.template["height"])
            image.fill(0)
            image = None
            regions = self.template["regions"]
            metrics["sharpness"] = round(quality_score(card, regions["name"]), 2)
            if metrics["sharpness"] < self.template["minimum_laplacian_variance"]:
                raise retake("image_quality")
            for check in self.template["colors"]:
                region = cv2.cvtColor(crop(card, check["box"]), cv2.COLOR_BGR2HSV)
                try:
                    ratio = float(
                        np.mean(
                            cv2.inRange(region, tuple(check["lower"]), tuple(check["upper"])) > 0
                        )
                    )
                    metrics[check["name"]] = round(ratio, 3)
                    if ratio < check["minimum_fraction"]:
                        raise unmatched("template_unmatched")
                finally:
                    region.fill(0)
            for name, definition in self.template["artwork"].items():
                score = artwork_similarity(crop(card, regions[name]), self.artwork[name])
                metrics[f"{name}_similarity"] = round(score, 3)
                if score < definition["minimum_score"]:
                    raise unmatched("template_unmatched")
            deadline()
            if self._reader is None:
                self._reader = OcrReader()
            lines = self._reader.read(card)
            for name in ("school", "name", "number"):
                fields[name] = region_lines(lines, self.template["regions"][name])
                metrics[f"{name}_confidence"] = round(
                    min((line.confidence for line in fields[name]), default=0), 3
                )
            deadline()
            match_fields(fields, student, self.template)
            return self.template["id"]
        finally:
            # No output object, tensor, crop, image path, or OCR text is cached.
            for owned in (image, card):
                if owned is not None:
                    owned.fill(0)
            fields.clear()
            self._lock.release()
