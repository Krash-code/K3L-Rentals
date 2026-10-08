const db = require("../config/db");

const getMaintenance = async (req, res) => {
    try {
        const [records] = await db.query(`
            SELECT
                m.id,
                m.vehicle_id,
                v.vehicle_number,
                v.model,
                m.service_date,
                m.next_service_date,
                m.description,
                m.status
            FROM maintenance m
            JOIN vehicles v
            ON m.vehicle_id = v.id
        `);

        res.json(records);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch maintenance records"
        });
    }
};


const addMaintenance = async (req, res) => {
    try {
        const {
            vehicle_id,
            service_date,
            next_service_date,
            description,
            status
        } = req.body;

        const [result] = await db.query(
            `INSERT INTO maintenance
            (
                vehicle_id,
                service_date,
                next_service_date,
                description,
                status
            )
            VALUES (?, ?, ?, ?, ?)`,
            [
                vehicle_id,
                service_date,
                next_service_date,
                description,
                status || "scheduled"
            ]
        );

        await db.query(
    `UPDATE vehicles
     SET status = 'maintenance'
     WHERE id = ?`,
    [vehicle_id]
);

        res.status(201).json({
            message: "Maintenance record added successfully",
            maintenanceId: result.insertId
        });
        

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to add maintenance record"
        });
    }
};


const updateMaintenance = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            next_service_date,
            description,
            status
        } = req.body;

        const [result] = await db.query(
            `UPDATE maintenance
            SET
                next_service_date = ?,
                description = ?,
                status = ?
            WHERE id = ?`,
            [
                next_service_date,
                description,
                status,
                id
            ]
        );

        if (status === "completed") {

    await db.query(
        `UPDATE vehicles
         SET status = 'available'
         WHERE id = (
             SELECT vehicle_id
             FROM maintenance
             WHERE id = ?
         )`,
        [id]
    );

}

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Maintenance record not found"
            });
        }

        res.json({
            message: "Maintenance record updated successfully"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update maintenance record"
        });
    }
};


module.exports = {
    getMaintenance,
    addMaintenance,
    updateMaintenance
};