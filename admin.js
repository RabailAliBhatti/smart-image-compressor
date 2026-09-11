/**
 * Admin Portal Controller
 * Handles password-protected access to SQLite telemetry, analytics,
 * session management, filtering, CSV export, PBKDF2 password updates,
 * brute-force lockout display, and IP blacklist controls.
 */

(() => {
  'use strict';

  // Auth State
  let adminToken = sessionStorage.getItem('admin_session_token') || null;

  // Header Buttons
  const adminSettingsBtn = document.getElementById('adminSettingsBtn');
  const ipAccessBtn = document.getElementById('ipAccessBtn');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');

  // DOM Elements
  const adminLoginScreen = document.getElementById('adminLoginScreen');
  const adminDashboardScreen = document.getElementById('adminDashboardScreen');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');

  // Analytics KPI Elements
  const kpiTotalOps = document.getElementById('kpiTotalOps');
  const kpiTotalSaved = document.getElementById('kpiTotalSaved');
  const kpiOriginalSize = document.getElementById('kpiOriginalSize');
  const kpiAvgPct = document.getElementById('kpiAvgPct');
  const kpiFinalSize = document.getElementById('kpiFinalSize');
  const kpiOverallPct = document.getElementById('kpiOverallPct');
  const kpiUniqueClients = document.getElementById('kpiUniqueClients');

  const formatBarVisual = document.getElementById('formatBarVisual');
  const formatBarLegend = document.getElementById('formatBarLegend');
  const formatSummaryText = document.getElementById('formatSummaryText');

  const historySearchInput = document.getElementById('historySearchInput');
  const historyRangeFilter = document.getElementById('historyRangeFilter');
  const historyFormatFilter = document.getElementById('historyFormatFilter');
  const historySourceFilter = document.getElementById('historySourceFilter');
  const historyCountLabel = document.getElementById('historyCountLabel');
  const activityTableBody = document.getElementById('activityTableBody');
  const emptyHistoryBox = document.getElementById('emptyHistoryBox');

  const refreshAnalyticsBtn = document.getElementById('refreshAnalyticsBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const toastShelf = document.getElementById('toastShelf');

  // Password Modal Elements
  const passwordModal = document.getElementById('passwordModal');
  const closePassModalBtn = document.getElementById('closePassModalBtn');
  const changePassForm = document.getElementById('changePassForm');
  const currentPassInput = document.getElementById('currentPassInput');
  const newPassInput = document.getElementById('newPassInput');
  const confirmPassInput = document.getElementById('confirmPassInput');
  const passErrorMsg = document.getElementById('passErrorMsg');
  const submitPassBtn = document.getElementById('submitPassBtn');

  // IP Access Modal Elements
  const ipModal = document.getElementById('ipModal');
  const closeIpModalBtn = document.getElementById('closeIpModalBtn');
  const manualIpInput = document.getElementById('manualIpInput');
  const blockIpSubmitBtn = document.getElementById('blockIpSubmitBtn');
  const ipTableBody = document.getElementById('ipTableBody');

  const FORMAT_COLORS = {
    PNG: '#22c55e',
    JPEG: '#3b82f6',
    JPG: '#3b82f6',
    WEBP: '#06b6d4',
    AVIF: '#a855f7',
    OTHER: '#64748b'
  };

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

  // --- 1. Authentication Handlers ---

  async function checkAuth() {
    if (!adminToken) {
      showLoginScreen();
      return;
    }

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'X-Admin-Token': adminToken }
      });

      if (res.ok) {
        showDashboardScreen();
        loadAnalytics();
        loadHistory();
      } else {
        adminToken = null;
        sessionStorage.removeItem('admin_session_token');
        showLoginScreen();
      }
    } catch (e) {
      showLoginScreen();
    }
  }

  function showLoginScreen() {
    adminLoginScreen.style.display = 'flex';
    adminDashboardScreen.style.display = 'none';
    adminLogoutBtn.style.display = 'none';
    if (adminSettingsBtn) adminSettingsBtn.style.display = 'none';
    if (ipAccessBtn) ipAccessBtn.style.display = 'none';
    adminPasswordInput.value = '';
    adminPasswordInput.focus();
  }

  function showDashboardScreen() {
    adminLoginScreen.style.display = 'none';
    adminDashboardScreen.style.display = 'flex';
    adminLogoutBtn.style.display = 'inline-flex';
    if (adminSettingsBtn) adminSettingsBtn.style.display = 'inline-flex';
    if (ipAccessBtn) ipAccessBtn.style.display = 'inline-flex';
    loginErrorMsg.style.display = 'none';
  }

  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = adminPasswordInput.value;
    loginErrorMsg.style.display = 'none';
    loginSubmitBtn.disabled = true;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        adminToken = data.token;
        sessionStorage.setItem('admin_session_token', adminToken);
        showDashboardScreen();
        loadAnalytics();
        loadHistory();
        showToast('Admin dashboard unlocked.');
      } else if (res.status === 429) {
        loginErrorMsg.textContent = data.error || 'Too many failed login attempts. IP locked for 15 minutes.';
        loginErrorMsg.style.display = 'block';
      } else {
        loginErrorMsg.textContent = data.error || 'Incorrect admin password. Please try again.';
        loginErrorMsg.style.display = 'block';
        adminPasswordInput.select();
      }
    } catch (err) {
      loginErrorMsg.textContent = 'Server connection failed.';
      loginErrorMsg.style.display = 'block';
    } finally {
      loginSubmitBtn.disabled = false;
    }
  });

  adminLogoutBtn.addEventListener('click', async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { 'X-Admin-Token': adminToken }
        });
      } catch (e) {}
    }
    adminToken = null;
    sessionStorage.removeItem('admin_session_token');
    showLoginScreen();
    showToast('Admin logged out.');
  });

  // --- 2. Analytics & History Loaders ---

  async function loadAnalytics() {
    if (!adminToken) return;

    const range = historyRangeFilter ? encodeURIComponent(historyRangeFilter.value) : 'ALL';
    try {
      const res = await fetch(`/api/analytics?range=${range}`, {
        headers: { 'X-Admin-Token': adminToken }
      });

      if (res.status === 401) {
        showLoginScreen();
        return;
      }

      if (!res.ok) return;
      const data = await res.json();

      kpiTotalOps.textContent = data.total_compressions.toLocaleString();
      kpiTotalSaved.textContent = formatBytes(data.total_saved_bytes);
      kpiOriginalSize.textContent = `${formatBytes(data.total_original_bytes)} original volume`;
      kpiAvgPct.textContent = `${data.avg_saved_percent}%`;
      kpiFinalSize.textContent = formatBytes(data.total_compressed_bytes);
      kpiOverallPct.textContent = `${data.overall_saved_percent}% overall space reduction`;
      kpiUniqueClients.textContent = `${data.unique_clients} client IP${data.unique_clients === 1 ? '' : 's'}`;

      renderFormatBar(data.format_breakdown, data.total_compressions);
    } catch (e) {
      console.error('Failed to load analytics:', e);
    }
  }

  function renderFormatBar(breakdown, total) {
    formatBarVisual.innerHTML = '';
    formatBarLegend.innerHTML = '';

    if (!breakdown || breakdown.length === 0 || total === 0) {
      formatSummaryText.textContent = '0 total files';
      formatBarVisual.innerHTML = '<div class="format-bar-segment" style="width: 100%; background-color: var(--border-base);"></div>';
      formatBarLegend.innerHTML = '<span style="color: var(--text-faint); font-size: 0.78rem;">No activity recorded yet</span>';
      return;
    }

    formatSummaryText.textContent = `${total} total files`;

    breakdown.forEach(item => {
      const pct = ((item.count / total) * 100).toFixed(1);
      const color = FORMAT_COLORS[item.format] || FORMAT_COLORS.OTHER;

      const segment = document.createElement('div');
      segment.className = 'format-bar-segment';
      segment.style.width = `${pct}%`;
      segment.style.backgroundColor = color;
      segment.title = `${item.format}: ${item.count} (${pct}%)`;
      formatBarVisual.appendChild(segment);

      const leg = document.createElement('div');
      leg.className = 'legend-item';
      leg.innerHTML = `
        <span class="legend-color" style="background-color: ${color};"></span>
        <span><strong>${item.format}</strong> ${item.count} (${pct}%)</span>
      `;
      formatBarLegend.appendChild(leg);
    });
  }

  async function loadHistory() {
    if (!adminToken) return;

    const search = encodeURIComponent(historySearchInput.value.trim());
    const fmt = encodeURIComponent(historyFormatFilter.value);
    const src = encodeURIComponent(historySourceFilter.value);
    const range = historyRangeFilter ? encodeURIComponent(historyRangeFilter.value) : 'ALL';

    try {
      const res = await fetch(`/api/history?search=${search}&format=${fmt}&source=${src}&range=${range}&limit=100`, {
        headers: { 'X-Admin-Token': adminToken }
      });

      if (res.status === 401) {
        showLoginScreen();
        return;
      }

      if (!res.ok) return;
      const data = await res.json();

      activityTableBody.innerHTML = '';
      historyCountLabel.textContent = `Showing ${data.logs.length} of ${data.total_count} events`;

      if (!data.logs || data.logs.length === 0) {
        emptyHistoryBox.style.display = 'flex';
        return;
      }

      emptyHistoryBox.style.display = 'none';

      data.logs.forEach(log => {
        const tr = document.createElement('tr');

        const date = new Date(log.timestamp + 'Z');
        const formattedDate = date.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const isSuccess = log.status === 'success';
        const isSkipped = log.status === 'skipped';
        const badgeClass = isSuccess ? 'badge-saved' : (isSkipped ? 'badge-neutral' : 'badge-error');
        const badgeText = isSuccess ? `-${log.saved_percent}%` : (isSkipped ? 'Kept As-Is' : 'Error');

        tr.innerHTML = `
          <td style="color: var(--text-faint); font-size: 0.78rem;">${formattedDate}</td>
          <td style="font-weight: 500;">${log.filename}</td>
          <td><span class="badge-tag badge-neutral" style="font-size: 0.7rem;">${log.source}</span></td>
          <td><span class="mono-num">${formatBytes(log.original_size)}</span></td>
          <td><span class="mono-num">${formatBytes(log.compressed_size)}</span></td>
          <td><span class="badge-tag ${badgeClass}">${badgeText}</span></td>
          <td><span class="mono-num" style="font-weight: 600;">${log.format}</span></td>
          <td style="color: var(--text-faint); font-family: var(--font-mono); font-size: 0.75rem;">${log.client_ip}</td>
          <td style="text-align: right;"><span class="badge-tag ${badgeClass}">${log.status}</span></td>
        `;

        activityTableBody.appendChild(tr);
      });
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  }

  // --- Modal Helpers ---
  function openModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
      modal.classList.add('open');
    });
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('open');
    setTimeout(() => {
      if (!modal.classList.contains('open')) {
        modal.style.display = 'none';
      }
    }, 150);
  }

  // Backdrop click and Escape key listeners
  [passwordModal, ipModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal(passwordModal);
      closeModal(ipModal);
    }
  });

  // --- 3. Password Management Handlers ---

  if (adminSettingsBtn && passwordModal) {
    adminSettingsBtn.addEventListener('click', () => {
      openModal(passwordModal);
      currentPassInput.value = '';
      newPassInput.value = '';
      confirmPassInput.value = '';
      passErrorMsg.style.display = 'none';
      currentPassInput.focus();
    });

    closePassModalBtn.addEventListener('click', () => {
      closeModal(passwordModal);
    });

    changePassForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      passErrorMsg.style.display = 'none';
      const current_password = currentPassInput.value;
      const new_password = newPassInput.value;
      const confirm_password = confirmPassInput.value;

      if (new_password.length < 6) {
        passErrorMsg.textContent = 'New password must be at least 6 characters.';
        passErrorMsg.style.display = 'block';
        return;
      }
      if (new_password !== confirm_password) {
        passErrorMsg.textContent = 'New passwords do not match.';
        passErrorMsg.style.display = 'block';
        return;
      }

      submitPassBtn.disabled = true;
      try {
        const res = await fetch('/api/admin/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': adminToken
          },
          body: JSON.stringify({ current_password, new_password })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast('Master password updated successfully!');
          closeModal(passwordModal);
        } else {
          passErrorMsg.textContent = data.error || 'Failed to update master password.';
          passErrorMsg.style.display = 'block';
        }
      } catch (err) {
        passErrorMsg.textContent = 'Network error while updating password.';
        passErrorMsg.style.display = 'block';
      } finally {
        submitPassBtn.disabled = false;
      }
    });
  }

  // --- 4. IP Access & Blacklist Controls ---

  if (ipAccessBtn && ipModal) {
    ipAccessBtn.addEventListener('click', () => {
      openModal(ipModal);
      manualIpInput.value = '';
      loadIpAccess();
    });

    closeIpModalBtn.addEventListener('click', () => {
      closeModal(ipModal);
    });

    blockIpSubmitBtn.addEventListener('click', async () => {
      const ip = manualIpInput.value.trim();
      if (!ip) {
        showToast('Please enter an IP address.');
        return;
      }
      try {
        const res = await fetch('/api/admin/block-ip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': adminToken
          },
          body: JSON.stringify({ ip, reason: 'Manual block' })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(`IP ${ip} blocked.`);
          manualIpInput.value = '';
          loadIpAccess();
        } else {
          showToast(data.error || 'Failed to block IP.');
        }
      } catch (err) {
        showToast('Network error while blocking IP.');
      }
    });

    ipTableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-ip]');
      if (!btn) return;
      const ip = btn.getAttribute('data-ip');
      const action = btn.getAttribute('data-action');
      if (!ip || !action) return;

      try {
        const endpoint = action === 'block' ? '/api/admin/block-ip' : '/api/admin/unblock-ip';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': adminToken
          },
          body: JSON.stringify({ ip, reason: 'Console management' })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(data.message || `IP ${action}ed successfully.`);
          loadIpAccess();
        } else {
          showToast(data.error || `Failed to ${action} IP.`);
        }
      } catch (err) {
        showToast('Network error while managing IP.');
      }
    });
  }

  async function loadIpAccess() {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/blacklist', {
        headers: { 'X-Admin-Token': adminToken }
      });
      if (!res.ok) return;
      const data = await res.json();
      renderIpTable(data.blacklist || [], data.top_clients || []);
    } catch (e) {
      console.error('Failed to load IP access list:', e);
    }
  }

  function renderIpTable(blacklist, topClients) {
    ipTableBody.innerHTML = '';
    const blockedSet = new Set(blacklist.map(b => b.ip_address));
    const allIps = new Map();

    blacklist.forEach(b => {
      allIps.set(b.ip_address, {
        client_ip: b.ip_address,
        total_ops: '-',
        last_seen: b.created_at,
        is_blocked: true,
        reason: b.reason
      });
    });

    topClients.forEach(c => {
      if (allIps.has(c.client_ip)) {
        const item = allIps.get(c.client_ip);
        item.total_ops = c.total_ops;
        item.last_seen = c.last_seen;
      } else {
        allIps.set(c.client_ip, {
          client_ip: c.client_ip,
          total_ops: c.total_ops,
          last_seen: c.last_seen,
          is_blocked: blockedSet.has(c.client_ip),
          reason: ''
        });
      }
    });

    if (allIps.size === 0) {
      ipTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-faint); padding: 1.5rem;">No client IPs recorded yet.</td></tr>';
      return;
    }

    allIps.forEach(item => {
      const tr = document.createElement('tr');
      const badgeClass = item.is_blocked ? 'badge-error' : 'badge-saved';
      const statusText = item.is_blocked ? 'Blocked' : 'Active';
      const btnClass = item.is_blocked ? 'btn-secondary' : 'btn-danger';
      const btnAction = item.is_blocked ? 'unblock' : 'block';
      const btnLabel = item.is_blocked ? 'Unblock' : 'Block';

      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-weight: 500;">${item.client_ip}</td>
        <td><span class="mono-num">${item.total_ops}</span></td>
        <td style="color: var(--text-faint); font-size: 0.78rem;">${item.last_seen || 'N/A'}</td>
        <td style="text-align: right;">
          <span class="badge-tag ${badgeClass}" style="margin-right: 0.5rem;">${statusText}</span>
          <button type="button" class="${btnClass}" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" data-ip="${item.client_ip}" data-action="${btnAction}">
            ${btnLabel}
          </button>
        </td>
      `;
      ipTableBody.appendChild(tr);
    });
  }

  // --- 5. Search & Filter Events ---

  let searchTimeout = null;
  historySearchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadHistory, 250);
  });

  if (historyRangeFilter) {
    historyRangeFilter.addEventListener('change', () => {
      loadAnalytics();
      loadHistory();
    });
  }
  historyFormatFilter.addEventListener('change', loadHistory);
  historySourceFilter.addEventListener('change', loadHistory);

  refreshAnalyticsBtn.addEventListener('click', () => {
    loadAnalytics();
    loadHistory();
    showToast('Analytics refreshed.');
  });

  // Export CSV
  exportCsvBtn.addEventListener('click', () => {
    if (!adminToken) return;
    window.location.href = `/api/export-history?token=${encodeURIComponent(adminToken)}`;
    showToast('Downloading CSV audit log...');
  });

  // Clear History
  clearHistoryBtn.addEventListener('click', async () => {
    if (!adminToken) return;
    if (!confirm('Are you sure you want to permanently clear all activity logs in the SQLite database?')) {
      return;
    }

    try {
      const res = await fetch('/api/history', {
        method: 'DELETE',
        headers: { 'X-Admin-Token': adminToken }
      });

      if (res.ok) {
        showToast('Activity log cleared.');
        loadAnalytics();
        loadHistory();
      } else {
        showToast('Failed to clear activity log.');
      }
    } catch (e) {
      showToast('Network error while clearing log.');
    }
  });

  // Initial Auth Check
  checkAuth();
})();

