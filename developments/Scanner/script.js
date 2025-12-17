// ATS Analysis Logic

document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultsContainer = document.getElementById('results-container');
    const inputSection = document.getElementById('input-section');

    analyzeBtn.addEventListener('click', runAnalysis);

    // Drag & Drop Logic
    const dropZone = document.getElementById('drop-zone');

    // Prevent default drag behaviors for the entire window to be safe
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    if (dropZone) {
        // Specific Zone Visuals
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });

        // Drop Handle
        dropZone.addEventListener('drop', handleDrop, false);
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        dropZone.classList.add('drag-over');
    }

    function unhighlight(e) {
        dropZone.classList.remove('drag-over');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (fileInput) {
            fileInput.files = files; // Sync with input
            // Trigger change manually since setting .files doesn't trigger it
            const event = new Event('change');
            fileInput.dispatchEvent(event);
        }
    }

    // Global storage for filename and raw content
    window.uploadedFileName = "Unknown File";
    window.rawFileContent = "";

    // File Upload Logic
    const fileInput = document.getElementById('cv-upload');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            window.uploadedFileName = file.name; // Capture filename

            const textarea = document.getElementById('cv-input');
            textarea.value = "Reading file...";
            textarea.disabled = true;

            try {
                let text = "";
                if (file.type === "application/pdf") {
                    text = await readPDF(file);
                } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                    text = await readDocx(file);
                } else {
                    text = await readText(file);
                }

                textarea.value = text;
                window.rawFileContent = text; // Capture raw content
            } catch (err) {
                console.error(err);
                alert("Error reading file: " + err.message);
                textarea.value = "";
                window.rawFileContent = "";
            } finally {
                textarea.disabled = false;
            }
        });
    }

    function runAnalysis() {
        const cvText = document.getElementById('cv-input').value;

        if (!cvText.trim() || cvText === "Reading file...") {
            alert("Please provide a CV to audit.");
            return;
        }

        // 1. Parsing Phase
        const parsedCV = parseCV(cvText);

        // 2. Audit Phase (Scoring based on best practices)
        const matchResults = calculateAudit(parsedCV);

        // 3. Analysis Phase (Strengths/Weaknesses)
        const analysis = generateAnalysis(matchResults, parsedCV);

        // 4. Recommendations Phase
        const recommendations = generateRecommendations(matchResults, parsedCV);

        // Store for saving
        window.lastScanData = { matchResults, analysis, recommendations, parsedCV };

        // Auto-save
        autoSaveReport(window.lastScanData);

        // Render Results
        renderResults(matchResults, analysis, recommendations, parsedCV);


        // UI Transition
        inputSection.style.display = 'none'; // Or keep it but scroll down. Let's hide for focus.
        resultsContainer.classList.remove('hidden');

        // Trigger animations
        setTimeout(() => {
            const circlePath = document.getElementById('score-circle-path');
            const score = matchResults.finalScore;
            // specific animation logic for the circle
            const dashArray = `${score}, 100`;
            circlePath.style.strokeDasharray = dashArray;
            animateValue("final-ats-score", 0, score, 1500);

            // Fill bars
            document.getElementById('fill-skills').style.width = `${Math.min(100, (matchResults.breakdown.skills / 30) * 100)}%`;
            document.getElementById('fill-experience').style.width = `${Math.min(100, (matchResults.breakdown.experience / 30) * 100)}%`;
            document.getElementById('fill-formatting').style.width = `${Math.min(100, (matchResults.breakdown.formatting / 20) * 100)}%`;
            document.getElementById('fill-education').style.width = `${Math.min(100, (matchResults.breakdown.education / 20) * 100)}%`;

            // Numbers
            document.getElementById('val-skills').textContent = `${Math.round(matchResults.breakdown.skills)}/30`;
            document.getElementById('val-experience').textContent = `${Math.round(matchResults.breakdown.experience)}/30`;
            document.getElementById('val-formatting').textContent = `${Math.round(matchResults.breakdown.formatting)}/20`;
            document.getElementById('val-education').textContent = `${Math.round(matchResults.breakdown.education)}/20`;

        }, 100);
    }
});

