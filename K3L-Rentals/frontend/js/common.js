// K3L Rentals - Common Utilities and Navbar State Manager
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

// Get logged-in user from localStorage
function getUser() {
    const user = localStorage.getItem("user");
    if (!user) return null;
    try {
        return JSON.parse(user);
    } catch (error) {
        return null;
    }
}

// Check Firebase login session
function isLoggedIn() {
    return !!(auth && auth.currentUser);
}

// Logout using Firebase
async function logout() {
    try {
        if (auth) {
            await auth.signOut();
        }
        localStorage.removeItem("user");
        window.location.href = "index.html";
    } catch (error) {
        console.error("Logout error:", error);
        alert("Unable to logout. Please try again.");
    }
}

// Format INR currency
function formatINR(amount) {
    const num = Number(amount || 0);
    return "₹" + num.toLocaleString("en-IN");
}

// Escape HTML utility
function escapeHTML(str) {
    return String(str || "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

// Update navbar based on auth state
function updateNavbar() {
    const loginLink = document.getElementById("loginLink");
    const registerLink = document.getElementById("registerLink");
    const logoutBtn = document.getElementById("logoutBtn");
    const bookingsLink = document.getElementById("bookingsLink");
    const userGreeting = document.getElementById("userGreeting");

    if (!auth) return;

    auth.onAuthStateChanged(function (user) {
        const loggedIn = !!user;

        if (loginLink) {
            loginLink.classList.toggle("hidden", loggedIn);
            if (loggedIn) loginLink.style.display = "none";
            else loginLink.style.display = "";
        }

        if (registerLink) {
            registerLink.classList.toggle("hidden", loggedIn);
            if (loggedIn) registerLink.style.display = "none";
            else registerLink.style.display = "";
        }

        if (bookingsLink) {
            bookingsLink.classList.toggle("hidden", !loggedIn);
            if (!loggedIn) bookingsLink.style.display = "none";
            else bookingsLink.style.display = "";
        }

        if (logoutBtn) {
            logoutBtn.classList.toggle("hidden", !loggedIn);
            if (!loggedIn) logoutBtn.style.display = "none";
            else logoutBtn.style.display = "";
            logoutBtn.onclick = logout;
        }

        if (userGreeting) {
            if (loggedIn) {
                userGreeting.style.display = "";
                userGreeting.textContent = user.displayName ? `Hi, ${user.displayName.split(" ")[0]}` : user.email.split("@")[0];
            } else {
                userGreeting.style.display = "none";
            }
        }

        if (!loggedIn) {
            localStorage.removeItem("user");
        }
    });
}

// Run after page loads
document.addEventListener("DOMContentLoaded", updateNavbar);
