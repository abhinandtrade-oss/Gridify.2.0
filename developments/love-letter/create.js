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
generateBtn.addEventListener('click', () => {
    const sender = senderInput.value.trim() || "A Secret Admirer";
    const message = messageInput.value.trim();

    if (!message) {
        alert("Please write a message or choose a preset first!");
        return;
    }

    // Generate URL
    // We assume view.html is in the same directory.
    const baseUrl = window.location.href.replace('create.html', 'view.html');

    // Encode parameters
    // We use encodeURIComponent to handle special characters, emojis, newlines etc safely.
    // For a very robust solution, we'd base64 encode, but this is sufficient for a "mini-experience".
    const params = new URLSearchParams();
    params.set('s', sender);
    params.set('m', message);

    const fullUrl = `${baseUrl}?${params.toString()}`;

    // Show Result
    linkBox.textContent = fullUrl;
    previewBtn.href = fullUrl;

    formSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
});

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
