/**
 * SMTP Settings Management
 */

document.addEventListener('DOMContentLoaded', () => {
    const saveBtn = document.getElementById('btn-save-settings');
    const senderNameInput = document.getElementById('senderName');
    const scriptUrlInput = document.getElementById('scriptUrl');
    let currentUserEmail = '';

    // 1. Selection Logic for Cards
    function selectScriptType(type) {
        const systemRadio = document.getElementById('typeSystem');
        const userRadio = document.getElementById('typeUser');
        const systemCard = document.getElementById('card-system');
        const userCard = document.getElementById('card-user');

        if (type === 'system') {
            systemRadio.checked = true;
            systemCard.classList.add('border-2', 'border-primary');
            systemCard.classList.remove('border');
            userCard.classList.add('border');
            userCard.classList.remove('border-2', 'border-primary');
        } else {
            userRadio.checked = true;
            userCard.classList.add('border-2', 'border-primary');
            userCard.classList.remove('border');
            systemCard.classList.add('border');
            systemCard.classList.remove('border-2', 'border-primary');
        }

        updateInstructionNote();
        updateScriptCode();
    }

    // Load from LocalStorage and Auth
    async function loadSettings() {
        // Get current user email from Supabase
        const { data: { session } } = await window.supabase.auth.getSession();
        if (session && session.user) {
            currentUserEmail = session.user.email;
        }

        const settings = JSON.parse(localStorage.getItem('glamer_smtp_settings') || '{}');

        if (settings.scriptType) {
            selectScriptType(settings.scriptType);
        } else {
            selectScriptType('system');
        }

        if (settings.senderName) {
            senderNameInput.value = settings.senderName;
        } else {
            senderNameInput.value = 'House of Pachu'; // Default
        }

        if (settings.scriptUrl) {
            scriptUrlInput.value = settings.scriptUrl;
        }
    }

    // 2. Save Settings
    async function saveSettings() {
        const provider = document.querySelector('input[name="emailProvider"]:checked')?.value || 'google-script';
        const scriptType = document.querySelector('input[name="scriptType"]:checked')?.value || 'system';
        const senderName = senderNameInput.value.trim();
        const scriptUrl = scriptUrlInput.value.trim();

        if (!scriptUrl) {
            alert('Please provide a Google Script Web App URL.');
            return;
        }

        const settings = {
            provider,
            scriptType,
            senderName,
            scriptUrl,
            updatedAt: new Date().toISOString()
        };

        try {
            // Store in LocalStorage
            localStorage.setItem('glamer_smtp_settings', JSON.stringify(settings));

            // Show success message
            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i data-lucide="check" style="width: 16px; height: 16px;"></i> Saved!';
            saveBtn.classList.replace('btn-primary', 'btn-success');

            if (typeof lucide !== 'undefined') lucide.createIcons();

            setTimeout(() => {
                saveBtn.innerHTML = originalText;
                saveBtn.classList.replace('btn-success', 'btn-primary');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }, 2000);

        } catch (err) {
            console.error('Error saving settings:', err);
            alert('Failed to save settings.');
        }
    }

    // 3. Test Connection
    async function testConnection() {
        const scriptUrl = scriptUrlInput.value.trim();
        const senderName = senderNameInput.value.trim() || 'House of Pachu';

        if (!scriptUrl) {
            alert('Please enter a Web App URL first.');
            return;
        }

        const testBtn = document.getElementById('btn-test-connection');
        const originalText = testBtn.innerHTML;
        testBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Testing...';
        testBtn.disabled = true;

        try {
            const scriptType = document.querySelector('input[name="scriptType"]:checked')?.value;
            const payload = {
                to: currentUserEmail || 'test@example.com',
                subject: 'SMTP Test Connection 🚀',
                body: `Your SMTP settings are working correctly!\n\nMode: ${scriptType === 'system' ? 'System Wide' : 'Personal'}\nSender: ${senderName}`,
                name: senderName,
                from_email: currentUserEmail // Sending the registered email for verification in Personal mode
            };

            // Using fetch with no-cors. Note: We can't see the response status/body.
            await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'text/plain' // Must be text/plain for no-cors
                },
                body: JSON.stringify(payload)
            });

            // Since we use no-cors, we assume success if no network error occurred
            setTimeout(() => {
                alert('Test request sent! \n\nIMPORTANT: Since this is a cross-domain request, we cannot confirm if the script actually executed. \n\nPlease check the inbox of: ' + (currentUserEmail || 'your email') + '\n\nIf you don\'t receive it within 2 minutes:\n1. Check if the Web App URL is correct\n2. Ensure you deployed as "Anyone"\n3. Ensure you authorized the script');
                testBtn.innerHTML = originalText;
                testBtn.disabled = false;
            }, 1000);

        } catch (err) {
            console.error('Test failed:', err);
            alert('Connection failed to initiate: ' + err.message);
            testBtn.innerHTML = originalText;
            testBtn.disabled = false;
        }
    }

    // Update instruction note dynamically
    function updateInstructionNote() {
        const scriptType = document.querySelector('input[name="scriptType"]:checked')?.value;
        const note = document.getElementById('mode-note');
        const executeAsNote = document.getElementById('execute-as-note');

        if (note) {
            note.textContent = scriptType === 'system' ? '(Option 1: System Wide)' : '(Option 2: Personal Account)';
        }

        if (executeAsNote) {
            executeAsNote.innerHTML = scriptType === 'system'
                ? 'Set to <strong>"Me"</strong> (the primary system account).'
                : `Set to <strong>"Me"</strong> (this ensures emails are sent from <strong>${currentUserEmail || 'your email'}</strong>).`;
        }
    }

    function updateScriptCode() {
        const scriptType = document.querySelector('input[name="scriptType"]:checked')?.value;
        const senderName = senderNameInput.value.trim() || 'House of Pachu';
        const codeElement = document.querySelector('#script-code pre code');

        let code = `function doPost(e) {
  var response = { "status": "error", "message": "Unknown error" };
  
  try {
    var contents = e.postData.contents;
    if (!contents) throw new Error("No data received");
    
    var data = JSON.parse(contents);
    var to = data.to;
    var subject = data.subject || "No Subject";
    var body = data.body || "";
    var htmlBody = data.htmlBody || null;
    var name = data.name || data.senderName || "${senderName}";
    
    if (!to) throw new Error("Recipient email (to) is missing");
`;

        if (scriptType === 'user') {
            code += `
    // SECURITY CHECK: Only allow sending if the request comes from this specific user
    var authorizedUser = "${currentUserEmail || 'REPLACE_WITH_YOUR_EMAIL'}";
    
    if (data.from_email !== authorizedUser) {
      throw new Error("Unauthorized: This script is configured for " + authorizedUser);
    }
`;
        }

        code += `
    MailApp.sendEmail({
      to: to,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      name: name
    });

    response = { "status": "success", "message": "Email sent successfully" };
  } catch (error) {
    response = { "status": "error", "message": error.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}`;

        if (codeElement) {
            codeElement.textContent = code;
        }
    }

    // Event Listeners
    saveBtn.addEventListener('click', saveSettings);
    document.getElementById('btn-test-connection').addEventListener('click', testConnection);
    senderNameInput.addEventListener('input', updateScriptCode);

    // Card Click Listeners
    document.querySelectorAll('.script-type-card').forEach(card => {
        card.addEventListener('click', () => {
            selectScriptType(card.dataset.type);
        });
    });

    // Initialize
    loadSettings();
});

// Note: In a real-world application, these settings should be stored in a secure
// database table (e.g., 'system_settings') rather than localStorage for persistence
// across different browsers and devices.
