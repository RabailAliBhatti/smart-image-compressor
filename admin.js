/**
 * Admin Portal Controller
 * Handles password-protected access to SQLite telemetry, analytics,
 * session management, filtering, and CSV export.
 */

(() => {
  'use strict';

  // Auth State
  let adminToken = sessionStorage.getItem('admin_session_token') || null;

  // DOM Elements
  const adminLoginScreen = document.getElementById('adminLoginScreen');
  const adminDashboardScreen = document.getElementById('adminDashboardScreen');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  const loginErrorMsg = document.getElementById('loginErrorMsg');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');

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
  const historyFormatFilter = document.getElementById('historyFormatFilter');
  const historySourceFilter = document.getElementById('historySourceFilter');
  const historyCountLabel = document.getElementById('historyCountLabel');
  const activityTableBody = document.getElementById('activityTableBody');
  const emptyHistoryBox = document.getElementById('emptyHistoryBox');

  const refreshAnalyticsBtn = document.getElementById('refreshAnalyticsBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const toastShelf = document.getElementById('toastShelf');

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
    adminPasswordInput.value = '';
    adminPasswordInput.focus();
  }

  function showDashboardScreen() {
    adminLoginScreen.style.display = 'none';
    adminDashboardScreen.style.display = 'flex';
    adminLogoutBtn.style.display = 'inline-flex';
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
      } else {
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

    try {
      const res = await fetch('/api/analytics', {
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

    try {
      const res = await fetch(`/api/history?search=${search}&format=${fmt}&source=${src}&limit=100`, {
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

  // Search & Filter Events
  let searchTimeout = null;
  historySearchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadHistory, 250);
  });

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
