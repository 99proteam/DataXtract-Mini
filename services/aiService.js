const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('../config/database');
const fs = require('fs');
const path = require('path');
const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

class AIService {
    constructor() {
        this.config = this.loadConfig();
        this.model = null;
        this.initClient();
    }

    loadConfig() {
        if (fs.existsSync(SETTINGS_FILE)) {
            const allSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
            return allSettings.ai || { provider: 'gemini', apiKey: '' };
        }
        return {
            provider: 'gemini',
            apiKey: ''
        };
    }

    saveConfig(newConfig) {
        let allSettings = {};
        if (fs.existsSync(SETTINGS_FILE)) {
            allSettings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        }
        allSettings.ai = { ...allSettings.ai, ...newConfig };
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(allSettings, null, 2));
        this.config = allSettings.ai;
        this.initClient();
    }

    initClient() {
        if (!this.config.apiKey) {
            this.model = null;
            return;
        }

        try {
            const genAI = new GoogleGenerativeAI(this.config.apiKey);
            this.model = genAI.getGenerativeModel({ model: "gemini-pro" });
        } catch (e) {
            console.error('Failed to initialize Gemini client:', e);
            this.model = null;
        }
    }

    async analyzeBatch(items, prompt, systemPrompt = "You are a helpful data analyst.") {
        if (!this.model) {
            throw new Error('Gemini API not configured. Please set API Key.');
        }

        const results = [];
        // Gemini has rate limits (free tier 60/min). 
        // We'll process sequentially with a small delay to be safe, or small batches.
        // Let's do sequential for safety on free key.

        for (const item of items) {
            const result = await this.analyzeSingle(item, prompt, systemPrompt);
            results.push(result);
            // Small delay to avoid hitting rate limits too hard if items are small
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }

    async analyzeSingle(item, userPrompt, systemPrompt) {
        try {
            const itemContext = JSON.stringify(item, null, 2);
            // Gemini Pro doesn't separate system prompt in the same way as GPT-4/3.5 Turbo historically,
            // but we can prepend it.
            const content = `${systemPrompt}\n\n${userPrompt}\n\nData to analyze:\n${itemContext}`;

            if (!this.model) {
                this.initClient(); // Try to re-init if missing
                if (!this.model) throw new Error("Gemini Client not initialized");
            }

            const result = await this.model.generateContent(content);
            const response = await result.response;
            const text = response.text();

            return {
                id: item.id,
                success: true,
                analysis: text
            };
        } catch (error) {
            console.error(`AI Error for item ${item.id}:`, error.message);
            return {
                id: item.id,
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new AIService();
