
async function loadBookings() {
    const container = document.getElementById("bookingsContainer");

    try {
        // Check Firebase login
        const user = firebase.auth().currentUser;

        if (!user) {
            window.location.href = "login.html";
            return;
        }

        container.innerHTML = `
            <div class="info-card">
                <h3>Loading your bookings...</h3>
            </div>
        `;

        // Get only bookings belonging to this user
        const snapshot = await firebase.firestore()
            .collection("bookings")
            .where("userId", "==", user.uid)
            .get();

        const myBookings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (myBookings.length === 0) {
            container.innerHTML = `
                <div class="info-card">
                    <h3>No bookings yet</h3>

                    <p>
                        You haven't booked any vehicles yet.
                    </p>

                    <br>

                    <a href="vehicles.html" class="primary-btn">
                        Browse Vehicles
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = myBookings.map(booking => {

            const model = booking.model || "Vehicle";
            const vehicleNumber = booking.vehicle_number || "N/A";
            const startDate = booking.start_date || "N/A";
            const endDate = booking.end_date || "N/A";
            const amount = booking.total_amount ?? "N/A";
            const status = booking.status || "Pending";

            const category = String(
                booking.category || "car"
            ).toLowerCase();

            const icon = category === "bike" ? "🏍️" : "🚗";

            return `
                <div class="booking-item">

                    <h3>
                        ${icon} ${escapeHTML(model)}
                    </h3>

                    <p>
                        Vehicle Number:
                        ${escapeHTML(vehicleNumber)}
                    </p>

                    <p>
                        Start Date:
                        ${escapeHTML(startDate)}
                    </p>

                    <p>
                        End Date:
                        ${escapeHTML(endDate)}
                    </p>

                    <p>
                        Total Amount:
                        ₹${escapeHTML(amount)}
                    </p>

                    <p>
                        Status:
                        <span class="status">
                            ${escapeHTML(status)}
                        </span>
                    </p>

                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Unable to load bookings:", error);

        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load bookings</h3>
                <p>Please check your Firestore permissions.</p>
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


// Wait until Firebase checks the login session
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        loadBookings();
    } else {
        window.location.href = "login.html";
    }
});
