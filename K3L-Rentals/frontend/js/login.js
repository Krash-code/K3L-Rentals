// K3L Rentals - Customer Authentication & Email Verification Handler
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginBtn = document.getElementById("loginBtn");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const verificationBanner = document.getElementById("verificationBanner");
const resendVerificationBtn = document.getElementById("resendVerificationBtn");
const resendStatus = document.getElementById("resendStatus");

let currentUnverifiedUser = null;

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;

        if (!email || !password) {
            showError("Please enter your email address and password.");
            return;
        }

        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = "Authenticating...";
        }
        message.innerHTML = "";
        if (verificationBanner) verificationBanner.style.display = "none";

        try {
            // STEP 1: Firebase Authentication login
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // STEP 2: Verify registered customer profile in Firestore
            const profileDoc = await firebase.firestore()
                .collection("users")
                .doc(user.uid)
                .get();

            // Check if account is actually an administrator
            if (!profileDoc.exists) {
                const adminDoc = await firebase.firestore()
                    .collection("admins")
                    .doc(user.uid)
                    .get();

                if (adminDoc.exists) {
                    await firebase.auth().signOut();
                    localStorage.removeItem("user");
                    showError("This is an administrator account. Please use the Admin Login Portal to access your dashboard.");
                    setTimeout(() => {
                        window.location.href = "admin-login.html";
                    }, 1800);
                    return;
                }

                // If neither customer profile nor admin record exists:
                // NEVER automatically create an account during login!
                await firebase.auth().signOut();
                localStorage.removeItem("user");
                showError("No customer profile found for this account. Your registration is incomplete or does not exist. Please register as a new customer.");
                return;
            }

            const userData = profileDoc.data();

            // Safety check: If a role is marked admin in customer doc, redirect to admin portal
            if (userData.role === "admin") {
                await firebase.auth().signOut();
                localStorage.removeItem("user");
                showError("Administrative accounts must sign in via the Admin Login Portal.");
                setTimeout(() => {
                    window.location.href = "admin-login.html";
                }, 1800);
                return;
            }

            // Sync emailVerified flag in Firestore if it became true in Firebase Auth
            if (user.emailVerified && !userData.emailVerified) {
                await firebase.firestore().collection("users").doc(user.uid).update({
                    emailVerified: true
                }).catch(console.warn);
            }

            // Inform user if email is unverified (email verification gate)
            if (!user.emailVerified) {
                currentUnverifiedUser = user;
                if (verificationBanner) {
                    verificationBanner.style.display = "block";
                }
            }

            // Save verified user session in localStorage
            localStorage.setItem("user", JSON.stringify({
                uid: user.uid,
                name: userData.name || user.displayName || user.email.split("@")[0],
                email: user.email,
                role: "customer",
                emailVerified: user.emailVerified
            }));

            message.innerHTML = `
                <div style="background: #ecfdf5; border: 1px solid #10b981; color: #065f46; padding: 12px; border-radius: 8px; font-size: 0.92rem;">
                    ✓ Login successful! Redirecting to fleet catalog...
                </div>
            `;

            setTimeout(function () {
                window.location.href = "vehicles.html";
            }, 600);

        } catch (error) {
            console.error("Login error:", error);

            if (
                error.code === "auth/invalid-credential" ||
                error.code === "auth/wrong-password" ||
                error.code === "auth/user-not-found"
            ) {
                showError("Invalid email or password. If you have not registered for an account yet, please click 'Register here' below.");
            } else if (error.code === "auth/invalid-email") {
                showError("Please enter a valid email address.");
            } else if (error.code === "auth/too-many-requests") {
                showError("Too many unsuccessful attempts. Access temporarily restricted for security. Please try again shortly.");
            } else if (error.code === "auth/user-disabled") {
                showError("This account has been disabled. Please contact support.");
            } else {
                showError(error.message || "Login failed. Please try again.");
            }
        } finally {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = "Sign In";
            }
        }
    });
}

// Resend Verification Email Button
if (resendVerificationBtn) {
    resendVerificationBtn.addEventListener("click", async function () {
        const user = currentUnverifiedUser || firebase.auth().currentUser;
        if (!user) {
            alert("Please enter your credentials and sign in first to request a verification email.");
            return;
        }

        resendVerificationBtn.disabled = true;
        resendStatus.textContent = "Sending link...";
        try {
            await user.sendEmailVerification();
            resendStatus.textContent = "✓ Verification link sent! Check your inbox/spam.";
            resendStatus.style.color = "#065f46";
        } catch (err) {
            console.error("Error sending verification email:", err);
            resendStatus.textContent = "Could not send link: " + (err.message || "Rate limit reached.");
            resendStatus.style.color = "#991b1b";
        } finally {
            setTimeout(() => {
                resendVerificationBtn.disabled = false;
            }, 5000);
        }
    });
}

// Forgot Password handler
if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", async function (e) {
        e.preventDefault();
        const emailInput = document.getElementById("email");
        let targetEmail = emailInput ? emailInput.value.trim().toLowerCase() : "";

        if (!targetEmail) {
            targetEmail = prompt("Please enter your registered email address to receive a password reset link:");
            if (!targetEmail) return;
            targetEmail = targetEmail.trim().toLowerCase();
        }

        try {
            await firebase.auth().sendPasswordResetEmail(targetEmail);
            alert(`A password reset link has been dispatched to ${targetEmail}. Please check your inbox and spam folder.`);
        } catch (err) {
            console.error("Password reset error:", err);
            if (err.code === "auth/user-not-found") {
                alert("No account found with this email address.");
            } else if (err.code === "auth/invalid-email") {
                alert("Please enter a valid email address.");
            } else {
                alert("Could not send password reset email: " + err.message);
            }
        }
    });
}

function showError(msg) {
    message.innerHTML = `
        <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px; border-radius: 8px; font-size: 0.9rem;">
            ⚠️ <strong>Login Error:</strong> ${escapeHTML(msg)}
        </div>
    `;
}

function escapeHTML(str) {
    return String(str || "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

// Clear stale phantom sessions or redirect valid active customers
if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(async function (user) {
        if (user) {
            try {
                const profileDoc = await firebase.firestore().collection("users").doc(user.uid).get();
                if (profileDoc.exists) {
                    window.location.href = "vehicles.html";
                } else {
                    // Stale or deleted session
                    await firebase.auth().signOut();
                    localStorage.removeItem("user");
                }
            } catch (e) {
                console.warn("Session check note:", e);
            }
        }
    });
}
