document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const profileForm = document.getElementById('profile-form');
    const headerStoreName = document.getElementById('header-store-name');
    const statusContainer = document.getElementById('seller-status-container');

    // Get seller ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const sellerId = urlParams.get('id');

    if (!sellerId) {
        alert('No seller ID provided.');
        window.location.href = 'sellers.html';
        return;
    }

    // List of fields to handle
    const fields = [
        'store_name', 'email', 'phone', 'legal_name', 'business_type',
        'gstin', 'pan', 'msme_number', 'address_line1', 'address_line2',
        'city', 'state', 'pincode', 'bank_account_name', 'bank_name',
        'bank_account_number', 'bank_ifsc'
    ];

    // Load seller data
    async function loadProfile() {
        const { data, error } = await client
            .from('sellers')
            .select('*')
            .eq('id', sellerId)
            .single();

        if (error) {
            console.error('Error loading profile:', error);
            alert('Error loading profile details. This seller might not exist or there is a database issue.');
            return;
        }

        if (data) {
            // Update UI headers
            headerStoreName.textContent = data.store_name || 'Seller Profile';
            renderStatus(data.status);

            // Populate form fields
            fields.forEach(field => {
                const element = document.getElementById(field);
                if (element) {
                    element.value = data[field] || '';
                }
            });
        }
    }

    function renderStatus(status) {
        statusContainer.innerHTML = `
            <span class="status-pill ${status}">
                ${status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        `;
    }

    // Form Submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btnSave = document.getElementById('btn-save-profile');
        const originalText = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

        const profileData = {};
        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element && field !== 'email') { // Email is readonly
                profileData[field] = element.value.trim();
            }
        });

        // Basic Validation for Indian context
        if (profileData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(profileData.gstin)) {
            // alert('Invalid GSTIN format.');
            // btnSave.disabled = false;
            // btnSave.innerHTML = originalText;
            // return;
        }

        const { error } = await client
            .from('sellers')
            .update(profileData)
            .eq('id', sellerId);

        if (error) {
            console.error('Error updating profile:', error);
            alert('Error updating profile: ' + error.message + '\n\nNote: If you haven\'t added the new profile columns to your database yet, this update will fail.');
        } else {
            alert('Seller profile updated successfully!');
            loadProfile(); // Refresh
        }

        btnSave.disabled = false;
        btnSave.innerHTML = originalText;
    });

    // Auto-formatting for inputs
    const gstinInput = document.getElementById('gstin');
    if (gstinInput) {
        gstinInput.addEventListener('input', () => {
            gstinInput.value = gstinInput.value.toUpperCase();
        });
    }

    const panInput = document.getElementById('pan');
    if (panInput) {
        panInput.addEventListener('input', () => {
            panInput.value = panInput.value.toUpperCase();
        });
    }

    const ifscInput = document.getElementById('bank_ifsc');
    if (ifscInput) {
        ifscInput.addEventListener('input', () => {
            ifscInput.value = ifscInput.value.toUpperCase();
        });
    }

    const pincodeInput = document.getElementById('pincode');
    if (pincodeInput) {
        pincodeInput.addEventListener('input', () => {
            pincodeInput.value = pincodeInput.value.replace(/\D/g, '').substring(0, 6);
        });
    }

    loadProfile();
});
