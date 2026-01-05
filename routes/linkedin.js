/**
 * LinkedIn Routes
 * API endpoints for LinkedIn profile extraction and search
 */

const express = require('express');
const router = express.Router();
const linkedinExtractor = require('../services/linkedinExtractor');

/**
 * GET /api/linkedin/sessions
 * Get all available LinkedIn sessions
 */
router.get('/sessions', (req, res) => {
    try {
        const sessions = linkedinExtractor.getAvailableSessions();
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/linkedin/init
 * Initialize a new LinkedIn session
 */
router.post('/init', async (req, res) => {
    try {
        const { sessionName } = req.body;

        if (!sessionName) {
            return res.status(400).json({ error: 'sessionName required' });
        }

        const result = await linkedinExtractor.initSession(sessionName, (message) => {
            console.log(`[LinkedIn] Login needed: ${message}`);
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/linkedin/close
 * Close a LinkedIn session
 */
router.post('/close', async (req, res) => {
    try {
        const { sessionName } = req.body;
        if (!sessionName) {
            return res.status(400).json({ error: 'sessionName required' });
        }
        const result = await linkedinExtractor.closeSession(sessionName);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/linkedin/session/:name
 * Get status of a specific session
 */
router.get('/session/:name', (req, res) => {
    try {
        const status = linkedinExtractor.getSessionStatus(req.params.name);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/linkedin/confirm-login
 * Confirm login after user has logged in manually
 */
router.post('/confirm-login', async (req, res) => {
    try {
        const { sessionName, force } = req.body;

        if (!sessionName) {
            return res.status(400).json({ error: 'sessionName required' });
        }

        const result = await linkedinExtractor.confirmLogin(sessionName, force === true);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/linkedin/search-people
 * Search for people on LinkedIn
 */
router.post('/search-people', async (req, res) => {
    try {
        const { sessionName, keywords, company, title, location, limit } = req.body;

        if (!sessionName) {
            return res.status(400).json({ error: 'sessionName required' });
        }

        const result = await linkedinExtractor.searchPeople(sessionName, {
            keywords,
            company,
            title,
            location,
            limit: limit || 25
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/linkedin/search-companies
 * Search for companies on LinkedIn
 */
router.post('/search-companies', async (req, res) => {
    try {
        const { sessionName, keywords, limit } = req.body;

        if (!sessionName || !keywords) {
            return res.status(400).json({ error: 'sessionName and keywords required' });
        }

        const result = await linkedinExtractor.searchCompanies(sessionName, keywords, limit || 25);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/linkedin/extract-profile
 * Extract detailed info from a LinkedIn profile
 */
router.post('/extract-profile', async (req, res) => {
    try {
        const { sessionName, profileUrl } = req.body;

        if (!sessionName || !profileUrl) {
            return res.status(400).json({ error: 'sessionName and profileUrl required' });
        }

        const result = await linkedinExtractor.extractProfile(sessionName, profileUrl);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/linkedin/extract-profiles
 * Extract detailed info from multiple LinkedIn profiles
 */
router.post('/extract-profiles', async (req, res) => {
    try {
        const { sessionName, profileUrls } = req.body;

        if (!sessionName || !profileUrls || !Array.isArray(profileUrls)) {
            return res.status(400).json({ error: 'sessionName and profileUrls array required' });
        }

        const result = await linkedinExtractor.extractProfiles(sessionName, profileUrls, (progress) => {
            console.log(`[LinkedIn] Extracting ${progress.current}/${progress.total}: ${progress.url}`);
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/linkedin/search-jobs
 * Search for jobs on LinkedIn
 */
router.post('/search-jobs', async (req, res) => {
    try {
        const { sessionName, keywords, location, jobType, experience, limit } = req.body;

        if (!sessionName) {
            return res.status(400).json({ error: 'sessionName required' });
        }

        const result = await linkedinExtractor.searchJobs(sessionName, {
            keywords,
            location,
            jobType,
            experience,
            limit: limit || 25
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/linkedin/extract-job
 * Extract detailed job information
 */
router.post('/extract-job', async (req, res) => {
    try {
        const { sessionName, jobUrl } = req.body;

        if (!sessionName || !jobUrl) {
            return res.status(400).json({ error: 'sessionName and jobUrl required' });
        }

        const result = await linkedinExtractor.extractJob(sessionName, jobUrl);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
