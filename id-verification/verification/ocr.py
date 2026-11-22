import hashlib
import json
import threading
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .config import ROOT
from .errors import VerificationError


@dataclass(frozen=True, repr=False)
class TextLine:
    text: str
    confidence: float
    x: float
    y: float


class OcrReader:
    def __init__(self, model_dir: Path = ROOT / "models"):
        from rapidocr import EngineType, ModelType, OCRVersion, RapidOCR

        manifest = json.loads((model_dir / "manifest.json").read_text())
        for entry in manifest["files"]:
            path = model_dir / entry["name"]
            with path.open("rb") as model:
                if hashlib.file_digest(model, "sha256").hexdigest() != entry["sha256"]:
                    raise ValueError("Invalid packaged OCR model")
        cv2.setNumThreads(1)
        self._lock = threading.Lock()
        self._engine = RapidOCR(
            params={
                "Global.log_level": "critical",
                "Global.use_cls": False,
                "Global.model_root_dir": str(model_dir),
                "Global.max_side_len": 1200,
                "Global.text_score": 0.5,
                "Det.engine_type": EngineType.ONNXRUNTIME,
                "Det.ocr_version": OCRVersion.PPOCRV5,
                "Det.model_type": ModelType.MOBILE,
                "Det.model_path": str(model_dir / "ch_PP-OCRv5_det_mobile.onnx"),
                "Det.limit_side_len": 736,
                "Det.limit_type": "max",
                "Det.max_candidates": 50,
                "Rec.engine_type": EngineType.ONNXRUNTIME,
                "Rec.ocr_version": OCRVersion.PPOCRV5,
                "Rec.model_type": ModelType.MOBILE,
                "Rec.lang_type": "en",
                "Rec.model_path": str(model_dir / "en_PP-OCRv5_rec_mobile.onnx"),
                "Rec.rec_batch_num": 4,
                "EngineConfig.onnxruntime.intra_op_num_threads": 1,
                "EngineConfig.onnxruntime.inter_op_num_threads": 1,
                "EngineConfig.onnxruntime.enable_cpu_mem_arena": False,
            }
        )

    def read(self, image: np.ndarray) -> list[TextLine]:
        # RapidOCR updates its configuration during __call__; one inference at a time.
        if not self._lock.acquire(blocking=False):
            raise VerificationError("busy", 429, retry_after=5)
        owned = output = None
        try:
            owned = image.copy()
            output = self._engine(owned)
            if getattr(output, "txts", None) is None or output.boxes is None:
                return []
            height, width = owned.shape[:2]
            return [
                TextLine(
                    text=str(text),
                    confidence=float(score),
                    x=float(np.mean(box[:, 0])) / width,
                    y=float(np.mean(box[:, 1])) / height,
                )
                for text, score, box in zip(output.txts, output.scores, output.boxes, strict=True)
            ]
        finally:
            if owned is not None:
                owned.fill(0)
            if isinstance(getattr(output, "img", None), np.ndarray):
                output.img.fill(0)
            output = None
            self._lock.release()
