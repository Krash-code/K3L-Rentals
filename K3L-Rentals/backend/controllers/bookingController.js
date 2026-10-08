const db = require("../config/db");


// GET ALL BOOKINGS
const getBookings = async (req, res) => {
    try {
        const [bookings] = await db.query(`
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
            JOIN vehicles v
            ON b.vehicle_id = v.id
        `);

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

        const {
            vehicle_id,
            start_date,
            end_date
        } = req.body;

        // Get logged-in user's ID from JWT
        const user_id = req.user.id;


        // --------------------------------
        // 1. Validate dates
        // --------------------------------

        const start = new Date(start_date);
        const end = new Date(end_date);

        const days = Math.ceil(
            (end - start) /
            (1000 * 60 * 60 * 24)
        );

        if (days <= 0) {
            return res.status(400).json({
                message: "End date must be after start date"
            });
        }


        // --------------------------------
        // 2. Check vehicle exists
        // --------------------------------

        const [vehicles] = await db.query(
            `SELECT
                id,
                price_per_day,
                status
             FROM vehicles
             WHERE id = ?`,
            [vehicle_id]
        );


        if (vehicles.length === 0) {
            return res.status(404).json({
                message: "Vehicle not found"
            });
        }


        const vehicle = vehicles[0];


        // --------------------------------
        // 3. Check vehicle status
        // --------------------------------

        if (vehicle.status !== "available") {

            return res.status(400).json({
                message: "Vehicle is currently unavailable"
            });

        }


        // --------------------------------
        // 4. Check date overlap
        // --------------------------------

        const [existingBookings] = await db.query(
            `SELECT id
             FROM bookings
             WHERE vehicle_id = ?
             AND status IN ('confirmed', 'pending')
             AND start_date < ?
             AND end_date > ?`,
            [
                vehicle_id,
                end_date,
                start_date
            ]
        );


        if (existingBookings.length > 0) {

            return res.status(400).json({
                message:
                    "Vehicle is already booked for the selected dates"
            });

        }


        // --------------------------------
        // 5. Calculate total amount
        // --------------------------------

        const total_amount =
            days * Number(vehicle.price_per_day);


        // --------------------------------
        // 6. Create booking
        // --------------------------------

        const [result] = await db.query(
            `INSERT INTO bookings
            (
                user_id,
                vehicle_id,
                start_date,
                end_date,
                total_amount,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                vehicle_id,
                start_date,
                end_date,
                total_amount,
                "confirmed"
            ]
        );


        // --------------------------------
        // 7. Send response
        // --------------------------------

        res.status(201).json({

            message:
                "Booking created successfully",

            bookingId:
                result.insertId,

            total_amount:
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
const updateBooking = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            start_date,
            end_date,
            status
        } = req.body;


        // Get existing booking + vehicle price
        const [bookings] = await db.query(
            `SELECT
                b.vehicle_id,
                v.price_per_day
             FROM bookings b
             JOIN vehicles v
             ON b.vehicle_id = v.id
             WHERE b.id = ?`,
            [id]
        );


        if (bookings.length === 0) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }


        const start = new Date(start_date);
        const end = new Date(end_date);

        const days = Math.ceil(
            (end - start) /
            (1000 * 60 * 60 * 24)
        );


        if (days <= 0) {
            return res.status(400).json({
                message: "End date must be after start date"
            });
        }


        const total_amount =
            days * bookings[0].price_per_day;


        const [result] = await db.query(
            `UPDATE bookings
             SET
                start_date = ?,
                end_date = ?,
                total_amount = ?,
                status = ?
             WHERE id = ?`,
            [
                start_date,
                end_date,
                total_amount,
                status,
                id
            ]
        );


        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }


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
const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;


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