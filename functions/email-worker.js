import { EmailMessage } from "cloudflare:email";

export default {
    async fetch(request, env) {
        // 1. Handle CORS (Cross-Origin Resource Sharing)
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST",
                    "Access-Control-Allow-Headers": "Content-Type",
                },
            });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        try {
            const { to, subject, message } = await request.json();

            if (!to || !subject || !message) {
                return new Response(JSON.stringify({ error: "Missing parameters: to, subject, or message" }), {
                    status: 400,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            // 2. Debug Binding
            if (!env.SEALER_EMAIL) {
                return new Response(JSON.stringify({
                    error: "BINDING_MISSING",
                    details: "The 'SEALER_EMAIL' binding is not set up in Cloudflare Settings."
                }), {
                    status: 500,
                    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
                });
            }

            // 3. Construct the MIME message
            const mimeMessage = [
                `From: "Gridify Alerts" <alert.noreplay@gridify.in>`,
                `To: ${to}`,
                `Subject: ${subject}`,
                `Date: ${new Date().toUTCString()}`,
                `MIME-Version: 1.0`,
                `Content-Type: text/plain; charset="utf-8"`,
                `Content-Transfer-Encoding: 7bit`,
                ``,
                message,
                ``,
                `---`,
                `This is an automated message. Please do not reply.`
            ].join("\r\n");

            // 4. Attempt to send
            await env.SEALER_EMAIL.send(new EmailMessage(
                "alert.noreplay@gridify.in",
                to,
                mimeMessage
            ));

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
            });

        } catch (e) {
            console.error("Worker Catch Error:", e.message);
            return new Response(JSON.stringify({
                error: "WORKER_EXECUTION_FAILED",
                details: e.message
            }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
            });
        }
    },
};
