const params =
    new URLSearchParams(window.location.search);

const vehicleId =
    params.get("id");


async function loadVehicleDetails() {

    const container =
        document.getElementById("vehicleDetails");


    if (!vehicleId) {

        container.innerHTML = `
            <div class="info-card">

                <h3>
                    Vehicle not selected
                </h3>

                <a
                    href="vehicles.html"
                    class="primary-btn">
                    Browse Vehicles
                </a>

            </div>
        `;

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/vehicles/${vehicleId}`
            );


        const vehicle =
            await response.json();


        if (!response.ok) {

            container.innerHTML = `
                <div class="info-card">

                    <h3>
                        ${vehicle.message}
                    </h3>

                </div>
            `;

            return;
        }


        container.innerHTML = `

            <div class="details-card">

                <div class="details-image">

                    ${
                        vehicle.image
                        ? `<img
                            src="${vehicle.image}"
                            alt="${vehicle.model}">`
                        : "🚗"
                    }

                </div>


                <div class="details-content">

                    <h1>
                        ${vehicle.model}
                    </h1>


                    <p>
                        <strong>
                            Vehicle Number:
                        </strong>

                        ${vehicle.vehicle_number}
                    </p>


                    <p>
                        <strong>
                            Type:
                        </strong>

                        ${vehicle.type || "N/A"}
                    </p>


                    <p>
                        <strong>
                            Location:
                        </strong>

                        ${vehicle.location || "N/A"}
                    </p>


                    <p>
                        <strong>
                            Price:
                        </strong>

                        ₹${vehicle.price_per_day} / day
                    </p>


                    <p>
                        <strong>
                            Status:
                        </strong>

                        ${vehicle.status}
                    </p>


                    ${
                        vehicle.status === "available"

                        ? `
                            <a
                                href="booking.html?id=${vehicle.id}"
                                class="primary-btn">

                                Book This Vehicle

                            </a>
                          `

                        : `
                            <p>
                                This vehicle is currently unavailable.
                            </p>
                          `
                    }

                </div>

            </div>

        `;

    }

    catch (error) {

        console.error(error);

        container.innerHTML = `

            <div class="info-card">

                <h3>
                    Unable to load vehicle.
                </h3>

            </div>

        `;

    }

}


loadVehicleDetails();