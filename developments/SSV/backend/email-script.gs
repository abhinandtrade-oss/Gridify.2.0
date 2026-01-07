function doPost(e) {
  // Security: You might want to add a shared token check here
  
  try {
    const data = JSON.parse(e.postData.contents);
    
    const emailType = data.emailType;
    const to = data.to;
    const cc = data.cc || "";
    const subject = data.subject;
    const body = data.body;
    const priority = data.priority || "NORMAL"; // NORMAL or HIGH
    
    if (!to || !subject || !body) {
      return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": "Missing required fields" })).setMimeType(ContentService.MimeType.JSON);
    }

    let mailOptions = {
      to: to,
      cc: cc,
      subject: subject,
      htmlBody: body + "<br><br>---<br><div style='text-align: center; font-size: 12px; color: #888;'>powered by <a href='https://www.gridify.in' style='color: #4a90e2; text-decoration: none;'>GRIDIFY</a></div>"
    };

    // Note: GmailApp does not natively support "High Priority" flags easily in the same way as Outlook, 
    // but we can add [URGENT] to subject if priority is HIGH.
    if (priority === "HIGH") {
      mailOptions.subject = "[URGENT] " + mailOptions.subject;
    }

    MailApp.sendEmail(mailOptions);
    
    return ContentService.createTextOutput(JSON.stringify({ "status": "success" })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
