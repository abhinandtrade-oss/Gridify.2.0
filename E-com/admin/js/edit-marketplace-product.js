/**
 * Marketplace: Edit Product Logic for Sellers
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    // Configuration
    const R2_WORKER_URL = 'https://review-images-proxy.info-adhil-ecom.workers.dev'.replace(/\/$/, '');
    const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

    const form = document.getElementById('edit-product-form');
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
    let originalProduct = null;
    let platformFeeSettings = { platformFee: 0, gstRate: 18 };
    let productId = new URLSearchParams(window.location.search).get('id');
    let selectedImages = []; // Array of { id, file, base64, url, isExisting }

    if (!productId) {
        showAlert('No product ID provided.', 'error');
        setTimeout(() => window.location.href = 'marketplace-products.html', 2000);
        return;
    }

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
        } else {
            showAlert('Seller profile not found.', 'error');
            setTimeout(() => window.location.href = 'marketplace-products.html', 2000);
            return;
        }

        // 2. Load Categories
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

        // 4. Load Product Data
        const { data: product, error } = await client
            .from('products')
            .select('*')
            .eq('id', productId)
            .eq('seller_id', currentSeller.id)
            .single();

        if (error || !product) {
            console.error('Error loading product:', error);
            showAlert('Product not found or access denied.', 'error');
            setTimeout(() => window.location.href = 'marketplace-products.html', 2000);
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

        // Populate existing images
        if (p.images && p.images.length > 0) {
            selectedImages = p.images.sort((a, b) => a.arrangement - b.arrangement).map(img => ({
                id: Math.random(),
                url: img.url,
                isExisting: true
            }));
        } else {
            selectedImages = [];
        }
        updatePreviews();
        calculateFees();
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
                    base64: event.target.result,
                    isExisting: false
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

        if (!currentSeller) return;

        const sprice = parseFloat(sellingPriceInput.value);
        if (sprice < 10) {
            showAlert('Minimum selling price allowed is ₹10.', 'warning');
            return;
        }

        if (selectedImages.length === 0) {
            showAlert('Please upload at least one image.', 'warning');
            return;
        }

        const btn = document.getElementById('btn-submit-product');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        try {
            const sku = skuPreview.textContent;
            const imageUrls = [];

            // Process all selected images
            for (let i = 0; i < selectedImages.length; i++) {
                const img = selectedImages[i];
                const slNo = i + 1;

                if (img.isExisting) {
                    imageUrls.push({
                        url: img.url,
                        arrangement: slNo
                    });
                } else {
                    const extension = img.file.name.split('.').pop() || 'jpg';
                    const filename = `products/IM-${sku}-${slNo}-${Date.now()}.${extension}`;

                    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Image ${slNo}/${selectedImages.length}...`;

                    const url = await uploadToR2(img.file, filename);
                    if (url) {
                        imageUrls.push({
                            url: url,
                            arrangement: slNo
                        });
                    }
                }
            }

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
                images: imageUrls,
                status: 'pending_approval',
                previous_data: originalProduct
            };

            const { error } = await client
                .from('products')
                .update(productData)
                .eq('id', productId)
                .eq('seller_id', currentSeller.id);

            if (error) throw error;

            showAlert('Product updated successfully and sent for re-approval.', 'success');
            setTimeout(() => window.location.href = 'marketplace-products.html', 1500);

        } catch (err) {
            console.error('Update error:', err);
            showAlert('Error: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });

    init();
});
