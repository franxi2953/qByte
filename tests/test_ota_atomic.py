"""Release test: an OTA exposes either the old or the complete new firmware."""

import os
import time
from pathlib import Path
from urllib.parse import urljoin

import pytest
import requests


DEVICE = os.getenv("QBYTE_URL", "http://qByte.local").rstrip("/")
TIMEOUT = int(os.getenv("QBYTE_OTA_TIMEOUT", "240"))
PARTITIONS = Path(__file__).parents[1] / "Production/embedded system/partitions.csv"


def get_json(url):
    response = requests.get(url, timeout=10, headers={"Cache-Control": "no-cache"})
    response.raise_for_status()
    return response.json()


def version_parts(version):
    try:
        return tuple(int(part) for part in version.split("."))
    except ValueError:
        pytest.fail(f"Invalid firmware version: {version}")


def test_ota_is_atomic():
    layout = PARTITIONS.read_text(encoding="utf-8")
    assert "ota_0" in layout and "ota_1" in layout, "OTA requires two application slots"

    before = get_json(f"{DEVICE}/firmware-update")
    assert not before["experiment_running"], "Stop the active protocol first"

    manifest = get_json(before["manifest"])
    old_version = before["version"]
    new_version = manifest["version"]
    if version_parts(new_version) <= version_parts(old_version):
        pytest.skip(f"Publish a version newer than {old_version} to test OTA")

    # Reject an empty or clearly invalid candidate before touching the device.
    binary_url = urljoin(before["manifest"], manifest["url"])
    candidate = requests.get(binary_url, timeout=30)
    candidate.raise_for_status()
    assert len(candidate.content) > 100_000, "Firmware candidate is too small"
    assert candidate.content[0] == 0xE9, "Firmware candidate is not an ESP32 image"

    start = requests.get(f"{DEVICE}/firmware-update?start=1", timeout=10)
    assert start.status_code == 202, start.text

    observed = {old_version}
    deadline = time.monotonic() + TIMEOUT
    while time.monotonic() < deadline:
        try:
            status = get_json(f"{DEVICE}/firmware-update")
            observed.add(status["version"])
            assert observed <= {old_version, new_version}, observed
            if status["version"] == new_version:
                print(f"OTA: {old_version} -> {new_version}")
                return
        except (requests.ConnectionError, requests.Timeout):
            pass  # The ESP32 is unavailable briefly while flashing and rebooting.
        time.sleep(2)

    pytest.fail(f"Device did not boot firmware {new_version}; observed {observed}")
