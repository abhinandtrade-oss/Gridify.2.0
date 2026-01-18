// viewer.js - Multi-page e-newspaper viewer
import { db } from './firebase-config.js';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const NEWSPAPERS_COL = 'newspapers';
const PAGES_COL = 'pages';

function fixDriveUrl(url) {
    if (!url) return url;
    if (url.startsWith('data:')) return url;
    let id = '';
    if (url.includes('id=')) {
        id = url.split('id=')[1].split('&')[0];
    } else if (url.includes('/d/')) {
        const parts = url.split('/d/');
        if (parts.length > 1) {
            id = parts[1].split(/[/?=]/)[0];
        }
    }
    if (id) {
        return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
    }
    return url;
}

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const newspaperId = urlParams.get('id');

    if (!newspaperId) {
        location.href = 'index.html';
        return;
    }

    showLoader('Fetching newspaper edition...');
    await loadNewspaperData(newspaperId);
    setupZoom();
    setupShare(newspaperId);
    await setupEditionSelector();
    hideLoader();
});

async function loadNewspaperData(id) {
    const titleEl = document.getElementById('newspaper-id-title');
    const pagesContainer = document.getElementById('pages-container');
    const downloadBtn = document.getElementById('download-pdf');

    try {
        const docRef = doc(db, NEWSPAPERS_COL, id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            alert("Newspaper not found.");
            location.href = 'index.html';
            return;
        }

        const news = docSnap.data();
        titleEl.textContent = `${news.month} ${news.year}`;

        // Setup PDF download
        if (news.pdfUrl) {
            downloadBtn.onclick = () => window.open(news.pdfUrl, '_blank');
            downloadBtn.style.display = 'flex';
        } else {
            downloadBtn.style.display = 'none';
        }

        // Load pages
        const pagesRef = collection(db, PAGES_COL);
        const pagesQ = query(
            pagesRef,
            where('newspaperId', '==', id)
        );
        const pagesSnapshot = await getDocs(pagesQ);

        if (pagesSnapshot.empty) {
            pagesContainer.innerHTML = '<p>No pages found for this edition.</p>';
            return;
        }

        pagesContainer.innerHTML = '';
        const pages = [];
        pagesSnapshot.forEach(docSnapshot => {
            pages.push(docSnapshot.data());
        });

        // Manual sort by pageNumber
        pages.sort((a, b) => parseInt(a.pageNumber) - parseInt(b.pageNumber));

        pages.forEach(page => {
            const wrapper = document.createElement('div');
            wrapper.className = 'page-image-wrapper';

            const img = document.createElement('img');
            img.src = fixDriveUrl(page.imageUrl);
            img.className = 'page-image';
            img.loading = 'lazy'; // Native lazy loading
            img.alt = `Page ${page.pageNumber}`;
            img.onclick = () => openZoom(fixDriveUrl(page.imageUrl));

            wrapper.appendChild(img);
            pagesContainer.appendChild(wrapper);
        });

    } catch (error) {
        console.error("Error loading viewer:", error);
    }
}

// Zoom Logic
function setupZoom() {
    const modal = document.getElementById('zoom-modal');
    const close = document.getElementById('close-zoom');

    if (close) close.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target == modal) modal.style.display = 'none';
    };
}

function openZoom(url) {
    const modal = document.getElementById('zoom-modal');
    const zoomedImg = document.getElementById('zoomed-image');
    if (zoomedImg) zoomedImg.src = url;
    if (modal) modal.style.display = 'flex';
}

// Share Logic
function setupShare(id) {
    const shareBtn = document.getElementById('share-btn');
    const shareMenu = document.getElementById('share-menu');

    if (shareBtn) {
        shareBtn.onclick = (e) => {
            e.stopPropagation();
            if (navigator.share) {
                navigator.share({
                    title: 'SSV CHRONICLES - E-News Paper',
                    text: 'Checkout this month\'s e-newspaper of SSV College',
                    url: window.location.href
                }).catch(console.error);
            } else if (shareMenu) {
                shareMenu.classList.toggle('active');
            }
        };
    }

    document.onclick = () => {
        if (shareMenu) shareMenu.classList.remove('active');
    };
}

window.copyLink = function () {
    navigator.clipboard.writeText(window.location.href).then(() => {
        alert("Link copied to clipboard!");
    });
}

// Edition Selector
async function setupEditionSelector() {
    const selector = document.getElementById('edition-selector');
    if (!selector) return;

    try {
        const newspapersRef = collection(db, NEWSPAPERS_COL);
        const q = query(
            newspapersRef,
            where('status', '==', 'published')
        );
        const snapshot = await getDocs(q);

        selector.innerHTML = '<option value="">Select Edition</option>';

        const editions = [];
        snapshot.forEach(docSnapshot => {
            editions.push({ id: docSnapshot.id, ...docSnapshot.data() });
        });

        // Manual sort by createdAt desc
        editions.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

        editions.forEach(news => {
            const option = document.createElement('option');
            option.value = news.id;
            option.textContent = `${news.month} ${news.year}`;

            const urlParams = new URLSearchParams(window.location.search);
            if (news.id === urlParams.get('id')) {
                option.selected = true;
            }

            selector.appendChild(option);
        });

        selector.onchange = async (e) => {
            if (e.target.value) {
                showLoader('Switching edition...');
                window.location.href = `viewer.html?id=${e.target.value}`;
            }
        };
    } catch (error) {
        console.error("Error loading editions for selector:", error);
    }
}

window.shareTo = function (platform) {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent("Checkout this month's e-newspaper of SSV College");
    let shareUrl = '';

    switch (platform) {
        case 'whatsapp':
            shareUrl = `https://api.whatsapp.com/send?text=${text}%20${url}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
            break;
    }

    if (shareUrl) window.open(shareUrl, '_blank');
}
