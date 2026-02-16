/**
 * Admin Product Reviews Management
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const reviewsContainer = document.getElementById('reviews-container');
    const searchInput = document.getElementById('search-reviews');
    const ratingFilter = document.getElementById('filter-rating');
    const repliedFilter = document.getElementById('filter-replied');
    const replyModal = new bootstrap.Modal(document.getElementById('replyModal'));
    const replyForm = document.getElementById('reply-form');
    const replyTextArea = document.getElementById('reply-text');
    const reviewIdInput = document.getElementById('review-id-input');
    const customerCommentText = document.getElementById('customer-comment-text');
    const btnSaveReply = document.getElementById('btn-save-reply');

    let allReviews = [];
    let currentUser = null;
    let currentRole = null;
    let sellerSkus = []; // If seller, store their product SKUs

    async function init() {
        // 1. Get current session and role
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;
        currentUser = session.user;

        const { data: roleData } = await client
            .from('user_roles')
            .select('role')
            .eq('user_id', currentUser.id)
            .single();

        currentRole = roleData?.role || 'user';

        // 2. If seller, fetch their product SKUs
        if (currentRole === 'seller' || currentRole === 'admin') {
            const { data: myProducts } = await client
                .from('products')
                .select('sku')
                .eq('seller_id', currentUser.id);

            if (myProducts) {
                sellerSkus = myProducts.map(p => p.sku);
            }
        }

        await loadReviews();
        setupEventListeners();
    }

    async function loadReviews() {
        try {
            reviewsContainer.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-primary"></div></div>';

            let query = client
                .from('product_reviews')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply Seller Restriction
            if (currentRole === 'seller' && sellerSkus.length > 0) {
                query = query.in('product_sku', sellerSkus);
            } else if (currentRole === 'seller' && sellerSkus.length === 0) {
                reviewsContainer.innerHTML = '<div class="text-center p-5 text-muted">You have no products yet.</div>';
                return;
            }

            const { data: reviews, error } = await query;
            if (error) throw error;

            if (reviews && reviews.length > 0) {
                const userIds = [...new Set(reviews.map(r => r.user_id))];
                const skus = [...new Set(reviews.map(r => r.product_sku))];

                const { data: profiles } = await client
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);

                const profileMap = {};
                if (profiles) profiles.forEach(p => profileMap[p.id] = p.full_name);

                // Fetch order status for these reviewers on these products
                const { data: orderData } = await client
                    .from('order_items')
                    .select(`
                        id,
                        orders(id, user_id, status, created_at),
                        products!inner(sku)
                    `)
                    .in('orders.user_id', userIds)
                    .in('products.sku', skus);

                const orderStatusMap = {};
                if (orderData) {
                    orderData.forEach(item => {
                        if (item.orders) {
                            const key = `${item.orders.user_id}_${item.products.sku}`;
                            if (!orderStatusMap[key] || new Date(item.orders.created_at) > new Date(orderStatusMap[key].date)) {
                                orderStatusMap[key] = {
                                    id: item.orders.id || 'N/A',
                                    status: item.orders.status,
                                    date: item.orders.created_at
                                };
                            }
                        }
                    });
                }

                reviews.forEach(r => {
                    r.profiles = { full_name: profileMap[r.user_id] || 'Customer' };
                    const statusKey = `${r.user_id}_${r.product_sku}`;
                    const orderInfo = orderStatusMap[statusKey];
                    r.order_status = orderInfo?.status || 'no_order';
                    r.order_id = orderInfo?.id || null;
                });
            }

            allReviews = reviews || [];
            renderReviews();
        } catch (err) {
            console.error('Error loading reviews:', err);
            reviewsContainer.innerHTML = '<div class="alert alert-danger">Error loading reviews. Please check console.</div>';
        }
    }

    function renderReviews() {
        const searchTerm = searchInput.value.toLowerCase();
        const rating = ratingFilter.value;
        const replied = repliedFilter.value;

        const filtered = allReviews.filter(r => {
            const matchesSearch = !searchTerm ||
                r.product_sku.toLowerCase().includes(searchTerm) ||
                (r.comment && r.comment.toLowerCase().includes(searchTerm)) ||
                (r.profiles?.full_name && r.profiles.full_name.toLowerCase().includes(searchTerm));

            const matchesRating = !rating || r.rating == rating;
            const matchesReplied = !replied || (replied === 'yes' ? !!r.seller_reply : !r.seller_reply);

            return matchesSearch && matchesRating && matchesReplied;
        });

        if (filtered.length === 0) {
            reviewsContainer.innerHTML = '<div class="text-center p-5 text-muted bg-white border rounded">No reviews found matching your criteria.</div>';
            return;
        }

        reviewsContainer.innerHTML = filtered.map(review => {
            const name = review.profiles?.full_name || 'Customer';
            const initial = name.charAt(0).toUpperCase();
            const date = new Date(review.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
            });

            return `
                <div class="review-card">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="d-flex gap-3">
                            <div class="reviewer-avatar">${initial}</div>
                            <div>
                                <h6 class="mb-0 fw-bold">${name} <span class="text-muted fw-normal">on ${review.product_sku}</span></h6>
                                <div class="stars mb-1">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
                                <div class="small text-muted mb-2 d-flex align-items-center gap-2">
                                    Posted on ${date} • 
                                    <span class="badge ${getStatusBadgeClass(review.order_status)}" style="font-size: 0.65rem;">
                                        ${review.order_status.toUpperCase().replace(/_/g, ' ')}
                                    </span>
                                    ${review.order_id ? `<span class="text-muted" style="font-size: 0.7rem;">Order: #${review.order_id.substring(0, 8)}...</span>` : ''}
                                </div>
                                <p class="mb-0 text-dark">${review.comment || '<span class="text-muted italic">No comment.</span>'}</p>
                            </div>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-primary" onclick="window.handleReply('${review.id}')">
                                <i data-lucide="message-square" style="width: 14px; margin-right: 4px;"></i> Reply
                            </button>
                            ${currentRole === 'super_admin' ? `
                                <button class="btn btn-sm btn-outline-danger" onclick="window.handleDelete('${review.id}')">
                                    <i data-lucide="trash-2" style="width: 14px; margin-right: 4px;"></i> Delete
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    ${review.seller_reply ? `
                        <div class="reply-box mt-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span class="fw-bold text-primary small">
                                    <i data-lucide="corner-down-right" style="width:12px"></i> 
                                    ${review.replied_by_system ? 'System Administrator' : 'Merchant Response'}
                                </span>
                                <div class="d-flex align-items-center gap-2">
                                    <span class="text-muted" style="font-size: 0.7rem;">
                                        ${new Date(review.replied_at).toLocaleDateString()}
                                    </span>
                                    ${currentRole === 'super_admin' ? `
                                        <button class="btn btn-link text-danger p-0" title="Delete Reply Only" onclick="window.deleteReplyOnly('${review.id}')">
                                            <i data-lucide="x-circle" style="width:14px"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                            <p class="mb-0 small text-muted">${review.seller_reply}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        lucide.createIcons();
    }

    function getStatusBadgeClass(status) {
        switch (status.toLowerCase()) {
            case 'pending': return 'bg-warning text-dark';
            case 'processing': return 'bg-info text-white';
            case 'shipped': return 'bg-primary text-white';
            case 'delivered': return 'bg-success text-white';
            case 'cancelled': return 'bg-danger text-white';
            case 'returned': return 'bg-secondary text-white';
            case 'no_order': return 'bg-light text-muted';
            default: return 'bg-dark text-white';
        }
    }

    function setupEventListeners() {
        searchInput.addEventListener('input', renderReviews);
        ratingFilter.addEventListener('change', renderReviews);
        repliedFilter.addEventListener('change', renderReviews);

        btnSaveReply.addEventListener('click', async () => {
            const rid = reviewIdInput.value;
            const reply = replyTextArea.value.trim();

            if (!reply) {
                if (window.NotificationSystem) window.NotificationSystem.showToast('Please enter a reply', 'error');
                return;
            }

            try {
                btnSaveReply.disabled = true;
                btnSaveReply.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sending...';

                const updateData = {
                    seller_reply: reply,
                    replied_at: new Date().toISOString(),
                    replied_by: currentUser.id,
                    replied_by_system: currentRole === 'super_admin'
                };

                const { error } = await client
                    .from('product_reviews')
                    .update(updateData)
                    .eq('id', rid);

                if (error) throw error;

                if (window.NotificationSystem) window.NotificationSystem.showToast('Reply sent successfully', 'success');
                replyModal.hide();
                await loadReviews();
            } catch (err) {
                console.error('Error saving reply:', err);
                if (window.NotificationSystem) window.NotificationSystem.showToast('Error sending reply.', 'error');
            } finally {
                btnSaveReply.disabled = false;
                btnSaveReply.innerHTML = 'Send Reply';
            }
        });
    }

    window.handleReply = (id) => {
        const review = allReviews.find(r => r.id === id);
        if (!review) return;

        reviewIdInput.value = review.id;
        customerCommentText.textContent = `"${review.comment || 'No comment provided.'}"`;
        replyTextArea.value = review.seller_reply || '';
        replyModal.show();
    };

    window.handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) return;

        try {
            const { error } = await client
                .from('product_reviews')
                .delete()
                .eq('id', id);

            if (error) throw error;

            if (window.NotificationSystem) window.NotificationSystem.showToast('Review deleted', 'success');
            await loadReviews();
        } catch (err) {
            console.error('Error deleting review:', err);
            if (window.NotificationSystem) window.NotificationSystem.showToast('Error deleting review', 'error');
        }
    };

    window.deleteReplyOnly = async (id) => {
        if (!confirm('Are you sure you want to delete only the seller reply?')) return;

        try {
            const { error } = await client
                .from('product_reviews')
                .update({
                    seller_reply: null,
                    replied_at: null,
                    replied_by: null,
                    replied_by_system: false
                })
                .eq('id', id);

            if (error) throw error;

            if (window.NotificationSystem) window.NotificationSystem.showToast('Reply removed', 'success');
            await loadReviews();
        } catch (err) {
            console.error('Error removing reply:', err);
            if (window.NotificationSystem) window.NotificationSystem.showToast('Error removing reply', 'error');
        }
    };

    init();
});
