
// =====================================
// FIREBASE
// =====================================

const db = firebase.firestore();
const auth = firebase.auth();


// =====================================
// ELEMENTS
// =====================================

const vehicleFormContainer =
    document.getElementById("vehicleFormContainer");

const showAddFormBtn =
    document.getElementById("showAddFormBtn");

const cancelFormBtn =
    document.getElementById("cancelFormBtn");

const vehicleForm =
    document.getElementById("vehicleForm");

const formTitle =
    document.getElementById("formTitle");

const formMessage =
    document.getElementById("formMessage");

const vehicleTableContainer =
    document.getElementById("vehicleTableContainer");

const categorySelect =
    document.getElementById("category");

const typeSelect =
    document.getElementById("type");


// =====================================
// VEHICLE TYPES
// =====================================

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
            <option value="${escapeHTML(type)}"
                ${type === selectedType ? "selected" : ""}>
                ${escapeHTML(type)}
            </option>
        `).join("")}
    `;
}


// =====================================
// HTML SAFETY
// =====================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}


// =====================================
// ADMIN ACCESS CHECK
// =====================================

async function checkAdminAccess(user) {
    if (!user) {
        window.location.href = "admin-login.html";
        return false;
    }

    try {
        // Admin must have a manually provisioned trusted record
        const adminDoc = await db
            .collection("admins")
            .doc(user.uid)
            .get();

        if (!adminDoc.exists) {
            await auth.signOut();
            localStorage.removeItem("user");

            alert("You do not have admin access.");
            window.location.href = "admin-login.html";
            return false;
        }

        return true;

    } catch (error) {
        console.error("Admin verification error:", error);

        alert("Unable to verify admin access. Check Firestore rules.");
        return false;
    }
}


// =====================================
// LOGOUT
// =====================================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
}


// =====================================
// SHOW ADD FORM
// =====================================

if (showAddFormBtn) {
    showAddFormBtn.addEventListener("click", function () {
        resetForm();

        formTitle.textContent = "Add Vehicle";
        vehicleFormContainer.classList.remove("hidden");

        updateVehicleTypes();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    });
}


// =====================================
// CANCEL FORM
// =====================================

if (cancelFormBtn) {
    cancelFormBtn.addEventListener("click", function () {
        vehicleFormContainer.classList.add("hidden");
        resetForm();
    });
}


// =====================================
// CATEGORY CHANGE
// =====================================

if (categorySelect) {
    categorySelect.addEventListener("change", function () {
        updateVehicleTypes();
    });
}


// =====================================
// RESET FORM
// =====================================

function resetForm() {
    vehicleForm.reset();

    document.getElementById("vehicleId").value = "";

    if (categorySelect) {
        categorySelect.value = "car";
        updateVehicleTypes();
    }

    formMessage.textContent = "";
    formMessage.style.color = "";
}


// =====================================
// LOAD VEHICLES
// =====================================

async function loadVehicles() {
    try {
        const snapshot = await db
            .collection("vehicles")
            .get();

        const vehicles = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        displayVehicles(vehicles);

    } catch (error) {
        console.error("Load vehicles error:", error);

        vehicleTableContainer.innerHTML = `
            <div class="info-card">
                <h3>Unable to load vehicles.</h3>
                <p>Check your Firestore permissions.</p>
            </div>
        `;
    }
}


// =====================================
// DISPLAY VEHICLES
// =====================================

