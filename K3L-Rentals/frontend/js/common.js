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
    const kycLink = document.getElementById("kycLink");
    const userGreeting = document.getElementById("userGreeting");

    function renderNav(loggedIn, name = "") {
        if (loginLink) {
            loginLink.classList.toggle("hidden", loggedIn);
            loginLink.style.display = loggedIn ? "none" : "";
        }
        if (registerLink) {
            registerLink.classList.toggle("hidden", loggedIn);
            registerLink.style.display = loggedIn ? "none" : "";
        }
        if (bookingsLink) {
            bookingsLink.classList.toggle("hidden", !loggedIn);
            bookingsLink.style.display = !loggedIn ? "none" : "";
        }
        if (kycLink) {
            kycLink.classList.toggle("hidden", !loggedIn);
            kycLink.style.display = !loggedIn ? "none" : "";
        }
        if (logoutBtn) {
            logoutBtn.classList.toggle("hidden", !loggedIn);
            logoutBtn.style.display = !loggedIn ? "none" : "";
            logoutBtn.onclick = logout;
        }
        if (userGreeting) {
            if (loggedIn && name) {
                userGreeting.style.display = "";
                userGreeting.textContent = `Hi, ${name}`;
            } else {
                userGreeting.style.display = "none";
                userGreeting.textContent = "";
            }
        }
    }

    if (!auth) return;

    auth.onAuthStateChanged(async function (user) {
        if (!user) {
            localStorage.removeItem("user");
            renderNav(false);
            return;
        }

        try {
            // Verify Firestore profile existence to reject phantom/deleted sessions
            const firestore = db || (typeof firebase !== "undefined" ? firebase.firestore() : null);
            if (firestore) {
                // Determine if registration is actively in progress
                const isRegistering = (
                    window.isRegistrationInProgress === true ||
                    sessionStorage.getItem("k3l_registration_in_progress") === "true" ||
                    window.location.pathname.endsWith("register.html") ||
                    (user.metadata && user.metadata.creationTime && (Date.now() - new Date(user.metadata.creationTime).getTime() < 60000))
                );

                const [userDoc, adminDoc] = await Promise.all([
                    firestore.collection("users").doc(user.uid).get().catch(() => ({ exists: false })),
                    firestore.collection("admins").doc(user.uid).get().catch(() => ({ exists: false }))
                ]);

                if (!userDoc.exists && !adminDoc.exists) {
                    if (isRegistering) {
                        // Legitimate registration in progress: profile document is actively being created by register.js.
                        // Do NOT sign out or destroy the session.
                        console.log("Registration in progress for UID:", user.uid, "- deferring session validation.");
                        return;
                    }
                    console.warn("Invalid session: No customer or admin document found for UID:", user.uid);
                    await auth.signOut();
                    localStorage.removeItem("user");
                    renderNav(false);
                    return;
                }

                const profile = userDoc.exists ? userDoc.data() : adminDoc.data();
                const isAdmin = adminDoc.exists || profile.role === "admin";
                const displayName = (profile.name || user.displayName || user.email.split("@")[0]).split(" ")[0];

                renderNav(true, displayName);

                localStorage.setItem("user", JSON.stringify({
                    uid: user.uid,
                    name: profile.name || user.displayName || user.email.split("@")[0],
                    email: user.email,
                    role: isAdmin ? "admin" : "customer",
                    emailVerified: user.emailVerified
                }));
            } else {
                const displayName = (user.displayName || user.email.split("@")[0]).split(" ")[0];
                renderNav(true, displayName);
            }
        } catch (err) {
            console.warn("Navbar auth verification notice:", err);
            renderNav(true, (user.displayName || user.email.split("@")[0]).split(" ")[0]);
        }
    });
}

// Run after page loads
document.addEventListener("DOMContentLoaded", updateNavbar);
