document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const payoutList = document.getElementById('payout-list');
    const payoutForm = document.getElementById('payout-form');
    const payoutModal = new bootstrap.Modal(document.getElementById('payoutModal'));
    const modalTitle = document.getElementById('payoutModalTitle');

    // UI Elements for stats
    const statPendingAmount = document.getElementById('stat-pending-amount');
    const statPaidAmount = document.getElementById('stat-paid-amount');
    const statRequestCount = document.getElementById('stat-request-count');

    // Modal elements
    const currentStatusBadge = document.getElementById('current-status-badge');
    const stepProcessing = document.getElementById('step-processing');
    const stepAdjustments = document.getElementById('step-adjustments');
    const stepPayment = document.getElementById('step-payment');
    const btnSavePayout = document.getElementById('btn-save-payout');
    const btnCancelPayout = document.getElementById('btn-cancel-payout');
    const additionsInput = document.getElementById('payout-additions');
    const reductionsInput = document.getElementById('payout-reductions');
    const totalDisplay = document.getElementById('total-payable-display');
    const amountInput = document.getElementById('payout-amount');

    // New Notes & Cancellation Elements
    const notesHistory = document.getElementById('notes-history');
    const newNoteText = document.getElementById('new-note-text');
    const cancellationReasonContainer = document.getElementById('cancellation-reason-container');
    const cancellationReasonInput = document.getElementById('cancellation-reason');
    const defaultFooterBtns = document.getElementById('default-footer-btns');
    const cancellationFooterBtns = document.getElementById('cancellation-footer-btns');
    const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
    const btnBackFromCancel = document.getElementById('btn-back-from-cancel');
    const btnMoveBack = document.getElementById('btn-move-back');

    let allPayouts = [];
    let currentPayout = null;
    let currentUser = null;

    // Fetch and display data
    async function init() {
        const { data: { user } } = await client.auth.getUser();
        currentUser = user;
        await loadPayouts();
        subscribeToPayouts();
    }

    async function loadPayouts() {
        payoutList.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span class="ms-2">Loading requests...</span>
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
                payoutList.innerHTML = `<tr><td colspan="6" class="empty-state text-danger">Error loading payouts: ${error.message}</td></tr>`;
                lucide.createIcons();
                return;
            }

            allPayouts = data;
            filterData(); // Apply default filter
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
                        <p>No payout requests found.</p>
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
                    ${payout.total_payable && payout.total_payable != payout.amount ? `<div class="text-primary small">Total: ₹${parseFloat(payout.total_payable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>` : ''}
                </td>
                <td>
                    <span class="badge ${getStatusBadgeClass(payout.status)}">
                        ${getStatusLabel(payout.status)}
                    </span>
                </td>
                <td>
                    <div class="text-muted small">${payout.transaction_id || '---'}</div>
                </td>
                <td>
                    <div class="action-btns justify-content-end">
                        <button class="btn btn-outline-primary btn-sm px-3 edit-btn" data-id="${payout.id}">
                            ${payout.status === 'paid' || payout.status === 'cancelled' ? 'View' : 'Process'}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        lucide.createIcons();
        attachEventListeners();
        updateStats(allPayouts);
    }

    function getStatusBadgeClass(status) {
        switch (status) {
            case 'paid': return 'badge-success';
            case 'requested': return 'badge-warning';
            case 'processing': return 'badge-info';
            case 'approval_pending': return 'badge-approval-pending';
            case 'cancelled': return 'badge-danger';
            default: return 'badge-secondary';
        }
    }

    function getStatusLabel(status) {
        return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    function updateStats(payouts) {
        let pending = 0;
        let paid = 0;
        let requests = 0;

        // Initialize status counts
        const counts = {
            all: payouts.length,
            requested: 0,
            processing: 0,
            approval_pending: 0,
            paid: 0,
            cancelled: 0
        };

        payouts.forEach(p => {
            if (counts.hasOwnProperty(p.status)) {
                counts[p.status]++;
            }

            if (p.status !== 'paid' && p.status !== 'cancelled') {
                pending += parseFloat(p.amount) || 0;
                requests++;
            } else if (p.status === 'paid') {
                paid += parseFloat(p.total_payable || p.amount) || 0;
            }
        });

        statPendingAmount.textContent = `₹${pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        statPaidAmount.textContent = `₹${paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        statRequestCount.textContent = requests;

        // Update card counts
        Object.keys(counts).forEach(status => {
            const countEl = document.getElementById(`count-${status}`);
            if (countEl) countEl.textContent = counts[status];
        });
    }

    function calculateTotal() {
        const amount = parseFloat(amountInput.value) || 0;
        const additions = parseFloat(additionsInput.value) || 0;
        const reductions = parseFloat(reductionsInput.value) || 0;
        const total = amount + additions - reductions;
        totalDisplay.textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        return total;
    }

    additionsInput.addEventListener('input', calculateTotal);
    reductionsInput.addEventListener('input', calculateTotal);

    // Filter Card Listeners
    document.querySelectorAll('.status-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.status-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            filterData();
        });
    });

    function attachEventListeners() {
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const payout = allPayouts.find(p => p.id === id);
                if (payout) {
                    currentPayout = payout;
                    openPayoutModal(payout);
                }
            });
        });
    }

    function renderNotes(history) {
        if (!history || history.length === 0) {
            notesHistory.innerHTML = '<div class="text-center text-muted py-3"><small>No notes history.</small></div>';
            return;
        }

        notesHistory.innerHTML = history.map(item => {
            const isMe = currentUser && item.user === currentUser.email;
            return `
                <div class="note-item ${isMe ? 'outgoing' : 'incoming'}">
                    <div class="note-header">
                        <span>${item.user || 'Unknown'}</span>
                        <span class="note-time">${new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="note-content">${item.text}</div>
                </div>
            `;
        }).join('');
        notesHistory.scrollTop = notesHistory.scrollHeight;
    }

    function openPayoutModal(payout) {
        // Reset all inputs to editable first (prevents lock-in from previous views)
        payoutForm.querySelectorAll('input, textarea').forEach(el => el.readOnly = false);
        // Ensure static display fields remain readonly
        document.getElementById('seller-display').readOnly = true;
        amountInput.readOnly = true;

        document.getElementById('payout-id').value = payout.id;
        document.getElementById('seller-display').value = payout.sellers?.store_name || 'Unknown Seller';
        document.getElementById('seller-id').value = payout.seller_id;
        amountInput.value = payout.amount;
        document.getElementById('transaction-id').value = payout.transaction_id || '';
        document.getElementById('payout-additions').value = payout.additions || 0;
        document.getElementById('payout-reductions').value = payout.reductions || 0;
        document.getElementById('adjustment-reason').value = payout.adjustment_reason || '';

        // Reset Notes & Cancellation
        newNoteText.value = '';
        cancellationReasonInput.value = '';
        toggleCancellationView(false);

        // Parse notes history (it might be null or stringified JSON or plain text)
        let history = [];
        try {
            if (payout.notes) {
                history = JSON.parse(payout.notes);
                if (!Array.isArray(history)) history = [{ text: payout.notes, user: 'System', timestamp: payout.created_at }];
            }
        } catch (e) {
            // Fallback for legacy plain text notes
            history = [{ text: payout.notes, user: 'System', timestamp: payout.created_at }];
        }
        renderNotes(history);

        currentStatusBadge.textContent = getStatusLabel(payout.status);
        currentStatusBadge.className = `badge ${getStatusBadgeClass(payout.status)}`;

        // Reset visibility
        stepProcessing.classList.add('d-none');
        stepAdjustments.classList.add('d-none');
        stepPayment.classList.add('d-none');
        btnSavePayout.classList.add('d-none');
        btnCancelPayout.parentElement.classList.add('d-none');
        btnMoveBack.classList.add('d-none');

        // Logic based on status
        if (payout.status === 'requested') {
            stepProcessing.classList.remove('d-none');
            btnSavePayout.classList.remove('d-none');
            btnSavePayout.textContent = 'Move to Processing';
            btnCancelPayout.parentElement.classList.remove('d-none');
        } else if (payout.status === 'processing') {
            stepAdjustments.classList.remove('d-none');
            btnSavePayout.classList.remove('d-none');
            btnSavePayout.textContent = 'Submit for Approval';
            btnCancelPayout.parentElement.classList.remove('d-none');
            btnMoveBack.classList.remove('d-none');
            btnMoveBack.textContent = 'Back to Requested';
        } else if (payout.status === 'approval_pending') {
            stepAdjustments.classList.remove('d-none');
            stepPayment.classList.remove('d-none');
            btnSavePayout.classList.remove('d-none');
            btnSavePayout.textContent = 'Approve & Pay';
            btnCancelPayout.parentElement.classList.remove('d-none');
            btnMoveBack.classList.remove('d-none');
            btnMoveBack.textContent = 'Back to Processing';
        } else {
            // Paid or Cancelled
            stepAdjustments.classList.remove('d-none');
            if (payout.status === 'paid') {
                stepPayment.classList.remove('d-none');
                btnMoveBack.classList.remove('d-none');
                btnMoveBack.textContent = 'Revoke to Pending';
            }
            if (payout.status === 'cancelled') {
                btnMoveBack.classList.remove('d-none');
                btnMoveBack.textContent = 'Restore to Requested';
            }
            // Disable all inputs except for the move back button if applicable
            payoutForm.querySelectorAll('input, textarea').forEach(el => el.readOnly = true);
        }

        calculateTotal();
        payoutModal.show();
    }

    function toggleCancellationView(show) {
        if (show) {
            cancellationReasonContainer.classList.remove('d-none');
            defaultFooterBtns.classList.add('d-none');
            cancellationFooterBtns.classList.remove('d-none');
            btnSavePayout.classList.add('d-none');
        } else {
            cancellationReasonContainer.classList.add('d-none');
            defaultFooterBtns.classList.remove('d-none');
            cancellationFooterBtns.classList.add('d-none');
            if (currentPayout && !['paid', 'cancelled'].includes(currentPayout.status)) {
                btnSavePayout.classList.remove('d-none');
            }
        }
    }

    btnCancelPayout.addEventListener('click', () => toggleCancellationView(true));
    btnBackFromCancel.addEventListener('click', () => toggleCancellationView(false));

    btnMoveBack.addEventListener('click', async () => {
        if (!currentPayout) return;

        let prevStatus = 'requested';
        let statusLabel = 'Requested';

        if (currentPayout.status === 'processing') {
            prevStatus = 'requested';
            statusLabel = 'Requested';
        } else if (currentPayout.status === 'approval_pending') {
            prevStatus = 'processing';
            statusLabel = 'Processing';
        } else if (currentPayout.status === 'paid') {
            prevStatus = 'approval_pending';
            statusLabel = 'Approval Pending';
        } else if (currentPayout.status === 'cancelled') {
            prevStatus = 'requested';
            statusLabel = 'Requested';
        }

        if (!confirm(`Are you sure you want to move this payout back to ${statusLabel}?`)) return;

        btnMoveBack.disabled = true;
        btnMoveBack.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Moving...';

        // Prepare notes update
        let history = [];
        try { history = JSON.parse(currentPayout.notes || '[]'); } catch (e) { history = [{ text: currentPayout.notes, user: 'System', timestamp: currentPayout.created_at }]; }
        if (!Array.isArray(history)) history = [];

        history.push({
            text: `STATUS REVERTED: Moved back to ${statusLabel}`,
            user: currentUser?.email || 'Admin',
            timestamp: new Date().toISOString()
        });

        const { error } = await client.from('seller_payouts').update({
            status: prevStatus,
            notes: JSON.stringify(history),
            updated_at: new Date().toISOString()
        }).eq('id', currentPayout.id);

        if (error) {
            alert('Error moving back: ' + error.message);
            btnMoveBack.disabled = false;
            btnMoveBack.textContent = 'Move Back';
        } else {
            payoutModal.hide();
            await loadPayouts();
        }
    });

    btnConfirmCancel.addEventListener('click', async () => {
        const reason = cancellationReasonInput.value.trim();
        if (!reason) {
            alert('Please provide a reason for cancellation.');
            return;
        }

        if (!confirm('Are you sure you want to CANCEL this payout request?')) return;

        btnConfirmCancel.disabled = true;
        btnConfirmCancel.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Cancelling...';

        // Prepare notes update
        let history = [];
        try { history = JSON.parse(currentPayout.notes || '[]'); } catch (e) { history = [currentPayout.notes]; }
        if (!Array.isArray(history)) history = [];

        history.push({
            text: `CANCELLED: ${reason}`,
            user: currentUser?.email || 'Admin',
            timestamp: new Date().toISOString()
        });

        const { error } = await client.from('seller_payouts').update({
            status: 'cancelled',
            notes: JSON.stringify(history),
            updated_at: new Date().toISOString()
        }).eq('id', currentPayout.id);

        if (error) {
            alert('Error cancelling: ' + error.message);
            btnConfirmCancel.disabled = false;
            btnConfirmCancel.textContent = 'Confirm Cancellation';
        } else {
            payoutModal.hide();
            await loadPayouts();
        }
    });

    payoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentPayout) return;

        let nextStatus = currentPayout.status;
        if (currentPayout.status === 'requested') nextStatus = 'processing';
        else if (currentPayout.status === 'processing') nextStatus = 'approval_pending';
        else if (currentPayout.status === 'approval_pending') nextStatus = 'paid';

        const totalPayable = calculateTotal();

        // Handle Notes History
        let history = [];
        try { history = JSON.parse(currentPayout.notes || '[]'); } catch (e) { if (currentPayout.notes) history = [{ text: currentPayout.notes, user: 'System', timestamp: currentPayout.created_at }]; }
        if (!Array.isArray(history)) history = [];

        if (newNoteText.value.trim()) {
            history.push({
                text: newNoteText.value.trim(),
                user: currentUser?.email || 'Admin',
                timestamp: new Date().toISOString()
            });
        }

        const payoutData = {
            status: nextStatus,
            additions: parseFloat(additionsInput.value) || 0,
            reductions: parseFloat(reductionsInput.value) || 0,
            adjustment_reason: document.getElementById('adjustment-reason').value,
            total_payable: totalPayable,
            transaction_id: document.getElementById('transaction-id').value,
            notes: JSON.stringify(history),
            updated_at: new Date().toISOString()
        };

        if (nextStatus === 'paid' && !payoutData.transaction_id) {
            alert('Please enter a Transaction ID to approve payment.');
            return;
        }

        btnSavePayout.disabled = true;
        btnSavePayout.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Updating...';

        const { error } = await client.from('seller_payouts').update(payoutData).eq('id', currentPayout.id);

        if (error) {
            alert('Error updating: ' + error.message);
            btnSavePayout.disabled = false;
            btnSavePayout.textContent = 'Submit';
        } else {
            payoutModal.hide();
            await loadPayouts();
        }
    });

    document.getElementById('search-seller').addEventListener('input', filterData);

    function filterData() {
        const searchTerm = document.getElementById('search-seller').value.toLowerCase();
        const activeCard = document.querySelector('.status-card.active');
        const statusFilter = activeCard ? activeCard.getAttribute('data-status') : 'all';

        const filtered = allPayouts.filter(p => {
            const matchesSearch = (p.sellers?.store_name || '').toLowerCase().includes(searchTerm) ||
                p.id.toLowerCase().includes(searchTerm);
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

        renderPayouts(filtered);
    }

    async function init() {
        const { data: { user } } = await client.auth.getUser();
        currentUser = user;
        await loadPayouts();
        subscribeToPayouts();
    }

    function subscribeToPayouts() {
        client
            .channel('public:seller_payouts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'seller_payouts' }, (payload) => {
                console.log('Real-time change detected:', payload);
                loadPayouts();
            })
            .subscribe();
    }

    init();
});

