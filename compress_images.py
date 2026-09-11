#!/usr/bin/env python3
"""
Image Compressor Script
Compresses images (JPEG, PNG, WebP, etc.) in a directory to strictly meet a target file size (default: 500 KB).
Supports format preservation (Auto) as well as conversion to PNG, JPEG, or WebP.
Includes EXIF privacy stripping, custom watermarking overlay, and multi-page PDF compilation.
"""

import os
import sys
import shutil
import io
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

try:
    import db
except Exception:
    db = None

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"}

def format_size(bytes_size: int) -> str:
    """Format bytes into a human-readable string."""
    if bytes_size < 1024:
        return f"{bytes_size} B"
    elif bytes_size < 1024 * 1024:
        return f"{bytes_size / 1024:.1f} KB"
    else:
        return f"{bytes_size / (1024 * 1024):.2f} MB"

def apply_watermark(img: Image.Image, text: str, opacity: float = 0.65) -> Image.Image:
    """Draw a semi-transparent text watermark with background pill in bottom-right corner."""
    if not text:
        return img

    base = img.convert("RGBA")
    txt_layer = Image.new("RGBA", base.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(txt_layer)
    w, h = base.size

    font_size = max(16, int(h * 0.035))
    try:
        font = ImageFont.truetype("arial.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    margin = int(min(w, h) * 0.03)
    x = max(10, w - tw - margin - 10)
    y = max(10, h - th - margin - 10)

    alpha_int = int(255 * opacity)
    draw.rectangle([x - 8, y - 6, x + tw + 8, y + th + 6], fill=(0, 0, 0, int(alpha_int * 0.6)))
    draw.text((x, y), text, fill=(255, 255, 255, alpha_int), font=font)

    merged = Image.alpha_composite(base, txt_layer)
    if img.mode == "RGB":
        return merged.convert("RGB")
    return merged

def compress_png(img: Image.Image, target_bytes: int) -> bytes:
    """
    Compress a PNG image to stay strictly under target_bytes.
    Uses optimization, FASTOCTREE quantization, and progressive Lanczos downscaling.
    Preserves alpha channel / transparency.
    """
    buffer = io.BytesIO()

    # Step 1: If image is moderately sized, test saving directly
    w, h = img.size
    if w * h <= 1200 * 1200:
        buffer.seek(0)
        buffer.truncate()
        img.save(buffer, format="PNG", optimize=True, compress_level=9)
        if buffer.tell() <= target_bytes:
            return buffer.getvalue()

    # Step 2: Binary search on dimension scale + FASTOCTREE quantization (256 colors)
    current_img = img.copy()
    if w > 2400 or h > 2400:
        current_img.thumbnail((2200, 2200), Image.Resampling.LANCZOS)
        w, h = current_img.size

    scale = 1.0
    best_data = None

    for _ in range(8):
        cur_w = max(60, int(w * scale))
        cur_h = max(60, int(h * scale))
        scaled_img = current_img.resize((cur_w, cur_h), Image.Resampling.LANCZOS)

        # Try FASTOCTREE with 256 colors
        try:
            quantized = scaled_img.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
            buffer.seek(0)
            buffer.truncate()
            quantized.save(buffer, format="PNG", optimize=True, compress_level=9)
            size = buffer.tell()
            if size <= target_bytes:
                best_data = buffer.getvalue()
                break
        except Exception:
            pass

        # Also try non-quantized if scale is low
        if scale <= 0.6:
            buffer.seek(0)
            buffer.truncate()
            scaled_img.save(buffer, format="PNG", optimize=True, compress_level=9)
            if buffer.tell() <= target_bytes:
                best_data = buffer.getvalue()
                break

        scale *= 0.85

    if best_data is None:
        best_data = buffer.getvalue()

    return best_data

def compress_jpeg(img: Image.Image, target_bytes: int, min_quality: int = 25) -> bytes:
    """
    Compress a JPEG image to stay strictly under target_bytes.
    Uses binary search on quality (95 down to min_quality) followed by Lanczos downscaling.
    """
    # Ensure RGB
    if img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")

    buffer = io.BytesIO()
    best_data = None
    low = min_quality
    high = 95

    current_img = img.copy()
    while low <= high:
        mid = (low + high) // 2
        buffer.seek(0)
        buffer.truncate()
        current_img.save(buffer, format="JPEG", quality=mid, optimize=True)
        size = buffer.tell()

        if size <= target_bytes:
            best_data = buffer.getvalue()
            low = mid + 1
        else:
            high = mid - 1

    # Downscale if needed
    if best_data is None:
        w, h = current_img.size
        scale = 0.9
        while scale > 0.15:
            w = int(w * scale)
            h = int(h * scale)
            if w < 60 or h < 60:
                break
            resized = current_img.resize((w, h), Image.Resampling.LANCZOS)
            low = min_quality
            high = 75
            found = False
            while low <= high:
                mid = (low + high) // 2
                buffer.seek(0)
                buffer.truncate()
                resized.save(buffer, format="JPEG", quality=mid, optimize=True)
                if buffer.tell() <= target_bytes:
                    best_data = buffer.getvalue()
                    found = True
                    low = mid + 1
                else:
                    high = mid - 1
            if found:
                break
            scale = 0.85

    if best_data is None:
        buffer.seek(0)
        buffer.truncate()
        current_img.save(buffer, format="JPEG", quality=min_quality, optimize=True)
        best_data = buffer.getvalue()

    return best_data

def compress_webp(img: Image.Image, target_bytes: int, min_quality: int = 25) -> bytes:
    """
    Compress a WebP image to stay strictly under target_bytes.
    Supports transparency (RGBA), fast quality search, and dimension downscaling.
    """
    buffer = io.BytesIO()
    best_data = None
    low = min_quality
    high = 92

    current_img = img.copy()
    w, h = current_img.size
    if w > 2400 or h > 2400:
        current_img.thumbnail((2200, 2200), Image.Resampling.LANCZOS)

    # Step 1: Binary search on quality
    while low <= high:
        mid = (low + high) // 2
        buffer.seek(0)
        buffer.truncate()
        current_img.save(buffer, format="WEBP", quality=mid, method=4)
        size = buffer.tell()

        if size <= target_bytes:
            best_data = buffer.getvalue()
            low = mid + 1
        else:
            high = mid - 1

    # Step 2: Downscale if lowest quality is still > target_bytes
    if best_data is None:
        w, h = current_img.size
        scale = 0.88
        while scale > 0.15:
            w = int(w * scale)
            h = int(h * scale)
            if w < 60 or h < 60:
                break
            resized = current_img.resize((w, h), Image.Resampling.LANCZOS)
            low = min_quality
            high = 75
            found = False
            while low <= high:
                mid = (low + high) // 2
                buffer.seek(0)
                buffer.truncate()
                resized.save(buffer, format="WEBP", quality=mid, method=4)
                if buffer.tell() <= target_bytes:
                    best_data = buffer.getvalue()
                    found = True
                    low = mid + 1
                else:
                    high = mid - 1
            if found:
                break
            scale = 0.85

    if best_data is None:
        buffer.seek(0)
        buffer.truncate()
        current_img.save(buffer, format="WEBP", quality=min_quality, method=4)
        best_data = buffer.getvalue()

    return best_data

def compress_single_image(
    input_path: Path,
    output_path: Path,
    target_bytes: int = 500 * 1000,
    format_choice: str = "auto",
    strip_exif: bool = True,
    watermark_text: str = "",
) -> tuple[int, int, bool]:
    """
    Compress an image to ensure it is <= target_bytes.
    format_choice: 'auto', 'png', 'jpeg', or 'webp'.
    strip_exif: strips camera metadata & GPS coordinates.
    watermark_text: applies watermark text overlay if provided.
    Returns (original_size, final_size, was_compressed).
    """
    orig_size = input_path.stat().st_size
    in_ext = input_path.suffix.lower()

    # Determine output format and extension
    if format_choice == "auto":
        if in_ext in (".jpg", ".jpeg"):
            target_fmt = "JPEG"
            out_ext = ".jpg"
        elif in_ext == ".png":
            target_fmt = "PNG"
            out_ext = ".png"
        elif in_ext == ".webp":
            target_fmt = "WEBP"
            out_ext = ".webp"
        else:
            target_fmt = "JPEG"
            out_ext = ".jpg"
    elif format_choice.lower() == "png":
        target_fmt = "PNG"
        out_ext = ".png"
    elif format_choice.lower() == "webp":
        target_fmt = "WEBP"
        out_ext = ".webp"
    else:
        target_fmt = "JPEG"
        out_ext = ".jpg"

    # Adjust output file extension if needed
    if output_path.suffix.lower() != out_ext:
        output_path = output_path.with_suffix(out_ext)

    # Check if we can bypass without modifications
    if in_ext == out_ext and orig_size <= target_bytes and not watermark_text and not strip_exif:
        if input_path.resolve() != output_path.resolve():
            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(input_path, output_path)
        return orig_size, orig_size, False

    # Open image and transpose EXIF tags
    with Image.open(input_path) as img:
        img = ImageOps.exif_transpose(img)

        # Apply watermark if requested
        if watermark_text:
            img = apply_watermark(img, watermark_text)

        if target_fmt == "PNG":
            compressed_data = compress_png(img, target_bytes)
        elif target_fmt == "WEBP":
            compressed_data = compress_webp(img, target_bytes)
        else:
            compressed_data = compress_jpeg(img, target_bytes)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(compressed_data)

    final_size = output_path.stat().st_size
    return orig_size, final_size, True

def export_to_pdf(image_paths: list[Path], pdf_path: Path):
    """Compile compressed images into a single multi-page PDF document."""
    if not image_paths:
        return
    rgb_images = []
    for p in sorted(image_paths):
        try:
            with Image.open(p) as im:
                rgb_im = im.convert("RGB")
                rgb_images.append(rgb_im.copy())
        except Exception as e:
            print(f"Skipping {p.name} for PDF: {e}")

    if rgb_images:
        pdf_path.parent.mkdir(parents=True, exist_ok=True)
        first = rgb_images[0]
        rest = rgb_images[1:] if len(rgb_images) > 1 else []
        first.save(pdf_path, "PDF", resolution=100.0, save_all=True, append_images=rest)
        print("=" * 65)
        print(f"  COMPILED MULTI-PAGE PDF: {pdf_path.resolve()}")
        print(f"  Pages: {len(rgb_images)} | File Size: {format_size(pdf_path.stat().st_size)}")
        print("=" * 65)

def process_directory(
    input_dir: Path,
    output_dir: Path,
    target_kb: float = 500.0,
    format_choice: str = "auto",
    in_place: bool = False,
    strip_exif: bool = True,
    watermark_text: str = "",
    pdf_out: Path | None = None,
):
    """Process all supported images in input_dir."""
    target_bytes = int(target_kb * 1000)

    if not input_dir.exists():
        print(f"Error: Input directory '{input_dir}' does not exist.")
        sys.exit(1)

    image_files = [
        f for f in input_dir.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    ]

    if not image_files:
        print(f"No supported images found in '{input_dir}'.")
        return

    print("=" * 65)
    print(f"  IMAGE COMPRESSOR (Target: < {target_kb} KB, Format: {format_choice.upper()})")
    print(f"  Input Directory  : {input_dir.resolve()}")
    print(f"  Output Directory : {output_dir.resolve() if not in_place else 'In-place'}")
    print(f"  EXIF Stripping   : {'Enabled (Privacy Protected)' if strip_exif else 'Disabled'}")
    if watermark_text:
        print(f"  Watermark Stamp  : '{watermark_text}'")
    print(f"  Total Images     : {len(image_files)}")
    print("=" * 65)

    total_orig = 0
    total_final = 0
    compressed_count = 0
    skipped_count = 0
    output_files = []

    for idx, file_path in enumerate(sorted(image_files), start=1):
        out_file = file_path if in_place else (output_dir / file_path.name)
        try:
            orig_sz, final_sz, was_compressed = compress_single_image(
                input_path=file_path,
                output_path=out_file,
                target_bytes=target_bytes,
                format_choice=format_choice,
                strip_exif=strip_exif,
                watermark_text=watermark_text,
            )
            total_orig += orig_sz
            total_final += final_sz
            output_files.append(out_file)

            name_display = file_path.name[:27] + "..." if len(file_path.name) > 30 else file_path.name

            if was_compressed:
                compressed_count += 1
                diff = orig_sz - final_sz
                pct = (diff / orig_sz) * 100 if orig_sz > 0 else 0
                status = "success"
                print(f"[{idx:>2}/{len(image_files)}] {name_display:<30} {format_size(orig_sz):>9} -> {format_size(final_sz):>9}  (-{pct:4.1f}%)")
            else:
                skipped_count += 1
                status = "skipped"
                diff = 0
                pct = 0.0
                print(f"[{idx:>2}/{len(image_files)}] {name_display:<30} {format_size(orig_sz):>9} -> [Already <= {target_kb} KB]")

            # Log to SQLite Database if db module is available
            if db:
                try:
                    db.log_activity(
                        filename=file_path.name,
                        original_size=orig_sz,
                        compressed_size=final_sz,
                        saved_bytes=diff,
                        saved_percent=pct,
                        format_type=out_file.suffix.replace(".", "").upper() or format_choice.upper(),
                        source="cli",
                        client_ip="127.0.0.1",
                        user_agent="Python-CLI",
                        status=status,
                    )
                except Exception:
                    pass

        except Exception as e:
            print(f"[{idx:>2}/{len(image_files)}] {file_path.name:<30} [ERROR: {e}]")
            if db:
                try:
                    db.log_activity(
                        filename=file_path.name,
                        original_size=file_path.stat().st_size if file_path.exists() else 0,
                        compressed_size=0,
                        saved_bytes=0,
                        saved_percent=0.0,
                        format_type=format_choice.upper(),
                        source="cli",
                        client_ip="127.0.0.1",
                        user_agent="Python-CLI",
                        status=f"error: {str(e)[:50]}",
                    )
                except Exception:
                    pass

    saved_bytes = total_orig - total_final
    saved_pct = (saved_bytes / total_orig) * 100 if total_orig > 0 else 0

    print("=" * 65)
    print("  SUMMARY")
    print(f"  Images Processed : {len(image_files)}")
    print(f"  Compressed       : {compressed_count}")
    print(f"  Kept As-Is       : {skipped_count}")
    print(f"  Original Size    : {format_size(total_orig)}")
    print(f"  Final Size       : {format_size(total_final)}")
    print(f"  Space Saved      : {format_size(saved_bytes)} ({saved_pct:.1f}%)")
    print("=" * 65)

    if pdf_out and output_files:
        export_to_pdf(output_files, pdf_out)

def main():
    parser = argparse.ArgumentParser(description="Compress images to strictly stay under target KB.")
    parser.add_argument("-i", "--input", type=str, default=None, help="Input directory (default: './images' or '.')")
    parser.add_argument("-o", "--output", type=str, default=None, help="Output directory (default: './compressed_images')")
    parser.add_argument("-s", "--size", type=float, default=500.0, help="Target max size in KB (default: 500)")
    parser.add_argument("-f", "--format", type=str, default="auto", choices=["auto", "png", "jpeg", "webp"], help="Target format (auto, png, jpeg, webp)")
    parser.add_argument("--in-place", action="store_true", help="Overwrite original files in-place")
    parser.add_argument("--keep-exif", action="store_true", help="Preserve EXIF & GPS metadata (default is to strip for privacy)")
    parser.add_argument("--watermark", type=str, default="", help="Optional watermark text to stamp on images")
    parser.add_argument("--pdf-out", type=str, default=None, help="Compile all processed images into a single PDF document file")

    args = parser.parse_args()
    in_dir = Path(args.input) if args.input else (Path("images") if Path("images").is_dir() else Path("."))
    out_dir = Path(args.output) if args.output else Path("compressed_images")
    pdf_out = Path(args.pdf_out) if args.pdf_out else None

    process_directory(
        input_dir=in_dir,
        output_dir=out_dir,
        target_kb=args.size,
        format_choice=args.format,
        in_place=args.in_place,
        strip_exif=not args.keep_exif,
        watermark_text=args.watermark,
        pdf_out=pdf_out,
    )

if __name__ == "__main__":
    main()

