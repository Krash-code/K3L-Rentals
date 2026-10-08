let allVehicles = [];


// Load vehicles
async function loadVehicles() {

    try {

        const response =
            await fetch(
                `${API_URL}/vehicles`
            );


        if (!response.ok) {

            throw new Error(
                "Failed to fetch vehicles"
            );
        }


        allVehicles =
            await response.json();


        createTypeFilter();

        displayVehicles(
            allVehicles
        );


    } catch (error) {

        console.error(error);

        document.getElementById(
            "vehicleContainer"
        ).innerHTML = `
            <p>
                Unable to load vehicles.
            </p>
        `;
    }
}



// Create type dropdown
function createTypeFilter() {

    const filter =
        document.getElementById(
            "typeFilter"
        );


    const types =
        [
            ...new Set(
                allVehicles
                    .map(vehicle => vehicle.type)
                    .filter(type => type)
            )
        ];


    types.forEach(type => {

        const option =
            document.createElement(
                "option"
            );

        option.value = type;

        option.textContent = type;

        filter.appendChild(option);

    });
}



// Display vehicles
function displayVehicles(
    vehicles
) {

    const container =
        document.getElementById(
            "vehicleContainer"
        );


    const available =
        vehicles.filter(
            vehicle =>
                vehicle.status ===
                "available"
        );


    if (available.length === 0) {

        container.innerHTML = `
            <div class="info-card">

                <h3>
                    No vehicles found
                </h3>

                <p>
                    Try another search or filter.
                </p>

            </div>
        `;

        return;
    }


    container.innerHTML =
        available.map(
            vehicle => `

            <div class="vehicle-card">

                <div class="vehicle-image">

                    ${
                        vehicle.image
                        ?
                        `<img
                            src="${vehicle.image}"
                            alt="${vehicle.model}">`
                        :
                        "🚗"
                    }

                </div>


                <div class="vehicle-info">

                    <h3>
                        ${vehicle.model}
                    </h3>

                    <p>
                        Type:
                        ${vehicle.type || "N/A"}
                    </p>

                    <p>
                        📍
                        ${vehicle.location || "N/A"}
                    </p>

                    <p>
                        <strong>
                            ₹${vehicle.price_per_day}
                        </strong>
                        / day
                    </p>


                    <a
                        href="vehicle-details.html?id=${vehicle.id}"
                        class="secondary-btn">

                        View Details

                    </a>

                </div>

            </div>

        `
        ).join("");
}



// Filter
function filterVehicles() {

    const search =
        document.getElementById(
            "searchInput"
        ).value
        .toLowerCase();


    const type =
        document.getElementById(
            "typeFilter"
        ).value;


    const filtered =
        allVehicles.filter(
            vehicle => {

                const matchesSearch =

                    vehicle.model
                        .toLowerCase()
                        .includes(search)

                    ||

                    vehicle.vehicle_number
                        .toLowerCase()
                        .includes(search);


                const matchesType =

                    type === "all"

                    ||

                    vehicle.type === type;


                return (
                    matchesSearch &&
                    matchesType
                );
            }
        );


    displayVehicles(
        filtered
    );
}



document.getElementById(
    "searchInput"
).addEventListener(
    "input",
    filterVehicles
);


document.getElementById(
    "typeFilter"
).addEventListener(
    "change",
    filterVehicles
);


loadVehicles();