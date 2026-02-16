/**
 * Store Page Logic
 * Handles seller information and product display for a specific seller
 */

document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const productsGrid = document.getElementById('products-grid');
    const productsLoading = document.getElementById('products-loading');
    const noProducts = document.getElementById('no-products');
    const storeDisplayName = document.getElementById('store-display-name');
    const storeState = document.getElementById('store-state');
    const storePincode = document.getElementById('store-pincode');
    const storeSince = document.getElementById('store-since');
    const breadcrumbStoreName = document.getElementById('breadcrumb-store-name');
    const sortSelect = document.getElementById('sort-select');
    const productCount = document.getElementById('store-product-count');

    // 1. Get Seller ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const sellerId = urlParams.get('id');

    if (!sellerId) {
        window.location.href = 'shop.html';
        return;
    }

    async function initStore() {
        try {
            // Load Seller Info
            const { data: seller, error } = await client
                .from('sellers')
                .select('*')
                .eq('id', sellerId)
                .maybeSingle();

            if (error || !seller) {
                console.error('Error loading seller:', error);
                window.location.href = 'shop.html';
                return;
            }

            // Update UI with seller info
            storeDisplayName.textContent = seller.store_name;
            breadcrumbStoreName.textContent = seller.store_name;
            document.title = `${seller.store_name} - House of Pachu`;

            storeState.textContent = seller.state || 'India';
            storePincode.textContent = seller.pincode || 'N/A';
            storeSince.textContent = seller.created_at ? new Date(seller.created_at).getFullYear() : '2024';

            // Initialize SlimSelect
            if (typeof SlimSelect !== 'undefined') {
                new SlimSelect({
                    select: '#sort-select',
                    settings: { showSearch: false }
                });
            }

            // Add Event Listeners for filters
            sortSelect.addEventListener('change', () => loadProducts());

            await loadProducts();
        } catch (err) {
            console.error('Initialization error:', err);
            window.location.href = 'shop.html';
        }
    }

    async function loadProducts() {
        try {
            productsLoading.style.display = 'grid';
            productsGrid.style.display = 'none';
            noProducts.style.display = 'none';

            let query = client
                .from('products')
                .select(`
                    *,
                    categories!inner(name)
                `)
                .eq('seller_id', sellerId)
                .eq('status', 'active');

            // Sort Logic
            const sortValue = sortSelect.value;
            if (sortValue === 'price-low') {
                query = query.order('selling_price', { ascending: true });
            } else if (sortValue === 'price-high') {
                query = query.order('selling_price', { ascending: false });
            } else if (sortValue === 'oldest') {
                query = query.order('created_at', { ascending: true });
            } else {
                // Default: newest
                query = query.order('created_at', { ascending: false });
            }

            const { data: products, error } = await query;

            if (error) throw error;

            renderProducts(products);
        } catch (err) {
            console.error('Error loading products:', err);
            showNoProducts();
        }
    }

    function renderProducts(products) {
        productsLoading.style.display = 'none';

        if (!products || products.length === 0) {
            productCount.textContent = '0';
            showNoProducts();
            return;
        }

        productCount.textContent = products.length;
        productsGrid.style.display = 'grid';
        productsGrid.innerHTML = products.map(product => {
            // Price calculation
            const mrp = parseFloat(product.mrp);
            const sellingPrice = parseFloat(product.selling_price);
            const discount = mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;

            // Image handling (using first image or placeholder)
            const images = product.images || [];
            const mainImage = images.length > 0 ? images.sort((a, b) => a.arrangement - b.arrangement)[0].url : 'https://placehold.co/600x800?text=No+Image';

            return `
                <div class="ul-product mb-4">
                    <div class="ul-product-img">
                        <img src="${mainImage}" alt="${product.name}" onerror="this.src='https://placehold.co/600x800?text=No+Image'">

                        <div class="ul-product-actions">
                            <button class="add-to-cart-btn-trigger" data-id="${product.id}" title="Add to Cart"><i class="flaticon-shopping-bag"></i></button>
                            <a href="shop-details.html?id=${product.id}" title="Quick View"><i class="flaticon-hide"></i></a>
                            <button class="add-to-wishlist-btn-trigger" data-id="${product.id}" title="Add to Wishlist"><i class="flaticon-heart"></i></button>
                        </div>
                    </div>

                    <div class="ul-product-txt text-center">
                        <h4 class="ul-product-title"><a href="shop-details.html?id=${product.id}">${product.name}</a></h4>
                        <h5 class="ul-product-category"><a href="shop.html?category=${encodeURIComponent(product.categories.name)}">${product.categories.name}</a></h5>
                        
                        <div class="ul-product-price-wrapper mt-2">
                            <span class="ul-product-price text-dark fw-bold" style="font-size: 1.1rem;">₹${sellingPrice.toLocaleString()}</span>
                            ${mrp > sellingPrice ? `
                                <span class="ul-product-mrp text-muted text-decoration-line-through ms-2" style="font-size: 0.9rem;">₹${mrp.toLocaleString()}</span>
                                <span class="ul-product-discount-tag text-success ms-2" style="font-size: 0.85rem; font-weight: 600;">(${discount}% Off)</span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function showNoProducts() {
        productsLoading.style.display = 'none';
        productsGrid.style.display = 'none';
        noProducts.style.display = 'block';
    }

    initStore();
});
