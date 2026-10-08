const db = require("../config/db");

// GET ALL CUSTOMERS
const getCustomers = async (req, res) => {
    try {
        const [customers] = await db.query(`
            SELECT
                id,
                name,
                email,
                phone,
                role
            FROM users
            ORDER BY id DESC
        `);

        res.json(customers);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch customers"
        });
    }
};


// UPDATE CUSTOMER ROLE
const updateCustomerRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!["user", "admin"].includes(role)) {
            return res.status(400).json({
                message: "Invalid role"
            });
        }

        // Prevent admin from changing their own role
        if (Number(id) === Number(req.user.id)) {
            return res.status(400).json({
                message: "You cannot change your own role"
            });
        }

        const [result] = await db.query(
            `UPDATE users
             SET role = ?
             WHERE id = ?`,
            [role, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        res.json({
            message: "Customer role updated successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update customer role"
        });
    }
};


// DELETE CUSTOMER
const deleteCustomer = async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent admin from deleting themselves
        if (Number(id) === Number(req.user.id)) {
            return res.status(400).json({
                message: "You cannot delete your own account"
            });
        }

        const [result] = await db.query(
            "DELETE FROM users WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Customer not found"
            });
        }

        res.json({
            message: "Customer deleted successfully"
        });

    } catch (error) {
        console.error(error);

        // Foreign key constraint
        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(400).json({
                message:
                    "Cannot delete this customer because they have existing bookings."
            });
        }

        res.status(500).json({
            message: "Failed to delete customer"
        });
    }
};


module.exports = {
    getCustomers,
    updateCustomerRole,
    deleteCustomer
};