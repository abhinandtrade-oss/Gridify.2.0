/**
 * M.G. University Inter Zone Powerlifting Championship
 * Official Website Script
 */

// Supabase Configuration (Replace with your actual credentials)
const SUPABASE_URL = 'https://rcmeifutgontewyycivi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_aJ9CPJVCp3cM1lUVrjOKFA_Yrx-jDe4';

// Initialize Supabase if credentials are provided
window.supabaseClient = (typeof window.supabase !== 'undefined')
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
const supabaseClient = window.supabaseClient;

/**
 * Sponsors & Partners Section
 */
async function initSponsors() {
    const section = document.getElementById('sponsors-section');
    const container = document.getElementById('sponsors-container');
    if (!section || !container || !supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('sponsors')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) {
            section.style.display = 'none';
            return;
        }

        container.innerHTML = data.map((sponsor, index) => `
            <a href="${sponsor.website_url}" target="_blank" class="sponsor-banner ${index === 0 ? 'active' : ''}">
                <img src="${sponsor.image_url}" alt="${sponsor.name}" 
                     onload="document.getElementById('sponsors-section').style.display = 'block';">
            </a>
        `).join('');

        // Rotation Logic
        if (data.length > 1) {
            let currentIndex = 0;
            const banners = container.querySelectorAll('.sponsor-banner');

            setInterval(() => {
                banners[currentIndex].classList.remove('active');
                currentIndex = (currentIndex + 1) % banners.length;
                banners[currentIndex].classList.add('active');
            }, 2000); // 2 seconds interval
        }

        // The section will be shown if at least one image loads (see onload above)
    } catch (err) {
        console.error('Sponsor loading error:', err);
        section.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize toast container
    if (!document.querySelector('.toast-container')) {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    await loadComponents();
    initMobileMenu();
    updateAuthUI();
    initRegistrationForm();
    initAuthForms();
    highlightActiveLink();
    initCookieBanner();
    if (document.getElementById('sponsors-section')) initSponsors();
    initAnnouncements();
    initHeroSlideshow();
});


/**
 * Announcement System
 */
let announcementQueue = [];

async function initAnnouncements() {
    // Check if we are on the home page by looking for unique sections
    const isHomePage = document.querySelector('.highlights') && document.querySelector('.competition-details');
    if (!isHomePage || !supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error || !data || data.length === 0) return;

        announcementQueue = data;
        showNextAnnouncement();
    } catch (err) {
        console.error('Announcement error:', err);
    }
}

function showNextAnnouncement() {
    if (announcementQueue.length === 0) return;
    const next = announcementQueue.shift();
    showAnnouncementModal(next);
}

