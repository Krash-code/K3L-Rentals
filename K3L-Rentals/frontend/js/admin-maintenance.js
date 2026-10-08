const token = getToken();
const user = getUser();


// ADMIN ACCESS CHECK

if (
    !token ||
    !user ||
    user.role !== "admin"
) {
    window.location.href =
        "admin-login.html";
}


// ELEMENTS

const formContainer =
    document.getElementById(
        "maintenanceFormContainer"
    );

const form =
    document.getElementById(
        "maintenanceForm"
    );

const formTitle =
    document.getElementById(
        "maintenanceFormTitle"
    );

const formMessage =
    document.getElementById(
        "maintenanceFormMessage"
    );


// LOGOUT

document
    .getElementById("logoutBtn")
    .addEventListener(
        "click",
        logout
    );


// ADD BUTTON

document
    .getElementById("addMaintenanceBtn")
    .addEventListener(
        "click",
        openAddForm
    );


// CANCEL BUTTON

document
    .getElementById("cancelMaintenance")
    .addEventListener(
        "click",
        closeForm
    );


// OPEN ADD FORM

function openAddForm() {

    form.reset();

    document.getElementById(
        "maintenanceId"
    ).value = "";

    formTitle.textContent =
        "Add Maintenance Record";

    formMessage.textContent = "";

    formContainer.classList.remove(
        "hidden"
    );

    loadVehicles();

}


// CLOSE FORM

function closeForm() {

    formContainer.classList.add(
        "hidden"
    );

    form.reset();

    formMessage.textContent = "";

}


// LOAD VEHICLES

async function loadVehicles(
    selectedVehicleId = null
) {

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


        const select =
            document.getElementById(
                "vehicle_id"
            );


        select.innerHTML = `
            <option value="">
                Select Vehicle
            </option>
        `;


        vehicles.forEach(
            vehicle => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    vehicle.id;

                option.textContent =
                    `${vehicle.vehicle_number} - ${vehicle.model}`;

                if (
                    selectedVehicleId &&
                    Number(vehicle.id) ===
                    Number(selectedVehicleId)
                ) {
                    option.selected = true;
                }

                select.appendChild(
                    option
                );

            }
        );


    } catch (error) {

        console.error(error);

        alert(
            "Unable to load vehicles."
        );

    }

}


// LOAD MAINTENANCE

async function loadMaintenance() {

    try {

        const response =
            await fetch(
                `${API_URL}/maintenance`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Failed to fetch maintenance"
            );

        }


        displayMaintenance(data);


    } catch (error) {

        console.error(error);

        document
            .getElementById(
                "maintenanceTableContainer"
            )
            .innerHTML = `

                <div class="info-card">

                    <h3>
                        Unable to load maintenance records.
                    </h3>

                    <p>
                        ${error.message}
                    </p>

                </div>

            `;

    }

}


// DISPLAY MAINTENANCE

function displayMaintenance(
    records
) {

    const container =
        document.getElementById(
            "maintenanceTableContainer"
        );


    if (records.length === 0) {

        container.innerHTML = `

            <div class="info-card">

                <h3>
                    No maintenance records found.
                </h3>

                <p>
                    Add a maintenance record to get started.
                </p>

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

                        <th>Service Date</th>

                        <th>Next Service</th>

                        <th>Description</th>

                        <th>Status</th>

                        <th>Actions</th>

                    </tr>

                </thead>


                <tbody>

                    ${records.map(
                        record => `

                        <tr>

                            <td>
                                ${record.id}
                            </td>


                            <td>

                                <strong>
                                    ${record.vehicle_number}
                                </strong>

                                <br>

                                ${record.model}

                            </td>


                            <td>
                                ${formatDate(
                                    record.service_date
                                )}
                            </td>


                            <td>
                                ${formatDate(
                                    record.next_service_date
                                )}
                            </td>


                            <td>
                                ${record.description || "N/A"}
                            </td>


                            <td>

                                <span
                                    class="admin-status ${record.status}"
                                >
                                    ${formatStatus(
                                        record.status
                                    )}
                                </span>

                            </td>


                            <td>

                                <button
                                    class="table-btn edit-btn"
                                    onclick="editMaintenance(
                                        ${record.id}
                                    )"
                                >
                                    Edit
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


// EDIT MAINTENANCE

async function editMaintenance(
    id
) {

    try {

        const response =
            await fetch(
                `${API_URL}/maintenance`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        const records =
            await response.json();


        if (!response.ok) {

            alert(
                "Unable to load maintenance record."
            );

            return;
        }


        const record =
            records.find(
                item =>
                    Number(item.id) ===
                    Number(id)
            );


        if (!record) {

            alert(
                "Maintenance record not found."
            );

            return;
        }


        document.getElementById(
            "maintenanceId"
        ).value = record.id;


        formTitle.textContent =
            "Edit Maintenance Record";


        await loadVehicles(
            record.vehicle_id
        );


        document.getElementById(
            "service_date"
        ).value =
            formatDate(
                record.service_date
            );


        document.getElementById(
            "next_service_date"
        ).value =
            formatDate(
                record.next_service_date
            );


        document.getElementById(
            "description"
        ).value =
            record.description || "";


        document.getElementById(
            "maintenance_status"
        ).value =
            record.status || "scheduled";


        formMessage.textContent = "";


        formContainer.classList.remove(
            "hidden"
        );


        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });


    } catch (error) {

        console.error(error);

        alert(
            "Unable to load maintenance record."
        );

    }

}


