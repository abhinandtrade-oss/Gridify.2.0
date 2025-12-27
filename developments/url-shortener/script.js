import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, limit, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Firebase Configuration (Matching the main project)
const firebaseConfig = {
    apiKey: "AIzaSyD9G64Wu-hOHadZUfk9EG8MaXfqL7T9-F0",
    authDomain: "grfy-b1731.firebaseapp.com",
    projectId: "grfy-b1731",
    storageBucket: "grfy-b1731.firebasestorage.app",
    messagingSenderId: "376190086826",
    appId: "1:376190086826:web:71c268ada23c4163f02ad3",
    measurementId: "G-M45BCQPTPV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const COLLECTION_NAME = "short_urls";

document.addEventListener('DOMContentLoaded', async () => {
    const urlInput = document.getElementById('url-input');
    const customCodeInput = document.getElementById('custom-code');
    const shortenBtn = document.getElementById('shorten-btn');
    const resultSection = document.getElementById('result-section');
    const shortUrlResult = document.getElementById('short-url-result');
    const copyBtn = document.getElementById('copy-btn');
    const urlList = document.getElementById('url-list');
    const recentUrlsContainer = document.getElementById('recent-urls');

    // --- Redirection Logic ---
    const urlParams = new URLSearchParams(window.location.search);
    const shortCode = urlParams.get('s');

    if (shortCode) {
        document.body.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; gap:20px;">
                <img src="../../assets/images/logos/logo.png" style="height:80px;">
                <h2 style="font-family: 'Outfit'; color: #1e293b;">Redirecting you...</h2>
                <div class="loader-simple" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #6366f1; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            </div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        `;

        try {
            const docRef = doc(db, COLLECTION_NAME, shortCode);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                window.location.href = docSnap.data().longUrl;
            } else {
                alert("Invalid or expired short link!");
                window.location.href = window.location.pathname; // Go back to main interface
            }
        } catch (error) {
            console.error("Redirection Error:", error);
            alert("Something went wrong. Please try again.");
            window.location.href = window.location.pathname;
        }
        return;
    }

    // --- Main Logic ---
    loadRecentLinks();

    shortenBtn.addEventListener('click', async () => {
        const longUrl = urlInput.value.trim();
        let customCode = customCodeInput.value.trim();

        if (!longUrl) {
            alert("Please enter a valid URL");
            return;
        }

        if (!isValidUrl(longUrl)) {
            alert("Invalid URL format. Make sure it includes http:// or https://");
            return;
        }

        shortenBtn.disabled = true;
        shortenBtn.innerHTML = '<span>Shortening...</span><i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            if (!customCode) {
                customCode = generateRandomCode(6);
            } else {
                // Check if custom code exists
                const existingSnap = await getDoc(doc(db, COLLECTION_NAME, customCode));
                if (existingSnap.exists()) {
                    alert("This custom code is already taken. Try another one!");
                    shortenBtn.disabled = false;
                    shortenBtn.innerHTML = '<span>Shorten URL</span><i class="fa-solid fa-bolt"></i>';
                    return;
                }
            }

            const shortLinkData = {
                longUrl: longUrl,
                shortCode: customCode,
                createdAt: new Date().toISOString(),
                clicks: 0
            };

            await setDoc(doc(db, COLLECTION_NAME, customCode), shortLinkData);

            const baseUrl = window.location.origin + window.location.pathname;
            const fullShortUrl = `${baseUrl}?s=${customCode}`;

            shortUrlResult.textContent = fullShortUrl;
            resultSection.classList.add('active');

            saveToLocal(shortLinkData);
            loadRecentLinks();

        } catch (error) {
            console.error("Shorten Error:", error);
            alert("Failed to shorten URL. Check console for details.");
        } finally {
            shortenBtn.disabled = false;
            shortenBtn.innerHTML = '<span>Shorten URL</span><i class="fa-solid fa-bolt"></i>';
        }
    });

    copyBtn.addEventListener('click', () => {
        const text = shortUrlResult.textContent;
        navigator.clipboard.writeText(text).then(() => {
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
            }, 2000);
        });
    });

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    function generateRandomCode(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function saveToLocal(linkData) {
        let recent = JSON.parse(localStorage.getItem('recent_short_links') || '[]');
        recent.unshift(linkData);
        recent = recent.slice(0, 5); // Keep last 5
        localStorage.setItem('recent_short_links', JSON.stringify(recent));
    }

    function loadRecentLinks() {
        const recent = JSON.parse(localStorage.getItem('recent_short_links') || '[]');
        if (recent.length === 0) {
            recentUrlsContainer.classList.remove('active');
            return;
        }

        recentUrlsContainer.classList.add('active');
        urlList.innerHTML = '';
        const baseUrl = window.location.origin + window.location.pathname;

        recent.forEach(item => {
            const fullShort = `${baseUrl}?s=${item.shortCode}`;
            const div = document.createElement('div');
            div.className = 'url-item';
            div.innerHTML = `
                <div class="url-item-info">
                    <a href="${fullShort}" class="short-link" target="_blank">${baseUrl}?s=${item.shortCode}</a>
                    <span class="long-link">${item.longUrl}</span>
                </div>
                <button class="copy-btn small-copy" onclick="navigator.clipboard.writeText('${fullShort}'); this.innerHTML='<i class=\'fas fa-check\'></i>'; setTimeout(()=>this.innerHTML='<i class=\'fas fa-copy\'></i>', 2000)">
                    <i class="fa-solid fa-copy"></i>
                </button>
            `;
            urlList.appendChild(div);
        });
    }
});
