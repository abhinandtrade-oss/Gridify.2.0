/**
 * Marketplace: Shop Profile Management for Sellers
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const profileForm = document.getElementById('shop-profile-form');
    const statusContainer = document.getElementById('seller-status-container');
    const btnSave = document.getElementById('btn-save-profile');
    const emailInput = document.getElementById('email');

    let currentSeller = null;
    let currentUserEmail = null;

    const fields = [
        'store_name', 'email', 'phone', 'legal_name',
        'gstin', 'pan', 'address_line1', 'address_line2',
        'city', 'state', 'pincode', 'bank_account_name',
        'bank_name', 'bank_account_number', 'bank_ifsc'
    ];

    async function init() {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        currentUserEmail = session.user.email;
        if (emailInput) emailInput.value = currentUserEmail;

        // Find seller record by email
        const { data: seller, error } = await client
            .from('sellers')
            .select('*')
            .eq('email', currentUserEmail)
            .maybeSingle();

        if (error) {
            console.error('Error fetching seller:', error);
            return;
        }

        if (seller) {
            currentSeller = seller;
            populateForm(seller);
            renderStatus(seller.status);

            // If seller is active/approved, lock the fields
            if (seller.status === 'active') {
                lockProfile();
            } else {
                alert('Verification Pending: Your seller profile is currently under review. Please contact the administrator for approval.');
            }
        } else {
            // New Seller Onboarding
            renderStatus('new');
            console.log("No seller profile found. Ready for onboarding.");
        }
    }

    function populateForm(data) {
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el) el.value = data[field] || '';
        });
    }

    function lockProfile() {
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el) {
                el.readOnly = true;
                el.classList.add('bg-light');
            }
        });

        if (btnSave) {
            btnSave.style.display = 'none';
            // Show a notice
            const notice = document.createElement('div');
            notice.className = 'alert alert-info mt-3 d-flex align-items-center gap-2';
            notice.innerHTML = `<i data-lucide="lock" style="width: 18px;"></i> Profile information is locked as your seller account is verified.`;
            btnSave.parentElement.appendChild(notice);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    function renderStatus(status) {
        let label = status.toUpperCase();
        let className = status;

        if (status === 'new') {
            label = 'SETUP REQUIRED';
            className = 'pending';
        }

        statusContainer.innerHTML = `
            <span class="status-pill ${className}">
                ${label}
            </span>
        `;
    }

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Safety check
        if (currentSeller && currentSeller.status === 'active') {
            alert('Your profile is verified and locked. Please contact support for any changes.');
            return;
        }

        const originalText = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        const updateData = {};
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el && field !== 'email') {
                updateData[field] = el.value.trim();
            }
        });

        // Ensure email is included for new inserts
        updateData.email = currentUserEmail;

        let result;

        if (currentSeller && currentSeller.id) {
            // Update existing
            result = await client
                .from('sellers')
                .update(updateData)
                .eq('id', currentSeller.id);
        } else {
            // Self-Onboarding: Insert new record
            updateData.status = 'pending'; // Start as pending for approval

            result = await client
                .from('sellers')
                .insert([updateData])
                .select();
        }

        if (result.error) {
            alert('Error saving profile: ' + result.error.message);
        } else {
            const isNew = !currentSeller;
            alert('Profile saved successfully! Your account is now pending administrative approval.');

            // Update local state
            if (isNew && result.data && result.data[0]) {
                currentSeller = result.data[0];
            } else {
                currentSeller = { ...currentSeller, ...updateData };
            }
            renderStatus(currentSeller.status);
        }

        btnSave.disabled = false;
        btnSave.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    init();
});
