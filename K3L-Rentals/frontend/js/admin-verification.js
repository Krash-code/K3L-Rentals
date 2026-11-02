// K3L Rentals - Admin Document Verification & Advance Payment Engine
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

let currentAdmin = null;
let allBookings = [];
let allKycUsers = [];
let activeTab = "pending-docs";
let activeModalItem = null; // { type: 'booking' | 'user', data: object }

const listContainer = document.getElementById("verificationListContainer");
const actionStatusMsg = document.getElementById("actionStatusMessage");
const docReviewModal = document.getElementById("docReviewModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalRejectBtn = document.getElementById("modalRejectBtn");
const modalApproveBtn = document.getElementById("modalApproveBtn");
const rejectionReasonBox = document.getElementById("rejectionReasonBox");
const rejectionReasonInput = document.getElementById("rejectionReasonInput");
const confirmRejectBtn = document.getElementById("confirmRejectBtn");
const cancelRejectBtn = document.getElementById("cancelRejectBtn");
const mainModalButtons = document.getElementById("mainModalButtons");

// Admin Access Verification via /admins/{uid}
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
            alert("Admin privileges required to access verification portal.");
            window.location.href = "admin-login.html";
            return false;
        }
        currentAdmin = user;
        return true;
    } catch (err) {
        console.error("Admin verification error:", err);
        listContainer.innerHTML = `<div class="info-card"><h3>Admin Verification Error</h3><p>${escapeHTML(err.message)}</p></div>`;
        return false;
    }
}

// Load all bookings and pending KYC users from Firestore
async function loadVerificationBookings() {
    if (!listContainer) return;
    listContainer.innerHTML = "<p>Loading records...</p>";

    try {
        const [bookingsSnap, usersSnap] = await Promise.all([
            db.collection("bookings").get(),
            db.collection("users").where("kyc_status", "==", "Pending Review").get().catch(e => {
                console.warn("Could not query pending kyc users by index:", e);
                return db.collection("users").get();
            })
        ]);

        allBookings = bookingsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        allKycUsers = usersSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(u => u.kyc_status === "Pending Review");

        // Sort latest first
        allBookings.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
        });

        updateTabCounters();
        renderTabContent();

    } catch (err) {
        console.error("Load bookings error:", err);
        listContainer.innerHTML = `<div class="info-card"><h3>Could not load verification records</h3><p>${escapeHTML(err.message)}</p></div>`;
    }
}

// Update badges on tabs
function updateTabCounters() {
    const pendingBookingDocs = allBookings.filter(b => b.verification_status === "Pending Review" || (b.status === "Pending Review" && b.verification_status !== "Approved"));
    const pendingDocsTotal = allKycUsers.length + pendingBookingDocs.length;
    const pendingPayments = allBookings.filter(b => b.payment_status === "Pending Verification");
    const confirmed = allBookings.filter(b => b.status === "Confirmed" || b.status === "Active");
    const rejected = allBookings.filter(b => b.verification_status === "Rejected" || b.status === "Rejected");

    document.getElementById("pendingDocsCount").textContent = pendingDocsTotal;
    document.getElementById("pendingPaymentsCount").textContent = pendingPayments.length;
    document.getElementById("confirmedCount").textContent = confirmed.length;
    document.getElementById("rejectedCount").textContent = rejected.length;
}

