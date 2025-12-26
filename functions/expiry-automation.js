export default {
    async scheduled(event, env, ctx) {
        // This runs automatically based on the Cron trigger (9:00 AM IST)
        console.log("Starting daily expiry automation...");
        await runExpiryCheck();
    },
    // Also allow manual trigger via URL for testing
    async fetch(request, env) {
        await runExpiryCheck();
        return new Response("Automation triggered manually.");
    }
};

async function runExpiryCheck() {
    const PROJECT_ID = "grfy-b1731";
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRAffAw-c1Ya_drBWP2EMFHhPxHDeDygUXObRels0BX-rAyEmHqEC_D2-9MSUAl1kbMw/exec";

    // 1. Get Today's Date in IST (YYYY-MM-DD)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const todayStr = istTime.toISOString().split('T')[0];

    console.log(`Checking for expiry date: ${todayStr}`);

    // 2. Query Firestore via REST API
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;

    const queryPayload = {
        structuredQuery: {
            from: [{ collectionId: "subscribers" }],
            where: {
                compositeFilter: {
                    op: "AND",
                    filters: [
                        {
                            fieldFilter: {
                                field: { fieldPath: "status" },
                                op: "EQUAL",
                                value: { stringValue: "active" }
                            }
                        },
                        {
                            fieldFilter: {
                                field: { fieldPath: "expiryDate" },
                                op: "EQUAL",
                                value: { stringValue: todayStr }
                            }
                        }
                    ]
                }
            }
        }
    };

    try {
        const response = await fetch(firestoreUrl, {
            method: 'POST',
            body: JSON.stringify(queryPayload)
        });

        const results = await response.json();

        // Firestore returns an array of objects representing matching documents
        // If no matches, it might return an empty array or an array with one empty object
        if (!results || results.length === 0 || !results[0].document) {
            console.log("No subscribers expiring today.");
            return;
        }

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

            if (!sub.email) continue;

            // 3. Construct HTML Message (Matches Dashboard template)
            const htmlMessage = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <p>Dear ${sub.name},</p>
                    <p>Your Gridify - <strong>${sub.product}</strong> subscription is set to expire today.</p>
                    <p><strong>Type of Subscription :</strong> ${sub.type}</p>
                    <p><strong>Plan :</strong> ${sub.briefing}</p>
                    <p><strong>Amount :</strong> ₹ ${sub.amount}</p>
                    <p>Please complete the payment to continue the service without any interruption.</p>
                    <p>For further details or assistance, contact us at <a href="mailto:sales@gridify.in">sales@gridify.in</a>.</p>
                    <br>
                    <p>Regards, Team Gridify</p>
                    <p><i>Please do not reply to this email.</i></p>
                    <br>
                    <img src="https://ci3.googleusercontent.com/mail-sig/AIorK4ywg6tSP5RqQc6O7l55MEke1l3Bf38GklDFOob5Ogvc1rx0SJ6nCrQ8z6h5v8C5_T-vC8HicKpcH8ih" alt="Gridify Signature" style="max-width: 400px; display: block;">
                </div>
            `;

            // 4. Send to Google Apps Script
            console.log(`Sending alert to: ${sub.email}`);
            await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    to: sub.email,
                    subject: "Gridify Email Subscription Expiry Notice",
                    message: htmlMessage
                })
            });
        }

        console.log(`Automation completed. Alerts processed.`);

    } catch (e) {
        console.error("Automation Error:", e.message);
    }
}
