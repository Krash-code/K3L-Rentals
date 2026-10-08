const API_URL = "http://localhost:3000/api";


// Get JWT token
function getToken() {
    return localStorage.getItem("token");
}


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


// Check login
function isLoggedIn() {
    return !!getToken();
}


// Logout
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.href = "index.html";
}


// Update navbar
function updateNavbar() {

    const loginLink = document.getElementById("loginLink");
    const registerLink = document.getElementById("registerLink");
    const logoutBtn = document.getElementById("logoutBtn");
    const bookingsLink = document.getElementById("bookingsLink");

    const loggedIn = isLoggedIn();


    // Login
    if (loginLink) {

        if (loggedIn) {
            loginLink.classList.add("hidden");
        } else {
            loginLink.classList.remove("hidden");
        }
    }


    // Register
    if (registerLink) {

        if (loggedIn) {
            registerLink.classList.add("hidden");
        } else {
            registerLink.classList.remove("hidden");
        }
    }


    // My bookings
    if (bookingsLink) {

        if (loggedIn) {
            bookingsLink.classList.remove("hidden");
        } else {
            bookingsLink.classList.add("hidden");
        }
    }


    // Logout
    if (logoutBtn) {

        if (loggedIn) {
            logoutBtn.classList.remove("hidden");
        } else {
            logoutBtn.classList.add("hidden");
        }

        logoutBtn.onclick = logout;
    }
}


document.addEventListener(
    "DOMContentLoaded",
    updateNavbar
);