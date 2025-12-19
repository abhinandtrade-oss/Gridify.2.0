/**
 * PDF Rendering Logic
 */

const PDFRenderer = {
    pdfDoc: null,
    pages: [],

    async loadPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        this.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        return this.pdfDoc;
    },

    async renderAllPages() {
        const container = document.getElementById('pdf-pages-container');
        container.innerHTML = ''; // Clear previous

        for (let i = 1; i <= this.pdfDoc.numPages; i++) {
            const page = await this.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: App.state.scale });

            const pageWrapper = document.createElement('div');
            pageWrapper.className = 'pdf-page-wrapper';
            pageWrapper.dataset.pageIndex = i;
            pageWrapper.style.width = `${viewport.width}px`;
            pageWrapper.style.height = `${viewport.height}px`;

            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas-layer';
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            pageWrapper.appendChild(canvas);
            container.appendChild(pageWrapper);

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            // Initialize Fabric Canvas on top
            this.initFabricCanvas(pageWrapper, i, viewport.width, viewport.height);
        }
    },

    initFabricCanvas(wrapper, pageIndex, width, height) {
        const canvasEl = document.createElement('canvas');
        canvasEl.className = 'canvas-layer';
        canvasEl.id = `canvas-page-${pageIndex}`;
        wrapper.appendChild(canvasEl);

        const fabricCanvas = new fabric.Canvas(canvasEl.id, {
            width: width,
            height: height,
            isDrawingMode: false
        });

        // Store canvas reference
        App.state.pages.push({
            pageIndex: pageIndex,
            fabricCanvas: fabricCanvas
        });

        if (window.EditorTools) {
            EditorTools.initCanvasEvents(fabricCanvas);
        }
    }
};

window.PDFRenderer = PDFRenderer;
