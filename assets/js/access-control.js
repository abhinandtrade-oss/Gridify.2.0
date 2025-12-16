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
    // Allow 'admin' and 'early-access' roles
    if (!session || (session.role !== 'admin' && session.role !== 'early-access')) {
        // If we are not in the list.html page (to avoid infinite loop if logic was different)
        // Redirect to list.html
        window.location.href = '../../list.html';
    }

    // Auto logout on reload -> Clears session when page is unloaded
    // This effectively logs out the user from this tab when they reload or close/navigate away.
    window.addEventListener('beforeunload', function () {
        sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    });
})();
