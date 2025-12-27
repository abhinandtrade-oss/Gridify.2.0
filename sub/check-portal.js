
import { db } from '../assets/js/firebase-config.js';
import {
    collection, getDocs, query, where, limit
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const SUB_COLLECTION = 'subscribers';

class CheckPortal {
    constructor() {
        this.currentData = null;
        this.init();
    }

    init() {
        $('#btnCheck').on('click', () => this.handleLookup());
        $('#userInput').on('keypress', (e) => {
            if (e.which == 13) this.handleLookup();
        });
        $('#btnRenew').on('click', () => this.handleRenew());
    }

    async handleLookup() {
        const input = $('#userInput').val().trim().toLowerCase();
        if (!input) return;

        $('#errorMsg').hide();
        const btn = $('#btnCheck');
        const originalHtml = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Checking...');

        try {
            // Check by email
            let q = query(collection(db, SUB_COLLECTION), where('email', '==', input), limit(1));
            let snapshot = await getDocs(q);

            // If not found, check by mobile (exact match as stored)
            if (snapshot.empty) {
                q = query(collection(db, SUB_COLLECTION), where('mobile', '==', input), limit(1));
                snapshot = await getDocs(q);

                // Fallback: try with clean digits if user entered formatting
                if (snapshot.empty) {
                    const cleanPhone = input.replace(/\D/g, '');
                    if (cleanPhone.length >= 10) {
                        // This is tricky with Firestore without fetching all, 
                        // but let's assume one format for now or 
                        // advise user to try email if mobile fails.
                    }
                }
            }

            if (snapshot.empty) {
                $('#errorMsg').fadeIn();
                btn.prop('disabled', false).html(originalHtml);
                return;
            }

            this.currentData = snapshot.docs[0].data();
            this.showResult(this.currentData);

        } catch (e) {
            console.error("Lookup Error:", e);
            alert("An error occurred. Please try again later.");
        } finally {
            btn.prop('disabled', false).html(originalHtml);
        }
    }

    showResult(data) {
        const now = new Date();
        const expiryDate = new Date(data.expiryDate);
        expiryDate.setHours(23, 59, 59, 999);

        const isExpired = expiryDate < now;
        const diff = expiryDate - now;
        const isExpiringSoon = diff > 0 && diff < (7 * 24 * 60 * 60 * 1000);
        const isToday = now.toISOString().split('T')[0] === data.expiryDate;

        $('#resName').text(data.name);
        $('#resProduct').text(data.product || 'Subscription Plan');
        $('#resType').text(data.type);
        $('#resAmount').text(`₹ ${data.amount || '0'}`);
        $('#resStart').text(data.activatedDate);
        $('#resExpiry').text(data.expiryDate);

        let badgeHtml = '';
        if (data.status === 'inactive') {
            badgeHtml = '<span class="status-badge bg-secondary text-white">Inactive</span>';
        } else if (isExpired) {
            badgeHtml = '<span class="status-badge bg-danger text-white">Expired</span>';
        } else if (isToday) {
            badgeHtml = '<span class="status-badge bg-warning text-dark">Expires Today</span>';
        } else if (isExpiringSoon) {
            badgeHtml = '<span class="status-badge bg-warning text-dark">Expiring Soon</span>';
        } else {
            badgeHtml = '<span class="status-badge bg-success text-white">Active</span>';
        }
        $('#statusBadgeContainer').html(badgeHtml);

        // Always set Monthly as the default renewal suggestion
        $('input[name="renewalPlan"][value="Monthly"]').prop('checked', true);

        $('#lookupView').hide();
        $('#resultView').fadeIn();
    }

    handleRenew() {
        if (!this.currentData) return;

        const data = this.currentData;
        const selectedPlan = $('input[name="renewalPlan"]:checked').val();
        const waNumber = "919544852462"; // Gridify Admin
        const text = `Hi, I would like to renew my Gridify subscription.\n\n*Details:*\nName: ${data.name}\nProduct: ${data.product}\nNew Plan Choice: ${selectedPlan}\nCurrent Expiry: ${data.expiryDate}\n\nPlease guide me through the renewal process.`;

        const protocolUrl = `whatsapp://send?phone=${waNumber}&text=${encodeURIComponent(text)}`;
        const webUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;

        // Try protocol first
        window.location.href = protocolUrl;

        // Fallback logic
        setTimeout(() => {
            if (document.hasFocus()) {
                window.location.href = webUrl;
            }
        }, 1000);
    }
}

new CheckPortal();
