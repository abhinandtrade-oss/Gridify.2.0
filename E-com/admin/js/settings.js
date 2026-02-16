/**
 * Settings Management
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const saveBtn = document.getElementById('btn-save-settings');
    const lastUpdatedSpan = document.getElementById('last-updated');

    // Load current settings
    async function loadSettings() {
        // 1. Fetch from Supabase
        if (client) {
            try {
                const { data, error } = await client
                    .from('site_settings')
                    .select('*')
                    .eq('key', 'announcement_config')
                    .single();

                if (data && data.value) {
                    const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                    if (window.setAnnouncementFormData) {
                        window.setAnnouncementFormData(config);
                    }
                    if (data.updated_at) {
                        lastUpdatedSpan.textContent = new Date(data.updated_at).toLocaleString();
                    }
                    return;
                }
            } catch (err) {
                console.warn('Settings: Could not fetch from Supabase, trying local storage.');
            }
        }

        // 2. Fallback to localStorage
        const localData = JSON.parse(localStorage.getItem('glamer_announcement_config') || '{}');
        if (localData.type && window.setAnnouncementFormData) {
            window.setAnnouncementFormData(localData);
            if (localData.updatedAt) {
                lastUpdatedSpan.textContent = new Date(localData.updatedAt).toLocaleString();
            }
        }
    }

    async function saveSettings() {
        if (!window.getAnnouncementFormData) return;

        const config = window.getAnnouncementFormData();
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
        saveBtn.disabled = true;

        try {
            const updatedAt = new Date().toISOString();

            // 1. Save to Supabase
            if (client) {
                const { error } = await client
                    .from('site_settings')
                    .upsert({
                        key: 'announcement_config',
                        value: config,
                        updated_at: updatedAt
                    }, { onConflict: 'key' });

                if (error) throw error;
            }

            // 2. Save to LocalStorage
            config.updatedAt = updatedAt;
            localStorage.setItem('glamer_announcement_config', JSON.stringify(config));

            // Success feedback
            saveBtn.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px;"></i> Saved!';
            saveBtn.classList.replace('btn-primary', 'btn-success');
            if (typeof lucide !== 'undefined') lucide.createIcons();

            lastUpdatedSpan.textContent = new Date(updatedAt).toLocaleString();

            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.classList.replace('btn-success', 'btn-primary');
                saveBtn.disabled = false;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 2000);

        } catch (err) {
            console.error('Error saving settings:', err);
            alert('Failed to save to database. It will be saved locally.');

            config.updatedAt = new Date().toISOString();
            localStorage.setItem('glamer_announcement_config', JSON.stringify(config));

            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }

    await loadSettings();
});
