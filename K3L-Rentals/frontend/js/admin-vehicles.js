const token = getToken();
const user = getUser();


// =====================================
// ADMIN ACCESS CHECK
// =====================================

if (
    !token ||
    !user ||
    user.role !== "admin"
) {
    window.location.href = "admin-login.html";
}


// =====================================
// ELEMENTS
// =====================================

const vehicleFormContainer =
    document.getElementById(
        "vehicleFormContainer"
    );

const showAddFormBtn =
    document.getElementById(
        "showAddFormBtn"
    );

const cancelFormBtn =
    document.getElementById(
        "cancelFormBtn"
    );

const vehicleForm =
    document.getElementById(
        "vehicleForm"
    );

const formTitle =
    document.getElementById(
        "formTitle"
    );

const formMessage =
    document.getElementById(
        "formMessage"
    );


// =====================================
// LOGOUT
// =====================================

document
    .getElementById("logoutBtn")
    .addEventListener(
        "click",
        logout
    );


// =====================================
// SHOW ADD FORM
// =====================================

showAddFormBtn.addEventListener(
    "click",
    function () {

        resetForm();

        formTitle.textContent =
            "Add Vehicle";

        vehicleFormContainer
            .classList
            .remove("hidden");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }
);


// =====================================
// CANCEL FORM
// =====================================

cancelFormBtn.addEventListener(
    "click",
    function () {

        vehicleFormContainer
            .classList
            .add("hidden");

        resetForm();

    }
);


// =====================================
// RESET FORM
// =====================================

function resetForm() {

    vehicleForm.reset();

    document.getElementById(
        "vehicleId"
    ).value = "";

    formMessage.textContent = "";

    formMessage.style.color = "";

}


// =====================================
// LOAD VEHICLES
// =====================================

async function loadVehicles() {

    try {

        const response =
            await fetch(
                `${API_URL}/vehicles`
            );


        const vehicles =
            await response.json();


        if (!response.ok) {

            throw new Error(
                "Failed to load vehicles"
            );

        }


        displayVehicles(vehicles);

    }

    catch (error) {

        console.error(error);

        document.getElementById(
            "vehicleTableContainer"
        ).innerHTML = `

            <div class="info-card">

                <h3>
                    Unable to load vehicles.
                </h3>

            </div>

        `;

    }

}


// =====================================
// DISPLAY VEHICLES
// =====================================

function displayVehicles(vehicles) {

    const container =
        document.getElementById(
            "vehicleTableContainer"
        );


    if (vehicles.length === 0) {

        container.innerHTML = `

            <div class="info-card">

                <h3>
                    No vehicles found.
                </h3>

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
                        <th>Vehicle</th>
                        <th>Model</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Price / Day</th>
                        <th>Status</th>
                        <th>Actions</th>

                    </tr>

                </thead>


                <tbody>

                    ${vehicles.map(
                        vehicle => `

                        <tr>

                            <td>
                                ${vehicle.id}
                            </td>

                            <td>
                                ${vehicle.vehicle_number}
                            </td>

                            <td>
                                ${vehicle.model}
                            </td>

                            <td>
                                ${vehicle.type || "N/A"}
                            </td>

                            <td>
                                ${vehicle.location || "N/A"}
                            </td>

                            <td>
                                ₹${vehicle.price_per_day}
                            </td>

                            <td>

                                <span
                                    class="admin-status
                                    ${vehicle.status}">

                                    ${vehicle.status}

                                </span>

                            </td>

                            <td>

                                <button
                                    class="table-btn edit-btn"
                                    onclick="editVehicle(${vehicle.id})">

                                    Edit

                                </button>


                                <button
                                    class="table-btn delete-btn"
                                    onclick="deleteVehicle(${vehicle.id})">

                                    Delete

                                </button>

                            </td>

                        </tr>

                    `
                    ).join("")}

                </tbody>

            </table>

        </div>

    `;

}


// =====================================
// EDIT VEHICLE
// =====================================

async function editVehicle(id) {

    try {

        const response =
            await fetch(
                `${API_URL}/vehicles/${id}`
            );


        const vehicle =
            await response.json();


        if (!response.ok) {

            alert(
                vehicle.message ||
                "Unable to load vehicle"
            );

            return;

        }


        document.getElementById(
            "vehicleId"
        ).value = vehicle.id;


        document.getElementById(
            "vehicle_number"
        ).value =
            vehicle.vehicle_number;


        document.getElementById(
            "model"
        ).value =
            vehicle.model;


        document.getElementById(
            "type"
        ).value =
            vehicle.type || "";


        document.getElementById(
            "price_per_day"
        ).value =
            vehicle.price_per_day;


        document.getElementById(
            "location"
        ).value =
            vehicle.location || "";


        document.getElementById(
            "status"
        ).value =
            vehicle.status || "available";


        document.getElementById(
            "image"
        ).value =
            vehicle.image || "";


        formTitle.textContent =
            "Edit Vehicle";


        formMessage.textContent = "";


        vehicleFormContainer
            .classList
            .remove("hidden");


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

    catch (error) {

        console.error(error);

        alert(
            "Unable to load vehicle"
        );

    }

}


// =====================================
// SAVE VEHICLE
// =====================================

vehicleForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const id =
            document.getElementById(
                "vehicleId"
            ).value;


        const vehicleData = {

            vehicle_number:
                document.getElementById(
                    "vehicle_number"
                ).value.trim(),

            model:
                document.getElementById(
                    "model"
                ).value.trim(),

            type:
                document.getElementById(
                    "type"
                ).value,

            price_per_day:
                Number(
                    document.getElementById(
                        "price_per_day"
                    ).value
                ),

            location:
                document.getElementById(
                    "location"
                ).value.trim(),

            status:
                document.getElementById(
                    "status"
                ).value,

            image:
                document.getElementById(
                    "image"
                ).value.trim()

        };


        formMessage.textContent =
            "Saving vehicle...";

        formMessage.style.color =
            "black";


        try {

            const url =
                id
                ? `${API_URL}/vehicles/${id}`
                : `${API_URL}/vehicles`;


            const method =
                id
                ? "PUT"
                : "POST";


            const response =
                await fetch(
                    url,
                    {
                        method: method,

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${token}`

                        },

                        body:
                            JSON.stringify(
                                vehicleData
                            )

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                formMessage.textContent =
                    data.message ||
                    "Failed to save vehicle";

                formMessage.style.color =
                    "red";

                return;

            }


            formMessage.textContent =
                id
                ? "Vehicle updated successfully!"
                : "Vehicle added successfully!";

            formMessage.style.color =
                "green";


            setTimeout(
                function () {

                    vehicleFormContainer
                        .classList
                        .add("hidden");

                    resetForm();

                    loadVehicles();

                },
                700
            );

        }

        catch (error) {

            console.error(error);

            formMessage.textContent =
                "Cannot connect to server.";

            formMessage.style.color =
                "red";

        }

    }
);


// =====================================
// DELETE VEHICLE
// =====================================

async function deleteVehicle(id) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this vehicle?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/vehicles/${id}`,
                {
                    method: "DELETE",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Failed to delete vehicle"
            );

            return;

        }


        alert(
            "Vehicle deleted successfully."
        );


        loadVehicles();

    }

    catch (error) {

        console.error(error);

        alert(
            "Cannot connect to server."
        );

    }

}


// =====================================
// INITIAL LOAD
// =====================================

loadVehicles();