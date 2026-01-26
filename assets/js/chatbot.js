/* Griddy Chatbot Logic */
(function () {
    const chatbotHTML = `
    <div id="griddy-chatbot-container">
        <div id="griddy-toggle">
            <img src="assets/chat-bot/Griddy.gif" alt="Griddy Logo">
        </div>
        <div id="griddy-window">
            <div id="griddy-header">
                <img src="assets/chat-bot/Griddy.gif" alt="Griddy">
                <div class="info">
                    <h4>Griddy</h4>
                    <p>Online | Digital Expert</p>
                </div>
                <div class="close-btn">&times;</div>
            </div>
            <div id="griddy-messages">
                <div class="griddy-message bot">Hello! I'm Griddy. How can I help you with our digital solutions today?</div>
            </div>
            <div id="griddy-quick-replies">
                <div class="griddy-chip">Web Development</div>
                <div class="griddy-chip">SEO Services</div>
                <div class="griddy-chip">UI/UX Design</div>
                <div class="griddy-chip">Pricing</div>
            </div>
            <div id="griddy-input-area">
                <input type="text" id="griddy-input" placeholder="Type a message...">
                <button id="griddy-send"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    </div>
    `;

    // Add CSS to head
    if (!document.getElementById('griddy-css')) {
        const link = document.createElement('link');
        link.id = 'griddy-css';
        link.rel = 'stylesheet';
        link.href = 'assets/css/chatbot.css';
        document.head.appendChild(link);
    }

    // Append HTML to body
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    const toggle = document.getElementById('griddy-toggle');
    const chatbotWindow = document.getElementById('griddy-window');
    const closeBtn = document.querySelector('#griddy-header .close-btn');
    const input = document.getElementById('griddy-input');
    const sendBtn = document.getElementById('griddy-send');
    const messagesContainer = document.getElementById('griddy-messages');
    const chips = document.querySelectorAll('.griddy-chip');

    // Default Knowledge Base
    const defaultKnowledge = {
        "web development": "We offer premium web development using modern technologies like React, Node.js, and Cloudflare. Check our Web Design section for more!",
        "seo": "Our SEO services help you rank #1 on Google. We optimize content, speed, and backlinks.",
        "ui": "Our UI/UX design team focuses on user-centric interfaces that 'wow' your customers.",
        "ux": "Our UI/UX design team focuses on user-centric interfaces that 'wow' your customers.",
        "pricing": "Our pricing is competitive and depends on the project scope. Contact us for a custom quote!",
        "contact": "You can contact us via email at info@gridify.in or call +91 81295 66053.",
        "hello": "Hi there! I'm Griddy. I'm here to help you grow your digital presence.",
        "hi": "Hi there! I'm Griddy. I'm here to help you grow your digital presence.",
    };

    let activeKnowledge = { ...defaultKnowledge };

    // Async Fetch Knowledge from Firebase
    async function syncKnowledge() {
        const firebaseConfig = {
            apiKey: "AIzaSyD9G64Wu-hOHadZUfk9EG8MaXfqL7T9-F0",
            authDomain: "grfy-b1731.firebaseapp.com",
            projectId: "grfy-b1731",
            storageBucket: "grfy-b1731.firebasestorage.app",
            messagingSenderId: "376190086826",
            appId: "1:376190086826:web:71c268ada23c4163f02ad3",
            measurementId: "G-M45BCQPTPV"
        };

        // Check if we already have local cache while loading
        const cached = localStorage.getItem('griddy_knowledge');
        if (cached) activeKnowledge = { ...defaultKnowledge, ...JSON.parse(cached) };

        try {
            // Check if Firebase script is already loaded
            if (typeof window.firebase === 'undefined') {
                const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js");
                const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js");

                const app = initializeApp(firebaseConfig);
                const db = getFirestore(app);
                const docRef = doc(db, "settings", "chatbot_knowledge");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    activeKnowledge = { ...defaultKnowledge, ...docSnap.data().knowledge };
                    localStorage.setItem('griddy_knowledge', JSON.stringify(docSnap.data().knowledge));
                    console.log("Griddy: Brain synced with Firebase.");
                }
            }
        } catch (e) {
            console.warn("Griddy: Firebase sync failed, using offline brain.", e);
        }
    }

    syncKnowledge();

    function getKnowledge() {
        return activeKnowledge;
    }

    toggle.addEventListener('click', () => {
        chatbotWindow.classList.toggle('active');
    });

    closeBtn.addEventListener('click', () => {
        chatbotWindow.classList.remove('active');
    });

    let chatHistory = [];

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `griddy-message ${sender}`;
        msgDiv.textContent = text;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Track history for WhatsApp
        chatHistory.push(`${sender === 'user' ? 'Customer' : 'Griddy'}: ${text}`);
    }

    function showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'griddy-message bot typing';
        typingDiv.id = 'griddy-typing';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function removeTyping() {
        const typing = document.getElementById('griddy-typing');
        if (typing) typing.remove();
    }

    function showWhatsAppOption() {
        const helpDiv = document.createElement('div');
        helpDiv.className = 'griddy-message bot whatsapp-offer';
        helpDiv.innerHTML = `
            <p>I couldn't find a perfect answer for that. Would you like to chat with our human experts on WhatsApp?</p>
            <button id="griddy-whatsapp-trigger" class="griddy-whatsapp-btn">
                <i class="fab fa-whatsapp"></i> Chat on WhatsApp
            </button>
        `;
        messagesContainer.appendChild(helpDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Attach event listener immediately after adding to DOM
        const btn = helpDiv.querySelector('#griddy-whatsapp-trigger');
        if (btn) {
            btn.addEventListener('click', () => {
                const phoneNumber = "918129566053";
                const historyText = chatHistory.slice(-10).join('\n');
                const message = encodeURIComponent(`Hi, I need help with a query from your website.\n\n--- Recent Chat History ---\n${historyText}\n---------------------------`);
                window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
            });
        }
    }

    function handleSend() {
        const text = input.value.trim();
        if (!text) return;

        addMessage(text, 'user');
        input.value = '';

        showTyping();

        setTimeout(() => {
            removeTyping();
            const knowledge = getKnowledge();
            let found = false;
            let response = "";

            const lowerText = text.toLowerCase();
            for (let key in knowledge) {
                if (lowerText.includes(key)) {
                    response = knowledge[key];
                    found = true;
                    break;
                }
            }

            if (found) {
                addMessage(response, 'bot');
            } else {
                showWhatsAppOption();
            }
        }, 1000);
    }

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            input.value = chip.textContent;
            handleSend();
        });
    });

})();
