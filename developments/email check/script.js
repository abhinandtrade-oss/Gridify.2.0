document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('verificationForm');
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const messageDiv = document.getElementById('message');
    const displayEmail = document.getElementById('display-email');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const resendBtn = document.getElementById('resendBtn');
    const otpInput = document.getElementById('otp');

    let userEmail = '';

    const showMessage = (text, type = 'success') => {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    };

    const toggleLoading = (btn, isLoading) => {
        btn.disabled = isLoading;
        btn.textContent = isLoading ? 'Processing...' : btn.getAttribute('data-original-text') || btn.textContent;
        if (!btn.getAttribute('data-original-text')) {
            btn.setAttribute('data-original-text', btn.textContent === 'Processing...' ? '' : btn.textContent);
        }
    };

    // Step 1: Send OTP
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (step1.classList.contains('hidden')) return;

        const formData = new FormData(form);
        userEmail = formData.get('email');
        formData.append('action', 'send_otp');

        toggleLoading(sendOtpBtn, true);

        try {
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server error ${response.status}: Use a PHP server (like XAMPP or 'php -S') instead of Live Server.`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server did not return JSON. Ensure your PHP server is running.');
            }

            const data = await response.json();

            if (data.success) {
                displayEmail.textContent = userEmail;
                step1.classList.add('hidden');
                step2.classList.remove('hidden');
                showMessage(data.message, 'success');
            } else {
                showMessage(data.message, 'error');
            }
        } catch (error) {
            showMessage(error.message || 'Something went wrong.', 'error');
            console.error(error);
        } finally {
            toggleLoading(sendOtpBtn, false);
        }
    });

    // Step 2: Verify OTP
    verifyOtpBtn.addEventListener('click', async () => {
        const otp = otpInput.value;
        if (!otp || otp.length !== 6) {
            showMessage('Please enter a valid 6-digit OTP', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('action', 'verify_otp');
        formData.append('otp', otp);
        formData.append('email', userEmail);

        toggleLoading(verifyOtpBtn, true);

        try {
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Server error ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server did not return JSON.');
            }

            const data = await response.json();

            if (data.success) {
                showMessage('Verification successful! Redirecting...', 'success');
                setTimeout(() => {
                    window.location.href = 'coming-soon.html';
                }, 1500);
            } else {
                showMessage(data.message, 'error');
            }
        } catch (error) {
            showMessage(error.message || 'Something went wrong.', 'error');
            console.error(error);
        } finally {
            toggleLoading(verifyOtpBtn, false);
        }
    });

    // Resend OTP
    resendBtn.addEventListener('click', async () => {
        const formData = new FormData();
        formData.append('action', 'send_otp');
        formData.append('email', userEmail);

        toggleLoading(resendBtn, true);

        try {
            const response = await fetch('api.php', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Server error');

            const data = await response.json();
            showMessage(data.success ? 'New OTP sent!' : data.message, data.success ? 'success' : 'error');
        } catch (error) {
            showMessage('Failed to resend OTP. Ensure PHP is running.', 'error');
        } finally {
            toggleLoading(resendBtn, false);
        }
    });
});
