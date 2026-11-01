// K3L Rentals - Vehicle Details View
const params = new URLSearchParams(window.location.search);
const vehicleId = params.get("id");

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

async function loadVehicleDetails() {
    const container = document.getElementById("vehicleDetails");
    if (!container) return;

    if (!vehicleId) {
        container.innerHTML = `
            <div class="info-card">
                <h3>Vehicle not selected</h3>
                <p>Please browse our vehicles catalog and select a vehicle to view details.</p>
                <br>
                <a href="vehicles.html" class="primary-btn">Browse Vehicles</a>
            </div>
        `;
        return;
    }

    try {
        const firestore = firebase.firestore();
        const doc = await firestore
            .collection("vehicles")
            .doc(vehicleId)
            .get();

        if (!doc.exists) {
            container.innerHTML = `
                <div class="info-card">
                    <h3>Vehicle not found</h3>
                    <p>The requested vehicle is no longer in our fleet records.</p>
                    <br>
                    <a href="vehicles.html" class="primary-btn">Browse Vehicles</a>
                </div>
            `;
            return;
        }

        const vehicle = doc.data();

        // Fetch schedules
        let schedules = [];
        try {
            const schedSnap = await firestore
                .collection("vehicles")
                .doc(vehicleId)
                .collection("schedules")
                .where("status", "==", "Confirmed")
                .get();
            schedules = schedSnap.docs.map(d => d.data());
        } catch (e) {
            schedules = [];
        }

        const category = String(vehicle.category || "car").toLowerCase();
        const isBike = category === "bike";
        const vehicleIcon = isBike ? "🏍️" : "🚗";

        const status = String(vehicle.status || "available").toLowerCase();
        const isMaintenance = status === "maintenance";
        const price = Number(vehicle.price_per_day || 0);

        let reservationsBlock = "";
        if (schedules.length > 0) {
            const sorted = [...schedules].sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
            reservationsBlock = `
                <div style="margin: 16px 0; background: #fffaf0; border: 1px solid #feebc8; padding: 12px; border-radius: 6px;">
                    <strong style="color: #c05621; font-size: 0.95rem;">📅 Existing Booking Dates:</strong>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
                        ${sorted.map(s => `
                            <span style="background: #feebc8; color: #7b341e; font-size: 0.85rem; padding: 3px 10px; border-radius: 4px; font-weight: 500;">
                                ${escapeHTML(s.start_date)} → ${escapeHTML(s.end_date)}
                            </span>
                        `).join("")}
                    </div>
                    <small style="color:#744210; display:block; margin-top:6px;">This vehicle can be reserved for any dates outside the ranges above.</small>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="details-card">
                <div class="details-image">
                    ${
                        vehicle.image
                            ? `<img
                                src="${escapeHTML(vehicle.image)}"
                                alt="${escapeHTML(vehicle.model || "Vehicle")}"
                                onerror="this.style.display='none'">`
                            : `<div style="font-size: 5rem; text-align: center;">${vehicleIcon}</div>`
                    }
                </div>

                <div class="details-content">
                    <h1>${escapeHTML(vehicle.model || "Vehicle")}</h1>

                    <p>
                        <strong>Category:</strong>
                        ${isBike ? "🏍️ Bike" : "🚗 Car"}
                        ${vehicle.type ? " • " + escapeHTML(vehicle.type) : ""}
                    </p>

                    <p>
                        <strong>Vehicle Registration:</strong>
                        ${escapeHTML(vehicle.vehicle_number || "N/A")}
                    </p>

                    <p>
                        <strong>Fleet Location:</strong>
                        📍 ${escapeHTML(vehicle.location || "Coimbatore")}
                    </p>

                    <p>
                        <strong>Daily Rate:</strong>
                        <span style="font-size: 1.3rem; font-weight: bold; color: #2b6cb0;">₹${price.toLocaleString("en-IN")}</span> / day
                    </p>

                    <p>
                        <strong>Operational Status:</strong>
                        <span class="admin-status ${status.replace(/[\s-]/g, "_")}">
                            ${escapeHTML(vehicle.status || "Available")}
                        </span>
                    </p>

                    ${reservationsBlock}

                    <div style="margin-top: 24px;">
                        ${
                            !isMaintenance
                                ? `
                                    <a href="booking.html?id=${encodeURIComponent(vehicleId)}"
                                       class="primary-btn" style="display:inline-block; padding: 12px 24px; font-size:1.1rem;">
                                        Book This Vehicle
                                    </a>
                                `
                                : `
                                    <div style="background: #fff5f5; border: 1px solid #feb2b2; padding: 12px; border-radius: 6px; color: #c53030;">
                                        <strong>⚠️ In Service:</strong> This vehicle is currently undergoing maintenance and is not available for bookings.
                                    </div>
                                    <br>
                                    <a href="vehicles.html" class="secondary-btn">Browse Other Vehicles</a>
                                `
                        }
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error("Unable to load vehicle details:", error);
        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load vehicle details</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}

document.addEventListener("DOMContentLoaded", loadVehicleDetails);
if (typeof firebase !== "undefined") {
    loadVehicleDetails();
}
