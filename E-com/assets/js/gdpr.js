/**
 * GDPR Cookie Consent Banner
 * Handles the display and user interaction for cookie consent.
 */

// Initialize GDPR
(function () {
    const initGDPR = () => {
        const gdprStatus = localStorage.getItem("gdpr_status");
        if (!gdprStatus) {
            setTimeout(showGDPRBanner, 1000);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener("DOMContentLoaded", initGDPR);
    } else {
        initGDPR();
    }
})();

function showGDPRBanner() {
    // Check if banner already exists
    if (document.getElementById('gdpr-banner')) return;

    // Create container
    const banner = document.createElement("div");
    banner.id = "gdpr-banner";
    banner.className = "gdpr-banner";

    // Icon SVG (Cookie icon)
    const cookieIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cookie"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg>
    `;

    // Add content
    banner.innerHTML = `
        <div class="gdpr-content">
            <div class="gdpr-icon-wrapper">
                ${cookieIcon}
            </div>
            <div class="gdpr-text">
                <h3 class="gdpr-title">We value your privacy</h3>
                <p class="gdpr-message">
                    We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. 
                    By clicking "Accept All", you consent to our use of cookies.
                    <a href="privacy-policy.html" class="gdpr-link">Read More</a>
                </p>
            </div>
        </div>
        <div class="gdpr-actions">
            <button id="gdpr-reject" class="ul-btn gdpr-btn-reject">Reject All</button>
            <button id="gdpr-accept" class="ul-btn gdpr-btn-accept">Accept All</button>
        </div>
    `;

    document.body.appendChild(banner);

    // Trigger animation
    requestAnimationFrame(() => {
        banner.classList.add('show');
    });

    // Event listeners
    document.getElementById("gdpr-accept").addEventListener("click", () => {
        localStorage.setItem("gdpr_status", "accepted");
        removeGDPRBanner();
    });

    document.getElementById("gdpr-reject").addEventListener("click", () => {
        localStorage.setItem("gdpr_status", "rejected");
        removeGDPRBanner();
    });
}

function removeGDPRBanner() {
    const banner = document.getElementById("gdpr-banner");
    if (banner) {
        banner.classList.remove("show");
        // Remove from DOM after transition
        setTimeout(() => banner.remove(), 500);
    }
}