function displayVehicles(vehicles) {
    if (vehicles.length === 0) {
        vehicleTableContainer.innerHTML = `
            <div class="info-card">
                <h3>No vehicles found.</h3>
            </div>
        `;
        return;
    }

    vehicleTableContainer.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Vehicle Number</th>
                        <th>Category</th>
                        <th>Model</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Price / Day</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>

                <tbody>
                    ${vehicles.map(vehicle => {
                        const category = String(
                            vehicle.category || "car"
                        ).toLowerCase();

                        const icon = category === "bike" ? "🏍️" : "🚗";

                        return `
                            <tr>
                                <td>${escapeHTML(vehicle.vehicle_number || "N/A")}</td>
                                <td>${icon} ${escapeHTML(category)}</td>
                                <td>${escapeHTML(vehicle.model || "N/A")}</td>
                                <td>${escapeHTML(vehicle.type || "N/A")}</td>
                                <td>${escapeHTML(vehicle.location || "N/A")}</td>
                                <td>₹${escapeHTML(vehicle.price_per_day ?? "N/A")}</td>
                                <td>
                                    <span class="admin-status">
                                        ${escapeHTML(vehicle.status || "N/A")}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        class="table-btn edit-btn"
                                        data-action="edit"
                                        data-id="${escapeHTML(vehicle.id)}">
                                        Edit
                                    </button>

                                    <button
                                        class="table-btn delete-btn"
                                        data-action="delete"
                                        data-id="${escapeHTML(vehicle.id)}">
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

    // Handle Edit and Delete buttons
    vehicleTableContainer.querySelectorAll("button[data-action]")
        .forEach(button => {
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


// =====================================
// EDIT VEHICLE
// =====================================

async function editVehicle(id) {
    try {
        const doc = await db
            .collection("vehicles")
            .doc(id)
            .get();

        if (!doc.exists) {
            alert("Vehicle not found.");
            return;
        }

        const vehicle = doc.data();

        document.getElementById("vehicleId").value = doc.id;
        document.getElementById("vehicle_number").value =
            vehicle.vehicle_number || "";

        document.getElementById("model").value =
            vehicle.model || "";

        categorySelect.value =
            String(vehicle.category || "car").toLowerCase();

        updateVehicleTypes(vehicle.type || "");

        document.getElementById("price_per_day").value =
            vehicle.price_per_day ?? "";

        document.getElementById("location").value =
            vehicle.location || "";

        document.getElementById("status").value =
            String(vehicle.status || "available").toLowerCase();

        document.getElementById("image").value =
            vehicle.image || "";

        formTitle.textContent = "Edit Vehicle";
        formMessage.textContent = "";

        vehicleFormContainer.classList.remove("hidden");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    } catch (error) {
        console.error("Edit vehicle error:", error);
        alert("Unable to load vehicle. Check Firestore permissions.");
    }
}


// =====================================
// SAVE VEHICLE
// =====================================

vehicleForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const id = document.getElementById("vehicleId").value;

    const category = categorySelect.value;
    const price = Number(
        document.getElementById("price_per_day").value
    );

    const vehicleData = {
        category: category,

        vehicle_number: document.getElementById("vehicle_number")
            .value.trim().toUpperCase(),

        model: document.getElementById("model")
            .value.trim(),

        type: typeSelect.value,

        price_per_day: price,

        location: document.getElementById("location")
            .value.trim(),

        status: document.getElementById("status").value,

        image: document.getElementById("image")
            .value.trim()
    };

    if (
        !vehicleData.category ||
        !vehicleData.vehicle_number ||
        !vehicleData.model ||
        !vehicleData.type ||
        !vehicleData.location ||
        !vehicleData.status ||
        !Number.isFinite(price) ||
        price <= 0
    ) {
        formMessage.textContent =
            "Please fill in all fields with valid values.";

        formMessage.style.color = "red";
        return;
    }

    const submitButton = vehicleForm.querySelector(
        'button[type="submit"]'
    );

    if (submitButton) {
        submitButton.disabled = true;
    }

    formMessage.textContent = "Saving vehicle...";
    formMessage.style.color = "black";

    try {
        if (id) {
            // Update existing vehicle
            await db.collection("vehicles")
                .doc(id)
                .update({
                    ...vehicleData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

        } else {
            // Add new vehicle
            await db.collection("vehicles")
                .add({
                    ...vehicleData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
        }

        formMessage.textContent = id
            ? "Vehicle updated successfully!"
            : "Vehicle added successfully!";

        formMessage.style.color = "green";

        await loadVehicles();

        setTimeout(function () {
            vehicleFormContainer.classList.add("hidden");
            resetForm();
        }, 700);

    } catch (error) {
        console.error("Save vehicle error:", error);

        formMessage.textContent =
            "Unable to save vehicle. Check admin permissions.";

        formMessage.style.color = "red";

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
});


// =====================================
// DELETE VEHICLE
// =====================================

async function deleteVehicle(id) {
    const confirmed = confirm(
        "Are you sure you want to delete this vehicle?"
    );

    if (!confirmed) return;

    try {
        await db.collection("vehicles")
            .doc(id)
            .delete();

        alert("Vehicle deleted successfully.");

        await loadVehicles();

    } catch (error) {
        console.error("Delete vehicle error:", error);

        alert("Unable to delete vehicle. Check admin permissions.");
    }
}


// =====================================
// INITIAL LOAD
// =====================================

auth.onAuthStateChanged(async function (user) {
    const isAdmin = await checkAdminAccess(user);

    if (isAdmin) {
        await loadVehicles();
    }
});
