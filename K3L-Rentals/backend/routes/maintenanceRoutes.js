const express = require("express");

const router = express.Router();

const {
    getMaintenance,
    addMaintenance,
    updateMaintenance
} = require("../controllers/maintenanceController");

const authenticateToken = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

router.get(
    "/",
    authenticateToken,
    getMaintenance
);

router.post(
    "/",
    authenticateToken,
    adminOnly,
    addMaintenance
);

router.put(
    "/:id",
    authenticateToken,
    adminOnly,
    updateMaintenance
);

module.exports = router;