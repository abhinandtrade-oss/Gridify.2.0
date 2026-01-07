# SSV Event Tracker Portal

A secure web portal to manage organizational events, track report submissions, and automate reminders via Google Apps Script.

## Project Structure

- `public/`: Frontend files (HTML, CSS, JS).
- `public/admin/`: Admin specific pages (Login, User Management).
- `public/user/`: User specific pages (Dashboard, Event Creation).
- `public/assets/`: Shared assets (CSS, JS, Firebase Config).
- `backend/`: Google Apps Script code for Email Service.

## Setup Instructions

### 1. Firebase Configuration

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. Enable **Authentication** (Email/Password).
4. Enable **Firestore Database**.
5. Copy your web app configuration keys.
6. Open `public/assets/js/firebase-config.js` and paste your keys.

### 2. Firestore Rules

Set up the following rules in your Firestore Database to ensure security:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    match /events/{eventId} {
      allow read, write: if request.auth != null;
    }
    match /config/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### 3. Google Apps Script (Email Service)

1. Go to [Google Apps Script](https://script.google.com/).
2. Create a new project.
3. Copy the content from `backend/email-script.gs` into the script editor.
4. Click **Deploy** > **New Deployment**.
5. Select type: **Web app**.
6. Set "Execute as": **Me** (your email).
7. Set "Who has access": **Anyone**.
8. Click **Deploy** and copy the **Web App URL**.
9. Log in to the **Admin Portal** of this app and paste the URL in the configuration section.

### 4. Admin Setup (First Time)

Since the Admin Portal requires an admin account to create other users, you need to manually create the first admin:

1. Use the Firebase Console > Authentication to create a user (e.g., `admin@ssv.com`).
2. Go to Firestore Database > `users` collection.
3. Add a document with ID = the User UID from the auth tab.
4. Add fields:
   - `email`: "admin@ssv.com"
   - `role`: "admin"
   - `suspended`: false

Now you can log in to the Admin Portal.

## Features

- **Role-Based Access**: Separate Admin and User dashboards.
- **Email Automation**: Automated emails for event creation and reminders.
- **Escalation**: 3rd reminder automatically prompts for HOD email and marks as High Priority.
- **Export**: CSV export of event data.
- **Design**: Premium Glassmorphism UI.

## Support

Powered by [GRIDIFY](https://www.gridify.in)
