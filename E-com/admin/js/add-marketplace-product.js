/**
 * Marketplace: Add Product Logic for Sellers
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    // Configuration
    const R2_WORKER_URL = 'https://review-images-proxy.info-adhil-ecom.workers.dev'.replace(/\/$/, '');
    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

    const form = document.getElementById('add-product-form');
    const categorySelect = document.getElementById('category-id');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const btnUploadImage = document.getElementById('btn-upload-image');
    const productImagesInput = document.getElementById('product-images-input');

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
    let selectedImages = []; // Array of { id, file, base64, url }

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
            console.warn('Could not load pricing settings from DB', err);
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
    btnUploadImage.addEventListener('click', () => productImagesInput.click());

    productImagesInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.size > MAX_FILE_SIZE) {
                showAlert(`Image exceeds 4MB limit: ${file.name}`, 'warning');
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                const id = Date.now() + Math.random();
                selectedImages.push({
                    id,
                    file,
                    base64: event.target.result
                });
                updatePreviews();
            };
            reader.readAsDataURL(file);
        });
        productImagesInput.value = '';
    });

    function updatePreviews() {
        if (!imagePreviewContainer) return;
        imagePreviewContainer.innerHTML = selectedImages.map((img, index) => `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="image-preview-item">
                    <img src="${img.base64 || img.url}">
                    <button type="button" class="remove-btn" onclick="removeImage(${img.id})">&times;</button>
                    <div class="arrangement-badge">Rank ${index + 1}</div>
                </div>
            </div>
        `).join('');
    }

    window.removeImage = (id) => {
        selectedImages = selectedImages.filter(img => img.id !== id);
        updatePreviews();
    };

    async function uploadToR2(file, filename) {
        if (!R2_WORKER_URL) return null;
        try {
            const response = await fetch(`${R2_WORKER_URL}?key=${encodeURIComponent(filename)}`, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type }
            });
            if (response.ok) return `${R2_WORKER_URL}?key=${encodeURIComponent(filename)}`;
            throw new Error('Upload failed');
        } catch (e) {
            console.error('R2 Error:', e);
            throw e;
        }
    }

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
        const total_deduction = feeAmount + gstAmount;
        const payout = sprice - total_deduction;

        estFeeEl.textContent = `₹${feeAmount.toFixed(2)}`;
        estGstEl.textContent = `₹${gstAmount.toFixed(2)}`;
        estPayoutEl.textContent = `₹${payout.toFixed(2)}`;

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
            showAlert('Seller profile not detected.', 'error');
            return;
        }

        if (selectedImages.length === 0) {
            showAlert('Please upload at least one image.', 'warning');
            return;
        }

        const sprice = parseFloat(sellingPriceInput.value);
        if (sprice < 10) {
            showAlert('Minimum selling price allowed is ₹10.', 'warning');
            return;
        }

        const btn = document.getElementById('btn-submit-product');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';

        try {
            // Check storage limit first
            const storageCheck = await window.checkStorageLimit();
            if (storageCheck && storageCheck.allowed === false) {
                showAlert(storageCheck.message, 'error');
                return;
            }

            const sku = skuPreview.textContent;
            const imageUrls = [];

            // Upload all selected images to R2
            for (let i = 0; i < selectedImages.length; i++) {
                const img = selectedImages[i];
                const slNo = i + 1;
                const extension = img.file.name.split('.').pop() || 'jpg';
                const filename = `products/IM-${sku}-${slNo}.${extension}`;

                btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Image ${slNo}/${selectedImages.length}...`;

                const url = await uploadToR2(img.file, filename);
                if (url) {
                    imageUrls.push({
                        url: url,
                        arrangement: slNo
                    });
                }
            }

            const productData = {
                seller_id: currentSeller.id,
                category_id: categorySelect.value,
                sku: sku,
                name: document.getElementById('product-name').value,
                description: document.getElementById('product-description').value,
                keywords: document.getElementById('product-keywords').value,
                mrp: parseFloat(mrpInput.value),
                selling_price: sprice,
                discount_type: discountTypeSelect.value,
                discount_value: parseFloat(discountValueInput.value) || 0,
                stock_quantity: parseInt(document.getElementById('stock-quantity').value) || 0,
                images: imageUrls,
                status: 'pending_approval'
            };

            const { data, error } = await client
                .from('products')
                .insert([productData]);

            if (error) throw error;

            showAlert('Product listed successfully for approval!', 'success');
            setTimeout(() => window.location.href = 'marketplace-products.html', 1500);

        } catch (err) {
            console.error('Submit error:', err);
            showAlert('Error: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });

    init();
});
