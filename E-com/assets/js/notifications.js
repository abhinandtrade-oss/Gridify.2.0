/**
 * Notification System
 * Replaces native browser alerts and confirms with Bootstrap Toasts and Modals.
 */

const NotificationSystem = {
    init() {
        // Create Toast Container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container position-fixed top-0 start-50 translate-middle-x p-3';
            container.style.zIndex = '1070';
            document.body.appendChild(container);
        }

        // Create Confirm Modal ID if it doesn't exist
        if (!document.getElementById('confirm-modal')) {
            const modalHtml = `
                <div class="modal fade" id="confirm-modal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header border-0 pb-0">
                                <h5 class="modal-title fw-bold">Confirmation Required</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body py-4">
                                <p id="confirm-modal-message" class="mb-0 text-muted"></p>
                            </div>
                            <div class="modal-footer border-0 pt-0">
                                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" id="confirm-modal-btn">Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        // Create Input Modal ID if it doesn't exist
        if (!document.getElementById('input-modal')) {
            const inputModalHtml = `
                <div class="modal fade" id="input-modal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header border-0 pb-0">
                                <h5 class="modal-title fw-bold" id="input-modal-title">Input Required</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body py-4">
                                <p id="input-modal-message" class="mb-3 text-muted"></p>
                                <input type="text" id="input-modal-field" class="form-control" placeholder="">
                            </div>
                            <div class="modal-footer border-0 pt-0">
                                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" id="input-modal-btn">Submit</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', inputModalHtml);
        }
    },

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     */
    showToast(message, type = 'info') {
        this.init(); // Ensure container exists

        let bgClass = 'text-bg-primary';
        let icon = '';

        switch (type) {
            case 'success':
                bgClass = 'text-bg-success';
                icon = 'check-circle';
                break;
            case 'error':
                bgClass = 'text-bg-danger';
                icon = 'alert-circle';
                break;
            case 'warning':
                bgClass = 'text-bg-warning';
                icon = 'alert-triangle';
                break;
            default:
                bgClass = 'text-bg-primary';
                icon = 'info';
        }

        const toastId = 'toast-' + Date.now();
        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center gap-2">
                        <i data-lucide="${icon}" width="18" height="18"></i>
                        <span>${message}</span>
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        document.getElementById('toast-container').insertAdjacentHTML('beforeend', toastHtml);

        // meaningful lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        const toastElement = document.getElementById(toastId);
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
            toast.show();
        } else {
            // Fallback for when bootstrap is not loaded correctly
            toastElement.classList.add('show');
            setTimeout(() => toastElement.classList.remove('show'), 5000);
        }

        // Cleanup after hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    },

    /**
     * Show a confirmation modal
     * @param {string} message - The confirmation message
     * @param {function} onConfirm - Callback function to execute on confirmation
     */
    showConfirm(message, onConfirm) {
        this.init(); // Ensure modal exists

        const modalEl = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-modal-message');
        const btnEl = document.getElementById('confirm-modal-btn');

        msgEl.textContent = message;

        // Remove existing event listeners to prevent multiple clicks
        const newBtn = btnEl.cloneNode(true);
        btnEl.parentNode.replaceChild(newBtn, btnEl);

        newBtn.addEventListener('click', () => {
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            } else {
                modalEl.classList.remove('show');
                modalEl.style.display = 'none';
            }

            if (typeof onConfirm === 'function') {
                onConfirm();
            }
        });

        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
    },

    /**
     * Show an input modal (replaces prompt)
     * @param {string} message - The message/label to display
     * @param {string} defaultValue - Default value for the input
     * @param {function} onSubmit - Callback function(value) to execute on submit
     */
    showInput(message, defaultValue, onSubmit) {
        this.init();

        const modalEl = document.getElementById('input-modal');
        const msgEl = document.getElementById('input-modal-message');
        const inputEl = document.getElementById('input-modal-field');
        const btnEl = document.getElementById('input-modal-btn');

        msgEl.textContent = message;
        inputEl.value = defaultValue || '';

        const newBtn = btnEl.cloneNode(true);
        btnEl.parentNode.replaceChild(newBtn, btnEl);

        newBtn.addEventListener('click', () => {
            const val = inputEl.value;
            if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            } else {
                modalEl.classList.remove('show');
                modalEl.style.display = 'none';
            }

            if (typeof onSubmit === 'function') {
                onSubmit(val);
            }
        });

        if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        } else {
            modalEl.classList.add('show');
            modalEl.style.display = 'block';
        }
    }
};

// Expose to window for global access
window.NotificationSystem = NotificationSystem;

// Helper global functions to replace alert/confirm easily
window.showAlert = (msg, type = 'info') => NotificationSystem.showToast(msg, type);
window.showConfirm = (msg, callback) => NotificationSystem.showConfirm(msg, callback);
window.showPrompt = (msg, defaultValue, callback) => NotificationSystem.showInput(msg, defaultValue, callback);
