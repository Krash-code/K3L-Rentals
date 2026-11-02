const API_KEY = "AIzaSyDcVHD6NXM2MNkiNBlOR6ovdRg_OiHTdsU";
const PROJECT_ID = "k3l-rentals-13ff0";
const REFERER = "https://k3l-rentals-13ff0.web.app/";

const AUTH_SIGNIN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const AUTH_DELETE_URL = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const testAccounts = [
    { email: "qa_cust2_1793625356561@k3lrentals.com", pass: "Pass@2026", uid: "N1WpD9xlunOGXdvVvWwAwWfafDr1" },
    { email: "cust_audit_1793624207681@k3lrentals.com", pass: "AuditPass@2026", uid: "WKIHLfzgGlXsQ5YFgUnUjYcAWvl1" },
    { email: "qa_test_1793625353595@k3lrentals.com", pass: "SecurePass@2026", uid: "kakbc6ULNAMtbtbGu9WJnQMluRj1" }
];

async function cleanup() {
    console.log("=== K3L RENTALS -- TEST DATA CLEANUP EXECUTION ===");

    for (const acc of testAccounts) {
        console.log(`\nProcessing candidate: ${acc.email} (${acc.uid})`);

        // 1. Authenticate
        const loginRes = await fetch(AUTH_SIGNIN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Referer": REFERER },
            body: JSON.stringify({ email: acc.email, password: acc.pass, returnSecureToken: true })
        });
        const loginData = await loginRes.json();

        if (!loginData.idToken) {
            console.log(`  Login failed or account already removed: ${JSON.stringify(loginData.error?.message)}`);
            continue;
        }

        const token = loginData.idToken;
        console.log(`  Authenticated successfully. Deleting user profile in Firestore...`);

        // 2. Delete Firestore user profile
        const delProfileRes = await fetch(`${FIRESTORE_BASE}/users/${acc.uid}?key=${API_KEY}`, {
            method: "DELETE",
            headers: { "Referer": REFERER, "Authorization": `Bearer ${token}` }
        });
        console.log(`  Firestore profile deletion: HTTP ${delProfileRes.status}`);

        // 3. Delete from Firebase Authentication
        const delAuthRes = await fetch(AUTH_DELETE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Referer": REFERER },
            body: JSON.stringify({ idToken: token })
        });
        console.log(`  Firebase Auth account deletion: HTTP ${delAuthRes.status}`);
    }

    console.log("\n=== CLEANUP FINISHED ===");
}

cleanup().catch(console.error);

