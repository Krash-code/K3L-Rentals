
const auth = firebase.auth();
const db = firebase.firestore();

// Check admin access
async function checkAdminAccess(user) {
    if (!user) {
        window.location.href = "admin-login.html";
        return false;
    }

    try {
        const adminDoc = await db
            .collection("admins")
            .doc(user.uid)
            .get();

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
        return false;
    }
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", function () {
    logout();
});

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        // Fetch Firestore collections
        const [
            vehiclesSnapshot,
            bookingsSnapshot,
            usersSnapshot
        ] = await Promise.all([
            db.collection("vehicles").get(),
            db.collection("bookings").get(),
            db.collection("users").get()
        ]);

        const vehicles = vehiclesSnapshot.docs.map(doc => doc.data());
        const bookings = bookingsSnapshot.docs.map(doc => doc.data());
        const customers = usersSnapshot.docs.map(doc => doc.data());

        // Vehicle statistics
        const totalVehicles = vehicles.length;

        const available = vehicles.filter(vehicle =>
            ["available", "Available"].includes(vehicle.status)
        ).length;

        const booked = vehicles.filter(vehicle =>
            ["booked", "Booked"].includes(vehicle.status)
        ).length;

        const maintenance = vehicles.filter(vehicle =>
            ["maintenance", "Maintenance"].includes(vehicle.status)
        ).length;

        const inUse = vehicles.filter(vehicle =>
            ["in_use", "In Use"].includes(vehicle.status)
        ).length;

        // Booking and customer statistics
        const totalBookings = bookings.length;
        const totalCustomers = customers.filter(
            customer => customer.role === "customer"
        ).length;

        // Revenue from completed bookings
        const totalRevenue = bookings
            .filter(booking =>
                ["completed", "Completed"].includes(booking.status)
            )
            .reduce((total, booking) => {
                return total + (Number(booking.total_amount) || 0);
            }, 0);

        // Display values
        document.getElementById("totalVehicles").textContent = totalVehicles;
        document.getElementById("available").textContent = available;
        document.getElementById("booked").textContent = booked;
        document.getElementById("maintenance").textContent = maintenance;
        document.getElementById("inUse").textContent = inUse;
        document.getElementById("totalBookings").textContent = totalBookings;
        document.getElementById("totalCustomers").textContent = totalCustomers;

        document.getElementById("totalRevenue").textContent =
            `₹${totalRevenue.toLocaleString("en-IN")}`;

    } catch (error) {
        console.error("Dashboard loading error:", error);

        alert("Unable to load dashboard statistics: " + error.message);
    }
}

// Wait for Firebase authentication
auth.onAuthStateChanged(async function (user) {
    const isAdmin = await checkAdminAccess(user);

    if (isAdmin) {
        await loadDashboardStats();
    }
});
