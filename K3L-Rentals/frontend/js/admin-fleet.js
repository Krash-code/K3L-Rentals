
const auth = firebase.auth();
const db = firebase.firestore();

const container = document.getElementById("fleetTableContainer");

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
        console.error("Admin verification failed:", error);
        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to verify admin access.</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
        return false;
    }
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", function () {
    logout();
});

// Refresh fleet
document.getElementById("refreshFleetBtn").addEventListener("click", function () {
    loadFleet();
});

// Load fleet from Firestore
async function loadFleet() {
    try {
        container.innerHTML = "<p>Loading fleet...</p>";

        const snapshot = await db
            .collection("vehicles")
            .get();

        const vehicles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        displayFleet(vehicles);

    } catch (error) {
        console.error("Fleet loading error:", error);

        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load fleet.</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

// Display fleet
function displayFleet(vehicles) {
    if (vehicles.length === 0) {
        container.innerHTML = `
            <div class="info-card">
                <h3>No vehicles found.</h3>
                <p>There are currently no vehicles in the fleet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Category</th>
                        <th>Vehicle Number</th>
                        <th>Model</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>

                <tbody>
                    ${vehicles.map(vehicle => {
                        const category = vehicle.category || "car";
                        const icon = category === "bike" ? "🏍️" : "🚗";

                        return `
                            <tr>
                                <td>${escapeHtml(vehicle.id)}</td>

                                <td>
                                    ${icon} ${escapeHtml(category.toUpperCase())}
                                </td>

                                <td>
                                    ${escapeHtml(vehicle.vehicle_number || "N/A")}
                                </td>

                                <td>
                                    ${escapeHtml(vehicle.model || "N/A")}
                                </td>

                                <td>
                                    ${escapeHtml(vehicle.type || "N/A")}
                                </td>

                                <td>
                                    <input
                                        type="text"
                                        id="location-${escapeHtml(vehicle.id)}"
                                        value="${escapeHtml(vehicle.location || "")}"
                                        class="fleet-input"
                                    >
                                </td>

                                <td>
                                    <select
                                        id="status-${escapeHtml(vehicle.id)}"
                                        class="fleet-select"
                                    >
                                        <option value="available"
                                            ${vehicle.status === "available" || vehicle.status === "Available" ? "selected" : ""}>
                                            Available
                                        </option>

                                        <option value="booked"
                                            ${vehicle.status === "booked" || vehicle.status === "Booked" ? "selected" : ""}>
                                            Booked
                                        </option>

                                        <option value="in_use"
                                            ${vehicle.status === "in_use" || vehicle.status === "In Use" ? "selected" : ""}>
                                            In Use
                                        </option>

                                        <option value="maintenance"
                                            ${vehicle.status === "maintenance" || vehicle.status === "Maintenance" ? "selected" : ""}>
                                            Maintenance
                                        </option>
                                    </select>
                                </td>

                                <td>
                                    <button
                                        class="table-btn edit-btn"
                                        data-id="${escapeHtml(vehicle.id)}"
                                        onclick="saveFleetChanges(this.dataset.id)"
                                    >
                                        Save
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;
}

// Save location and status
async function saveFleetChanges(id) {
    const statusElement = document.getElementById(`status-${id}`);
    const locationElement = document.getElementById(`location-${id}`);

    if (!statusElement || !locationElement) {
        alert("Vehicle details not found.");
        return;
    }

    const status = statusElement.value;
    const location = locationElement.value.trim();

    if (!location) {
        alert("Location cannot be empty.");
        return;
    }

    try {
        await db.collection("vehicles")
            .doc(id)
            .update({
                status: status,
                location: location,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        alert("Fleet details updated successfully!");

        await loadFleet();

    } catch (error) {
        console.error("Fleet update error:", error);
        alert("Failed to update fleet: " + error.message);
    }
}

// Escape HTML
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Format status
function formatStatus(status) {
    if (!status) return "Unknown";

    return String(status)
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

// Initial load after Firebase authentication
auth.onAuthStateChanged(async function (user) {
    const isAdmin = await checkAdminAccess(user);

    if (isAdmin) {
        await loadFleet();
    }
});
