// Preset Messages Data
const presets = [
    `You are the sun in my day, the wind in my sky, the waves in my ocean, and the beat in my heart. I love you more than words can say.`,

    `My Dearest,

From the moment I met you, I knew my life would never be the same. You have brought so much joy, light, and love into my world. 
Every moment with you is a treasure I hold dear.

I love you endlessly.`,

    `Distance means so little when someone means so much. 
I am counting the seconds until I can hold you in my arms again. 
Until then, know that you are always in my thoughts and forever in my heart.`,

    `In your eyes, I found my home.
In your heart, I found my love.
In your soul, I found my mate.
I am yours, today and always.`
];

// Elements
const senderInput = document.getElementById('senderName');
const messageInput = document.getElementById('messageBody');
const generateBtn = document.getElementById('generateBtn');
const resultSection = document.getElementById('resultSection');
const formSection = document.getElementById('formSection');
const linkBox = document.getElementById('linkBox');
const copyBtn = document.getElementById('copyBtn');
const previewBtn = document.getElementById('previewBtn');

// Function to apply preset
function applyPreset(index) {
    if (index >= 0 && index < presets.length) {
        messageInput.value = presets[index];
    }
}

// Generate Link
// Generate Link
generateBtn.addEventListener('click', () => {
    const sender = senderInput.value.trim() || "A Secret Admirer";
    const message = messageInput.value.trim();

    if (!message) {
        alert("Please write a message or choose a preset first!");
        return;
    }

    // --- CONFIGURATION ---
    // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
    // Example: "https://script.google.com/macros/s/AKfycbx.../exec"
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzuSLq1eUZyp1k5B7NpPxzBmHgtMvL5hp4GOTYqIFgQ0GfRgGPlOQ1LBpcFKtCjnhy9/exec";
    // ---------------------

    const baseUrl = "https://www.gridify.in/developments/love-letter/view";

    // Option A: If Script URL is present, save to Sheet (Excel)
    if (GOOGLE_SCRIPT_URL) {
        // Change button state
        const originalBtnText = generateBtn.innerHTML;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        generateBtn.disabled = true;

        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ sender: sender, message: message }),
            mode: 'no-cors', // Try 'cors' if possible, but 'no-cors' + redirect handling is tricky in JS. 
            // Text/Plain approach is safer for GAS CORS.
        })
            // NOTE: GAS 'doPost' simple trigger with 'no-cors' yields an opaque response.
            // We actually need CORS to get the ID back. 
            // Standard GAS adjustment: return ContentService...setMimeType(JSON) allows CORS.
            // Let's try standard fetch Assuming the user set "Who has access: Anyone".
            // To fix potential CORS issues with 'POST', we can use a clever trick: 
            // Send data via POST but treat as text.
            .then(async (response) => {
                // Re-attempt with pure CORS structure for the provided script
                return fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { "Content-Type": "text/plain" }, // Avoids preflight
                    body: JSON.stringify({ sender: sender, message: message })
                });
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.id) {
                    const fullUrl = `${baseUrl}?id=${data.id}`;
                    showResult(fullUrl);
                } else {
                    alert("Error saving to sheet. detailed: " + (data.error || "Unknown"));
                    // Fallback
                    useUrlParams(baseUrl, sender, message);
                }
            })
            .catch(err => {
                console.error("Save failed", err);
                alert("Could not save to Sheet (check console). Using standard link instead.");
                useUrlParams(baseUrl, sender, message);
            })
            .finally(() => {
                generateBtn.innerHTML = originalBtnText;
                generateBtn.disabled = false;
            });

    } else {
        // Option B: No Backend, use URL Params
        useUrlParams(baseUrl, sender, message);
    }
});

function useUrlParams(baseUrl, sender, message) {
    const params = new URLSearchParams();
    params.set('s', sender);
    params.set('m', message);
    const fullUrl = `${baseUrl}?${params.toString()}`;
    showResult(fullUrl);
}

function showResult(url) {
    linkBox.textContent = url;
    previewBtn.href = url;
    formSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
}

// Copy to Clipboard
copyBtn.addEventListener('click', () => {
    const url = linkBox.textContent;
    navigator.clipboard.writeText(url).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert("Could not copy automatically. Please select and copy the link manually.");
    });
});
