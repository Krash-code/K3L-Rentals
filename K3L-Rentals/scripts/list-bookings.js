const API_KEY = "AIzaSyDcVHD6NXM2MNkiNBlOR6ovdRg_OiHTdsU";
const PROJECT_ID = "k3l-rentals-13ff0";
const REFERER = "https://k3l-rentals-13ff0.web.app/";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function listAllBookings() {
    const res = await fetch(`${FIRESTORE_BASE}/bookings?key=${API_KEY}`, {
        headers: { "Referer": REFERER }
    });
    const data = await res.json();
    const docs = data.documents || [];
    console.log("Total Bookings in Firestore:", docs.length);
    docs.forEach(d => {
        const id = d.name.split("/").pop();
        const f = d.fields || {};
        console.log(`ID: ${id.padEnd(25)} | User: ${f.userId?.stringValue || f.customerEmail?.stringValue || "N/A"} | Status: ${f.status?.stringValue} | Model: ${f.model?.stringValue}`);
    });
}
listAllBookings();

