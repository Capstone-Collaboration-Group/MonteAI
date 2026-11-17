"""In-memory evaluation of locally supplied captures. Prints only outcomes/timings.

Supply a JSON array on stdin: [{"image": "external/path", "student": {...}}].
Use external files; never add captures or real identity manifests to this repository.
"""

import argparse
import ctypes
import json
import os
import statistics
import sys
import time
from pathlib import Path

from verification.errors import VerificationError
from verification.identity import StudentIdentity
from verification.pipeline import VerificationPipeline


def peak_rss_mib() -> float:
    """Return native process peak RSS, including NumPy/OpenCV/ONNX allocations."""
    if os.name == "nt":
        from ctypes import wintypes

        class ProcessMemoryCounters(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]

        counters = ProcessMemoryCounters()
        counters.cb = ctypes.sizeof(counters)
        get_process = ctypes.WinDLL("kernel32", use_last_error=True).GetCurrentProcess
        get_process.argtypes = []
        get_process.restype = wintypes.HANDLE
        get_memory = ctypes.WinDLL("psapi", use_last_error=True).GetProcessMemoryInfo
        get_memory.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(ProcessMemoryCounters),
            wintypes.DWORD,
        ]
        get_memory.restype = wintypes.BOOL
        if not get_memory(
            get_process(),
            ctypes.byref(counters),
            counters.cb,
        ):
            raise OSError("GetProcessMemoryInfo failed")
        value = counters.PeakWorkingSetSize
    else:
        import resource

        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        if sys.platform != "darwin":
            value *= 1024  # Linux reports KiB; macOS reports bytes.
    return round(value / 1024 / 1024, 1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runs", type=int, default=3)
    args = parser.parse_args()
    if not 1 <= args.runs <= 20:
        parser.error("Use 1 to 20 runs")
    cases = json.load(sys.stdin)
    if not isinstance(cases, list) or not cases:
        parser.error("stdin must contain a non-empty JSON array")
    initial_rss = peak_rss_mib()
    pipeline = VerificationPipeline()
    timings = []
    for index, case in enumerate(cases, 1):
        student = StudentIdentity.from_dict(case["student"])
        for run in range(args.runs):
            raw = bytearray(Path(case["image"]).read_bytes())
            metrics = {}
            started = time.perf_counter()
            try:
                pipeline.verify(raw, student, metrics)
                outcome, code = "verified", "verified"
            except VerificationError as error:
                outcome, code = error.outcome, error.code
            finally:
                raw[:] = b"\0" * len(raw)
            seconds = time.perf_counter() - started
            timings.append(seconds)
            print(
                json.dumps(
                    {
                        "sample": index,
                        "run": run + 1,
                        "outcome": outcome,
                        "code": code,
                        "seconds": round(seconds, 3),
                        "metrics": metrics,
                    }
                )
            )
    peak_rss = peak_rss_mib()
    print(
        json.dumps(
            {
                "attempts": len(timings),
                "median_seconds": round(statistics.median(timings), 3),
                "max_seconds": round(max(timings), 3),
                "initial_peak_rss_mib": initial_rss,
                "peak_rss_mib": peak_rss,
                "peak_rss_growth_mib": round(peak_rss - initial_rss, 1),
                "note": (
                    "Local CPU/process measurements; Azure cold starts and billing "
                    "are not measured."
                ),
            }
        )
    )


if __name__ == "__main__":
    main()
