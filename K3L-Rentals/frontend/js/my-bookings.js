// K3L Rentals - Customer Bookings Management & 25% Advance Payment Engine
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

let myBookings = [];
let activeFilter = "all";
let activePayBooking = null;
let activeResubmitBooking = null;

let resubmitCompressedId = null;
let resubmitCompressedDl = null;

const container = document.getElementById("bookingsContainer");
const actionNotice = document.getElementById("bookingActionNotice");

const paymentModal = document.getElementById("paymentModal");
const closePaymentModal = document.getElementById("closePaymentModal");
const paymentSubmissionForm = document.getElementById("paymentSubmissionForm");
const paymentFormMessage = document.getElementById("paymentFormMessage");
const copyUpiBtn = document.getElementById("copyUpiBtn");

const resubmitModal = document.getElementById("resubmitModal");
const closeResubmitModal = document.getElementById("closeResubmitModal");
const resubmitForm = document.getElementById("resubmitForm");
const resubmitMessage = document.getElementById("resubmitMessage");

// Utility: Escape HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Compress file to base64 JPEG via HTML5 Canvas
function compressImageFile(file, maxDimension = 900, quality = 0.65) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);
        if (!file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                let width = img.width;
                let height = img.height;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Load authenticated user's bookings
async function loadMyBookings() {
    if (!container) return;

    const user = auth.currentUser;
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    container.innerHTML = "<p>Loading your reservations...</p>";

    try {
        const snapshot = await db.collection("bookings")
            .where("userId", "==", user.uid)
            .get();

        myBookings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort latest first
        myBookings.sort((a, b) => {
            const dateA = a.start_date || "";
            const dateB = b.start_date || "";
            return dateB.localeCompare(dateA);
        });

        renderBookingsList();

    } catch (err) {
        console.error("Load bookings error:", err);
        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load bookings</h3>
                <p>${escapeHTML(err.message)}</p>
            </div>
        `;
    }
}

// Render list filtered by active tab
function renderBookingsList() {
    let list = myBookings;

    if (activeFilter === "pending_review") {
        list = myBookings.filter(b => b.verification_status === "Pending Review" || (b.status === "Pending Review" && b.verification_status !== "Approved" && b.verification_status !== "Rejected"));
    } else if (activeFilter === "documents_approved") {
        list = myBookings.filter(b => b.verification_status === "Approved");
    } else if (activeFilter === "awaiting_advance") {
        list = myBookings.filter(b => b.verification_status === "Approved" && b.payment_status !== "Paid" && b.payment_status !== "Pending Verification");
    } else if (activeFilter === "payment_pending_verification") {
        list = myBookings.filter(b => b.payment_status === "Pending Verification");
    } else if (activeFilter === "confirmed") {
        list = myBookings.filter(b => b.status === "Confirmed");
    } else if (activeFilter === "active") {
        list = myBookings.filter(b => b.status === "Active" || b.status === "In Use" || b.status === "in_use");
    } else if (activeFilter === "completed") {
        list = myBookings.filter(b => b.status === "Completed");
    } else if (activeFilter === "rejected") {
        list = myBookings.filter(b => b.verification_status === "Rejected" || b.status === "Rejected");
    } else if (activeFilter === "cancelled") {
        list = myBookings.filter(b => b.status === "Cancelled");
    }

    if (list.length === 0) {
        container.innerHTML = `
            <div class="info-card" style="text-align: center; padding: 40px 20px;">
                <h3>No bookings found in this view</h3>
                <p style="color: var(--slate-500); margin-top: 6px;">
                    ${myBookings.length === 0 ? "You have not placed any reservations yet." : "No bookings match this filter."}
                </p>
                <div style="margin-top: 16px;">
                    <a href="vehicles.html" class="primary-btn">Browse Fleet &amp; Reserve</a>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(booking => renderBookingCard(booking)).join("");

    // Attach button listeners
    container.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", function () {
            const action = this.dataset.action;
            const bookingId = this.dataset.id;
            const b = myBookings.find(item => item.id === bookingId);
            if (!b) return;

            if (action === "pay-advance") {
                openPaymentModal(b);
            } else if (action === "resubmit-docs") {
                openResubmitModal(b);
            } else if (action === "cancel-booking") {
                cancelCustomerBooking(b);
            } else if (action === "start-tracking") {
                startCustomerTracking(b);
            } else if (action === "stop-tracking") {
                stopCustomerTracking(b);
            } else if (action === "view-inspection") {
                openCustomerInspectionModal(b);
            } else if (action === "view-receipt") {
                openCustomerReceiptModal(b);
            }
        });
    });
}

