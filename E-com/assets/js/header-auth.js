/**
 * Header Auth Logic
 * Handles user icon behavior based on authentication state
 */

const initHeaderAuth = async () => {
    const userIcon = document.getElementById('header-user-icon');
    const authDropdown = document.getElementById('header-auth-dropdown');
    const logoutBtn = document.getElementById('header-logout-btn');

    if (!userIcon || !authDropdown || !window.supabase) return;

    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        const loginBtn = document.getElementById('header-login-btn');
        const wishlistBtn = document.getElementById('header-wishlist-btn');
        const cartBtn = document.getElementById('header-cart-btn');

        // Sidebar elements
        const sidebarUserIcon = document.getElementById('sidebar-user-icon');
        const sidebarLoginBtn = document.getElementById('sidebar-login-btn');
        const sidebarAuthDropdown = document.getElementById('sidebar-auth-dropdown');

        if (session) {
            // User is logged in
            if (userIcon) userIcon.style.display = 'inline-flex';
            if (loginBtn) loginBtn.style.display = 'none';
            if (wishlistBtn) wishlistBtn.style.display = 'inline-flex';
            if (cartBtn) cartBtn.style.display = 'inline-flex';

            // Sidebar toggles
            if (sidebarUserIcon) {
                sidebarUserIcon.style.display = 'flex';
                sidebarUserIcon.innerHTML = `<span class="me-2">Hi, ${session.user.user_metadata.full_name || 'User'}</span> <i class="flaticon-user"></i>`;
            }
            if (sidebarLoginBtn) sidebarLoginBtn.style.display = 'none';
            if (sidebarAuthDropdown) sidebarAuthDropdown.style.display = 'block';

            userIcon.href = "javascript:void(0)";

            userIcon.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                authDropdown.classList.toggle('active');
            });

            // Sidebar User Icon Click - maybe toggle a dropdown or just go to profile?
            // For sidebar, let's just make it a link to profile if simpler, or toggle sub-menu
            if (sidebarUserIcon) {
                sidebarUserIcon.href = "profile.html"; // Direct link for mobile simplicity
            }

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!authDropdown.contains(e.target) && !userIcon.contains(e.target)) {
                    authDropdown.classList.remove('active');
                }
            });

            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    const { error } = await window.supabase.auth.signOut();
                    if (error) {
                        console.error('Logout error:', error);
                        showAlert('Logout failed: ' + error.message, 'error');
                    } else {
                        window.location.reload();
                    }
                });
            }

            const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
            if (sidebarLogoutBtn) {
                sidebarLogoutBtn.addEventListener('click', async () => {
                    const { error } = await window.supabase.auth.signOut();
                    if (error) {
                        console.error('Logout error:', error);
                        alert('Logout failed: ' + error.message);
                    } else {
                        window.location.reload();
                    }
                });
            }
        } else {
            // User is NOT logged in
            if (userIcon) userIcon.style.display = 'none';
            if (wishlistBtn) wishlistBtn.style.display = 'none';
            if (cartBtn) cartBtn.style.display = 'none';

            if (sidebarUserIcon) sidebarUserIcon.style.display = 'none';
            if (sidebarAuthDropdown) sidebarAuthDropdown.style.display = 'none';

            const isSubFolder = window.location.pathname.split('/').filter(Boolean).length > 1 &&
                (window.location.pathname.includes('/auth/') || window.location.pathname.includes('/admin/'));
            const loginPath = isSubFolder ? '../auth/login.html' : 'auth/login.html';

            if (loginBtn) {
                loginBtn.style.display = 'inline-flex';
                loginBtn.href = loginPath;
            }

            if (sidebarLoginBtn) {
                sidebarLoginBtn.style.display = 'flex'; // Consistent flex display
                sidebarLoginBtn.href = loginPath;
            }
        }
    } catch (err) {
        console.error('Header Auth Initialization Error:', err);
    }
};

/**
 * Checks if user is logged in and returns session
 */
const checkUserSession = async () => {
    if (!window.supabase) return null;
    const { data: { session } } = await window.supabase.auth.getSession();
    return session;
};

// Wait for common components to be loaded
document.addEventListener('commonComponentsLoaded', initHeaderAuth);

// If components are already loaded
if (window.commonComponentsLoaded) {
    initHeaderAuth();
}

window.checkUserSession = checkUserSession;
