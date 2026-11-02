// K3L Rentals - Admin Authentication
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

const adminLoginForm = document.getElementById("adminLoginForm");
const message = document.getElementById("message");

if (adminLoginForm) {
    adminLoginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const submitButton = adminLoginForm.querySelector('button[type="submit"]');

        if (submitButton) {
            submitButton.disabled = true;
        }

        message.textContent = "Verifying admin credentials...";
        message.style.color = "black";

        try {
            // STEP 1: Firebase Authentication
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // STEP 2: Check trusted admin document in Firestore
            const adminDoc = await db.collection("admins").doc(user.uid).get();

            // STEP 3: Reject normal customers
            if (!adminDoc.exists) {
                await auth.signOut();
                localStorage.removeItem("user");

                message.textContent = "Access denied. This account does not have administrative privileges.";
                message.style.color = "red";
                return;
            }

            // STEP 4: Store trusted session information
            const adminData = {
                uid: user.uid,
                name: user.displayName || adminDoc.data()?.name || "Admin",
                email: user.email,
                role: "admin"
            };

            localStorage.setItem("user", JSON.stringify(adminData));

            // STEP 5: Successful login
            message.textContent = "Admin authenticated successfully! Redirecting...";
            message.style.color = "green";

            setTimeout(function () {
                window.location.href = "admin-dashboard.html";
            }, 600);

        } catch (error) {
            console.error("Admin login error:", error);

            const errorMessages = {
                "auth/invalid-email": "Please enter a valid email address.",
                "auth/user-not-found": "No registered admin account found with this email.",
                "auth/wrong-password": "Incorrect password.",
                "auth/invalid-credential": "Invalid email or password.",
                "auth/too-many-requests": "Too many failed attempts. Please try again later.",
                "permission-denied": "Permission denied by Firestore rules. Admin access cannot be verified."
            };

            message.textContent = errorMessages[error.code] || (error.message || "Admin login failed.");
            message.style.color = "red";

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
}

// Check if already authenticated as admin
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        if (user) {
            try {
                const adminDoc = await db.collection("admins").doc(user.uid).get();
                if (adminDoc.exists) {
                    window.location.href = "admin-dashboard.html";
                }
            } catch (e) {
                console.warn("Existing admin session check note:", e);
            }
        }
    });
}
