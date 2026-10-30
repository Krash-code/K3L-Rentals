
let allVehicles = [];

async function loadVehicles() {
    const container = document.getElementById("vehicleContainer");

    try {
        const snapshot = await firebase.firestore()
            .collection("vehicles")
            .get();

        allVehicles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        createTypeFilter();
        displayVehicles(allVehicles);

    } catch (error) {
        console.error("Unable to load vehicles:", error);

        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load vehicles</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}


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


// CREATE TYPE FILTER
function createTypeFilter() {
    const filter = document.getElementById("typeFilter");

    if (!filter) return;

    const currentValue = filter.value;

    filter.innerHTML = '<option value="all">All Types</option>';

    const types = [
        ...new Set(
            allVehicles
                .map(vehicle => vehicle.type)
                .filter(Boolean)
        )
    ];

    types.sort();

    types.forEach(type => {
        const option = document.createElement("option");

        option.value = type;
        option.textContent = type;

        filter.appendChild(option);
    });

    filter.value = types.includes(currentValue)
        ? currentValue
        : "all";
}


// DISPLAY VEHICLES
function displayVehicles(vehicles) {
    const container = document.getElementById("vehicleContainer");

    const available = vehicles.filter(vehicle =>
        String(vehicle.status || "").toLowerCase() === "available"
    );

    if (available.length === 0) {
        container.innerHTML = `
            <div class="info-card">
                <h3>No vehicles found</h3>
                <p>Try another search or filter.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = available.map(vehicle => {

        const category = String(vehicle.category || "car").toLowerCase();

        const isBike = category === "bike";

        const vehicleIcon = isBike ? "🏍️" : "🚗";

        const image = vehicle.image
            ? `<img src="${escapeHTML(vehicle.image)}"
                    alt="${escapeHTML(vehicle.model || "Vehicle")}"
                    onerror="this.style.display='none'">`
            : vehicleIcon;

        return `
            <div class="vehicle-card">

                <div class="vehicle-image">
                    ${image}
                </div>

                <div class="vehicle-info">

                    <h3>${escapeHTML(vehicle.model || "Vehicle")}</h3>

                    <p>
                        ${vehicleIcon}
                        ${isBike ? "Bike" : "Car"}
                        ${vehicle.type ? " - " + escapeHTML(vehicle.type) : ""}
                    </p>

                    <p>
                        Vehicle Number:
                        ${escapeHTML(vehicle.vehicle_number || "N/A")}
                    </p>

                    <p>
                        📍 ${escapeHTML(vehicle.location || "N/A")}
                    </p>

                    <p>
                        <strong>₹${escapeHTML(vehicle.price_per_day ?? "N/A")}</strong>
                        / day
                    </p>

                    <a
                        href="vehicle-details.html?id=${encodeURIComponent(vehicle.id)}"
                        class="secondary-btn">
                        View Details
                    </a>

                </div>

            </div>
        `;
    }).join("");
}


// SEARCH AND FILTER
function filterVehicles() {

    const search = document.getElementById("searchInput")
        .value.trim().toLowerCase();

    const type = document.getElementById("typeFilter").value;

    const filtered = allVehicles.filter(vehicle => {

        const model = String(vehicle.model || "").toLowerCase();

        const number = String(vehicle.vehicle_number || "").toLowerCase();

        const category = String(vehicle.category || "car").toLowerCase();

        const matchesSearch =
            model.includes(search) ||
            number.includes(search);

        const matchesType =
            type === "all" || vehicle.type === type;

        return matchesSearch && matchesType;
    });

    displayVehicles(filtered);
}


// EVENT LISTENERS
document.getElementById("searchInput")
    ?.addEventListener("input", filterVehicles);

document.getElementById("typeFilter")
    ?.addEventListener("change", filterVehicles);


// LOAD VEHICLES
loadVehicles();
