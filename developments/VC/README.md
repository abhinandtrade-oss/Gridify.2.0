# Gridify Live Video Conference Portal

A secure, real-time video conferencing application built with Vanilla JS, WebRTC, and Firebase.

## Setup Instructions

1. **Firebase Setup**:
   - Go to [Firebase Console](https://console.firebase.google.com/).
   - Create a new project.
   - Enable **Authentication** (Email/Password Sign-in provider).
   - Enable **Firestore Database** (Create database).
   - Enable **Realtime Database**.
   - Copy your web app's configuration (Project Settings > General > Your apps > SDK setup/config).

2. **Configure App**:
   - Open `public/assets/js/firebase-config.js`.
   - Replace the placeholder values in `firebaseConfig` object with your actual keys from Firebase Console.

3. **Run Locally**:
   - You need a local server to run this (due to ES6 modules).
   - If you have Node.js installed, simpler way:
     ```bash
     npx serve public
     ```
   - open `http://localhost:3000` (or the port provided).

4. **Deploy**:
   - Install Firebase CLI: `npm install -g firebase-tools`
   - Login: `firebase login`
   - Initialize (if needed, but structure is ready): `firebase init hosting`
   - Deploy: `firebase deploy`

## Features

- **Authentication**: Login/Register with Email/Password.
- **Dashboard**: Create/Join meetings, view history.
- **Video Room**:
  - Real-time Video/Audio (WebRTC).
  - Screen Sharing.
  - Chat.
  - Mute/Camera toggle.
  - Host controls (End meeting).
- **Security**: Basic validation and Auth checks.

## Project Structure

- `/public`: Hosting root.
  - `/auth`: Login/Register pages.
  - `/dashboard`: Main dashboard.
  - `/meeting`: Video room.
  - `/assets`: CSS and JS files.

## Notes

- **Browser Permissions**: Ensure you allow Camera and Microphone access.
- **WebRTC**: Works best on HTTPS or localhost. Remote connections might fail without proper STUN/TURN servers if behind strict firewalls (Code uses Google's public STUN servers).
