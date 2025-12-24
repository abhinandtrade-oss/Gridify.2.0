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
I am yours, today and always.`,

    `I never believed in soulmates until I found you.
You understand me in ways no one else ever could.
Thank you for being my best friend and my one true love.`,

    `Every love story is beautiful, but ours is my favorite.
I can't wait to see what the future holds for us.
With all my love, forever.`,

    `You are the first thing I think of when I wake up and the last thing on my mind before I go to sleep.
My world is a happier place because of you.`,

    `If I had a flower for every time I thought of you...
I could walk through my garden forever.`,

    // New Presets
    `Thinking of you is my favorite hobby. 
Dreaming of you is my favorite escape. 
Being with you is my favorite place.`,

    `You are my safe place, my quiet chaos, and my beautiful reality. 
I love you more than yesterday, but less than tomorrow.`,

    `Life is an adventure, and I want to explore every corner of it with you by my side.
You make every moment magical.`,

    `I promise to be there for you when you need me, 
to love you when you don't feel lovable, 
and to stand by you no matter what comes our way.`,

    `Good morning to the person who makes my sun shine,
and good night to the one who stars in my dreams.
I love you, always.`,

    `I believe that we were destined to meet, 
destined to fall in love, 
and destined to be together forever.`,

    `You complete me in ways I didn't know were possible.
You are the missing piece to my puzzle, the melody to my song.`,

    `I am so grateful for every laugh, every smile, and every moment we share.
Thank you for being you and for loving me.`,

    `I want to grow old with you, counting the stars and the years as they pass by.
My love for you is eternal.`,

    `I just wanted to say: I love you.
Not for what you are, but for what I am when I am with you.`
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

// Function to select theme
function selectTheme(themeName) {
    document.getElementById('selectedTheme').value = themeName;
    // Update visual selection
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.querySelector('div').style.border = '3px solid transparent';
    });

    const selectedOpt = document.querySelector(`.theme-option[data-theme="${themeName}"]`);
    if (selectedOpt) {
        selectedOpt.classList.add('selected');
        // Add border color based on theme (or just #ff4757 generic active color)
        selectedOpt.querySelector('div').style.border = '3px solid #ff4757';
    }
    // Live Preview on Index Page
    document.body.className = ''; // Reset
    if (themeName !== 'classic') {
        document.body.classList.add(`theme-${themeName}`);
    }
}

// Generate Link
generateBtn.addEventListener('click', () => {
    const sender = senderInput.value.trim() || "A Secret Admirer";
    const message = messageInput.value.trim();
    const theme = document.getElementById('selectedTheme').value || 'classic';

    if (!message) {
        alert("Please write a message or choose a preset first!");
        return;
    }

    // --- CONFIGURATION ---
    // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE
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
            mode: 'no-cors',
        })
            .then(async (response) => {
                return fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    headers: { "Content-Type": "text/plain" },
                    body: JSON.stringify({ sender: sender, message: message })
                });
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.id) {
                    // Append theme to the URL
                    const fullUrl = `${baseUrl}?id=${data.id}&theme=${theme}`;
                    showResult(fullUrl);
                } else {
                    alert("Error saving to sheet. detailed: " + (data.error || "Unknown"));
                    useUrlParams(baseUrl, sender, message, theme);
                }
            })
            .catch(err => {
                console.error("Save failed", err);
                alert("Could not save to Sheet (check console). Using standard link instead.");
                useUrlParams(baseUrl, sender, message, theme);
            })
            .finally(() => {
                generateBtn.innerHTML = originalBtnText;
                generateBtn.disabled = false;
            });

    } else {
        // Option B: No Backend, use URL Params
        useUrlParams(baseUrl, sender, message, theme);
    }
});

function useUrlParams(baseUrl, sender, message, theme) {
    const params = new URLSearchParams();
    params.set('s', sender);
    params.set('m', message);
    if (theme && theme !== 'classic') {
        params.set('t', theme);
    }
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