// --- Phase 1: Parsing ---

const TECH_KEYWORDS = [
    "JavaScript", "Python", "Java", "C++", "React", "Node.js", "AWS", "SQL", "NoSQL", "Docker", "Kubernetes", "TypeScript", "HTML", "CSS", "Git", "CI/CD", "Agile", "Scrum", "Machine Learning", "AI", "Data Analysis", "Project Management", "Communication", "Leadership", "Sales", "Marketing", "SEO", "Figma", "Design", "Go", "Rust", "C#", ".NET", "Azure", "GCP", "Linux", "Bash", "Terraform", "Ansible", "Jenkins", "CircleCI", "GitHub Actions", "MongoDB", "PostgreSQL", "MySQL", "Redis", "Elasticsearch", "GraphQL", "REST API", "Microservices", "Serverless", "Lambdas", "TDD", "BDD", "Jest", "Mocha", "Cypress", "Selenium", "Playwright", "Webpack", "Vite", "Next.js", "Nuxt.js", "Vue.js", "Angular", "Svelte", "Redux", "MobX", "Recoil", "Zustand", "Express", "NestJS", "FastAPI", "Flask", "Django", "Spring Boot", "Laravel", "Rails", "Phoenix", "Asp.Net", "Kotlin", "Swift", "Flutter", "React Native", "Ionic", "Cordova", "Xamarin", "Unity", "Unreal Engine", "Blender", "Maya", "3ds Max", "Photoshop", "Illustrator", "InDesign", "Premiere Pro", "After Effects", "Final Cut Pro", "DaVinci Resolve", "Audition", "Logic Pro", "Pro Tools", "Ableton Live", "FL Studio", "GarageBand", "Excel", "Word", "PowerPoint", "Outlook", "Teams", "Slack", "Zoom", "Trello", "Asana", "Jira", "Confluence", "Notion", "Airtable", "Salesforce", "HubSpot", "Zendesk", "Intercom", "Shopify", "WordPress", "Webflow", "Squarespace", "Wix", "Google Analytics", "Google Ads", "Facebook Ads", "Instagram Ads", "LinkedIn Ads", "TikTok Ads", "Snapchat Ads", "Twitter Ads", "Pinterest Ads", "Mailchimp", "SendGrid", "Twilio", "Stripe", "PayPal", "Square", "QuickBooks", "Xero", "FreshBooks", "Wave", "Zoho", "SAP", "Oracle", "Microsoft Dynamics", "NetSuite", "Intuit", "Sage", "Xero", "Tableau", "Power BI", "Looker", "Domo"
];

function parseCV(text) {
    const skills = [];

    // Skill extraction (Simple keyword matching against a predefined list)
    TECH_KEYWORDS.forEach(skill => {
        // Regex to match whole words to avoid "Go" inside "Google"
        const regex = new RegExp(`\\b${escapeRegExp(skill)}\\b`, 'i');
        if (regex.test(text)) {
            skills.push(skill);
        }
    });

    // Extract emails
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const emails = text.match(emailRegex) || [];

    // Metrics detection (numbers + % or keywords)
    // Look for lines containing numbers that look like achievements
    const lines = text.split('\n');
    const metricLines = lines.filter(line => {
        return /\d+%|\$\d+|\d+ (users|clients|revenue|sales|growth|increase|decrease|saved)/i.test(line);
    }).map(l => l.trim()).filter(l => l.length > 10 && l.length < 150); // Valid length

    // Structure detection
    const hasEducation = /Education|University|College|Degree|Bachelor|Master|PhD/i.test(text);
    const hasExperience = /Experience|Work|History|Employment|Career/i.test(text);
    const hasProjects = /Projects|Portfolio/i.test(text);

    return {
        raw: text,
        skills: [...new Set(skills)], // Unique
        emails: emails,
        metrics: metricLines,
        hasEducation,
        hasExperience,
        hasProjects
    };
}

// --- Phase 2: Audit Logic (Replaces Matching) ---

