document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
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
    const modalOrderId = document.getElementById('modal-order-id');
    const modalReason = document.getElementById('modal-reason');
    const modalAdminNotes = document.getElementById('modal-admin-notes');

    // Load initial data
    loadReturns();

    // Check for return ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialReturnId = urlParams.get('id');
    if (initialReturnId) {
        setTimeout(() => {
            if (window.openReturnModal) window.openReturnModal(initialReturnId);
        }, 1000);
    }

    async function loadReturns() {
        if (!returnsList) return;

        // Check if user is a seller
        const { data: { session } } = await client.auth.getSession();
        let sellerId = null;

        if (session) {
            const { data: seller } = await client
                .from('sellers')
                .select('id')
                .eq('email', session.user.email)
                .maybeSingle();

            if (seller) {
                sellerId = seller.id;
            }
        }

        const status = statusFilter.value;

        let query = client
            .from('returns')
            .select(`
                *,
                orders (id, customer_email, customer_first_name, customer_last_name),
                order_items!inner (
                    id, 
                    total_price, 
                    products!inner (
                        name, 
                        images,
                        seller_id
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (sellerId) {
            // Filter by seller's products
            query = query.eq('order_items.products.seller_id', sellerId);
        }

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        returnsList.innerHTML = '<tr><td colspan="8" class="text-center py-5">Loading...</td></tr>';

        try {
            const { data, error } = await query;
            if (error) throw error;

            if (!data || data.length === 0) {
                returnsList.innerHTML = '<tr><td colspan="8" class="text-center py-5 text-muted">No return requests found.</td></tr>';
                return;
            }

            returnsList.innerHTML = data.map(ret => {
                const order = ret.orders;
                const item = ret.order_items;
                const product = item?.products;
                const date = new Date(ret.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

                return `
                    <tr>
                        <td><span class="text-muted small">#${ret.id.substring(0, 8)}</span></td>
                        <td><a href="orders.html?id=${order.id}" class="text-decoration-none fw-bold">#${order.id.substring(0, 8)}</a></td>
                        <td>
                            <div class="fw-medium">${order.customer_first_name} ${order.customer_last_name}</div>
                            <div class="text-muted small">${order.customer_email}</div>
                        </td>
                        <td>
                            <div class="d-flex align-items-center">
                                <img src="${getImageUrl(product)}" class="rounded me-2" width="32" height="32" style="object-fit:cover;">
                                <div class="small fw-medium text-truncate" style="max-width: 150px;">${product ? product.name : 'Unknown Product'}</div>
                            </div>
                        </td>
                        <td><span class="d-inline-block text-truncate small" style="max-width: 150px;" title="${ret.reason}">${ret.reason}</span></td>
                        <td class="small text-muted">${date}</td>
                        <td>
                            <span class="badge bg-${getStatusColor(ret.status)} text-uppercase">${ret.status}</span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" style="font-size: 0.75rem;" onclick="openReturnModal('${ret.id}', '${escapeHtml(ret.reason)}', '${escapeHtml(ret.admin_notes || '')}', '${ret.order_id}')">
                                Review
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            lucide.createIcons();

        } catch (err) {
            console.error('Error loading returns:', err);
            returnsList.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-danger">Failed to load data: ${err.message}</td></tr>`;
        }
    }

    // Helper: Get Image URL
    function getImageUrl(product) {
        if (!product || !product.images) return '../assets/img/product-placeholder.png';
        try {
            const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
            if (Array.isArray(imgs) && imgs.length > 0) return imgs[0].url || imgs[0];
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
            case 'replacement':
            case 'return_replacement': return 'primary';
            default: return 'secondary';
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
    window.openReturnModal = async (id, reason, notes, orderId) => {
        if (!reason) {
            // If only ID is provided, fetch details
            try {
                const { data: ret, error } = await client
                    .from('returns')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;
                reason = ret.reason;
                notes = ret.admin_notes || '';
                orderId = ret.order_id;
            } catch (err) {
                console.error('Error fetching return for modal:', err);
                return;
            }
        }
        modalReturnId.value = id;
        modalOrderId.value = orderId;
        modalReason.textContent = reason;
        modalAdminNotes.value = notes;
        returnModal.show();
    };

    // Update Status Global
    window.updateReturnStatus = async (newStatus) => {
        const id = modalReturnId.value;
        const orderId = modalOrderId.value;
        const notes = modalAdminNotes.value;

        showConfirm(`Are you sure you want to mark this request as ${newStatus}?`, async () => {
            try {
                // Determine return table status and order table status
                let returnTableStatus = newStatus;
                let orderTableStatus = null;

                if (newStatus === 'rejected') {
                    orderTableStatus = 'delivered'; // If rejected, it stays as delivered
                } else if (newStatus === 'approved') {
                    // Update return status to approved, order stays as is or moves to refund pending?
                    // Typically approved return -> refund process
                    // Check if orderTableStatus logic was correct.
                    // Previous code:
                    // } else if (newStatus === 'approved') {
                    //    orderTableStatus = 'return_refund';
                    // }
                    orderTableStatus = 'return_refund';
                } else if (newStatus === 'replacement') {
                    orderTableStatus = 'return_replacement';
                }

                // 1. Update return table
                const { data: returnUpdate, error: returnError } = await client
                    .from('returns')
                    .update({ status: returnTableStatus, admin_notes: notes })
                    .eq('id', id)
                    .select();

                if (returnError) throw returnError;

                if (!returnUpdate || returnUpdate.length === 0) {
                    throw new Error("Return status not updated. You might not have permission (RLS).");
                }

                // 2. Update order status if mapped
                let orderUpdated = false;
                if (orderTableStatus && orderId) {
                    const { error: orderError } = await client
                        .from('orders')
                        .update({ status: orderTableStatus, updated_at: new Date().toISOString() })
                        .eq('id', orderId);

                    if (orderError) {
                        console.warn(`Failed to update order status to ${orderTableStatus}:`, orderError);
                    } else {
                        orderUpdated = true;
                    }
                }

                showAlert(`Return request successfully processed as: ${newStatus.toUpperCase()}`, 'success');
                returnModal.hide();
                loadReturns();

            } catch (err) {
                console.error('Error updating return status:', err);
                showAlert('Failed to update: ' + err.message, 'error');
            }
        });
    };

    // Expose loadReturns globally
    window.loadReturns = loadReturns;

    // Status Filter Change
    statusFilter.addEventListener('change', loadReturns);
});
