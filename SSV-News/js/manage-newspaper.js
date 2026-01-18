// manage-newspaper.js - Upload and Edit Newspaper Editions
import { auth, db, storage } from './firebase-config.js';
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    getDoc,
    addDoc,
    updateDoc,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const NEWSPAPERS_COL = 'newspapers';
const PAGES_COL = 'pages';

// Utility to fix Drive URLs for public viewing
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

let uploadedPages = []; // { id, url, pageNumber, file }
let currentNewspaperId = null;
let pdfFile = null;
let isSaving = false;

// Warning if user leaves while saving
window.onbeforeunload = function () {
    if (isSaving) {
        return "Upload is still in progress. Are you sure you want to leave?";
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        const displayEl = document.getElementById('user-display-name');
        if (displayEl) displayEl.textContent = user.email;

        showLoader('Verifying permissions...');

        // Check role and toggle admin-only elements
        const userDocRef = doc(db, 'users', user.email);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            await signOut(auth);
            window.location.href = '../login.html';
            return;
        }

        const userData = userDocSnap.data();

        if (userData.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-flex');
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.onclick = () => signOut(auth).then(() => location.href = '../login.html');
        }

        const urlParams = new URLSearchParams(window.location.search);
        currentNewspaperId = urlParams.get('id');

        setupFileSelectors();

        if (currentNewspaperId) {
            const titleEl = document.getElementById('page-title');
            if (titleEl) titleEl.textContent = "Edit Newspaper Edition";
            showLoader('Loading existing data...');
            await loadExistingData(currentNewspaperId);
        }
        hideLoader();

        const saveDraftBtn = document.getElementById('save-draft-btn');
        const publishBtn = document.getElementById('publish-btn');

        if (saveDraftBtn) saveDraftBtn.addEventListener('click', () => saveData('draft'));
        if (publishBtn) publishBtn.addEventListener('click', () => saveData('published'));
    });
});

function setupFileSelectors() {
    const pagesInput = document.getElementById('pages-input');
    const dropZonePages = document.getElementById('drop-zone-pages');
    const pdfInput = document.getElementById('pdf-input');
    const dropZonePdf = document.getElementById('drop-zone-pdf');

    if (dropZonePages && pagesInput) {
        dropZonePages.onclick = () => pagesInput.click();
        pagesInput.onchange = (e) => handlePageUpload(e.target.files);
    }

    if (dropZonePdf && pdfInput) {
        dropZonePdf.onclick = () => pdfInput.click();
        pdfInput.onchange = (e) => handlePdfSelection(e.target.files[0]);
    }

    const removePdfBtn = document.getElementById('remove-pdf');
    if (removePdfBtn) {
        removePdfBtn.onclick = () => {
            pdfFile = null;
            document.getElementById('pdf-preview').style.display = 'none';
            document.getElementById('pdf-status').style.display = 'block';
            document.getElementById('pdf-input').value = '';
        };
    }

    // Drag and drop
    if (dropZonePages) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZonePages.addEventListener(eventName, preventDefaults, false);
        });

        dropZonePages.addEventListener('drop', (e) => {
            preventDefaults(e);
            const dt = e.dataTransfer;
            handlePageUpload(dt.files);
        }, false);
    }
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

async function handlePageUpload(files) {
    const progressContainer = document.getElementById('upload-progress');
    if (progressContainer) progressContainer.style.display = 'block';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== 'image/jpeg' && file.type !== 'image/png') continue;

        // Create temporary preview
        const reader = new FileReader();
        reader.onload = (e) => {
            const pageObj = {
                id: Date.now() + Math.random().toString(36).substr(2, 9),
                tempUrl: e.target.result,
                file: file,
                pageNumber: uploadedPages.length + 1
            };
            uploadedPages.push(pageObj);
            renderPages();
        };
        reader.readAsDataURL(file);
    }
}

function handlePdfSelection(file) {
    if (file && file.type === 'application/pdf') {
        pdfFile = file;
        const preview = document.getElementById('pdf-preview');
        const status = document.getElementById('pdf-status');
        const nameEl = document.getElementById('pdf-name');

        if (preview) preview.style.display = 'flex';
        if (status) status.style.display = 'none';
        if (nameEl) nameEl.textContent = file.name;
    }
}