// Build Lifecycle Stepper HTML
function renderStepper(b) {
    const vStatus = b.verification_status || "Pending Review";
    const pStatus = b.payment_status || "Awaiting Approval";
    const status = (b.status || "").toLowerCase();

    // Step 1: Request
    const s1Class = "completed";

    // Step 2: Verification
    let s2Class = "step-circle";
    let s2Label = "Under Review";
    if (vStatus === "Approved") {
        s2Class += " completed";
        s2Label = "Verified";
    } else if (vStatus === "Rejected") {
        s2Class += " rejected";
        s2Label = "Rejected";
    } else {
        s2Class += " active";
    }

    // Step 3: Advance Payment
    let s3Class = "step-circle";
    let s3Label = "25% Advance";
    if (pStatus === "Paid") {
        s3Class += " completed";
        s3Label = "Advance Paid";
    } else if (pStatus === "Pending Verification") {
        s3Class += " active";
        s3Label = "Verifying UTR";
    } else if (vStatus === "Approved") {
        s3Class += " active";
        s3Label = "Pay Advance";
    }

    // Step 4: Reservation Confirmation
    let s4Class = "step-circle";
    let s4Label = "Confirmed Lock";
    if (status === "confirmed" || status === "active" || status === "completed") {
        s4Class += " completed";
        s4Label = status === "completed" ? "Trip Finished" : "Confirmed";
    }

    return `
        <div class="stepper-container" style="background: var(--slate-50); padding: 14px 16px; border-radius: 8px; border: 1px solid var(--slate-200); margin: 16px 0;">
            <div class="stepper-step">
                <div class="step-circle ${s1Class}">1</div>
                <div class="step-label">Submitted</div>
            </div>
            <div style="flex: 1; height: 2px; background: ${vStatus === 'Approved' ? '#16a34a' : (vStatus === 'Rejected' ? '#dc2626' : '#cbd5e1')}; margin: 0 4px; margin-bottom: 20px;"></div>

            <div class="stepper-step">
                <div class="${s2Class}">2</div>
                <div class="step-label">${s2Label}</div>
            </div>
            <div style="flex: 1; height: 2px; background: ${pStatus === 'Paid' ? '#16a34a' : '#cbd5e1'}; margin: 0 4px; margin-bottom: 20px;"></div>

            <div class="stepper-step">
                <div class="${s3Class}">3</div>
                <div class="step-label">${s3Label}</div>
            </div>
            <div style="flex: 1; height: 2px; background: ${status === 'confirmed' ? '#16a34a' : '#cbd5e1'}; margin: 0 4px; margin-bottom: 20px;"></div>

            <div class="stepper-step">
                <div class="${s4Class}">4</div>
                <div class="step-label">${s4Label}</div>
            </div>
        </div>
    `;
}

