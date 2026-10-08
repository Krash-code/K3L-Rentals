const express = require("express");

const router =
    express.Router();


const {
    getReports
} =
    require("../controllers/reportController");


const authenticateToken =
    require("../middleware/authMiddleware");


const adminOnly =
    require("../middleware/adminMiddleware");


router.get(
    "/",
    authenticateToken,
    adminOnly,
    getReports
);


module.exports = router;