// K3L Rentals - Admin Operational Reports & Analytics
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

// Escape HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatStatus(status) {
    if (!status) return "Unknown";
    return String(status).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString("en-IN");
}

// Check Admin Access
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
            alert("Administrative access required.");
            window.location.href = "admin-login.html";
            return false;
        }
        return true;
    } catch (error) {
        console.error("Admin verification error:", error);
        const content = document.getElementById("reportContent");
        if (content) {
            content.innerHTML = `
                <div class="info-card">
                    <h3>Unable to verify admin access</h3>
                    <p>${escapeHTML(error.message)}</p>
                </div>
            `;
        }
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

// Print Report
const printReportBtn = document.getElementById("printReportBtn");
if (printReportBtn) {
    printReportBtn.addEventListener("click", function () {
        window.print();
    });
}

// Load and aggregate report statistics from Firestore
async function loadReports() {
    const reportContent = document.getElementById("reportContent");
    if (!reportContent) return;

    try {
        reportContent.innerHTML = `
            <div class="info-card">
                <h3>Generating analytical reports...</h3>
            </div>
        `;

        const [
            vehiclesSnap,
            usersSnap,
            bookingsSnap,
            maintenanceSnap
        ] = await Promise.all([
            db.collection("vehicles").get(),
            db.collection("users").get(),
            db.collection("bookings").get(),
            db.collection("maintenance").get()
        ]);

        const vehicles = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const bookings = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const maintenance = maintenanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const norm = (s) => String(s || "").toLowerCase().trim().replace(/[\s-]/g, "_");

        // Summary calculations
        const totalVehicles = vehicles.length;
        const totalCustomers = users.filter(u => (u.role || "customer") === "customer").length;
        const totalBookings = bookings.length;
        const totalRevenue = bookings
            .filter(b => ["completed", "confirmed"].includes(norm(b.status)))
            .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

        const completedMaint = maintenance.filter(m => norm(m.status) === "completed").length;
        const pendingMaint = maintenance.filter(m => ["scheduled", "in_progress"].includes(norm(m.status))).length;

        // Status groupings
        const vehicleStatusCounts = {
            available: vehicles.filter(v => norm(v.status) === "available").length,
            booked: vehicles.filter(v => norm(v.status) === "booked").length,
            in_use: vehicles.filter(v => ["in_use", "inuse"].includes(norm(v.status))).length,
            maintenance: vehicles.filter(v => norm(v.status) === "maintenance").length
        };

        const bookingStatusCounts = {
            confirmed: bookings.filter(b => norm(b.status) === "confirmed").length,
            pending: bookings.filter(b => norm(b.status) === "pending").length,
            completed: bookings.filter(b => norm(b.status) === "completed").length,
            cancelled: bookings.filter(b => norm(b.status) === "cancelled").length
        };

        // Popular vehicles by bookings count
        const vehicleBookingCounts = {};
        bookings.forEach(b => {
            const key = b.model || b.vehicle_number || "Unknown";
            vehicleBookingCounts[key] = (vehicleBookingCounts[key] || 0) + 1;
        });

        const sortedPopular = Object.entries(vehicleBookingCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Render full analytics
        reportContent.innerHTML = `
            <div class="dashboard-grid" style="margin-bottom: 24px;">
                <div class="dashboard-card">
                    <h3>Total Fleet Size</h3>
                    <p class="dashboard-number">${totalVehicles}</p>
                </div>
                <div class="dashboard-card">
                    <h3>Registered Customers</h3>
                    <p class="dashboard-number">${totalCustomers}</p>
                </div>
                <div class="dashboard-card">
                    <h3>Total Bookings</h3>
                    <p class="dashboard-number">${totalBookings}</p>
                </div>
                <div class="dashboard-card">
                    <h3>Cumulative Revenue</h3>
                    <p class="dashboard-number" style="font-size:1.4rem; color:#2b6cb0;">₹${formatCurrency(totalRevenue)}</p>
                </div>
            </div>

            <div class="admin-form-card" style="margin-bottom: 24px;">
                <h2>Fleet Operational Status</h2>
                <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
                    <div style="padding:12px; background:#f0fff4; border-radius:6px; border:1px solid #c6f6d5;">
                        <span class="admin-status available">Available</span>
                        <h3 style="font-size:1.8rem; margin:8px 0 0 0; color:#22543d;">${vehicleStatusCounts.available}</h3>
                    </div>
                    <div style="padding:12px; background:#ebf8ff; border-radius:6px; border:1px solid #bee3f8;">
                        <span class="admin-status booked">Booked</span>
                        <h3 style="font-size:1.8rem; margin:8px 0 0 0; color:#2a4365;">${vehicleStatusCounts.booked}</h3>
                    </div>
                    <div style="padding:12px; background:#feebc8; border-radius:6px; border:1px solid #fbd38d;">
                        <span class="admin-status in_use">In Use</span>
                        <h3 style="font-size:1.8rem; margin:8px 0 0 0; color:#744210;">${vehicleStatusCounts.in_use}</h3>
                    </div>
                    <div style="padding:12px; background:#fff5f5; border-radius:6px; border:1px solid #fed7d7;">
                        <span class="admin-status maintenance">Maintenance</span>
                        <h3 style="font-size:1.8rem; margin:8px 0 0 0; color:#742a2a;">${vehicleStatusCounts.maintenance}</h3>
                    </div>
                </div>
            </div>

            <div class="admin-form-card" style="margin-bottom: 24px;">
                <h2>Booking Distribution & Fleet Servicing</h2>
                <div style="display:flex; flex-wrap:wrap; gap:24px;">
                    <div style="flex:1; min-width:260px;">
                        <h3>Reservations by Status</h3>
                        <p>Confirmed: <strong>${bookingStatusCounts.confirmed}</strong></p>
                        <p>Pending: <strong>${bookingStatusCounts.pending}</strong></p>
                        <p>Completed: <strong>${bookingStatusCounts.completed}</strong></p>
                        <p>Cancelled: <strong>${bookingStatusCounts.cancelled}</strong></p>
                    </div>
                    <div style="flex:1; min-width:260px;">
                        <h3>Maintenance Summary</h3>
                        <p>Completed Servicing: <strong style="color:#2f855a;">${completedMaint}</strong></p>
                        <p>Pending / In-Progress: <strong style="color:#c53030;">${pendingMaint}</strong></p>
                        <p>Total Maintenance Logs: <strong>${maintenance.length}</strong></p>
                    </div>
                    <div style="flex:1; min-width:260px;">
                        <h3>Most Popular Vehicles</h3>
                        ${sortedPopular.length ? sortedPopular.map(([model, count]) => `
                            <p>🚗 ${escapeHTML(model)}: <strong>${count} ${count === 1 ? 'booking' : 'bookings'}</strong></p>
                        `).join("") : "<p>No booking activity yet.</p>"}
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Report generation error:", error);
        reportContent.innerHTML = `
            <div class="info-card">
                <h3>Report generation error</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}

// Auth state listener
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        const isAdmin = await checkAdminAccess(user);
        if (isAdmin) {
            await loadReports();
        }
    });
}
