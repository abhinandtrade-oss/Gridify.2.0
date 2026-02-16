/**
 * User Management - Admins & Participants
 */

document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const adminList = document.getElementById('admin-list');
    const participantList = document.getElementById('participant-list');
    const userForm = document.getElementById('user-form');
    const userModal = new bootstrap.Modal(document.getElementById('userModal'));

    const adminCountEl = document.getElementById('admin-count');
    const participantCountEl = document.getElementById('participant-count');

    let currentUserRole = null;
    let cachedAdmins = [];
    let cachedSellers = [];
    let cachedParticipants = [];

    // Initialize
    async function init() {
        // 1. Get role first so we know what permissions the user has
        await getCurrentUserRole();
        // 2. Ensure profile is synced (minimal impact if it fails)
        await ensureUserProfile();
        // 3. Load UI data
        await loadAvailableRoles();
        await refreshAll();
    }

    async function loadAvailableRoles() {
        const roleDropdown = document.getElementById('admin-role');
        if (!roleDropdown) return;

        try {
            // Fetch from the source of truth: role_permissions table
            const { data: roles, error } = await client
                .from('role_permissions')
                .select('role_name')
                .order('role_name', { ascending: true });

            if (error) throw error;

            // System role labels
            const systemRoleLabels = {
                'super_admin': 'Super Administrator',
                'admin': 'Administrator',
                'seller': 'Seller',
                'user': 'Basic User / Participant'
            };

            // Also ensure standard roles are present even if not in DB (safety fallback)
            let allRoles = roles.map(r => r.role_name);
            ['super_admin', 'admin', 'seller', 'user'].forEach(sr => {
                if (!allRoles.includes(sr)) allRoles.push(sr);
            });

            // Sort logic: system roles first, then others
            const systemPriority = ['super_admin', 'admin', 'seller', 'user'];
            allRoles.sort((a, b) => {
                const idxA = systemPriority.indexOf(a);
                const idxB = systemPriority.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
            });

            roleDropdown.innerHTML = '<option value="" disabled selected>Select a role</option>' +
                allRoles.map(role => {
                    const label = systemRoleLabels[role] ||
                        role.split(/[_\-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    return `<option value="${role}">${label}</option>`;
                }).join('');

        } catch (err) {
            console.error('Error loading roles for dropdown:', err);
            roleDropdown.innerHTML = '<option value="" disabled>Error loading roles</option>';
        }
    }

    async function refreshAll() {
        await loadAdmins();
        updateStats();
    }

    function updateStats() {
        const admins = cachedAdmins.length;
        document.getElementById('stat-admins').textContent = admins;
        // Other stats can be periodically fetched or synced if needed, 
        // but for this page we focus on Team Members.
    }

    async function ensureUserProfile() {
        try {
            const { data: { session } } = await client.auth.getSession();
            if (session) {
                const { user } = session;

                // 1. Check if profile exists first to avoid unnecessary 403s on upsert
                const { data: profile, error: fetchError } = await client
                    .from('profiles')
                    .select('id, email')
                    .eq('id', user.id)
                    .maybeSingle();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    console.warn('Could not verify profile existence:', fetchError);
                }

                if (profile && profile.email === user.email.toLowerCase().trim()) {
                    // Profile already synced, skip upsert
                    return;
                }

                // 2. Only upsert if missing or email mismatched
                const { error } = await client.from('profiles').upsert({
                    id: user.id,
                    email: user.email.toLowerCase().trim()
                }, { onConflict: 'id' });

                if (error) {
                    // Only show warning if we expected it to work (as a Super Admin) or if it's a critical failure
                    if (currentUserRole === 'super_admin') {
                        console.error('Super Admin profile sync failed:', error);
                    } else {
                        console.warn('Profile sync limited by RLS. This is normal for non-super admins.');
                    }
                }
            }
        } catch (e) {
            console.warn('Profile refinement skipped:', e);
        }
    }

    async function getCurrentUserRole() {
        const { data: { session } } = await client.auth.getSession();
        if (session) {
            const { data } = await client
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();
            currentUserRole = data?.role;

            // Show/hide "Add Admin" based on role
            const addBtn = document.getElementById('btn-add-admin');
            if (currentUserRole !== 'super_admin') {
                // addBtn.style.display = 'none'; // Optional: allow admins to add lower admins?
            }
        }
    }

    /**
     * Load Team Members (Admins)
     * Fetches from user_roles joined with profiles (if available)
     */
    async function loadAdmins() {
        adminList.innerHTML = '<tr><td colspan="4" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

        try {
            // 1. Fetch from all records in user_roles
            const { data: roles, error: rolesError } = await client
                .from('user_roles')
                .select('user_id, role')
                .order('role', { ascending: true });

            if (rolesError) throw rolesError;

            // 2. Fetch from confirmed tables (profiles, customers)
            const ids = roles.map(r => r.user_id);
            const [
                { data: profiles },
                { data: customers }
            ] = await Promise.all([
                client.from('profiles').select('id, email, created_at').in('id', ids),
                client.from('customers').select('id, email').in('id', ids)
            ]);

            // Create data map
            const userDataMap = {};
            if (profiles) profiles.forEach(p => userDataMap[p.id] = { email: p.email, date: p.created_at });
            if (customers) customers.forEach(c => {
                if (!userDataMap[c.id]) userDataMap[c.id] = { email: c.email };
            });

            // Also get current user info for fallback
            const { data: sessionData } = await client.auth.getSession();
            const currentAuthUser = sessionData.session?.user;

            // Combine
            cachedAdmins = roles.map(r => {
                let info = userDataMap[r.user_id] || {};
                let email = info.email;
                let date = info.date ? new Date(info.date).toLocaleDateString() : 'Active';

                // Fallback 1: Is it the current user?
                if (!email && currentAuthUser && currentAuthUser.id === r.user_id) {
                    email = currentAuthUser.email;
                }

                return {
                    ...r,
                    email: email || 'Hidden / Protected Email',
                    displayDate: date
                };
            });

            renderAdmins(cachedAdmins);
            if (adminCountEl) adminCountEl.textContent = cachedAdmins.length;
            updateStats();
        } catch (err) {
            console.error('Error loading admins:', err);
            adminList.innerHTML = `<tr><td colspan="4" class="text-center text-danger p-4">Failed to load team members: ${err.message}</td></tr>`;
        }
    }

    function renderAdmins(admins) {
        if (!admins || admins.length === 0) {
            adminList.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-muted">No admin users found.</td></tr>';
            return;
        }

        adminList.innerHTML = admins.map(admin => {
            return `
                <tr>
                    <td>
                        <div class="d-flex align-items-center gap-3">
                            <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">
                                ${admin.email.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div class="fw-semibold text-main">${admin.email}</div>
                                <div class="text-muted small">UID: ${admin.user_id}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                <div class="user-badge badge-${admin.role}">${admin.role.replace('_', ' ')}</div>
            </td>
            <td>
                <div class="text-muted small">${admin.displayDate}</div>
            </td>
            <td class="text-end">
                <div class="dropdown">
                    <button class="btn btn-sm btn-light" data-bs-toggle="dropdown">
                        <i data-lucide="more-vertical" style="width: 14px; height: 14px;"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item small" href="#" onclick="editAdmin('${admin.user_id}', '${admin.email}')">Edit User Role</a></li>
                        ${admin.role !== 'super_admin' ? `<li><hr class="dropdown-divider"></li>` : ''}
                        ${admin.role !== 'super_admin' ? `<li><a class="dropdown-item small text-danger" href="#" onclick="removeAdmin('${admin.user_id}')">Remove Role</a></li>` : ''}
                    </ul>
                </div>
            </td>
        </tr>
    `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Seller and Participant loading removed - handled by dedicated pages (sellers.html, customers.html)


    // Form submission for adding admin (Placeholder - usually requires Invite or Cloud Function)
    // Reset form for "Add Admin"
    document.getElementById('btn-add-admin').addEventListener('click', () => {
        userForm.reset();
        document.getElementById('admin-user-id').value = '';
        const emailInput = document.getElementById('admin-email');
        if (emailInput) {
            emailInput.disabled = false;
            emailInput.value = '';
        }
        document.getElementById('userModalTitle').textContent = 'Add New Admin';
    });

    // Form submission for adding/editing admin
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const userId = document.getElementById('admin-user-id').value;
        const email = document.getElementById('admin-email').value;
        const role = document.getElementById('admin-role').value;

        try {
            if (userId) {
                // UPDATE or UPSERT into user_roles
                const { error } = await client
                    .from('user_roles')
                    .upsert({
                        user_id: userId,
                        role: role
                    }, { onConflict: 'user_id' });

                if (error) {
                    console.error('Role Update Error:', error);
                    if (error.code === '23514') {
                        // The database has a CHECK constraint. Instead of just throwing, we provide a very clear explanation and SQL.
                        const sql = `ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;`;
                        const msg = `The role "${role}" is not allowed by your database settings.\n\n` +
                            `To allow dynamic roles, please run this SQL in your Supabase SQL Editor:\n\n` +
                            `${sql}\n\n` +
                            `This will remove the restriction and allow any role created in Roles & Permissions to be assigned.`;
                        throw new Error(msg);
                    }
                    throw error;
                }

                // NEW: Also upsert into profiles to maintain the UID -> Email link
                if (email && email.includes('@')) {
                    await client.from('profiles').upsert({
                        id: userId,
                        email: email.toLowerCase().trim()
                    }, { onConflict: 'id' });
                }

                if (role === 'seller') {
                    // Check if they are in sellers table
                    const { data: isSeller } = await client.from('sellers').select('id').ilike('email', email).maybeSingle();
                    if (!isSeller) {
                        showAlert('Warning: This user has been granted the "Seller" role, but does not have a Store Profile yet. Please add them in the Sellers Management section to complete their setup.', 'warning');
                    }
                }

                showAlert('User role updated successfully!', 'success');
            } else {
                // ADD: Try to find user by email first
                console.log('Searching for user by email:', email);
                const cleanEmail = email.toLowerCase().trim();

                // 1. Check profiles
                let { data: foundUser } = await client
                    .from('profiles')
                    .select('id')
                    .ilike('email', cleanEmail)
                    .maybeSingle();

                // 2. Check participants if not in profiles
                if (!foundUser) {
                    const { data: foundParticipant } = await client
                        .from('customers')
                        .select('id')
                        .ilike('email', cleanEmail)
                        .maybeSingle();
                    if (foundParticipant) foundUser = foundParticipant;
                }

                if (foundUser) {
                    console.log('Assigning role:', role, 'to user:', foundUser.id);
                    const { error: roleError } = await client
                        .from('user_roles')
                        .upsert({
                            user_id: foundUser.id,
                            role: role
                        }, { onConflict: 'user_id' });

                    if (roleError) {
                        console.error('Role Assignment Error:', roleError);
                        if (roleError.code === '23514') {
                            throw new Error(`The role "${role}" is not allowed by the database constraint. Please update the "user_roles_role_check" constraint in your Supabase SQL Editor to include this role.`);
                        }
                        throw roleError;
                    }

                    if (role === 'seller') {
                        const { data: isSeller } = await client.from('sellers').select('id').ilike('email', cleanEmail).maybeSingle();
                        if (!isSeller) {
                            showAlert('User found and role assigned! Note: No store profile found for this email. Please register them as a seller in Sellers section.', 'warning');
                        } else {
                            showAlert('User found and Seller role assigned successfully!', 'success');
                        }
                    } else {
                        showAlert('User found and role assigned successfully!', 'success');
                    }
                } else {
                    showAlert('No user found with email "' + email + '".\n\nTo add an admin, use the Supabase Auth dashboard to create/invite the user first, then assign their role here.', 'error');
                }
            }
            userModal.hide();
            loadAdmins();
            updateStats();
        } catch (err) {
            console.error('Error saving user:', err);
            showAlert('Error: ' + err.message, 'error');
        }
    });

    // Search Functionality
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();

            // Filter Admins
            const filteredAdmins = cachedAdmins.filter(a =>
                (a.email && a.email.toLowerCase().includes(term)) ||
                (a.user_id && a.user_id.toLowerCase().includes(term))
            );
            renderAdmins(filteredAdmins);
        });
    }

    // Initial load
    init();
});

