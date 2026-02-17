/**
 * Shop Page Logic
 * Handles category filtering and product display
 */

document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const productsGrid = document.getElementById('products-grid');
    const productsLoading = document.getElementById('products-loading');
    const noProducts = document.getElementById('no-products');
    const pageTitle = document.getElementById('page-title');
    const breadcrumbCategory = document.getElementById('breadcrumb-category');
    const categoryDescription = document.getElementById('category-description');
    const sortSelect = document.getElementById('sort-select');
    const priceFilter = document.getElementById('price-filter');
    const currentCount = document.getElementById('current-count');

    // 1. Get Params from URL
    const urlParams = new URLSearchParams(window.location.search);
    const categoryName = urlParams.get('category');
    const searchQuery = urlParams.get('search');

    async function initShop() {
        if (searchQuery) {
            pageTitle.textContent = `Search: ${searchQuery}`;
            breadcrumbCategory.textContent = 'Search';
        } else if (categoryName) {
            pageTitle.textContent = categoryName;
            breadcrumbCategory.textContent = categoryName;

            // Try to fetch category details for description
            const { data: catData } = await client
                .from('categories')
                .select('description')
                .eq('name', categoryName)
                .maybeSingle();

            if (catData && catData.description) {
                categoryDescription.textContent = catData.description;
            }
        } else {
            pageTitle.textContent = 'All Products';
            breadcrumbCategory.textContent = 'All';
        }

        // Initialize SlimSelect
        if (typeof SlimSelect !== 'undefined') {
            new SlimSelect({
                select: '#sort-select',
                settings: { showSearch: false }
            });
            new SlimSelect({
                select: '#price-filter',
                settings: { showSearch: false }
            });
        }

        // Add Event Listeners for filters
        sortSelect.addEventListener('change', () => loadProducts());
        priceFilter.addEventListener('change', () => loadProducts());

        await loadProducts();
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
                    categories!inner(name),
                    sellers(store_name)
                `)
                .eq('status', 'active');

            // Category Filter
            if (categoryName) {
                query = query.eq('categories.name', categoryName);
            }

            // Search Filter
            if (searchQuery) {
                query = query.or(`name.ilike.%${searchQuery}%,keywords.ilike.%${searchQuery}%`);
            }

            // Price Range Filter
            const priceValue = priceFilter.value;
            if (priceValue !== 'all') {
                if (priceValue === 'under-1000') {
                    query = query.lte('selling_price', 1000);
                } else if (priceValue === '1000-5000') {
                    query = query.gte('selling_price', 1000).lte('selling_price', 5000);
                } else if (priceValue === '5000-10000') {
                    query = query.gte('selling_price', 5000).lte('selling_price', 10000);
                } else if (priceValue === 'over-10000') {
                    query = query.gte('selling_price', 10000);
                }
            }

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

    async function getProductRatings(skus) {
        if (!skus || skus.length === 0) return {};

        const { data: ratings, error } = await client
            .from('product_reviews')
            .select('product_sku, rating')
            .in('product_sku', skus);

        if (error) {
            console.error('Error fetching ratings:', error);
            return {};
        }

        const stats = {};
        ratings.forEach(r => {
            if (!stats[r.product_sku]) stats[r.product_sku] = { sum: 0, count: 0 };
            stats[r.product_sku].sum += r.rating;
            stats[r.product_sku].count += 1;
        });

        const final = {};
        Object.keys(stats).forEach(sku => {
            final[sku] = {
                avg: (stats[sku].sum / stats[sku].count).toFixed(1),
                count: stats[sku].count
            };
        });
        return final;
    }

    function generateStarsHtml(rating) {
        let stars = '';
        const filledStars = Math.floor(rating || 0);
        for (let i = 1; i <= 5; i++) {
            if (i <= filledStars) {
                stars += '<i class="flaticon-star text-warning"></i>';
            } else if (i - 0.5 <= rating) {
                stars += '<i class="flaticon-star text-warning" style="opacity: 0.6;"></i>';
            } else {
                stars += '<i class="flaticon-star" style="color: #e0e0e0;"></i>';
            }
        }
        return stars;
    }

    async function renderProducts(products) {
        productsLoading.style.display = 'none';

        if (!products || products.length === 0) {
            currentCount.textContent = '0';
            showNoProducts();
            return;
        }

        const skus = products.map(p => p.sku);
        const ratingsMap = await getProductRatings(skus);

        currentCount.textContent = products.length;
        productsGrid.style.display = 'grid';
        productsGrid.innerHTML = products.map(product => {
            // Price calculation
            const mrp = parseFloat(product.mrp);
            const sellingPrice = parseFloat(product.selling_price);
            const discount = mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;

            // Image handling (using first image or placeholder)
            const images = product.images || [];
            const mainImage = images.length > 0 ? images.sort((a, b) => a.arrangement - b.arrangement)[0].url : 'https://placehold.co/600x800?text=No+Image';

            const ratingData = ratingsMap[product.sku] || { avg: 0, count: 0 };

            return `
                <div class="ul-product mb-4">
                    <div class="ul-product-img">
                        <img src="${mainImage}" alt="${product.name}" onerror="this.src='https://placehold.co/600x800?text=No+Image'">
                    </div>

                    <div class="ul-product-txt text-center">
                        <h4 class="ul-product-title"><a href="shop-details.html?id=${product.id}">${product.name}</a></h4>
                        <div class="d-flex justify-content-center gap-2 align-items-center mb-1">
                            <h5 class="ul-product-category mb-0"><a href="shop.html?category=${encodeURIComponent(product.categories.name)}">${product.categories.name}</a></h5>
                            <span class="text-muted" style="font-size: 0.7rem;">•</span>
                            <a href="store.html?id=${product.seller_id}" class="text-muted text-decoration-none" style="font-size: 0.75rem; font-weight: 500;">
                                <i class="flaticon-shopping-bag me-1" style="font-size: 0.7rem;"></i>${product.sellers?.store_name || 'Store'}
                            </a>
                        </div>
                        
                        <div class="ul-product-rating mb-1" style="font-size: 0.75rem;">
                            ${generateStarsHtml(ratingData.avg)}
                            <span class="text-muted ms-1">(${ratingData.count})</span>
                        </div>

                        <div class="ul-product-price-wrapper mt-2">
                            <span class="ul-product-price text-dark fw-bold" style="font-size: 1.1rem;">₹${sellingPrice.toLocaleString()}</span>
                            ${mrp > sellingPrice ? `
                                <span class="ul-product-mrp text-muted text-decoration-line-through ms-2" style="font-size: 0.9rem;">₹${mrp.toLocaleString()}</span>
                                <span class="ul-product-discount-tag text-success ms-2" style="font-size: 0.85rem; font-weight: 600;">(${discount}% Off)</span>
                            ` : ''}
                        </div>

                        <div class="ul-product-actions mt-auto">
                            <button class="add-to-cart-btn-trigger" data-id="${product.id}" title="Add to Cart"><i class="flaticon-shopping-bag"></i></button>
                            <a href="shop-details.html?id=${product.id}" title="Quick View"><i data-lucide="eye"></i></a>
                            <button class="add-to-wishlist-btn-trigger" data-id="${product.id}" title="Add to Wishlist"><i class="flaticon-heart"></i></button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function showNoProducts() {
        productsLoading.style.display = 'none';
        productsGrid.style.display = 'none';
        noProducts.style.display = 'block';
    }

    initShop();
});
