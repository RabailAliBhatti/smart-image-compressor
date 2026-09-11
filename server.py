#!/usr/bin/env python3
"""
Lightweight Local Web Server for Image Compressor Dashboard.
Zero external dependencies (uses Python standard library).
"""

import os
import sys
import json
import socket
import webbrowser
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# Import existing compression engine
from compress_images import compress_single_image, format_size, SUPPORTED_EXTENSIONS

BASE_DIR = Path(__file__).resolve().parent
INPUT_DIR = BASE_DIR / "images"
OUTPUT_DIR = BASE_DIR / "compressed_images"

class CompressorRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            
            image_count = 0
            if INPUT_DIR.exists():
                image_count = len([f for f in INPUT_DIR.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS])

            data = {
                "status": "ok",
                "input_dir": str(INPUT_DIR.resolve()),
                "output_dir": str(OUTPUT_DIR.resolve()),
                "image_count": image_count,
            }
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        # Default static file handler
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/compress-folder":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                payload = json.loads(body) if body else {}
            except Exception:
                payload = {}

            target_kb = float(payload.get("target_kb", 500.0))
            format_choice = str(payload.get("format", "auto")).lower()
            target_bytes = int(target_kb * 1000)

            if not INPUT_DIR.exists():
                self.send_response(404)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Folder {INPUT_DIR} does not exist"}).encode("utf-8"))
                return

            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            image_files = [
                f for f in INPUT_DIR.iterdir()
                if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
            ]

            total_orig = 0
            total_final = 0
            compressed_count = 0
            skipped_count = 0

            for f in image_files:
                out_path = OUTPUT_DIR / f.name
                try:
                    orig_sz, final_sz, was_compressed = compress_single_image(
                        input_path=f,
                        output_path=out_path,
                        target_bytes=target_bytes,
                        format_choice=format_choice,
                    )
                    total_orig += orig_sz
                    total_final += final_sz
                    if was_compressed:
                        compressed_count += 1
                    else:
                        skipped_count += 1
                except Exception as e:
                    print(f"Error compressing {f.name}: {e}")

            saved_bytes = total_orig - total_final
            saved_pct = (saved_bytes / total_orig) * 100 if total_orig > 0 else 0

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()

            resp = {
                "success": True,
                "total_images": len(image_files),
                "compressed_count": compressed_count,
                "skipped_count": skipped_count,
                "orig_formatted": format_size(total_orig),
                "final_formatted": format_size(total_final),
                "saved_formatted": format_size(saved_bytes),
                "saved_pct": round(saved_pct, 1),
                "output_dir": str(OUTPUT_DIR.resolve())
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

def is_port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0

def find_available_port(start_port: int = 5000) -> int:
    port = start_port
    while port < start_port + 100:
        if is_port_available(port):
            return port
        port += 1
    return start_port

def run_server(port: int = 5000, open_browser: bool = True):
    port = find_available_port(port)
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, CompressorRequestHandler)
    url = f"http://localhost:{port}"

    print("=" * 60)
    print("  IMAGE COMPRESSOR DASHBOARD")
    print(f"  Running locally at: {url}")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 60)

    if open_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        httpd.server_close()

if __name__ == "__main__":
    open_b = "--no-browser" not in sys.argv
    run_server(port=5000, open_browser=open_b)
