
const db = firebase.firestore();
const auth = firebase.auth();


// =====================================
// HTML SAFETY
// =====================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// =====================================
// FORMAT HELPERS
// =====================================

function formatStatus(status) {
    if (!status) return "Unknown";

    return String(status)
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}


function formatMonth(month) {
    if (!month) return "N/A";

    const parts = month.split("-");

    if (parts.length !== 2) return month;

    const date = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1
    );

    return date.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric"
    });
}


function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString("en-IN");
}


// =====================================
// ADMIN ACCESS CHECK
// =====================================

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

            alert("You do not have admin access.");
            window.location.href = "admin-login.html";

            return false;
        }

        return true;

    } catch (error) {
        console.error("Admin verification error:", error);

        document.getElementById("reportContent").innerHTML = `
            <div class="info-card">
                <h3>Unable to verify admin access.</h3>
                <p>Please check Firestore permissions.</p>
            </div>
        `;

        return false;
    }
}


// =====================================
// LOGOUT
// =====================================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
}


// =====================================
// PRINT REPORT
// =====================================

const printReportBtn = document.getElementById("printReportBtn");

if (printReportBtn) {
    printReportBtn.addEventListener("click", function () {
        window.print();
    });
}


// =====================================
// LOAD REPORTS FROM FIRESTORE
// =====================================

