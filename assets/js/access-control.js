(function () {
    const ADMIN_STORAGE_KEY = 'gridify_admin_session';

    function getSession() {
        const data = sessionStorage.getItem(ADMIN_STORAGE_KEY);
        if (!data) return null;
        try {
            return JSON.parse(data);
        } catch (e) { return null; }
    }

    const session = getSession();

    // 1. No Session -> Redirect Login
    if (!session) {
        // preserve query params if needed? Nah.
        window.location.href = '../../login/';
        return;
    }

    // 2. Admin Role -> Access All
    if (session.role === 'admin') {
        // Allowed
    } else if (session.role === 'user') {
        // 3. User Role -> Check Allowed Programs based on Path
        const path = window.location.pathname.toLowerCase();
        const allowed = session.allowedPrograms || []; // e.g. ['builder', 'scanner']

        let isAuthorized = false;

        // Check path against allowed keywords
        if (path.includes('builder')) {
            if (allowed.includes('builder')) isAuthorized = true;
        } else if (path.includes('scanner')) {
            if (allowed.includes('scanner')) isAuthorized = true;
        } else {
            // Dashboard or other pages? 
            // If they are in /developments/ but not builder/scanner?
            // Assume strict check for the known apps.
            if (path.includes('developments')) {
                // strict
            } else {
                isAuthorized = true; // access to shared assets/pages?
            }
        }

        if (!isAuthorized) {
            alert("You do not have access to this feature.");
            window.location.href = '../../login/';
        }

    } else {
        // Unknown role or 'early-access' legacy?
        // Treat as unauthorized for now to force new flow
        window.location.href = '../../login/';
    }

})();
