/**
 * Product Reviews Logic (Full Featured Version)
 * Handles eligibility, R2 image uploads, filtering, and editing
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    // CONFIGURATION
    const R2_WORKER_URL = 'https://review-images-proxy.info-adhil-ecom.workers.dev'.replace(/\/$/, '');

    // UI Elements
    const reviewsPane = document.getElementById('reviews-pane');
    const reviewsTab = document.getElementById('reviews-tab');

    let currentUserId = null;
    let productSku = null;
    let isEligible = false;
    let purchaseDate = null;
    let hasReviewed = false;
    let selectedImages = [];
    let allReviews = [];
    let activeFilter = null; // null or 1-5
    let isEditing = false;
    let editingReviewId = null;

    if (!productId) return;

    // Global Image Viewer
    window.viewImage = (url) => {
        const viewerHtml = `
            <div id="image-viewer" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;justify-content:center;align-items:center;cursor:pointer;" onclick="this.remove()">
                <img src="${url}" style="max-width:90%;max-height:90%;object-fit:contain;border-radius:10px;box-shadow:0 0 50px rgba(0,0,0,0.5);">
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', viewerHtml);
    };

    // 1. Initial Load
    async function initReviews() {
        try {
            // Get product SKU first
            const { data: product } = await client
                .from('products')
                .select('sku')
                .eq('id', productId)
                .single();

            if (product) productSku = product.sku;

            // Check Auth
            const { data: { session } } = await client.auth.getSession();
            if (session) {
                currentUserId = session.user.id;
                await checkEligibility();
                await checkExistingReview();
            }

            await loadReviews();
        } catch (err) {
            console.error('Reviews Init Error:', err);
        }
    }

    // 2. Eligibility & Existing Review Check
    async function checkEligibility() {
        if (!currentUserId || !productSku) return;

        const { data: eligibleOrders } = await client
            .from('order_items')
            .select(`
                id,
                orders!inner(status, user_id, created_at),
                products!inner(sku)
            `)
            .eq('orders.user_id', currentUserId)
            .eq('products.sku', productSku)
            .in('orders.status', ['delivered', 'return_refund', 'return_replacement'])
            .order('created_at', { foreignTable: 'orders', ascending: true }); // Get earliest purchase

        if (eligibleOrders && eligibleOrders.length > 0) {
            isEligible = true;
            // Store the earliest purchase date
            purchaseDate = new Date(eligibleOrders[0].orders.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
        }
    }

    async function checkExistingReview() {
        if (!currentUserId || !productSku) return;
        const { data } = await client
            .from('product_reviews')
            .select('*')
            .eq('user_id', currentUserId)
            .eq('product_sku', productSku)
            .maybeSingle();

        if (data) {
            hasReviewed = true;
            // Store for quick edit prepopulation
            window.myReview = data;
        }
    }

    function renderAddReviewButton() {
        // If button already exists, remove it first
        const existingBtn = document.getElementById('btn-open-review-modal');
        if (existingBtn) existingBtn.parentElement.remove();

        if (!isEligible) return;

        const btnContainer = document.createElement('div');
        btnContainer.className = 'text-end mb-4';

        let btnText = hasReviewed ? '<i class="flaticon-edit me-2"></i> Edit Your Review' : '<i class="flaticon-edit me-2"></i> Write a Review';

        btnContainer.innerHTML = `
            <button id="btn-open-review-modal" class="add-to-cart-btn w-auto py-2 px-4 shadow-sm">
                ${btnText}
            </button>
        `;
        reviewsPane.prepend(btnContainer);

        document.getElementById('btn-open-review-modal').addEventListener('click', () => {
            if (hasReviewed) {
                editReview(window.myReview);
            } else {
                openReviewModal();
            }
        });
    }

    function openReviewModal() {
        isEditing = false;
        editingReviewId = null;
        selectedImages = [];
        const form = document.getElementById('review-form');
        if (form) form.reset();

        const preview = document.getElementById('upload-preview');
        if (preview) preview.innerHTML = '';

        const label = document.getElementById('rating-label-display');
        if (label) label.textContent = '';

        const title = document.getElementById('reviewModalLabel');
        if (title) title.textContent = 'Write a Review';

        const modalEl = document.getElementById('reviewModal');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    }

    window.editReview = (review) => {
        isEditing = true;
        editingReviewId = review.id;

        // Populate form
        const ratingInput = document.querySelector(`input[name="rating"][value="${review.rating}"]`);
        if (ratingInput) ratingInput.checked = true;

        const label = document.getElementById('rating-label-display');
        if (label) label.textContent = ratingLabels[review.rating] || '';

        const comment = document.getElementById('review-comment-text');
        if (comment) comment.value = review.comment || '';

        // Populate existing images
        selectedImages = (review.images || []).map(url => ({
            id: Math.random(),
            url: url,
            isExisting: true
        }));
        updatePreviews();

        const title = document.getElementById('reviewModalLabel');
        if (title) title.textContent = 'Edit Your Review';

        const submitBtn = document.getElementById('btn-submit-review');
        if (submitBtn) submitBtn.textContent = 'Update Review';

        const modalEl = document.getElementById('reviewModal');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    };

    // 3. Load & Render Reviews
    async function loadReviews() {
        if (!productSku) return;

        try {
            const { data: reviews, error } = await client
                .from('product_reviews')
                .select('*')
                .eq('product_sku', productSku)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (reviews && reviews.length > 0) {
                const userIds = [...new Set(reviews.map(r => r.user_id))];

                // Fetch profiles for all reviewers
                const { data: profiles, error: pError } = await client
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);

                if (pError) console.warn('Profile fetch error:', pError);

                const profileMap = {};
                if (profiles) {
                    profiles.forEach(p => {
                        profileMap[p.id] = p.full_name;
                    });
                }

                // Also fetch purchase dates for these reviewers
                const { data: oItems } = await client
                    .from('order_items')
                    .select('orders(user_id, created_at), products!inner(sku)')
                    .eq('products.sku', productSku)
                    .in('orders.user_id', userIds)
                    .in('orders.status', ['delivered', 'return_refund', 'return_replacement']);

                const purchaseDateMap = {};
                if (oItems) {
                    oItems.forEach(oi => {
                        if (oi.orders) {
                            const uid = oi.orders.user_id;
                            const date = new Date(oi.orders.created_at);
                            if (!purchaseDateMap[uid] || date < purchaseDateMap[uid]) {
                                purchaseDateMap[uid] = date;
                            }
                        }
                    });
                }

                reviews.forEach(r => {
                    // Mapping profile name with a clearer fallback if mapping exists but name is null
                    const profileName = profileMap[r.user_id];
                    r.profiles = {
                        full_name: profileName || (r.user_id === currentUserId ? 'You' : 'E-Com Customer')
                    };

                    if (purchaseDateMap[r.user_id]) {
                        r.purchaseDateStr = purchaseDateMap[r.user_id].toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                        });
                    }
                });
            }

            allReviews = reviews || [];
            renderReviews();
        } catch (err) {
            console.error('Error loading reviews:', err);
            reviewsPane.innerHTML = `<div class="text-center py-5 text-danger">Failed to load reviews. Please refresh.</div>`;
        }
    }

    function renderReviews() {
        const filtered = activeFilter ? allReviews.filter(r => r.rating === activeFilter) : allReviews;
        const countText = `Reviews (${allReviews.length})`;
        if (reviewsTab) reviewsTab.textContent = countText;
        const countBadge = document.getElementById('reviews-count-badge');
        if (countBadge) countBadge.textContent = `${allReviews.length} Review${allReviews.length !== 1 ? 's' : ''}`;

        if (allReviews.length === 0) {
            reviewsPane.innerHTML = `
                <div class="text-center py-5">
                    <i class="flaticon-box mb-3 d-block text-muted" style="font-size: 60px; opacity: 0.2;"></i>
                    <p class="text-muted">No reviews yet for this product.</p>
                    ${isEligible && !hasReviewed ? '<p class="text-muted small">Be the first to share your experience!</p>' : ''}
                </div>
            `;
            renderAddReviewButton();
            return;
        }

        const avgRating = (allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length).toFixed(1);

        let reviewsHtml = `
            <div class="reviews-summary row align-items-center g-4 mb-5">
                <div class="col-md-4 text-center border-end">
                    <div class="rating-huge">${avgRating}</div>
                    <div class="text-warning mb-2 fs-5">
                        ${generateStars(avgRating)}
                    </div>
                    <div class="text-muted small">Based on ${allReviews.length} Verified ${allReviews.length === 1 ? 'Review' : 'Reviews'}</div>
                </div>
                <div class="col-md-8 px-lg-5">
                    ${generateRatingBars()}
                </div>
            </div>
            
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h6 class="fw-bold mb-0">${activeFilter ? `Showing ${activeFilter} Star Reviews` : 'All Reviews'} (${filtered.length})</h6>
                ${activeFilter ? `<button class="btn btn-link btn-sm text-decoration-none" onclick="window.setReviewFilter(null)">Clear Filter</button>` : ''}
            </div>

            <div class="reviews-list">
                ${filtered.length > 0 ? filtered.map(r => renderReviewCard(r)).join('') : '<div class="text-center py-5 text-muted">No reviews match your filter.</div>'}
            </div>
        `;

        reviewsPane.innerHTML = reviewsHtml;
        renderAddReviewButton();
    }

    window.handleEditClick = (reviewId) => {
        const review = allReviews.find(r => r.id === reviewId);
        if (review) editReview(review);
    };

    function renderReviewCard(review) {
        const reviewDate = new Date(review.created_at).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
        const name = review.profiles?.full_name || 'Verified Buyer';
        const initial = name.charAt(0).toUpperCase();

        const imagesHtml = (review.images || []).map(img => `
            <img src="${img}" class="review-img" onclick="window.viewImage('${img}')" onerror="this.style.display='none'">
        `).join('');

        const isMine = review.user_id === currentUserId;

        return `
            <div class="review-card shadow-sm border-0">
                ${isMine ? `
                    <div class="review-actions">
                        <button class="action-btn" title="Edit your review" onclick="window.handleEditClick('${review.id}')">
                            <i class="flaticon-edit"></i>
                        </button>
                    </div>
                ` : ''}
                <div class="review-header">
                    <div class="reviewer-info">
                        <div class="reviewer-avatar">${initial}</div>
                        <div>
                            <div class="fw-bold d-flex align-items-center gap-2">
                                ${name} 
                                <span class="verified-badge"><i class="flaticon-check"></i> Verified Buyer</span>
                            </div>
                            <div class="text-warning small" style="margin-top: 2px;">${generateStars(review.rating)}</div>
                            ${review.purchaseDateStr ? `<span class="purchase-date" title="Reliable Purchase Date">Ordered: ${review.purchaseDateStr}</span>` : ''}
                        </div>
                    </div>
                    <div class="text-end pe-md-4">
                        <div class="review-date text-muted">Reviewed: ${reviewDate}</div>
                    </div>
                </div>
                <div class="review-comment mt-3">${review.comment || 'No comment provided.'}</div>
                ${imagesHtml ? `<div class="review-images mt-3">${imagesHtml}</div>` : ''}
                
                ${review.seller_reply ? `
                    <div class="seller-reply-container mt-3 p-3 rounded" style="background: #f8f9fa; border-left: 4px solid #ef2853;">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="fw-bold small text-dark">
                                <i class="flaticon-back-arrow" style="transform: scaleX(-1); display: inline-block; margin-right: 5px;"></i>
                                ${review.replied_by_system ? 'System Administrator' : 'Seller Response'}
                            </span>
                            <span class="text-muted" style="font-size: 0.75rem;">${new Date(review.replied_at).toLocaleDateString()}</span>
                        </div>
                        <p class="mb-0 small text-muted italic">${review.seller_reply}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    function generateStars(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= Math.floor(rating)) {
                stars += '<i class="flaticon-star"></i>';
            } else if (i - 0.5 <= rating) {
                stars += '<i class="flaticon-star" style="opacity: 0.7;"></i>';
            } else {
                stars += '<i class="flaticon-star" style="opacity: 0.15;"></i>';
            }
        }
        return stars;
    }

    function generateRatingBars() {
        const counts = [0, 0, 0, 0, 0, 0];
        allReviews.forEach(r => counts[r.rating]++);

        let html = '';
        for (let i = 5; i >= 1; i--) {
            const percent = ((counts[i] / allReviews.length) * 100).toFixed(0);
            const activeClass = activeFilter === i ? 'active' : '';
            html += `
                <div class="rating-bar-row d-flex align-items-center gap-3 mb-2 ${activeClass}" onclick="window.setReviewFilter(${i})">
                    <div style="width: 50px;" class="small text-muted">${i} Stars</div>
                    <div class="progress flex-grow-1" style="height: 6px; border-radius: 10px; background: #f0f0f0;">
                        <div class="progress-bar bg-warning" style="width: ${percent}%"></div>
                    </div>
                    <div style="width: 40px;" class="small text-muted text-end">${percent}%</div>
                </div>
            `;
        }
        return html;
    }

    window.setReviewFilter = (stars) => {
        activeFilter = (activeFilter === stars) ? null : stars;
        renderReviews();
    };

    // 4. Form Handling & File Upload
    const imageInput = document.getElementById('review-images-input');
    const previewContainer = document.getElementById('upload-preview');
    const ratingLabels = {
        '5': 'Excellent!',
        '4': 'Very Good',
        '3': 'Average',
        '2': 'Poor',
        '1': 'Terrible'
    };

    document.querySelectorAll('input[name="rating"]').forEach(input => {
        input.addEventListener('change', (e) => {
            const label = document.getElementById('rating-label-display');
            if (label) label.textContent = ratingLabels[e.target.value] || '';
        });
    });

    imageInput?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.size > 1.5 * 1024 * 1024) {
                showAlert('Image exceeds 1.5MB limit: ' + file.name, 'warning');
                return;
            }
            if (selectedImages.length >= 5) {
                showAlert('Max 5 images allowed.', 'warning');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                const id = Date.now() + Math.random();
                selectedImages.push({ id, file, base64: event.target.result });
                updatePreviews();
            };
            reader.readAsDataURL(file);
        });
        imageInput.value = '';
    });

    function updatePreviews() {
        if (!previewContainer) return;
        previewContainer.innerHTML = selectedImages.map(img => `
            <div class="preview-box">
                <img src="${img.base64 || img.url}">
                <button class="remove-img" onclick="removeSelectedImage(${img.id})">×</button>
            </div>
        `).join('');
    }

    window.removeSelectedImage = (id) => {
        selectedImages = selectedImages.filter(img => img.id !== id);
        updatePreviews();
    };

    // SUBMIT/UPDATE REVIEW
    const btnSubmit = document.getElementById('btn-submit-review');
    btnSubmit?.addEventListener('click', async () => {
        const rating = document.querySelector('input[name="rating"]:checked')?.value;
        const comment = document.getElementById('review-comment-text').value;

        if (!rating) {
            showAlert('Please select a rating.', 'warning');
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> ${isEditing ? 'Updating...' : 'Submitting...'}`;

        try {
            const imageUrls = [];
            for (const img of selectedImages) {
                if (img.isExisting) {
                    imageUrls.push(img.url);
                } else {
                    const url = await uploadToR2(img.file);
                    if (url) imageUrls.push(url);
                }
            }

            const reviewData = {
                user_id: currentUserId,
                product_sku: productSku,
                rating: parseInt(rating),
                comment: comment,
                images: imageUrls,
                created_at: isEditing ? undefined : new Date().toISOString()
            };

            const { error } = await client
                .from('product_reviews')
                .upsert(reviewData, { onConflict: 'user_id,product_sku' });

            if (error) throw error;

            showAlert(isEditing ? 'Review updated successfully!' : 'Thank you! Your review has been posted.', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('reviewModal'));
            modal.hide();

            hasReviewed = true;
            await checkExistingReview(); // Refresh myReview
            loadReviews(); // Refresh list

        } catch (err) {
            console.error('Submit Error:', err);
            showAlert('Error: ' + err.message, 'error');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Submit Review';
        }
    });

    async function uploadToR2(file) {
        if (!R2_WORKER_URL) return null;
        const fileName = `reviews/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
        try {
            const response = await fetch(`${R2_WORKER_URL}?key=${encodeURIComponent(fileName)}`, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type }
            });
            if (response.ok) return `${R2_WORKER_URL}?key=${encodeURIComponent(fileName)}`;
            throw new Error('Upload failed');
        } catch (e) {
            console.error('R2 Error:', e);
            throw e;
        }
    }

    initReviews();
});
