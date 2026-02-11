(function () {
    const SUPABASE_URL = 'https://rcmeifutgontewyycivi.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_aJ9CPJVCp3cM1lUVrjOKFA_Yrx-jDe4';

    const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const loginForm = document.getElementById('adminLoginForm');
    const errorDiv = document.getElementById('login-error');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button');

        // UI State
        btn.disabled = true;
        btn.textContent = 'Authenticating...';
        errorDiv.textContent = '';

        try {
            const { data, error } = await supabaseAdmin.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            if (data.user) {
                // Successful login
                btn.textContent = 'Redirecting...';
                window.location.href = 'index.html';
            }
        } catch (err) {
            console.error('Login error:', err);
            errorDiv.textContent = err.message || 'Invalid credentials. Please try again.';
            btn.disabled = false;
            btn.textContent = 'Secure Login';
        }
    });
})();
