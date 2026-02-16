
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
    let currentOrderData = null;
    let currentSellerData = null;
    const btnPrintLabel = document.getElementById('btn-print-label');

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
    if (btnPrintLabel) {
        btnPrintLabel.addEventListener('click', printOrderLabel);
    }

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
                        <div class="fw-medium">${(order.customer_first_name || '') + ' ' + (order.customer_last_name || '') || 'Guest Customer'}</div>
                        <div class="small text-muted">${order.customer_email}</div>
                    </td>
                    <td>${date}</td>
                    <td class="fw-bold">₹${order.total_amount.toLocaleString('en-IN')}</td>
                     <td>
                        <span class="badge bg-light text-dark border">${order.payment_method ? order.payment_method.replace('_', ' ').toUpperCase() : 'N/A'}</span>
                    </td>
                    <td>
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

            // Fetch profile phone separately as fallback
            let profile = null;
            if (order.user_id) {
                const { data: p } = await client
                    .from('profiles')
                    .select('phone')
                    .eq('id', order.user_id)
                    .single();
                profile = p;
            }

            // Fetch Order Items with Product details (need seller_id from product)
            const { data: items, error: itemsError } = await client
                .from('order_items')
                .select('*, products(name, images, sku, seller_id)')
                .eq('order_id', orderId);

            if (itemsError) throw itemsError;

            // Fetch seller details for print label
            let seller = null;
            if (items && items.length > 0 && items[0].products) {
                const sId = items[0].products.seller_id;
                const { data: s } = await client
                    .from('sellers')
                    .select('*')
                    .eq('id', sId)
                    .single();
                seller = s;
            }

            currentOrderData = order;
            currentSellerData = seller;

            populateModal(order, items, profile);

        } catch (err) {
            console.error('Error fetching order details:', err);
            showAlert('Failed to load order details', 'error');
            orderModal.hide();
        }
    };

    function populateModal(order, items, profile = null) {
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

        // Disable Save Button if Status is Terminal (Cancelled or Return Refund)
        const allowedNextSteps = statusFlow[currentStatus] || [];
        if (allowedNextSteps.length === 0) {
            btnSaveStatus.disabled = true;
            btnSaveStatus.classList.add('btn-secondary');
            btnSaveStatus.classList.remove('btn-primary');
            btnSaveStatus.innerHTML = '<i data-lucide="lock" style="width: 16px; height: 16px;" class="me-1"></i> Status Locked';
        } else {
            btnSaveStatus.disabled = false;
            btnSaveStatus.classList.remove('btn-secondary');
            btnSaveStatus.classList.add('btn-primary');
            btnSaveStatus.textContent = 'Update Status';
        }

        if (window.lucide) lucide.createIcons();

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

        modalOrderId.textContent = '#' + order.id.substring(0, 8);
        modalStatusSelect.value = order.status;

        const date = new Date(order.created_at).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
        modalOrderDate.textContent = date;

        const displayPhone = order.customer_phone || (profile ? profile.phone : null) || 'No phone';
        modalCustomerInfo.innerHTML = `
            <p class="mb-1 fw-bold">${(order.customer_first_name || '') + ' ' + (order.customer_last_name || '') || 'Guest Customer'}</p>
            <p class="mb-1"><a href="mailto:${order.customer_email}" class="text-decoration-none">${order.customer_email}</a></p>
            <p class="mb-0 text-muted">${displayPhone}</p>
        `;

        modalShippingAddress.innerHTML = `
            <p class="mb-1 fw-bold text-dark">${(order.customer_first_name || '') + ' ' + (order.customer_last_name || '')}</p>
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
            // Double check current status from DB to prevent race conditions (like customer cancelling while modal open)
            const { data: latestOrder, error: checkError } = await client
                .from('orders')
                .select('status')
                .eq('id', currentOrderId)
                .single();

            if (checkError) throw checkError;

            if (latestOrder.status === 'cancelled') {
                showAlert('This order has been cancelled and cannot be modified.', 'error');
                fetchOrders(statusFilter.value);
                orderModal.hide();
                return;
            }

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

            // If status is cancelled, restore stock
            if (newStatus === 'cancelled') {
                const { data: items, error: itemsError } = await client
                    .from('order_items')
                    .select('product_id, quantity')
                    .eq('order_id', currentOrderId);

                if (itemsError) throw itemsError;

                if (items && items.length > 0) {
                    for (const item of items) {
                        // Fetch current stock
                        const { data: product, error: prodError } = await client
                            .from('products')
                            .select('stock_quantity')
                            .eq('id', item.product_id)
                            .single();

                        if (!prodError && product) {
                            const newStock = (product.stock_quantity || 0) + item.quantity;
                            await client
                                .from('products')
                                .update({ stock_quantity: newStock })
                                .eq('id', item.product_id);
                        }
                    }
                }
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

    function printOrderLabel() {
        if (!currentOrderData) return;

        const order = currentOrderData;
        const seller = currentSellerData;

        const websiteName = "House of Pachu";
        const logoUrl = "../assets/img/logo.png";

        const customerName = (order.customer_first_name || '') + ' ' + (order.customer_last_name || '');
        const customerAddress = `${order.shipping_address}, ${order.shipping_city}, ${order.shipping_state} - ${order.shipping_pincode}`;
        const customerPhone = order.customer_phone || (order.profiles ? order.profiles.phone : 'N/A');

        const sellerName = seller ? seller.store_name : websiteName;
        const sellerAddress = seller ? `${seller.address_line1}, ${seller.address_line2 ? seller.address_line2 + ', ' : ''}${seller.city}, ${seller.state} - ${seller.pincode}` : "Default Warehouse";
        const sellerPhone = seller ? seller.phone : "N/A";

        const printWindow = window.open('', '_blank', 'width=900,height=800');
        printWindow.document.write(`
            <html>
            <head>
                <title>Shipping Label - #${order.id.substring(0, 8)}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    body { 
                        font-family: 'Inter', system-ui, -apple-system, sans-serif; 
                        margin: 0; 
                        padding: 0;
                        background-color: #f5f5f5;
                    }
                    .page-container {
                        width: 210mm;
                        min-height: 297mm;
                        margin: 0 auto;
                        background: white;
                        display: flex;
                        flex-direction: column;
                    }
                    .label-half {
                        height: 148.5mm; /* Exactly half of A4 297mm */
                        width: 210mm;
                        padding: 15mm;
                        box-sizing: border-box;
                        position: relative;
                        border-bottom: 1px dashed #ccc;
                    }
                    .label-container { 
                        border: 3px solid #000; 
                        padding: 30px; 
                        width: 100%;
                        height: 100%;
                        position: relative;
                        background: #fff;
                        box-sizing: border-box;
                        display: flex;
                        flex-direction: column;
                    }
                    .header { 
                        display: flex; 
                        justify-content: space-between; 
                        align-items: flex-start; 
                        border-bottom: 2px solid #000; 
                        padding-bottom: 12px; 
                        margin-bottom: 20px; 
                    }
                    .logo-section { display: flex; align-items: center; gap: 10px; }
                    .logo { width: 40px; height: 40px; object-fit: contain; }
                    .site-name { font-size: 20px; font-weight: 800; color: #000; margin: 0; text-transform: uppercase; }
                    .order-info { text-align: right; }
                    .order-id { font-size: 15px; font-weight: 700; color: #000; }
                    .order-date { font-size: 11px; color: #444; }
                    
                    .address-section { margin-bottom: 15px; }
                    .section-label { 
                        font-size: 10px; 
                        font-weight: 800; 
                        text-transform: uppercase; 
                        background: #000;
                        color: #fff;
                        padding: 3px 8px;
                        display: inline-block;
                        margin-bottom: 8px;
                    }
                    .address-content { font-size: 18px; line-height: 1.3; color: #000; }
                    .phone-box {
                        margin-top: 5px;
                        font-size: 16px;
                        font-weight: 700;
                    }
                    
                    .from-section {
                        margin-top: auto; /* Push to bottom */
                        padding-top: 15px;
                        border-top: 1px solid #eee;
                    }
                    .from-content { font-size: 13px; color: #333; line-height: 1.3; }
                    
                    .badge-cod { 
                        position: absolute; 
                        top: 70px; 
                        right: 30px; 
                        border: 4px solid #000; 
                        padding: 10px 20px; 
                        font-weight: 900; 
                        font-size: 32px; 
                        transform: rotate(-12deg);
                        background: #fff;
                        z-index: 10;
                    }
                    
                    .footer-note { 
                        margin-top: 15px; 
                        text-align: center; 
                        font-size: 10px; 
                        color: #777;
                    }

                    @media print {
                        body { background: none; }
                        .page-container { margin: 0; border: none; }
                        .label-half { border-bottom: 1px dashed #000; }
                        .label-half:last-child { border-bottom: none; }
                    }
                </style>
            </head>
            <body>
                <div class="page-container">
                    <!-- Slip 1 (Top Half) -->
                    <div class="label-half">
                        <div class="label-container">
                            <div class="header">
                                <div class="logo-section">
                                    <img src="${logoUrl}" class="logo" onerror="this.style.display='none'">
                                    <h1 class="site-name">${websiteName}</h1>
                                </div>
                                <div class="order-info">
                                    <div class="order-id">#${order.id.substring(0, 8).toUpperCase()}</div>
                                    <div class="order-date">${new Date(order.created_at).toLocaleDateString('en-IN')}</div>
                                </div>
                            </div>
                            ${order.payment_method === 'cod' ? '<div class="badge-cod">C.O.D</div>' : ''}
                            <div class="address-section">
                                <div class="section-label">SHIP TO (CUSTOMER)</div>
                                <div class="address-content">
                                    <strong>${customerName.toUpperCase()}</strong><br>
                                    ${order.shipping_address}<br>
                                    ${order.shipping_city}, ${order.shipping_state}<br>
                                    <strong>PIN: ${order.shipping_pincode}</strong>
                                    <div class="phone-box">CONTACT: ${customerPhone}</div>
                                </div>
                            </div>
                            <div class="from-section">
                                <div class="section-label" style="background:none; color:#000; padding:0; border:none; font-size: 9px;">FROM (REMITTER)</div>
                                <div class="from-content">
                                    <strong>${sellerName}</strong><br>
                                    ${sellerAddress} | <strong>PH: ${sellerPhone}</strong>
                                </div>
                            </div>
                            <div class="footer-note">Merchant Copy / Shipping Slip</div>
                        </div>
                    </div>

                    <!-- Slip 2 (Bottom Half) -->
                    <div class="label-half">
                        <div class="label-container">
                            <div class="header">
                                <div class="logo-section">
                                    <img src="${logoUrl}" class="logo" onerror="this.style.display='none'">
                                    <h1 class="site-name">${websiteName}</h1>
                                </div>
                                <div class="order-info">
                                    <div class="order-id">#${order.id.substring(0, 8).toUpperCase()}</div>
                                    <div class="order-date">${new Date(order.created_at).toLocaleDateString('en-IN')}</div>
                                </div>
                            </div>
                            ${order.payment_method === 'cod' ? '<div class="badge-cod">C.O.D</div>' : ''}
                            <div class="address-section">
                                <div class="section-label">SHIP TO (CUSTOMER)</div>
                                <div class="address-content">
                                    <strong>${customerName.toUpperCase()}</strong><br>
                                    ${order.shipping_address}<br>
                                    ${order.shipping_city}, ${order.shipping_state}<br>
                                    <strong>PIN: ${order.shipping_pincode}</strong>
                                    <div class="phone-box">CONTACT: ${customerPhone}</div>
                                </div>
                            </div>
                            <div class="from-section">
                                <div class="section-label" style="background:none; color:#000; padding:0; border:none; font-size: 9px;">FROM (REMITTER)</div>
                                <div class="from-content">
                                    <strong>${sellerName}</strong><br>
                                    ${sellerAddress} | <strong>PH: ${sellerPhone}</strong>
                                </div>
                            </div>
                            <div class="footer-note">Courier Copy / Shipping Slip</div>
                        </div>
                    </div>
                </div>
                <script>
                    window.onload = function() {
                        setTimeout(() => {
                           window.print();
                        }, 500);
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
});