// Global functions for inline events
window.updateSellerStatus = (id, status) => {
    showConfirm(`Are you sure you want to set this seller to ${status}?`, async () => {
        try {
            const { error } = await window.supabase
                .from('sellers')
                .update({ status: status })
                .eq('id', id);

            if (error) throw error;
            showAlert(`Seller marked as ${status}.`, 'success');

            // Re-trigger global refresh defined in DOMContentLoaded
            // We'll use a custom event or just export the refreshAll if we had it global
            // For now, reload is safest but let's try to reach back into the closure
            window.location.reload();
        } catch (err) {
            showAlert('Error: ' + err.message, 'error');
        }
    });
};

window.viewUserDetails = async (userId) => {
    const detailModal = new bootstrap.Modal(document.getElementById('userDetailsModal'));
    const content = document.getElementById('user-detail-content');
    detailModal.show();

    try {
        // Search across all tables for this user info
        const [
            { data: profile },
            { data: customer },
            { data: seller },
            { data: role }
        ] = await Promise.all([
            window.supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
            window.supabase.from('customers').select('*').eq('id', userId).maybeSingle(),
            window.supabase.from('sellers').select('*').ilike('email', (await window.supabase.from('profiles').select('email').eq('id', userId).maybeSingle()).data?.email || '___').maybeSingle(),
            window.supabase.from('user_roles').select('*').eq('user_id', userId).maybeSingle()
        ]);

        const user = profile || customer || { id: userId, email: 'Unknown' };

        content.innerHTML = `
            <div class="d-flex flex-column align-items-center mb-4">
                <div class="user-avatar indigo mb-3" style="width: 80px; height: 80px; font-size: 2rem;">
                    ${(user.full_name || user.name || 'U').charAt(0).toUpperCase()}
                </div>
                <h4 class="mb-1">${user.full_name || user.name || 'User'}</h4>
                <div class="text-muted small mb-2">${user.email}</div>
                <span class="user-badge badge-${role?.role || 'user'}">${(role?.role || 'Basic User').replace('_', ' ')}</span>
            </div>
            
            <div class="detail-list bg-light p-3 rounded-4">
                <div class="mb-3">
                    <label class="text-muted small fw-bold text-uppercase">User ID</label>
                    <div class="text-break small">${userId}</div>
                </div>
                ${customer ? `
                <div class="mb-3">
                    <label class="text-muted small fw-bold text-uppercase">Account Type</label>
                    <div>Customer</div>
                </div>
                <div class="mb-3">
                    <label class="text-muted small fw-bold text-uppercase">Joined Date</label>
                    <div>${new Date(customer.joined_date).toLocaleString()}</div>
                </div>
                ` : ''}
                ${seller ? `
                <hr>
                <div class="mb-3">
                    <label class="text-muted small fw-bold text-uppercase">Store Name</label>
                    <div>${seller.store_name}</div>
                </div>
                <div class="mb-3">
                    <label class="text-muted small fw-bold text-uppercase">Business Status</label>
                    <div class="text-capitalize">${seller.status}</div>
                </div>
                ` : ''}
            </div>
        `;
    } catch (err) {
        content.innerHTML = `<div class="alert alert-danger">Error loading details: ${err.message}</div>`;
    }
};

