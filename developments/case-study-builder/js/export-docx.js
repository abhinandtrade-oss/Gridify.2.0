async function exportDOCX() {
    if (!window.docx) {
        alert("DOCX library not loaded. Please ensure you're connected to the internet.");
        return;
    }
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = window.docx;
    const state = window.UXData.getState();
    const btn = document.getElementById('btnDOCX');

    btn.textContent = 'Generating...';
    btn.classList.add('loading');

    try {
        const docSections = [];

        // Title Page
        docSections.push({
            children: [
                new Paragraph({
                    text: state.title,
                    heading: HeadingLevel.HEADING_1,
                }),
                new Paragraph({
                    text: "UX Case Study",
                    spacing: { before: 200, after: 1200 },
                }),
            ],
        });

        // Content Sections
        for (const section of state.sections) {
            if (section.blocks.length === 0) continue;

            const sectionChildren = [
                new Paragraph({
                    text: section.title,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 400, after: 200 },
                })
            ];

            for (const block of section.blocks) {
                if (block.type === 'text') {
                    sectionChildren.push(
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: block.content,
                                }),
                            ],
                            spacing: { after: 200 },
                        })
                    );
                } else {
                    try {
                        const response = await fetch(block.content);
                        const buffer = await response.arrayBuffer();

                        sectionChildren.push(
                            new Paragraph({
                                children: [
                                    new ImageRun({
                                        data: buffer,
                                        transformation: {
                                            width: 600,
                                            height: 400,
                                        },
                                    }),
                                ],
                                spacing: { after: 200 },
                            })
                        );
                    } catch (e) {
                        console.error('Error adding image to docx:', e);
                    }
                }
            }

            docSections.push({ children: sectionChildren });
        }

        const doc = new Document({
            sections: docSections,
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.title.replace(/\s+/g, '_')}_Case_Study.docx`;
        a.click();
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('DOCX Export failed:', error);
        alert('Failed to generate DOCX. Please check console for details.');
    } finally {
        btn.textContent = 'Download DOCX';
        btn.classList.remove('loading');
    }
}
