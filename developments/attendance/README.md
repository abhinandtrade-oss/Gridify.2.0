# Employee Attendance System Setup (Gridify)

This module provides a photo-based punch-in/out system with live face detection, integrated with Google Sheets and Drive.

## 1. Google Sheets Setup
1. Create a new Google Sheet.
2. The system will automatically create the "Attendance" sheet on first use, but you can manually create one with these headers in row 1:
   `User ID`, `User Name`, `Date`, `Punch In Time`, `Punch Out Time`, `Total Work Duration`, `Attendance Status`, `Punch In Image URL`, `Punch Out Image URL`, `Edited By`, `Last Modified Timestamp`

## 2. Google Apps Script Deployment
1. Open your Google Sheet.
2. Go to `Extensions` > `Apps Script`.
3. Copy the content of `backend.gs` from this folder and paste it into the script editor.
4. (Optional) Create a folder in Google Drive to store images and paste its ID into `DRIVE_FOLDER_ID` in the script. If left empty, it will save to your root directory.
5. Click `Deploy` > `New Deployment`.
6. Select `Web App`.
7. Set "Execute as" to `Me`.
8. Set "Who has access" to `Anyone`.
9. Click `Deploy`, authorize permissions, and **copy the Web App URL**.

## 3. Frontend Configuration
1. Open `ERP/attendance/script.js`.
2. Replace the `ATTENDANCE_GAS_URL` constant with the Web App URL you copied in the previous step.

## 4. Registering the Module (Optional)
To make the Attendance module appear in your Gridify Dashboard:
1. Log in as an Admin.
2. If your project has a "Management" or "Settings" section to add programs, add:
   - **ID**: `attendance`
   - **Name**: `Attendance`
   - **Path**: `attendance` (Relative to /ERP/)
   - **Icon**: `fa-clock`
   - **Color**: `primary`

## 5. Security Note
- Role-based access is handled via `access-control.js`.
- Ensure users who need access have `attendance` in their `allowedPrograms` array in Firestore.
- Admin users (role: 'admin') have access by default.

## Features
- **Live Face Detection**: Submissions are blocked unless a real human face is detected by the camera.
- **Role-based UI**: Normal users see their dashboard and punch controls; Admins see organization-wide records and edit controls.
- **Auto-Image Upload**: Captures and uploads a photo to Google Drive at every punch for verification.
- **Attendance Rules**: Automatic "Present" / "Leave" / "Incomplete" status calculation.
