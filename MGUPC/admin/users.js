document.addEventListener('DOMContentLoaded', async () => {
    // Wait for Supabase to be available
    if (!window.supabaseAdmin) {
        console.error('Supabase client not initialized. Make sure admin.js is loaded first.');
        return;
    }

    // Wait for auth check in admin.js to complete? 
    // admin.js redirects if not auth. We can just try to load users.
    // However, it's cleaner to wait or just check if we have a user.

    // We can rely on the fact that admin.js runs first and handles the auth check.
    // But we might want to delay slightly or just listen for a custom event if admin.js emitted one.
    // For now, we'll just try loading. If RLS fails, we show an error.

    loadUsers();

    // Attach event listeners
    // (None for now, buttons use onclick attributes defined globally below)
});

async function loadUsers() {
    const tbody = document.getElementById('usersList');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Loading users...</td></tr>';

    const { data, error } = await window.supabaseAdmin
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red;">Error: ${error.message}</td></tr>`;
        return;
    }

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No users found.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(user => {
        const role = user.role || 'volunteer'; // Default to volunteer if null
        return `
            <tr>
                <td>${user.email}</td>
                <td>
                    <select class="form-select" style="width: auto; padding: 0.2rem;" onchange="updateUserRole('${user.email}', this.value)">
                        <option value="volunteer" ${role === 'volunteer' ? 'selected' : ''}>Volunteer</option>
                        <option value="coordinator" ${role === 'coordinator' ? 'selected' : ''}>Coordinator</option>
                        <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="super admin" ${role === 'super admin' ? 'selected' : ''}>Super Admin</option>
                    </select>
                </td>
                <td>${new Date(user.created_at).toLocaleString()}</td>
                <td>
                    <button class="btn btn-danger" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="deleteUser('${user.email}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

window.addUser = async () => {
    const emailInput = document.getElementById('newUserEmail');
    const roleInput = document.getElementById('newUserRole');

    const email = emailInput.value.trim();
    const role = roleInput.value;

    if (!email) {
        alert('Please enter an email address.');
        return;
    }

    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        alert('Please enter a valid email address.');
        return;
    }

    // Show loading state?
    const btn = document.querySelector('.add-user-form button');
    const originalText = btn.textContent;
    btn.textContent = 'Adding...';
    btn.disabled = true;

    const { error } = await window.supabaseAdmin
        .from('admin_users')
        .insert([{ email, role }]);

    btn.textContent = originalText;
    btn.disabled = false;

    if (error) {
        console.error('Error adding user:', error);
        if (error.code === '23505') { // Unique violation
            alert('This email is already registered as an admin user.');
        } else {
            alert('Error adding user: ' + error.message);
        }
    } else {
        alert('User added successfully.');
        emailInput.value = '';
        loadUsers();
    }
};

window.updateUserRole = async (email, newRole) => {
    // Optimistic UI updates are risky here if it fails, so we'll just alert on failure.
    // Or we could reload users on success.

    // We should ask for confirmation maybe? Nah, logic allows quick changes.

    const { error } = await window.supabaseAdmin
        .from('admin_users')
        .update({ role: newRole })
        .eq('email', email);

    if (error) {
        console.error('Error updating role:', error);
        alert('Failed to update role: ' + error.message);
        loadUsers(); // Revert UI
    } else {
        // Success
        console.log(`Updated ${email} to ${newRole}`);
        // Optionally show a toast or just do nothing as the select reflects the change.
    }
};

window.deleteUser = async (email) => {
    if (!confirm(`Are you sure you want to delete the user ${email}? This will remove their admin access immediately.`)) {
        return;
    }

    const { error } = await window.supabaseAdmin
        .from('admin_users')
        .delete()
        .eq('email', email);

    if (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user: ' + error.message);
    } else {
        loadUsers();
    }
};
