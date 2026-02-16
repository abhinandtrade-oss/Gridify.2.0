document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;

    // UI Elements
    const supplierSelect = document.getElementById('supplier-select');
    const dateStartInput = document.getElementById('date-start');
    const dateEndInput = document.getElementById('date-end');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnPrint = document.getElementById('btn-print');
    const btnExport = document.getElementById('btn-export-csv');

    // Stats Elements
    const elTotalRev = document.getElementById('total-revenue');
    const elFees = document.getElementById('platform-fees');
    const elEarnings = document.getElementById('supplier-earnings');
    const elRefunds = document.getElementById('total-refunds');
    const elPendingRev = document.getElementById('pending-revenue'); // Added in HTML?

    // Tables
    const supplierTableBody = document.getElementById('supplier-table-body');
    const ledgerTableBody = document.getElementById('ledger-table-body');
    const payoutTableBody = document.getElementById('payout-table-body');

    // State
    let pricingConfig = { platformFee: 0, minFee: 0, gstRate: 18 };
    let currentData = {
        orders: [],
        sellers: {},
        summary: {},
        supplierLedger: [],
        transactions: [],
        payouts: []
    };
    // Used for filtering raw data without re-fetching
    let rawOrders = [];
    let rawPayouts = []; // Added declaration
    let sellerMapRef = {};

    // Initialize Dates (Local time)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const toISODate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    dateStartInput.value = toISODate(startOfMonth);
    dateEndInput.value = toISODate(now);

    // --- Core Logic ---

    async function init() {
        await loadPricingConfig();
        await loadData();
        setupEventListeners();
    }

    async function loadPricingConfig() {
        try {
            const { data } = await client
                .from('site_settings')
                .select('value')
                .eq('key', 'pricing_config')
                .maybeSingle();

            if (data && data.value) {
                const cfg = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                pricingConfig = {
                    platformFee: Number(cfg.platformFee) || 0,
                    minFee: Number(cfg.minFee) || 0,
                    gstRate: Number(cfg.gstRate) || 18
                };
            }
        } catch (e) {
            console.error("Using default pricing config", e);
        }
    }

    async function loadData() {
        setLoading(true);

        const startDate = new Date(dateStartInput.value);
        const endDate = new Date(dateEndInput.value);
        endDate.setHours(23, 59, 59, 999);

        try {
            // Try Server-Side RPC first
            /* 
            // Commenting out RPC call for now as I cannot guarantee the user runs the SQL.
            // I will implement client-side logic to ensure functionality, 
            // but the SQL file is provided for production use.
            const { data: summary, error } = await client.rpc('get_accounts_summary', { 
                p_start_date: startDate.toISOString(), 
                p_end_date: endDate.toISOString() 
            });
            */

            // Client-Side Implementation (Fallback/Demo Mode)
            // 1. Fetch Orders
            // Fetch ALL orders for the period first, then filter locally
            const { data: orders, error: ordersError } = await client
                .from('orders')
                .select('*, order_items(product_id, products(seller_id))')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;
            rawOrders = orders;

            // 1.1 Fetch Payouts
            const { data: payouts, error: payoutsError } = await client
                .from('seller_payouts')
                .select(`
                    *,
                    sellers (
                        store_name
                    )
                `)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .order('created_at', { ascending: false });

            if (payoutsError) {
                console.error("Error fetching payouts:", payoutsError);
                rawPayouts = [];
            } else {
                rawPayouts = payouts || [];
            }

            // 2. Fetch Sellers Map
            const { data: sellersData } = await client.from('sellers').select('id, store_name');
            const sellerMap = {};
            if (sellersData) {
                // Populate Dropdown if empty (first load)
                if (supplierSelect.options.length <= 1) {
                    sellersData.forEach(s => {
                        sellerMap[s.id] = s.store_name;
                        const opt = document.createElement('option');
                        opt.value = s.id;
                        opt.textContent = s.store_name;
                        supplierSelect.appendChild(opt);
                    });
                } else {
                    // Just update map
                    sellersData.forEach(s => sellerMap[s.id] = s.store_name);
                }
            }
            sellerMapRef = sellerMap;

            // 3. Process Logic with Filter
            filterAndProcessData();

        } catch (err) {
            console.error("Error loading accounts data:", err);
            alert("Failed to load financial data.");
        } finally {
            setLoading(false);
        }
    }

    function filterAndProcessData() {
        const selectedSellerId = supplierSelect.value;
        let filteredOrders = rawOrders;
        let filteredPayouts = rawPayouts;

        if (selectedSellerId !== 'all') {
            filteredOrders = rawOrders.filter(order => {
                // Determine order seller
                if (order.order_items && order.order_items.length > 0) {
                    const firstItem = order.order_items[0];
                    if (firstItem.products && firstItem.products.seller_id) {
                        return firstItem.products.seller_id === selectedSellerId;
                    }
                }
                return false;
            });

            filteredPayouts = rawPayouts.filter(p => p.seller_id === selectedSellerId);
        }

        processFinancials(filteredOrders, sellerMapRef, filteredPayouts);
        renderUI();
    }

    function processFinancials(orders, sellerMap, payouts = []) {
        let stats = {
            revenue: 0,
            fees: 0,
            earnings: 0,
            refunds: 0,
            pending: 0
        };

        const supplierStats = {};
        const transactions = [];

        // 1. Process Payouts
        payouts.forEach(p => {
            const sellerId = p.seller_id;
            const sellerName = sellerMap[sellerId] || 'Unknown';
            const amount = parseFloat(p.total_payable || p.amount || 0);
            const status = p.status?.toLowerCase() || 'requested';

            // Track in supplier ledger
            if (!supplierStats[sellerName]) supplierStats[sellerName] = initSuppStat();

            // Only 'paid' impacts the balance
            if (status === 'paid') {
                stats.earnings -= amount;
                supplierStats[sellerName].paid += amount;
                supplierStats[sellerName].net -= amount;
            }

            // All payouts go to the ledger if they aren't 'cancelled'
            if (status !== 'cancelled') {
                transactions.push({
                    id: p.id,
                    date: p.created_at || new Date().toISOString(),
                    supplier: sellerName,
                    status: p.status,
                    gross: 0,
                    fee: 0,
                    refund_deduct: 0,
                    earning: 0,
                    net: status === 'paid' ? -amount : 0,
                    isPayout: true,
                    amount: amount
                });
            }
        });

        // 2. Process Orders
        orders.forEach(order => {
            // Identify Seller 
            let sellerId = null;
            let sellerName = 'Unknown Supplier';

            if (order.order_items && order.order_items.length > 0) {
                const firstItem = order.order_items[0];
                if (firstItem.products && firstItem.products.seller_id) {
                    sellerId = firstItem.products.seller_id;
                    sellerName = sellerMap[sellerId] || 'Unknown';
                }
            }

            // Calc Fee
            const rawFee = Math.max(
                (order.total_amount * pricingConfig.platformFee / 100),
                pricingConfig.minFee
            );
            const gst = 0;

            // Transaction Entry
            let tx = {
                id: order.id,
                date: order.created_at,
                supplier: sellerName,
                status: order.status,
                gross: order.total_amount, // Keep actual amount here
                fee: 0,
                earning: 0,
                refund_deduct: 0,
                net: 0
            };

            const status = order.status?.toLowerCase() || 'pending';

            // Status Logic
            if (status === 'delivered') {
                // Gross GMV (Total value of successful transactions)
                stats.revenue += order.total_amount;
                stats.fees += rawFee;
                stats.earnings += (order.total_amount - rawFee);

                tx.fee = rawFee;
                tx.refund_deduct = 0;
                tx.earning = tx.gross - tx.fee - tx.refund_deduct;
                tx.net = tx.earning;

                if (!supplierStats[sellerName]) supplierStats[sellerName] = initSuppStat();
                supplierStats[sellerName].orders++;
                supplierStats[sellerName].sales += order.total_amount;
                supplierStats[sellerName].fees += rawFee;
                supplierStats[sellerName].net += (order.total_amount - rawFee);

            } else if (['return_refund', 'returned'].includes(status)) {
                // Returns do not count towards Gross GMV, but platform keeps the fee
                // Net impact: Sale is reversed, fees remain
                stats.revenue += 0;
                stats.earnings += (0 - rawFee);
                stats.fees += rawFee;
                stats.refunds += order.total_amount;

                tx.fee = rawFee; // Platform keeps the fee
                tx.refund_deduct = order.total_amount;
                tx.earning = tx.gross - tx.fee - tx.refund_deduct; // Result: -rawFee
                tx.net = tx.earning;

                if (!supplierStats[sellerName]) supplierStats[sellerName] = initSuppStat();
                supplierStats[sellerName].sales += order.total_amount; // Gross Sales still shows the original volume
                supplierStats[sellerName].refunds += order.total_amount;
                supplierStats[sellerName].fees += rawFee;
                supplierStats[sellerName].net += (tx.earning);

            } else if (['pending', 'processing', 'shipped', 'pending_approval'].includes(status)) {
                // Any status that is not delivered/returned/cancelled is considered pending if it's not explicitly failed
                if (order.status?.toLowerCase() !== 'cancelled' && order.status?.toLowerCase() !== 'delivery_failed') {
                    stats.pending += order.total_amount;

                    tx.fee = 0;
                    tx.refund_deduct = 0;
                    tx.earning = 0; // Not earned yet
                    tx.net = 0;

                    if (!supplierStats[sellerName]) supplierStats[sellerName] = initSuppStat();
                    supplierStats[sellerName].pending += order.total_amount;
                }
            }

            transactions.push(tx);
        });

        // Convert Supplier Stats to Array
        const supplierLedger = Object.keys(supplierStats).map(name => ({
            name,
            ...supplierStats[name]
        }));

        // Sort transactions by date (descending)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        currentData = {
            orders,
            summary: stats,
            supplierLedger,
            transactions,
            payouts: payouts.filter(p => p.status !== 'cancelled') // Show all active/paid payouts
        };
    }

    function initSuppStat() {
        return { orders: 0, sales: 0, refunds: 0, fees: 0, net: 0, pending: 0, paid: 0 };
    }

    function renderUI() {
        // Update Label based on Filter
        const selectedSellerId = supplierSelect.value;
        const revenueLabel = document.querySelector('.stat-card:nth-child(1) .stat-label');
        if (revenueLabel) {
            revenueLabel.textContent = selectedSellerId === 'all' ? 'Overall Revenue' : 'Actual Revenue';
        }

        // 1. Stats
        // Capping Revenue and Earnings at 0 for the card display as per user request
        elTotalRev.textContent = formatMoney(Math.max(0, currentData.summary.revenue));
        elFees.textContent = formatMoney(currentData.summary.fees); // Base Fee only
        elEarnings.textContent = formatMoney(Math.max(0, currentData.summary.earnings));
        elRefunds.textContent = formatMoney(currentData.summary.refunds);
        const elPending = document.getElementById('pending-revenue');
        if (elPending) elPending.textContent = formatMoney(currentData.summary.pending);

        // 2. Supplier Table
        supplierTableBody.innerHTML = '';
        if (currentData.supplierLedger.length === 0) {
            supplierTableBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No data found.</td></tr>';
        } else {
            currentData.supplierLedger.forEach(s => {
                const netClass = s.net < 0 ? 'text-danger' : 'text-success';
                const row = `
                    <tr>
                        <td class="fw-medium">${s.name}</td>
                        <td class="text-center">${s.orders}</td>
                        <td class="text-end">${formatMoney(s.sales)}</td>
                        <td class="text-end text-danger">${formatMoney(s.refunds)}</td>
                        <td class="text-end">${formatMoney(s.fees)}</td>
                        <td class="text-end text-danger">${formatMoney(s.paid)}</td>
                        <td class="text-end fw-bold ${netClass}">${formatMoney(s.net)}</td>
                        <td class="text-end text-muted">${formatMoney(s.pending)}</td>
                    </tr>
                `;
                supplierTableBody.insertAdjacentHTML('beforeend', row);
            });
        }

        // 3. Ledger Table
        ledgerTableBody.innerHTML = '';
        if (currentData.transactions.length === 0) {
            ledgerTableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No transactions found.</td></tr>';
        } else {
            currentData.transactions.forEach(t => {
                const date = new Date(t.date).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });

                if (t.isPayout) {
                    const statusClass = t.status === 'paid' ? 'text-danger' : 'text-muted';
                    const netClass = t.status === 'paid' ? 'text-danger' : '';
                    const row = `
                        <tr class="table-light">
                            <td class="fw-medium text-primary">PAYMENT</td>
                            <td>${date}</td>
                            <td>${t.supplier}</td>
                            <td>${getStatusBadge(t.status)}</td>
                            <td class="text-end text-muted">-</td>
                            <td class="text-end text-muted">-</td>
                            <td class="text-end text-muted">-</td>
                            <td class="text-end fw-bold ${statusClass}">${t.status === 'paid' ? '-' : ''}${formatMoney(t.amount)}</td>
                            <td class="text-end fw-bold ${netClass}">${t.status === 'paid' ? '-' : ''}${formatMoney(t.status === 'paid' ? t.amount : 0)}</td>
                        </tr>
                    `;
                    ledgerTableBody.insertAdjacentHTML('beforeend', row);
                } else {
                    const netClass = t.net < 0 ? 'text-danger' : (t.net > 0 ? 'text-success' : '');
                    const feeClass = t.fee < 0 ? 'text-danger' : '';
                    const earnClass = t.earning < 0 ? 'text-danger' : '';

                    // Refund Ded
                    const refundDedDisplay = t.refund_deduct
                        ? `<span class="text-danger">-${formatMoney(t.refund_deduct)}</span>`
                        : '<span class="text-muted">-</span>';

                    const row = `
                        <tr>
                            <td class="fw-medium">#${t.id.slice(0, 8)}</td>
                            <td>${date}</td>
                            <td>${t.supplier}</td>
                            <td>${getStatusBadge(t.status)}</td>
                            <td class="text-end">${formatMoney(t.gross)}</td>
                            <td class="text-end ${feeClass}">${formatMoney(t.fee)}</td>
                            <td class="text-end">${refundDedDisplay}</td>
                            <td class="text-end ${earnClass}">${formatMoney(t.earning)}</td>
                            <td class="text-end fw-bold ${netClass}">${formatMoney(t.net)}</td>
                        </tr>
                    `;
                    ledgerTableBody.insertAdjacentHTML('beforeend', row);
                }
            });
        }

        // 4. Payout Table
        if (payoutTableBody) {
            payoutTableBody.innerHTML = '';
            if (currentData.payouts.length === 0) {
                payoutTableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-5 text-muted">
                            <div class="mb-2">
                                <i data-lucide="info" style="width: 32px; height: 32px; opacity: 0.5;"></i>
                            </div>
                            No settlement records found for this period.
                        </td>
                    </tr>`;
                if (window.lucide) lucide.createIcons();
            } else {
                currentData.payouts.forEach(p => {
                    const date = new Date(p.created_at).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                    const amount = parseFloat(p.total_payable || p.amount || 0);
                    const row = `
                        <tr>
                            <td class="text-nowrap">${date}</td>
                            <td class="fw-medium">${p.sellers?.store_name || 'Unknown'}</td>
                            <td class="text-end fw-bold">${formatMoney(amount)}</td>
                            <td class="text-center">${getStatusBadge(p.status)}</td>
                            <td class="font-monospace small text-muted">${p.transaction_id || '---'}</td>
                        </tr>
                    `;
                    payoutTableBody.insertAdjacentHTML('beforeend', row);
                });
                if (window.lucide) lucide.createIcons();
            }
        }

        renderCharts();
    }

    let revenueChart = null;
    let distributionChart = null;

    function renderCharts() {
        // Prepare Data
        const labels = ['Revenue', 'Platform Fees', 'Supplier Net', 'Refunds'];
        const values = [
            currentData.summary.revenue,
            currentData.summary.fees,
            currentData.summary.earnings,
            currentData.summary.refunds
        ];

        // 1. Revenue Breakdown (Bar)
        const ctx1 = document.getElementById('revenueBreakdownChart').getContext('2d');
        if (revenueChart) revenueChart.destroy();

        revenueChart = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Amount (₹)',
                    data: values,
                    backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });

        // 2. Distribution (Doughnut)
        const ctx2 = document.getElementById('distributionChart').getContext('2d');
        if (distributionChart) distributionChart.destroy();

        distributionChart = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Platform Fees', 'Supplier Net'],
                datasets: [{
                    data: [currentData.summary.fees, currentData.summary.earnings],
                    backgroundColor: ['#10b981', '#f59e0b'],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    // Helpers
    function getStatusBadge(status) {
        const styles = {
            'pending': 'bg-warning-subtle text-warning-emphasis',
            'processing': 'bg-primary-subtle text-primary-emphasis',
            'shipped': 'bg-info-subtle text-info-emphasis',
            'delivered': 'bg-success-subtle text-success-emphasis',
            'cancelled': 'bg-danger-subtle text-danger-emphasis',
            'returned': 'bg-secondary-subtle text-secondary-emphasis',
            'return_refund': 'bg-danger-subtle text-danger-emphasis',
            'return_replacement': 'bg-info-subtle text-info-emphasis',
            'requested': 'bg-warning-subtle text-warning-emphasis',
            'processing': 'bg-info-subtle text-info-emphasis',
            'approval_pending': 'bg-primary-subtle text-primary-emphasis',
            'paid': 'bg-success-subtle text-success-emphasis'
        };
        const cleanStatus = status?.trim();
        const label = cleanStatus ? cleanStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Pending';
        const style = styles[cleanStatus?.toLowerCase()] || 'bg-light text-muted border';
        return `<span class="badge ${style}">${label}</span>`;
    }

    function formatMoney(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    }

    function setLoading(isLoading) {
        if (isLoading) {
            btnRefresh.disabled = true;
            btnRefresh.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        } else {
            btnRefresh.disabled = false;
            btnRefresh.innerHTML = '<i data-lucide="refresh-cw" style="width: 14px; height: 14px;"></i> Refresh';
            if (window.lucide) lucide.createIcons();
        }
    }

    function setupEventListeners() {
        btnRefresh.addEventListener('click', loadData);
        supplierSelect.addEventListener('change', filterAndProcessData);

        dateStartInput.addEventListener('change', loadData);
        dateEndInput.addEventListener('change', loadData);

        btnExport.addEventListener('click', exportCSV);
        btnPrint.addEventListener('click', () => window.print());
    }

    function exportCSV() {
        const rows = [];
        // Headers
        rows.push(['Order ID', 'Date', 'Supplier', 'Status', 'Gross Amount', 'Platform Fee', 'Supplier Earning', 'Net Impact']);

        currentData.transactions.forEach(t => {
            rows.push([
                t.id,
                new Date(t.date).toLocaleDateString(),
                t.supplier,
                t.status,
                t.gross,
                t.fee,
                t.earning,
                t.net
            ]);
        });

        let csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "financial_ledger.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Start
    init();
});
