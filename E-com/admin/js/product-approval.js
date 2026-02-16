/**
 * Admin: Product Approval Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const productList = document.getElementById('pending-product-list');
    const productModal = new bootstrap.Modal(document.getElementById('productModal'));
    const detailsContent = document.getElementById('product-details-content');
    const btnApprove = document.getElementById('btn-approve-modal');
    const btnReject = document.getElementById('btn-reject-modal');

    let currentProduct = null;
    let allProducts = [];

    async function init() {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;
        loadPendingProducts();
    }

    async function loadPendingProducts() {
        productList.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div class="spinner-border spinner-border-sm text-primary"></div>
                    <span class="ms-2">Fetching products...</span>
                </td>
            </tr>
        `;

        const { data, error } = await client
            .from('products')
            .select(`
                *,
                sellers (store_name),
                categories (name)
            `)
            .eq('status', 'pending_approval')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error:', error);
            productList.innerHTML = `<tr><td colspan="6" class="empty-state text-danger">Error: ${error.message}</td></tr>`;
            return;
        }

        allProducts = data;
        renderProducts(data);
    }

    function renderProducts(products) {
        if (!products || products.length === 0) {
            productList.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i data-lucide="check-circle" style="color: #10b981; width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                        <p>All clear! No products waiting for approval.</p>
                    </td>
                </tr>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        productList.innerHTML = products.map(p => {
            const mainImg = p.images && p.images.length > 0 ? p.images.sort((a, b) => a.arrangement - b.arrangement)[0].url : '';
            const isUpdate = !!p.previous_data;
            const badge = isUpdate
                ? '<span class="badge bg-warning text-dark ms-2" style="font-size: 0.7em;">Update</span>'
                : '<span class="badge bg-success ms-2" style="font-size: 0.7em;">New</span>';

            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center gap-3">
                            <img src="${mainImg}" class="product-img" onerror="this.src='../assets/img/placeholder.png'">
                            <div>
                                <div class="fw-bold text-main">
                                    ${p.name}
                                    ${badge}
                                </div>
                                <div class="text-muted small">${p.sku}</div>
                            </div>
                        </div>
                    </td>
                    <td><div class="text-muted small">${p.sellers?.store_name || 'N/A'}</div></td>
                    <td><span class="badge bg-light text-dark fw-normal">${p.categories?.name || 'Uncategorized'}</span></td>
                    <td>
                        <div class="price-tag">₹${parseFloat(p.selling_price).toLocaleString()}</div>
                        <div class="mrp-tag">₹${parseFloat(p.mrp).toLocaleString()}</div>
                    </td>
                    <td>${p.stock_quantity}</td>
                    <td>
                        <div class="action-btns justify-content-end">
                            <button class="btn-icon view-btn" data-id="${p.id}" title="Review Details">
                                <i data-lucide="eye"></i>
                            </button>
                            <button class="btn-icon text-success approve-btn" data-id="${p.id}" title="Quick Approve">
                                <i data-lucide="check"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
        attachEvents();
    }

    function attachEvents() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const product = allProducts.find(p => p.id === id);
                if (product) showDetails(product);
            });
        });

        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const product = allProducts.find(p => p.id === id);
                if (confirm(`Approve "${product.name}"?`)) {
                    await updateStatus(id, 'active');
                }
            });
        });
    }

    function showDetails(p) {
        currentProduct = p;
        if (p.previous_data) {
            detailsContent.innerHTML = renderComparison(p);
        } else {
            detailsContent.innerHTML = renderStandard(p);
        }
        productModal.show();
    }

    function renderStandard(p) {
        const mainImg = p.images && p.images.length > 0 ? p.images.sort((a, b) => a.arrangement - b.arrangement)[0].url : '';

        return `
            <div class="row">
                <div class="col-md-5">
                    <img src="${mainImg}" class="img-fluid rounded shadow-sm mb-3" onerror="this.src='../assets/img/placeholder.png'">
                    <div class="d-flex gap-2 overflow-auto pb-2">
                        ${p.images.slice(1).map(img => `<img src="${img.url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">`).join('')}
                    </div>
                </div>
                <div class="col-md-7">
                    <h4 class="mb-1">${p.name}</h4>
                    <p class="text-muted small mb-3">SKU: ${p.sku} | Category: ${p.categories?.name || 'N/A'}</p>
                    
                    <div class="bg-light p-3 rounded mb-3">
                        <div class="row">
                            <div class="col-6">
                                <span class="small text-muted d-block">Selling Price</span>
                                <span class="h5 mb-0 text-primary">₹${parseFloat(p.selling_price).toLocaleString()}</span>
                            </div>
                            <div class="col-6">
                                <span class="small text-muted d-block">MRP</span>
                                <span class="h5 mb-0 text-decoration-line-through text-muted">₹${parseFloat(p.mrp).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <h6 class="fw-bold small text-uppercase">Description</h6>
                        <p class="small text-secondary mb-0">${p.description || 'No description provided.'}</p>
                    </div>

                    <div class="mb-3">
                        <h6 class="fw-bold small text-uppercase">Keywords</h6>
                        <p class="small text-secondary mb-0">${p.keywords || 'No keywords provided.'}</p>
                    </div>

                    <div class="row small">
                        <div class="col-6"><strong>Stock:</strong> ${p.stock_quantity}</div>
                        <div class="col-6"><strong>Seller:</strong> ${p.sellers?.store_name || 'N/A'}</div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderComparison(p) {
        const old = p.previous_data;
        const mainImg = p.images && p.images.length > 0 ? p.images[0].url : '';

        // Helper to compare fields
        const diff = (label, oldVal, newVal, isPrice = false) => {
            if (oldVal == newVal) return ''; // Don't show if same
            const format = (v) => isPrice ? `₹${parseFloat(v).toLocaleString()}` : v;
            return `
                <div class="mb-3 border-bottom pb-2">
                    <h6 class="fw-bold small text-muted text-uppercase mb-1">${label} Changed</h6>
                    <div class="row">
                        <div class="col-6 border-end">
                            <span class="badge bg-secondary mb-1">Previous</span>
                            <div class="text-muted">${format(oldVal)}</div>
                        </div>
                        <div class="col-6">
                            <span class="badge bg-warning text-dark mb-1">Updated</span>
                            <div class="text-dark fw-bold">${format(newVal)}</div>
                        </div>
                    </div>
                </div>
            `;
        };

        const staticField = (label, val, isPrice = false) => {
            const format = (v) => isPrice ? `₹${parseFloat(v).toLocaleString()}` : v;
            return `
                <div class="mb-2">
                    <span class="small text-muted fw-bold">${label}:</span> 
                    <span class="small">${format(val)}</span>
                </div>
             `;
        };

        let diffHtml = '';
        diffHtml += diff('Name', old.name, p.name);
        diffHtml += diff('MRP', old.mrp, p.mrp, true);
        diffHtml += diff('Selling Price', old.selling_price, p.selling_price, true);
        diffHtml += diff('Stock', old.stock_quantity, p.stock_quantity);
        diffHtml += diff('Keywords', old.keywords || 'N/A', p.keywords || 'N/A');
        diffHtml += diff('Description', old.description, p.description);

        if (!diffHtml) diffHtml = '<div class="alert alert-info">No significant changes detected in text fields.</div>';

        return `
            <div class="row">
                <div class="col-md-4">
                    <img src="${mainImg}" class="img-fluid rounded shadow-sm mb-3" onerror="this.src='../assets/img/placeholder.png'">
                    <div class="small">
                         ${staticField('SKU', p.sku)}
                         ${staticField('Category', p.categories?.name || 'N/A')}
                         ${staticField('Seller', p.sellers?.store_name || 'N/A')}
                    </div>
                </div>
                <div class="col-md-8">
                    <h5 class="mb-3 border-bottom pb-2">Updates Review</h5>
                    ${diffHtml}
                </div>
            </div>
        `;
    }

    async function updateStatus(id, status) {
        const { error } = await client
            .from('products')
            .update({ status: status })
            .eq('id', id);

        if (error) {
            alert('Error: ' + error.message);
        } else {
            productModal.hide();
            loadPendingProducts();
        }
    }

    btnApprove.addEventListener('click', () => {
        if (currentProduct) updateStatus(currentProduct.id, 'active');
    });

    btnReject.addEventListener('click', () => {
        if (currentProduct && confirm('Reject this product?')) {
            updateStatus(currentProduct.id, 'rejected');
        }
    });

    init();
});
