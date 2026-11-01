// K3L Rentals - Public Vehicle Catalog & Date-Based Availability Engine
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

let allVehicles = [];
let vehicleSchedulesMap = new Map(); // vehicleId -> array of { start_date, end_date, status }

// Prevent HTML injection
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Set min dates for filter inputs
function initDatePickers() {
    const today = new Date().toISOString().split("T")[0];
    const startDateInput = document.getElementById("filterStartDate");
    const endDateInput = document.getElementById("filterEndDate");
    if (startDateInput) startDateInput.min = today;
    if (endDateInput) endDateInput.min = today;
}

// Load vehicles and their public schedules from Firestore
async function loadVehicles() {
    const container = document.getElementById("vehicleContainer");
    if (!container) return;

    initDatePickers();

    try {
        const firestore = db || firebase.firestore();
        const snapshot = await firestore.collection("vehicles").get();

        allVehicles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Load schedules in parallel for all vehicles for date filtering
        const schedulePromises = allVehicles.map(async (v) => {
            try {
                const sSnap = await firestore.collection("vehicles")
                    .doc(v.id)
                    .collection("schedules")
                    .where("status", "==", "Confirmed")
                    .get();
                const list = sSnap.docs.map(d => d.data());
                vehicleSchedulesMap.set(v.id, list);
            } catch (e) {
                vehicleSchedulesMap.set(v.id, []);
            }
        });

        await Promise.all(schedulePromises);

        createTypeFilter();
        filterVehicles();

    } catch (error) {
        console.error("Unable to load vehicles:", error);
        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load vehicle listings</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}

// CREATE TYPE FILTER
function createTypeFilter() {
    const filter = document.getElementById("typeFilter");
    if (!filter) return;

    const currentVal = filter.value;
    filter.innerHTML = '<option value="all">All Types</option>';

    const categorySelect = document.getElementById("categoryFilter");
    const selectedCategory = categorySelect ? categorySelect.value : "all";

    const relevantVehicles = selectedCategory === "all"
        ? allVehicles
        : allVehicles.filter(v => String(v.category || "car").toLowerCase() === selectedCategory.toLowerCase());

    const types = Array.from(new Set(
        relevantVehicles.map(v => v.type).filter(Boolean)
    )).sort();

    types.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        if (type === currentVal) option.selected = true;
        filter.appendChild(option);
    });
}

// Check if a vehicle is available for a given date range
function isVehicleAvailableForDates(vehicleId, startDate, endDate) {
    if (!startDate || !endDate) return true;
    const schedules = vehicleSchedulesMap.get(vehicleId) || [];
    // If any confirmed schedule overlaps: bStart < endDate && bEnd > startDate
    for (const s of schedules) {
        if (s.start_date < endDate && s.end_date > startDate) {
            return false;
        }
    }
    return true;
}

