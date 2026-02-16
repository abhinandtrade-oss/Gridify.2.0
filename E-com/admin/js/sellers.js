document.addEventListener('DOMContentLoaded', () => {
    const client = window.supabase;
    const sellerList = document.getElementById('seller-list');
    const sellerForm = document.getElementById('seller-form');
    const sellerModal = new bootstrap.Modal(document.getElementById('sellerModal'));
    const modalTitle = document.getElementById('sellerModalTitle');

    // Form Inputs
    const sellerIdInput = document.getElementById('seller-id');
    const storeNameInput = document.getElementById('store-name');
    const emailInput = document.getElementById('seller-email');
    const phoneInput = document.getElementById('seller-phone');
    const statusInput = document.getElementById('seller-status');

    let allSellers = [];

    // Fetch and display sellers
    async function loadSellers() {
        sellerList.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span class="ms-2">Loading sellers...</span>
                </td>
            </tr>
        `;

        const { data, error } = await client
            .from('sellers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching sellers:', error);
            sellerList.innerHTML = `<tr><td colspan="5" class="empty-state text-danger">Error loading sellers. Please check database.</td></tr>`;
            return;
        }

        allSellers = data;
        renderSellers(data);

        // Background sync for pending verifications
        syncAllPendingVerifications(data);
    }

    async function syncAllPendingVerifications(sellers) {
        const pendingSellers = sellers.filter(s => s.status === 'email verification pending');
        if (pendingSellers.length === 0) return;

        let updatedAny = false;
        for (const seller of pendingSellers) {
            const wasUpdated = await checkAndApproveSeller(seller);
            if (wasUpdated) updatedAny = true;
        }

        if (updatedAny) {
            loadSellers(); // Refresh list if anything changed
        }
    }

    async function checkAndApproveSeller(seller) {
        try {
            // 1. Check if a profile/user exists with this email
            // We use 'profiles' table which is public or admin-accessible and contains email
            const { data: profile, error: profileError } = await client
                .from('profiles')
                .select('id, email')
                .eq('email', seller.email)
                .maybeSingle();

            if (profileError) return false;

            if (profile) {
                // User has verified and logged in at least once (profile created)
                console.log(`User ${seller.email} found. Checking role...`);

                // 2. Ensure they have the 'seller' role
                const { data: roleData, error: roleError } = await client
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', profile.id)
                    .maybeSingle();

                if (roleError) return false;

                if (!roleData || roleData.role !== 'seller') {
                    // Assign 'seller' role
                    const { error: assignError } = await client
                        .from('user_roles')
                        .upsert({
                            user_id: profile.id,
                            role: 'seller'
                        });

                    if (assignError) {
                        console.warn(`Could not assign seller role to ${profile.id}:`, assignError);
                        // Even if role assignment fails (RLS), we might still want to proceed if the role is handled by trigger
                    }
                }

                // 3. Update seller status to 'active' (Approved)
                const { error: updateError } = await client
                    .from('sellers')
                    .update({ status: 'active' })
                    .eq('id', seller.id);

                if (!updateError) {
                    console.log(`Seller ${seller.store_name} successfully transitioned to Approved.`);
                    return true;
                }
            }
        } catch (err) {
            console.error('Error in checkAndApproveSeller:', err);
        }
        return false;
    }

    function renderSellers(sellers) {
        if (sellers.length === 0) {
            sellerList.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        <i data-lucide="store"></i>
                        <p>No sellers registered yet.</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        sellerList.innerHTML = sellers.map(seller => `
            <tr>
                <td>
                    <div class="category-name">${seller.store_name}</div>
                    <div class="text-muted small">ID: #${seller.id.substring(0, 8)}</div>
                </td>
                <td>
                    <div class="fw-medium">${seller.email}</div>
                    <div class="text-muted small">${seller.phone || 'No phone provided'}</div>
                </td>
                <td>
                    <div class="text-muted small">${new Date(seller.created_at).toLocaleDateString()}</div>
                </td>
                <td>
                    <span class="badge ${getStatusBadgeClass(seller.status)}">
                        ${seller.status === 'active' ? 'Approved' : (seller.status === 'email verification pending' ? 'Email Verification Pending' : seller.status.charAt(0).toUpperCase() + seller.status.slice(1))}
                    </span>
                </td>
                <td>
                    <div class="action-btns justify-content-end">
                        <a href="seller-payouts.html?sellerId=${seller.id}" class="btn-icon payout-btn" title="Create Payout">
                            <i data-lucide="banknote"></i>
                        </a>
                        <a href="seller-profile.html?id=${seller.id}" class="btn-icon profile-btn" title="Manage Profile">
                            <i data-lucide="user-cog"></i>
                        </a>
                        <button class="btn-icon welcome-mail-btn" data-id="${seller.id}" title="Send Welcome Mail">
                            <i data-lucide="mail"></i>
                        </button>
                        <button class="btn-icon edit-btn" data-id="${seller.id}" title="Edit Basic Info">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="btn-icon delete delete-btn" data-id="${seller.id}" title="Delete">
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
            case 'active': return 'badge-success';
            case 'email verification pending': return 'badge-warning text-dark';
            case 'pending': return 'badge-info text-white';
            case 'suspended': return 'badge-danger';
            default: return 'badge-secondary';
        }
    }

    function attachEventListeners() {
        // Edit buttons
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const seller = allSellers.find(s => s.id === id);
                if (seller) {
                    modalTitle.textContent = 'Edit Seller Basic Info';
                    sellerIdInput.value = seller.id;
                    storeNameInput.value = seller.store_name;
                    emailInput.value = seller.email;
                    phoneInput.value = seller.phone || '';
                    statusInput.value = seller.status;
                    sellerModal.show();
                }
            });
        });

        // Welcome Mail buttons
        document.querySelectorAll('.welcome-mail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const seller = allSellers.find(s => s.id === id);
                if (seller) {
                    sendWelcomeEmail(seller);
                }
            });
        });

        // Delete buttons
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                showConfirm('Are you sure you want to remove this seller? This action cannot be undone.', async () => {
                    const { error } = await client
                        .from('sellers')
                        .delete()
                        .eq('id', id);

                    if (error) {
                        showAlert('Error deleting seller: ' + error.message, 'error');
                    } else {
                        showAlert('Seller deleted successfully', 'success');
                        loadSellers();
                    }
                });
            });
        });
    }

    // Form Submission
    sellerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = sellerIdInput.value;
        const email = emailInput.value;
        const status = statusInput.value;

        const sellerData = {
            store_name: storeNameInput.value,
            email: email.toLowerCase().trim(),
            phone: phoneInput.value,
            status: status
        };

        // Requirement: Seller email MUST be an existing user
        let { data: existingUser, error: checkError } = await client
            .from('profiles')
            .select('id')
            .eq('email', sellerData.email)
            .maybeSingle();

        if (!existingUser && !checkError) {
            // Check customers table as fallback
            const { data: customer } = await client
                .from('customers')
                .select('id')
                .eq('email', sellerData.email)
                .maybeSingle();
            if (customer) existingUser = customer;
        }

        if (checkError) {
            showAlert('Error checking user existence: ' + checkError.message, 'error');
            return;
        }

        if (!existingUser && !id) {
            showAlert(`Error: No registered user found with email "${sellerData.email}". \n\nThe contact email of the seller MUST be an existing user. Please ensure the user has signed up as a customer/user before adding them as a seller.`, 'error');
            return;
        }

        // No longer forcing email invitation step
        if (status === 'active') {
            sellerData.status = 'active';
        }

        let result;
        if (id) {
            result = await client.from('sellers').update(sellerData).eq('id', id);
        } else {
            // result = await client.from('sellers').insert([sellerData]);
            // Use select() to get the inserted record (for redirection)
            result = await client.from('sellers').insert([sellerData]).select();
        }

        if (result.error) {
            showAlert('Error saving seller: ' + result.error.message, 'error');
        } else {
            const savedSeller = (result.data && result.data.length > 0) ? result.data[0] : null;

            if (!id) {
                showAlert('Seller account created successfully with Active status.', 'success');
            } else if (status === 'active') {
                showAlert('Seller approved and set to Active.', 'success');
            } else {
                showAlert('Seller details updated successfully.', 'success');
            }

            sellerModal.hide();
            sellerForm.reset();

            // If it was a new seller, ask to complete profile
            if (!id && savedSeller) {
                showConfirm('Seller created. Would you like to update the complete company details (GST, Bank, etc.) now?', () => {
                    window.location.href = `seller-profile.html?id=${savedSeller.id}`;
                });
            }

            loadSellers();
        }
    });

    // Reset modal on close
    document.getElementById('sellerModal').addEventListener('hidden.bs.modal', () => {
        sellerForm.reset();
        sellerIdInput.value = '';
        modalTitle.textContent = 'Add New Seller Account';
    });

    async function sendWelcomeEmail(seller) {
        const settings = JSON.parse(localStorage.getItem('glamer_smtp_settings') || '{}');
        const scriptUrl = settings.scriptUrl;

        if (!scriptUrl) {
            showAlert('SMTP Settings Missing: Please configure the Google Script URL in the SMTP Settings page first.', 'warning');
            return;
        }

        showConfirm(`Are you sure you want to send a welcome email to ${seller.store_name} (${seller.email})?`, async () => {
            const btn = document.querySelector(`.welcome-mail-btn[data-id="${seller.id}"]`);
            const originalContent = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
            btn.disabled = true;

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

                // Using no-cors with explicit text/plain header
                await fetch(scriptUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    cache: 'no-cache',
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    body: JSON.stringify(payload)
                });

                showAlert(`Welcome email request has been sent to ${seller.email} via Google Script.`, 'success');
                btn.innerHTML = '<i data-lucide="check" class="text-success"></i>';
                setTimeout(() => {
                    btn.innerHTML = originalContent;
                    btn.disabled = false;
                    lucide.createIcons();
                }, 3000);

            } catch (err) {
                console.error('Error sending welcome mail:', err);
                showAlert('Failed to initiate email: ' + err.message, 'error');
                btn.innerHTML = originalContent;
                btn.disabled = false;
                lucide.createIcons();
            }
        });
    }

    loadSellers();
});
