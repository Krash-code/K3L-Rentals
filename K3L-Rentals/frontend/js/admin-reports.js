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


// PRINT

document
    .getElementById("printReportBtn")
    .addEventListener(
        "click",
        function () {

            window.print();

        }
    );


// LOAD REPORTS

async function loadReports() {

    try {

        const response =
            await fetch(
                `${API_URL}/reports`,
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
                "Failed to load reports"
            );

        }


        displaySummary(
            data.summary
        );


        displayBookingStatus(
            data.bookingStatus
        );


        displayVehicleStatus(
            data.vehicleStatus
        );


        displayMonthlyRevenue(
            data.monthlyRevenue
        );


        displayPopularVehicles(
            data.popularVehicles
        );


    } catch (error) {

        console.error(error);

        document.getElementById(
            "reportContent"
        ).innerHTML = `

            <div class="info-card">

                <h3>
                    Unable to load reports.
                </h3>

                <p>
                    ${error.message}
                </p>

            </div>

        `;

    }

}


// SUMMARY

function displaySummary(
    summary
) {

    document.getElementById(
        "totalVehicles"
    ).textContent =
        summary.totalVehicles;


    document.getElementById(
        "totalCustomers"
    ).textContent =
        summary.totalCustomers;


    document.getElementById(
        "totalBookings"
    ).textContent =
        summary.totalBookings;


    document.getElementById(
        "totalRevenue"
    ).textContent =
        `₹${Number(
            summary.totalRevenue
        ).toLocaleString("en-IN")}`;


    document.getElementById(
        "totalMaintenance"
    ).textContent =
        summary.totalMaintenance;


    document.getElementById(
        "completedMaintenance"
    ).textContent =
        summary.completedMaintenance;


    document.getElementById(
        "pendingMaintenance"
    ).textContent =
        summary.pendingMaintenance;

}


// BOOKING STATUS

function displayBookingStatus(
    data
) {

    const container =
        document.getElementById(
            "bookingStatusContainer"
        );


    if (!data.length) {

        container.innerHTML =
            "<p>No booking data available.</p>";

        return;

    }


    container.innerHTML = `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>

                        <th>Status</th>
                        <th>Number of Bookings</th>

                    </tr>

                </thead>


                <tbody>

                    ${data.map(
                        item => `

                        <tr>

                            <td>
                                <span
                                    class="admin-status ${item.status}"
                                >
                                    ${formatStatus(
                                        item.status
                                    )}
                                </span>
                            </td>

                            <td>
                                ${item.count}
                            </td>

                        </tr>

                    `
                    ).join("")}

                </tbody>

            </table>

        </div>

    `;

}


// VEHICLE STATUS

function displayVehicleStatus(
    data
) {

    const container =
        document.getElementById(
            "vehicleStatusContainer"
        );


    if (!data.length) {

        container.innerHTML =
            "<p>No vehicle data available.</p>";

        return;

    }


    container.innerHTML = `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>

                        <th>Status</th>
                        <th>Number of Vehicles</th>

                    </tr>

                </thead>


                <tbody>

                    ${data.map(
                        item => `

                        <tr>

                            <td>

                                <span
                                    class="admin-status ${item.status}"
                                >
                                    ${formatStatus(
                                        item.status
                                    )}
                                </span>

                            </td>

                            <td>
                                ${item.count}
                            </td>

                        </tr>

                    `
                    ).join("")}

                </tbody>

            </table>

        </div>

    `;

}


// MONTHLY REVENUE

function displayMonthlyRevenue(
    data
) {

    const container =
        document.getElementById(
            "monthlyRevenueContainer"
        );


    if (!data.length) {

        container.innerHTML =
            "<p>No revenue data available.</p>";

        return;

    }


    container.innerHTML = `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>

                        <th>Month</th>
                        <th>Revenue</th>

                    </tr>

                </thead>


                <tbody>

                    ${data.map(
                        item => `

                        <tr>

                            <td>
                                ${formatMonth(
                                    item.month
                                )}
                            </td>

                            <td>
                                ₹${Number(
                                    item.revenue
                                ).toLocaleString(
                                    "en-IN"
                                )}
                            </td>

                        </tr>

                    `
                    ).join("")}

                </tbody>

            </table>

        </div>

    `;

}


// POPULAR VEHICLES

function displayPopularVehicles(
    data
) {

    const container =
        document.getElementById(
            "popularVehiclesContainer"
        );


    if (!data.length) {

        container.innerHTML =
            "<p>No vehicle booking data available.</p>";

        return;

    }


    container.innerHTML = `

        <div class="admin-table-wrapper">

            <table class="admin-table">

                <thead>

                    <tr>

                        <th>Vehicle</th>
                        <th>Vehicle Number</th>
                        <th>Total Bookings</th>

                    </tr>

                </thead>


                <tbody>

                    ${data.map(
                        item => `

                        <tr>

                            <td>
                                ${item.model}
                            </td>

                            <td>
                                ${item.vehicle_number}
                            </td>

                            <td>
                                ${item.bookings}
                            </td>

                        </tr>

                    `
                    ).join("")}

                </tbody>

            </table>

        </div>

    `;

}


// FORMAT STATUS

function formatStatus(
    status
) {

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


// FORMAT MONTH

function formatMonth(
    month
) {

    if (!month) {
        return "N/A";
    }

    const parts =
        month.split("-");


    if (parts.length !== 2) {
        return month;
    }


    const date =
        new Date(
            Number(parts[0]),
            Number(parts[1]) - 1
        );


    return date.toLocaleDateString(
        "en-IN",
        {
            month: "long",
            year: "numeric"
        }
    );

}


// INITIAL LOAD

loadReports();