const express = require("express");
const path = require("path");

const db = require("./config/db");

const vehicleRoutes = require("./routes/vehicleRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const authRoutes = require("./routes/authRoutes");
const fleetRoutes = require("./routes/fleetRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const dashboardRoutes =
    require("./routes/dashboardRoutes");
const customerRoutes =
    require("./routes/customerRoutes");
const reportRoutes =
    require("./routes/reportRoutes");

const app = express();

const PORT = 3000;

app.use(express.json());


// Serve frontend
app.use(express.static(
    path.join(__dirname, "../frontend")
));


app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "../frontend/index.html"
        )
    );
});


app.get("/test-db", async (req, res) => {

    try {

        const [result] =
            await db.query(
                "SELECT 1 AS connected"
            );

        res.json(result);

    } catch (error) {

        console.error(error);

        res.status(500).send(
            "Database connection failed"
        );
    }
});


app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/vehicles",
    vehicleRoutes
);

app.use(
    "/api/bookings",
    bookingRoutes
);

app.use(
    "/api/fleet",
    fleetRoutes
);

app.use(
    "/api/maintenance",
    maintenanceRoutes
);

app.use(
    "/api/dashboard",
    dashboardRoutes
);

app.use(
    "/api/customers",
     customerRoutes);

app.use(
    "/api/reports",
    reportRoutes
);

app.listen(
    PORT,
    () => {
        console.log(
            `Server running at http://localhost:${PORT}`
        );
    }
);