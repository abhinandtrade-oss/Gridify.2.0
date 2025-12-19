document.addEventListener('DOMContentLoaded', () => {
    const data = window.UXData;
    data.loadData();
    const state = data.getState();

    const sectionNav = document.getElementById('sectionNav');
    const sectionEditors = document.getElementById('sectionEditors');
    const livePreview = document.getElementById('livePreview');
    const caseStudyTitle = document.getElementById('caseStudyTitle');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const saveStatus = document.getElementById('saveStatus');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    let currentSectionIndex = 0;

    // Initialize UI
    caseStudyTitle.value = state.title;

    function render() {
        sectionNav.innerHTML = '';
        sectionEditors.innerHTML = '';

        state.sections.forEach((section, index) => {
            // Nav Item
            const navItem = document.createElement('div');
            navItem.className = `nav-item ${index === currentSectionIndex ? 'active' : ''}`;
            navItem.textContent = section.title;
            navItem.onclick = () => goToSection(index);
            sectionNav.appendChild(navItem);

            // Editor
            const editor = document.createElement('div');
            editor.className = `section-editor ${index === currentSectionIndex ? 'active' : ''}`;
            editor.innerHTML = `
                <h2 class="heading" style="margin-bottom: 20px;">${section.title}</h2>
                <textarea placeholder="Describe your ${section.title.toLowerCase()} here..." data-id="${section.id}">${section.content}</textarea>
                
                <div class="image-uploader">
                    <label class="btn btn-outline" style="cursor: pointer;">
                        Add Image
                        <input type="file" accept="image/*" style="display: none;" onchange="handleImageUpload(event, '${section.id}')">
                    </label>
                    <div class="image-preview-grid" id="images-${section.id}" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; margin-top: 20px;">
                        ${section.images.map((img, i) => `
                            <div class="image-item" style="position: relative;">
                                <img src="${img}" style="width: 100%; border-radius: 8px; border: 1px solid #eee;">
                                <button onclick="removeImage('${section.id}', ${i})" style="position: absolute; top: -5px; right: -5px; background: #ff4757; color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 12px;">&times;</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            sectionEditors.appendChild(editor);
        });

        updateProgress();
        updatePreview();
        updateNavButtons();
    }

    function goToSection(index) {
        currentSectionIndex = index;
        render();
    }

    function updateNavButtons() {
        prevBtn.disabled = currentSectionIndex === 0;
        nextBtn.textContent = currentSectionIndex === state.sections.length - 1 ? 'Finish' : 'Next Section';
    }

    prevBtn.onclick = () => {
        if (currentSectionIndex > 0) goToSection(currentSectionIndex - 1);
    };

    nextBtn.onclick = () => {
        if (currentSectionIndex < state.sections.length - 1) {
            goToSection(currentSectionIndex + 1);
        } else {
            window.location.href = 'preview.html';
        }
    };

    // Auto-save & Preview
    sectionEditors.addEventListener('input', (e) => {
        if (e.target.tagName === 'TEXTAREA') {
            const id = e.target.dataset.id;
            data.updateSection(id, e.target.value);
            showSavedStatus();
            updatePreview();
            updateProgress();
        }
    });

    caseStudyTitle.oninput = (e) => {
        data.updateTitle(e.target.value);
        showSavedStatus();
        updatePreview();
    };

    function showSavedStatus() {
        saveStatus.textContent = 'Saving...';
        setTimeout(() => {
            saveStatus.textContent = 'All changes saved';
        }, 1000);
    }

    function updateProgress() {
        const total = state.sections.length;
        const filled = state.sections.filter(s => s.content.trim() !== '' || s.images.length > 0).length;
        const percent = Math.round((filled / total) * 100);
        progressFill.style.width = `${percent}%`;
        progressText.textContent = `${percent}% complete`;
    }

    function updatePreview() {
        let html = `<h1 class="heading" style="font-size: 2.5rem; margin-bottom: 40px;">${state.title}</h1>`;
        state.sections.forEach(section => {
            if (section.content || section.images.length > 0) {
                html += `
                    <div style="margin-bottom: 40px;">
                        <h2 class="heading" style="font-size: 1.5rem; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 8px;">${section.title}</h2>
                        <div style="white-space: pre-wrap; margin-bottom: 16px;">${section.content}</div>
                        <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
                            ${section.images.map(img => `<img src="${img}" style="max-width: 100%; border-radius: 12px;">`).join('')}
                        </div>
                    </div>
                `;
            }
        });
        livePreview.innerHTML = html;
    }

    // Global handles for dynamic elements
    window.handleImageUpload = (event, sectionId) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                data.addImageToSection(sectionId, e.target.result);
                render();
            };
            reader.readAsDataURL(file);
        }
    };

    window.removeImage = (sectionId, index) => {
        data.removeImageFromSection(sectionId, index);
        render();
    };

    render();
});
