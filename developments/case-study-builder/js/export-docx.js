async function exportDOCX() {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } = window.docx;
    const state = window.UXData.getState();
    const btn = document.getElementById('btnDOCX');

    btn.textContent = 'Generating...';
    btn.classList.add('loading');

    try {
        const sections = [];

        // Title Page
        sections.push({
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
            if (section.content || section.images.length > 0) {
                const sectionChildren = [
                    new Paragraph({
                        text: section.title,
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 400, after: 200 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: section.content,
                            }),
                        ],
                        spacing: { after: 200 },
                    }),
                ];

                // Images
                for (const imgData of section.images) {
                    try {
                        const response = await fetch(imgData);
                        const buffer = await response.arrayBuffer();

                        // Default size (approx width 600px)
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

                sections.push({ children: sectionChildren });
            }
        }

        const doc = new Document({
            sections: sections,
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
