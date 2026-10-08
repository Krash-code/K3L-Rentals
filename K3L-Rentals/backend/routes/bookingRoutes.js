const express = require("express");

const router = express.Router();

const {
    getBookings,
    addBooking,
    updateBooking,
    deleteBooking
} = require("../controllers/bookingController");

const authenticateToken = require("../middleware/authMiddleware");


// Get bookings
router.get(
    "/",
    authenticateToken,
    getBookings
);

// Create booking
router.post(
    "/",
    authenticateToken,
    addBooking
);


// Update booking
router.put(
    "/:id",
    authenticateToken,
    updateBooking
);


// Delete booking
router.delete(
    "/:id",
    authenticateToken,
    deleteBooking
);


module.exports = router;