#!/usr/bin/env python3
"""
SQLite Database Module for Image Compressor Analytics & Activity Logging.
Zero external dependencies (uses Python standard library sqlite3).
"""

import sqlite3
import csv
import io
import hashlib
import hmac
import secrets
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).resolve().parent / "compressor.db"

def get_connection() -> sqlite3.Connection:
    """Return a connection with row_factory enabled."""
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize SQLite database tables and indices."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                filename TEXT NOT NULL,
                original_size INTEGER NOT NULL,
                compressed_size INTEGER NOT NULL,
                saved_bytes INTEGER NOT NULL,
                saved_percent REAL NOT NULL,
                format TEXT NOT NULL,
                source TEXT NOT NULL,
                client_ip TEXT DEFAULT '127.0.0.1',
                user_agent TEXT DEFAULT '',
                status TEXT DEFAULT 'success'
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON activity_logs (timestamp DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_format ON activity_logs (format)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_source ON activity_logs (source)")

        # Admin Configuration Table (Stores salted PBKDF2 password hash)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS admin_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Rate Limiting & Brute-Force Protection Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS login_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT NOT NULL,
                attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                success INTEGER NOT NULL
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_login_ip ON login_attempts (ip_address, attempt_time)")

        # IP Blacklist Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ip_blacklist (
                ip_address TEXT PRIMARY KEY,
                reason TEXT DEFAULT 'Administrative block',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.commit()

def log_activity(
    filename: str,
    original_size: int,
    compressed_size: int,
    saved_bytes: int,
    saved_percent: float,
    format_type: str,
    source: str = "browser_upload",
    client_ip: str = "127.0.0.1",
    user_agent: str = "",
    status: str = "success"
) -> int:
    """Insert a compression event into the activity log."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO activity_logs (
                filename, original_size, compressed_size, saved_bytes,
                saved_percent, format, source, client_ip, user_agent, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            filename, original_size, compressed_size, saved_bytes,
            round(saved_percent, 1), format_type.upper(), source, client_ip, user_agent, status
        ))
        conn.commit()
        return cursor.lastrowid

def parse_date_condition(date_range: str) -> str:
    dr = (date_range or "ALL").upper()
    if dr == "TODAY":
        return " AND timestamp >= datetime('now', 'start of day')"
    elif dr == "7D":
        return " AND timestamp >= datetime('now', '-7 days')"
    elif dr == "30D":
        return " AND timestamp >= datetime('now', '-30 days')"
    return ""

def get_analytics(date_range: str = "ALL") -> dict:
    """Compute aggregate analytics across compression events within optional date range."""
    date_sql = parse_date_condition(date_range)
    with get_connection() as conn:
        cursor = conn.cursor()

        # Total counts and sums
        cursor.execute(f"""
            SELECT 
                COUNT(*) as total_compressions,
                COALESCE(SUM(original_size), 0) as total_original_bytes,
                COALESCE(SUM(compressed_size), 0) as total_compressed_bytes,
                COALESCE(SUM(saved_bytes), 0) as total_saved_bytes,
                COALESCE(AVG(saved_percent), 0.0) as avg_saved_percent,
                COUNT(DISTINCT client_ip) as unique_clients
            FROM activity_logs
            WHERE 1=1 {date_sql}
        """)
        row = cursor.fetchone()

        # Format distribution breakdown
        cursor.execute(f"""
            SELECT format, COUNT(*) as count, COALESCE(SUM(saved_bytes), 0) as saved
            FROM activity_logs
            WHERE 1=1 {date_sql}
            GROUP BY format
            ORDER BY count DESC
        """)
        format_rows = cursor.fetchall()
        format_breakdown = [
            {"format": r["format"], "count": r["count"], "saved_bytes": r["saved"]}
            for r in format_rows
        ]

        # Source breakdown
        cursor.execute(f"""
            SELECT source, COUNT(*) as count
            FROM activity_logs
            WHERE 1=1 {date_sql}
            GROUP BY source
        """)
        source_rows = cursor.fetchall()
        source_breakdown = {r["source"]: r["count"] for r in source_rows}

        total_orig = row["total_original_bytes"]
        total_comp = row["total_compressed_bytes"]
        total_saved = row["total_saved_bytes"]
        overall_pct = (total_saved / total_orig * 100) if total_orig > 0 else 0.0

        return {
            "total_compressions": row["total_compressions"],
            "total_original_bytes": total_orig,
            "total_compressed_bytes": total_comp,
            "total_saved_bytes": total_saved,
            "overall_saved_percent": round(overall_pct, 1),
            "avg_saved_percent": round(row["avg_saved_percent"], 1),
            "unique_clients": row["unique_clients"],
            "format_breakdown": format_breakdown,
            "source_breakdown": source_breakdown,
        }

def get_history(
    search: str = None,
    format_filter: str = None,
    source_filter: str = None,
    date_range: str = "ALL",
    limit: int = 100,
    offset: int = 0
) -> tuple[list[dict], int]:
    """Fetch paginated, filtered activity logs and total matching count."""
    with get_connection() as conn:
        cursor = conn.cursor()

        query = "SELECT * FROM activity_logs WHERE 1=1"
        count_query = "SELECT COUNT(*) FROM activity_logs WHERE 1=1"
        params = []

        date_sql = parse_date_condition(date_range)
        if date_sql:
            query += date_sql
            count_query += date_sql

        if search:
            query += " AND filename LIKE ?"
            count_query += " AND filename LIKE ?"
            params.append(f"%{search}%")

        if format_filter and format_filter.upper() != "ALL":
            query += " AND format = ?"
            count_query += " AND format = ?"
            params.append(format_filter.upper())

        if source_filter and source_filter.lower() != "all":
            query += " AND source = ?"
            count_query += " AND source = ?"
            params.append(source_filter.lower())

        cursor.execute(count_query, params)
        total_count = cursor.fetchone()[0]

        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor.execute(query, params)
        rows = cursor.fetchall()

        results = []
        for r in rows:
            results.append({
                "id": r["id"],
                "timestamp": r["timestamp"],
                "filename": r["filename"],
                "original_size": r["original_size"],
                "compressed_size": r["compressed_size"],
                "saved_bytes": r["saved_bytes"],
                "saved_percent": r["saved_percent"],
                "format": r["format"],
                "source": r["source"],
                "client_ip": r["client_ip"],
                "user_agent": r["user_agent"],
                "status": r["status"]
            })

        return results, total_count

def export_csv() -> str:
    """Generate a CSV string of all activity logs."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM activity_logs ORDER BY id DESC")
        rows = cursor.fetchall()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID", "Timestamp (UTC)", "Filename", "Original Bytes",
            "Compressed Bytes", "Saved Bytes", "Saved %", "Format",
            "Source", "Client IP", "User Agent", "Status"
        ])
        for r in rows:
            writer.writerow([
                r["id"], r["timestamp"], r["filename"], r["original_size"],
                r["compressed_size"], r["saved_bytes"], r["saved_percent"],
                r["format"], r["source"], r["client_ip"], r["user_agent"], r["status"]
            ])

        return output.getvalue()

