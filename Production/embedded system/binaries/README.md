# Release Images

This directory contains the two generated images that are useful outside a local PlatformIO build:

- `main.ino.bin`: application image published by the OTA update server.
- `main.spiffs.bin`: complete SPIFFS image for factory or USB installation.

Build and refresh them from the parent directory:

```bash
pio run
pio run --target buildfs
cp .pio/build/qbyte/firmware.bin binaries/main.ino.bin
cp .pio/build/qbyte/spiffs.bin binaries/main.spiffs.bin
```

PlatformIO generates the bootloader, OTA metadata, and partition table inside `.pio`; those build artifacts are not stored here.
