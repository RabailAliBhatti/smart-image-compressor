#!/usr/bin/env python3
"""
Lightweight Local Web Server for Image Compressor & Password-Protected Admin API.
Integrated with SQLite database for tracking complete activity history.
Zero external dependencies (uses Python standard library).
"""

import os
import sys
import json
import base64
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

if getattr(sys, 'frozen', False):
    # Running in a PyInstaller executable bundle
    BASE_DIR = Path(getattr(sys, '_MEIPASS', Path(sys.executable).parent))
    DATA_DIR = Path(sys.executable).resolve().parent
else:
    BASE_DIR = Path(__file__).resolve().parent
    DATA_DIR = BASE_DIR

INPUT_DIR = DATA_DIR / "images"
OUTPUT_DIR = DATA_DIR / "compressed_images"

# Admin Authentication Configuration
# Default password is 'admin123', can be overridden via ADMIN_PASSWORD environment variable
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
ACTIVE_ADMIN_TOKENS = set()

def get_local_ip() -> str:
    """Detect the host machine's LAN IP address on the local Wi-Fi/Ethernet network."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"

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

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def send_unauthorized(self):
        self.send_json({"error": "Unauthorized. Admin password required."}, status=401)

    def do_GET(self):
        client_ip = self.client_address[0]
        if db.is_ip_blocked(client_ip):
            self.send_json({"error": "Access denied. IP blocked by administrator."}, status=403)
            return

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

        # 1b. Public Network Info (for Phone QR upload)
        if path == "/api/network-info":
            local_ip = get_local_ip()
            server_port = self.server.server_address[1]
            self.send_json({
                "local_ip": local_ip,
                "port": server_port,
                "url": f"http://{local_ip}:{server_port}"
            })
            return

        # 2. Protected Analytics Summary (Requires Admin)
        if path == "/api/analytics":
            if not verify_admin_auth(self):
                self.send_unauthorized()
                return
            date_range = query.get("range", ["ALL"])[0]
            analytics = db.get_analytics(date_range=date_range)
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
            date_range = query.get("range", ["ALL"])[0]
            limit = int(query.get("limit", [100])[0])
            offset = int(query.get("offset", [0])[0])

            logs, total_count = db.get_history(
                search=search,
                format_filter=format_filter,
                source_filter=source_filter,
                date_range=date_range,
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

        # 4. Protected IP Blacklist & Access Summary (Requires Admin)
        if path == "/api/admin/blacklist":
            if not verify_admin_auth(self):
                self.send_unauthorized()
                return
            self.send_json({
                "blacklist": db.get_blacklist(),
                "top_clients": db.get_top_client_ips()
            })
            return

        # 5. Protected Export CSV (Requires Admin)
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
        client_ip = self.client_address[0]
        user_agent = self.headers.get("User-Agent", "")

        if db.is_ip_blocked(client_ip):
            self.send_json({"error": "Access denied. IP blocked by administrator."}, status=403)
            return

        parsed = urlparse(self.path)
        path = parsed.path
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length > 0 else ""
        try:
            payload = json.loads(body) if body else {}
        except Exception:
            payload = {}

        # 0. Mobile Direct Upload Endpoint
        if path == "/api/upload":
            files = payload.get("files", [])
            if not files and payload.get("data") and payload.get("filename"):
                files = [{"name": payload.get("filename"), "data": payload.get("data")}]

            if not files:
                self.send_json({"error": "No files provided"}, status=400)
                return

            INPUT_DIR.mkdir(parents=True, exist_ok=True)
            saved_files = []

            for f in files:
                fname = os.path.basename(f.get("name", "photo.jpg"))
                raw_data = f.get("data", "")
                if "," in raw_data:
                    raw_data = raw_data.split(",", 1)[1]

                try:
                    binary_bytes = base64.b64decode(raw_data)
                except Exception:
                    continue

                dest_path = INPUT_DIR / fname
                if dest_path.exists():
                    stem = dest_path.stem
                    suffix = dest_path.suffix
                    dest_path = INPUT_DIR / f"{stem}_{secrets.token_hex(3)}{suffix}"

                with open(dest_path, "wb") as out_f:
                    out_f.write(binary_bytes)

                saved_files.append({
                    "filename": dest_path.name,
                    "size": len(binary_bytes),
                    "path": f"images/{dest_path.name}"
                })

            self.send_json({
                "success": True,
                "saved_count": len(saved_files),
                "files": saved_files
            })
            return

        # 1. Admin Login Endpoint (with Rate Limiting & PBKDF2 Password Check)
        if path == "/api/admin/login":
            is_locked, retry_secs = db.check_login_rate_limit(client_ip)
            if is_locked:
                self.send_json({
                    "error": f"Too many failed login attempts. Locked out for {retry_secs // 60} minutes.",
                    "retry_after": retry_secs
                }, status=429)
                return

            entered_password = payload.get("password", "")
            stored_hash = db.get_stored_admin_password_hash()

            if stored_hash:
                valid = db.verify_password_hash(entered_password, stored_hash)
            else:
                valid = (entered_password == ADMIN_PASSWORD)

            if valid:
                db.record_login_attempt(client_ip, success=True)
                token = secrets.token_hex(24)
                ACTIVE_ADMIN_TOKENS.add(token)
                self.send_json({"success": True, "token": token})
            else:
                db.record_login_attempt(client_ip, success=False)
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

        # 4. Admin Password Change Endpoint
        if path == "/api/admin/change-password":
            if not verify_admin_auth(self):
                self.send_unauthorized()
                return

            current_password = payload.get("current_password", "")
            new_password = payload.get("new_password", "")

            if len(new_password) < 6:
                self.send_json({"error": "New password must be at least 6 characters."}, status=400)
                return

            stored_hash = db.get_stored_admin_password_hash()
            if stored_hash:
                valid = db.verify_password_hash(current_password, stored_hash)
            else:
                valid = (current_password == ADMIN_PASSWORD)

            if not valid:
                self.send_json({"error": "Current password is incorrect."}, status=401)
                return

            db.set_admin_password(new_password)
            self.send_json({"success": True, "message": "Password updated successfully."})
            return

        # 5. Admin Block IP Endpoint
        if path == "/api/admin/block-ip":
            if not verify_admin_auth(self):
                self.send_unauthorized()
                return

            target_ip = payload.get("ip", "").strip()
            reason = payload.get("reason", "Administrative block")
            if not target_ip:
                self.send_json({"error": "IP address required."}, status=400)
                return

            db.block_ip(target_ip, reason)
            self.send_json({"success": True, "message": f"IP {target_ip} blocked."})
            return

        # 6. Admin Unblock IP Endpoint
        if path == "/api/admin/unblock-ip":
            if not verify_admin_auth(self):
                self.send_unauthorized()
                return

            target_ip = payload.get("ip", "").strip()
            if not target_ip:
                self.send_json({"error": "IP address required."}, status=400)
                return

            db.unblock_ip(target_ip)
            self.send_json({"success": True, "message": f"IP {target_ip} unblocked."})
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
        client_ip = self.client_address[0]
        if db.is_ip_blocked(client_ip):
            self.send_json({"error": "Access denied. IP blocked by administrator."}, status=403)
            return

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
    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, CompressorRequestHandler)
    local_url = f"http://localhost:{port}"
    lan_ip = get_local_ip()
    lan_url = f"http://{lan_ip}:{port}"

    print("=" * 65)
    print("  SMART IMAGE COMPRESSOR & SECURE ADMIN SERVER")
    print(f"  Local Access    : {local_url}")
    print(f"  Mobile / LAN    : {lan_url}")
    print(f"  Admin Portal    : {local_url}/admin.html")
    print(f"  Default Password: {ADMIN_PASSWORD}")
    print(f"  Database        : {db.DB_PATH.resolve()}")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 65)

    if open_browser:
        threading.Timer(0.8, lambda: webbrowser.open(local_url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        httpd.server_close()

if __name__ == "__main__":
    open_b = "--no-browser" not in sys.argv
    run_server(port=5000, open_browser=open_b)