// Render individual booking card
function renderBookingCard(b) {
    const totalAmount = Number(b.total_amount || 0);
    const advanceRequired = Number(b.advance_amount || Math.round(totalAmount * 0.25));
    const status = (b.status || "Pending Review");
    const statusLower = status.toLowerCase();
    const vStatus = b.verification_status || "Pending Review";
    const pStatus = b.payment_status || "Awaiting Approval";
    const category = String(b.category || "car").toLowerCase();
    const icon = category === "bike" ? "🏍️" : "🚗";

    const isAdvancePaid = pStatus === "Paid";
    const advancePaid = isAdvancePaid ? advanceRequired : 0;
    const remainingRentalBalance = totalAmount - advancePaid;
    const damagePenalty = Number(b.damage_penalty || b.return_inspection?.fine_amount || b.return_inspection?.damage_penalty || 0);
    const totalOutstanding = remainingRentalBalance + damagePenalty;

    const isCancellable = statusLower !== "cancelled" && statusLower !== "completed";

    // Callout messages based on current phase
    let phaseCallout = "";

    if (vStatus === "Rejected") {
        phaseCallout = `
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin: 12px 0;">
                <strong style="color: #991b1b; display: block; font-size: 0.92rem;">⚠️ Documents Were Not Approved:</strong>
                <p style="color: #b91c1c; font-size: 0.88rem; margin: 4px 0 10px;">
                    "${escapeHTML(b.rejection_reason || "Document details could not be verified.")}"
                </p>
                <button class="primary-btn" data-action="resubmit-docs" data-id="${escapeHTML(b.id)}" style="padding: 7px 16px; font-size: 0.85rem;">
                    Resubmit Corrected Documents
                </button>
            </div>
        `;
    } else if (vStatus === "Approved" && pStatus !== "Paid" && pStatus !== "Pending Verification") {
        phaseCallout = `
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px; margin: 12px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                <div>
                    <strong style="color: #1e40af; display: block; font-size: 0.95rem;">🎉 Identity Documents Approved!</strong>
                    <p style="color: #1d4ed8; font-size: 0.85rem; margin-top: 2px;">
                        Pay the mandatory 25% advance (<strong>₹${advanceRequired.toLocaleString("en-IN")}</strong>) to secure and lock your vehicle reservation.
                    </p>
                </div>
                <button class="primary-btn" data-action="pay-advance" data-id="${escapeHTML(b.id)}" style="background: #2563eb; padding: 10px 20px; font-size: 0.95rem;">
                    Pay 25% Advance (₹${advanceRequired.toLocaleString("en-IN")}) →
                </button>
            </div>
        `;
    } else if (pStatus === "Pending Verification") {
        phaseCallout = `
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 14px; margin: 12px 0;">
                <strong style="color: #92400e; font-size: 0.9rem;">⏳ Advance Payment Reference Under Admin Verification</strong>
                <p style="color: #b45309; font-size: 0.85rem; margin-top: 2px;">
                    We are verifying your transaction UTR <code>${escapeHTML(b.utr_number || "")}</code>. Once matched with our bank/UPI account, your reservation will be marked Confirmed!
                </p>
            </div>
        `;
    } else if (statusLower === "confirmed") {
        phaseCallout = `
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 14px; margin: 12px 0;">
                <strong style="color: #065f46; font-size: 0.9rem;">✓ Vehicle Reservation Confirmed!</strong>
                <p style="color: #047857; font-size: 0.85rem; margin-top: 2px;">
                    25% advance of ₹${advanceRequired.toLocaleString("en-IN")} received. Please carry your original Driving Licence and pay remaining rental balance of ₹${remainingRentalBalance.toLocaleString("en-IN")} at vehicle pickup.
                </p>
            </div>
        `;
    } else if (statusLower === "active" || statusLower === "in use" || statusLower === "in_use") {
        const isSharing = b.tracking && b.tracking.is_sharing;
        phaseCallout = `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin: 12px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <strong style="color: #166534; font-size: 0.92rem;">🚗 Trip Active • Vehicle Handed Over</strong>
                        <p style="color: #15803d; font-size: 0.84rem; margin-top: 2px;">
                            Starting km: <strong>${escapeHTML(b.pickup_inspection?.odometer_km || "Recorded")}</strong> • Fuel: <strong>${escapeHTML(b.pickup_inspection?.fuel_level || "Full")}</strong>
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="primary-btn" data-action="${isSharing ? 'stop-tracking' : 'start-tracking'}" data-id="${escapeHTML(b.id)}" style="background: ${isSharing ? '#dc2626' : '#16a34a'}; padding: 6px 14px; font-size: 0.82rem;">
                            ${isSharing ? '🛑 Stop Sharing Location' : '📡 Share Live Trip Location'}
                        </button>
                    </div>
                </div>
                <div id="tracking-status-${escapeHTML(b.id)}" style="margin-top: 8px; font-size: 0.8rem; color: #166534;">
                    ${isSharing
                        ? `🟢 Location Sharing is ACTIVE (Accurate to ±${b.tracking.accuracy_m || 10}m)`
                        : `ℹ️ Voluntary live location sharing aids roadside safety and assistance while your rental is active.`}
                </div>
            </div>
        `;
    } else if (statusLower === "completed") {
        phaseCallout = `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin: 12px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <div>
                    <strong style="color: #0f172a; font-size: 0.9rem;">🏁 Trip Completed</strong>
                    <p style="color: #64748b; font-size: 0.84rem; margin-top: 2px;">
                        Vehicle returned and verified. Thank you for renting with K3L Rentals!
                    </p>
                </div>
            </div>
        `;
    }

    return `
        <div class="booking-item" style="border: 1px solid var(--slate-200); border-radius: 12px; padding: 22px; margin-bottom: 20px; background: white; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.4rem;">${icon}</span>
                        <h2 style="margin: 0; font-size: 1.25rem; color: var(--slate-900);">${escapeHTML(b.model || "Vehicle")}</h2>
                        <span style="background: var(--slate-100); padding: 3px 8px; border-radius: 4px; font-family: monospace; font-size: 0.85rem;">
                            ${escapeHTML(b.vehicle_number || "N/A")}
                        </span>
                    </div>
                    <p style="font-size: 0.85rem; color: var(--slate-500); margin-top: 4px;">
                        Booking ID: <code>${escapeHTML(b.id)}</code> • Hub: 📍 ${escapeHTML(b.location || "Coimbatore")}
                    </p>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="admin-status ${statusLower.replace(/[\s-]/g, '_')}">
                        ${escapeHTML(status)}
                    </span>
                    ${isCancellable ? `
                        <button class="table-btn delete-btn" data-action="cancel-booking" data-id="${escapeHTML(b.id)}" style="padding: 6px 12px; font-size: 0.8rem;">
                            Cancel Booking
                        </button>
                    ` : ''}
                </div>
            </div>

            ${renderStepper(b)}

            <!-- Distinct 5-Point Financial & Period Summary Grid -->
            <div style="background: var(--surface-alt); padding: 16px; border-radius: 10px; border: 1px solid var(--slate-200); margin: 14px 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--slate-200); padding-bottom: 8px;">
                    <span style="font-size: 0.85rem; color: var(--slate-600); font-weight: 600;">
                        📅 Rental Period: <strong>${escapeHTML(b.start_date || "")} → ${escapeHTML(b.end_date || "")}</strong> (${b.rental_days || 1} days @ ₹${Number(b.price_per_day || 0).toLocaleString("en-IN")}/day)
                    </span>
                    <span style="font-size: 0.8rem; background: var(--slate-200); padding: 2px 8px; border-radius: 4px;">
                        ${isAdvancePaid ? '✓ Advance Settled' : 'Advance Pending'}
                    </span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; font-size: 0.86rem;">
                    <div>
                        <span style="color: var(--slate-500); display: block; font-size: 0.74rem; text-transform: uppercase;">1. Total Rental</span>
                        <strong style="color: var(--slate-900); font-size: 0.95rem;">₹${totalAmount.toLocaleString("en-IN")}</strong>
                        <small style="display: block; color: var(--slate-500); font-size: 0.72rem;">Full rental charge</small>
                    </div>
                    <div>
                        <span style="color: var(--slate-500); display: block; font-size: 0.74rem; text-transform: uppercase;">2. 25% Advance</span>
                        <strong style="color: ${isAdvancePaid ? '#16a34a' : '#2563eb'}; font-size: 0.95rem;">₹${advancePaid.toLocaleString("en-IN")}</strong>
                        <small style="display: block; color: ${isAdvancePaid ? '#16a34a' : '#2563eb'}; font-size: 0.72rem;">${isAdvancePaid ? '✓ Paid' : `Due: ₹${advanceRequired.toLocaleString("en-IN")}`}</small>
                    </div>
                    <div>
                        <span style="color: var(--slate-500); display: block; font-size: 0.74rem; text-transform: uppercase;">3. 75% Balance</span>
                        <strong style="color: var(--slate-900); font-size: 0.95rem;">₹${remainingRentalBalance.toLocaleString("en-IN")}</strong>
                        <small style="display: block; color: var(--slate-500); font-size: 0.72rem;">Due at pickup</small>
                    </div>
                    <div>
                        <span style="color: var(--slate-500); display: block; font-size: 0.74rem; text-transform: uppercase;">4. Damage Penalty</span>
                        <strong style="color: ${damagePenalty > 0 ? '#dc2626' : 'var(--slate-700)'}; font-size: 0.95rem;">₹${damagePenalty.toLocaleString("en-IN")}</strong>
                        <small style="display: block; color: ${damagePenalty > 0 ? '#dc2626' : 'var(--slate-500)'}; font-size: 0.72rem;">${damagePenalty > 0 ? 'Assessed fine' : 'Nil (₹0)'}</small>
                    </div>
                    <div style="background: #f1f5f9; padding: 6px 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <span style="color: #0f172a; display: block; font-size: 0.74rem; text-transform: uppercase; font-weight: 700;">5. Net Outstanding</span>
                        <strong style="color: #0f172a; font-size: 1.05rem;">₹${totalOutstanding.toLocaleString("en-IN")}</strong>
                        <small style="display: block; color: #475569; font-size: 0.72rem;">Amount payable</small>
                    </div>
                </div>
            </div>

            ${phaseCallout}

            <!-- Action Toolbar for Receipt and Inspection -->
            <div style="display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; justify-content: flex-end;">
                ${(statusLower === "confirmed" || statusLower === "active" || statusLower === "completed") ? `
                    <button class="secondary-btn" data-action="view-receipt" data-id="${escapeHTML(b.id)}" style="padding: 6px 14px; font-size: 0.82rem;">
                        🧾 View / Print Receipt
                    </button>
                ` : ''}
                ${(b.pickup_inspection || b.return_inspection) ? `
                    <button class="secondary-btn" data-action="view-inspection" data-id="${escapeHTML(b.id)}" style="padding: 6px 14px; font-size: 0.82rem;">
                        📸 Vehicle Condition Report
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// Open 25% Advance Payment Modal
function openPaymentModal(booking) {
    activePayBooking = booking;
    const summary = document.getElementById("paymentModalSummary");
    const bookingIdInput = document.getElementById("payModalBookingId");
    const upiQrImage = document.getElementById("upiQrImage");
    const utrInput = document.getElementById("utrNumberInput");

    bookingIdInput.value = booking.id;
    utrInput.value = "";
    paymentFormMessage.innerHTML = "";

    const total = Number(booking.total_amount || 0);
    const advance = Number(booking.advance_amount || Math.round(total * 0.25));

    summary.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Vehicle:</span>
            <strong>${escapeHTML(booking.model)} (${escapeHTML(booking.vehicle_number)})</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span>Total Rental Amount:</span>
            <span>₹${total.toLocaleString("en-IN")}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 1.05rem; color: #2563eb; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
            <strong>25% Advance Payable Now:</strong>
            <strong>₹${advance.toLocaleString("en-IN")}</strong>
        </div>
    `;

    // Generate UPI QR URI for configured receiving account (Ms Krishma Priya S / K3L Rentals):
    const receivingUpi = "9486886986@ybl";
    const payeeName = "Ms Krishma Priya S";
    const upiUri = `upi://pay?pa=${receivingUpi}&pn=${encodeURIComponent(payeeName)}&am=${advance}&tn=K3L-Rental-${booking.id.substring(0, 8)}&cu=INR`;
    upiQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUri)}`;

    paymentModal.style.display = "flex";
}

if (closePaymentModal) {
    closePaymentModal.addEventListener("click", () => {
        paymentModal.style.display = "none";
        activePayBooking = null;
    });
}

// Copy UPI ID button
if (copyUpiBtn) {
    copyUpiBtn.addEventListener("click", () => {
        navigator.clipboard.writeText("9486886986@ybl").then(() => {
            copyUpiBtn.textContent = "Copied!";
            setTimeout(() => { copyUpiBtn.textContent = "Copy"; }, 2000);
        });
    });
}

// Submit UTR Reference
if (paymentSubmissionForm) {
    paymentSubmissionForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!activePayBooking) return;

        const utr = document.getElementById("utrNumberInput").value.trim();
        if (!utr || utr.length < 6) {
            paymentFormMessage.innerHTML = `<span style="color:red;">Please enter a valid 12-digit UPI reference number.</span>`;
            return;
        }

        const submitBtn = document.getElementById("submitUtrBtn");
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting Transaction Reference...";

        try {
            await db.collection("bookings").doc(activePayBooking.id).update({
                payment_status: "Pending Verification",
                utr_number: utr,
                payment_method: "UPI",
                payment_submitted_at: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            paymentFormMessage.innerHTML = `<span style="color:#16a34a; font-weight:600;">✓ Transaction reference submitted successfully!</span>`;

            setTimeout(async () => {
                paymentModal.style.display = "none";
                activePayBooking = null;
                showNotice("✓ Advance payment reference submitted. Our team is verifying your payment.", "success");
                await loadMyBookings();
            }, 800);

        } catch (err) {
            console.error("UTR submission error:", err);
            paymentFormMessage.innerHTML = `<span style="color:red;">Error submitting reference: ${escapeHTML(err.message)}</span>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Advance Payment Reference";
        }
    });
}

