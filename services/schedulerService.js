const cron = require('node-cron');
const { scheduleOps, campaignOps } = require('../config/database');
const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const xlsx = require('xlsx');

// Import your extraction logic triggering mechanism
// Since triggering logic is in routes or other services, we might need a way to reuse it.
// Ideally, the extraction logic should be in a separate service function (e.g. `CampaignRunner`)
// For now, we will simulate the run or need to refactor routes to share logic.
const googleMapsRoutes = require('../routes/googleMaps');
const domainRoutes = require('../routes/extraction');
const { keywordOps, domainOps } = require('../config/database');
// NOTE: Require routes usually isn't the best way to share logic. 
// A better way is to move the 'start' logic to a service. 
// But given the current structure, we'll try to invoke the extraction starter directly if possible,
// or simply use the database update to 'running' which the frontend/service might verify. 
// However, the extraction loop is actually triggered by the API call. 
// We should probably move the `startMapsExtraction` and `startDomainExtraction` to services.

// Let's assume we can POST to the local API or call a shared function. 
// Refactoring `googleMaps.js` to export the start logic is clean.

class SchedulerService {
    constructor() {
        this.jobs = new Map(); // Store cron tasks by schedule ID
    }

    init() {
        console.log('[Scheduler] Initializing...');
        const schedules = scheduleOps.getAll.all();
        schedules.forEach(s => {
            if (s.status === 'active') {
                this.scheduleJob(s);
            }
        });
        console.log(`[Scheduler] Loaded ${this.jobs.size} active jobs.`);
    }

    scheduleJob(schedule) {
        // If job exists, stop it first (update case)
        if (this.jobs.has(schedule.id)) {
            this.jobs.get(schedule.id).stop();
        }

        try {
            const task = cron.schedule(schedule.cron_expression, async () => {
                console.log(`[Scheduler] Executing job ${schedule.id} for campaign ${schedule.campaign_id}`);
                await this.executeJob(schedule);
            });

            this.jobs.set(schedule.id, task);
        } catch (error) {
            console.error(`[Scheduler] Failed to schedule job ${schedule.id}:`, error);
        }
    }

    stopJob(scheduleId) {
        if (this.jobs.has(scheduleId)) {
            this.jobs.get(scheduleId).stop();
            this.jobs.delete(scheduleId);
        }
    }

    async executeJob(schedule) {
        try {
            const campaignId = schedule.campaign_id;
            const campaign = campaignOps.getById.get(campaignId);

            if (!campaign) {
                console.error(`[Scheduler] Campaign ${campaignId} not found`);
                return;
            }

            if (campaign.status === 'running') {
                console.log(`[Scheduler] Campaign ${campaignId} is already running. Skipping.`);
                return;
            }

            console.log(`[Scheduler] Starting ${campaign.campaign_type} campaign: ${campaign.name}`);

            // Reset campaign to run again
            // We need to re-verify pending items or reset completed ones? 
            // For a scheduler, usually we want to re-run on the same inputs or new inputs.
            // If it's "Completed", we might need to reset stats or just run pending.
            // Assuming "Recurring" means "Process whatever is pending" OR "Re-process all".
            // For Safety: We will only run if there are pending items, OR if we strictly reset.
            // Let's assume we run what's available.

            campaignOps.start.run(campaignId);
            scheduleOps.updateLastRun.run(new Date().toISOString(), schedule.id);
            const options = campaign.options ? JSON.parse(campaign.options) : {};

            if (campaign.campaign_type === 'maps') {
                const keywords = keywordOps.getAllPending.all(campaignId);
                if (keywords.length > 0) {
                    googleMapsRoutes.startMapsExtraction(campaignId, keywords, options);
                } else {
                    console.log('[Scheduler] No pending keywords for Maps campaign.');
                    campaignOps.complete.run(campaignId);
                }
            } else {
                // Domain
                const domains = domainOps.getAllPending.all(campaignId);
                if (domains.length > 0) {
                    domainRoutes.startDomainExtraction(campaignId, domains, options);
                } else {
                    console.log('[Scheduler] No pending domains for campaign.');
                    campaignOps.complete.run(campaignId);
                }
            }

        } catch (error) {
            console.error(`[Scheduler] Job execution failed:`, error);
        }
    }
}

module.exports = new SchedulerService();
