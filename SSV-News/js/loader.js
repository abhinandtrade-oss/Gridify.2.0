/**
 * Global Loading Indicator Logic
 * Provides showLoader() and hideLoader() functions.
 */

(function () {
    // Create and inject the loader HTML
    function injectLoader() {
        if (document.getElementById('global-loader')) return;

        const loaderDiv = document.createElement('div');
        loaderDiv.id = 'global-loader';
        loaderDiv.className = 'loading-indicator';
        loaderDiv.innerHTML = `
            <div class="spinner-small"></div>
            <span id="loader-text">Connecting...</span>
        `;
        document.body.appendChild(loaderDiv);
    }

    // Show the loader with optional text
    window.showLoader = function (text = 'Connecting...') {
        injectLoader();
        const loader = document.getElementById('global-loader');
        const loaderText = document.getElementById('loader-text');
        if (loader && loaderText) {
            loaderText.textContent = text;
            loader.classList.add('active');
        }
    };

    // Hide the loader
    window.hideLoader = function () {
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.remove('active');
        }
    };

    // Auto-inject on DOM content loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectLoader);
    } else {
        injectLoader();
    }
})();
