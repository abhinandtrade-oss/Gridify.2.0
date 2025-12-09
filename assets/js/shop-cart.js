/* Shop, Cart, and Checkout Logic */

const CART_KEY = 'ridda_cart';
// Check if APP_SCRIPT_URL is already defined in window (from product-manager.js), otherwise define it locally
const API_URL = (typeof window.APP_SCRIPT_URL !== 'undefined')
    ? window.APP_SCRIPT_URL
    : 'https://script.google.com/macros/s/AKfycbwB90DHy11h3yyZaSTJ1Q-gPJhjEspF-eG9Pwp268i4hynoj4HQ1-M9lz79eZUOXKfRAA/exec';

// --- Cart State Management ---

function getCart() {
    const cart = localStorage.getItem(CART_KEY);
    return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function updateCartCount() {
    const count = getCart().reduce((sum, item) => sum + item.quantity, 0);

    // Desktop Badge
    const badge = document.getElementById('nav-cart-count');
    if (badge) {
        badge.textContent = count;
        if (count === 0) badge.classList.add('d-none');
        else badge.classList.remove('d-none');
    }

    // Mobile Badge
    const mobileBadge = document.getElementById('mobile-cart-count');
    if (mobileBadge) {
        mobileBadge.textContent = count;
        if (count === 0) mobileBadge.classList.add('d-none');
        else mobileBadge.classList.remove('d-none');
    }
}



function showCartNotification(message) {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('cart-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'cart-notification';
        notification.className = 'cart-notification-toast';
        // Add icon
        notification.innerHTML = '<i class="fas fa-check-circle"></i> <span class="msg"></span>';
        document.body.appendChild(notification);
    }

    // Set message
    notification.querySelector('.msg').textContent = message;

    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Hide after 3 seconds
    if (window.cartNotificationTimeout) {
        clearTimeout(window.cartNotificationTimeout);
    }

    window.cartNotificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function addToCart(product) {
    let cart = getCart();
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    saveCart(cart);
    showCartNotification(`${product.title} has been added to your cart!`);
    updateCartCount();
}


function removeFromCart(productId) {
    try {
        let cart = getCart();
        // Use loose equality to ensure string/number IDs match
        cart = cart.filter(item => item.id != productId);
        saveCart(cart);
        renderCart();
        updateCheckoutSummary();
        updateCartCount();
    } catch (error) {
        console.error("Error removing item:", error);
    }
}

function updateQuantity(productId, change) {
    let cart = getCart();
    const item = cart.find(item => item.id === productId);

    if (item) {
        item.quantity += change;
        if (item.quantity < 1) item.quantity = 1; // Prevent 0 or negative
        saveCart(cart);
        renderCart();
        updateCheckoutSummary();
        updateCartCount();
    }
}

function clearCart() {
    localStorage.removeItem(CART_KEY);
    renderCart();
    updateCartCount();
    updateCheckoutSummary();
}

function getCartTotal() {
    const cart = getCart();
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// --- Shop Page: Modal & Events ---


function changeButtonText(btn) {
    const span = btn.querySelector('span');
    if (!span) return;

    // Prevent double clicking/flickering if user clicks fast
    if (btn.classList.contains('is-added-state')) return;
    btn.classList.add('is-added-state');

    const originalText = "Add to Cart"; // Assuming standard text
    const originalHover = btn.getAttribute('data-hover');

    span.textContent = 'Added! ✔️';
    btn.setAttribute('data-hover', 'Added! ✔️');

    setTimeout(() => {
        span.textContent = originalText;
        if (originalHover) btn.setAttribute('data-hover', originalHover);
        btn.classList.remove('is-added-state');
    }, 2000);
}

function setupShopPage() {
    // Event delegation for "Add to Cart" on main shop page
    document.addEventListener('click', function (e) {
        if (e.target.closest('.add-to-cart-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.add-to-cart-btn');
            const product = {
                id: btn.dataset.id,
                title: btn.dataset.title,
                price: parseFloat(btn.dataset.price),
                image: btn.dataset.image
            };
            addToCart(product);
            changeButtonText(btn);
        }

        if (e.target.closest('.view-details-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.view-details-btn');
            openProductModal({
                id: btn.dataset.id,
                title: btn.dataset.title,
                price: parseFloat(btn.dataset.price),
                image: btn.dataset.image,
                category: btn.dataset.category,
                description: btn.dataset.description
            });
        }

        // Cart Remove Button Delegation
        if (e.target.closest('.remove-from-cart-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.remove-from-cart-btn');
            removeFromCart(btn.dataset.id);
        }
    });
}


function openProductModal(product) {
    const modal = document.getElementById('productDetailsModal');
    if (!modal) return;

    // Populate Modal Data
    modal.querySelector('.modal-title').textContent = product.title;
    modal.querySelector('.modal-price').textContent = '₹' + product.price;
    modal.querySelector('.modal-category').textContent = product.category || 'Product';
    modal.querySelector('.modal-img').src = product.image;

    // Update Description
    const descEl = modal.querySelector('.modal-body p');
    if (descEl) {
        descEl.textContent = product.description || "Experience premium quality with our exclusive design assets. Perfect for your next project.";
    }

    // Set up "Add to Cart" button in modal
    const modalAddBtn = modal.querySelector('.modal-add-to-cart');
    // Remove old event listeners to prevent duplicates (cloning is a simple way)
    const newBtn = modalAddBtn.cloneNode(true);
    modalAddBtn.parentNode.replaceChild(newBtn, modalAddBtn);

    newBtn.addEventListener('click', () => {
        addToCart(product);
        changeButtonText(newBtn);
        // $('#productDetailsModal').modal('hide'); // Don't hide immediately so user sees "Added!"
        setTimeout(() => {
            if (typeof $ !== 'undefined') {
                $('#productDetailsModal').modal('hide');
            } else {
                // Vanilla bootstrap close if strictly needed, but let's stick to jQuery as per existing code preference or just leave it open? 
                // Using the existing close logic but delayed slightly looks better, BUT user might want to add multiple.
                // Actually, usually you want to keep shopping or close. 
                // The original code closed it immediately: $('#productDetailsModal').modal('hide');
                // Let's keep it open so they see "Added!", or delay close.
                // IF I close it immediately, they won't see "Added!" on the button.
                // Let's comment out the close for now or delay it.
                // I'll delay it for 0.5s so they see the click effect at least, or just leave it open.
                // Leaving it open is better UX for "Add to Cart" usually.
            }
        }, 500);
    });

    // Show Modal (Bootstrap 5 vanilla JS way)
    if (typeof $ !== 'undefined') {
        $('#productDetailsModal').modal('show');
    } else {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
}

// --- Cart Page Logic ---

function renderCart() {
    try {
        const cartContainer = document.getElementById('cart-items');
        const totalContainer = document.getElementById('cart-total');
        const subtotalContainer = document.getElementById('cart-subtotal');
        const orderTotalContainer = document.getElementById('order-total');

        if (!cartContainer) return;

        // Debug Log
        console.log("Rendering Cart...");

        const cart = getCart();
        cartContainer.innerHTML = '';

        if (cart.length === 0) {
            cartContainer.innerHTML = '<tr><td colspan="4" class="text-center">Your cart is empty.</td></tr>';
            if (subtotalContainer) subtotalContainer.innerText = '0';
            if (orderTotalContainer) orderTotalContainer.innerText = '0';
            return;
        }

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="title">${item.title}</span></td>
                <td><span class="price">₹${item.price}</span></td>
                <td>
                    <div class="quantity-input">
                        <button class="quantity-down" onclick="updateQuantity('${item.id}', -1)">--</button>
                        <input class="quantity" type="text" value="${item.quantity}" readonly>
                        <button class="quantity-up" onclick="updateQuantity('${item.id}', 1)">+</button>
                    </div>
                </td>
                <td><b class="price">₹${itemTotal}</b></td>
                <td>
                    <button class="remove-from-cart-btn btn btn-danger btn-sm" data-id="${item.id}" title="Remove Item" style="color: #fff !important; background-color: #dc3545 !important; border-color: #dc3545 !important;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            cartContainer.appendChild(row);
        });

        const total = getCartTotal();
        let finalTotal = total;

        // Check for applied coupon
        const couponData = sessionStorage.getItem('gridify_applied_coupon');
        if (couponData) {
            try {
                const coupon = JSON.parse(couponData);
                let discount = 0;
                if (coupon.type === 'percent') {
                    discount = total * (parseFloat(coupon.value) / 100);
                } else if (coupon.type === 'fixed') {
                    discount = parseFloat(coupon.value);
                }

                finalTotal = total - discount;
                if (finalTotal < 0) finalTotal = 0;

                // Update Order Total UI with discount info
                if (orderTotalContainer) {
                    orderTotalContainer.innerHTML = `
                        <span style="text-decoration: line-through; color: #999; font-size: 0.8em;">₹${total}</span>
                        <span style="color: #28a745;">₹${finalTotal.toFixed(2)}</span>
                        <div style="font-size: 0.8em; color: #28a745;">Code: ${coupon.code} Applied</div>
                    `;
                }
            } catch (e) {
                console.error("Coupon Parse Error", e);
                // Fallback
                if (orderTotalContainer) orderTotalContainer.innerText = total;
            }
        } else {
            if (orderTotalContainer) orderTotalContainer.innerText = total;
        }

        if (subtotalContainer) subtotalContainer.innerText = total;

    } catch (e) {
        console.error("Render error:", e);
    }
}


// --- Checkout Page Logic ---

function updateCheckoutSummary() {
    const summaryContainer = document.querySelector('.checkout-summary-tbody'); // We need to add this class or ID to checkout table body
    const totalDisplay = document.querySelector('.checkout-total-price');

    if (!summaryContainer) return;

    const cart = getCart();
    summaryContainer.innerHTML = '';

    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.title} <strong>× ${item.quantity}</strong></td>
            <td>₹${itemTotal}</td>
        `;
        summaryContainer.appendChild(row);
    });

    // Apply Coupon
    if (totalDisplay) {
        let finalTotal = total;
        const couponData = sessionStorage.getItem('gridify_applied_coupon');
        if (couponData) {
            try {
                const coupon = JSON.parse(couponData);
                let discount = 0;
                if (coupon.type === 'percent') {
                    discount = total * (parseFloat(coupon.value) / 100);
                } else if (coupon.type === 'fixed') {
                    discount = parseFloat(coupon.value);
                }
                finalTotal = total - discount;
                if (finalTotal < 0) finalTotal = 0;

                totalDisplay.innerHTML = `
                <span class="text-decoration-line-through text-muted small me-2">₹${total}</span>
                <span class="text-success">₹${finalTotal.toFixed(2)}</span>
                <div class="small text-success">Code: ${coupon.code}</div>
                `;
            } catch (e) { totalDisplay.innerText = '₹' + total; }
        } else {
            totalDisplay.innerText = '₹' + total;
        }
    }
}




function setupCheckoutPage() {
    const placeOrderBtn = document.getElementById('place-order-btn');
    const checkoutForm = document.getElementById('checkout-form');
    const successModal = document.getElementById('successModal');
    const closeBtn = document.querySelector('.close-modal');

    // Close Modal Logic
    if (closeBtn && successModal) {
        closeBtn.addEventListener('click', () => {
            successModal.classList.remove('show');
            document.body.style.overflow = '';
        });

        window.addEventListener('click', (e) => {
            if (e.target === successModal) {
                successModal.classList.remove('show');
                document.body.style.overflow = '';
            }
        });
    }


    if (!placeOrderBtn || !checkoutForm) return;

    placeOrderBtn.addEventListener('click', function (e) {
        e.preventDefault();

        // 1. Validate Form
        if (!checkoutForm.checkValidity()) {
            checkoutForm.reportValidity();
            return;
        }

        // 2. Prepare Data
        const formData = new FormData(checkoutForm);

        // Add Cart Details
        const cart = getCart();
        const cartDetails = cart.map(item => `${item.title} (x${item.quantity}) - ₹${item.price * item.quantity}`).join('\n');

        formData.append('Ordered Items', cartDetails);

        // Calculate Final Total
        let total = getCartTotal();
        const couponData = sessionStorage.getItem('gridify_applied_coupon');
        if (couponData) {
            try {
                const coupon = JSON.parse(couponData);
                let discount = 0;
                if (coupon.type === 'percent') {
                    discount = total * (parseFloat(coupon.value) / 100);
                } else if (coupon.type === 'fixed') {
                    discount = parseFloat(coupon.value);
                }
                total = total - discount;
                if (total < 0) total = 0;
                formData.append('Applied Coupon', `${coupon.code} (${coupon.value}${coupon.type === 'percent' ? '%' : '₹'})`);
            } catch (e) { }
        }

        formData.append('Total Amount', '₹' + total);

        // Add Payment Method
        const paymentMethod = document.querySelector('input[name="payment_method"]:checked');

        if (!paymentMethod) {
            alert('Please select a payment method.');

            // Scroll to payment section
            const paymentSection = document.getElementById('paymentMethod');
            if (paymentSection) {
                paymentSection.scrollIntoView({ behavior: 'smooth' });
            }
            return;
        }

        formData.append('Payment Method', paymentMethod.value);


        // 3. Show Loading State
        const originalBtnText = placeOrderBtn.innerHTML;
        placeOrderBtn.disabled = true;
        placeOrderBtn.innerHTML = '<span>Processing...</span>';

        // 4. Submit via Fetch
        fetch(checkoutForm.action, {
            method: 'POST',
            mode: 'no-cors', // Important for Google Apps Script
            body: formData
        })
            .then(response => {
                // For no-cors, we get an opaque response. We assume success if no network error.
                // 5. Show Success Popup
                clearCart();

                // Show Modal (Custom)
                if (successModal) {
                    successModal.classList.add('show');
                    document.body.style.overflow = 'hidden';
                }

                // Reset Form
                checkoutForm.reset();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('There was a problem submitting your order. Please try again.');
            })
            .finally(() => {
                placeOrderBtn.disabled = false;
                placeOrderBtn.innerHTML = originalBtnText;
            });
    });
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("Shop Cart JS Loaded"); // Debug
    // Setup global events (Add to cart, View details, Remove from cart)
    setupShopPage();
    updateCartCount();

    // Page specific logic
    if (document.getElementById('cart-items')) {
        renderCart();
    }
    if (document.querySelector('.checkout-form')) {
        updateCheckoutSummary();
        setupCheckoutPage();
    }


    // Coupon Form Logic
    const couponForm = document.getElementById('coupon-form');
    if (couponForm) {
        couponForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const messageDiv = document.getElementById('coupon-message');
            const codeInput = document.getElementById('coupon-code');
            const btn = couponForm.querySelector('button');

            if (!codeInput || !codeInput.value) return;
            const code = codeInput.value.trim();

            if (messageDiv) messageDiv.innerHTML = 'Verifying...';
            if (btn) btn.disabled = true;

            try {
                // Fetch coupons from Cloud
                const response = await fetch(`${API_URL}?action=getCoupons`);
                const coupons = await response.json();

                // Find match
                const match = coupons.find(c => String(c.code) === code && String(c.status) === 'active');

                if (match) {
                    // Valid
                    sessionStorage.setItem('gridify_applied_coupon', JSON.stringify(match));
                    if (messageDiv) messageDiv.innerHTML = `<span class="text-success">Coupon '${match.code}' applied! Saving ${match.value}${match.type === 'percent' ? '%' : '₹'}</span>`;
                    renderCart(); // Re-render to update totals
                } else {
                    // Invalid
                    sessionStorage.removeItem('gridify_applied_coupon');
                    renderCart();
                    if (messageDiv) messageDiv.innerHTML = `<span style="color: red;">Invalid or expired coupon code.</span>`;
                }

            } catch (err) {
                console.error("Coupon Error", err);
                if (messageDiv) messageDiv.innerHTML = `<span style="color: red;">Network Error. Please try again.</span>`;
            } finally {
                if (btn) btn.disabled = false;
            }
        });
    }

    // Clear All Logic
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', function (e) {
            e.preventDefault();
            clearCart();
            location.reload();
        });
    }

    // Optional user-friendly count update
});
