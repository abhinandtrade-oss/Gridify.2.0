/* Main UI Scripts */

document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const menuToggle = document.getElementById('mobile-menu');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('mobile-active');

            // Toggle icon between bars and times
            const icon = menuToggle.querySelector('i');
            if (icon.classList.contains('fa-bars')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });

        // Close menu when clicking links
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('mobile-active');
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            });
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

    // Check for Live Class
    checkLiveClass();
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
        // Robust Title Replacement: Replace "EduPortal" wherever it appears
        if (document.title.includes('EduPortal')) {
            document.title = document.title.replace('EduPortal', settings.siteName);
        } else if (!document.title.includes(settings.siteName)) {
            // If EduPortal isn't found but we want to ensure the new name is there (e.g. appended)
            // For now, replacing EduPortal is the safest bet to avoid duplicating names if script runs twice.
        }
    }

    // Logo (Image or Text)
    const logoEls = document.querySelectorAll('.logo');
    logoEls.forEach(el => {
        if (settings.logoUrl) {
            const size = settings.logoSize || '30px';
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.gap = '12px';
            el.innerHTML = `<img src="${settings.logoUrl}" alt="${settings.siteName || 'Logo'}" style="height: ${size}; width: auto; object-fit: contain;"> <span>${settings.siteName || ''}</span>`;
        } else if (settings.siteName) {
            const icon = el.querySelector('i');
            const iconHtml = icon ? icon.outerHTML : '<i class="fas fa-graduation-cap"></i>';
            el.innerHTML = `${iconHtml} ${settings.siteName}`;
        }
    });

    // Color Theme
    if (settings.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
        // Set hover to same color to maintain consistency if no darker shade available
        // Ideally we would calculate a derived color, but this prevents "Red to Indigo" gradients
        document.documentElement.style.setProperty('--primary-hover', settings.primaryColor);
    }

    // Favicon
    if (settings.logoUrl) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = settings.logoUrl;
    }

    // Update Footer and Hero Names
    if (settings.siteName) {
        const footerNameEl = document.getElementById('footer-site-name');
        if (footerNameEl) footerNameEl.innerText = settings.siteName;

        const footerCopyNameEl = document.getElementById('footer-copy-name');
        if (footerCopyNameEl) footerCopyNameEl.innerText = settings.siteName;

        const heroNameEl = document.getElementById('hero-site-name');
        if (heroNameEl) heroNameEl.innerText = settings.siteName;

        const authNameEl = document.getElementById('auth-site-name');
        if (authNameEl) authNameEl.innerText = settings.siteName;
    }
}

