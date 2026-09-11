# Smart Image Compressor & Dashboard

An intuitive, powerful image compression tool that shrinks images, documents, and certificates strictly under a target file size (default: **500 KB**).

Designed for anyone to use effortlessly—no coding or command-line experience needed!

---

## 🚀 Easy 1-Click Visual Dashboard (Recommended)

1. Double-click [**`launch_dashboard.bat`**](file:///c:/Users/Rabail%20Ali/Desktop/Scripts/image-compressor/launch_dashboard.bat).
2. Your browser will automatically open with the dashboard:
   - **Drag & Drop**: Drop pictures or certificates directly into the browser.
   - **Size Selector**: Choose presets (`100 KB`, `250 KB`, `500 KB`, `1 MB`) or drag the slider.
   - **Format Selector**:
     - **Auto (Keep Original)**: Preserves original format (PNG stays PNG, JPG stays JPG).
     - **PNG**: Smart quantization and optimization preserving full transparency.
     - **JPEG**: Universal compatibility.
     - **WebP & AVIF**: High-efficiency next-gen compression.
   - **Before / After Comparison**: Click any image thumbnail to inspect visual quality side-by-side.
   - **Download Options**: Download individual images with matching format extensions or click **"Download All (ZIP)"**.
   - **Batch Disk Compression**: Switch to the "Local Folder" tab to compress your entire `./images` folder on disk with 1 click!

*Note: You can also open [**`index.html`**](file:///c:/Users/Rabail%20Ali/Desktop/Scripts/image-compressor/index.html) directly in any web browser without running any command.*

---

## 💻 Terminal / Command Line Options

If you prefer using the command line:

```powershell
# Compress all images in ./images (keeping original formats) to under 500 KB:
py compress_images.py -f auto -s 500

# Compress specifically to PNG format:
py compress_images.py -f png -s 500

# Compress specifically to WebP format:
py compress_images.py -f webp -s 500

# Custom folders:
py compress_images.py -i "path/to/input" -o "path/to/output" -f auto

# Overwrite in-place:
py compress_images.py --in-place
```

Or double-click [**`run_compressor.bat`**](file:///c:/Users/Rabail%20Ali/Desktop/Scripts/image-compressor/run_compressor.bat).
