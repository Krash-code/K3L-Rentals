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
            // Firebase Authentication login
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Fetch customer profile from Firestore
            const profileDoc = await firebase.firestore()
                .collection("users")
                .doc(user.uid)
                .get();

            let userData = {};
            if (!profileDoc.exists) {
                userData = {
                    name: user.displayName || user.email.split("@")[0],
                    email: user.email,
                    phone: "",
                    role: "customer",
                    emailVerified: user.emailVerified
                };
                await firebase.firestore().collection("users").doc(user.uid).set({
                    ...userData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                userData = profileDoc.data();
                // Sync emailVerified flag in Firestore if it became true
                if (user.emailVerified && !userData.emailVerified) {
                    await firebase.firestore().collection("users").doc(user.uid).update({
                        emailVerified: true
                    }).catch(console.warn);
                }
            }

            // Check if email is verified
            if (!user.emailVerified) {
                currentUnverifiedUser = user;
                if (verificationBanner) {
                    verificationBanner.style.display = "block";
                }
            }

            // Save user session in localStorage
            localStorage.setItem("user", JSON.stringify({
                uid: user.uid,
                name: userData.name || user.displayName || user.email.split("@")[0],
                email: user.email,
                role: userData.role || "customer",
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
                showError("Incorrect email or password. Please verify your credentials.");
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
