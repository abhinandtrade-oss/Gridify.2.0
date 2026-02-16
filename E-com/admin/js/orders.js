
document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const ordersList = document.getElementById('orders-list');
    const statusFilter = document.getElementById('status-filter');
    const orderCount = document.getElementById('order-count');

    // Modal elements
    const orderModalEl = document.getElementById('orderModal');
    const orderModal = new bootstrap.Modal(orderModalEl);
    const modalOrderId = document.getElementById('modal-order-id');
    const modalCustomerInfo = document.getElementById('modal-customer-info');
    const modalShippingAddress = document.getElementById('modal-shipping-address');
    const modalStatusSelect = document.getElementById('modal-status-select'); // Hidden Input
    const statusButtons = document.querySelectorAll('.status-btn');
    const modalOrderDate = document.getElementById('modal-order-date');
    const modalOrderItems = document.getElementById('modal-order-items');
    const modalSubtotal = document.getElementById('modal-subtotal');
    const modalDiscountRow = document.getElementById('modal-discount-row');
    const modalDiscount = document.getElementById('modal-discount');
    const modalTotal = document.getElementById('modal-total');
    const btnSaveStatus = document.getElementById('btn-save-status');

    // Tracking Elements
    const trackingInfoWrapper = document.getElementById('tracking-info-wrapper');
    const modalCourierName = document.getElementById('modal-courier-name');
    const modalTrackingNumber = document.getElementById('modal-tracking-number');

    let currentOrderId = null;

    // Initial load
    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = urlParams.get('status') || 'all';

    // Set filter value if valid option exists
    if (statusFilter.querySelector(`option[value="${initialStatus}"]`)) {
        statusFilter.value = initialStatus;
    } else {
        statusFilter.value = 'all';
    }

    fetchOrders(statusFilter.value);

    // Initial check for Order ID param
    const initialOrderId = urlParams.get('id');
    if (initialOrderId) {
        // Wait a bit for Supabase to be ready if needed, though it should be already
        setTimeout(() => {
            if (window.viewOrder) window.viewOrder(initialOrderId);
        }, 500);
    }

    // Event Listeners
    statusFilter.addEventListener('change', () => fetchOrders(statusFilter.value));

    // Handle Status Button Clicks
    statusButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            if (this.disabled) return;

            // Update Active State
            statusButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Update Hidden Input
            modalStatusSelect.value = this.dataset.value;

            // Toggle Tracking Info
            const val = this.dataset.value;
            if (['shipped', 'delivered', 'delivery_failed', 'return_replacement'].includes(val)) {
                trackingInfoWrapper.classList.remove('d-none');
            } else {
                if (currentOrder && ['shipped', 'delivered', 'delivery_failed', 'return_replacement'].includes(currentOrder.status)) {
                    // Keep visible logic if needed
                }
                trackingInfoWrapper.classList.add('d-none');
            }
        });
    });

    btnSaveStatus.addEventListener('click', updateOrderStatus);

    async function fetchOrders(status = 'all') {
        ordersList.innerHTML = `
            <tr>
                <td colspan="7" class="text-center p-5">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span class="ms-2 text-muted">Loading orders...</span>
                </td>
            </tr>
        `;

        try {
            let query = client
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (status !== 'all') {
                query = query.eq('status', status);
            }

            const { data: orders, error } = await query;

            if (error) throw error;

            renderOrders(orders);
        } catch (err) {
            console.error('Error fetching orders:', err);
            ordersList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center p-5 text-danger">
                        Error loading orders. Please try again.
                    </td>
                </tr>
            `;
        }
    }

    function renderOrders(orders) {
        orderCount.textContent = orders.length;

        if (orders.length === 0) {
            ordersList.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center p-5 text-muted">
                        No orders found.
                    </td>
                </tr>
            `;
            return;
        }

        ordersList.innerHTML = orders.map(order => {
            const date = new Date(order.created_at).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            let statusClass = '';
            switch (order.status) {
                case 'pending': statusClass = 'pending'; break;
                case 'completed':
                case 'delivered': statusClass = 'completed'; break;
                case 'cancelled': statusClass = 'cancelled'; break;
                case 'shipped': statusClass = 'shipped'; break;
                case 'delivery_failed': statusClass = 'cancelled'; break; // Re-use cancelled or similar style
                case 'return_replacement': statusClass = 'processing'; break;
                case 'return_refund': statusClass = 'cancelled'; break;
                default: statusClass = 'text-secondary';
            }

            // Format status label better for new long statuses
            let statusLabel = order.status.replace(/_/g, ' ');
            statusLabel = statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1);

            return `
                <tr>
                    <td><span class="fw-bold text-primary">#${order.id.substring(0, 8)}</span></td>
                    <td>
                        <div class="fw-medium">${order.customer_first_name} ${order.customer_last_name}</div>
                        <div class="small text-muted">${order.customer_email}</div>
                    </td>
                    <td>${date}</td>
                    <td class="fw-bold">₹${order.total_amount.toLocaleString('en-IN')}</td>
                     <td>
                        <span class="badge bg-light text-dark border">${order.payment_method ? order.payment_method.replace('_', ' ').toUpperCase() : 'N/A'}</span>
                    </td>
                    <td>
                        <span class="status-badge ${statusClass}">
                        <span class="status-badge ${statusClass}">
                            ${statusLabel}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-view" onclick="viewOrder('${order.id}')">
                            <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    // Expose viewOrder to global scope
    window.viewOrder = async function (orderId) {
        currentOrderId = orderId;

        // Show loading state in modal or open modal with loading
        // Reset modal content
        modalOrderId.textContent = '#...';
        modalCustomerInfo.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div>';
        modalOrderItems.innerHTML = '';

        orderModal.show();

        try {
            // Fetch Order Details
            const { data: order, error: orderError } = await client
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single();

            if (orderError) throw orderError;

            // Fetch Order Items with Product details
            // Assuming there is a relation setup, otherwise we might need to fetch manually.
            // Let's try fetching with relation first. If it fails, we fetch items then products.
            const { data: items, error: itemsError } = await client
                .from('order_items')
                .select('*, products(name, images, sku)')
                .eq('order_id', orderId);

            if (itemsError) throw itemsError;

            populateModal(order, items);

        } catch (err) {
            console.error('Error fetching order details:', err);
            showAlert('Failed to load order details', 'error');
            orderModal.hide();
        }
    };

    function populateModal(order, items) {
        // Status Flow Logic
        const currentStatus = order.status;
        const statusFlow = {
            'pending': ['processing', 'cancelled'],
            'processing': ['shipped', 'cancelled'],
            'shipped': ['delivered', 'delivery_failed'],
            'delivery_failed': ['processing', 'cancelled'], // Can try to deliver again or cancel
            'delivered': ['return_replacement', 'return_refund'],
            'return_replacement': ['processing', 'shipped', 'delivered'], // Loop back if replacement is sent
            'return_refund': [],
            'cancelled': []
        };

        // Update Buttons based on Flow
        statusButtons.forEach(btn => {
            const btnValue = btn.dataset.value;
            btn.classList.remove('active', 'disabled');
            btn.disabled = false; // Reset first

            if (btnValue === currentStatus) {
                btn.classList.add('active');
                modalStatusSelect.value = currentStatus; // Set initial value
            } else {
                const allowedNextSteps = statusFlow[currentStatus] || [];
                if (!allowedNextSteps.includes(btnValue)) {
                    btn.classList.add('disabled');
                    btn.disabled = true;
                }
            }
        });

        // Store current order for reference in event listeners
        window.currentOrder = order;

        // Populate Tracking Info
        modalCourierName.value = order.courier_name || '';
        modalTrackingNumber.value = order.tracking_number || '';

        // Show/Hide Tracking Fields based on current status
        if (['shipped', 'delivered', 'delivery_failed', 'return_replacement'].includes(currentStatus)) {
            trackingInfoWrapper.classList.remove('d-none');
        } else {
            trackingInfoWrapper.classList.add('d-none');
        }

        // Remove old onchange if any (not needed as buttons handle logic now)
        // modalStatusSelect.onchange removed as we use buttons

        modalOrderId.textContent = '#' + order.id.substring(0, 8);
        modalStatusSelect.value = order.status;

        const date = new Date(order.created_at).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
        modalOrderDate.textContent = date;

        modalCustomerInfo.innerHTML = `
            <p class="mb-1 fw-bold">${order.customer_first_name} ${order.customer_last_name}</p>
            <p class="mb-1"><a href="mailto:${order.customer_email}" class="text-decoration-none">${order.customer_email}</a></p>
            <p class="mb-0 text-muted">${order.customer_phone || 'No phone'}</p>
        `;

        modalShippingAddress.innerHTML = `
            <p class="mb-1">${order.shipping_address || ''}</p>
            <p class="mb-1">${order.shipping_city || ''}, ${order.shipping_state || ''}</p>
            <p class="mb-0">${order.shipping_pincode || ''}</p>
        `;

        // Check if items is null or empty
        if (!items || items.length === 0) {
            modalOrderItems.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center py-4 text-muted">
                        No items found for this order.
                    </td>
                </tr>
            `;
        } else {
            modalOrderItems.innerHTML = items.map(item => {
                const product = item.products; // Can be null in case of RLS or deletion

                // Handle image parsing
                let imageUrl = '../assets/img/product-placeholder.png';
                if (product && product.images) {
                    try {
                        const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
                        if (Array.isArray(imgs) && imgs.length > 0) imageUrl = imgs[0]?.url || imgs[0]; // Handle object with url or string
                        else if (typeof imgs === 'string') imageUrl = imgs;
                    } catch (e) {
                        console.warn('Image parse error', e);
                    }
                }

                // Handle Missing Product Info
                const productName = product ? product.name : '<span class="text-danger">Product Info Unavailable</span>';
                const productSku = product ? (product.sku || 'N/A') : 'ID: ' + item.product_id;

                return `
                    <tr>
                        <td class="ps-3">
                            <div class="d-flex align-items-center">
                                <img src="${imageUrl}" class="rounded me-3" width="40" height="40" style="object-fit: cover;" onerror="this.src='../assets/img/product-placeholder.png'">
                                <div>
                                    <div class="fw-medium small">${productName}</div>
                                    <div class="text-muted" style="font-size: 0.75rem;">SKU: ${productSku}</div>
                                </div>
                            </div>
                        </td>
                        <td class="text-center">${item.quantity}</td>
                        <td class="text-end pe-3">₹${item.total_price.toLocaleString('en-IN')}</td>
                    </tr>
                `;
            }).join('');
        }

        modalSubtotal.textContent = '₹' + order.subtotal.toLocaleString('en-IN');

        if (order.discount_amount > 0) {
            modalDiscountRow.classList.remove('d-none');
            modalDiscount.textContent = '-₹' + order.discount_amount.toLocaleString('en-IN');
        } else {
            modalDiscountRow.classList.add('d-none');
        }

        modalTotal.textContent = '₹' + order.total_amount.toLocaleString('en-IN');
    }

    async function updateOrderStatus() {
        if (!currentOrderId) return;

        const newStatus = modalStatusSelect.value;
        const btn = btnSaveStatus;

        btn.disabled = true;
        btn.textContent = 'Updating...';

        try {
            const updates = {
                status: newStatus,
                updated_at: new Date().toISOString()
            };

            if (newStatus === 'shipped') {
                const courier = modalCourierName.value.trim();
                const tracking = modalTrackingNumber.value.trim();

                if (!courier || !tracking) {
                    showAlert('Please enter Courier Name and Tracking Number for shipped orders.', 'warning');
                    btn.disabled = false;
                    btn.textContent = 'Update Status';
                    return;
                }
                updates.courier_name = courier;
                updates.tracking_number = tracking;
            }

            const { error } = await client
                .from('orders')
                .update(updates)
                .eq('id', currentOrderId);

            if (error) throw error;

            // Update UI list if in background
            fetchOrders(statusFilter.value);

            // Show success
            showAlert('Order status updated successfully', 'success');
            orderModal.hide();

        } catch (err) {
            console.error('Error updating status:', err);
            showAlert('Failed to update status: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Update Status';
        }
    }
});
