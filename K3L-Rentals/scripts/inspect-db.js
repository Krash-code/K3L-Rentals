// Inspect full database inventory across collections
const API_KEY = "AIzaSyDcVHD6NXM2MNkiNBlOR6ovdRg_OiHTdsU";
const PROJECT_ID = "k3l-rentals-13ff0";
const REFERER = "https://k3l-rentals-13ff0.web.app/";

const AUTH_SIGNIN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function signIn(email, password) {
    const res = await fetch(AUTH_SIGNIN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Referer": REFERER
        },
        body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    return await res.json();
}

async function getCollection(col, token) {
    const headers = { "Referer": REFERER };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${FIRESTORE_BASE}/${col}?key=${API_KEY}`, { headers });
    return { status: res.status, data: await res.json() };
}

async function main() {
    console.log("Connecting as admin@k3lrentals.com to inspect Firestore...");
    const adminAuth = await signIn("admin@k3lrentals.com", "AdminPassword@2026");
    if (!adminAuth.idToken) {
        console.error("Admin signin failed:", adminAuth);
        return;
    }
    const token = adminAuth.idToken;

    console.log("\n==================== 1. ADMINS (/admins) ====================");
    const admins = await getCollection("admins", token);
    (admins.data.documents || []).forEach(d => {
        const id = d.name.split("/").pop();
        console.log(`- Admin UID: ${id} | Role: ${d.fields?.role?.stringValue}`);
    });

    console.log("\n==================== 2. USERS (/users) ====================");
    const users = await getCollection("users", token);
    (users.data.documents || []).forEach(d => {
        const id = d.name.split("/").pop();
        const f = d.fields || {};
        console.log(`- User UID: ${id} | Name: ${f.name?.stringValue || "N/A"} | Email: ${f.email?.stringValue || "N/A"} | Role: ${f.role?.stringValue || "N/A"}`);
    });

    console.log("\n==================== 3. BOOKINGS (/bookings) ====================");
    const bookings = await getCollection("bookings", token);
    (bookings.data.documents || []).forEach(d => {
        const id = d.name.split("/").pop();
        const f = d.fields || {};
        const total = f.total_amount?.integerValue || f.total_amount?.doubleValue || 0;
        console.log(`- Booking ID: ${id} | Model: ${f.model?.stringValue} | Cust: ${f.customerEmail?.stringValue || f.userId?.stringValue} | Dates: ${f.start_date?.stringValue} -> ${f.end_date?.stringValue} | Status: ${f.status?.stringValue} | Total: ₹${total}`);
    });

    console.log("\n==================== 4. VEHICLES (/vehicles) ====================");
    const vehicles = await getCollection("vehicles", token);
    console.log(`Total fleet vehicles count: ${(vehicles.data.documents || []).length}`);
    (vehicles.data.documents || []).forEach(d => {
        const id = d.name.split("/").pop();
        const f = d.fields || {};
        console.log(`- Vehicle ID: ${id.padEnd(14)} | ${f.model?.stringValue.padEnd(20)} | Reg: ${f.vehicle_number?.stringValue.padEnd(14)} | ${f.category?.stringValue.toUpperCase().padEnd(5)} | 📍${f.location?.stringValue.padEnd(12)} | Status: ${f.status?.stringValue}`);
    });
}

main().catch(console.error);
