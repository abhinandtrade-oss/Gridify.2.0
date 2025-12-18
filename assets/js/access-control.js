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
        const allowed = session.allowedPrograms || [];

        let isAuthorized = false;

        // Check if we are inside a development program folder
        const devMatch = path.match(/\/developments\/([^\/]+)/i);

        if (devMatch) {
            const currentProgFolder = devMatch[1].toLowerCase();
            // Check if user has access to this program
            // We assume the program folder name matches an entry in allowedPrograms
            if (allowed.includes(currentProgFolder)) {
                isAuthorized = true;
            } else {
                // Special case for sub-paths or legacy naming if any
                if (currentProgFolder === 'scanner' && allowed.includes('scanner')) isAuthorized = true;
                if (currentProgFolder === 'builder' && allowed.includes('builder')) isAuthorized = true;
            }
        } else {
            // Dashboard, login, or other shared pages are authorized
            isAuthorized = true;
        }

        if (!isAuthorized) {
            console.warn(`Access Denied to ${path}. Allowed:`, allowed);
            alert("You do not have access to this feature.");
            window.location.href = '../../login/';
        }


    } else {
        // Unknown role or 'early-access' legacy?
        // Treat as unauthorized for now to force new flow
        window.location.href = '../../login/';
    }

})();