// Global Enroll/Unenroll Functions (Used in Index and Courses pages)
window.enroll = async (e, courseId) => {
    if (!Auth.currentUser) {
        // Redirect to login with return url
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `auth/login.html?redirect=${returnUrl}`;
        return;
    }
    const btn = e.target.closest('button'); // Ensure we get the button if icon is clicked
    if (!btn) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    try {
        const res = await window.DB.enrollUserInCourse(Auth.currentUser.uid, courseId);
        if (res.success) {
            if (res.pendingVerification) {
                Auth.showToast(res.message, 'info');
            } else {
                Auth.showToast('Enrolled Successfully!', 'success');
            }
            // Reload to update UI state
            setTimeout(() => window.location.reload(), 1500);
        } else {
            Auth.showToast(res.message, 'info');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    } catch (err) {
        console.error(err);
        Auth.showToast(err.message, 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.unenroll = async (e, courseId) => {
    if (!confirm('Are you sure you want to unenroll?')) return;
    try {
        const res = await window.DB.unenrollUserFromCourse(Auth.currentUser.uid, courseId);
        if (res.success) {
            Auth.showToast('Unenrolled Successfully', 'success');
            setTimeout(() => window.location.reload(), 1000);
        }
    } catch (err) {
        Auth.showToast(err.message, 'error');
    }
};

// Featured Courses Logic for Index Page
document.addEventListener('DOMContentLoaded', () => {
    const featuredList = document.getElementById('featured-courses');
    if (featuredList) {
        loadFeaturedCourses(featuredList);
    }
});

async function loadFeaturedCourses(list) {
    // Show Loading
    list.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p>Loading courses...</p>
        </div>`;

    // Wait for DB and Auth to be ready
    let attempts = 0;
    const waitForResources = setInterval(async () => {
        attempts++;
        // Check if DB, DB.getCourses, and Auth are ready
        // We also need to wait for Auth to determine currentUser state, 
        // but Auth.currentUser might be null if not logged in.
        // We rely on window.auth.onAuthStateChanged logic internally or just check readiness.
        // For simplicity, we just wait for the DB methods.
        // Auth state is reactive, but we need an initial read.

        if (window.DB && window.DB.getCourses && window.auth) {
            clearInterval(waitForResources);

            // Wait a bit more for Auth state to settle if needed, or use listener
            window.auth.onAuthStateChanged(async (user) => {
                await renderFeaturedCourses(list, user);
            });

        } else if (attempts > 50) { // 10 seconds
            clearInterval(waitForResources);
            list.innerHTML = '<p style="grid-column: 1 / -1; text-align:center;">Unable to load courses.</p>';
        }
    }, 200);
}

async function renderFeaturedCourses(list, user) {
    try {
        const courses = await window.DB.getCourses();

        // Filter: Active only
        const activeCourses = courses.filter(c => c.status !== 'inactive');

        // Sort: We want "latest"
        activeCourses.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
        });

        // Take top 3
        const featured = activeCourses.slice(0, 3);

        if (featured.length === 0) {
            list.innerHTML = '<p style="grid-column: 1 / -1; text-align:center;">No courses available at the moment.</p>';
            return;
        }

        // Get User Enrollment Data if logged in
        let enrolledIds = [];
        let pendingIds = [];

        if (user) {
            try {
                const doc = await window.db.collection('users').doc(user.uid).get();
                if (doc.exists) {
                    enrolledIds = doc.data().enrolledCourses || [];
                }
                const requests = await window.DB.getPaymentRequests(user.uid);
                pendingIds = requests.filter(r => r.status === 'pending').map(r => r.courseId);
            } catch (e) {
                console.error("Error fetching user data", e);
            }
        }

        list.innerHTML = '';

        featured.forEach(course => {
            const isPremium = course.isPremium;
            const price = course.price;
            const isFree = !isPremium || price === 0;

            const priceBadge = isFree
                ? `<span class="badge badge-success">Free</span>`
                : `<span class="badge" style="background:#8b5cf6; color:white;">₹${price}</span>`;

            const premiumBadge = isPremium
                ? `<span class="badge badge-warning" style="box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><i class="fas fa-crown" style="margin-right:4px;"></i> Premium</span>`
                : ``;

            let btnHtml = '';

            if (!user) {
                btnHtml = `<a href="courses.html" class="btn btn-secondary" style="width:100%">View Details</a>`;
            } else {
                if (enrolledIds.includes(course.id)) {
                    btnHtml = `
                        <a href="dashboard/index.html" class="btn btn-success" style="width:100%; justify-content:center;">
                            Enrolled <i class="fas fa-check"></i>
                        </a>`;
                } else if (pendingIds.includes(course.id)) {
                    btnHtml = `
                        <button class="btn btn-secondary" style="width:100%; cursor: default; justify-content:center;" disabled>
                            <i class="fas fa-clock"></i> Verification Pending
                        </button>`;
                } else {
                    btnHtml = `<button onclick="enroll(event, '${course.id}')" class="btn btn-primary" style="width:100%; justify-content:center;">Enroll Now</button>`;
                }
            }

            // Enhanced Card Design
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-image" style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); height: 200px; display: flex; align-items: center; justify-content: center; position: relative;">
                     ${premiumBadge ? `<div style="position: absolute; top: 12px; right: 12px;">${premiumBadge}</div>` : ''}
                     <i class="fas fa-graduation-cap fa-4x" style="color: var(--primary-color); opacity: 0.8;"></i>
                </div>
                <div class="card-body">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem;">
                     <span class="badge badge-secondary">${course.category || 'General'}</span>
                     ${priceBadge}
                  </div>
                  <h3 class="card-title">${course.title}</h3>
                  <p class="card-text">${course.description ? course.description.substring(0, 90) + '...' : 'No description available.'}</p>
                  <div class="card-footer">
                     ${btnHtml}
                  </div>
                </div>
            `;
            list.appendChild(card);
        });

    } catch (e) {
        console.error("Error loading featured courses", e);
        list.innerHTML = '<p style="grid-column: 1 / -1; text-align:center;">Error loading courses.</p>';
    }
}

async function checkLiveClass() {
    try {
        // Wait for DB availability (since it's loaded as module)
        if (!window.DB || !window.DB.getActiveLiveClass) {
            setTimeout(checkLiveClass, 500); // Retry
            return;
        }

        const liveSession = await window.DB.getActiveLiveClass();

        // 1. Handle Banner (Global)
        const banner = document.getElementById('live-banner');
        if (liveSession && banner) {
            banner.classList.remove('hidden');
            const titleEl = document.getElementById('live-title');
            if (titleEl) titleEl.innerText = liveSession.title;

            // Update link
            const linkEl = banner.querySelector('a');
            if (linkEl) {
                // Determine state
                const user = window.auth ? window.auth.currentUser : null;
                if (!user) {
                    linkEl.innerHTML = '<i class="fas fa-lock"></i> Login to Watch 🔴';
                    linkEl.onclick = (e) => {
                        e.preventDefault();
                        window.location.href = 'auth/login.html?redirect=' + encodeURIComponent(window.location.href);
                    };
                    linkEl.removeAttribute('href'); // Avoid default click
                    linkEl.style.cursor = 'pointer';
                } else {
                    linkEl.innerHTML = 'Join Stream 🔴';
                    linkEl.href = 'dashboard/index.html'; // Redirect to dashboard
                    linkEl.target = '_self';
                    linkEl.onclick = null;
                }
            }
        } else if (banner) {
            banner.classList.add('hidden');
        }

        // 2. Handle Preview Section (Index Page Only)
        const previewSection = document.getElementById('live-preview-section');
        if (previewSection) {
            if (liveSession) {
                previewSection.classList.remove('hidden');
                previewSection.style.display = 'block'; // Ensure visibility
                document.getElementById('live-preview-title').innerText = liveSession.title;
                document.getElementById('live-preview-desc').innerText = liveSession.description || '';

                // Badges
                const metaContainer = document.getElementById('live-preview-meta');
                if (metaContainer) {
                    metaContainer.innerHTML = `
                        <span class="badge badge-secondary">${liveSession.category || 'General'}</span>
                        ${liveSession.courseTitle ? `<span class="badge" style="background:#e0e7ff; color:var(--primary-color);">${liveSession.courseTitle}</span>` : ''}
                    `;
                }

                // Video Embed
                let videoId = '';
                try {
                    // Updated regex to include 'live/' format commonly used for live streams
                    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/)([^#\&\?]*).*/;
                    const match = liveSession.youtubeLink.match(regExp);
                    if (match && match[2].length === 11) videoId = match[2];
                    else {
                        console.warn("Could not extract video ID from:", liveSession.youtubeLink);
                    }
                } catch (e) {
                    console.error("Regex error:", e);
                }

                const iframe = document.getElementById('live-preview-frame');
                if (iframe) {
                    if (videoId) {
                        const newSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}`;
                        if (iframe.src !== newSrc) iframe.src = newSrc;
                    }
                }

                // CTA Logic
                const ctaContainer = document.getElementById('live-preview-cta');
                const user = window.auth ? window.auth.currentUser : null;

                if (user) {
                    ctaContainer.innerHTML = `
                        <h3 style="margin-bottom: 0.5rem; font-size: 1.5rem;">Instructor is Live!</h3>
                        <p style="margin-bottom: 1.5rem; opacity: 0.9;">Click below to watch on your dashboard.</p>
                    `;
                    const joinBtn = document.createElement('button');
                    joinBtn.className = 'btn btn-primary';
                    joinBtn.style.background = 'var(--danger-color)';
                    joinBtn.style.borderColor = 'var(--danger-color)';
                    joinBtn.innerHTML = '<i class="fas fa-play"></i> Watch on Dashboard';

                    joinBtn.onclick = () => {
                        window.location.href = 'dashboard/index.html';
                    };
                    ctaContainer.appendChild(joinBtn);
                } else {
                    ctaContainer.innerHTML = `
                        <h3 style="margin-bottom: 0.5rem; font-size: 1.5rem;">Happening Now!</h3>
                        <p style="margin-bottom: 1.5rem; opacity: 0.9;">Login to join the conversation.</p>
                        <a href="auth/login.html?redirect=index.html" class="btn btn-primary">Login to Join</a>
                    `;
                }

            } else {
                previewSection.classList.add('hidden');
                // clear iframe
                const iframe = document.getElementById('live-preview-frame');
                if (iframe) iframe.src = '';
            }
        }

    } catch (e) {
        console.log("Live check info:", e);
    }
}

