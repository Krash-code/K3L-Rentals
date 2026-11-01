// K3L Rentals - Admin Booking Management
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

const bookingFormContainer = document.getElementById("bookingFormContainer");
const bookingForm = document.getElementById("bookingForm");
const cancelBookingEdit = document.getElementById("cancelBookingEdit");
const bookingFormMessage = document.getElementById("bookingFormMessage");
const bookingTableContainer = document.getElementById("bookingTableContainer");

let allBookings = [];
let currentAdmin = null;

// Admin Access Check
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
            alert("Admin access required.");
            window.location.href = "admin-login.html";
            return false;
        }

        currentAdmin = user;
        return true;

    } catch (error) {
        console.error("Admin verification error:", error);
        if (bookingTableContainer) {
            bookingTableContainer.innerHTML = `
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

// Cancel Edit
if (cancelBookingEdit) {
    cancelBookingEdit.addEventListener("click", function () {
        bookingFormContainer.classList.add("hidden");
        bookingForm.reset();
        bookingFormMessage.textContent = "";
    });
}

// Load Bookings
async function loadBookings() {
    try {
        bookingTableContainer.innerHTML = "<p>Loading bookings...</p>";

        const snapshot = await db.collection("bookings").get();

        allBookings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort by start date or created timestamp descending
        allBookings.sort((a, b) => {
            const dateA = a.start_date || "";
            const dateB = b.start_date || "";
            return dateB.localeCompare(dateA);
        });

        displayBookings(allBookings);

    } catch (error) {
        console.error("Booking loading error:", error);
        bookingTableContainer.innerHTML = `
            <div class="info-card">
                <h3>Unable to load bookings</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

// Display Bookings
function displayBookings(bookings) {
    if (bookings.length === 0) {
        bookingTableContainer.innerHTML = `
            <div class="info-card">
                <h3>No bookings recorded yet</h3>
                <p>Customer reservations will appear here once booked.</p>
            </div>
        `;
        return;
    }

    bookingTableContainer.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Booking ID</th>
                        <th>Customer</th>
                        <th>Vehicle</th>
                        <th>Registration</th>
                        <th>Dates</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${bookings.map(booking => {
                        const status = booking.status || "Pending";
                        const statusClass = status.toLowerCase().replace(/[\s-]/g, "_");
                        const category = String(booking.category || "car").toLowerCase();
                        const icon = category === "bike" ? "🏍️" : "🚗";

                        return `
                            <tr>
                                <td><code>${escapeHtml(booking.id.substring(0, 8))}...</code></td>
                                <td>
                                    <strong>${escapeHtml(booking.customerName || "Customer")}</strong><br>
                                    <small>${escapeHtml(booking.customerEmail || booking.userId || "")}</small>
                                </td>
                                <td>${icon} ${escapeHtml(booking.model || "Vehicle")}</td>
                                <td>${escapeHtml(booking.vehicle_number || "N/A")}</td>
                                <td>
                                    ${escapeHtml(formatDate(booking.start_date))} to ${escapeHtml(formatDate(booking.end_date))}<br>
                                    <small>(${booking.rental_days || 1} days)</small>
                                </td>
                                <td><strong>₹${Number(booking.total_amount || 0).toLocaleString("en-IN")}</strong></td>
                                <td>
                                    <span class="admin-status ${statusClass}">
                                        ${escapeHtml(status)}
                                    </span>
                                </td>
                                <td>
                                    <button class="table-btn edit-btn" data-action="edit" data-id="${escapeHtml(booking.id)}">
                                        Edit
                                    </button>
                                    <button class="table-btn delete-btn" data-action="delete" data-id="${escapeHtml(booking.id)}">
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;

    // Bind actions
    bookingTableContainer.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", function () {
            const id = this.dataset.id;
            if (this.dataset.action === "edit") {
                editBooking(id);
            } else if (this.dataset.action === "delete") {
                deleteBooking(id);
            }
        });
    });
}

// Format Date
function formatDate(date) {
    if (!date) return "N/A";
    if (date.toDate) return date.toDate().toISOString().split("T")[0];
    return String(date).split("T")[0];
}

// Edit Booking
function editBooking(id) {
    const booking = allBookings.find(item => item.id === id);
    if (!booking) {
        alert("Booking not found.");
        return;
    }

    document.getElementById("bookingId").value = booking.id;
    document.getElementById("start_date").value = formatDate(booking.start_date);
    document.getElementById("end_date").value = formatDate(booking.end_date);
    document.getElementById("booking_status").value = booking.status || "Pending";

    bookingFormMessage.textContent = "";
    bookingFormContainer.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Save Booking Edit
if (bookingForm) {
    bookingForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const id = document.getElementById("bookingId").value;
        const startDate = document.getElementById("start_date").value;
        const endDate = document.getElementById("end_date").value;
        const status = document.getElementById("booking_status").value;

        if (!id) {
            bookingFormMessage.textContent = "Invalid booking ID.";
            bookingFormMessage.style.color = "red";
            return;
        }

        if (endDate <= startDate) {
            bookingFormMessage.textContent = "End date must be after start date.";
            bookingFormMessage.style.color = "red";
            return;
        }

        bookingFormMessage.textContent = "Updating booking record...";
        bookingFormMessage.style.color = "black";

        try {
            const bookingRef = db.collection("bookings").doc(id);
            const bookingDoc = await bookingRef.get();

            if (!bookingDoc.exists) {
                throw new Error("Booking not found.");
            }

            const booking = bookingDoc.data();
            const start = new Date(startDate + "T00:00:00");
            const end = new Date(endDate + "T00:00:00");
            const rentalDays = Math.round((end - start) / (1000 * 60 * 60 * 24));

            if (rentalDays <= 0) {
                throw new Error("Invalid rental duration.");
            }

            const pricePerDay = Number(booking.price_per_day || 0);
            const totalAmount = rentalDays * pricePerDay;

            await bookingRef.update({
                start_date: startDate,
                end_date: endDate,
                rental_days: rentalDays,
                total_amount: totalAmount,
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // If booking marked completed or cancelled, sync vehicle status to available
            if (booking.vehicleId) {
                const normStatus = status.toLowerCase();
                if (normStatus === "completed" || normStatus === "cancelled") {
                    await db.collection("vehicles").doc(booking.vehicleId).update({
                        status: "available",
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } else if (normStatus === "confirmed") {
                    await db.collection("vehicles").doc(booking.vehicleId).update({
                        status: "booked",
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            bookingFormMessage.textContent = "Booking updated successfully!";
            bookingFormMessage.style.color = "green";

            setTimeout(async function () {
                bookingFormContainer.classList.add("hidden");
                bookingForm.reset();
                await loadBookings();
            }, 600);

        } catch (error) {
            console.error("Booking update error:", error);
            bookingFormMessage.textContent = error.message;
            bookingFormMessage.style.color = "red";
        }
    });
}

// Delete Booking
async function deleteBooking(id) {
    const confirmed = confirm("Are you sure you want to delete this booking record?");
    if (!confirmed) return;

    try {
        await db.collection("bookings").doc(id).delete();
        alert("Booking deleted successfully.");
        await loadBookings();
    } catch (error) {
        console.error("Booking deletion error:", error);
        alert("Failed to delete booking: " + error.message);
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

// Auth listener
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        const isAdmin = await checkAdminAccess(user);
        if (isAdmin) {
            await loadBookings();
        }
    });
}
