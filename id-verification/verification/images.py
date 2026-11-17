import io
import warnings

import cv2
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import MAX_IMAGE_BYTES, MAX_PIXELS
from .errors import VerificationError, retake


def crop(image: np.ndarray, box: list[float]) -> np.ndarray:
    height, width = image.shape[:2]
    x1, y1, x2, y2 = box
    return image[int(y1 * height) : int(y2 * height), int(x1 * width) : int(x2 * width)]


def decode_image(raw: bytes | bytearray) -> np.ndarray:
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise VerificationError("image_too_large", 413)
    # Pillow inspects dimensions BEFORE full decode to bound decompression memory.
    # BytesIO is in memory; no multipart parser, temporary file, or URL loader is used.
    try:
        with warnings.catch_warnings(), io.BytesIO(raw) as stream:
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(stream) as source:
                if source.format not in ("JPEG", "PNG") or getattr(source, "n_frames", 1) != 1:
                    raise VerificationError("unsupported_image", 415)
                width, height = source.size
                if width * height > MAX_PIXELS or max(width, height) > 6000:
                    raise VerificationError("image_too_large", 413)
                if min(width, height) < 450:
                    raise retake("image_quality")
                with ImageOps.exif_transpose(source) as oriented, oriented.convert("RGB") as rgb:
                    pixels = np.array(rgb)
                    try:
                        return cv2.cvtColor(pixels, cv2.COLOR_RGB2BGR)
                    finally:
                        pixels.fill(0)
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise VerificationError("image_too_large", 413) from None
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError):
        raise VerificationError("unsupported_image", 415) from None


def ordered_corners(points: np.ndarray) -> np.ndarray:
    points = np.asarray(points, dtype=np.float32).reshape(4, 2)
    center = points.mean(axis=0)
    order = np.argsort(np.arctan2(points[:, 1] - center[1], points[:, 0] - center[0]))
    points = points[order]
    points = np.roll(points, -int(np.argmin(points.sum(axis=1))), axis=0)
    return points


def warp_card(image: np.ndarray, points: np.ndarray, width: int, height: int) -> np.ndarray:
    points = ordered_corners(points)
    top = np.linalg.norm(points[1] - points[0])
    side = np.linalg.norm(points[2] - points[1])
    if top > side:
        points = np.roll(points, -1, axis=0)
    destination = np.float32([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]])
    transform = cv2.getPerspectiveTransform(points, destination)
    return cv2.warpPerspective(image, transform, (width, height))


def green_fraction(image: np.ndarray) -> float:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    try:
        return float(np.mean(cv2.inRange(hsv, (32, 45, 25), (98, 255, 255)) > 0))
    finally:
        hsv.fill(0)