async function loadReports() {
    const reportContent = document.getElementById("reportContent");

    try {
        reportContent.innerHTML = `
            <div class="info-card">
                <h3>Loading reports...</h3>
            </div>
        `;

        const results = await Promise.all([
            db.collection("vehicles").get(),
            db.collection("users").get(),
            db.collection("bookings").get(),
            db.collection("maintenance").get()
        ]);

        const vehicles = results[0].docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const users = results[1].docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const bookings = results[2].docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const maintenance = results[3].docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Calculate report data
        const summary = {
            totalVehicles: vehicles.length,

            totalCustomers: users.filter(
                user => user.role === "customer"
            ).length,

            totalBookings: bookings.length,

            // This is completed-booking value, not verified payment receipts.
            totalRevenue: bookings
                .filter(booking =>
                    String(booking.status || "").toLowerCase()
                    === "completed"
                )
                .reduce((total, booking) =>
                    total + Number(booking.total_amount || 0), 0
                ),

            totalMaintenance: maintenance.length,

            completedMaintenance: maintenance.filter(
                item => String(item.status || "").toLowerCase()
                    === "completed"
            ).length,

            pendingMaintenance: maintenance.filter(
                item => String(item.status || "").toLowerCase()
                    === "pending"
            ).length
        };

        // Booking status counts
        const bookingStatus = countByStatus(bookings);

        // Vehicle status counts
        const vehicleStatus = countByStatus(vehicles);

        // Monthly completed-booking value
        const monthlyRevenue = calculateMonthlyRevenue(bookings);

        // Most frequently booked vehicles
        const popularVehicles = calculatePopularVehicles(bookings);

        displaySummary(summary);
        displayBookingStatus(bookingStatus);
        displayVehicleStatus(vehicleStatus);
        displayMonthlyRevenue(monthlyRevenue);
        displayPopularVehicles(popularVehicles);

        reportContent.innerHTML = "";

    } catch (error) {
        console.error("Report loading error:", error);

        reportContent.innerHTML = `
            <div class="info-card">
                <h3>Unable to load reports.</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}


// =====================================
// COUNT BY STATUS
// =====================================

function countByStatus(items) {
    const counts = {};

    items.forEach(item => {
        const status = String(
            item.status || "unknown"
        ).toLowerCase();

        counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts).map(([status, count]) => ({
        status,
        count
    }));
}


// =====================================
// MONTHLY REVENUE
// =====================================

function calculateMonthlyRevenue(bookings) {
    const monthlyTotals = {};

    bookings.forEach(booking => {
        // Count completed bookings only
        if (
            String(booking.status || "").toLowerCase()
            !== "completed"
        ) {
            return;
        }

        // Use booking creation date
        let date = null;

        if (booking.createdAt &&
            typeof booking.createdAt.toDate === "function") {
            date = booking.createdAt.toDate();

        } else if (booking.start_date) {
            date = new Date(booking.start_date + "T00:00:00");
        }

        if (!date || Number.isNaN(date.getTime())) return;

        const month =
            `${date.getFullYear()}-${String(
                date.getMonth() + 1
            ).padStart(2, "0")}`;

        monthlyTotals[month] =
            (monthlyTotals[month] || 0)
            + Number(booking.total_amount || 0);
    });

    return Object.entries(monthlyTotals)
        .map(([month, revenue]) => ({ month, revenue }))
        .sort((a, b) => a.month.localeCompare(b.month));
}


// =====================================
// POPULAR VEHICLES
// =====================================

function calculatePopularVehicles(bookings) {
    const vehicleCounts = {};

    bookings.forEach(booking => {
        const id = booking.vehicleId || booking.vehicle_id;

        const key = id || booking.vehicle_number || booking.model;

        if (!key) return;

        if (!vehicleCounts[key]) {
            vehicleCounts[key] = {
                model: booking.model || "Vehicle",
                vehicle_number: booking.vehicle_number || "N/A",
                category: booking.category || "car",
                bookings: 0
            };
        }

        vehicleCounts[key].bookings++;
    });

    return Object.values(vehicleCounts)
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 10);
}


// =====================================
// SUMMARY
// =====================================

function displaySummary(summary) {
    document.getElementById("totalVehicles").textContent =
        summary.totalVehicles;

    document.getElementById("totalCustomers").textContent =
        summary.totalCustomers;

    document.getElementById("totalBookings").textContent =
        summary.totalBookings;

    document.getElementById("totalRevenue").textContent =
        `₹${formatCurrency(summary.totalRevenue)}`;

    document.getElementById("totalMaintenance").textContent =
        summary.totalMaintenance;

    document.getElementById("completedMaintenance").textContent =
        summary.completedMaintenance;

    document.getElementById("pendingMaintenance").textContent =
        summary.pendingMaintenance;
}


// =====================================
// BOOKING STATUS
// =====================================

function displayBookingStatus(data) {
    const container = document.getElementById(
        "bookingStatusContainer"
    );

    if (!data.length) {
        container.innerHTML = "<p>No booking data available.</p>";
        return;
    }

    container.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Number of Bookings</th>
                    </tr>
                </thead>

                <tbody>
                    ${data.map(item => `
                        <tr>
                            <td>
                                <span class="admin-status">
                                    ${escapeHTML(formatStatus(item.status))}
                                </span>
                            </td>
                            <td>${item.count}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}


// =====================================
// VEHICLE STATUS
// =====================================

function displayVehicleStatus(data) {
    const container = document.getElementById(
        "vehicleStatusContainer"
    );

    if (!data.length) {
        container.innerHTML = "<p>No vehicle data available.</p>";
        return;
    }

    container.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Number of Vehicles</th>
                    </tr>
                </thead>

                <tbody>
                    ${data.map(item => `
                        <tr>
                            <td>
                                <span class="admin-status">
                                    ${escapeHTML(formatStatus(item.status))}
                                </span>
                            </td>
                            <td>${item.count}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}


// =====================================
// MONTHLY REVENUE
// =====================================

function displayMonthlyRevenue(data) {
    const container = document.getElementById(
        "monthlyRevenueContainer"
    );

    if (!data.length) {
        container.innerHTML = "<p>No revenue data available.</p>";
        return;
    }

    container.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Completed Booking Value</th>
                    </tr>
                </thead>

                <tbody>
                    ${data.map(item => `
                        <tr>
                            <td>${escapeHTML(formatMonth(item.month))}</td>
                            <td>₹${formatCurrency(item.revenue)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}


// =====================================
// POPULAR VEHICLES
// =====================================

function displayPopularVehicles(data) {
    const container = document.getElementById(
        "popularVehiclesContainer"
    );

    if (!data.length) {
        container.innerHTML =
            "<p>No vehicle booking data available.</p>";
        return;
    }

    container.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Vehicle</th>
                        <th>Category</th>
                        <th>Vehicle Number</th>
                        <th>Total Bookings</th>
                    </tr>
                </thead>

                <tbody>
                    ${data.map(item => `
                        <tr>
                            <td>${escapeHTML(item.model)}</td>
                            <td>
                                ${String(item.category).toLowerCase() === "bike"
                                    ? "🏍️ Bike"
                                    : "🚗 Car"}
                            </td>
                            <td>${escapeHTML(item.vehicle_number)}</td>
                            <td>${item.bookings}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}


// =====================================
// INITIAL LOAD
// =====================================

auth.onAuthStateChanged(async function (user) {
    const isAdmin = await checkAdminAccess(user);

    if (isAdmin) {
        await loadReports();
    }
});
