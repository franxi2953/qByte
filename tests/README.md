# Production tests

These tests use a real qByte. Keep it empty and supervised while its heaters are on.

## Install

Run this from Windows or a machine that can open `http://qByte.local`:

```bash
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
```

Use another device address when mDNS is unavailable. In PowerShell:

```powershell
$env:QBYTE_URL = "http://192.168.1.50"
```

## Run

```bash
python -m pytest tests/test_temperature_protocol.py -s
python -m pytest tests/test_ota_atomic.py -s
```

The temperature test uses the web interface to set the wells to 60 °C, the lid to 70 °C, and the lid difference to 10 °C. It reads all four sensors twice, ten seconds apart, then stops the protocol and restores the previous lid settings.

The OTA test is intended for release acceptance. It checks that the partition table has two application slots and runs the device transition only when the online manifest contains a newer version. It verifies the candidate image before starting, then accepts only the complete old or new firmware version until the new version boots.

## OTA power-cut test

Run this only while you are beside the qByte. A newer firmware version must already be published:

```powershell
$env:QBYTE_POWER_CUT = "1"
python -m pytest tests/test_ota_power_cut.py -s
```

The test asks before starting the OTA, tells you when to cut power, detects that the qByte has disappeared, and then asks you to reconnect it. Passing means the device boots a complete old or new firmware, remains stable, and serves all interface files. It cannot prove that power was physically removed, so it asks you to confirm that step.

All device requests use HTTP GET only.
