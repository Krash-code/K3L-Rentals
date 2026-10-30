
const auth = firebase.auth();
const db = firebase.firestore();

const params = new URLSearchParams(window.location.search);
const vehicleId = params.get("id");

const vehicleSummary = document.getElementById("vehicleSummary");
const bookingForm = document.getElementById("bookingForm");
const bookingMessage = document.getElementById("bookingMessage");

let selectedVehicle = null;


// ------------------------------------
// ESCAPE HTML
// ------------------------------------

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// ------------------------------------
// LOAD VEHICLE FROM FIRESTORE
// ------------------------------------

async function loadVehicle() {
    if (!vehicleId) {
        vehicleSummary.innerHTML = "<p>Vehicle not selected.</p>";
        bookingForm.style.display = "none";
        return;
    }

    try {
        const vehicleDoc = await db
            .collection("vehicles")
            .doc(vehicleId)
            .get();

        if (!vehicleDoc.exists) {
            vehicleSummary.innerHTML = "<p>Vehicle not found.</p>";
            bookingForm.style.display = "none";
            return;
        }

        selectedVehicle = {
            id: vehicleDoc.id,
            ...vehicleDoc.data()
        };

        const category = String(
            selectedVehicle.category || "car"
        ).toLowerCase();

        const icon = category === "bike" ? "🏍️" : "🚗";

        vehicleSummary.innerHTML = `
            <div class="info-card">
                <h2>
                    ${icon} ${escapeHTML(selectedVehicle.model || "Vehicle")}
                </h2>

                <p>${escapeHTML(selectedVehicle.type || category)}</p>

                <p>
                    Vehicle Number:
                    ${escapeHTML(selectedVehicle.vehicle_number || "N/A")}
                </p>

                <p>
                    📍 ${escapeHTML(selectedVehicle.location || "N/A")}
                </p>

                <p>
                    <strong>
                        ₹${Number(selectedVehicle.price_per_day || 0).toLocaleString("en-IN")}
                    </strong>
                    / day
                </p>
            </div>
        `;

        const status = String(
            selectedVehicle.status || ""
        ).toLowerCase();

        if (status !== "available") {
            bookingMessage.textContent =
                "This vehicle is currently unavailable.";

            bookingMessage.style.color = "red";
            bookingForm.style.display = "none";
        }

    } catch (error) {
        console.error("Vehicle loading error:", error);

        vehicleSummary.innerHTML =
            "<p>Unable to load vehicle. Please try again.</p>";

        bookingForm.style.display = "none";
    }
}


// ------------------------------------
// CREATE BOOKING
// ------------------------------------

bookingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const user = auth.currentUser;

    if (!user) {
        window.location.href = "login.html";
        return;
    }

    if (!selectedVehicle) {
        bookingMessage.textContent =
            "Vehicle details are not available.";

        bookingMessage.style.color = "red";
        return;
    }

    const startDate = document.getElementById("start_date").value;
    const endDate = document.getElementById("end_date").value;

    if (!startDate || !endDate) {
        bookingMessage.textContent =
            "Please select both dates.";

        bookingMessage.style.color = "red";
        return;
    }

    // Validate rental dates
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end <= start
    ) {
        bookingMessage.textContent =
            "End date must be after the start date.";

        bookingMessage.style.color = "red";
        return;
    }

    const rentalDays = Math.round(
        (end - start) / (1000 * 60 * 60 * 24)
    );

    const submitButton = bookingForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.disabled = true;
    }

    bookingMessage.textContent = "Creating your booking...";
    bookingMessage.style.color = "black";

    try {
        // Check latest vehicle details
        const vehicleRef = db
            .collection("vehicles")
            .doc(vehicleId);

        const latestVehicle = await vehicleRef.get();

        if (!latestVehicle.exists) {
            throw new Error("Vehicle no longer exists.");
        }

        const vehicle = latestVehicle.data();

        if (
            String(vehicle.status || "").toLowerCase()
            !== "available"
        ) {
            throw new Error(
                "This vehicle is currently unavailable."
            );
        }

        const pricePerDay = Number(vehicle.price_per_day);

        if (
            !Number.isFinite(pricePerDay) ||
            pricePerDay <= 0
        ) {
            throw new Error("Invalid vehicle rental price.");
        }

        const totalAmount = rentalDays * pricePerDay;

        const category = String(
            vehicle.category || "car"
        ).toLowerCase();

        // Save booking in Firestore
        const bookingRef = await db
            .collection("bookings")
            .add({
                userId: user.uid,

                vehicleId: vehicleId,
                model: vehicle.model || "",
                vehicle_number: vehicle.vehicle_number || "",
                category: category,
                type: vehicle.type || "",
                location: vehicle.location || "",

                start_date: startDate,
                end_date: endDate,

                rental_days: rentalDays,
                price_per_day: pricePerDay,
                total_amount: totalAmount,

                status: "Pending",

                createdAt:
                    firebase.firestore.FieldValue.serverTimestamp()
            });

        bookingMessage.innerHTML = `
            <div class="info-card">
                <h3 style="color:green;">
                    Booking successful!
                </h3>

                <p>
                    Booking ID:
                    ${escapeHTML(bookingRef.id)}
                </p>

                <p>
                    Rental Days: ${rentalDays}
                </p>

                <p>
                    Total Amount:
                    ₹${totalAmount.toLocaleString("en-IN")}
                </p>

                <p>Status: Pending</p>

                <a href="my-bookings.html" class="primary-btn">
                    View My Bookings
                </a>
            </div>
        `;

        bookingForm.style.display = "none";

    } catch (error) {
        console.error("Booking error:", error);

        bookingMessage.textContent =
            error.message || "Unable to create booking.";

        bookingMessage.style.color = "red";

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
});


// ------------------------------------
// CHECK FIREBASE LOGIN
// ------------------------------------

auth.onAuthStateChanged(function (user) {
    if (user) {
        loadVehicle();
    } else {
        window.location.href = "login.html";
    }
});