window.removeAdmin = (id) => {
    showConfirm('Are you sure you want to remove this admin?', async () => {
        const { error } = await window.supabase
            .from('user_roles')
            .delete()
            .eq('user_id', id);

        if (error) showAlert(error.message, 'error');
        else window.location.reload();
    });
};
window.editAdmin = async (userId, email) => {
    let finalUserId = userId;
    const cleanEmail = email ? email.toLowerCase().trim() : null;

    // If userId is missing but we have an email, try to find the profile (Resilient Search)
    if (!finalUserId && cleanEmail) {
        console.log('Attempting to find user by email:', cleanEmail);

        // Try profiles table
        const { data: profile } = await window.supabase
            .from('profiles')
            .select('id')
            .ilike('email', cleanEmail)
            .maybeSingle();

        if (profile) {
            finalUserId = profile.id;
        } else {
            // Try customers table
            const { data: customer } = await window.supabase
                .from('customers')
                .select('id')
                .ilike('email', cleanEmail)
                .maybeSingle();

            if (customer) {
                finalUserId = customer.id;
            }
        }
    }

    // Fallback: If still no ID, ask the user to enter it manually (since they can see it in dashboard)
    if (!finalUserId || finalUserId === 'undefined' || finalUserId === '') {
        showPrompt('Cannot auto-identify UID for ' + (email || 'this user') + '.\n\nPlease copy and paste the User UID from the Supabase Auth dashboard:', '', (manualId) => {
            if (manualId) {
                continueEditAdmin(manualId.trim(), email);
            }
        });
        return;
    }

    continueEditAdmin(finalUserId, email);
};

async function continueEditAdmin(finalUserId, email) {
    const userForm = document.getElementById('user-form');
    const modalTitle = document.getElementById('userModalTitle');
    const emailInput = document.getElementById('admin-email');
    const roleInput = document.getElementById('admin-role');
    const idInput = document.getElementById('admin-user-id');
    const userModal = new bootstrap.Modal(document.getElementById('userModal'));

    idInput.value = finalUserId;
    modalTitle.textContent = 'Edit User Role';
    emailInput.value = email || ('User ID: ' + finalUserId);
    emailInput.disabled = true;

    // Fetch current role to pre-select
    const { data: roleData } = await window.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', finalUserId)
        .maybeSingle();

    if (roleData) {
        roleInput.value = roleData.role;
    } else {
        roleInput.value = '';
    }

    userModal.show();
}
