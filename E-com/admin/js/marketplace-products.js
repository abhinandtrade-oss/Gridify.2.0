/**
 * Marketplace: Product Listing for Sellers
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const productList = document.getElementById('product-list');

    async function init() {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        // 1. Get Seller ID
        const { data: seller } = await client
            .from('sellers')
            .select('id')
            .eq('email', session.user.email)
            .maybeSingle();

        if (!seller) {
            productList.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center p-5">
                        <div class="text-muted mb-3">No seller profile found for your account.</div>
                        <a href="shop-profile.html" class="btn btn-outline-primary btn-sm">Setup Shop Profile</a>
                    </td>
                </tr>
            `;
            return;
        }

        // 2. Load Products
        const { data: products, error } = await client
            .from('products')
            .select(`
                *,
                categories (name)
            `)
            .eq('seller_id', seller.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading products:', error);
            productList.innerHTML = `<tr><td colspan="6" class="text-center p-5 text-danger">Error loading products: ${error.message}</td></tr>`;
            return;
        }

        renderProducts(products);
    }

    function renderProducts(products) {
        if (!products || products.length === 0) {
            productList.innerHTML = '<tr><td colspan="6" class="text-center p-5 text-muted">You haven\'t listed any products yet.</td></tr>';
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
                    <td>
                        <div class="fw-bold">₹${parseFloat(p.selling_price).toLocaleString()}</div>
                        <div class="text-muted small text-decoration-line-through">₹${parseFloat(p.mrp).toLocaleString()}</div>
                    </td>
                    <td>
                        <span class="${p.stock_quantity < 5 ? 'text-danger fw-bold' : ''}">${p.stock_quantity}</span>
                    </td>
                    <td>
                        <span class="badge-status ${getStatusClass(p.status)}">
                            ${p.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                    </td>
                    <td class="text-end">
                        <div class="action-btns justify-content-end">
                            <a href="edit-marketplace-product.html?id=${p.id}" class="btn btn-sm btn-light">
                                <i data-lucide="edit-2" style="width: 14px;"></i>
                            </a>
                            <button class="btn btn-sm btn-light text-danger" onclick="deleteProduct('${p.id}')">
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
            case 'pending_approval': return 'status-pending';
            case 'rejected': return 'status-rejected';
            default: return 'status-pending';
        }
    }

    window.deleteProduct = async (id) => {
        if (!confirm('Are you sure you want to delete this product?')) return;

        const { error } = await client.from('products').delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else init();
    };

    init();
});
