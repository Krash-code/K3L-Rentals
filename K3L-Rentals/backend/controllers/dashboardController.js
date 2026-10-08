const db = require("../config/db");

const getDashboardStats = async (req, res) => {
    try {

        // Total vehicles
        const [totalVehiclesResult] = await db.query(
            "SELECT COUNT(*) AS total FROM vehicles"
        );

        // Available vehicles
        const [availableResult] = await db.query(
            `SELECT COUNT(*) AS total
             FROM vehicles
             WHERE status = 'available'`
        );

        // Maintenance vehicles
        const [maintenanceResult] = await db.query(
            `SELECT COUNT(*) AS total
             FROM vehicles
             WHERE status = 'maintenance'`
        );

        // Vehicles currently in use
        const [inUseResult] = await db.query(
            `SELECT COUNT(DISTINCT vehicle_id) AS total
             FROM bookings
             WHERE status = 'confirmed'
             AND CURDATE() >= start_date
             AND CURDATE() < end_date`
        );

        // Vehicles with future bookings
        const [bookedResult] = await db.query(
            `SELECT COUNT(DISTINCT vehicle_id) AS total
             FROM bookings
             WHERE status = 'confirmed'
             AND end_date > CURDATE()
             AND start_date > CURDATE()`
        );

        // Total bookings
        const [totalBookingsResult] = await db.query(
            "SELECT COUNT(*) AS total FROM bookings"
        );

        // Total customers
        const [totalCustomersResult] = await db.query(
            `SELECT COUNT(*) AS total
             FROM users
             WHERE role = 'user'`
        );

        // Total revenue
        const [revenueResult] = await db.query(
            `SELECT
                COALESCE(SUM(total_amount), 0) AS total
             FROM bookings
             WHERE status = 'confirmed'`
        );


        res.json({

            totalVehicles:
                totalVehiclesResult[0].total,

            available:
                availableResult[0].total,

            booked:
                bookedResult[0].total,

            maintenance:
                maintenanceResult[0].total,

            inUse:
                inUseResult[0].total,

            totalBookings:
                totalBookingsResult[0].total,

            totalCustomers:
                totalCustomersResult[0].total,

            totalRevenue:
                revenueResult[0].total

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Failed to fetch dashboard statistics"
        });

    }
};

module.exports = {
    getDashboardStats
};