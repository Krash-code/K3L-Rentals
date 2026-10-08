const token = getToken();

const user = getUser();


// ------------------------------------
// Check admin access
// ------------------------------------

if (
    !token ||
    !user ||
    user.role !== "admin"
) {

    window.location.href =
        "admin-login.html";

}


// ------------------------------------
// Logout
// ------------------------------------

const logoutBtn =
    document.getElementById("logoutBtn");

logoutBtn.addEventListener(
    "click",
    function () {

        logout();

    }
);


// ------------------------------------
// Load dashboard statistics
// ------------------------------------

async function loadDashboardStats() {

    try {

        const response =
            await fetch(
                `${API_URL}/dashboard/stats`,
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

            console.error(data);

            alert(
                data.message ||
                "Failed to load dashboard"
            );

            return;

        }


        // --------------------------------
        // Display values
        // --------------------------------

        document.getElementById(
            "totalVehicles"
        ).textContent =
            data.totalVehicles;


        document.getElementById(
            "available"
        ).textContent =
            data.available;


        document.getElementById(
            "booked"
        ).textContent =
            data.booked;


        document.getElementById(
            "maintenance"
        ).textContent =
            data.maintenance;


        document.getElementById(
            "inUse"
        ).textContent =
            data.inUse;


        document.getElementById(
            "totalBookings"
        ).textContent =
            data.totalBookings;


        document.getElementById(
            "totalCustomers"
        ).textContent =
            data.totalCustomers;


        document.getElementById(
            "totalRevenue"
        ).textContent =
            `₹${Number(
                data.totalRevenue
            ).toLocaleString("en-IN")}`;


    } catch (error) {

        console.error(error);

        alert(
            "Unable to connect to server."
        );

    }

}


loadDashboardStats();