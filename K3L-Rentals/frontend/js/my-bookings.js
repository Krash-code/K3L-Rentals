async function loadBookings() {

    const token =
        getToken();


    const user =
        getUser();


    // Not logged in
    if (!token || !user) {

        window.location.href =
            "login.html";

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/bookings`,
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

            document.getElementById(
                "bookingsContainer"
            ).innerHTML = `

                <div class="info-card">

                    <h3>
                        ${data.message}
                    </h3>

                </div>

            `;

            return;
        }


        /*
            Your current backend returns
            all bookings.

            So we filter them here using
            the logged-in user's ID.
        */

        const myBookings =
            data.filter(
                booking =>
                    Number(booking.user_id) ===
                    Number(user.id)
            );


        const container =
            document.getElementById(
                "bookingsContainer"
            );


        if (myBookings.length === 0) {

            container.innerHTML = `

                <div class="info-card">

                    <h3>
                        No bookings yet
                    </h3>

                    <p>
                        You haven't booked
                        any vehicles yet.
                    </p>

                    <br>

                    <a
                        href="vehicles.html"
                        class="primary-btn">

                        Browse Vehicles

                    </a>

                </div>

            `;

            return;
        }


        container.innerHTML =
            myBookings.map(
                booking => `

                <div class="booking-item">

                    <h3>
                        ${booking.model}
                    </h3>


                    <p>
                        Vehicle Number:
                        ${booking.vehicle_number}
                    </p>


                    <p>
                        Start Date:
                        ${booking.start_date}
                    </p>


                    <p>
                        End Date:
                        ${booking.end_date}
                    </p>


                    <p>
                        Total Amount:
                        ₹${booking.total_amount}
                    </p>


                    <p>
                        Status:

                        <span class="status">
                            ${booking.status}
                        </span>

                    </p>

                </div>

            `
            ).join("");


    } catch (error) {

        console.error(error);

        document.getElementById(
            "bookingsContainer"
        ).innerHTML = `

            <div class="info-card">

                <h3>
                    Unable to load bookings.
                </h3>

            </div>

        `;
    }
}


loadBookings();