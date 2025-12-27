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
    const ID_INSTANCE = "7105444221";
    const API_TOKEN_INSTANCE = "03b2c5fb819c449c942e9e1fd87182d22d7c82c012eb427ebd";
    const ADMIN_PHONE = "9544852462";

    // --- TIME CHECK LOGIC ---
    // 1. Get Current Time (IST)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const todayStr = istTime.toISOString().split('T')[0];
    const currentHour = istTime.getUTCHours();
    const currentMinute = istTime.getUTCMinutes();

    // Convert to "HH:MM" format for easy comparison
    // const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    console.log(`Checking for expiry date: ${todayStr} at IST Time: ${currentHour}:${currentMinute}`);

    const firestoreBaseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

    // 2. Fetch Admin Settings to see if we should run NOW
    let shouldRun = false;
    let preferredTime = "09:00"; // Default

    try {
        const settingsResp = await fetch(`${firestoreBaseUrl}/admin_settings/general`);
        if (settingsResp.ok) {
            const settingsDoc = await settingsResp.json();
            if (settingsDoc.fields && settingsDoc.fields.alertTime) {
                preferredTime = settingsDoc.fields.alertTime.stringValue;
            }
            // Check last run to avoid double sending
            if (settingsDoc.fields && settingsDoc.fields.lastRunDate && settingsDoc.fields.lastRunDate.stringValue === todayStr) {
                console.log("Already ran today. Skipping.");
                return;
            }
        }
    } catch (e) { console.log("Error fetching settings, using default 9 AM"); }

    // 3. Compare Time
    // We allow a 35 minute window. e.g. if set to 09:00, we run if current time is between 09:00 and 09:35
    const [prefHour, prefMinute] = preferredTime.split(':').map(Number);
    const timeInMinutes = (currentHour * 60) + currentMinute;
    const prefInMinutes = (prefHour * 60) + prefMinute;

    // Check if we are past the preferred time but within 35 mins
    if (timeInMinutes >= prefInMinutes && timeInMinutes < (prefInMinutes + 35)) {
        shouldRun = true;
    } else {
        console.log(`Not time yet. Preferred: ${preferredTime}, Current: ${currentHour}:${currentMinute}`);
        return;
    }

    if (!shouldRun) return;

    // --- MAIN ALERT LOGIC ---
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
        const response = await fetch(`${firestoreBaseUrl}:runQuery`, { method: 'POST', body: JSON.stringify(queryPayload) });
        const results = await response.json();

        let expiringNames = [];

        if (results && results.length > 0 && results[0].document) {
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
                    const htmlMessage = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <p>Dear ${sub.name},</p>
                        <p>Your Gridify - <strong>${sub.product}</strong> subscription is set to expire today.</p>
                        <p><strong>Type of Subscription :</strong> ${sub.type}</p>
                        <p><strong>Plan :</strong> ${sub.briefing}</p>
                        <p><strong>Amount :</strong> ₹ ${sub.amount}</p>
                        <p>Please complete the payment.</p>
                        <br><p>Regards, Team Gridify</p>
                        <img src="https://ci3.googleusercontent.com/mail-sig/AIorK4ywg6tSP5RqQc6O7l55MEke1l3Bf38GklDFOob5Ogvc1rx0SJ6nCrQ8z6h5v8C5_T-vC8HicKpcH8ih" alt="Gridify Signature" style="max-width: 400px;">
                    </div>`;

                    await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({ to: sub.email, subject: "Gridify Email Subscription Expiry Notice", message: htmlMessage })
                    });
                }
            }
        }

        // WhatsApp Admin Summary
        if (expiringNames.length > 0) {
            const message = `*Gridify Admin Alert*\n\n${expiringNames.length} subscriptions expire today:\n- ${expiringNames.join("\n- ")}`;
            const waUrl = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`;
            await fetch(waUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: `${ADMIN_PHONE}@c.us`, message: message })
            });
        }

        // 4. Update Last Run Date to prevent duplicates
        await fetch(`${firestoreBaseUrl}/admin_settings/general?updateMask.fieldPaths=lastRunDate`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { lastRunDate: { stringValue: todayStr }, alertTime: { stringValue: preferredTime } } })
        });

        console.log("Automation completed & status saved.");

    } catch (e) { console.error("Automation Error:", e.message); }
}
