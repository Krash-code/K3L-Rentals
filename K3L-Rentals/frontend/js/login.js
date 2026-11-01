// K3L Rentals - Customer Authentication
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const submitButton = loginForm.querySelector('button[type="submit"]');

        if (!email || !password) {
            message.textContent = "Please enter email and password.";
            message.style.color = "red";
            return;
        }

        message.textContent = "Logging in...";
        message.style.color = "black";

        if (submitButton) {
            submitButton.disabled = true;
        }

        try {
            // Firebase login
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Get customer profile from Firestore
            const profile = await firebase.firestore()
                .collection("users")
                .doc(user.uid)
                .get();

            let userData = {};
            if (!profile.exists) {
                // Self-heal profile if missing
                userData = {
                    name: user.displayName || user.email.split("@")[0],
                    email: user.email,
                    phone: "",
                    role: "customer"
                };
                await firebase.firestore().collection("users").doc(user.uid).set({
                    ...userData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                userData = profile.data();
            }

            // Save user session in localStorage
            localStorage.setItem("user", JSON.stringify({
                uid: user.uid,
                name: userData.name || user.displayName || "",
                email: user.email,
                role: userData.role || "customer"
            }));

            message.textContent = "Login successful!";
            message.style.color = "green";

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
                message.textContent = "Incorrect email or password. Please try again.";
            } else if (error.code === "auth/too-many-requests") {
                message.textContent = "Too many attempts. Please wait and try again.";
            } else if (
                error.code === "permission-denied" ||
                error.code === "firestore/permission-denied"
            ) {
                message.textContent = "Unable to access your profile. Check Firestore rules.";
            } else {
                message.textContent = error.message || "Login failed. Please try again.";
            }

            message.style.color = "red";

        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
}