function showAnnouncementModal(announcement) {
    // Remove existing if any
    const existing = document.getElementById('announcementModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'announcementModal';
    overlay.style.display = 'flex';
    overlay.style.zIndex = '9999';
    overlay.style.backdropFilter = 'blur(8px)';

    let contentHTML = '';

    if (announcement.type === 'image') {
        contentHTML = `
            <div style="position: relative; max-width: 800px; width: 90%; background: transparent; padding: 0; outline: none;">
                <button onclick="closeAnnouncement()" style="position: absolute; top: -15px; right: -15px; background: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-weight: bold; color: #333; z-index: 10; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">&times;</button>
                ${announcement.link ? `<a href="${announcement.link}" target="_blank" style="display: block;">` : ''}
                <img src="${announcement.content}" alt="Announcement" style="width: 100%; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.4); display: block; max-height: 85vh; object-fit: contain; background: white;">
                ${announcement.link ? `</a>` : ''}
            </div>
        `;
    } else {
        contentHTML = `
            <div class="modal-content" style="max-width: 500px; width: 90%; text-align: left; position: relative;">
                <button onclick="closeAnnouncement()" style="position: absolute; top: 15px; right: 15px; background: transparent; border: none; font-size: 1.5rem; cursor: pointer; color: #9ca3af; line-height: 1;">&times;</button>
                <div class="modal-icon" style="background: #eff6ff; color: #3b82f6; margin: 0 auto 1.5rem;">
                   <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                </div>
                <h3 class="modal-title" style="text-align: center; margin-bottom: 1rem;">Announcement</h3>
                <div class="modal-text" style="color: #1f2937; font-size: 1rem; text-align: center; white-space: pre-wrap; line-height: 1.6; margin-bottom: 2rem;">${announcement.content}</div>
                ${announcement.link ? `
                    <div style="text-align: center;">
                        <a href="${announcement.link}" target="_blank" class="btn btn-primary" style="width: 100%; display: block; text-align: center;">Learn More</a>
                    </div>
                ` : ''}
            </div>
        `;
    }

    overlay.innerHTML = contentHTML;
    document.body.appendChild(overlay);

    // Fade in animation
    overlay.animate([
        { opacity: 0 },
        { opacity: 1 }
    ], {
        duration: 300,
        easing: 'ease-out'
    });

    window.closeAnnouncement = () => {
        const el = document.getElementById('announcementModal');
        if (el) {
            el.animate([
                { opacity: 1 },
                { opacity: 0 }
            ], {
                duration: 200,
                easing: 'ease-in'
            }).onfinish = () => {
                el.remove();
                // Show next announcement after a short delay
                setTimeout(showNextAnnouncement, 300);
            };
        }
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) window.closeAnnouncement();
    });
}

/**
 * GDPR Cookie Consent Banner
 */
function initCookieBanner() {
    if (localStorage.getItem('cookieConsent')) return;

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML = `
        <div class="cookie-content">
            <h4>Cookie Consent</h4>
            <p>We use cookies to enhance your experience and analyze our traffic. By clicking "Accept", you consent to our use of cookies. <a href="privacy.html">Learn more</a></p>
        </div>
        <div class="cookie-buttons">
            <button class="cookie-btn btn-settings" id="declineCookies">Decline</button>
            <button class="cookie-btn btn-accept" id="acceptCookies">Accept</button>
        </div>
    `;

    document.body.appendChild(banner);

    // Show with slight delay
    setTimeout(() => banner.classList.add('show'), 1000);

    document.getElementById('acceptCookies').addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'accepted');
        banner.classList.remove('show');
        setTimeout(() => banner.remove(), 600);
    });

    document.getElementById('declineCookies').addEventListener('click', () => {
        localStorage.setItem('cookieConsent', 'declined');
        banner.classList.remove('show');
        setTimeout(() => banner.remove(), 600);
    });
}

/**
 * Custom Portal Notification System
 */
function showToast(message, type = 'success') {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const successIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    const errorIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;

    const icon = type === 'success' ? successIcon : errorIcon;
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <p>${message}</p>`;

    container.appendChild(toast);

    // Remove toast after 5 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/**
 * Public Prominent Alert Modal
 */
function showAlert(title, message) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'dynamicModal';

    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-icon">!</div>
            <h3 class="modal-title">${title}</h3>
            <p class="modal-text">${message}</p>
            <button class="modal-btn" onclick="document.getElementById('dynamicModal').remove()">I Understand</button>
        </div>
    `;

    document.body.appendChild(overlay);
    overlay.style.display = 'flex';

    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
}

/**
 * Load Header and Footer Dynamically
 */
async function loadComponents() {
    const header = document.querySelector('header');
    const footer = document.querySelector('footer');

    if (header) {
        const response = await fetch('header.html');
        header.innerHTML = await response.text();
    }

    if (footer) {
        const response = await fetch('footer.html');
        footer.innerHTML = await response.text();
    }
}

/**
 * Highlight Active Navigation Link
 */
