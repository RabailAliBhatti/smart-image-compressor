#!/usr/bin/env python3
"""
Lightweight Local Web Server for Image Compressor & Password-Protected Admin API.
Integrated with SQLite database for tracking complete activity history.
Zero external dependencies (uses Python standard library).
"""

import os
import sys
import json
import socket
import secrets
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

# Admin Authentication Configuration
# Default password is 'admin123', can be overridden via ADMIN_PASSWORD environment variable
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
ACTIVE_ADMIN_TOKENS = set()

def verify_admin_auth(handler) -> bool:
    """Check if request has a valid admin session token."""
    # Check X-Admin-Token header
    token = handler.headers.get("X-Admin-Token")
    if token and token in ACTIVE_ADMIN_TOKENS:
        return True

    # Check Authorization: Bearer <token>
    auth_header = handler.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token in ACTIVE_ADMIN_TOKENS:
            return True

    # Check query param ?token= (useful for CSV export download link)
    parsed = urlparse(handler.path)
    query = parse_qs(parsed.query)
    q_token = query.get("token", [None])[0]
    if q_token and q_token in ACTIVE_ADMIN_TOKENS:
        return True

    return False

class CompressorRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def send_unauthorized(self):
        self.send_json({"error": "Unauthorized. Admin password required."}, status=401)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 1. Public Server Status
        if path == "/api/status":
            image_count = 0
            if INPUT_DIR.exists():
                image_count = len([f for f in INPUT_DIR.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS])

            self.send_json({
                "status": "ok",
                "input_dir": str(INPUT_DIR.resolve()),
                "output_dir": str(OUTPUT_DIR.resolve()),
                "image_count": image_count,
            })
            return

        # 2. Protected Analytics Summary (Requires Admin)
        if path == "/api/analytics":
            if not verify_admin_auth(self):
                self.send_unauthorized()
                return
            analytics = db.get_analytics()
            self.send_json(analytics)
            return

        # 3. Protected Activity History (Requires Admin)
        if path == "/api/history":
            if not verify_admin_auth(self):
                self.send_unauthorized()
                return

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

            self.send_json({
                "logs": logs,
                "total_count": total_count,
                "limit": limit,
                "offset": offset
            })
            return

        # 4. Protected Export CSV (Requires Admin)
        if path == "/api/export-history":
            if not verify_admin_auth(self):
                self.send_unauthorized()
                return

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

        # 1. Admin Login Endpoint
        if path == "/api/admin/login":
            entered_password = payload.get("password", "")
            if entered_password == ADMIN_PASSWORD:
                token = secrets.token_hex(24)
                ACTIVE_ADMIN_TOKENS.add(token)
                self.send_json({"success": True, "token": token})
            else:
                self.send_json({"error": "Invalid admin password."}, status=401)
            return

        # 2. Admin Logout Endpoint
        if path == "/api/admin/logout":
            token = self.headers.get("X-Admin-Token") or payload.get("token")
            if token and token in ACTIVE_ADMIN_TOKENS:
                ACTIVE_ADMIN_TOKENS.remove(token)
            self.send_json({"success": True})
            return

        # 3. Admin Token Verify Endpoint
        if path == "/api/admin/verify":
            is_valid = verify_admin_auth(self)
            self.send_json({"valid": is_valid}, status=200 if is_valid else 401)
            return

        # 4. Public Batch Local Folder Compression
        if path == "/api/compress-folder":
            target_kb = float(payload.get("target_kb", 500.0))
            format_choice = str(payload.get("format", "auto")).lower()
            target_bytes = int(target_kb * 1000)

            if not INPUT_DIR.exists():
                self.send_json({"error": f"Folder {INPUT_DIR} does not exist"}, status=404)
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

            self.send_json({
                "success": True,
                "total_images": len(image_files),
                "compressed_count": compressed_count,
                "skipped_count": skipped_count,
                "orig_formatted": format_size(total_orig),
                "final_formatted": format_size(total_final),
                "saved_formatted": format_size(saved_bytes),
                "saved_pct": round(saved_pct, 1),
                "output_dir": str(OUTPUT_DIR.resolve())
            })
            return

        # 5. Public Telemetry Logging (so all compressions are recorded in SQLite)
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

            self.send_json({"success": True, "log_id": log_id})
            return

        self.send_response(404)
        self.end_headers()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        # Protected Clear History (Requires Admin)
        if parsed.path == "/api/history":
            if not verify_admin_auth(self):
                self.send_unauthorized()
                return

            deleted = db.clear_history()
            self.send_json({"success": True, "deleted": deleted})
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

    print("=" * 65)
    print("  SMART IMAGE COMPRESSOR & SECURE ADMIN SERVER")
    print(f"  Public Dashboard: {url}")
    print(f"  Admin Portal    : {url}/admin.html")
    print(f"  Default Password: {ADMIN_PASSWORD}")
    print(f"  Database        : {db.DB_PATH.resolve()}")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 65)

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
