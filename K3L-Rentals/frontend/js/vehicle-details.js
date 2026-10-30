
const params = new URLSearchParams(window.location.search);
const vehicleId = params.get("id");

async function loadVehicleDetails() {
    const container = document.getElementById("vehicleDetails");

    if (!vehicleId) {
        container.innerHTML = `
            <div class="info-card">
                <h3>Vehicle not selected</h3>
                <a href="vehicles.html" class="primary-btn">
                    Browse Vehicles
                </a>
            </div>
        `;
        return;
    }

    try {
        const doc = await firebase.firestore()
            .collection("vehicles")
            .doc(vehicleId)
            .get();

        if (!doc.exists) {
            container.innerHTML = `
                <div class="info-card">
                    <h3>Vehicle not found</h3>
                    <a href="vehicles.html" class="primary-btn">
                        Browse Vehicles
                    </a>
                </div>
            `;
            return;
        }

        const vehicle = doc.data();

        const category = String(vehicle.category || "car").toLowerCase();
        const isBike = category === "bike";
        const vehicleIcon = isBike ? "🏍️" : "🚗";

        const status = String(vehicle.status || "").toLowerCase();
        const isAvailable = status === "available";

        container.innerHTML = `
            <div class="details-card">

                <div class="details-image">
                    ${
                        vehicle.image
                            ? `<img
                                src="${escapeHTML(vehicle.image)}"
                                alt="${escapeHTML(vehicle.model || "Vehicle")}"
                                onerror="this.style.display='none'">`
                            : vehicleIcon
                    }
                </div>

                <div class="details-content">

                    <h1>
                        ${escapeHTML(vehicle.model || "Vehicle")}
                    </h1>

                    <p>
                        <strong>Category:</strong>
                        ${isBike ? "🏍️ Bike" : "🚗 Car"}
                    </p>

                    <p>
                        <strong>Vehicle Number:</strong>
                        ${escapeHTML(vehicle.vehicle_number || "N/A")}
                    </p>

                    <p>
                        <strong>Type:</strong>
                        ${escapeHTML(vehicle.type || "N/A")}
                    </p>

                    <p>
                        <strong>Location:</strong>
                        ${escapeHTML(vehicle.location || "N/A")}
                    </p>

                    <p>
                        <strong>Price:</strong>
                        ₹${escapeHTML(vehicle.price_per_day ?? "N/A")} / day
                    </p>

                    <p>
                        <strong>Status:</strong>
                        ${escapeHTML(vehicle.status || "Unknown")}
                    </p>

                    ${
                        isAvailable
                            ? `
                                <a
                                    href="booking.html?id=${encodeURIComponent(vehicleId)}"
                                    class="primary-btn">
                                    Book This Vehicle
                                </a>
                            `
                            : `
                                <p>
                                    This vehicle is currently unavailable.
                                </p>
                            `
                    }

                </div>
            </div>
        `;

    } catch (error) {
        console.error("Unable to load vehicle details:", error);

        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load vehicle details</h3>
                <p>Please check your internet connection and Firestore permissions.</p>
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

loadVehicleDetails();
