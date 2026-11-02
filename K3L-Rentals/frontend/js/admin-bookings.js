// K3L Rentals - Admin Booking Management & 4-Angle Inspection Engine
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

const bookingFormContainer = document.getElementById("bookingFormContainer");
const bookingForm = document.getElementById("bookingForm");
const cancelBookingEdit = document.getElementById("cancelBookingEdit");
const bookingFormMessage = document.getElementById("bookingFormMessage");
const bookingTableContainer = document.getElementById("bookingTableContainer");

const inspectionModal = document.getElementById("inspectionModal");
const closeInspectionModal = document.getElementById("closeInspectionModal");
const inspectionForm = document.getElementById("inspectionForm");
const inspectionMessage = document.getElementById("inspectionMessage");

let allBookings = [];
let currentAdmin = null;
let activeTab = "all";
let activeInspectionBooking = null;

let compressedPhotos = { front: null, back: null, left: null, right: null };

// Check Admin Access via /admins/{uid}
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
            bookingTableContainer.innerHTML = `<div class="info-card"><h3>Admin Verification Error</h3><p>${escapeHtml(error.message)}</p></div>`;
        }
        return false;
    }
}

// Compress File via Canvas to < 70KB
function compressImageFile(file, maxDimension = 750, quality = 0.6) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                let w = img.width;
                let h = img.height;
                if (w > maxDimension || h > maxDimension) {
                    if (w > h) {
                        h = Math.round((h * maxDimension) / w);
                        w = maxDimension;
                    } else {
                        w = Math.round((w * maxDimension) / h);
                        h = maxDimension;
                    }
                }
                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Setup photo listeners for inspection modal
