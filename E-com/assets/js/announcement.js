/**
 * Announcement Management for Index Page (Banner focused)
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;

    async function getAnnouncement() {
        const now = new Date();

        // 1. Try local storage first (cache)
        const localData = JSON.parse(localStorage.getItem('glamer_announcement_config') || '{}');

        // Handle Banner
        const homeConfig = localData.home || (localData.type === 'banner' ? localData : null);
        if (homeConfig && isValid(homeConfig, now)) {
            displayBannerAnnouncement(homeConfig);
        }

        // Handle Alerts
        if (localData.alerts) {
            handleAlertPopups(localData.alerts, now);
        }

        // 2. Fetch fresh data from Supabase
        if (client) {
            try {
                const { data } = await client
                    .from('site_settings')
                    .select('value')
                    .eq('key', 'announcement_config')
                    .single();

                if (data && data.value) {
                    const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;

                    // Banner Fresh
                    const homeConfig = config.home || (config.type === 'banner' ? config : null);
                    if (homeConfig && isValid(homeConfig, now)) {
                        displayBannerAnnouncement(homeConfig);
                    } else {
                        hideAnnouncement();
                    }

                    // Alerts Fresh
                    if (config.alerts) {
                        handleAlertPopups(config.alerts, now);
                    }

                    localStorage.setItem('glamer_announcement_config', JSON.stringify(config));
                }
            } catch (err) {
                console.warn('Announcement: Could not fetch from server.');
            }
        }
    }

    function isValid(config, now) {
        if (!config.content && (!config.banners || config.banners.length === 0)) return false;
        const start = config.start ? new Date(config.start) : null;
        const end = config.end ? new Date(config.end) : null;
        if (start && now < start) return false;
        if (end && now > end) return false;
        return true;
    }

    // --- POPUP ALERT LOGIC ---
    let activeAlerts = [];
    let currentAlertIndex = 0;

    function handleAlertPopups(alerts, now) {
        // Filter active ones
        activeAlerts = alerts.filter(a => {
            if (!a.content) return false;
            const start = a.start ? new Date(a.start) : null;
            const end = a.end ? new Date(a.end) : null;
            if (start && now < start) return false;
            if (end && now > end) return false;
            return true;
        });

        if (activeAlerts.length > 0) {
            showNextAlert();
        }
    }

    function showNextAlert() {
        if (currentAlertIndex >= activeAlerts.length) return;

        const alert = activeAlerts[currentAlertIndex];
        const overlayId = `glamer-alert-overlay-${currentAlertIndex}`;

        if (document.getElementById(overlayId)) return;

        const overlay = document.createElement('div');
        overlay.id = overlayId;
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 99999; backdrop-filter: blur(5px);
            opacity: 0; transition: opacity 0.3s ease;
        `;

        let contentHtml = '';
        if (alert.type === 'image') {
            contentHtml = `<img src="${alert.content}" style="max-width: 100%; max-height: 80vh; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">`;
        } else {
            contentHtml = `
                <div style="background: white; padding: 40px; border-radius: 20px; max-width: 500px; width: 90%; text-align: center; position: relative; box-shadow: 0 20px 50px rgba(0,0,0,0.3);">
                    <div style="font-size: 24px; font-weight: 700; color: #1e293b; margin-bottom: 15px;">Announcement</div>
                    <div style="font-size: 16px; color: #64748b; line-height: 1.6;">${alert.content}</div>
                </div>
            `;
        }

        const container = document.createElement('div');
        container.style.cssText = `position: relative; max-width: 90%; transform: scale(0.8); transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);`;

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.style.cssText = `
            position: absolute; top: -20px; right: -20px; width: 40px; height: 40px;
            background: #f43f5e; color: white; border: none; border-radius: 50%;
            font-size: 24px; cursor: pointer; display: flex; align-items: center;
            justify-content: center; box-shadow: 0 5px 15px rgba(244, 63, 94, 0.4); z-index: 10;
        `;

        if (alert.link) {
            const link = document.createElement('a');
            link.href = alert.link;
            link.style.textDecoration = 'none';
            link.innerHTML = contentHtml;
            container.appendChild(link);
        } else {
            container.innerHTML = contentHtml;
        }

        container.appendChild(closeBtn);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // Animate in
        setTimeout(() => {
            overlay.style.opacity = '1';
            container.style.transform = 'scale(1)';
        }, 10);

        const closeFunc = () => {
            overlay.style.opacity = '0';
            container.style.transform = 'scale(0.8)';
            setTimeout(() => {
                overlay.remove();
                currentAlertIndex++;
                showNextAlert();
            }, 300);
        };

        closeBtn.onclick = closeFunc;
        overlay.onclick = (e) => { if (e.target === overlay) closeFunc(); };
    }

    function displayBannerAnnouncement(config) {
        const bannerSection = document.getElementById('index-announcement-banner');
        if (!bannerSection) return;

        const banners = config.banners || [];
        if (banners.length === 0 && config.content) {
            // Fallback for old single banner format
            banners.push({ image: config.content, link: config.link });
        }

        if (banners.length === 0) {
            bannerSection.style.display = 'none';
            return;
        }

        bannerSection.style.display = 'block';

        // Create Splide HTML structure
        let slidesHtml = banners.map(b => `
            <li class="splide__slide">
                ${b.link ? `<a href="${b.link}">` : ''}
                <img src="${b.image}" alt="Announcement Banner" style="width: 100%; height: auto; border-radius: 12px; object-fit: cover;">
                ${b.link ? `</a>` : ''}
            </li>
        `).join('');

        bannerSection.innerHTML = `
            <div class="ul-container py-4">
                <div class="splide index-banner-carousel">
                    <div class="splide__track">
                        <ul class="splide__list">
                            ${slidesHtml}
                        </ul>
                    </div>
                </div>
            </div>
        `;

        // Initialize Splide if available
        if (window.Splide) {
            new Splide('.index-banner-carousel', {
                type: 'loop',
                autoplay: true,
                interval: 3000, // 3 seconds
                pauseOnHover: true,
                arrows: banners.length > 1,
                pagination: banners.length > 1,
                speed: 800,
                easing: 'ease'
            }).mount();
        }
    }

    function hideAnnouncement() {
        const bannerSection = document.getElementById('index-announcement-banner');
        if (bannerSection) {
            bannerSection.style.display = 'none';
        }
    }

    getAnnouncement();
});
