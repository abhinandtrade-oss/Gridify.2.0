document.addEventListener('DOMContentLoaded', () => {
    const trendingGrid = document.getElementById("trending-products-grid");
    const flashSaleContainer = document.getElementById("flash-sale-container");

    async function loadIndexProducts() {
        const client = window.supabase;
        if (!client) return;

        try {
            // Fetch Trending Products
            const { data: trendingProducts, error: trendingError } = await client
                .from('products')
                .select(`*, categories(name)`)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(8);

            if (trendingError) throw trendingError;

            // Fetch Flash Sale Products
            const { data: flashProducts, error: flashError } = await client
                .from('products')
                .select(`*, categories(name)`)
                .eq('status', 'active')
                .limit(6);

            if (flashError) throw flashError;

            // Fetch Top 3 Categories for Sub-Banners
            const { data: catData, error: catError } = await client
                .from('categories')
                .select(`name, id`)
                .eq('is_visible', true)
                .limit(3);

            if (catError) throw catError;

            // For each category, get one representative product image
            const subBannerContainer = document.getElementById('sub-banners-container');
            if (subBannerContainer && catData) {
                const subBannersHtml = await Promise.all(catData.map(async (cat, index) => {
                    const { data: prodData } = await client
                        .from('products')
                        .select('images, name')
                        .eq('category_id', cat.id)
                        .eq('status', 'active')
                        .limit(1)
                        .maybeSingle();

                    const imgUrl = prodData?.images?.[0]?.url || `assets/img/sub-banner-${index + 1}.png`;
                    const bgClass = index === 1 ? 'ul-sub-banner--2' : (index === 2 ? 'ul-sub-banner--3' : '');

                    return `
                        <div class="col">
                            <div class="ul-sub-banner ${bgClass}">
                                <div class="ul-sub-banner-txt">
                                    <div class="top">
                                        <span class="ul-ad-sub-title">Featured category</span>
                                        <h3 class="ul-sub-banner-title">${cat.name}</h3>
                                        <p class="ul-sub-banner-descr">Premium Selection</p>
                                    </div>
                                    <div class="bottom">
                                        <a href="shop.html?category=${encodeURIComponent(cat.name)}" class="ul-sub-banner-btn">Shop Now <i class="flaticon-up-right-arrow"></i></a>
                                    </div>
                                </div>
                                <div class="ul-sub-banner-img">
                                    <img src="${imgUrl}" alt="${cat.name}" style="max-height: 200px; object-fit: contain;">
                                </div>
                            </div>
                        </div>
                    `;
                }));
                subBannerContainer.innerHTML = subBannersHtml.join('');
            }

            if (trendingProducts && trendingProducts.length > 0) {
                renderTrendingProducts(trendingProducts, trendingGrid);
            } else if (trendingGrid) {
                trendingGrid.innerHTML = '<div class="col-12 text-center py-4"><p class="text-muted">No products available at the moment.</p></div>';
            }

            if (flashProducts && flashProducts.length > 0) {
                renderFlashSaleProducts(flashProducts, flashSaleContainer);

                // Refresh Swiper for Flash Sale
                setTimeout(() => {
                    if (window.Swiper) {
                        const swiperElem = document.querySelector('.ul-flash-sale-slider');
                        if (swiperElem && swiperElem.swiper) {
                            swiperElem.swiper.update();
                        }
                    }
                }, 500);
            } else if (flashSaleContainer) {
                flashSaleContainer.innerHTML = '<div class="swiper-slide text-center">No flash deals currently.</div>';
            }

        } catch (err) {
            console.warn("Public Products: Error loading products:", err);
        }
    }

    async function getProductRatings(skus) {
        if (!skus || skus.length === 0) return {};

        const { data: ratings, error } = await window.supabase
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

    async function renderTrendingProducts(products, container) {
        if (!container) return;

        const skus = products.map(p => p.sku);
        const ratingsMap = await getProductRatings(skus);

        container.innerHTML = products.map(product => {
            const mrp = parseFloat(product.mrp);
            const sellingPrice = parseFloat(product.selling_price);
            const discount = mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
            const images = product.images || [];
            const mainImg = images.length > 0 ? images.sort((a, b) => a.arrangement - b.arrangement)[0].url : 'https://placehold.co/600x800?text=No+Image';
            const categoryName = product.categories?.name || 'Uncategorized';

            const ratingData = ratingsMap[product.sku] || { avg: 0, count: 0 };

            return `
                <div class="col">
                    <div class="ul-product">
                        <div class="ul-product-img">
                            <img src="${mainImg}" alt="${product.name}" onerror="this.src='https://placehold.co/600x800?text=No+Image'">
                        </div>

                        <div class="ul-product-txt text-center">
                            <h4 class="ul-product-title"><a href="shop-details.html?id=${product.id}">${product.name}</a></h4>
                            <h5 class="ul-product-category"><a href="shop.html?category=${encodeURIComponent(categoryName)}">${categoryName}</a></h5>
                            
                            <div class="ul-product-rating mt-1" style="font-size: 0.75rem;">
                                ${generateStarsHtml(ratingData.avg)}
                                <span class="text-muted ms-1">(${ratingData.count})</span>
                            </div>

                            <div class="ul-product-price-wrapper mt-1">
                                <span class="ul-product-price text-dark fw-bold">₹${sellingPrice.toLocaleString()}</span>
                                ${mrp > sellingPrice ? `
                                    <span class="ul-product-mrp text-muted text-decoration-line-through ms-2" style="font-size: 0.85rem;">₹${mrp.toLocaleString()}</span>
                                ` : ''}
                            </div>

                            <div class="ul-product-actions mt-auto">
                                <button class="add-to-cart-btn-trigger" data-id="${product.id}" title="Add to Cart"><i class="flaticon-shopping-bag"></i></button>
                                <a href="shop-details.html?id=${product.id}" title="Quick View"><i data-lucide="eye"></i></a>
                                <button class="add-to-wishlist-btn-trigger" data-id="${product.id}" title="Add to Wishlist"><i class="flaticon-heart"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    async function renderFlashSaleProducts(products, container) {
        if (!container) return;

        const skus = products.map(p => p.sku);
        const ratingsMap = await getProductRatings(skus);

        container.innerHTML = products.map(product => {
            const mrp = parseFloat(product.mrp);
            const sellingPrice = parseFloat(product.selling_price);
            const discount = mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;
            const images = product.images || [];
            const mainImg = images.length > 0 ? images.sort((a, b) => a.arrangement - b.arrangement)[0].url : 'https://placehold.co/600x800?text=No+Image';
            const categoryName = product.categories?.name || 'Uncategorized';

            const ratingData = ratingsMap[product.sku] || { avg: 0, count: 0 };

            return `
                <div class="swiper-slide">
                    <div class="ul-product">
                        <div class="ul-product-heading d-flex justify-content-between align-items-center mb-2 px-2">
                            <span class="ul-product-price fw-bold text-primary">₹${sellingPrice.toLocaleString()}</span>
                            ${discount > 0 ? `<span class="ul-product-discount-tag badge bg-danger">${discount}% Off</span>` : ''}
                        </div>

                        <div class="ul-product-img">
                            <img src="${mainImg}" alt="${product.name}" onerror="this.src='https://placehold.co/600x800?text=No+Image'">
                        </div>

                        <div class="ul-product-txt">
                            <h4 class="ul-product-title"><a href="shop-details.html?id=${product.id}">${product.name}</a></h4>
                            <h5 class="ul-product-category"><a href="shop.html?category=${encodeURIComponent(categoryName)}">${categoryName}</a></h5>
                            <div class="ul-product-rating mt-1" style="font-size: 0.75rem;">
                                ${generateStarsHtml(ratingData.avg)}
                                <span class="text-muted ms-1">(${ratingData.count})</span>
                            </div>

                            <div class="ul-product-actions mt-auto">
                                <button class="add-to-cart-btn-trigger" data-id="${product.id}" title="Add to Cart"><i class="flaticon-shopping-bag"></i></button>
                                <a href="shop-details.html?id=${product.id}" title="Quick View"><i data-lucide="eye"></i></a>
                                <button class="add-to-wishlist-btn-trigger" data-id="${product.id}" title="Add to Wishlist"><i class="flaticon-heart"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    loadIndexProducts();
});

