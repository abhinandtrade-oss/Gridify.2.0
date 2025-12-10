/**
 * Product Manager (Firebase Firestore Edition)
 * Handles data persistence using Firebase Firestore.
 */

import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const PRODUCT_STORAGE_KEY = 'gridify_products_fb_v1';
const PRODUCTS_COLLECTION = 'products';

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
        // Try Firestore First
        try {
            console.log("Fetching products from Firestore...");
            const querySnapshot = await getDocs(collection(db, PRODUCTS_COLLECTION));

            let products = [];
            querySnapshot.forEach((doc) => {
                products.push(doc.data());
            });

            console.log(`Firestore returned ${products.length} products.`);

            // If Cloud is empty, seed it
            if (products.length === 0) {
                console.log("Firestore empty, seeding initial data...");
                await this.seedInitialData();
                return INITIAL_PRODUCTS;
            }

            // Cache it
            localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));
            return products;
        } catch (error) {
            console.error("Firestore Read Error:", error);
            // Fallback to local cache
            console.warn("Falling back to local cache.");
            return this.getLocalProducts();
        }
    },

    getLocalProducts: function () {
        if (!localStorage.getItem(PRODUCT_STORAGE_KEY)) {
            localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS));
        }
        const products = localStorage.getItem(PRODUCT_STORAGE_KEY);
        return products ? JSON.parse(products) : [];
    },

    getActiveProducts: async function () {
        let products = await this.getAllProducts();

        // Double check if empty and seed again (failsafe)
        if (products.length === 0) {
            console.log("ActiveProducts check: Empty. Trying to seed...");
            await this.seedInitialData();
            products = await this.getAllProducts(); // Retry fetch
        }

        return products.filter(p => p.isActive);
    },

    saveProduct: async function (product) {
        if (!product.id) {
            product.id = Date.now().toString();
        }
        if (typeof product.isActive === 'undefined') product.isActive = true;

        try {
            console.log("Saving to Firestore...", product);
            await setDoc(doc(db, PRODUCTS_COLLECTION, String(product.id)), product);

            // Update Cache
            let products = this.getLocalProducts();
            const index = products.findIndex(p => String(p.id) === String(product.id));
            if (index !== -1) products[index] = product;
            else products.push(product);
            localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));

            return true;
        } catch (e) {
            console.error("Firestore Save Error", e);
            alert("Error saving to cloud: " + e.message);
            return false;
        }
    },

    deleteProduct: async function (id) {
        try {
            console.log("Deleting from Firestore...", id);
            await deleteDoc(doc(db, PRODUCTS_COLLECTION, String(id)));

            // Update Cache
            let products = this.getLocalProducts();
            products = products.filter(p => String(p.id) !== String(id));
            localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(products));

            return true;
        } catch (e) {
            console.error("Firestore Delete Error", e);
            alert("Error deleting from cloud: " + e.message);
            return false;
        }
    },

    toggleStatus: async function (id) {
        let products = await this.getAllProducts();
        const product = products.find(p => String(p.id) === String(id));
        if (product) {
            product.isActive = !product.isActive;
            return await this.saveProduct(product);
        }
        return false;
    },

    seedInitialData: async function () {
        try {
            const batchPromises = INITIAL_PRODUCTS.map(p =>
                setDoc(doc(db, PRODUCTS_COLLECTION, String(p.id)), p)
            );
            await Promise.all(batchPromises);
            console.log("Seeding complete.");
            localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS));
        } catch (e) {
            console.error("Seeding failed", e);
        }
    }
};

window.ProductManager = ProductManager;
export default ProductManager;

