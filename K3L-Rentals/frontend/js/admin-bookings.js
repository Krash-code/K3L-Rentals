
const auth = firebase.auth();
const db = firebase.firestore();

const bookingFormContainer =
    document.getElementById("bookingFormContainer");

const bookingForm =
    document.getElementById("bookingForm");

const cancelBookingEdit =
    document.getElementById("cancelBookingEdit");

const bookingFormMessage =
    document.getElementById("bookingFormMessage");

const bookingTableContainer =
    document.getElementById("bookingTableContainer");

let allBookings = [];
let currentAdmin = null;

// ------------------------------------
// ADMIN ACCESS CHECK
// ------------------------------------

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

        currentAdmin = user;
        return true;

    } catch (error) {
        console.error("Admin verification error:", error);

        bookingTableContainer.innerHTML = `
            <div class="info-card">
                <h3>Unable to verify admin access.</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;

        return false;
    }
}

// ------------------------------------
// LOGOUT
// ------------------------------------

document.getElementById("logoutBtn").addEventListener(
    "click",
    function () {
        logout();
    }
);

// ------------------------------------
// CANCEL EDIT
// ------------------------------------

cancelBookingEdit.addEventListener("click", function () {
    bookingFormContainer.classList.add("hidden");
    bookingForm.reset();
    bookingFormMessage.textContent = "";
});

// ------------------------------------
// LOAD BOOKINGS
// ------------------------------------

async function loadBookings() {
    try {
        bookingTableContainer.innerHTML = "<p>Loading bookings...</p>";

        const snapshot = await db
            .collection("bookings")
            .get();

        allBookings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        displayBookings(allBookings);

    } catch (error) {
        console.error("Booking loading error:", error);

        bookingTableContainer.innerHTML = `
            <div class="info-card">
                <h3>Unable to load bookings.</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

// ------------------------------------
// DISPLAY BOOKINGS
// ------------------------------------

function displayBookings(bookings) {
    if (bookings.length === 0) {
        bookingTableContainer.innerHTML = `
            <div class="info-card">
                <h3>No bookings found.</h3>
                <p>There are currently no customer bookings.</p>
            </div>
        `;
        return;
    }

    bookingTableContainer.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User ID</th>
                        <th>Vehicle</th>
                        <th>Vehicle Number</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>

                <tbody>
                    ${bookings.map(booking => `
                        <tr>
                            <td>${escapeHtml(booking.id)}</td>

                            <td>${escapeHtml(booking.userId || "N/A")}</td>

                            <td>
                                ${booking.category === "bike" ? "🏍️" : "🚗"}
                                ${escapeHtml(booking.model || "N/A")}
                            </td>

                            <td>
                                ${escapeHtml(booking.vehicle_number || "N/A")}
                            </td>

                            <td>${escapeHtml(formatDate(booking.start_date))}</td>

                            <td>${escapeHtml(formatDate(booking.end_date))}</td>

                            <td>
                                ₹${Number(booking.total_amount || 0).toLocaleString("en-IN")}
                            </td>

                            <td>
                                <span class="admin-status">
                                    ${escapeHtml(formatStatus(booking.status))}
                                </span>
                            </td>

                            <td>
                                <button
                                    class="table-btn edit-btn"
                                    data-id="${escapeHtml(booking.id)}"
                                    onclick="editBooking(this.dataset.id)">
                                    Edit
                                </button>

                                <button
                                    class="table-btn delete-btn"
                                    data-id="${escapeHtml(booking.id)}"
                                    onclick="deleteBooking(this.dataset.id)">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

// ------------------------------------
// FORMAT DATE
// ------------------------------------

function formatDate(date) {
    if (!date) return "N/A";

    if (date.toDate) {
        return date.toDate().toISOString().split("T")[0];
    }

    return String(date).split("T")[0];
}

// ------------------------------------
// FORMAT STATUS
// ------------------------------------

function formatStatus(status) {
    if (!status) return "Unknown";

    return String(status)
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

// ------------------------------------
// EDIT BOOKING
// ------------------------------------

function editBooking(id) {
    const booking = allBookings.find(item => item.id === id);

    if (!booking) {
        alert("Booking not found.");
        return;
    }

    document.getElementById("bookingId").value = booking.id;

    document.getElementById("start_date").value =
        formatDate(booking.start_date);

    document.getElementById("end_date").value =
        formatDate(booking.end_date);

    document.getElementById("booking_status").value =
        booking.status || "Pending";

    bookingFormMessage.textContent = "";

    bookingFormContainer.classList.remove("hidden");

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// ------------------------------------
// UPDATE BOOKING
// ------------------------------------

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
        bookingFormMessage.textContent =
            "End date must be after start date.";

        bookingFormMessage.style.color = "red";
        return;
    }

    bookingFormMessage.textContent = "Updating booking...";
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

        const rentalDays = Math.round(
            (end - start) / (1000 * 60 * 60 * 24)
        );

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

        bookingFormMessage.textContent =
            "Booking updated successfully!";

        bookingFormMessage.style.color = "green";

        setTimeout(async function () {
            bookingFormContainer.classList.add("hidden");
            bookingForm.reset();
            await loadBookings();
        }, 700);

    } catch (error) {
        console.error("Booking update error:", error);

        bookingFormMessage.textContent = error.message;
        bookingFormMessage.style.color = "red";
    }
});

// ------------------------------------
// DELETE BOOKING
// ------------------------------------

async function deleteBooking(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this booking?"
    );

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

// ------------------------------------
// ESCAPE HTML
// ------------------------------------

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ------------------------------------
// INITIAL LOAD
// ------------------------------------

auth.onAuthStateChanged(async function (user) {
    const isAdmin = await checkAdminAccess(user);

    if (isAdmin) {
        await loadBookings();
    }
});