def color_anchor_candidates(small: np.ndarray) -> list[np.ndarray]:
    """Recover the card when its white outer edge blends into the background.

    Use the independent green header and long yellow program strip as four
    geometric anchors. Never use a portrait or identity text for alignment.
    """
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    yellow = cv2.inRange(hsv, (15, 80, 60), (40, 255, 255))
    green = cv2.inRange(hsv, (32, 45, 20), (98, 255, 130))
    kernel = np.ones((7, 7), np.uint8)
    yellow = cv2.morphologyEx(yellow, cv2.MORPH_CLOSE, kernel)
    green = cv2.morphologyEx(green, cv2.MORPH_CLOSE, kernel)
    try:
        strips, _ = cv2.findContours(yellow, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        headers, _ = cv2.findContours(green, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        headers = sorted(headers, key=cv2.contourArea, reverse=True)[:5]
        candidates = []
        area = small.shape[0] * small.shape[1]
        for strip in sorted(strips, key=cv2.contourArea, reverse=True)[:6]:
            if cv2.contourArea(strip) < area * 0.015:
                continue
            rectangle = cv2.minAreaRect(strip)
            short, long = sorted(rectangle[1])
            if short < 1 or not 6 < long / short < 16:
                continue
            corners = cv2.boxPoints(rectangle)
            vectors = np.roll(corners, -1, axis=0) - corners
            u = vectors[np.argmax(np.linalg.norm(vectors, axis=1))] / long
            if u[0] < 0:
                u = -u
            center = np.asarray(rectangle[0], dtype=np.float32)
            band_left, band_right = center - u * long / 2, center + u * long / 2
            expected_height = long / (720 / 1120)
            for direction in (1, -1):
                v = np.array([-u[1], u[0]]) * direction
                for header in headers:
                    if cv2.contourArea(header) < area * 0.025:
                        continue
                    points = header.reshape(-1, 2)
                    vertical = (points - center) @ v
                    horizontal = (points - center) @ u
                    top = float(vertical.min())
                    if not -0.85 * expected_height < top < -0.50 * expected_height:
                        continue
                    near_top = horizontal[vertical < top + expected_height * 0.025]
                    if len(near_top) < 2 or not 0.70 * long < np.ptp(near_top) < 1.12 * long:
                        continue
                    top_left = center + near_top.min() * u + top * v
                    top_right = center + near_top.max() * u + top * v
                    template = np.float32(
                        [[0, 0], [720, 0], [720, 1120 * 0.675], [0, 1120 * 0.675]]
                    )
                    observed = np.float32([top_left, top_right, band_right, band_left])
                    transform = cv2.getPerspectiveTransform(template, observed)
                    full_card = np.float32([[[0, 0], [720, 0], [720, 1120], [0, 1120]]])
                    result = cv2.perspectiveTransform(full_card, transform)[0]
                    if (
                        np.all(result >= -3)
                        and np.all(result[:, 0] < small.shape[1] + 3)
                        and np.all(result[:, 1] < small.shape[0] + 3)
                    ):
                        candidates.append(result)
        return candidates
    finally:
        hsv.fill(0)
        yellow.fill(0)
        green.fill(0)


def locate_card(image: np.ndarray, width: int = 720, height: int = 1120) -> np.ndarray:
    scale = min(1.0, 1600 / max(image.shape[:2]))
    small = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    candidates: list[tuple[float, np.ndarray]] = []
    best = None
    card = band = gray = edges = joined = None
    try:
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 35, 100)
        joined = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        contours, _ = cv2.findContours(joined, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        image_area = small.shape[0] * small.shape[1]
        for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:35]:
            area = cv2.contourArea(contour)
            if area < image_area * 0.20:
                continue
            perimeter = cv2.arcLength(contour, True)
            for epsilon in (0.02, 0.035):
                approx = cv2.approxPolyDP(contour, epsilon * perimeter, True)
                if len(approx) != 4 or not cv2.isContourConvex(approx):
                    continue
                points = ordered_corners(approx)
                sides = [np.linalg.norm(points[(i + 1) % 4] - points[i]) for i in range(4)]
                short, long = sorted(((sides[0] + sides[2]) / 2, (sides[1] + sides[3]) / 2))
                if 0.52 < short / long < 0.80 and short / scale >= 450:
                    candidates.append((area / image_area, points / scale))
                break
        for points in color_anchor_candidates(small):
            if np.linalg.norm(points[1] - points[0]) / scale >= 450:
                candidates.append((cv2.contourArea(points) / image_area, points / scale))
        h, w = image.shape[:2]
        if 0.59 <= min(w, h) / max(w, h) <= 0.73:
            # Clients may submit the camera guide's already-cropped frame.
            candidates.append((0.99, np.float32([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]])))
        best_score = -1.0
        for area, points in candidates[:12]:
            card = warp_card(image, points, width, height)
            top = green_fraction(crop(card, [0.03, 0.04, 0.95, 0.17]))
            bottom = green_fraction(crop(card, [0.05, 0.83, 0.97, 0.96]))
            if bottom > top:
                rotated = cv2.rotate(card, cv2.ROTATE_180)
                card.fill(0)
                card = rotated
                top = bottom
            band = cv2.cvtColor(crop(card, [0.02, 0.65, 0.98, 0.70]), cv2.COLOR_BGR2HSV)
            yellow = float(np.mean(cv2.inRange(band, (15, 60, 60), (40, 255, 255)) > 0))
            band.fill(0)
            score = top + yellow + area * 0.10
            if score > best_score:
                if best is not None:
                    best.fill(0)
                best, best_score = card, score
            else:
                card.fill(0)
            card = None
        if best is None or best_score < 0.40:
            if best is not None:
                best.fill(0)
            raise retake("card_not_found")
        result, best = best, None
        return result
    finally:
        small.fill(0)
        for value in (gray, edges, joined, card, band):
            if isinstance(value, np.ndarray):
                value.fill(0)
        if best is not None:
            best.fill(0)


def quality_score(card: np.ndarray, name_region: list[float]) -> float:
    gray = cv2.cvtColor(crop(card, name_region), cv2.COLOR_BGR2GRAY)
    try:
        if np.percentile(gray, 95) - np.percentile(gray, 5) < 25:
            return 0.0
        return float(cv2.Laplacian(gray, cv2.CV_64F).var())
    finally:
        gray.fill(0)
