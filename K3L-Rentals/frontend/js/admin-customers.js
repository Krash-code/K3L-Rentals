// K3L Rentals - Admin Customer Management
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

let allCustomers = [];

const container = document.getElementById("customerTableContainer");
const searchInput = document.getElementById("searchInput");

// Check admin access
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
        return true;
    } catch (error) {
        console.error("Admin verification error:", error);
        if (container) {
            container.innerHTML = `
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

// Search input listener
if (searchInput) {
    searchInput.addEventListener("input", filterCustomers);
}

// Load customers from Firestore
async function loadCustomers() {
    try {
        container.innerHTML = "<p>Loading customers...</p>";

        const snapshot = await db.collection("users").get();

        allCustomers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).filter(user => (user.role || "customer") === "customer");

        displayCustomers(allCustomers);

    } catch (error) {
        console.error("Customer loading error:", error);
        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load customers</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

// Display Customers Table
function displayCustomers(customers) {
    if (customers.length === 0) {
        container.innerHTML = `
            <div class="info-card">
                <h3>No registered customers found</h3>
                <p>New user registrations will be listed here.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>Full Name</th>
                        <th>Email Address</th>
                        <th>Phone Number</th>
                        <th>Account Role</th>
                    </tr>
                </thead>
                <tbody>
                    ${customers.map(customer => `
                        <tr>
                            <td><code>${escapeHtml(customer.id.substring(0, 10))}...</code></td>
                            <td><strong>${escapeHtml(customer.name || "Customer")}</strong></td>
                            <td>${escapeHtml(customer.email || "N/A")}</td>
                            <td>${escapeHtml(customer.phone || "N/A")}</td>
                            <td>
                                <span class="admin-status available">
                                    ${escapeHtml(customer.role || "customer")}
                                </span>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

// Filter Customers
function filterCustomers() {
    const search = (searchInput?.value || "").toLowerCase().trim();

    const filtered = allCustomers.filter(c => {
        const name = String(c.name || "").toLowerCase();
        const email = String(c.email || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        return name.includes(search) || email.includes(search) || phone.includes(search);
    });

    displayCustomers(filtered);
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

// Auth state
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        const isAdmin = await checkAdminAccess(user);
        if (isAdmin) {
            await loadCustomers();
        }
    });
}
