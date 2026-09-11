#!/usr/bin/env python3
"""
PyInstaller Packaging Script for Smart Image Compressor.
Bundles the dashboard web UI, Python compression engine, SQLite database,
and local server into a standalone zero-dependency Windows executable (.exe).

Usage:
    py build_exe.py
    or run build_exe.bat
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"
BUILD_DIR = BASE_DIR / "build"
EXE_NAME = "SmartImageCompressor"

def check_pyinstaller():
    """Ensure PyInstaller is installed in the current Python environment."""
    try:
        import PyInstaller
        print(f"[OK] Found PyInstaller version {PyInstaller.__version__}")
        return True
    except ImportError:
        print("[!] PyInstaller not found. Installing via pip...")
        res = subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=False)
        return res.returncode == 0

def build():
    print("=" * 65)
    print("  BUILDING STANDALONE WINDOWS EXECUTABLE (.EXE)")
    print(f"  Target: {EXE_NAME}.exe")
    print("=" * 65)

    if not check_pyinstaller():
        print("[ERROR] Failed to install or locate PyInstaller. Please run: pip install pyinstaller")
        sys.exit(1)

    # Windows path separator for PyInstaller --add-data is ';'
    sep = ";" if sys.platform == "win32" else ":"

    # Data files to bundle with the binary
    data_files = [
        ("index.html", "."),
        ("admin.html", "."),
        ("styles.css", "."),
        ("app.js", "."),
        ("admin.js", "."),
        ("sw.js", "."),
        ("manifest.json", "."),
        ("qrcode.min.js", "."),
        ("icons", "icons"),
    ]

    add_data_args = []
    for src, dst in data_files:
        src_path = BASE_DIR / src
        if src_path.exists():
            add_data_args.extend(["--add-data", f"{src_path}{sep}{dst}"])
        else:
            print(f"[WARN] Asset '{src}' not found, skipping.")

    # Hidden imports required by dependencies
    hidden_imports = [
        "--hidden-import=PIL",
        "--hidden-import=PIL.Image",
        "--hidden-import=PIL.ImageDraw",
        "--hidden-import=PIL.ImageOps",
        "--hidden-import=sqlite3",
        "--hidden-import=webbrowser",
        "--hidden-import=compress_images",
        "--hidden-import=db",
    ]

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name", EXE_NAME,
        "--onefile",
        "--clean",
        *add_data_args,
        *hidden_imports,
        str(BASE_DIR / "server.py")
    ]

    print("\nExecuting PyInstaller command:")
    print(" ".join(cmd[:8]), "...")

    result = subprocess.run(cmd, cwd=str(BASE_DIR))

    if result.returncode == 0:
        exe_path = DIST_DIR / f"{EXE_NAME}.exe"
        print("\n" + "=" * 65)
        print("  BUILD SUCCESSFUL!")
        print(f"  Standalone Executable: {exe_path}")
        if exe_path.exists():
            size_mb = exe_path.stat().st_size / (1024 * 1024)
            print(f"  File Size            : {size_mb:.1f} MB")
        print("=" * 65)
        print("  You can now distribute this single .exe file to any Windows machine.")
        print("  Users do not need Python or Pillow installed to run it!")
        print("=" * 65)
    else:
        print("\n[ERROR] PyInstaller build failed with exit code:", result.returncode)
        sys.exit(result.returncode)

if __name__ == "__main__":
    build()
