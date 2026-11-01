// K3L Rentals - Customer My Bookings & Self-Service Cancellation
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

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

async function loadBookings() {
    const container = document.getElementById("bookingsContainer");
    if (!container) return;

    try {
        const user = auth ? auth.currentUser : (typeof firebase !== "undefined" ? firebase.auth().currentUser : null);

        if (!user) {
            window.location.href = "login.html";
            return;
        }

        container.innerHTML = `
            <div class="info-card">
                <h3>Loading your bookings...</h3>
            </div>
        `;

        // Get bookings belonging strictly to this authenticated user
        const snapshot = await db.collection("bookings")
            .where("userId", "==", user.uid)
            .get();

        const myBookings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort descending by start date or creation
        myBookings.sort((a, b) => {
            const dateA = a.start_date || "";
            const dateB = b.start_date || "";
            return dateB.localeCompare(dateA);
        });

        if (myBookings.length === 0) {
            container.innerHTML = `
                <div class="info-card">
                    <h3>No bookings yet</h3>
                    <p>You haven't booked any vehicles yet.</p>
                    <br>
                    <a href="vehicles.html" class="primary-btn">Browse Vehicles</a>
                </div>
            `;
            return;
        }

        container.innerHTML = myBookings.map(booking => {
            const model = booking.model || "Vehicle";
            const vehicleNumber = booking.vehicle_number || "N/A";
            const startDate = booking.start_date || "N/A";
            const endDate = booking.end_date || "N/A";
            const amount = Number(booking.total_amount || 0).toLocaleString("en-IN");
            const rawStatus = String(booking.status || "Pending");
            const status = rawStatus.toLowerCase();
            const category = String(booking.category || "car").toLowerCase();
            const icon = category === "bike" ? "🏍️" : "🚗";
            const days = booking.rental_days || 1;

            const isCancellable = status === "confirmed" || status === "pending";

            return `
                <div class="booking-item" style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 16px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <h3 style="margin-top:0;">${icon} ${escapeHTML(model)}</h3>
                            <p><strong>Registration:</strong> ${escapeHTML(vehicleNumber)}</p>
                            <p><strong>Category:</strong> ${icon} ${category.toUpperCase()} ${booking.type ? " • " + escapeHTML(booking.type) : ""}</p>
                            <p><strong>Rental Dates:</strong> ${escapeHTML(startDate)} to ${escapeHTML(endDate)} (${days} ${days === 1 ? 'day' : 'days'})</p>
                            <p><strong>Pickup Location:</strong> 📍 ${escapeHTML(booking.location || "Coimbatore")}</p>
                            <p><strong>Total Amount:</strong> <strong style="color:#2b6cb0; font-size:1.1rem;">₹${escapeHTML(amount)}</strong></p>
                            <p><strong>Status:</strong> <span class="admin-status ${status}">${escapeHTML(rawStatus)}</span></p>
                        </div>

                        <div>
                            ${isCancellable ? `
                                <button class="table-btn delete-btn" onclick="cancelBooking('${escapeHTML(booking.id)}', '${escapeHTML(booking.vehicleId || "")}')" style="padding: 8px 16px; font-size: 0.9rem;">
                                    Cancel Booking
                                </button>
                            ` : `
                                <span style="font-size:0.85rem; color:#718096;">
                                    ${status === 'cancelled' ? 'Booking Cancelled' : 'Completed Trip'}
                                </span>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Unable to load bookings:", error);
        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load bookings</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}

// Cancel Booking Handler
async function cancelBooking(bookingId, vehicleId) {
    if (!bookingId) return;

    const confirmed = confirm("Are you sure you want to cancel this booking? This will release the vehicle for other customers.");
    if (!confirmed) return;

    try {
        // 1. Update booking document status to Cancelled
        await db.collection("bookings").doc(bookingId).update({
            status: "Cancelled",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Update public schedule slot if present
        if (vehicleId) {
            try {
                await db.collection("vehicles")
                    .doc(vehicleId)
                    .collection("schedules")
                    .doc(bookingId)
                    .update({
                        status: "Cancelled",
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
            } catch (schedErr) {
                console.warn("Schedule slot update failed (may not exist):", schedErr);
            }
        }

        alert("Your booking has been cancelled successfully.");
        await loadBookings();

    } catch (error) {
        console.error("Cancellation error:", error);
        alert("Unable to cancel booking: " + error.message);
    }
}

// Global exposure for inline handler
window.cancelBooking = cancelBooking;

// Wait until Firebase checks the login session
if (auth) {
    auth.onAuthStateChanged(user => {
        if (user) {
            loadBookings();
        } else {
            window.location.href = "login.html";
        }
    });
} else if (typeof firebase !== "undefined") {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            loadBookings();
        } else {
            window.location.href = "login.html";
        }
    });
}
