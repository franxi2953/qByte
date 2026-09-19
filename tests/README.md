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

Both tests use HTTP GET requests only.
