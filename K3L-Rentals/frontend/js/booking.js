// K3L Rentals - Reservation Engine with Age 18+ Verification & 25% Advance Workflow
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

const params = new URLSearchParams(window.location.search);
const vehicleId = params.get("id");

const vehicleSummary = document.getElementById("vehicleSummary");
const bookingForm = document.getElementById("bookingForm");
const bookingMessage = document.getElementById("bookingMessage");
const emailGateBanner = document.getElementById("emailGateBanner");
const gateUserEmail = document.getElementById("gateUserEmail");
const gateResendBtn = document.getElementById("gateResendBtn");
const gateCheckStatusBtn = document.getElementById("gateCheckStatusBtn");
const gateActionStatus = document.getElementById("gateActionStatus");
const submitBookingBtn = document.getElementById("submitBookingBtn");

let selectedVehicle = null;
let activeSchedules = [];
let compressedIdDoc = null;
let compressedDlDoc = null;
let customerProfile = null;

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

// Compress file to base64 JPEG via HTML5 Canvas (keeps size < 100KB for Firestore Spark plan)
function compressImageFile(file, maxDimension = 900, quality = 0.65) {
    return new Promise((resolve, reject) => {
        if (!file) return resolve(null);

        // If not an image (e.g. PDF), convert to small base64 directly
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

                const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
                resolve(compressedDataUrl);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Setup Document File Listeners with Preview & Compression
function setupDocumentUploadListeners() {
    const idInput = document.getElementById("idDocInput");
    const dlInput = document.getElementById("dlDocInput");
    const idPreview = document.getElementById("idDocPreview");
    const dlPreview = document.getElementById("dlDocPreview");

    if (idInput) {
        idInput.addEventListener("change", async function () {
            const file = this.files[0];
            if (!file) {
                compressedIdDoc = null;
                if (idPreview) idPreview.style.display = "none";
                return;
            }

            try {
                compressedIdDoc = await compressImageFile(file);
                if (idPreview && compressedIdDoc) {
                    const img = idPreview.querySelector("img");
                    if (img) img.src = compressedIdDoc;
                    idPreview.style.display = "block";
                }
            } catch (err) {
                console.error("ID document processing failed:", err);
                alert("Could not process identity document. Please choose a valid image file.");
            }
        });
    }

    if (dlInput) {
        dlInput.addEventListener("change", async function () {
            const file = this.files[0];
            if (!file) {
                compressedDlDoc = null;
                if (dlPreview) dlPreview.style.display = "none";
                return;
            }

            try {
                compressedDlDoc = await compressImageFile(file);
                if (dlPreview && compressedDlDoc) {
                    const img = dlPreview.querySelector("img");
                    if (img) img.src = compressedDlDoc;
                    dlPreview.style.display = "block";
                }
            } catch (err) {
                console.error("DL document processing failed:", err);
                alert("Could not process driving licence document. Please choose a valid image file.");
            }
        });
    }
}

// Set minimum date input to today
function setMinDateLimits() {
    const today = new Date().toISOString().split("T")[0];
    const maxDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const startDateInput = document.getElementById("start_date");
    const endDateInput = document.getElementById("end_date");
    if (startDateInput) {
        startDateInput.min = today;
        startDateInput.max = maxDate;
    }
    if (endDateInput) {
        endDateInput.min = today;
        endDateInput.max = maxDate;
    }
}

// Check email verification gate
async function verifyEmailGate(user) {
    if (!user) return false;

    // In local/demo environments, allow demo accounts if verified or prompt verification
    if (!user.emailVerified) {
        if (emailGateBanner) {
            emailGateBanner.style.display = "block";
            if (gateUserEmail) gateUserEmail.textContent = user.email;
        }
        if (bookingForm) bookingForm.style.display = "none";
        return false;
    } else {
        if (emailGateBanner) emailGateBanner.style.display = "none";
        return true;
    }
}

// Check KYC verification gate
async function checkKycGate(user) {
    const kycGateCard = document.getElementById("kycGateCard");
    if (!user) return false;

    try {
        const uDoc = await db.collection("users").doc(user.uid).get();
        customerProfile = uDoc.exists ? uDoc.data() : {};
        const kycStatus = customerProfile.kyc_status || "Not Submitted";
        const idType = customerProfile.id_type || "Aadhaar Card";

        if (kycStatus === "Approved") {
            if (kycGateCard) {
                kycGateCard.style.display = "block";
                kycGateCard.innerHTML = `
                    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <strong style="color: #065f46; font-size: 1rem;">✓ Identity Verified: Both ${escapeHTML(idType)} &amp; Driving Licence Approved</strong>
                            <p style="color: #047857; font-size: 0.85rem; margin-top: 2px;">Your verified documents are linked to your profile. Select rental dates below to reserve.</p>
                        </div>
                        <a href="kyc.html" style="color: #065f46; font-size: 0.85rem; text-decoration: underline; font-weight: 600;">View KYC Profile →</a>
                    </div>
                `;
            }

            // Pre-populate document cache from approved profile
            if (customerProfile.id_document) compressedIdDoc = customerProfile.id_document;
            if (customerProfile.dl_document) compressedDlDoc = customerProfile.dl_document;

            // Update document section UI to show pre-verified status
            const docSection = document.getElementById("docSectionContainer");
            if (docSection) {
                docSection.innerHTML = `
                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
                        <div style="display: flex; align-items: center; gap: 8px; color: #166534; font-weight: 600;">
                            <span>✓</span>
                            <span>Verified KYC Documents Automatically Attached</span>
                        </div>
                        <p style="font-size: 0.85rem; color: #15803d; margin: 4px 0 10px;">
                            ${escapeHTML(idType)} and Driving Licence approved by K3L Admin. No document re-upload required.
                        </p>
                        <div style="padding-top: 10px; border-top: 1px dashed #bbf7d0;">
                            <label style="display: flex; align-items: flex-start; gap: 10px; font-size: 0.85rem; color: #166534; cursor: pointer;">
                                <input type="checkbox" id="consentCheckbox" required checked style="margin-top: 3px; width: 16px; height: 16px; cursor: pointer;">
                                <span>
                                    <strong>Driver Declaration:</strong> I confirm I am 18+ years old and hold a valid, non-expired driving licence. I agree to K3L Rentals terms and conditions.
                                </span>
                            </label>
                        </div>
                    </div>
                `;
            }

            if (bookingForm) {
                bookingForm.style.display = "block";
                const sDate = document.getElementById("start_date");
                const eDate = document.getElementById("end_date");
                if (sDate) sDate.disabled = false;
                if (eDate) eDate.disabled = false;
                if (submitBookingBtn) submitBookingBtn.disabled = false;
            }
            return true;

        } else if (kycStatus === "Pending Review") {
            if (kycGateCard) {
                kycGateCard.style.display = "block";
                kycGateCard.innerHTML = `
                    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 18px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                            <div>
                                <span style="background: #fef3c7; color: #92400e; padding: 3px 10px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; text-transform: uppercase;">
                                    ⏳ Verification Pending Review
                                </span>
                                <h3 style="color: #92400e; margin: 8px 0 6px;">Vehicle Reservation &amp; Dates Locked</h3>
                                <p style="color: #78350f; font-size: 0.9rem; margin: 0 0 12px; line-height: 1.5;">
                                    Your identity documents (${escapeHTML(idType)} and Driving Licence) have been submitted and are in our verification queue. Date selection and reservation will unlock automatically once approved by K3L Admin.
                                </p>
                            </div>
                        </div>
                        <a href="kyc.html" class="secondary-btn" style="display: inline-block; padding: 8px 18px; font-size: 0.88rem;">
                            View Verification Queue Status →
                        </a>
                    </div>
                `;
            }
            if (bookingForm) bookingForm.style.display = "none";
            return false;

        } else if (kycStatus === "Rejected") {
            const reason = customerProfile.kyc_rejection_reason || "Documents could not be verified.";
            if (kycGateCard) {
                kycGateCard.style.display = "block";
                kycGateCard.innerHTML = `
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 18px;">
                        <span style="background: #fee2e2; color: #991b1b; padding: 3px 10px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; text-transform: uppercase;">
                            ⚠️ Verification Not Approved
                        </span>
                        <h3 style="color: #991b1b; margin: 8px 0 6px;">Vehicle Reservation Locked</h3>
                        <p style="color: #b91c1c; font-size: 0.9rem; margin: 0 0 6px;">
                            <strong>Admin Reason:</strong> "${escapeHTML(reason)}"
                        </p>
                        <p style="color: #7f1d1d; font-size: 0.85rem; margin: 0 0 14px;">
                            Please upload corrected documents on the KYC portal to unlock vehicle booking.
                        </p>
                        <a href="kyc.html" class="primary-btn" style="display: inline-block; padding: 8px 18px; font-size: 0.88rem;">
                            Resubmit Documents on KYC Portal →
                        </a>
                    </div>
                `;
            }
            if (bookingForm) bookingForm.style.display = "none";
            return false;

        } else {
            // Not Submitted
            if (kycGateCard) {
                kycGateCard.style.display = "block";
                kycGateCard.innerHTML = `
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px;">
                        <span style="background: #dbeafe; color: #1e40af; padding: 3px 10px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; text-transform: uppercase;">
                            🔒 Verification Required
                        </span>
                        <h3 style="color: #1e40af; margin: 8px 0 6px;">Identity Verification Required to Book</h3>
                        <p style="color: #1e3a8a; font-size: 0.9rem; margin: 0 0 14px; line-height: 1.5;">
                            Under Motor Vehicles Act regulations and K3L Rentals policy, drivers must complete a one-time identity verification (Aadhaar/PAN + Driving Licence) before selecting rental dates.
                        </p>
                        <a href="kyc.html" class="primary-btn" style="display: inline-block; padding: 10px 20px; font-size: 0.92rem;">
                            Complete Identity Verification (KYC) Now →
                        </a>
                    </div>
                `;
            }
            if (bookingForm) bookingForm.style.display = "none";
            return false;
        }

    } catch (err) {
        console.error("KYC gate check error:", err);
        return false;
    }
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
                    <strong style="color: #c05621; font-size: 0.88rem;">📅 Currently Reserved Dates (Unavailable):</strong>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                        ${sorted.map(s => `
                            <span style="background: #feebc8; color: #7b341e; font-size: 0.8rem; padding: 2px 8px; border-radius: 4px; font-weight: 500;">
                                ${escapeHTML(s.start_date)} → ${escapeHTML(s.end_date)}
                            </span>
                        `).join("")}
                    </div>
                    <small style="color: #744210; display:block; margin-top:4px;">You can reserve any dates outside the ranges above.</small>
                </div>
            `;
        }

        vehicleSummary.innerHTML = `
            <div class="info-card">
                <h2>${icon} ${escapeHTML(selectedVehicle.model || "Vehicle")}</h2>
                <p><strong>Category:</strong> ${icon} ${category.toUpperCase()} ${selectedVehicle.type ? " • " + escapeHTML(selectedVehicle.type) : ""}</p>
                <p><strong>Registration Number:</strong> ${escapeHTML(selectedVehicle.vehicle_number || "N/A")}</p>
                <p><strong>Pickup Hub:</strong> 📍 ${escapeHTML(selectedVehicle.location || "Coimbatore")}</p>
                <p><strong>Daily Rental Rate:</strong> <strong>₹${price.toLocaleString("en-IN")}</strong> / day</p>
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
            const kycGateCard = document.getElementById("kycGateCard");
            if (kycGateCard) kycGateCard.style.display = "none";
        } else {
            const isEmailOk = await verifyEmailGate(auth.currentUser);
            if (isEmailOk) {
                await checkKycGate(auth.currentUser);
            }
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

// Calculate duration, 25% advance, and price estimate on date changes
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
            estimateElem.innerHTML = `<div style="color:#e53e3e; font-weight: 500; font-size:0.9rem;">⚠️ End date must be after start date</div>`;
        }
        return;
    }

    const days = Math.round((end - start) / (1000 * 60 * 60 * 24));

    // Rental duration rule: 1 to 7 days
    if (days < 1 || days > 7) {
        if (estimateElem) {
            estimateElem.innerHTML = `
                <div style="background: #fff5f5; border: 1px solid #feb2b2; color: #c53030; padding: 10px; border-radius: 6px; font-size: 0.88rem;">
                    ⚠️ <strong>Invalid Rental Duration:</strong> Rentals must be between <strong>1 and 7 consecutive days</strong>. (You selected <strong>${days} days</strong>).
                </div>
            `;
        }
        return;
    }

    // Check for overlap with active confirmed schedules
    const conflict = activeSchedules.find(s => {
        const sStatus = String(s.status || "").toLowerCase();
        if (sStatus !== "confirmed") return false;
        return s.start_date < endDate && s.end_date > startDate;
    });

    if (conflict) {
        if (estimateElem) {
            estimateElem.innerHTML = `
                <div style="background:#fff5f5; color:#c53030; padding:10px; border-radius:6px; margin: 12px 0; border:1px solid #feb2b2; font-size: 0.88rem;">
                    ⚠️ <strong>Dates Unavailable:</strong> Conflicting reservation exists from <strong>${escapeHTML(conflict.start_date)}</strong> to <strong>${escapeHTML(conflict.end_date)}</strong>. Please pick alternative dates.
                </div>
            `;
        }
        return;
    }

    const price = Number(selectedVehicle.price_per_day || 0);
    const total = days * price;
    const advance = Math.round(total * 0.25);
    const balance = total - advance;

    if (estimateElem) {
        estimateElem.innerHTML = `
            <div style="background:#f8fafc; padding:16px; border-radius:8px; border:1px solid #e2e8f0;">
                <h4 style="color: #1e293b; margin-bottom: 8px; font-size: 0.95rem;">💰 Rental &amp; Payment Breakdown</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; font-size: 0.88rem;">
                    <div><strong>Duration:</strong> ${days} ${days === 1 ? 'day' : 'days'}</div>
                    <div><strong>Daily Rate:</strong> ₹${price.toLocaleString("en-IN")}/day</div>
                    <div><strong>Total Rental:</strong> <span style="font-weight:700; color:#1e293b;">₹${total.toLocaleString("en-IN")}</span></div>
                </div>
                <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #cbd5e1; display: flex; flex-wrap: wrap; gap: 16px; font-size: 0.9rem;">
                    <div style="background: #eff6ff; padding: 6px 12px; border-radius: 6px; border: 1px solid #bfdbfe;">
                        <span style="color: #1e40af; font-weight: 600;">25% Advance Required:</span>
                        <strong style="color: #2563eb; font-size: 1.1rem; margin-left: 4px;">₹${advance.toLocaleString("en-IN")}</strong>
                        <small style="display:block; color:#60a5fa; font-size: 0.75rem;">Payable after document approval</small>
                    </div>
                    <div style="background: #f1f5f9; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <span style="color: #475569; font-weight: 600;">Remaining 75% Balance:</span>
                        <strong style="color: #0f172a; font-size: 1.1rem; margin-left: 4px;">₹${balance.toLocaleString("en-IN")}</strong>
                        <small style="display:block; color:#64748b; font-size: 0.75rem;">Payable at vehicle pickup hub</small>
                    </div>
                </div>
            </div>
        `;
    }
}

// Add event listeners for dynamic price calculation
document.getElementById("start_date")?.addEventListener("change", updatePriceEstimate);
document.getElementById("end_date")?.addEventListener("change", updatePriceEstimate);

// Email gate button handlers
if (gateResendBtn) {
    gateResendBtn.addEventListener("click", async function () {
        const user = auth.currentUser;
        if (!user) return;
        gateResendBtn.disabled = true;
        gateActionStatus.textContent = "Sending...";
        gateActionStatus.style.color = "#475569";
        try {
            await user.sendEmailVerification();
            gateActionStatus.textContent = "✓ Email sent! Please check your inbox.";
            gateActionStatus.style.color = "#16a34a";
        } catch (err) {
            console.error("Resend verification error:", err);
            gateActionStatus.textContent = "Could not send: " + err.message;
            gateActionStatus.style.color = "#dc2626";
        } finally {
            setTimeout(() => { gateResendBtn.disabled = false; }, 6000);
        }
    });
}

if (gateCheckStatusBtn) {
    gateCheckStatusBtn.addEventListener("click", async function () {
        const user = auth.currentUser;
        if (!user) return;
        gateCheckStatusBtn.disabled = true;
        gateActionStatus.textContent = "Checking status...";
        gateActionStatus.style.color = "#475569";
        try {
            await user.reload();
            if (user.emailVerified) {
                gateActionStatus.textContent = "✓ Email verified! Unlocking booking form...";
                gateActionStatus.style.color = "#16a34a";
                setTimeout(() => {
                    emailGateBanner.style.display = "none";
                    if (bookingForm) bookingForm.style.display = "block";
                    setMinDateLimits();
                }, 1000);
            } else {
                gateActionStatus.textContent = "Still not verified. Please click the link in your email.";
                gateActionStatus.style.color = "#d97706";
            }
        } catch (err) {
            gateActionStatus.textContent = "Status check error: " + err.message;
            gateActionStatus.style.color = "#dc2626";
        } finally {
            gateCheckStatusBtn.disabled = false;
        }
    });
}

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

        // Re-check email verification gate
        await user.reload();
        if (!user.emailVerified) {
            alert("Email verification is mandatory before submitting a vehicle booking.");
            verifyEmailGate(user);
            return;
        }

        if (!selectedVehicle) {
            bookingMessage.innerHTML = `<div style="color:red;">Vehicle details are not available.</div>`;
            return;
        }

        const startDate = document.getElementById("start_date").value;
        const endDate = document.getElementById("end_date").value;
        const idType = document.getElementById("idTypeSelect")?.value || "Aadhaar Card";
        const consentCheckbox = document.getElementById("consentCheckbox");

        if (!startDate || !endDate) {
            showBookingError("Please select both start and end rental dates.");
            return;
        }

        const start = new Date(startDate + "T00:00:00");
        const end = new Date(endDate + "T00:00:00");

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            showBookingError("End date must be after the start date.");
            return;
        }

        const rentalDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        if (rentalDays < 1 || rentalDays > 7) {
            showBookingError(`Rental duration must be between 1 and 7 consecutive days. You requested ${rentalDays} days.`);
            return;
        }

        const isApprovedKyc = customerProfile && customerProfile.kyc_status === "Approved";
        const finalIdDoc = compressedIdDoc || (isApprovedKyc ? customerProfile.id_document : null);
        const finalDlDoc = compressedDlDoc || (isApprovedKyc ? customerProfile.dl_document : null);
        const finalIdType = (customerProfile && customerProfile.id_type) || idType || "Aadhaar Card";

        // Validate document uploads
        if (!finalIdDoc) {
            showBookingError(`Please upload or verify your ${finalIdType} on the KYC portal.`);
            return;
        }

        if (!finalDlDoc) {
            showBookingError("Please upload or verify your Driving Licence (DL) on the KYC portal.");
            return;
        }

        if (!consentCheckbox || !consentCheckbox.checked) {
            showBookingError("You must agree to the mandatory document verification consent checkbox.");
            return;
        }

        if (submitBookingBtn) {
            submitBookingBtn.disabled = true;
            submitBookingBtn.textContent = "Uploading & Submitting Reservation Request...";
        }

        bookingMessage.innerHTML = `<div style="color:#2563eb; font-weight:500;">Validating fleet availability and submitting documents...</div>`;

        try {
            // Fresh conflict check against confirmed schedules in Firestore
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
            const advanceAmount = Math.round(totalAmount * 0.25);
            const balanceAmount = totalAmount - advanceAmount;
            const category = String(selectedVehicle.category || "car").toLowerCase();

            // Fetch customer profile from Firestore for phone number
            let customerPhone = "";
            try {
                const uDoc = await db.collection("users").doc(user.uid).get();
                if (uDoc.exists) {
                    customerPhone = uDoc.data().phone || "";
                }
            } catch (uErr) {
                console.warn("Could not read customer phone:", uErr);
            }

            // Generate unified booking document
            const newBookingRef = db.collection("bookings").doc();
            const bookingId = newBookingRef.id;

            const vStatus = isApprovedKyc ? "Approved" : "Pending Review";
            const pStatus = isApprovedKyc ? "Awaiting Advance" : "Awaiting Approval";
            const bStatus = isApprovedKyc ? "Awaiting Advance" : "Pending Review";

            const bookingPayload = {
                userId: user.uid,
                customerName: user.displayName || user.email.split("@")[0],
                customerEmail: user.email,
                customerPhone: customerPhone,
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
                advance_amount: advanceAmount,
                balance_amount: balanceAmount,
                id_type: finalIdType,
                id_document: finalIdDoc,
                dl_document: finalDlDoc,
                kyc_verified: !!isApprovedKyc,
                consent_accepted: true,
                consent_timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                verification_status: vStatus,
                payment_status: pStatus,
                status: bStatus,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await newBookingRef.set(bookingPayload);

            // Also create schedule reservation in the vehicle's subcollection (Sanitized - No PII/UID)
            await db.collection("vehicles")
                .doc(vehicleId)
                .collection("schedules")
                .doc(bookingId)
                .set({
                    start_date: startDate,
                    end_date: endDate,
                    status: bStatus,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            // Write in-app notification to customer
            await db.collection("users").doc(user.uid).collection("notifications").add({
                title: isApprovedKyc ? "Booking Created - Advance Due" : "Booking Request Submitted",
                message: isApprovedKyc
                    ? `Your booking for ${selectedVehicle.model} is ready. Pay the 25% advance (₹${advanceAmount.toLocaleString("en-IN")}) to lock your dates.`
                    : `Your booking request for ${selectedVehicle.model} (${startDate} to ${endDate}) has been submitted for manual document review.`,
                type: "booking",
                bookingId: bookingId,
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(e => console.warn("Could not create user notification:", e));

            bookingMessage.innerHTML = `
                <div class="info-card" style="border-left: 4px solid #2563eb; background: #f8fafc; padding: 20px;">
                    <h3 style="color:#1d4ed8; margin-top:0;">📋 Booking Request ${isApprovedKyc ? 'Logged &amp; Ready for Advance Payment!' : 'Submitted for Review!'}</h3>
                    <p style="font-size: 0.95rem; line-height: 1.6;">
                        Your reservation request for <strong>${escapeHTML(selectedVehicle.model)} (${escapeHTML(selectedVehicle.vehicle_number)})</strong> has been logged.
                    </p>
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 12px 0; font-size: 0.88rem;">
                        <p><strong>Booking Reference:</strong> <code>${escapeHTML(bookingId)}</code></p>
                        <p><strong>Rental Duration:</strong> ${rentalDays} days (${escapeHTML(startDate)} → ${escapeHTML(endDate)})</p>
                        <p><strong>Total Rental:</strong> ₹${totalAmount.toLocaleString("en-IN")}</p>
                        <p><strong>25% Advance to Pay:</strong> <strong style="color: #2563eb;">₹${advanceAmount.toLocaleString("en-IN")}</strong></p>
                        <p><strong>Current Status:</strong> <span class="admin-status ${bStatus.toLowerCase().replace(/[\s-]/g, '_')}">${escapeHTML(bStatus)}</span></p>
                    </div>

                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 0.85rem; color: #1e40af;">
                        <strong>Next Steps:</strong>
                        <ol style="margin-left: 18px; margin-top: 4px;">
                            ${isApprovedKyc ? `
                                <li>Your driver identity documents are already verified and approved!</li>
                                <li>Pay the mandatory 25% advance (<strong>₹${advanceAmount.toLocaleString("en-IN")}</strong>) to confirm and lock your vehicle schedule.</li>
                                <li>After admin confirms your payment UTR, vehicle reservation is 100% locked!</li>
                            ` : `
                                <li>Our administrative team will review your ${finalIdType} and Driving Licence.</li>
                                <li>Once approved, you will receive an in-app notice to complete the 25% advance payment (₹${advanceAmount.toLocaleString("en-IN")}).</li>
                                <li>After your advance payment is verified, your vehicle lock is confirmed!</li>
                            `}
                        </ol>
                    </div>

                    <a href="my-bookings.html" class="primary-btn" style="display:inline-block; padding: 10px 20px; text-decoration: none;">
                        ${isApprovedKyc ? 'Pay 25% Advance in My Bookings →' : 'Track in My Bookings →'}
                    </a>
                </div>
            `;

            bookingForm.style.display = "none";

        } catch (error) {
            console.error("Booking error:", error);
            showBookingError(error.message || "Unable to complete booking. Please try again.");
        } finally {
            if (submitBookingBtn) {
                submitBookingBtn.disabled = false;
                submitBookingBtn.textContent = "Submit Booking Request for Verification";
            }
        }
    });
}

function showBookingError(msg) {
    bookingMessage.innerHTML = `
        <div style="color: #991b1b; background: #fef2f2; padding: 14px; border-radius: 8px; border: 1px solid #fecaca; font-size: 0.9rem;">
            ⚠️ <strong>Booking Submission Failed:</strong> ${escapeHTML(msg)}
        </div>
    `;
}

// Authentication state listener & initial setup
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        if (user) {
            try {
                const uDoc = await db.collection("users").doc(user.uid).get();
                if (!uDoc.exists) {
                    alert("Customer profile not found. Please register an account before booking vehicles.");
                    await auth.signOut();
                    localStorage.removeItem("user");
                    window.location.href = "register.html";
                    return;
                }
            } catch (uErr) {
                console.warn("Booking user verification note:", uErr);
            }
            setupDocumentUploadListeners();
            await loadVehicle();
        } else {
            window.location.href = "login.html";
        }
    });
} else {
    document.addEventListener("DOMContentLoaded", () => {
        setupDocumentUploadListeners();
        loadVehicle();
    });
}