// Add Auth Listener to update UI when login state resolves
document.addEventListener('DOMContentLoaded', () => {
    // We poll for auth capability
    const waitAuth = setInterval(() => {
        if (window.auth) {
            clearInterval(waitAuth);
            window.auth.onAuthStateChanged((user) => {
                checkLiveClass(); // Re-run when state changes
                updateCTASection(user);
            });
        }
    }, 200);
});

function updateCTASection(user) {
    const title = document.getElementById('cta-title');
    const desc = document.getElementById('cta-desc');
    const btn = document.getElementById('cta-btn');

    if (!title || !desc || !btn) return;

    if (user) {
        title.innerText = "Spread the Knowledge";
        desc.innerText = "Invite your friends to join our learning community and help them achieve their goals.";
        btn.innerHTML = '<i class="fas fa-share-alt"></i> Refer a Friend';

        // Remove existing href to prevent navigation
        btn.removeAttribute('href');

        btn.onclick = async (e) => {
            e.preventDefault();
            const url = window.location.origin;
            const shareData = {
                title: 'EduPortal',
                text: 'Join me on EduPortal and start learning today!',
                url: url
            };

            const originalHtml = btn.innerHTML;
            let copied = false;

            // 1. Try Clipboard API
            if (navigator.clipboard) {
                try {
                    await navigator.clipboard.writeText(url);
                    copied = true;
                    btn.innerHTML = '<i class="fas fa-check"></i> Copied & Shared!';
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-success');
                } catch (err) {
                    console.error('Could not copy text: ', err);
                }
            }

            // 2. Try Native Share API
            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (err) {
                    // Start sharing failed or was cancelled by user
                    console.log('Share API skipped or cancelled:', err);
                }
            } else if (!copied) {
                // Fallback if both failed (or clipboard failed and no share)
                prompt("Copy this link to share:", url);
            }

            // Reset UI after delay
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.classList.remove('btn-success');
                btn.classList.add('btn-primary');
            }, 3000);
        };
    } else {
        title.innerText = "Ready to Start Learning?";
        desc.innerText = "Join our community of lifelong learners today and take the first step towards your goals.";
        btn.innerText = "Create Free Account";
        btn.href = "auth/signup.html";
        btn.onclick = null;
    }
}

