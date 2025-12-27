
import { db } from '../assets/js/firebase-config.js';
import {
    collection, getDocs, doc, setDoc, deleteDoc, updateDoc,
    query, where, getDoc, addDoc, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { AdminManager } from '../assets/js/admin-manager.js';

const SUB_COLLECTION = 'subscribers';
const PROD_COLLECTION = 'subscription_products';
const SETTINGS_COLLECTION = 'admin_settings';
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRAffAw-c1Ya_drBWP2EMFHhPxHDeDygUXObRels0BX-rAyEmHqEC_D2-9MSUAl1kbMw/exec";

class SubManager {
    constructor() {
        this.subscribers = [];
        this.products = [];
        this.todayExpiring = [];
        this.currentFilter = 'all';
        this.init();
    }

    async init() {
        const session = AdminManager.getSession();
        if (!session || session.role !== 'admin') {
            window.location.href = '../login/index.html';
            return;
        }

        setTimeout(() => $('#authOverlay').fadeOut(), 500);

        this.bindEvents();
        await this.loadProducts();
        await this.loadSubscribers();
        this.loadAutomationStatus();
    }

    bindEvents() {
        $('#subForm').on('submit', (e) => { e.preventDefault(); this.handleSave(); });
        $('#productMgtForm').on('submit', (e) => { e.preventDefault(); this.handleProductSave(); });
        $('#searchInput').on('input', () => this.renderTable());
        $('#btnSendAlerts').on('click', () => this.handleExpiryAlerts());
        $('#exportBtn').on('click', () => this.exportToExcel());
        $('#logoutBtn').on('click', () => AdminManager.logout());
        $('#subModal').on('show.bs.modal', () => this.populateProductDropdown());
        $('#subType, #subActivatedDate').on('change', () => this.updateExpiryDate());
        $('#btnConfirmWASend').on('click', () => {
            const phone = $('#waPhone').text().replace(/\D/g, '');
            const text = $('#waMessage').val();
            bootstrap.Modal.getInstance(document.getElementById('waModal')).hide();
            openWhatsAppPopup(phone, text);
        });

        // Filter Cards
        $('#filter-all').on('click', () => this.setFilter('all'));
        $('#filter-active').on('click', () => this.setFilter('active'));
        $('#filter-inactive').on('click', () => this.setFilter('inactive'));
        $('#filter-expiring').on('click', () => this.setFilter('expiring'));
        $('#filter-expired').on('click', () => this.setFilter('expired'));
    }

    setFilter(filter) {
        this.currentFilter = filter;
        $('.stat-card').removeClass('active-filter');
        $(`#filter-${filter}`).addClass('active-filter');

        const titles = {
            'all': 'All Subscribers',
            'active': 'Active Subscriptions',
            'inactive': 'Inactive Subscriptions',
            'expiring': 'Expiring Soon',
            'expired': 'Expired Subscriptions'
        };
        $('#table-title').text(titles[filter] || 'Subscriber List');

        this.renderTable();
    }

    updateExpiryDate() {
        const type = $('#subType').val();
        const activatedDate = $('#subActivatedDate').val();

        if (!activatedDate) return;

        let date = new Date(activatedDate);
        if (isNaN(date.getTime())) return;

        switch (type) {
            case 'Days':
                date.setDate(date.getDate() + 1);
                break;
            case 'Weekly':
                date.setDate(date.getDate() + 7);
                break;
            case 'Monthly':
                date.setDate(date.getDate() + 30);
                break;
            case 'Quarterly':
                date.setDate(date.getDate() + 90);
                break;
            case 'Yearly':
                date.setDate(date.getDate() + 365);
                break;
            case 'Lifetime':
                date.setFullYear(date.getFullYear() + 100); // 100 years
                break;
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        $('#subExpiryDate').val(`${year}-${month}-${day}`);
    }

    // --- Product Management ---

    async loadProducts() {
        try {
            const q = query(collection(db, PROD_COLLECTION), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            this.products = [];
            querySnapshot.forEach((doc) => this.products.push({ id: doc.id, ...doc.data() }));
            this.renderProductTable();
        } catch (e) {
            console.error("Load Products Error:", e);
        }
    }

    renderProductTable() {
        const tbody = $('#productTableBody');
        tbody.empty();
        this.products.forEach(p => {
            tbody.append(`
                <tr>
                    <td><div class="fw-700">${p.name}</div></td>
                    <td><div class="small text-slate">${new Date(p.createdAt).toLocaleDateString()}</div></td>
                    <td>
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" 
                                ${p.status === 'active' ? 'checked' : ''} 
                                onchange="window.toggleProductStatus('${p.id}', this.checked)">
                            <label class="small fw-600 ${p.status === 'active' ? 'text-success' : 'text-danger'}">
                                ${p.status === 'active' ? 'Active' : 'Inactive'}
                            </label>
                        </div>
                    </td>
                    <td class="text-end">
                        <button class="action-btn" onclick="window.editProduct('${p.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="window.deleteProduct('${p.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `);
        });
    }

    async handleProductSave() {
        const id = $('#manageProductId').val();
        const data = {
            name: $('#manageProductName').val(),
            updatedAt: new Date().toISOString()
        };

        const btn = $('#productMgtForm button[type="submit"]');
        const originalText = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Saving...');

        try {
            if (id && id.trim() !== '') {
                // Update existing product - do NOT overwrite status
                await updateDoc(doc(db, PROD_COLLECTION, id), data);
            } else {
                // Add new product - default to active
                data.status = 'active';
                data.createdAt = new Date().toISOString();
                await addDoc(collection(db, PROD_COLLECTION), data);
            }
            this.resetProductForm();
            await this.loadProducts();
            // Also refresh subscriber dropdown if it's open or about to be
            this.populateProductDropdown();
        } catch (e) {
            console.error("Product Save Error:", e);
            alert("Error saving product: " + e.message);
        } finally {
            btn.prop('disabled', false).html(originalText);
        }
    }

    async toggleStatus(id, newCheckedState) {
        const status = newCheckedState ? 'active' : 'inactive';
        try {
            await updateDoc(doc(db, PROD_COLLECTION, id), {
                status: status,
                updatedAt: new Date().toISOString()
            });
            await this.loadProducts();
            this.populateProductDropdown();
        } catch (e) {
            console.error("Toggle Status Error:", e);
            alert("Failed to update status: " + e.message);
        }
    }

    populateProductDropdown() {
        const select = $('#subProduct');
        const currentValue = select.val();
        select.empty().append('<option value="" disabled selected>Select a product</option>');
        this.products.filter(p => p.status === 'active').forEach(p => {
            select.append(`<option value="${p.name}">${p.name}</option>`);
        });
        if (currentValue) select.val(currentValue);
    }

    resetProductForm() {
        $('#manageProductId').val('');
        $('#productMgtForm')[0].reset();
        $('#productMgtForm button[type="submit"]').html('<i class="fas fa-save me-1"></i>Save');
        $('#productMgtForm').removeClass('editing-mode');
    }

    // --- Subscriber Management ---

    async loadSubscribers() {
        try {
            const q = query(collection(db, SUB_COLLECTION), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            this.subscribers = [];
            querySnapshot.forEach((doc) => this.subscribers.push({ id: doc.id, ...doc.data() }));
            this.updateStats();
            this.renderTable();
        } catch (e) { console.error("Load Subs Error:", e); }
    }

    updateStats() {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        $('#stat-total').text(this.subscribers.length);

        const activeCount = this.subscribers.filter(s => {
            const expiryDate = new Date(s.expiryDate);
            expiryDate.setHours(23, 59, 59, 999);
            return s.status === 'active' && expiryDate >= now;
        }).length;
        $('#stat-active').text(activeCount);

        const inactiveCount = this.subscribers.filter(s => s.status === 'inactive').length;
        $('#stat-inactive').text(inactiveCount);

        // Find subscribers expiring today
        this.todayExpiring = this.subscribers.filter(s => s.expiryDate === todayStr && s.status === 'active');

        if (this.todayExpiring.length > 0) {
            $('#expiryCount').text(this.todayExpiring.length);
            $('#expiryAlertBanner').removeClass('d-none');
        } else {
            $('#expiryAlertBanner').addClass('d-none');
        }

        const expiringCount = this.subscribers.filter(s => {
            const expiryDate = new Date(s.expiryDate);
            expiryDate.setHours(23, 59, 59, 999);
            const diff = expiryDate - now;
            return diff > 0 && diff < (7 * 24 * 60 * 60 * 1000);
        }).length;
        $('#stat-expiring').text(expiringCount);

        const expiredCount = this.subscribers.filter(s => {
            const expiryDate = new Date(s.expiryDate);
            expiryDate.setHours(23, 59, 59, 999);
            return expiryDate < now;
        }).length;
        $('#stat-expired').text(expiredCount);

        // Update total card as active by default if no filter
        if (this.currentFilter === 'all') $('#filter-all').addClass('active-filter');
    }

    renderTable() {
        const search = $('#searchInput').val().toLowerCase();
        const tbody = $('#subTableBody').empty();
        const now = new Date();

        let filtered = this.subscribers.filter(s =>
            s.name.toLowerCase().includes(search) ||
            s.product?.toLowerCase().includes(search) ||
            s.email.toLowerCase().includes(search)
        );

        // Apply Status Filter
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(s => {
                const expiryDate = new Date(s.expiryDate);
                expiryDate.setHours(23, 59, 59, 999);
                const isExpired = expiryDate < now;
                const diff = expiryDate - now;
                const isExpiringSoon = diff > 0 && diff < (7 * 24 * 60 * 60 * 1000);

                if (this.currentFilter === 'active') return s.status === 'active' && !isExpired;
                if (this.currentFilter === 'inactive') return s.status === 'inactive';
                if (this.currentFilter === 'expiring') return s.status === 'active' && isExpiringSoon;
                if (this.currentFilter === 'expired') return isExpired;
                return true;
            });
        }

        if (filtered.length === 0) $('#noResults').removeClass('d-none');
        else {
            $('#noResults').addClass('d-none');
            filtered.forEach(s => {
                const expiryDate = new Date(s.expiryDate);
                expiryDate.setHours(23, 59, 59, 999);
                const isExpired = expiryDate < now;
                const diff = expiryDate - now;
                const isExpiringSoon = diff > 0 && diff < (7 * 24 * 60 * 60 * 1000);
                const isToday = now.toISOString().split('T')[0] === s.expiryDate;

                let statusBadge = '';
                if (s.status === 'inactive') {
                    statusBadge = `<span class="badge-pill badge-inactive">Inactive</span>`;
                } else if (isExpired) {
                    statusBadge = `<span class="badge-pill bg-danger text-white">Expired</span>`;
                } else if (isToday) {
                    statusBadge = `<span class="badge-pill bg-warning text-dark">Expires Today</span>`;
                } else if (isExpiringSoon) {
                    statusBadge = `<span class="badge-pill bg-warning-soft text-warning">Expiring Soon</span>`;
                } else {
                    statusBadge = `<span class="badge-pill badge-active">Active</span>`;
                }

                tbody.append(`
                    <tr>
                        <td>
                            <div class="d-flex align-items-center">
                                <span class="status-dot ${s.status === 'active' ? 'status-dot-active' : 'status-dot-inactive'}"></span>
                                <div>
                                    <div class="sub-name">${s.name}</div>
                                    <div class="sub-email">${s.email}</div>
                                </div>
                            </div>
                        </td>
                        <td class="hide-mobile"><div class="fw-600 text-dark">${s.product || 'N/A'}</div></td>
                        <td class="hide-mobile"><a href="${s.website}" target="_blank" class="text-primary small">${s.website || 'N/A'}</a></td>
                        <td><div class="small fw-600">${s.mobile}</div><div class="small text-success fw-600 text-nowrap">₹ ${s.amount || '0'}</div></td>
                        <td class="hide-mobile"><div class="badge bg-light text-dark border mb-1">${s.type}</div><div class="small text-slate">${s.paymentMode}</div></td>
                        <td>
                            <div class="small"><b>Starts:</b> ${s.activatedDate}</div>
                            <div class="small ${isExpired ? 'text-danger fw-bold' : (isToday ? 'text-danger fw-bold' : (isExpiringSoon ? 'text-warning fw-bold' : 'text-slate'))}">
                                <b>Expires:</b> ${s.expiryDate}
                            </div>
                        </td>
                        <td>${statusBadge}</td>
                        <td class="text-end">
                            <button onclick="window.sendWhatsAppAlert('${s.id}')" class="action-btn text-success" title="WhatsApp Alert"><i class="fab fa-whatsapp"></i></button>
                            <button class="action-btn" onclick="window.editSub('${s.id}')" title="Edit"><i class="fas fa-edit"></i></button>
                            <button class="action-btn btn-delete" onclick="window.deleteSub('${s.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `);
            });
        }
    }

    async handleSave() {
        const id = $('#subId').val();
        const data = {
            name: $('#subName').val(), product: $('#subProduct').val(), email: $('#subEmail').val(),
            mobile: $('#subMobile').val(), website: $('#subWebsite').val(), type: $('#subType').val(),
            paymentMode: $('#subPaymentMode').val(), activatedDate: $('#subActivatedDate').val(),
            expiryDate: $('#subExpiryDate').val(),
            amount: $('#subAmount').val(),
            briefing: $('#subBriefing').val(),
            status: $('#subStatus').is(':checked') ? 'active' : 'inactive',
            updatedAt: new Date().toISOString()
        };
        if (!data.product) { alert("Please select a product"); return; }
        const btn = $('#subForm button[type="submit"]');
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Saving...');
        try {
            if (id && id.trim() !== '') await updateDoc(doc(db, SUB_COLLECTION, id), data);
            else { data.createdAt = new Date().toISOString(); await addDoc(collection(db, SUB_COLLECTION), data); }
            bootstrap.Modal.getInstance(document.getElementById('subModal')).hide();
            await this.loadSubscribers();
        } catch (e) { alert(e.message); } finally { btn.prop('disabled', false).html('<i class="fas fa-save me-2"></i>Save Subscriber'); }
    }

    async handleExpiryAlerts() {
        if (this.todayExpiring.length === 0) return;

        const btn = $('#btnSendAlerts');
        const originalHtml = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Sending Alerts...');

        let successCount = 0;

        for (const sub of this.todayExpiring) {
            try {
                // Alert to Subscriber
                // HTML Message for the email
                const subMessage = `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <p>Dear ${sub.name},</p>
                        <p>Your Gridify - <strong>${sub.product}</strong> subscription is set to expire today.</p>
                        <p><strong>Type of Subscription :</strong> ${sub.type}</p>
                        <p><strong>Plan :</strong> ${sub.briefing || 'N/A'}</p>
                        <p><strong>Amount :</strong> ₹ ${sub.amount || '0'}</p>
                        <p>Please complete the payment to continue the service without any interruption.</p>
                        <p>visit to check the status and repay : <a href="https://gridify.in/developments/url-shortener/?s=sub">https://gridify.in/developments/url-shortener/?s=sub</a></p>
                        <p>For further details or assistance, contact us at <a href="mailto:sales@gridify.in">sales@gridify.in</a>.</p>
                        <br>
                        <p>Regards, Team Gridify</p>
                        <p><i>Please do not reply to this email.</i></p>
                        <br>
                        <img src="https://ci3.googleusercontent.com/mail-sig/AIorK4ywg6tSP5RqQc6O7l55MEke1l3Bf38GklDFOob5Ogvc1rx0SJ6nCrQ8z6h5v8C5_T-vC8HicKpcH8ih" alt="Gridify Signature" style="max-width: 400px; display: block;">
                    </div>
                `;

                await this.sendEmail(sub.email, "Gridify Email Subscription Expiry Notice", subMessage);

                successCount++;
            } catch (e) {
                console.error(`Failed to alert ${sub.name}:`, e);
            }
        }

        btn.html(originalHtml).prop('disabled', false);
        alert(`Successfully sent alerts to ${successCount} subscribers.`);
    }

    async sendEmail(toEmail, subject, message) {
        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // Google Apps Script requires no-cors for direct browser requests
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: toEmail,
                    subject: subject,
                    message: message
                })
            });
            // no-cors mode doesn't allow reading the response, so we assume success if no reachability error occurs
            return { success: true };
        } catch (e) {
            console.error("Email Sending Error:", e);
            throw e;
        }
    }

    exportToExcel() {
        if (this.subscribers.length === 0) {
            alert("No data to export");
            return;
        }

        const data = this.subscribers.map(s => ({
            'Name': s.name,
            'Email': s.email,
            'Product': s.product || 'N/A',
            'Mobile': s.mobile,
            'Website': s.website || 'N/A',
            'Amount (₹)': s.amount || '0',
            'Type': s.type,
            'Payment Mode': s.paymentMode,
            'Activated Date': s.activatedDate,
            'Expiry Date': s.expiryDate,
            'Status': s.status,
            'Briefing': s.briefing || '',
            'Created At': s.createdAt ? new Date(s.createdAt).toLocaleString() : 'N/A'
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Subscribers");

        // Generate and download the file
        const timestamp = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, `Subscribers_Export_${timestamp}.xlsx`);
    }

    async saveSettings(time) {
        try {
            await setDoc(doc(db, SETTINGS_COLLECTION, 'general'), {
                alertTime: time
            }, { merge: true });
            alert("Settings saved! Automations will run at " + time + " daily.");
            $('#settingsModal').modal('hide');
        } catch (e) {
            console.error("Save Settings Error:", e);
            alert("Failed to save settings.");
        }
    }

    async loadSettings() {
        try {
            const docSnap = await getDoc(doc(db, SETTINGS_COLLECTION, 'general'));
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.alertTime) {
                    $('#alertTimeInput').val(data.alertTime);
                }
            }
        } catch (e) {
            console.error("Load Settings Error:", e);
        }
    }

    async loadAutomationStatus() {
        try {
            const docSnap = await getDoc(doc(db, SETTINGS_COLLECTION, 'general'));
            let status = 'unknown';
            let alertTime = '09:00';
            let lastRun = null;
            let lastRunTime = null;

            if (docSnap.exists()) {
                const data = docSnap.data();
                alertTime = data.alertTime || '09:00';
                lastRun = data.lastRunDate || null;
                lastRunTime = data.lastRunTime || '';
            }

            // Update UI Fields
            $('#statusScheduled').text(alertTime);
            $('#statusLastRun').text((lastRun ? (lastRun + ' ' + lastRunTime) : 'Never').trim());

            // Logic to determine State
            const todayStr = new Date().toISOString().split('T')[0];
            const now = new Date();
            const [h, m] = alertTime.split(':').map(Number);
            const alertDate = new Date();
            alertDate.setHours(h, m, 0, 0);

            if (lastRun === todayStr) {
                // Automation Ran Successfully Today
                this.updateStatusUI('active', 'System Active', 'Daily automation completed successfully.');
            } else {
                // Has not run yet today
                if (now < alertDate) {
                    // Waiting for time
                    const diffMs = alertDate - now;
                    const diffHrs = Math.floor((diffMs % 86400000) / 3600000);
                    const diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000);
                    this.updateStatusUI('waiting', 'System Sleeping', `Next run in ${diffHrs}h ${diffMins}m`);
                } else {
                    // It is PAST the time, but LastRun is not today
                    // Allow 1 hour buffer before showing error (maybe worker is running right now)
                    const oneHourPast = new Date(alertDate.getTime() + 60 * 60 * 1000);
                    if (now > oneHourPast) {
                        this.updateStatusUI('error', 'Status Unknown', 'Automation missed schedule or no data found.');
                    } else {
                        this.updateStatusUI('running', 'Processing...', 'System should be running now.');
                    }
                }
            }

            // Calculate "Next Check" roughly (worker runs every 30 mins)
            const minutes = now.getMinutes();
            const next30 = minutes >= 30 ? 60 : 30;
            const nextCheckDate = new Date(now.getTime() + (next30 - minutes) * 60000);
            $('#statusNextCheck').text(nextCheckDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        } catch (e) {
            console.error("Status Load Error", e);
            this.updateStatusUI('error', 'Connection Error', 'Could not fetch status.');
        }
    }

    updateStatusUI(state, title, msg) {
        const iconBox = $('#statusIconBg');
        const icon = $('#statusIcon');
        const text = $('#statusText');
        const pulse = $('#statusPulse');
        const bar = $('#statusProgressBar');

        // Reset classes
        iconBox.removeClass('bg-success bg-warning bg-danger bg-secondary');
        pulse.css('animation', 'none');

        $('#statusIconBg').parent().find('h6').text(title);
        text.text(msg);

        switch (state) {
            case 'active':
                iconBox.addClass('bg-success');
                icon.attr('class', 'fas fa-check-circle fa-lg');
                pulse.css({ 'animation': 'pulse-ring 2s infinite', 'box-shadow': '0 0 0 0 rgba(25, 135, 84, 0.7)' }); // Green pulse
                bar.addClass('bg-success').css('width', '100%');
                break;
            case 'waiting':
                iconBox.addClass('bg-warning'); // Yellow/Orange
                icon.attr('class', 'fas fa-hourglass-half fa-lg');
                pulse.css('animation', 'none'); // No pulse when sleeping
                bar.addClass('bg-warning').css('width', '50%');
                break;
            case 'running':
                iconBox.addClass('bg-info');
                icon.attr('class', 'fas fa-sync fa-spin fa-lg');
                pulse.css('animation', 'pulse-ring 1s infinite'); // Fast pulse
                bar.addClass('bg-info').css('width', '75%');
                break;
            case 'error':
                iconBox.addClass('bg-danger');
                icon.attr('class', 'fas fa-exclamation-triangle fa-lg');
                pulse.css({ 'animation': 'pulse-ring 2s infinite', 'box-shadow': '0 0 0 0 rgba(220, 53, 69, 0.7)' }); // Red pulse
                bar.addClass('bg-danger').css('width', '100%');
                break;
        }
    }

    async fetchLogs() {
        const area = $('#automationLogsArea');
        area.val('Loading logs from Firestore...');
        try {
            const docSnap = await getDoc(doc(db, SETTINGS_COLLECTION, 'logs'));
            if (docSnap.exists() && docSnap.data().latestLog) {
                const logs = docSnap.data().latestLog;
                const updated = docSnap.data().updatedAt ? new Date(docSnap.data().updatedAt).toLocaleString() : '';
                area.val(`[Last Updated: ${updated}]\n\n${logs}`);
            } else {
                area.val('No logs found yet. Wait for the next automation run.');
            }
        } catch (e) {
            console.error(e);
            area.val('Failed to load logs: ' + e.message);
        }
    }

    async forceRunAutomation() {
        if (!confirm("Are you sure you want to FORCE RUN the automation now?\nThis will send emails/WhatsApp messages regardless of schedule.")) return;

        const area = $('#automationLogsArea');
        area.val('Triggering Force Run... Please wait...');

        try {
            const WORKER_URL = "https://gridify-expiry-automation.abhinandsofficial.workers.dev/?run=true";

            const response = await fetch(WORKER_URL);
            const text = await response.text();

            area.val(`[FORCE RUN RESPONSE]\n\n${text}`);
            alert("Force Run Completed. Check logs below.");

            setTimeout(() => this.fetchLogs(), 3000);
        } catch (e) {
            console.error(e);
            area.val('Force Run Failed (Network Error or CORS): ' + e.message);
            alert("Failed to trigger worker. Check console.");
        }
    }
}

