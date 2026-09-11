/**
 * Image Compressor - Utility Dashboard Controller
 * Handles local server status, client-side canvas compression,
 * tabular results rendering, numeric slider synchronization, and ZIP exports.
 */

(() => {
  'use strict';

  // State
  let targetSizeKb = 500;
  let selectedFormat = 'auto'; // 'auto', 'png', 'jpeg', 'webp', 'avif'
  const items = [];
  let isServerConnected = false;

  // Header & Status
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  // Mode Switcher
  const modeUploadBtn = document.getElementById('modeUploadBtn');
  const modeFolderBtn = document.getElementById('modeFolderBtn');
  const uploadView = document.getElementById('uploadView');
  const localFolderView = document.getElementById('localFolderView');

  // Controls
  const targetSizeInput = document.getElementById('targetSizeInput');
  const targetSizeSlider = document.getElementById('targetSizeSlider');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const formatRadios = document.querySelectorAll('input[name="formatOption"]');

  // Dropzone & File Input
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');

  // Results & Table
  const resultsSection = document.getElementById('resultsSection');
  const resultsCount = document.getElementById('resultsCount');
  const tableBody = document.getElementById('tableBody');
  const statCount = document.getElementById('statCount');
  const statOrigSize = document.getElementById('statOrigSize');
  const statCompSize = document.getElementById('statCompSize');
  const statSaved = document.getElementById('statSaved');

  const clearAllBtn = document.getElementById('clearAllBtn');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const runLocalBatchBtn = document.getElementById('runLocalBatchBtn');

  // Modal
  const compareModal = document.getElementById('compareModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalOrigImg = document.getElementById('modalOrigImg');
  const modalCompImg = document.getElementById('modalCompImg');
  const modalOrigSize = document.getElementById('modalOrigSize');
  const modalCompSize = document.getElementById('modalCompSize');
  const modalTargetLabel = document.getElementById('modalTargetLabel');

  const toastShelf = document.getElementById('toastShelf');

  // Format resolver
  function resolveFormat(fileName, fileType, reqFormat) {
    if (reqFormat === 'auto') {
      if (/\.png$/i.test(fileName) || fileType === 'image/png') return { mime: 'image/png', ext: '.png', name: 'PNG' };
      if (/\.webp$/i.test(fileName) || fileType === 'image/webp') return { mime: 'image/webp', ext: '.webp', name: 'WebP' };
      if (/\.avif$/i.test(fileName) || fileType === 'image/avif') return { mime: 'image/avif', ext: '.avif', name: 'AVIF' };
      return { mime: 'image/jpeg', ext: '.jpg', name: 'JPEG' };
    }
    if (reqFormat === 'png') return { mime: 'image/png', ext: '.png', name: 'PNG' };
    if (reqFormat === 'webp') return { mime: 'image/webp', ext: '.webp', name: 'WebP' };
    if (reqFormat === 'avif') return { mime: 'image/avif', ext: '.avif', name: 'AVIF' };
    return { mime: 'image/jpeg', ext: '.jpg', name: 'JPEG' };
  }

  // Utilities
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastShelf.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // Check Server Status
  async function checkServer() {
    try {
      const res = await fetch('/api/status', { method: 'GET', cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        isServerConnected = true;
        statusDot.style.backgroundColor = 'var(--success-text)';
        statusText.textContent = 'Server Connected (Local)';
        if (data.input_dir) document.getElementById('inputFolderPath').textContent = data.input_dir;
        if (data.output_dir) document.getElementById('outputFolderPath').textContent = data.output_dir;
        return;
      }
    } catch (e) {
      // Standalone mode
    }
    isServerConnected = false;
    statusDot.style.backgroundColor = 'var(--text-faint)';
    statusText.textContent = 'In-Browser Mode';
  }

  // Mode Switch
  modeUploadBtn.addEventListener('click', () => {
    modeUploadBtn.classList.add('active');
    modeFolderBtn.classList.remove('active');
    uploadView.style.display = 'block';
    localFolderView.style.display = 'none';
  });

  modeFolderBtn.addEventListener('click', () => {
    modeFolderBtn.classList.add('active');
    modeUploadBtn.classList.remove('active');
    uploadView.style.display = 'none';
    localFolderView.style.display = 'block';
  });

  // Size Controls Synchronization
  function setTargetSize(val) {
    let num = parseInt(val, 10);
    if (isNaN(num) || num < 20) num = 20;
    if (num > 10000) num = 10000;

    targetSizeKb = num;
    targetSizeInput.value = targetSizeKb;
    targetSizeSlider.value = Math.min(2000, targetSizeKb);

    presetBtns.forEach(btn => {
      if (parseInt(btn.dataset.size, 10) === targetSizeKb) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  targetSizeInput.addEventListener('change', (e) => setTargetSize(e.target.value));
  targetSizeSlider.addEventListener('input', (e) => setTargetSize(e.target.value));
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => setTargetSize(btn.dataset.size));
  });

  formatRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) selectedFormat = e.target.value;
    });
  });

  // Dropzone Handlers
  browseBtn.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('click', (e) => {
    if (e.target !== browseBtn) fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) {
      handleFiles(Array.from(e.target.files));
      fileInput.value = '';
    }
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  window.addEventListener('paste', (e) => {
    const pasteFiles = [];
    if (e.clipboardData && e.clipboardData.items) {
      for (const item of e.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) pasteFiles.push(f);
        }
      }
    }
    if (pasteFiles.length > 0) {
      handleFiles(pasteFiles);
      showToast(`Pasted ${pasteFiles.length} image(s) from clipboard.`);
    }
  });

  // Multi-Format Client-Side Canvas Compressor
  async function compressImageClientSide(file, targetKb, formatChoice) {
    const targetBytes = targetKb * 1000;
    const origSize = file.size;
    const fmt = resolveFormat(file.name, file.type, formatChoice);

    // If already under target AND already same format, keep directly
    const isSameFormat = (
      (fmt.ext === '.png' && (file.type === 'image/png' || /\.png$/i.test(file.name))) ||
      (fmt.ext === '.jpg' && (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name))) ||
      (fmt.ext === '.webp' && (file.type === 'image/webp' || /\.webp$/i.test(file.name)))
    );

    if (isSameFormat && origSize <= targetBytes) {
      return { blob: file, size: origSize, wasCompressed: false, ext: fmt.ext, mime: fmt.mime };
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const canvas = document.createElement('canvas');
          const isJpeg = fmt.mime === 'image/jpeg';
          const ctx = canvas.getContext('2d', { alpha: !isJpeg });

          let currentWidth = img.naturalWidth || img.width;
          let currentHeight = img.naturalHeight || img.height;

          // Helper to draw and export
          const testCompression = (w, h, quality, mime) => {
            canvas.width = w;
            canvas.height = h;
            if (isJpeg) {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, w, h);
            } else {
              ctx.clearRect(0, 0, w, h);
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            return new Promise(res => {
              canvas.toBlob(b => res(b), mime, quality);
            });
          };

          let bestBlob = null;
          let actualMime = fmt.mime;

          // --- 1. PNG Compression ---
          if (fmt.mime === 'image/png') {
            // Test full size
            let blob = await testCompression(currentWidth, currentHeight, undefined, 'image/png');
            if (blob && blob.size <= targetBytes) {
              bestBlob = blob;
            } else {
              // Scale down dimensions until PNG size is <= targetBytes
              let scale = 0.9;
              while (scale > 0.15) {
                const testW = Math.max(60, Math.round(currentWidth * scale));
                const testH = Math.max(60, Math.round(currentHeight * scale));
                blob = await testCompression(testW, testH, undefined, 'image/png');
                if (blob && blob.size <= targetBytes) {
                  bestBlob = blob;
                  break;
                }
                scale *= 0.85;
              }
            }
            if (!bestBlob) {
              bestBlob = await testCompression(Math.max(80, Math.round(currentWidth * 0.2)), Math.max(80, Math.round(currentHeight * 0.2)), undefined, 'image/png');
            }
          }

          // --- 2. JPEG / WebP / AVIF Compression ---
          else {
            // Test AVIF capability
            if (fmt.mime === 'image/avif') {
              const testAvif = await testCompression(10, 10, 0.8, 'image/avif');
              if (!testAvif || testAvif.type !== 'image/avif') {
                actualMime = 'image/webp'; // Fallback to WebP if browser canvas doesn't support AVIF export
              }
            }

            // Binary search quality at full resolution
            let low = 0.25;
            let high = 0.95;

            for (let i = 0; i < 6; i++) {
              const mid = (low + high) / 2;
              const blob = await testCompression(currentWidth, currentHeight, mid, actualMime);
              if (blob && blob.size <= targetBytes) {
                bestBlob = blob;
                low = mid;
              } else {
                high = mid;
              }
            }

            // Downscale dimensions if lowest quality is still over target
            if (!bestBlob) {
              let scale = 0.88;
              while (scale > 0.15) {
                const testW = Math.round(currentWidth * scale);
                const testH = Math.round(currentHeight * scale);

                let scaleLow = 0.3;
                let scaleHigh = 0.8;
                let found = null;

                for (let i = 0; i < 4; i++) {
                  const mid = (scaleLow + scaleHigh) / 2;
                  const blob = await testCompression(testW, testH, mid, actualMime);
                  if (blob && blob.size <= targetBytes) {
                    found = blob;
                    scaleLow = mid;
                  } else {
                    scaleHigh = mid;
                  }
                }

                if (found) {
                  bestBlob = found;
                  break;
                }
                scale *= 0.82;
              }
            }

            if (!bestBlob) {
              bestBlob = await testCompression(
                Math.max(100, Math.round(currentWidth * 0.3)),
                Math.max(100, Math.round(currentHeight * 0.3)),
                0.25,
                actualMime
              );
            }
          }

          resolve({
            blob: bestBlob,
            size: bestBlob.size,
            wasCompressed: true,
            ext: fmt.ext,
            mime: actualMime
          });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to read image.'));
      };

      img.src = objectUrl;
    });
  }

  // Handle Files Batch
  async function handleFiles(files) {
    const validFiles = files.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|avif|tiff?)$/i.test(f.name));
    if (validFiles.length === 0) {
      showToast('No supported image files found.');
      return;
    }

    resultsSection.style.display = 'flex';

    for (const file of validFiles) {
      const id = 'row_' + Math.random().toString(36).substring(2, 9);
      const origUrl = URL.createObjectURL(file);

      const item = {
        id,
        name: file.name,
        originalFile: file,
        originalSize: file.size,
        compressedBlob: null,
        compressedSize: 0,
        origUrl,
        compUrl: null,
        wasCompressed: false,
        outputExt: '.jpg',
        status: 'compressing'
      };

      items.push(item);
      renderRow(item);
      updateMetrics();

      try {
        const res = await compressImageClientSide(file, targetSizeKb, selectedFormat);
        item.compressedBlob = res.blob;
        item.compressedSize = res.size;
        item.outputExt = res.ext;
        item.compUrl = URL.createObjectURL(res.blob);
        item.wasCompressed = res.wasCompressed;
        item.status = 'done';
      } catch (err) {
        item.status = 'error';
      }

      updateRow(item);
      updateMetrics();
    }
  }

  // Render Table Row
  function renderRow(item) {
    const tr = document.createElement('tr');
    tr.id = item.id;

    tr.innerHTML = `
      <td>
        <div class="cell-file">
          <img class="table-thumb" id="thumb_${item.id}" src="${item.origUrl}" alt="Preview" title="Click to compare">
          <div class="file-name-wrapper">
            <span class="file-name" title="${item.name}">${item.name}</span>
          </div>
        </div>
      </td>
      <td><span class="mono-num">${formatBytes(item.originalSize)}</span></td>
      <td><span class="mono-num" id="compSize_${item.id}" style="color: var(--text-faint);">Processing...</span></td>
      <td><span class="badge-tag badge-neutral" id="badge_${item.id}">Queued</span></td>
      <td>
        <div class="row-actions" style="justify-content: flex-end;">
          <button type="button" class="btn-table-icon" id="prevBtn_${item.id}" title="Preview Comparison" style="display: none;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button type="button" class="btn-table-icon" id="dlBtn_${item.id}" title="Download File" style="display: none;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      </td>
    `;

    tableBody.appendChild(tr);
  }

  // Update Table Row
  function updateRow(item) {
    const compSizeEl = document.getElementById(`compSize_${item.id}`);
    const badgeEl = document.getElementById(`badge_${item.id}`);
    const prevBtn = document.getElementById(`prevBtn_${item.id}`);
    const dlBtn = document.getElementById(`dlBtn_${item.id}`);
    const thumb = document.getElementById(`thumb_${item.id}`);

    if (item.status === 'done') {
      compSizeEl.textContent = formatBytes(item.compressedSize);
      compSizeEl.style.color = 'var(--text-main)';

      if (item.wasCompressed) {
        const saved = item.originalSize - item.compressedSize;
        const pct = ((saved / item.originalSize) * 100).toFixed(0);
        badgeEl.className = 'badge-tag badge-saved';
        badgeEl.textContent = `-${pct}% (${formatBytes(saved)})`;
      } else {
        badgeEl.className = 'badge-tag badge-neutral';
        badgeEl.textContent = `Already < ${targetSizeKb} KB`;
      }

      prevBtn.style.display = 'inline-flex';
      dlBtn.style.display = 'inline-flex';

      prevBtn.onclick = () => openCompareModal(item);
      thumb.onclick = () => openCompareModal(item);
      dlBtn.onclick = () => downloadSingle(item);
    } else if (item.status === 'error') {
      compSizeEl.textContent = 'Error';
      compSizeEl.style.color = 'var(--danger-text)';
      badgeEl.className = 'badge-tag badge-neutral';
      badgeEl.textContent = 'Failed';
    }
  }

  // Update Metrics
  function updateMetrics() {
    resultsCount.textContent = `Files (${items.length})`;
    statCount.textContent = items.length;

    const totalOrig = items.reduce((sum, i) => sum + (i.originalSize || 0), 0);
    const totalComp = items.reduce((sum, i) => sum + (i.compressedSize || i.originalSize || 0), 0);
    const savedBytes = totalOrig - totalComp;
    const savedPct = totalOrig > 0 ? ((savedBytes / totalOrig) * 100).toFixed(1) : 0;

    statOrigSize.textContent = formatBytes(totalOrig);
    statCompSize.textContent = formatBytes(totalComp);
    statSaved.textContent = `${savedPct}% (${formatBytes(Math.max(0, savedBytes))})`;
  }

  // Single File Download
  function downloadSingle(item) {
    if (!item.compressedBlob) return;
    const link = document.createElement('a');
    let ext = item.outputExt || '.jpg';
    let baseName = item.name.replace(/\.[^/.]+$/, '');
    link.download = `${baseName}_under${targetSizeKb}kb${ext}`;
    link.href = item.compUrl;
    link.click();
  }

  // Batch ZIP Download
  downloadAllBtn.addEventListener('click', async () => {
    const readyItems = items.filter(i => i.status === 'done' && i.compressedBlob);
    if (readyItems.length === 0) {
      showToast('No completed images to download.');
      return;
    }

    if (window.JSZip) {
      const zip = new JSZip();
      showToast('Packaging images into ZIP...');

      readyItems.forEach(item => {
        let ext = item.outputExt || '.jpg';
        let baseName = item.name.replace(/\.[^/.]+$/, '');
        zip.file(`${baseName}_compressed${ext}`, item.compressedBlob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zipBlob);
      link.download = `compressed_images_${targetSizeKb}kb.zip`;
      link.click();
      showToast('ZIP archive downloaded.');
    } else {
      readyItems.forEach((item, index) => {
        setTimeout(() => downloadSingle(item), index * 150);
      });
      showToast('Downloading files sequentially.');
    }
  });

  // Clear All
  clearAllBtn.addEventListener('click', () => {
    items.forEach(item => {
      if (item.origUrl) URL.revokeObjectURL(item.origUrl);
      if (item.compUrl) URL.revokeObjectURL(item.compUrl);
    });
    items.length = 0;
    tableBody.innerHTML = '';
    resultsSection.style.display = 'none';
    showToast('List cleared.');
  });

  // Comparison Modal
  function openCompareModal(item) {
    modalTitle.textContent = item.name;
    modalOrigImg.src = item.origUrl;
    modalCompImg.src = item.compUrl || item.origUrl;
    modalOrigSize.textContent = formatBytes(item.originalSize);
    modalCompSize.textContent = formatBytes(item.compressedSize);
    modalTargetLabel.textContent = `${targetSizeKb}`;
    compareModal.classList.add('open');
  }

  closeModalBtn.addEventListener('click', () => compareModal.classList.remove('open'));
  compareModal.addEventListener('click', (e) => {
    if (e.target === compareModal) compareModal.classList.remove('open');
  });

  // Local Folder Processing
  runLocalBatchBtn.addEventListener('click', async () => {
    if (!isServerConnected) {
      alert('To process files from a local disk folder directly, run "launch_dashboard.bat" or "py server.py".\n\nAlternatively, you can drag and drop your images into the "Upload Files" tab.');
      return;
    }

    runLocalBatchBtn.disabled = true;
    runLocalBatchBtn.textContent = 'Compressing Directory...';

    try {
      const res = await fetch('/api/compress-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_kb: targetSizeKb, format: selectedFormat })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Compressed ${data.compressed_count} images successfully.`);
        alert(`Batch compression complete!\n\nFormat: ${selectedFormat.toUpperCase()}\n${data.total_images} images processed:\n• ${data.compressed_count} compressed\n• ${data.skipped_count} already under ${targetSizeKb} KB\n• Total space saved: ${data.saved_formatted} (${data.saved_pct}%)\n\nSaved to:\n${data.output_dir}`);
      } else {
        showToast('Error during batch compression.');
      }
    } catch (e) {
      showToast('Failed to connect to local compression API.');
    } finally {
      runLocalBatchBtn.disabled = false;
      runLocalBatchBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        Run Batch Compression on Directory
      `;
    }
  });

  // Init
  checkServer();
})();
