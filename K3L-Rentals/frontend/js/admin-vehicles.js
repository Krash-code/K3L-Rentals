// K3L Rentals - Admin Vehicle Management
var auth = window.auth || (typeof firebase !== "undefined" ? firebase.auth() : null);
var db = window.db || (typeof firebase !== "undefined" ? firebase.firestore() : null);

// DOM Elements
const vehicleFormContainer = document.getElementById("vehicleFormContainer");
const showAddFormBtn = document.getElementById("showAddFormBtn");
const cancelFormBtn = document.getElementById("cancelFormBtn");
const vehicleForm = document.getElementById("vehicleForm");
const formTitle = document.getElementById("formTitle");
const formMessage = document.getElementById("formMessage");
const vehicleTableContainer = document.getElementById("vehicleTableContainer");
const categorySelect = document.getElementById("category");
const typeSelect = document.getElementById("type");

// Vehicle category mapping
const vehicleTypes = {
    car: ["SUV", "Sedan", "Hatchback", "MUV", "Luxury", "Van"],
    bike: ["Standard", "Sports", "Cruiser", "Scooter", "Electric"]
};

function updateVehicleTypes(selectedType = "") {
    if (!categorySelect || !typeSelect) return;

    const category = categorySelect.value || "car";
    const types = vehicleTypes[category] || vehicleTypes.car;

    typeSelect.innerHTML = `
        <option value="">Select Type</option>
        ${types.map(type => `
            <option value="${escapeHTML(type)}" ${type === selectedType ? "selected" : ""}>
                ${escapeHTML(type)}
            </option>
        `).join("")}
    `;
}

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
            alert("Administrative privileges required.");
            window.location.href = "admin-login.html";
            return false;
        }
        return true;
    } catch (error) {
        console.error("Admin verification error:", error);
        alert("Unable to verify admin access: " + error.message);
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

// Show Add Form
if (showAddFormBtn) {
    showAddFormBtn.addEventListener("click", function () {
        resetForm();
        formTitle.textContent = "Add New Vehicle";
        vehicleFormContainer.classList.remove("hidden");
        updateVehicleTypes();
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// Cancel Form
if (cancelFormBtn) {
    cancelFormBtn.addEventListener("click", function () {
        vehicleFormContainer.classList.add("hidden");
        resetForm();
    });
}

// Category Change
if (categorySelect) {
    categorySelect.addEventListener("change", function () {
        updateVehicleTypes();
    });
}

function resetForm() {
    if (vehicleForm) vehicleForm.reset();
    const vIdElem = document.getElementById("vehicleId");
    if (vIdElem) vIdElem.value = "";
    if (categorySelect) {
        categorySelect.value = "car";
        updateVehicleTypes();
    }
    if (formMessage) {
        formMessage.textContent = "";
        formMessage.style.color = "";
    }
}

// Load Vehicles from Firestore
async function loadVehicles() {
    if (!vehicleTableContainer) return;

    try {
        vehicleTableContainer.innerHTML = "<p>Loading vehicles...</p>";
        const snapshot = await db.collection("vehicles").get();

        const vehicles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        displayVehicles(vehicles);

    } catch (error) {
        console.error("Load vehicles error:", error);
        vehicleTableContainer.innerHTML = `
            <div class="info-card">
                <h3>Unable to load vehicles</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}

// Display Vehicles in Table
function displayVehicles(vehicles) {
    if (vehicles.length === 0) {
        vehicleTableContainer.innerHTML = `
            <div class="info-card">
                <h3>No vehicles registered yet</h3>
                <p>Click the "+ Add Vehicle" button above to add your first fleet asset.</p>
            </div>
        `;
        return;
    }

    vehicleTableContainer.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Registration No.</th>
                        <th>Category</th>
                        <th>Model</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Rate / Day</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${vehicles.map(vehicle => {
                        const category = String(vehicle.category || "car").toLowerCase();
                        const icon = category === "bike" ? "🏍️" : "🚗";
                        const statusClass = String(vehicle.status || "available").toLowerCase().replace(/[\s-]/g, "_");

                        return `
                            <tr>
                                <td><strong>${escapeHTML(vehicle.vehicle_number || "N/A")}</strong></td>
                                <td>${icon} ${escapeHTML(category.toUpperCase())}</td>
                                <td>${escapeHTML(vehicle.model || "N/A")}</td>
                                <td>${escapeHTML(vehicle.type || "N/A")}</td>
                                <td>📍 ${escapeHTML(vehicle.location || "N/A")}</td>
                                <td>₹${Number(vehicle.price_per_day || 0).toLocaleString("en-IN")}</td>
                                <td>
                                    <span class="admin-status ${statusClass}">
                                        ${escapeHTML(vehicle.status || "available")}
                                    </span>
                                </td>
                                <td>
                                    <button class="table-btn edit-btn" data-action="edit" data-id="${escapeHTML(vehicle.id)}">
                                        Edit
                                    </button>
                                    <button class="table-btn delete-btn" data-action="delete" data-id="${escapeHTML(vehicle.id)}">
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

    // Bind Edit and Delete buttons
    vehicleTableContainer.querySelectorAll("button[data-action]").forEach(button => {
        button.addEventListener("click", function () {
            const id = this.dataset.id;
            if (this.dataset.action === "edit") {
                editVehicle(id);
            } else if (this.dataset.action === "delete") {
                deleteVehicle(id);
            }
        });
    });
}

// Edit Vehicle
async function editVehicle(id) {
    try {
        const doc = await db.collection("vehicles").doc(id).get();
        if (!doc.exists) {
            alert("Vehicle not found.");
            return;
        }

        const vehicle = doc.data();

        document.getElementById("vehicleId").value = doc.id;
        document.getElementById("vehicle_number").value = vehicle.vehicle_number || "";
        document.getElementById("model").value = vehicle.model || "";

        if (categorySelect) {
            categorySelect.value = String(vehicle.category || "car").toLowerCase();
            updateVehicleTypes(vehicle.type || "");
        }

        document.getElementById("price_per_day").value = vehicle.price_per_day ?? "";
        document.getElementById("location").value = vehicle.location || "Coimbatore";
        document.getElementById("status").value = String(vehicle.status || "available").toLowerCase();
        document.getElementById("image").value = vehicle.image || "";

        formTitle.textContent = "Edit Vehicle (" + (vehicle.vehicle_number || "Asset") + ")";
        formMessage.textContent = "";

        vehicleFormContainer.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });

    } catch (error) {
        console.error("Edit vehicle error:", error);
        alert("Unable to load vehicle details: " + error.message);
    }
}

// Save or Update Vehicle
if (vehicleForm) {
    vehicleForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const id = document.getElementById("vehicleId").value;
        const category = categorySelect ? categorySelect.value : "car";
        const price = Number(document.getElementById("price_per_day").value);

        const vehicleData = {
            category: category,
            vehicle_number: document.getElementById("vehicle_number").value.trim().toUpperCase(),
            model: document.getElementById("model").value.trim(),
            type: typeSelect ? typeSelect.value : "Standard",
            price_per_day: price,
            location: document.getElementById("location").value.trim(),
            status: document.getElementById("status").value,
            image: document.getElementById("image").value.trim()
        };

        if (
            !vehicleData.category ||
            !vehicleData.vehicle_number ||
            !vehicleData.model ||
            !vehicleData.location ||
            !vehicleData.status ||
            !Number.isFinite(price) ||
            price <= 0
        ) {
            formMessage.textContent = "Please fill in all required fields with valid values.";
            formMessage.style.color = "red";
            return;
        }

        const submitButton = vehicleForm.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;

        formMessage.textContent = "Saving vehicle record...";
        formMessage.style.color = "black";

        try {
            if (id) {
                // Update
                await db.collection("vehicles").doc(id).update({
                    ...vehicleData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                formMessage.textContent = "Vehicle updated successfully!";
            } else {
                // Add
                await db.collection("vehicles").add({
                    ...vehicleData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                formMessage.textContent = "Vehicle added to fleet successfully!";
            }

            formMessage.style.color = "green";
            await loadVehicles();

            setTimeout(function () {
                vehicleFormContainer.classList.add("hidden");
                resetForm();
            }, 600);

        } catch (error) {
            console.error("Save vehicle error:", error);
            formMessage.textContent = "Failed to save vehicle: " + error.message;
            formMessage.style.color = "red";
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
}

// Delete Vehicle
async function deleteVehicle(id) {
    const confirmed = confirm("Are you sure you want to permanently delete this vehicle from the fleet?");
    if (!confirmed) return;

    try {
        await db.collection("vehicles").doc(id).delete();
        alert("Vehicle deleted successfully.");
        await loadVehicles();
    } catch (error) {
        console.error("Delete vehicle error:", error);
        alert("Unable to delete vehicle: " + error.message);
    }
}

// Auth state init
if (auth) {
    auth.onAuthStateChanged(async function (user) {
        const isAdmin = await checkAdminAccess(user);
        if (isAdmin) {
            await loadVehicles();
        }
    });
}
