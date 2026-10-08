const db = require("../config/db");


// GET REPORT DATA
const getReports = async (req, res) => {

    try {

        // =========================
        // BASIC STATISTICS
        // =========================

        const [vehicleResult] =
            await db.query(`
                SELECT COUNT(*) AS total
                FROM vehicles
            `);


        const [customerResult] =
            await db.query(`
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'user'
            `);


        const [bookingResult] =
            await db.query(`
                SELECT COUNT(*) AS total
                FROM bookings
            `);


        const [revenueResult] =
            await db.query(`
                SELECT
                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS total
                FROM bookings
                WHERE status = 'confirmed'
            `);


        // =========================
        // BOOKING STATUS
        // =========================

        const [bookingStatusResult] =
            await db.query(`
                SELECT
                    status,
                    COUNT(*) AS count
                FROM bookings
                GROUP BY status
            `);


        // =========================
        // VEHICLE STATUS
        // =========================

        const [vehicleStatusResult] =
            await db.query(`
                SELECT
                    status,
                    COUNT(*) AS count
                FROM vehicles
                GROUP BY status
            `);


        // =========================
        // MAINTENANCE
        // =========================

        const [maintenanceResult] =
            await db.query(`
                SELECT
                    COUNT(*) AS total
                FROM maintenance
            `);


        const [completedMaintenanceResult] =
            await db.query(`
                SELECT
                    COUNT(*) AS total
                FROM maintenance
                WHERE status = 'completed'
            `);


        const [pendingMaintenanceResult] =
            await db.query(`
                SELECT
                    COUNT(*) AS total
                FROM maintenance
                WHERE status IN (
                    'scheduled',
                    'in_progress'
                )
            `);


        // =========================
        // MONTHLY REVENUE
        // =========================

        const [monthlyRevenueResult] =
            await db.query(`
                SELECT
                    DATE_FORMAT(
                        start_date,
                        '%Y-%m'
                    ) AS month,

                    COALESCE(
                        SUM(total_amount),
                        0
                    ) AS revenue

                FROM bookings

                WHERE status = 'confirmed'

                GROUP BY
                    DATE_FORMAT(
                        start_date,
                        '%Y-%m'
                    )

                ORDER BY month
            `);


        // =========================
        // MOST BOOKED VEHICLES
        // =========================

        const [popularVehiclesResult] =
            await db.query(`
                SELECT
                    v.model,
                    v.vehicle_number,
                    COUNT(b.id) AS bookings

                FROM vehicles v

                LEFT JOIN bookings b
                    ON v.id = b.vehicle_id
                    AND b.status = 'confirmed'

                GROUP BY
                    v.id,
                    v.model,
                    v.vehicle_number

                ORDER BY bookings DESC

                LIMIT 10
            `);


        // =========================
        // RESPONSE
        // =========================

        res.json({

            summary: {

                totalVehicles:
                    vehicleResult[0].total,

                totalCustomers:
                    customerResult[0].total,

                totalBookings:
                    bookingResult[0].total,

                totalRevenue:
                    revenueResult[0].total,

                totalMaintenance:
                    maintenanceResult[0].total,

                completedMaintenance:
                    completedMaintenanceResult[0].total,

                pendingMaintenance:
                    pendingMaintenanceResult[0].total

            },


            bookingStatus:
                bookingStatusResult,


            vehicleStatus:
                vehicleStatusResult,


            monthlyRevenue:
                monthlyRevenueResult,


            popularVehicles:
                popularVehiclesResult

        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message:
                "Failed to generate reports"
        });

    }

};


module.exports = {
    getReports
};