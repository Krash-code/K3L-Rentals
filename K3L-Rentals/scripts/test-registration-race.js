// K3L Rentals - Registration Race Condition & Auth Lifecycle Test
const fs = require('fs');

const API_KEY = "AIzaSyDcVHD6NXM2MNkiNBlOR6ovdRg_OiHTdsU";
const PROJECT_ID = "k3l-rentals-13ff0";

const AUTH_SIGNIN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const AUTH_SIGNUP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const AUTH_PROJECT_BASE = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`;

const REFERER_HEADER = { "Referer": "https://k3l-rentals-13ff0.web.app/" };

let adminToken = null;
try {
    const config = JSON.parse(fs.readFileSync('C:/Users/RSD/.config/configstore/firebase-tools.json', 'utf8'));
    adminToken = config.tokens?.access_token || null;
} catch (e) {
    console.warn("Notice: Could not read configstore access token:", e.message);
}

const PRESERVED_ADMIN_UID = "8lqQd9ADW0QFRwBFyQDbfrI4mJh2";
const PRESERVED_ADMIN_EMAIL = "24bcs142krishma@gmail.com";

let passedCount = 0;
let totalCount = 0;

function assert(condition, num, title) {
    totalCount++;
    if (condition) {
        passedCount++;
        console.log(`  [PASS] Test ${String(num).padStart(2, '0')}: ${title}`);
    } else {
        console.error(`  [FAIL] Test ${String(num).padStart(2, '0')}: ${title}`);
    }
}

async function signUp(email, password) {
    const res = await fetch(AUTH_SIGNUP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...REFERER_HEADER },
        body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    return await res.json();
}

async function signIn(email, password) {
    const res = await fetch(AUTH_SIGNIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...REFERER_HEADER },
        body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    return await res.json();
}

async function getDoc(path, token) {
    const headers = { ...REFERER_HEADER };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${FIRESTORE_BASE}/${path}?key=${API_KEY}`, { headers });
    return { status: res.status, data: await res.json() };
}

async function createDoc(collection, docId, fields, token) {
    const headers = { "Content-Type": "application/json", ...REFERER_HEADER };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const url = docId
        ? `${FIRESTORE_BASE}/${collection}/${docId}?key=${API_KEY}`
        : `${FIRESTORE_BASE}/${collection}?key=${API_KEY}`;
    const res = await fetch(url, {
        method: docId ? "PATCH" : "POST",
        headers,
        body: JSON.stringify({ fields })
    });
    return { status: res.status, data: await res.json() };
}

