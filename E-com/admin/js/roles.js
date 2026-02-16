/**
 * Roles & Permissions Management
 */

document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const roleList = document.getElementById('role-list');
    const roleForm = document.getElementById('role-form');
    const permissionsGrid = document.getElementById('permissions-grid');
    const roleModal = new bootstrap.Modal(document.getElementById('roleModal'));
    const modalTitle = document.getElementById('roleModalTitle');

    let availablePages = [];

    // 1. Initial Load
    async function init() {
        await scanSidebarForPages();
        await loadRoles();
    }

    /**
     * Scans the sidebar.html file to dynamically find all available pages in the portal.
     * This ensures any newly created pages added to the sidebar are automatically available for role assignment.
     */
    async function scanSidebarForPages() {
        try {
            const response = await fetch('sidebar.html');
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Find all links that end with .html
            const links = Array.from(doc.querySelectorAll('a[href$=".html"]'));

            // Extract unique filenames and labels
            const pageMap = new Map();

            links.forEach(link => {
                const href = link.getAttribute('href');
                // Clean href from potential paths
                const filename = href.split('/').pop();

                if (filename && filename !== 'login.html' && filename !== 'logout' && !filename.startsWith('#')) {
                    // Try to get a clean label
                    let label = link.textContent.trim();
                    if (!label && link.querySelector('span')) {
                        label = link.querySelector('span').textContent.trim();
                    }

                    if (!pageMap.has(filename)) {
                        pageMap.set(filename, label || filename);
                    }
                }
            });

            availablePages = Array.from(pageMap.entries()).map(([filename, label]) => ({
                filename,
                label
            }));

            renderPermissionsGrid();
        } catch (err) {
            console.error('Error scanning sidebar:', err);
            permissionsGrid.innerHTML = '<div class="alert alert-danger">Failed to scan sidebar for pages.</div>';
        }
    }

    function renderPermissionsGrid() {
        if (availablePages.length === 0) {
            permissionsGrid.innerHTML = '<p class="text-muted text-center w-100 p-3">No pages found in sidebar.</p>';
            return;
        }

        permissionsGrid.innerHTML = availablePages.map(page => `
            <div class="permission-item">
                <input type="checkbox" class="form-check-input page-checkbox" id="page-${page.filename}" value="${page.filename}">
                <label class="form-check-label small" for="page-${page.filename}">${page.label}</label>
            </div>
        `).join('');
    }

    async function loadRoles() {
        try {
            const { data, error } = await client
                .from('role_permissions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase Error (loadRoles):', error);
                throw error;
            }

            renderRoles(data);
        } catch (err) {
            console.error('Detailed Error loading roles:', err);
            const errorMsg = err.message || (typeof err === 'object' ? JSON.stringify(err) : 'Unknown error');
            roleList.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error: ${errorMsg}</td></tr>`;
        }
    }

    function renderRoles(roles) {
        if (!roles || roles.length === 0) {
            roleList.innerHTML = '<tr><td colspan="4" class="empty-state">No custom roles defined yet.</td></tr>';
            return;
        }

        roleList.innerHTML = roles.map(role => `
            <tr>
                <td>
                    <div class="fw-bold text-main">${role.role_name}</div>
                </td>
                <td>
                    <div class="d-flex flex-wrap gap-1">
                        ${role.accessible_pages.length > 0
                ? role.accessible_pages.slice(0, 3).map(p => `<span class="badge badge-pages">${p}</span>`).join('')
                : '<span class="text-muted small">No access</span>'
            }
                        ${role.accessible_pages.length > 3 ? `<span class="badge bg-light text-muted">+${role.accessible_pages.length - 3} more</span>` : ''}
                    </div>
                </td>
                <td>
                    <span class="text-muted small">${new Date(role.created_at).toLocaleDateString()}</span>
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-light btn-edit" data-id="${role.id}" title="Edit Role">
                        <i data-lucide="edit-2" style="width: 14px; height: 14px;"></i>
                    </button>
                    ${role.role_name !== 'admin' && role.role_name !== 'super_admin' ? `
                        <button class="btn btn-sm btn-light text-danger btn-delete" data-id="${role.id}" title="Delete Role">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Add Event Listeners
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => editRole(btn.dataset.id, roles));
        });
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => deleteRole(btn.dataset.id));
        });
    }

    async function editRole(id, roles) {
        const role = roles.find(r => r.id === id);
        if (!role) return;

        document.getElementById('role-id').value = role.id;
        document.getElementById('role-name').value = role.role_name;
        document.getElementById('role-name').disabled = (role.role_name === 'admin' || role.role_name === 'super_admin');

        // Reset and set checkboxes
        document.querySelectorAll('.page-checkbox').forEach(cb => {
            cb.checked = role.accessible_pages.includes(cb.value);
        });

        modalTitle.textContent = 'Edit Role';
        roleModal.show();
    }

    async function deleteRole(id) {
        if (!confirm('Are you sure you want to delete this role? Users assigned to this role may lose access.')) return;

        try {
            const { error } = await client
                .from('role_permissions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadRoles();
        } catch (err) {
            alert('Error deleting role: ' + err.message);
        }
    }

    // Form Submission
    roleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roleId = document.getElementById('role-id').value;
        const roleName = document.getElementById('role-name').value.trim().toLowerCase();

        const selectedPages = Array.from(document.querySelectorAll('.page-checkbox:checked'))
            .map(cb => cb.value);

        if (!roleName) return;

        try {
            const roleData = {
                role_name: roleName,
                accessible_pages: selectedPages
            };

            let error;
            if (roleId) {
                const { error: updateError } = await client
                    .from('role_permissions')
                    .update(roleData)
                    .eq('id', roleId);
                error = updateError;
            } else {
                const { error: insertError } = await client
                    .from('role_permissions')
                    .insert(roleData);
                error = insertError;
            }

            if (error) {
                console.error('Supabase Error (saveRole):', error);
                throw error;
            }

            // Explicitly blur focus to prevent ARIA warnings before hiding
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }

            roleModal.hide();
            roleForm.reset();
            loadRoles();
        } catch (err) {
            console.error('Error saving role:', err);
            alert('Error saving role: ' + (err.message || err.details || 'Conflict or Database Error'));
        }
    });

    // Modal Events
    document.getElementById('btn-add-role').addEventListener('click', () => {
        document.getElementById('role-id').value = '';
        document.getElementById('role-name').value = '';
        document.getElementById('role-name').disabled = false;
        document.querySelectorAll('.page-checkbox').forEach(cb => cb.checked = false);
        modalTitle.textContent = 'Create New Role';
    });

    // Bulk Select
    document.getElementById('btn-select-all').addEventListener('click', () => {
        document.querySelectorAll('.page-checkbox').forEach(cb => cb.checked = true);
    });

    document.getElementById('btn-deselect-all').addEventListener('click', () => {
        document.querySelectorAll('.page-checkbox').forEach(cb => cb.checked = false);
    });

    init();
});
