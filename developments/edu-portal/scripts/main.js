/* Main UI Scripts */

document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const menuToggle = document.getElementById('mobile-menu');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');

            // Toggle icon betwen bars and times
            const icon = menuToggle.querySelector('i');
            if (icon.classList.contains('fa-bars')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Scroll Header effect (optional)
    window.addEventListener('scroll', () => {
        const header = document.querySelector('header');
        if (window.scrollY > 50) {
            header.style.boxShadow = "var(--shadow-md)";
        } else {
            header.style.boxShadow = "var(--shadow-sm)";
        }
    });

    // Apply Site Settings
    applySiteSettings();
});

async function applySiteSettings() {
    // 1. Try Local Storage first for speed
    const cached = localStorage.getItem('siteSettings');
    if (cached) {
        applySettingsToDOM(JSON.parse(cached));
    }

    // 2. Fetch from DB (needs DB to be ready)
    // We poll briefly for DB availability since it's loaded via module
    const maxRetries = 20;
    let attempts = 0;

    const checkDB = setInterval(async () => {
        attempts++;
        if (window.DB && window.DB.getSiteSettings) {
            clearInterval(checkDB);
            try {
                const settings = await window.DB.getSiteSettings();
                if (settings) {
                    localStorage.setItem('siteSettings', JSON.stringify(settings));
                    applySettingsToDOM(settings);
                }
            } catch (e) {
                console.error("Failed to sync site settings", e);
            }
        } else if (attempts > maxRetries) {
            clearInterval(checkDB);
        }
    }, 200);
}

function applySettingsToDOM(settings) {
    if (!settings) return;
    window.applySettingsToDOM = applySettingsToDOM;

    // Site Name (Title & Logo Text)
    if (settings.siteName) {
        if (!document.title.includes(' - ')) {
            // Document title might be just "Page Name" or "Page Name - OldName"
            // We try to preserve the prefix
            const parts = document.title.split(' - ');
            if (parts.length > 0) document.title = `${parts[0]} - ${settings.siteName}`;
        } else {
            const parts = document.title.split(' - ');
            document.title = `${parts[0]} - ${settings.siteName}`;
        }
    }

    // Logo (Image or Text)
    const logoEls = document.querySelectorAll('.logo');
    logoEls.forEach(el => {
        if (settings.logoUrl) {
            // If it's an image URL, verify if we should replace text or icon
            // Simple approach: Use image tag
            const size = settings.logoSize || '30px';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.gap = '12px';
            el.innerHTML = `<img src="${settings.logoUrl}" alt="${settings.siteName || 'Logo'}" style="height: ${size}; width: auto; object-fit: contain;"> <span>${settings.siteName || ''}</span>`;
        } else if (settings.siteName) {
            // Just text update
            // Keep icon if present? The user request implies replacing logic.
            // Let's keep the Graduation Cap icon if no logo URL, but update text
            const icon = el.querySelector('i');
            const iconHtml = icon ? icon.outerHTML : '<i class="fas fa-graduation-cap"></i>';
            el.innerHTML = `${iconHtml} ${settings.siteName}`;
        }
    });

    // Color Theme
    if (settings.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
        // We might want to auto-calculate the secondary or hover colors, but simpler is best for now.
        // Or if we want to be fancy, we can set --accent-color to a complementary or same.
    }
}
