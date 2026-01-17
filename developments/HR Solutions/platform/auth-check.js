
(function () {
    const platformUser = localStorage.getItem('platformUser');
    if (!platformUser && !window.location.pathname.endsWith('index.html')) {
        window.location.href = 'index.html';
        return;
    }

    if (platformUser) {
        const user = JSON.parse(platformUser);
        // Check session expiry if needed, for now just presence
        document.addEventListener('DOMContentLoaded', () => {
            const userNameEl = document.getElementById('userName');
            if (userNameEl) userNameEl.textContent = user.email.split('@')[0];

            const userBadgeEl = document.getElementById('userBadge');
            if (userBadgeEl) userBadgeEl.textContent = user.email.substring(0, 2).toUpperCase();
        });
    }
})();

window.logout = function () {
    localStorage.removeItem('platformUser');
    window.location.href = 'index.html';
};
