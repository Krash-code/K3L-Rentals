const registerForm =
    document.getElementById("registerForm");

const message =
    document.getElementById("message");


registerForm.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();


        const name =
            document.getElementById("name").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const phone =
            document.getElementById("phone").value.trim();

        const password =
            document.getElementById("password").value;


        message.textContent =
            "Creating account...";

        message.style.color =
            "black";


        try {

            const response = await fetch(
                `${API_URL}/auth/register`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        name: name,

                        email: email,

                        phone: phone,

                        password: password

                    })
                }
            );


            const data =
                await response.json();


            if (!response.ok) {

                message.textContent =
                    data.message ||
                    "Registration failed";

                message.style.color =
                    "red";

                return;
            }


            message.textContent =
                "Registration successful!";

            message.style.color =
                "green";


            setTimeout(
                function () {

                    window.location.href =
                        "login.html";

                },
                1000
            );


        } catch (error) {

            console.error(error);

            message.textContent =
                "Cannot connect to server.";

            message.style.color =
                "red";
        }

    }
);