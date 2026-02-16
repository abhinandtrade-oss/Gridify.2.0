/**
 * Global Search Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const searchInput = document.getElementById('global-search-input');
    const loader = document.getElementById('searching-loader');
    const noResultsMsg = document.getElementById('no-results-msg');
    const initialMsg = document.getElementById('initial-msg');

    // Sections
    const sectionOrders = document.getElementById('results-orders');
    const sectionProducts = document.getElementById('results-products');
    const sectionReturns = document.getElementById('results-returns');

    // Grids
    const gridOrders = document.getElementById('grid-orders');
    const gridProducts = document.getElementById('grid-products');
    const gridReturns = document.getElementById('grid-returns');

    // Counts
    const countOrders = document.getElementById('count-orders');
    const countProducts = document.getElementById('count-products');
    const countReturns = document.getElementById('count-returns');

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        let query = e.target.value.trim();
        if (query.startsWith('#')) query = query.substring(1);

        clearTimeout(debounceTimer);

        if (query.length < 3) {
            hideAllSections();
            initialMsg.style.display = 'block';
            noResultsMsg.style.display = 'none';
            loader.style.display = 'none';
            return;
        }

        initialMsg.style.display = 'none';
        loader.style.display = 'block';
        noResultsMsg.style.display = 'none';

        debounceTimer = setTimeout(() => {
            performGlobalSearch(query);
        }, 500);
    });

    async function performGlobalSearch(query) {
        console.log('Searching for:', query);

        try {
            // Execute searches in parallel but catch errors individually to prevent crashing
            const searchPromises = [
                searchOrders(query),
                searchProducts(query),
                searchReturns(query)
            ];

            const [orders, products, returns] = await Promise.all(searchPromises);

            loader.style.display = 'none';
            renderResults({ orders, products, returns });

        } catch (err) {
            console.error('Global Search failed:', err);
            loader.style.display = 'none';
        }
    }

    async function searchOrders(query) {
        try {
            // Build filter string carefully. 
            // Avoid ilike on uuid 'id' column to prevent database errors (22P02)
            let conditions = [
                `customer_email.ilike.%${query}%`,
                `customer_first_name.ilike.%${query}%`,
                `customer_last_name.ilike.%${query}%`
            ];

            // If query looks like a phone number
            if (/^\d+$/.test(query)) {
                conditions.push(`customer_phone.ilike.%${query}%`);
            }

            let { data, error } = await client
                .from('orders')
                .select('*')
                .or(conditions.join(','))
                .limit(10);

            // If nothing found in text fields, and it looks like a hex string (ID)
            // try an exact match on ID if it's long enough
            if ((!data || data.length === 0) && query.length >= 8 && /^[0-9a-fA-F-]+$/.test(query)) {
                const { data: idData } = await client
                    .from('orders')
                    .select('*')
                    .eq('id', query) // Exact match for UUID
                    .limit(1);

                if (idData && idData.length > 0) return idData;

                // If still nothing, maybe it's the start of a UUID?
                // Note: Standard Supabase doesn't support ilike on uuid without rpc.
                // We'll try to fetch all recent orders and filter in JS as a last resort for ID search
                const { data: recent } = await client
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (recent) {
                    return recent.filter(o => o.id.startsWith(query.toLowerCase()));
                }
            }

            return data || [];
        } catch (e) {
            console.warn('Order search error:', e);
            return [];
        }
    }

    async function searchProducts(query) {
        try {
            const { data } = await client
                .from('products')
                .select('*')
                .or(`sku.ilike.%${query}%,name.ilike.%${query}%`)
                .limit(10);
            return data || [];
        } catch (e) {
            return [];
        }
    }

    async function searchReturns(query) {
        try {
            // Simplify select to ensure it works
            let { data, error } = await client
                .from('returns')
                .select('*, orders:order_id(id, customer_email, customer_first_name, customer_last_name)')
                .or(`reason.ilike.%${query}%`)
                .limit(10);

            // Same JS fallback for Return ID search
            if ((!data || data.length === 0) && query.length >= 8 && /^[0-9a-fA-F-]+$/.test(query)) {
                const { data: recentReturns } = await client
                    .from('returns')
                    .select('*, orders:order_id(id, customer_email, customer_first_name, customer_last_name)')
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (recentReturns) {
                    return recentReturns.filter(r =>
                        r.id.startsWith(query.toLowerCase()) ||
                        r.order_id.startsWith(query.toLowerCase())
                    );
                }
            }

            return data || [];
        } catch (e) {
            console.warn('Return search error:', e);
            return [];
        }
    }

    function renderResults(results) {
        let totalCount = 0;

        // Render Orders
        if (results.orders.length > 0) {
            sectionOrders.style.display = 'block';
            countOrders.textContent = results.orders.length;
            gridOrders.innerHTML = results.orders.map(order => `
                <div class="result-card" onclick="window.location.href='orders.html?id=${order.id}'">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge-type type-order">Order</span>
                        <span class="text-muted small">${new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="fw-bold mb-1">ID: #${order.id.substring(0, 8)}</div>
                    <div class="text-main mb-1">${order.customer_first_name} ${order.customer_last_name}</div>
                    <div class="small text-muted mb-2">${order.customer_email}</div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="fw-bold text-primary">₹${(order.total_amount || 0).toLocaleString()}</span>
                        <span class="badge bg-light text-dark border small">${(order.status || 'PENDING').toUpperCase()}</span>
                    </div>
                </div>
            `).join('');
            totalCount += results.orders.length;
        } else {
            sectionOrders.style.display = 'none';
        }

        // Render Products
        if (results.products.length > 0) {
            sectionProducts.style.display = 'block';
            countProducts.textContent = results.products.length;
            gridProducts.innerHTML = results.products.map(p => {
                let imgUrl = '../assets/img/placeholder.png';
                if (p.images) {
                    const imgs = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
                    if (Array.isArray(imgs) && imgs.length > 0) imgUrl = imgs[0].url || imgs[0];
                }
                return `
                    <div class="result-card" onclick="window.location.href='edit-marketplace-product.html?id=${p.id}'">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge-type type-product">Product</span>
                            <span class="text-muted small">SKU: ${p.sku}</span>
                        </div>
                        <div class="d-flex gap-3">
                            <img src="${imgUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;" onerror="this.src='../assets/img/placeholder.png'">
                            <div>
                                <div class="fw-bold mb-0">${p.name}</div>
                                <div class="text-primary fw-bold">₹${parseFloat(p.selling_price || 0).toLocaleString()}</div>
                                <div class="small text-muted">Stock: ${p.stock_quantity}</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            totalCount += results.products.length;
        } else {
            sectionProducts.style.display = 'none';
        }

        // Render Returns
        if (results.returns.length > 0) {
            sectionReturns.style.display = 'block';
            countReturns.textContent = results.returns.length;
            gridReturns.innerHTML = results.returns.map(ret => {
                const customer = ret.orders ? `${ret.orders.customer_first_name} ${ret.orders.customer_last_name}` : 'Unknown';
                return `
                    <div class="result-card" onclick="window.location.href='returns.html?id=${ret.id}'">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <span class="badge-type type-return">Return</span>
                            <span class="text-muted small">${new Date(ret.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="fw-bold mb-1">Return: #${ret.id.substring(0, 8)}</div>
                        <div class="small text-muted mb-2">Order: #${ret.order_id.substring(0, 8)}</div>
                        <div class="text-truncate mb-2" style="max-width: 100%; font-size: 0.85rem; color: #64748b;">"${ret.reason}"</div>
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="badge bg-light text-dark border small">${(ret.status || 'PENDING').toUpperCase()}</span>
                        </div>
                    </div>
                `;
            }).join('');
            totalCount += results.returns.length;
        } else {
            sectionReturns.style.display = 'none';
        }

        if (totalCount === 0) {
            noResultsMsg.style.display = 'block';
        } else {
            noResultsMsg.style.display = 'none';
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function hideAllSections() {
        sectionOrders.style.display = 'none';
        sectionProducts.style.display = 'none';
        sectionReturns.style.display = 'none';
    }
});
