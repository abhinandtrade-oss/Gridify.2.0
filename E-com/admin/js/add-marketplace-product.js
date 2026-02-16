/**
 * Marketplace: Add Product Logic for Sellers
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const form = document.getElementById('add-product-form');
    const categorySelect = document.getElementById('category-id');
    const imageContainer = document.getElementById('image-container');
    const btnAddImage = document.getElementById('btn-add-image');

    // Pricing inputs
    const mrpInput = document.getElementById('mrp');
    const sellingPriceInput = document.getElementById('selling-price');
    const discountValueInput = document.getElementById('discount-value');
    const discountTypeSelect = document.getElementById('discount-type');

    // Fee Display
    const feeBox = document.getElementById('fee-box');
    const feePercentEl = document.getElementById('fee-percent');
    const estFeeEl = document.getElementById('est-fee');
    const estGstEl = document.getElementById('est-gst');
    const estPayoutEl = document.getElementById('est-payout');

    // SKU Logic
    const skuPreview = document.getElementById('sku-preview');

    let currentSeller = null;
    let platformFeeSettings = { platformFee: 0, gstRate: 18 };
    let sellerSlNo = '0000';
    let productCount = 0;

    async function init() {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        // 1. Load Seller & Settings
        const { data: seller } = await client
            .from('sellers')
            .select('*')
            .eq('email', session.user.email)
            .maybeSingle();

        if (seller) {
            currentSeller = seller;
            // Use padded serial_no (e.g., 0001)
            sellerSlNo = (seller.serial_no || 0).toString().padStart(4, '0');

            // Get product count to suggest product sl no
            const { count } = await client
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('seller_id', seller.id);

            productCount = (count || 0) + 1;
            updateSKUPreview();
        } else {
            // Profile setup required
            if (confirm('You need to setup your Shop Profile before you can add products. Redirecting you to Profile Setup...')) {
                window.location.href = 'shop-profile.html';
            }
            return;
        }

        // 2. Load Categories (Admins only)
        const { data: categories } = await client
            .from('categories')
            .select('id, name')
            .eq('is_visible', true);

        if (categories) {
            categories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.id;
                opt.textContent = cat.name;
                categorySelect.appendChild(opt);
            });
        }

        // 3. Load Fee Settings
        let savedSettings = {};
        try {
            const { data } = await client
                .from('site_settings')
                .select('value')
                .eq('key', 'pricing_config')
                .maybeSingle();

            if (data && data.value) {
                savedSettings = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            }
        } catch (err) {
            console.warn('Could not load pricing settings from DB, falling back to local storage', err);
        }

        if (Object.keys(savedSettings).length === 0) {
            savedSettings = JSON.parse(localStorage.getItem('glamer_pricing_settings') || '{}');
        }

        platformFeeSettings = {
            platformFee: parseFloat(savedSettings.platformFee) ?? 0,
            minFee: parseFloat(savedSettings.minFee) ?? 0,
            gstRate: savedSettings.gstRate !== undefined ? parseFloat(savedSettings.gstRate) : 18
        };
        feePercentEl.textContent = platformFeeSettings.platformFee;

        lucide.createIcons();
    }

    function updateSKUPreview() {
        const pSl = productCount.toString().padStart(4, '0');
        skuPreview.textContent = `MP-${sellerSlNo}-${pSl}`;
    }

    // Image Management
    btnAddImage.addEventListener('click', () => {
        const row = document.createElement('div');
        row.className = 'image-row';
        row.innerHTML = `
            <div class="flex-grow-1">
                <label class="small text-muted mb-1">Image URL</label>
                <input type="url" class="form-control img-url" placeholder="https://example.com/image.jpg" required>
            </div>
            <div style="width: 100px;">
                <label class="small text-muted mb-1">Order</label>
                <input type="number" class="form-control img-order" value="${imageContainer.children.length + 1}" min="1">
            </div>
            <button type="button" class="btn btn-outline-danger btn-remove-img">
                <i data-lucide="trash-2" style="width: 16px;"></i>
            </button>
        `;
        imageContainer.appendChild(row);
        lucide.createIcons();

        row.querySelector('.btn-remove-img').addEventListener('click', () => {
            row.remove();
        });
    });

    // Pricing Logic
    function calculateFees() {
        const sprice = parseFloat(sellingPriceInput.value) || 0;

        // Enforcement: Min ₹10
        const priceWarning = document.getElementById('price-warning');
        if (sprice > 0 && sprice < 10) {
            priceWarning.style.display = 'block';
            sellingPriceInput.classList.add('is-invalid');
        } else {
            priceWarning.style.display = 'none';
            sellingPriceInput.classList.remove('is-invalid');
        }

        let feeAmount = (sprice * platformFeeSettings.platformFee) / 100;

        // Apply Minimum Fee if configured
        if (platformFeeSettings.minFee && feeAmount < platformFeeSettings.minFee && sprice > 0) {
            feeAmount = platformFeeSettings.minFee;
        }

        const gstAmount = (feeAmount * platformFeeSettings.gstRate) / 100;
        const totalDeduction = feeAmount + gstAmount;
        const payout = sprice - totalDeduction;

        // Update UI labels
        const gstLabel = document.querySelector('#fee-box span:nth-child(1)'); // This might be brittle, let's target the GST % specifically if possible
        // Actually, let's just update the values.

        estFeeEl.textContent = `₹${feeAmount.toFixed(2)}`;
        estGstEl.textContent = `₹${gstAmount.toFixed(2)}`;
        estPayoutEl.textContent = `₹${payout.toFixed(2)}`;

        // Update the GST % display if it exists
        const gstPercentDisplay = document.getElementById('gst-percent-display');
        if (gstPercentDisplay) gstPercentDisplay.textContent = platformFeeSettings.gstRate;
    }

    // Auto-calculate discount
    function updateDiscount() {
        const mrp = parseFloat(mrpInput.value) || 0;
        const sprice = parseFloat(sellingPriceInput.value) || 0;

        if (mrp > 0 && sprice > 0) {
            const diff = mrp - sprice;
            if (discountTypeSelect.value === 'amount') {
                discountValueInput.value = diff.toFixed(2);
            } else {
                discountValueInput.value = ((diff / mrp) * 100).toFixed(2);
            }
        }
        calculateFees();
    }

    [mrpInput, sellingPriceInput, discountTypeSelect].forEach(el => {
        el.addEventListener('input', updateDiscount);
    });

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentSeller) {
            alert('Seller profile not detected.');
            return;
        }

        const sprice = parseFloat(sellingPriceInput.value);
        if (sprice < 10) {
            alert('Minimum selling price allowed is ₹10.');
            return;
        }

        const btn = document.getElementById('btn-submit-product');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';

        // Gather images
        const imageRows = imageContainer.querySelectorAll('.image-row');
        const images = Array.from(imageRows).map(row => ({
            url: row.querySelector('.img-url').value,
            arrangement: parseInt(row.querySelector('.img-order').value) || 1
        }));

        const productData = {
            seller_id: currentSeller.id,
            category_id: categorySelect.value,
            sku: skuPreview.textContent,
            name: document.getElementById('product-name').value,
            description: document.getElementById('product-description').value,
            keywords: document.getElementById('product-keywords').value,
            mrp: parseFloat(mrpInput.value),
            selling_price: sprice,
            discount_type: discountTypeSelect.value,
            discount_value: parseFloat(discountValueInput.value) || 0,
            stock_quantity: parseInt(document.getElementById('stock-quantity').value) || 0,
            images: images,
            status: 'pending_approval' // Usually marketplace products need approval
        };

        const { error } = await client
            .from('products')
            .insert([productData]);

        if (error) {
            console.error('Insert error:', error);
            alert('Error adding product: ' + error.message + '\n\nPlease ensure the "products" table exists with appropriate columns.');
        } else {
            alert('Product listed successfully for approval!');
            window.location.href = 'marketplace-products.html';
        }

        btn.disabled = false;
        btn.innerHTML = originalText;
    });

    init();
});
