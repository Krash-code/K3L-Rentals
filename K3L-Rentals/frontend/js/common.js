
// Get logged-in user
function getUser() {
    const user = localStorage.getItem("user");

    if (!user) {
        return null;
    }

    try {
        return JSON.parse(user);
    } catch (error) {
        return null;
    }
}


// Check Firebase login session
function isLoggedIn() {
    return !!(
        typeof firebase !== "undefined" &&
        firebase.auth().currentUser
    );
}


// Logout using Firebase
async function logout() {
    try {
        await firebase.auth().signOut();

        localStorage.removeItem("user");

        window.location.href = "index.html";

    } catch (error) {
        console.error("Logout error:", error);
        alert("Unable to logout. Please try again.");
    }
}


// Update navbar
function updateNavbar() {

    const loginLink = document.getElementById("loginLink");
    const registerLink = document.getElementById("registerLink");
    const logoutBtn = document.getElementById("logoutBtn");
    const bookingsLink = document.getElementById("bookingsLink");

    // Firebase authentication session
    firebase.auth().onAuthStateChanged(function (user) {

        const loggedIn = !!user;

        // Login link
        if (loginLink) {
            loginLink.classList.toggle("hidden", loggedIn);
        }

        // Register link
        if (registerLink) {
            registerLink.classList.toggle("hidden", loggedIn);
        }

        // My bookings link
        if (bookingsLink) {
            bookingsLink.classList.toggle("hidden", !loggedIn);
        }

        // Logout button
        if (logoutBtn) {
            logoutBtn.classList.toggle("hidden", !loggedIn);
            logoutBtn.onclick = logout;
        }

        // Keep local user information in sync
        if (!loggedIn) {
            localStorage.removeItem("user");
        }
    });
}


// Run after page loads
document.addEventListener("DOMContentLoaded", updateNavbar);
