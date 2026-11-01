// K3L Rentals - Smart Fleet Management
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

const container = document.getElementById("fleetTableContainer");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const locationFilter = document.getElementById("locationFilter");
const refreshFleetBtn = document.getElementById("refreshFleetBtn");

let allFleetVehicles = [];

// Demonstration Route Locations
const DEMO_ROUTE_LOCATIONS = ["Coimbatore", "Erode", "Salem"];

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
        console.error("Admin verification failed:", error);
        if (container) {
            container.innerHTML = `
                <div class="info-card">
                    <h3>Unable to verify admin access</h3>
                    <p>${escapeHtml(error.message)}</p>
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

// Refresh Fleet
if (refreshFleetBtn) {
    refreshFleetBtn.addEventListener("click", loadFleet);
}

// Load Fleet from Firestore
async function loadFleet() {
    try {
        container.innerHTML = "<p>Loading fleet status...</p>";

        const snapshot = await db.collection("vehicles").get();

        allFleetVehicles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        populateLocationFilter();
        applyFleetFilters();

    } catch (error) {
        console.error("Fleet loading error:", error);
        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load fleet</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

// Populate Location Filter Dropdown
function populateLocationFilter() {
    if (!locationFilter) return;

    const currentVal = locationFilter.value;
    const locations = Array.from(new Set([
        ...DEMO_ROUTE_LOCATIONS,
        ...allFleetVehicles.map(v => v.location).filter(Boolean)
    ])).sort();

    locationFilter.innerHTML = '<option value="all">All Locations</option>';
    locations.forEach(loc => {
        const opt = document.createElement("option");
        opt.value = loc;
        opt.textContent = loc;
        if (loc === currentVal) opt.selected = true;
        locationFilter.appendChild(opt);
    });
}

// Filter and Display Fleet
function applyFleetFilters() {
    const search = (searchInput?.value || "").toLowerCase().trim();
    const status = statusFilter?.value || "all";
    const location = locationFilter?.value || "all";

    const filtered = allFleetVehicles.filter(v => {
        const model = String(v.model || "").toLowerCase();
        const number = String(v.vehicle_number || "").toLowerCase();
        const vLocation = String(v.location || "").toLowerCase();
        const vStatus = String(v.status || "").toLowerCase().replace(/[\s-]/g, "_");

        const matchesSearch = !search || model.includes(search) || number.includes(search) || vLocation.includes(search);
        const matchesStatus = status === "all" || vStatus === status.toLowerCase();
        const matchesLocation = location === "all" || String(v.location || "").toLowerCase() === location.toLowerCase();

        return matchesSearch && matchesStatus && matchesLocation;
    });

    displayFleet(filtered);
}

// Event Listeners for Filters
if (searchInput) searchInput.addEventListener("input", applyFleetFilters);
if (statusFilter) statusFilter.addEventListener("change", applyFleetFilters);
if (locationFilter) locationFilter.addEventListener("change", applyFleetFilters);

// Display Fleet Table
function displayFleet(vehicles) {
    if (vehicles.length === 0) {
        container.innerHTML = `
            <div class="info-card">
                <h3>No vehicles found matching criteria</h3>
                <p>Try adjusting your search terms or filter selections.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="margin-bottom:12px; font-size: 0.9rem; color: #4a5568;">
            Showing <strong>${vehicles.length}</strong> of <strong>${allFleetVehicles.length}</strong> fleet assets.
            Demonstration route: <span style="color:#2b6cb0; font-weight:bold;">Coimbatore → Erode → Salem</span>
        </div>
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Asset</th>
                        <th>Category</th>
                        <th>Registration No.</th>
                        <th>Model</th>
                        <th>Demonstration Location</th>
                        <th>Operational Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${vehicles.map(vehicle => {
                        const category = String(vehicle.category || "car").toLowerCase();
                        const icon = category === "bike" ? "🏍️" : "🚗";
                        const curStatus = String(vehicle.status || "available").toLowerCase().replace(/[\s-]/g, "_");
                        const curLocation = vehicle.location || "Coimbatore";

                        return `
                            <tr>
                                <td><code>${escapeHtml(vehicle.id.substring(0, 6))}</code></td>
                                <td>${icon} ${escapeHtml(category.toUpperCase())}</td>
                                <td><strong>${escapeHtml(vehicle.vehicle_number || "N/A")}</strong></td>
                                <td>${escapeHtml(vehicle.model || "N/A")}</td>
                                <td>
                                    <select id="location-${escapeHtml(vehicle.id)}" class="fleet-select" style="min-width: 140px;">
                                        ${DEMO_ROUTE_LOCATIONS.map(loc => `
                                            <option value="${escapeHtml(loc)}" ${loc.toLowerCase() === curLocation.toLowerCase() ? "selected" : ""}>
                                                📍 ${escapeHtml(loc)}
                                            </option>
                                        `).join("")}
                                        ${!DEMO_ROUTE_LOCATIONS.map(l => l.toLowerCase()).includes(curLocation.toLowerCase()) ? `
                                            <option value="${escapeHtml(curLocation)}" selected>
                                                📍 ${escapeHtml(curLocation)}
                                            </option>
                                        ` : ""}
                                    </select>
                                </td>
                                <td>
                                    <select id="status-${escapeHtml(vehicle.id)}" class="fleet-select" style="min-width: 130px;">
                                        <option value="available" ${curStatus === "available" ? "selected" : ""}>Available</option>
                                        <option value="booked" ${curStatus === "booked" ? "selected" : ""}>Booked</option>
                                        <option value="in_use" ${["in_use", "inuse"].includes(curStatus) ? "selected" : ""}>In Use</option>
                                        <option value="maintenance" ${curStatus === "maintenance" ? "selected" : ""}>Maintenance</option>
                                    </select>
                                </td>
                                <td>
                                    <button class="table-btn edit-btn" data-id="${escapeHtml(vehicle.id)}" onclick="saveFleetChanges('${escapeHtml(vehicle.id)}')">
                                        Save
                                    </button>
                                    <span id="feedback-${escapeHtml(vehicle.id)}" style="margin-left: 8px; font-size: 0.85rem;"></span>
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;
}

// Save Fleet Changes (Location & Status) without prompt boxes
async function saveFleetChanges(id) {
    const statusElem = document.getElementById(`status-${id}`);
    const locationElem = document.getElementById(`location-${id}`);
    const feedbackElem = document.getElementById(`feedback-${id}`);

    if (!statusElem || !locationElem) {
        alert("Vehicle element not found.");
        return;
    }

    const newStatus = statusElem.value;
    const newLocation = locationElem.value.trim();

    if (feedbackElem) {
        feedbackElem.textContent = "Saving...";
        feedbackElem.style.color = "#4a5568";
    }

    try {
        await db.collection("vehicles").doc(id).update({
            status: newStatus,
            location: newLocation,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update local state
        const target = allFleetVehicles.find(v => v.id === id);
        if (target) {
            target.status = newStatus;
            target.location = newLocation;
        }

        if (feedbackElem) {
            feedbackElem.textContent = "✓ Saved";
            feedbackElem.style.color = "#38a169";
            setTimeout(() => {
                if (feedbackElem) feedbackElem.textContent = "";
            }, 2500);
        }

    } catch (error) {
        console.error("Fleet update error:", error);
        if (feedbackElem) {
            feedbackElem.textContent = "✗ Error";
            feedbackElem.style.color = "#e53e3e";
        }
        alert("Failed to update fleet: " + error.message);
    }
}

// Escape HTML
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initial Authentication check
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        const isAdmin = await checkAdminAccess(user);
        if (isAdmin) {
            await loadFleet();
        }
    });
}
