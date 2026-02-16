/**
 * Customers Management
 */

document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const customerList = document.getElementById('customer-list');
    const customerCountEl = document.getElementById('customer-count');

    async function loadCustomers() {
        customerList.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';

        try {
            // First try 'profiles' table, then 'participants'
            let tableName = 'profiles';
            let { data, error } = await client
                .from(tableName)
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                // Fallback attempt to 'participants'
                tableName = 'participants';
                const { data: pData, error: pError } = await client
                    .from(tableName)
                    .select('*')
                    .order('created_at', { ascending: false });

                if (pError) throw pError;
                data = pData;
            }

            renderCustomers(data);
            customerCountEl.textContent = data.length;

        } catch (err) {
            console.error('Error loading customers:', err);
            customerList.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-4">No customer data available.</td></tr>';
        }
    }

    function renderCustomers(customers) {
        if (!customers || customers.length === 0) {
            customerList.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-muted">No registered customers yet.</td></tr>';
            return;
        }

        customerList.innerHTML = customers.map(p => `
            <tr>
                <td><div class="fw-medium text-main">${p.full_name || p.name || 'Anonymous User'}</div></td>
                <td><div class="text-muted small">${p.email || 'N/A'}</div></td>
                <td><div class="text-muted small">${p.college || 'N/A'}</div></td>
                <td>
                    <span class="badge ${p.status === 'active' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'} small">
                        ${p.status || 'Registered'}
                    </span>
                </td>
                <td><div class="text-muted small">${new Date(p.created_at).toLocaleDateString()}</div></td>
            </tr>
        `).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Export functionality
    document.getElementById('btn-export')?.addEventListener('click', () => {
        alert('Export CSV feature coming soon!');
    });

    loadCustomers();
});