def clear_history() -> int:
    """Delete all activity records from the database."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM activity_logs")
        deleted = cursor.rowcount
        conn.commit()
        return deleted

# ==============================================================================
# Security, Password Management, and Rate Limiting
# ==============================================================================

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100000)
    return f"{salt}${key.hex()}"

def verify_password_hash(password: str, stored: str) -> bool:
    try:
        salt_hex, key_hex = stored.split("$", 1)
        key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 100000)
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception:
        return False

def get_stored_admin_password_hash() -> str | None:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM admin_config WHERE key = 'admin_password_hash'")
        row = cursor.fetchone()
        return row["value"] if row else None

def set_admin_password(new_password: str) -> str:
    p_hash = hash_password(new_password)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO admin_config (key, value, updated_at) 
            VALUES ('admin_password_hash', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        """, (p_hash,))
        conn.commit()
    return p_hash

def record_login_attempt(ip: str, success: bool):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO login_attempts (ip_address, success)
            VALUES (?, ?)
        """, (ip, 1 if success else 0))
        conn.commit()

def check_login_rate_limit(ip: str, max_attempts: int = 5, window_minutes: int = 15) -> tuple[bool, int]:
    """Returns (is_locked, seconds_remaining)."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) 
            FROM login_attempts 
            WHERE ip_address = ? AND success = 0 
              AND attempt_time >= datetime('now', '-' || ? || ' minutes')
        """, (ip, window_minutes))
        fail_count = cursor.fetchone()[0]

        if fail_count >= max_attempts:
            return True, window_minutes * 60

        return False, 0

def is_ip_blocked(ip: str) -> bool:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM ip_blacklist WHERE ip_address = ?", (ip,))
        return cursor.fetchone() is not None

def block_ip(ip: str, reason: str = "Administrative block"):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO ip_blacklist (ip_address, reason, created_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        """, (ip, reason))
        conn.commit()

def unblock_ip(ip: str):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM ip_blacklist WHERE ip_address = ?", (ip,))
        conn.commit()

def get_blacklist() -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM ip_blacklist ORDER BY created_at DESC")
        rows = cursor.fetchall()
        return [{"ip_address": r["ip_address"], "reason": r["reason"], "created_at": r["created_at"]} for r in rows]

def get_top_client_ips(limit: int = 20) -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT client_ip, COUNT(*) as total_ops, MAX(timestamp) as last_seen,
                   EXISTS(SELECT 1 FROM ip_blacklist b WHERE b.ip_address = activity_logs.client_ip) as is_blocked
            FROM activity_logs
            GROUP BY client_ip
            ORDER BY total_ops DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        return [
            {
                "client_ip": r["client_ip"],
                "total_ops": r["total_ops"],
                "last_seen": r["last_seen"],
                "is_blocked": bool(r["is_blocked"])
            }
            for r in rows
        ]

# Auto-initialize tables on module import
init_db()
