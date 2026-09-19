"""Manual production test for an OTA interrupted by loss of power."""

import os
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import pytest
import requests


DEVICE = os.getenv("QBYTE_URL", "http://qByte.local").rstrip("/")
ENABLED = os.getenv("QBYTE_POWER_CUT", "0") == "1"
POWER_CUT_WINDOW = int(os.getenv("QBYTE_POWER_CUT_WINDOW", "30"))
RECOVERY_TIMEOUT = int(os.getenv("QBYTE_RECOVERY_TIMEOUT", "180"))
PARTITIONS = Path(__file__).parents[1] / "Production/embedded system/partitions.csv"


def get(url, timeout=3):
    response = requests.get(url, timeout=timeout, headers={"Cache-Control": "no-cache"})
    response.raise_for_status()
    return response


def status(device):
    return get(f"{device}/firmware-update").json()


def version_parts(version):
    try:
        return tuple(int(part) for part in version.split("."))
    except ValueError:
        pytest.fail(f"Invalid firmware version: {version}")


def wait_until_offline(device):
    deadline = time.monotonic() + POWER_CUT_WINDOW
    failures = 0
    while time.monotonic() < deadline:
        try:
            status(device)
            failures = 0
        except (requests.ConnectionError, requests.Timeout):
            failures += 1
            if failures >= 2:
                return
        time.sleep(0.25)
    pytest.fail(f"Power loss was not detected within {POWER_CUT_WINDOW} seconds")


def wait_until_online(device):
    deadline = time.monotonic() + RECOVERY_TIMEOUT
    while time.monotonic() < deadline:
        try:
            return status(device)
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError):
            time.sleep(1)
    pytest.fail(f"qByte did not return within {RECOVERY_TIMEOUT} seconds")


def normalized_url(value, fallback):
    value = value.strip()
    if not value:
        return fallback
    if not value.startswith(("http://", "https://")):
        value = f"http://{value}"
    return value.rstrip("/")


def test_ota_survives_power_cut():
    if not ENABLED:
        pytest.skip("Set QBYTE_POWER_CUT=1 to enable this supervised test")

    layout = PARTITIONS.read_text(encoding="utf-8")
    assert "ota_0" in layout and "ota_1" in layout, "OTA requires two application slots"

    before = status(DEVICE)
    assert not before["experiment_running"], "Stop the active protocol first"
    assert not before["updating"], "An update is already running"

    manifest = get(before["manifest"], timeout=10).json()
    old_version = before["version"]
    new_version = manifest["version"]
    if version_parts(new_version) <= version_parts(old_version):
        pytest.skip(f"Publish a version newer than {old_version} before this test")

    candidate_url = urljoin(before["manifest"], manifest["url"])
    candidate = get(candidate_url, timeout=30).content
    assert len(candidate) > 100_000, "Firmware candidate is too small"
    assert candidate[0] == 0xE9, "Firmware candidate is not an ESP32 image"

    print(f"\nDevice: {DEVICE}")
    print(f"OTA:    {old_version} -> {new_version}")
    answer = input("Escribe START para iniciar la OTA, o Enter para cancelar: ").strip()
    if answer != "START":
        pytest.skip("Cancelled by operator")

    start = requests.get(f"{DEVICE}/firmware-update?start=1", timeout=10)
    assert start.status_code == 202, start.text
    print("\nCORTA LA ALIMENTACION AHORA.")
    wait_until_offline(DEVICE)

    print("qByte ha dejado de responder.")
    reconnect = input(
        "Si esta fisicamente apagado, conectalo de nuevo y pulsa Enter. "
        "Si cambio la IP, escribe la nueva URL; escribe CANCEL si no lo apagaste: "
    ).strip()
    if reconnect.upper() == "CANCEL":
        pytest.fail("Power cut was not confirmed by the operator")

    recovered_device = normalized_url(reconnect, DEVICE)
    after = wait_until_online(recovered_device)
    final_version = after["version"]

    assert final_version in {old_version, new_version}, (
        f"Partial or unexpected firmware booted: {final_version}"
    )
    assert not after["updating"], "Device remained in update state"
    assert not after["experiment_running"], "Device resumed an experiment unexpectedly"

    # Confirm that the recovered firmware and interface remain usable.
    config = get(f"{recovered_device}/device-config").json()
    assert config.get("mdns"), "Device configuration is unreadable"

    index = get(f"{recovered_device}/", timeout=10).text
    match = re.search(r"<!-- Version: ([^ ]+) -->", index)
    assert match, "Interface version marker is missing"
    assert match.group(1) in {old_version, new_version}, match.group(1)

    origin = urlsplit(before["manifest"])
    update_origin = f"{origin.scheme}://{origin.netloc}"
    file_list = get(f"{update_origin}/update_server/file_list.json", timeout=10).json()
    for filename in file_list["files"]:
        asset = get(f"{recovered_device}/{filename}", timeout=10)
        assert asset.content, f"Interface asset is empty: {filename}"

    # The result must remain stable after the first successful boot.
    time.sleep(3)
    assert status(recovered_device)["version"] == final_version

    result = "rollback al firmware anterior" if final_version == old_version else "OTA completada"
    print(f"PASS: {result}; qByte arranco con firmware {final_version}")
