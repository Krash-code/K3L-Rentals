// K3L Rentals - Admin Maintenance Management
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

const formContainer = document.getElementById("maintenanceFormContainer");
const form = document.getElementById("maintenanceForm");
const formTitle = document.getElementById("maintenanceFormTitle");
const formMessage = document.getElementById("maintenanceFormMessage");
const maintenanceTableContainer = document.getElementById("maintenanceTableContainer");
const vehicleSelect = document.getElementById("vehicle_id");

// Escape HTML
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Date formatter
function formatDate(date) {
    if (!date) return "N/A";
    if (date.toDate) return date.toDate().toISOString().split("T")[0];
    return String(date).split("T")[0];
}

// Status formatter
function formatStatus(status) {
    if (!status) return "Unknown";
    return String(status).replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

// Admin access check
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
            alert("Administrative access required.");
            window.location.href = "admin-login.html";
            return false;
        }
        return true;
    } catch (error) {
        console.error("Admin verification error:", error);
        if (maintenanceTableContainer) {
            maintenanceTableContainer.innerHTML = `
                <div class="info-card">
                    <h3>Unable to verify admin access</h3>
                    <p>${escapeHTML(error.message)}</p>
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

// Open Add Form
function openAddForm() {
    if (form) form.reset();
    const idElem = document.getElementById("maintenanceId");
    if (idElem) idElem.value = "";
    if (formTitle) formTitle.textContent = "Schedule Maintenance";
    if (formMessage) formMessage.textContent = "";
    if (formContainer) formContainer.classList.remove("hidden");
    loadVehicles();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

const addBtn = document.getElementById("addMaintenanceBtn");
if (addBtn) addBtn.addEventListener("click", openAddForm);

// Close Form
function closeForm() {
    if (formContainer) formContainer.classList.add("hidden");
    if (form) form.reset();
    const idElem = document.getElementById("maintenanceId");
    if (idElem) idElem.value = "";
    if (formMessage) formMessage.textContent = "";
}

const cancelBtn = document.getElementById("cancelMaintenance");
if (cancelBtn) cancelBtn.addEventListener("click", closeForm);

// Load vehicles into select dropdown
async function loadVehicles(selectedVehicleId = "") {
    if (!vehicleSelect) return;

    try {
        const snapshot = await db.collection("vehicles").get();
        vehicleSelect.innerHTML = '<option value="">Select Vehicle</option>';

        snapshot.forEach(doc => {
            const v = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            const category = String(v.category || "car").toLowerCase();
            const icon = category === "bike" ? "🏍️" : "🚗";
            option.textContent = `${icon} ${v.vehicle_number || "N/A"} - ${v.model || "Vehicle"}`;
            if (doc.id === selectedVehicleId) option.selected = true;
            vehicleSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Vehicle loading error:", error);
    }
}

// Load Maintenance Records
async function loadMaintenance() {
    if (!maintenanceTableContainer) return;

    try {
        maintenanceTableContainer.innerHTML = "<p>Loading maintenance records...</p>";

        const snapshot = await db.collection("maintenance").get();
        const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        displayMaintenance(records);

    } catch (error) {
        console.error("Maintenance loading error:", error);
        maintenanceTableContainer.innerHTML = `
            <div class="info-card">
                <h3>Unable to load maintenance records</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}

// Display Maintenance Table
function displayMaintenance(records) {
    if (records.length === 0) {
        maintenanceTableContainer.innerHTML = `
            <div class="info-card">
                <h3>No maintenance records</h3>
                <p>Click "+ Add Maintenance" to schedule servicing for any fleet vehicle.</p>
            </div>
        `;
        return;
    }

    maintenanceTableContainer.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Vehicle</th>
                        <th>Service Date</th>
                        <th>Next Service</th>
                        <th>Status</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(record => {
                        const status = record.status || "scheduled";
                        const statusClass = status.toLowerCase().replace(/[\s-]/g, "_");

                        return `
                            <tr>
                                <td>
                                    <strong>${escapeHTML(record.vehicle_number || record.model || record.vehicle_id)}</strong><br>
                                    <small>${escapeHTML(record.model || "")}</small>
                                </td>
                                <td>${escapeHTML(formatDate(record.service_date))}</td>
                                <td>${escapeHTML(formatDate(record.next_service_date))}</td>
                                <td>
                                    <span class="admin-status ${statusClass}">
                                        ${escapeHTML(formatStatus(status))}
                                    </span>
                                </td>
                                <td>${escapeHTML(record.description || "N/A")}</td>
                                <td>
                                    <button class="table-btn edit-btn" data-action="edit" data-id="${escapeHTML(record.id)}">
                                        Edit
                                    </button>
                                    <button class="table-btn delete-btn" data-action="delete" data-id="${escapeHTML(record.id)}">
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        </div>
    `;

    maintenanceTableContainer.querySelectorAll("button[data-action]").forEach(btn => {
        btn.addEventListener("click", function () {
            const id = this.dataset.id;
            if (this.dataset.action === "edit") {
                editMaintenance(id);
            } else if (this.dataset.action === "delete") {
                deleteMaintenance(id);
            }
        });
    });
}

// Edit Maintenance Record
async function editMaintenance(id) {
    try {
        const doc = await db.collection("maintenance").doc(id).get();
        if (!doc.exists) {
            alert("Record not found.");
            return;
        }

        const data = doc.data();
        document.getElementById("maintenanceId").value = doc.id;
        document.getElementById("service_date").value = formatDate(data.service_date);
        document.getElementById("next_service_date").value = formatDate(data.next_service_date);
        document.getElementById("maintenance_status").value = data.status || "scheduled";
        document.getElementById("description").value = data.description || "";

        await loadVehicles(data.vehicle_id);

        formTitle.textContent = "Edit Maintenance Record";
        formMessage.textContent = "";
        formContainer.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (error) {
        console.error("Edit maintenance error:", error);
        alert("Failed to load record: " + error.message);
    }
}

// Form Submit: Add / Edit Maintenance
if (form) {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const id = document.getElementById("maintenanceId").value;
        const vehicleId = document.getElementById("vehicle_id").value;
        const serviceDate = document.getElementById("service_date").value;
        const nextServiceDate = document.getElementById("next_service_date").value;
        const status = document.getElementById("maintenance_status").value;
        const description = document.getElementById("description").value.trim();

        if (!vehicleId || !serviceDate || !nextServiceDate || !description) {
            formMessage.textContent = "Please fill in all required fields.";
            formMessage.style.color = "red";
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        formMessage.textContent = "Saving maintenance record...";
        formMessage.style.color = "black";

        try {
            // Get vehicle details for quick display
            const vDoc = await db.collection("vehicles").doc(vehicleId).get();
            const vData = vDoc.exists ? vDoc.data() : {};

            const recordData = {
                vehicle_id: vehicleId,
                vehicle_number: vData.vehicle_number || "",
                model: vData.model || "",
                service_date: serviceDate,
                next_service_date: nextServiceDate,
                status: status,
                description: description,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (id) {
                await db.collection("maintenance").doc(id).update(recordData);
                formMessage.textContent = "Record updated successfully!";
            } else {
                recordData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection("maintenance").add(recordData);
                formMessage.textContent = "Record scheduled successfully!";
            }

            // Sync vehicle status if under maintenance or completed
            if (status === "in_progress") {
                await db.collection("vehicles").doc(vehicleId).update({
                    status: "maintenance",
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else if (status === "completed") {
                await db.collection("vehicles").doc(vehicleId).update({
                    status: "available",
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            formMessage.style.color = "green";
            await loadMaintenance();

            setTimeout(() => {
                closeForm();
            }, 600);

        } catch (error) {
            console.error("Save maintenance error:", error);
            formMessage.textContent = "Failed to save: " + error.message;
            formMessage.style.color = "red";
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// Delete Maintenance Record
async function deleteMaintenance(id) {
    const confirmed = confirm("Are you sure you want to delete this maintenance record?");
    if (!confirmed) return;

    try {
        await db.collection("maintenance").doc(id).delete();
        alert("Record deleted successfully.");
        await loadMaintenance();
    } catch (error) {
        console.error("Delete maintenance error:", error);
        alert("Failed to delete record: " + error.message);
    }
}

// Auth listener
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        const isAdmin = await checkAdminAccess(user);
        if (isAdmin) {
            await loadMaintenance();
        }
    });
}
