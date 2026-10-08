const params =
    new URLSearchParams(window.location.search);

const vehicleId =
    params.get("id");


const vehicleSummary =
    document.getElementById("vehicleSummary");


const bookingForm =
    document.getElementById("bookingForm");


const bookingMessage =
    document.getElementById("bookingMessage");


async function loadVehicle() {

    if (!vehicleId) {

        vehicleSummary.innerHTML =
            "<p>Vehicle not selected.</p>";

        bookingForm.style.display = "none";

        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/vehicles/${vehicleId}`
        );

        const vehicle =
            await response.json();


        if (!response.ok) {

            vehicleSummary.innerHTML =
                `<p>${vehicle.message}</p>`;

            return;
        }


        vehicleSummary.innerHTML = `

            <div class="info-card">

                <h2>
                    ${vehicle.model}
                </h2>

                <p>
                    ${vehicle.type}
                </p>

                <p>
                    📍 ${vehicle.location}
                </p>

                <p>
                    <strong>
                        ₹${vehicle.price_per_day}
                    </strong>
                    / day
                </p>

            </div>

        `;


    } catch (error) {

        console.error(error);

        vehicleSummary.innerHTML =
            "<p>Unable to load vehicle.</p>";
    }
}


bookingForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const token = getToken();

        const user = getUser();


        if (!token || !user) {

            window.location.href =
                "login.html";

            return;
        }


        const start_date =
            document.getElementById(
                "start_date"
            ).value;


        const end_date =
            document.getElementById(
                "end_date"
            ).value;


        try {

            const response = await fetch(
                `${API_URL}/bookings`,
                {
                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({

                        vehicle_id:
                            Number(vehicleId),

                        start_date,

                        end_date

                    })
                }
            );


            const data =
                await response.json();


            if (!response.ok) {

                bookingMessage.textContent =
                    data.message ||
                    "Booking failed";

                bookingMessage.style.color =
                    "red";

                return;
            }


            bookingMessage.innerHTML = `

                <p style="color:green;">
                    Booking successful!
                </p>

                <p>
                    Booking ID:
                    ${data.bookingId}
                </p>

                <p>
                    Total Amount:
                    ₹${data.total_amount}
                </p>

                <a
                    href="my-bookings.html"
                    class="primary-btn">

                    View My Bookings

                </a>

            `;


            bookingForm.style.display =
                "none";


        } catch (error) {

            console.error(error);

            bookingMessage.textContent =
                "Unable to connect to server.";

            bookingMessage.style.color =
                "red";
        }

    }
);


loadVehicle();