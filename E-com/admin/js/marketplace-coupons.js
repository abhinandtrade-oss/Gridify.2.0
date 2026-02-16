/**
 * Marketplace: Coupon Management for Sellers
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const couponList = document.getElementById('coupon-list');
    const couponForm = document.getElementById('coupon-form');
    const couponModal = new bootstrap.Modal(document.getElementById('couponModal'));

    let currentSellerId = null;

    async function init() {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        // 1. Check if user is Admin/Super-Admin
        const { data: roleData } = await client
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();

        const isAdmin = roleData && (roleData.role === 'admin' || roleData.role === 'super_admin');

        // 2. Get Seller ID
        const { data: seller } = await client
            .from('sellers')
            .select('id')
            .eq('email', session.user.email)
            .maybeSingle();

        if (seller) {
            currentSellerId = seller.id;
        }

        // If not a seller and not an admin, show error
        if (!seller && !isAdmin) {
            couponList.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center p-5">
                        <div class="text-muted mb-3">No seller profile found for your account.</div>
                        <a href="shop-profile.html" class="btn btn-outline-primary btn-sm">Setup Shop Profile</a>
                    </td>
                </tr>
            `;
            // Hide the create button if not a seller
            const createBtn = document.querySelector('[data-bs-target="#couponModal"]');
            if (createBtn) createBtn.style.display = 'none';
            return;
        }

        // 3. Load Coupons
        loadCoupons();
    }

    async function loadCoupons() {
        const query = client.from('coupons').select('*');

        // If we have a seller ID, filter by it. 
        // If we don't have a seller ID (e.g. Admin), show all.
        if (currentSellerId) {
            query.eq('seller_id', currentSellerId);
        } else {
            // For admins who aren't sellers, they see everything
            console.log("Loading all coupons (Admin view)");
        }

        const { data: coupons, error } = await query
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading coupons:', error);
            if (error.code === '42P01') {
                couponList.innerHTML = `<tr><td colspan="8" class="text-center p-5 text-danger">Database table 'coupons' not found. Please create it in Supabase.</td></tr>`;
            } else {
                couponList.innerHTML = `<tr><td colspan="8" class="text-center p-5 text-danger">Error loading coupons: ${error.message}</td></tr>`;
            }
            return;
        }

        renderCoupons(coupons);
        updateStats(coupons);
    }

    function renderCoupons(coupons) {
        if (!coupons || coupons.length === 0) {
            couponList.innerHTML = '<tr><td colspan="8" class="text-center p-5 text-muted">You haven\'t created any coupons yet.</td></tr>';
            return;
        }

        couponList.innerHTML = coupons.map(c => {
            const status = getCouponStatus(c);
            return `
                <tr>
                    <td><span class="coupon-code">${c.code}</span></td>
                    <td><span class="text-capitalize">${c.type}</span></td>
                    <td><div class="fw-bold">${c.type === 'percentage' ? c.value + '%' : '₹' + parseFloat(c.value).toLocaleString()}</div></td>
                    <td>₹${parseFloat(c.min_purchase || 0).toLocaleString()}</td>
                    <td>
                        <div class="small">${c.used_count || 0} / ${c.usage_limit || '∞'}</div>
                        <div class="progress" style="height: 4px; width: 60px;">
                            <div class="progress-bar" style="width: ${c.usage_limit ? (c.used_count / c.usage_limit * 100) : 0}%"></div>
                        </div>
                    </td>
                    <td>
                        <div class="small">${new Date(c.start_date).toLocaleDateString()}</div>
                        <div class="small text-muted">${new Date(c.end_date).toLocaleDateString()}</div>
                    </td>
                    <td>
                        <span class="badge-status ${getStatusClass(status)}">
                            ${status.toUpperCase()}
                        </span>
                    </td>
                    <td class="text-end">
                        <div class="action-btns justify-content-end">
                            <button class="btn btn-sm btn-light" onclick="editCoupon('${c.id}')">
                                <i data-lucide="edit-2" style="width: 14px;"></i>
                            </button>
                            <button class="btn btn-sm btn-light text-danger" onclick="deleteCoupon('${c.id}')">
                                <i data-lucide="trash-2" style="width: 14px;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function getCouponStatus(c) {
        const now = new Date();
        const start = new Date(c.start_date);
        const end = new Date(c.end_date);

        if (c.status === 'inactive') return 'inactive';
        if (now < start) return 'pending';
        if (now > end) return 'expired';
        if (c.usage_limit && c.used_count >= c.usage_limit) return 'expired';
        return 'active';
    }

    function getStatusClass(status) {
        switch (status) {
            case 'active': return 'status-active';
            case 'inactive': return 'status-inactive';
            case 'expired': return 'status-expired';
            case 'pending': return 'status-pending';
            default: return 'status-expired';
        }
    }

    function updateStats(coupons) {
        const active = coupons.filter(c => getCouponStatus(c) === 'active').length;
        const uses = coupons.reduce((sum, c) => sum + (c.used_count || 0), 0);

        document.getElementById('active-count').textContent = active;
        document.getElementById('total-uses').textContent = uses;
        // Total discount is harder to calculate without order data, so we'll keep it simple or hide it
        // Or we could show "Average Discount" 
    }

    // Modal Control
    window.resetForm = () => {
        document.getElementById('modalTitle').textContent = 'Create New Coupon';
        couponForm.reset();
        document.getElementById('coupon-id').value = '';
        document.getElementById('start_date').valueAsDate = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        document.getElementById('end_date').valueAsDate = nextMonth;
    };

    window.editCoupon = async (id) => {
        const { data: coupon, error } = await client
            .from('coupons')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            alert('Error loading coupon: ' + error.message);
            return;
        }

        document.getElementById('modalTitle').textContent = 'Edit Coupon';
        document.getElementById('coupon-id').value = coupon.id;
        document.getElementById('code').value = coupon.code;
        document.getElementById('type').value = coupon.type;
        document.getElementById('value').value = coupon.value;
        document.getElementById('min_purchase').value = coupon.min_purchase;
        document.getElementById('usage_limit').value = coupon.usage_limit || '';
        document.getElementById('start_date').value = coupon.start_date;
        document.getElementById('end_date').value = coupon.end_date;
        document.getElementById('status').value = coupon.status;

        couponModal.show();
    };

    couponForm.onsubmit = async (e) => {
        e.preventDefault();
        const btnSave = document.getElementById('btn-save');
        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';

        const id = document.getElementById('coupon-id').value;
        const couponData = {
            seller_id: currentSellerId,
            code: document.getElementById('code').value.toUpperCase(),
            type: document.getElementById('type').value,
            value: parseFloat(document.getElementById('value').value),
            min_purchase: parseFloat(document.getElementById('min_purchase').value || 0),
            usage_limit: parseInt(document.getElementById('usage_limit').value) || null,
            start_date: document.getElementById('start_date').value,
            end_date: document.getElementById('end_date').value,
            status: document.getElementById('status').value
        };

        let result;
        if (id) {
            result = await client.from('coupons').update(couponData).eq('id', id);
        } else {
            result = await client.from('coupons').insert([couponData]);
        }

        if (result.error) {
            alert('Error saving coupon: ' + result.error.message);
        } else {
            couponModal.hide();
            loadCoupons();
        }

        btnSave.disabled = false;
        btnSave.textContent = 'Save Coupon';
    };

    window.deleteCoupon = async (id) => {
        if (!confirm('Are you sure you want to delete this coupon?')) return;

        const { error } = await client.from('coupons').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else loadCoupons();
    };

    init();
});
