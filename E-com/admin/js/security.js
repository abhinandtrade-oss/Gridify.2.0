/**
 * Security Page Logic
 * Handles the multi-step password reset flow utilizing Supabase Auth OTP verification.
 */

document.addEventListener('DOMContentLoaded', async () => {
    const client = window.supabase;
    const emailDisplay = document.getElementById('display-email');

    // UI Containers
    const stepSend = document.getElementById('step-send-otp');
    const stepVerify = document.getElementById('step-verify-otp');
    const stepChange = document.getElementById('step-change-password');

    // Buttons & Inputs
    const btnSend = document.getElementById('btn-send-otp');
    const btnVerify = document.getElementById('btn-verify-otp');
    const btnUpdate = document.getElementById('btn-update-password');
    const resendLink = document.getElementById('resend-otp');
    const formPassword = document.getElementById('form-change-password');

    let userEmail = '';

    // 1. Initial State - Get current user email
    try {
        const { data: { user } } = await client.auth.getUser();
        if (user) {
            userEmail = user.email;
            emailDisplay.textContent = userEmail;
        } else {
            console.error('No authenticated user found');
            window.location.href = 'index.html';
        }
    } catch (err) {
        console.error('Auth error:', err);
    }

    // --- Step 1: Send OTP ---
    async function sendOTP() {
        try {
            setLoading(btnSend, true, 'Sending...');
            const { error } = await client.auth.resetPasswordForEmail(userEmail);
            if (error) throw error;

            showStep('verify');
            showAlert('A verification code has been sent to your email.', 'success');
        } catch (error) {
            showAlert('Error sending code: ' + error.message, 'error');
        } finally {
            setLoading(btnSend, false, '<i data-lucide="send" style="width: 18px;"></i> Send Verification Code');
        }
    }

    btnSend.addEventListener('click', sendOTP);
    resendLink.addEventListener('click', (e) => {
        e.preventDefault();
        sendOTP();
    });

    // --- Step 2: Verify OTP ---
    btnVerify.addEventListener('click', async () => {
        const inputs = document.querySelectorAll('#otp-inputs input');
        const token = Array.from(inputs).map(i => i.value).join('');

        if (token.length !== 8) {
            showAlert('Please enter all 8 digits of the verification code.', 'warning');
            return;
        }

        try {
            setLoading(btnVerify, true, 'Verifying...');
            const { error } = await client.auth.verifyOtp({
                email: userEmail,
                token: token,
                type: 'recovery'
            });

            if (error) throw error;

            showStep('change');
        } catch (error) {
            showAlert('Verification failed: ' + error.message, 'error');
        } finally {
            setLoading(btnVerify, false, 'Verify & Continue');
        }
    });

    // --- Step 3: Change Password ---
    formPassword.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            showAlert('Passwords do not match!', 'error');
            return;
        }

        try {
            setLoading(btnUpdate, true, 'Updating...');
            const { error } = await client.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            showAlert('Password updated successful! You will be logged out for security.', 'success');

            // Auto Logout
            setTimeout(async () => {
                await client.auth.signOut();
                window.location.href = 'index.html';
            }, 2000);

        } catch (error) {
            showAlert('Update failed: ' + error.message, 'error');
        } finally {
            setLoading(btnUpdate, false, '<i data-lucide="save" style="width: 18px;"></i> Update Password & Logout');
        }
    });

    // --- Helpers ---
    function showStep(step) {
        stepSend.classList.remove('active');
        stepVerify.classList.remove('active');
        stepChange.classList.remove('active');

        if (step === 'send') stepSend.classList.add('active');
        if (step === 'verify') stepVerify.classList.add('active');
        if (step === 'change') stepChange.classList.add('active');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function setLoading(btn, isLoading, text) {
        btn.disabled = isLoading;
        btn.innerHTML = isLoading ?
            `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${text}` :
            text;

        if (!isLoading && typeof lucide !== 'undefined') lucide.createIcons();
    }
});