// SUBMIT FORM

form.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const id =
            document.getElementById(
                "maintenanceId"
            ).value;


        const vehicleId =
            document.getElementById(
                "vehicle_id"
            ).value;


        const serviceDate =
            document.getElementById(
                "service_date"
            ).value;


        const nextServiceDate =
            document.getElementById(
                "next_service_date"
            ).value;


        const description =
            document.getElementById(
                "description"
            ).value.trim();


        const status =
            document.getElementById(
                "maintenance_status"
            ).value;


        // VALIDATION

        if (!vehicleId) {

            formMessage.textContent =
                "Please select a vehicle.";

            formMessage.style.color =
                "red";

            return;
        }


        if (
            nextServiceDate &&
            serviceDate &&
            nextServiceDate < serviceDate
        ) {

            formMessage.textContent =
                "Next service date cannot be before service date.";

            formMessage.style.color =
                "red";

            return;
        }


        if (!description) {

            formMessage.textContent =
                "Please enter a maintenance description.";

            formMessage.style.color =
                "red";

            return;
        }


        formMessage.textContent =
            "Saving maintenance record...";

        formMessage.style.color =
            "black";


        try {

            let response;


            // ADD

            if (!id) {

                response =
                    await fetch(
                        `${API_URL}/maintenance`,
                        {
                            method: "POST",

                            headers: {

                                "Content-Type":
                                    "application/json",

                                "Authorization":
                                    `Bearer ${token}`
                            },

                            body:
                                JSON.stringify({

                                    vehicle_id:
                                        Number(
                                            vehicleId
                                        ),

                                    service_date:
                                        serviceDate,

                                    next_service_date:
                                        nextServiceDate,

                                    description:
                                        description,

                                    status:
                                        status

                                })
                        }
                    );

            }


            // UPDATE

            else {

                response =
                    await fetch(
                        `${API_URL}/maintenance/${id}`,
                        {
                            method: "PUT",

                            headers: {

                                "Content-Type":
                                    "application/json",

                                "Authorization":
                                    `Bearer ${token}`
                            },

                            body:
                                JSON.stringify({

                                    next_service_date:
                                        nextServiceDate,

                                    description:
                                        description,

                                    status:
                                        status

                                })
                        }
                    );

            }


            const data =
                await response.json();


            if (!response.ok) {

                formMessage.textContent =
                    data.message ||
                    "Failed to save maintenance record.";

                formMessage.style.color =
                    "red";

                return;
            }


            formMessage.textContent =
                id
                    ? "Maintenance record updated successfully!"
                    : "Maintenance record added successfully!";

            formMessage.style.color =
                "green";


            setTimeout(
                function () {

                    closeForm();

                    loadMaintenance();

                },
                700
            );


        } catch (error) {

            console.error(error);

            formMessage.textContent =
                "Cannot connect to server.";

            formMessage.style.color =
                "red";

        }

    }
);


// FORMAT DATE

function formatDate(date) {

    if (!date) {
        return "";
    }

    return String(date)
        .split("T")[0];

}


// FORMAT STATUS

function formatStatus(status) {

    if (!status) {
        return "Unknown";
    }

    return status
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );

}


// INITIAL LOAD

loadMaintenance();