function calculateAudit(cv) {
    let score = {
        skills: 0, // Max 30
        experience: 0, // Max 30
        formatting: 0, // Max 20
        education: 0 // Max 20
    };

    // 1. Skill Density (30 pts)
    // Heuristic: Expect at least 5 distinct skills for a basic score, 10 for full.
    if (cv.skills.length > 0) {
        score.skills = Math.min(30, (cv.skills.length / 10) * 30);
    }

    // 2. Experience & Impact (30 pts)
    if (cv.hasExperience) {
        score.experience += 10;
    }
    // Boost for metrics
    score.experience += Math.min(20, cv.metrics.length * 4);

    // 3. Formatting & Structure (20 pts)
    if (cv.raw.length > 500) score.formatting += 5;
    if (cv.raw.length > 1000) score.formatting += 5;
    if (cv.emails.length > 0) score.formatting += 5;
    // Penalty for too little text already handled in logic above? No, we add here.
    if (cv.hasProjects) score.formatting += 5;

    // Penalties
    if (cv.raw.length < 500) score.formatting = Math.max(0, score.formatting - 10);
    if (!cv.emails || cv.emails.length === 0) score.formatting = Math.max(0, score.formatting - 10);

    // 4. Education (20 pts)
    if (cv.hasEducation) score.education = 20;

    // Total
    let finalScore = score.skills + score.experience + score.formatting + score.education;
    finalScore = Math.min(100, Math.max(0, finalScore)); // Clamp

    return {
        finalScore: Math.round(finalScore),
        breakdown: score,
        details: {
            metricsCount: cv.metrics.length,
            textLength: cv.raw.length
        }
    };
}

// --- Phase 3: Analysis ---

function generateAnalysis(results, cv) {
    const strengths = [];
    const weaknesses = [];

    // Strengths
    if (results.breakdown.skills >= 25) strengths.push("[SKILLS] Strong technical vocabulary detected.");
    else if (results.breakdown.skills >= 15) strengths.push("[SKILLS] Moderate technical skill set identified.");

    if (results.details.metricsCount > 3) strengths.push("[IMPACT] excellent use of quantified metrics.");

    if (cv.hasExperience) strengths.push("[STRUCT] Experience section clearly defined.");
    if (cv.hasEducation) strengths.push("[STRUCT] Education background detected.");

    // Weaknesses
    if (results.breakdown.skills < 10) weaknesses.push("[GAP] Low technical keyword density.");
    if (results.details.metricsCount < 2) weaknesses.push("[IMPACT] Lack of measurable results (%, numbers).");
    if (!cv.hasEducation) weaknesses.push("[STRUCT] Education section missing or unclear.");
    if (results.details.textLength < 500) weaknesses.push("[LEN] Content appears too short for detailed analysis.");
    if (!cv.emails || cv.emails.length === 0) weaknesses.push("[CONTACT] No email address found.");

    return { strengths, weaknesses };
}

// --- Phase 4: Recommendations ---

function generateRecommendations(results, cv) {
    const recs = [];

    if (results.breakdown.skills < 15) {
        recs.push({
            type: 'CONTENT GAP',
            text: "Expand technical skills section.",
            action: "List core technologies explicitly."
        });
    }

    if (results.details.metricsCount < 3) {
        recs.push({
            type: 'QUALITY IMPROVEMENT',
            text: "Quantify your impact.",
            action: "Add numbers to your experience bullets (e.g. 'Improved X by Y%')."
        });
    }

    if (!cv.hasEducation) {
        recs.push({
            type: 'STRUCTURE',
            text: "Add Education Section.",
            action: "List degree and university clearly."
        });
    }

    if (recs.length === 0) {
        recs.push({
            type: 'PASS',
            text: "Resume structure looks solid.",
            action: "Ready for human review."
        });
    }

    return recs;
}


// --- Rendering ---

