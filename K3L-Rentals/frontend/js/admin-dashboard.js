// K3L Rentals - Admin Dashboard Analytics
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

// Check admin authorization
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

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
        if (typeof logout === "function") {
            logout();
        } else {
            auth.signOut().then(() => {
                localStorage.removeItem("user");
                window.location.href = "index.html";
            });
        }
    });
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

        // Status normalization helper
        const norm = (val) => String(val || "").toLowerCase().trim().replace(/[\s-]/g, "_");

        // Real-time Vehicle Status Counts
        const totalVehicles = vehicles.length;
        const available = vehicles.filter(v => norm(v.status) === "available").length;
        const booked = vehicles.filter(v => norm(v.status) === "booked").length;
        const maintenance = vehicles.filter(v => norm(v.status) === "maintenance").length;
        const inUse = vehicles.filter(v => ["in_use", "inuse"].includes(norm(v.status))).length;

        // Customer & Booking metrics
        const totalBookings = bookings.length;
        const totalCustomers = users.filter(u => (u.role || "customer") === "customer").length;

        // Revenue from completed or confirmed bookings
        const totalRevenue = bookings
            .filter(b => ["completed", "confirmed"].includes(norm(b.status)))
            .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

        // Update DOM elements safely
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setVal("totalVehicles", totalVehicles);
        setVal("available", available);
        setVal("booked", booked);
        setVal("maintenance", maintenance);
        setVal("inUse", inUse);
        setVal("totalBookings", totalBookings);
        setVal("totalCustomers", totalCustomers);
        setVal("totalRevenue", `₹${totalRevenue.toLocaleString("en-IN")}`);

    } catch (error) {
        console.error("Dashboard loading error:", error);
        const container = document.querySelector(".dashboard-grid") || document.body;
        const errBanner = document.createElement("div");
        errBanner.className = "info-card";
        errBanner.style.borderLeft = "4px solid #e53e3e";
        errBanner.innerHTML = `<p style="color:#e53e3e;">Failed to load stats: ${error.message}</p>`;
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
