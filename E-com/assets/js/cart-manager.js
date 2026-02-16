/**
 * Cart and Wishlist Manager
 * Handles local storage based cart and wishlist functionality
 */

const CartManager = {
    CART_KEY: 'hp_cart',
    WISHLIST_KEY: 'hp_wishlist',

    // --- Core Methods ---
    getCart() {
        return JSON.parse(localStorage.getItem(this.CART_KEY)) || [];
    },

    getWishlist() {
        return JSON.parse(localStorage.getItem(this.WISHLIST_KEY)) || [];
    },

    saveCart(cart) {
        localStorage.setItem(this.CART_KEY, JSON.stringify(cart));
        this.updateCounts();
        document.dispatchEvent(new CustomEvent('cartUpdated', { detail: cart }));
    },

    saveWishlist(wishlist) {
        localStorage.setItem(this.WISHLIST_KEY, JSON.stringify(wishlist));
        this.updateCounts();
        document.dispatchEvent(new CustomEvent('wishlistUpdated', { detail: wishlist }));
    },

    // --- Action Methods ---
    async addToCart(product, quantity = 1) {
        // Check login status first
        const session = await window.checkUserSession();
        if (!session) {
            this.showErrorToast(`Please login to add items to your cart.`);
            return false;
        }

        let cart = this.getCart();
        const existing = cart.find(item => item.id === product.id);
        const currentQtyInCart = existing ? existing.quantity : 0;
        const requestedTotal = currentQtyInCart + quantity;

        // Check stock
        if (requestedTotal > product.stock_quantity) {
            const availableToAdd = product.stock_quantity - currentQtyInCart;
            if (availableToAdd <= 0) {
                this.showErrorToast(`Sorry, no more stock available for ${product.name}`);
            } else {
                this.showErrorToast(`Only ${product.stock_quantity} units available. You already have ${currentQtyInCart} in cart.`);
            }
            return false;
        }

        if (existing) {
            existing.quantity = requestedTotal;
            existing.stock_quantity = product.stock_quantity; // Update stock info
        } else {
            cart.push({
                id: product.id,
                name: product.name,
                price: parseFloat(product.selling_price),
                image: product.images?.[0]?.url || 'https://placehold.co/100x130',
                quantity: quantity,
                stock_quantity: product.stock_quantity
            });
        }

        this.saveCart(cart);
        this.showToast(`${product.name} added to cart!`);
        return true;
    },

    async addToWishlist(product) {
        // Check login status first
        const session = await window.checkUserSession();
        if (!session) {
            this.showErrorToast(`Please login to use wishlist.`);
            return;
        }

        let wishlist = this.getWishlist();
        if (wishlist.some(item => item.id === product.id)) {
            this.showToast(`${product.name} is already in wishlist!`);
            return;
        }

        wishlist.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.selling_price),
            image: product.images?.[0]?.url || 'https://placehold.co/100x130'
        });

        this.saveWishlist(wishlist);
        this.showToast(`${product.name} added to wishlist!`);
    },

    removeFromCart(productId) {
        let cart = this.getCart().filter(item => item.id !== productId);
        this.saveCart(cart);
    },

    removeFromWishlist(productId) {
        let wishlist = this.getWishlist().filter(item => item.id !== productId);
        this.saveWishlist(wishlist);
    },

    updateQuantity(productId, delta) {
        let cart = this.getCart();
        const item = cart.find(i => i.id === productId);
        if (item) {
            const newQty = item.quantity + delta;

            if (delta > 0 && newQty > item.stock_quantity) {
                this.showErrorToast(`Cannot add more. Only ${item.stock_quantity} units in stock.`);
                return false;
            }

            item.quantity = newQty;
            if (item.quantity <= 0) {
                cart = cart.filter(i => i.id !== productId);
            }
            this.saveCart(cart);
            return true;
        }
        return false;
    },

    // --- UI Helpers ---
    updateCounts() {
        const cartCountEls = document.querySelectorAll('.cart-count-badge');
        const wishlistCountEls = document.querySelectorAll('.wishlist-count-badge');

        const cart = this.getCart();
        const wishlist = this.getWishlist();

        const cartTotal = cart.reduce((sum, item) => sum + item.quantity, 0);

        cartCountEls.forEach(el => el.textContent = cartTotal);
        wishlistCountEls.forEach(el => el.textContent = wishlist.length);
    },

    showToast(message) {
        if (window.showAlert) window.showAlert(message, 'success');
        else console.log('Cart:', message);
    },

    showErrorToast(message) {
        if (window.showAlert) window.showAlert(message, 'error');
        else console.error('Cart Error:', message);
    },

    init() {
        // Initialize global listeners
        document.addEventListener('click', async (e) => {
            const addToCartBtn = e.target.closest('.add-to-cart-btn-trigger');
            const addToWishlistBtn = e.target.closest('.add-to-wishlist-btn-trigger');

            if (addToCartBtn || addToWishlistBtn) {
                const productId = addToCartBtn?.dataset.id || addToWishlistBtn?.dataset.id;
                if (!productId) return;

                // Fetch product details if not already present
                try {
                    const { data: product } = await window.supabase
                        .from('products')
                        .select('*')
                        .eq('id', productId)
                        .single();

                    if (product) {
                        if (addToCartBtn) this.addToCart(product);
                        else this.addToWishlist(product);
                    }
                } catch (err) {
                    console.error('Action error:', err);
                }
            }
        });

        this.updateCounts();
    }
};

// Add count badge styles
const style = document.createElement('style');
style.textContent = `
    .badge-count {
        position: absolute;
        top: -8px;
        right: -8px;
        background: var(--ul-primary);
        color: white;
        font-size: 10px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        z-index: 10;
    }
`;
document.head.appendChild(style);

window.CartManager = CartManager;
CartManager.init();
