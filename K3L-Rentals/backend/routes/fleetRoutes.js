const express = require("express");

const router = express.Router();

const {
    getFleet,
    updateVehicleStatus,
    updateVehicleLocation
} = require("../controllers/fleetController");

const authenticateToken = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

router.get(
    "/",
    authenticateToken,
    getFleet
);

router.put(
    "/:id/status",
    authenticateToken,
    adminOnly,
    updateVehicleStatus
);

router.put(
    "/:id/location",
    authenticateToken,
    adminOnly,
    updateVehicleLocation
);

module.exports = router;