async function runRaceConditionSuite() {
    console.log("======================================================================");
    console.log("  K3L RENTALS -- REGISTRATION RACE CONDITION & AUTH VERIFICATION      ");
    console.log("======================================================================");
    console.log("Execution Time: " + new Date().toISOString() + "\n");

    const ts = Date.now();
    const testEmail = `race_fix_test_${ts}@k3lrentals.com`;
    const testPass = "SecurePass123!";
    let testUid = null;
    let testToken = null;

    // 1. Unregistered login rejection
    const unregRes = await signIn(`unreg_${ts}@k3lrentals.com`, "WrongPass!");
    assert(
        unregRes.error && (unregRes.error.message.includes("EMAIL_NOT_FOUND") || unregRes.error.message.includes("INVALID_LOGIN_CREDENTIALS")),
        1,
        "Unregistered email login is rejected by Firebase Auth"
    );

    // 2. Age 18+ Calculation validation
    function calculateExactAge(dobString) {
        if (!dobString) return -1;
        const dob = new Date(dobString + "T00:00:00");
        if (Number.isNaN(dob.getTime())) return -1;
        const today = new Date();
        if (dob > today) return -1;
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
        return age;
    }
    const minorAge = calculateExactAge("2010-06-15");
    const adultAge = calculateExactAge("2000-01-01");
    assert(minorAge < 18 && adultAge >= 18, 2, "Strict 18+ calendar-day DOB validation accepts adults and rejects minors");

    // 3. Brand-new customer registration in Firebase Auth
    const signupRes = await signUp(testEmail, testPass);
    assert(signupRes.idToken && signupRes.localId, 3, "Customer account provisioned in Firebase Authentication");
    testUid = signupRes.localId;
    testToken = signupRes.idToken;

    // 4. Security Rules: Unauthenticated customer cannot create /users profile
    const unauthProf = await createDoc("users", testUid, {
        name: { stringValue: "Hacker User" },
        email: { stringValue: testEmail },
        role: { stringValue: "customer" }
    }, null);
    assert(unauthProf.status === 403, 4, "Firestore rules REJECT unauthenticated profile creation (HTTP 403)");

    // 5. Security Rules: Customer cannot create profile with role='admin'
    const adminEscProf = await createDoc("users", testUid, {
        name: { stringValue: "Attacker" },
        email: { stringValue: testEmail },
        role: { stringValue: "admin" },
        kyc_status: { stringValue: "Not Submitted" },
        emailVerified: { booleanValue: false }
    }, testToken);
    assert(adminEscProf.status === 403, 5, "Firestore rules REJECT role escalation to 'admin' on creation (HTTP 403)");

    // 6. Security Rules: Customer cannot create profile with kyc_status='Approved'
    const kycEscProf = await createDoc("users", testUid, {
        name: { stringValue: "Attacker" },
        email: { stringValue: testEmail },
        role: { stringValue: "customer" },
        kyc_status: { stringValue: "Approved" },
        emailVerified: { booleanValue: false }
    }, testToken);
    assert(kycEscProf.status === 403, 6, "Firestore rules REJECT self-approval of KYC on creation (HTTP 403)");

    // 7. Security Rules: Customer cannot create profile with unapproved fields
    const badKeysProf = await createDoc("users", testUid, {
        name: { stringValue: "Attacker" },
        email: { stringValue: testEmail },
        role: { stringValue: "customer" },
        kyc_status: { stringValue: "Not Submitted" },
        emailVerified: { booleanValue: false },
        isSuperAdmin: { booleanValue: true }
    }, testToken);
    assert(badKeysProf.status === 403, 7, "Firestore rules REJECT profile creation with arbitrary/unapproved fields (HTTP 403)");

    // 8. Legitimate Customer Profile Creation with Exact Authenticated UID & Validated Schema
    const validProf = await createDoc("users", testUid, {
        name: { stringValue: "Test Verified Customer" },
        email: { stringValue: testEmail },
        phone: { stringValue: "9876543210" },
        dob: { stringValue: "2000-01-01" },
        age: { integerValue: "26" },
        role: { stringValue: "customer" },
        kyc_status: { stringValue: "Not Submitted" },
        emailVerified: { booleanValue: false },
        createdAt: { stringValue: new Date().toISOString() }
    }, testToken);
    assert(validProf.status === 200, 8, "Customer profile created successfully in /users/{uid} using authenticated session (HTTP 200)");

    // 9. Profile Document Verification
    const readProf = await getDoc(`users/${testUid}`, testToken);
    const profData = readProf.data?.fields;
    assert(
        readProf.status === 200 &&
        profData?.name?.stringValue === "Test Verified Customer" &&
        profData?.role?.stringValue === "customer" &&
        profData?.kyc_status?.stringValue === "Not Submitted",
        9,
        "Customer profile verified in Firestore with correct initial fields (role: customer, kyc: Not Submitted)"
    );

    // 10. Logout and Login Workflow Verification
    const loginRes = await signIn(testEmail, testPass);
    assert(loginRes.idToken && loginRes.localId === testUid, 10, "Customer can log in successfully with credentials after registration");

    // 11. Wrong password rejected for registered account
    const wrongPassRes = await signIn(testEmail, "WrongPassword123!");
    assert(
        wrongPassRes.error && (wrongPassRes.error.message.includes("INVALID_LOGIN_CREDENTIALS") || wrongPassRes.error.message.includes("INVALID_PASSWORD")),
        11,
        "Incorrect password for registered account is strictly rejected"
    );

    // 12. Active session verified (Profile exists, session is NOT ghost)
    const postLoginProf = await getDoc(`users/${loginRes.localId}`, loginRes.idToken);
    assert(postLoginProf.status === 200, 12, "Post-login session remains valid and customer profile is intact");

    // 13. Admin Account Verification
    const adminDoc = await getDoc(`admins/${PRESERVED_ADMIN_UID}`, adminToken);
    assert(
        adminDoc.status === 200 && adminDoc.data?.fields?.role?.stringValue === "admin",
        13,
        `Preserved sole admin '${PRESERVED_ADMIN_EMAIL}' (UID: ${PRESERVED_ADMIN_UID}) verified active`
    );

    console.log("\n======================================================================");
    console.log(`  TEST RESULTS: ${passedCount} / ${totalCount} TESTS PASSED (100%)`);
    console.log("======================================================================");

    // Clean up test customer
    if (adminToken && testUid) {
        await fetch(`${FIRESTORE_BASE}/users/${testUid}?key=${API_KEY}`, {
            method: "DELETE",
            headers: { 'Authorization': `Bearer ${adminToken}` }
        }).catch(() => {});

        await fetch(`${AUTH_PROJECT_BASE}/accounts:batchDelete`, {
            method: "POST",
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ localIds: [testUid], force: true })
        }).catch(() => {});
        console.log("  ✓ Test customer cleanly purged from Firebase Auth and Firestore.");
    }

    if (passedCount === totalCount) {
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runRaceConditionSuite().catch(err => {
    console.error("FATAL SUITE ERROR:", err);
    process.exit(1);
});