function renderPages() {
    const display = document.getElementById('pages-display');
    if (!display) return;
    display.innerHTML = '';

    uploadedPages.forEach((page, index) => {
        page.pageNumber = index + 1; // Sync numbers
        const div = document.createElement('div');
        div.className = 'page-preview';
        div.innerHTML = `
            <img src="${fixDriveUrl(page.url || page.tempUrl)}" alt="Page ${page.pageNumber}" 
                 onclick="openImagePreview('${fixDriveUrl(page.url || page.tempUrl)}')" 
                 style="cursor: pointer;" title="Click to view full size">
            <div class="page-number">P ${page.pageNumber}</div>
            <div class="page-actions">
                <button onclick="movePage(${index}, -1)" class="page-action-btn"><i class="fas fa-chevron-left"></i></button>
                <button onclick="movePage(${index}, 1)" class="page-action-btn"><i class="fas fa-chevron-right"></i></button>
                <button onclick="removePage(${index})" class="page-action-btn" style="background:#d9534f"><i class="fas fa-trash"></i></button>
            </div>
        `;
        display.appendChild(div);
    });
}

window.movePage = function (index, direction) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < uploadedPages.length) {
        const temp = uploadedPages[index];
        uploadedPages[index] = uploadedPages[newIndex];
        uploadedPages[newIndex] = temp;
        renderPages();
    }
}

window.removePage = function (index) {
    uploadedPages.splice(index, 1);
    renderPages();
}

// Image Preview Logic
window.openImagePreview = function (url) {
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('preview-image');
    if (modal && img) {
        // Use higher quality image if possible (remove thumbnail sizing)
        const fullUrl = url.replace('&sz=w1000', '&sz=w2000');
        img.src = fullUrl;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
}

function closeImagePreview() {
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('preview-image');
    if (modal) {
        modal.classList.remove('active');
        if (img) setTimeout(() => img.src = '', 300); // Clear source after fade out
        document.body.style.overflow = '';
    }
}

// Initialize preview listeners
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('close-preview');
    const modal = document.getElementById('image-preview-modal');

    if (closeBtn) closeBtn.addEventListener('click', closeImagePreview);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeImagePreview();
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                closeImagePreview();
            }
        });
    }
});

// Helper to update UI badge
function updateStatusBadge(status) {
    const badge = document.getElementById('edition-status-badge');
    const text = document.getElementById('edition-status-text');
    if (!badge || !text) return;

    // Normalize status
    const displayStatus = (status || 'draft').toUpperCase();
    text.textContent = displayStatus;
    badge.style.display = 'inline-flex';

    if (status === 'published') {
        badge.style.backgroundColor = '#d4edda';
        badge.style.color = '#155724';
        badge.style.border = '1px solid #c3e6cb';
        // Add check icon if not present
        if (!text.innerHTML.includes('fa-check')) {
            text.innerHTML = `<i class="fas fa-check-circle" style="margin-right:5px"></i> ${displayStatus}`;
        }
    } else {
        badge.style.backgroundColor = '#f8f9fa';
        badge.style.color = '#6c757d';
        badge.style.border = '1px solid #dee2e6';
        if (!text.innerHTML.includes('fa-pen')) {
            text.innerHTML = `<i class="fas fa-pen-to-square" style="margin-right:5px"></i> ${displayStatus}`;
        }
    }
}

async function loadExistingData(id) {
    try {
        const docRef = doc(db, NEWSPAPERS_COL, id);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();

        updateStatusBadge(data.status);

        const monthEl = document.getElementById('news-month');
        const yearEl = document.getElementById('news-year');

        if (monthEl) monthEl.value = data.month;
        if (yearEl) yearEl.value = data.year;

        if (data.pdfUrl) {
            const preview = document.getElementById('pdf-preview');
            const status = document.getElementById('pdf-status');
            const nameEl = document.getElementById('pdf-name');
            if (preview) preview.style.display = 'flex';
            if (status) status.style.display = 'none';
            if (nameEl) nameEl.textContent = "Current PDF attached";
        }

        const pagesRef = collection(db, PAGES_COL);
        const q = query(pagesRef, where('newspaperId', '==', id));
        const pagesSnapshot = await getDocs(q);

        uploadedPages = pagesSnapshot.docs.map(docSnapshot => ({
            id: docSnapshot.id,
            url: docSnapshot.data().imageUrl,
            pageNumber: docSnapshot.data().pageNumber
        }));

        // Sort manually to avoid needing a Firestore composite index
        uploadedPages.sort((a, b) => a.pageNumber - b.pageNumber);

        console.log(`Loaded ${uploadedPages.length} pages for newspaper ${id}`);
        renderPages();
    } catch (error) {
        console.error("Load error detail:", error);
        alert("Error loading newspaper data. Check console for details.");
    } finally {
        hideLoader();
    }
}

