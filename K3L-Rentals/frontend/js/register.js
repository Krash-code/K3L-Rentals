// K3L Rentals - Customer Registration with Age 18+ Gate & Email Verification
const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");
const dobInput = document.getElementById("dob");
const submitBtn = document.getElementById("submitBtn");

// Utility: Calculate exact age in years from YYYY-MM-DD
function calculateExactAge(dobString) {
    if (!dobString) return -1;
    const dob = new Date(dobString + "T00:00:00");
    if (Number.isNaN(dob.getTime())) return -1;

    const today = new Date();
    // Reject future dates
    if (dob > today) return -1;

    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
}

// Automatically enforce 18+ max date constraint in HTML date picker
if (dobInput) {
    const today = new Date();
    const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    const maxDateStr = eighteenYearsAgo.toISOString().split("T")[0];
    dobInput.max = maxDateStr;

    function handleDobChange() {
        const val = dobInput.value;
        if (!val) {
            message.innerHTML = "";
            if (submitBtn) submitBtn.disabled = false;
            return;
        }
        const age = calculateExactAge(val);
        if (age < 18) {
            message.innerHTML = `
                <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px; border-radius: 8px; font-size: 0.95rem; font-weight: 600;">
                    ⚠️ You are not eligible to register. You must be 18 or older.
                </div>
            `;
            if (submitBtn) submitBtn.disabled = true;
        } else {
            message.innerHTML = `
                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 10px 14px; border-radius: 6px; font-size: 0.9rem;">
                    ✓ Age verified: ${age} years old.
                </div>
            `;
            if (submitBtn) submitBtn.disabled = false;
        }
    }

    dobInput.addEventListener("change", handleDobChange);
    dobInput.addEventListener("input", handleDobChange);
}

