#!/bin/bash
# Script to start the firmware update server

echo "[INFO] Starting firmware update server..."

# Check if we're in the right directory
if [ ! -f "server.py" ]; then
    echo "[ERROR] server.py not found. Please run from update_server directory"
    exit 1
fi

# Start HTTP server on port 443 (matches Cloudflare tunnel for daicochiti.xyz)
echo "[INFO] Starting HTTP server on port 443 (requires sudo)"
sudo python3 server.py 443 .