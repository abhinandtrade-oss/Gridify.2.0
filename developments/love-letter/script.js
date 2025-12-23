document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const envelopeContainer = document.getElementById('openEnvelope');
    const envelope = document.querySelector('.envelope');
    const startScreen = document.getElementById('startScreen');
    const letterContent = document.getElementById('letterContent');
    const audio = document.getElementById('bgMusic');
    const popSound = document.getElementById('popSound');
    const typingContainer = document.getElementById('typingContainer');
    const signature = document.getElementById('signature');
    const greeting = document.getElementById('greeting');
    const createBtnContainer = document.getElementById('createBtnContainer');
    const musicControl = document.getElementById('musicControl');

    // --- Data Parsing (URL Params) ---
    const urlParams = new URLSearchParams(window.location.search);
    const encodedMessage = urlParams.get('m'); // 'm' for message
    const encodedSender = urlParams.get('s');  // 's' for sender
    const msgId = urlParams.get('id');         // 'id' for database entry

    // Default Content
    let letterText = `My dearest,

From the moment our paths crossed, my world has been brighter. 
Every smile you share warms my heart, and every laugh is like music to my soul.

I wanted to create this little corner of the web just to tell you how incredibly special you are to me. 
You inspire me to be better, to dream bigger, and to love deeper.

No matter where life takes us, know that my heart beats for you.`;

    let senderName = "Your Secret Admirer";

    // --- CONFIGURATION ---
    // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE (MUST MATCH create.js)
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzuSLq1eUZyp1k5B7NpPxzBmHgtMvL5hp4GOTYqIFgQ0GfRgGPlOQ1LBpcFKtCjnhy9/exec";
    // ---------------------

    // 1. Check for Database ID first
    if (msgId && GOOGLE_SCRIPT_URL) {
        // Show loading state on envelope
        const envelopeText = document.querySelector('.envelope .text-hint');
        const originalText = envelopeText.textContent;
        envelopeText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Fetching letter...';
        envelopeContainer.style.pointerEvents = 'none'; // Disable click while loading

        fetch(`${GOOGLE_SCRIPT_URL}?id=${msgId}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    letterText = data.message;
                    senderName = data.sender;
                    // Update Initials immediately
                    signature.querySelector('span').textContent = senderName;
                } else {
                    console.error("Letter not found");
                    letterText = "Sorry, this letter could not be found or has expired.";
                }
            })
            .catch(err => {
                console.error("Fetch error", err);
                letterText = "Error loading letter. Please check your internet connection.";
            })
            .finally(() => {
                // Restore envelope state
                envelopeText.textContent = originalText;
                envelopeContainer.style.pointerEvents = 'auto';
            });
    }
    // 2. Fallback to URL Params
    else {
        if (encodedMessage) {
            try {
                letterText = decodeURIComponent(encodedMessage);
            } catch (e) { console.error("Error decoding message", e); }
        }
        if (encodedSender) {
            try {
                senderName = decodeURIComponent(encodedSender);
            } catch (e) { console.error("Error decoding sender", e); }
        }
    }

    // Update Initials (Initial Render)
    signature.querySelector('span').textContent = senderName;




    let isEnvelopeOpen = false;

    // --- Interaction: Open Envelope ---
    envelopeContainer.addEventListener('click', () => {
        if (isEnvelopeOpen) return;
        isEnvelopeOpen = true;

        // 1. Play Pop Sound Burst (10 times with 25ms delay)
        let popCount = 0;
        const popRepeats = 10;

        // Play first immediately to capture user gesture
        const firstPop = new Audio('mus/pop.m4a');
        firstPop.volume = 1.0;
        firstPop.play().catch(e => console.error("First pop failed", e));
        popCount++;

        const burstInterval = setInterval(() => {
            if (popCount >= popRepeats) {
                clearInterval(burstInterval);
                // 3. Play Music after pops are done
                if (audio) {
                    audio.volume = 0.5;
                    audio.play().catch(e => console.warn("Background music autoplay blocked", e));
                }
                return;
            }

            const pop = new Audio('mus/pop.m4a');
            pop.volume = 1.0;
            pop.play().catch(e => console.error("Pop interval failed", e));
            popCount++;
        }, 25);


        // Blast Effect - Romantic Explosion
        createBlastEffect();

        // 2. Animate Envelope
        envelope.classList.add('open');

        // 4. Transition to Letter
        setTimeout(() => {
            startScreen.style.opacity = '0';
            setTimeout(() => {
                startScreen.classList.add('hidden');
                letterContent.classList.remove('hidden');

                // 5. Start Typing
                typeWriter(letterText, typingContainer, () => {
                    // Show Signature
                    signature.classList.remove('hidden-fade');
                    signature.classList.add('visible-fade');

                    // Show Mute Control
                    musicControl.classList.remove('hidden-fade');
                    musicControl.classList.add('visible-fade');

                    // Show "Create Your Own" button after a delay
                    setTimeout(() => {
                        createBtnContainer.classList.remove('hidden-fade');
                        createBtnContainer.classList.add('visible-fade');
                    }, 1500);
                });

            }, 1000); // Wait for fade out
        }, 800); // Wait for envelope flap animation
    });

    // --- Blast Effect Function ---
    function createBlastEffect() {
        const blastCount = 60;
        const blastSymbols = ['🧸', '🌹', '🌸', '🌺', '💖', '💘', '🦋', '💐', '🍫', '✨'];

        for (let i = 0; i < blastCount; i++) {
            const el = document.createElement('div');
            el.classList.add('blast-item');
            el.textContent = blastSymbols[Math.floor(Math.random() * blastSymbols.length)];

            // Random Direction Setup
            const angle = Math.random() * 360; // Random angle
            const power = Math.random() * 400 + 100; // Distance of explosion
            const rotate = Math.random() * 360;

            // Convert polar to cartesian
            const rad = angle * (Math.PI / 180);
            const tx = Math.cos(rad) * power;
            const ty = Math.sin(rad) * power;

            // Set Custom Properties for CSS Animation
            el.style.setProperty('--tx', `${tx}px`);
            el.style.setProperty('--ty', `${ty}px`);
            el.style.setProperty('--r', `${rotate}deg`);

            // Vary animation duration
            el.style.animation = `blastOut ${Math.random() * 0.8 + 0.6}s ease-out forwards`;

            document.body.appendChild(el);

            // Cleanup
            setTimeout(() => {
                el.remove();
            }, 1500);
        }
    }


    // --- Typing Effect Function ---
    function typeWriter(text, element, callback) {
        let i = 0;
        const speed = 50; // Base speed in ms
        element.innerHTML = ''; // Clear defaults

        function type() {
            if (i < text.length) {
                const char = text.charAt(i);

                if (char === '\n') {
                    element.innerHTML += '<br>';
                } else {
                    element.innerHTML += char;
                }
                i++;

                // Randomize speed for "human" feel
                const randomSpeed = speed + (Math.random() * 50 - 20);
                setTimeout(type, randomSpeed);
            } else {
                if (callback) callback();
            }
        }
        type();
    }


    // --- Background Falling Elements (Hearts & Flowers) ---
    const fallingContainer = document.getElementById('fallingContainer');
    const symbols = ['❤', '🌸', '🌹', '💕', '✨', '💌'];

    function createFallingElement() {
        if (document.hidden) return; // Save resources

        const el = document.createElement('div');
        el.classList.add('falling-item');
        el.textContent = symbols[Math.floor(Math.random() * symbols.length)];

        // Random Position & Animation Properies
        const startLeft = Math.random() * 100;
        const duration = Math.random() * 5 + 5; // 5 to 10s
        const size = Math.random() * 1.5 + 1; // 1rem to 2.5rem

        el.style.left = `${startLeft}%`;
        el.style.animationDuration = `${duration}s`;
        el.style.fontSize = `${size}rem`;
        el.style.color = Math.random() > 0.5 ? '#ff4757' : '#ff7b93';

        fallingContainer.appendChild(el);

        // Cleanup
        setTimeout(() => {
            el.remove();
        }, duration * 1000);
    }

    // Start falling loop
    setInterval(createFallingElement, 400);

    // --- Mute Control Logic ---
    musicControl.addEventListener('click', () => {
        if (!audio) return;

        if (audio.muted) {
            audio.muted = false;
            musicControl.innerHTML = '<i class="fas fa-volume-up"></i>';
        } else {
            audio.muted = true;
            musicControl.innerHTML = '<i class="fas fa-volume-mute"></i>';
        }
    });
});
