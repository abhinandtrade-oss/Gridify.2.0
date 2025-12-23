
// ==========================================
// GOOGLE APPS SCRIPT CODE (BACKEND)
// ==========================================
// 1. Go to https://script.google.com/
// 2. Click "New Project"
// 3. Paste the code below into the script editor (replace existing code).
// 4. Click "Deploy" > "New deployment".
// 5. Select type: "Web app".
// 6. Set Description: "Love Letter Backend".
// 7. Execute as: "Me" (your email).
// 8. Who has access: "Anyone" (IMPORTANT!).
// 9. Click "Deploy".
// 10. Copy the "Web app URL" (it ends with /exec).
// 11. Paste this URL into 'create.js' and 'view.js' where indicated.

function doPost(e) {
    return handleRequest(e);
}

function doGet(e) {
    return handleRequest(e);
}

function handleRequest(e) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Setup Headers if new sheet
    if (sheet.getLastRow() === 0) {
        sheet.appendRow(["ID", "Timestamp", "Sender", "Message"]);
    }

    // Parse parameters
    var params = e.parameter;

    // If POST data is JSON (create new entry)
    if (e.postData && e.postData.contents) {
        try {
            var data = JSON.parse(e.postData.contents);
            var id = Utilities.getUuid();
            var timestamp = new Date();
            var sender = data.sender || "Anonymous";
            var message = data.message || "";

            sheet.appendRow([id, timestamp, sender, message]);

            return responseJSON({ success: true, id: id });
        } catch (err) {
            return responseJSON({ success: false, error: err.toString() });
        }
    }

    // If GET request with ID (retrieve entry)
    if (params.id) {
        var data = sheet.getDataRange().getValues();
        // Search for ID (Column A is index 0)
        for (var i = 1; i < data.length; i++) {
            if (data[i][0] == params.id) {
                return responseJSON({
                    success: true,
                    sender: data[i][2],
                    message: data[i][3]
                });
            }
        }
        return responseJSON({ success: false, error: "Letter not found" });
    }

    return responseJSON({ success: false, error: "Invalid Request" });
}

function responseJSON(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}
