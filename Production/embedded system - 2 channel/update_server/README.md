# Firmware Update Server

This directory contains the firmware update server for the qByte LAMP device.

## Directory Structure

```
update_server/
├── data/                    # Web interface and firmware files
│   ├── index.html          # Main web interface
│   ├── style.css           # CSS styles
│   ├── functions.js        # JavaScript functions
│   ├── data_query.js       # Data query functions
│   ├── analysis.js         # Analysis functions
│   ├── JS_merged.js.gz     # Compressed JavaScript
│   ├── uikit.min.css.gz    # Compressed CSS framework
│   ├── config.txt          # Default configuration
│   ├── credentials.txt     # Default credentials
│   ├── last_run.txt        # Last run data
│   ├── protocols.txt       # Protocol definitions
│   ├── main.ino.bin        # Firmware binary
│   └── fota.json           # Firmware update manifest
├── file_list.json          # List of files to update
├── server.py               # Python HTTPS server
├── start_server.sh        # Startup script
└── README.md              # This file
```

## Setup Instructions

1. **Copy to Raspberry Pi**: Upload the entire `update_server` directory to your Raspberry Pi.

2. **SSL Certificates (Recommended)**: For secure HTTPS, generate SSL certificates:
   ```bash
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

3. **Start the Server**:
   ```bash
   cd update_server
   ./start_server.sh
   ```

   Or manually:
   ```bash
   python3 server.py 443 .
   ```

## Server Configuration

- **Default Port**: 443 (HTTPS) or 80 (HTTP if no certificates)
- **Host**: Should be accessible at `daicochiti.xyz`
- **Endpoints**:
  - `/data/fota.json` - Firmware update manifest
  - `/data/main.ino.bin` - Firmware binary
  - `/file_list` - List of files to update
  - `/data/<file>` - Individual web interface files

## Security Notes

- The server includes CORS headers for cross-origin requests
- HTTPS is strongly recommended for production use
- Ensure the server is only accessible from trusted networks

## Updating Firmware

1. Replace `data/main.ino.bin` with the new firmware binary
2. Update the version in `data/fota.json`
3. Update `file_list.json` if new files are added
4. Restart the server

The ESP32 device will automatically check for updates and download new firmware when available.