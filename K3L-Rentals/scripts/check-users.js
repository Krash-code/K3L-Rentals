const API_KEY = "AIzaSyDcVHD6NXM2MNkiNBlOR6ovdRg_OiHTdsU";
const PROJECT_ID = "k3l-rentals-13ff0";
const REFERER = "https://k3l-rentals-13ff0.web.app/";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function listUsers() {
    // Check with the three known test UIDs from accounts.json
    const testUids = [
        "N1WpD9xlunOGXdvVvWwAwWfafDr1",
        "WKIHLfzgGlXsQ5YFgUnUjYcAWvl1",
        "kakbc6ULNAMtbtbGu9WJnQMluRj1"
    ];
    for (const uid of testUids) {
        const res = await fetch(`${FIRESTORE_BASE}/users/${uid}?key=${API_KEY}`, {
            headers: { "Referer": REFERER }
        });
        console.log(`User ${uid}: Status ${res.status}`);
    }

    // Check user profiles for krashvinsall and 24bcs142krishma
    const originalUids = [
        { email: "krashvinsall@gmail.com", uid: "fqQ1WpLoUggcKnz1dm2xoBJBfjG3" },
        { email: "24bcs142krishma@gmail.com", uid: "8lqQd9ADW0QFRwBFyQDbfrI4mJh2" },
        { email: "kashikasampathkumar@gmail.com", uid: "78XkcFK1CuSpmK8AhtyB5nTZbT62" }
    ];
    for (const o of originalUids) {
        const res = await fetch(`${FIRESTORE_BASE}/users/${o.uid}?key=${API_KEY}`, {
            headers: { "Referer": REFERER }
        });
        console.log(`Original User ${o.email} (${o.uid}): Status ${res.status}`);
    }
}
listUsers();

