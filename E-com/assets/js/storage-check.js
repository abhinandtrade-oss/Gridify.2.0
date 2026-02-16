/**
 * Helper to check R2 Storage Limit before uploads
 * Works for both Admin and Public pages
 */
window.checkStorageLimit = async function () {
    const client = window.supabase;
    if (!client) return { allowed: true };

    try {
        // 1. Get Storage Config
        const { data: configData } = await client
            .from('site_settings')
            .select('value')
            .eq('key', 'storage_config')
            .maybeSingle();

        if (!configData || !configData.value) return { allowed: true };

        const config = typeof configData.value === 'string' ? JSON.parse(configData.value) : configData.value;
        if (!config.limitGB || !config.workerUrl) return { allowed: true };

        // 2. Get Current Stats from Worker
        const response = await fetch(`${config.workerUrl.replace(/\/$/, '')}/stats`);
        if (!response.ok) return { allowed: true };

        const stats = await response.json();
        const usedGB = (stats.totalSize || 0) / (1024 * 1024 * 1024);

        if (usedGB >= config.limitGB) {
            return {
                allowed: false,
                message: `Storage limit reached or exceeded. Current usage: ${usedGB.toFixed(2)} GB / ${config.limitGB} GB limit.`
            };
        }

        return { allowed: true };
    } catch (err) {
        console.warn('Storage Check failed:', err);
        return { allowed: true };
    }
};
