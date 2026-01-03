# EduPortal

A complete educational web portal demo built with HTML, CSS, and JavaScript.

## Folder Structure

- `/` - Root directory containing the main entry point (`index.html`).
- `/public` - (Optional) Public assets or static pages can be organized here. Currently, core pages are at root for easier access.
- `/auth` - Authentication pages (`login.html`, `signup.html`).
- `/dashboard` - Student dashboard (`index.html`).
- `/admin` - Admin dashboard (`index.html`).
- `/styles` - CSS files (`main.css`).
- `/scripts` - JavaScript files (`main.js`, `auth.js`).
- `/assets` - Directory for images, icons, and other media.

## How to Run

1. **Local File System**: You can simply open `index.html` in your browser.
   - Note: Browsers may restrict some features like local file access or absolute paths.
   - For the best experience, use a local server.

2. **Local Server (Recommended)**:
   If you have Node.js installed, run:
   ```bash
   npx serve .
   ```
   Then visit `http://localhost:3000`.

## Features implemented

- **Public Website**: Home, Courses, About, Contact pages.
- **Authentication**: Mock login system (Student & Admin roles).
  - Student Credentials: `student@edu.com` / `student`
  - Admin Credentials: `admin@edu.com` / `admin`
- **Dashboards**: Dedicated areas for Students and Admins.
- **Responsive Design**: Mobile-friendly layout.
- **Live & Recorded Classes**: UI placeholders for video embedding.

## TODO / Backend Integration Points

- **Authentication**: Connect `Auth.login` in `scripts/auth.js` to a real backend API (JWT based).
- **Database**: Replace mock data in `dashboard/index.html` and `course.html` with data fetched from a database.
- **Payment**: Integrate Stripe/Razorpay in the subscription flow.
- **Video**: Replace YouTube embeds with a secure video player if needed.

## Design
Built using a custom "EduPortal Design System" defined in `styles/main.css` (No frameworks used, pure CSS).
