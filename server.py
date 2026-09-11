#!/usr/bin/env python3
"""
Lightweight Local Web Server for Image Compressor Dashboard & Analytics API.
Integrated with SQLite database for tracking complete activity history.
Zero external dependencies (uses Python standard library).
"""

import os
import sys
import json
import socket
import webbrowser
import threading
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

# Import compression engine and database module
from compress_images import compress_single_image, format_size, SUPPORTED_EXTENSIONS
import db

BASE_DIR = Path(__file__).resolve().parent
INPUT_DIR = BASE_DIR / "images"
OUTPUT_DIR = BASE_DIR / "compressed_images"

class CompressorRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. Server Status
        if path == "/api/status":
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

        # 2. Analytics Summary
        if path == "/api/analytics":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            analytics = db.get_analytics()
            self.wfile.write(json.dumps(analytics).encode("utf-8"))
            return

        # 3. Activity History (Searchable & Filterable)
        if path == "/api/history":
            search = query.get("search", [None])[0]
            format_filter = query.get("format", [None])[0]
            source_filter = query.get("source", [None])[0]
            limit = int(query.get("limit", [100])[0])
            offset = int(query.get("offset", [0])[0])

            logs, total_count = db.get_history(
                search=search,
                format_filter=format_filter,
                source_filter=source_filter,
                limit=limit,
                offset=offset
            )

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()

            self.wfile.write(json.dumps({
                "logs": logs,
                "total_count": total_count,
                "limit": limit,
                "offset": offset
            }).encode("utf-8"))
            return

        # 4. Export CSV
        if path == "/api/export-history":
            csv_content = db.export_csv()
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="compressor_activity_log.csv"')
            self.end_headers()
            self.wfile.write(csv_content.encode("utf-8"))
            return

        # Default static file handler
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else ""
        try:
            payload = json.loads(body) if body else {}
        except Exception:
            payload = {}

        client_ip = self.client_address[0]
        user_agent = self.headers.get("User-Agent", "")

        # 1. Batch Local Folder Compression
        if path == "/api/compress-folder":
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

                    saved_b = orig_sz - final_sz
                    saved_pct = (saved_b / orig_sz * 100) if orig_sz > 0 else 0.0

                    if was_compressed:
                        compressed_count += 1
                        status = "success"
                    else:
                        skipped_count += 1
                        status = "skipped"

                    # Log to SQLite Database
                    db.log_activity(
                        filename=f.name,
                        original_size=orig_sz,
                        compressed_size=final_sz,
                        saved_bytes=saved_b,
                        saved_percent=saved_pct,
                        format_type=out_path.suffix.replace(".", "") or format_choice,
                        source="local_folder",
                        client_ip=client_ip,
                        user_agent=user_agent,
                        status=status
                    )

                except Exception as e:
                    print(f"Error compressing {f.name}: {e}")
                    db.log_activity(
                        filename=f.name,
                        original_size=f.stat().st_size if f.exists() else 0,
                        compressed_size=0,
                        saved_bytes=0,
                        saved_percent=0.0,
                        format_type=format_choice,
                        source="local_folder",
                        client_ip=client_ip,
                        user_agent=user_agent,
                        status=f"error: {str(e)[:50]}"
                    )

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

        # 2. Client-Side Browser Compression Telemetry Logger
        if path == "/api/log-activity":
            filename = payload.get("filename", "unknown")
            orig_sz = int(payload.get("original_size", 0))
            comp_sz = int(payload.get("compressed_size", 0))
            saved_b = orig_sz - comp_sz
            saved_p = (saved_b / orig_sz * 100) if orig_sz > 0 else 0.0
            fmt = str(payload.get("format", "JPEG"))
            status = str(payload.get("status", "success"))

            log_id = db.log_activity(
                filename=filename,
                original_size=orig_sz,
                compressed_size=comp_sz,
                saved_bytes=saved_b,
                saved_percent=saved_p,
                format_type=fmt,
                source="browser_upload",
                client_ip=client_ip,
                user_agent=user_agent,
                status=status
            )

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "log_id": log_id}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/history":
            deleted = db.clear_history()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "deleted": deleted}).encode("utf-8"))
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
    print("  SMART IMAGE COMPRESSOR & ANALYTICS SERVER")
    print(f"  Database : {db.DB_PATH.resolve()}")
    print(f"  Dashboard: {url}")
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