function highlightActiveLink() {
    const path = window.location.pathname.split("/").pop() || 'index.html';
    const navIdMap = {
        'index.html': 'nav-home',
        'about.html': 'nav-about',
        'rules.html': 'nav-rules',
        'register.html': 'nav-register',
        'schedule.html': 'nav-schedule',
        'live-score.html': 'nav-live',
        'contact.html': 'nav-contact'
    };

    const activeId = navIdMap[path];
    if (activeId) {
        const activeLink = document.getElementById(activeId);
        if (activeLink) activeLink.classList.add('active');
    }
}

/**
 * Update UI based on Auth State
 */
async function updateAuthUI() {
    if (!supabaseClient) return;

    const { data: { user } } = await supabaseClient.auth.getUser();
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    // Remove any existing auth-related buttons to prevent duplicates
    const existingAuthBtn = document.querySelector('.auth-btn-nav');
    if (existingAuthBtn) existingAuthBtn.remove();

    const li = document.createElement('li');
    li.className = 'auth-btn-nav';

    if (user) {
        const userName = user.user_metadata?.full_name || user.email.split('@')[0];
        li.innerHTML = `
            <div class="user-profile-dropdown" id="userProfileToggle">
                <div class="user-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                </div>
                <span class="user-name">${userName}</span>
                <span class="dropdown-arrow">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 9l6 6 6-6"></path>
                    </svg>
                </span>
                
                <div class="dropdown-menu" id="userDropdown">
                    <a href="profile.html" class="dropdown-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        My Profile
                    </a>
                    <a href="#" class="dropdown-item" id="logoutBtn" style="color: #dc3545;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        Logout
                    </a>
                </div>
            </div>
        `;
        navLinks.appendChild(li);

        const toggle = document.getElementById('userProfileToggle');
        const menu = document.getElementById('userDropdown');

        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
            const arrow = toggle.querySelector('.dropdown-arrow');
            if (arrow) arrow.style.transform = menu.classList.contains('show') ? 'rotate(180deg)' : 'rotate(0)';
        });

        document.addEventListener('click', (e) => {
            if (!toggle.contains(e.target)) {
                menu.classList.remove('show');
                const arrow = toggle.querySelector('.dropdown-arrow');
                if (arrow) arrow.style.transform = 'rotate(0)';
            }
        });

        document.getElementById('logoutBtn').addEventListener('click', async (e) => {
            e.preventDefault();
            await supabaseClient.auth.signOut();
            showToast('Logged out successfully.', 'success');
            setTimeout(() => window.location.href = 'index.html', 1000);
        });
    } else {
        li.innerHTML = `<a href="login.html" class="btn btn-primary" style="padding: 0.4rem 1.2rem; margin-top: -5px; color: white;">Login</a>`;
        navLinks.appendChild(li);
    }
}

/**
 * Auth Forms Handler (Login/Signup)
 */
