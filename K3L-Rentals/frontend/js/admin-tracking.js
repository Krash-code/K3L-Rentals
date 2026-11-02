// K3L Rentals - Admin Live Trip Tracking Engine
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

let currentAdmin = null;
const container = document.getElementById("trackingContainer");
const refreshBtn = document.getElementById("refreshTrackingBtn");

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
            alert("Admin privileges required.");
            window.location.href = "admin-login.html";
            return false;
        }
        currentAdmin = user;
        return true;
    } catch (err) {
        console.error("Admin verification error:", err);
        if (container) {
            container.innerHTML = `<div class="info-card"><h3>Admin Verification Error</h3><p>${escapeHTML(err.message)}</p></div>`;
        }
        return false;
    }
}

// Load and Render Active Bookings with Tracking Telemetry
async function loadActiveTracking() {
    if (!container) return;
    container.innerHTML = "<p>Loading active rental fleet...</p>";

    try {
        // Query active bookings
        const snapshot = await db.collection("bookings")
            .where("status", "in", ["Active", "in_use", "in use"])
            .get();

        const activeRentals = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (activeRentals.length === 0) {
            container.innerHTML = `
                <div class="info-card" style="text-align: center; padding: 40px 20px;">
                    <h3>No Vehicles Currently On The Road</h3>
                    <p style="color: var(--slate-500); margin-top: 6px;">
                        There are currently no active rental trips underway. Live tracking activates once vehicle handover is confirmed by staff.
                    </p>
                    <div style="margin-top: 14px;">
                        <a href="admin-bookings.html" class="primary-btn">View All Bookings</a>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="margin-bottom: 12px; font-size: 0.9rem; color: var(--slate-600);">
                Active Rentals On Road: <strong>${activeRentals.length}</strong>
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px;">
                ${activeRentals.map(b => renderTrackingCard(b)).join("")}
            </div>
        `;

    } catch (err) {
        console.error("Tracking load error:", err);
        container.innerHTML = `<div class="info-card"><h3>Failed to load tracking data</h3><p>${escapeHTML(err.message)}</p></div>`;
    }
}

function renderTrackingCard(b) {
    const tracking = b.tracking || {};
    const isSharing = !!tracking.is_sharing;
    const category = String(b.category || "car").toLowerCase();
    const icon = category === "bike" ? "🏍️" : "🚗";

    let lastUpdatedTime = "Never";
    let isRecent = false;
    if (tracking.last_updated) {
        const timeMs = tracking.last_updated.toMillis ? tracking.last_updated.toMillis() : new Date(tracking.last_updated).getTime();
        const diffSec = Math.round((Date.now() - timeMs) / 1000);
        lastUpdatedTime = new Date(timeMs).toLocaleTimeString();
        if (diffSec < 180) { // within 3 minutes
            isRecent = true;
        }
    }

    let statusPill = "";
    if (isSharing && isRecent) {
        statusPill = `<span class="tracking-status-pill live">● Live Location Streaming</span>`;
    } else if (isSharing && !isRecent) {
        statusPill = `<span class="tracking-status-pill offline">⚠️ Location Stale / Browser Backgrounded</span>`;
    } else if (tracking.permission_denied) {
        statusPill = `<span class="tracking-status-pill denied">✗ Customer Location Denied</span>`;
    } else {
        statusPill = `<span class="tracking-status-pill offline">○ Not Sharing Location</span>`;
    }

    let mapSection = "";
    if (tracking.latitude && tracking.longitude) {
        const lat = Number(tracking.latitude).toFixed(6);
        const lon = Number(tracking.longitude).toFixed(6);
        const acc = Math.round(Number(tracking.accuracy_m || 0));
        const osmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;

        mapSection = `
            <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
                    <div style="font-size: 0.88rem; color: #1e293b;">
                        <strong>Coordinates:</strong> <code>${lat}, ${lon}</code> • 
                        <span>Accuracy: &plusmn;${acc} meters</span> • 
                        <span style="color: #64748b;">Updated: ${lastUpdatedTime}</span>
                    </div>
                    <a href="${osmUrl}" target="_blank" rel="noopener noreferrer" class="secondary-btn" style="padding: 4px 10px; font-size: 0.8rem; text-decoration: none;">
                        🗺️ Open in OpenStreetMap ↗
                    </a>
                </div>
                <!-- Free OpenStreetMap Embed without any paid API keys -->
                <div style="width: 100%; height: 200px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1;">
                    <iframe
                        width="100%"
                        height="100%"
                        frameborder="0"
                        scrolling="no"
                        marginheight="0"
                        marginwidth="0"
                        src="https://www.openstreetmap.org/export/embed.html?bbox=${Number(lon)-0.01}%2C${Number(lat)-0.01}%2C${Number(lon)+0.01}%2C${Number(lat)+0.01}&amp;layer=mapnik&amp;marker=${lat}%2C${lon}">
                    </iframe>
                </div>
            </div>
        `;
    } else {
        mapSection = `
            <div style="margin-top: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; text-align: center; color: #64748b; font-size: 0.85rem;">
                No GPS coordinates received yet. Customer has not enabled location sharing on their device.
            </div>
        `;
    }

    return `
        <div class="tracking-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1.3rem;">${icon}</span>
                        <h3 style="margin: 0; font-size: 1.15rem; color: var(--slate-900);">${escapeHTML(b.model || "Vehicle")}</h3>
                        <span style="background: var(--slate-100); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.82rem;">
                            ${escapeHTML(b.vehicle_number || "N/A")}
                        </span>
                    </div>
                    <div style="margin-top: 4px; font-size: 0.85rem; color: var(--slate-600);">
                        Customer: <strong>${escapeHTML(b.customerName || "Customer")}</strong> (${escapeHTML(b.customerPhone || "No Phone")}) • 
                        Hub: 📍 ${escapeHTML(b.location || "Coimbatore")} • 
                        Trip Dates: ${escapeHTML(b.start_date || "")} → ${escapeHTML(b.end_date || "")}
                    </div>
                </div>
                <div>
                    ${statusPill}
                </div>
            </div>
            ${mapSection}
        </div>
    `;
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

if (refreshBtn) {
    refreshBtn.addEventListener("click", loadActiveTracking);
}

// Authentication state listener
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        const isAdmin = await checkAdminAccess(user);
        if (isAdmin) {
            await loadActiveTracking();
            // Auto refresh every 45 seconds for active admin dashboard
            setInterval(loadActiveTracking, 45000);
        }
    });
}
