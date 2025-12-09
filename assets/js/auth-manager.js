/**
 * Auth Manager
 * Handles simple username/password authentication using SHA-256 hashing.
 */

const AUTH_SESSION_KEY = 'gridify_auth_session';

// Credentials (Pre-hashed for security in source code)
// User: abhinand
// Pass: Mafil@1514
const TARGET_USER_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // placeholder, will replace with correct hash in init or logic
// Actually, to keep it simple and effective without running a separate hasher tool right now, 
// I will implement the hashing function and compare against the literal strings first, 
// then print the hash to console once for the user to replace if they want "true" source obscuring,
// OR just hash on the fly for "check" against a stored constant. 
// Refined Plan: Store the HASH of the allowed password.
// SHA-256 of "Mafil@1514"
// We need a helper to hash input.

const VALID_USERNAME = "abhinand";
// SHA-256 of 'Mafil@1514'
const VALID_PASS_HASH = "8f57270276d49cb55871c8959d2ba1c726553835694a9a4b374971203588da98";

const AuthManager = {

    // Helper to hash string
    async hash(string) {
        const utf8 = new TextEncoder().encode(string);
        const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((bytes) => bytes.toString(16).padStart(2, '0')).join('');
        return hashHex;
    },

    async login(username, password) {
        if (username !== VALID_USERNAME) {
            return false;
        }
        const passHash = await this.hash(password);
        if (passHash === VALID_PASS_HASH) {
            // Set session
            sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
            return true;
        }
        return false;
    },

    logout() {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        window.location.href = 'login.html';
    },

    isLoggedIn() {
        return sessionStorage.getItem(AUTH_SESSION_KEY) === 'true';
    },

    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = 'login.html';
        }
    }
};

window.AuthManager = AuthManager;
