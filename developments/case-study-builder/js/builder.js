document.addEventListener('DOMContentLoaded', () => {
    const data = window.UXData;
    data.loadData();
    const state = data.getState();

    const sectionNav = document.getElementById('sectionNav');
    const blockList = document.getElementById('blockList');
    const caseStudyTitle = document.getElementById('caseStudyTitle');
    const caseStudySubtitle = document.getElementById('caseStudySubtitle');
    const sectionTitleInput = document.getElementById('sectionTitleInput');
    const saveStatus = document.getElementById('saveStatus');
    const livePreviewContent = document.getElementById('livePreviewContent');
    const blockProps = document.getElementById('blockProps');
    const noSelectionMsg = document.getElementById('noSelectionMsg');
    const textOnlyProps = document.getElementById('textOnlyProps');
    const imageOnlyProps = document.getElementById('imageOnlyProps');

    let activeSectionId = state.sections[0]?.id || null;
    let activeBlockId = null;

    // Initialization
    caseStudyTitle.value = state.title;
    caseStudySubtitle.value = state.subtitle || 'UX Case Study';

    function render() {
        renderNav();
        renderEditor();
        updatePropertiesPanel();
        renderLivePreview();
    }

    function selectBlock(blockId) {
        if (activeBlockId === blockId) return;
        activeBlockId = blockId;

        // Update visual selection without re-rendering everything
        document.querySelectorAll('.block-item').forEach(item => {
            const id = item.dataset.id;
            item.classList.toggle('active', id === activeBlockId);
        });

        updatePropertiesPanel();
    }

    function renderNav() {
        sectionNav.innerHTML = '';
        state.sections.forEach((section, index) => {
            const isActive = section.id === activeSectionId;
            const item = document.createElement('div');
            item.className = `nav-item ${isActive ? 'active' : ''}`;
            item.innerHTML = `
                <span>${index + 1}. ${section.title}</span>
                <div class="controls">
                    <button onclick="event.stopPropagation(); changeSectionOrder('${section.id}', 'up')">↑</button>
                    <button onclick="event.stopPropagation(); changeSectionOrder('${section.id}', 'down')">↓</button>
                    <button onclick="event.stopPropagation(); deleteSection('${section.id}')" style="color: #ff4757;">×</button>
                </div>
            `;
            item.onclick = () => { activeSectionId = section.id; activeBlockId = null; render(); };
            sectionNav.appendChild(item);
        });
    }

    function renderEditor() {
        const section = state.sections.find(s => s.id === activeSectionId);
        if (!section) return;

        sectionTitleInput.value = section.title;
        blockList.innerHTML = '';

        section.blocks.forEach(block => {
            const blockItem = document.createElement('div');
            blockItem.className = `block-item ${block.id === activeBlockId ? 'active' : ''}`;
            blockItem.dataset.id = block.id;
            blockItem.style.width = block.styles.width || '100%';

            if (block.type === 'text') {
                blockItem.innerHTML = `
                    <div class="block-controls">
                        <button onclick="event.stopPropagation(); moveBlock('${block.id}', 'up')">↑</button>
                        <button onclick="event.stopPropagation(); moveBlock('${block.id}', 'down')">↓</button>
                    </div>
                    <textarea class="block-text" placeholder="Type here..." oninput="updateBlockContent('${block.id}', this.value)" 
                        style="text-align: ${block.styles.textAlign || 'left'}; font-family: ${block.styles.fontFamily || 'inherit'}; color: ${block.styles.color || '#1a1a1a'}">${block.content}</textarea>
                `;
            } else {
                blockItem.innerHTML = `
                    <div class="block-controls">
                        <button onclick="event.stopPropagation(); moveBlock('${block.id}', 'up')">↑</button>
                        <button onclick="event.stopPropagation(); moveBlock('${block.id}', 'down')">↓</button>
                    </div>
                    <div style="display: flex; justify-content: ${getJustify(block.styles.alignment)}; pointer-events: none;">
                        <img src="${block.content}" class="block-image-preview" style="border-radius: ${block.styles.cornerRadius}px; opacity: ${block.styles.opacity / 100}">
                    </div>
                `;
            }

            blockItem.onclick = (e) => {
                e.stopPropagation();
                selectBlock(block.id);
            };
            blockList.appendChild(blockItem);
        });
    }

    function updatePropertiesPanel() {
        const section = state.sections.find(s => s.id === activeSectionId);
        const block = section?.blocks.find(b => b.id === activeBlockId);

        if (block) {
            blockProps.style.display = 'block';
            noSelectionMsg.style.display = 'none';

            textOnlyProps.style.display = block.type === 'text' ? 'block' : 'none';
            imageOnlyProps.style.display = block.type === 'image' ? 'block' : 'none';

            // Set current width active button
            document.querySelectorAll('.width-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.w === block.styles.width);
            });

            if (block.type === 'text') {
                document.getElementById('textFont').value = block.styles.fontFamily || 'Inter';
                document.getElementById('textColor').value = block.styles.color || '#1a1a1a';
            }

            if (block.type === 'image') {
                document.getElementById('imgRadius').value = block.styles.cornerRadius;
                document.getElementById('imgOpacity').value = block.styles.opacity;
            }
        } else {
            blockProps.style.display = 'none';
            noSelectionMsg.style.display = 'block';
        }

        if (section) {
            document.getElementById('secGap').value = section.styles.gap;
        }
    }

    function getJustify(align) {
        if (align === 'left') return 'flex-start';
        if (align === 'right') return 'flex-end';
        return 'center';
    }

    // Global Event Listeners & Functions
    window.addNewSection = () => {
        const newSec = data.addSection(activeSectionId);
        activeSectionId = newSec.id;
        activeBlockId = null;
        render();
    };

    window.deleteSection = (id) => {
        if (confirm('Delete section?')) {
            data.removeSection(id);
            if (activeSectionId === id) activeSectionId = state.sections[0]?.id || null;
            render();
        }
    };

    window.changeSectionOrder = (id, dir) => { data.moveSection(id, dir); render(); };

    window.addTextBlock = () => {
        const block = data.addBlock(activeSectionId, 'text');
        activeBlockId = block.id;
        render();
    };

    window.handleImageBlock = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const block = data.addBlock(activeSectionId, 'image', event.target.result);
                activeBlockId = block.id;
                render();
            };
            reader.readAsDataURL(file);
        }
    };

    window.updateBlockContent = (id, val) => {
        data.updateBlock(activeSectionId, id, { content: val });
        renderLivePreview(); // Real-time update
        showStatus();
    };

    window.updateWidth = (w) => { data.updateBlock(activeSectionId, activeBlockId, { styles: { width: w } }); render(); showStatus(); };

    window.updateBlockStyle = (prop, val) => {
        data.updateBlock(activeSectionId, activeBlockId, { styles: { [prop]: val } });
        render();
        showStatus();
    };

    window.updateImgProp = (prop, val) => {
        const u = {};
        u[prop] = prop === 'alignment' ? val : parseInt(val);
        data.updateBlock(activeSectionId, activeBlockId, { styles: u });
        render();
        showStatus();
    };

    window.deleteActiveBlock = () => { data.removeBlock(activeSectionId, activeBlockId); activeBlockId = null; render(); showStatus(); };
    window.moveBlock = (id, dir) => { data.moveBlock(activeSectionId, id, dir); render(); };

    window.updateSectionProp = (prop, val) => {
        data.updateSection(activeSectionId, { styles: { [prop]: parseInt(val) } });
        renderLivePreview();
        showStatus();
    };

    sectionTitleInput.oninput = (e) => { data.updateSection(activeSectionId, { title: e.target.value }); renderNav(); renderLivePreview(); showStatus(); };
    caseStudyTitle.oninput = (e) => { data.updateTitle(e.target.value); renderLivePreview(); showStatus(); };
    caseStudySubtitle.oninput = (e) => { data.updateSubtitle(e.target.value); renderLivePreview(); showStatus(); };

    function showStatus() {
        saveStatus.textContent = 'Saving...';
        setTimeout(() => saveStatus.textContent = 'All changes saved', 800);
    }

    function renderLivePreview() {
        if (!livePreviewContent) return;
        const s = data.getState();
        let html = `<div>
            <header style="margin-bottom: 2em; text-align: center;">
                <h1 class="heading" style="font-size: 2.5em; margin-bottom: 0.4em;">${s.title || 'Untitled Case Study'}</h1>
                <p style="color: #666; font-size: 1.1em;">${s.subtitle || 'UX Case Study'}</p>
            </header>`;

        s.sections.forEach(sec => {
            if (sec.blocks.length === 0) return;
            // Convert px gap to em for scaling (assuming 16px is base, so gap/16)
            const baseGapEm = (sec.styles.gap || 20) / 16;
            html += `<section style="margin-bottom: 2.5em; padding-top: 1.25em;">
                <h2 class="heading" style="font-size: 1.5em; margin-bottom: 1.25em; border-bottom: 1px solid #eee; padding-bottom: 0.6em;">${sec.title}</h2>
                <div style="display: flex; flex-wrap: wrap; gap: ${baseGapEm}em; align-items: flex-start;">`;

            sec.blocks.forEach(block => {
                const w = block.styles.width || '100%';
                let contentHtml = '';
                if (block.type === 'text') {
                    contentHtml = `<div style="white-space: pre-wrap; text-align: ${block.styles.textAlign}; font-family: ${block.styles.fontFamily}; color: ${block.styles.color}; font-size: 1em; line-height: 1.6;">${block.content || '...'}</div>`;
                } else {
                    const align = getJustify(block.styles.alignment);
                    contentHtml = `<div style="display: flex; justify-content: ${align}; width: 100%;">
                        <img src="${block.content}" style="border-radius: ${block.styles.cornerRadius}px; opacity: ${block.styles.opacity / 100}; max-width: 100%; height: auto;">
                    </div>`;
                }
                const gapEm = baseGapEm;
                const calcWidth = w === '100%' ? '100%' : `calc(${w} - ${gapEm}em)`;
                html += `<div style="flex: 0 0 ${calcWidth}; width: ${calcWidth};">${contentHtml}</div>`;
            });

            html += `</div></section>`;
        });

        html += `</div>`;
        livePreviewContent.innerHTML = html;
    }

    render();
});
