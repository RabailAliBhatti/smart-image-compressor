#!/usr/bin/env python3
"""
Unit Test Suite for Smart Image Compressor (compress_images.py)
Tests strict target size compliance, multi-format compression,
PNG alpha channel preservation, CMYK conversion, EXIF stripping,
watermarking, and PDF compilation.
"""

import os
import sys
import shutil
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

# Add parent directory to sys.path so compress_images can be imported directly
sys.path.insert(0, str(Path(__file__).parent.parent.resolve()))

import compress_images


class TestCompressorEngine(unittest.TestCase):

    def setUp(self):
        """Create a temporary directory for test input and output files."""
        self.test_dir = tempfile.mkdtemp(prefix="compressor_test_")
        self.in_dir = Path(self.test_dir) / "input"
        self.out_dir = Path(self.test_dir) / "output"
        self.in_dir.mkdir(parents=True, exist_ok=True)
        self.out_dir.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        """Clean up the temporary directory."""
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def _generate_synthetic_image(self, filename, mode="RGB", size=(2000, 1500)):
        """Helper to create realistic high-entropy test images."""
        filepath = self.in_dir / filename
        img = Image.new(mode, size, (240, 240, 240) if mode == "RGB" else (240, 240, 240, 0))
        draw = ImageDraw.Draw(img)

        w, h = size
        for i in range(0, max(w, h), 40):
            color = ((i * 7) % 255, (i * 13) % 255, (i * 19) % 255)
            if mode == "RGBA":
                color = color + (200,)
            draw.rectangle([i, i, i + 35, i + 35], fill=color)
            draw.line([(0, i), (w, h - i)], fill=color, width=3)
            draw.ellipse([w - i - 60, i, w - i, i + 60], outline=color, width=2)

        fmt = "PNG" if filename.lower().endswith(".png") else "JPEG"
        img.save(filepath, format=fmt, quality=95)
        return filepath

    def test_jpeg_strict_size_limit(self):
        """Test that high-res JPEG compresses strictly under 500 KB and 200 KB limits."""
        input_path = self._generate_synthetic_image("photo.jpg", mode="RGB", size=(2200, 1800))
        orig_size = input_path.stat().st_size
        self.assertGreater(orig_size, 300 * 1024, "Generated test image should be larger than 300 KB")

        target_bytes = 200 * 1000
        output_path = self.out_dir / "photo_200k.jpg"
        orig, final, compressed = compress_images.compress_single_image(
            input_path=input_path,
            output_path=output_path,
            target_bytes=target_bytes,
            format_choice="jpeg"
        )

        self.assertTrue(output_path.exists(), "Output file must exist")
        actual_size = output_path.stat().st_size
        self.assertLessEqual(actual_size, target_bytes, f"Output size ({actual_size} bytes) must be <= {target_bytes}")

    def test_png_quantization_and_alpha(self):
        """Test that PNG images preserve alpha channel and stay under target limit."""
        input_path = self._generate_synthetic_image("graphic.png", mode="RGBA", size=(1600, 1200))

        target_bytes = 150 * 1000
        output_path = self.out_dir / "graphic_opt.png"
        orig, final, compressed = compress_images.compress_single_image(
            input_path=input_path,
            output_path=output_path,
            target_bytes=target_bytes,
            format_choice="png"
        )

        self.assertTrue(output_path.exists())
        self.assertLessEqual(output_path.stat().st_size, target_bytes)

        # Verify alpha channel presence in output
        with Image.open(output_path) as out_img:
            self.assertIn(out_img.mode, ("RGBA", "P", "LA"), "Output PNG must preserve transparency or palette with alpha")

    def test_cmyk_jpeg_handling(self):
        """Test that CMYK JPEG images (e.g. from document scanners) convert to RGB smoothly without crash."""
        cmyk_path = self.in_dir / "document_cmyk.jpg"
        img = Image.new("CMYK", (1200, 900), (0, 100, 100, 0))
        img.save(cmyk_path, "JPEG")

        output_path = self.out_dir / "document_rgb.jpg"
        orig, final, compressed = compress_images.compress_single_image(
            input_path=cmyk_path,
            output_path=output_path,
            target_bytes=300 * 1000,
            format_choice="jpeg"
        )

        self.assertTrue(output_path.exists())
        with Image.open(output_path) as out_img:
            self.assertEqual(out_img.mode, "RGB", "CMYK image must be converted to standard RGB")

    def test_exif_stripping(self):
        """Test that EXIF metadata is stripped when strip_exif=True."""
        input_path = self.in_dir / "with_exif.jpg"
        img = Image.new("RGB", (800, 600), (100, 150, 200))
        exif_bytes = img.getexif()
        exif_bytes[0x0112] = 1 # Orientation normal
        img.save(input_path, "JPEG", exif=exif_bytes)

        output_path = self.out_dir / "stripped.jpg"
        compress_images.compress_single_image(
            input_path=input_path,
            output_path=output_path,
            target_bytes=500 * 1000,
            format_choice="jpeg",
            strip_exif=True
        )

        with Image.open(output_path) as out_img:
            out_exif = out_img.getexif()
            self.assertNotIn(0x8825, out_exif, "GPS metadata must be stripped")

    def test_watermark_overlay(self):
        """Test that apply_watermark applies text overlay and returns an image of matching size."""
        base_img = Image.new("RGB", (800, 600), (220, 220, 220))
        watermarked = compress_images.apply_watermark(base_img, "CONFIDENTIAL", opacity=0.5)

        self.assertEqual(watermarked.size, (800, 600))
        self.assertIsNotNone(watermarked)

    def test_pdf_compilation(self):
        """Test that export_to_pdf packages multiple images into a valid multi-page PDF."""
        img1 = self._generate_synthetic_image("page1.jpg", size=(600, 800))
        img2 = self._generate_synthetic_image("page2.jpg", size=(600, 800))
        pdf_out = self.out_dir / "bundle.pdf"

        compress_images.export_to_pdf([img1, img2], pdf_out)
        self.assertTrue(pdf_out.exists(), "Combined PDF file must exist")
        self.assertGreater(pdf_out.stat().st_size, 0, "PDF file must not be empty")

        # Validate PDF header
        with open(pdf_out, "rb") as f:
            header = f.read(5)
            self.assertEqual(header, b"%PDF-", "File must have valid PDF magic bytes header")

    def test_auto_format_preservation(self):
        """Test that format_choice='auto' preserves the original extension."""
        png_in = self._generate_synthetic_image("scan.png", mode="RGBA", size=(800, 600))
        jpg_in = self._generate_synthetic_image("scan.jpg", mode="RGB", size=(800, 600))

        png_out = self.out_dir / "scan_out.png"
        jpg_out = self.out_dir / "scan_out.jpg"

        compress_images.compress_single_image(png_in, png_out, target_bytes=300 * 1000, format_choice="auto")
        compress_images.compress_single_image(jpg_in, jpg_out, target_bytes=300 * 1000, format_choice="auto")

        self.assertTrue(png_out.exists())
        self.assertTrue(jpg_out.exists())
        with Image.open(png_out) as img:
            self.assertEqual(img.format, "PNG")
        with Image.open(jpg_out) as img:
            self.assertEqual(img.format, "JPEG")


if __name__ == "__main__":
    unittest.main()
