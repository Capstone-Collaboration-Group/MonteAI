import threading
from types import SimpleNamespace

import cv2
import numpy as np
import pytest

from verification.config import ROOT
from verification.ocr import OcrReader


@pytest.mark.parametrize("failure", [False, True])
def test_ocr_releases_owned_image_and_lock(failure):
    held = []

    def engine(image):
        held.append(image)
        if failure:
            raise RuntimeError("inference failed")
        # Detection-only output can be returned when recognition finds no text.
        return SimpleNamespace(img=image, boxes=[])

    reader = OcrReader.__new__(OcrReader)
    reader._lock = threading.Lock()
    reader._engine = engine
    source = np.full((80, 640, 3), 255, np.uint8)
    if failure:
        with pytest.raises(RuntimeError):
            reader.read(source)
    else:
        assert reader.read(source) == []
    assert not held[0].any()
    assert source.all()
    assert not reader._lock.locked()


@pytest.mark.models
def test_packaged_ocr_reads_synthetic_heading_without_network_or_downloads(monkeypatch):
    if not (ROOT / "models/en_PP-OCRv5_rec_mobile.onnx").is_file():
        pytest.skip("Run python -m tools.prepare_models first")

    def denied(*args, **kwargs):
        pytest.fail("OCR attempted network access, downloading, or capture output")

    monkeypatch.setattr("socket.socket.connect", denied)
    monkeypatch.setattr("socket.socket.connect_ex", denied)
    monkeypatch.setattr("requests.sessions.Session.request", denied)
    monkeypatch.setattr("rapidocr.utils.download_file.DownloadFile.run", denied)
    monkeypatch.setattr("cv2.imwrite", denied)
    monkeypatch.setattr("PIL.Image.Image.save", denied)
    image = np.full((90, 760, 3), 255, np.uint8)
    cv2.putText(
        image, "COLEGIO DE MONTALBAN", (18, 58), cv2.FONT_HERSHEY_SIMPLEX,
        1.4, (0, 0, 0), 2, cv2.LINE_AA,
    )
    try:
        lines = OcrReader().read(image)
        assert " ".join(line.text for line in lines) == "COLEGIO DE MONTALBAN"
        assert min(line.confidence for line in lines) > 0.90
    finally:
        image.fill(0)
