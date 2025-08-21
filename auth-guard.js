// This script will "guard" your pages, redirecting any user who is not logged in.

// IMPORTANT: You must import the Firebase SDKs in the HTML file *before* you import this script.
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth();

onAuthStateChanged(auth, (user) => {
    if (!user) {
        // No user is signed in.
        console.log("Auth Guard: No user found. Redirecting to login page.");
        // Redirect them to the login page
        window.location.href = 'login.html';
    } else {
        // User is signed in.
        console.log(`Auth Guard: User ${user.uid} is authenticated. Access granted.`);
        // You can optionally make the main content visible here if you hide it by default
        // to prevent a "flash" of content before the check runs.
        // For example: document.body.style.display = 'block';
    }
});
