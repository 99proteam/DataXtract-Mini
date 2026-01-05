const express = require('express');
const router = express.Router();
const { scheduleOps } = require('../config/database');
const schedulerService = require('../services/schedulerService');

// Get all schedules
router.get('/', (req, res) => {
    try {
        const schedules = scheduleOps.getAll.all();
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new schedule
router.post('/', (req, res) => {
    try {
        const { campaign_id, cron_expression, frequency_label, auto_export_format } = req.body;

        if (!cron.validate(cron_expression)) {
            return res.status(400).json({ error: 'Invalid cron expression' });
        }

        const result = scheduleOps.add.run(
            campaign_id,
            cron_expression,
            frequency_label,
            new Date().toISOString(), // Next run (approx)
            auto_export_format || 'none'
        );

        const newSchedule = scheduleOps.getById.get(result.lastInsertRowid);

        // Register with service
        schedulerService.scheduleJob(newSchedule);

        res.json({ success: true, schedule: newSchedule });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Toggle pause/resume
router.post('/:id/toggle', (req, res) => {
    try {
        const { id } = req.params;
        const schedule = scheduleOps.getById.get(id);

        if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

        const newStatus = schedule.status === 'active' ? 'paused' : 'active';
        scheduleOps.updateStatus.run(newStatus, id);

        if (newStatus === 'active') {
            schedulerService.scheduleJob({ ...schedule, status: 'active' });
        } else {
            schedulerService.stopJob(parseInt(id));
        }

        res.json({ success: true, status: newStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete schedule
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        scheduleOps.delete.run(id);
        schedulerService.stopJob(parseInt(id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const cron = require('node-cron');

module.exports = router;
