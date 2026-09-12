/**
 * Smart Image Compressor - Application Controller & Analytics Engine
 * Backed by SQLite database telemetry, multi-format compression,
 * application profiles, dimensional limits, and CSV export.
 */

(() => {
  'use strict';

  // State
  let targetSizeKb = 500;
  let selectedFormat = 'auto'; // 'auto', 'png', 'jpeg', 'webp', 'avif'
  const items = [];
  let isServerConnected = false;

  // Header & Server Status
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  // Mode Switcher
  const modeUploadBtn = document.getElementById('modeUploadBtn');
  const modeFolderBtn = document.getElementById('modeFolderBtn');
  const uploadView = document.getElementById('uploadView');
  const localFolderView = document.getElementById('localFolderView');

  // Profiles & Controls
  const profileBtns = document.querySelectorAll('.profile-btn');
  const targetSizeInput = document.getElementById('targetSizeInput');
  const targetSizeSlider = document.getElementById('targetSizeSlider');
  const presetBtns = document.querySelectorAll('.preset-btn');
  const maxWidthInput = document.getElementById('maxWidthInput');
  const maxHeightInput = document.getElementById('maxHeightInput');
  const formatRadios = document.querySelectorAll('input[name="formatOption"]');

  // Theme Toggle & PWA Controls
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIconSun = document.getElementById('themeIconSun');
  const themeIconMoon = document.getElementById('themeIconMoon');
  const pwaInstallBtn = document.getElementById('pwaInstallBtn');
  let deferredPwaPrompt = null;

  // Custom Profile Presets
  const openAddProfileBtn = document.getElementById('openAddProfileBtn');
  const customProfileModal = document.getElementById('customProfileModal');
  const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
  const cancelProfileModalBtn = document.getElementById('cancelProfileModalBtn');
  const customProfileForm = document.getElementById('customProfileForm');
  const customProfilesList = document.getElementById('customProfilesList');
  const cpNameInput = document.getElementById('cpNameInput');
  const cpSizeInput = document.getElementById('cpSizeInput');
  const cpFormatSelect = document.getElementById('cpFormatSelect');
  const cpWidthInput = document.getElementById('cpWidthInput');
  const cpHeightInput = document.getElementById('cpHeightInput');

  // Dropzone & File/Folder Inputs
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const folderInput = document.getElementById('folderInput');
  const browseBtn = document.getElementById('browseBtn');
  const browseFolderBtn = document.getElementById('browseFolderBtn');

  // Renaming & Privacy Controls
  const namingPatternInput = document.getElementById('namingPatternInput');
  const namingChips = document.querySelectorAll('.naming-chip');
  const stripExifToggle = document.getElementById('stripExifToggle');
  const stripExifPill = document.getElementById('stripExifPill');

  // Watermark Elements
  const enableWatermarkCheck = document.getElementById('enableWatermarkCheck');
  const watermarkControls = document.getElementById('watermarkControls');
  const watermarkTextInput = document.getElementById('watermarkTextInput');
  const watermarkPositionSelect = document.getElementById('watermarkPositionSelect');
  const watermarkOpacitySlider = document.getElementById('watermarkOpacitySlider');
  const wmOpacityVal = document.getElementById('wmOpacityVal');

  // Sidebar Accordions & Summary Pills
  const toggleAllAccordionBtn = document.getElementById('toggleAllAccordionBtn');
  const accordions = document.querySelectorAll('.sidebar-accordion');
  const pillMode = document.getElementById('pillMode');
  const pillProfile = document.getElementById('pillProfile');
  const pillSize = document.getElementById('pillSize');
  const pillDims = document.getElementById('pillDims');
  const pillFormat = document.getElementById('pillFormat');
  const pillNaming = document.getElementById('pillNaming');
  const pillPrivacy = document.getElementById('pillPrivacy');
  const pillWatermark = document.getElementById('pillWatermark');

  // Convert Banner & Action Buttons
  const convertBanner = document.getElementById('convertBanner');
  const bannerTitle = document.getElementById('bannerTitle');
  const bannerSubtitle = document.getElementById('bannerSubtitle');
  const bannerTargetKb = document.getElementById('bannerTargetKb');
  const bannerConvertBtn = document.getElementById('bannerConvertBtn');
  const bannerConvertBtnText = document.getElementById('bannerConvertBtnText');
  const convertAllBtn = document.getElementById('convertAllBtn');
  const convertAllBtnText = document.getElementById('convertAllBtnText');

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
  const exportPdfBtn = document.getElementById('exportPdfBtn');
  const runLocalBatchBtn = document.getElementById('runLocalBatchBtn');

  // Curtain Diff Comparison Modal
  const compareModal = document.getElementById('compareModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const modalTitle = document.getElementById('modalTitle');
  const modalCurtainModeBtn = document.getElementById('modalCurtainModeBtn');
  const modalSideModeBtn = document.getElementById('modalSideModeBtn');
  const modalZoomFitBtn = document.getElementById('modalZoomFitBtn');
  const modalZoom1xBtn = document.getElementById('modalZoom1xBtn');
  const modalZoom2xBtn = document.getElementById('modalZoom2xBtn');

  const curtainViewportWrap = document.getElementById('curtainViewportWrap');
  const curtainViewport = document.getElementById('curtainViewport');
  const curtainOrigImg = document.getElementById('curtainOrigImg');
  const curtainCompImg = document.getElementById('curtainCompImg');
  const curtainClippedWrap = document.getElementById('curtainClippedWrap');
  const curtainDivider = document.getElementById('curtainDivider');
  const curtainHandle = document.getElementById('curtainHandle');
  const curtainOrigSize = document.getElementById('curtainOrigSize');
  const curtainCompSize = document.getElementById('curtainCompSize');
  const curtainExifBadge = document.getElementById('curtainExifBadge');
  const curtainDimsInfo = document.getElementById('curtainDimsInfo');
  const sideBySideWrap = document.getElementById('sideBySideWrap');
  const modalOrigImg = document.getElementById('modalOrigImg');
  const modalCompImg = document.getElementById('modalCompImg');
  const modalOrigSize = document.getElementById('modalOrigSize');
  const modalCompSize = document.getElementById('modalCompSize');

  // PDF Modal Elements
  const pdfModal = document.getElementById('pdfModal');
  const closePdfModalBtn = document.getElementById('closePdfModalBtn');
  const pdfPageFormatSelect = document.getElementById('pdfPageFormatSelect');
  const pdfTargetSizeSelect = document.getElementById('pdfTargetSizeSelect');
  const generatePdfBtn = document.getElementById('generatePdfBtn');

  // SSIM and PSNR Quality Metric Elements
  const ssimBadge = document.getElementById('ssimBadge');
  const psnrBadge = document.getElementById('psnrBadge');

  // Interactive Crop & Rotate Elements
  const cropModal = document.getElementById('cropModal');
  const closeCropModalBtn = document.getElementById('closeCropModalBtn');
  const cancelCropBtn = document.getElementById('cancelCropBtn');
  const applyCropBtn = document.getElementById('applyCropBtn');
  const cropCanvasWrapper = document.getElementById('cropCanvasWrapper');
  const cropCanvas = document.getElementById('cropCanvas');
  const cropBox = document.getElementById('cropBox');
  const cropFileName = document.getElementById('cropFileName');
  const cropSelectionDims = document.getElementById('cropSelectionDims');
  const cropRotateLeftBtn = document.getElementById('cropRotateLeftBtn');
  const cropRotateRightBtn = document.getElementById('cropRotateRightBtn');
  const cropFlipHBtn = document.getElementById('cropFlipHBtn');
  const cropResetBtn = document.getElementById('cropResetBtn');
  const cropRatioBtns = document.querySelectorAll('#cropRatioGroup .crop-btn');

  // Preset Export / Import Elements
  const exportPresetsBtn = document.getElementById('exportPresetsBtn');
  const importPresetsBtn = document.getElementById('importPresetsBtn');
  const importPresetsInput = document.getElementById('importPresetsInput');

  // Mobile Connect Modal Elements
  const mobileConnectBtn = document.getElementById('mobileConnectBtn');
  const mobileConnectModal = document.getElementById('mobileConnectModal');
  const closeMobileConnectModalBtn = document.getElementById('closeMobileConnectModalBtn');
  const qrCodeContainer = document.getElementById('qrCodeContainer');
  const mobileConnectUrl = document.getElementById('mobileConnectUrl');
  const copyMobileUrlBtn = document.getElementById('copyMobileUrlBtn');

  const toastShelf = document.getElementById('toastShelf');

  // Format Colors for Charts
  const FORMAT_COLORS = {
    PNG: '#22c55e',
    JPEG: '#3b82f6',
    JPG: '#3b82f6',
    WEBP: '#06b6d4',
    AVIF: '#a855f7',
    OTHER: '#64748b'
  };

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
    if (!bytes || isNaN(bytes)) return '0 B';
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

  // --- Accordion Setup & Controls ---
  accordions.forEach(acc => {
    const header = acc.querySelector('.accordion-header');
    if (header) {
      header.addEventListener('click', () => {
        const isOpen = acc.classList.contains('is-open');
        acc.classList.toggle('is-open', !isOpen);
        header.setAttribute('aria-expanded', String(!isOpen));
      });
    }
  });

  if (toggleAllAccordionBtn) {
    toggleAllAccordionBtn.addEventListener('click', () => {
      const openCount = document.querySelectorAll('.sidebar-accordion.is-open').length;
      const shouldOpen = openCount < accordions.length / 2;
      accordions.forEach(acc => {
        acc.classList.toggle('is-open', shouldOpen);
        const header = acc.querySelector('.accordion-header');
        if (header) header.setAttribute('aria-expanded', String(shouldOpen));
      });
      toggleAllAccordionBtn.textContent = shouldOpen ? 'Collapse All' : 'Expand All';
    });
  }

  // Processing Mode Switch (Upload vs Local Folder - safe fallback)
  if (modeUploadBtn && modeFolderBtn) {
    modeUploadBtn.addEventListener('click', () => {
      modeUploadBtn.classList.add('active');
      modeFolderBtn.classList.remove('active');
      uploadView.style.display = 'block';
      if (localFolderView) localFolderView.style.display = 'none';
      if (pillMode) pillMode.textContent = 'Upload Files';
    });

    modeFolderBtn.addEventListener('click', () => {
      modeFolderBtn.classList.add('active');
      modeUploadBtn.classList.remove('active');
      uploadView.style.display = 'none';
      if (localFolderView) localFolderView.style.display = 'block';
      if (pillMode) pillMode.textContent = 'Local Folder';
    });
  }

  // Preset Profile Buttons
  profileBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      profileBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const size = parseInt(btn.dataset.size, 10);
      const fmt = btn.dataset.format;

      setTargetSize(size);

      // Update format radio
      formatRadios.forEach(radio => {
        if (radio.value === fmt) {
          radio.checked = true;
          selectedFormat = fmt;
          if (pillFormat) pillFormat.textContent = fmt.toUpperCase();
        }
      });

      const profileName = btn.querySelector('span').textContent;
      if (pillProfile) pillProfile.textContent = profileName.split(' ')[0];
      showToast(`Applied "${profileName}" profile`);
    });
  });

  // --- Theme Switcher Logic ---
  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if (themeIconSun) themeIconSun.style.display = 'none';
      if (themeIconMoon) themeIconMoon.style.display = 'block';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (themeIconSun) themeIconSun.style.display = 'block';
      if (themeIconMoon) themeIconMoon.style.display = 'none';
    }
    localStorage.setItem('smart_compressor_theme', theme);
  }

  const savedTheme = localStorage.getItem('smart_compressor_theme') ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const newTheme = isLight ? 'dark' : 'light';
      applyTheme(newTheme);
      showToast(`Switched to ${newTheme} theme`);
    });
  }

  // --- Service Worker & PWA Install Support ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('ServiceWorker registration error:', err);
      });
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    if (pwaInstallBtn) pwaInstallBtn.style.display = 'inline-flex';
  });

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener('click', async () => {
      if (!deferredPwaPrompt) return;
      deferredPwaPrompt.prompt();
      const choice = await deferredPwaPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        showToast('Thank you for installing Smart Image Compressor!');
      }
      deferredPwaPrompt = null;
      pwaInstallBtn.style.display = 'none';
    });
  }

  // --- Custom Profiles Manager ---
  function getCustomProfiles() {
    try {
      return JSON.parse(localStorage.getItem('custom_compression_profiles')) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomProfiles(profiles) {
    localStorage.setItem('custom_compression_profiles', JSON.stringify(profiles));
  }

  function renderCustomProfiles() {
    if (!customProfilesList) return;
    customProfilesList.innerHTML = '';
    const profiles = getCustomProfiles();

    profiles.forEach(p => {
      const wrap = document.createElement('div');
      wrap.className = 'profile-btn-custom-wrap';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'profile-btn is-custom';
      btn.dataset.id = p.id;
      btn.innerHTML = `
        <span>${p.name}</span>
        <span class="profile-tag">&lt; ${p.size} KB</span>
      `;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        setTargetSize(p.size);

        maxWidthInput.value = p.width || '';
        maxHeightInput.value = p.height || '';
        updateDimsPill();

        const fmt = p.format || 'auto';
        formatRadios.forEach(radio => {
          if (radio.value === fmt) {
            radio.checked = true;
            selectedFormat = fmt;
            if (pillFormat) pillFormat.textContent = fmt === 'auto' ? 'Auto' : fmt.toUpperCase();
          }
        });

        if (pillProfile) pillProfile.textContent = p.name.split(' ')[0];
        showToast(`Applied custom profile "${p.name}"`);
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-delete-preset';
      delBtn.title = 'Delete custom preset';
      delBtn.innerHTML = '&times;';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const updated = getCustomProfiles().filter(item => item.id !== p.id);
        saveCustomProfiles(updated);
        renderCustomProfiles();
        showToast(`Deleted custom profile "${p.name}"`);
      });

      wrap.appendChild(btn);
      wrap.appendChild(delBtn);
      customProfilesList.appendChild(wrap);
    });
  }

  if (openAddProfileBtn && customProfileModal) {
    const closeProfileModal = () => {
      customProfileModal.style.display = 'none';
    };

    openAddProfileBtn.addEventListener('click', () => {
      customProfileModal.style.display = 'flex';
      cpNameInput.value = '';
      cpSizeInput.value = targetSizeKb || 250;
      cpFormatSelect.value = selectedFormat || 'auto';
      cpWidthInput.value = maxWidthInput.value || '';
      cpHeightInput.value = maxHeightInput.value || '';
    });

    if (closeProfileModalBtn) closeProfileModalBtn.addEventListener('click', closeProfileModal);
    if (cancelProfileModalBtn) cancelProfileModalBtn.addEventListener('click', closeProfileModal);

    customProfileModal.addEventListener('click', (e) => {
      if (e.target === customProfileModal) closeProfileModal();
    });

    if (customProfileForm) {
      customProfileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = cpNameInput.value.trim();
        const size = parseInt(cpSizeInput.value, 10);
        if (!name || isNaN(size)) return;

        const newProfile = {
          id: 'cp_' + Date.now(),
          name,
          size,
          format: cpFormatSelect.value,
          width: cpWidthInput.value ? parseInt(cpWidthInput.value, 10) : null,
          height: cpHeightInput.value ? parseInt(cpHeightInput.value, 10) : null
        };

        const profiles = getCustomProfiles();
        profiles.push(newProfile);
        saveCustomProfiles(profiles);
        renderCustomProfiles();
        closeProfileModal();
        showToast(`Saved custom profile "${name}"`);
      });
    }
  }

  renderCustomProfiles();

  // --- Preset Export & Import ---
  if (exportPresetsBtn) {
    exportPresetsBtn.addEventListener('click', () => {
      const profiles = getCustomProfiles();
      const exportData = {
        app: 'SmartImageCompressor',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        currentSettings: {
          targetSizeKb,
          selectedFormat,
          maxWidth: maxWidthInput ? maxWidthInput.value : '',
          maxHeight: maxHeightInput ? maxHeightInput.value : ''
        },
        profiles
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `compression_presets_${Date.now()}.json`;
      link.click();
      showToast(`Exported ${profiles.length} preset(s) to JSON.`);
    });
  }

  if (importPresetsBtn && importPresetsInput) {
    importPresetsBtn.addEventListener('click', () => {
      importPresetsInput.value = '';
      importPresetsInput.click();
    });

    importPresetsInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          const incomingProfiles = Array.isArray(parsed) ? parsed : (parsed.profiles || []);
          if (!Array.isArray(incomingProfiles) || incomingProfiles.length === 0) {
            showToast('No valid presets found in JSON file.');
            return;
          }

          const currentProfiles = getCustomProfiles();
          let addedCount = 0;

          incomingProfiles.forEach(p => {
            if (p && p.name && p.size) {
              const profileObj = {
                id: p.id || ('cp_' + Math.random().toString(36).substring(2, 9)),
                name: String(p.name).trim(),
                size: parseInt(p.size, 10),
                format: p.format || 'auto',
                width: p.width ? parseInt(p.width, 10) : null,
                height: p.height ? parseInt(p.height, 10) : null
              };
              const exists = currentProfiles.some(cp => cp.name.toLowerCase() === profileObj.name.toLowerCase());
              if (!exists) {
                currentProfiles.push(profileObj);
                addedCount++;
              }
            }
          });

          if (addedCount > 0) {
            saveCustomProfiles(currentProfiles);
            renderCustomProfiles();
            showToast(`Imported ${addedCount} new preset(s)!`);
          } else {
            showToast('All presets from file are already present.');
          }
        } catch (err) {
          console.error('Preset import error:', err);
          showToast('Failed to parse preset JSON file.');
        }
      };
      reader.readAsText(file);
    });
  }

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

    if (pillSize) pillSize.textContent = `${targetSizeKb} KB`;

    // Update pending rows display
    items.filter(i => i.status === 'pending').forEach(i => {
      const el = document.getElementById(`compSize_${i.id}`);
      if (el) el.textContent = `Ready (≤ ${targetSizeKb} KB)`;
    });

    updateConvertUI();
  }

  targetSizeInput.addEventListener('change', (e) => setTargetSize(e.target.value));
  targetSizeSlider.addEventListener('input', (e) => setTargetSize(e.target.value));
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => setTargetSize(btn.dataset.size));
  });

  // Dimensional Limits
  function updateDimsPill() {
    const w = maxWidthInput.value;
    const h = maxHeightInput.value;
    if (pillDims) {
      if (w || h) pillDims.textContent = `${w || 'auto'}×${h || 'auto'}`;
      else pillDims.textContent = 'Original';
    }
  }
  maxWidthInput.addEventListener('input', updateDimsPill);
  maxHeightInput.addEventListener('input', updateDimsPill);

  // Format Selector
  formatRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedFormat = e.target.value;
        if (pillFormat) pillFormat.textContent = selectedFormat === 'auto' ? 'Auto' : selectedFormat.toUpperCase();
      }
    });
  });

  // Renaming Pattern Chips
  namingChips.forEach(chip => {
    chip.addEventListener('click', () => {
      namingChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      namingPatternInput.value = chip.dataset.pattern;
      if (pillNaming) pillNaming.textContent = chip.textContent;
    });
  });

  if (namingPatternInput) {
    namingPatternInput.addEventListener('input', () => {
      if (pillNaming) pillNaming.textContent = namingPatternInput.value.slice(0, 14);
    });
  }

  // Privacy Shield Toggle
  if (stripExifToggle) {
    stripExifToggle.addEventListener('change', () => {
      const isOn = stripExifToggle.checked;
      if (pillPrivacy) pillPrivacy.textContent = isOn ? 'Strip ON' : 'Strip OFF';
      if (stripExifPill) stripExifPill.classList.toggle('active', isOn);
    });
  }

  // Watermark Accordion & Controls
  if (enableWatermarkCheck) {
    enableWatermarkCheck.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      watermarkControls.style.display = isEnabled ? 'flex' : 'none';
      if (pillWatermark) {
        pillWatermark.textContent = isEnabled ? (watermarkTextInput.value.trim().slice(0, 10) || 'Active') : 'Disabled';
        pillWatermark.classList.toggle('accent', isEnabled);
      }
    });
  }

  if (watermarkTextInput) {
    watermarkTextInput.addEventListener('input', () => {
      if (enableWatermarkCheck && enableWatermarkCheck.checked && pillWatermark) {
        pillWatermark.textContent = watermarkTextInput.value.trim().slice(0, 10) || 'Active';
      }
    });
  }

  if (watermarkOpacitySlider) {
    watermarkOpacitySlider.addEventListener('input', (e) => {
      if (wmOpacityVal) wmOpacityVal.textContent = `${e.target.value}%`;
    });
  }

  // Filename Resolver
  function resolveFileName(template, item, index) {
    let rawTemplate = template || '{name}_min.{ext}';
    let baseName = item.name.replace(/\.[^/.]+$/, '');
    let ext = (item.outputExt || '.jpg').replace(/^\./, '');
    let sizeKb = item.compressedSize ? Math.round(item.compressedSize / 1024) + 'kb' : 'min';
    let dateStr = new Date().toISOString().slice(0, 10);

    if (rawTemplate === 'clean-kebab' || rawTemplate === 'slug') {
      let clean = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return `${clean || 'image'}.${ext}`;
    }

    let result = rawTemplate
      .replace(/\{name\}/g, baseName)
      .replace(/\{ext\}/g, ext)
      .replace(/\{size\}/g, sizeKb)
      .replace(/\{index\}/g, String(index + 1))
      .replace(/\{date\}/g, dateStr);

    result = result.replace(/[<>:"/\\|?*]/g, '_');
    if (!result.toLowerCase().endsWith('.' + ext.toLowerCase())) {
      result += '.' + ext;
    }
    return result;
  }

  // Watermark Renderer on Canvas
  function applyWatermark(ctx, w, h, text, pos, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    const fontSize = Math.max(16, Math.round(Math.min(w, h) * 0.055));
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    if (pos === 'diagonal') {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const stepY = fontSize * 3.5;
      for (let dy of [-stepY, 0, stepY]) {
        ctx.fillText(text, 0, dy);
      }
    } else if (pos === 'center') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2);
    } else if (pos === 'bottom-right') {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(text, w - 20, h - 20);
    } else if (pos === 'bottom-left') {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(text, 20, h - 20);
    } else if (pos === 'top-right') {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(text, w - 20, 20);
    }
    ctx.restore();
  }

  // EXIF Metadata Inspector
  function checkExifPresence(file) {
    return new Promise(resolve => {
      if (!file || !file.type || !file.type.includes('jpeg')) {
        resolve({ hasExif: false, hasGps: false });
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const view = new DataView(e.target.result);
          if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) {
            resolve({ hasExif: false, hasGps: false });
            return;
          }
          let offset = 2;
          let hasExif = false;
          let hasGps = false;
          while (offset < view.byteLength - 4) {
            const marker = view.getUint16(offset, false);
            if (marker === 0xFFE1) {
              hasExif = true;
              const len = view.getUint16(offset + 2, false);
              const bytes = new Uint8Array(e.target.result, offset + 4, Math.min(len, 200));
              let str = '';
              for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
              if (str.includes('GPS')) hasGps = true;
              break;
            }
            if ((marker & 0xFF00) !== 0xFF00) break;
            const length = view.getUint16(offset + 2, false);
            offset += 2 + length;
          }
          resolve({ hasExif, hasGps });
        } catch (err) {
          resolve({ hasExif: false, hasGps: false });
        }
      };
      reader.onerror = () => resolve({ hasExif: false, hasGps: false });
      reader.readAsArrayBuffer(file.slice(0, 65536));
    });
  }

  // Recursive Directory Traversal with complete batch retrieval
  async function traverseDirectory(entry, path = '') {
    const files = [];
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      file.relativePath = path ? `${path}/${file.name}` : file.name;
      files.push(file);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = [];
      const readBatch = () => new Promise((res, rej) => reader.readEntries(res, rej));
      let batch = await readBatch();
      while (batch && batch.length > 0) {
        entries.push(...batch);
        batch = await readBatch();
      }
      const subPath = path ? `${path}/${entry.name}` : entry.name;
      for (const subEntry of entries) {
        const subFiles = await traverseDirectory(subEntry, subPath);
        files.push(...subFiles);
      }
    }
    return files;
  }

  // Dropzone Handlers
  if (browseBtn) {
    browseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput.value = '';
      fileInput.click();
    });
  }

  if (browseFolderBtn) {
    browseFolderBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      folderInput.value = '';
      folderInput.click();
    });
  }

  dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#browseBtn') || e.target.closest('#browseFolderBtn')) {
      return;
    }
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) {
      handleFiles(Array.from(e.target.files));
      fileInput.value = '';
    }
  });

  folderInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) {
      const list = Array.from(e.target.files);
      list.forEach(f => {
        f.relativePath = f.webkitRelativePath || f.name;
      });
      handleFiles(list);
      folderInput.value = '';
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

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');

    const dt = e.dataTransfer;
    if (!dt) return;

    if (dt.items && dt.items.length) {
      const droppedFiles = [];
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            const entryFiles = await traverseDirectory(entry);
            droppedFiles.push(...entryFiles);
          }
        }
      }
      if (droppedFiles.length) {
        handleFiles(droppedFiles);
        return;
      }
    }

    if (dt.files && dt.files.length) {
      handleFiles(Array.from(dt.files));
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

    const maxW = parseInt(maxWidthInput.value, 10) || null;
    const maxH = parseInt(maxHeightInput.value, 10) || null;

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

          // Apply optional user dimension constraints
          if (maxW && currentWidth > maxW) {
            const aspect = currentHeight / currentWidth;
            currentWidth = maxW;
            currentHeight = Math.round(maxW * aspect);
          }
          if (maxH && currentHeight > maxH) {
            const aspect = currentWidth / currentHeight;
            currentHeight = maxH;
            currentWidth = Math.round(maxH * aspect);
          }

          // If same format and already smaller and no dimension constraint forced
          const isSameFormat = (
            (fmt.ext === '.png' && (file.type === 'image/png' || /\.png$/i.test(file.name))) ||
            (fmt.ext === '.jpg' && (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name))) ||
            (fmt.ext === '.webp' && (file.type === 'image/webp' || /\.webp$/i.test(file.name)))
          );

          const hasWatermark = enableWatermarkCheck && enableWatermarkCheck.checked && watermarkTextInput.value.trim().length > 0;
          const stripExif = stripExifToggle ? stripExifToggle.checked : true;

          if (isSameFormat && origSize <= targetBytes && !maxW && !maxH && !hasWatermark && !stripExif) {
            resolve({ blob: file, size: origSize, wasCompressed: false, ext: fmt.ext, mime: fmt.mime });
            return;
          }

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

            if (hasWatermark) {
              const text = watermarkTextInput.value.trim();
              const pos = watermarkPositionSelect.value;
              const op = (parseInt(watermarkOpacitySlider.value, 10) || 30) / 100;
              applyWatermark(ctx, w, h, text, pos, op);
            }

            return new Promise(res => {
              canvas.toBlob(b => res(b), mime, quality);
            });
          };

          let bestBlob = null;
          let actualMime = fmt.mime;

          // 1. PNG Compression
          if (fmt.mime === 'image/png') {
            let blob = await testCompression(currentWidth, currentHeight, undefined, 'image/png');
            if (blob && blob.size <= targetBytes) {
              bestBlob = blob;
            } else {
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

          // 2. JPEG / WebP / AVIF Compression
          else {
            if (fmt.mime === 'image/avif') {
              const testAvif = await testCompression(10, 10, 0.8, 'image/avif');
              if (!testAvif || testAvif.type !== 'image/avif') {
                actualMime = 'image/webp';
              }
            }

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

  // Handle Files Batch (Two-stage: queue first, convert on user action)
  async function handleFiles(files) {
    const validFiles = files.filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|avif|tiff?|jfif|heic|heif|gif)$/i.test(f.name));
    if (validFiles.length === 0) {
      showToast('No supported image files found in selection.');
      return;
    }

    resultsSection.style.display = 'flex';

    for (const file of validFiles) {
      const id = 'row_' + Math.random().toString(36).substring(2, 9);
      const origUrl = URL.createObjectURL(file);
      const exifInfo = await checkExifPresence(file);

      const item = {
        id,
        name: file.name,
        relativePath: file.relativePath || file.name,
        hasExif: exifInfo.hasExif,
        hasGps: exifInfo.hasGps,
        originalFile: file,
        originalSize: file.size,
        compressedBlob: null,
        compressedSize: 0,
        origUrl,
        compUrl: null,
        wasCompressed: false,
        outputExt: '.jpg',
        status: 'pending' // Queued/Pending - user will choose size and click Convert
      };

      items.push(item);
      renderRow(item);
    }

    updateMetrics();
    updateConvertUI();
    showToast(`Added ${validFiles.length} image(s). Adjust size on left, then click Convert.`);
  }

  // Two-Stage Conversion Orchestration
  let isConverting = false;

  async function convertSingleItem(item) {
    if (isConverting) return;
    item.status = 'compressing';
    updateRow(item);

    try {
      const res = await compressImageClientSide(item.originalFile, targetSizeKb, selectedFormat);
      item.compressedBlob = res.blob;
      item.compressedSize = res.size;
      item.outputExt = res.ext;
      if (item.compUrl) URL.revokeObjectURL(item.compUrl);
      item.compUrl = URL.createObjectURL(res.blob);
      item.wasCompressed = res.wasCompressed;
      item.status = 'done';

      if (isServerConnected) {
        fetch('/api/log-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: item.name,
            original_size: item.originalSize,
            compressed_size: item.compressedSize,
            format: res.ext.replace('.', '').toUpperCase(),
            status: 'success'
          })
        }).catch(() => {});
      }
      showToast(`Compressed "${item.name}"`);
    } catch (err) {
      item.status = 'error';
      showToast(`Compression failed for "${item.name}"`);
    }

    updateRow(item);
    updateMetrics();
    updateConvertUI();
  }

  async function startConversion() {
    if (isConverting) return;
    if (items.length === 0) {
      showToast('No images selected. Please drop or select images first.');
      return;
    }

    const hasPending = items.some(i => i.status === 'pending');
    const queue = hasPending ? items.filter(i => i.status === 'pending') : [...items];

    isConverting = true;
    if (convertAllBtn) convertAllBtn.disabled = true;
    if (bannerConvertBtn) bannerConvertBtn.disabled = true;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (bannerConvertBtnText) bannerConvertBtnText.textContent = `Converting ${i + 1} of ${queue.length}...`;
      if (convertAllBtnText) convertAllBtnText.textContent = `(${i + 1}/${queue.length})...`;

      item.status = 'compressing';
      updateRow(item);

      try {
        const res = await compressImageClientSide(item.originalFile, targetSizeKb, selectedFormat);
        item.compressedBlob = res.blob;
        item.compressedSize = res.size;
        item.outputExt = res.ext;
        if (item.compUrl) URL.revokeObjectURL(item.compUrl);
        item.compUrl = URL.createObjectURL(res.blob);
        item.wasCompressed = res.wasCompressed;
        item.status = 'done';

        if (isServerConnected) {
          fetch('/api/log-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: item.name,
              original_size: item.originalSize,
              compressed_size: item.compressedSize,
              format: res.ext.replace('.', '').toUpperCase(),
              status: 'success'
            })
          }).catch(() => {});
        }
      } catch (err) {
        console.error('Error compressing item:', item.name, err);
        item.status = 'error';
      }

      updateRow(item);
      updateMetrics();
    }

    isConverting = false;
    if (convertAllBtn) convertAllBtn.disabled = false;
    if (bannerConvertBtn) bannerConvertBtn.disabled = false;
    updateConvertUI();
    showToast(`Successfully converted ${queue.length} image(s)!`);
  }

  function updateConvertUI() {
    if (!convertBanner) return;

    if (items.length === 0) {
      convertBanner.style.display = 'none';
      if (downloadAllBtn) downloadAllBtn.disabled = true;
      if (exportPdfBtn) exportPdfBtn.disabled = true;
      if (convertAllBtn) convertAllBtn.disabled = true;
      return;
    }

    convertBanner.style.display = 'flex';
    const pendingCount = items.filter(i => i.status === 'pending').length;
    const doneCount = items.filter(i => i.status === 'done').length;

    if (bannerTargetKb) bannerTargetKb.textContent = `${targetSizeKb} KB`;

    if (pendingCount > 0) {
      if (bannerTitle) bannerTitle.textContent = `${pendingCount} Image${pendingCount > 1 ? 's' : ''} Ready to Convert`;
      if (bannerSubtitle) bannerSubtitle.innerHTML = `Target size: <span class="badge-size-target">${targetSizeKb} KB</span>. Adjust size on the left, then click Convert.`;
      if (bannerConvertBtnText) bannerConvertBtnText.textContent = `Convert All (${targetSizeKb} KB)`;
      if (convertAllBtnText) convertAllBtnText.textContent = `Convert Images (${pendingCount})`;
      if (convertAllBtn) convertAllBtn.disabled = false;
      if (bannerConvertBtn) bannerConvertBtn.disabled = false;
      if (downloadAllBtn) downloadAllBtn.disabled = doneCount === 0;
      if (exportPdfBtn) exportPdfBtn.disabled = doneCount === 0;
    } else if (doneCount > 0) {
      if (bannerTitle) bannerTitle.textContent = `All ${doneCount} Image${doneCount > 1 ? 's' : ''} Converted`;
      if (bannerSubtitle) bannerSubtitle.innerHTML = `Target size: <span class="badge-size-target">${targetSizeKb} KB</span>. Files ready for download, or click below to re-convert with new settings.`;
      if (bannerConvertBtnText) bannerConvertBtnText.textContent = `Re-convert All (${targetSizeKb} KB)`;
      if (convertAllBtnText) convertAllBtnText.textContent = 'Re-convert All';
      if (convertAllBtn) convertAllBtn.disabled = false;
      if (bannerConvertBtn) bannerConvertBtn.disabled = false;
      if (downloadAllBtn) downloadAllBtn.disabled = false;
      if (exportPdfBtn) exportPdfBtn.disabled = false;
    }
  }

  // Render Table Row
  function renderRow(item) {
    const tr = document.createElement('tr');
    tr.id = item.id;

    const folderBadge = item.relativePath && item.relativePath.includes('/')
      ? `<span class="badge-tag badge-neutral" style="font-size: 0.68rem; margin-right: 0.3rem;">📁 ${item.relativePath.substring(0, item.relativePath.lastIndexOf('/') + 1)}</span>`
      : '';

    const exifBadge = item.hasGps
      ? `<span class="badge-tag badge-saved" style="font-size: 0.65rem;" title="GPS location detected and stripped">🛡️ GPS</span>`
      : (item.hasExif ? `<span class="badge-tag badge-neutral" style="font-size: 0.65rem;" title="Camera metadata stripped">🛡️ EXIF</span>` : '');

    tr.innerHTML = `
      <td class="drag-col">
        <span class="drag-handle" title="Drag to reorder pages for PDF export">⋮⋮</span>
      </td>
      <td class="file-col">
        <div class="cell-file">
          <img class="table-thumb" id="thumb_${item.id}" src="${item.origUrl}" alt="Preview" title="Thumbnail">
          <div class="file-name-wrapper">
            <div style="display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap;">
              ${folderBadge}
              <span class="file-name" title="${item.name}">${item.name}</span>
              ${exifBadge}
            </div>
          </div>
        </div>
      </td>
      <td class="orig-col" data-label="Original"><span class="mono-num">${formatBytes(item.originalSize)}</span></td>
      <td class="comp-col" data-label="Target / Output"><span class="mono-num" id="compSize_${item.id}" style="color: var(--text-faint); font-size: 0.8rem;">Ready (&le; ${targetSizeKb} KB)</span></td>
      <td class="status-col" data-label="Status"><span class="badge-tag badge-neutral" id="badge_${item.id}">Ready to Convert</span></td>
      <td class="actions-col">
        <div class="row-actions">
          <button type="button" class="btn-table-icon" id="cropBtn_${item.id}" title="Crop & Rotate Image" style="color: var(--text-muted);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path>
              <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path>
            </svg>
          </button>
          <button type="button" class="btn-table-icon" id="rowConvertBtn_${item.id}" title="Convert this image now" style="color: var(--accent-primary);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
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

    // Row Drag-and-Drop Reordering
    tr.draggable = true;

    tr.addEventListener('dragstart', (e) => {
      tr.classList.add('is-dragging');
      e.dataTransfer.setData('text/plain', item.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    tr.addEventListener('dragend', () => {
      tr.classList.remove('is-dragging');
      tableBody.querySelectorAll('tr').forEach(r => {
        r.classList.remove('drag-over-above', 'drag-over-below');
      });
    });

    tr.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = tr.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) {
        tr.classList.add('drag-over-above');
        tr.classList.remove('drag-over-below');
      } else {
        tr.classList.add('drag-over-below');
        tr.classList.remove('drag-over-above');
      }
    });

    tr.addEventListener('dragleave', () => {
      tr.classList.remove('drag-over-above', 'drag-over-below');
    });

    tr.addEventListener('drop', (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId || draggedId === item.id) return;

      const draggedRow = document.getElementById(draggedId);
      if (!draggedRow) return;

      const isAbove = tr.classList.contains('drag-over-above');
      tr.classList.remove('drag-over-above', 'drag-over-below');

      if (isAbove) {
        tableBody.insertBefore(draggedRow, tr);
      } else {
        tableBody.insertBefore(draggedRow, tr.nextSibling);
      }

      // Sync internal items array order with DOM table order
      const newOrder = [];
      tableBody.querySelectorAll('tr').forEach(row => {
        const found = items.find(i => i.id === row.id);
        if (found) newOrder.push(found);
      });
      items.length = 0;
      items.push(...newOrder);
      showToast('Page order updated for PDF packaging');
    });

    tableBody.appendChild(tr);

    const cropBtn = document.getElementById(`cropBtn_${item.id}`);
    if (cropBtn) {
      cropBtn.addEventListener('click', () => openCropModal(item));
    }

    const rowConvertBtn = document.getElementById(`rowConvertBtn_${item.id}`);
    if (rowConvertBtn) {
      rowConvertBtn.addEventListener('click', () => convertSingleItem(item));
    }
  }

  // Update Table Row
  function updateRow(item) {
    const compSizeEl = document.getElementById(`compSize_${item.id}`);
    const badgeEl = document.getElementById(`badge_${item.id}`);
    const rowConvertBtn = document.getElementById(`rowConvertBtn_${item.id}`);
    const prevBtn = document.getElementById(`prevBtn_${item.id}`);
    const dlBtn = document.getElementById(`dlBtn_${item.id}`);
    const thumb = document.getElementById(`thumb_${item.id}`);

    if (!compSizeEl || !badgeEl) return;

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

      if (rowConvertBtn) rowConvertBtn.style.display = 'none';
      if (prevBtn) prevBtn.style.display = 'inline-flex';
      if (dlBtn) dlBtn.style.display = 'inline-flex';

      if (prevBtn) prevBtn.onclick = () => openCompareModal(item);
      if (thumb) {
        thumb.onclick = () => openCompareModal(item);
        thumb.style.cursor = 'pointer';
      }
      if (dlBtn) dlBtn.onclick = () => downloadSingle(item);

    } else if (item.status === 'compressing') {
      compSizeEl.textContent = 'Compressing...';
      compSizeEl.style.color = 'var(--accent-text)';
      badgeEl.className = 'badge-tag badge-neutral';
      badgeEl.textContent = 'In Progress...';
      if (rowConvertBtn) rowConvertBtn.style.display = 'none';
      if (prevBtn) prevBtn.style.display = 'none';
      if (dlBtn) dlBtn.style.display = 'none';

    } else if (item.status === 'pending') {
      compSizeEl.textContent = `Ready (≤ ${targetSizeKb} KB)`;
      compSizeEl.style.color = 'var(--text-faint)';
      badgeEl.className = 'badge-tag badge-neutral';
      badgeEl.textContent = 'Ready to Convert';
      if (rowConvertBtn) rowConvertBtn.style.display = 'inline-flex';
      if (prevBtn) prevBtn.style.display = 'none';
      if (dlBtn) dlBtn.style.display = 'none';
      if (thumb) {
        thumb.onclick = null;
        thumb.style.cursor = 'default';
      }

    } else if (item.status === 'error') {
      compSizeEl.textContent = 'Error';
      compSizeEl.style.color = 'var(--danger-text)';
      badgeEl.className = 'badge-tag badge-error';
      badgeEl.textContent = 'Failed';
      if (rowConvertBtn) rowConvertBtn.style.display = 'inline-flex';
    }
  }

  // Update Metrics
  function updateMetrics() {
    resultsCount.textContent = `Files (${items.length})`;
    statCount.textContent = items.length;

    const totalOrig = items.reduce((sum, i) => sum + (i.originalSize || 0), 0);
    const doneItems = items.filter(i => i.status === 'done');

    statOrigSize.textContent = formatBytes(totalOrig);

    if (doneItems.length > 0) {
      const totalComp = doneItems.reduce((sum, i) => sum + (i.compressedSize || 0), 0);
      const totalOrigDone = doneItems.reduce((sum, i) => sum + (i.originalSize || 0), 0);
      const savedBytes = totalOrigDone - totalComp;
      const savedPct = totalOrigDone > 0 ? ((savedBytes / totalOrigDone) * 100).toFixed(1) : 0;

      statCompSize.textContent = formatBytes(totalComp);
      statSaved.textContent = `${savedPct}% (${formatBytes(Math.max(0, savedBytes))})`;
    } else {
      statCompSize.textContent = `Pending (≤ ${targetSizeKb} KB)`;
      statSaved.textContent = `0%`;
    }
  }

  // Wire Convert Buttons
  if (convertAllBtn) {
    convertAllBtn.addEventListener('click', () => startConversion());
  }
  if (bannerConvertBtn) {
    bannerConvertBtn.addEventListener('click', () => startConversion());
  }

  // Clear All List
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', () => {
      items.forEach(i => {
        if (i.origUrl) URL.revokeObjectURL(i.origUrl);
        if (i.compUrl) URL.revokeObjectURL(i.compUrl);
      });
      items.length = 0;
      tableBody.innerHTML = '';
      resultsSection.style.display = 'none';
      updateMetrics();
      updateConvertUI();
      showToast('Files cleared.');
    });
  }

  // Single File Download
  function downloadSingle(item) {
    if (!item.compressedBlob) return;
    const link = document.createElement('a');
    const index = items.indexOf(item);
    const pattern = namingPatternInput ? namingPatternInput.value.trim() : '{name}_min.{ext}';
    link.download = resolveFileName(pattern, item, index >= 0 ? index : 0);
    link.href = item.compUrl;
    link.click();
  }

  // Batch ZIP Download with Folder Structure Preservation
  downloadAllBtn.addEventListener('click', async () => {
    const readyItems = items.filter(i => i.status === 'done' && i.compressedBlob);
    if (readyItems.length === 0) {
      showToast('No completed images to download.');
      return;
    }

    const pattern = namingPatternInput ? namingPatternInput.value.trim() : '{name}_min.{ext}';

    if (window.JSZip) {
      const zip = new JSZip();
      showToast('Packaging images into ZIP...');

      readyItems.forEach((item, idx) => {
        const resolvedName = resolveFileName(pattern, item, idx);
        let zipPath = resolvedName;
        if (item.relativePath && item.relativePath.includes('/')) {
          const folderPart = item.relativePath.substring(0, item.relativePath.lastIndexOf('/') + 1);
          zipPath = folderPart + resolvedName;
        }
        zip.file(zipPath, item.compressedBlob);
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

  // PDF Document Packaging Modal Handlers
  exportPdfBtn.addEventListener('click', () => {
    const readyItems = items.filter(i => i.status === 'done' && (i.compUrl || i.origUrl));
    if (readyItems.length === 0) {
      showToast('No compressed images available to package into PDF.');
      return;
    }
    pdfModal.classList.add('open');
  });

  closePdfModalBtn.addEventListener('click', () => pdfModal.classList.remove('open'));
  pdfModal.addEventListener('click', (e) => {
    if (e.target === pdfModal) pdfModal.classList.remove('open');
  });

  generatePdfBtn.addEventListener('click', async () => {
    const readyItems = items.filter(i => i.status === 'done' && (i.compUrl || i.origUrl));
    if (readyItems.length === 0) return;

    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert('jsPDF library is still loading. Please try again in a few seconds.');
      return;
    }

    const { jsPDF } = window.jspdf;
    const format = pdfPageFormatSelect.value;
    const progressNotice = document.getElementById('pdfProgressNotice');

    progressNotice.style.display = 'block';
    progressNotice.textContent = `Compiling ${readyItems.length} pages into PDF...`;
    generatePdfBtn.disabled = true;

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: format === 'letter' ? 'letter' : 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      for (let i = 0; i < readyItems.length; i++) {
        if (i > 0) doc.addPage();
        const item = readyItems[i];

        const img = await new Promise((res, rej) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => res(image);
          image.onerror = rej;
          image.src = item.compUrl || item.origUrl;
        });

        const imgRatio = img.width / img.height;
        let renderW = pageWidth - 20;
        let renderH = renderW / imgRatio;

        if (renderH > pageHeight - 20) {
          renderH = pageHeight - 20;
          renderW = renderH * imgRatio;
        }

        const renderX = (pageWidth - renderW) / 2;
        const renderY = (pageHeight - renderH) / 2;

        doc.addImage(img, 'JPEG', renderX, renderY, renderW, renderH, undefined, 'FAST');
        progressNotice.textContent = `Added page ${i + 1} of ${readyItems.length}...`;
      }

      doc.save(`document_package_${readyItems.length}pages.pdf`);
      showToast(`PDF document package created successfully.`);
      pdfModal.classList.remove('open');
    } catch (err) {
      console.error('PDF error:', err);
      showToast('Failed to create PDF document.');
    } finally {
      progressNotice.style.display = 'none';
      generatePdfBtn.disabled = false;
    }
  });

  // Clear All List
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

  // Curtain Diff Comparison Modal Engine
  let isDraggingCurtain = false;

  function updateCurtainPosition(clientX) {
    const rect = curtainViewport.getBoundingClientRect();
    let pos = (clientX - rect.left) / rect.width;
    pos = Math.max(0.01, Math.min(0.99, pos));
    const pct = (pos * 100).toFixed(1);

    curtainDivider.style.left = `${pct}%`;
    curtainClippedWrap.style.clipPath = `polygon(${pct}% 0, 100% 0, 100% 100%, ${pct}% 100%)`;
  }

  curtainViewport.addEventListener('pointerdown', (e) => {
    isDraggingCurtain = true;
    updateCurtainPosition(e.clientX);
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDraggingCurtain) return;
    updateCurtainPosition(e.clientX);
  });

  window.addEventListener('pointerup', () => {
    isDraggingCurtain = false;
  });

  // Keyboard navigation when modal is open
  window.addEventListener('keydown', (e) => {
    if (!compareModal.classList.contains('open')) return;
    const curLeft = parseFloat(curtainDivider.style.left) || 50;
    if (e.key === 'ArrowLeft') {
      const next = Math.max(2, curLeft - 4);
      curtainDivider.style.left = `${next}%`;
      curtainClippedWrap.style.clipPath = `polygon(${next}% 0, 100% 0, 100% 100%, ${next}% 100%)`;
    } else if (e.key === 'ArrowRight') {
      const next = Math.min(98, curLeft + 4);
      curtainDivider.style.left = `${next}%`;
      curtainClippedWrap.style.clipPath = `polygon(${next}% 0, 100% 0, 100% 100%, ${next}% 100%)`;
    } else if (e.key === 'Escape') {
      compareModal.classList.remove('open');
      pdfModal.classList.remove('open');
    }
  });

  // Zoom toggles
  function setCurtainZoom(scale) {
    curtainOrigImg.style.transform = `scale(${scale})`;
    curtainCompImg.style.transform = `scale(${scale})`;

    modalZoomFitBtn.classList.toggle('active', scale === 1);
    modalZoom1xBtn.classList.toggle('active', scale === 1.5);
    modalZoom2xBtn.classList.toggle('active', scale === 2.2);
  }

  modalZoomFitBtn.addEventListener('click', () => setCurtainZoom(1));
  modalZoom1xBtn.addEventListener('click', () => setCurtainZoom(1.5));
  modalZoom2xBtn.addEventListener('click', () => setCurtainZoom(2.2));

  // Modal View Switcher (Curtain Diff vs Side-by-Side)
  modalCurtainModeBtn.addEventListener('click', () => {
    modalCurtainModeBtn.classList.add('active');
    modalSideModeBtn.classList.remove('active');
    curtainViewportWrap.style.display = 'flex';
    sideBySideWrap.style.display = 'none';
  });

  modalSideModeBtn.addEventListener('click', () => {
    modalSideModeBtn.classList.add('active');
    modalCurtainModeBtn.classList.remove('active');
    curtainViewportWrap.style.display = 'none';
    sideBySideWrap.style.display = 'grid';
  });

  function openCompareModal(item) {
    modalTitle.textContent = item.name;

    // Set images
    curtainOrigImg.src = item.origUrl;
    curtainCompImg.src = item.compUrl || item.origUrl;
    modalOrigImg.src = item.origUrl;
    modalCompImg.src = item.compUrl || item.origUrl;

    // Badges & Labels
    curtainOrigSize.textContent = formatBytes(item.originalSize);
    modalOrigSize.textContent = formatBytes(item.originalSize);

    const saved = item.originalSize - (item.compressedSize || item.originalSize);
    const pct = item.originalSize > 0 ? ((saved / item.originalSize) * 100).toFixed(0) : 0;
    const compText = `${formatBytes(item.compressedSize)} (-${pct}%)`;

    curtainCompSize.textContent = compText;
    modalCompSize.textContent = compText;

    // EXIF & Dimension info
    const imgTest = new Image();
    imgTest.onload = () => {
      curtainDimsInfo.textContent = `${imgTest.naturalWidth} × ${imgTest.naturalHeight} px`;
    };
    imgTest.src = item.origUrl;

    if (item.hasGps) {
      curtainExifBadge.textContent = '🛡️ EXIF & GPS Location Stripped';
      curtainExifBadge.className = 'badge-tag badge-saved';
    } else if (item.hasExif) {
      curtainExifBadge.textContent = '🛡️ Camera Metadata Stripped';
      curtainExifBadge.className = 'badge-tag badge-saved';
    } else {
      curtainExifBadge.textContent = '🛡️ Clean File (No EXIF Found)';
      curtainExifBadge.className = 'badge-tag badge-neutral';
    }

    // Calculate SSIM & PSNR visual metrics
    if (ssimBadge && psnrBadge) {
      ssimBadge.textContent = 'SSIM: Calculating...';
      psnrBadge.textContent = 'PSNR: Calculating...';
      ssimBadge.className = 'badge-tag badge-quality';
      psnrBadge.className = 'badge-tag badge-quality';

      const origImgForMetric = new Image();
      const compImgForMetric = new Image();
      origImgForMetric.crossOrigin = 'anonymous';
      compImgForMetric.crossOrigin = 'anonymous';

      Promise.all([
        new Promise(res => { origImgForMetric.onload = () => res(origImgForMetric); origImgForMetric.src = item.origUrl; }),
        new Promise(res => { compImgForMetric.onload = () => res(compImgForMetric); compImgForMetric.src = item.compUrl || item.origUrl; })
      ]).then(([i1, i2]) => calculateSSIMAndPSNR(i1, i2))
        .then(metrics => {
          ssimBadge.textContent = `SSIM: ${metrics.ssim.toFixed(3)}`;
          psnrBadge.textContent = `PSNR: ${metrics.psnr >= 80 ? '>60' : metrics.psnr.toFixed(1)} dB`;

          if (metrics.ssim >= 0.94) ssimBadge.classList.add('high-quality');
          if (metrics.psnr >= 35) psnrBadge.classList.add('high-quality');
        })
        .catch(() => {
          ssimBadge.textContent = 'SSIM: N/A';
          psnrBadge.textContent = 'PSNR: N/A';
        });
    }

    // Reset divider to 50% and zoom to 1
    curtainDivider.style.left = '50%';
    curtainClippedWrap.style.clipPath = 'polygon(50% 0, 100% 0, 100% 100%, 50% 100%)';
    setCurtainZoom(1);

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


  // --- SSIM & PSNR Visual Quality Metric Engine ---
  function calculateSSIMAndPSNR(img1, img2) {
    return new Promise((resolve) => {
      const size = 256;
      const c1 = 6.5025;
      const c2 = 58.5225;

      const canvas1 = document.createElement('canvas');
      canvas1.width = size;
      canvas1.height = size;
      const ctx1 = canvas1.getContext('2d');
      ctx1.drawImage(img1, 0, 0, size, size);
      const data1 = ctx1.getImageData(0, 0, size, size).data;

      const canvas2 = document.createElement('canvas');
      canvas2.width = size;
      canvas2.height = size;
      const ctx2 = canvas2.getContext('2d');
      ctx2.drawImage(img2, 0, 0, size, size);
      const data2 = ctx2.getImageData(0, 0, size, size).data;

      const n = size * size;
      let sum1 = 0, sum2 = 0;
      let sse = 0;

      const lum1 = new Float32Array(n);
      const lum2 = new Float32Array(n);

      for (let i = 0, j = 0; i < data1.length; i += 4, j++) {
        const y1 = 0.299 * data1[i] + 0.587 * data1[i + 1] + 0.114 * data1[i + 2];
        const y2 = 0.299 * data2[i] + 0.587 * data2[i + 1] + 0.114 * data2[i + 2];
        lum1[j] = y1;
        lum2[j] = y2;
        sum1 += y1;
        sum2 += y2;
        const diff = y1 - y2;
        sse += diff * diff;
      }

      const mse = sse / n;
      let psnr = 100;
      if (mse > 0.0001) {
        psnr = 10 * Math.log10((255 * 255) / mse);
      }

      const mean1 = sum1 / n;
      const mean2 = sum2 / n;

      let var1 = 0, var2 = 0, cov = 0;
      for (let j = 0; j < n; j++) {
        const d1 = lum1[j] - mean1;
        const d2 = lum2[j] - mean2;
        var1 += d1 * d1;
        var2 += d2 * d2;
        cov += d1 * d2;
      }

      var1 /= (n - 1);
      var2 /= (n - 1);
      cov /= (n - 1);

      const ssim = ((2 * mean1 * mean2 + c1) * (2 * cov + c2)) /
                   ((mean1 * mean1 + mean2 * mean2 + c1) * (var1 + var2 + c2));

      resolve({
        ssim: Math.max(0, Math.min(1, ssim)),
        psnr: Math.max(0, psnr)
      });
    });
  }

  // --- Standalone Zero-Dependency QR Code Generator ---
  function generateQRCode(text) {
    const textBytes = [];
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code < 128) textBytes.push(code);
      else if (code < 2048) {
        textBytes.push(192 | (code >> 6), 128 | (code & 63));
      } else {
        textBytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
      }
    }

    const vCapL = [0, 17, 32, 53, 78];
    let version = 1;
    while (version <= 4 && textBytes.length > vCapL[version]) {
      version++;
    }
    if (version > 4) version = 4;

    const totalDataBytes = [0, 19, 34, 55, 80][version];
    const ecBytesPerBlock = [0, 7, 10, 15, 20][version];
    const dataBytesCount = totalDataBytes - ecBytesPerBlock;

    const bits = [];
    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >> i) & 1);
      }
    }

    pushBits(4, 4);
    pushBits(textBytes.length, 8);
    for (const b of textBytes) pushBits(b, 8);

    const maxBits = dataBytesCount * 8;
    const termLen = Math.min(4, maxBits - bits.length);
    for (let i = 0; i < termLen; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataBytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      dataBytes.push(b);
    }

    const padBytes = [0xEC, 0x11];
    let padIdx = 0;
    while (dataBytes.length < dataBytesCount) {
      dataBytes.push(padBytes[padIdx % 2]);
      padIdx++;
    }

    const exp = new Uint8Array(512);
    const log = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
      exp[i] = x;
      exp[i + 255] = x;
      log[x] = i;
      x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
    }

    function gfMul(a, b) {
      if (a === 0 || b === 0) return 0;
      return exp[log[a] + log[b]];
    }

    let genPoly = [1];
    for (let i = 0; i < ecBytesPerBlock; i++) {
      const nextPoly = new Array(genPoly.length + 1).fill(0);
      const factor = exp[i];
      for (let j = 0; j < genPoly.length; j++) {
        nextPoly[j] ^= gfMul(genPoly[j], factor);
        nextPoly[j + 1] ^= genPoly[j];
      }
      genPoly = nextPoly;
    }

    const ec = new Array(ecBytesPerBlock).fill(0);
    for (let i = 0; i < dataBytes.length; i++) {
      const lead = dataBytes[i] ^ ec[0];
      ec.shift();
      ec.push(0);
      if (lead !== 0) {
        for (let j = 0; j < ecBytesPerBlock; j++) {
          ec[j] ^= gfMul(genPoly[j], lead);
        }
      }
    }

    const allBytes = dataBytes.concat(ec);
    const size = 17 + 4 * version;
    const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
    const isReserved = Array.from({ length: size }, () => new Array(size).fill(false));

    function setModule(r, c, val, reserved = true) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        matrix[r][c] = val ? 1 : 0;
        if (reserved) isReserved[r][c] = true;
      }
    }

    function drawFinder(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const mr = row + r;
          const mc = col + c;
          if (mr >= 0 && mr < size && mc >= 0 && mc < size) {
            if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
              const isBlack = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
              setModule(mr, mc, isBlack);
            } else {
              setModule(mr, mc, false);
            }
          }
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i++) {
      setModule(6, i, i % 2 === 0);
      setModule(i, 6, i % 2 === 0);
    }

    const alignPos = [0, 0, 18, 22, 26][version];
    if (alignPos > 0) {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isB = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setModule(alignPos + dr, alignPos + dc, isB);
        }
      }
    }

    setModule(4 * version + 9, 8, true);

    for (let i = 0; i < 9; i++) {
      if (!isReserved[8][i]) setModule(8, i, 0);
      if (!isReserved[i][8]) setModule(i, 8, 0);
    }
    for (let i = size - 8; i < size; i++) {
      if (!isReserved[8][i]) setModule(8, i, 0);
    }
    for (let i = size - 7; i < size; i++) {
      if (!isReserved[i][8]) setModule(i, 8, 0);
    }

    const finalBits = [];
    for (const b of allBytes) {
      for (let i = 7; i >= 0; i--) finalBits.push((b >> i) & 1);
    }
    const remainderBitsCount = [0, 0, 7, 7, 7][version] || 0;
    for (let i = 0; i < remainderBitsCount; i++) finalBits.push(0);

    let bitIdx = 0;
    let dir = -1;
    let c = size - 1;

    while (c > 0) {
      if (c === 6) c--;
      for (let step = 0; step < size; step++) {
        const row = dir === -1 ? size - 1 - step : step;
        for (let col = c; col >= c - 1; col--) {
          if (!isReserved[row][col]) {
            let b = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
            if ((row + col) % 2 === 0) b ^= 1;
            matrix[row][col] = b;
          }
        }
      }
      dir = -dir;
      c -= 2;
    }

    const formatInfo = 0x77c4;
    for (let i = 0; i < 15; i++) {
      const bit = (formatInfo >> i) & 1;
      if (i < 6) setModule(8, i, bit, false);
      else if (i === 6) setModule(8, 7, bit, false);
      else if (i === 7) setModule(8, 8, bit, false);
      else if (i === 8) setModule(7, 8, bit, false);
      else setModule(14 - i, 8, bit, false);

      if (i < 8) setModule(size - 1 - i, 8, bit, false);
      else setModule(8, size - 15 + i, bit, false);
    }

    return { size, matrix };
  }

  function renderQRCode(container, text) {
    if (!container) return;
    container.innerHTML = '';
    if (window.QRCode) {
      new QRCode(container, {
        text: text,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    } else {
      // Fallback text if library is still initializing
      container.innerHTML = `<span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">${text}</span>`;
    }
  }

  // --- Interactive Canvas Crop & Rotate Engine ---
  let activeCropItem = null;
  let cropImg = null;
  let cropRotation = 0;
  let cropFlippedH = false;
  let cropAspectRatio = null;
  let cropBoxState = { x: 20, y: 20, w: 200, h: 200 };
  let isDraggingCropBox = false;
  let activeCropHandle = null;
  let dragStartPos = { x: 0, y: 0 };
  let boxStartPos = { x: 0, y: 0, w: 0, h: 0 };

  function openCropModal(item) {
    activeCropItem = item;
    cropRotation = 0;
    cropFlippedH = false;
    cropAspectRatio = null;
    if (cropFileName) cropFileName.textContent = item.name;

    cropRatioBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ratio === 'free');
    });

    cropModal.classList.add('open');
    cropModal.style.display = 'flex';

    cropImg = new Image();
    cropImg.onload = () => {
      initCropCanvasAndBox();
    };
    cropImg.src = item.origUrl;
  }

  function closeCropModal() {
    cropModal.classList.remove('open');
    cropModal.style.display = 'none';
    activeCropItem = null;
    cropImg = null;
  }

  if (closeCropModalBtn) closeCropModalBtn.addEventListener('click', closeCropModal);
  if (cancelCropBtn) cancelCropBtn.addEventListener('click', closeCropModal);
  if (cropModal) {
    cropModal.addEventListener('click', (e) => {
      if (e.target === cropModal) closeCropModal();
    });
  }

  function getTransformedDims(naturalW, naturalH, rotation) {
    if (rotation === 90 || rotation === 270) {
      return { w: naturalH, h: naturalW };
    }
    return { w: naturalW, h: naturalH };
  }

  function initCropCanvasAndBox() {
    if (!cropImg || !cropCanvasWrapper) return;

    const wrapperRect = cropCanvasWrapper.getBoundingClientRect();
    const maxW = wrapperRect.width > 0 ? wrapperRect.width - 32 : 720;
    const maxH = wrapperRect.height > 0 ? wrapperRect.height - 32 : 440;

    const tDims = getTransformedDims(cropImg.naturalWidth, cropImg.naturalHeight, cropRotation);
    const scale = Math.min(maxW / tDims.w, maxH / tDims.h, 1);

    const canvasW = Math.max(120, Math.round(tDims.w * scale));
    const canvasH = Math.max(120, Math.round(tDims.h * scale));

    cropCanvas.width = canvasW;
    cropCanvas.height = canvasH;

    drawTransformedCropImage();

    let initW = Math.round(canvasW * 0.75);
    let initH = Math.round(canvasH * 0.75);

    if (cropAspectRatio) {
      if (initW / initH > cropAspectRatio) {
        initW = Math.round(initH * cropAspectRatio);
      } else {
        initH = Math.round(initW / cropAspectRatio);
      }
    }

    const initX = Math.round((canvasW - initW) / 2);
    const initY = Math.round((canvasH - initH) / 2);

    cropBoxState = { x: initX, y: initY, w: initW, h: initH };
    updateCropBoxDOM();
  }

  function drawTransformedCropImage() {
    const ctx = cropCanvas.getContext('2d');
    const cw = cropCanvas.width;
    const ch = cropCanvas.height;

    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate((cropRotation * Math.PI) / 180);
    if (cropFlippedH) {
      ctx.scale(-1, 1);
    }

    const isRotated = (cropRotation === 90 || cropRotation === 270);
    const dw = isRotated ? ch : cw;
    const dh = isRotated ? cw : ch;

    ctx.drawImage(cropImg, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  function updateCropBoxDOM() {
    const canvasRect = cropCanvas.getBoundingClientRect();
    const wrapperRect = cropCanvasWrapper.getBoundingClientRect();

    const canvasOffsetX = canvasRect.left - wrapperRect.left;
    const canvasOffsetY = canvasRect.top - wrapperRect.top;

    cropBox.style.left = `${canvasOffsetX + cropBoxState.x}px`;
    cropBox.style.top = `${canvasOffsetY + cropBoxState.y}px`;
    cropBox.style.width = `${cropBoxState.w}px`;
    cropBox.style.height = `${cropBoxState.h}px`;

    if (cropImg && cropCanvas.width > 0) {
      const tDims = getTransformedDims(cropImg.naturalWidth, cropImg.naturalHeight, cropRotation);
      const ratio = tDims.w / cropCanvas.width;
      const realW = Math.round(cropBoxState.w * ratio);
      const realH = Math.round(cropBoxState.h * ratio);
      if (cropSelectionDims) {
        cropSelectionDims.textContent = `${realW} × ${realH} px`;
      }
    }
  }

  if (cropBox) {
    cropBox.addEventListener('pointerdown', (e) => {
      const handle = e.target.getAttribute('data-handle');
      if (handle) {
        activeCropHandle = handle;
      } else {
        isDraggingCropBox = true;
      }
      dragStartPos = { x: e.clientX, y: e.clientY };
      boxStartPos = { ...cropBoxState };
      e.preventDefault();
      e.stopPropagation();
    });
  }

  window.addEventListener('pointermove', (e) => {
    if (!isDraggingCropBox && !activeCropHandle) return;

    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    const cw = cropCanvas.width;
    const ch = cropCanvas.height;

    if (isDraggingCropBox) {
      let newX = Math.max(0, Math.min(cw - boxStartPos.w, boxStartPos.x + dx));
      let newY = Math.max(0, Math.min(ch - boxStartPos.h, boxStartPos.y + dy));
      cropBoxState.x = Math.round(newX);
      cropBoxState.y = Math.round(newY);
      updateCropBoxDOM();
    } else if (activeCropHandle) {
      let x = boxStartPos.x;
      let y = boxStartPos.y;
      let w = boxStartPos.w;
      let h = boxStartPos.h;

      if (activeCropHandle === 'se') {
        w = Math.max(40, Math.min(cw - x, boxStartPos.w + dx));
        if (cropAspectRatio) {
          h = Math.round(w / cropAspectRatio);
          if (y + h > ch) {
            h = ch - y;
            w = Math.round(h * cropAspectRatio);
          }
        } else {
          h = Math.max(40, Math.min(ch - y, boxStartPos.h + dy));
        }
      } else if (activeCropHandle === 'sw') {
        w = Math.max(40, Math.min(boxStartPos.x + boxStartPos.w, boxStartPos.w - dx));
        x = boxStartPos.x + (boxStartPos.w - w);
        if (cropAspectRatio) {
          h = Math.round(w / cropAspectRatio);
          if (y + h > ch) {
            h = ch - y;
            w = Math.round(h * cropAspectRatio);
            x = boxStartPos.x + (boxStartPos.w - w);
          }
        } else {
          h = Math.max(40, Math.min(ch - y, boxStartPos.h + dy));
        }
      } else if (activeCropHandle === 'ne') {
        w = Math.max(40, Math.min(cw - x, boxStartPos.w + dx));
        if (cropAspectRatio) {
          h = Math.round(w / cropAspectRatio);
          y = boxStartPos.y + (boxStartPos.h - h);
          if (y < 0) {
            y = 0;
            h = boxStartPos.y + boxStartPos.h;
            w = Math.round(h * cropAspectRatio);
          }
        } else {
          h = Math.max(40, Math.min(boxStartPos.y + boxStartPos.h, boxStartPos.h - dy));
          y = boxStartPos.y + (boxStartPos.h - h);
        }
      } else if (activeCropHandle === 'nw') {
        w = Math.max(40, Math.min(boxStartPos.x + boxStartPos.w, boxStartPos.w - dx));
        x = boxStartPos.x + (boxStartPos.w - w);
        if (cropAspectRatio) {
          h = Math.round(w / cropAspectRatio);
          y = boxStartPos.y + (boxStartPos.h - h);
          if (y < 0) {
            y = 0;
            h = boxStartPos.y + boxStartPos.h;
            w = Math.round(h * cropAspectRatio);
            x = boxStartPos.x + (boxStartPos.w - w);
          }
        } else {
          h = Math.max(40, Math.min(boxStartPos.y + boxStartPos.h, boxStartPos.h - dy));
          y = boxStartPos.y + (boxStartPos.h - h);
        }
      }

      cropBoxState = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
      updateCropBoxDOM();
    }
  });

  window.addEventListener('pointerup', () => {
    isDraggingCropBox = false;
    activeCropHandle = null;
  });

  cropRatioBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      cropRatioBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const ratioAttr = btn.dataset.ratio;
      if (ratioAttr === '1:1') cropAspectRatio = 1;
      else if (ratioAttr === '35:45') cropAspectRatio = 35 / 45;
      else if (ratioAttr === '4:3') cropAspectRatio = 4 / 3;
      else if (ratioAttr === '16:9') cropAspectRatio = 16 / 9;
      else cropAspectRatio = null;

      initCropCanvasAndBox();
    });
  });

  if (cropRotateLeftBtn) {
    cropRotateLeftBtn.addEventListener('click', () => {
      cropRotation = (cropRotation + 270) % 360;
      initCropCanvasAndBox();
    });
  }

  if (cropRotateRightBtn) {
    cropRotateRightBtn.addEventListener('click', () => {
      cropRotation = (cropRotation + 90) % 360;
      initCropCanvasAndBox();
    });
  }

  if (cropFlipHBtn) {
    cropFlipHBtn.addEventListener('click', () => {
      cropFlippedH = !cropFlippedH;
      drawTransformedCropImage();
    });
  }

  if (cropResetBtn) {
    cropResetBtn.addEventListener('click', () => {
      cropRotation = 0;
      cropFlippedH = false;
      cropAspectRatio = null;
      cropRatioBtns.forEach(b => b.classList.toggle('active', b.dataset.ratio === 'free'));
      initCropCanvasAndBox();
    });
  }

  if (applyCropBtn) {
    applyCropBtn.addEventListener('click', async () => {
      if (!activeCropItem || !cropImg) return;

      applyCropBtn.disabled = true;
      applyCropBtn.textContent = 'Applying...';

      try {
        const tDims = getTransformedDims(cropImg.naturalWidth, cropImg.naturalHeight, cropRotation);
        const scaleX = tDims.w / cropCanvas.width;
        const scaleY = tDims.h / cropCanvas.height;

        const sourceCropX = Math.round(cropBoxState.x * scaleX);
        const sourceCropY = Math.round(cropBoxState.y * scaleY);
        const sourceCropW = Math.round(cropBoxState.w * scaleX);
        const sourceCropH = Math.round(cropBoxState.h * scaleY);

        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = tDims.w;
        fullCanvas.height = tDims.h;
        const fCtx = fullCanvas.getContext('2d');

        fCtx.translate(tDims.w / 2, tDims.h / 2);
        fCtx.rotate((cropRotation * Math.PI) / 180);
        if (cropFlippedH) fCtx.scale(-1, 1);

        const isRotated = (cropRotation === 90 || cropRotation === 270);
        const fw = isRotated ? tDims.h : tDims.w;
        const fh = isRotated ? tDims.w : tDims.h;
        fCtx.drawImage(cropImg, -fw / 2, -fh / 2, fw, fh);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = sourceCropW;
        outCanvas.height = sourceCropH;
        const outCtx = outCanvas.getContext('2d');

        outCtx.drawImage(
          fullCanvas,
          sourceCropX, sourceCropY, sourceCropW, sourceCropH,
          0, 0, sourceCropW, sourceCropH
        );

        const mime = activeCropItem.originalFile.type || 'image/jpeg';
        const croppedBlob = await new Promise(res => outCanvas.toBlob(res, mime, 0.96));

        if (croppedBlob) {
          activeCropItem.originalFile = new File([croppedBlob], activeCropItem.name, { type: croppedBlob.type });
          activeCropItem.originalSize = croppedBlob.size;

          if (activeCropItem.origUrl) URL.revokeObjectURL(activeCropItem.origUrl);
          activeCropItem.origUrl = URL.createObjectURL(croppedBlob);

          const thumb = document.getElementById(`thumb_${activeCropItem.id}`);
          if (thumb) thumb.src = activeCropItem.origUrl;

          if (activeCropItem.status === 'done') {
            activeCropItem.status = 'pending';
            activeCropItem.compressedBlob = null;
            if (activeCropItem.compUrl) URL.revokeObjectURL(activeCropItem.compUrl);
            activeCropItem.compUrl = null;
            updateRow(activeCropItem);
            updateConvertUI();
            showToast(`Cropped "${activeCropItem.name}". Click "Convert" to recompress.`);
          } else {
            updateRow(activeCropItem);
          }

          updateMetrics();
          closeCropModal();
        }
      } catch (err) {
        console.error('Crop application error:', err);
        showToast('Failed to apply crop.');
      } finally {
        applyCropBtn.disabled = false;
        applyCropBtn.textContent = 'Apply Crop';
      }
    });
  }

  // --- Mobile Direct Upload & QR Code Sync Modal Handlers ---
  if (mobileConnectBtn && mobileConnectModal) {
    mobileConnectBtn.addEventListener('click', async () => {
      mobileConnectModal.classList.add('open');
      mobileConnectModal.style.display = 'flex';

      let targetUrl = window.location.href;
      if (isServerConnected) {
        try {
          const res = await fetch('/api/network-info');
          if (res.ok) {
            const data = await res.json();
            if (data.url) targetUrl = data.url;
          }
        } catch (e) {}
      }

      if (mobileConnectUrl) {
        mobileConnectUrl.textContent = targetUrl;
        mobileConnectUrl.href = targetUrl;
      }

      if (qrCodeContainer) {
        renderQRCode(qrCodeContainer, targetUrl);
      }
    });
  }

  if (copyMobileUrlBtn && mobileConnectUrl) {
    copyMobileUrlBtn.addEventListener('click', () => {
      const url = mobileConnectUrl.href || mobileConnectUrl.textContent;
      if (!url) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
          showToast('Link copied to clipboard!');
          copyMobileUrlBtn.textContent = 'Copied!';
          setTimeout(() => { copyMobileUrlBtn.textContent = 'Copy Link'; }, 2000);
        }).catch(() => {
          showToast('Copied: ' + url);
        });
      } else {
        showToast('Link: ' + url);
      }
    });
  }

  if (closeMobileConnectModalBtn && mobileConnectModal) {
    const closeSyncModal = () => {
      mobileConnectModal.classList.remove('open');
      mobileConnectModal.style.display = 'none';
    };
    closeMobileConnectModalBtn.addEventListener('click', closeSyncModal);
    mobileConnectModal.addEventListener('click', (e) => {
      if (e.target === mobileConnectModal) closeSyncModal();
    });
  }

  // Init
  checkServer();
})();
