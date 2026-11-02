// K3L Rentals - Admin Dashboard Analytics & Metrics Engine
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

// Check admin authorization via /admins/{uid}
async function checkAdminAccess(user) {
    if (!user) {
        window.location.href = "admin-login.html";
        return false;
    }

    try {
        const adminDoc = await db.collection("admins").doc(user.uid).get();

        if (!adminDoc.exists) {
            await auth.signOut();
            localStorage.removeItem("user");
            window.location.href = "admin-login.html";
            return false;
        }

        return true;

    } catch (error) {
        console.error("Admin verification error:", error);
        alert("Unable to verify admin access. Check Firestore rules.");
        window.location.href = "admin-login.html";
        return false;
    }
}

// Load real-time dashboard statistics from Firestore
async function loadDashboardStats() {
    try {
        const [
            vehiclesSnapshot,
            bookingsSnapshot,
            usersSnapshot
        ] = await Promise.all([
            db.collection("vehicles").get(),
            db.collection("bookings").get(),
            db.collection("users").get()
        ]);

        const vehicles = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const bookings = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const norm = (val) => String(val || "").toLowerCase().trim().replace(/[\s-]/g, "_");

        // Vehicle metrics
        const totalVehicles = vehicles.length;
        const available = vehicles.filter(v => norm(v.status) === "available").length;
        const booked = vehicles.filter(v => norm(v.status) === "booked").length;
        const maintenance = vehicles.filter(v => norm(v.status) === "maintenance").length;
        const inUse = vehicles.filter(v => ["in_use", "inuse"].includes(norm(v.status))).length;

        // Booking & Verification pipeline metrics
        const pendingDocs = bookings.filter(b => norm(b.verification_status) === "pending_review" || (norm(b.status) === "pending_review" && norm(b.verification_status) !== "approved")).length;
        const pendingPayments = bookings.filter(b => norm(b.payment_status) === "pending_verification").length;
        const activeTrips = bookings.filter(b => ["active", "in_use", "inuse"].includes(norm(b.status))).length;
        const completedTrips = bookings.filter(b => norm(b.status) === "completed").length;
        const totalBookings = bookings.length;

        // Customer count
        const totalCustomers = users.filter(u => (u.role || "customer") === "customer").length;

        // Revenue calculation (total from confirmed, active, completed)
        const totalRevenue = bookings
            .filter(b => ["completed", "confirmed", "active"].includes(norm(b.status)))
            .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

        // Update DOM elements safely
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setVal("pendingDocsCount", pendingDocs);
        setVal("pendingPaymentsCount", pendingPayments);
        setVal("activeTripsCount", activeTrips);
        setVal("totalVehicles", totalVehicles);
        setVal("available", available);
        setVal("booked", booked + inUse);
        setVal("maintenance", maintenance);
        setVal("totalBookings", totalBookings);
        setVal("completedTrips", completedTrips);
        setVal("totalCustomers", totalCustomers);
        setVal("totalRevenue", `₹${totalRevenue.toLocaleString("en-IN")}`);

    } catch (error) {
        console.error("Dashboard loading error:", error);
        const container = document.querySelector(".dashboard-grid") || document.body;
        const errBanner = document.createElement("div");
        errBanner.className = "info-card";
        errBanner.style.borderLeft = "4px solid #e53e3e";
        errBanner.innerHTML = `<p style="color:#e53e3e;">Failed to load statistics: ${error.message}</p>`;
        container.prepend(errBanner);
    }
}

// Authentication state listener
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        const isAdmin = await checkAdminAccess(user);
        if (isAdmin) {
            await loadDashboardStats();
        }
    });
}
