const loginForm =
    document.getElementById("loginForm");

const message =
    document.getElementById("message");


loginForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;


        message.textContent = "Logging in...";
        message.style.color = "black";


        try {

            const response = await fetch(
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


            if (!response.ok) {

                message.textContent =
                    data.message ||
                    "Invalid email or password";

                message.style.color = "red";

                return;
            }


            // Save JWT
            localStorage.setItem(
                "token",
                data.token
            );


            // Save user
            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );


            message.textContent =
                "Login successful!";

            message.style.color = "green";


            // Redirect
            setTimeout(
                function () {

                    window.location.href =
                        "vehicles.html";

                },
                700
            );


        } catch (error) {

            console.error(error);

            message.textContent =
                "Cannot connect to server.";

            message.style.color = "red";
        }

    }
);