async function saveData(status) {
    const monthEl = document.getElementById('news-month');
    const yearEl = document.getElementById('news-year');

    if (!monthEl || !yearEl) return;

    const month = monthEl.value;
    const year = parseInt(yearEl.value);

    if (uploadedPages.length === 0) {
        alert("Please upload at least one page.");
        return;
    }

    const btn = document.getElementById(status === 'published' ? 'publish-btn' : 'save-draft-btn');
    const originalText = btn.innerHTML;

    // Background Status Elements
    const bgStatus = document.getElementById('background-status');
    const statusText = document.getElementById('status-text');
    const statusIcon = document.getElementById('status-icon');
    const statusProgress = document.getElementById('status-progress-bar');
    const statusCount = document.getElementById('status-count');

    if (bgStatus) bgStatus.style.display = 'block';
    isSaving = true;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    try {
        showLoader(`Initiating ${status}...`);
        if (statusText) statusText.textContent = "Saving Newspaper...";
        let newspaperId = currentNewspaperId;
        const newspapersRef = collection(db, NEWSPAPERS_COL);

        if (!newspaperId) {
            const newDoc = await addDoc(newspapersRef, {
                month,
                year,
                status,
                createdBy: auth.currentUser.email,
                createdAt: serverTimestamp(),
                pageCount: uploadedPages.length
            });
            newspaperId = newDoc.id;
        } else {
            const docRef = doc(db, NEWSPAPERS_COL, newspaperId);
            await updateDoc(docRef, {
                month,
                year,
                status,
                pageCount: uploadedPages.length
            });
        }



        // Upload new pages and sync Firestore
        const progressBar = document.getElementById('progress-bar');
        const progressContainer = document.getElementById('upload-progress');
        if (progressContainer) progressContainer.style.display = 'block';

        // Clear existing pages for this newspaper
        const pagesRef = collection(db, PAGES_COL);
        const q = query(pagesRef, where('newspaperId', '==', newspaperId));
        const existingPagesSnapshot = await getDocs(q);
        const batch = writeBatch(db);
        existingPagesSnapshot.forEach(p => batch.delete(p.ref));
        await batch.commit();

        // Fetch Drive Settings
        let driveScriptUrl = null;
        try {
            const settingsSnap = await getDoc(doc(db, 'settings', 'drive_config'));
            if (settingsSnap.exists()) {
                driveScriptUrl = settingsSnap.data().scriptUrl;
            }
        } catch (err) {
            console.error("Error fetching drive settings:", err);
        }

        // Helper to upload to Google Drive via Apps Script
        async function uploadToGoogleDrive(file, customFilename, scriptUrl, fileStatus) {
            if (!scriptUrl) return null;

            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = async () => {
                    const base64Content = reader.result.split(',')[1];
                    try {
                        console.log(`Attempting Drive upload for ${customFilename} (${fileStatus})...`);
                        const response = await fetch(scriptUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain' },
                            body: JSON.stringify({
                                action: 'upload',
                                filename: customFilename,
                                mimetype: file.type,
                                base64: base64Content,
                                status: fileStatus
                            })
                        });

                        if (response.ok) {
                            const result = await response.json();
                            console.log(`Drive upload result for ${customFilename}:`, result);
                            resolve(result.success ? result.url : null);
                        } else {
                            console.error(`Drive upload failed with status ${response.status}`);
                            resolve(null);
                        }
                    } catch (err) {
                        console.error("Drive upload exception:", err);
                        resolve(null);
                    }
                };
                reader.onerror = () => resolve(null);
            });
        }

        // Format month and year for file naming
        const monthStr = month.toLowerCase();
        const yearStr = year.toString();
        // MM-YYYY format for PDF
        const monthMap = { 'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12' };
        const mmFormat = monthMap[monthStr] || '01';

        const isPublished = status === 'published';
        const suffix = isPublished ? '_published' : '';
        const pdfFilename = `SSV_e-news_${mmFormat}-${yearStr}${suffix}.pdf`;
        const searchPattern = `SSV_e-news_${monthStr}-${yearStr}`;

        // 1. If publishing, clear out draft files from Drive first
        if (isPublished && driveScriptUrl) {
            if (statusText) statusText.textContent = "Cleaning up draft files...";
            try {
                await fetch(driveScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: JSON.stringify({
                        action: 'deleteDrafts',
                        pattern: searchPattern
                    })
                });
            } catch (err) { console.error("Cleanup error:", err); }
        }

        for (let i = 0; i < uploadedPages.length; i++) {
            const page = uploadedPages[i];
            let imageUrl = page.url;

            // Page file naming: SSV_e-news_<month>-<year>_<page number>[_published]
            const pageFilename = `SSV_e-news_${monthStr}-${yearStr}_P${i + 1}${suffix}.jpg`;

            // Only upload if it's a new file OR if we want to ensure Drive has it
            const alreadyInDrive = page.url && page.url.includes('googleusercontent.com');
            const needsUpdate = page.file || (isPublished && !imageUrl.includes('_published'));

            if (needsUpdate || !alreadyInDrive) {
                let uploadSuccess = false;

                // 1. Try Google Drive first if script URL is set
                if (driveScriptUrl) {
                    try {
                        if (page.file || (isPublished && !alreadyInDrive)) {
                            // If it's a file, upload. 
                            // If it's an existing draft URL and we are publishing, we might want to re-upload to get the new name? 
                            // Actually, let's just upload if it's a file.
                            if (page.file) {
                                const driveUrl = await uploadToGoogleDrive(page.file, pageFilename, driveScriptUrl, status);
                                if (driveUrl) {
                                    imageUrl = driveUrl;
                                    uploadSuccess = true;
                                }
                            }
                        } else if (alreadyInDrive) {
                            uploadSuccess = true;
                        }
                    } catch (driveErr) {
                        console.error("Primary Drive upload failed:", driveErr);
                    }
                }

                // 2. Fallback to Firebase only if Drive failed or isn't set AND it's a new file
                if (!uploadSuccess && page.file) {
                    try {
                        console.log(`Uploading to Firebase Storage for page ${i + 1}...`);
                        const imgRef = ref(storage, `newspapers/${newspaperId}/page_${Date.now()}_${i}.jpg`);
                        const imgSnap = await uploadBytes(imgRef, page.file);
                        imageUrl = await getDownloadURL(imgSnap.ref);
                        uploadSuccess = true;
                    } catch (firebaseError) {
                        console.error("Firebase upload failed:", firebaseError);
                        if (!driveScriptUrl) {
                            throw new Error("Upload failed and no Drive fallback configured: " + firebaseError.message);
                        } else {
                            throw new Error("Both Google Drive and Firebase Storage failed to upload.");
                        }
                    }
                }
            }

            if (statusText) statusText.textContent = `Saving Page ${i + 1}...`;

            await addDoc(collection(db, PAGES_COL), {
                newspaperId: newspaperId,
                pageNumber: i + 1,
                imageUrl: imageUrl
            });

            if (statusProgress) statusProgress.style.width = `${((i + 1) / uploadedPages.length) * 100}%`;
            if (statusCount) statusCount.textContent = `Uploaded ${i + 1} of ${uploadedPages.length} pages`;
            if (progressBar) progressBar.style.width = `${((i + 1) / uploadedPages.length) * 100}%`;
        }

        // Handle PDF Upload with fallback
        if (pdfFile) {
            let pdfUploaded = false;
            let pdfUrl = null;

            // 1. Try Drive first
            if (driveScriptUrl) {
                try {
                    const driveUrl = await uploadToGoogleDrive(pdfFile, pdfFilename, driveScriptUrl, status);
                    if (driveUrl) {
                        pdfUrl = driveUrl;
                        pdfUploaded = true;
                    }
                } catch (e) { console.error("PDF Drive upload failed", e); }
            }

            // 2. Fallback to Firebase
            if (!pdfUploaded) {
                try {
                    const pdfRef = ref(storage, `newspapers/${newspaperId}/edition.pdf`);
                    const uploadSnap = await uploadBytes(pdfRef, pdfFile);
                    pdfUrl = await getDownloadURL(uploadSnap.ref);
                } catch (e) { console.error("PDF Firebase upload failed", e); }
            }

            if (pdfUrl) {
                const docRef = doc(db, NEWSPAPERS_COL, newspaperId);
                await updateDoc(docRef, { pdfUrl });
            }
        }

        if (statusText) statusText.textContent = "Saved Successfully!";
        if (statusIcon) {
            statusIcon.className = 'fas fa-check-circle';
            statusIcon.style.color = '#3c763d';
        }
        if (statusCount) statusCount.textContent = "You can now safely navigate away.";

        updateStatusBadge(status);

        isSaving = false;
        btn.innerHTML = originalText;
        btn.disabled = false;

        // Auto-hide progress toast after 5 seconds
        setTimeout(() => {
            if (!isSaving && bgStatus) bgStatus.style.display = 'none';
        }, 5000);
        hideLoader();

    } catch (error) {
        console.error("Save error:", error);
        isSaving = false;
        if (bgStatus) bgStatus.style.display = 'none';
        alert("Error saving: " + error.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
        hideLoader();
    }
}
