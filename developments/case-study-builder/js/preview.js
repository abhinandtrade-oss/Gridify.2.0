document.addEventListener('DOMContentLoaded', () => {
    const data = window.UXData;
    data.loadData();
    const state = data.getState();
    const container = document.getElementById('caseStudyContent');

    window.updatePageSize = (size) => {
        const paper = document.getElementById('caseStudyContent');
        let pageStyle = document.getElementById('dynamicPageStyle');
        if (!pageStyle) {
            pageStyle = document.createElement('style');
            pageStyle.id = 'dynamicPageStyle';
            document.head.appendChild(pageStyle);
        }

        if (size === 'A4') {
            paper.style.width = '210mm';
            paper.style.minHeight = '297mm';
            paper.style.padding = '20mm';
            pageStyle.textContent = '@page { size: A4; margin: 0; }';
        } else if (size === 'Letter') {
            paper.style.width = '215.9mm';
            paper.style.minHeight = '279.4mm';
            paper.style.padding = '20mm';
            pageStyle.textContent = '@page { size: letter; margin: 0; }';
        }
    };


    function getJustify(align) {
        if (align === 'left') return 'flex-start';
        if (align === 'right') return 'flex-end';
        return 'center';
    }

    function renderPreview() {
        let html = `
            <header style="margin-bottom: 80px; text-align: center;">
                <h1 class="heading" style="font-size: 3.5rem; line-height: 1.2; margin-bottom: 16px;">${state.title}</h1>
                <p style="font-size: 1.2rem; color: #666;">${state.subtitle || 'UX Case Study'}</p>
            </header>
        `;

        state.sections.forEach(section => {
            if (section.blocks.length === 0) return;

            html += `
                <section class="section" style="padding: ${section.styles.padding || 0}px 0;">
                    <h2 class="section-title heading" style="margin-bottom: 32px;">${section.title}</h2>
                    <div style="display: flex; flex-wrap: wrap; gap: ${section.styles.gap || 20}px; align-items: flex-start;">
            `;

            section.blocks.forEach(block => {
                const w = block.styles.width || '100%';
                let blockHtml = '';

                if (block.type === 'text') {
                    blockHtml = `<div style="white-space: pre-wrap; text-align: ${block.styles.textAlign || 'left'}; font-family: ${block.styles.fontFamily || 'inherit'}; color: ${block.styles.color || '#1a1a1a'}; font-size: 1.1rem; line-height: 1.8;">${block.content}</div>`;
                } else {
                    const align = getJustify(block.styles.alignment);
                    blockHtml = `
                        <div style="display: flex; justify-content: ${align}; width: 100%;">
                            <img src="${block.content}" 
                                 style="border-radius: ${block.styles.cornerRadius}px; opacity: ${block.styles.opacity / 100}; max-width: 100%; height: auto; box-shadow: var(--shadow-soft);">
                        </div>
                    `;
                }

                // Adjust width for flex gap if not 100%
                const gap = section.styles.gap || 20;
                const calcWidth = w === '100%' ? '100%' : `calc(${w} - ${gap}px)`;
                html += `<div style="flex: 0 0 ${calcWidth}; width: ${calcWidth};">${blockHtml}</div>`;
            });

            html += `</div></section>`;
        });

        if (state.sections.every(s => s.blocks.length === 0)) {
            html = `
                <div style="text-align: center; padding: 100px 0;">
                    <h2 class="heading">Your case study is empty</h2>
                    <p style="margin-top: 20px; color: #666;">Your blocks will appear here.</p>
                    <a href="builder.html" class="btn btn-primary" style="margin-top: 32px;">Back to Editor</a>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderPreview();
});
