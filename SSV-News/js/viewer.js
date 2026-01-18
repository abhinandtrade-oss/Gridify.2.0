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

let currentShareUrl = window.location.href; // Global variable to hold the enhanced share URL
let currentPages = [];
let currentPageIndex = 0;
let currentNewsData = null; // Store current newspaper metadata

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
        currentNewsData = news; // Store globally
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

        // Store pages globally
        currentPages = pages;

        pages.forEach((page, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'page-image-wrapper';

            const img = document.createElement('img');
            img.src = fixDriveUrl(page.imageUrl);
            img.className = 'page-image';
            img.loading = 'lazy'; // Native lazy loading
            img.alt = `Page ${page.pageNumber}`;
            img.onclick = () => openZoom(index);

            wrapper.appendChild(img);
            pagesContainer.appendChild(wrapper);
        });

        // Set Preview Image for Sharing (First Page)
        if (pages.length > 0) {
            const firstPageUrl = fixDriveUrl(pages[0].imageUrl);

            // Update Open Graph Tags
            const ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage) ogImage.content = firstPageUrl;

            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) ogTitle.content = `${news.month} ${news.year} - SSV CHRONICLES`;

            const ogDesc = document.querySelector('meta[property="og:description"]');
            if (ogDesc) ogDesc.content = `Read the ${news.month} ${news.year} edition of SSV Chronicles.`;

            document.title = `${news.month} ${news.year} | SSV CHRONICLES`;

            // Update Share URL with preview param
            try {
                const urlObj = new URL(window.location.href);
                urlObj.searchParams.set('preview_image', firstPageUrl);
                currentShareUrl = urlObj.toString();

                // Update og:url as well
                const ogUrl = document.querySelector('meta[property="og:url"]');
                if (ogUrl) ogUrl.content = currentShareUrl;
            } catch (e) {
                console.error("Error updating share URL:", e);
                currentShareUrl = window.location.href;
            }
        }

    } catch (error) {
        console.error("Error loading viewer:", error);
    }
}

// Zoom Logic
let showZoomControls;

function setupZoom() {
    const modal = document.getElementById('zoom-modal');
    const close = document.getElementById('close-zoom');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');

    if (close) close.onclick = () => {
        modal.style.display = 'none';
        hideControls();
    };

    // Close on background click
    window.onclick = (e) => {
        if (e.target == modal) {
            modal.style.display = 'none';
            hideControls();
        }
    };

    // Navigation buttons
    if (prevBtn) prevBtn.onclick = (e) => {
        e.stopPropagation();
        navigatePage(-1);
        showControls();
    };

    if (nextBtn) nextBtn.onclick = (e) => {
        e.stopPropagation();
        navigatePage(1);
        showControls();
    };

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (modal.style.display === 'flex') {
            if (e.key === 'ArrowLeft') navigatePage(-1);
            if (e.key === 'ArrowRight') navigatePage(1);
            if (e.key === 'Escape') {
                modal.style.display = 'none';
                hideControls();
            }
            showControls();
        }
    });

    // Auto-hide controls logic
    let controlsTimeout;
    const controls = [close, prevBtn, nextBtn].filter(Boolean);

    function showControls() {
        controls.forEach(el => {
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
        });
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(hideControls, 3000);
    }
    showZoomControls = showControls;

    function hideControls() {
        controls.forEach(el => {
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
        });
    }

    // Toggle controls or close on modal click
    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.tagName === 'IMG') {
            const isHidden = close.style.opacity === '0';
            if (isHidden) {
                showControls();
            } else if (e.target === modal) {
                modal.style.display = 'none';
                hideControls();
            } else {
                hideControls();
            }
        }
    });

    modal.addEventListener('mousemove', showControls);

    // Swipe Navigation (Mobile)
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;

    modal.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        showControls();
    }, { passive: true });

    modal.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const distance = touchEndX - touchStartX;

        if (Math.abs(distance) > minSwipeDistance) {
            if (distance > 0) {
                navigatePage(-1);
            } else {
                navigatePage(1);
            }
            showControls();
        }
    }
}

