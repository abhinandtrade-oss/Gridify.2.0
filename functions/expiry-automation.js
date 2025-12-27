export default {
    async scheduled(event, env, ctx) {
        await runExpiryCheck();
    },
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "*" }
            });
        }

        const url = new URL(request.url);
        const shouldRun = url.searchParams.get("run") === "true";

        if (!shouldRun) {
            // VIEW MODE: Just show the latest logs
            try {
                const PROJECT_ID = "grfy-b1731";
                const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/admin_settings/logs`;
                const response = await fetch(firestoreUrl);
                const data = await response.json();
                const latestLog = data.fields?.latestLog?.stringValue || "No logs found.";
                return new Response(`--- WORKER LOGS (Read-Only) ---\nTo trigger manually, append ?run=true to URL.\n\n${latestLog}`, {
                    headers: { 'content-type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
                });
            } catch (e) {
                return new Response(`Error fetching logs: ${e.message}`, { status: 500 });
            }
        }

        // EXECUTE MODE
        const logs = [];
        const originalLog = console.log;
        console.log = (...args) => { logs.push(args.join(' ')); originalLog(...args); };

        try {
            await runExpiryCheck(true); // isManual = true
            return new Response(`Manual Execution Completed.\n\n${logs.join('\n')}`, { headers: { 'content-type': 'text/plain', 'Access-Control-Allow-Origin': '*' } });
        } catch (e) {
            return new Response(`Error:\n${e.message}\n\nLogs:\n${logs.join('\n')}`, { status: 500 });
        }
    }
};

// Helper buffer for saving logs to Firestore
let globalLogBuffer = [];

async function saveLogs(firestoreBaseUrl, logs) {
    if (logs.length === 0) return;
    const logContent = logs.join("\n");
    // Save to admin_settings/logs document
    // We use a timestamp field to keep track of when it was updated
    await fetch(`${firestoreBaseUrl}/admin_settings/logs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fields: {
                latestLog: { stringValue: logContent },
                updatedAt: { stringValue: new Date().toISOString() }
            }
        })
    });
}