if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const phone = document.getElementById("phone").value.trim();
        const dob = document.getElementById("dob").value;
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        // Reset message container
        message.innerHTML = "";

        // 1. Basic field presence
        if (!name || !email || !phone || !dob || !password || !confirmPassword) {
            showError("Please fill in all required fields.");
            return;
        }

        // 2. Name validation
        if (name.length < 2) {
            showError("Please enter your full legal name (at least 2 characters).");
            return;
        }

        // 3. Indian Phone validation (10 digits starting 6-9)
        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            showError("Please enter a valid 10-digit Indian mobile number (starting with 6, 7, 8, or 9).");
            return;
        }

        // 4. Exact Age 18+ validation (reject under-18, future dates, and invalid dates)
        const exactAge = calculateExactAge(dob);
        if (exactAge < 18) {
            showError("You are not eligible to register. You must be 18 or older.");
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Create Account & Send Verification Email";
            }
            return;
        }

        // 5. Password length & match
        if (password.length < 6) {
            showError("Password must be at least 6 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            showError("Passwords do not match. Please re-enter.");
            return;
        }

        // Disable button during creation
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Creating Account & Sending Email...";
        }

        // Set registration flag before ANY auth calls so common.js doesn't sign out mid-creation
        window.isRegistrationInProgress = true;
        sessionStorage.setItem("k3l_registration_in_progress", "true");

        let user = null;

        try {
            // A. Create account in Firebase Authentication
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            user = userCredential.user;

            // B. Update Firebase Auth Display Name
            await user.updateProfile({
                displayName: name
            });

            // C. Save Customer Profile to Firestore /users/{uid} using exact authenticated UID
            await firebase.firestore().collection("users").doc(user.uid).set({
                name: name,
                email: email,
                phone: phone,
                dob: dob,
                age: exactAge,
                role: "customer",
                kyc_status: "Not Submitted",
                emailVerified: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // D. Send Email Verification link to user's registered inbox
            await user.sendEmailVerification();

            // Clear registration flag
            window.isRegistrationInProgress = false;
            sessionStorage.removeItem("k3l_registration_in_progress");

            // E. Show Success Message with Instructions
            message.innerHTML = `
                <div style="background: #ecfdf5; border: 1px solid #10b981; color: #065f46; padding: 18px; border-radius: 10px; margin-top: 10px;">
                    <h3 style="margin-bottom: 8px; font-size: 1.15rem; color: #065f46;">🎉 Registration Successful!</h3>
                    <p style="margin-bottom: 10px; font-size: 0.92rem;">
                        We have sent a verification email to <strong>${escapeHTML(email)}</strong>.
                    </p>
                    <p style="font-size: 0.88rem; color: #047857; margin-bottom: 14px;">
                        <strong>Next Step:</strong> Please open your email inbox (or spam folder), click the verification link, and then proceed to login. Vehicle reservations require a verified email.
                    </p>
                    <a href="login.html" class="primary-btn" style="display: inline-block; padding: 10px 20px; font-size: 0.95rem; text-decoration: none;">
                        Proceed to Login →
                    </a>
                </div>
            `;

            registerForm.reset();
            // Automatically sign out so user cannot act as logged in without logging in after verification
            await firebase.auth().signOut();
            localStorage.removeItem("user");

        } catch (error) {
            console.error("Registration failed:", error);
            window.isRegistrationInProgress = false;
            sessionStorage.removeItem("k3l_registration_in_progress");

            // If account already exists in Auth, check if it was an orphaned account with missing profile
            if (error.code === "auth/email-already-in-use") {
                try {
                    window.isRegistrationInProgress = true;
                    sessionStorage.setItem("k3l_registration_in_progress", "true");
                    const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
                    const recoveredUser = cred.user;
                    const prof = await firebase.firestore().collection("users").doc(recoveredUser.uid).get();

                    if (!prof.exists) {
                        console.log("Resuming interrupted profile creation for UID:", recoveredUser.uid);
                        await recoveredUser.updateProfile({ displayName: name });
                        await firebase.firestore().collection("users").doc(recoveredUser.uid).set({
                            name: name,
                            email: email,
                            phone: phone,
                            dob: dob,
                            age: exactAge,
                            role: "customer",
                            kyc_status: "Not Submitted",
                            emailVerified: false,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        await recoveredUser.sendEmailVerification();
                        window.isRegistrationInProgress = false;
                        sessionStorage.removeItem("k3l_registration_in_progress");

                        message.innerHTML = `
                            <div style="background: #ecfdf5; border: 1px solid #10b981; color: #065f46; padding: 18px; border-radius: 10px; margin-top: 10px;">
                                <h3 style="margin-bottom: 8px; font-size: 1.15rem; color: #065f46;">🎉 Registration Profile Completed!</h3>
                                <p style="margin-bottom: 10px; font-size: 0.92rem;">
                                    Your customer profile was successfully created and a verification email sent to <strong>${escapeHTML(email)}</strong>.
                                </p>
                                <p style="font-size: 0.88rem; color: #047857; margin-bottom: 14px;">
                                    <strong>Next Step:</strong> Please check your email, click the verification link, and then proceed to login.
                                </p>
                                <a href="login.html" class="primary-btn" style="display: inline-block; padding: 10px 20px; font-size: 0.95rem; text-decoration: none;">
                                    Proceed to Login →
                                </a>
                            </div>
                        `;
                        registerForm.reset();
                        await firebase.auth().signOut();
                        localStorage.removeItem("user");
                        return;
                    } else {
                        await firebase.auth().signOut();
                    }
                } catch (recErr) {
                    console.warn("Orphan recovery attempt notice:", recErr);
                    await firebase.auth().signOut().catch(() => {});
                } finally {
                    window.isRegistrationInProgress = false;
                    sessionStorage.removeItem("k3l_registration_in_progress");
                }
                showError("This email address is already registered. Please login or reset your password.");
            } else {
                // Rollback partial Auth record if Firestore creation or email verification threw
                if (user) {
                    try {
                        await user.delete();
                        console.log("Rolled back unprofiled Auth user:", user.uid);
                    } catch (cleanupErr) {
                        console.warn("Could not rollback partial auth user:", cleanupErr);
                        await firebase.auth().signOut().catch(() => {});
                    }
                }

                if (error.code === "auth/invalid-email") {
                    showError("The email address format is invalid. Please check.");
                } else if (error.code === "auth/weak-password") {
                    showError("Password is too weak. Please use at least 6 characters with mixed letters and numbers.");
                } else if (error.code === "permission-denied") {
                    showError(`Permission Denied [${error.code}]: Could not save customer profile to Firestore. ${error.message || ""}`);
                } else {
                    showError(`Registration Error [${error.code || 'unknown'}]: ${error.message || "Registration failed. Please try again."}`);
                }
            }

            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Create Account & Send Verification Email";
            }
        }
    });
}

function showError(msg) {
    message.innerHTML = `
        <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px; border-radius: 8px; font-size: 0.9rem;">
            ⚠️ <strong>Error:</strong> ${escapeHTML(msg)}
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