function setupPhotoListeners() {
    const slots = [
        { id: "photoFront", prev: "prevFront", key: "front" },
        { id: "photoBack", prev: "prevBack", key: "back" },
        { id: "photoLeft", prev: "prevLeft", key: "left" },
        { id: "photoRight", prev: "prevRight", key: "right" }
    ];

    slots.forEach(s => {
        const input = document.getElementById(s.id);
        const img = document.getElementById(s.prev);
        if (input) {
            input.addEventListener("change", async function () {
                const file = this.files[0];
                if (!file) {
                    compressedPhotos[s.key] = null;
                    if (img) img.style.display = "none";
                    return;
                }
                const b64 = await compressImageFile(file);
                compressedPhotos[s.key] = b64;
                if (img && b64) {
                    img.src = b64;
                    img.style.display = "block";
                }
            });
        }
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

        allBookings.sort((a, b) => {
            const dateA = a.start_date || "";
            const dateB = b.start_date || "";
            return dateB.localeCompare(dateA);
        });

        renderBookings();

    } catch (error) {
        console.error("Booking loading error:", error);
        bookingTableContainer.innerHTML = `<div class="info-card"><h3>Unable to load bookings</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
}

// Render Bookings Table based on active tab
function renderBookings() {
    let list = allBookings;

    if (activeTab === "pending_review") {
        list = allBookings.filter(b => (b.status || "").toLowerCase() === "pending review" || (b.verification_status || "").toLowerCase() === "pending review");
    } else if (activeTab === "awaiting_advance") {
        list = allBookings.filter(b => (b.status || "").toLowerCase() === "awaiting advance");
    } else if (activeTab === "confirmed") {
        list = allBookings.filter(b => (b.status || "").toLowerCase() === "confirmed");
    } else if (activeTab === "active") {
        list = allBookings.filter(b => (b.status || "").toLowerCase() === "active" || (b.status || "").toLowerCase() === "in use" || (b.status || "").toLowerCase() === "in_use");
    } else if (activeTab === "completed") {
        list = allBookings.filter(b => (b.status || "").toLowerCase() === "completed");
    } else if (activeTab === "cancelled") {
        list = allBookings.filter(b => (b.status || "").toLowerCase() === "cancelled");
    }

    if (list.length === 0) {
        bookingTableContainer.innerHTML = `
            <div class="info-card" style="text-align: center; padding: 32px;">
                <h3>No bookings found in this category</h3>
                <p style="color: var(--slate-500); margin-top: 4px;">Switch tabs or create test bookings to see records here.</p>
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
                        <th>Vehicle &amp; Hub</th>
                        <th>Rental Period</th>
                        <th>Amounts</th>
                        <th>Status</th>
                        <th>Operations &amp; Handover</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(booking => {
                        const rawStatus = booking.status || "Pending Review";
                        const statusLower = rawStatus.toLowerCase();
                        const statusClass = statusLower.replace(/[\s-]/g, "_");
                        const category = String(booking.category || "car").toLowerCase();
                        const icon = category === "bike" ? "🏍️" : "🚗";
                        const total = Number(booking.total_amount || 0).toLocaleString("en-IN");
                        const advance = Number(booking.advance_amount || Math.round(Number(booking.total_amount || 0) * 0.25)).toLocaleString("en-IN");

                        let operationalBtn = "";
                        if (statusLower === "pending review" || (booking.verification_status || "").toLowerCase() === "pending review") {
                            operationalBtn = `
                                <a href="admin-verification.html" class="table-btn" style="background: #eff6ff; color: #1d4ed8; text-decoration: none; padding: 4px 8px; font-size: 0.78rem;">
                                    Verify Docs →
                                </a>
                            `;
                        } else if (statusLower === "confirmed") {
                            operationalBtn = `
                                <button class="table-btn" data-action="pickup-insp" data-id="${escapeHtml(booking.id)}" style="background: #ecfdf5; color: #065f46; font-size: 0.78rem; font-weight: 600;">
                                    🔑 Handover Vehicle
                                </button>
                            `;
                        } else if (statusLower === "active" || statusLower === "in_use" || statusLower === "in use") {
                            operationalBtn = `
                                <button class="table-btn" data-action="return-insp" data-id="${escapeHtml(booking.id)}" style="background: #fdf4ff; color: #7e22ce; font-size: 0.78rem; font-weight: 600;">
                                    🏁 Inspect &amp; Complete
                                </button>
                            `;
                        }

                        return `
                            <tr>
                                <td><code>${escapeHtml(booking.id.substring(0, 8))}...</code></td>
                                <td>
                                    <strong>${escapeHtml(booking.customerName || "Customer")}</strong><br>
                                    <small style="color: var(--slate-500);">${escapeHtml(booking.customerEmail || "")}</small><br>
                                    <small style="color: var(--slate-600);">${escapeHtml(booking.customerPhone || "")}</small>
                                </td>
                                <td>
                                    ${icon} <strong>${escapeHtml(booking.model || "Vehicle")}</strong><br>
                                    <code>${escapeHtml(booking.vehicle_number || "N/A")}</code><br>
                                    <small>📍 ${escapeHtml(booking.location || "Coimbatore")}</small>
                                </td>
                                <td>
                                    ${escapeHtml(booking.start_date || "")} → ${escapeHtml(booking.end_date || "")}<br>
                                    <small>(${booking.rental_days || 1} days)</small>
                                </td>
                                <td>
                                    <strong>Total: ₹${total}</strong><br>
                                    <small style="color: #2563eb;">Adv (25%): ₹${advance}</small><br>
                                    <small style="color: #64748b;">Pay: ${escapeHtml(booking.payment_status || "Awaiting")}</small>
                                </td>
                                <td>
                                    <span class="admin-status ${statusClass}">
                                        ${escapeHtml(rawStatus)}
                                    </span>
                                </td>
                                <td>
                                    <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                                        ${operationalBtn}
                                        ${(booking.pickup_inspection || booking.return_inspection) ? `
                                            <button class="table-btn" data-action="view-comparison" data-id="${escapeHtml(booking.id)}" style="background: #f1f5f9; color: #334155; font-size: 0.78rem;">
                                                🔍 Audit
                                            </button>
                                        ` : ''}
                                        <button class="table-btn edit-btn" data-action="edit" data-id="${escapeHtml(booking.id)}" style="padding: 4px 8px; font-size: 0.78rem;">
                                            Edit
                                        </button>
                                        <button class="table-btn delete-btn" data-action="delete" data-id="${escapeHtml(booking.id)}" style="padding: 4px 8px; font-size: 0.78rem;">
                                            Del
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;

    // Attach listeners
    bookingTableContainer.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", function () {
            const id = this.dataset.id;
            const action = this.dataset.action;
            const booking = allBookings.find(b => b.id === id);
            if (!booking) return;

            if (action === "edit") {
                editBooking(booking);
            } else if (action === "delete") {
                deleteBooking(id);
            } else if (action === "pickup-insp") {
                openInspectionModal(booking, "pickup");
            } else if (action === "return-insp") {
                openInspectionModal(booking, "return");
            } else if (action === "view-comparison") {
                openAdminComparisonModal(booking);
            }
        });
    });
}

// Open Inspection Modal (Pickup or Return)
function openInspectionModal(booking, type) {
    activeInspectionBooking = booking;
    document.getElementById("inspBookingId").value = booking.id;
    document.getElementById("inspType").value = type;

    const titleElem = document.getElementById("inspectionModalTitle");
    const infoElem = document.getElementById("inspectionVehicleInfo");
    const odoLabel = document.getElementById("odometerLabel");
    const fineGroup = document.getElementById("fineGroup");
    const confirmBtn = document.getElementById("saveInspectionBtn");
    const baselineSection = document.getElementById("pickupBaselineSection");
    const baselineStats = document.getElementById("pickupBaselineStats");
    const baselineGrid = document.getElementById("pickupBaselineGrid");
    const photoSectionTitle = document.getElementById("photoSectionTitle");

    // Reset fields
    document.getElementById("inspOdometer").value = "";
    document.getElementById("inspFuelLevel").value = "100%";
    document.getElementById("inspNotes").value = "";
    document.getElementById("inspFineAmount").value = "0";
    inspectionMessage.innerHTML = "";
    compressedPhotos = { front: null, back: null, left: null, right: null };

    ["prevFront", "prevBack", "prevLeft", "prevRight"].forEach(p => {
        const img = document.getElementById(p);
        if (img) img.style.display = "none";
    });
    ["photoFront", "photoBack", "photoLeft", "photoRight"].forEach(p => {
        const inp = document.getElementById(p);
        if (inp) inp.value = "";
    });

    if (type === "pickup") {
        titleElem.textContent = "🔑 Vehicle Pickup Inspection & Handover";
        odoLabel.textContent = "Starting Odometer Reading (KM) *";
        fineGroup.style.display = "none";
        confirmBtn.textContent = "Confirm Pickup & Handover to Customer";
        confirmBtn.style.background = "#16a34a";
        if (photoSectionTitle) photoSectionTitle.textContent = "📸 4-Angle Condition Photos (Front, Back, Left, Right) *";
        if (baselineSection) baselineSection.style.display = "none";
    } else {
        titleElem.textContent = "🏁 Vehicle Return Inspection & Trip Completion";
        odoLabel.textContent = "Return Odometer Reading (KM) *";
        fineGroup.style.display = "block";
        confirmBtn.textContent = "Complete Return & Mark Trip Completed";
        confirmBtn.style.background = "#2563eb";
        if (photoSectionTitle) photoSectionTitle.textContent = "📸 Return Condition Photos (Compare with Baseline Above) *";

        if (baselineSection && booking.pickup_inspection) {
            baselineSection.style.display = "block";
            const p = booking.pickup_inspection;
            baselineStats.innerHTML = `Starting Odometer: <strong>${Number(p.odometer_km || 0).toLocaleString("en-IN")} KM</strong> • Fuel: <strong>${escapeHtml(p.fuel_level || "100%")}</strong> • Notes: "${escapeHtml(p.notes || "Clean vehicle")}"`;
            const photos = p.photos || {};
            baselineGrid.innerHTML = `
                <div style="text-align: center;"><span style="font-size: 0.72rem; font-weight: 600; display: block; margin-bottom: 2px;">Front Baseline</span>${photos.front ? `<img src="${photos.front}" style="max-height: 80px; width: 100%; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1; background: white;">` : `<p style="font-size:0.75rem; color:#94a3b8;">None</p>`}</div>
                <div style="text-align: center;"><span style="font-size: 0.72rem; font-weight: 600; display: block; margin-bottom: 2px;">Back Baseline</span>${photos.back ? `<img src="${photos.back}" style="max-height: 80px; width: 100%; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1; background: white;">` : `<p style="font-size:0.75rem; color:#94a3b8;">None</p>`}</div>
                <div style="text-align: center;"><span style="font-size: 0.72rem; font-weight: 600; display: block; margin-bottom: 2px;">Left Baseline</span>${photos.left ? `<img src="${photos.left}" style="max-height: 80px; width: 100%; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1; background: white;">` : `<p style="font-size:0.75rem; color:#94a3b8;">None</p>`}</div>
                <div style="text-align: center;"><span style="font-size: 0.72rem; font-weight: 600; display: block; margin-bottom: 2px;">Right Baseline</span>${photos.right ? `<img src="${photos.right}" style="max-height: 80px; width: 100%; object-fit: contain; border-radius: 4px; border: 1px solid #cbd5e1; background: white;">` : `<p style="font-size:0.75rem; color:#94a3b8;">None</p>`}</div>
            `;
        } else if (baselineSection) {
            baselineSection.style.display = "none";
        }
    }

    infoElem.innerHTML = `
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div><strong>Vehicle:</strong> ${escapeHtml(booking.model)} (${escapeHtml(booking.vehicle_number)})</div>
            <div><strong>Customer:</strong> ${escapeHtml(booking.customerName)}</div>
            <div><strong>Dates:</strong> ${escapeHtml(booking.start_date)} to ${escapeHtml(booking.end_date)}</div>
            <div><strong>Balance to Collect at Pickup:</strong> ₹${Number(booking.balance_amount || 0).toLocaleString("en-IN")}</div>
        </div>
    `;

    inspectionModal.style.display = "flex";
}

if (closeInspectionModal) {
    closeInspectionModal.addEventListener("click", () => {
        inspectionModal.style.display = "none";
        activeInspectionBooking = null;
    });
}

// Save Inspection Submission
if (inspectionForm) {
    inspectionForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!activeInspectionBooking) return;

        const b = activeInspectionBooking;
        const type = document.getElementById("inspType").value;
        const odo = document.getElementById("inspOdometer").value;
        const fuel = document.getElementById("inspFuelLevel").value;
        const notes = document.getElementById("inspNotes").value.trim();
        const fine = Number(document.getElementById("inspFineAmount").value || 0);

        if (!compressedPhotos.front || !compressedPhotos.back || !compressedPhotos.left || !compressedPhotos.right) {
            inspectionMessage.innerHTML = `<span style="color:red;">Please capture/upload condition photos for all 4 angles (Front, Back, Left, Right).</span>`;
            return;
        }

        const confirmBtn = document.getElementById("saveInspectionBtn");
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Saving Inspection Photos & Updating Fleet...";

        try {
            const inspectionPayload = {
                odometer_km: Number(odo),
                fuel_level: fuel,
                notes: notes,
                fine_amount: fine,
                photos: compressedPhotos,
                inspector_admin_id: currentAdmin.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (type === "pickup") {
                // Update booking to Active
                await db.collection("bookings").doc(b.id).update({
                    status: "Active",
                    pickup_inspection: inspectionPayload,
                    actual_pickup_time: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Set vehicle status to in_use
                if (b.vehicleId) {
                    await db.collection("vehicles").doc(b.vehicleId).update({
                        status: "in_use",
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(console.warn);
                }

                // Notify customer
                if (b.userId) {
                    await db.collection("users").doc(b.userId).collection("notifications").add({
                        title: "Vehicle Handover Completed",
                        message: `Your rental for ${b.model} is now active! Starting km: ${odo}. Have a safe journey!`,
                        type: "handover",
                        bookingId: b.id,
                        read: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(console.warn);
                }

                alert("✓ Vehicle handed over successfully. Booking marked Active.");

            } else {
                // Return inspection & trip completion
                await db.collection("bookings").doc(b.id).update({
                    status: "Completed",
                    return_inspection: inspectionPayload,
                    actual_return_time: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Release vehicle back to available
                if (b.vehicleId) {
                    await db.collection("vehicles").doc(b.vehicleId).update({
                        status: "available",
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(console.warn);

                    // Mark schedule completed
                    await db.collection("vehicles").doc(b.vehicleId).collection("schedules").doc(b.id).update({
                        status: "Completed",
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(console.warn);
                }

                // Notify customer
                if (b.userId) {
                    await db.collection("users").doc(b.userId).collection("notifications").add({
                        title: "Trip Completed! Thank you",
                        message: `Your trip with ${b.model} has been marked Completed. Thank you for choosing K3L Rentals!`,
                        type: "completed",
                        bookingId: b.id,
                        read: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(console.warn);
                }

                alert("✓ Vehicle return confirmed! Booking marked Completed and vehicle released to available fleet.");
            }

            inspectionModal.style.display = "none";
            activeInspectionBooking = null;
            await loadBookings();

        } catch (err) {
            console.error("Inspection error:", err);
            inspectionMessage.innerHTML = `<span style="color:red;">Error saving inspection: ${escapeHtml(err.message)}</span>`;
        } finally {
            confirmBtn.disabled = false;
        }
    });
}

// Edit Booking
function editBooking(booking) {
    document.getElementById("bookingId").value = booking.id;
    document.getElementById("start_date").value = booking.start_date || "";
    document.getElementById("end_date").value = booking.end_date || "";
    document.getElementById("booking_status").value = booking.status || "Pending Review";

    bookingFormMessage.textContent = "";
    bookingFormContainer.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

if (cancelBookingEdit) {
    cancelBookingEdit.addEventListener("click", () => {
        bookingFormContainer.classList.add("hidden");
    });
}

// Save Edit
if (bookingForm) {
    bookingForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const id = document.getElementById("bookingId").value;
        const startDate = document.getElementById("start_date").value;
        const endDate = document.getElementById("end_date").value;
        const status = document.getElementById("booking_status").value;

        if (endDate <= startDate) {
            bookingFormMessage.textContent = "End date must be after start date.";
            bookingFormMessage.style.color = "red";
            return;
        }

        try {
            const b = allBookings.find(item => item.id === id);
            const start = new Date(startDate + "T00:00:00");
            const end = new Date(endDate + "T00:00:00");
            const rentalDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
            const price = Number(b.price_per_day || 0);
            const total = rentalDays * price;
            const advance = Math.round(total * 0.25);
            const balance = total - advance;

            await db.collection("bookings").doc(id).update({
                start_date: startDate,
                end_date: endDate,
                rental_days: rentalDays,
                total_amount: total,
                advance_amount: advance,
                balance_amount: balance,
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Sync vehicle if needed
            if (b && b.vehicleId) {
                const sLow = status.toLowerCase();
                if (sLow === "completed" || sLow === "cancelled") {
                    await db.collection("vehicles").doc(b.vehicleId).update({ status: "available" }).catch(console.warn);
                } else if (sLow === "active") {
                    await db.collection("vehicles").doc(b.vehicleId).update({ status: "in_use" }).catch(console.warn);
                }
            }

            bookingFormMessage.textContent = "✓ Booking updated!";
            bookingFormMessage.style.color = "green";

            setTimeout(async () => {
                bookingFormContainer.classList.add("hidden");
                await loadBookings();
            }, 600);

        } catch (err) {
            console.error("Booking update error:", err);
            bookingFormMessage.textContent = err.message;
            bookingFormMessage.style.color = "red";
        }
    });
}

// Delete Booking
async function deleteBooking(id) {
    const ok = confirm("Are you sure you want to delete this booking record?");
    if (!ok) return;

    try {
        await db.collection("bookings").doc(id).delete();
        alert("Booking record removed.");
        await loadBookings();
    } catch (err) {
        alert("Failed to delete: " + err.message);
    }
}

// Tab filtering
document.querySelectorAll(".admin-tab-btn").forEach(btn => {
    btn.addEventListener("click", function () {
        document.querySelectorAll(".admin-tab-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        activeTab = this.dataset.tab;
        renderBookings();
    });
});

// Admin Side-by-Side Damage Audit & Condition Modal
function openAdminComparisonModal(b) {
    const modal = document.getElementById("adminComparisonModal");
    const body = document.getElementById("adminComparisonBody");
    if (!modal || !body) return;

    const p = b.pickup_inspection || {};
    const r = b.return_inspection || {};

    const pPhotos = p.photos || {};
    const rPhotos = r.photos || {};

    const startKm = p.odometer_km ? `${Number(p.odometer_km).toLocaleString("en-IN")} KM` : "Not recorded";
    const endKm = r.odometer_km ? `${Number(r.odometer_km).toLocaleString("en-IN")} KM` : "Pending Return";
    const netKm = (p.odometer_km && r.odometer_km) ? `${(Number(r.odometer_km) - Number(p.odometer_km)).toLocaleString("en-IN")} KM driven` : "--";

    const angles = [
        { label: "Front Angle", pImg: pPhotos.front, rImg: rPhotos.front },
        { label: "Back Angle", pImg: pPhotos.back, rImg: rPhotos.back },
        { label: "Left Side Profile", pImg: pPhotos.left, rImg: rPhotos.left },
        { label: "Right Side Profile", pImg: pPhotos.right, rImg: rPhotos.right }
    ];

    body.innerHTML = `
        <div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 0.9rem;">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div><strong>Vehicle:</strong> ${escapeHtml(b.model)} (<code>${escapeHtml(b.vehicle_number)}</code>)</div>
                <div><strong>Customer:</strong> ${escapeHtml(b.customerName)} (${escapeHtml(b.customerPhone || "")})</div>
                <div><strong>Dates:</strong> ${escapeHtml(b.start_date)} → ${escapeHtml(b.end_date)}</div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 12px; font-size: 0.85rem; border-top: 1px dashed var(--slate-300); padding-top: 10px;">
                <div><span style="color:var(--slate-500);">Pickup Odometer:</span><br><strong>${startKm}</strong></div>
                <div><span style="color:var(--slate-500);">Return Odometer:</span><br><strong>${endKm}</strong></div>
                <div><span style="color:var(--slate-500);">Net Distance:</span><br><strong style="color:#2563eb;">${netKm}</strong></div>
                <div><span style="color:var(--slate-500);">Pickup Fuel:</span><br><strong>${escapeHtml(p.fuel_level || "100%")}</strong></div>
                <div><span style="color:var(--slate-500);">Return Fuel:</span><br><strong>${escapeHtml(r.fuel_level || "--")}</strong></div>
            </div>
        </div>

        <h4 style="font-size: 0.95rem; margin-bottom: 10px; color: var(--slate-800);">📸 4-Angle Side-by-Side Photographic Verification</h4>
        <div style="display: flex; flex-direction: column; gap: 12px;">
            ${angles.map(a => `
                <div style="border: 1px solid var(--slate-200); border-radius: 8px; padding: 10px; background: white;">
                    <strong style="display: block; font-size: 0.85rem; color: var(--slate-700); margin-bottom: 6px;">${a.label}</strong>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="background: var(--slate-50); padding: 8px; border-radius: 6px; text-align: center;">
                            <span style="font-size: 0.75rem; color: #166534; font-weight: 600; display: block; margin-bottom: 4px;">Pickup Baseline</span>
                            ${a.pImg ? `<img src="${a.pImg}" alt="Pickup ${a.label}" style="max-height: 130px; width: 100%; object-fit: contain; border-radius: 4px;">` : `<p style="font-size: 0.78rem; color: var(--slate-400); padding: 15px 0;">No photo recorded</p>`}
                        </div>
                        <div style="background: var(--slate-50); padding: 8px; border-radius: 6px; text-align: center;">
                            <span style="font-size: 0.75rem; color: #1e40af; font-weight: 600; display: block; margin-bottom: 4px;">Return State</span>
                            ${a.rImg ? `<img src="${a.rImg}" alt="Return ${a.label}" style="max-height: 130px; width: 100%; object-fit: contain; border-radius: 4px;">` : `<p style="font-size: 0.78rem; color: var(--slate-400); padding: 15px 0;">Pending return</p>`}
                        </div>
                    </div>
                </div>
            `).join("")}
        </div>

        <div style="margin-top: 16px; background: var(--surface-alt); border-radius: 8px; padding: 12px; font-size: 0.88rem;">
            <div><strong>Pickup Staff Notes:</strong> ${escapeHtml(p.notes || "Vehicle handed over clean.")}</div>
            <div style="margin-top: 6px;"><strong>Return Inspection Notes:</strong> ${escapeHtml(r.notes || "Return inspection pending.")}</div>
            ${r.fine_amount > 0 ? `
                <div style="margin-top: 8px; color: #dc2626; font-weight: 700;">
                    ⚠️ Damage / Late Fine Assessed: ₹${Number(r.fine_amount).toLocaleString("en-IN")}
                </div>
            ` : `
                <div style="margin-top: 8px; color: #16a34a; font-weight: 600;">
                    ✓ Zero damages recorded. Return verified.
                </div>
            `}
        </div>
    `;

    modal.style.display = "flex";
}

const closeAdminComparisonModal = document.getElementById("closeAdminComparisonModal");
if (closeAdminComparisonModal) {
    closeAdminComparisonModal.addEventListener("click", () => {
        document.getElementById("adminComparisonModal").style.display = "none";
    });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initial Auth Listener
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        const isAdmin = await checkAdminAccess(user);
        if (isAdmin) {
            setupPhotoListeners();
            await loadBookings();
        }
    });
}
