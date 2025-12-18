document.addEventListener('DOMContentLoaded', () => {

    /* --- CONFIG --- */
    // Primary URL for both Image Upload and Sheet Logging
    const UPLOAD_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjKXmOAezGosL9cyDMI2MZvVbrfqH5FsObws_cIYb4b8WjBkFowMNkpYyZh-1eq7u-WQ/exec';

    /* --- UI ELEMENTS --- */
    const dropZone = document.getElementById('dropZone');
    const imageInput = document.getElementById('imageInput');
    const browseBtn = document.getElementById('browseBtn');

    // States
    const uploadState = document.getElementById('uploadState');
    const previewState = document.getElementById('previewState');
    const loadingState = document.getElementById('loadingState');
    const resultState = document.getElementById('resultState');

    // Preview Elements
    const previewImg = document.getElementById('previewImg');
    const confirmUploadBtn = document.getElementById('confirmUploadBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    // Result Elements
    const resultUrl = document.getElementById('resultUrl');
    const copyBtn = document.getElementById('copyBtn');
    const uploadAnotherBtn = document.getElementById('uploadAnotherBtn');

    let currentFile = null;

    /* --- EVENT LISTENERS --- */

    // 1. File Selection
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling to dropZone click
        imageInput.click();
    });

    dropZone.addEventListener('click', () => imageInput.click()); // Click anywhere to browse

    imageInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-color)';
        dropZone.style.background = 'rgba(59, 130, 246, 0.1)';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-dark)';
        dropZone.style.background = 'rgba(30, 41, 59, 0.5)';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-dark)';
        dropZone.style.background = 'rgba(30, 41, 59, 0.5)';
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload a valid image file (JPG, PNG).');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('File size exceeds 5MB limit.');
            return;
        }

        currentFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            showState('preview');
        };
        reader.readAsDataURL(file);
    }

    // 2. Upload Action
    confirmUploadBtn.addEventListener('click', () => {
        if (!currentFile) return;
        showState('loading');
        uploadImage(currentFile);
    });

    cancelBtn.addEventListener('click', () => {
        resetTool();
    });

    uploadAnotherBtn.addEventListener('click', () => {
        resetTool();
    });

    // 3. Copy Action
    copyBtn.addEventListener('click', () => {
        resultUrl.select();
        document.execCommand('copy');

        // Visual Feedback
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅';
        setTimeout(() => copyBtn.textContent = originalText, 2000);
    });

    /* --- LOGIC --- */

    function showState(state) {
        uploadState.style.display = 'none';
        previewState.style.display = 'none';
        loadingState.style.display = 'none';
        resultState.style.display = 'none';

        if (state === 'upload') uploadState.style.display = 'block';
        if (state === 'preview') previewState.style.display = 'block';
        if (state === 'loading') loadingState.style.display = 'block';
        if (state === 'result') resultState.style.display = 'block';
    }

    function resetTool() {
        currentFile = null;
        imageInput.value = '';
        previewImg.src = '';
        resultUrl.value = '';
        showState('upload');
    }

    function uploadImage(file) {
        // Prepare User Email (from session if available, else Anonymous)
        const sessionData = sessionStorage.getItem('gridify_admin_session');
        let userEmail = 'Anonymous';
        if (sessionData) {
            try { userEmail = JSON.parse(sessionData).username || 'Anonymous'; } catch (e) { }
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function () {
            const base64Data = reader.result.split(',')[1];

            const payload = {
                image: base64Data,
                mimeType: file.type,
                userEmail: userEmail,
                sheetName: 'individual',
                source: 'image_tool' // Optional marker
            };

            fetch(UPLOAD_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify(payload)
            })
                .then(res => res.json())
                .then(data => {
                    if (data.result === 'success') {
                        handleSuccess(data.url, userEmail);
                    } else {
                        alert('Upload failed: ' + data.message);
                        showState('preview');
                    }
                })
                .catch(err => {
                    console.error(err);
                    alert('Network error. Please try again.');
                    showState('preview');
                });
        };
    }

    function handleSuccess(url, email) {
        // Update UI
        resultUrl.value = url;
        showState('result');
        console.log('Upload & Logging success. URL:', url);
    }

});
