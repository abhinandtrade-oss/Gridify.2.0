/**
 * Admin Authentication & Role Authorization Check
 * This script ensures the user is logged in and has an authorized role (super_admin or admin).
 */

(function () {
    // Inject Notifications Script dynamically if not present
    if (!document.querySelector('script[src*="notifications.js"]')) {
        const script = document.createElement('script');
        script.src = 'js/notifications.js';
        document.head.appendChild(script);
    }

    // 0. Remove .html extension from URL immediately (REMOVED)
    /* 
    if (window.location.protocol !== 'file:') {
        if (window.location.pathname.endsWith('index.html')) {
            const newPath = window.location.pathname.replace(/index\.html$/, '');
            window.history.replaceState(null, '', newPath + window.location.search);
        } else if (window.location.pathname.endsWith('.html')) {
            const newPath = window.location.pathname.replace(/\.html$/, '');
            window.history.replaceState(null, '', newPath + window.location.search);
        }
    }
    */

    // 0. Prevent FOUC (Flash of Unauthenticated Content)
    // We inject a style to hide the body immediately until auth is resolved.
    const style = document.createElement('style');
    style.id = 'auth-protection';
    style.innerHTML = 'body { display: none !important; }';
    document.head.appendChild(style);

    function revealBody() {
        const styleEl = document.getElementById('auth-protection');
        if (styleEl) styleEl.remove();
    }

    // Helper to render unauthorized/login message
    function renderContent(title, message, btnText, btnLink) {
        // Ensure body exists before writing to it
        if (!document.body) {
            window.addEventListener('DOMContentLoaded', () => renderContent(title, message, btnText, btnLink));
            return;
        }

        revealBody(); // Remove the hiding style so our new content is visible
        document.body.classList.add('auth-restricted');

        document.body.innerHTML = `
            <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-family: 'Inter', sans-serif; background-color: #f8f9fa;">
                <div style="margin-bottom: 1.5rem; color: #dc3545;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <h1 style="font-size: 2.5rem; margin-bottom: 1rem; color: #1e293b; font-weight: 700;">${title}</h1>
                <p style="font-size: 1.125rem; color: #64748b; margin-bottom: 2rem; max-width: 400px; line-height: 1.6;">${message}</p>
                <a href="${btnLink}" style="padding: 0.75rem 2rem; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 0.5rem; font-weight: 600; transition: background-color 0.2s; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.1), 0 2px 4px -1px rgba(79, 70, 229, 0.06);">${btnText}</a>
            </div>
        `;
    }

    async function checkAdminAuth() {
        const client = window.supabase;

        // 1. Wait for Supabase client to be ready
        if (!client || typeof client.auth === 'undefined') {
            // console.warn("Auth check: Supabase client not ready, retrying...");
            setTimeout(checkAdminAuth, 50);
            return;
        }

        try {
            // 2. Get current session
            const { data: { session }, error: sessionError } = await client.auth.getSession();

            if (sessionError || !session) {
                console.log("No active session.");
                // Check if we are already on login page (index.html or root of admin)
                // If path is /admin/ or ends with /admin, we are fine (assuming index.html is served)
                // If path includes index.html, we are fine
                const path = window.location.pathname;
                const isLoginPage = path.endsWith('/admin/') || path.endsWith('/admin') || path.includes('index.html') || path.includes('login.html');

                if (!isLoginPage) {
                    renderContent(
                        "Authentication Required",
                        "You need to log in to access the admin portal.",
                        "Log In",
                        "index.html"
                    );
                } else {
                    revealBody(); // On login page, just show it
                }
                return;
            }

            // 3. Check role in user_roles table
            const { data: roleData, error: roleError } = await client
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();

            if (roleError || !roleData) {
                console.error("Role check failed or user has no assigned role:", roleError);
                renderContent(
                    "Access Denied",
                    "You do not have the required permissions to access this area.",
                    "Return Home",
                    "../index.html"
                );
                return;
            }

            const role = roleData.role;
            console.log("Authenticated as:", role);

            let allowedPages = [];
            // 4. Check dynamic permissions
            // super_admin bypasses all checks
            if (role !== 'super_admin') {
                const { data: permData, error: permError } = await client
                    .from('role_permissions')
                    .select('accessible_pages')
                    .eq('role_name', role)
                    .single();

                if (permError || !permData) {
                    if (role === 'admin' || role === 'super_admin') {
                        // All admins have basic access, but restrict sensitive pages if needed
                        console.warn("No specific permissions found for admin/super_admin role in DB. Allowing default access.");
                    } else {
                        renderContent(
                            "Restricted Access",
                            `Your role "${role}" is not authorized to view the admin dashboard.`,
                            "Go Back",
                            "../index.html"
                        );
                        return;
                    }
                } else {
                    let currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
                    if (!currentPage.endsWith('.html') && currentPage !== '') {
                        currentPage += '.html';
                    }

                    allowedPages = permData.accessible_pages || [];

                    // Always allow dashboard, security, and profile pages
                    const alwaysAllowed = ['dashboard.html', 'security.html', 'shop-profile.html', 'modify-shop-profile.html'];
                    const isAlwaysAllowed = alwaysAllowed.includes(currentPage);
                    const isExplicitlyAllowed = allowedPages.includes(currentPage);

                    if (!isAlwaysAllowed && !isExplicitlyAllowed) {
                        renderContent(
                            "Permission Denied",
                            "You do not have permission to view this specific page.",
                            "Back to Dashboard",
                            "dashboard.html"
                        );
                        return;
                    }
                }
            }

            // Success! Reveal the body and update UI
            revealBody();
            updateUserUI(session.user, role, allowedPages);
            initAutoLogout();

        } catch (err) {
            console.error("Auth check error:", err);
            renderContent(
                "Error",
                "An unexpected error occurred during authentication check.",
                "Reload",
                window.location.href
            );
        }
    }

    function updateUserUI(user, role, allowedPages) {
        const update = () => {
            const nameEl = document.querySelector('.user-info .name');
            const roleEl = document.querySelector('.user-info .role');
            const avatarEl = document.querySelector('.user-avatar');

            if (nameEl && roleEl && avatarEl) {
                nameEl.textContent = user.email;
                roleEl.textContent = role.replace(/_/g, ' ').toUpperCase();
                avatarEl.textContent = user.email.substring(0, 2).toUpperCase();

                // Filter Sidebar if not super_admin
                if (role !== 'super_admin') {
                    filterSidebar(allowedPages);
                }

                return true;
            }
            return false;
        };

        // Try immediately and also when DOM is ready
        if (!update()) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', update);
            } else {
                update(); // DOM already ready
            }

            // Also use MutationObserver because sidebar is loaded dynamically
            const observer = new MutationObserver((mutations, obs) => {
                if (update()) {
                    obs.disconnect();
                }
            });
            // Observer needs body to exist
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    observer.observe(document.body, { childList: true, subtree: true });
                });
            }
        }
    }

    /**
     * Hides sidebar items that the user doesn't have access to
     */
    function filterSidebar(allowedPages) {
        const sidebar = document.querySelector('.admin-sidebar');
        if (!sidebar) return;

        // 1. Filter individual nav items (not in groups)
        const directLinks = sidebar.querySelectorAll('.sidebar-nav > a.nav-item');
        directLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href !== '#' && href !== 'javascript:void(0)') {
                let filename = href.split('/').pop();
                const cleanFilename = filename.split('?')[0];

                // Always allow dashboard, security, and logout
                if (cleanFilename === 'dashboard.html' || cleanFilename === 'security.html' || link.id === 'btn-logout') return;

                if (!allowedPages.includes(filename) && !allowedPages.includes(cleanFilename)) {
                    link.style.display = 'none';
                }
            }
        });

        // 2. Filter groups and their submenus
        const groups = sidebar.querySelectorAll('.nav-group');
        groups.forEach(group => {
            const submenuLinks = group.querySelectorAll('.submenu a');
            let visibleLinksCount = 0;

            submenuLinks.forEach(link => {
                const href = link.getAttribute('href');
                let filename = href.split('/').pop();
                const cleanFilename = filename.split('?')[0];

                if (allowedPages.includes(filename) || allowedPages.includes(cleanFilename) || cleanFilename === 'dashboard.html' || cleanFilename === 'security.html' || link.id === 'nav-security') {
                    link.style.display = '';
                    visibleLinksCount++;
                } else {
                    link.style.display = 'none';
                }
            });

            // If no links in the submenu are visible, hide the entire group
            if (visibleLinksCount === 0) {
                group.style.display = 'none';
            } else {
                group.style.display = 'block';
            }
        });
    }

    // Auto Logout implementation
    function initAutoLogout() {
        const AUTO_LOGOUT_TIME = 4 * 60 * 60 * 1000; // 4 Hours

        const updateActivity = () => {
            localStorage.setItem('adminLastActivity', Date.now());
        };

        // Check immediately on load
        const lastActivity = localStorage.getItem('adminLastActivity');
        if (lastActivity && (Date.now() - parseInt(lastActivity) > AUTO_LOGOUT_TIME)) {
            performLogout();
            return;
        }

        // Initialize if not present
        if (!lastActivity) {
            updateActivity();
        }

        // Throttled activity listener (updates at most once per minute)
        const throttledUpdate = throttle(updateActivity, 60000);

        window.addEventListener('mousemove', throttledUpdate);
        window.addEventListener('keydown', throttledUpdate);
        window.addEventListener('click', throttledUpdate);
        window.addEventListener('scroll', throttledUpdate);
        window.addEventListener('touchstart', throttledUpdate);

        // Periodic check every minute
        setInterval(() => {
            const last = localStorage.getItem('adminLastActivity');
            if (last && (Date.now() - parseInt(last) > AUTO_LOGOUT_TIME)) {
                performLogout();
            }
        }, 60000);
    }

    async function performLogout() {
        console.warn("Session expired due to inactivity. Logging out...");
        localStorage.removeItem('adminLastActivity');

        const client = window.supabase;
        if (client) {
            await client.auth.signOut();
        }
        window.location.href = 'index.html';
    }

    function throttle(func, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    // Execute check
    checkAdminAuth();
})();