async function runExpiryCheck(isManual = false) {
    const PROJECT_ID = "grfy-b1731";
    const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwRAffAw-c1Ya_drBWP2EMFHhPxHDeDygUXObRels0BX-rAyEmHqEC_D2-9MSUAl1kbMw/exec";

    // --- ADMIN WHATSAPP CONFIG (GREEN-API) ---
    const ID_INSTANCE = "7105444221";
    const API_TOKEN_INSTANCE = "03b2c5fb819c449c942e9e1fd87182d22d7c82c012eb427ebd";
    const ADMIN_PHONE = "120363405714573337@g.us";

    const firestoreBaseUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

    globalLogBuffer = []; // Reset buffer
    const log = (msg) => {
        console.log(msg);
        // Calculate IST for logging (UTC + 5.5)
        const d = new Date();
        const istDate = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
        const timeStr = istDate.toISOString().split('T')[1].substring(0, 8); // e.g. "18:30:05"
        globalLogBuffer.push(`[${timeStr} IST] ${msg}`);
    };

    log("System Initializing...");

    // --- TIME CHECK LOGIC ---
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const todayStr = istTime.toISOString().split('T')[0];
    const currentHour = istTime.getUTCHours();
    const currentMinute = istTime.getUTCMinutes();

    log(`Current IST Time: ${todayStr} ${currentHour}:${currentMinute}`);

    // 2. Fetch Admin Settings
    let shouldRun = false;
    let preferredTime = "09:00";

    try {
        const settingsResp = await fetch(`${firestoreBaseUrl}/admin_settings/general`);
        if (settingsResp.ok) {
            const settingsDoc = await settingsResp.json();
            if (settingsDoc.fields && settingsDoc.fields.alertTime) {
                preferredTime = settingsDoc.fields.alertTime.stringValue;
            }

            // LOGIC FOR MULTIPLE RUNS
            // If the user changed the "alertTime", lastConfiguredTime will be different from preferredTime.
            // In that case, we ALLOW a re-run even if lastRunDate is today.

            if (!isManual) {
                const lastRunDate = settingsDoc.fields?.lastRunDate?.stringValue;
                const lastConfiguredTime = settingsDoc.fields?.lastConfiguredTime?.stringValue;

                // Logic: If ran today AND the time setting hasn't changed, STOP.
                // If the time setting CHANGED (e.g. user updated from 17:00 to 18:00), we allow a re-run.
                if (lastRunDate === todayStr) {
                    if (lastConfiguredTime === preferredTime) {
                        log("Already executed today for this specific schedule. Skipping.");
                        await saveLogs(firestoreBaseUrl, globalLogBuffer);
                        return;
                    } else {
                        log(`Notice: Schedule changed (Last: ${lastConfiguredTime} -> New: ${preferredTime}). allowing re-run.`);
                    }
                }
            }
        }
    } catch (e) { log("Error fetching settings, using default 09:00"); }

    // 3. Robust Latch Logic
    if (!isManual) {
        const [prefHour, prefMinute] = preferredTime.split(':').map(Number);
        const timeInMinutes = (currentHour * 60) + currentMinute;
        const prefInMinutes = (prefHour * 60) + prefMinute;

        if (timeInMinutes >= prefInMinutes) {
            shouldRun = true;
        } else {
            log(`Too early. Preferred: ${preferredTime}, Current: ${currentHour}:${currentMinute}. Sleeping.`);
            await saveLogs(firestoreBaseUrl, globalLogBuffer);
            return;
        }
    } else {
        shouldRun = true;
        log("Manual Trigger - Bypassing Time Checks.");
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
        log(`Searching subscribers...`);

        const response = await fetch(`${firestoreBaseUrl}:runQuery`, { method: 'POST', body: JSON.stringify(queryPayload) });
        const results = await response.json();

        if (!results) log("Firestore result: NULL");
        else log(`Firestore found ${results.length} results.`);

        let expiringDetails = []; // Changed from names to details

        if (results && results.length > 0 && results[0].document) {
            for (const res of results) {
                if (!res.document) continue;
                const fields = res.document.fields;
                log(`Processing: ${fields.name?.stringValue}`);

                const sub = {
                    name: fields.name?.stringValue || "Subscriber",
                    email: fields.email?.stringValue,
                    product: fields.product?.stringValue || "Service",
                    type: fields.type?.stringValue || "Subscription",
                    briefing: fields.briefing?.stringValue || "N/A",
                    amount: fields.amount?.stringValue || "0",
                    mobile: fields.mobile?.stringValue || "N/A"
                };

                if (sub.email) {
                    // Add details for WhatsApp
                    expiringDetails.push(`${sub.name}\n  📱 ${sub.mobile}\n  📧 ${sub.email}`);

                    const htmlMessage = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                        <p>Dear ${sub.name},</p>
                        <p>Your Gridify - <strong>${sub.product}</strong> subscription is set to expire today.</p>
                        <p><strong>Type of Subscription :</strong> ${sub.type}</p>
                        <p><strong>Plan :</strong> ${sub.briefing}</p>
                        <p><strong>Amount :</strong> ₹ ${sub.amount}</p>
                        <p>Please complete the payment.</p>
                        <p>visit to check the status and repay : <a href="https://gridify.in/developments/url-shortener/?s=sub">https://gridify.in/developments/url-shortener/?s=sub</a></p>
                        <br><p>Regards, Team Gridify</p>
                        <img src="https://ci3.googleusercontent.com/mail-sig/AIorK4ywg6tSP5RqQc6O7l55MEke1l3Bf38GklDFOob5Ogvc1rx0SJ6nCrQ8z6h5v8C5_T-vC8HicKpcH8ih" alt="Gridify Signature" style="max-width: 400px;">
                    </div>`;

                    log(`Sending Email to: ${sub.email}`);
                    const emailResp = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({ to: sub.email, subject: "Gridify Email Subscription Expiry Notice", message: htmlMessage })
                    });
                    log(`Email Resp: ${emailResp.status}`);
                }
            }
        } else {
            log("No matching subscribers.");
        }

        // WhatsApp Admin Summary
        if (expiringDetails.length > 0) {
            log(`Sending WA Alert for ${expiringDetails.length} users.`);
            const message = `*Gridify Admin Alert*\n\n${expiringDetails.length} subscriptions expire today:\n\n- ${expiringDetails.join("\n- ")}`;
            const waUrl = `https://api.green-api.com/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`;
            const waResp = await fetch(waUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatId: ADMIN_PHONE, message: message })
            });
            log(`WA Resp: ${waResp.status}`);
        }

        // 4. Update Last Run Date + Configured Time
        log("Saving Run State...");
        await fetch(`${firestoreBaseUrl}/admin_settings/general?updateMask.fieldPaths=lastRunDate&updateMask.fieldPaths=lastConfiguredTime`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fields: {
                    lastRunDate: { stringValue: todayStr },
                    alertTime: { stringValue: preferredTime },
                    lastConfiguredTime: { stringValue: preferredTime } // IMPORTANT: Save this to prevent infinite loops
                }
            })
        });
        log("Automation Complete.");

        // Final Save of Logs
        await saveLogs(firestoreBaseUrl, globalLogBuffer);

    } catch (e) {
        log(`ERROR: ${e.message}`);
        await saveLogs(firestoreBaseUrl, globalLogBuffer);
    }
}
