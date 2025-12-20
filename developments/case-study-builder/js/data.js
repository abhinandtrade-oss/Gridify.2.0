const STORAGE_KEY = 'ux_case_study_data_v4';

const DEFAULT_SECTIONS = [
    {
        id: 'project-overview',
        title: 'Project Overview',
        blocks: [
            { id: 'b1', type: 'text', content: '', styles: { width: '100%', textAlign: 'left', padding: 0 } }
        ],
        styles: { padding: 0, gap: 20 }
    },
    // ... I'll define the rest programmatically to keep the code concise
];

const MANDATORY_TITLES = [
    'Project Overview', 'Context (Brief)', 'Problem Statement', 'Crafted Solution', 'Timeline',
    'Project Goals', 'Research Part', 'Brainstorming & Ideation', 'Sketches & Wireframes',
    'Iterations', 'Final Designs', 'Design System / Style Guide', 'Prototype', 'User Testing',
    'Conclusion', 'Scope of Improvements', 'What Could Have Been Better?', 'Feedback & Suggestions'
];

let appState = {
    title: 'Untitled Case Study',
    subtitle: 'UX Case Study',
    sections: MANDATORY_TITLES.map(title => ({
        id: title.toLowerCase().replace(/\s+/g, '-'),
        title: title,
        blocks: [],
        styles: { padding: 0, gap: 20 }
    })),
    lastSaved: null
};

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        appState = JSON.parse(saved);
        return true;
    }
    // Migration from v2
    const v2Saved = localStorage.getItem('ux_case_study_data_v2');
    if (v2Saved) {
        const v2Data = JSON.parse(v2Saved);
        appState.title = v2Data.title;
        appState.subtitle = v2Data.subtitle || 'UX Case Study';
        appState.sections = v2Data.sections.map(s => {
            const blocks = [];
            if (s.content) {
                blocks.push({ id: 't-' + Date.now(), type: 'text', content: s.content, styles: { width: '100%', textAlign: s.styles.textAlign || 'left', padding: 0 } });
            }
            s.images.forEach((img, i) => {
                blocks.push({
                    id: 'i-' + Date.now() + i,
                    type: 'image',
                    content: img.src,
                    styles: {
                        width: img.styles.width === 'hug' ? '50%' : '100%',
                        alignment: img.styles.alignment || 'center',
                        cornerRadius: img.styles.cornerRadius || 12,
                        opacity: img.styles.opacity || 100
                    }
                });
            });
            return { id: s.id, title: s.title, blocks, styles: s.styles };
        });
        saveData();
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
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('ux_case_study_data_v2'); // Also clear old versions
        window.location.reload();
    }
}

// Section CRUD
function updateSection(id, updates) {
    const index = appState.sections.findIndex(s => s.id === id);
    if (index !== -1) {
        appState.sections[index] = { ...appState.sections[index], ...updates };
        saveData();
    }
}

function addSection(afterId = null) {
    const newSection = {
        id: 'section-' + Date.now(),
        title: 'New Section',
        blocks: [],
        styles: { padding: 0, gap: 20 }
    };
    if (afterId) {
        const index = appState.sections.findIndex(s => s.id === afterId);
        appState.sections.splice(index + 1, 0, newSection);
    } else {
        appState.sections.push(newSection);
    }
    saveData();
    return newSection;
}

function removeSection(id) {
    appState.sections = appState.sections.filter(s => s.id !== id);
    saveData();
}

function moveSection(id, direction) {
    const index = appState.sections.findIndex(s => s.id === id);
    if (direction === 'up' && index > 0) {
        [appState.sections[index], appState.sections[index - 1]] = [appState.sections[index - 1], appState.sections[index]];
    } else if (direction === 'down' && index < appState.sections.length - 1) {
        [appState.sections[index], appState.sections[index + 1]] = [appState.sections[index + 1], appState.sections[index]];
    }
    saveData();
}

// Block CRUD
function addBlock(sectionId, type, initialContent = '') {
    const section = appState.sections.find(s => s.id === sectionId);
    if (section) {
        const newBlock = {
            id: 'block-' + Date.now() + Math.random().toString(36).substr(2, 5),
            type: type,
            content: initialContent,
            styles: type === 'text'
                ? { width: '100%', textAlign: 'left', padding: 0, color: '#1a1a1a', fontFamily: 'Inter' }
                : { width: '100%', alignment: 'center', cornerRadius: 12, opacity: 100 }
        };
        section.blocks.push(newBlock);
        saveData();
        return newBlock;
    }
}

function updateBlock(sectionId, blockId, updates) {
    const section = appState.sections.find(s => s.id === sectionId);
    if (section) {
        const block = section.blocks.find(b => b.id === blockId);
        if (block) {
            if (updates.styles) block.styles = { ...block.styles, ...updates.styles };
            if (updates.content !== undefined) block.content = updates.content;
            saveData();
        }
    }
}

function removeBlock(sectionId, blockId) {
    const section = appState.sections.find(s => s.id === sectionId);
    if (section) {
        section.blocks = section.blocks.filter(b => b.id !== blockId);
        saveData();
    }
}

function moveBlock(sectionId, blockId, direction) {
    const section = appState.sections.find(s => s.id === sectionId);
    if (section) {
        const index = section.blocks.findIndex(b => b.id === blockId);
        if (direction === 'up' && index > 0) {
            [section.blocks[index], section.blocks[index - 1]] = [section.blocks[index - 1], section.blocks[index]];
        } else if (direction === 'down' && index < section.blocks.length - 1) {
            [section.blocks[index], section.blocks[index + 1]] = [section.blocks[index + 1], section.blocks[index]];
        }
        saveData();
    }
}

function updateTitle(newTitle) {
    appState.title = newTitle;
    saveData();
}

function updateSubtitle(newSubtitle) {
    appState.subtitle = newSubtitle;
    saveData();
}

window.UXData = {
    getState: () => appState,
    loadData,
    saveData,
    resetData,
    updateSection,
    addSection,
    removeSection,
    moveSection,
    addBlock,
    updateBlock,
    removeBlock,
    moveBlock,
    updateTitle,
    updateSubtitle
};
