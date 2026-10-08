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

const bookingFormContainer =
    document.getElementById(
        "bookingFormContainer"
    );

const bookingForm =
    document.getElementById(
        "bookingForm"
    );

const cancelBookingEdit =
    document.getElementById(
        "cancelBookingEdit"
    );

const bookingFormMessage =
    document.getElementById(
        "bookingFormMessage"
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
// CANCEL EDIT
// =====================================

cancelBookingEdit.addEventListener(
    "click",
    function () {

        bookingFormContainer
            .classList
            .add("hidden");

        bookingForm.reset();

        bookingFormMessage.textContent = "";

    }
);


// =====================================
// LOAD BOOKINGS
// =====================================

async function loadBookings() {

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

            throw new Error(
                data.message ||
                "Failed to fetch bookings"
            );

        }


        displayBookings(data);

    }

    catch (error) {

        console.error(error);

        document.getElementById(
            "bookingTableContainer"
        ).innerHTML = `

            <div class="info-card">

                <h3>
                    Unable to load bookings.
                </h3>

                <p>
                    ${error.message}
                </p>

            </div>

        `;

    }

}


// =====================================
// DISPLAY BOOKINGS
// =====================================

function displayBookings(bookings) {

    const container =
        document.getElementById(
            "bookingTableContainer"
        );


    if (bookings.length === 0) {

        container.innerHTML = `

            <div class="info-card">

                <h3>
                    No bookings found.
                </h3>

                <p>
                    There are currently no customer bookings.
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
                        <th>User ID</th>
                        <th>Vehicle</th>
                        <th>Vehicle Number</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Actions</th>

                    </tr>

                </thead>


                <tbody>

                    ${bookings.map(
                        booking => `

                        <tr>

                            <td>
                                ${booking.id}
                            </td>

                            <td>
                                ${booking.user_id}
                            </td>

                            <td>
                                ${booking.model}
                            </td>

                            <td>
                                ${booking.vehicle_number}
                            </td>

                            <td>
                                ${formatDate(
                                    booking.start_date
                                )}
                            </td>

                            <td>
                                ${formatDate(
                                    booking.end_date
                                )}
                            </td>

                            <td>
                                ₹${booking.total_amount}
                            </td>

                            <td>

                                <span
                                    class="admin-status
                                    ${booking.status}">

                                    ${booking.status}

                                </span>

                            </td>

                            <td>

                                <button
                                    class="table-btn edit-btn"
                                    onclick="editBooking(${booking.id})">

                                    Edit

                                </button>


                                <button
                                    class="table-btn delete-btn"
                                    onclick="deleteBooking(${booking.id})">

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
// FORMAT DATE
// =====================================

function formatDate(date) {

    if (!date) {
        return "N/A";
    }

    return String(date).split("T")[0];

}


// =====================================
// EDIT BOOKING
// =====================================

async function editBooking(id) {

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


        const bookings =
            await response.json();


        if (!response.ok) {

            alert(
                "Unable to load booking"
            );

            return;

        }


        const booking =
            bookings.find(
                item =>
                    Number(item.id) ===
                    Number(id)
            );


        if (!booking) {

            alert(
                "Booking not found"
            );

            return;

        }


        document.getElementById(
            "bookingId"
        ).value =
            booking.id;


        document.getElementById(
            "start_date"
        ).value =
            formatDate(
                booking.start_date
            );


        document.getElementById(
            "end_date"
        ).value =
            formatDate(
                booking.end_date
            );


        document.getElementById(
            "booking_status"
        ).value =
            booking.status;


        bookingFormMessage.textContent =
            "";


        bookingFormContainer
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
            "Unable to load booking"
        );

    }

}


// =====================================
// UPDATE BOOKING
// =====================================

bookingForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const id =
            document.getElementById(
                "bookingId"
            ).value;


        const startDate =
            document.getElementById(
                "start_date"
            ).value;


        const endDate =
            document.getElementById(
                "end_date"
            ).value;


        const status =
            document.getElementById(
                "booking_status"
            ).value;


        if (endDate <= startDate) {

            bookingFormMessage.textContent =
                "End date must be after start date.";

            bookingFormMessage.style.color =
                "red";

            return;

        }


        bookingFormMessage.textContent =
            "Updating booking...";

        bookingFormMessage.style.color =
            "black";


        try {

            const response =
                await fetch(
                    `${API_URL}/bookings/${id}`,
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

                                start_date:
                                    startDate,

                                end_date:
                                    endDate,

                                status:
                                    status

                            })

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                bookingFormMessage.textContent =
                    data.message ||
                    "Failed to update booking";

                bookingFormMessage.style.color =
                    "red";

                return;

            }


            bookingFormMessage.textContent =
                "Booking updated successfully!";

            bookingFormMessage.style.color =
                "green";


            setTimeout(
                function () {

                    bookingFormContainer
                        .classList
                        .add("hidden");

                    bookingForm.reset();

                    loadBookings();

                },
                700
            );

        }

        catch (error) {

            console.error(error);

            bookingFormMessage.textContent =
                "Cannot connect to server.";

            bookingFormMessage.style.color =
                "red";

        }

    }
);


// =====================================
// DELETE BOOKING
// =====================================

async function deleteBooking(id) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this booking?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/bookings/${id}`,
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
                "Failed to delete booking"
            );

            return;

        }


        alert(
            "Booking deleted successfully."
        );


        loadBookings();

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

loadBookings();