function initAuthForms() {
    const signupForm = document.getElementById('signupForm');
    const loginForm = document.getElementById('loginForm');
    const authMessage = document.getElementById('auth-message');

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(signupForm);
            const { email, password, full_name } = Object.fromEntries(formData);

            authMessage.textContent = 'Creating account...';

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name }
                }
            });

            if (error) {
                if (error.status === 504) {
                    authMessage.textContent = 'Server took too long to respond. This usually happens during email sending. Please check your inbox anyway, or try again in a moment.';
                    showToast('Connection timeout. Please try again.', 'error');
                } else if (error.status === 400 || error.message.includes('already registered')) {
                    authMessage.innerHTML = 'This email already exists. <a href="forgot-password.html" style="color: var(--primary-color); font-weight: 600;">Try resetting your password.</a>';
                    showToast('Email already registered.', 'error');
                } else {
                    authMessage.textContent = error.message;
                    showToast(error.message, 'error');
                }
                authMessage.style.color = 'red';
            } else {
                authMessage.textContent = 'Account created! Please check your email for a confirmation link.';
                authMessage.style.color = 'var(--secondary-color)';
                showToast('Verification email sent! Check your inbox.', 'success');
                signupForm.reset();
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const { email, password } = Object.fromEntries(formData);

            authMessage.textContent = 'Logging in...';

            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                authMessage.textContent = error.message;
                authMessage.style.color = 'red';
                showToast(error.message, 'error');
            } else {
                authMessage.textContent = 'Login successful! Redirecting...';
                authMessage.style.color = 'var(--secondary-color)';
                showToast('Welcome back! Login successful.', 'success');
                setTimeout(() => window.location.href = 'register.html', 1500);
            }
        });
    }

    // Forgot Password Handler
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            authMessage.textContent = 'Sending reset link...';

            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`,
            });

            if (error) {
                authMessage.textContent = error.message;
                authMessage.style.color = 'red';
                showToast(error.message, 'error');
            } else {
                authMessage.textContent = 'Password reset link sent! Please check your email.';
                authMessage.style.color = 'var(--secondary-color)';
                showToast('Reset email sent successfully.', 'success');
                forgotPasswordForm.reset();
            }
        });
    }

    // Reset Password Handler
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('new_password').value;
            const confirmPassword = document.getElementById('confirm_password').value;

            if (newPassword !== confirmPassword) {
                authMessage.textContent = 'Passwords do not match.';
                authMessage.style.color = 'red';
                showToast('Passwords do not match.', 'error');
                return;
            }

            authMessage.textContent = 'Updating password...';

            const { error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                authMessage.textContent = error.message;
                authMessage.style.color = 'red';
                showToast(error.message, 'error');
            } else {
                authMessage.textContent = 'Password updated successfully! Redirecting to login...';
                authMessage.style.color = 'var(--secondary-color)';
                showToast('Password updated. You can now login.', 'success');
                setTimeout(() => window.location.href = 'login.html', 2000);
            }
        });
    }
}

/**
 * Mobile Menu Toggle
 */
function initMobileMenu() {
    const btn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('.nav-links');

    if (btn && nav) {
        btn.addEventListener('click', () => {
            nav.style.display = nav.style.display === 'flex' ? 'none' : 'flex';
            if (nav.style.display === 'flex') {
                nav.style.flexDirection = 'column';
                nav.style.position = 'absolute';
                nav.style.top = '100%';
                nav.style.left = '0';
                nav.style.width = '100%';
                nav.style.background = 'white';
                nav.style.padding = '1rem';
                nav.style.boxShadow = '0 10px 10px rgba(0,0,0,0.1)';
            }
        });
    }
}

/**
 * Registration Form Logic
 */
async function initRegistrationForm() {
    const form = document.getElementById('registrationForm');
    const messageDiv = document.getElementById('form-message');

    if (!form) return;

    // Check if user is logged in
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        const overlay = document.createElement('div');
        overlay.style = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.9); z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 15px;";
        overlay.innerHTML = `
            <h3 style="margin-bottom: 1rem;">Authentication Required</h3>
            <p style="margin-bottom: 1.5rem;">Please login to register for the championship.</p>
            <a href="login.html" class="btn btn-primary">Go to Login</a>
        `;
        form.style.position = 'relative';
        form.appendChild(overlay);
        return;
    }

    // Check for existing registration (Only allow editing if status is Pending)
    const { data: existingReg } = await supabaseClient
        .from('participants')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (existingReg && existingReg.verification_status !== 'Pending') {
        const isApproved = existingReg.verification_status === 'Approved';
        const overlay = document.createElement('div');
        overlay.style = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.95); z-index: 10; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 15px; text-align: center; padding: 2rem;";
        overlay.innerHTML = `
            <div style="font-size: 3rem; margin-bottom: 1rem;">${isApproved ? '✅' : '🔒'}</div>
            <h3 style="margin-bottom: 1rem;">${isApproved ? 'Registration Approved' : 'Modification Locked'}</h3>
            <p style="margin-bottom: 1.5rem;">Editing is disabled for entries with status: <strong>${existingReg.verification_status}</strong>. Please contact our support team for assistance.</p>
            <a href="profile.html" class="btn btn-primary">Return to Profile</a>
        `;
        form.style.position = 'relative';
        form.appendChild(overlay);
        return;
    }

    // Pre-fill form if editing (Pending status only)
    if (existingReg && existingReg.verification_status === 'Pending') {
        const fields = ['full_name', 'college_name', 'dob', 'register_number', 'gender', 'phone', 'age'];
        fields.forEach(field => {
            const el = document.getElementById(field);
            if (el && existingReg[field]) {
                el.value = existingReg[field];
            }
        });

        // Special handling for searchable college select
        const collegeSearchInput = document.getElementById('college_search');
        if (collegeSearchInput && existingReg.college_name) {
            collegeSearchInput.value = existingReg.college_name;
        }

        // Emergency contact split
        const emergencyContact = existingReg.emergency_contact;
        if (emergencyContact) {
            const match = emergencyContact.match(/(.*) \((.*)\)/);
            if (match) {
                const nameInput = document.getElementById('emergency_contact_name');
                const phoneInput = document.getElementById('emergency_contact_phone');
                if (nameInput) nameInput.value = match[1];
                if (phoneInput) phoneInput.value = match[2];
            }
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Update & Resubmit Registration';
        }

        // We'll pre-fill weight_category after loadCategories is defined and called
    }

    // Searchable College Select Logic
    const collegeSearchInput = document.getElementById('college_search');
    const collegeHiddenInput = document.getElementById('college_name');
    const collegeDropdown = document.getElementById('college_dropdown');
    const otherCollegeGroup = document.getElementById('other_college_group');
    const otherCollegeInput = document.getElementById('other_college');
    let allColleges = [];

    async function loadColleges() {
        if (!collegeSearchInput) return;

        const { data: colleges, error } = await supabaseClient
            .from('colleges')
            .select('name')
            .order('name');

        if (error) {
            console.error('Error loading colleges:', error);
            collegeDropdown.innerHTML = '<div class="dropdown-item-select" style="color: red; text-align: center; padding: 1rem;">Error loading colleges</div>';
            return;
        }

        allColleges = colleges.map(c => c.name);
        renderDropdown(allColleges);
    }

    function renderDropdown(list) {
        if (!collegeDropdown) return;
        collegeDropdown.innerHTML = '';

        if (list.length === 0) {
            const noRes = document.createElement('div');
            noRes.className = 'dropdown-item-select';
            noRes.style.color = '#999';
            noRes.style.textAlign = 'center';
            noRes.textContent = 'No matching colleges';
            collegeDropdown.appendChild(noRes);
        } else {
            list.forEach(name => {
                const item = document.createElement('div');
                item.className = 'dropdown-item-select';
                item.textContent = name;
                item.onclick = () => selectCollege(name);
                collegeDropdown.appendChild(item);
            });
        }

        // Add Other option at the bottom
        const otherItem = document.createElement('div');
        otherItem.className = 'dropdown-item-select other-option';
        otherItem.textContent = 'Other (College not listed)';
        otherItem.onclick = () => selectOther();
        collegeDropdown.appendChild(otherItem);
    }

    function selectCollege(name) {
        collegeSearchInput.value = name;
        collegeHiddenInput.value = name;
        collegeDropdown.style.display = 'none';
        otherCollegeGroup.style.display = 'none';
        otherCollegeInput.required = false;

        // Remove error styling if focus was on hidden input
        collegeSearchInput.style.borderColor = '';
    }

    function selectOther() {
        collegeSearchInput.value = 'Other';
        collegeHiddenInput.value = 'Other';
        collegeDropdown.style.display = 'none';
        otherCollegeGroup.style.display = 'block';
        otherCollegeInput.required = true;
        otherCollegeInput.focus();
    }

    if (collegeSearchInput) {
        collegeSearchInput.addEventListener('focus', () => {
            collegeDropdown.style.display = 'block';
            if (collegeSearchInput.value === 'Other') {
                renderDropdown(allColleges);
            }
        });

        collegeSearchInput.addEventListener('input', () => {
            const val = collegeSearchInput.value.toLowerCase();
            if (val === 'other') {
                renderDropdown(allColleges);
            } else {
                const filtered = allColleges.filter(c => c.toLowerCase().includes(val));
                renderDropdown(filtered);
            }
            collegeDropdown.style.display = 'block';

            // If user types something not in list, we don't automatically select it.
            // They must choose a list item or "Other".
            collegeHiddenInput.value = '';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.searchable-select')) {
                collegeDropdown.style.display = 'none';

                // If they clicked away and didn't select anything valid, but typed something
                if (collegeHiddenInput.value === '' && collegeSearchInput.value !== '') {
                    // Check if what they typed exactly matches a college
                    const exactMatch = allColleges.find(c => c.toLowerCase() === collegeSearchInput.value.toLowerCase());
                    if (exactMatch) {
                        selectCollege(exactMatch);
                    }
                }
            }
        });
    }

    await loadColleges();

    const genderSelect = document.getElementById('gender');
    const categorySelect = document.getElementById('weight_category');

    async function loadCategories() {
        if (!categorySelect || !genderSelect) return;

        const { data: categories, error } = await supabaseClient
            .from('weight_categories')
            .select('name, gender')
            .order('name');

        if (error) {
            console.error('Error loading weight categories:', error);
            return;
        }

        const selectedGender = genderSelect.value;
        categorySelect.innerHTML = '<option value="" disabled selected>Select Category</option>';

        if (!selectedGender) {
            categorySelect.innerHTML = '<option value="" disabled selected>Select Category (Select Gender first)</option>';
            return;
        }

        const genderMap = { 'Male': 'Men', 'Female': 'Women' };
        const targetGender = genderMap[selectedGender];
        const filtered = categories.filter(c => c.gender === targetGender);

        if (filtered.length === 0) {
            categorySelect.innerHTML = `<option value="" disabled selected>No categories found for ${selectedGender}</option>`;
        } else {
            filtered.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.textContent = c.name;
                categorySelect.appendChild(opt);
            });
        }
    }

    if (genderSelect && categorySelect) {
        // Hide initial options until gender is selected
        categorySelect.innerHTML = '<option value="" disabled selected>Select Category (Select Gender first)</option>';

        genderSelect.addEventListener('change', loadCategories);

        // Handle form reset to revert category options
        form.addEventListener('reset', () => {
            setTimeout(() => {
                categorySelect.innerHTML = '<option value="" disabled selected>Select Category (Select Gender first)</option>';
            }, 0);
        });

        // Initial load if gender is already selected (e.g. browser back button or pre-fill)
        if (genderSelect.value) {
            await loadCategories();
            // Pre-fill weight category if editing
            if (existingReg && existingReg.weight_category) {
                categorySelect.value = existingReg.weight_category;
            }
        }
    }

    // Age Calculation Logic (Cutoff: 01/07/2025)
    const dobInput = document.getElementById('dob');
    const ageInput = document.getElementById('age');
    if (dobInput && ageInput) {
        dobInput.addEventListener('change', () => {
            if (!dobInput.value) {
                ageInput.value = '';
                return;
            }
            const dob = new Date(dobInput.value);
            const cutoff = new Date('2025-07-01');
            let age = cutoff.getFullYear() - dob.getFullYear();
            const m = cutoff.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && cutoff.getDate() < dob.getDate())) {
                age--;
            }
            ageInput.value = age;
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Basic UI Feedback
        messageDiv.textContent = 'Submitting your registration...';
        messageDiv.style.color = 'var(--text-color)';

        const formData = new FormData(form);
        const participantData = Object.fromEntries(formData.entries());

        // Handle "Other" college selection
        if (participantData.college_name === 'Other') {
            const extraCollege = document.getElementById('other_college').value.trim();
            if (extraCollege) {
                participantData.college_name = extraCollege;
            } else {
                showToast('Please enter your college name.', 'error');
                return;
            }
        }

        // Use the logged-in user's email since we removed it from the form
        participantData.email = user.email;

        // Client-side Validation Highlights
        if (!validateForm(participantData, messageDiv)) return;

        // Strip UI-only or combined fields before Supabase insertion
        const dbPayload = { ...participantData };
        delete dbPayload.emergency_contact_name;
        delete dbPayload.emergency_contact_phone;
        delete dbPayload.gdpr_consent;
        delete dbPayload.rules_agreement;

        // Satisfy database "zone" constraint (required but not needed in UI)
        dbPayload.zone = 'Inter-Zone';

        // Map emergency contact info to the correct database column
        dbPayload.emergency_contact = `${participantData.emergency_contact_name} (${participantData.emergency_contact_phone})`;

        // Check if Supabase is initialized
        if (!supabaseClient) {
            console.error('Supabase not initialized. Please check credentials in script.js');
            messageDiv.textContent = 'Error: Database connection not configured. Check script.js';
            messageDiv.style.color = 'red';
            return;
        }

        try {
            // Check for potential duplicates (Register Number or Email)
            const { data: existing, error: checkError } = await supabaseClient
                .from('participants')
                .select('id, register_number, email, ssv_reg_no, verification_status')
                .or(`register_number.eq.${dbPayload.register_number},email.eq.${dbPayload.email}`)
                .maybeSingle();

            if (checkError) throw checkError;

            // Handle Re-submission for Pending Registration
            if (existing && existing.verification_status === 'Pending' && existing.email === user.email) {
                // Update existing record
                const { error: updateError } = await supabaseClient
                    .from('participants')
                    .update({
                        ...dbPayload,
                        verification_status: 'Pending',
                        rejection_reason: null,
                        ssv_reg_no: existing.ssv_reg_no // Keep the same ID
                    })
                    .eq('id', existing.id);

                if (updateError) throw updateError;

                showAlert('Registration Updated!', `Technical revisions to your application have been saved. <br><br><strong>Registration ID: ${existing.ssv_reg_no}</strong>`);
                showToast('Changes saved successfully!', 'success');
                messageDiv.textContent = `Update successful! ID: ${existing.ssv_reg_no}`;
                messageDiv.style.color = 'var(--secondary-color)';
                form.reset();
                return;
            }

            if (existing && existing.verification_status !== 'Pending') {
                showToast('Error: Registration is locked.', 'error');
                return;
            }

            if (existing) {
                if (existing.email === dbPayload.email) {
                    showToast('Error: This email is already registered.', 'error');
                } else {
                    showToast('Error: This university register number is already registered.', 'error');
                }
                messageDiv.textContent = 'Already registered.';
                messageDiv.style.color = 'red';
                return;
            }

            // Generate custom SSV Registration Number
            const today = new Date();
            const ddmm = String(today.getDate()).padStart(2, '0') + String(today.getMonth() + 1).padStart(2, '0');

            // Get today's count to generate SL No.
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
            const { count, error: countError } = await supabaseClient
                .from('participants')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', startOfDay);

            if (countError) throw countError;

            const slNo = (count || 0) + 1;
            const ssv_reg_no = `MGUPC-SSV-${ddmm}-${String(slNo).padStart(3, '0')}`;

            // Add to payload
            dbPayload.ssv_reg_no = ssv_reg_no;
            dbPayload.verification_status = 'Pending';

            // Insert new participant with user_id
            const { error: insertError } = await supabaseClient
                .from('participants')
                .insert([{ ...dbPayload, user_id: user.id }]);

            if (insertError) throw insertError;

            // Success Message
            showAlert('Registration Successful!', `Your registration has been received. <br><br><strong>Registration ID: ${ssv_reg_no}</strong><br><br>Please save this ID for future reference.`);
            showToast('Registration successful!', 'success');
            messageDiv.textContent = `Registration successful! ID: ${ssv_reg_no}`;
            messageDiv.style.color = 'var(--secondary-color)';
            form.reset();

        } catch (error) {
            console.error('Submission error:', error);
            showToast('An error occurred during submission. Please try again later.', 'error');
            messageDiv.textContent = 'An error occurred during submission.';
            messageDiv.style.color = 'red';
        }
    });
}

/**
 * Client-side Form Validation
 */
function validateForm(data, messageDiv) {
    // Participant phone number validation (10 digits)
    if (!/^[0-9]{10}$/.test(data.phone)) {
        showAlert('Invalid Phone', 'Please enter a valid 10-digit phone number.');
        messageDiv.textContent = 'Invalid phone number.';
        messageDiv.style.color = 'red';
        return false;
    }

    // Emergency contact phone number validation (10 digits)
    if (!/^[0-9]{10}$/.test(data.emergency_contact_phone)) {
        showAlert('Invalid Emergency Contact', 'Please enter a valid 10-digit emergency contact number.');
        messageDiv.textContent = 'Invalid emergency contact.';
        messageDiv.style.color = 'red';
        return false;
    }

    // Must not be the same as participant phone
    if (data.phone === data.emergency_contact_phone) {
        showAlert('Phone Number Conflict', 'Emergency contact number must be different from your own phone number.');
        messageDiv.textContent = 'Numbers must be different.';
        messageDiv.style.color = 'red';
        return false;
    }

    // Age Eligibility Check
    if (parseInt(data.age) >= 25) {
        showAlert('Eligibility Error', 'Participants must be below 25 years old as of 01/07/2025. You do not meet the age requirement for this championship.');
        messageDiv.textContent = 'Eligibility Error.';
        messageDiv.style.color = 'red';
        return false;
    }

    return true;
}

/**
 * Password Visibility Toggle
 */
window.togglePasswordVisibility = function (inputId) {
    const input = document.getElementById(inputId);
    const toggler = input.nextElementSibling;

    if (input.type === 'password') {
        input.type = 'text';
        toggler.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
        `;
    } else {
        input.type = 'password';
        toggler.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
    }
}


