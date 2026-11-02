// K3L Rentals - Customer In-App Notification Center
(function () {
    const auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
    const db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

    let unsubscribeNotifs = null;

    function initNotificationCenter(user) {
        if (!user || !db) return;

        // Find or create notification bell container in navbar
        const navbar = document.querySelector(".navbar nav");
        if (!navbar || document.getElementById("notifBellContainer")) return;

        const bellContainer = document.createElement("div");
        bellContainer.id = "notifBellContainer";
        bellContainer.style.position = "relative";
        bellContainer.style.display = "inline-flex";
        bellContainer.style.alignItems = "center";
        bellContainer.style.marginRight = "8px";

        bellContainer.innerHTML = `
            <button id="notifBellBtn" title="Notifications" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; font-size: 1.1rem;">
                🔔
                <span id="notifBadge" style="display: none; position: absolute; top: -3px; right: -3px; background: #ef4444; color: white; border-radius: 10px; padding: 1px 6px; font-size: 0.7rem; font-weight: bold; border: 2px solid var(--slate-900);">0</span>
            </button>

            <!-- Notifications Dropdown -->
            <div id="notifDropdown" style="display: none; position: absolute; top: 48px; right: 0; width: 330px; background: white; color: var(--slate-900); border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 1px solid #e2e8f0; z-index: 1000; overflow: hidden;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                    <strong style="font-size: 0.92rem; color: #1e293b;">Notifications</strong>
                    <button id="markAllReadBtn" style="background: none; border: none; font-size: 0.78rem; color: #2563eb; cursor: pointer; font-weight: 500;">Mark all read</button>
                </div>
                <div id="notifList" style="max-height: 320px; overflow-y: auto; padding: 8px 0;">
                    <p style="padding: 16px; text-align: center; color: #64748b; font-size: 0.85rem;">No new notifications</p>
                </div>
                <div style="padding: 10px; text-align: center; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                    <a href="my-bookings.html" style="font-size: 0.82rem; color: #2563eb; font-weight: 600;">View in My Bookings →</a>
                </div>
            </div>
        `;

        // Insert before logoutBtn if present, otherwise append
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn && logoutBtn.parentNode === navbar) {
            navbar.insertBefore(bellContainer, logoutBtn);
        } else {
            navbar.appendChild(bellContainer);
        }

        const bellBtn = document.getElementById("notifBellBtn");
        const dropdown = document.getElementById("notifDropdown");
        const badge = document.getElementById("notifBadge");
        const list = document.getElementById("notifList");
        const markAllReadBtn = document.getElementById("markAllReadBtn");

        bellBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
        });

        document.addEventListener("click", function (e) {
            if (!bellContainer.contains(e.target)) {
                dropdown.style.display = "none";
            }
        });

        // Listen for user notifications
        if (unsubscribeNotifs) unsubscribeNotifs();

        unsubscribeNotifs = db.collection("users")
            .doc(user.uid)
            .collection("notifications")
            .orderBy("createdAt", "desc")
            .limit(15)
            .onSnapshot(snapshot => {
                const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                const unreadCount = notifs.filter(n => !n.read).length;

                if (unreadCount > 0) {
                    badge.style.display = "inline-block";
                    badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
                } else {
                    badge.style.display = "none";
                }

                if (notifs.length === 0) {
                    list.innerHTML = `<p style="padding: 16px; text-align: center; color: #64748b; font-size: 0.85rem;">No notifications yet.</p>`;
                    return;
                }

                list.innerHTML = notifs.map(n => {
                    const isUnread = !n.read;
                    const dateStr = n.createdAt?.toMillis ? new Date(n.createdAt.toMillis()).toLocaleDateString() : "";
                    return `
                        <div class="notif-item" data-id="${n.id}" style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; background: ${isUnread ? '#eff6ff' : 'white'}; cursor: pointer; transition: background 0.2s;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                                <strong style="font-size: 0.85rem; color: #1e293b;">${escapeHTML(n.title || "Notification")}</strong>
                                <small style="color: #94a3b8; font-size: 0.72rem;">${escapeHTML(dateStr)}</small>
                            </div>
                            <p style="font-size: 0.8rem; color: #475569; margin: 0; line-height: 1.4;">${escapeHTML(n.message || "")}</p>
                        </div>
                    `;
                }).join("");

                list.querySelectorAll(".notif-item").forEach(item => {
                    item.addEventListener("click", async function () {
                        const notifId = this.dataset.id;
                        await db.collection("users").doc(user.uid).collection("notifications").doc(notifId).update({ read: true }).catch(console.warn);
                        window.location.href = "my-bookings.html";
                    });
                });
            }, err => {
                console.warn("Notifications listener note:", err);
            });

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener("click", async function () {
                const snap = await db.collection("users").doc(user.uid).collection("notifications").where("read", "==", false).get();
                const batch = db.batch();
                snap.forEach(doc => {
                    batch.update(doc.ref, { read: true });
                });
                await batch.commit().catch(console.warn);
            });
        }
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

    // Connect to auth state
    if (auth) {
        auth.onAuthStateChanged(user => {
            if (user) {
                initNotificationCenter(user);
            } else {
                if (unsubscribeNotifs) {
                    unsubscribeNotifs();
                    unsubscribeNotifs = null;
                }
                const b = document.getElementById("notifBellContainer");
                if (b) b.remove();
            }
        });
    }
})();

