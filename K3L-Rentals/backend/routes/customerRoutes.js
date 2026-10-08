const express = require("express");
const router = express.Router();

const {
    getCustomers,
    updateCustomerRole,
    deleteCustomer
} = require("../controllers/customerController");

const authenticateToken =
    require("../middleware/authMiddleware");

const adminOnly =
    require("../middleware/adminMiddleware");


// GET ALL CUSTOMERS
router.get(
    "/",
    authenticateToken,
    adminOnly,
    getCustomers
);


// UPDATE CUSTOMER ROLE
router.put(
    "/:id/role",
    authenticateToken,
    adminOnly,
    updateCustomerRole
);


// DELETE CUSTOMER
router.delete(
    "/:id",
    authenticateToken,
    adminOnly,
    deleteCustomer
);


module.exports = router;