/**
 * Hero Background Slideshow
 */
function initHeroSlideshow() {
    const backgrounds = document.querySelectorAll('.hero-bg');
    if (backgrounds.length === 0) return;

    let currentIndex = 0;
    const intervalTime = 1500;
    let slideInterval;

    function startInterval() {
        if (slideInterval) clearInterval(slideInterval);
        slideInterval = setInterval(nextSlide, intervalTime);
    }

    function showSlide(index) {
        backgrounds.forEach((bg, i) => {
            bg.classList.remove('active');
            if (i === index) bg.classList.add('active');
        });

        // Handle Video
        const targetBg = backgrounds[index];
        const video = targetBg.querySelector('video');

        // Pause all other videos
        document.querySelectorAll('.hero-bg video').forEach(v => {
            if (v !== video) v.pause();
        });

        if (video) {
            video.currentTime = 0;
            const playPromise = video.play();

            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Video play failed:", error);
                    nextSlide();
                    startInterval();
                });
            }
        }
    }

    function nextSlide() {
        let nextIndex = (currentIndex + 1) % backgrounds.length;
        const nextBg = backgrounds[nextIndex];
        const video = nextBg.querySelector('video');

        if (video) {
            clearInterval(slideInterval); // Stop timer while video plays
            currentIndex = nextIndex;
            showSlide(currentIndex);

            video.onended = () => {
                nextSlide();
                startInterval();
            };

            video.onerror = () => {
                console.warn("Video error, skipping");
                nextSlide();
                startInterval();
            };
        } else {
            currentIndex = nextIndex;
            showSlide(currentIndex);
        }
    }

    // Initialize - start interval for the first slide (which is an image)
    // If the first slide was a video, we would need different logic, but it's an image.
    startInterval();
}
