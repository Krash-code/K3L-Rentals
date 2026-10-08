const express = require("express");

const router = express.Router();

const {
    getVehicles,
    getVehicleById,
    addVehicle,
    updateVehicle,
    deleteVehicle
} = require("../controllers/vehicleController");

const authenticateToken = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");


// Anyone can view all vehicles
router.get("/", getVehicles);


// Anyone can view one vehicle
router.get("/:id", getVehicleById);


// Admin only: add vehicle
router.post(
    "/",
    authenticateToken,
    adminOnly,
    addVehicle
);


// Admin only: update vehicle
router.put(
    "/:id",
    authenticateToken,
    adminOnly,
    updateVehicle
);


// Admin only: delete vehicle
router.delete(
    "/:id",
    authenticateToken,
    adminOnly,
    deleteVehicle
);


module.exports = router;