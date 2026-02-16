/**
 * Admin: All Products Management
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const productList = document.getElementById('product-list');
    const searchSkuInput = document.getElementById('search-sku');
    const filterSupplierSelect = document.getElementById('filter-supplier');
    const filterStatusSelect = document.getElementById('filter-status');
    const btnResetFilters = document.getElementById('btn-reset-filters');

    async function init() {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        // 1. Load Suppliers for filter
        const { data: sellers } = await client
            .from('sellers')
            .select('id, store_name')
            .order('store_name', { ascending: true });

        if (sellers) {
            sellers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.store_name;
                filterSupplierSelect.appendChild(opt);
            });
        }

        // 2. Load Products
        loadProducts();

        // 3. Event Listeners
        searchSkuInput.addEventListener('input', debounce(() => loadProducts(), 500));
        filterSupplierSelect.addEventListener('change', () => loadProducts());
        filterStatusSelect.addEventListener('change', () => loadProducts());
        btnResetFilters.addEventListener('click', () => {
            searchSkuInput.value = '';
            filterSupplierSelect.value = '';
            filterStatusSelect.value = '';
            loadProducts();
        });
    }

    async function loadProducts() {
        productList.innerHTML = `<tr><td colspan="7" class="text-center p-5"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>`;

        let query = client
            .from('products')
            .select(`
                *,
                categories (name),
                sellers (store_name)
            `)
            .order('created_at', { ascending: false });

        // Apply Search
        const search = searchSkuInput.value.trim();
        if (search) {
            query = query.or(`sku.ilike.%${search}%,name.ilike.%${search}%`);
        }

        // Apply Supplier Filter
        const supplierId = filterSupplierSelect.value;
        if (supplierId) {
            query = query.eq('seller_id', supplierId);
        }

        // Apply Status Filter
        const status = filterStatusSelect.value;
        if (status) {
            query = query.eq('status', status);
        }

        const { data: products, error } = await query;

        if (error) {
            console.error('Error loading products:', error);
            productList.innerHTML = `<tr><td colspan="7" class="text-center p-5 text-danger">Error loading products: ${error.message}</td></tr>`;
            return;
        }

        renderProducts(products);
    }

    function renderProducts(products) {
        if (!products || products.length === 0) {
            productList.innerHTML = '<tr><td colspan="7" class="text-center p-5 text-muted">No products found matching your filters.</td></tr>';
            return;
        }

        productList.innerHTML = products.map(p => {
            const mainImg = p.images && p.images.length > 0 ? p.images.sort((a, b) => a.arrangement - b.arrangement)[0].url : '';
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center gap-3">
                            <img src="${mainImg}" class="product-img" alt="${p.name}" onerror="this.src='../assets/img/placeholder.png'">
                            <div>
                                <div class="fw-bold text-main">${p.name}</div>
                                <div class="text-muted small">${p.sku}</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="text-muted">${p.categories?.name || 'Uncategorized'}</span></td>
                    <td><span class="badge bg-light text-dark border">${p.sellers?.store_name || 'System / Admin'}</span></td>
                    <td>
                        <div class="fw-bold">₹${parseFloat(p.selling_price).toLocaleString()}</div>
                        <div class="text-muted small text-decoration-line-through">₹${parseFloat(p.mrp).toLocaleString()}</div>
                    </td>
                    <td>
                        <span class="${p.stock_quantity < 5 ? 'text-danger fw-bold' : ''}">${p.stock_quantity}</span>
                    </td>
                    <td>
                        <div class="dropdown">
                            <button class="badge-status ${getStatusClass(p.status)} border-0 dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                ${p.status.replace(/_/g, ' ').toUpperCase()}
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="javascript:void(0)" onclick="updateStatus('${p.id}', 'active')">Active</a></li>
                                <li><a class="dropdown-item" href="javascript:void(0)" onclick="updateStatus('${p.id}', 'inactive')">Inactive</a></li>
                                <li><a class="dropdown-item" href="javascript:void(0)" onclick="updateStatus('${p.id}', 'pending_approval')">Pending Approval</a></li>
                                <li><a class="dropdown-item" href="javascript:void(0)" onclick="updateStatus('${p.id}', 'rejected')">Rejected</a></li>
                            </ul>
                        </div>
                    </td>
                    <td class="text-end">
                        <div class="action-btns justify-content-end">
                            <a href="edit-product.html?id=${p.id}" class="btn btn-sm btn-light" title="Edit Product">
                                <i data-lucide="edit-2" style="width: 14px;"></i>
                            </a>
                            <button class="btn btn-sm btn-light text-danger" onclick="deleteProduct('${p.id}')" title="Delete Product">
                                <i data-lucide="trash-2" style="width: 14px;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function getStatusClass(status) {
        switch (status) {
            case 'active': return 'status-active';
            case 'inactive': return 'status-rejected';
            case 'pending_approval': return 'status-pending';
            case 'rejected': return 'status-rejected';
            default: return 'status-pending';
        }
    }

    window.updateStatus = async (id, status) => {
        const { error } = await client
            .from('products')
            .update({ status })
            .eq('id', id);

        if (error) {
            showAlert('Error updating status: ' + error.message, 'error');
        } else {
            showAlert('Product status updated successfully', 'success');
            loadProducts();
        }
    };

    window.deleteProduct = (id) => {
        showConfirm('Are you sure you want to delete this product? This action cannot be undone.', async () => {
            const { error } = await client.from('products').delete().eq('id', id);
            if (error) showAlert('Error: ' + error.message, 'error');
            else {
                showAlert('Product deleted successfully', 'success');
                loadProducts();
            }
        });
    };

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    init();
});
