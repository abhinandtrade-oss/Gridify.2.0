export class EmailService {
    constructor(scriptUrl) {
        this.scriptUrl = scriptUrl;
    }

    async sendEmail(emailData) {
        if (!this.scriptUrl) {
            console.error("Google Apps Script URL is missing.");
            return { success: false, message: "Email configuration missing." };
        }

        try {
            // Google Apps Script Web App requires 'application/x-www-form-urlencoded' or specific handling for CORS if strictly JSON.
            // Often, 'no-cors' mode is needed if the script doesn't handle OPTIONS, but that makes reading response opaque.
            // For this implementation, we assume the Apps Script is set to "Anyone" and handles JSON content type correctly 
            // OR we use the trick of sending it as a hidden form or fetch with CORS allowed.
            // Standard fetch:
            const response = await fetch(this.scriptUrl, {
                method: 'POST',
                body: JSON.stringify(emailData),
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8', // 'text/plain' checks preflight issues in some simplified setups
                },
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error("Email send failed:", error);
            // In a real-world no-cors scenario we might not know if it failed, but we assume the best if no network error.
            return { success: false, message: error.message };
        }
    }
}

export const CSVExport = {
    downloadCSV: (data, filename = 'export.csv') => {
        if (!data || !data.length) return;

        const headers = Object.keys(data[0]);
        const csvRows = [];

        // Add headers
        csvRows.push(headers.join(','));

        // Add Data
        for (const row of data) {
            const values = headers.map(header => {
                const escaped = ('' + row[header]).replace(/"/g, '\\"');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
};

export const formatDate = (dateString) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
