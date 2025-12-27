export default {
    async fetch(request, env) {
        // --- GREEN-API CONFIG ---
        const ID_INSTANCE = "7105444221";
        const API_TOKEN_INSTANCE = "03b2c5fb819c449c942e9e1fd87182d22d7c82c012eb427ebd";

        const url = `https://api.green-api.com/waInstance${ID_INSTANCE}/getContacts/${API_TOKEN_INSTANCE}`;

        try {
            const response = await fetch(url, { method: 'POST' });
            const contacts = await response.json();

            // Filter only groups (ending in @g.us)
            const groups = contacts.filter(c => c.id.endsWith('@g.us'));

            if (groups.length === 0) {
                return new Response("No groups found. Make sure the bot is added to a group and has synced contacts.", { headers: { 'content-type': 'text/plain' } });
            }

            const list = groups.map(g => `Group Name: ${g.name || 'Unknown'}\nGroup ID: ${g.id}`).join('\n\n');

            return new Response(`--- YOUR WHATSAPP GROUPS ---\nCopy the Group ID you want to use:\n\n${list}`, {
                headers: { 'content-type': 'text/plain' }
            });

        } catch (e) {
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    }
};
