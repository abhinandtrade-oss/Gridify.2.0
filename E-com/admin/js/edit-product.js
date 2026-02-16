/**
 * Admin: Edit Product Logic for All Suppliers
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const form = document.getElementById('edit-product-form');
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

    let originalProduct = null;
    let platformFeeSettings = { platformFee: 0, gstRate: 18 };
    let productId = new URLSearchParams(window.location.search).get('id');

    if (!productId) {
        showAlert('No product ID provided.', 'error');
        setTimeout(() => window.location.href = 'products.html', 2000);
        return;
    }

    async function init() {
        const { data: { session } } = await client.auth.getSession();
        if (!session) return;

        // 1. Load Categories
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

        // 2. Load Fee Settings
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
            console.warn('Could not load pricing settings from DB', err);
        }

        platformFeeSettings = {
            platformFee: parseFloat(savedSettings.platformFee) ?? 0,
            minFee: parseFloat(savedSettings.minFee) ?? 0,
            gstRate: savedSettings.gstRate !== undefined ? parseFloat(savedSettings.gstRate) : 18
        };
        feePercentEl.textContent = platformFeeSettings.platformFee;

        // 3. Load Product Data (Any seller)
        const { data: product, error } = await client
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (error || !product) {
            console.error('Error loading product:', error);
            showAlert('Product not found.', 'error');
            setTimeout(() => window.location.href = 'products.html', 2000);
            return;
        }

        originalProduct = product;
        fillForm(product);
        lucide.createIcons();
    }

    function fillForm(p) {
        document.getElementById('product-name').value = p.name;
        categorySelect.value = p.category_id;
        document.getElementById('stock-quantity').value = p.stock_quantity;
        document.getElementById('product-description').value = p.description;
        document.getElementById('product-keywords').value = p.keywords || '';
        skuPreview.textContent = p.sku;
        mrpInput.value = p.mrp;
        sellingPriceInput.value = p.selling_price;
        discountTypeSelect.value = p.discount_type;
        discountValueInput.value = p.discount_value;
        document.getElementById('product-status').value = p.status;

        // Images
        imageContainer.innerHTML = '';
        if (p.images && p.images.length > 0) {
            p.images.sort((a, b) => a.arrangement - b.arrangement).forEach(img => {
                addImageRow(img.url, img.arrangement);
            });
        } else {
            addImageRow('', 1);
        }

        calculateFees();
    }

    function addImageRow(url = '', order = 1) {
        const row = document.createElement('div');
        row.className = 'image-row';
        row.innerHTML = `
            <div class="flex-grow-1">
                <label class="small text-muted mb-1">Image URL</label>
                <input type="url" class="form-control img-url" placeholder="https://example.com/image.jpg" value="${url}" required>
            </div>
            <div style="width: 100px;">
                <label class="small text-muted mb-1">Order</label>
                <input type="number" class="form-control img-order" value="${order}" min="1">
            </div>
            <button type="button" class="btn btn-outline-danger btn-remove-img">
                <i data-lucide="trash-2" style="width: 16px;"></i>
            </button>
        `;
        imageContainer.appendChild(row);
        lucide.createIcons();

        row.querySelector('.btn-remove-img').addEventListener('click', () => {
            if (imageContainer.children.length > 1) {
                row.remove();
            } else {
                showAlert('At least one image is required.', 'warning');
            }
        });
    }

    btnAddImage.addEventListener('click', () => {
        addImageRow('', imageContainer.children.length + 1);
    });

    // Pricing Logic
    function calculateFees() {
        const sprice = parseFloat(sellingPriceInput.value) || 0;
        const priceWarning = document.getElementById('price-warning');
        if (sprice > 0 && sprice < 10) {
            priceWarning.style.display = 'block';
            sellingPriceInput.classList.add('is-invalid');
        } else {
            priceWarning.style.display = 'none';
            sellingPriceInput.classList.remove('is-invalid');
        }

        let feeAmount = (sprice * platformFeeSettings.platformFee) / 100;
        if (platformFeeSettings.minFee && feeAmount < platformFeeSettings.minFee && sprice > 0) {
            feeAmount = platformFeeSettings.minFee;
        }

        const gstAmount = (feeAmount * platformFeeSettings.gstRate) / 100;
        const totalDeduction = feeAmount + gstAmount;
        const payout = sprice - totalDeduction;

        estFeeEl.textContent = `₹${feeAmount.toFixed(2)}`;
        estGstEl.textContent = `₹${gstAmount.toFixed(2)}`;
        estPayoutEl.textContent = `₹${payout.toFixed(2)}`;

        const gstPercentDisplay = document.getElementById('gst-percent-display');
        if (gstPercentDisplay) gstPercentDisplay.textContent = platformFeeSettings.gstRate;
    }

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

        const sprice = parseFloat(sellingPriceInput.value);
        if (sprice < 10) {
            showAlert('Minimum selling price allowed is ₹10.', 'warning');
            return;
        }

        const btn = document.getElementById('btn-submit-product');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        const imageRows = imageContainer.querySelectorAll('.image-row');
        const images = Array.from(imageRows).map(row => ({
            url: row.querySelector('.img-url').value,
            arrangement: parseInt(row.querySelector('.img-order').value) || 1
        }));

        const productData = {
            category_id: categorySelect.value,
            name: document.getElementById('product-name').value,
            description: document.getElementById('product-description').value,
            keywords: document.getElementById('product-keywords').value,
            mrp: parseFloat(mrpInput.value),
            selling_price: sprice,
            discount_type: discountTypeSelect.value,
            discount_value: parseFloat(discountValueInput.value) || 0,
            stock_quantity: parseInt(document.getElementById('stock-quantity').value) || 0,
            images: images,
            status: document.getElementById('product-status').value,
            previous_data: originalProduct
        };

        const { error } = await client
            .from('products')
            .update(productData)
            .eq('id', productId);

        if (error) {
            console.error('Update error:', error);
            showAlert('Error updating product: ' + error.message, 'error');
        } else {
            showAlert('Product updated successfully!', 'success');
            setTimeout(() => window.location.href = 'products.html', 1500);
        }

        btn.disabled = false;
        btn.innerHTML = originalText;
    });

    init();
});
