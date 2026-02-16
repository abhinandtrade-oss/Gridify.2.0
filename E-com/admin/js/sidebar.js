document.addEventListener('DOMContentLoaded', () => {
    // Determine the base path for admin files
    const isSubFolder = window.location.pathname.includes('/admin/');
    const sidebarPath = (isSubFolder ? 'sidebar.html' : 'admin/sidebar.html') + '?v=' + Date.now();

    fetch(sidebarPath)
        .then(response => response.text())
        .then(html => {
            // Check if auth failed before injecting sidebar
            if (document.body.classList.contains('auth-restricted')) return;

            document.body.insertAdjacentHTML('afterbegin', html);

            // Initialize Lucide Icons if available
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            // Dropdown Toggle Logic
            const submenuToggles = document.querySelectorAll('.has-submenu');
            submenuToggles.forEach(toggle => {
                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Close other submenus if needed (optional)
                    // submenuToggles.forEach(other => {
                    //     if (other !== toggle) other.classList.remove('open');
                    // });
                    toggle.classList.toggle('open');
                });
            });

            // Set active link based on current page
            const currentUrl = window.location.href;
            const navItems = document.querySelectorAll('.nav-item, .submenu a');

            navItems.forEach(item => {
                const itemUrl = item.href;

                if (!itemUrl) return;

                // Check for exact match (handles query params)
                // Or check if path matches for ensuring base path highlighting
                if (itemUrl === currentUrl || (itemUrl.split('?')[0] === currentUrl.split('?')[0] && itemUrl.indexOf('?') === -1 && currentUrl.indexOf('?') === -1)) {
                    item.classList.add('active');

                    // If it's a submenu item, open the parent and highlight it
                    const parentSubmenu = item.closest('.submenu');
                    if (parentSubmenu) {
                        const parentToggle = parentSubmenu.previousElementSibling;
                        if (parentToggle) {
                            parentToggle.classList.add('open', 'active');
                        }
                    }
                } else {
                    // Only remove active if it's not a parent toggle being kept active by its children
                    if (!item.classList.contains('has-submenu') || !item.nextElementSibling?.querySelector('.active')) {
                        item.classList.remove('active');
                    }
                }
            });

            // Mobile Sidebar Toggle Logic
            const toggleBtn = document.querySelector('.sidebar-toggle');
            const sidebar = document.querySelector('.admin-sidebar');
            const overlay = document.querySelector('.sidebar-overlay');

            if (toggleBtn && sidebar && overlay) {
                toggleBtn.addEventListener('click', () => {
                    sidebar.classList.toggle('open');
                    overlay.classList.toggle('active');
                });

                overlay.addEventListener('click', () => {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('active');
                });
            }

            // Call fetchSidebarCounts after sidebar is loaded
            fetchSidebarCounts();

            // Logout Logic
            const logoutBtn = document.getElementById('btn-logout');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    showConfirm('Are you sure you want to logout?', async () => {
                        const { error } = await window.supabase.auth.signOut();
                        if (error) {
                            console.error('Error logging out:', error);
                        } else {
                            localStorage.removeItem('adminLastActivity');
                            window.location.href = 'index.html';
                        }
                    });
                });
            }
        })
        .catch(err => console.error('Error loading sidebar:', err));

    async function fetchSidebarCounts(retryCount = 0) {
        const client = window.supabase;
        if (!client || typeof client.from !== 'function') {
            if (retryCount < 5) {
                setTimeout(() => fetchSidebarCounts(retryCount + 1), 500);
            }
            return;
        }

        try {
            // 1. Pending Orders
            const { count: pendingOrders } = await client
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            // 2. Pending Sellers
            const { count: pendingSellers } = await client
                .from('sellers')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            // 3. Pending Products
            const { count: pendingProducts } = await client
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending_approval');

            // 4. Returns (Pending)
            const { count: pendingReturns } = await client
                .from('returns')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            // Update Badges
            updateBadge('a[href="orders.html?status=pending"]', pendingOrders);
            updateBadge('a[href="pending-sellers.html"]', pendingSellers);
            updateBadge('a[href="product-approval.html"]', pendingProducts);
            updateBadge('a[href="returns.html"]', pendingReturns);
            // Also for MP Returns if separate count? Or same?
            // updateBadge('a[href="mp-returns.html"]', pendingReturns); // Maybe duplicate of returns badge?

            // Update Parents
            // Orders Parent: pendingOrders + pendingReturns
            const totalOrdersAlerts = (pendingOrders || 0) + (pendingReturns || 0);
            updateBadge('#nav-orders', totalOrdersAlerts, true);

            // Sellers Parent: pendingSellers + pendingProducts
            const totalSellersAlerts = (pendingSellers || 0) + (pendingProducts || 0);
            updateBadge('#nav-sellers', totalSellersAlerts, true);

        } catch (err) {
            console.error('Error fetching sidebar counts:', err);
        }
    }

    function updateBadge(selector, count, isParent = false) {
        if (!count || count <= 0) return;

        let el = document.querySelector(selector);
        if (!el) return;

        // Remove existing badge
        const existing = el.querySelector('.sidebar-badge');
        if (existing) existing.remove();

        const badge = document.createElement('span');
        badge.className = 'sidebar-badge';
        badge.textContent = count > 99 ? '99+' : count;

        if (isParent) {
            badge.style.marginLeft = 'auto';
            badge.style.marginRight = '0.5rem';

            const arrow = el.querySelector('.dropdown-icon');
            if (arrow) {
                arrow.style.marginLeft = '0';
                el.insertBefore(badge, arrow);
            } else {
                el.appendChild(badge);
            }
        } else {
            el.appendChild(badge);
        }
    }
});
