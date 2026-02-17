/**
 * Shop Details Page Logic
 * Fetches single product data and handles UI interactions
 */

document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    // UI Elements
    const skeleton = document.getElementById('product-details-skeleton');
    const content = document.getElementById('product-details-content');
    const mainImg = document.getElementById('main-product-img');
    const mainImgLink = document.getElementById('main-product-img-link');
    const thumbContainer = document.getElementById('thumb-container');
    const productName = document.getElementById('product-name');
    const breadcrumbName = document.getElementById('breadcrumb-product-name');
    const productCategory = document.getElementById('product-category');
    const productCategoryLink = document.getElementById('product-category-link');
    const productSeller = document.getElementById('product-seller');
    const sellingPriceEl = document.getElementById('selling-price');
    const mrpEl = document.getElementById('mrp');
    const discountEl = document.getElementById('discount-tag');
    const productDesc = document.getElementById('product-desc');
    const tabDesc = document.getElementById('tab-description');
    const productSku = document.getElementById('product-sku');
    const productStock = document.getElementById('product-stock');
    const qtyInput = document.getElementById('product-qty');
    const relatedProductsGrid = document.getElementById('related-products-grid');

    if (!productId) {
        window.location.href = 'shop.html';
        return;
    }

    let currentProduct = null;

    async function initProductDetails() {
        try {
            // 1. Fetch Product Data
            const { data: product, error } = await client
                .from('products')
                .select(`
                    *,
                    categories(id, name),
                    sellers(store_name)
                `)
                .eq('id', productId)
                .single();

            if (error || !product) throw new Error('Product not found');

            currentProduct = product;
            renderProduct(product);
            loadProductRating(product.sku);
            loadRelatedProducts(product.categories.id, product.id);
            setupCartActions();
        } catch (err) {
            console.error('Error:', err);
            // Optionally show error to user
            if (skeleton) {
                skeleton.innerHTML = `<div class="text-center py-5"><p>Product not found.</p><a href="shop.html" class="btn btn-primary">Back to Shop</a></div>`;
            }
        } finally {
            if (skeleton && content) {
                skeleton.style.display = 'none';
                content.style.display = 'block';
            }
        }
    }

    function renderProduct(product) {
        // Basic Info
        productName.textContent = product.name;
        breadcrumbName.textContent = product.name;
        const catName = product.categories?.name || 'Uncategorized';
        productCategory.textContent = catName;
        if (productCategoryLink) {
            productCategoryLink.href = `shop.html?category=${encodeURIComponent(catName)}`;
        }

        // Description
        const desc = product.description || 'No description available.';
        productDesc.textContent = desc.length > 200 ? desc.substring(0, 200) + '...' : desc;
        tabDesc.innerHTML = desc.replace(/\n/g, '<br>');

        // Price Calculation
        const mrp = parseFloat(product.mrp);
        const sellingPrice = parseFloat(product.selling_price);
        const discount = mrp > sellingPrice ? Math.round(((mrp - sellingPrice) / mrp) * 100) : 0;

        sellingPriceEl.textContent = `₹${sellingPrice.toLocaleString()}`;
        if (mrp > sellingPrice) {
            mrpEl.textContent = `₹${mrp.toLocaleString()}`;
            discountEl.textContent = `${discount}% OFF`;
        } else {
            mrpEl.style.display = 'none';
            discountEl.style.display = 'none';
        }

        // Meta Info
        productSku.textContent = product.sku || 'N/A';
        if (productSeller) {
            const storeName = product.sellers?.store_name || 'House of Pachu';
            if (product.seller_id) {
                productSeller.innerHTML = `<a href="store.html?id=${product.seller_id}" class="text-decoration-none text-primary fw-bold">${storeName}</a>`;
            } else {
                productSeller.textContent = storeName;
            }
        }
        const stockCount = product.stock_quantity || 0;
        if (stockCount > 0) {
            productStock.textContent = `In Stock (${stockCount})`;
            productStock.style.color = '#28a745';
        } else {
            productStock.textContent = 'Out of Stock';
            productStock.style.color = '#dc3545';
            // Disable add to cart if out of stock
            const addToCartBtn = document.getElementById('add-to-cart-main');
            if (addToCartBtn) {
                addToCartBtn.disabled = true;
                addToCartBtn.textContent = 'Out of Stock';
                addToCartBtn.style.opacity = '0.6';
                addToCartBtn.style.cursor = 'not-allowed';
            }
        }

        // Images
        const images = product.images || [];
        if (images.length > 0) {
            const sortedImages = images.sort((a, b) => (a.arrangement || 0) - (b.arrangement || 0));
            mainImg.src = sortedImages[0].url;

            // Setup main link and gallery
            if (mainImgLink) {
                mainImgLink.href = sortedImages[0].url;

                // Add hidden gallery links for other images
                const galleryContainer = document.createElement('div');
                galleryContainer.id = 'extra-gallery-links';
                galleryContainer.style.display = 'none';

                // Add all other images as hidden links for the lightbox gallery
                sortedImages.slice(1).forEach(img => {
                    const link = document.createElement('a');
                    link.setAttribute('data-fslightbox', 'gallery');
                    link.href = img.url;
                    galleryContainer.appendChild(link);
                });

                // Clear old extra links if any and append new ones
                const oldGallery = document.getElementById('extra-gallery-links');
                if (oldGallery) oldGallery.remove();
                mainImgLink.parentNode.appendChild(galleryContainer);
            }

            thumbContainer.innerHTML = sortedImages.map((img, idx) => `
                <div class="thumb-img ${idx === 0 ? 'active' : ''}" onclick="updateMainImage('${img.url}', this)">
                    <img src="${img.url}" alt="Thumbnail">
                </div>
            `).join('');

            // Initialize or refresh fslightbox
            if (typeof refreshFsLightbox === 'function') {
                refreshFsLightbox();
            }
        }

        document.title = `${product.name} - House of Pachu`;
    }

    async function loadRelatedProducts(categoryId, currentId) {
        if (!categoryId) return;

        const { data: related } = await client
            .from('products')
            .select(`*, categories(name)`)
            .eq('category_id', categoryId)
            .neq('id', currentId)
            .limit(4);

        if (related && related.length > 0) {
            renderRelated(related);
        } else {
            document.querySelector('.related-products-section').style.display = 'none';
        }
    }

    function renderRelated(products) {
        relatedProductsGrid.innerHTML = products.map(product => {
            const sellingPrice = parseFloat(product.selling_price);
            const images = product.images || [];
            const mainImg = images.length > 0 ? images.sort((a, b) => (a.arrangement || 0) - (b.arrangement || 0))[0].url : 'https://placehold.co/600x800?text=No+Image';

            return `
                <div class="col">
                    <div class="ul-product shadow-sm">
                        <div class="ul-product-img">
                            <img src="${mainImg}" alt="${product.name}" onerror="this.src='https://placehold.co/600x800?text=No+Image'">
                        </div>
                        <div class="ul-product-txt text-center">
                            <h4 class="ul-product-title"><a href="shop-details.html?id=${product.id}">${product.name}</a></h4>
                            <h5 class="ul-product-category">
                                <a href="shop.html?category=${encodeURIComponent(product.categories?.name || 'Uncategorized')}">
                                    ${product.categories?.name || 'Uncategorized'}
                                </a>
                            </h5>
                            <div class="ul-product-price-wrapper mt-2">
                                <span class="ul-product-price text-dark fw-bold">₹${sellingPrice.toLocaleString()}</span>
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

    // Quantity Handlers
    document.getElementById('qty-plus').addEventListener('click', () => {
        const currentQty = parseInt(qtyInput.value) || 1;
        if (currentProduct && currentQty >= currentProduct.stock_quantity) {
            window.CartManager.showErrorToast(`Only ${currentProduct.stock_quantity} units available.`);
            return;
        }
        qtyInput.value = currentQty + 1;
    });

    document.getElementById('qty-minus').addEventListener('click', () => {
        const currentQty = parseInt(qtyInput.value) || 1;
        if (currentQty > 1) {
            qtyInput.value = currentQty - 1;
        }
    });

    qtyInput.addEventListener('change', () => {
        let val = parseInt(qtyInput.value) || 1;
        if (val < 1) val = 1;
        if (currentProduct && val > currentProduct.stock_quantity) {
            val = currentProduct.stock_quantity;
            window.CartManager.showErrorToast(`Capping at available stock: ${val}`);
        }
        qtyInput.value = val;
    });

    function setupCartActions() {
        const addToCartMain = document.getElementById('add-to-cart-main');
        const addToWishlistMain = document.getElementById('add-to-wishlist-main');

        addToCartMain?.addEventListener('click', () => {
            if (currentProduct && window.CartManager) {
                const qty = parseInt(qtyInput.value) || 1;
                window.CartManager.addToCart(currentProduct, qty);
            }
        });

        addToWishlistMain?.addEventListener('click', () => {
            if (currentProduct && window.CartManager) {
                window.CartManager.addToWishlist(currentProduct);
            }
        });
    }

    // Global update image function
    window.updateMainImage = (url, thumbEl) => {
        mainImg.src = url;
        if (mainImgLink) {
            mainImgLink.href = url;
            // No need to refresh fslightbox here if we only want to show the current main image
            // However, fslightbox might need a refresh to pick up the new href
            if (typeof refreshFsLightbox === 'function') {
                refreshFsLightbox();
            }
        }
        document.querySelectorAll('.thumb-img').forEach(el => el.classList.remove('active'));
        thumbEl.classList.add('active');
    };

    async function loadProductRating(sku) {
        if (!sku) return;

        try {
            const { data: reviews } = await client
                .from('product_reviews')
                .select('rating')
                .eq('product_sku', sku);

            const ratingDisplay = document.getElementById('product-rating-display');
            if (!ratingDisplay) return;

            let avg = 0;
            let count = 0;

            if (reviews && reviews.length > 0) {
                count = reviews.length;
                const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
                avg = sum / count;
            }

            ratingDisplay.innerHTML = `
                <div class="stars text-warning d-flex">
                    ${generateStarsHtml(avg)}
                </div>
                <span class="text-muted small">(${count} review${count !== 1 ? 's' : ''})</span>
            `;
        } catch (err) {
            console.error('Error loading product rating:', err);
        }
    }

    function generateStarsHtml(rating) {
        let stars = '';
        const filledStars = Math.floor(rating || 0);
        for (let i = 1; i <= 5; i++) {
            if (i <= filledStars) {
                stars += '<i class="flaticon-star"></i>';
            } else if (i - 0.5 <= rating) {
                // Approximate half star with opacity or just full if closer
                stars += '<i class="flaticon-star" style="opacity: 0.6;"></i>';
            } else {
                stars += '<i class="flaticon-star" style="color: #e0e0e0;"></i>';
            }
        }
        return stars;
    }

    initProductDetails();
});
