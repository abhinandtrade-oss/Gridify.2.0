function exportFigma() {
    const data = window.UXData;
    const state = data.getState();
    const btn = document.getElementById('btnFigma');

    // Create selection UI or just provide options
    const choice = confirm("Choose Export Method:\n\nOK: Download JSON (for plugins)\nCancel: Copy Content to Clipboard");

    if (choice) {
        // Download JSON
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.title.replace(/\s+/g, '_')}_Case_Study.json`;
        a.click();
        URL.revokeObjectURL(url);
    } else {
        // Copy to Clipboard
        let clipboardText = `PROMPT: UX CASE STUDY CONTENT\nTITLE: ${state.title}\n\n`;
        state.sections.forEach(section => {
            if (section.content || section.images.length > 0) {
                clipboardText += `--- ${section.title.toUpperCase()} ---\n${section.content}\n\n`;
            }
        });

        navigator.clipboard.writeText(clipboardText).then(() => {
            btn.textContent = 'Copied to Clipboard!';
            setTimeout(() => btn.textContent = 'Export for Figma', 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy content. Please allow clipboard permissions.');
        });
    }
}
