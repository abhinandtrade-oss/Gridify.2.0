document.addEventListener('DOMContentLoaded', () => {
    // Check Auth - Ideally separate this logic or ensure admin privileges
    const client = window.supabase;
    if (!client) {
        console.error('Supabase not initialized');
        return;
    }

    // Elements
    const returnsList = document.getElementById('returns-list');
    const statusFilter = document.getElementById('status-filter');
    const returnModal = new bootstrap.Modal(document.getElementById('returnModal'));
    const modalReturnId = document.getElementById('modal-return-id');
    const modalReason = document.getElementById('modal-reason');
    const modalAdminNotes = document.getElementById('modal-admin-notes');
    const modalSellerInfo = document.getElementById('modal-seller-info');

    // Load initial data
    loadMPReturns();

    // Check for return ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialReturnId = urlParams.get('id');
    if (initialReturnId) {
        setTimeout(() => {
            if (window.openReturnModal) window.openReturnModal(initialReturnId);
        }, 1000);
    }

    async function loadMPReturns() {
        if (!returnsList) return;

        const status = statusFilter.value;
        // Fetch returns, orders, items, products, and sellers.
        // Assuming products.seller_id -> sellers.id
        // NOTE: Supabase join depth: returns -> order_items -> products -> sellers
        const query = client
            .from('returns')
            .select(`
                *,
                orders (
                    id, 
                    customer_email, 
                    customer_first_name, 
                    customer_last_name,
                    order_date,
                    shipping_address,
                    city,
                    state,
                    pincode,
                    status
                ),
                order_items (
                    id, 
                    products (
                        name, 
                        images,
                        seller_id,
                        sellers (shop_name, owner_name, email)
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (status !== 'all') {
            query.eq('status', status);
        }

        returnsList.innerHTML = '<tr><td colspan="9" class="text-center py-5">Loading marketplace returns...</td></tr>';

        try {
            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                returnsList.innerHTML = '<tr><td colspan="9" class="text-center py-5 text-muted">No return requests found.</td></tr>';
                return;
            }

            returnsList.innerHTML = data.map(ret => {
                const order = ret.orders;
                const item = ret.order_items;
                const product = item?.products;
                const seller = product?.sellers;
                const date = new Date(ret.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

                return `
                    <tr>
                        <td><span class="text-muted small">#${ret.id.substring(0, 8)}</span></td>
                        <td>
                            <a href="orders.html?id=${order.id}" class="text-decoration-none fw-bold">#${order.id.substring(0, 8)}</a>
                            <div class="text-muted small" style="font-size: 0.7rem;">${new Date(order.order_date).toLocaleDateString()}</div>
                        </td>
                        <td>
                            <div class="fw-medium">${order.customer_first_name} ${order.customer_last_name}</div>
                            <div class="text-muted small">${order.customer_email}</div>
                        </td>
                        <td>
                            <div class="d-flex align-items-center">
                                <img src="${getImageUrl(product)}" class="rounded me-2" width="32" height="32" style="object-fit:cover;">
                                <div class="small fw-medium text-truncate" style="max-width: 120px;" title="${product ? product.name : ''}">${product ? product.name : 'Unknown Product'}</div>
                            </div>
                        </td>
                        <td>
                            ${seller ? `
                                <div class="fw-medium">${escapeHtml(seller.shop_name)}</div>
                                <div class="text-muted small">${escapeHtml(seller.owner_name)}</div>
                            ` : '<span class="text-muted small">House of Pachu</span>'}
                        </td>
                        <td>
                            <div class="small fw-bold text-uppercase ${getStatusClass(order.status)}">${order.status}</div>
                            <div class="text-muted small" style="font-size: 0.7rem;">
                                ${escapeHtml(order.city)}, ${escapeHtml(order.state)}
                            </div>
                        </td>
                        <td><span class="d-inline-block text-truncate small" style="max-width: 150px;" title="${ret.reason}">${ret.reason}</span></td>
                        <td>
                            <span class="badge bg-${getStatusColor(ret.status)} text-uppercase">${ret.status}</span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" style="font-size: 0.75rem;" 
                                onclick="openReturnModal(
                                    '${ret.id}', 
                                    '${escapeHtml(ret.reason)}', 
                                    '${escapeHtml(ret.admin_notes || '')}', 
                                    '${seller ? escapeHtml(seller.shop_name) : 'House of Pachu'}'
                                )">
                                Review
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            lucide.createIcons();

        } catch (err) {
            console.error('Error loading returns:', err);
            returnsList.innerHTML = `<tr><td colspan="9" class="text-center py-5 text-danger">Failed to load data: ${err.message}</td></tr>`;
        }
    }

    // Helper: Get Image URL
    function getImageUrl(product) {
        if (!product || !product.images) return '../assets/img/product-placeholder.png';
        try {
            const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
            if (Array.isArray(imgs) && imgs.length > 0) return imgs[0].url || imgs[0]; // some URLs are objects {url: '...'}
            if (typeof imgs === 'string') return imgs;
        } catch (e) { }
        return '../assets/img/product-placeholder.png';
    }

    // Helper: Status Color
    function getStatusColor(status) {
        switch (status) {
            case 'pending': return 'warning';
            case 'approved': return 'success';
            case 'rejected': return 'danger';
            case 'completed': return 'info';
            default: return 'secondary';
        }
    }

    function getStatusClass(status) {
        switch (status) {
            case 'delivered': return 'text-success';
            case 'cancelled': return 'text-danger';
            case 'shipped': return 'text-info';
            default: return 'text-secondary';
        }
    }

    // Helper: Escape HTML
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Open Modal Global
    window.openReturnModal = async (id, reason, notes, shopName) => {
        if (!reason) {
            // If only ID is provided, fetch details
            try {
                // We need to join with sellers to get the shop name
                const { data: ret, error } = await client
                    .from('returns')
                    .select('*, order_items(products(sellers(shop_name)))')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                reason = ret.reason;
                notes = ret.admin_notes || '';
                const seller = ret.order_items?.products?.sellers;
                shopName = seller ? seller.shop_name : 'House of Pachu';
            } catch (err) {
                console.error('Error fetching return for modal:', err);
                return;
            }
        }
        modalReturnId.value = id;
        modalReason.textContent = reason;
        modalAdminNotes.value = notes;
        if (modalSellerInfo) modalSellerInfo.textContent = "Sold by: " + shopName;
        returnModal.show();
    };

    // Update Status Global
    window.updateReturnStatus = async (newStatus) => {
        const id = modalReturnId.value;
        const notes = modalAdminNotes.value;

        if (!confirm(`Are you sure you want to mark this request as ${newStatus}?`)) return;

        try {
            const { error } = await client
                .from('returns')
                .update({ status: newStatus, admin_notes: notes })
                .eq('id', id);

            if (error) throw error;

            alert(`Return request marked as ${newStatus}.`);
            returnModal.hide();
            loadMPReturns(); // Refresh list

        } catch (err) {
            console.error('Error updating return status:', err);
            alert('Failed to update status: ' + err.message);
        }
    };

    // Expose loadMPReturns globally
    window.loadMPReturns = loadMPReturns;

    // Status Filter Change
    statusFilter.addEventListener('change', loadMPReturns);
});
