document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const pendingSellerList = document.getElementById('pending-seller-list');
    const detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
    const detailsContent = document.getElementById('seller-details-content');
    const btnApproveModal = document.getElementById('btn-approve-modal');
    const btnRejectModal = document.getElementById('btn-reject-modal');

    let currentSeller = null;

    // Fetch and display pending sellers
    async function loadPendingSellers() {
        pendingSellerList.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span class="ms-2">Loading pending requests...</span>
                </td>
            </tr>
        `;

        const { data, error } = await client
            .from('sellers')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching pending sellers:', error);
            pendingSellerList.innerHTML = `<tr><td colspan="5" class="empty-state text-danger">Error loading pending sellers.</td></tr>`;
            return;
        }

        renderPendingSellers(data);
    }

    function renderPendingSellers(sellers) {
        if (sellers.length === 0) {
            pendingSellerList.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i data-lucide="check-circle" style="color: #10b981; width: 48px; height: 48px; margin-bottom: 1rem;"></i>
                        <p>No pending approvals at the moment.</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        pendingSellerList.innerHTML = sellers.map(seller => `
            <tr>
                <td>
                    <div class="category-name">${seller.store_name}</div>
                    <div class="text-muted small">ID: #${seller.id.substring(0, 8)}</div>
                </td>
                <td>
                    <div class="fw-medium">${seller.email}</div>
                    <div class="text-muted small">${seller.business_type || 'Type not specified'}</div>
                </td>
                <td>
                    <div class="text-muted small">${new Date(seller.created_at).toLocaleDateString()}</div>
                </td>
                <td>
                    <div class="text-muted small">${seller.phone || 'N/A'}</div>
                    <div class="text-muted small">${seller.city || ''}${seller.city ? ', ' : ''}${seller.state || ''}</div>
                </td>
                <td>
                    <div class="action-btns justify-content-end">
                        <button class="btn-icon profile-btn view-details-btn" data-id="${seller.id}" title="Review Details">
                            <i data-lucide="eye"></i>
                        </button>
                        <button class="btn-icon text-success approve-btn" data-id="${seller.id}" title="Quick Approve">
                            <i data-lucide="check"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        lucide.createIcons();
        attachEventListeners(sellers);
    }

    function attachEventListeners(sellers) {
        // View Details buttons
        document.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const seller = sellers.find(s => s.id === id);
                if (seller) {
                    showSellerDetails(seller);
                }
            });
        });

        // Quick Approve buttons
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const seller = sellers.find(s => s.id === id);
                if (confirm(`Quick approve ${seller.store_name}?`)) {
                    await updateSellerStatus(id, 'active', seller.email, seller.store_name);
                }
            });
        });
    }

    function showSellerDetails(seller) {
        currentSeller = seller;
        detailsContent.innerHTML = `
            <div class="seller-details-grid">
                <div class="detail-section mb-4">
                    <h6 class="border-bottom pb-2 mb-3 text-primary">Store & Contact</h6>
                    <div class="row">
                        <div class="col-6 mb-2"><strong>Store Name:</strong><br>${seller.store_name}</div>
                        <div class="col-6 mb-2"><strong>Email:</strong><br>${seller.email}</div>
                        <div class="col-6 mb-2"><strong>Phone:</strong><br>${seller.phone || 'N/A'}</div>
                        <div class="col-6 mb-2"><strong>Applied:</strong><br>${new Date(seller.created_at).toLocaleString()}</div>
                    </div>
                </div>
                
                <div class="detail-section mb-4">
                    <h6 class="border-bottom pb-2 mb-3 text-primary">Business Registration</h6>
                    <div class="row">
                        <div class="col-12 mb-2"><strong>Legal Name:</strong><br>${seller.legal_name || 'N/A'}</div>
                        <div class="col-6 mb-2"><strong>Type:</strong><br>${seller.business_type || 'N/A'}</div>
                        <div class="col-6 mb-2"><strong>GSTIN:</strong><br>${seller.gstin || 'N/A'}</div>
                        <div class="col-6 mb-2"><strong>PAN:</strong><br>${seller.pan || 'N/A'}</div>
                        <div class="col-6 mb-2"><strong>MSME:</strong><br>${seller.msme_number || 'N/A'}</div>
                    </div>
                </div>

                <div class="detail-section mb-4">
                    <h6 class="border-bottom pb-2 mb-3 text-primary">Address</h6>
                    <div class="row">
                        <div class="col-12 mb-2"><strong>Address:</strong><br>${seller.address_line1 || ''}<br>${seller.address_line2 || ''}</div>
                        <div class="col-4 mb-2"><strong>City:</strong><br>${seller.city || 'N/A'}</div>
                        <div class="col-4 mb-2"><strong>State:</strong><br>${seller.state || 'N/A'}</div>
                        <div class="col-4 mb-2"><strong>Pincode:</strong><br>${seller.pincode || 'N/A'}</div>
                    </div>
                </div>

                <div class="detail-section">
                    <h6 class="border-bottom pb-2 mb-3 text-primary">Bank Details</h6>
                    <div class="row">
                        <div class="col-6 mb-2"><strong>A/C Holder:</strong><br>${seller.bank_account_name || 'N/A'}</div>
                        <div class="col-6 mb-2"><strong>Bank:</strong><br>${seller.bank_name || 'N/A'}</div>
                        <div class="col-6 mb-2"><strong>A/C Number:</strong><br>${seller.bank_account_number || 'N/A'}</div>
                        <div class="col-6 mb-2"><strong>IFSC:</strong><br>${seller.bank_ifsc || 'N/A'}</div>
                    </div>
                </div>
            </div>
        `;
        detailsModal.show();
    }

    async function updateSellerStatus(id, status, email, store_name) {
        let finalStatus = status;
        if (status === 'active') {
            finalStatus = 'active';
        }

        const { error } = await client
            .from('sellers')
            .update({ status: finalStatus })
            .eq('id', id);

        if (error) {
            alert('Error updating status: ' + error.message);
            return;
        }

        if (finalStatus === 'active') {
            if (confirm(`${store_name} has been approved! Would you like to send a welcome email via Google Script now?`)) {
                await sendWelcomeEmail({ id, email, store_name });
            } else {
                alert(`${store_name} has been approved successfully.`);
            }
        } else if (status === 'suspended') {
            alert(`${store_name} has been rejected/suspended.`);
        }

        detailsModal.hide();
        loadPendingSellers();
    }

    btnApproveModal.addEventListener('click', () => {
        if (currentSeller) {
            updateSellerStatus(currentSeller.id, 'active', currentSeller.email, currentSeller.store_name);
        }
    });

    btnRejectModal.addEventListener('click', () => {
        if (currentSeller && confirm('Are you sure you want to reject this application?')) {
            updateSellerStatus(currentSeller.id, 'suspended', currentSeller.email, currentSeller.store_name);
        }
    });

    async function sendWelcomeEmail(seller) {
        const settings = JSON.parse(localStorage.getItem('glamer_smtp_settings') || '{}');
        const scriptUrl = settings.scriptUrl;

        if (!scriptUrl) {
            alert('SMTP Settings Missing: Please configure the Google Script URL in the SMTP Settings page first.');
            return;
        }

        try {
            const { data: { session } } = await client.auth.getSession();
            const currentUserEmail = session?.user?.email;

            const payload = {
                to: seller.email,
                subject: `Welcome to House of Pachu - ${seller.store_name}`,
                name: settings.senderName || 'House of Pachu',
                from_email: currentUserEmail,
                htmlBody: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <img src="https://houseofpachu.in/assets/img/logo2.png" alt="House of Pachu" style="width: 100px; margin-bottom: 20px;">
                        <h2 style="color: #4f46e5;">Welcome to Our Marketplace!</h2>
                        <p>Hi <strong>${seller.store_name}</strong>,</p>
                        <p>We are thrilled to inform you that your seller account at <strong>House of Pachu</strong> has been approved and is now active!</p>
                        <p>You can now start listing your products and reaching thousands of customers across our platform.</p>
                        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <h4 style="margin-top: 0;">What's Next?</h4>
                            <ul style="padding-left: 20px;">
                                <li>Log in to your dashboard to complete your shop profile.</li>
                                <li>Upload high-quality product images.</li>
                                <li>Set up your payout preferences.</li>
                            </ul>
                        </div>
                        <p>If you have any questions, feel free to reply to this email or contact our support team.</p>
                        <p>Best regards,<br><strong>Team House of Pachu</strong></p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #64748b; text-align: center;">This is an automated welcome email from House of Pachu Seller Central.</p>
                    </div>
                `
            };

            await fetch(scriptUrl, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: JSON.stringify(payload)
            });

            alert(`Welcome email has been sent to ${seller.email} successfully.`);
        } catch (err) {
            console.error('Error sending welcome mail:', err);
            alert('Seller approved, but failed to initiate welcome email: ' + err.message);
        }
    }

    loadPendingSellers();
});
