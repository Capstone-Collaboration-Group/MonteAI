from zipfile import ZIP_DEFLATED, ZipFile

import pytest

from tools.package_archive import create_archive


def test_archive_has_root_relative_linux_paths_and_preserves_file_bytes(tmp_path):
    stage = tmp_path / "stage with spaces"
    files = {
        "function_app.py": b"# synthetic function\n",
        "host.json": b'{"version": "2.0"}',
        "requirements.txt": b"# synthetic dependencies\n",
        "verification/__init__.py": b"",
        "verification/service.py": b"# synthetic service\n",
        "templates/assets/artwork.png": b"synthetic artwork",
        "models/manifest.json": b'{"files": []}',
        "models/test.onnx": b"\x00\x01synthetic model",
        "licenses/PaddleOCR LICENSE": b"synthetic license notice\n",
    }
    for name, data in files.items():
        path = stage / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    (stage / "empty directory").mkdir()
    output = tmp_path / "package with spaces.zip"

    create_archive(stage, output)

    with ZipFile(output) as archive:
        assert archive.namelist() == sorted(files)
        assert all("\\" not in name for name in archive.namelist())
        assert {name: archive.read(name) for name in archive.namelist()} == files
        assert all(entry.compress_type == ZIP_DEFLATED for entry in archive.infolist())
        assert archive.testzip() is None


def test_archive_refuses_to_overwrite_existing_release(tmp_path):
    stage = tmp_path / "stage"
    stage.mkdir()
    (stage / "host.json").write_bytes(b"new package data")
    output = tmp_path / "existing-release.zip"
    original = b"previous release must remain unchanged"
    output.write_bytes(original)

    with pytest.raises(FileExistsError):
        create_archive(stage, output)

    assert output.read_bytes() == original


def test_missing_stage_does_not_create_archive(tmp_path):
    output = tmp_path / "package.zip"

    with pytest.raises(ValueError, match="staging directory"):
        create_archive(tmp_path / "missing", output)

    assert not output.exists()