// Open Resubmit Modal
function openResubmitModal(booking) {
    activeResubmitBooking = booking;
    document.getElementById("resubmitBookingId").value = booking.id;
    document.getElementById("resubmitRejectionNotice").innerHTML = `
        <strong>Rejection Note from Verification Team:</strong>
        <p style="margin-top: 4px;">"${escapeHTML(booking.rejection_reason || "Documents could not be verified.")}"</p>
    `;
    resubmitMessage.innerHTML = "";
    resubmitModal.style.display = "flex";
}

if (closeResubmitModal) {
    closeResubmitModal.addEventListener("click", () => {
        resubmitModal.style.display = "none";
        activeResubmitBooking = null;
    });
}

// Setup resubmit file listeners
const resubmitIdFile = document.getElementById("resubmitIdFile");
const resubmitDlFile = document.getElementById("resubmitDlFile");
if (resubmitIdFile) {
    resubmitIdFile.addEventListener("change", async function () {
        resubmitCompressedId = await compressImageFile(this.files[0]);
        const p = document.getElementById("resubmitIdPreview");
        if (p && resubmitCompressedId) {
            p.querySelector("img").src = resubmitCompressedId;
            p.style.display = "block";
        }
    });
}
if (resubmitDlFile) {
    resubmitDlFile.addEventListener("change", async function () {
        resubmitCompressedDl = await compressImageFile(this.files[0]);
        const p = document.getElementById("resubmitDlPreview");
        if (p && resubmitCompressedDl) {
            p.querySelector("img").src = resubmitCompressedDl;
            p.style.display = "block";
        }
    });
}

