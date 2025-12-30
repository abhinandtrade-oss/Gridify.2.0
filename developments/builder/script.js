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
                    const preview = document.getElementById('resumePreview');

                    if (img && container) {
                        img.src = val;
                        container.style.display = val ? 'block' : 'none';

                        if (preview) {
                            if (val) preview.classList.add('has-photo');
                            else preview.classList.remove('has-photo');
                        }

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

    // Template Selector
    document.getElementById('resumeTemplate').addEventListener('change', () => {
        const template = document.getElementById('resumeTemplate').value;
        const preview = document.getElementById('resumePreview');

        // Remove all theme classes first
        const themes = [
            'theme-default', 'theme-modern-blue', 'theme-minimalist',
            'theme-elegant-purple', 'theme-professional-green', 'theme-classic-purple'
        ];
        themes.forEach(t => preview.classList.remove(t));

        // Add selected theme
        preview.classList.add(template);

        // Re-trigger layout-specific logic if needed
        checkVisibility();
    });

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

        // 4. Experience OR Project (Optional)
        // No validation check needed as these are now optional.

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

    /* --- 8. GOOGLE SHEETS INTEGRATION --- */
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1YjSVMjZYuouVG62jeCqaIUzyvXa_YNPYQQ2f_WegU0hVqzRWMDrnDICfjev-i69Ksw/exec';

    // Helper to get all dynamic values
    const getDynamicValues = (containerId, fieldMap) => {
        const container = document.getElementById(containerId);
        if (!container) return [];
        const items = [];
        container.querySelectorAll('.dynamic-item').forEach(item => {
            const obj = {};
            Object.keys(fieldMap).forEach(key => {
                const el = item.querySelector(fieldMap[key]);
                obj[key] = el ? el.value : '';
            });
            items.push(obj);
        });
        return items;
    };

    const collectData = () => {
        // Collect skills
        const skillNodes = document.querySelectorAll('#skillsContainer .skill-name');
        const skillsList = Array.from(skillNodes).map(input => input.value).filter(val => val.trim() !== '').join(', ');

        return {
            type: 'builder',
            // Personal & Profile
            fullName: getValue('#fullName'),
            jobTitle: getValue('#jobTitle'),
            // Identity Email (Login User)
            loginEmail: (sessionStorage.getItem('gridify_admin_session') ? JSON.parse(sessionStorage.getItem('gridify_admin_session')).username : ''),
            // Resume Contact Email (Form Input)
            contactEmail: getValue('#email'),
            photo: getValue('#photo'), // Photo URL
            phone: getValue('#phone'),
            location: getValue('#location'),
            linkedin: getValue('#linkedin'),
            website: getValue('#website'),
            nationality: getValue('#nationality'),
            // Meta
            industry: getValue('#industry'),
            totalExp: getValue('#totalExp'), // ID check: logic used .r-total-exp but input id?
            // Checking input IDs from staticFields map: 
            // 'totalExp': '.r-total-exp' is target. Input ID is same usually? 
            // Wait, previous code used `getValue('#totalExp')`? No, staticFields keys are IDs.
            // Let's use the known IDs from staticFields keys.
            currentRole: getValue('#r-role'), // wait, key in staticFields is 'currentRole', selector is '.r-role'. ID is likely 'currentRole' or similar?
            geoPref: getValue('#geoPref'), // Assuming IDs match keys if not standard

            // Text Areas
            summary: getValue('#summary'),

            // Dynamic Lists (Full Objects)
            skills: skillsList,
            experience: getDynamicValues('experienceContainer', {
                title: '.exp-title', company: '.exp-company', dept: '.exp-dept',
                start: '.exp-start', end: '.exp-end', loc: '.exp-loc',
                type: '.exp-type', desc: '.exp-desc', tech: '.exp-tech'
            }),
            education: getDynamicValues('educationContainer', {
                degree: '.edu-degree', school: '.edu-school',
                grade: '.edu-grade', gradeType: '.edu-grade-type',
                start: '.edu-start', end: '.edu-end', loc: '.edu-loc'
            }),
            projects: getDynamicValues('projectsContainer', {
                title: '.proj-name', role: '.proj-role', link: '.proj-link',
                tech: '.proj-tech', desc: '.proj-desc'
            }),
            achievements: getDynamicValues('achievementsContainer', {
                title: '.ach-title', year: '.ach-year'
            }),
            certifications: getValue('#certifications'), // Text area
            languages: getDynamicValues('languagesContainer', {
                name: '.lang-name', level: '.lang-level'
            }),
            hobbies: getValue('#hobbies'), // Text area
            references: getDynamicValues('referencesContainer', {
                name: '.ref-name', role: '.ref-role', org: '.ref-org', contact: '.ref-contact'
            }),
            declaration: {
                text: getValue('#declaration'),
                date: getValue('#declDate'),
                place: getValue('#declPlace')
            }
        };
    };

    const sendToSheet = (data) => {
        // Silent save, mostly
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            keepalive: true,
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(data)
        })
            .then(response => response.json())
            .then(result => {
                if (result.result !== 'success') {
                    console.error('Sheet Error:', result);
                } else {
                    console.log('Auto-saved to Sheets');
                }
            })
            .catch(error => {
                console.error('Network Error during auto-save:', error);
            });
    };

    const downloadBtn = document.getElementById('downloadPdfBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
            let isValid = validateResume();

            if (isValid) {
                const data = collectData();
                sendToSheet(data);

                // Small delay to ensure network request starts before print dialog freezes context
                setTimeout(() => {
                    window.print();
                }, 500);
            } else {
                // If invalid, just print? Or alert?
                // Logic says just print, but maybe show alert?
                alert('Resume has missing fields. Saving skipped, but you can still print.');
                window.print();
            }
        });
    }


    /* --- 9. DATA LOADING --- */
    const loadUserData = () => {
        const sessionData = sessionStorage.getItem('gridify_admin_session');
        if (!sessionData) return;

        let session;
        try { session = JSON.parse(sessionData); } catch (e) { return; }

        const email = session.username; // For users, username is email
        if (!email) return;

        // PRE-FILL EMAIL IMMEDIATELY to ensure saving consistency
        const emailInput = document.querySelector('#email');
        if (emailInput) {
            emailInput.value = email;
            // dispatch input event?
            emailInput.dispatchEvent(new Event('input'));
            // Optional: Make it read-only to prevent user changing it and losing data link?
            // emailInput.readOnly = true; 
        }

        console.log("Fetching data for:", email);

        // Loader
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'data-loader-overlay';
        loadingDiv.innerHTML = `
            <div class="lux-spinner"></div>
            <div class="loader-text">Syncing with Cloud...</div>
        `;
        document.body.appendChild(loadingDiv);

        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify({ action: 'fetch_data', email: email, sheetName: 'builder' })
        })
            .then(res => res.json())
            .then(resp => {
                if (resp.result === 'success' && resp.data) {
                    populateBuilder(resp.data);
                    // Optional: remove this alert later
                    // alert("Data loaded successfully!");
                } else {
                    console.log("No existing data found or error:", resp);
                    // alert("No saved data found for this email.");
                }
            })
            .catch(err => {
                console.error("Load Error:", err);
                alert("Failed to load data. Please check connection.");
            })
            .finally(() => {
                if (document.body.contains(loadingDiv)) document.body.removeChild(loadingDiv);
            });
    };

    const populateBuilder = (data) => {
        const setVal = (sel, val) => {
            const el = document.querySelector(sel);
            if (el) { el.value = val !== undefined ? val : ''; el.dispatchEvent(new Event('input')); }
        };

        setVal('#fullName', data.fullName);
        setVal('#jobTitle', data.jobTitle);
        setVal('#email', data.email);
        setVal('#photo', data.photo);
        setVal('#phone', data.phone);
        setVal('#location', data.location);
        setVal('#linkedin', data.linkedin);
        setVal('#website', data.website);
        setVal('#nationality', data.nationality);
        setVal('#industry', data.industry);
        setVal('#totalExp', data.totalExp);
        setVal('#currentRole', data.currentRole);
        setVal('#geoPref', data.geoPref);
        setVal('#summary', data.summary);
        setVal('#certifications', data.certifications);
        setVal('#hobbies', data.hobbies);
        if (data.declaration) {
            setVal('#declaration', data.declaration.text);
            setVal('#declDate', data.declaration.date);
            setVal('#declPlace', data.declaration.place);
        }

        const populateList = (btnId, containerId, items, mapper) => {
            const btn = document.getElementById(btnId);
            const container = document.getElementById(containerId);
            if (!btn || !container) return;
            container.innerHTML = '';
            if (!items || !Array.isArray(items)) return;
            items.forEach(item => {
                btn.click();
                const newItem = container.lastElementChild;
                if (newItem) mapper(newItem, item);
            });
        };

        if (data.skills) {
            const skillArr = data.skills.split(',').map(s => {
                s = s.trim();
                let name = s, level = '';
                if (s.includes('(') && s.endsWith(')')) {
                    const idx = s.lastIndexOf('(');
                    name = s.substring(0, idx).trim();
                    level = s.substring(idx + 1, s.length - 1).trim();
                }
                return { name, level };
            });
            populateList('addSkill', 'skillsContainer', skillArr, (el, item) => {
                el.querySelector('.skill-name').value = item.name;
                if (item.level) el.querySelector('.skill-level').value = item.level;
                el.querySelector('.skill-name').dispatchEvent(new Event('input'));
            });
        }

        populateList('addExperience', 'experienceContainer', data.experience, (el, item) => {
            el.querySelector('.exp-title').value = item.title || '';
            el.querySelector('.exp-company').value = item.company || '';
            el.querySelector('.exp-dept').value = item.dept || '';
            el.querySelector('.exp-start').value = item.start || '';
            el.querySelector('.exp-end').value = item.end || '';
            el.querySelector('.exp-loc').value = item.loc || '';
            el.querySelector('.exp-type').value = item.type || '';
            el.querySelector('.exp-desc').value = item.desc || '';
            el.querySelector('.exp-tech').value = item.tech || '';
            el.querySelector('.exp-title').dispatchEvent(new Event('input'));
        });

        populateList('addEducation', 'educationContainer', data.education, (el, item) => {
            el.querySelector('.edu-degree').value = item.degree || '';
            el.querySelector('.edu-school').value = item.school || '';
            el.querySelector('.edu-grade').value = item.grade || '';
            el.querySelector('.edu-grade-type').value = item.gradeType || '';
            el.querySelector('.edu-start').value = item.start || '';
            el.querySelector('.edu-end').value = item.end || '';
            el.querySelector('.edu-loc').value = item.loc || '';
            el.querySelector('.edu-degree').dispatchEvent(new Event('input'));
        });

        populateList('addProject', 'projectsContainer', data.projects, (el, item) => {
            el.querySelector('.proj-name').value = item.title || '';
            el.querySelector('.proj-role').value = item.role || '';
            el.querySelector('.proj-link').value = item.link || '';
            el.querySelector('.proj-tech').value = item.tech || '';
            el.querySelector('.proj-desc').value = item.desc || '';
            el.querySelector('.proj-name').dispatchEvent(new Event('input'));
        });

        populateList('addAchievement', 'achievementsContainer', data.achievements, (el, item) => {
            el.querySelector('.ach-title').value = item.title || '';
            el.querySelector('.ach-year').value = item.year || '';
            el.querySelector('.ach-title').dispatchEvent(new Event('input'));
        });

        populateList('addLanguage', 'languagesContainer', data.languages, (el, item) => {
            el.querySelector('.lang-name').value = item.name || '';
            el.querySelector('.lang-level').value = item.level || '';
            el.querySelector('.lang-name').dispatchEvent(new Event('input'));
        });

        populateList('addReference', 'referencesContainer', data.references, (el, item) => {
            el.querySelector('.ref-name').value = item.name || '';
            el.querySelector('.ref-role').value = item.role || '';
            el.querySelector('.ref-org').value = item.org || '';
            el.querySelector('.ref-contact').value = item.contact || '';
            el.querySelector('.ref-name').dispatchEvent(new Event('input'));
        });
    };

    /* --- 10. IMAGE UPLOAD TOOL --- */
    const UPLOAD_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1CRFm9T8TIpnLuv_Wihw3gfVhV53fp1KIL7WtOlcd4U5tVTBwFQwmynH-zqI2_rax/exec';

    const tabTools = document.getElementById('tabTools');
    const showToolsBtn = document.getElementById('showToolsBtn');
    const backToEditorBtn = document.getElementById('backToEditorBtn');
    const uploadShortcutBtn = document.getElementById('uploadShortcutBtn');

    // Elements
    const resumeForm = document.getElementById('resumeForm');
    const uploadSection = document.getElementById('uploadSection');
    const editorPanel = document.getElementById('editorPanel');

    // Toggle Functions
    const showUploadInterface = () => {
        resumeForm.style.display = 'none';
        uploadSection.style.display = 'block';

        // Mobile Tab State
        if (tabTools) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            tabTools.classList.add('active');
        }
    };

    const showEditorInterface = () => {
        resumeForm.style.display = 'block';
        uploadSection.style.display = 'none';

        // Mobile Tab State
        if (tabTools && tabEdit) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            tabEdit.classList.add('active');
        }
    };

    // Listeners
    let isShortcutUpload = false;

    if (showToolsBtn) {
        showToolsBtn.addEventListener('click', () => {
            isShortcutUpload = false;
            showUploadInterface();
        });
    }

    if (uploadShortcutBtn) {
        uploadShortcutBtn.addEventListener('click', () => {
            isShortcutUpload = true;
            showUploadInterface();
        });
    }

    if (backToEditorBtn) backToEditorBtn.addEventListener('click', showEditorInterface);

    // Mobile Tab Logic Update
    if (tabTools) {
        tabTools.addEventListener('click', () => {
            isShortcutUpload = false; // Tab always acts like Tools button
            // Switch to Editor Panel view first (if in Preview)
            appContainer.classList.remove('show-preview');
            if (tabPreview) tabPreview.classList.remove('active');

            showUploadInterface();
        });
    }

    // Also update existing tabs to switch back to form
    if (tabEdit) {
        // Intercept existing click to ensure form is shown
        const originalClick = tabEdit.onclick; // not using onclick property, using addEventListener.
        // We add a new listener. Events fire in order.
        tabEdit.addEventListener('click', () => {
            showEditorInterface();
        });
    }


    /* --- Upload Logic --- */
    const dropZone = document.getElementById('dropZone');
    const imageInput = document.getElementById('imageInput');
    const uploadPreview = document.getElementById('uploadPreview');
    const previewImg = document.getElementById('previewImg');
    const confirmUploadBtn = document.getElementById('confirmUploadBtn');
    const cancelUploadBtn = document.getElementById('cancelUploadBtn');
    const uploadLoader = document.getElementById('uploadLoader');
    const uploadResult = document.getElementById('uploadResult');
    const resultUrl = document.getElementById('resultUrl');
    const copyUrlBtn = document.getElementById('copyUrlBtn');
    const uploadAnotherBtn = document.getElementById('uploadAnotherBtn');

    let currentFile = null;

    // Drag & Drop
    if (dropZone) {
        dropZone.addEventListener('click', () => imageInput.click());

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--accent-color)';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-dark)';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-dark)';
            const files = e.dataTransfer.files;
            if (files.length) handleFileSelect(files[0]);
        });
    }

    if (imageInput) {
        imageInput.addEventListener('change', (e) => {
            if (e.target.files.length) handleFileSelect(e.target.files[0]);
        });
    }

    const handleFileSelect = (file) => {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('File is too large. Max 5MB.');
            return;
        }

        currentFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            dropZone.style.display = 'none';
            uploadPreview.style.display = 'block';
            uploadResult.style.display = 'none';
        };
        reader.readAsDataURL(file);
    };

    if (cancelUploadBtn) {
        cancelUploadBtn.addEventListener('click', () => {
            currentFile = null;
            previewImg.src = '';
            dropZone.style.display = 'block';
            uploadPreview.style.display = 'none';
            imageInput.value = ''; // Reset input
        });
    }

    if (uploadAnotherBtn) {
        uploadAnotherBtn.addEventListener('click', () => {
            currentFile = null;
            previewImg.src = '';
            dropZone.style.display = 'block';
            uploadPreview.style.display = 'none';
            uploadResult.style.display = 'none';
            imageInput.value = ''; // Reset input
        });
    }

    if (confirmUploadBtn) {
        confirmUploadBtn.addEventListener('click', () => {
            if (!currentFile) return;

            uploadPreview.style.display = 'none';
            uploadLoader.style.display = 'block';

            // Get Email
            const sessionData = sessionStorage.getItem('gridify_admin_session');
            let userEmail = 'Anonymous';
            if (sessionData) {
                try {
                    userEmail = JSON.parse(sessionData).username || 'Anonymous';
                } catch (e) { }
            }

            const reader = new FileReader();
            reader.readAsDataURL(currentFile);
            reader.onload = function () {
                const base64Data = reader.result.split(',')[1]; // Remove header
                const payload = {
                    image: base64Data,
                    mimeType: currentFile.type,
                    userEmail: userEmail
                };

                fetch(UPLOAD_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                })
                    .then(res => res.json())
                    .then(data => {
                        uploadLoader.style.display = 'none';
                        if (data.result === 'success') {
                            uploadResult.style.display = 'block';
                            resultUrl.value = data.url;

                            // AUTO-FILL LOGIC
                            const photoInput = document.getElementById('photo');
                            if (photoInput) {
                                photoInput.value = data.url;
                                photoInput.dispatchEvent(new Event('input'));
                                // Optional: Alert user visually
                                const resultLabel = uploadResult.querySelector('label');
                                if (resultLabel) resultLabel.textContent = "Image URL (Auto-applied to Resume):";
                            }

                            // Conditional Redirect
                            if (isShortcutUpload) {
                                setTimeout(() => {
                                    showEditorInterface();
                                }, 1000); // 1s delay to show success state
                            }

                        } else {
                            alert('Upload Failed: ' + data.message);
                            // Show retry
                            uploadPreview.style.display = 'block';
                        }
                    })
                    .catch(err => {
                        uploadLoader.style.display = 'none';
                        alert('Network Error: ' + err.message);
                        uploadPreview.style.display = 'block';
                    });
            };
        });
    }

    if (copyUrlBtn) {
        copyUrlBtn.addEventListener('click', () => {
            resultUrl.select();
            document.execCommand('copy'); // Fallback or use navigator.clipboard
            // navigator.clipboard.writeText(resultUrl.value);
            const originalText = copyUrlBtn.textContent;
            copyUrlBtn.textContent = 'Copied!';
            setTimeout(() => copyUrlBtn.textContent = originalText, 2000);
        });
    }

    loadUserData();
});
