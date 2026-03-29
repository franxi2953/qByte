#!/usr/bin/env python3
"""
Simple static file server for ESP32 firmware updates
Serves files from the current directory
"""

import http.server
import socketserver
import os
import sys

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers to allow cross-origin requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def log_message(self, format, *args):
        # Custom logging
        print(f"[INFO] {self.address_string()} - {format % args}")

def run_server(port=8000, directory='.'):
    # Change to the specified directory
    os.chdir(directory)

    # Create server
    with socketserver.TCPServer(("", port), CORSHTTPRequestHandler) as httpd:
        print(f"[INFO] Server running on http://0.0.0.0:{port}")
        print(f"[INFO] Serving directory: {os.getcwd()}")
        print("[INFO] Press Ctrl+C to stop")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[INFO] Server stopped")

if __name__ == "__main__":
    port = 8000
    directory = "."

    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    if len(sys.argv) > 2:
        directory = sys.argv[2]

    run_server(port, directory)