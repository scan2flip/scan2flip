// This script will "guard" your pages, redirecting any user who is not logged in.

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBoQwuUzYaa5fyklCn0Nh21unRmEGa4GuM",
    authDomain: "scan2flip-41afe.firebaseapp.com",
    projectId: "scan2flip-41afe",
    storageBucket: "scan2flip-41afe.firebasestorage.app",
    messagingSenderId: "747191811793",
    appId: "1:747191811793:web:e9d935f1a55c66fb7e4ff0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

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