const manager = new SubManager();
window.subManager = manager;

// --- Window Globals ---

window.editSub = (id) => {
    const s = manager.subscribers.find(sub => sub.id === id);
    if (!s) return;
    $('#modalTitle').text('Edit Subscriber');
    $('#subId').val(s.id);
    $('#subName').val(s.name);
    manager.populateProductDropdown();
    $('#subProduct').val(s.product);
    $('#subEmail').val(s.email);
    $('#subMobile').val(s.mobile);
    $('#subWebsite').val(s.website);
    $('#subType').val(s.type);
    $('#subPaymentMode').val(s.paymentMode);
    $('#subActivatedDate').val(s.activatedDate);
    $('#subExpiryDate').val(s.expiryDate);
    $('#subAmount').val(s.amount || '');
    $('#subBriefing').val(s.briefing || '');
    $('#subStatus').prop('checked', s.status === 'active');
    new bootstrap.Modal(document.getElementById('subModal')).show();
};

window.deleteSub = (id) => {
    if (confirm("Delete this subscriber?")) {
        deleteDoc(doc(db, SUB_COLLECTION, id)).then(() => manager.loadSubscribers());
    }
};

window.editProduct = (id) => {
    const p = manager.products.find(x => x.id === id);
    if (!p) return;
    console.log("Editing product:", p);
    $('#manageProductId').val(p.id);
    $('#manageProductName').val(p.name);
    $('#manageProductStatus').prop('checked', p.status === 'active');
    $('#productMgtForm button[type="submit"]').html('<i class="fas fa-save me-1"></i>Update');
    $('#productMgtForm').addClass('editing-mode');
    $('#manageProductName').focus();
};

window.toggleProductStatus = (id, state) => manager.toggleStatus(id, state);

window.deleteProduct = (id) => {
    if (confirm("Delete product?")) {
        deleteDoc(doc(db, PROD_COLLECTION, id)).then(() => manager.loadProducts());
    }
};

window.sendWhatsAppAlert = (id) => {
    const s = manager.subscribers.find(sub => sub.id === id);
    if (!s) return;

    const text = `Dear ${s.name},\n\nYour ${s.product} subscription expires today.\nKindly make the payment to continue the service.\n\nVisit to check status and repay: https://gridify.in/developments/url-shortener/?s=sub\n\nRegards,\nGridify`;
    const phone = s.mobile.replace(/\D/g, '');

    openWhatsAppPopup(phone, text);
};

window.resetForm = () => {
    $('#modalTitle').text('Add New Subscriber');
    $('#subId').val('');
    $('#subForm')[0].reset();
    $('#subStatus').prop('checked', true);
};

window.resetProductForm = () => manager.resetProductForm();
window.loadProductTableOnly = () => manager.loadProducts();
window.saveSettings = () => manager.saveSettings($('#alertTimeInput').val());
window.loadSettings = () => manager.loadSettings();