function openZoom(index) {
    const modal = document.getElementById('zoom-modal');
    const zoomedImg = document.getElementById('zoomed-image');

    if (index >= 0 && index < currentPages.length) {
        currentPageIndex = index;
        const url = fixDriveUrl(currentPages[index].imageUrl);

        if (zoomedImg) zoomedImg.src = url;
        if (modal) modal.style.display = 'flex';

        updateNavButtons();
        if (showZoomControls) showZoomControls();
    }
}

function navigatePage(direction) {
    const newIndex = currentPageIndex + direction;
    if (newIndex >= 0 && newIndex < currentPages.length) {
        openZoom(newIndex);
    }
}

function updateNavButtons() {
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');

    if (prevBtn) prevBtn.style.visibility = currentPageIndex > 0 ? 'visible' : 'hidden';
    if (nextBtn) nextBtn.style.visibility = currentPageIndex < currentPages.length - 1 ? 'visible' : 'hidden';
}

// Share Logic
function setupShare(id) {
    const shareBtn = document.getElementById('share-btn');
    const shareMenu = document.getElementById('share-menu');

    if (shareBtn) {
        shareBtn.onclick = async (e) => {
            e.stopPropagation();

            const firstPageUrl = currentPages.length > 0 ? fixDriveUrl(currentPages[0].imageUrl) : '';
            const shareTitle = 'SSV CHRONICLES - E-News Paper';
            const shareText = `Checkout the ${currentNewsData?.month || ''} ${currentNewsData?.year || ''} edition of SSV Chronicles E-Newspaper.`;

            if (navigator.share) {
                const shareData = {
                    title: shareTitle,
                    text: shareText,
                    url: currentShareUrl
                };

                // Try to attach image file if possible
                if (firstPageUrl && navigator.canShare && navigator.canShare({ files: [new File([], 'test.jpg', { type: 'image/jpeg' })] })) {
                    try {
                        // Attempt to fetch the image as a blob
                        // We use a shorter timeout for the fetch to not delay the share dialog too much
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 2000);

                        const corsResponse = await fetch(firstPageUrl, {
                            signal: controller.signal
                        }).catch(() => null);

                        clearTimeout(timeoutId);

                        if (corsResponse && corsResponse.ok) {
                            const blob = await corsResponse.blob();
                            const file = new File([blob], 'newspaper-preview.jpg', { type: 'image/jpeg' });
                            if (navigator.canShare({ files: [file] })) {
                                shareData.files = [file];
                            }
                        }
                    } catch (err) {
                        console.warn("Could not attach image file to share:", err);
                    }
                }

                navigator.share(shareData).catch(err => {
                    if (err.name !== 'AbortError') console.error("Share failed:", err);
                });
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
    navigator.clipboard.writeText(currentShareUrl).then(() => {
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
    const url = encodeURIComponent(currentShareUrl);
    const firstPageUrl = currentPages.length > 0 ? fixDriveUrl(currentPages[0].imageUrl) : '';
    const newspaperTitle = `${currentNewsData?.month || ''} ${currentNewsData?.year || ''}`;
    const baseText = `Checkout the ${newspaperTitle} edition of SSV Chronicles E-Newspaper`;

    // For platforms that support it, including the image URL in the text can help generate a preview
    const textWithPreview = encodeURIComponent(`${baseText}\n\n${url}`);
    let shareUrl = '';

    switch (platform) {
        case 'whatsapp':
            // WhatsApp often picks up the first image if it's in the text or OG tags
            shareUrl = `https://api.whatsapp.com/send?text=${textWithPreview}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${encodeURIComponent(baseText)}`;
            break;
    }

    if (shareUrl) window.open(shareUrl, '_blank');
}
