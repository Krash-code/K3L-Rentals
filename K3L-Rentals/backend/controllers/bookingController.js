
const db = require("../config/db");

// Accept only real dates in YYYY-MM-DD format.
function isValidDate(value) {
    if (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

// Calculate rental days using UTC to avoid timezone errors.
function calculateDays(startDate, endDate) {
    const start = Date.parse(`${startDate}T00:00:00Z`);
    const end = Date.parse(`${endDate}T00:00:00Z`);

    return (end - start) / 86400000;
}

// GET BOOKINGS
// Admins see all bookings; customers see only their own.
const getBookings = async (req, res) => {
    try {
        let query = `
            SELECT
                b.id,
                b.user_id,
                b.vehicle_id,
                b.start_date,
                b.end_date,
                b.total_amount,
                b.status,
                v.vehicle_number,
                v.model
            FROM bookings b
            JOIN vehicles v ON b.vehicle_id = v.id
        `;

        const params = [];

        if (req.user.role !== "admin") {
            query += " WHERE b.user_id = ?";
            params.push(req.user.id);
        }

        query += " ORDER BY b.id DESC";

        const [bookings] = await db.query(query, params);

        res.json(bookings);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to fetch bookings"
        });
    }
};

// ADD BOOKING
const addBooking = async (req, res) => {
    try {
        const { vehicle_id, start_date, end_date } = req.body;
        const user_id = req.user.id;

        if (!Number.isInteger(Number(vehicle_id)) ||
            Number(vehicle_id) <= 0) {
            return res.status(400).json({
                message: "A valid vehicle ID is required"
            });
        }

        if (!isValidDate(start_date) ||
            !isValidDate(end_date)) {
            return res.status(400).json({
                message: "Dates must be valid and use YYYY-MM-DD format"
            });
        }

        const days = calculateDays(start_date, end_date);

        if (days <= 0) {
            return res.status(400).json({
                message: "End date must be after start date"
            });
        }

        const [vehicles] = await db.query(
            `SELECT id, price_per_day, status
             FROM vehicles
             WHERE id = ?`,
            [Number(vehicle_id)]
        );

        if (vehicles.length === 0) {
            return res.status(404).json({
                message: "Vehicle not found"
            });
        }

        const vehicle = vehicles[0];

        if (vehicle.status !== "available") {
            return res.status(400).json({
                message: "Vehicle is currently unavailable"
            });
        }

        const [conflicts] = await db.query(
            `SELECT id
             FROM bookings
             WHERE vehicle_id = ?
               AND status IN ('confirmed', 'pending')
               AND start_date < ?
               AND end_date > ?
             LIMIT 1`,
            [Number(vehicle_id), end_date, start_date]
        );

        if (conflicts.length > 0) {
            return res.status(409).json({
                message: "Vehicle is already booked for the selected dates"
            });
        }

        const total_amount =
            days * Number(vehicle.price_per_day);

        const [result] = await db.query(
            `INSERT INTO bookings
                (user_id, vehicle_id, start_date, end_date,
                 total_amount, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                Number(vehicle_id),
                start_date,
                end_date,
                total_amount,
                "confirmed"
            ]
        );

        res.status(201).json({
            message: "Booking created successfully",
            bookingId: result.insertId,
            total_amount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to create booking"
        });
    }
};

// UPDATE BOOKING
// This endpoint must be admin-only in bookingRoutes.js.
const updateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { start_date, end_date, status } = req.body;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                message: "Invalid booking ID"
            });
        }

        if (!isValidDate(start_date) ||
            !isValidDate(end_date)) {
            return res.status(400).json({
                message: "Dates must be valid and use YYYY-MM-DD format"
            });
        }

        const days = calculateDays(start_date, end_date);

        if (days <= 0) {
            return res.status(400).json({
                message: "End date must be after start date"
            });
        }

        const allowedStatuses = [
            "pending",
            "confirmed",
            "cancelled",
            "completed"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid booking status"
            });
        }

        const [bookings] = await db.query(
            `SELECT b.id, b.vehicle_id, v.price_per_day, v.status AS vehicle_status
             FROM bookings b
             JOIN vehicles v ON b.vehicle_id = v.id
             WHERE b.id = ?`,
            [id]
        );

        if (bookings.length === 0) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        const booking = bookings[0];

        // Check whether another active booking overlaps.
        if (["pending", "confirmed"].includes(status)) {
            if (booking.vehicle_status !== "available") {
                return res.status(400).json({
                    message: "Vehicle is currently unavailable"
                });
            }

            const [conflicts] = await db.query(
                `SELECT id
                 FROM bookings
                 WHERE vehicle_id = ?
                   AND id <> ?
                   AND status IN ('confirmed', 'pending')
                   AND start_date < ?
                   AND end_date > ?
                 LIMIT 1`,
                [
                    booking.vehicle_id,
                    id,
                    end_date,
                    start_date
                ]
            );

            if (conflicts.length > 0) {
                return res.status(409).json({
                    message: "Vehicle is already booked for the selected dates"
                });
            }
        }

        const total_amount =
            days * Number(booking.price_per_day);

        await db.query(
            `UPDATE bookings
             SET start_date = ?,
                 end_date = ?,
                 total_amount = ?,
                 status = ?
             WHERE id = ?`,
            [start_date, end_date, total_amount, status, id]
        );

        res.json({
            message: "Booking updated successfully",
            total_amount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to update booking"
        });
    }
};

// DELETE BOOKING
// This endpoint must be admin-only in bookingRoutes.js.
const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;

        if (!/^[1-9]\d*$/.test(id)) {
            return res.status(400).json({
                message: "Invalid booking ID"
            });
        }

        const [result] = await db.query(
            "DELETE FROM bookings WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        res.json({
            message: "Booking deleted successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Failed to delete booking"
        });
    }
};

module.exports = {
    getBookings,
    addBooking,
    updateBooking,
    deleteBooking
};