// K3L Rentals - Vehicle Booking & Reservation Engine
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

const params = new URLSearchParams(window.location.search);
const vehicleId = params.get("id");

const vehicleSummary = document.getElementById("vehicleSummary");
const bookingForm = document.getElementById("bookingForm");
const bookingMessage = document.getElementById("bookingMessage");

let selectedVehicle = null;
let activeSchedules = [];

// Escape HTML utility
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Set minimum date input to today
function setMinDateLimits() {
    const today = new Date().toISOString().split("T")[0];
    const startDateInput = document.getElementById("start_date");
    const endDateInput = document.getElementById("end_date");
    if (startDateInput) startDateInput.min = today;
    if (endDateInput) endDateInput.min = today;
}

// Load selected vehicle details and its confirmed schedules
async function loadVehicle() {
    if (!vehicleId) {
        vehicleSummary.innerHTML = `
            <div class="info-card">
                <h3>Vehicle not selected</h3>
                <p>Please select a vehicle from our fleet catalog.</p>
                <a href="vehicles.html" class="primary-btn">Browse Vehicles</a>
            </div>
        `;
        if (bookingForm) bookingForm.style.display = "none";
        return;
    }

    try {
        const vehicleDoc = await db.collection("vehicles").doc(vehicleId).get();

        if (!vehicleDoc.exists) {
            vehicleSummary.innerHTML = `
                <div class="info-card">
                    <h3>Vehicle not found</h3>
                    <p>The selected vehicle does not exist or has been removed.</p>
                    <a href="vehicles.html" class="primary-btn">Browse Vehicles</a>
                </div>
            `;
            if (bookingForm) bookingForm.style.display = "none";
            return;
        }

        selectedVehicle = {
            id: vehicleDoc.id,
            ...vehicleDoc.data()
        };

        // Fetch active schedules for date conflict prevention
        try {
            const schedSnap = await db.collection("vehicles")
                .doc(vehicleId)
                .collection("schedules")
                .where("status", "==", "Confirmed")
                .get();

            activeSchedules = schedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn("Could not load schedules subcollection:", e);
            activeSchedules = [];
        }

        const category = String(selectedVehicle.category || "car").toLowerCase();
        const icon = category === "bike" ? "🏍️" : "🚗";
        const price = Number(selectedVehicle.price_per_day || 0);
        const status = String(selectedVehicle.status || "available").toLowerCase();

        // Render schedule pills if any exist
        let schedulesHtml = "";
        if (activeSchedules.length > 0) {
            const sorted = [...activeSchedules].sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
            schedulesHtml = `
                <div style="margin-top: 12px; background: #fffaf0; border: 1px solid #feebc8; padding: 10px; border-radius: 6px;">
                    <strong style="color: #c05621; font-size: 0.9rem;">📅 Current Booked Dates:</strong>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                        ${sorted.map(s => `
                            <span style="background: #feebc8; color: #7b341e; font-size: 0.8rem; padding: 2px 8px; border-radius: 4px; font-weight: 500;">
                                ${escapeHTML(s.start_date)} → ${escapeHTML(s.end_date)}
                            </span>
                        `).join("")}
                    </div>
                    <small style="color: #744210; display:block; margin-top:4px;">You can book any dates outside these ranges.</small>
                </div>
            `;
        }

        vehicleSummary.innerHTML = `
            <div class="info-card">
                <h2>${icon} ${escapeHTML(selectedVehicle.model || "Vehicle")}</h2>
                <p><strong>Category:</strong> ${icon} ${category.toUpperCase()} ${selectedVehicle.type ? " • " + escapeHTML(selectedVehicle.type) : ""}</p>
                <p><strong>Registration Number:</strong> ${escapeHTML(selectedVehicle.vehicle_number || "N/A")}</p>
                <p><strong>Location:</strong> 📍 ${escapeHTML(selectedVehicle.location || "Coimbatore")}</p>
                <p><strong>Daily Rate:</strong> <strong>₹${price.toLocaleString("en-IN")}</strong> / day</p>
                <p><strong>Fleet Status:</strong> <span class="admin-status ${status.replace(/[\s-]/g, "_")}">${escapeHTML(selectedVehicle.status || "available")}</span></p>
                ${schedulesHtml}
            </div>
        `;

        if (status === "maintenance") {
            bookingMessage.innerHTML = `
                <div class="info-card" style="border-left: 4px solid #e53e3e;">
                    <p style="color: #e53e3e; font-weight: bold;">⚠️ This vehicle is currently undergoing maintenance and is not taking reservations.</p>
                    <p>Please choose an available vehicle from our fleet.</p>
                    <a href="vehicles.html" class="primary-btn" style="display:inline-block; margin-top:10px;">Browse Available Vehicles</a>
                </div>
            `;
            if (bookingForm) bookingForm.style.display = "none";
        } else {
            if (bookingForm) bookingForm.style.display = "block";
            setMinDateLimits();
        }

    } catch (error) {
        console.error("Vehicle loading error:", error);
        vehicleSummary.innerHTML = `
            <div class="info-card">
                <h3>Unable to load vehicle</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
        if (bookingForm) bookingForm.style.display = "none";
    }
}

// Calculate duration and total on date change
function updatePriceEstimate() {
    const startDate = document.getElementById("start_date")?.value;
    const endDate = document.getElementById("end_date")?.value;
    const estimateElem = document.getElementById("priceEstimate");

    if (!startDate || !endDate || !selectedVehicle) {
        if (estimateElem) estimateElem.innerHTML = "";
        return;
    }

    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");

    if (end <= start) {
        if (estimateElem) {
            estimateElem.innerHTML = `<span style="color:#e53e3e; font-weight: 500;">End date must be after start date</span>`;
        }
        return;
    }

    // Check for overlap with active schedules
    const conflict = activeSchedules.find(s => {
        const sStatus = String(s.status || "").toLowerCase();
        if (sStatus !== "confirmed") return false;
        return s.start_date < endDate && s.end_date > startDate;
    });

    if (conflict) {
        if (estimateElem) {
            estimateElem.innerHTML = `
                <div style="background:#fff5f5; color:#c53030; padding:10px; border-radius:6px; margin: 12px 0; border:1px solid #feb2b2;">
                    ⚠️ <strong>Dates Unavailable:</strong> Conflicting reservation exists from <strong>${escapeHTML(conflict.start_date)}</strong> to <strong>${escapeHTML(conflict.end_date)}</strong>. Please pick alternative dates.
                </div>
            `;
        }
        return;
    }

    const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
    const price = Number(selectedVehicle.price_per_day || 0);
    const total = days * price;

    if (estimateElem) {
        estimateElem.innerHTML = `
            <div style="background:#f7fafc; padding:12px; border-radius:6px; margin: 12px 0; border:1px solid #e2e8f0;">
                <p><strong>Rental Duration:</strong> ${days} ${days === 1 ? 'day' : 'days'}</p>
                <p><strong>Estimated Total:</strong> <span style="font-size:1.2rem; color:#2b6cb0; font-weight:bold;">₹${total.toLocaleString("en-IN")}</span></p>
                <small style="color:#38a169;">✓ Dates available for booking</small>
            </div>
        `;
    }
}

// Add event listeners for dynamic price calculation
document.getElementById("start_date")?.addEventListener("change", updatePriceEstimate);
document.getElementById("end_date")?.addEventListener("change", updatePriceEstimate);

// Handle booking creation
if (bookingForm) {
    bookingForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const user = auth.currentUser;
        if (!user) {
            alert("Please login to complete your booking.");
            window.location.href = "login.html";
            return;
        }

        if (!selectedVehicle) {
            bookingMessage.textContent = "Vehicle details are not available.";
            bookingMessage.style.color = "red";
            return;
        }

        const startDate = document.getElementById("start_date").value;
        const endDate = document.getElementById("end_date").value;

        if (!startDate || !endDate) {
            bookingMessage.textContent = "Please select both start and end dates.";
            bookingMessage.style.color = "red";
            return;
        }

        const start = new Date(startDate + "T00:00:00");
        const end = new Date(endDate + "T00:00:00");

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            bookingMessage.textContent = "End date must be after the start date.";
            bookingMessage.style.color = "red";
            return;
        }

        const rentalDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        const submitButton = bookingForm.querySelector('button[type="submit"]');

        if (submitButton) {
            submitButton.disabled = true;
        }

        bookingMessage.textContent = "Validating dates and confirming booking...";
        bookingMessage.style.color = "black";

        try {
            // 1. Fresh conflict check against confirmed schedules in Firestore
            const freshSchedSnap = await db.collection("vehicles")
                .doc(vehicleId)
                .collection("schedules")
                .where("status", "==", "Confirmed")
                .get();

            let hasConflict = false;
            let conflictDetails = null;
            freshSchedSnap.forEach(doc => {
                const s = doc.data();
                if (s.start_date < endDate && s.end_date > startDate) {
                    hasConflict = true;
                    conflictDetails = s;
                }
            });

            if (hasConflict) {
                throw new Error(`This vehicle is already reserved from ${conflictDetails.start_date} to ${conflictDetails.end_date}. Please select different dates.`);
            }

            const pricePerDay = Number(selectedVehicle.price_per_day);
            if (!Number.isFinite(pricePerDay) || pricePerDay <= 0) {
                throw new Error("Invalid vehicle rental price.");
            }

            const totalAmount = rentalDays * pricePerDay;
            const category = String(selectedVehicle.category || "car").toLowerCase();

            // 2. Generate unified booking ID
            const newBookingRef = db.collection("bookings").doc();
            const bookingId = newBookingRef.id;

            // 3. Write private booking record
            await newBookingRef.set({
                userId: user.uid,
                customerName: user.displayName || user.email.split("@")[0],
                customerEmail: user.email,
                vehicleId: vehicleId,
                model: selectedVehicle.model || "",
                vehicle_number: selectedVehicle.vehicle_number || "",
                category: category,
                type: selectedVehicle.type || "",
                location: selectedVehicle.location || "Coimbatore",
                start_date: startDate,
                end_date: endDate,
                rental_days: rentalDays,
                price_per_day: pricePerDay,
                total_amount: totalAmount,
                status: "Confirmed",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // 4. Write public schedule slot under vehicle for availability tracking
            await db.collection("vehicles")
                .doc(vehicleId)
                .collection("schedules")
                .doc(bookingId)
                .set({
                    userId: user.uid,
                    start_date: startDate,
                    end_date: endDate,
                    status: "Confirmed",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            bookingMessage.innerHTML = `
                <div class="info-card" style="border-left: 4px solid #38a169;">
                    <h3 style="color:#2f855a; margin-top:0;">🎉 Booking Confirmed Successfully!</h3>
                    <p><strong>Booking ID:</strong> <code>${escapeHTML(bookingId)}</code></p>
                    <p><strong>Vehicle:</strong> ${escapeHTML(selectedVehicle.model)} (${escapeHTML(selectedVehicle.vehicle_number)})</p>
                    <p><strong>Rental Duration:</strong> ${rentalDays} days (${escapeHTML(startDate)} to ${escapeHTML(endDate)})</p>
                    <p><strong>Total Amount:</strong> <strong style="color:#2f855a;">₹${totalAmount.toLocaleString("en-IN")}</strong></p>
                    <p><strong>Status:</strong> <span class="admin-status booked">Confirmed</span></p>
                    <br>
                    <a href="my-bookings.html" class="primary-btn">View in My Bookings</a>
                </div>
            `;

            bookingForm.style.display = "none";

        } catch (error) {
            console.error("Booking error:", error);
            bookingMessage.innerHTML = `
                <div style="color: #e53e3e; background: #fff5f5; padding: 12px; border-radius: 6px; border: 1px solid #feb2b2;">
                    <strong>Booking Failed:</strong> ${escapeHTML(error.message || "Unable to complete booking. Please try again.")}
                </div>
            `;
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
}

// Authentication state listener
if (auth) {
    auth.onAuthStateChanged(function (user) {
        if (user) {
            loadVehicle();
        } else {
            window.location.href = "login.html";
        }
    });
} else {
    document.addEventListener("DOMContentLoaded", loadVehicle);
}
