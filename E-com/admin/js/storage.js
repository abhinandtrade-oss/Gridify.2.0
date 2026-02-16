/**
 * Admin: Storage Management Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;

    // UI Elements
    const storageLimitInput = document.getElementById('storage-limit-input');
    const workerUrlInput = document.getElementById('worker-url-input');
    const btnSaveSettings = document.getElementById('btn-save-storage-settings');
    const btnRefreshStats = document.getElementById('btn-refresh-stats');
    const fileListBody = document.getElementById('file-list-body');
    const fileSearchInput = document.getElementById('file-search');
    const btnLoadMore = document.getElementById('btn-load-more');

    const usageCircle = document.getElementById('usage-circle');
    const usagePercentText = document.getElementById('usage-percent');
    const usedSizeText = document.getElementById('used-size');
    const totalLimitText = document.getElementById('total-limit');
    const fileCountText = document.getElementById('file-count');
    const usageProgressBar = document.getElementById('usage-progress-bar');
    const limitLabel = document.getElementById('limit-label');
    const storageWarning = document.getElementById('storage-warning');
    const warningPercentSpan = document.getElementById('usage-warning-percent');

    let currentConfig = {
        limitGB: 10,
        workerUrl: 'https://review-images-proxy.info-adhil-ecom.workers.dev'
    };

    let allFiles = [];
    let nextCursor = null;

    async function init() {
        await loadConfig();
        await refreshStats();
        await loadFiles();

        lucide.createIcons();
    }

    async function loadConfig() {
        if (!client) return;
        try {
            const { data, error } = await client
                .from('site_settings')
                .select('value')
                .eq('key', 'storage_config')
                .maybeSingle();

            if (data && data.value) {
                currentConfig = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                storageLimitInput.value = currentConfig.limitGB || 10;
                workerUrlInput.value = currentConfig.workerUrl || '';
            }
        } catch (err) {
            console.error('Error loading storage config:', err);
        }
    }

    async function saveConfig() {
        if (!client) return;

        const limitGB = parseFloat(storageLimitInput.value) || 10;
        const workerUrl = workerUrlInput.value.trim().replace(/\/$/, '');

        const newConfig = { limitGB, workerUrl };

        btnSaveSettings.disabled = true;
        btnSaveSettings.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        try {
            const { error } = await client
                .from('site_settings')
                .upsert({
                    key: 'storage_config',
                    value: newConfig,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            currentConfig = newConfig;
            alert('Storage settings saved successfully!');
            await refreshStats();
        } catch (err) {
            console.error('Error saving storage config:', err);
            alert('Failed to save settings: ' + err.message);
        } finally {
            btnSaveSettings.disabled = false;
            btnSaveSettings.innerText = 'Save Storage Settings';
        }
    }

    async function refreshStats() {
        if (!currentConfig.workerUrl) {
            setStats(0, 0);
            return;
        }

        try {
            const response = await fetch(`${currentConfig.workerUrl}/stats`);
            if (!response.ok) throw new Error('Failed to fetch stats');

            const stats = await response.json();
            setStats(stats.totalSize || 0, stats.count || 0);
        } catch (err) {
            console.warn('Could not fetch real-time stats from worker. The worker might not be updated yet.', err);
            // Fallback: estimate or show 0
            setStats(0, 0);
        }
    }

    function setStats(usedBytes, count) {
        const usedGB = usedBytes / (1024 * 1024 * 1024);
        const limitGB = currentConfig.limitGB || 10;
        const percent = Math.min((usedGB / limitGB) * 100, 100).toFixed(1);

        usageCircle.style.setProperty('--percentage', `${percent}%`);
        usagePercentText.innerText = `${percent}%`;
        usedSizeText.innerText = usedBytes > 1024 * 1024 * 1024
            ? `${usedGB.toFixed(2)} GB`
            : `${(usedBytes / (1024 * 1024)).toFixed(2)} MB`;

        totalLimitText.innerText = `${limitGB.toFixed(1)} GB`;
        limitLabel.innerText = `${limitGB.toFixed(1)} GB`;
        fileCountText.innerText = `Total Files: ${count}`;
        usageProgressBar.style.width = `${percent}%`;

        if (percent >= 80) {
            storageWarning.style.display = 'block';
            warningPercentSpan.innerText = percent;
            usageProgressBar.style.backgroundColor = percent >= 95 ? '#ef4444' : '#f59e0b';
        } else {
            storageWarning.style.display = 'none';
        }
    }

    async function loadFiles(cursor = null) {
        if (!currentConfig.workerUrl) {
            fileListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Please set a Worker URL in settings.</td></tr>';
            return;
        }

        try {
            const url = new URL(`${currentConfig.workerUrl}/list`);
            if (cursor) url.searchParams.set('cursor', cursor);

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to list files');

            const data = await response.json();
            const files = data.objects || [];
            nextCursor = data.cursor || null;

            if (cursor) {
                allFiles = [...allFiles, ...files];
            } else {
                allFiles = files;
                fileListBody.innerHTML = '';
            }

            renderFiles(allFiles);
            btnLoadMore.style.display = nextCursor ? 'inline-block' : 'none';

        } catch (err) {
            console.error('Error listing files:', err);
            fileListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Error: Could not connect to Worker. Ensure it supports the /list endpoint.</td></tr>';
        }
    }

    function renderFiles(files) {
        if (files.length === 0) {
            fileListBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No files found.</td></tr>';
            return;
        }

        const searchTerm = fileSearchInput.value.toLowerCase();
        const filtered = files.filter(f => f.key.toLowerCase().includes(searchTerm));

        fileListBody.innerHTML = filtered.map(file => `
            <tr>
                <td>
                    <img src="${currentConfig.workerUrl}?key=${encodeURIComponent(file.key)}" class="file-preview" onerror="this.src='../assets/img/placeholder.png'">
                </td>
                <td class="small fw-medium">${file.key}</td>
                <td class="small">${(file.size / 1024).toFixed(1)} KB</td>
                <td class="small text-muted">${new Date(file.uploaded).toLocaleString()}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-danger btn-delete-file" data-key="${file.key}">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        lucide.createIcons();

        // Attach delete listeners
        document.querySelectorAll('.btn-delete-file').forEach(btn => {
            btn.onclick = () => deleteFile(btn.dataset.key);
        });
    }

    async function deleteFile(key) {
        if (!confirm(`Are you sure you want to delete ${key}?`)) return;

        try {
            const response = await fetch(`${currentConfig.workerUrl}?key=${encodeURIComponent(key)}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('File deleted successfully');
                allFiles = allFiles.filter(f => f.key !== key);
                renderFiles(allFiles);
                refreshStats();
            } else {
                throw new Error('Delete failed');
            }
        } catch (err) {
            alert('Error deleting file: ' + err.message);
        }
    }

    // Event Listeners
    btnSaveSettings.onclick = saveConfig;
    btnRefreshStats.onclick = () => {
        refreshStats();
        loadFiles();
    };
    fileSearchInput.oninput = () => renderFiles(allFiles);
    btnLoadMore.onclick = () => {
        if (nextCursor) loadFiles(nextCursor);
    };

    init();
});
