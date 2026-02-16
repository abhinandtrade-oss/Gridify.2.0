/**
 * Pricing Settings Management
 */

document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('btn-save-pricing');
    const platformFeeInput = document.getElementById('platformFee');
    const minFeeInput = document.getElementById('minFee');
    const gstRateInput = document.getElementById('gstRate');

    // Preview Elements
    const previewFeePercent = document.getElementById('preview-fee-percent');
    const previewFeeAmount = document.getElementById('preview-fee-amount');
    const previewGstPercent = document.getElementById('preview-gst-percent');
    const previewGstAmount = document.getElementById('preview-gst-amount');
    const previewTotalDeduction = document.getElementById('preview-total-deduction');
    const previewSellerEarnings = document.getElementById('preview-seller-earnings');

    // Load Settings
    async function loadSettings() {
        let settings = {};

        // 1. Try fetching from Supabase
        if (typeof window.supabase !== 'undefined') {
            const client = window.supabase;
            try {
                const { data, error } = await client
                    .from('site_settings')
                    .select('value')
                    .eq('key', 'pricing_config')
                    .maybeSingle();

                if (data && data.value) {
                    // Handle if value is stringified JSON or object
                    settings = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                }
            } catch (err) {
                console.error('Error fetching settings from Supabase:', err);
            }
        }

        // 2. Fallback/Merge with localStorage
        if (Object.keys(settings).length === 0) {
            settings = JSON.parse(localStorage.getItem('glamer_pricing_settings') || '{}');
        }

        platformFeeInput.value = settings.platformFee ?? 0;
        minFeeInput.value = settings.minFee ?? 0;
        gstRateInput.value = settings.gstRate !== undefined ? settings.gstRate : 18;

        updatePreview();
    }

    // Save Settings
    async function saveSettings() {
        const settings = {
            platformFee: parseFloat(platformFeeInput.value) || 0,
            minFee: parseFloat(minFeeInput.value) || 0,
            gstRate: parseFloat(gstRateInput.value) || 0,
            updatedAt: new Date().toISOString()
        };

        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';
        saveBtn.disabled = true;

        try {
            // 1. Save to Supabase
            if (typeof window.supabase !== 'undefined') {
                const client = window.supabase;
                const { error } = await client
                    .from('site_settings')
                    .upsert({
                        key: 'pricing_config',
                        value: settings,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'key' });

                if (error) throw error;
            }

            // 2. Save to LocalStorage
            localStorage.setItem('glamer_pricing_settings', JSON.stringify(settings));

            // Show success message
            saveBtn.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px;"></i> Saved!';
            saveBtn.classList.replace('btn-primary', 'btn-success');

            if (typeof lucide !== 'undefined') lucide.createIcons();

            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.classList.replace('btn-success', 'btn-primary');
                saveBtn.disabled = false;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 2000);

        } catch (err) {
            console.error('Error saving settings:', err);
            alert('Failed to save settings: ' + err.message);

            // Restore button
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
            saveBtn.classList.replace('btn-success', 'btn-primary'); // Ensure class is correct
        }
    }

    // Update Preview Logic
    function updatePreview() {
        const amount = 1000;
        const feePercent = parseFloat(platformFeeInput.value) || 0;
        const minFee = parseFloat(minFeeInput.value) || 0;
        const gstRate = parseFloat(gstRateInput.value) || 0;

        let feeAmount = (amount * feePercent) / 100;
        if (feeAmount < minFee) {
            feeAmount = minFee;
        }

        const gstAmount = (feeAmount * gstRate) / 100;
        const totalDeduction = feeAmount + gstAmount;
        const sellerEarnings = amount - totalDeduction;

        // Update UI
        previewFeePercent.textContent = feePercent;
        previewGstPercent.textContent = gstRate;

        previewFeeAmount.textContent = `₹${feeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        previewGstAmount.textContent = `₹${gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        previewTotalDeduction.textContent = `₹${totalDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        previewSellerEarnings.textContent = `₹${sellerEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }

    // Event Listeners
    saveBtn.addEventListener('click', saveSettings);

    [platformFeeInput, minFeeInput, gstRateInput].forEach(input => {
        input.addEventListener('input', updatePreview);
    });

    // Initialize
    loadSettings();
});
