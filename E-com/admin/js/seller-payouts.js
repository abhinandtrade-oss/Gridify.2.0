document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const payoutList = document.getElementById('payout-list');
    const payoutForm = document.getElementById('payout-form');
    const payoutModal = new bootstrap.Modal(document.getElementById('payoutModal'));
    const modalTitle = document.getElementById('payoutModalTitle');
    const sellerSelect = document.getElementById('seller-id');

    // UI Elements for stats
    const statPendingAmount = document.getElementById('stat-pending-amount');
    const statPaidAmount = document.getElementById('stat-paid-amount');
    const statSellerCount = document.getElementById('stat-seller-count');

    let allPayouts = [];
    let allSellers = [];

    // Fetch and display data
    async function init() {
        await fetchSellers();
        await loadPayouts();
    }

    async function fetchSellers() {
        // Fetch users who are either 'active' or 'approved'
        const { data, error } = await client
            .from('sellers')
            .select('id, store_name, status')
            .in('status', ['active', 'approved']);

        if (error) {
            console.error('Error fetching sellers:', error);
            return;
        }

        allSellers = data;
        renderSellerDropdown(data);
        statSellerCount.textContent = data.length;
    }

    function renderSellerDropdown(sellers) {
        sellerSelect.innerHTML = '<option value="">Choose a seller...</option>' +
            sellers.map(s => `<option value="${s.id}">${s.store_name}</option>`).join('');
    }

    async function loadPayouts() {
        payoutList.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span class="ms-2">Loading payouts...</span>
                </td>
            </tr>
        `;

        try {
            const { data, error } = await client
                .from('seller_payouts')
                .select(`
                    *,
                    sellers (
                        store_name
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching payouts:', error);
                // Check for both Postgres (42P01) and PostgREST (PGRST205) missing table codes
                if (error.code === '42P01' || error.code === 'PGRST205') {
                    payoutList.innerHTML = `<tr><td colspan="6" class="empty-state text-warning">
                        <i data-lucide="alert-triangle"></i>
                        <h4 class="mt-3">Table Missing</h4>
                        <p>The 'seller_payouts' table does not exist in your Supabase database.</p>
                        <button class="btn btn-primary mt-2" onclick="showSql()">
                            <i data-lucide="terminal" class="me-2"></i>View Setup SQL
                        </button>
                    </td></tr>`;
                } else {
                    payoutList.innerHTML = `<tr><td colspan="6" class="empty-state text-danger">Error loading payouts: ${error.message}</td></tr>`;
                }
                lucide.createIcons();
                return;
            }

            allPayouts = data;
            renderPayouts(data);
            updateStats(data);
        } catch (err) {
            console.error('Unexpected error:', err);
            payoutList.innerHTML = `<tr><td colspan="6" class="empty-state text-danger">Unexpected error occurred.</td></tr>`;
        }
    }

    function renderPayouts(payouts) {
        if (payouts.length === 0) {
            payoutList.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">
                        <i data-lucide="banknote"></i>
                        <p>No payout records found matching filters.</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        payoutList.innerHTML = payouts.map(payout => `
            <tr>
                <td>
                    <div class="text-nowrap">${new Date(payout.created_at).toLocaleDateString()}</div>
                    <div class="text-muted small">${new Date(payout.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td>
                    <div class="category-name">${payout.sellers?.store_name || 'Unknown Seller'}</div>
                    <div class="text-muted small">ID: #${payout.id.substring(0, 8)}</div>
                </td>
                <td>
                    <div class="fw-bold">₹${parseFloat(payout.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                </td>
                <td>
                    <span class="badge ${getStatusBadgeClass(payout.status)}">
                        ${payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </span>
                </td>
                <td>
                    <div class="text-muted small">${payout.transaction_id || '---'}</div>
                </td>
                <td>
                    <div class="action-btns justify-content-end">
                        <button class="btn-icon edit-btn" data-id="${payout.id}" title="Edit Record">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="btn-icon delete-btn" data-id="${payout.id}" title="Delete Record">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        lucide.createIcons();
        attachEventListeners();
    }

    function getStatusBadgeClass(status) {
        switch (status) {
            case 'paid': return 'badge-success';
            case 'requested': return 'badge-warning';
            case 'processing': return 'badge-info';
            case 'cancelled': return 'badge-danger';
            default: return 'badge-secondary';
        }
    }

    function updateStats(payouts) {
        let pending = 0;
        let paid = 0;

        payouts.forEach(p => {
            if (p.status === 'requested' || p.status === 'processing') {
                pending += parseFloat(p.amount) || 0;
            } else if (p.status === 'paid') {
                paid += parseFloat(p.amount) || 0;
            }
        });

        statPendingAmount.textContent = `₹${pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        statPaidAmount.textContent = `₹${paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }

    function attachEventListeners() {
        // Edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const payout = allPayouts.find(p => p.id === id);
                if (payout) {
                    modalTitle.textContent = 'Edit Payout Record';
                    document.getElementById('payout-id').value = payout.id;
                    document.getElementById('seller-id').value = payout.seller_id;
                    document.getElementById('payout-amount').value = payout.amount;
                    document.getElementById('payout-status').value = payout.status;
                    document.getElementById('payout-notes').value = payout.notes || '';
                    payoutModal.show();
                }
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this payout record?')) {
                    const { error } = await client
                        .from('seller_payouts')
                        .delete()
                        .eq('id', id);

                    if (error) {
                        alert('Error deleting: ' + error.message);
                    } else {
                        loadPayouts();
                    }
                }
            });
        });
    }

    // Form Submission
    payoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('payout-id').value;
        const payoutData = {
            seller_id: document.getElementById('seller-id').value,
            amount: parseFloat(document.getElementById('payout-amount').value),
            status: id ? document.getElementById('payout-status').value : 'requested',
            notes: document.getElementById('payout-notes').value,
        };

        let result;
        if (id) {
            result = await client.from('seller_payouts').update(payoutData).eq('id', id);
        } else {
            result = await client.from('seller_payouts').insert([payoutData]);
        }

        if (result.error) {
            alert('Error saving: ' + result.error.message);
        } else {
            payoutModal.hide();
            payoutForm.reset();
            loadPayouts();
        }
    });

    // Filters
    document.getElementById('search-seller').addEventListener('input', filterData);
    document.getElementById('filter-status').addEventListener('change', filterData);

    function filterData() {
        const searchTerm = document.getElementById('search-seller').value.toLowerCase();
        const statusFilter = document.getElementById('filter-status').value;

        const filtered = allPayouts.filter(p => {
            const matchesSearch = p.sellers?.store_name.toLowerCase().includes(searchTerm) ||
                p.id.toLowerCase().includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

        renderPayouts(filtered);
    }

    // Reset modal on close
    document.getElementById('payoutModal').addEventListener('hidden.bs.modal', () => {
        payoutForm.reset();
        document.getElementById('payout-id').value = '';
        modalTitle.textContent = 'Record New Payout';
    });

    window.showSql = () => {
        const sql = `
-- 1. Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create the seller_payouts table
CREATE TABLE IF NOT EXISTS public.seller_payouts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.sellers(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'paid', 'cancelled')),
    transaction_id TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

-- 4. Create Policy (Allow admins full access)
-- Note: This policy allows any authenticated user. 
-- For production, you should restrict this to admin roles only.
CREATE POLICY "Allow authenticated users full access" ON public.seller_payouts
    FOR ALL USING (auth.role() = 'authenticated');

-- 5. Create updated_at trigger (recommended)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_seller_payouts_modtime
    BEFORE UPDATE ON public.seller_payouts
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();

-- SUCCESS: Copy and run this in your Supabase SQL Editor.
        `;
        // Create a temporary textarea to copy to clipboard
        const el = document.createElement('textarea');
        el.value = sql.trim();
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);

        alert("SQL Setup Script has been COPIED to your clipboard!\n\nPlease paste it into your Supabase SQL Editor and click 'Run'.");
    };

    // Check for sellerId in URL to auto-open modal
    const urlParams = new URLSearchParams(window.location.search);
    const sellerIdParam = urlParams.get('sellerId');

    async function init() {
        await fetchSellers();
        await loadPayouts();

        if (sellerIdParam) {
            document.getElementById('seller-id').value = sellerIdParam;
            payoutModal.show();
            // Clear URL param without reloading to prevent re-opening on refresh
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    init();
});
