/**
 * Online PDF Editor - Core Logic
 */

const App = {
    state: {
        pdfDoc: null,
        currentPage: 1,
        totalPages: 0,
        scale: 1.5,
        currentTool: 'select',
        pages: [] // Array of { pageIndex, fabricCanvas }
    },

    init() {
        this.initTheme();
        this.bindEvents();
        console.log('App Initialized');
    },

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            this.updateThemeIcon(true);
        }
    },

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        this.updateThemeIcon(isDark);
    },

    updateThemeIcon(isDark) {
        const icon = document.getElementById('theme-icon');
        if (icon) {
            icon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
            lucide.createIcons();
        }
    },

    bindEvents() {
        const uploadZone = document.getElementById('upload-zone');
        const fileInput = document.getElementById('pdf-file-input');
        const btnUploadNew = document.getElementById('btn-upload-new');
        const themeToggle = document.getElementById('theme-toggle');

        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        uploadZone.addEventListener('click', () => fileInput.click());

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) this.handleFileUpload(files[0]);
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.handleFileUpload(e.target.files[0]);
        });

        btnUploadNew.addEventListener('click', () => {
            if (confirm('All current edits will be lost. Continue?')) {
                location.reload();
            }
        });

        // Navigation
        document.getElementById('prev-page').addEventListener('click', () => this.changePage(-1));
        document.getElementById('next-page').addEventListener('click', () => this.changePage(1));

        // Tools
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setTool(btn.id.replace('tool-', ''));
            });
        });
    },

    async handleFileUpload(file) {
        if (file.type !== 'application/pdf') {
            alert('Please upload a valid PDF file.');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            alert('File size exceeds 20MB limit.');
            return;
        }

        // Hide upload zone, show viewer
        document.getElementById('upload-zone').classList.add('hidden');
        document.getElementById('pdf-viewer-container').classList.remove('hidden');

        this.state.pdfFile = file;

        try {
            await PDFRenderer.loadPDF(file);
            this.state.totalPages = PDFRenderer.pdfDoc.numPages;
            document.getElementById('total-pages').textContent = this.state.totalPages;

            // Render all pages (optimally we should lazy load, but for MVP we render all)
            await PDFRenderer.renderAllPages();

            this.updateUI();
            this.logUsage('upload', file.size);
        } catch (error) {
            console.error('Error loading PDF:', error);
            alert('Failed to load PDF.');
        }
    },

    changePage(delta) {
        const newPage = this.state.currentPage + delta;
        if (newPage >= 1 && newPage <= this.state.totalPages) {
            this.state.currentPage = newPage;
            this.updateUI();

            // Scroll to the page
            const pageEl = document.querySelector(`[data-page-index="${newPage}"]`);
            if (pageEl) {
                pageEl.scrollIntoView({ behavior: 'smooth' });
            }
        }
    },

    updateUI() {
        document.getElementById('current-page').textContent = this.state.currentPage;
    },

    setTool(tool) {
        this.state.currentTool = tool;
        console.log('Current Tool:', tool);
        // Dispatch to editor tools logic
        if (window.EditorTools) {
            EditorTools.updateActiveTool(tool);
        }
    },

    async logUsage(action, fileSize = 0) {
        const data = {
            timestamp: new Date().toISOString(),
            fileSize: fileSize,
            action: action,
            deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop'
        };

        console.log('Logging usage:', data);
    },

    // --- PDF Manipulation & Export ---

    async downloadPDF() {
        const btnDownload = document.getElementById('btn-download');
        const originalText = btnDownload.innerHTML;
        btnDownload.innerHTML = '<i data-lucide="loader" class="spin"></i> <span>Processing...</span>';
        lucide.createIcons();

        try {
            const pdfDoc = await PDFLib.PDFDocument.load(await this.state.pdfFile.arrayBuffer());
            const pages = pdfDoc.getPages();

            for (let i = 0; i < this.state.pages.length; i++) {
                const fabricPage = this.state.pages[i];
                const fabricCanvas = fabricPage.fabricCanvas;
                const pdfPage = pages[fabricPage.pageIndex - 1];

                if (fabricCanvas.getObjects().length > 0) {
                    // Export fabric canvas to image
                    const dataURL = fabricCanvas.toDataURL({
                        format: 'png',
                        multiplier: 1 / this.state.scale
                    });

                    const pngImage = await pdfDoc.embedPng(dataURL);
                    const { width, height } = pdfPage.getSize();
                    pdfPage.drawImage(pngImage, {
                        x: 0,
                        y: 0,
                        width: width,
                        height: height,
                    });
                }

                // Handle rotation during export if needed
                const pageEl = document.querySelector(`[data-page-index="${fabricPage.pageIndex}"]`);
                if (pageEl && pageEl.dataset.rotation) {
                    const rotation = parseInt(pageEl.dataset.rotation);
                    pdfPage.setRotation(PDFLib.degrees(rotation));
                }
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `edited_${this.state.pdfFile.name}`;
            link.click();

            this.logUsage('download', pdfBytes.length);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('Failed to export PDF.');
        } finally {
            btnDownload.innerHTML = originalText;
            lucide.createIcons();
        }
    },

    rotatePage(direction) {
        const pageEl = document.querySelector(`[data-page-index="${this.state.currentPage}"]`);
        if (pageEl) {
            const currentRotation = parseInt(pageEl.dataset.rotation || 0);
            const newRotation = (currentRotation + (direction === 'right' ? 90 : -90)) % 360;
            pageEl.style.transform = `rotate(${newRotation}deg)`;
            pageEl.dataset.rotation = newRotation;
        }
    },

    deleteCurrentPage() {
        if (confirm('Are you sure you want to delete this page?')) {
            const pageIndex = this.state.currentPage;
            const pageEl = document.querySelector(`[data-page-index="${pageIndex}"]`);
            if (pageEl) {
                pageEl.remove();
                this.state.pages = this.state.pages.filter(p => p.pageIndex !== pageIndex);
                if (this.state.currentPage > 1) this.changePage(-1);
                else this.updateUI();
            }
        }
    }
};

window.App = App;

window.addEventListener('DOMContentLoaded', () => {
    App.init();

    // Global Event Listeners
    document.getElementById('btn-download').addEventListener('click', () => App.downloadPDF());
    document.getElementById('tool-rotate-left').addEventListener('click', () => App.rotatePage('left'));
    document.getElementById('tool-rotate-right').addEventListener('click', () => App.rotatePage('right'));
    document.getElementById('tool-delete-page').addEventListener('click', () => App.deleteCurrentPage());
});
