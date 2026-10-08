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


// LOGOUT
document
    .getElementById("logoutBtn")
    .addEventListener(
        "click",
        logout
    );


// REFRESH BUTTON
document
    .getElementById("refreshFleetBtn")
    .addEventListener(
        "click",
        loadFleet
    );


// LOAD FLEET
async function loadFleet() {

    try {

        const response =
            await fetch(
                `${API_URL}/fleet`,
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
                "Failed to fetch fleet"
            );

        }


        displayFleet(data);


    } catch (error) {

        console.error(error);

        document
            .getElementById(
                "fleetTableContainer"
            )
            .innerHTML = `

                <div class="info-card">

                    <h3>
                        Unable to load fleet.
                    </h3>

                    <p>
                        ${error.message}
                    </p>

                </div>

            `;

    }

}


// DISPLAY FLEET
function displayFleet(vehicles) {

    const container =
        document.getElementById("fleetTableContainer");

    if (vehicles.length === 0) {

        container.innerHTML = `
            <div class="info-card">
                <h3>No vehicles found.</h3>
                <p>There are currently no vehicles in the fleet.</p>
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
                        <th>Vehicle Number</th>
                        <th>Model</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>

                <tbody>

                    ${vehicles.map(vehicle => `

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


                            <!-- LOCATION -->
                            <td>

                                <input
                                    type="text"
                                    id="location-${vehicle.id}"
                                    value="${escapeHtml(
                                        vehicle.location || ""
                                    )}"
                                    class="fleet-input"
                                >

                            </td>


                            <!-- STATUS -->
                            <td>

                                <select
                                    id="status-${vehicle.id}"
                                    class="fleet-select"
                                >

                                    <option
                                        value="available"
                                        ${vehicle.status === "available" ? "selected" : ""}
                                    >
                                        Available
                                    </option>

                                    <option
                                        value="booked"
                                        ${vehicle.status === "booked" ? "selected" : ""}
                                    >
                                        Booked
                                    </option>

                                    <option
                                        value="in_use"
                                        ${vehicle.status === "in_use" ? "selected" : ""}
                                    >
                                        In Use
                                    </option>

                                    <option
                                        value="maintenance"
                                        ${vehicle.status === "maintenance" ? "selected" : ""}
                                    >
                                        Maintenance
                                    </option>

                                </select>

                            </td>


                            <!-- ACTIONS -->
                            <td>

                                <button
                                    class="table-btn edit-btn"
                                    onclick="saveFleetChanges(${vehicle.id})"
                                >
                                    Save
                                </button>

                            </td>

                        </tr>

                    `).join("")}

                </tbody>

            </table>

        </div>

    `;
}

async function saveFleetChanges(id) {

    const status =
        document.getElementById(
            `status-${id}`
        ).value;

    const location =
        document.getElementById(
            `location-${id}`
        ).value.trim();


    if (!location) {

        alert("Location cannot be empty.");

        return;
    }


    try {

        // UPDATE STATUS
        const statusResponse =
            await fetch(
                `${API_URL}/fleet/${id}/status`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        status: status
                    })
                }
            );


        const statusData =
            await statusResponse.json();


        if (!statusResponse.ok) {

            alert(
                statusData.message ||
                "Failed to update status"
            );

            return;
        }


        // UPDATE LOCATION
        const locationResponse =
            await fetch(
                `${API_URL}/fleet/${id}/location`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        location: location
                    })
                }
            );


        const locationData =
            await locationResponse.json();


        if (!locationResponse.ok) {

            alert(
                locationData.message ||
                "Failed to update location"
            );

            return;
        }


        alert(
            "Fleet details updated successfully!"
        );


        // Reload latest data
        loadFleet();


    } catch (error) {

        console.error(error);

        alert(
            "Cannot connect to server."
        );

    }
}

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// FORMAT STATUS
function formatStatus(
    status
) {

    if (!status) {
        return "Unknown";
    }

    return status
        .replace("_", " ")
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );
}


// ESCAPE QUOTES
function escapeQuotes(
    value
) {

    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");

}

// INITIAL LOAD
loadFleet();