// home.js - Public Home Page Logic
import { db } from './firebase-config.js';
import { collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    showLoader('Loading editions...');
    await loadLatestNewspaper();
    await loadArchive();
    setupYearFilter();
    hideLoader();
});

async function loadLatestNewspaper() {
    const latestContainer = document.getElementById('latest-container');
    if (!latestContainer) return;

    try {
        const newspapersRef = collection(db, NEWSPAPERS_COL);
        const q = query(
            newspapersRef,
            where('status', '==', 'published')
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            latestContainer.innerHTML = '<p style="text-align:center;">No published editions available yet.</p>';
            return;
        }

        const newsList = [];
        snapshot.forEach(doc => newsList.push({ id: doc.id, ...doc.data() }));
        newsList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const news = newsList[0];
        const newsId = news.id;

        // Get the first page image for preview
        const pagesRef = collection(db, PAGES_COL);
        const pagesQ = query(
            pagesRef,
            where('newspaperId', '==', newsId),
            where('pageNumber', '==', 1),
            limit(1)
        );
        const pagesSnapshot = await getDocs(pagesQ);

        let coverImg = 'https://via.placeholder.com/400x533?text=NO+IMAGE';
        if (!pagesSnapshot.empty) {
            coverImg = pagesSnapshot.docs[0].data().imageUrl;
        }

        latestContainer.innerHTML = `
            <div class="newspaper-card" style="max-width: 450px; margin: 0 auto; cursor: pointer;" onclick="location.href='viewer.html?id=${newsId}'">
                <img src="${fixDriveUrl(coverImg)}" alt="${news.month} ${news.year}" class="card-image">
                <div class="card-content">
                    <h3 class="card-title">${news.month} ${news.year} - Latest Edition</h3>
                    <p style="color: #666; font-size: 0.9rem; margin-bottom: 15px;">Published on: ${news.createdAt ? new Date(news.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                    <button class="btn btn-secondary" style="width: 100%;">Read Full Edition <i class="fas fa-book-open"></i></button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Error loading latest newspaper:", error);
        latestContainer.innerHTML = '<p>Error loading content.</p>';
    }
}

async function loadArchive(year = '') {
    const grid = document.getElementById('newspaper-grid');
    if (!grid) return;
    grid.innerHTML = '<p>Loading archive...</p>';

    try {
        const newspapersRef = collection(db, NEWSPAPERS_COL);
        let q;
        if (year) {
            q = query(
                newspapersRef,
                where('status', '==', 'published'),
                where('year', '==', parseInt(year))
            );
        } else {
            q = query(
                newspapersRef,
                where('status', '==', 'published')
            );
        }

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            grid.innerHTML = '<p>No archives found for this period.</p>';
            return;
        }

        grid.innerHTML = '';
        const newsItems = [];
        snapshot.forEach(docSnapshot => {
            newsItems.push({ id: docSnapshot.id, ...docSnapshot.data() });
        });

        // Manual sort by createdAt desc
        newsItems.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        for (const news of newsItems) {
            const newsId = news.id;

            // Get cover image
            const pagesRef = collection(db, PAGES_COL);
            const pagesQ = query(
                pagesRef,
                where('newspaperId', '==', newsId),
                where('pageNumber', '==', 1),
                limit(1)
            );
            const pagesSnapshot = await getDocs(pagesQ);

            let coverImg = 'https://via.placeholder.com/300x400?text=NO+IMAGE';
            if (!pagesSnapshot.empty) {
                coverImg = pagesSnapshot.docs[0].data().imageUrl;
            }

            const card = document.createElement('div');
            card.className = 'newspaper-card';
            card.onclick = () => location.href = `viewer.html?id=${newsId}`;
            card.innerHTML = `
                <img src="${fixDriveUrl(coverImg)}" alt="${news.month} ${news.year}" class="card-image">
                <div class="card-content">
                    <h4 class="card-title">${news.month} ${news.year}</h4>
                    <button class="btn btn-primary" style="width: 100%; font-size: 0.8rem;">Read Now</button>
                </div>
            `;
            grid.appendChild(card);
        }
    } catch (error) {
        console.error("Error loading archive:", error);
        grid.innerHTML = '<p>Error loading archive.</p>';
    }
}

function setupYearFilter() {
    const yearSelect = document.getElementById('year-filter');
    if (!yearSelect) return;
    const currentYear = new Date().getFullYear();

    yearSelect.innerHTML = '<option value="">All Years</option>';
    for (let i = currentYear; i >= 2024; i--) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        yearSelect.appendChild(option);
    }

    yearSelect.addEventListener('change', async (e) => {
        showLoader('Filtering archive...');
        await loadArchive(e.target.value);
        hideLoader();
    });
}
