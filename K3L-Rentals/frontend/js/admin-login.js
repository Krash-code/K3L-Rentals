const adminLoginForm =
    document.getElementById("adminLoginForm");

const message =
    document.getElementById("message");


adminLoginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const email =
            document
                .getElementById("email")
                .value
                .trim();


        const password =
            document
                .getElementById("password")
                .value;


        message.textContent =
            "Checking admin credentials...";

        message.style.color = "black";


        try {

            const response =
                await fetch(
                    `${API_URL}/auth/login`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            email: email,
                            password: password
                        })
                    }
                );


            const data =
                await response.json();


            // Login itself failed
            if (!response.ok) {

                message.textContent =
                    data.message ||
                    "Invalid email or password";

                message.style.color = "red";

                return;
            }


            // Login worked, but user is not admin
            if (
                !data.user ||
                data.user.role !== "admin"
            ) {

                message.textContent =
                    "Access denied. Admin account required.";

                message.style.color = "red";

                return;
            }


            // Store admin login information
            localStorage.setItem(
                "token",
                data.token
            );


            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );


            message.textContent =
                "Admin login successful!";

            message.style.color = "green";


            setTimeout(function () {

                window.location.href =
                    "admin-dashboard.html";

            }, 700);


        } catch (error) {

            console.error(error);

            message.textContent =
                "Cannot connect to server.";

            message.style.color = "red";

        }

    }
);