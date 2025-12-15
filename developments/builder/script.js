document.addEventListener('DOMContentLoaded', () => {

    /* --- HELPERS --- */
    const setText = (selector, val) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = val;
    };

    // Safely get value or empty string
    const getValue = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.value : '';
    };

    /* --- 1. STATIC FIELDS LISTENER --- */
    // Map Input ID -> Preview Selector
    const staticFields = {
        'fullName': ['.r-name', '.r-name-sign'],
        'jobTitle': '.r-title',
        'email': '.r-email',
        'phone': '.r-phone',
        'location': '.r-location',
        'linkedin': '.r-linkedin',
        'website': '.r-website',
        'nationality': '.r-nationality',
        'photo': '#rPhoto', // Special handling
        // Profile Meta
        'industry': '.r-industry',
        'totalExp': '.r-total-exp',
        'currentRole': '.r-role',
        'geoPref': '.r-geo',
        // Text Areas
        'summary': '.r-summary-text',
        'certifications': '.r-certs-text',
        'hobbies': '.r-hobbies-text',
        'declaration': '.r-declaration-text',
        // Declaration Meta
        'declDate': '.r-decl-date',
        'declPlace': '.r-decl-place'
    };

    const attachStaticListeners = () => {
        Object.keys(staticFields).forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;

            input.addEventListener('input', () => {
                const targets = staticFields[id];
                const val = input.value;

                if (id === 'photo') {
                    const img = document.querySelector(targets);
                    const container = document.getElementById('rPhotoContainer');
                    if (img && container) {
                        img.src = val;
                        container.style.display = val ? 'block' : 'none';
                        // Adjust header alignment if needed
                        document.querySelector('.r-header-content').style.textAlign = val ? 'left' : 'center';
                        document.querySelector('.r-name').style.textAlign = val ? 'left' : 'center';
                        document.querySelector('.r-title').style.textAlign = val ? 'left' : 'center';
                        document.querySelector('.r-contact-info').style.textAlign = val ? 'left' : 'center';
                        document.querySelector('.r-profile-meta').style.textAlign = val ? 'left' : 'center';
                    }
                } else if (Array.isArray(targets)) {
                    targets.forEach(t => setText(t, val));
                } else {
                    setText(targets, val);
                }

                checkVisibility();
            });
        });
    };

    /* --- 2. DYNAMIC LIST MANAGER --- */
    // Generic function to handle Add/Remove/Update of list items
    const setupDynamicSection = (containerId, buttonId, templateId, renderCallback) => {
        const container = document.getElementById(containerId);
        const button = document.getElementById(buttonId);
        const template = document.getElementById(templateId);

        if (!container || !button || !template) return;

        const addItem = () => {
            const clone = template.content.cloneNode(true);
            container.appendChild(clone);
            const newItem = container.lastElementChild;

            // Listeners for inputs
            newItem.querySelectorAll('input, textarea, select').forEach(inp => {
                inp.addEventListener('input', renderCallback);
            });
            // Remove button
            newItem.querySelector('.remove-btn').addEventListener('click', () => {
                newItem.remove();
                renderCallback();
            });

            renderCallback(); // Initial empty render/check
        };

        button.addEventListener('click', addItem);
    };

    /* --- 3. RENDER FUNCTIONS --- */

    // Skills: Output as "Skill, Skill, Skill" (Comma Separated List)
    const renderSkills = () => {
        const container = document.getElementById('skillsContainer');
        const output = document.getElementById('r-skills-list');
        const items = container.querySelectorAll('.dynamic-item');
        const allSkills = [];

        items.forEach(item => {
            const name = item.querySelector('.skill-name').value.trim();
            const level = item.querySelector('.skill-level').value;

            if (name) {
                // Format: "Name (Level)" or just "Name"
                const text = level ? `${name} (${level})` : name;
                allSkills.push(text);
            }
        });

        // Build HTML: Simple flat list
        // output.innerHTML = allSkills.join(', '); 
        // Better for wrapping: create spans or just text? Text is fine.
        output.textContent = allSkills.join(', ');

        checkVisibility();
    };

    // Experience
    const renderExperience = () => {
        const container = document.getElementById('experienceContainer');
        const output = document.getElementById('r-experience-list');
        output.innerHTML = '';

        container.querySelectorAll('.dynamic-item').forEach(item => {
            const title = item.querySelector('.exp-title').value;
            const company = item.querySelector('.exp-company').value;
            const dept = item.querySelector('.exp-dept').value;
            const start = item.querySelector('.exp-start').value;
            const end = item.querySelector('.exp-end').value;
            const loc = item.querySelector('.exp-loc').value;
            const type = item.querySelector('.exp-type').value;
            const desc = item.querySelector('.exp-desc').value; // Bullets expected
            const tech = item.querySelector('.exp-tech').value;

            if (title || company) {
                const div = document.createElement('div');
                div.className = 'r-item-block';
                // Layout: Title (Bold) ......... Date (Right)
                //         Company | Dept, Location (Type)
                //         Desc
                //         Tech
                const subDetails = [company, dept, loc, type].filter(x => x).join(', ');

                div.innerHTML = `
                    <div class="r-row-split">
                        <span class="r-bold">${title}</span>
                        <span class="r-date">${start} ${(start && end) ? '-' : ''} ${end}</span>
                    </div>
                    <div class="r-row-split r-sub">
                        <span>${subDetails}</span>
                    </div>
                    ${desc ? `<div class="r-desc whitespace-pre">${desc}</div>` : ''}
                    ${tech ? `<div class="r-tech"><strong>Tech:</strong> ${tech}</div>` : ''}
                 `;
                output.appendChild(div);
            }
        });
        checkVisibility();
    };

    // Education
    const renderEducation = () => {
        const container = document.getElementById('educationContainer');
        const output = document.getElementById('r-education-list');
        output.innerHTML = '';

        container.querySelectorAll('.dynamic-item').forEach(item => {
            const degree = item.querySelector('.edu-degree').value;
            const school = item.querySelector('.edu-school').value;
            // Field of study removed
            const grade = item.querySelector('.edu-grade').value;
            const gradeType = item.querySelector('.edu-grade-type').value;
            const start = item.querySelector('.edu-start').value;
            const end = item.querySelector('.edu-end').value;
            const loc = item.querySelector('.edu-loc').value;

            if (degree || school) {
                // Grade formatting
                let gradeText = '';
                if (grade) {
                    if (gradeType === 'percent') {
                        gradeText = `Grade: ${grade}%`;
                    } else if (gradeType === 'grade') {
                        gradeText = `Grade: ${grade}`;
                    } else {
                        gradeText = `CGPA: ${grade}`;
                    }
                }

                const div = document.createElement('div');
                div.className = 'r-item-block';
                div.innerHTML = `
                    <div class="r-row-split">
                        <span class="r-bold">${degree}</span>
                        <span class="r-date">${start} - ${end}</span>
                    </div>
                    <div class="r-row-split r-sub">
                        <span>${school}${loc ? `, ${loc}` : ''}</span>
                        ${gradeText ? `<span style="font-weight:500;">${gradeText}</span>` : '<span></span>'}
                    </div>
                `;
                output.appendChild(div);
            }
        });
        checkVisibility();
    };

    // Projects
    const renderProjects = () => {
        const container = document.getElementById('projectsContainer');
        const output = document.getElementById('r-projects-list');
        output.innerHTML = '';

        container.querySelectorAll('.dynamic-item').forEach(item => {
            const title = item.querySelector('.proj-name').value;
            const role = item.querySelector('.proj-role').value;
            const link = item.querySelector('.proj-link').value;
            const tech = item.querySelector('.proj-tech').value;
            const desc = item.querySelector('.proj-desc').value;

            if (title || desc) {
                const div = document.createElement('div');
                div.className = 'r-item-block';
                div.innerHTML = `
                    <div class="r-row-split">
                        <span class="r-bold">${title} ${role ? `| ${role}` : ''}</span>
                        ${link ? `<a href="${link}" target="_blank" class="r-link">${link}</a>` : ''}
                    </div>
                    ${desc ? `<div class="r-desc whitespace-pre">${desc}</div>` : ''}
                    ${tech ? `<div class="r-tech"><strong>Tech:</strong> ${tech}</div>` : ''}
                 `;
                output.appendChild(div);
            }
        });
        checkVisibility();
    };

    // Achievements
    const renderAchievements = () => {
        const container = document.getElementById('achievementsContainer');
        const output = document.getElementById('r-achievements-list');
        output.innerHTML = '';

        container.querySelectorAll('.dynamic-item').forEach(item => {
            const title = item.querySelector('.ach-title').value;
            const year = item.querySelector('.ach-year').value;

            if (title) {
                const li = document.createElement('li');
                li.innerHTML = `${title} ${year ? `(${year})` : ''}`;
                output.appendChild(li);
            }
        });
        checkVisibility();
    };

    // Languages
    const renderLanguages = () => {
        const container = document.getElementById('languagesContainer');
        const output = document.getElementById('r-languages-list');
        const items = [];

        container.querySelectorAll('.dynamic-item').forEach(item => {
            const name = item.querySelector('.lang-name').value;
            const level = item.querySelector('.lang-level').value;
            if (name) {
                items.push(level ? `${name} (${level})` : name);
            }
        });
        output.textContent = items.join(', ');
        checkVisibility();
    };

    // References
    const renderReferences = () => {
        const displayMode = document.getElementById('refDisplay').value;
        const output = document.getElementById('r-ref-content');
        output.innerHTML = '';

        if (displayMode === 'request') {
            output.innerHTML = '<em>References available upon request.</em>';
        } else {
            const container = document.getElementById('referencesContainer');

            // Use 2-col grid
            const grid = document.createElement('div');
            grid.className = 'r-ref-grid';

            container.querySelectorAll('.dynamic-item').forEach(item => {
                const name = item.querySelector('.ref-name').value;
                const role = item.querySelector('.ref-role').value;
                const org = item.querySelector('.ref-org').value;
                const contact = item.querySelector('.ref-contact').value;

                if (name) {
                    const cell = document.createElement('div');
                    cell.innerHTML = `
                        <div class="r-bold">${name}</div>
                        <div>${role}${org ? `, ${org}` : ''}</div>
                        <div class="r-sm">${contact}</div>
                     `;
                    grid.appendChild(cell);
                }
            });
            output.appendChild(grid);
        }
        checkVisibility();
    };

    /* --- 4. CONFIG & TOGGLES --- */

    // Check Visibility of Sections
    const checkVisibility = () => {
        // Map IDs to their Data Source (logic)

        // Simple Text Sections
        ['secCerts', 'secHobbies', 'secDeclaration'].forEach(id => {
            const sec = document.getElementById(id);
            // find content: p tag inside or similar
            const text = sec.querySelector('p')?.textContent.trim();
            if (sec) sec.style.display = text ? 'block' : 'none';
        });

        // Dynamic List Sections
        const listMap = {
            'secSkills': 'r-skills-list',
            'secExperience': 'r-experience-list',
            'secEducation': 'r-education-list',
            'secProjects': 'r-projects-list',
            'secAchievements': 'r-achievements-list',
            'secLanguages': 'r-languages-list', // content is text but logic same
            'secReferences': 'r-references-list'
        };

        Object.keys(listMap).forEach(secId => {
            const sec = document.getElementById(secId);
            const content = document.getElementById(listMap[secId]);
            if (sec && content) {
                const hasContent = content.children.length > 0 || content.textContent.trim().length > 0;
                sec.style.display = hasContent ? 'block' : 'none';
            }
        });

        // Summary vs Objective
        const summaryType = document.getElementById('summaryType').value;
        const sumSec = document.getElementById('secSummary');
        const sumText = document.querySelector('.r-summary-text').textContent;
        document.getElementById('rSummaryTitle').textContent = summaryType === 'objective' ? 'Career Objective' : 'Professional Summary';
        sumSec.style.display = sumText ? 'block' : 'none';

        // Profile Meta
        const meta = document.getElementById('rProfileMeta');
        const hasMeta = ['industry', 'totalExp', 'currentRole', 'geoPref'].some(id => getValue('#' + id));
        meta.style.display = hasMeta ? 'block' : 'none';

        // Declaration Signature Block
        // Only show if declaration text exists
        // (already handled by simple text section logic above mostly, but signature block needs care?)
        // The helper logic covers p text content.
    };

    // Event Listeners for Configs
    document.getElementById('summaryType').addEventListener('change', checkVisibility);
    document.getElementById('refDisplay').addEventListener('change', renderReferences);

    // CV Type (Ordering)
    document.getElementById('cvType').addEventListener('change', () => {
        const type = document.getElementById('cvType').value;
        const body = document.getElementById('resumeBody');
        const exc = document.getElementById('secExperience');
        const edu = document.getElementById('secEducation');

        if (type === 'fresher' || type === 'academic') {
            body.insertBefore(edu, exc);
        } else {
            body.insertBefore(exc, edu);
        }
    });

    /* --- 6. MOBILE TABS --- */
    const tabEdit = document.getElementById('tabEdit');
    const tabPreview = document.getElementById('tabPreview');
    const appContainer = document.querySelector('.app-container');

    if (tabEdit && tabPreview) {
        tabEdit.addEventListener('click', () => {
            tabEdit.classList.add('active');
            tabPreview.classList.remove('active');
            appContainer.classList.remove('show-preview');
        });

        tabPreview.addEventListener('click', () => {
            tabEdit.classList.remove('active');
            tabPreview.classList.add('active');
            appContainer.classList.add('show-preview');
        });
    }

    /* --- 7. VALIDATION --- */
    const validateResume = () => {
        const errors = [];

        // 1. Personal Info
        if (!getValue('#fullName')) errors.push("Full Name is missing.");
        if (!getValue('#jobTitle')) errors.push("Target Job Title is missing.");
        if (!getValue('#email')) errors.push("Email is missing.");
        if (!getValue('#phone')) errors.push("Phone is missing.");
        if (!getValue('#location')) errors.push("Location is missing.");

        // 2. Summary
        if (!getValue('#summary')) errors.push("Summary is missing.");

        // 3. Skills (At least one)
        const skillItems = document.querySelectorAll('#skillsContainer .dynamic-item');
        let hasSkill = false;
        skillItems.forEach(i => {
            if (i.querySelector('.skill-name').value.trim()) hasSkill = true;
        });
        if (!hasSkill) errors.push("At least one Skill is required.");

        // 4. Experience OR Project (At least one total)
        const expItems = document.querySelectorAll('#experienceContainer .dynamic-item');
        const projItems = document.querySelectorAll('#projectsContainer .dynamic-item');
        let hasExp = false;
        let hasProj = false;

        expItems.forEach(i => {
            if (i.querySelector('.exp-title').value.trim()) hasExp = true;
        });
        projItems.forEach(i => {
            if (i.querySelector('.proj-name').value.trim()) hasProj = true;
        });

        if (!hasExp && !hasProj) errors.push("At least one Experience OR Project is required.");

        // 5. Education (At least one)
        const eduItems = document.querySelectorAll('#educationContainer .dynamic-item');
        let hasEdu = false;
        eduItems.forEach(i => {
            if (i.querySelector('.edu-degree').value.trim()) hasEdu = true;
        });
        if (!hasEdu) errors.push("Education is required.");

        // Display Status
        const statusDiv = document.getElementById('validationStatus');
        if (statusDiv) {
            if (errors.length > 0) {
                statusDiv.textContent = `⚠️ Missing: ${errors.length} fields`;
                statusDiv.title = errors.join('\n');
                statusDiv.style.color = '#e74c3c';
            } else {
                statusDiv.textContent = "✅ Ready";
                statusDiv.style.color = '#27ae60';
            }
        }

        return errors.length === 0;
    };

    // Attach validation to inputs
    document.getElementById('resumeForm').addEventListener('input', validateResume);
    // Initial check
    setTimeout(validateResume, 1000);

    /* --- 5. INIT --- */
    attachStaticListeners();
    setupDynamicSection('skillsContainer', 'addSkill', 'skillTemplate', () => { renderSkills(); validateResume(); });
    setupDynamicSection('experienceContainer', 'addExperience', 'experienceTemplate', () => { renderExperience(); validateResume(); });
    setupDynamicSection('educationContainer', 'addEducation', 'educationTemplate', () => { renderEducation(); validateResume(); });
    setupDynamicSection('projectsContainer', 'addProject', 'projectTemplate', () => { renderProjects(); validateResume(); });
    setupDynamicSection('achievementsContainer', 'addAchievement', 'achievementTemplate', renderAchievements);
    setupDynamicSection('languagesContainer', 'addLanguage', 'languageTemplate', renderLanguages);
    setupDynamicSection('referencesContainer', 'addReference', 'referenceTemplate', renderReferences);

    // Ref Toggle trigger initially
    renderReferences();

    // AI Stub
    document.getElementById('aiEnhanceSummary').addEventListener('click', (e) => {
        e.target.innerText = 'Analyzing...';
        setTimeout(() => {
            alert('AI Suggestion: Keywords optimized based on job description.');
            e.target.innerText = '✨ AI Enhance';
        }, 800);
    });

});
