const STORAGE_KEY = 'ux_case_study_data';

const DEFAULT_SECTIONS = [
    { id: 'project-overview', title: 'Project Overview', content: '', images: [] },
    { id: 'context', title: 'Context (Brief)', content: '', images: [] },
    { id: 'problem-statement', title: 'Problem Statement', content: '', images: [] },
    { id: 'crafted-solution', title: 'Crafted Solution', content: '', images: [] },
    { id: 'timeline', title: 'Timeline', content: '', images: [] },
    { id: 'project-goals', title: 'Project Goals', content: '', images: [] },
    { id: 'research-part', title: 'Research Part', content: '', images: [] },
    { id: 'brainstorming', title: 'Brainstorming & Ideation', content: '', images: [] },
    { id: 'sketches', title: 'Sketches & Wireframes', content: '', images: [] },
    { id: 'iterations', title: 'Iterations', content: '', images: [] },
    { id: 'final-designs', title: 'Final Designs', content: '', images: [] },
    { id: 'design-system', title: 'Design System / Style Guide', content: '', images: [] },
    { id: 'prototype', title: 'Prototype', content: '', images: [] },
    { id: 'user-testing', title: 'User Testing', content: '', images: [] },
    { id: 'conclusion', title: 'Conclusion', content: '', images: [] },
    { id: 'improvements', title: 'Scope of Improvements', content: '', images: [] },
    { id: 'reflection', title: 'What Could Have Been Better?', content: '', images: [] },
    { id: 'feedback', title: 'Feedback & Suggestions', content: '', images: [] }
];

let appState = {
    title: 'Untitled Case Study',
    sections: JSON.parse(JSON.stringify(DEFAULT_SECTIONS)),
    lastSaved: null
};

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        appState = JSON.parse(saved);
        return true;
    }
    return false;
}

function saveData() {
    appState.lastSaved = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function resetData() {
    if (confirm('Are you sure you want to reset? All progress will be lost.')) {
        appState = {
            title: 'Untitled Case Study',
            sections: JSON.parse(JSON.stringify(DEFAULT_SECTIONS)),
            lastSaved: null
        };
        saveData();
        window.location.reload();
    }
}

function updateSection(id, content) {
    const section = appState.sections.find(s => s.id === id);
    if (section) {
        section.content = content;
        saveData();
    }
}

function addImageToSection(id, imageData) {
    const section = appState.sections.find(s => s.id === id);
    if (section) {
        section.images.push(imageData);
        saveData();
    }
}

function removeImageFromSection(id, index) {
    const section = appState.sections.find(s => s.id === id);
    if (section && section.images[index]) {
        section.images.splice(index, 1);
        saveData();
    }
}

function updateTitle(newTitle) {
    appState.title = newTitle;
    saveData();
}

// Export for other scripts
window.UXData = {
    getState: () => appState,
    loadData,
    saveData,
    resetData,
    updateSection,
    addImageToSection,
    removeImageFromSection,
    updateTitle
};
