/**
 * Fabric.js Editing Tools
 */

const EditorTools = {
    activeTool: 'select',

    initCanvasEvents(canvas) {
        canvas.on('selection:created', (e) => this.handleSelection(e));
        canvas.on('selection:updated', (e) => this.handleSelection(e));
        canvas.on('selection:cleared', () => this.handleSelection(null));

        // Handle object modified for history/state (Phase 2)
        canvas.on('object:modified', () => {
            console.log('Object modified');
        });

        // Click to add text if tool is active
        canvas.on('mouse:down', (options) => {
            if (this.activeTool === 'text' && !options.target) {
                this.addText(canvas, options.pointer.x, options.pointer.y);
            }
        });
    },

    updateActiveTool(tool) {
        this.activeTool = tool;

        App.state.pages.forEach(p => {
            const canvas = p.fabricCanvas;
            canvas.isDrawingMode = (tool === 'draw' || tool === 'highlight');

            if (canvas.isDrawingMode) {
                canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
                canvas.freeDrawingBrush.width = (tool === 'highlight') ? 20 : 3;
                canvas.freeDrawingBrush.color = (tool === 'highlight') ? '#ffff0088' : document.getElementById('prop-text-color').value;
            }

            // Set cursor based on tool
            canvas.defaultCursor = this.getCursorForTool(tool);
            canvas.setCursor(canvas.defaultCursor);
        });
    },

    getCursorForTool(tool) {
        switch (tool) {
            case 'text': return 'text';
            case 'draw':
            case 'highlight': return 'crosshair';
            case 'shape': return 'crosshair';
            case 'image': return 'copy';
            default: return 'default';
        }
    },

    handleSelection(e) {
        const propPanel = document.getElementById('prop-text-group');
        if (e && e.selected && e.selected[0] && e.selected[0].type === 'i-text') {
            const obj = e.selected[0];
            propPanel.classList.remove('hidden');
            document.getElementById('prop-font-size').value = obj.fontSize;
            document.getElementById('prop-text-color').value = obj.fill;
        } else {
            // keep it visible or hide depending on UX preference
            // propPanel.classList.add('hidden');
        }
    },

    addText(canvas, x, y) {
        const text = new fabric.IText('Type something...', {
            left: x,
            top: y,
            fontFamily: 'Inter',
            fontSize: parseInt(document.getElementById('prop-font-size').value),
            fill: document.getElementById('prop-text-color').value,
            textBackgroundColor: document.getElementById('prop-bg-color').value === '#ffffff' ? 'transparent' : document.getElementById('prop-bg-color').value
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        App.state.currentTool = 'select'; // Switch back to select after adding
        App.updateUI();
        this.updateActiveTool('select');
        document.getElementById('tool-select').click();
    },

    addShape(type) {
        // Implement shape adding logic
        const canvas = App.state.pages[App.state.currentPage - 1].fabricCanvas;
        let shape;
        const color = document.getElementById('prop-text-color').value;

        if (type === 'rect') {
            shape = new fabric.Rect({
                left: 100, top: 100, width: 100, height: 60, fill: 'transparent', stroke: color, strokeWidth: 2
            });
        } else if (type === 'circle') {
            shape = new fabric.Circle({
                left: 100, top: 100, radius: 40, fill: 'transparent', stroke: color, strokeWidth: 2
            });
        }

        if (shape) {
            canvas.add(shape);
            canvas.setActiveObject(shape);
        }
    },

    addImage(file) {
        const reader = new FileReader();
        reader.onload = (f) => {
            const data = f.target.result;
            fabric.Image.fromURL(data, (img) => {
                const canvas = App.state.pages[App.state.currentPage - 1].fabricCanvas;
                img.scaleToWidth(200);
                canvas.add(img);
                canvas.centerObject(img);
                canvas.setActiveObject(img);
            });
        };
        reader.readAsDataURL(file);
    }
};

// Bind properties panel events
document.getElementById('prop-font-size').addEventListener('input', (e) => {
    const canvas = App.state.pages[App.state.currentPage - 1].fabricCanvas;
    const activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
        activeObj.set('fontSize', parseInt(e.target.value));
        canvas.renderAll();
    }
});

document.getElementById('prop-text-color').addEventListener('input', (e) => {
    const canvas = App.state.pages[App.state.currentPage - 1].fabricCanvas;
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
        activeObj.set('fill', e.target.value);
        if (activeObj.stroke && activeObj.stroke !== 'transparent') {
            activeObj.set('stroke', e.target.value);
        }
        canvas.renderAll();
    }

    // Also update drawing brush color
    if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush.color = e.target.value;
    }
});

document.getElementById('prop-bg-color').addEventListener('input', (e) => {
    const canvas = App.state.pages[App.state.currentPage - 1].fabricCanvas;
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
        if (activeObj.type === 'i-text') {
            activeObj.set('textBackgroundColor', e.target.value);
        } else {
            activeObj.set('fill', e.target.value);
        }
        canvas.renderAll();
    }
});

document.getElementById('align-left').addEventListener('click', () => setTextAlign('left'));
document.getElementById('align-center').addEventListener('click', () => setTextAlign('center'));
document.getElementById('align-right').addEventListener('click', () => setTextAlign('right'));

function setTextAlign(align) {
    const canvas = App.state.pages[App.state.currentPage - 1].fabricCanvas;
    const activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.type === 'i-text') {
        activeObj.set('textAlign', align);
        canvas.renderAll();
    }

    document.querySelectorAll('.align-controls .btn-icon').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`align-${align}`).classList.add('active');
}

window.EditorTools = EditorTools;

// Tool-specific sub-actions
document.getElementById('tool-shape').addEventListener('click', () => {
    // For now just add a rectangle, could add a submenu later
    EditorTools.addShape('rect');
});

document.getElementById('tool-image').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        if (e.target.files.length > 0) EditorTools.addImage(e.target.files[0]);
    };
    input.click();
});

document.getElementById('tool-whiteout').addEventListener('click', () => {
    const canvas = App.state.pages[App.state.currentPage - 1].fabricCanvas;
    const rect = new fabric.Rect({
        left: 100,
        top: 100,
        width: 150,
        height: 30,
        fill: '#ffffff',
        stroke: '#e2e8f0',
        strokeWidth: 1,
        transparentCorners: false
    });
    canvas.add(rect);
    canvas.setActiveObject(rect);
    EditorTools.updateActiveTool('select');
    document.getElementById('tool-select').click();
});
