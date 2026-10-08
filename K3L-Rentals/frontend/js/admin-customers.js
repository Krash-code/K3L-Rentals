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


// STORE CUSTOMERS
let allCustomers = [];


// SEARCH
document
    .getElementById("searchInput")
    .addEventListener(
        "input",
        filterCustomers
    );


// LOAD CUSTOMERS
async function loadCustomers() {

    try {

        const response =
            await fetch(
                `${API_URL}/customers`,
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
                "Failed to fetch customers"
            );

        }


        allCustomers = data;

        displayCustomers(
            allCustomers
        );


    } catch (error) {

        console.error(error);

        document
            .getElementById(
                "customerTableContainer"
            )
            .innerHTML = `

                <div class="info-card">

                    <h3>
                        Unable to load customers.
                    </h3>

                    <p>
                        ${error.message}
                    </p>

                </div>

            `;

    }

}


// DISPLAY CUSTOMERS
function displayCustomers(
    customers
) {

    const container =
        document.getElementById(
            "customerTableContainer"
        );


    if (customers.length === 0) {

        container.innerHTML = `

            <div class="info-card">

                <h3>
                    No customers found.
                </h3>

                <p>
                    There are currently no customers.
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

                        <th>Name</th>

                        <th>Email</th>

                        <th>Phone</th>

                        <th>Role</th>

                        <th>Actions</th>

                    </tr>

                </thead>


                <tbody>

                    ${customers.map(
                        customer => `

                        <tr>

                            <td>
                                ${customer.id}
                            </td>


                            <td>
                                ${customer.name}
                            </td>


                            <td>
                                ${customer.email}
                            </td>


                            <td>
                                ${customer.phone || "N/A"}
                            </td>


                            <td>

                                <span
                                    class="admin-status
                                    ${customer.role}">
                                    ${customer.role}
                                </span>

                            </td>


                            <td>

                                <button
                                    class="table-btn edit-btn"
                                    onclick="changeRole(
                                        ${customer.id},
                                        '${customer.role}'
                                    )">

                                    Change Role

                                </button>


                                ${
                                    Number(customer.id) !==
                                    Number(user.id)
                                    ?

                                    `
                                    <button
                                        class="table-btn delete-btn"
                                        onclick="deleteCustomer(
                                            ${customer.id}
                                        )">

                                        Delete

                                    </button>
                                    `

                                    :

                                    `
                                    <span>
                                        Current Account
                                    </span>
                                    `
                                }

                            </td>

                        </tr>

                    `
                    ).join("")}

                </tbody>

            </table>

        </div>

    `;

}


// SEARCH CUSTOMERS
function filterCustomers() {

    const search =
        document
            .getElementById(
                "searchInput"
            )
            .value
            .toLowerCase()
            .trim();


    const filtered =
        allCustomers.filter(
            customer => {

                return (

                    String(
                        customer.name
                    )
                    .toLowerCase()
                    .includes(search)

                    ||

                    String(
                        customer.email
                    )
                    .toLowerCase()
                    .includes(search)

                    ||

                    String(
                        customer.phone || ""
                    )
                    .toLowerCase()
                    .includes(search)

                );

            }
        );


    displayCustomers(
        filtered
    );

}


// CHANGE ROLE
async function changeRole(
    id,
    currentRole
) {

    const newRole =
        currentRole === "admin"
            ? "user"
            : "admin";


    const confirmed =
        confirm(
            `Change this user's role from ${currentRole} to ${newRole}?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/customers/${id}/role`,
                {
                    method: "PUT",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        role: newRole
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Failed to update role"
            );

            return;
        }


        alert(
            "Customer role updated successfully."
        );


        // IMPORTANT:
        // Reload customers after role change
        loadCustomers();


    } catch (error) {

        console.error(error);

        alert(
            "Cannot connect to server."
        );

    }

}


// DELETE CUSTOMER
async function deleteCustomer(
    id
) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this customer?"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/customers/${id}`,
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
                "Failed to delete customer"
            );

            return;
        }


        alert(
            "Customer deleted successfully."
        );


        loadCustomers();


    } catch (error) {

        console.error(error);

        alert(
            "Cannot connect to server."
        );

    }

}


// INITIAL LOAD
loadCustomers();