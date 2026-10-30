
const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;

    if (!name || !email || !phone || !password) {
        message.textContent = "Please fill in all fields.";
        message.style.color = "red";
        return;
    }

    if (password.length < 6) {
        message.textContent = "Password must be at least 6 characters.";
        message.style.color = "red";
        return;
    }

    message.textContent = "Creating account...";
    message.style.color = "black";

    const submitButton = registerForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.disabled = true;
    }

    let user = null;

    try {
        // Create account using Firebase Authentication
        const userCredential =
            await firebase.auth().createUserWithEmailAndPassword(
                email,
                password
            );

        user = userCredential.user;

        // Save customer details in Firestore
        await firebase.firestore()
            .collection("users")
            .doc(user.uid)
            .set({
                name: name,
                email: email,
                phone: phone,
                role: "customer",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        // Update Firebase profile
        await user.updateProfile({
            displayName: name
        });

        message.textContent = "Registration successful!";
        message.style.color = "green";

        registerForm.reset();

        setTimeout(function () {
            window.location.href = "login.html";
        }, 1000);

    } catch (error) {
        console.error("Registration error:", error);

        // Remove partially created account if profile creation failed
        if (user) {
            try {
                await user.delete();
            } catch (deleteError) {
                console.error(
                    "Account cleanup failed:",
                    deleteError
                );
            }
        }

        if (error.code === "auth/email-already-in-use") {
            message.textContent =
                "This email is already registered.";

        } else if (error.code === "auth/weak-password") {
            message.textContent =
                "Password must be at least 6 characters.";

        } else if (error.code === "auth/invalid-email") {
            message.textContent =
                "Please enter a valid email address.";

        } else if (
            error.code === "permission-denied" ||
            error.code === "firestore/permission-denied"
        ) {
            message.textContent =
                "Unable to save customer details. Check Firestore rules.";

        } else {
            message.textContent =
                "Registration failed. Please try again.";
        }

        message.style.color = "red";

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
});
