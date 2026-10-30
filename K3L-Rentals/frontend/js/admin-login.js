
const auth = firebase.auth();
const db = firebase.firestore();

const adminLoginForm = document.getElementById("adminLoginForm");
const message = document.getElementById("message");

adminLoginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const submitButton = adminLoginForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.disabled = true;
    }

    message.textContent = "Checking admin credentials...";
    message.style.color = "black";

    try {
        // STEP 1: Firebase Authentication
        const userCredential = await auth.signInWithEmailAndPassword(
            email,
            password
        );

        const user = userCredential.user;

        // STEP 2: Check trusted admin document in Firestore
        const adminDoc = await db
            .collection("admins")
            .doc(user.uid)
            .get();

        // STEP 3: Reject normal customers
        if (!adminDoc.exists) {
            await auth.signOut();
            localStorage.removeItem("user");

            message.textContent =
                "Access denied. Admin account required.";

            message.style.color = "red";
            return;
        }

        // STEP 4: Store basic session information
        const adminData = {
            uid: user.uid,
            name: user.displayName || "Admin",
            email: user.email,
            role: "admin"
        };

        localStorage.setItem("user", JSON.stringify(adminData));

        // STEP 5: Successful login
        message.textContent = "Admin login successful!";
        message.style.color = "green";

        setTimeout(function () {
            window.location.href = "admin-dashboard.html";
        }, 700);

    } catch (error) {
        console.error("Admin login error:", error);

        const errorMessages = {
            "auth/invalid-email": "Please enter a valid email address.",
            "auth/user-not-found": "No account found with this email.",
            "auth/wrong-password": "Incorrect password.",
            "auth/invalid-credential": "Invalid email or password.",
            "auth/too-many-requests": "Too many attempts. Try again later.",
            "permission-denied": "Unable to verify admin access. Check Firestore rules."
        };

        message.textContent =
            errorMessages[error.code] ||
            "Admin login failed. Please try again.";

        message.style.color = "red";

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
});
