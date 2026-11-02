async function verifyLive() {
    const urls = [
        "https://k3l-rentals-13ff0.web.app/",
        "https://k3l-rentals-13ff0.web.app/vehicles.html",
        "https://k3l-rentals-13ff0.web.app/vehicle-details.html",
        "https://k3l-rentals-13ff0.web.app/booking.html",
        "https://k3l-rentals-13ff0.web.app/my-bookings.html",
        "https://k3l-rentals-13ff0.web.app/login.html",
        "https://k3l-rentals-13ff0.web.app/register.html",
        "https://k3l-rentals-13ff0.web.app/admin-login.html",
        "https://k3l-rentals-13ff0.web.app/admin-dashboard.html",
        "https://k3l-rentals-13ff0.web.app/admin-verification.html",
        "https://k3l-rentals-13ff0.web.app/admin-bookings.html",
        "https://k3l-rentals-13ff0.web.app/admin-fleet.html",
        "https://k3l-rentals-13ff0.web.app/admin-tracking.html",
        "https://k3l-rentals-13ff0.web.app/admin-maintenance.html",
        "https://k3l-rentals-13ff0.web.app/admin-reports.html",
        "https://k3l-rentals-13ff0.web.app/admin-customers.html",
        "https://k3l-rentals-13ff0.web.app/js/firebase-config.js",
        "https://k3l-rentals-13ff0.web.app/js/chatbot.js",
        "https://k3l-rentals-13ff0.web.app/js/notifications.js",
        "https://k3l-rentals-13ff0.web.app/css/style.css"
    ];

    console.log("=== PROBING LIVE DEPLOYED APPLICATION (https://k3l-rentals-13ff0.web.app) ===");
    let passed = 0;
    for (const url of urls) {
        const res = await fetch(url);
        const text = await res.text();
        const hasLocalhost = text.includes("localhost") || text.includes("127.0.0.1");
        const status = (res.status === 200 && !hasLocalhost) ? "[OK]" : "[FAIL]";
        if (status === "[OK]") passed++;
        console.log(`${status} ${res.status} | ${url.replace("https://k3l-rentals-13ff0.web.app/", "") || "index.html"}`);
    }
    console.log(`\nVerified ${passed} / ${urls.length} live production endpoints successfully!`);
}
verifyLive().catch(console.error);

