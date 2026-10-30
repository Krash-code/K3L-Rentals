
const db = firebase.firestore();
const auth = firebase.auth();


// =====================================
// ELEMENTS
// =====================================

const formContainer = document.getElementById("maintenanceFormContainer");
const form = document.getElementById("maintenanceForm");
const formTitle = document.getElementById("maintenanceFormTitle");
const formMessage = document.getElementById("maintenanceFormMessage");

const maintenanceTableContainer = document.getElementById(
    "maintenanceTableContainer"
);

const vehicleSelect = document.getElementById("vehicle_id");


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
// DATE FORMAT
// =====================================

function formatDate(date) {
    if (!date) return "";

    if (date.toDate && typeof date.toDate === "function") {
        date = date.toDate();
    }

    if (date instanceof Date) {
        return date.toISOString().split("T")[0];
    }

    return String(date).split("T")[0];
}


// =====================================
// STATUS FORMAT
// =====================================

function formatStatus(status) {
    if (!status) return "Unknown";

    return String(status)
        .replace(/_/g, " ")
        .replace(/\b\w/g, letter => letter.toUpperCase());
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

        maintenanceTableContainer.innerHTML = `
            <div class="info-card">
                <h3>Unable to verify admin access.</h3>
                <p>Check Firestore permissions.</p>
            </div>
        `;

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
// OPEN ADD FORM
// =====================================

function openAddForm() {
    form.reset();

    document.getElementById("maintenanceId").value = "";

    formTitle.textContent = "Add Maintenance Record";
    formMessage.textContent = "";

    formContainer.classList.remove("hidden");

    loadVehicles();
}


document.getElementById("addMaintenanceBtn")
    .addEventListener("click", openAddForm);


// =====================================
// CLOSE FORM
// =====================================

function closeForm() {
    formContainer.classList.add("hidden");
    form.reset();

    document.getElementById("maintenanceId").value = "";
    formMessage.textContent = "";
}


document.getElementById("cancelMaintenance")
    .addEventListener("click", closeForm);


// =====================================
// LOAD VEHICLES
// =====================================

async function loadVehicles(selectedVehicleId = "") {
    try {
        const snapshot = await db
            .collection("vehicles")
            .get();

        vehicleSelect.innerHTML = `
            <option value="">Select Vehicle</option>
        `;

        snapshot.forEach(doc => {
            const vehicle = doc.data();

            const option = document.createElement("option");

            option.value = doc.id;

            const category = String(
                vehicle.category || "car"
            ).toLowerCase();

            const icon = category === "bike" ? "🏍️" : "🚗";

            option.textContent =
                `${icon} ${vehicle.vehicle_number || "N/A"} - ${vehicle.model || "Vehicle"}`;

            if (doc.id === selectedVehicleId) {
                option.selected = true;
            }

            vehicleSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Vehicle loading error:", error);
        alert("Unable to load vehicles. Check Firestore permissions.");
    }
}


// =====================================
// LOAD MAINTENANCE
// =====================================

async function loadMaintenance() {
    try {
        const snapshot = await db
            .collection("maintenance")
            .get();

        const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Get vehicle details for displaying maintenance records
        const vehicleSnapshot = await db
            .collection("vehicles")
            .get();

        const vehicleMap = {};

        vehicleSnapshot.forEach(doc => {
            vehicleMap[doc.id] = doc.data();
        });

        records.forEach(record => {
            const vehicle = vehicleMap[record.vehicleId];

            if (vehicle) {
                record.vehicle_number = vehicle.vehicle_number || "N/A";
                record.model = vehicle.model || "Vehicle";
                record.category = vehicle.category || "car";
            }
        });

        displayMaintenance(records);

    } catch (error) {
        console.error("Maintenance loading error:", error);

        maintenanceTableContainer.innerHTML = `
            <div class="info-card">
                <h3>Unable to load maintenance records.</h3>
                <p>${escapeHTML(error.message)}</p>
            </div>
        `;
    }
}


// =====================================
// DISPLAY MAINTENANCE
// =====================================

function displayMaintenance(records) {
    if (records.length === 0) {
        maintenanceTableContainer.innerHTML = `
            <div class="info-card">
                <h3>No maintenance records found.</h3>
                <p>Add a maintenance record to get started.</p>
            </div>
        `;
        return;
    }

    maintenanceTableContainer.innerHTML = `
        <div class="admin-table-wrapper">
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Vehicle</th>
                        <th>Service Date</th>
                        <th>Next Service</th>
                        <th>Description</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>

                <tbody>
                    ${records.map(record => `
                        <tr>
                            <td>${escapeHTML(record.id)}</td>

                            <td>
                                <strong>
                                    ${escapeHTML(record.vehicle_number || "N/A")}
                                </strong>
                                <br>
                                ${escapeHTML(record.model || "N/A")}
                                <br>
                                ${String(record.category).toLowerCase() === "bike"
                                    ? "🏍️ Bike"
                                    : "🚗 Car"}
                            </td>

                            <td>${escapeHTML(formatDate(record.service_date))}</td>

                            <td>${escapeHTML(formatDate(record.next_service_date))}</td>

                            <td>${escapeHTML(record.description || "N/A")}</td>

                            <td>
                                <span class="admin-status">
                                    ${escapeHTML(formatStatus(record.status))}
                                </span>
                            </td>

                            <td>
                                <button
                                    class="table-btn edit-btn"
                                    data-id="${escapeHTML(record.id)}">
                                    Edit
                                </button>
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;

    maintenanceTableContainer
        .querySelectorAll("button[data-id]")
        .forEach(button => {
            button.addEventListener("click", function () {
                editMaintenance(this.dataset.id);
            });
        });
}


// =====================================
// EDIT MAINTENANCE
// =====================================

async function editMaintenance(id) {
    try {
        const doc = await db
            .collection("maintenance")
            .doc(id)
            .get();

        if (!doc.exists) {
            alert("Maintenance record not found.");
            return;
        }

        const record = doc.data();

        document.getElementById("maintenanceId").value = doc.id;

        formTitle.textContent = "Edit Maintenance Record";

        await loadVehicles(record.vehicleId || "");

        document.getElementById("service_date").value =
            formatDate(record.service_date);

        document.getElementById("next_service_date").value =
            formatDate(record.next_service_date);

        document.getElementById("description").value =
            record.description || "";

        document.getElementById("maintenance_status").value =
            record.status || "scheduled";

        formMessage.textContent = "";

        formContainer.classList.remove("hidden");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    } catch (error) {
        console.error("Edit maintenance error:", error);
        alert("Unable to load maintenance record.");
    }
}


// =====================================
// SUBMIT FORM
// =====================================

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const id = document.getElementById("maintenanceId").value;

    const vehicleId = vehicleSelect.value;

    const serviceDate = document.getElementById("service_date").value;

    const nextServiceDate = document.getElementById("next_service_date").value;

    const description = document.getElementById("description").value.trim();

    const status = document.getElementById("maintenance_status").value;

    if (!vehicleId) {
        formMessage.textContent = "Please select a vehicle.";
        formMessage.style.color = "red";
        return;
    }

    if (!serviceDate) {
        formMessage.textContent = "Please select a service date.";
        formMessage.style.color = "red";
        return;
    }

    if (nextServiceDate && nextServiceDate < serviceDate) {
        formMessage.textContent =
            "Next service date cannot be before service date.";

        formMessage.style.color = "red";
        return;
    }

    if (!description) {
        formMessage.textContent =
            "Please enter a maintenance description.";

        formMessage.style.color = "red";
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');

    if (submitButton) {
        submitButton.disabled = true;
    }

    formMessage.textContent = "Saving maintenance record...";
    formMessage.style.color = "black";

    try {
        const vehicleDoc = await db
            .collection("vehicles")
            .doc(vehicleId)
            .get();

        if (!vehicleDoc.exists) {
            throw new Error("Selected vehicle does not exist.");
        }

        const vehicle = vehicleDoc.data();

        const maintenanceData = {
            vehicleId: vehicleId,
            service_date: serviceDate,
            next_service_date: nextServiceDate,
            description: description,
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            await db.collection("maintenance")
                .doc(id)
                .update(maintenanceData);

        } else {
            maintenanceData.createdAt =
                firebase.firestore.FieldValue.serverTimestamp();

            await db.collection("maintenance")
                .add(maintenanceData);
        }

        // Update vehicle status when maintenance is scheduled or completed
        const maintenanceStatus = status.toLowerCase();

        if (
            maintenanceStatus === "scheduled" ||
            maintenanceStatus === "in_progress" ||
            maintenanceStatus === "pending"
        ) {
            await db.collection("vehicles")
                .doc(vehicleId)
                .update({ status: "maintenance" });

        } else if (maintenanceStatus === "completed") {
            await db.collection("vehicles")
                .doc(vehicleId)
                .update({ status: "available" });
        }

        formMessage.textContent = id
            ? "Maintenance record updated successfully!"
            : "Maintenance record added successfully!";

        formMessage.style.color = "green";

        await loadMaintenance();

        setTimeout(closeForm, 700);

    } catch (error) {
        console.error("Save maintenance error:", error);

        formMessage.textContent =
            "Unable to save maintenance record. Check Firestore permissions.";

        formMessage.style.color = "red";

    } finally {
        if (submitButton) {
            submitButton.disabled = false;
        }
    }
});


// =====================================
// INITIAL LOAD
// =====================================

auth.onAuthStateChanged(async function (user) {
    const isAdmin = await checkAdminAccess(user);

    if (isAdmin) {
        await loadMaintenance();
    }
});
