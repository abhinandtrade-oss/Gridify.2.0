document.addEventListener('DOMContentLoaded', () => {
    const data = window.UXData;
    data.loadData();
    const state = data.getState();
    const container = document.getElementById('caseStudyContent');

    function renderPreview() {
        let html = `
            <header style="margin-bottom: 80px;">
                <h1 class="heading" style="font-size: 3.5rem; line-height: 1.2; margin-bottom: 16px;">${state.title}</h1>
                <p style="font-size: 1.2rem; color: #666;">UX Case Study</p>
            </header>
        `;

        state.sections.forEach(section => {
            if (section.content || section.images.length > 0) {
                html += `
                    <section class="section">
                        <h2 class="section-title heading">${section.title}</h2>
                        <div class="content-text">${section.content || ''}</div>
                        <div class="image-gallery">
                            ${section.images.map(img => `<img src="${img}" alt="${section.title}">`).join('')}
                        </div>
                    </section>
                `;
            }
        });

        if (state.sections.every(s => !s.content && s.images.length === 0)) {
            html = `
                <div style="text-align: center; padding: 100px 0;">
                    <h2 class="heading">Your case study is empty</h2>
                    <p style="margin-top: 20px; color: #666;">Go back to the editor to add some content!</p>
                    <a href="builder.html" class="btn btn-primary" style="margin-top: 32px;">Back to Editor</a>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    renderPreview();
});
