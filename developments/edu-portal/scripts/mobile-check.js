/**
 * Mobile Number Collection Script
 * Checks if user needs to provide mobile number and prompts them
 */

// Create and inject mobile number modal
function createMobileNumberModal() {
    const modalHTML = `
    <!-- Mobile Number Collection Modal -->
    <div id="mobile-number-modal"
        style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); align-items: center; justify-content: center; z-index: 30000; backdrop-filter: blur(4px);">
        <div class="card" style="width: 90%; max-width: 400px; padding: 2.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border-radius: 1rem;">
            <div style="text-align: center; margin-bottom: 1.5rem;">
                <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
                    <i class="fas fa-mobile-alt" style="font-size: 1.75rem; color: white;"></i>
                </div>
                <h3 style="margin-bottom: 0.5rem; font-size: 1.5rem; color: #111827;">Mobile Number Required</h3>
                <p style="color: #6b7280; font-size: 0.95rem; line-height: 1.5;">Please provide your mobile number to complete your profile and receive important updates.</p>
            </div>
            <form id="mobile-number-form">
                <div class="form-group">
                    <label class="form-label" style="font-weight: 600; color: #374151;">Mobile Number (Indian)</label>
                    <div style="position: relative;">
                        <i class="fas fa-phone" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #9ca3af;"></i>
                        <input type="tel" id="mobile-number-input" class="form-control" required pattern="[6-9][0-9]{9}" maxlength="10"
                            placeholder="10-digit mobile number" title="Enter a valid 10-digit Indian mobile number starting with 6-9"
                            style="padding-left: 2.75rem; border-radius: 0.75rem; border: 1px solid #e5e7eb; font-size: 0.95rem;">
                    </div>
                    <small style="display: block; margin-top: 0.5rem; color: #6b7280; font-size: 0.85rem;">
                        <i class="fas fa-info-circle"></i> Enter 10-digit Indian mobile number (starting with 6-9)
                    </small>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%; padding: 1rem; margin-top: 1rem; font-weight: 600; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">
                    <i class="fas fa-check-circle" style="margin-right: 0.5rem;"></i> Save Mobile Number
                </button>
            </form>
        </div>
    </div>
    `;

    // Inject modal into page
    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);
}

// Check and prompt for mobile number
async function checkAndPromptMobileNumber(uid, userProfile) {
    // Don't prompt super_admin
    if (userProfile && userProfile.role === 'super_admin') {
        return;
    }

    // Check session storage flag or user profile
    const needsMobile = sessionStorage.getItem('requireMobileNumber') === 'true' || !userProfile.mobile;

    if (needsMobile) {
        // Create modal if doesn't exist
        if (!document.getElementById('mobile-number-modal')) {
            createMobileNumberModal();
        }

        // Show modal
        const modal = document.getElementById('mobile-number-modal');
        if (modal) {
            modal.style.display = 'flex';

            // Handle form submission
            const form = document.getElementById('mobile-number-form');
            if (form && !form.hasAttribute('data-initialized')) {
                form.setAttribute('data-initialized', 'true');
                form.onsubmit = async (e) => {
                    e.preventDefault();
                    const mobileInput = document.getElementById('mobile-number-input');
                    const mobile = mobileInput.value.trim();

                    // Validate Indian mobile number format (10 digits starting with 6-9)
                    if (!mobile || !/^[6-9][0-9]{9}$/.test(mobile)) {
                        if (window.Auth && window.Auth.showToast) {
                            window.Auth.showToast('Please enter a valid 10-digit Indian mobile number starting with 6-9', 'error');
                        } else {
                            alert('Please enter a valid 10-digit Indian mobile number starting with 6-9');
                        }
                        return;
                    }

                    // Show loading state
                    const submitBtn = form.querySelector('button[type="submit"]');
                    const originalText = submitBtn.innerHTML;
                    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Saving...';
                    submitBtn.disabled = true;

                    try {
                        const result = await window.DB.updateMobileNumber(uid, mobile);

                        if (result.success) {
                            // Clear session flag
                            sessionStorage.removeItem('requireMobileNumber');

                            // Hide modal
                            modal.style.display = 'none';

                            // Update local profile if Auth object exists
                            if (window.Auth && window.Auth.userProfile) {
                                window.Auth.userProfile.mobile = mobile;
                            }

                            // Show success message
                            if (window.Auth && window.Auth.showToast) {
                                window.Auth.showToast('Mobile number saved successfully!', 'success');
                            } else {
                                alert('Mobile number saved successfully!');
                            }
                        } else {
                            throw new Error(result.message || 'Failed to save mobile number');
                        }
                    } catch (error) {
                        if (window.Auth && window.Auth.showToast) {
                            window.Auth.showToast('Error: ' + error.message, 'error');
                        } else {
                            alert('Error: ' + error.message);
                        }
                        submitBtn.innerHTML = originalText;
                        submitBtn.disabled = false;
                    }
                };
            }
        }
    }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.MobileCheck = {
        checkAndPromptMobileNumber
    };
}
