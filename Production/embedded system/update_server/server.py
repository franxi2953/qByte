#!/usr/bin/env python3
"""Small static server for qByte firmware and UI update assets."""

import http.server
import socketserver
import os
import sys

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Update assets must never be replaced by a stale Cloudflare response.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, format, *args):
        print(f"[INFO] {self.address_string()} - {format % args}")

class UpdateServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

def run_server(port=8000, directory='.'):
    os.chdir(directory)

    with UpdateServer(("", port), CORSHTTPRequestHandler) as httpd:
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
