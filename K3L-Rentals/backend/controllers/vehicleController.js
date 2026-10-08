const db = require("../config/db");


// GET ALL VEHICLES
const getVehicles = async (req, res) => {
    try {
        const [vehicles] = await db.query(
            "SELECT * FROM vehicles"
        );

        res.json(vehicles);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch vehicles"
        });
    }
};


// GET VEHICLE BY ID
const getVehicleById = async (req, res) => {
    try {
        const { id } = req.params;

        const [vehicles] = await db.query(
            "SELECT * FROM vehicles WHERE id = ?",
            [id]
        );

        if (vehicles.length === 0) {
            return res.status(404).json({
                message: "Vehicle not found"
            });
        }

        res.json(vehicles[0]);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch vehicle"
        });
    }
};


// ADD VEHICLE
const addVehicle = async (req, res) => {
    try {
        const {
            vehicle_number,
            model,
            type,
            price_per_day,
            location,
            status,
            image
        } = req.body;

        const [result] = await db.query(
            `INSERT INTO vehicles
            (vehicle_number, model, type, price_per_day, location, status, image)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                vehicle_number,
                model,
                type,
                price_per_day,
                location,
                status || "available",
                image
            ]
        );

        res.status(201).json({
            message: "Vehicle added successfully",
            vehicleId: result.insertId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to add vehicle"
        });
    }
};


// UPDATE VEHICLE
const updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            vehicle_number,
            model,
            type,
            price_per_day,
            location,
            status,
            image
        } = req.body;

        const [result] = await db.query(
            `UPDATE vehicles
            SET
                vehicle_number = ?,
                model = ?,
                type = ?,
                price_per_day = ?,
                location = ?,
                status = ?,
                image = ?
            WHERE id = ?`,
            [
                vehicle_number,
                model,
                type,
                price_per_day,
                location,
                status,
                image,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Vehicle not found"
            });
        }

        res.json({
            message: "Vehicle updated successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update vehicle"
        });
    }
};


// DELETE VEHICLE
const deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.query(
            "DELETE FROM vehicles WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Vehicle not found"
            });
        }

        res.json({
            message: "Vehicle deleted successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete vehicle"
        });
    }
};


module.exports = {
    getVehicles,
    getVehicleById,
    addVehicle,
    updateVehicle,
    deleteVehicle
};