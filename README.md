# Smart Image Compressor (`smart-image-compressor`)

[![Python Version](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![Release](https://img.shields.io/badge/release-v1.0.0-indigo.svg)](https://github.com/RabailAliBhatti/smart-image-compressor)
[![CI Test Suite](https://github.com/RabailAliBhatti/smart-image-compressor/actions/workflows/ci.yml/badge.svg)](https://github.com/RabailAliBhatti/smart-image-compressor/actions/workflows/ci.yml)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-2563eb.svg)](https://rabailalibhatti.github.io/smart-image-compressor/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

> **Fast, offline-first batch image compressor and modern utility dashboard.**  
> Effortlessly compress PNG, JPEG, WebP, and AVIF images strictly under **500 KB** (or any custom target size) for government portals, job applications, web performance, and document archiving—with zero visual degradation.

---

## 🌟 Why Smart Image Compressor?

Many government applications, university admissions, and job recruitment portals impose strict file size limits (such as **"under 500 KB"** or **"under 200 KB"**). Manually resizing photos, certificates, and ID cards with generic tools often blurs text or exceeds the upload ceiling.

**Smart Image Compressor** solves this completely:
- **Strict Size Guarantee**: Files are iteratively optimized to stay strictly below your exact target KB limit.
- **True Multi-Format Engine**:
  - **PNG**: Smart 256-color palette quantization (`FASTOCTREE`) and progressive Lanczos scaling that preserves **alpha transparency**.
  - **JPEG**: Precision binary-search quality optimization with high-resolution Lanczos downscaling.
  - **WebP & AVIF**: Next-generation compression for maximum size reduction.
  - **Auto**: Automatically preserves each file's native format (`.png` stays `.png`, `.jpg` stays `.jpg`).
- **100% Offline & Private**: Runs entirely on your local machine. No photos, scans, or identity documents are ever uploaded to cloud servers.
- **Dual Interface**: A clean, accessible **Web Dashboard** for non-technical users and a fast **CLI** for developers and power users.

---

## 🚀 Quick Start

### 1. Requirements
- Python 3.10 or higher
- Pillow (`PIL`):
  ```bash
  pip install Pillow
  ```

### 2. Launch the Visual Dashboard (Recommended)

#### On Windows:
Double-click [**`launch_dashboard.bat`**](file:///c:/Users/Rabail%20Ali/Desktop/Scripts/image-compressor/launch_dashboard.bat).  
*Your default web browser will automatically open with the dashboard at `http://localhost:5000`.*

#### On Any OS (macOS / Linux / Windows Terminal):
```bash
# Start the local server
python server.py

# Or run with the Python launcher on Windows:
py server.py
```

> 🌐 **Live Web Application (Zero Install)**: Try the live web tool directly at **[https://rabailalibhatti.github.io/smart-image-compressor/](https://rabailalibhatti.github.io/smart-image-compressor/)**.  
> 📱 **PWA Desktop & Mobile App**: Open in any modern browser (Chrome, Edge, Safari) and click **Install App** to use it offline with a desktop shortcut.  
> 💻 **Standalone Local Mode**: You can also double-click [**`index.html`**](file:///c:/Users/Rabail%20Ali/Desktop/Scripts/image-compressor/index.html) to run locally in your browser with zero Python installation required.

---

## 🖥️ Dashboard Features

| Feature | Description |
| :--- | :--- |
| **Interactive Canvas Crop & Rotate** | Freeform and preset aspect ratios (**1:1 Square / US Visa**, **35x45mm Passport / CNIC**, **4:3**, **16:9**) with 90° clockwise/counter-clockwise rotation and horizontal flip before compression. |
| **SSIM & PSNR Quality Metrics** | Real-time mathematical image fidelity scoring in the comparison modal: **Structural Similarity Index (SSIM)** and **Peak Signal-to-Noise Ratio (PSNR)** to guarantee zero perceptual degradation. |
| **Preset Import & Export (JSON)** | One-click export of custom profiles and compression rules to `.json`, and seamless import on any device. |
| **Local Wi-Fi Phone Upload & QR Sync** | Instant camera QR code connection for mobile phones on the same Wi-Fi network to upload and compress photos straight from your phone. |
| **Interactive Curtain Split Slider** | Draggable swipe curtain (like Squoosh/Juxtapose) for 100% pixel-level Before/After comparison, with Fit, 1x, 2x zoom and Side-by-Side toggle. |
| **Image-to-PDF Document Package** | Compile compressed images into a single multi-page PDF under strict size caps with customizable page margins and orientation. |
| **EXIF & GPS Privacy Stripper** | One-click toggle that strips camera serials, timestamps, and GPS coordinates before export. |
| **Folder Structure Preservation** | Drag whole folder hierarchies or use the "Browse Folder" button; folder paths are mirrored in the output batch ZIP. |
| **Batch File Renaming Rules** | Rename output files using customizable tags (`{name}`, `{ext}`, `{size}`, `{index}`, `{date}`) or quick presets (`{name}_min`, `{index}_{name}`, clean slug). |
| **Custom Watermark & Stamp** | Add branded text watermarks with position controls (center, corners) and adjustable opacity overlay. |
| **Drag & Drop & Clipboard** | Drop single images, folders, or paste directly from your clipboard (`Ctrl+V`). |
| **Numeric Target Size** | Direct number input (`[ 500 ] KB`) synchronized with precision slider and preset chips (`100 KB`, `250 KB`, `500 KB`, `1 MB`). |
| **Multi-Format Selection** | Switch between **Auto (Keep Original)**, **PNG**, **JPEG**, **WebP**, and **AVIF**. |
| **Standalone Windows .exe Builder** | Package everything into a single zero-dependency Windows desktop executable with `py build_exe.py` or `build_exe.bat`. |
| **🔒 Protected Admin Portal** | Dedicated analytics console (`admin.html`) locked behind a master password with live SQLite audit logs and CSV export. |
| **PBKDF2 Password Security** | Change the admin master password directly within the portal, securely stored as a salted PBKDF2-HMAC-SHA256 hash. |
| **Brute-Force Rate Limiting** | Automatically locks out suspicious IPs for 15 minutes after 5 failed login attempts with HTTP 429 status. |
| **IP Blacklist & Access Control** | Block and unblock client IPs directly from the security modal. |
| **Date-Range Analytics Filtering** | Filter audit logs and KPI metrics by **All Time**, **Today**, **Last 7 Days**, or **Last 30 Days**. |

---

## 🔒 Admin Portal & Analytics Security

The Analytics & Activity Log screen is completely separated from the public compression tool and protected by enterprise-grade security:

- **Admin URL**: `http://localhost:5000/admin.html`
- **Default Master Password**: `admin123`
- **In-Portal Password Management**: Change the master password anytime from the admin header. Passwords are encrypted using **PBKDF2-HMAC-SHA256 with random 16-byte salt (100,000 rounds)** and stored in the SQLite `admin_config` table.
- **Brute-Force Rate Limiting**: After 5 failed password attempts from a client IP within a 15-minute window, the server automatically returns `HTTP 429 Too Many Requests` and locks login for 15 minutes.
- **IP Blacklisting**: Block offending or abusive client IPs from accessing the server.
- **Date-Range Telemetry**: View telemetry metrics and filter audit events across **All Time**, **Today**, **Last 7 Days**, and **Last 30 Days**.
- **Protected Endpoints**: `/api/analytics`, `/api/history`, `/api/export-history`, `/api/admin/change-password`, and `/api/admin/blacklist` strictly require valid admin session tokens. Anonymous attempts are blocked with `HTTP 401 Unauthorized`.

---

## 💻 Command Line Interface (CLI)

The CLI tool (`compress_images.py`) is modular, scriptable, and integrates directly with the SQLite database.

### Usage Examples

```powershell
# Default: Compresses all images in ./images to under 500 KB into ./compressed_images
py compress_images.py

# Strip EXIF metadata and stamp a watermark:
py compress_images.py -s 500 --watermark "CONFIDENTIAL"

# Compile all compressed images into a single multi-page PDF document:
py compress_images.py -i ./images -o ./compressed_images --pdf-out ./compressed_images/document.pdf

# Keep each file's original format (PNG -> PNG, JPG -> JPG):
py compress_images.py -f auto -s 500

# Force all output files to compressed PNG format:
py compress_images.py -f png -s 500

# Force all output files to ultra-compact WebP format:
py compress_images.py -f webp -s 300

# Specify custom input and output folders:
py compress_images.py -i "C:/Users/Documents/Scans" -o "C:/Users/Documents/Compressed" -s 200

# Overwrite files in-place:
py compress_images.py -i "path/to/folder" --in-place
```

### CLI Flags Reference

| Flag | Short | Default | Description |
| :--- | :---: | :---: | :--- |
| `--size` | `-s` | `500.0` | Target maximum file size in Kilobytes (KB). |
| `--format` | `-f` | `auto` | Target output format (`auto`, `png`, `jpeg`, `webp`). |
| `--input` | `-i` | `./images` | Input directory containing images to compress. |
| `--output` | `-o` | `./compressed_images` | Output directory where compressed files will be saved. |
| `--in-place` | - | `False` | Overwrite original images directly in-place. |
| `--keep-exif` | - | `False` | Preserve EXIF/GPS metadata (default strips EXIF for privacy). |
| `--watermark` | - | `""` | Optional text to watermark across compressed images. |
| `--pdf-out` | - | `None` | Compile all processed images into a single combined PDF document. |

---

## ⚙️ How the Compression Algorithm Works

```mermaid
flowchart TD
    A[Input Image] --> B{Size <= Target KB?}
    B -- Yes & Format Matches --> C[Copy Direct / Preserve 100% Quality]
    B -- No --> D[Auto EXIF Orientation Fix]
    D --> E{Selected Format}
    
    E -- PNG --> F[Test Full Size Level 9]
    F --> G{Size <= Target?}
    G -- Yes --> H[Save Output]
    G -- No --> I[FASTOCTREE 256-Color Quantization]
    I --> J{Size <= Target?}
    J -- Yes --> H
    J -- No --> K[Lanczos Downscaling + Quantize Loop]
    K --> H

    E -- JPEG / WebP --> L[Binary Search Quality 95 down to 25]
    L --> M{Size <= Target?}
    M -- Yes --> H
    M -- No --> N[Lanczos Progressive Scale Down]
    N --> L
```

1. **Orientation Correction**: Automatically transposes EXIF orientation tags so scanned certificates and phone photos are never rotated sideways or upside-down.
2. **Quality Binary Search**: For JPEG and WebP, performs a 6-step binary search across compression quality levels to find the highest visual quality that satisfies the target size.
3. **Adaptive Quantization**: For PNGs, applies FASTOCTREE color quantization (reducing 24-bit RGB to optimized 8-bit indexed palette while preserving full alpha transparency).
4. **Lanczos Resampling**: If maximum compression at native resolution still exceeds the size threshold (e.g. 35-megapixel camera photos), the image dimensions are downscaled smoothly using high-fidelity Lanczos filtering.

---

## 📂 Project Structure

```
smart-image-compressor/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI matrix test runner
├── icons/
│   └── icon.svg               # Vector SVG application & PWA app icon
├── tests/
│   └── test_compressor.py     # Automated unit test suite (7 comprehensive tests)
├── .gitignore                 # Excludes caches, temporary files, and user images
├── LICENSE                    # MIT Open Source License
├── README.md                  # Comprehensive documentation & guides
├── admin.html                 # Password-protected admin analytics portal
├── admin.js                   # Admin dashboard logic, PBKDF2 & IP blacklist
├── app.js                     # Client-side canvas compressor, PWA & UI logic
├── compress_images.py         # Core Python compression engine & CLI
├── db.py                      # SQLite analytics database & telemetry queries
├── images/                    # Source images directory (.gitkeep tracked)
├── index.html                 # Semantic, accessible web dashboard
├── launch_dashboard.bat       # 1-click Windows launcher for Web Dashboard
├── manifest.json              # Progressive Web App (PWA) manifest
├── run_compressor.bat         # 1-click Windows launcher for CLI
├── server.py                  # Zero-dependency local web server & batch API
├── styles.css                 # High-contrast design system (Dark & Light modes)
└── sw.js                      # Offline service worker cache manager
```

---

## 🧪 Running Automated Tests

The repository includes a comprehensive Python unit test suite verifying strict size compliance, PNG transparency, CMYK conversions, EXIF stripping, and PDF packaging:

```bash
# Run the complete test suite locally:
py -m unittest discover -s tests -p "test_*.py" -v
```

---

## 🌐 Publishing to GitHub

To push this repository to your GitHub account:

```bash
# 1. Log in to GitHub (if not already authenticated)
gh auth login

# 2. Create the remote repository with the SEO-optimized name
gh repo create smart-image-compressor --public --source=. --remote=origin --push

# Or add your existing GitHub remote URL manually:
git remote add origin https://github.com/RabailAliBhatti/smart-image-compressor.git
git branch -M main
git push -u origin main --tags
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the [LICENSE](LICENSE) file for details.

Developed with precision by **Rabail Ali Bhatti** ([rabailalibhatti500@gmail.com](mailto:rabailalibhatti500@gmail.com)).