// Render content based on active tab
function renderTabContent() {
    if (!listContainer) return;

    if (activeTab === "pending-docs") {
        const pendingBookingDocs = allBookings.filter(b => b.verification_status === "Pending Review" || (b.status === "Pending Review" && b.verification_status !== "Approved"));

        if (allKycUsers.length === 0 && pendingBookingDocs.length === 0) {
            listContainer.innerHTML = `
                <div class="info-card" style="text-align: center; padding: 40px 20px;">
                    <h3>All Documents Verified</h3>
                    <p style="color: var(--slate-500); margin-top: 6px;">
                        There are currently no customer account KYC submissions or booking document reviews pending!
                    </p>
                </div>
            `;
            return;
        }

        let html = "";

        // Section 1: Customer Account KYC Profile Submissions
        if (allKycUsers.length > 0) {
            html += `
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span style="font-size: 1.2rem;">🪪</span>
                        <h2 style="font-size: 1.15rem; margin: 0; color: #1e3a8a;">
                            Customer Account KYC Verifications (${allKycUsers.length} Pending)
                        </h2>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 14px;">
                        ${allKycUsers.map(u => renderUserKycCard(u)).join("")}
                    </div>
                </div>
            `;
        }

        // Section 2: Booking Document Submissions
        if (pendingBookingDocs.length > 0) {
            html += `
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                        <span style="font-size: 1.2rem;">📋</span>
                        <h2 style="font-size: 1.15rem; margin: 0; color: #1e3a8a;">
                            Booking Document Submissions (${pendingBookingDocs.length} Pending)
                        </h2>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 14px;">
                        ${pendingBookingDocs.map(b => renderBookingCard(b)).join("")}
                    </div>
                </div>
            `;
        }

        listContainer.innerHTML = html;
        attachButtonListeners();
        return;
    }

    let filtered = [];
    if (activeTab === "pending-payments") {
        filtered = allBookings.filter(b => b.payment_status === "Pending Verification");
    } else if (activeTab === "confirmed-tab") {
        filtered = allBookings.filter(b => b.status === "Confirmed" || b.status === "Active");
    } else if (activeTab === "rejected-tab") {
        filtered = allBookings.filter(b => b.verification_status === "Rejected" || b.status === "Rejected");
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="info-card" style="text-align: center; padding: 40px 20px;">
                <h3>No records found in this section</h3>
                <p style="color: var(--slate-500); margin-top: 6px;">
                    ${activeTab === "pending-payments" ? "No advance payment references pending verification." : "No items to display."}
                </p>
            </div>
        `;
        return;
    }

    // If pending payments tab, add instructional banner
    let paymentBanner = "";
    if (activeTab === "pending-payments") {
        paymentBanner = `
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; font-size: 0.88rem; color: #92400e; display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 1.3rem;">💡</span>
                <div>
                    <strong>Advance Payment Verification Protocol:</strong>
                    <div style="margin-top: 2px;">
                        Verify receipt of the exact 25% advance amount in your UPI app for <strong>9486886986@ybl</strong> (Payee: <strong>Ms Krishma Priya S</strong> / K3L Rentals). Match the customer's reported transaction UTR reference before confirming.
                    </div>
                </div>
            </div>
        `;
    }

    listContainer.innerHTML = `
        ${paymentBanner}
        <div style="display: flex; flex-direction: column; gap: 16px;">
            ${filtered.map(booking => renderBookingCard(booking)).join("")}
        </div>
    `;

    attachButtonListeners();
}

function attachButtonListeners() {
    listContainer.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", function () {
            const action = this.dataset.action;
            const id = this.dataset.id;

            if (action === "inspect-user-kyc") {
                const user = allKycUsers.find(u => u.id === id);
                if (user) openDocModal({ type: "user", data: user });
            } else if (action === "inspect-docs") {
                const booking = allBookings.find(b => b.id === id);
                if (booking) openDocModal({ type: "booking", data: booking });
            } else if (action === "confirm-payment") {
                const booking = allBookings.find(b => b.id === id);
                if (booking) confirmAdvancePayment(booking);
            } else if (action === "reject-payment") {
                const booking = allBookings.find(b => b.id === id);
                if (booking) rejectAdvancePayment(booking);
            }
        });
    });
}

// Render User KYC Card
function renderUserKycCard(u) {
    let ageStr = "N/A";
    if (u.dob) {
        const birth = new Date(u.dob);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        ageStr = `${age} yrs (${age >= 18 ? '✓ 18+' : '⚠️ Minor'})`;
    }

    return `
        <div style="border: 1px solid #bfdbfe; border-radius: 10px; padding: 18px; background: #f8fafc; box-shadow: var(--shadow-sm); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
            <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.15rem;">👤</span>
                    <strong style="font-size: 1.05rem; color: #0f172a;">${escapeHTML(u.name || "Customer")}</strong>
                    <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 12px; font-size: 0.76rem; font-weight: 700;">
                        Pending KYC Review
                    </span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 14px; margin-top: 8px; font-size: 0.85rem; color: #475569;">
                    <span>Email: <strong>${escapeHTML(u.email || "N/A")}</strong></span>
                    <span>Phone: <strong>${escapeHTML(u.phone || "N/A")}</strong></span>
                    <span>DOB / Age: <strong>${escapeHTML(u.dob || "N/A")} (${ageStr})</strong></span>
                    <span>ID Proof: <strong>${escapeHTML(u.id_type || "Aadhaar Card")}</strong></span>
                </div>
            </div>
            <div>
                <button class="primary-btn" data-action="inspect-user-kyc" data-id="${escapeHTML(u.id)}" style="padding: 8px 18px; font-size: 0.88rem; background: #2563eb;">
                    🔍 Review KYC Documents &amp; Approve/Reject
                </button>
            </div>
        </div>
    `;
}

// Render individual booking card
function renderBookingCard(b) {
    const total = Number(b.total_amount || 0).toLocaleString("en-IN");
    const advance = Number(b.advance_amount || Math.round(Number(b.total_amount || 0) * 0.25)).toLocaleString("en-IN");
    const vStatus = b.verification_status || "Pending Review";
    const pStatus = b.payment_status || "Awaiting Approval";
    const status = b.status || "Pending Review";
    const category = String(b.category || "car").toLowerCase();
    const icon = category === "bike" ? "🏍️" : "🚗";

    let actionButtons = "";

    if (activeTab === "pending-docs") {
        actionButtons = `
            <button class="primary-btn" data-action="inspect-docs" data-id="${escapeHTML(b.id)}" style="padding: 8px 16px; font-size: 0.9rem;">
                🔍 Review Documents &amp; Approve/Reject
            </button>
        `;
    } else if (activeTab === "pending-payments") {
        actionButtons = `
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="primary-btn" data-action="confirm-payment" data-id="${escapeHTML(b.id)}" style="background: #16a34a; border-color: #16a34a; padding: 8px 16px; font-size: 0.9rem;">
                    ✓ Confirm Advance Received
                </button>
                <button class="secondary-btn" data-action="reject-payment" data-id="${escapeHTML(b.id)}" style="color: #dc2626; border-color: #fca5a5; padding: 8px 16px; font-size: 0.9rem;">
                    ✗ Reject Payment (Invalid UTR)
                </button>
            </div>
        `;
    } else {
        actionButtons = `
            <button class="secondary-btn" data-action="inspect-docs" data-id="${escapeHTML(b.id)}" style="padding: 6px 14px; font-size: 0.85rem;">
                View Documents
            </button>
        `;
    }

    return `
        <div class="booking-item" style="border: 1px solid var(--slate-200); border-radius: 10px; padding: 20px; background: white; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
                <div style="flex: 1; min-width: 260px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <span style="font-size: 1.25rem;">${icon}</span>
                        <h3 style="margin: 0; font-size: 1.15rem;">${escapeHTML(b.model || "Vehicle")}</h3>
                        <span style="font-family: monospace; font-size: 0.82rem; background: var(--slate-100); padding: 2px 6px; border-radius: 4px;">
                            ${escapeHTML(b.vehicle_number || "")}
                        </span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-top: 10px; font-size: 0.88rem; color: var(--slate-700);">
                        <div><strong>Customer:</strong> ${escapeHTML(b.customerName || "Customer")}</div>
                        <div><strong>Email:</strong> ${escapeHTML(b.customerEmail || "N/A")}</div>
                        <div><strong>Phone:</strong> ${escapeHTML(b.customerPhone || "N/A")}</div>
                        <div><strong>Dates:</strong> ${escapeHTML(b.start_date || "")} → ${escapeHTML(b.end_date || "")} (${b.rental_days || 1}d)</div>
                        <div><strong>Total Amount:</strong> ₹${total}</div>
                        <div><strong>25% Advance:</strong> <span style="color: #2563eb; font-weight: 700;">₹${advance}</span></div>
                    </div>

                    ${b.utr_number ? `
                        <div style="margin-top: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 14px; border-radius: 6px; font-size: 0.85rem; color: #166534;">
                            💳 <strong>Customer Submitted UPI Reference / UTR:</strong> <code>${escapeHTML(b.utr_number)}</code>
                            ${b.payment_submitted_at ? `<small style="display: block; color: #15803d; margin-top: 2px;">Submitted: ${new Date(b.payment_submitted_at.toMillis ? b.payment_submitted_at.toMillis() : b.payment_submitted_at).toLocaleString()}</small>` : ''}
                        </div>
                    ` : ''}

                    ${b.rejection_reason ? `
                        <div style="margin-top: 10px; background: #fef2f2; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; color: #991b1b;">
                            ⚠️ <strong>Rejection Reason:</strong> ${escapeHTML(b.rejection_reason)}
                        </div>
                    ` : ''}
                </div>

                <div style="text-align: right; min-width: 200px; display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
                    <div>
                        <span style="font-size: 0.82rem; color: var(--slate-500); display: block; margin-bottom: 2px;">Verification:</span>
                        <span class="admin-status ${vStatus.toLowerCase().replace(/[\s-]/g, '_')}">${escapeHTML(vStatus)}</span>
                    </div>
                    <div>
                        <span style="font-size: 0.82rem; color: var(--slate-500); display: block; margin-bottom: 2px;">Payment:</span>
                        <span class="admin-status ${pStatus.toLowerCase().replace(/[\s-]/g, '_')}">${escapeHTML(pStatus)}</span>
                    </div>
                    <div style="margin-top: 6px;">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Open Document Inspection Modal
function openDocModal(target) {
    activeModalItem = target;
    const modalCustomerInfo = document.getElementById("modalCustomerInfo");
    const modalIdLabel = document.getElementById("modalIdLabel");
    const modalIdImage = document.getElementById("modalIdImage");
    const modalDlImage = document.getElementById("modalDlImage");

    if (target.type === "user") {
        const u = target.data;
        let ageStr = "N/A";
        if (u.dob) {
            const birth = new Date(u.dob);
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
            ageStr = `${age} yrs (${age >= 18 ? '✓ Age 18+ Verified' : '⚠️ Minor <18'})`;
        }

        modalCustomerInfo.innerHTML = `
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 0.88rem; color: #1e40af;">
                <strong>🪪 Customer Account Verification (KYC):</strong> Approving will unlock vehicle reservations and date selection for this customer.
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
                <div><strong>Customer Name:</strong> ${escapeHTML(u.name || "Customer")}</div>
                <div><strong>Email:</strong> ${escapeHTML(u.email || "N/A")}</div>
                <div><strong>Phone:</strong> ${escapeHTML(u.phone || "N/A")}</div>
                <div><strong>Date of Birth:</strong> ${escapeHTML(u.dob || "N/A")} (${ageStr})</div>
                <div><strong>ID Proof Type:</strong> ${escapeHTML(u.id_type || "Aadhaar Card")}</div>
                <div><strong>Account UID:</strong> <code>${escapeHTML(u.id)}</code></div>
            </div>
            <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 0.8rem; color: #64748b;">
                <strong>Admin Checklist:</strong> Verify age 18+ from DOB, inspect photograph clarity, and ensure Driving Licence has valid non-expired LMV/Motorcycle endorsements.
            </div>
        `;

        modalIdLabel.textContent = `${u.id_type || "Identity Proof"} Document:`;

        if (u.id_document) {
            modalIdImage.src = u.id_document;
            modalIdImage.style.display = "block";
        } else {
            modalIdImage.style.display = "none";
            modalIdLabel.textContent += " (No document uploaded)";
        }

        if (u.dl_document) {
            modalDlImage.src = u.dl_document;
            modalDlImage.style.display = "block";
        } else {
            modalDlImage.style.display = "none";
        }

    } else {
        const booking = target.data;
        modalCustomerInfo.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
                <div><strong>Customer Name:</strong> ${escapeHTML(booking.customerName)}</div>
                <div><strong>Email:</strong> ${escapeHTML(booking.customerEmail)}</div>
                <div><strong>Phone:</strong> ${escapeHTML(booking.customerPhone || "N/A")}</div>
                <div><strong>Vehicle:</strong> ${escapeHTML(booking.model)} (${escapeHTML(booking.vehicle_number)})</div>
                <div><strong>Dates:</strong> ${escapeHTML(booking.start_date)} to ${escapeHTML(booking.end_date)}</div>
                <div><strong>25% Advance:</strong> ₹${Number(booking.advance_amount || 0).toLocaleString("en-IN")}</div>
            </div>
        `;

        modalIdLabel.textContent = `${booking.id_type || "Identity Proof"} Document:`;

        if (booking.id_document) {
            modalIdImage.src = booking.id_document;
            modalIdImage.style.display = "block";
        } else {
            modalIdImage.style.display = "none";
            modalIdLabel.textContent += " (No document uploaded)";
        }

        if (booking.dl_document) {
            modalDlImage.src = booking.dl_document;
            modalDlImage.style.display = "block";
        } else {
            modalDlImage.style.display = "none";
        }
    }

    rejectionReasonBox.style.display = "none";
    mainModalButtons.style.display = "flex";
    rejectionReasonInput.value = "";

    docReviewModal.style.display = "flex";
}

// Close Modal
function closeDocModal() {
    docReviewModal.style.display = "none";
    activeModalItem = null;
}

if (closeModalBtn) closeModalBtn.addEventListener("click", closeDocModal);

// Modal Approve Button
if (modalApproveBtn) {
    modalApproveBtn.addEventListener("click", async function () {
        if (!activeModalItem) return;

        modalApproveBtn.disabled = true;
        modalApproveBtn.textContent = "Approving...";

        try {
            if (activeModalItem.type === "user") {
                const u = activeModalItem.data;
                await db.collection("users").doc(u.id).update({
                    kyc_status: "Approved",
                    kyc_reviewed_by: currentAdmin.uid,
                    kyc_reviewed_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Also update any pending bookings for this customer
                const pendingCustBookings = allBookings.filter(b => b.userId === u.id && (b.verification_status === "Pending Review" || b.status === "Pending Review"));
                for (const b of pendingCustBookings) {
                    await db.collection("bookings").doc(b.id).update({
                        verification_status: "Approved",
                        status: "Awaiting Advance",
                        reviewed_by: currentAdmin.uid,
                        reviewed_at: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(console.warn);
                }

                await db.collection("users").doc(u.id).collection("notifications").add({
                    title: "Driver Identity Verified & Approved!",
                    message: "Both your identity proof and Driving Licence have been approved by K3L Admin. You can now reserve vehicles and pick rental dates.",
                    type: "kyc_approval",
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(console.warn);

                showBannerMsg(`✓ Driver KYC for ${escapeHTML(u.name || u.email)} approved! Customer can now reserve vehicles.`, "success");

            } else {
                const b = activeModalItem.data;
                await db.collection("bookings").doc(b.id).update({
                    verification_status: "Approved",
                    status: "Awaiting Advance",
                    reviewed_by: currentAdmin.uid,
                    reviewed_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                if (b.userId) {
                    await db.collection("users").doc(b.userId).collection("notifications").add({
                        title: "Documents Approved!",
                        message: `Your identity documents for ${b.model} have been approved. Please pay the 25% advance (₹${Number(b.advance_amount || 0).toLocaleString("en-IN")}) to lock your reservation.`,
                        type: "approval",
                        bookingId: b.id,
                        read: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(console.warn);
                }

                showBannerMsg(`✓ Documents for booking ${b.id.substring(0, 8)}... approved successfully. Customer notified to pay 25% advance.`, "success");
            }

            closeDocModal();
            await loadVerificationBookings();

        } catch (err) {
            console.error("Approval error:", err);
            alert("Could not approve documents: " + err.message);
        } finally {
            modalApproveBtn.disabled = false;
            modalApproveBtn.textContent = "✓ Approve Documents (Awaiting Advance)";
        }
    });
}

// Show Rejection reason box
if (modalRejectBtn) {
    modalRejectBtn.addEventListener("click", function () {
        mainModalButtons.style.display = "none";
        rejectionReasonBox.style.display = "block";
        rejectionReasonInput.focus();
    });
}

if (cancelRejectBtn) {
    cancelRejectBtn.addEventListener("click", function () {
        rejectionReasonBox.style.display = "none";
        mainModalButtons.style.display = "flex";
    });
}

// Confirm Rejection Button
if (confirmRejectBtn) {
    confirmRejectBtn.addEventListener("click", async function () {
        if (!activeModalItem) return;
        const reason = rejectionReasonInput.value.trim();

        if (!reason) {
            alert("Please enter a clear reason for rejection so the customer can correct it.");
            return;
        }

        confirmRejectBtn.disabled = true;
        confirmRejectBtn.textContent = "Rejecting...";

        try {
            if (activeModalItem.type === "user") {
                const u = activeModalItem.data;
                await db.collection("users").doc(u.id).update({
                    kyc_status: "Rejected",
                    kyc_rejection_reason: reason,
                    kyc_reviewed_by: currentAdmin.uid,
                    kyc_reviewed_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await db.collection("users").doc(u.id).collection("notifications").add({
                    title: "KYC Documents Not Approved",
                    message: `Your submitted documents were not approved: "${reason}". Please visit the ID Verification (KYC) page to correct and resubmit.`,
                    type: "kyc_rejection",
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(console.warn);

                showBannerMsg(`User KYC for ${escapeHTML(u.name || u.email)} rejected: "${reason}".`, "error");

            } else {
                const b = activeModalItem.data;
                await db.collection("bookings").doc(b.id).update({
                    verification_status: "Rejected",
                    rejection_reason: reason,
                    status: "Rejected",
                    reviewed_by: currentAdmin.uid,
                    reviewed_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                if (b.userId) {
                    await db.collection("users").doc(b.userId).collection("notifications").add({
                        title: "Documents Verification Required Correction",
                        message: `Your document submission for ${b.model} was not approved: "${reason}". Please resubmit corrected documents from My Bookings.`,
                        type: "rejection",
                        bookingId: b.id,
                        read: false,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    }).catch(console.warn);
                }

                showBannerMsg(`Booking ${b.id.substring(0, 8)}... rejected with reason: "${reason}".`, "error");
            }

            closeDocModal();
            await loadVerificationBookings();

        } catch (err) {
            console.error("Rejection error:", err);
            alert("Could not reject documents: " + err.message);
        } finally {
            confirmRejectBtn.disabled = false;
            confirmRejectBtn.textContent = "Confirm Rejection";
        }
    });
}

// Confirm Advance Payment (Mark as Paid & Confirmed)
async function confirmAdvancePayment(booking) {
    const advanceStr = Number(booking.advance_amount || 0).toLocaleString("en-IN");
    const confirmed = confirm(`UPI Payment Verification Protocol:\n\nDid you verify receipt of ₹${advanceStr} in your UPI / Bank app for receiving UPI ID 9486886986@ybl (Ms Krishma Priya S) matching customer UTR "${booking.utr_number || 'N/A'}"?\n\nClick OK to confirm advance payment and lock the vehicle schedule.`);
    if (!confirmed) return;

    try {
        // 1. Update Booking record
        await db.collection("bookings").doc(booking.id).update({
            payment_status: "Paid",
            status: "Confirmed",
            payment_confirmed_by: currentAdmin.uid,
            payment_confirmed_at: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Lock schedule slot under vehicle (Sanitized - No PII/UID)
        if (booking.vehicleId) {
            await db.collection("vehicles")
                .doc(booking.vehicleId)
                .collection("schedules")
                .doc(booking.id)
                .set({
                    start_date: booking.start_date,
                    end_date: booking.end_date,
                    status: "Confirmed",
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
        }

        // 3. Notify customer (Structured In-App Booking Confirmation)
        if (booking.userId) {
            const total = Number(booking.total_amount || 0);
            const advance = Number(booking.advance_amount || Math.round(total * 0.25));
            const balance = Number(booking.balance_amount || (total - advance));
            await db.collection("users").doc(booking.userId).collection("notifications").add({
                title: "Reservation Confirmed!",
                message: `Your booking for ${booking.model} (${booking.vehicle_number || ''}) from ${booking.start_date} to ${booking.end_date} has been confirmed! Total: ₹${total.toLocaleString('en-IN')}, 25% Advance Paid: ₹${advance.toLocaleString('en-IN')}, 75% Balance Due at Pickup: ₹${balance.toLocaleString('en-IN')}. Pickup at: 📍 ${booking.location || 'Coimbatore'} hub with your original Driving Licence.`,
                type: "payment_confirmed",
                bookingId: booking.id,
                vehicleModel: booking.model || "",
                vehicleNumber: booking.vehicle_number || "",
                startDate: booking.start_date || "",
                endDate: booking.end_date || "",
                totalAmount: total,
                advanceAmount: advance,
                balanceAmount: balance,
                paymentStatus: "Paid",
                bookingStatus: "Confirmed",
                pickupInstructions: `Please present your original Driving Licence and Aadhaar/PAN card at the ${booking.location || 'Coimbatore'} pickup hub. Starting odometer and 4-angle vehicle condition will be recorded before keys handover.`,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(console.warn);
        }

        showBannerMsg(`✓ Payment verified! Booking ${booking.id.substring(0, 8)}... is now Confirmed.`, "success");
        await loadVerificationBookings();

    } catch (err) {
        console.error("Payment confirmation error:", err);
        alert("Could not confirm payment: " + err.message);
    }
}

// Reject Advance Payment
async function rejectAdvancePayment(booking) {
    const reason = prompt("Enter note for rejecting payment (e.g. UTR not found on bank statement / amount mismatch):", "Invalid or mismatched transaction reference");
    if (!reason) return;

    try {
        await db.collection("bookings").doc(booking.id).update({
            payment_status: "Payment Rejected",
            payment_rejection_note: reason,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        if (booking.userId) {
            await db.collection("users").doc(booking.userId).collection("notifications").add({
                title: "Advance Payment Reference Mismatch",
                message: `Your advance payment reference for ${booking.model} could not be verified (${reason}). Please check your transaction details and resubmit in My Bookings.`,
                type: "payment_rejected",
                bookingId: booking.id,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(console.warn);
        }

        showBannerMsg(`Payment reference rejected for booking ${booking.id.substring(0, 8)}...`, "error");
        await loadVerificationBookings();

    } catch (err) {
        console.error("Payment rejection error:", err);
        alert("Could not reject payment: " + err.message);
    }
}

function showBannerMsg(text, type) {
    if (!actionStatusMsg) return;
    const isSuccess = type === "success";
    actionStatusMsg.innerHTML = `
        <div style="background: ${isSuccess ? '#ecfdf5' : '#fef2f2'}; border: 1px solid ${isSuccess ? '#a7f3d0' : '#fecaca'}; color: ${isSuccess ? '#065f46' : '#991b1b'}; padding: 12px; border-radius: 8px; font-size: 0.9rem;">
            ${escapeHTML(text)}
        </div>
    `;
    setTimeout(() => { actionStatusMsg.innerHTML = ""; }, 5000);
}

function escapeHTML(str) {
    return String(str || "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

// Tab navigation buttons
document.querySelectorAll(".v-tab-btn").forEach(btn => {
    btn.addEventListener("click", function () {
        document.querySelectorAll(".v-tab-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        activeTab = this.dataset.tab;
        renderTabContent();
    });
});

// Auth State Listener
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        const isAdmin = await checkAdminAccess(user);
        if (isAdmin) {
            await loadVerificationBookings();
        }
    });
}

