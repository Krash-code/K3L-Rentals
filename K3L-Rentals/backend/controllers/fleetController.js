const db = require("../config/db");

const getFleet = async (req, res) => {
    try {
        const [vehicles] = await db.query(`
            SELECT
                id,
                vehicle_number,
                model,
                type,
                location,
                status
            FROM vehicles
        `);

        res.json(vehicles);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch fleet"
        });
    }
};


const updateVehicleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = [
    "available",
    "booked",
    "in_use",
    "maintenance"
];

if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
        message: "Invalid vehicle status"
    });
}

        const [result] = await db.query(
            "UPDATE vehicles SET status = ? WHERE id = ?",
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Vehicle not found"
            });
        }

        res.json({
            message: "Vehicle status updated successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update vehicle status"
        });
    }
};


const updateVehicleLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { location } = req.body;

        const allowedStatuses = [
    "available",
    "booked",
    "in_use",
    "maintenance"
];

if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
        message: "Invalid vehicle status"
    });
}

        const [result] = await db.query(
            "UPDATE vehicles SET location = ? WHERE id = ?",
            [location, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Vehicle not found"
            });
        }

        res.json({
            message: "Vehicle location updated successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update vehicle location"
        });
    }
};


module.exports = {
    getFleet,
    updateVehicleStatus,
    updateVehicleLocation
};