// Radial Menu Logic
document.addEventListener('DOMContentLoaded', () => {
    const radialToggle = document.getElementById('radial-toggle');
    const radialMenu = document.getElementById('referral-radial-menu');

    if (radialToggle && radialMenu) {
        radialToggle.addEventListener('click', () => {
            radialMenu.classList.toggle('active');
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!radialMenu.contains(e.target)) {
                radialMenu.classList.remove('active');
            }
        });
    }
});

async function shareReferral(platform) {
    const url = window.location.origin;
    const text = 'Join me on EduPortal and start learning today!';

    // Toggle menu off
    const radialMenu = document.getElementById('referral-radial-menu');
    if (radialMenu) radialMenu.classList.remove('active');

    if (platform === 'copy') {
        try {
            await navigator.clipboard.writeText(url);
            if (window.Auth && window.Auth.showToast) {
                window.Auth.showToast('Referral link copied to clipboard!', 'success');
            } else {
                alert('Referral link copied to clipboard!');
            }
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    } else if (platform === 'whatsapp') {
        const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`;
        window.open(whatsappUrl, '_blank');
    } else if (platform === 'email') {
        const mailtoUrl = `mailto:?subject=Join EduPortal&body=${encodeURIComponent(text + '\n' + url)}`;
        window.location.href = mailtoUrl;
    }
}
