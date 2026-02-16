/**
 * Common Loader for Header and Footer
 * This script fetches and injects the header, footer, and sidebar from the /pub/ folder.
 * It also centralizes header logic like dynamic categories and search functionality.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Determine if the current page is in a subfolder
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    // If opening file directly, pathname might have many parts. 
    // We assume subfolder if the last part is not index.html or shop.html but it's in a known subfolder.
    const isSubFolder = pathParts.length > 1 && (window.location.pathname.includes('/auth/') || window.location.pathname.includes('/admin/'));

    const basePath = isSubFolder ? '../' : '';
    const pubPath = basePath + 'pub/';

    // Utility to load script
    const loadScript = (src) => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = basePath + src;
            script.onload = resolve;
            document.head.appendChild(script);
        });
    };

    const components = [
        { id: 'sidebar-placeholder', file: 'sidebar.html', position: 'afterbegin' },
        { id: 'header-placeholder', file: 'header.html', position: 'afterbegin' },
        { id: 'footer-placeholder', file: 'footer.html', position: 'beforeend' }
    ];

    const loadComponent = (comp) => {
        return fetch(pubPath + comp.file)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load ${comp.file}`);
                return response.text();
            })
            .then(html => {
                const placeholder = document.getElementById(comp.id);
                if (placeholder) {
                    placeholder.innerHTML = html;
                } else {
                    if (comp.position === 'afterbegin') {
                        document.body.insertAdjacentHTML('afterbegin', html);
                    } else {
                        document.body.insertAdjacentHTML('beforeend', html);
                    }
                }

                // If it's the header, initialize its logic
                if (comp.id === 'header-placeholder' || (comp.position === 'afterbegin' && html.includes('ul-header'))) {
                    setTimeout(() => initHeaderLogic(), 0);
                }
            })
            .catch(err => console.error(`Error loading ${comp.file}:`, err));
    };

    const initHeaderLogic = () => {
        const client = window.supabase;

        // 1. Fix paths if in subfolder
        if (isSubFolder) {
            const header = document.querySelector('.ul-header');
            if (header) {
                header.querySelectorAll('a').forEach(a => {
                    const href = a.getAttribute('href');
                    if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('..')) {
                        a.setAttribute('href', basePath + href);
                    }
                });
                header.querySelectorAll('img').forEach(img => {
                    const src = img.getAttribute('src');
                    if (src && !src.startsWith('http') && !src.startsWith('..')) {
                        img.setAttribute('src', basePath + src);
                    }
                });
            }
        }

        // 2. Mobile Toggles
        const ulHeaderSearchOpener = document.querySelectorAll(".ul-header-mobile-search-opener");
        const ulHeaderSearchCloser = document.querySelector(".ul-header-mobile-search-closer");
        const ulHeaderSearchWrapper = document.querySelector(".ul-header-search-form-wrapper");

        if (ulHeaderSearchOpener.length > 0 && ulHeaderSearchWrapper) {
            ulHeaderSearchOpener.forEach(opener => {
                opener.addEventListener("click", () => {
                    ulHeaderSearchWrapper.classList.add("active");
                });
            });
        }

        if (ulHeaderSearchCloser && ulHeaderSearchWrapper) {
            ulHeaderSearchCloser.addEventListener("click", () => {
                ulHeaderSearchWrapper.classList.remove("active");
            });
        }

        // 3. Search Form Submission
        const headerSearchForm = document.querySelector(".ul-header-search-form");
        if (headerSearchForm) {
            headerSearchForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const category = document.querySelector("#ul-header-search-category")?.value;
                const query = document.querySelector("#ul-header-search")?.value;

                let params = new URLSearchParams();
                if (category && category !== 'Select Category') params.append('category', category);
                if (query) params.append('search', query);

                window.location.href = `${basePath}shop.html?${params.toString()}`;
            });
        }

        // 4. Dynamic Categories
        if (client) {
            loadDynamicHeaderCategories(client);
            loadDynamicHeaderAnnouncement(client);
        }
    };

    async function loadDynamicHeaderAnnouncement(client) {
        const slider = document.querySelector(".ul-header-top-slider");
        if (!slider) return;

        const announcementElements = slider.querySelectorAll(".ul-header-top-slider-item");

        // 1. Helper to check if announcement is valid
        const isValid = (config) => {
            if (!config || !config.content) return false;

            const now = new Date();
            const start = config.start ? new Date(config.start) : null;
            const end = config.end ? new Date(config.end) : null;
            if (start && now < start) return false;
            if (end && now > end) return false;
            return true;
        };

        // 2. Helper to apply config
        const applyConfig = (config) => {
            document.querySelector('.ul-header-top')?.setAttribute('style', 'display: block');
            const content = config.link
                ? `<a href="${config.link}" style="color: inherit; text-decoration: none;">${config.content}</a>`
                : config.content;

            announcementElements.forEach(el => {
                el.innerHTML = `<i class="flaticon-sparkle"></i> ${content}`;
            });
        };

        // 3. Try Cache first
        const localData = JSON.parse(localStorage.getItem('glamer_announcement_config') || '{}');
        const headerConfig = localData.header || (localData.type === 'text' ? localData : null);

        if (headerConfig && isValid(headerConfig)) {
            applyConfig(headerConfig);
        } else {
            document.querySelector('.ul-header-top')?.setAttribute('style', 'display: none !important');
        }

        // 4. Fetch fresh from DB
        if (client) {
            try {
                const { data } = await client
                    .from('site_settings')
                    .select('value')
                    .eq('key', 'announcement_config')
                    .single();

                if (data && data.value) {
                    const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
                    const headerConfig = config.header || (config.type === 'text' ? config : null);

                    if (headerConfig && isValid(headerConfig)) {
                        applyConfig(headerConfig);
                    } else {
                        document.querySelector('.ul-header-top')?.setAttribute('style', 'display: none !important');
                    }
                    // Cache the whole config
                    localStorage.setItem('glamer_announcement_config', JSON.stringify(config));
                } else {
                    // Fallback to old text if no config exists
                    const { data: oldData } = await client
                        .from('site_settings')
                        .select('value')
                        .eq('key', 'announcement_text')
                        .single();

                    if (oldData) {
                        applyConfig({ content: oldData.value });
                    }
                }
            } catch (err) {
                // Silently fail if table missing or error
            }
        }
    }

    async function loadDynamicHeaderCategories(client) {
        const headerCatSelect = document.querySelector("#ul-header-search-category");
        const navCatList = document.querySelector("#nav-categories-list");
        const megaMenuCats = document.querySelector("#megamenu-categories-list");

        if (!headerCatSelect && !navCatList && !megaMenuCats) return;

        try {
            const { data: categories, error } = await client
                .from('categories')
                .select('name')
                .eq('is_visible', true)
                .order('name', { ascending: true });

            if (error || !categories) return;

            // Search Dropdown
            if (headerCatSelect) {
                headerCatSelect.innerHTML = '<option data-placeholder="true">Select Category</option>';
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat.name;
                    option.textContent = cat.name;
                    headerCatSelect.appendChild(option);
                });
                if (window.SlimSelect) {
                    new SlimSelect({
                        select: '#ul-header-search-category',
                        settings: { showSearch: false }
                    });
                }
            }

            // Categories Dropdown in Main Nav
            if (navCatList) {
                navCatList.innerHTML = categories.map(cat => `
                    <li><a href="${basePath}shop.html?category=${encodeURIComponent(cat.name)}">${cat.name}</a></li>
                `).join('');
            }

            // Mega Menu Columns
            if (megaMenuCats) {
                megaMenuCats.innerHTML = categories.map(cat => `
                    <li><a href="${basePath}shop.html?category=${encodeURIComponent(cat.name)}">${cat.name}</a></li>
                `).join('');
            }
        } catch (err) {
            console.error('Error populating dynamic header:', err);
        }
    }

    // Load all components
    Promise.all(components.map(loadComponent)).then(async () => {
        console.log('Common components loaded and initialized');

        // Load global helpers
        await loadScript('assets/js/notifications.js');
        await loadScript('assets/js/header-auth.js');
        await loadScript('assets/js/cart-manager.js');
        await loadScript('assets/js/gdpr.js');

        // Load Lucide Icons if not present
        if (typeof lucide === 'undefined') {
            const lucideScript = document.createElement('script');
            lucideScript.src = 'https://cdn.jsdelivr.net/npm/lucide/dist/umd/lucide.min.js';
            lucideScript.onload = () => lucide.createIcons();
            document.head.appendChild(lucideScript);
        }

        // Page Protection logic
        const protectedPages = ['cart.html', 'wishlist.html', 'checkout.html', 'profile.html'];
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        if (protectedPages.includes(currentPage)) {
            const session = await window.checkUserSession();
            if (!session) {
                // Redirect to login with a message
                const loginPath = isSubFolder ? '../auth/login.html' : 'auth/login.html';
                window.location.href = `${loginPath}?message=please_login&redirect=${encodeURIComponent(window.location.pathname)}`;
            }
        }

        document.dispatchEvent(new CustomEvent('commonComponentsLoaded'));
        window.commonComponentsLoaded = true;
    });
});