// Submit Document Resubmission
if (resubmitForm) {
    resubmitForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!activeResubmitBooking) return;

        if (!resubmitCompressedId || !resubmitCompressedDl) {
            resubmitMessage.innerHTML = `<span style="color:red;">Please select both a corrected ID and Driving Licence file.</span>`;
            return;
        }

        const idType = document.getElementById("resubmitIdSelect").value;
        const submitBtn = document.getElementById("resubmitSubmitBtn");
        submitBtn.disabled = true;
        submitBtn.textContent = "Compressing & Resubmitting...";

        try {
            await db.collection("bookings").doc(activeResubmitBooking.id).update({
                id_type: idType,
                id_document: resubmitCompressedId,
                dl_document: resubmitCompressedDl,
                verification_status: "Pending Review",
                status: "Pending Review",
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            resubmitMessage.innerHTML = `<span style="color:#16a34a; font-weight:600;">✓ Corrected documents resubmitted successfully!</span>`;

            setTimeout(async () => {
                resubmitModal.style.display = "none";
                activeResubmitBooking = null;
                showNotice("✓ Documents resubmitted for admin review.", "success");
                await loadMyBookings();
            }, 800);

        } catch (err) {
            console.error("Resubmit error:", err);
            resubmitMessage.innerHTML = `<span style="color:red;">Resubmission failed: ${escapeHTML(err.message)}</span>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Resubmit Documents for Review";
        }
    });
}

// Cancel Booking
async function cancelCustomerBooking(b) {
    const confirmed = confirm(`Are you sure you want to cancel your booking for ${b.model}? The vehicle will be made available for other customers.`);
    if (!confirmed) return;

    try {
        await db.collection("bookings").doc(b.id).update({
            status: "Cancelled",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (b.vehicleId) {
            await db.collection("vehicles").doc(b.vehicleId).collection("schedules").doc(b.id).update({
                status: "Cancelled",
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(console.warn);
        }

        showNotice("✓ Your booking has been cancelled.", "info");
        await loadMyBookings();

    } catch (err) {
        console.error("Cancellation error:", err);
        alert("Could not cancel booking: " + err.message);
    }
}

// Voluntary Live Trip Location Tracking (Roadside Safety)
let customerWatchId = null;
let activeTrackingBookingId = null;

async function startCustomerTracking(b) {
    if (!("geolocation" in navigator)) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    const confirmed = confirm("Share your live trip location with K3L Fleet Management for roadside assistance and emergency safety?");
    if (!confirmed) return;

    activeTrackingBookingId = b.id;

    customerWatchId = navigator.geolocation.watchPosition(
        async function (pos) {
            const lat = Number(pos.coords.latitude.toFixed(6));
            const lng = Number(pos.coords.longitude.toFixed(6));
            const acc = Math.round(pos.coords.accuracy);

            try {
                await db.collection("bookings").doc(b.id).update({
                    tracking: {
                        is_sharing: true,
                        latitude: lat,
                        longitude: lng,
                        accuracy_m: acc,
                        last_updated: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                const el = document.getElementById(`tracking-status-${b.id}`);
                if (el) {
                    el.innerHTML = `<span style="color:#16a34a; font-weight:600;">🟢 Live Sharing Active</span> (GPS: ${lat}, ${lng} • ±${acc}m accuracy)`;
                }
            } catch (err) {
                console.warn("Location update error:", err);
            }
        },
        function (err) {
            console.warn("Geolocation watch error:", err);
            alert("Could not access location: " + err.message + ". Please ensure location permissions are enabled.");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    showNotice("Live location sharing initiated. Safe travels!", "success");
    await loadMyBookings();
}

async function stopCustomerTracking(b) {
    if (customerWatchId !== null) {
        navigator.geolocation.clearWatch(customerWatchId);
        customerWatchId = null;
    }
    activeTrackingBookingId = null;

    try {
        await db.collection("bookings").doc(b.id).update({
            "tracking.is_sharing": false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showNotice("Location sharing stopped.", "info");
        await loadMyBookings();
    } catch (err) {
        console.warn("Stop tracking error:", err);
    }
}

// Side-by-Side Inspection & Condition Report Modal
function openCustomerInspectionModal(b) {
    const modal = document.getElementById("custInspectionModal");
    const body = document.getElementById("custInspectionBody");
    if (!modal || !body) return;

    const p = b.pickup_inspection || {};
    const r = b.return_inspection || {};

    const pPhotos = p.photos || {};
    const rPhotos = r.photos || {};

    const startKm = p.odometer_km ? `${Number(p.odometer_km).toLocaleString("en-IN")} KM` : "Not recorded";
    const endKm = r.odometer_km ? `${Number(r.odometer_km).toLocaleString("en-IN")} KM` : "Pending Return";
    const netKm = (p.odometer_km && r.odometer_km) ? `${(Number(r.odometer_km) - Number(p.odometer_km)).toLocaleString("en-IN")} KM driven` : "--";

    const angles = [
        { label: "Front View", pImg: pPhotos.front, rImg: rPhotos.front },
        { label: "Back View", pImg: pPhotos.back, rImg: rPhotos.back },
        { label: "Left Profile", pImg: pPhotos.left, rImg: rPhotos.left },
        { label: "Right Profile", pImg: pPhotos.right, rImg: rPhotos.right }
    ];

    body.innerHTML = `
        <div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 0.9rem;">
                <div><strong>Vehicle:</strong> ${escapeHTML(b.model)} (<code>${escapeHTML(b.vehicle_number)}</code>)</div>
                <div><strong>Hub:</strong> 📍 ${escapeHTML(b.location || "Coimbatore")}</div>
                <div><strong>Rental Period:</strong> ${escapeHTML(b.start_date)} → ${escapeHTML(b.end_date)}</div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 12px; font-size: 0.85rem; border-top: 1px dashed var(--slate-300); padding-top: 10px;">
                <div><span style="color:var(--slate-500);">Pickup Odometer:</span><br><strong>${startKm}</strong></div>
                <div><span style="color:var(--slate-500);">Return Odometer:</span><br><strong>${endKm}</strong></div>
                <div><span style="color:var(--slate-500);">Distance Traveled:</span><br><strong style="color:#2563eb;">${netKm}</strong></div>
                <div><span style="color:var(--slate-500);">Pickup Fuel:</span><br><strong>${escapeHTML(p.fuel_level || "100%")}</strong></div>
                <div><span style="color:var(--slate-500);">Return Fuel:</span><br><strong>${escapeHTML(r.fuel_level || "--")}</strong></div>
            </div>
        </div>

        <h4 style="font-size: 0.95rem; margin-bottom: 8px; color: var(--slate-800);">📸 4-Angle Side-by-Side Photographic Verification</h4>
        <div style="display: flex; flex-direction: column; gap: 14px;">
            ${angles.map(a => `
                <div style="border: 1px solid var(--slate-200); border-radius: 8px; padding: 10px; background: white;">
                    <strong style="display: block; font-size: 0.85rem; color: var(--slate-700); margin-bottom: 8px;">${a.label}</strong>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div style="background: var(--slate-50); padding: 6px; border-radius: 6px; text-align: center;">
                            <span style="font-size: 0.75rem; color: #166534; font-weight: 600; display: block; margin-bottom: 4px;">Pickup Handover</span>
                            ${a.pImg ? `<img src="${a.pImg}" alt="Pickup ${a.label}" style="max-height: 120px; width: 100%; object-fit: contain; border-radius: 4px;">` : `<p style="font-size: 0.78rem; color: var(--slate-400); padding: 20px 0;">No photo recorded</p>`}
                        </div>
                        <div style="background: var(--slate-50); padding: 6px; border-radius: 6px; text-align: center;">
                            <span style="font-size: 0.75rem; color: #1e40af; font-weight: 600; display: block; margin-bottom: 4px;">Return Inspection</span>
                            ${a.rImg ? `<img src="${a.rImg}" alt="Return ${a.label}" style="max-height: 120px; width: 100%; object-fit: contain; border-radius: 4px;">` : `<p style="font-size: 0.78rem; color: var(--slate-400); padding: 20px 0;">Pending return</p>`}
                        </div>
                    </div>
                </div>
            `).join("")}
        </div>

        <!-- Remarks & Damage Assessment -->
        <div style="margin-top: 16px; background: var(--surface-alt); border-radius: 8px; padding: 12px; font-size: 0.85rem;">
            <div><strong>Pickup Remarks:</strong> ${escapeHTML(p.notes || "Vehicle handed over in clean condition.")}</div>
            <div style="margin-top: 6px;"><strong>Return Remarks:</strong> ${escapeHTML(r.notes || (b.status === "Completed" ? "Vehicle received and inspected." : "Return pending."))}</div>
            ${r.fine_amount > 0 ? `
                <div style="margin-top: 8px; color: #dc2626; font-weight: 600;">
                    ⚠️ Assessed Damage / Late Fine: ₹${Number(r.fine_amount).toLocaleString("en-IN")}
                </div>
            ` : `
                <div style="margin-top: 8px; color: #16a34a; font-weight: 600;">
                    ✓ Zero damages recorded. Clean inspection completed.
                </div>
            `}
        </div>
    `;

    modal.style.display = "flex";
}

const closeCustInspectionModal = document.getElementById("closeCustInspectionModal");
if (closeCustInspectionModal) {
    closeCustInspectionModal.addEventListener("click", () => {
        document.getElementById("custInspectionModal").style.display = "none";
    });
}

// Printable Advance Payment Receipt & Confirmation Modal
function openCustomerReceiptModal(b) {
    const modal = document.getElementById("receiptModal");
    const area = document.getElementById("printableReceiptArea");
    if (!modal || !area) return;

    const total = Number(b.total_amount || 0);
    const advanceRequired = Number(b.advance_amount || Math.round(total * 0.25));
    const pStatus = b.payment_status || "Awaiting Verification";
    const isPaid = pStatus === "Paid";
    const advancePaid = isPaid ? advanceRequired : 0;
    const remainingRentalBalance = total - advancePaid;
    const damagePenalty = Number(b.damage_penalty || b.return_inspection?.fine_amount || b.return_inspection?.damage_penalty || 0);
    const totalOutstanding = remainingRentalBalance + damagePenalty;

    area.innerHTML = `
        <div style="border: 2px solid #0f172a; padding: 24px; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px;">
                <div>
                    <h1 style="font-size: 1.5rem; margin: 0; color: #0f172a; letter-spacing: -0.5px;">🚗 K3L RENTALS</h1>
                    <p style="font-size: 0.82rem; color: #475569; margin: 2px 0 0;">
                        Premium Self-Drive Car &amp; Bike Rentals<br>
                        Gandhipuram Central Hub, Coimbatore, Tamil Nadu<br>
                        Phone: +91 98765 43210 • Email: support@k3lrentals.com
                    </p>
                </div>
                <div style="text-align: right;">
                    <span style="display: inline-block; background: #0f172a; color: white; padding: 4px 10px; font-size: 0.75rem; font-weight: 700; border-radius: 4px; text-transform: uppercase;">
                        ${isPaid ? 'CONFIRMED BOOKING' : 'BOOKING RECEIPT'}
                    </span>
                    <p style="font-size: 0.8rem; color: #64748b; margin-top: 6px;">
                        Date: ${new Date().toLocaleDateString("en-IN")}<br>
                        Booking Ref: <code>${escapeHTML(b.id)}</code>
                    </p>
                </div>
            </div>

            <!-- Customer & Vehicle Info Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; font-size: 0.88rem; background: #f8fafc; padding: 12px; border-radius: 6px;">
                <div>
                    <strong style="color: #0f172a; display: block; margin-bottom: 4px;">CUSTOMER DETAILS</strong>
                    <div>Name: <strong>${escapeHTML(b.customerName || "Customer")}</strong></div>
                    <div>Phone: ${escapeHTML(b.customerPhone || "N/A")}</div>
                    <div>Email: ${escapeHTML(b.customerEmail || "N/A")}</div>
                    <div>Verified ID: ${escapeHTML(b.id_type || "Aadhaar Card")}</div>
                </div>
                <div>
                    <strong style="color: #0f172a; display: block; margin-bottom: 4px;">VEHICLE &amp; TRIP DETAILS</strong>
                    <div>Model: <strong>${escapeHTML(b.model)}</strong> (${escapeHTML(b.category || "Vehicle")})</div>
                    <div>Reg No: <code>${escapeHTML(b.vehicle_number || "N/A")}</code></div>
                    <div>Pickup Hub: 📍 ${escapeHTML(b.location || "Coimbatore")}</div>
                    <div>Dates: <strong>${escapeHTML(b.start_date)}</strong> to <strong>${escapeHTML(b.end_date)}</strong> (${b.rental_days || 1} days)</div>
                </div>
            </div>

            <!-- Distinct 5-Point Financial Table -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 0.88rem;">
                <thead>
                    <tr style="background: #e2e8f0; text-align: left;">
                        <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Financial Item</th>
                        <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Rate / Basis</th>
                        <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: center;">Qty / Notes</th>
                        <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right;">Amount (INR)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">1. Total Rental Charge</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">₹${Number(b.price_per_day || 0).toLocaleString("en-IN")}/day</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${b.rental_days || 1} days</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">₹${total.toLocaleString("en-IN")}</td>
                    </tr>
                    <tr style="color: ${isPaid ? '#166534' : '#2563eb'};">
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">2. 25% Advance Paid via UPI</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">25% of Total</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${isPaid ? `UTR: ${escapeHTML(b.utr_number || "Verified")}` : 'Due before pickup'}</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">
                            ${isPaid ? `- ₹${advancePaid.toLocaleString("en-IN")}` : `₹0 (Due: ₹${advanceRequired.toLocaleString("en-IN")})`}
                        </td>
                    </tr>
                    <tr style="background: #f8fafc;">
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">3. Remaining 75% Rental Balance</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">75% of Total</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">Payable at pickup</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">₹${remainingRentalBalance.toLocaleString("en-IN")}</td>
                    </tr>
                    <tr style="color: ${damagePenalty > 0 ? '#dc2626' : '#64748b'};">
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0;">4. Approved Damage Penalty</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">Post-Trip Inspection</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: center;">${damagePenalty > 0 ? 'Assessed fine' : 'Nil (₹0)'}</td>
                        <td style="padding: 8px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">+ ₹${damagePenalty.toLocaleString("en-IN")}</td>
                    </tr>
                    <tr style="font-weight: 700; font-size: 1rem; background: #eff6ff;">
                        <td colspan="3" style="padding: 10px; border: 1px solid #bfdbfe; text-align: right; color: #1e40af;">
                            5. Total Outstanding Net Balance:
                        </td>
                        <td style="padding: 10px; border: 1px solid #bfdbfe; text-align: right; color: #1e40af;">
                            ₹${totalOutstanding.toLocaleString("en-IN")}
                        </td>
                    </tr>
                </tbody>
            </table>

            <!-- Terms & Handover Checklist -->
            <div style="font-size: 0.76rem; color: #64748b; line-height: 1.4; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
                <strong>Key Handover Guidelines:</strong>
                <ol style="margin: 4px 0 0 16px; padding: 0;">
                    <li>Customer must present original Physical Driving Licence at vehicle pickup.</li>
                    <li>Fuel level must be returned at equal or higher level as recorded during pickup handover.</li>
                    <li>Speed limit for cars is 100 km/h; bikes 80 km/h. Helmets mandatory for two-wheeler rentals.</li>
                    <li>Roadside assistance helpline available 24/7 at +91 98765 43210.</li>
                </ol>
            </div>
        </div>
    `;

    modal.style.display = "flex";
}

const closeReceiptModal = document.getElementById("closeReceiptModal");
const dismissReceiptBtn = document.getElementById("dismissReceiptBtn");
const printReceiptBtn = document.getElementById("printReceiptBtn");

if (closeReceiptModal) {
    closeReceiptModal.addEventListener("click", () => {
        document.getElementById("receiptModal").style.display = "none";
    });
}
if (dismissReceiptBtn) {
    dismissReceiptBtn.addEventListener("click", () => {
        document.getElementById("receiptModal").style.display = "none";
    });
}
if (printReceiptBtn) {
    printReceiptBtn.addEventListener("click", () => {
        window.print();
    });
}

function showNotice(text, type) {
    if (!actionNotice) return;
    const isSuccess = type === "success";
    actionNotice.innerHTML = `
        <div style="background: ${isSuccess ? '#ecfdf5' : '#eff6ff'}; border: 1px solid ${isSuccess ? '#a7f3d0' : '#bfdbfe'}; color: ${isSuccess ? '#065f46' : '#1e40af'}; padding: 12px; border-radius: 8px; font-size: 0.9rem;">
            ${escapeHTML(text)}
        </div>
    `;
    setTimeout(() => { actionNotice.innerHTML = ""; }, 5000);
}

// Tab filtering listeners
document.querySelectorAll(".filter-tab-btn").forEach(btn => {
    btn.addEventListener("click", function () {
        document.querySelectorAll(".filter-tab-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        activeFilter = this.dataset.filter;
        renderBookingsList();
    });
});

// Auth state listener
if (auth) {
    auth.onAuthStateChanged(function (user) {
        if (user) {
            loadMyBookings();
        } else {
            window.location.href = "login.html";
        }
    });
} else {
    document.addEventListener("DOMContentLoaded", loadMyBookings);
}