function renderResults(matchResults, analysis, recommendations, cv) {
    // Likelihood
    const likelihood = document.getElementById('likelihood-text');
    const final = matchResults.finalScore;

    if (final >= 80) {
        likelihood.textContent = "PASS";
        likelihood.style.color = "var(--success-color)";
    } else if (final >= 50) {
        likelihood.textContent = "BORDERLINE";
        likelihood.style.color = "var(--warning-color)";
    } else {
        likelihood.textContent = "REJECT";
        likelihood.style.color = "var(--danger-color)";
    }

    // Extracted Skills
    const skillsContainer = document.getElementById('extracted-skills');
    skillsContainer.innerHTML = '';

    if (cv.skills.length === 0) {
        skillsContainer.innerHTML = '<span class="empty-state">No specific tech skills detected</span>';
    }

    cv.skills.forEach(skill => {
        // No matching check anymore
        const span = document.createElement('span');
        span.className = 'tag';
        // Always generic style since no JD verification
        span.style.borderColor = 'var(--accent-color)';
        span.style.color = 'var(--accent-color)';

        span.textContent = skill;
        skillsContainer.appendChild(span);
    });

    // Metrics
    const metricsList = document.getElementById('extracted-metrics');
    metricsList.innerHTML = '';
    if (cv.metrics.length === 0) {
        metricsList.innerHTML = '<li class="empty-state">No quantified metrics found</li>';
    } else {
        cv.metrics.slice(0, 4).forEach(metric => {
            const li = document.createElement('li');
            li.textContent = metric;
            metricsList.appendChild(li);
        });
        if (cv.metrics.length > 4) {
            const li = document.createElement('li');
            li.textContent = `...and ${cv.metrics.length - 4} more.`;
            li.style.listStyle = 'none';
            metricsList.appendChild(li);
        }
    }

    // Strengths & Weaknesses
    const strList = document.getElementById('list-strengths');
    strList.innerHTML = '';
    analysis.strengths.slice(0, 5).forEach(s => {
        const li = document.createElement('li');
        li.textContent = s;
        strList.appendChild(li);
    });

    const weakList = document.getElementById('list-weaknesses');
    weakList.innerHTML = '';
    analysis.weaknesses.slice(0, 5).forEach(w => {
        const li = document.createElement('li');
        li.textContent = w;
        weakList.appendChild(li);
    });

    // Recommendations
    const recContainer = document.getElementById('recommendations-container');
    recContainer.innerHTML = '';
    recommendations.slice(0, 5).forEach(rec => {
        const div = document.createElement('div');
        div.className = 'recommendation-card';
        div.innerHTML = `
            <h4>${markedParse(rec.text)}</h4>
            <div class="recommendation-meta">
                <span class="type">${rec.type}</span>
            </div>
            <div class="recommendation-action">👉 ${rec.action}</div>
        `;
        recContainer.appendChild(div);
    });
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function markedParse(text) {
    // Simple bold parser for **text**
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function animateValue(id, start, end, duration) {
    if (start === end) return;
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    const obj = document.getElementById(id);
    const timer = setInterval(function () {
        current += increment;
        obj.textContent = current;
        if (current == end) {
            clearInterval(timer);
        }
    }, stepTime);
}



// --- File Reading Helpers ---

function readText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

async function readPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        text += strings.join(" ") + "\n";
    }
    return text;
}

async function readDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return result.value;
}

// --- Google Sheets Integration ---
// --- Google Sheets Integration ---
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjz5Vg4whvxDa6wdE1-OY3F7LHEwqzr3W03LqLF08h9XcU_SctuPTlHAgjlkFNEgdPqQ/exec';

function autoSaveReport(d) {
    if (!d) return;

    // Prepare data payload
    const data = {
        type: 'scanner',
        fileName: window.uploadedFileName || 'N/A',
        extractedEmail: (d.parsedCV.emails && d.parsedCV.emails.length > 0) ? d.parsedCV.emails[0] : 'N/A',
        finalScore: d.matchResults.finalScore,
        breakdown: d.matchResults.breakdown,
        missingKeywords: d.analysis.weaknesses.join('; '),
        recommendations: d.recommendations.map(r => r.text).join('; '),
        rawContent: window.rawFileContent || ''
    };

    console.log('Auto-saving report...');

    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
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
                console.log('Report auto-saved successfully.');
            }
        })
        .catch(error => {
            console.error('Network Error during auto-save:', error);
        });
}
