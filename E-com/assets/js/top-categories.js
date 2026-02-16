/**
 * Top Categories with Most Sales (Products)
 * Dynamically fetches top 5 categories by product count (as sales proxy)
 * and displays 4 products for each.
 */

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('dynamic-top-categories');
    if (!container) return;

    async function loadTopCategories() {
        const client = window.supabase;
        if (!client) return;

        try {
            // 1. Fetch Categories
            const { data: categories, error: catError } = await client
                .from('categories')
                .select('*')
                .eq('is_visible', true);

            if (catError) throw catError;

            // 2. Fetch all active products
            // We'll use product count as a proxy for "most sale/active" categories since 
            // no sales column exists yet.
            const { data: products, error: prodError } = await client
                .from('products')
                .select(`
                    *,
                    categories(id, name)
                `)
                .eq('status', 'active');

            if (prodError) throw prodError;

            // Group products by category
            const categoryGroups = {};
            products.forEach(p => {
                if (!p.category_id || !p.categories) return;

                const catId = p.category_id;
                if (!categoryGroups[catId]) {
                    categoryGroups[catId] = {
                        category: p.categories,
                        products: []
                    };
                }
                categoryGroups[catId].products.push(p);
            });

            // Sort categories by product count (proxy for "more sale")
            // TIP: If you add a 'sales_count' column to categories, you can sort by that here.
            const sortedCategories = Object.values(categoryGroups)
                .sort((a, b) => b.products.length - a.products.length)
                .slice(0, 5);

            if (sortedCategories.length === 0) {
                container.innerHTML = `
                    <div class="ul-container">
                        <div class="ul-inner-container text-center py-5">
                            <h4 class="text-muted">No featured categories with products found.</h4>
                        </div>
                    </div>
                `;
                return;
            }

            // 3. Fetch Ratings for all these products
            const skus = products.map(p => p.sku);
            const { data: ratingsData } = await client
                .from('product_reviews')
                .select('product_sku, rating')
                .in('product_sku', skus);

            const ratingsMap = {};
            if (ratingsData) {
                const stats = {};
                ratingsData.forEach(r => {
                    if (!stats[r.product_sku]) stats[r.product_sku] = { sum: 0, count: 0 };
                    stats[r.product_sku].sum += r.rating;
                    stats[r.product_sku].count += 1;
                });
                Object.keys(stats).forEach(sku => {
                    ratingsMap[sku] = {
                        avg: (stats[sku].sum / stats[sku].count).toFixed(1),
                        count: stats[sku].count
                    };
                });
            }

            // 4. Render each category section
            const shownProductIds = new Set();
            let html = '';

            sortedCategories.forEach(group => {
                const cat = group.category;
                // Filter out products already shown in previous categories
                const availableProducts = group.products.filter(p => !shownProductIds.has(p.id));
                const catProducts = availableProducts.slice(0, 4);

                if (catProducts.length > 0) {
                    // Mark these products as shown
                    catProducts.forEach(p => shownProductIds.add(p.id));

                    html += `
                        <section class="ul-products py-5">
                            <div class="ul-container">
                                <div class="ul-inner-container">
                                    <div class="ul-section-heading mb-4">
                                        <div class="left">
                                            <span class="ul-section-sub-title">Featured Category</span>
                                            <h2 class="ul-section-title">
                                                <a href="shop.html?category=${encodeURIComponent(cat.name)}" style="color: inherit; text-decoration: none;">
                                                    ${cat.name}
                                                </a>
                                            </h2>
                                        </div>
                                        <div class="right">
                                            <a href="shop.html?category=${encodeURIComponent(cat.name)}" class="ul-btn">
                                                View All <i class="flaticon-up-right-arrow"></i>
                                            </a>
                                        </div>
                                    </div>

                                    <div class="row row-cols-lg-4 row-cols-md-3 row-cols-2 row-cols-xxs-1 ul-bs-row">
                                        ${catProducts.map(product => {
                        // Pass ratingsMap implicitly or just use the global scope since it's defined in loadTopCategories
                        window.ratingsMapGlobal = ratingsMap;
                        return renderProductCard(product, cat.name);
                    }).join('')}
                                    </div>
                                </div>
                            </div>
                        </section>
                    `;
                }
            });

            container.innerHTML = html || `
                <div class="ul-container">
                    <div class="ul-inner-container text-center py-5">
                        <h4 class="text-muted">No products found for categories.</h4>
                    </div>
                </div>
            `;

        } catch (err) {
            console.warn("Top Categories: Error loading:", err);
            container.innerHTML = '';
        }
    }

    function renderProductCard(product, categoryName) {
        const mrp = parseFloat(product.mrp);
        const sellingPrice = parseFloat(product.selling_price);
        const discount = mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
        const images = product.images || [];
        const mainImg = images.length > 0 ? images.sort((a, b) => a.arrangement - b.arrangement)[0].url : 'https://placehold.co/600x800?text=No+Image';

        const ratingData = window.ratingsMapGlobal?.[product.sku] || { avg: 0, count: 0 };

        return `
            <div class="col">
                <div class="ul-product">
                    <div class="ul-product-img">
                        <img src="${mainImg}" alt="${product.name}" onerror="this.src='https://placehold.co/600x800?text=No+Image'">
                        <div class="ul-product-actions">
                            <button class="add-to-cart-btn-trigger" data-id="${product.id}" title="Add to Cart"><i class="flaticon-shopping-bag"></i></button>
                            <a href="shop-details.html?id=${product.id}" title="Quick View"><i class="flaticon-hide"></i></a>
                            <button class="add-to-wishlist-btn-trigger" data-id="${product.id}" title="Add to Wishlist"><i class="flaticon-heart"></i></button>
                        </div>
                    </div>

                    <div class="ul-product-txt text-center">
                        <h4 class="ul-product-title"><a href="shop-details.html?id=${product.id}">${product.name}</a></h4>
                        <h5 class="ul-product-category"><a href="shop.html?category=${encodeURIComponent(categoryName)}">${categoryName}</a></h5>
                        
                        <div class="ul-product-rating mt-1" style="font-size: 0.75rem;">
                            ${generateStarsHtml(ratingData.avg)}
                            <span class="text-muted ms-1">(${ratingData.count})</span>
                        </div>
                        
                        <div class="ul-product-price-wrapper mt-2">
                            <span class="ul-product-price text-dark fw-bold">₹${sellingPrice.toLocaleString()}</span>
                            ${mrp > sellingPrice ? `
                                <span class="ul-product-mrp text-muted text-decoration-line-through ms-2" style="font-size: 0.85rem;">₹${mrp.toLocaleString()}</span>
                                <span class="text-success ms-1" style="font-size: 0.8rem; font-weight: 600;">(${discount}% off)</span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
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

    loadTopCategories();
});
