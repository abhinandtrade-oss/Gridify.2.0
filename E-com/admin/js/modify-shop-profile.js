/**
 * Marketplace: Modify Shop Profile Logic for Sellers
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const profileForm = document.getElementById('modify-profile-form');
    const statusContainer = document.getElementById('seller-status-container');
    const btnUpdate = document.getElementById('btn-update-profile');
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
        } else {
            alert('No seller profile found. Redirecting to setup...');
            window.location.href = 'shop-profile.html';
        }
    }

    function populateForm(data) {
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el) el.value = data[field] || '';
        });
    }

    function renderStatus(status) {
        statusContainer.innerHTML = `
            <span class="status-pill ${status}">
                ${status.toUpperCase()}
            </span>
        `;
    }

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentSeller) return;

        const originalText = btnUpdate.innerHTML;
        btnUpdate.disabled = true;
        btnUpdate.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Updating...';

        const updateData = {};
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el && field !== 'email') {
                updateData[field] = el.value.trim();
            }
        });

        const { error } = await client
            .from('sellers')
            .update(updateData)
            .eq('id', currentSeller.id);

        if (error) {
            alert('Error updating profile: ' + error.message);
        } else {
            alert('Profile updated successfully!');
            currentSeller = { ...currentSeller, ...updateData };
            renderStatus(currentSeller.status);
        }

        btnUpdate.disabled = false;
        btnUpdate.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });

    init();
});
