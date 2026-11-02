// K3L Rentals - Customer Identity Verification (KYC) Engine
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

let currentUser = null;
let compressedIdBase64 = null;
let compressedDlBase64 = null;

const badgeContainer = document.getElementById("kycBadgeContainer");
const noticeContainer = document.getElementById("kycNoticeContainer");
const formCard = document.getElementById("kycFormCard");
const kycForm = document.getElementById("kycForm");
const formMessage = document.getElementById("kycFormMessage");
const submitBtn = document.getElementById("submitKycBtn");

// Checklist elements
const iconAadhaar = document.getElementById("iconAadhaar");
const textAadhaar = document.getElementById("textAadhaar");
const iconDl = document.getElementById("iconDl");
const textDl = document.getElementById("textDl");
const iconBookingGate = document.getElementById("iconBookingGate");
const textBookingGate = document.getElementById("textBookingGate");

// Compress file to base64 JPEG via HTML5 Canvas (< 80KB)
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

function escapeHTML(str) {
    return String(str || "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

// Load and render user KYC status
async function loadKycStatus() {
    if (!auth || !auth.currentUser) return;
    currentUser = auth.currentUser;

    try {
        const userDoc = await db.collection("users").doc(currentUser.uid).get();
        const data = userDoc.exists ? userDoc.data() : {};
        const status = data.kyc_status || "Not Submitted";
        const idType = data.id_type || "Aadhaar Card";
        const rejectionReason = data.kyc_rejection_reason || "Document details could not be verified.";

        renderStatusUI(status, idType, rejectionReason, data);

    } catch (err) {
        console.error("KYC load error:", err);
        noticeContainer.innerHTML = `<div class="info-card"><h3>Error Loading Status</h3><p>${escapeHTML(err.message)}</p></div>`;
    }
}

function renderStatusUI(status, idType, rejectionReason, data) {
    // Reset classes
    badgeContainer.innerHTML = "";
    noticeContainer.innerHTML = "";
    formCard.style.display = "none";

    if (status === "Approved") {
        badgeContainer.innerHTML = `<span class="kyc-status-badge status-approved">✓ Approved</span>`;

        iconAadhaar.className = "checklist-icon icon-ok";
        iconAadhaar.textContent = "✓";
        textAadhaar.textContent = `${idType} Verified`;

        iconDl.className = "checklist-icon icon-ok";
        iconDl.textContent = "✓";
        textDl.textContent = "Driving Licence Verified";

        iconBookingGate.className = "checklist-icon icon-ok";
        iconBookingGate.textContent = "🔓";
        textBookingGate.textContent = "Unlocked & Ready";

        noticeContainer.innerHTML = `
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px;">
                <h3 style="color: #065f46; margin: 0 0 8px; font-size: 1.15rem;">🎉 Identity Documents Approved!</h3>
                <p style="color: #047857; margin: 0 0 16px; font-size: 0.92rem; line-height: 1.5;">
                    Both your identity proof (${escapeHTML(idType)}) and Driving Licence have been reviewed and approved by K3L Admin. Vehicle discovery, date selection, and rental bookings are fully unlocked.
                </p>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <a href="vehicles.html" class="primary-btn" style="padding: 10px 22px; font-size: 0.95rem;">
                        Browse Fleet &amp; Reserve Vehicle →
                    </a>
                    <a href="my-bookings.html" class="secondary-btn" style="padding: 10px 18px; font-size: 0.95rem;">
                        View My Bookings
                    </a>
                </div>
            </div>
        `;

    } else if (status === "Pending Review") {
        badgeContainer.innerHTML = `<span class="kyc-status-badge status-pending_review">⏳ Pending Review</span>`;

        iconAadhaar.className = "checklist-icon icon-pending";
        iconAadhaar.textContent = "⏳";
        textAadhaar.textContent = "Under Administrative Review";

        iconDl.className = "checklist-icon icon-pending";
        iconDl.textContent = "⏳";
        textDl.textContent = "Under Administrative Review";

        iconBookingGate.className = "checklist-icon icon-locked";
        iconBookingGate.textContent = "🔒";
        textBookingGate.textContent = "Locked until Approved";

        noticeContainer.innerHTML = `
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px;">
                <h3 style="color: #92400e; margin: 0 0 8px; font-size: 1.15rem;">⏳ Documents Under Admin Review</h3>
                <p style="color: #78350f; margin: 0 0 12px; font-size: 0.92rem; line-height: 1.5;">
                    Your ${escapeHTML(idType)} and Driving Licence have been submitted and are in our verification queue. Staff will verify your age and document validity against motor vehicle regulations. Approvals typically take 15–30 minutes.
                </p>
                <p style="font-size: 0.85rem; color: #b45309; margin: 0;">
                    <em>Note: Vehicle selection and date booking will unlock automatically once approved.</em>
                </p>
            </div>
        `;

    } else if (status === "Rejected") {
        badgeContainer.innerHTML = `<span class="kyc-status-badge status-rejected">⚠️ Rejected</span>`;

        iconAadhaar.className = "checklist-icon icon-rejected";
        iconAadhaar.textContent = "✗";
        textAadhaar.textContent = "Verification Failed";

        iconDl.className = "checklist-icon icon-rejected";
        iconDl.textContent = "✗";
        textDl.textContent = "Verification Failed";

        iconBookingGate.className = "checklist-icon icon-locked";
        iconBookingGate.textContent = "🔒";
        textBookingGate.textContent = "Locked until Approved";

        noticeContainer.innerHTML = `
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 18px; margin-bottom: 16px;">
                <h3 style="color: #991b1b; margin: 0 0 6px; font-size: 1.15rem;">⚠️ Documents Were Not Approved</h3>
                <p style="color: #b91c1c; margin: 0 0 8px; font-size: 0.92rem;">
                    <strong>Admin Reason:</strong> "${escapeHTML(rejectionReason)}"
                </p>
                <p style="color: #7f1d1d; margin: 0; font-size: 0.85rem;">
                    Please check the rejection note above, upload corrected documents using the form below, and resubmit for review.
                </p>
            </div>
        `;
        formCard.style.display = "block";

    } else {
        // Not Submitted
        badgeContainer.innerHTML = `<span class="kyc-status-badge status-not_submitted">Not Submitted</span>`;

        iconAadhaar.className = "checklist-icon icon-locked";
        iconAadhaar.textContent = "!";
        textAadhaar.textContent = "Not Submitted Yet";

        iconDl.className = "checklist-icon icon-locked";
        iconDl.textContent = "!";
        textDl.textContent = "Not Submitted Yet";

        iconBookingGate.className = "checklist-icon icon-locked";
        iconBookingGate.textContent = "🔒";
        textBookingGate.textContent = "Locked until Approved";

        noticeContainer.innerHTML = `
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 18px; margin-bottom: 16px;">
                <h3 style="color: #1e40af; margin: 0 0 6px; font-size: 1.15rem;">Action Required: Submit Verification Documents</h3>
                <p style="color: #1e3a8a; margin: 0; font-size: 0.9rem; line-height: 1.5;">
                    To protect our fleet and comply with rental regulations, all drivers must be verified before reserving a vehicle. Please upload your ID Proof (Aadhaar or PAN) and Driving Licence below.
                </p>
            </div>
        `;
        formCard.style.display = "block";
    }
}

// Setup file listeners
const kycIdFile = document.getElementById("kycIdFile");
const kycDlFile = document.getElementById("kycDlFile");

if (kycIdFile) {
    kycIdFile.addEventListener("change", async function () {
        compressedIdBase64 = await compressImageFile(this.files[0]);
        const p = document.getElementById("kycIdPreview");
        if (p && compressedIdBase64) {
            p.querySelector("img").src = compressedIdBase64;
            p.style.display = "block";
        }
    });
}

if (kycDlFile) {
    kycDlFile.addEventListener("change", async function () {
        compressedDlBase64 = await compressImageFile(this.files[0]);
        const p = document.getElementById("kycDlPreview");
        if (p && compressedDlBase64) {
            p.querySelector("img").src = compressedDlBase64;
            p.style.display = "block";
        }
    });
}

// Form Submission
if (kycForm) {
    kycForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!currentUser) return;

        if (!compressedIdBase64 || !compressedDlBase64) {
            formMessage.innerHTML = `<span style="color:red; font-weight:600;">Please select and attach both your ID proof and Driving Licence files.</span>`;
            return;
        }

        const idType = document.getElementById("kycIdType").value;
        const consent = document.getElementById("kycConsentCheckbox").checked;

        if (!consent) {
            formMessage.innerHTML = `<span style="color:red; font-weight:600;">You must provide explicit verification consent.</span>`;
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Compressing & Submitting Documents...";
        formMessage.innerHTML = "";

        try {
            await db.collection("users").doc(currentUser.uid).update({
                id_type: idType,
                id_document: compressedIdBase64,
                dl_document: compressedDlBase64,
                kyc_status: "Pending Review",
                kyc_consent: true,
                kyc_submitted_at: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            formMessage.innerHTML = `<span style="color:#16a34a; font-weight:600;">✓ Verification documents submitted successfully! Admin will review shortly.</span>`;

            setTimeout(async () => {
                await loadKycStatus();
                window.scrollTo({ top: 0, behavior: "smooth" });
            }, 800);

        } catch (err) {
            console.error("KYC submission error:", err);
            formMessage.innerHTML = `<span style="color:red;">Submission failed: ${escapeHTML(err.message)}</span>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Documents for Admin Verification";
        }
    });
}

// Auth Listener
if (auth) {
    auth.onAuthStateChanged(function (user) {
        if (user) {
            loadKycStatus();
        } else {
            window.location.href = "login.html";
        }
    });
}
