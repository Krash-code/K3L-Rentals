
const auth = firebase.auth();
const db = firebase.firestore();

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

        return true;

    } catch (error) {
        console.error("Admin verification error:", error);

        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to verify admin access.</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;

        return false;
    }
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", function () {
    logout();
});

// Search customers
searchInput.addEventListener("input", filterCustomers);

// Load customers from Firestore
async function loadCustomers() {
    try {
        container.innerHTML = "<p>Loading customers...</p>";

        const snapshot = await db
            .collection("users")
            .get();

        allCustomers = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data()
            }))
            .filter(customer => customer.role === "customer");

        displayCustomers(allCustomers);

    } catch (error) {
        console.error("Customer loading error:", error);

        container.innerHTML = `
            <div class="info-card">
                <h3>Unable to load customers.</h3>
                <p>${escapeHtml(error.message)}</p>
            </div>
        `;
    }
}

// Display customers
function displayCustomers(customers) {
    if (customers.length === 0) {
        container.innerHTML = `
            <div class="info-card">
                <h3>No customers found.</h3>
                <p>There are currently no customers.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Role</th>
                    </tr>
                </thead>

                <tbody>
                    ${customers.map(customer => `
                        <tr>
                            <td>${escapeHtml(customer.id)}</td>

                            <td>${escapeHtml(customer.name || "N/A")}</td>

                            <td>${escapeHtml(customer.email || "N/A")}</td>

                            <td>${escapeHtml(customer.phone || "N/A")}</td>

                            <td>
                                <span class="admin-status customer">
                                    Customer
                                </span>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

// Search customers
function filterCustomers() {
    const search = searchInput.value
        .toLowerCase()
        .trim();

    const filtered = allCustomers.filter(customer => {
        return (
            String(customer.name || "")
                .toLowerCase()
                .includes(search) ||

            String(customer.email || "")
                .toLowerCase()
                .includes(search) ||

            String(customer.phone || "")
                .toLowerCase()
                .includes(search)
        );
    });

    displayCustomers(filtered);
}

// Escape HTML
function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initial load after authentication
auth.onAuthStateChanged(async function (user) {
    const isAdmin = await checkAdminAccess(user);

    if (isAdmin) {
        await loadCustomers();
    }
});