// DISPLAY VEHICLES
function displayVehicles(vehicles, isDateFiltered = false, startDate = "", endDate = "") {
    const container = document.getElementById("vehicleContainer");
    const msgElem = document.getElementById("filterStatusMessage");
    if (!container) return;

    if (msgElem) {
        if (isDateFiltered && startDate && endDate) {
            msgElem.innerHTML = `Showing vehicles available for <strong>${escapeHTML(startDate)}</strong> to <strong>${escapeHTML(endDate)}</strong> (${vehicles.length} found)`;
        } else {
            msgElem.innerHTML = `Showing ${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`;
        }
    }

    if (vehicles.length === 0) {
        container.innerHTML = `
            <div class="info-card" style="grid-column: 1 / -1; text-align: center; padding: 32px;">
                <h3>No vehicles match your criteria</h3>
                <p>No vehicles are available matching your active search, category, or date range.</p>
                <button onclick="clearAllFilters()" class="primary-btn" style="margin-top: 12px;">
                    Reset Filters
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = vehicles.map(vehicle => {
        const category = String(vehicle.category || "car").toLowerCase();
        const isBike = category === "bike";
        const vehicleIcon = isBike ? "🏍️" : "🚗";
        const status = String(vehicle.status || "available").toLowerCase();

        const image = vehicle.image
            ? `<img src="${escapeHTML(vehicle.image)}"
                    alt="${escapeHTML(vehicle.model || "Vehicle")}"
                    onerror="this.style.display='none'">`
            : vehicleIcon;

        const isMaintenance = status === "maintenance";

        return `
            <div class="vehicle-card" style="${isMaintenance ? 'opacity: 0.7;' : ''}">
                <div class="vehicle-image">
                    ${image}
                </div>

                <div class="vehicle-info">
                    <h3>${escapeHTML(vehicle.model || "Vehicle")}</h3>

                    <p>
                        ${vehicleIcon} ${isBike ? "Bike" : "Car"}
                        ${vehicle.type ? " • " + escapeHTML(vehicle.type) : ""}
                    </p>

                    <p>
                        <strong>Number:</strong>
                        ${escapeHTML(vehicle.vehicle_number || "N/A")}
                    </p>

                    <p>
                        📍 ${escapeHTML(vehicle.location || "Coimbatore")}
                    </p>

                    <p>
                        <strong>₹${Number(vehicle.price_per_day ?? 0).toLocaleString("en-IN")}</strong> / day
                    </p>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 12px;">
                        <span class="admin-status ${status.replace(/[\s-]/g, '_')}">
                            ${escapeHTML(vehicle.status || "available")}
                        </span>

                        <a href="vehicle-details.html?id=${encodeURIComponent(vehicle.id)}"
                           class="secondary-btn">
                            View Details
                        </a>
                    </div>
                </div>
            </div>
        `;
    }).join("");
}

// SEARCH AND FILTER
function filterVehicles() {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const typeFilter = document.getElementById("typeFilter");
    const startDateInput = document.getElementById("filterStartDate");
    const endDateInput = document.getElementById("filterEndDate");

    const search = (searchInput?.value || "").trim().toLowerCase();
    const category = categoryFilter?.value || "all";
    const type = typeFilter?.value || "all";
    const startDate = startDateInput?.value || "";
    const endDate = endDateInput?.value || "";

    const isDateFiltered = !!(startDate && endDate && endDate > startDate);

    const filtered = allVehicles.filter(vehicle => {
        const model = String(vehicle.model || "").toLowerCase();
        const number = String(vehicle.vehicle_number || "").toLowerCase();
        const location = String(vehicle.location || "").toLowerCase();
        const vCategory = String(vehicle.category || "car").toLowerCase();
        const vType = String(vehicle.type || "");
        const status = String(vehicle.status || "").toLowerCase();

        // If date-filtered, exclude maintenance vehicles and check schedules
        if (isDateFiltered) {
            if (status === "maintenance") return false;
            if (!isVehicleAvailableForDates(vehicle.id, startDate, endDate)) {
                return false;
            }
        }

        const matchesSearch = !search ||
            model.includes(search) ||
            number.includes(search) ||
            location.includes(search);

        const matchesCategory = category === "all" || vCategory === category.toLowerCase();
        const matchesType = type === "all" || vType === type;

        return matchesSearch && matchesCategory && matchesType;
    });

    displayVehicles(filtered, isDateFiltered, startDate, endDate);
}

// Reset all filters
function clearAllFilters() {
    const searchInput = document.getElementById("searchInput");
    const categoryFilter = document.getElementById("categoryFilter");
    const typeFilter = document.getElementById("typeFilter");
    const startDateInput = document.getElementById("filterStartDate");
    const endDateInput = document.getElementById("filterEndDate");

    if (searchInput) searchInput.value = "";
    if (categoryFilter) categoryFilter.value = "all";
    if (startDateInput) startDateInput.value = "";
    if (endDateInput) endDateInput.value = "";

    createTypeFilter();
    filterVehicles();
}

// EVENT LISTENERS
document.getElementById("searchInput")?.addEventListener("input", filterVehicles);
document.getElementById("categoryFilter")?.addEventListener("change", function () {
    createTypeFilter();
    filterVehicles();
});
document.getElementById("typeFilter")?.addEventListener("change", filterVehicles);
document.getElementById("filterStartDate")?.addEventListener("change", filterVehicles);
document.getElementById("filterEndDate")?.addEventListener("change", filterVehicles);
document.getElementById("clearFiltersBtn")?.addEventListener("click", clearAllFilters);

// Global for inline button
window.clearAllFilters = clearAllFilters;

// Initial Load
document.addEventListener("DOMContentLoaded", loadVehicles);
if (typeof firebase !== "undefined") {
    loadVehicles();
}
