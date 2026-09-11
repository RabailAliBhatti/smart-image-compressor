#!/usr/bin/env python3
"""
SQLite Database Module for Image Compressor Analytics & Activity Logging.
Zero external dependencies (uses Python standard library sqlite3).
"""

import sqlite3
import csv
import io
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

def get_analytics() -> dict:
    """Compute aggregate analytics across all compression events."""
    with get_connection() as conn:
        cursor = conn.cursor()

        # Total counts and sums
        cursor.execute("""
            SELECT 
                COUNT(*) as total_compressions,
                COALESCE(SUM(original_size), 0) as total_original_bytes,
                COALESCE(SUM(compressed_size), 0) as total_compressed_bytes,
                COALESCE(SUM(saved_bytes), 0) as total_saved_bytes,
                COALESCE(AVG(saved_percent), 0.0) as avg_saved_percent,
                COUNT(DISTINCT client_ip) as unique_clients
            FROM activity_logs
        """)
        row = cursor.fetchone()

        # Format distribution breakdown
        cursor.execute("""
            SELECT format, COUNT(*) as count, COALESCE(SUM(saved_bytes), 0) as saved
            FROM activity_logs
            GROUP BY format
            ORDER BY count DESC
        """)
        format_rows = cursor.fetchall()
        format_breakdown = [
            {"format": r["format"], "count": r["count"], "saved_bytes": r["saved"]}
            for r in format_rows
        ]

        # Source breakdown
        cursor.execute("""
            SELECT source, COUNT(*) as count
            FROM activity_logs
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
    limit: int = 100,
    offset: int = 0
) -> tuple[list[dict], int]:
    """Fetch paginated, filtered activity logs and total matching count."""
    with get_connection() as conn:
        cursor = conn.cursor()

        query = "SELECT * FROM activity_logs WHERE 1=1"
        count_query = "SELECT COUNT(*) FROM activity_logs WHERE 1=1"
        params = []

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

# Auto-initialize tables on module import
init_db()
