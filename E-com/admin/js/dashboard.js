document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard JS loaded");

    const client = window.supabase;

    // --- Helpers ---
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric'
        });
    };

    // --- Charts Instances ---
    let revenueChartInstance = null;
    let statusChartInstance = null;
    let pricingConfig = { platformFee: 0, minFee: 0 };

    // --- Main Update Function ---
    async function initDashboard() {
        if (!client || typeof client.from !== 'function') {
            console.warn("Dashboard: Supabase client not ready yet, retrying in 500ms...");
            setTimeout(initDashboard, 500);
            return;
        }

        console.log("Dashboard: Fetching data...");

        await fetchPricingConfig();

        await Promise.all([
            fetchStats(),
            fetchRevenueChart(30), // Default to 30 days (matches UI selection)
            fetchOrderStatusChart(),
            fetchRecentOrders()
        ]);
        setupChartListeners();
    }

    async function fetchPricingConfig() {
        try {
            const { data: settingsData } = await client
                .from('site_settings')
                .select('value')
                .eq('key', 'pricing_config')
                .maybeSingle();

            if (settingsData && settingsData.value) {
                const cfg = typeof settingsData.value === 'string' ? JSON.parse(settingsData.value) : settingsData.value;
                pricingConfig = {
                    platformFee: Number(cfg.platformFee) || 0,
                    minFee: Number(cfg.minFee) || 0
                };
            }
        } catch (err) {
            console.error("Error loading pricing config:", err);
        }
    }

    // 1. Fetch Key Stats
    async function fetchStats() {
        try {
            const { data: { session } } = await client.auth.getSession();
            if (!session) return;

            // Get user role and seller info
            const { data: roleData } = await client
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();

            const role = roleData ? roleData.role : null;
            let sellerId = null;

            if (role !== 'super_admin') {
                const { data: seller } = await client
                    .from('sellers')
                    .select('id')
                    .eq('email', session.user.email)
                    .maybeSingle();
                if (seller) sellerId = seller.id;
            }

            // Stats are fetched after pricingConfig is loaded in initDashboard

            // Fetch Orders with Seller Info
            // Fetching more status info to be accurate
            let query = client.from('orders').select('*, order_items(products(seller_id))');

            const { data: allOrders, error: ordersError } = await query;

            if (!ordersError && allOrders) {
                // Filter orders if user is a seller
                const filteredOrders = sellerId
                    ? allOrders.filter(o => o.order_items?.some(item => item.products?.seller_id === sellerId))
                    : allOrders;

                // Total Orders
                document.getElementById('total-orders').textContent = filteredOrders.length;

                // Pending Orders (including processing and shipped)
                const pendingOrders = filteredOrders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status?.toLowerCase()));
                document.getElementById('pending-orders').textContent = pendingOrders.length;

                // Revenue Calculation: 
                // Today's Revenue usually means value of orders placed today that are NOT cancelled or returned.
                // This gives a more "active" feel to the dashboard.

                let todayRevenue = 0;
                const todayStr = new Date().toISOString().split('T')[0];

                filteredOrders.forEach(order => {
                    const amount = Number(order.total_amount) || 0;
                    const orderDateStr = new Date(order.created_at).toISOString().split('T')[0];
                    const isToday = orderDateStr === todayStr;

                    if (isToday) {
                        // Exclude cancelled/returned from today's active revenue
                        if (order.status !== 'cancelled' && !['returned', 'return_refund'].includes(order.status)) {
                            const fee = Math.max((amount * pricingConfig.platformFee / 100), pricingConfig.minFee);
                            // Revenue for platform = fee, Revenue for seller = amount - fee
                            todayRevenue += sellerId ? (amount - fee) : fee;
                        } else if (['returned', 'return_refund'].includes(order.status)) {
                            // If it's a return, it doesn't add to revenue. 
                            // We don't subtract it from today's revenue unless it was previously counted.
                            // For simplicity in "Today's" view, we just ignore it or show it as 0.
                        }
                    }
                });

                const elTodayRev = document.getElementById('today-revenue');
                if (elTodayRev) {
                    elTodayRev.textContent = formatCurrency(Math.max(0, todayRevenue));
                }

                // Total Customers 
                // Logic: Count unique customer_emails from orders if 'customers' table is underpopulated
                const uniqueCustomersInOrders = new Set();
                filteredOrders.forEach(o => {
                    if (o.customer_email) uniqueCustomersInOrders.add(o.customer_email);
                });

                if (sellerId) {
                    document.getElementById('new-customers').textContent = uniqueCustomersInOrders.size;
                } else {
                    const { count: totalCustomers, error: customersError } = await client
                        .from('customers')
                        .select('*', { count: 'exact', head: true });

                    if (!customersError && totalCustomers > uniqueCustomersInOrders.size) {
                        document.getElementById('new-customers').textContent = totalCustomers;
                    } else {
                        // Fallback to unique emails from orders if customers table is empty or smaller
                        document.getElementById('new-customers').textContent = uniqueCustomersInOrders.size;
                    }
                }
            }

        } catch (err) {
            console.error("Error fetching stats:", err);
        }
    }

    // 2. Fetch Revenue Chart Data (Last 7 Days)
    async function fetchRevenueChart(days = 7) {
        try {
            const { data: { session } } = await client.auth.getSession();
            if (!session) return;

            const { data: roleData } = await client
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();

            const role = roleData ? roleData.role : null;
            let sellerId = null;

            if (role !== 'super_admin') {
                const { data: seller } = await client
                    .from('sellers')
                    .select('id')
                    .eq('email', session.user.email)
                    .maybeSingle();
                if (seller) sellerId = seller.id;
            }

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - (days - 1));
            if (days > 1) {
                startDate.setHours(0, 0, 0, 0);
            } else {
                // Today view - start from beginning of today
                startDate.setHours(0, 0, 0, 0);
            }

            let query = client
                .from('orders')
                .select('created_at, total_amount, status, order_items(products(seller_id))')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true });

            const { data: orders, error } = await query;
            if (error) throw error;

            const groupedData = {};
            const labels = [];

            if (days === 1) {
                // Hourly grouping for today
                for (let i = 0; i <= new Date().getHours(); i++) {
                    const label = i + ":00";
                    groupedData[label] = 0;
                    labels.push(label);
                }

                orders.forEach(order => {
                    if (sellerId && !order.order_items?.some(item => item.products?.seller_id === sellerId)) return;

                    // Exclude cancelled/returned from revenue chart
                    const status = order.status?.toLowerCase();
                    if (status === 'cancelled' || status === 'returned' || status === 'return_refund') return;

                    const hour = new Date(order.created_at).getHours();
                    const label = hour + ":00";
                    if (groupedData[label] !== undefined) {
                        const amount = Number(order.total_amount) || 0;
                        // Use same logic as fetchStats: Platform fee for super admin, earnings for seller
                        const fee = Math.max((amount * pricingConfig.platformFee / 100), pricingConfig.minFee);
                        const value = sellerId ? (amount - fee) : fee;
                        groupedData[label] += value;
                    }
                });
            } else {
                // Daily grouping
                for (let i = days - 1; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dateKey = d.toISOString().split('T')[0];
                    groupedData[dateKey] = 0;
                }

                orders.forEach(order => {
                    if (sellerId && !order.order_items?.some(item => item.products?.seller_id === sellerId)) return;

                    // Exclude cancelled/returned from revenue chart
                    const status = order.status?.toLowerCase();
                    if (status === 'cancelled' || status === 'returned' || status === 'return_refund') return;

                    const dateKey = new Date(order.created_at).toISOString().split('T')[0];
                    if (groupedData[dateKey] !== undefined) {
                        const amount = Number(order.total_amount) || 0;
                        const fee = Math.max((amount * pricingConfig.platformFee / 100), pricingConfig.minFee);
                        const value = sellerId ? (amount - fee) : fee;
                        groupedData[dateKey] += value;
                    }
                });

                Object.keys(groupedData).forEach(dateStr => {
                    labels.push(formatDate(dateStr));
                });
            }

            const data = Object.values(groupedData);
            renderRevenueChart(labels, data);

        } catch (err) {
            console.error("Error fetching revenue chart data:", err);
        }
    }

    function setupChartListeners() {
        const periodSelect = document.getElementById('revenue-period');
        if (periodSelect) {
            periodSelect.addEventListener('change', (e) => {
                fetchRevenueChart(Number(e.target.value));
            });
        }
    }

    // 3. Render Revenue Chart
    function renderRevenueChart(labels, data) {
        const ctx = document.getElementById('revenueChart').getContext('2d');

        if (revenueChartInstance) {
            revenueChartInstance.destroy();
        }

        revenueChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue',
                    data: data,
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { borderDash: [2, 4], color: '#e2e8f0' },
                        ticks: {
                            callback: function (value) {
                                return '₹' + value;
                            }
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // 4. Fetch Order Status Distribution
    async function fetchOrderStatusChart() {
        try {
            const { data: { session } } = await client.auth.getSession();
            if (!session) return;

            const { data: roleData } = await client
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();

            const role = roleData ? roleData.role : null;
            let sellerId = null;

            if (role !== 'super_admin') {
                const { data: seller } = await client
                    .from('sellers')
                    .select('id')
                    .eq('email', session.user.email)
                    .maybeSingle();
                if (seller) sellerId = seller.id;
            }

            let query = client.from('orders').select('status, order_items(products(seller_id))');
            const { data: orders, error } = await query;

            if (error) throw error;

            const statusCounts = {};
            orders.forEach(order => {
                if (sellerId && !order.order_items?.some(item => item.products?.seller_id === sellerId)) {
                    return;
                }
                const status = order.status || 'Unknown';
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });

            const labels = Object.keys(statusCounts);
            const data = Object.values(statusCounts);

            renderStatusChart(labels, data);

        } catch (err) {
            console.error("Error fetching status chart data:", err);
        }
    }

    // 5. Render Status Chart
    function renderStatusChart(labels, data) {
        const ctx = document.getElementById('orderStatusChart').getContext('2d');

        if (statusChartInstance) {
            statusChartInstance.destroy();
        }

        const colors = {
            'pending': '#f59e0b',
            'processing': '#3b82f6',
            'shipped': '#8b5cf6',
            'delivered': '#10b981',
            'cancelled': '#ef4444',
            'returned': '#64748b'
        };

        const bgColors = labels.map(label => colors[label.toLowerCase()] || '#cbd5e1');

        statusChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    // 6. Fetch Recent Orders
    async function fetchRecentOrders() {
        try {
            const { data: { session } } = await client.auth.getSession();
            if (!session) return;

            const { data: roleData } = await client
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();

            const role = roleData ? roleData.role : null;
            let sellerId = null;

            if (role !== 'super_admin') {
                const { data: seller } = await client
                    .from('sellers')
                    .select('id')
                    .eq('email', session.user.email)
                    .maybeSingle();
                if (seller) sellerId = seller.id;
            }

            let query = client
                .from('orders')
                .select('id, created_at, total_amount, status, customer_first_name, customer_last_name, order_items(products(seller_id))')
                .order('created_at', { ascending: false });

            const { data: allOrders, error } = await query;

            if (error) throw error;

            const filteredOrders = sellerId
                ? allOrders.filter(o => o.order_items?.some(item => item.products?.seller_id === sellerId))
                : allOrders;

            const orders = filteredOrders.slice(0, 5);

            const tbody = document.getElementById('recent-orders-table');
            tbody.innerHTML = '';

            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No orders found.</td></tr>';
                return;
            }

            orders.forEach(order => {
                const customerName = `${order.customer_first_name || ''} ${order.customer_last_name || ''}`.trim() || 'Guest';
                const statusBadge = getStatusBadge(order.status);

                const row = `
                    <tr>
                        <td class="fw-medium">#${order.id.toString().slice(0, 8)}...</td>
                        <td>${customerName}</td>
                        <td>${new Date(order.created_at).toLocaleDateString('en-IN')}</td>
                        <td class="fw-bold">${formatCurrency(order.total_amount)}</td>
                        <td>${statusBadge}</td>
                        <td>
                            <a href="orders.html?id=${order.id}" class="btn btn-sm btn-light text-primary">
                                <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
                            </a>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
            });

            // Re-init icons for dynamic content
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

        } catch (err) {
            console.error("Error fetching recent orders:", err);
            document.getElementById('recent-orders-table').innerHTML =
                '<tr><td colspan="6" class="text-center py-4 text-danger">Failed to load orders.</td></tr>';
        }
    }

    function getStatusBadge(status) {
        const styles = {
            'pending': 'bg-warning-subtle text-warning-emphasis',
            'processing': 'bg-primary-subtle text-primary-emphasis',
            'shipped': 'bg-info-subtle text-info-emphasis',
            'delivered': 'bg-success-subtle text-success-emphasis',
            'cancelled': 'bg-danger-subtle text-danger-emphasis',
            'returned': 'bg-secondary-subtle text-secondary-emphasis'
        };
        const style = styles[status?.toLowerCase()] || 'bg-light text-muted';
        return `<span class="badge ${style}">${status}</span>`;
    }

    // Start
    // 7. Quick Links / Quick Actions Logic
    async function initQuickLinks() {
        const grid = document.getElementById('quick-links');
        if (!grid) return;

        // Get Permissions
        let allowedPages = [];
        try {
            const { data: { session } } = await client.auth.getSession();
            if (session) {
                const { data: roleData } = await client
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', session.user.id)
                    .single();

                if (roleData) {
                    const role = roleData.role;
                    if (role === 'super_admin') {
                        allowedPages = 'ALL';
                    } else {
                        const { data: permData } = await client
                            .from('role_permissions')
                            .select('accessible_pages')
                            .eq('role_name', role)
                            .single();
                        allowedPages = permData ? permData.accessible_pages : [];
                    }
                }
            }
        } catch (err) {
            console.error("Error fetching permissions for quick links:", err);
        }

        // Define App Icons
        const appIcons = [
            {
                label: 'Orders',
                href: 'orders.html',
                icon: 'shopping-cart',
                countTable: 'orders',
                countFilter: { col: 'status', val: 'pending' }
            },
            {
                label: 'Returns',
                href: 'returns.html',
                icon: 'corner-down-left',
                countTable: 'returns',
                countFilter: { col: 'status', val: 'pending' }
            },
            {
                label: 'Products',
                href: 'products.html',
                icon: 'package',
                countTable: null
            },
            {
                label: 'Product Approvals',
                href: 'product-approval.html',
                icon: 'check-square',
                countTable: 'products',
                countFilter: { col: 'status', val: 'pending_approval' }
            },
            {
                label: 'Customers',
                href: 'customers.html',
                icon: 'users',
                countTable: null
            },
            {
                label: 'Sellers',
                href: 'sellers.html',
                icon: 'store',
                countTable: null
            },
            {
                label: 'New Sellers',
                href: 'pending-sellers.html',
                icon: 'user-plus',
                countTable: 'sellers',
                countFilter: { col: 'status', val: 'pending' }
            },
            {
                label: 'Payouts',
                href: 'seller-payouts.html',
                icon: 'wallet',
                countTable: 'seller_payouts',
                countFilter: { col: 'status', val: ['requested', 'approval_pending'] }
            },
            {
                label: 'Settings',
                href: 'settings.html',
                icon: 'settings',
                countTable: null
            }
        ];

        // Filter & Render
        grid.innerHTML = '';
        let hasIcons = false;

        for (const item of appIcons) {
            // Check visibility
            if (allowedPages !== 'ALL') {
                const filename = item.href.split('?')[0];
                if (!allowedPages.includes(filename)) {
                    continue;
                }
            }

            hasIcons = true;
            const bubbleId = `bubble-${item.label.replace(/\s+/g, '-')}`;

            const card = document.createElement('a');
            card.href = item.href;
            card.className = 'quick-access-card';
            card.innerHTML = `
                <div class="quick-access-icon">
                    <i data-lucide="${item.icon}"></i>
                    ${item.countTable ? `<span class="icon-bubble d-none" id="${bubbleId}">0</span>` : ''}
                </div>
                <span class="quick-access-label">${item.label}</span>
            `;
            grid.appendChild(card);

            if (item.countTable) {
                fetchQuickLinkCount(item.countTable, item.countFilter, bubbleId);
            }
        }

        if (!hasIcons) {
            grid.innerHTML = '<p class="text-muted col-12">No quick actions available.</p>';
        }

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async function fetchQuickLinkCount(table, filter, elementId) {
        try {
            let query = client
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (Array.isArray(filter.val)) {
                query = query.in(filter.col, filter.val);
            } else {
                query = query.eq(filter.col, filter.val);
            }

            const { count, error } = await query;

            if (!error && count > 0) {
                const el = document.getElementById(elementId);
                if (el) {
                    el.textContent = count > 99 ? '99+' : count;
                    el.classList.remove('d-none');
                }
            }
        } catch (e) {
            console.error(`Error fetching count for ${table}:`, e);
        }
    }

    // Start
    initDashboard();
    initQuickLinks();
});
