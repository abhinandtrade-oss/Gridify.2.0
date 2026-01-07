# Hosting & Deployment Guide

## 1. Cloudflare Pages Setup (for ssv.gridify.in)

This guide assumes you have access to the Cloudflare account managing `gridify.in`.

### Step 1: Deploy to Cloudflare Pages
1.  **Push your code** to a GitHub/GitLab repository.
2.  Log in to the **Cloudflare Dashboard**.
3.  Go to **Compute (Workers & Pages)** > **Pages**.
4.  Click **Connect to Git**.
5.  Select your repository (`SSV-Event-Tracker`).
6.  **Build Settings**:
    *   **Framework Preset**: None / Static HTML
    *   **Build command**: (Leave empty)
    *   **Build output directory**: `/` (If your `index.html` is in the root) or just leave it default if allowing root. *Note: Since `index.html` is in the root, leave this blank or set to `.`*

### Step 2: Configure Subdomain (ssv.gridify.in)
1.  Once the project is deployed, go to the **Custom Domains** tab in your Pages project.
2.  Click **Set up a custom domain**.
3.  Enter `ssv.gridify.in`.
4.  Cloudflare will automatically configure the DNS record (CNAME).
5.  Wait for SSL initialization (usually < 5 mins).

---

## 2. Firebase Configuration Script

You asked for the script to add to Firebase. This primarily refers to the **Security Rules** to ensure your database is secure and only accessible by authorized users.

### Action: Update Firestore Security Rules

1.  Go to [Firebase Console](https://console.firebase.google.com/).
2.  Navigate to **Firestore Database** > **Rules** tab.
3.  **Delete** the existing code and **Paste** the following script:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // USERS COLLECTION
    // - Users can read their own profile
    // - Admins can read/write everything
    match /users/{userId} {
      allow read: if request.auth != null && (request.auth.uid == userId || isAdmin());
      allow write: if isAdmin(); // Only admins can create/suspend users
    }

    // EVENTS COLLECTION
    // - Authenticated users can read/write events
    match /events/{eventId} {
      allow read, write: if request.auth != null;
    }

    // CONFIG COLLECTION (Google Script URL)
    // - Admins can write
    // - Authenticated users can read (to get the email trigger URL)
    match /config/{document=**} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}
```

4.  Click **Publish**.

### Action: Update Indexes (If required)
If you see an error in the console saying "The query requires an index", simply click the direct link provided in the error message to automatically generate it in Firebase.

---

## 3. Google Apps Script (Backend)

Ensure your Email script is actively deployed:

1.  Go to your Google Apps Script project.
2.  Ensure code from `backend/email-script.gs` is pasted.
3.  **Deploy** > **Manage Deployments** > **Edit** > **New Version** > **Deploy**.
4.  Copy the **Web App URL**.
5.  Log in to `ssv.gridify.in/public/admin/index` (after hosting).
6.  Paste the URL in the Admin Dashboard configuration.
