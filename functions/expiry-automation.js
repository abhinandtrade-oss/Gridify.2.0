export default {
    async scheduled(event, env, ctx) {
        await runExpiryCheck();
    },
    async fetch(request, env) {
        await runExpiryCheck();
        return new Response("Automation triggered manually.");
    }
};

async function runExpiryCheck() {
    const PROJECT_ID = "grfy-b1731";
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRAffAw-c1Ya_drBWP2EMFHhPxHDeDygUXObRels0BX-rAyEmHqEC_D2-9MSUAl1kbMw/exec";

    // --- ADMIN WHATSAPP CONFIG (GREEN-API) ---
    // Get these from console.green-api.com (Free Developer Plan)
    const ID_INSTANCE = "7105444221";
    const API_TOKEN_INSTANCE = "03b2c5fb819c449c942e9e1fd87182d22d7c82c012eb427ebd";
    const ADMIN_PHONE = "9544852462"; // Your WhatsApp number

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const todayStr = istTime.toISOString().split('T')[0];

    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
    const queryPayload = {
        structuredQuery: {
            from: [{ collectionId: "subscribers" }], where: {
                compositeFilter: {
                    op: "AND", filters: [
                        { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } },
                        { fieldFilter: { field: { fieldPath: "expiryDate" }, op: "EQUAL", value: { stringValue: todayStr } } }
                    ]
                }
            }
        }
    };

    try {
        const response = await fetch(firestoreUrl, { method: 'POST', body: JSON.stringify(queryPayload) });
        const results = await response.json();

        if (!results || results.length === 0 || !results[0].document) return;

        let expiringNames = [];

        for (const res of results) {
            if (!res.document) continue;
            const fields = res.document.fields;
            const sub = {
                name: fields.name?.stringValue || "Subscriber",
                email: fields.email?.stringValue,
                product: fields.product?.stringValue || "Service",
                type: fields.type?.stringValue || "Subscription",
                briefing: fields.briefing?.stringValue || "N/A",
                amount: fields.amount?.stringValue || "0"
            };

            if (sub.email) {
                expiringNames.push(sub.name);
                // Send Email to Client
                const htmlMessage = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <p>Dear ${sub.name},</p>
                    <p>Your Gridify - <strong>${sub.product}</strong> subscription is set to expire today.</p>
                    <p><strong>Type of Subscription :</strong> ${sub.type}</p>
                    <p><strong>Plan :</strong> ${sub.briefing}</p>
                    <p><strong>Amount :</strong> ₹ ${sub.amount}</p>
                    <p>Please complete the payment to continue the service without any interruption.</p>
                    <p>visit to check the status and repay : <a href="https://gridify.in/developments/url-shortener/?s=sub">https://gridify.in/developments/url-shortener/?s=sub</a></p>
                    <p>For further details or assistance, contact us at <a href="mailto:sales@gridify.in">sales@gridify.in</a>.</p>
                    <br><p>Regards, Team Gridify</p><p><i>Please do not reply to this email.</i></p><br>
                    <img src="https://ci3.googleusercontent.com/mail-sig/AIorK4ywg6tSP5RqQc6O7l55MEke1l3Bf38GklDFOob5Ogvc1rx0SJ6nCrQ8z6h5v8C5_T-vC8HicKpcH8ih" alt="Gridify Signature" style="max-width: 400px; display: block;">
                </div>`;

                await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({ to: sub.email, subject: "Gridify Email Subscription Expiry Notice", message: htmlMessage })
                });
            }
        }

        // Send WhatsApp Summary to ADMIN via Green-API
        if (ID_INSTANCE !== "YOUR_ID_INSTANCE" && expiringNames.length > 0) {
            const message = `*Gridify Admin Alert*\n\nThe following subscriptions expire today:\n- ${expiringNames.join("\n- ")}\n\nPlease check the dashboard to send manual WhatsApp reminders.`;

            const waUrl = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`;
            await fetch(waUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: `${ADMIN_PHONE}@c.us`, message: message })
            });
        }

    } catch (e) { console.error("Automation Error:", e.message); }
}
