# qByte Firmware Updates

qByte updates are published through the Mac mini service at `qbyte.daicochiti.xyz`, with the public GitHub repository as the source of truth.

## Published Endpoints

- Manifest: `https://qbyte.daicochiti.xyz/update_server/data/fota.json`
- Firmware binary: `https://qbyte.daicochiti.xyz/binaries/main.ino.bin?v=<version>`
- Interface file list: `https://qbyte.daicochiti.xyz/update_server/file_list.json`
- Interface assets: `https://qbyte.daicochiti.xyz/code/main/data/<filename>`

The firmware checks the manifest only when an update is requested. It updates changed SPIFFS interface files first, then installs a newer firmware binary and restarts. An active experiment prevents updates.

## Device Controls

Open the device at `http://<device-name>.local/` and select **Update firmware**, or send `update` through the 115200-baud serial console. Keep the device powered during the download and restart.

Firmware `2.0.2` and earlier points to the retired `daicochiti.xyz` updater. Those devices need one USB flash to install `2.1.0`; subsequent releases can be installed from the web interface.

## Publishing a Release

1. Update `V_SOFTWARE` in `code/main/main.ino` and the version comment at the top of `code/main/data/index.html`.
2. Build the firmware with PlatformIO using the configuration in the parent directory.
3. Replace `binaries/main.ino.bin` with `.pio/build/qbyte/firmware.bin`.
4. Add any changed interface assets to `file_list.json`. Keep `index.html` last so its version changes only after the supporting files install.
5. Update `data/fota.json` to the same firmware version, including the matching `?v=<version>` on the binary URL.
6. Push the release commit to `master`, deploy the update tree to the Mac mini, and verify each public endpoint.

The legacy updater does not verify firmware signatures. Only publish reviewed binaries, and treat write access to `master` as release access.

## Server

The production `launchd` service runs:

```bash
python3 server.py 8003 ../
```
