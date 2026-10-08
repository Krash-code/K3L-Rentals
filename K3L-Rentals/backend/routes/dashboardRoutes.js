const express = require("express");

const router = express.Router();

const {
    getDashboardStats
} = require("../controllers/dashboardController");

const authenticateToken =
    require("../middleware/authMiddleware");

const adminOnly =
    require("../middleware/adminMiddleware");


router.get(
    "/stats",
    authenticateToken,
    adminOnly,
    getDashboardStats
);


module.exports = router;