/**
 * Product Manager (Google Sheets Edition)
 * Handles data persistence using Google Apps Script.
 */

const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwB90DHy11h3yyZaSTJ1Q-gPJhjEspF-eG9Pwp268i4hynoj4HQ1-M9lz79eZUOXKfRAA/exec';
window.APP_SCRIPT_URL = APP_SCRIPT_URL;
const PRODUCT_STORAGE_KEY = 'gridify_products_gs_v1';

// Initial Seed Data (Fallback)
const INITIAL_PRODUCTS = [
    {
        id: "1",
        itemName: "Basic single page site",
        itemCategory: "Website",
        price: 2999,
        image: "assets/images/products/product1.jpg",
        description: "Minimum price is 2999 and the maximum price will be upto 4499 as per the addons on the site.",
        isActive: true
    },
    {
        id: "2",
        itemName: "Basic site 3-5 pages",
        itemCategory: "Website",
        price: 5999,
        image: "assets/images/products/product2.jpg",
        description: "Minimum price is 5999 and the maximum price will be upto 12999 as per the addons on the site.",
        isActive: true
    },
    {
        id: "3",
        itemName: "Custom Site 3-6 pages",
        itemCategory: "Website",
        price: 14999,
        image: "assets/images/products/product3.jpg",
        description: "Minimum price is 14999 and the maximum price will be upto 29999 as per the addons on the site.",
        isActive: true
    },
    {
        id: "4",
        itemName: "Basic Package",
        itemCategory: "Package",
        price: 3799,
        image: "assets/images/products/product4.jpg",
        description: "Minimum price is 3799 and then maximum price will be upto 5799. Package contains:✅ Up to 2 pages design,✅ 2 forms,✅ Customization available,✅ Form datas on Google sheet,✅ Basic SEO setup,✅ Basic support till the pan ends",
        isActive: true
    },
    {
        id: "5",
        itemName: "Standard Package",
        itemCategory: "Package",
        price: 11799,
        image: "assets/images/products/product5.jpg",
        description: "Minimum price is 11799 and then maximum price will be upto 16799. package contains :✅ Basic site package (3-5 pages),✅ 2 - 4 forms,✅ Customization available,✅ Form datas on Google sheet,✅ Basic SEO setup,✅ Email Alerts,✅ 10 % off on addons*,✅ Standard support till the pan ends",
        isActive: true
    },
    {
        id: "6",
        itemName: "Custom / Premium Package",
        itemCategory: "Package",
        price: 18999,
        image: "assets/images/products/product6.jpg",
        description: "Minimum price is 18999 and then maximum price will be upto 34999. Package contains:✅ Basic site package (3-5 pages),✅ 2 - 4 forms,✅ Customization available,✅ Form datas on Google sheet,✅ Basic SEO setup,✅ Email Alerts,✅ 15 % off on addons*,✅ Standard support till the pan ends",
        isActive: true
    },
    {
        id: "7",
        itemName: "Interactive animations",
        itemCategory: "Addons",
        price: 699,
        image: "assets/images/products/product7.jpg",
        description: "Minimum price is 699 per unit. and its maximum rate will be 1999.",
        isActive: true
    },
    {
        id: "8",
        itemName: "Whatsapp Alerts",
        itemCategory: "Addons",
        price: 1499,
        image: "assets/images/products/product8.jpg",
        description: "Minimum price is 1499per unit. (One side alert (customer / owner side))",
        isActive: true
    },
    {
        id: "9",
        itemName: "Whatsapp alerts (both side)",
        itemCategory: "Whatsapp alerts",
        price: 2199,
        image: "assets/images/products/product9.jpg",
        description: "Minimum price is 2199 per unit. (both side)",
        isActive: true
    },
    {
        id: "10",
        itemName: "Custom domain email",
        itemCategory: "Addons",
        price: 999,
        image: "assets/images/products/product1.jpg",
        description: "Price 999. for 10 email (your@email.com) . in association with cloudeflare and gmail. *t&c apply",
        isActive: true
    },
    {
        id: "11",
        itemName: "Exxtra web page",
        itemCategory: "Website",
        price: 1499,
        image: "assets/images/products/product2.jpg",
        description: "For extra adding pages will charge 1499 / page",
        isActive: true
    },
    {
        id: "12",
        itemName: "UI/UX & poster/banner desingning",
        itemCategory: "UI/UX",
        price: 149,
        image: "assets/images/products/product3.jpg",
        description: "Min charge will be 149*. and may varry as per the design and needs",
        isActive: true
    }
];

const ProductManager = {

    getAllProducts: async function () {
        // Try Cloud First
        try {
            console.log("Fetching products from cloud...");
            const response = await fetch(`${APP_SCRIPT_URL}?action=read`);

            if (response.ok) {
                const products = await response.json();
                console.log(`Cloud returned ${products.length} products.`);

                // If cloud is empty (empty array), seed it with initial data
                if (products.length === 0) {
                    console.log("Cloud empty, seeding initial data...");
                    await this._persistData(INITIAL_PRODUCTS);
                    return INITIAL_PRODUCTS;
                }

                // Cache it
                localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
                return products;
            }
        } catch (error) {
            console.error("Cloud Read Error:", error);
        }

        // Fallback to local cache if cloud fails (offline support)
        console.warn("Falling back to local cache.");
        return this.getLocalProducts();
    },

    getLocalProducts: function () {
        if (!localStorage.getItem(PRODUCT_STORAGE_KEY)) {
            // Only seed local if we have nothing else and cloud failed
            localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS));
        }
        const products = localStorage.getItem(PRODUCT_STORAGE_KEY);
        return products ? JSON.parse(products) : [];
    },

    getActiveProducts: async function () {
        const products = await this.getAllProducts();
        return products.filter(p => p.isActive);
    },

    saveProduct: async function (product) {
        // 1. Get current list from cloud
        let products = await this.getAllProducts();

        if (product.id) {
            // Update existing - Comparison fixed to string
            const index = products.findIndex(p => String(p.id) === String(product.id));
            if (index !== -1) {
                products[index] = { ...products[index], ...product };
            }
        } else {
            // Add new
            product.id = Date.now().toString();
            if (typeof product.isActive === 'undefined') product.isActive = true;
            products.push(product);
        }

        // 2. Save back
        return await this._persistData(products);
    },

    deleteProduct: async function (id) {
        let products = await this.getAllProducts();
        // Comparison fixed to string
        products = products.filter(p => String(p.id) !== String(id));
        return await this._persistData(products);
    },

    toggleStatus: async function (id) {
        const products = await this.getAllProducts();
        // Comparison fixed to string
        const product = products.find(p => String(p.id) === String(id));
        if (product) {
            product.isActive = !product.isActive;
            await this._persistData(products);
            return product.isActive;
        }
        return false;
    },

    // Save to Google Sheet
    _persistData: async function (products) {
        // Optimistic Update
        localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));

        try {
            console.log("Saving to cloud...", products.length + " items");
            const response = await fetch(APP_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'save',
                    products: products
                })
            });

            if (!response.ok) throw new Error("Google Script returned error: " + response.status);

            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);

            console.log("Cloud save successful.");
            return true;
        } catch (e) {
            console.error("Cloud Save Error", e);
            alert("Warning: Saved locally to cache, but cloud sync failed. Check connection.");
            return false;
        }
    }
};

window.ProductManager = ProductManager;
