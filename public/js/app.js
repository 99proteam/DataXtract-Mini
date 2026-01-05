/**
 * Domain Data Extractor - Frontend Application
 * Handles UI interactions, API calls, and WebSocket communication
 */

// ===================================
// State Management
// ===================================

const state = {
    campaigns: [],
    currentCampaign: null,
    currentStep: 1,
    uploadedFile: null,
    itemsCount: 0, // Replaces domainCount
    ws: null,
    wsConnected: false,
    campaignType: 'domain' // 'domain' or 'maps'
};

// Visual Tools Logic
let currentToolTab = 'screenshots';

function switchToolTab(tabName) {
    currentToolTab = tabName;

    // Update Tabs
    document.querySelectorAll('.marketing-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent.toLowerCase().includes(tabName === 'downloader' ? 'code' : tabName === 'traffic' ? 'traffic' : 'screenshots')) {
            tab.classList.add('active');
        }
    });

    // Update Sections
    document.querySelectorAll('.tool-section').forEach(section => {
        section.classList.add('hidden');
    });

    const targetSection = document.getElementById(tabName === 'screenshots' ? 'toolScreenshots' :
        tabName === 'traffic' ? 'toolTraffic' : 'toolDownloader');
    if (targetSection) targetSection.classList.remove('hidden');
}

async function startTrafficGen() {
    const urlsText = document.getElementById('trafficUrls').value;
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u);

    if (urls.length === 0) {
        showToast('Please enter at least one URL', 'error');
        return;
    }

    const config = {
        useProxies: document.getElementById('trafficUseProxies').checked,
        device: document.getElementById('trafficDevice').value,
        visitCount: parseInt(document.getElementById('trafficVisitCount').value) || 1,
        internalVisits: parseInt(document.getElementById('trafficInternalVisits').value) || 0,
        enableHuman: document.getElementById('trafficHuman').checked,
        durationMin: parseInt(document.getElementById('trafficMinTime').value) || 30,
        durationMax: parseInt(document.getElementById('trafficMaxTime').value) || 60
    };

    const consoleDiv = document.getElementById('trafficConsole');
    consoleDiv.style.display = 'block';
    consoleDiv.innerHTML = '<div style="margin-bottom: 8px; color: #fff; border-bottom: 1px solid #333; padding-bottom: 8px;">Traffic Generator Logs</div>';

    try {
        // Subscribe to tools channel
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({ type: 'subscribe', campaignId: 'visual_tools' }));
        }

        const response = await fetch('/api/tools/traffic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls, config })
        });

        const data = await response.json();
        if (data.success) {
            showToast('Traffic job started', 'success');
            appendLog(consoleDiv, 'Job started: ' + data.jobId);
        } else {
            showToast(data.error, 'error');
        }
    } catch (e) {
        showToast('Failed to start traffic job', 'error');
        console.error(e);
    }
}

async function startDownloader() {
    const urlsText = document.getElementById('downloadUrls').value;
    const urls = urlsText.split('\n').map(u => u.trim()).filter(u => u);

    if (urls.length === 0) {
        showToast('Please enter at least one URL', 'error');
        return;
    }

    const renderJs = document.getElementById('renderJs').checked;

    const consoleDiv = document.getElementById('downloadConsole');
    consoleDiv.style.display = 'block';
    consoleDiv.innerHTML = '<div style="margin-bottom: 8px; color: #fff; border-bottom: 1px solid #333; padding-bottom: 8px;">Downloader Logs</div>';

    try {
        // Subscribe to tools channel
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
            state.ws.send(JSON.stringify({ type: 'subscribe', campaignId: 'visual_tools' }));
        }

        const response = await fetch('/api/tools/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls, renderJs })
        });

        const data = await response.json();
        if (data.success) {
            showToast('Download job started', 'success');
            appendLog(consoleDiv, 'Job started: ' + data.batchId);
            appendLog(consoleDiv, 'Files will be saved to data/downloads/' + data.batchId);
        } else {
            showToast(data.error, 'error');
        }
    } catch (e) {
        showToast('Failed to start download job', 'error');
        console.error(e);
    }
}

async function exportTrafficLogs() {
    try {
        window.location.href = '/api/tools/export/traffic';
    } catch (e) {
        showToast('Failed to export logs', 'error');
    }
}

function appendLog(consoleDiv, message) {
    const div = document.createElement('div');
    div.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    div.style.marginBottom = '4px';
    consoleDiv.appendChild(div);
    consoleDiv.scrollTop = consoleDiv.scrollHeight;
}

// Global scope
window.switchToolTab = switchToolTab;
window.startTrafficGen = startTrafficGen;
window.startDownloader = startDownloader;
window.exportTrafficLogs = exportTrafficLogs;


// ===================================
// DOM Elements
// ===================================

const elements = {
    // Pages
    pages: document.querySelectorAll('.page'),
    navItems: document.querySelectorAll('.nav-item'),

    // Stats
    statTotalCampaigns: document.getElementById('statTotalCampaigns'),
    statTotalDomains: document.getElementById('statTotalDomains'),
    statTotalEmails: document.getElementById('statTotalEmails'),
    statActiveCampaigns: document.getElementById('statActiveCampaigns'),

    // Campaign Lists
    recentCampaigns: document.getElementById('recentCampaigns'),
    allCampaigns: document.getElementById('allCampaigns'),

    // New Campaign Modal
    modalNewCampaign: document.getElementById('modalNewCampaign'),
    // btnNewCampaign: document.getElementById('btnNewCampaign'), // REMOVED: Using class selector in initEventListeners
    btnCloseModal: document.getElementById('btnCloseModal'),
    formNewCampaign: document.getElementById('formNewCampaign'),
    wizardSteps: document.querySelectorAll('.wizard-step'),
    wizardContents: document.querySelectorAll('.wizard-content'),
    btnPrevStep: document.getElementById('btnPrevStep'),
    btnNextStep: document.getElementById('btnNextStep'),
    btnCreateCampaign: document.getElementById('btnCreateCampaign'),

    // Wizard Inputs
    campaignTypeInputs: document.getElementsByName('campaignType'),
    domainUploadView: document.getElementById('domainUploadView'),
    mapsKeywordsView: document.getElementById('mapsKeywordsView'),
    domainConfigView: document.getElementById('domainConfigView'),
    mapsConfigView: document.getElementById('mapsConfigView'),
    keywordsInput: document.getElementById('keywordsInput'),
    enableDeepCrawl: document.getElementById('enableDeepCrawl'),
    deepCrawlOptions: document.getElementById('deepCrawlOptions'),

    // Campaign Details
    pageCampaignDetails: document.getElementById('pageCampaignDetails'),
    btnBackToCampaigns: document.getElementById('btnBackToCampaigns'),
    campaignDetailName: document.getElementById('campaignDetailName'),
    campaignDetailStatus: document.getElementById('campaignDetailStatus'),
    campaignDetailProgress: document.getElementById('campaignDetailProgress'),
    campaignProgressBar: document.getElementById('campaignProgressBar'),
    progressLog: document.getElementById('progressLog'),
    resultsTableBody: document.getElementById('resultsTableBody'),
    resultsTableHead: document.querySelector('#resultsTable thead tr'), // Added for dynamic headers
    btnStartCampaign: document.getElementById('btnStartCampaign'),
    btnPauseCampaign: document.getElementById('btnPauseCampaign'),
    btnVerifyEmails: document.getElementById('btnVerifyEmails'),
    btnExportResults: document.getElementById('btnExportResults'),

    // Settings
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    // Proxy
    settingsProxyEnabled: document.getElementById('settingsProxyEnabled'),
    settingsProxyRotateError: document.getElementById('settingsProxyRotateError'),
    settingsWebshareApiKey: document.getElementById('settingsWebshareApiKey'),
    // SMTP
    settingsSmtpEnabled: document.getElementById('settingsSmtpEnabled'),
    settingsSmtpHost: document.getElementById('settingsSmtpHost'),
    settingsSmtpPort: document.getElementById('settingsSmtpPort'),
    settingsSmtpUser: document.getElementById('settingsSmtpUser'),
    settingsSmtpPass: document.getElementById('settingsSmtpPass'),
    // Twilio
    settingsTwilioEnabled: document.getElementById('settingsTwilioEnabled'),
    settingsTwilioSid: document.getElementById('settingsTwilioSid'),
    settingsTwilioToken: document.getElementById('settingsTwilioToken'),
    settingsTwilioPhone: document.getElementById('settingsTwilioPhone'),
    // AI
    settingsAiProvider: document.getElementById('settingsAiProvider'),
    settingsAiKey: document.getElementById('settingsAiKey'),
    settingsGeminiModel: document.getElementById('settingsGeminiModel'),
    settingsAiBaseUrl: document.getElementById('settingsAiBaseUrl'),
    settingsAiModel: document.getElementById('settingsAiModel'),
    // API Keys
    settingsApiZerobounce: document.getElementById('settingsApiZerobounce'),

    // Export Modal
    modalExport: document.getElementById('modalExport'),
    btnCloseExportModal: document.getElementById('btnCloseExportModal'),
    exportOptions: document.querySelectorAll('.export-option'),

    // Upload
    uploadZone: document.getElementById('uploadZone'),
    domainsFile: document.getElementById('domainsFile'),
    uploadedFile: document.getElementById('uploadedFile'),
    fileName: document.getElementById('fileName'),
    domainCount: document.getElementById('domainCount'),
    btnRemoveFile: document.getElementById('btnRemoveFile'),

    // Keywords Upload
    keywordsUploadZone: document.getElementById('keywordsUploadZone'),
    keywordsFile: document.getElementById('keywordsFile'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),

    // Mode selector
    modeOptions: document.querySelectorAll('.mode-option'),
    tabBtns: document.querySelectorAll('.tab-btn')
};

// ===================================
// Initialization
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    initEventListeners();
    // AI initialization removed

    // Load initial data
    loadCampaigns();
    loadProxies(); // Load proxies on startup
    initMobileMenu(); // Initialize mobile sidebar
});

// ===================================
// WebSocket
// ===================================

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state.ws = new WebSocket(`${protocol}//${window.location.host}`);

    state.ws.onopen = () => {
        state.wsConnected = true;
        console.log('WebSocket connected');
    };

    state.ws.onclose = () => {
        state.wsConnected = false;
        console.log('WebSocket disconnected');
        // Reconnect after 3 seconds
        setTimeout(initWebSocket, 3000);
    };

    state.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };
}

function handleWebSocketMessage(data) {
    // Allow screenshot updates to pass through even if not in a "campaign"
    const isScreenshot = data.campaignId && data.campaignId.toString().startsWith('screenshot-');

    // DEBUG: Log matches
    if (data.type === 'progress' || data.type === 'screenshot_result') {
        // console.log('[WS Debug]', data.type, 'isScreenshot:', isScreenshot, 'ID:', data.campaignId);
    }

    if (!isScreenshot && (!state.currentCampaign || state.currentCampaign.id != data.campaignId)) return;

    switch (data.type) {
        case 'connected':
            console.log('Connected with client ID:', data.clientId);
            break;

        case 'progress':
            if (isScreenshot) {
                // Update screenshot progress
                const percent = data.progress;
                const bar = document.getElementById('screenshotProgressBar');
                const text = document.getElementById('screenshotProgressText');

                if (bar) bar.style.width = `${percent}%`;

                // Use count if available, else percent
                if (text) {
                    if (data.processed !== undefined && data.total !== undefined) {
                        text.textContent = `${data.processed} / ${data.total}`;
                    } else {
                        text.textContent = `${percent}%`;
                    }
                }
            } else {
                updateProgress(data);
            }
            break;

        case 'domain_complete':
            addLogEntry(`✓ Completed: ${data.domain} (${data.resultsCount} items)`, 'success');
            break;

        case 'keyword_complete': // For maps
            addLogEntry(`✓ Completed: ${data.keyword} (${data.resultsCount} results)`, 'success');
            break;

        case 'domain_error':
            addLogEntry(`✗ Error: ${data.domain} - ${data.error}`, 'error');
            break;

        case 'processing_item': // For maps
            addLogEntry(`⟳ Processing: ${data.item}`, 'info');
            const keywordEl = document.getElementById('campaignDetailKeyword');
            if (keywordEl) keywordEl.textContent = data.item;
            break;

        case 'log':
            addLogEntry(data.message, 'info');
            break;

        case 'completed':
            showToast('Campaign completed successfully!', 'success');
            state.liveResults = []; // Clear live results
            loadCampaigns(); // Refresh list
            loadCampaignDetails(state.currentCampaign.id); // Refresh details with final data
            break;

        case 'error':
            showToast(`Error: ${data.message}`, 'error');
            break;

        case 'result':
            // Live business result - add to table immediately
            if (data.business) {
                const isPartial = data.business.partial;
                const statusIcon = isPartial ? '⏳' : '✅';
                addLogEntry(`${statusIcon} ${isPartial ? 'Found' : 'Details'}: ${data.business.name} ${data.business.phone ? '📞 ' + data.business.phone : ''}`, 'success');

                // Add or update result in live results array
                if (!state.liveResults) state.liveResults = [];
                const existingIdx = state.liveResults.findIndex(r => r.name === data.business.name && r.address === data.business.address);

                if (existingIdx >= 0) {
                    // Update existing (replace partial with full details)
                    state.liveResults[existingIdx] = { ...data.business, keyword: data.keyword, type: 'map_business' };
                } else {
                    // Add new
                    state.liveResults.push({ ...data.business, keyword: data.keyword, type: 'map_business' });

                    // Increment Found Counter (Real-time 1, 2, 3...) ONLY for new items
                    const foundCountEl = document.getElementById('campaignDetailFound');
                    if (foundCountEl) {
                        const current = parseInt(foundCountEl.textContent) || 0;
                        foundCountEl.textContent = current + 1;

                        // Flash effect
                        foundCountEl.style.color = '#22c55e';
                        setTimeout(() => foundCountEl.style.color = '', 500);
                    }
                }

                // Update the results table with live data
                if (typeof renderResultsTable === 'function') {
                    renderResultsTable(state.liveResults, state.currentCampaign.campaign_type);
                }
            }
            break;

        case 'result_found':
            // Generic extraction result (email, phone, etc.)
            if (data.result) {
                const r = data.result;
                let icon = '📄';
                if (r.dataType === 'email') icon = '📧';
                else if (r.dataType === 'phone') icon = '📞';
                else if (r.dataType === 'social') icon = '🔗';

                addLogEntry(`${icon} Found ${r.dataType}: ${r.value} (${r.domain})`, 'success');

                if (!state.liveResults) state.liveResults = [];
                state.liveResults.push({ ...r, type: 'generic_result' });

                if (state.liveResults.length > 50) state.liveResults.shift();

                if (typeof renderResultsTable === 'function') {
                    renderResultsTable(state.liveResults, state.currentCampaign.campaign_type);
                }
            }
            break;

        case 'screenshot_result':
            {
                // Multi-device screenshot result
                const cardId = `shot-card-${data.urlIndex}-${data.device}`;
                const card = document.getElementById(cardId);

                if (card) {
                    const badge = card.querySelector('.status-badge');
                    const imgContainer = card.querySelector('.result-image');

                    if (data.success) {
                        badge.textContent = 'Captured';
                        badge.style.background = '#22c55e';
                        badge.style.color = '#fff';

                        imgContainer.style.display = 'block';
                        imgContainer.innerHTML = `
                            <a href="${data.image}" target="_blank">
                                <img src="${data.image}" style="width: 100%; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);" loading="lazy">
                            </a>
                        `;
                    } else {
                        badge.textContent = 'Failed';
                        badge.style.background = '#ef4444';
                        badge.style.color = '#fff';
                        card.insertAdjacentHTML('beforeend', `<div style="color: #ef4444; font-size: 0.8rem; margin-top: 8px;">${data.error}</div>`);
                    }
                }
            }
            break;
    }
}

function subscribeTocamp(campaignId) {
    if (state.ws && state.wsConnected) {
        state.ws.send(JSON.stringify({ type: 'subscribe', campaignId }));
    }
}

// ===================================
// Page Navigation
// ===================================

function navigateToPage(pageId) {
    // Query pages fresh each time to ensure we get all pages
    const allPages = document.querySelectorAll('.page');
    // Select both desktop and mobile nav items
    const allNavItems = document.querySelectorAll('.nav-item, .mobile-nav-item');

    // Hide all pages
    allPages.forEach(page => {
        page.classList.remove('active');
        page.classList.add('hidden');
    });

    // Remove active from all nav items
    allNavItems.forEach(item => item.classList.remove('active'));

    // Map data-page attribute to actual page ID
    const pageIdMap = {
        'dashboard': 'pageDashboard',
        'campaigns': 'pageCampaigns',
        'guide': 'pageGuide',
        'marketing': 'pageMarketing',
        'tools': 'pageTools',
        'settings': 'pageSettings'
    };

    const targetPageId = pageIdMap[pageId] || `page${pageId.charAt(0).toUpperCase() + pageId.slice(1)}`;
    const targetPage = document.getElementById(targetPageId);

    console.log('Navigating to:', pageId, '-> Target ID:', targetPageId, '-> Found:', !!targetPage);

    if (targetPage) {
        targetPage.classList.remove('hidden');
        targetPage.classList.add('active');
    } else {
        console.error('Page not found:', targetPageId);
    }

    // Set active nav item (Desktop & Mobile)
    const activeNavs = document.querySelectorAll(`.nav-item[data-page="${pageId}"], .mobile-nav-item[data-page="${pageId}"]`);
    activeNavs.forEach(nav => nav.classList.add('active'));

    // Special loading logic for specific pages
    if (pageId === 'schedules') loadSchedules();
    if (pageId === 'proxies') loadProxies();
    if (pageId === 'settings') loadSettings();
}

// ===================================
// Event Listeners
// ===================================

function initEventListeners() {
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateToPage(page);
        });
    });

    // New Campaign Modal (Handle multiple buttons for Desktop/Mobile)
    const newCampaignBtns = document.querySelectorAll('.btn-new-campaign');
    newCampaignBtns.forEach(btn => {
        btn.addEventListener('click', openNewCampaignModal);
    });

    if (elements.btnCloseModal) elements.btnCloseModal.addEventListener('click', closeNewCampaignModal);

    if (elements.modalNewCampaign) {
        elements.modalNewCampaign.addEventListener('click', (e) => {
            if (e.target === elements.modalNewCampaign) closeNewCampaignModal();
        });
    }

    // Wizard Navigation
    elements.btnPrevStep.addEventListener('click', prevStep);
    elements.btnNextStep.addEventListener('click', nextStep);
    elements.btnCreateCampaign.addEventListener('click', createCampaign);

    // Mode Selection UI
    elements.modeOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            // Unselect others strictly within the same group
            const group = e.currentTarget.closest('.mode-selector');
            if (group) {
                group.querySelectorAll('.mode-option').forEach(o => o.classList.remove('selected'));
                e.currentTarget.classList.add('selected');

                // If this is campaign type selector, update state and UI
                const input = e.currentTarget.querySelector('input[name="campaignType"]');
                if (input) {
                    input.checked = true; // Ensure radio is checked
                    setCampaignType(input.value);
                } else {
                    // For other mode selectors (like live/background)
                    const otherInput = e.currentTarget.querySelector('input');
                    if (otherInput) otherInput.checked = true;
                }
            }
        });
    });

    // Deep Crawl Toggle
    if (elements.enableDeepCrawl) {
        elements.enableDeepCrawl.addEventListener('change', (e) => {
            if (e.target.checked) {
                elements.deepCrawlOptions.classList.remove('hidden');
            } else {
                elements.deepCrawlOptions.classList.add('hidden');
            }
        });
    }

    // Add Custom Field Button (for Custom Websites)
    const btnAddCustomField = document.getElementById('btnAddCustomField');
    if (btnAddCustomField) {
        btnAddCustomField.addEventListener('click', addCustomField);
    }

    // File Upload (Domains)
    elements.uploadZone.addEventListener('click', () => elements.domainsFile.click());
    elements.uploadZone.addEventListener('dragover', handleDragOver);
    elements.uploadZone.addEventListener('dragleave', handleDragLeave);

    // Delete Campaign Listener (Dynamic Check)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btnDeleteCampaign')) {
            deleteCampaign();
        }
    });
    elements.uploadZone.addEventListener('drop', handleDrop);
    elements.domainsFile.addEventListener('change', handleFileSelect);
    elements.btnRemoveFile.addEventListener('click', removeFile);

    // File Upload (Keywords)
    if (elements.keywordsUploadZone) {
        elements.keywordsUploadZone.addEventListener('click', () => elements.keywordsFile.click());
        elements.keywordsFile.addEventListener('change', handleKeywordsFileSelect);
    }

    // Campaign Details
    elements.btnBackToCampaigns.addEventListener('click', () => navigateToPage('campaigns'));
    elements.btnStartCampaign.addEventListener('click', startCampaign);
    elements.btnPauseCampaign.addEventListener('click', pauseCampaign);
    if (elements.btnVerifyEmails) {
        elements.btnVerifyEmails.addEventListener('click', verifyEmails);
    }
    elements.btnExportResults.addEventListener('click', () => elements.modalExport.classList.add('active'));

    // Settings
    if (elements.btnSaveSettings) {
        elements.btnSaveSettings.addEventListener('click', saveSettings);
    }

    // Export Modal
    elements.btnCloseExportModal.addEventListener('click', () => elements.modalExport.classList.remove('active'));
    elements.exportOptions.forEach(option => {
        option.addEventListener('click', () => exportResults(option.dataset.format));
    });

    // Result Tabs
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterResults(btn.dataset.tab);
        });
    });
}

// ===================================
// Wizard Logic
// ===================================

function setCampaignType(type) {
    state.campaignType = type;

    // Get all input views and config views
    const views = {
        domain: { upload: elements.domainUploadView, config: elements.domainConfigView },
        maps: { upload: elements.mapsKeywordsView, config: elements.mapsConfigView }
    };

    // Hide all known upload and config views first to ensure clean state
    if (elements.domainUploadView) elements.domainUploadView.classList.add('hidden');
    if (elements.domainConfigView) elements.domainConfigView.classList.add('hidden');
    if (elements.mapsKeywordsView) elements.mapsKeywordsView.classList.add('hidden');
    if (elements.mapsConfigView) elements.mapsConfigView.classList.add('hidden');

    // Show the view for selected type
    if (views[type]) {
        if (views[type].upload) views[type].upload.classList.remove('hidden');
        if (views[type].config) views[type].config.classList.remove('hidden');
    }
}



function openNewCampaignModal() {
    elements.modalNewCampaign.classList.add('active');
    resetWizard();
}

function closeNewCampaignModal() {
    elements.modalNewCampaign.classList.remove('active');
    resetWizard();
}

function resetWizard() {
    state.currentStep = 1;
    state.uploadedFile = null;
    state.itemsCount = 0;
    state.campaignType = 'domain';

    // Reset form
    elements.formNewCampaign.reset();

    // Reset selections
    document.querySelectorAll('.mode-selector').forEach(sel => {
        sel.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('selected'));
        // Select first one by default
        const first = sel.querySelector('.mode-option');
        if (first) {
            first.classList.add('selected');
            const input = first.querySelector('input');
            if (input) input.checked = true;
        }
    });

    // Reset file upload
    elements.uploadZone.classList.remove('hidden');
    elements.uploadedFile.classList.add('hidden');
    if (elements.keywordsInput) elements.keywordsInput.value = '';

    // Reset default views
    setCampaignType('domain');

    // Reset wizard steps
    updateWizardUI();
}

function nextStep() {
    // Validation
    if (state.currentStep === 1) {
        const name = document.getElementById('campaignName').value;
        if (!name.trim()) {
            showToast('Please enter a campaign name', 'error');
            return;
        }
    }

    if (state.currentStep === 2) {
        if (state.campaignType === 'domain') {
            if (!state.uploadedFile) {
                showToast('Please upload a domain list file', 'error');
                return;
            }
        } else if (state.campaignType === 'maps') {
            // Maps: Check keywords input or file
            const keywordsText = elements.keywordsInput?.value?.trim() || '';
            if (!keywordsText && !state.uploadedFile) {
                showToast('Please enter keywords or upload a file', 'error');
                return;
            }
            if (keywordsText) {
                state.itemsCount = keywordsText.split(/\r?\n/).filter(k => k.trim()).length;
            }
        } else {
            // Fallback
            showToast('Invalid campaign type', 'error');
            return;
        }
    }

    if (state.currentStep === 4) {
        return; // Last step, should use create button
    }

    if (state.currentStep === 3) {
        updateReview();
    }

    state.currentStep++;
    updateWizardUI();
}

function prevStep() {
    if (state.currentStep > 1) {
        state.currentStep--;
        updateWizardUI();
    }
}

function updateWizardUI() {
    // Update steps
    elements.wizardSteps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 === state.currentStep) {
            step.classList.add('active');
        } else if (index + 1 < state.currentStep) {
            step.classList.add('completed');
        }
    });

    // Update content
    elements.wizardContents.forEach((content, index) => {
        content.classList.remove('active');
        if (index + 1 === state.currentStep) {
            content.classList.add('active');
        }
    });

    // Update buttons
    elements.btnPrevStep.disabled = state.currentStep === 1;

    if (state.currentStep === 4) {
        elements.btnNextStep.classList.add('hidden');
        elements.btnCreateCampaign.classList.remove('hidden');
    } else {
        elements.btnNextStep.classList.remove('hidden');
        elements.btnCreateCampaign.classList.add('hidden');
    }
}

// ===================================
// Mobile Sidebar Logic
// ===================================

function initMobileMenu() {
    const toggleBtn = document.getElementById('mobileMenuToggle');
    const overlay = document.getElementById('mobileMenuOverlay');
    const iconMenu = toggleBtn?.querySelector('.icon-menu');
    const iconClose = toggleBtn?.querySelector('.icon-close');
    const closeBtn = document.getElementById('mobileMenuClose'); // New dedicated close button

    // Desktop nav is handled by initEventListeners
    // We need to add listeners for mobile nav items specifically here or in initEventListeners
    // Let's add them here for specific mobile behavior (closing menu)
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');

    if (!toggleBtn || !overlay) {
        console.warn('Mobile menu elements not found');
        return;
    }

    function toggleMenu() {
        const isOpening = !overlay.classList.contains('active');
        overlay.classList.toggle('active', isOpening);
        document.body.style.overflow = isOpening ? 'hidden' : ''; // Prevent background scrolling

        if (iconMenu && iconClose) {
            iconMenu.classList.toggle('hidden', isOpening);
            iconClose.classList.toggle('hidden', !isOpening);
        }
    }

    function closeMenu() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';

        if (iconMenu && iconClose) {
            iconMenu.classList.remove('hidden');
            iconClose.classList.add('hidden');
        }
    }

    toggleBtn.addEventListener('click', toggleMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    // Close menu when clicking a nav item and navigate
    mobileNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateToPage(page); // Use existing navigation
            closeMenu();
        });
    });

    // Handle "New Campaign" button in mobile menu
    const btnNew = overlay.querySelector('.btn-new-campaign');
    if (btnNew) {
        btnNew.addEventListener('click', () => {
            closeMenu();
            openNewCampaignModal();
        });
    }
}

function updateReview() {
    document.getElementById('reviewName').textContent = document.getElementById('campaignName').value;

    // Get type display name
    const typeNames = {
        'domain': 'Domain Extraction',
        'maps': 'Google Maps'
    };
    document.getElementById('reviewType').textContent = typeNames[state.campaignType] || state.campaignType;
    document.getElementById('reviewMode').textContent = document.querySelector('input[name="mode"]:checked').value === 'live' ? 'Live Mode' : 'Background';

    // Get source label based on type
    const sourceLabels = {
        'domain': 'Domains:',
        'maps': 'Keywords:'
    };
    document.getElementById('reviewSourceLabel').textContent = sourceLabels[state.campaignType] || 'Items:';
    document.getElementById('reviewSourceCount').textContent = state.itemsCount;

    // Build filter tags
    const filters = [];
    let settings = "";

    if (state.campaignType === 'domain') {
        if (document.getElementById('filterEmails')?.checked) filters.push('Emails');
        if (document.getElementById('filterPhones')?.checked) filters.push('Phones');
        if (document.getElementById('filterTechnology')?.checked) filters.push('Technology');
        if (document.getElementById('filterSocial')?.checked) filters.push('Social Links');
        if (document.getElementById('filterMetadata')?.checked) filters.push('Metadata');
        if (document.getElementById('filterMedia')?.checked) filters.push('Media');

        const deepCrawl = document.getElementById('enableDeepCrawl')?.checked;
        settings = `Max Pages: ${document.getElementById('maxPages')?.value || 5}, Deep Crawl: ${deepCrawl ? 'Yes' : 'No'}`;
    } else if (state.campaignType === 'maps') {
        filters.push('Business Info');
        if (document.getElementById('getBusinessDetails')?.checked) filters.push('Detailed Info (Phone/Web)');

        let maxRes = document.getElementById('mapsMaxResults')?.value;
        if (maxRes === '-1') {
            settings = 'Max Results: Unlimited (all pages)';
        } else if (maxRes === 'custom') {
            settings = `Max Results: ${document.getElementById('mapsCustomResults')?.value || 20} (custom)`;
        } else {
            settings = `Max Results: ${maxRes || 20}`;
        }
    } else {
        filters.push('Default Configuration');
        settings = 'Standard Settings';
    }

    document.getElementById('reviewFilters').innerHTML = filters.map(f => `<span class="review-tag">${f}</span>`).join('');
    document.getElementById('reviewSettings').textContent = settings;
}

// ===================================
// API Functions
// ===================================

async function loadCampaigns() {
    try {
        const response = await fetch('/api/campaigns');
        state.campaigns = await response.json();
        updateDashboard();
        renderCampaignLists();
    } catch (error) {
        console.error('Failed to load campaigns:', error);
        showToast('Failed to load campaigns', 'error');
    }
}

async function createCampaign() {
    const formData = new FormData();
    const mode = document.querySelector('input[name="mode"]:checked').value;

    formData.append('name', document.getElementById('campaignName').value || `Campaign ${new Date().toLocaleDateString()}`);
    formData.append('mode', mode);
    formData.append('campaignType', state.campaignType);
    formData.append('options', JSON.stringify(getExtractionOptions()));

    // Get input data based on campaign type
    let inputData = [];

    switch (state.campaignType) {
        case 'domain':
            if (state.uploadedFile) {
                formData.append('domainsFile', state.uploadedFile);
            }
            break;

        case 'maps':
            if (state.uploadedFile) {
                formData.append('domainsFile', state.uploadedFile);
            } else {
                const keywordsText = document.getElementById('keywordsInput')?.value || '';

                inputData = keywordsText.split(/\r?\n/).filter(k => k.trim());
                formData.append('keywords', JSON.stringify(inputData));
            }
            break;

        case 'social':
            const socialText = document.getElementById('socialLinksInput')?.value || '';
            inputData = socialText.split(/\r?\n/).filter(k => k.trim());
            formData.append('keywords', JSON.stringify(inputData));
            break;

        case 'reviews':
            const reviewsText = document.getElementById('reviewsLinksInput')?.value || '';
            inputData = reviewsText.split(/\r?\n/).filter(k => k.trim());
            formData.append('keywords', JSON.stringify(inputData));
            break;

        case 'ecommerce':
            const ecommerceText = document.getElementById('ecommerceLinksInput')?.value || '';
            inputData = ecommerceText.split(/\r?\n/).filter(k => k.trim());
            formData.append('keywords', JSON.stringify(inputData));
            break;

        case 'custom-website':
            const customText = document.getElementById('customWebsiteUrlsInput')?.value || '';
            inputData = customText.split(/\r?\n/).filter(k => k.trim());
            formData.append('keywords', JSON.stringify(inputData));
            break;

        default:
            // Fallback: try keywordsInput
            const defaultText = document.getElementById('keywordsInput')?.value || '';
            inputData = defaultText.split(/\r?\n/).filter(k => k.trim());
            formData.append('keywords', JSON.stringify(inputData));
    }

    try {
        const response = await fetch('/api/campaigns', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            showToast('Campaign created successfully!', 'success');
            closeNewCampaignModal();
            loadCampaigns();

            // Open campaign details
            setTimeout(() => {
                openCampaignDetails(result.campaign.id);
            }, 500);
        } else {
            showToast(result.error || 'Failed to create campaign', 'error');
        }
    } catch (error) {
        console.error('Failed to create campaign:', error);
        showToast('Failed to create campaign', 'error');
    }
}

async function startCampaign() {
    if (!state.currentCampaign) return;

    // Different endpoint for maps vs domain
    const endpoint = state.currentCampaign.campaign_type === 'maps'
        ? `/api/maps/start/${state.currentCampaign.id}`
        : `/api/extraction/start/${state.currentCampaign.id}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            showToast('Extraction started', 'success');
            subscribeTocamp(state.currentCampaign.id);
            elements.btnStartCampaign.classList.add('hidden');
            elements.btnPauseCampaign.classList.remove('hidden');
            loadCampaignDetails(state.currentCampaign.id);
        } else {
            showToast(result.error || 'Failed to start extraction', 'error');
        }
    } catch (error) {
        console.error('Failed to start extraction:', error);
        showToast('Failed to start extraction', 'error');
    }
}

async function pauseCampaign() {
    if (!state.currentCampaign) return;

    // Different endpoint for maps vs domain
    const endpoint = state.currentCampaign.campaign_type === 'maps'
        ? `/api/maps/pause/${state.currentCampaign.id}`
        : `/api/extraction/pause/${state.currentCampaign.id}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            showToast('Campaign paused', 'info');
            elements.btnStartCampaign.classList.remove('hidden');
            elements.btnPauseCampaign.classList.add('hidden');
            loadCampaignDetails(state.currentCampaign.id);
        }
    } catch (error) {
        console.error('Failed to pause campaign:', error);
    }
}

// ... (previous functions remain mostly the same, updated loadCampaignDetails below)

// Open campaign details page
function openCampaignDetails(campaignId) {
    navigateToPage('campaignDetails');
    loadCampaignDetails(campaignId);
}

async function loadCampaignDetails(campaignId) {
    try {
        const [campaignRes, resultsRes, verificationRes] = await Promise.all([
            fetch(`/api/campaigns/${campaignId}`),
            fetch(`/api/campaigns/${campaignId}/results`),
            fetch(`/api/verification/campaign/${campaignId}/status`) // Fetch verification status
        ]);

        const campaign = await campaignRes.json();
        const results = await resultsRes.json();
        const verification = await verificationRes.json();
        const statusMap = verification.statusMap || {};

        state.currentCampaign = campaign;

        // Enrich results with verification status
        results.forEach(r => {
            if (r.emails) {
                r.emails.forEach(e => {
                    if (statusMap[e.value]) {
                        e.verification = statusMap[e.value];
                    }
                });
            }
        });

        // Update UI
        elements.campaignDetailName.textContent = campaign.name;
        elements.campaignDetailStatus.textContent = campaign.status;
        elements.campaignDetailStatus.className = `value status status-${campaign.status}`;

        const total = campaign.total_domains || 0;
        const processed = campaign.processed_domains || 0;
        elements.campaignDetailProgress.textContent = `${processed} / ${total}`;

        // Initialize Found Counter
        const foundCountEl = document.getElementById('campaignDetailFound');
        if (foundCountEl) {
            foundCountEl.textContent = results.length || 0;
        }

        const progress = total > 0 ? (processed / total) * 100 : 0;
        elements.campaignProgressBar.style.width = `${progress}%`;

        // Show/hide buttons based on status
        if (campaign.status === 'running') {
            elements.btnStartCampaign.classList.add('hidden');
            elements.btnPauseCampaign.classList.remove('hidden');
        } else if (campaign.status === 'completed') {
            elements.btnStartCampaign.classList.add('hidden');
            elements.btnPauseCampaign.classList.add('hidden');
        } else {
            elements.btnStartCampaign.classList.remove('hidden');
            elements.btnPauseCampaign.classList.add('hidden');
        }

        // Render results table based on type
        renderResultsTable(results, campaign.campaign_type);

        // Subscribe to updates
        subscribeTocamp(campaignId);

        // Start polling for status updates
        if (state.campaignPollTimer) clearTimeout(state.campaignPollTimer);
        if (campaign.status === 'running') {
            state.campaignPollTimer = setTimeout(() => refreshCampaignStatus(campaignId), 3000);
        }

    } catch (error) {
        console.error('Failed to load campaign details:', error);
        showToast('Failed to load campaign details', 'error');
    }
}

// Poll for campaign status updates
async function refreshCampaignStatus(campaignId) {
    if (!state.currentCampaign || state.currentCampaign.id !== campaignId) return;

    // Only poll if valid and visible
    if (document.getElementById('pageCampaignDetails').classList.contains('hidden')) {
        if (state.campaignPollTimer) clearTimeout(state.campaignPollTimer);
        return;
    }

    try {
        const response = await fetch(`/api/campaigns/${campaignId}`);
        const campaign = await response.json();

        if (campaign) {
            // Update Status
            if (elements.campaignDetailStatus) {
                elements.campaignDetailStatus.textContent = campaign.status;
                elements.campaignDetailStatus.className = `value status status-${campaign.status}`;
            }

            // Update Progress
            const total = campaign.total_domains || 0;
            const processed = campaign.processed_domains || 0;
            if (elements.campaignDetailProgress) {
                elements.campaignDetailProgress.textContent = `${processed} / ${total}`;
            }

            // Update Bar
            const progress = total > 0 ? (processed / total) * 100 : 0;
            if (elements.campaignProgressBar) {
                elements.campaignProgressBar.style.width = `${progress}%`;
            }

            // Update buttons
            if (campaign.status === 'running') {
                elements.btnStartCampaign.classList.add('hidden');
                elements.btnPauseCampaign.classList.remove('hidden');
            } else {
                elements.btnStartCampaign.classList.remove('hidden');
                elements.btnPauseCampaign.classList.add('hidden');
            }

            // Continue polling if running
            if (campaign.status === 'running') {
                state.campaignPollTimer = setTimeout(() => refreshCampaignStatus(campaignId), 3000);
            }
        }
    } catch (e) {
        console.error('Status poll error:', e);
    }
}

// navigateToPage is defined at line 271 - removed duplicate

async function verifyEmails() {
    if (!state.currentCampaign) return;

    try {
        const response = await fetch(`/api/verification/campaign/${state.currentCampaign.id}`, {
            method: 'POST'
        });
        const result = await response.json();

        if (result.success) {
            showToast(`Verification started for ${result.count} emails`, 'success');
            // Poll for updates every 5 seconds
            const interval = setInterval(async () => {
                if (window.location.hash !== '#pageCampaignDetails') {
                    clearInterval(interval);
                    return;
                }
                loadCampaignDetails(state.currentCampaign.id);
            }, 5000);
        } else {
            showToast(result.message || 'Verification failed to start', 'info');
        }
    } catch (error) {
        showToast('Error starting verification: ' + error.message, 'error');
    }
}

function exportResults(format) {
    if (!state.currentCampaign) return;

    const endpoint = state.currentCampaign.campaign_type === 'maps'
        ? `/api/maps/export/${state.currentCampaign.id}/${format}`
        : `/api/extraction/export/${state.currentCampaign.id}/${format}`;

    const url = endpoint;
    window.open(url, '_blank');
    elements.modalExport.classList.remove('active');
    showToast(`Exporting as ${format.toUpperCase()}...`, 'info');
}

async function deleteCampaign() {
    if (!state.currentCampaign) return;

    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone and will delete all extracted data.')) {
        return;
    }

    try {
        const response = await fetch(`/api/campaigns/${state.currentCampaign.id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Campaign deleted successfully', 'success');
            navigateToPage('campaigns');
            loadCampaigns(); // Refresh list
        } else {
            const data = await response.json();
            showToast('Failed to delete campaign: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        showToast('Error deleting campaign: ' + e.message, 'error');
    }
}

// ===================================
// Live Results Table Rendering
// ===================================

function renderLiveResultsTable() {
    const container = document.getElementById('liveResultsContainer') || elements.resultsTableBody;
    if (!container) return;

    if (!state.liveResults || state.liveResults.length === 0) {
        container.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Waiting for results...</td></tr>';
        return;
    }

    // Render live results as table rows
    container.innerHTML = state.liveResults.map((result, idx) => {
        // Handle both map_business and generic_result types
        if (result.type === 'map_business' || result.keyword) {
            // Extract additional data from result
            const emails = result.emails || (result.email ? [result.email] : []);
            const phones = result.phones || (result.phone ? [result.phone] : []);
            const prices = result.prices || [];
            const ratings = result.ratings || [];
            const social = result.social || {};
            const extractedContent = result.extractedContent || {};

            // Build social links display
            const socialLinks = Object.entries(social)
                .map(([platform, urls]) => `<span style="color: #8b5cf6;">${platform}: ${Array.isArray(urls) ? urls.length : 1}</span>`)
                .join(', ') || '-';

            // Build extracted content display
            let contentHtml = '';
            if (extractedContent.productTitle) contentHtml += `<div style="color:#22c55e; font-weight:500;">📦 ${extractedContent.productTitle}</div>`;
            if (extractedContent.posts?.length) contentHtml += `<div style="color:#3b82f6;">📱 ${extractedContent.posts.length} posts</div>`;
            if (extractedContent.reviewTexts?.length) contentHtml += `<div style="color:#f59e0b;">⭐ ${extractedContent.reviewTexts.length} reviews</div>`;

            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px;">
                        <strong>${result.name || 'Unknown'}</strong>
                        <div style="font-size: 0.8em; color: var(--text-muted);">${result.website || '-'}</div>
                    </td>
                    <td style="padding: 12px;">
                        ${emails.length > 0 ? emails.slice(0, 3).map(e => `<div style="color: #22c55e;">📧 ${e}</div>`).join('') : '<span style="color: var(--text-muted);">-</span>'}
                    </td>
                    <td style="padding: 12px;">
                        ${phones.length > 0 ? phones.slice(0, 3).map(p => `<div style="color: #3b82f6;">📞 ${p}</div>`).join('') : '<span style="color: var(--text-muted);">-</span>'}
                    </td>
                    <td style="padding: 12px;">
                        ${prices.length > 0 ? prices.slice(0, 3).map(p => `<div style="color: #f59e0b;">💰 ${p}</div>`).join('') : '<span style="color: var(--text-muted);">-</span>'}
                    </td>
                    <td style="padding: 12px;">
                        ${ratings.length > 0 ? ratings.slice(0, 2).map(r => `<div style="color: #eab308;">⭐ ${r}</div>`).join('') : '<span style="color: var(--text-muted);">-</span>'}
                    </td>
                    <td style="padding: 12px;">
                        ${socialLinks}
                        ${contentHtml}
                    </td>
                </tr>
            `;
        } else if (result.type === 'generic_result') {
            // For domain extraction results
            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 12px;">${result.domain || '-'}</td>
                    <td style="padding: 12px; color: ${result.dataType === 'email' ? '#22c55e' : '#3b82f6'};">
                        ${result.dataType === 'email' ? '📧' : result.dataType === 'phone' ? '📞' : '🔗'} ${result.value}
                    </td>
                    <td colspan="4" style="padding: 12px; color: var(--text-muted);">${result.sourceUrl || '-'}</td>
                </tr>
            `;
        }
        return '';
    }).join('');
}

// ===================================
// UI Helpers
// ===================================

function getExtractionOptions() {
    if (state.campaignType === 'maps') {
        // Handle max results - could be number, -1 (unlimited), or custom
        let maxResultsValue = document.getElementById('mapsMaxResults').value;
        let maxResults;

        if (maxResultsValue === 'custom') {
            maxResults = parseInt(document.getElementById('mapsCustomResults').value) || 20;
        } else if (maxResultsValue === '-1') {
            maxResults = -1; // Unlimited
        } else {
            maxResults = parseInt(maxResultsValue);
        }

        return {
            maxResults,
            getDetails: document.getElementById('getBusinessDetails').checked,
            useUserAgentRotation: document.getElementById('mapsUARotation').checked, // Enabled by default
            security: {
                delay: parseInt(document.getElementById('mapsDelay').value)
            }
        };
    }

    // Domain options
    return {
        extractionOptions: {
            emails: {
                enabled: document.getElementById('filterEmails').checked,
                limit: document.getElementById('emailLimit').value
            },
            phones: {
                enabled: document.getElementById('filterPhones').checked,
                limit: document.getElementById('phoneLimit').value
            },
            technology: {
                enabled: document.getElementById('filterTechnology').checked
            },
            socialLinks: {
                enabled: document.getElementById('filterSocial').checked
            },
            metadata: {
                enabled: document.getElementById('filterMetadata').checked
            },
            media: {
                images: {
                    enabled: document.getElementById('filterMedia')?.checked && document.getElementById('mediaImages')?.checked,
                    limit: parseInt(document.getElementById('imageLimit')?.value || 0)
                },
                videos: {
                    enabled: document.getElementById('filterMedia')?.checked && document.getElementById('mediaVideos')?.checked,
                    limit: parseInt(document.getElementById('videoLimit')?.value || 0)
                },
                pdfs: {
                    enabled: document.getElementById('filterMedia')?.checked && document.getElementById('mediaPdfs')?.checked,
                    limit: parseInt(document.getElementById('pdfLimit')?.value || 0)
                }
            }
        },
        crawlSettings: {
            maxPages: parseInt(document.getElementById('maxPages').value),
            deepCrawl: document.getElementById('enableDeepCrawl').checked,
            useSitemap: document.getElementById('useSitemap').checked,
            respectRobotsTxt: document.getElementById('respectRobots').checked
        },
        security: {
            minDelay: parseInt(document.getElementById('requestDelay').value),
            maxDelay: parseInt(document.getElementById('requestDelay').value) + 3000
        }
    };
}

function renderResultsTable(results, type) {
    if (results.length === 0) {
        elements.resultsTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    No data extracted yet. Start the campaign to begin extraction.
                </td>
            </tr>
        `;
        return;
    }

    // Check for "Business" types (Maps, Social, Reviews, etc.)
    const isBusinessCampaign = ['maps', 'social', 'reviews', 'ecommerce', 'custom-website'].includes(type) || type !== 'domain';

    if (isBusinessCampaign) {
        // Adjust headers
        const headerRow = elements.resultsTableHead || document.querySelector('#resultsTable thead tr');
        if (headerRow) {
            headerRow.innerHTML = `
                <th>Score</th>
                <th>Business Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Rating</th>
                <th>Website</th>
                <th>Actions</th>
            `;
        }

        // Flatten grouped results: [{keyword, businesses:[]}, ...] -> [{...business, keyword}, ...]
        let flatResults = [];
        for (const group of results) {
            if (group.businesses && Array.isArray(group.businesses)) {
                // Grouped format from API
                for (const biz of group.businesses) {
                    flatResults.push({ ...biz, keyword: group.keyword });
                }
            } else {
                // Already flat (single result object)
                flatResults.push(group);
            }
        }

        if (flatResults.length === 0) {
            elements.resultsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        No businesses found. The extraction may still be running.
                    </td>
                </tr>
            `;
            return;
        }

        elements.resultsTableBody.innerHTML = flatResults.map(r => {
            const name = r.name || r.businessName || r.business_name || '-';
            const address = r.address || r.fullAddress || '-';
            const phone = r.phone || '-';
            const website = r.website || '';
            const rating = r.rating || '-';
            const reviews = r.reviewCount || r.review_count || '-';
            const category = r.category || '';
            const keyword = r.keyword || r.searchKeyword || r.search_keyword || '-';

            // Enrichment fields
            const leadScore = r.leadScore || r.lead_score || null;
            const leadGrade = r.leadGrade || r.lead_grade || null;
            const businessEmail = r.businessEmail || r.business_email || null;
            const emailVerified = r.emailVerified || r.email_verified || false;
            const whatsappLink = r.whatsappLink || r.whatsapp_link || null;
            const whatsappAvailable = r.whatsappAvailable || r.whatsapp_available || false;
            const resultId = r.id || null;

            // Score badge styling
            let scoreHtml = '<span style="color:var(--text-muted)">-</span>';
            if (leadScore !== null) {
                const scoreColor = leadScore >= 70 ? '#22c55e' : (leadScore >= 40 ? '#f59e0b' : '#ef4444');
                scoreHtml = `<span class="score-badge" style="background:${scoreColor};color:white;padding:2px 8px;border-radius:12px;font-weight:600">${leadScore}</span>`;
                if (leadGrade) {
                    scoreHtml += ` <small style="color:var(--text-muted)">${leadGrade}</small>`;
                }
            }

            // Email display
            let emailHtml = '<span style="color:var(--text-muted)">-</span>';
            if (businessEmail) {
                const verifiedIcon = emailVerified ? '✅' : '❓';
                emailHtml = `<span title="${businessEmail}">${verifiedIcon} ${escapeHtml(businessEmail.substring(0, 20))}${businessEmail.length > 20 ? '...' : ''}</span>`;
            }

            // Phone with WhatsApp
            let phoneHtml = escapeHtml(phone);
            if (phone !== '-' && whatsappLink) {
                phoneHtml += ` <a href="${whatsappLink}" target="_blank" title="Open WhatsApp" style="color:#25d366">💬</a>`;
            } else if (phone !== '-') {
                phoneHtml += ` <button onclick="enrichWhatsApp(${resultId})" title="Get WhatsApp Link" class="btn-icon" style="font-size:0.7em">📱</button>`;
            }

            return `
            <tr data-result-id="${resultId}">
                <td>${scoreHtml}</td>
                <td class="domain-cell">
                    <div style="font-weight:600">${escapeHtml(name)}</div>
                    <div style="font-size:0.75em;opacity:0.7">${escapeHtml(category)}</div>
                    <div style="font-size:0.7em;opacity:0.5">${escapeHtml(address.substring(0, 40))}${address.length > 40 ? '...' : ''}</div>
                </td>
                <td>${phoneHtml}</td>
                <td>${emailHtml}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:4px">
                        <span>★</span> <span>${rating}</span> <small>(${reviews})</small>
                    </div>
                </td>
                <td>
                    ${website ?
                    `<a href="${website}" target="_blank" class="source-link">Visit</a>`
                    : '-'}
                </td>
                <td>
                    <div style="display:flex;gap:4px">
                        ${!businessEmail && website ? `<button onclick="enrichEmail(${resultId})" class="btn-sm" title="Find Email">📧</button>` : ''}
                        ${!leadScore ? `<button onclick="enrichScore(${resultId})" class="btn-sm" title="Calculate Score">📊</button>` : ''}
                    </div>
                </td>
            </tr>
            `;
        }).join('');

    } else {
        // Domain extraction
        if (elements.resultsTableHead) {
            elements.resultsTableHead.innerHTML = `
                <th>Domain</th>
                <th>Emails</th>
                <th>Phones</th>
                <th>Technology</th>
                <th>Social Links</th>
                <th>Title</th>
            `;
        }

        // Check if we have emails to verify
        const hasEmails = results.some(r => r.emails && r.emails.length > 0);
        if (hasEmails && elements.btnVerifyEmails) {
            elements.btnVerifyEmails.classList.remove('hidden');
        }

        elements.resultsTableBody.innerHTML = results.map(r => `
            <tr>
                <td class="domain-cell">${escapeHtml(r.domain)}</td>
                <td>
                    <div class="data-list">
                        ${(r.emails || []).slice(0, 3).map(e => {
            let statusIcon = '';
            // Check if verification status is available in the email object or a separate map
            // We will update the email objects in loadCampaignDetails to include verification status
            if (e.verification) {
                if (e.verification === 'valid') statusIcon = '<span title="Valid" style="color:green">✅</span>';
                else if (e.verification === 'invalid') statusIcon = '<span title="Invalid" style="color:red">❌</span>';
                else if (e.verification === 'disposable') statusIcon = '<span title="Disposable" style="color:orange">🗑️</span>';
                else if (e.verification === 'catch-all') statusIcon = '<span title="Catch-All" style="color:orange">⚠️</span>';
                else statusIcon = '<span title="Unknown" style="color:gray">❓</span>';
            }

            return `
                            <div class="data-item">
                                ${statusIcon}
                                <span>${escapeHtml(e.value)}</span>
                                ${e.source ? `<a href="${e.source}" target="_blank" class="source-link" title="${e.source}">📄</a>` : ''}
                            </div>
                        `}).join('')}
                        ${(r.emails || []).length > 3 ? `<small>+${r.emails.length - 3} more</small>` : ''}
                    </div>
                </td>
                <td>
                    <div class="data-list">
                        ${(r.phones || []).slice(0, 2).map(p => `
                            <div class="data-item">
                                <span>${escapeHtml(p.value)}</span>
                            </div>
                        `).join('')}
                    </div>
                </td>
                <td>
                    ${(r.technology || []).slice(0, 3).map(t => `<span class="tech-badge">${escapeHtml(t.name)}</span>`).join(' ')}
                </td>
                <td>
                    ${(r.socialLinks || []).slice(0, 3).map(s => `
                        <a href="${s.url}" target="_blank" title="${s.platform}">${getSocialIcon(s.platform)}</a>
            `).join(' ')}
                </td>
                <td><small>${escapeHtml((r.metadata || {}).title || '-')}</small></td>
            </tr>
        `).join('');
    }
}

// Render live results table during campaign execution
function renderLiveResultsTable() {
    if (!state.liveResults || state.liveResults.length === 0) return;

    // Check type of first result to determine table structure
    const firstResult = state.liveResults[0];

    if (firstResult.type === 'map_business' || firstResult.name) {
        // === GOOGLE MAPS RESULTS ===
        if (elements.resultsTableHead) {
            elements.resultsTableHead.innerHTML = `
                <th>Status</th>
                <th>Business Name</th>
                <th>Phone</th>
                <th>Rating</th>
                <th>Website</th>
            `;
        }

        elements.resultsTableBody.innerHTML = state.liveResults.map(r => {
            const name = r.name || '-';
            const address = r.address || r.fullAddress || '';
            const phone = r.phone || (r.partial ? '⏳ Loading...' : '-');
            const website = r.website || '';
            const rating = r.rating || '-';
            const reviews = r.reviewCount || '-';
            const category = r.category || '';
            const isPartial = r.partial;
            const statusIcon = isPartial ? '⏳' : '✅';
            const rowClass = isPartial ? 'style="opacity:0.7"' : '';

            return `
            <tr ${rowClass}>
                <td>${statusIcon}</td>
                <td class="domain-cell">
                    <div style="font-weight:600">${escapeHtml(name)}</div>
                    <div style="font-size:0.75em;opacity:0.7">${escapeHtml(category)}</div>
                    <div style="font-size:0.7em;opacity:0.5">${escapeHtml(address.substring(0, 40))}${address.length > 40 ? '...' : ''}</div>
                </td>
                <td>${escapeHtml(phone)}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:4px">
                        <span>★</span> <span>${rating}</span> <small>(${reviews})</small>
                    </div>
                </td>
                <td>
                    ${website ?
                    `<a href="${website}" target="_blank" class="source-link">Visit</a>`
                    : (isPartial ? '⏳' : '-')}
                </td>
            </tr>
            `;
        }).join('');

    } else {
        // === GENERIC / DOMAIN / SOCIAL RESULTS ===
        if (elements.resultsTableHead) {
            elements.resultsTableHead.innerHTML = `
                <th>Found</th>
                <th>Domain/Details</th>
                <th>Type</th>
                <th>Value</th>
                <th>Source</th>
            `;
        }

        // Reverse to show newest first
        const displayResults = [...state.liveResults].reverse();

        elements.resultsTableBody.innerHTML = displayResults.map(r => {
            let icon = '📄';
            let color = 'gray';

            if (r.dataType === 'email') { icon = '📧'; color = 'blue'; }
            else if (r.dataType === 'phone') { icon = '📞'; color = 'green'; }
            else if (r.dataType === 'social') { icon = '🔗'; color = 'purple'; }
            else if (r.dataType === 'technology') { icon = '🔧'; color = 'orange'; }
            else if (r.dataType === 'title') { icon = 'T'; color = 'black'; }

            return `
            <tr>
                <td>Just now</td>
                <td class="domain-cell">
                    <div style="font-weight:600">${escapeHtml(r.domain || '-')}</div>
                </td>
                <td><span class="score-badge" style="background:${color === 'blue' ? '#eff6ff' : '#f3f4f6'}; color:${color}; border:1px solid ${color}">${r.dataType || 'Info'}</span></td>
                <td style="word-break:break-all; font-family:monospace; font-size:0.9em;">${escapeHtml(r.value || '-')}</td>
                <td>
                    ${r.sourceUrl ?
                    `<a href="${r.sourceUrl}" target="_blank" class="source-link">View</a>`
                    : '-'}
                </td>
            </tr>
            `;
        }).join('');
    }
}

// ... Utilities ...

function handleDragOver(e) {
    e.preventDefault();
    elements.uploadZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) processFile(files[0]);
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) processFile(files[0]);
}

function handleKeywordsFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        state.uploadedFile = files[0]; // Logic handles itemsCount later or we can do it here
        // Simple preview
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target.result;
            const lines = content.split(/\r?\n/).filter(x => x.trim());
            state.itemsCount = lines.length;
            elements.keywordsInput.value = content; // Pre-fill textarea
        };
        reader.readAsText(files[0]);
    }
}

function processFile(file) {
    if (!file.name.endsWith('.txt')) {
        showToast('Please upload a .txt file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const domains = content.split(/[\r\n]+/).filter(d => d.trim().length > 0);

        state.uploadedFile = file;
        state.itemsCount = domains.length;

        elements.fileName.textContent = file.name;
        elements.domainCount.textContent = `${domains.length} domains found`;

        elements.uploadZone.classList.add('hidden');
        elements.uploadedFile.classList.remove('hidden');
    };
    reader.readAsText(file);
}

function removeFile() {
    state.uploadedFile = null;
    state.itemsCount = 0;
    elements.domainsFile.value = '';
    elements.uploadZone.classList.remove('hidden');
    elements.uploadedFile.classList.add('hidden');
}

// Navigation helpers - navigateToPage is defined at line 271, removed duplicate here

// Dashboard helpers
function updateDashboard() {
    const totalCampaigns = state.campaigns.length;
    const totalDomains = state.campaigns.reduce((sum, c) => sum + (c.processed_domains || 0), 0);
    const activeCampaigns = state.campaigns.filter(c => c.status === 'running').length;

    elements.statTotalCampaigns.textContent = totalCampaigns;
    elements.statTotalDomains.textContent = totalDomains;
    elements.statActiveCampaigns.textContent = activeCampaigns;
}

function renderCampaignLists() {
    const recentCampaigns = state.campaigns.slice(0, 5);

    const emptyHtml = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <p>No campaigns yet</p>
            <span>Create your first campaign to get started</span>
        </div>
    `;

    elements.recentCampaigns.innerHTML = recentCampaigns.length ? recentCampaigns.map(c => createCampaignCard(c)).join('') : emptyHtml;
    elements.allCampaigns.innerHTML = state.campaigns.length ? state.campaigns.map(c => createCampaignCard(c)).join('') : emptyHtml;

    document.querySelectorAll('.campaign-card').forEach(card => {
        card.addEventListener('click', () => {
            openCampaignDetails(card.dataset.id);
        });
    });
}

function createCampaignCard(campaign) {
    const date = new Date(campaign.created_at).toLocaleDateString();
    const progress = campaign.total_domains > 0
        ? Math.round((campaign.processed_domains / campaign.total_domains) * 100)
        : 0;

    const typeLabel = campaign.campaign_type === 'maps' ? '📍 Maps' : '🌐 Domain';

    return `
        <div class="campaign-card" data-id="${campaign.id}">
            <div class="campaign-info">
                <h3>${escapeHtml(campaign.name)}</h3>
                <div class="meta">
                    <span class="badge-type">${typeLabel}</span>
                    <span>${campaign.total_domains} items</span>
                    <span>${date}</span>
                    <span>${progress}% complete</span>
                </div>
            </div>
            <div class="campaign-status">
                <span class="status-badge ${campaign.status}">${campaign.status}</span>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getSocialIcon(platform) {
    // Simplified icons
    return '🔗';
}

function addLogEntry(message, type = '') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    elements.progressLog.appendChild(entry);
    elements.progressLog.scrollTop = elements.progressLog.scrollHeight;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<polyline points="20 6 9 17 4 12"/>',
        error: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
        info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
    };

    toast.innerHTML = `
        <div class="toast-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${icons[type] || icons.info}
            </svg>
        </div>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;

    elements.toastContainer.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });

    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 5000);
}

// ===================================
// Proxy Management
// ===================================

async function loadProxies() {
    try {
        const response = await fetch('/api/proxies');
        const proxies = await response.json();
        renderProxies(proxies);
        updateProxyStats(proxies);
    } catch (error) {
        showToast('Failed to load proxies: ' + error.message, 'error');
    }
}

function renderProxies(proxies) {
    const tbody = document.getElementById('proxiesTableBody');
    if (!tbody) return;

    tbody.innerHTML = proxies.map(p => `
        <tr>
            <td><span class="status-badge ${p.status}">${p.status}</span></td>
            <td>${p.protocol}</td>
            <td>${p.host}:${p.port}</td>
            <td>${p.username || '-'}</td>
            <td>${p.last_checked ? new Date(p.last_checked).toLocaleString() : 'Never'}</td>
            <td>
                <button class="btn-sm btn-action" onclick="testProxy(${p.id})">Test</button>
                <button class="btn-sm btn-danger" onclick="deleteProxy(${p.id})">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="text-center">No proxies added</td></tr>';
}

function updateProxyStats(proxies) {
    const elTotal = document.getElementById('statTotalProxies');
    if (elTotal) elTotal.textContent = proxies.length;

    const elActive = document.getElementById('statActiveProxies');
    if (elActive) elActive.textContent = proxies.filter(p => p.status === 'active').length;

    const elDead = document.getElementById('statDeadProxies');
    if (elDead) elDead.textContent = proxies.filter(p => p.status === 'dead').length;
}

async function saveProxies() {
    const proxiesString = document.getElementById('proxyInput').value;
    try {
        const response = await fetch('/api/proxies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proxiesString })
        });

        const data = await response.json();
        if (data.success) {
            showToast(`Added ${data.count} proxies`, 'success');
            document.getElementById('modalAddProxy').classList.remove('active');
            document.getElementById('proxyInput').value = '';
            loadProxies();
        } else {
            showToast(data.error || 'Failed to add proxies', 'error');
        }
    } catch (error) {
        showToast('Error saving proxies: ' + error.message, 'error');
    }
}

async function deleteProxy(id) {
    if (!confirm('Delete this proxy?')) return;
    try {
        await fetch(`/api/proxies/${id}`, { method: 'DELETE' });
        loadProxies();
        showToast('Proxy deleted', 'success');
    } catch (error) {
        showToast('Failed to delete proxy', 'error');
    }
}

async function testProxy(id) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/proxies/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const result = await response.json();

        if (result.success) {
            showToast(`Success! Latency: ${result.latency}ms`, 'success');
            loadProxies(); // Refresh status
        } else {
            showToast(`Failed: ${result.error}`, 'error');
            loadProxies(); // Refresh status
        }
    } catch (error) {
        showToast('Test failed: ' + error.message, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Global scope for onclick handlers
window.deleteProxy = deleteProxy;
window.testProxy = testProxy;

// Additional Event Listeners for Proxies
// Note: DOMContentLoaded listener at top handles initial load
// Here we add dynamic listeners if any, or rely on element IDs existing
document.addEventListener('DOMContentLoaded', () => {
    // Proxy Modal Buttons
    const btnAddProxy = document.getElementById('btnAddProxy');
    if (btnAddProxy) {
        btnAddProxy.addEventListener('click', () => {
            document.getElementById('modalAddProxy').classList.add('active');
        });
    }

    const btnCloseProxyModal = document.getElementById('btnCloseProxyModal');
    if (btnCloseProxyModal) {
        btnCloseProxyModal.addEventListener('click', () => {
            document.getElementById('modalAddProxy').classList.remove('active');
        });
    }

    const btnSaveProxies = document.getElementById('btnSaveProxies');
    if (btnSaveProxies) {
        btnSaveProxies.addEventListener('click', saveProxies);
    }

    // Schedule Event Listeners
    const btnScheduleCampaign = document.getElementById('btnScheduleCampaign');
    if (btnScheduleCampaign) {
        btnScheduleCampaign.addEventListener('click', openScheduleModal);
    }

    const btnCloseScheduleModal = document.getElementById('btnCloseScheduleModal');
    if (btnCloseScheduleModal) {
        btnCloseScheduleModal.addEventListener('click', () => {
            document.getElementById('modalSchedule').classList.remove('active');
        });
    }

    const btnSaveSchedule = document.getElementById('btnSaveSchedule');
    if (btnSaveSchedule) {
        btnSaveSchedule.addEventListener('click', saveSchedule);
    }

    const scheduleFrequency = document.getElementById('scheduleFrequency');
    if (scheduleFrequency) {
        scheduleFrequency.addEventListener('change', (e) => {
            const val = e.target.value;
            const timeGroup = document.getElementById('scheduleTimeGroup');
            const cronGroup = document.getElementById('scheduleCronGroup');

            if (val === 'custom') {
                timeGroup.classList.add('hidden');
                cronGroup.classList.remove('hidden');
            } else {
                timeGroup.classList.remove('hidden');
                cronGroup.classList.add('hidden');
            }
        });
    }
});

// ===================================
// Scheduler Logic
// ===================================

async function loadSchedules() {
    try {
        const response = await fetch('/api/schedules');
        const schedules = await response.json();
        renderSchedules(schedules);
    } catch (error) {
        showToast('Failed to load schedules: ' + error.message, 'error');
    }
}

function renderSchedules(schedules) {
    const tbody = document.getElementById('schedulesTableBody');
    if (!tbody) return;

    tbody.innerHTML = schedules.map(s => `
        <tr>
            <td>${escapeHtml(s.campaign_name)}</td>
            <td>${s.frequency_label || 'Custom'}</td>
            <td><code>${s.cron_expression}</code></td>
            <td>${s.next_run ? new Date(s.next_run).toLocaleString() : '-'}</td>
            <td>${s.last_run ? new Date(s.last_run).toLocaleString() : 'Never'}</td>
            <td><span class="status-badge ${s.status}">${s.status}</span></td>
            <td>
                <button class="btn-sm btn-action" onclick="toggleSchedule(${s.id})">
                    ${s.status === 'active' ? 'Pause' : 'Resume'}
                </button>
                <button class="btn-sm btn-danger" onclick="deleteSchedule(${s.id})">Delete</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="7" class="text-center">No active schedules</td></tr>';
}

function openScheduleModal() {
    if (!state.currentCampaign) return;
    document.getElementById('modalSchedule').classList.add('active');
}

async function saveSchedule() {
    if (!state.currentCampaign) return;

    const frequency = document.getElementById('scheduleFrequency').value;
    const time = document.getElementById('scheduleTime').value; // HH:MM
    const cronInput = document.getElementById('scheduleCron').value;
    const autoExport = document.getElementById('scheduleAutoExport').value;

    let cronExpression = '';
    let label = '';

    // Simple cron builder
    if (frequency === 'daily') {
        const [hour, minute] = time.split(':');
        cronExpression = `${minute} ${hour} * * *`;
        label = `Daily at ${time}`;
    } else if (frequency === 'weekly') {
        const [hour, minute] = time.split(':');
        // Default to Monday for simplicity, or could add day picker
        cronExpression = `${minute} ${hour} * * 1`;
        label = `Weekly (Mon) at ${time}`;
    } else {
        cronExpression = cronInput;
        label = 'Custom Cron';
    }

    try {
        const response = await fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                campaign_id: state.currentCampaign.id,
                cron_expression: cronExpression,
                frequency_label: label,
                auto_export_format: autoExport
            })
        });

        const data = await response.json();
        if (data.success) {
            showToast('Schedule created!', 'success');
            document.getElementById('modalSchedule').classList.remove('active');
        } else {
            showToast(data.error || 'Failed to create schedule', 'error');
        }
    } catch (error) {
        showToast('Error saving schedule: ' + error.message, 'error');
    }
}

async function toggleSchedule(id) {
    try {
        const response = await fetch(`/api/schedules/${id}/toggle`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            showToast(`Schedule ${data.status}`, 'success');
            loadSchedules();
        }
    } catch (error) {
        showToast('Failed to toggle schedule', 'error');
    }
}

async function deleteSchedule(id) {
    if (!confirm('Delete this schedule?')) return;
    try {
        await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
        loadSchedules();
        showToast('Schedule deleted', 'success');
    } catch (error) {
        showToast('Failed to delete schedule', 'error');
    }
}

// ===================================
// AI Enrichment Logic
// ===================================

const aiPrompts = {
    score: "Analyze the provided business data. detailed below. Assign a lead score from 0 to 10 based on completeness of data (phone, email, website) and potential value. Return ONLY the number.",
    summary: "Summarize the business services and key details in 2 sentences based on the data provided.",
    tech: "Identify any technologies, frameworks, or software mentioned in the data. Return a comma-separated list.",
    emails: "Extract any personal names associated with email addresses if present. Format as 'Name: Email'."
};

// AI features removed from UI as requested
// function initAI() { ... }
// function openAIModal() { ... }



// ===================================
// Settings Page Logic
// ===================================

function switchSettingsTab(tabName) {
    document.querySelectorAll('.settings-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));

    const tabId = `settingsTab${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
    const tabEl = document.getElementById(tabId);
    if (tabEl) {
        tabEl.classList.remove('hidden');
        // Find and activate corresponding button
        document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => {
            if (btn.textContent.toLowerCase().includes(tabName)) btn.classList.add('active');
        });
    }
}

async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();

        // Proxy
        document.getElementById('settingsProxyEnabled').checked = settings.proxy?.enabled || false;
        document.getElementById('settingsProxyRotateError').checked = settings.proxy?.rotateOnError !== false;
        document.getElementById('settingsWebshareApiKey').value = settings.proxy?.webshareApiKey || '';

        if (settings.proxy?.webshareApiKey) {
            const statusEl = document.getElementById('proxyConnectionStatus');
            if (statusEl) statusEl.textContent = '⚪ Saved (Ready)';
        }

        // SMTP
        document.getElementById('settingsSmtpEnabled').checked = settings.smtp?.enabled || false;
        document.getElementById('settingsSmtpHost').value = settings.smtp?.host || '';
        document.getElementById('settingsSmtpPort').value = settings.smtp?.port || 587;
        document.getElementById('settingsSmtpUser').value = settings.smtp?.user || '';
        // Don't load password (it's masked)

        // AI
        document.getElementById('settingsAiProvider').value = settings.ai?.provider || 'openai';
        // Don't load API key (it's masked)
        document.getElementById('settingsAiBaseUrl').value = settings.ai?.baseUrl || '';
        document.getElementById('settingsAiModel').value = settings.ai?.model || 'gpt-3.5-turbo';
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

async function saveSettings() {
    try {
        const settings = {
            proxy: {
                enabled: document.getElementById('settingsProxyEnabled').checked,
                rotateOnError: document.getElementById('settingsProxyRotateError').checked,
                webshareApiKey: document.getElementById('settingsWebshareApiKey').value
            },
            smtp: {
                enabled: document.getElementById('settingsSmtpEnabled').checked,
                host: document.getElementById('settingsSmtpHost').value,
                port: parseInt(document.getElementById('settingsSmtpPort').value),
                user: document.getElementById('settingsSmtpUser').value,
                pass: document.getElementById('settingsSmtpPass').value || '***'
            },
            ai: {
                provider: document.getElementById('settingsAiProvider').value,
                apiKey: document.getElementById('settingsAiKey').value || '...',
                baseUrl: document.getElementById('settingsAiBaseUrl').value,
                model: document.getElementById('settingsAiModel').value
            }
        };

        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        const data = await res.json();
        if (data.success) {
            showToast('Settings saved successfully!', 'success');
        } else {
            showToast('Failed to save settings', 'error');
        }
    } catch (e) {
        showToast('Error saving settings: ' + e.message, 'error');
    }
}

async function testSmtp() {
    try {
        showToast('Testing SMTP connection...', 'info');
        const res = await fetch('/api/settings/test-smtp', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('SMTP connection successful!', 'success');
        } else {
            showToast('SMTP test failed: ' + data.message, 'error');
        }
    } catch (e) {
        showToast('SMTP test error: ' + e.message, 'error');
    }
}

// Initialize Settings page listeners
document.addEventListener('DOMContentLoaded', () => {
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', saveSettings);
    }

    const btnTestSmtp = document.getElementById('btnTestSmtp');
    if (btnTestSmtp) {
        btnTestSmtp.addEventListener('click', testSmtp);
    }
});

// ===================================
// Enrichment Functions
// ===================================

// Find email for a single result
async function enrichEmail(resultId) {
    if (!resultId) return;
    try {
        showToast('Finding email...', 'info');
        const res = await fetch(`/api/enrichment/email/${resultId}`);
        const data = await res.json();
        if (data.email) {
            showToast(`Found email: ${data.email}`, 'success');
            // Reload results to show updated data
            if (state.currentCampaign) {
                loadCampaignDetails(state.currentCampaign.id);
            }
        } else {
            showToast('No email found on website', 'warning');
        }
    } catch (e) {
        showToast('Error finding email: ' + e.message, 'error');
    }
}

// Generate WhatsApp link for a single result
async function enrichWhatsApp(resultId) {
    if (!resultId) return;
    try {
        const res = await fetch(`/api/enrichment/whatsapp/${resultId}`);
        const data = await res.json();
        if (data.link) {
            window.open(data.link, '_blank');
            // Reload results to show updated data
            if (state.currentCampaign) {
                loadCampaignDetails(state.currentCampaign.id);
            }
        } else {
            showToast('Could not generate WhatsApp link', 'warning');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Calculate score for a single result
async function enrichScore(resultId) {
    if (!resultId) return;
    try {
        const res = await fetch(`/api/enrichment/score/${resultId}`);
        const data = await res.json();
        showToast(`Lead Score: ${data.score} (${data.grade})`, 'success');
        // Reload results to show updated data
        if (state.currentCampaign) {
            loadCampaignDetails(state.currentCampaign.id);
        }
    } catch (e) {
        showToast('Error calculating score: ' + e.message, 'error');
    }
}

// Bulk enrich all results in current campaign
async function enrichAllCampaign() {
    if (!state.currentCampaign) {
        showToast('No campaign selected', 'warning');
        return;
    }

    try {
        showToast('Starting full enrichment (WhatsApp + Email + Score)...', 'info');
        const res = await fetch('/api/enrichment/full', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                campaignId: state.currentCampaign.id,
                findEmail: true,
                checkWhatsApp: true,
                calculateScore: true
            })
        });
        const data = await res.json();
        showToast(`Enrichment started for ${data.totalToProcess} results. This may take a while.`, 'success');

        // Reload after a delay
        setTimeout(() => {
            loadCampaignDetails(state.currentCampaign.id);
        }, 10000);
    } catch (e) {
        showToast('Error starting enrichment: ' + e.message, 'error');
    }
}

// Bulk calculate scores for current campaign
async function bulkEnrichScore() {
    if (!state.currentCampaign) {
        showToast('No campaign selected', 'warning');
        return;
    }

    try {
        showToast('Calculating lead scores...', 'info');
        const res = await fetch('/api/enrichment/score/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId: state.currentCampaign.id })
        });
        const data = await res.json();
        showToast(`Scored ${data.processed} leads. Avg: ${data.stats.avg}`, 'success');
        // Reload results
        loadCampaignDetails(state.currentCampaign.id);
    } catch (e) {
        showToast('Error calculating scores: ' + e.message, 'error');
    }
}

// Bulk generate WhatsApp links for current campaign
async function bulkEnrichWhatsApp() {
    if (!state.currentCampaign) {
        showToast('No campaign selected', 'warning');
        return;
    }

    try {
        showToast('Generating WhatsApp links...', 'info');
        const res = await fetch('/api/enrichment/whatsapp/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignId: state.currentCampaign.id })
        });
        const data = await res.json();
        showToast(`Generated ${data.processed} WhatsApp links`, 'success');
        // Reload results
        loadCampaignDetails(state.currentCampaign.id);
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Toggle custom results input visibility
function toggleCustomResults() {
    const select = document.getElementById('mapsMaxResults');
    const customInput = document.getElementById('mapsCustomResults');
    const hint = document.getElementById('unlimitedHint');

    if (select.value === 'custom') {
        customInput.classList.remove('hidden');
        customInput.focus();
        if (hint) hint.classList.add('hidden');
    } else if (select.value === '-1') {
        customInput.classList.add('hidden');
        if (hint) hint.classList.remove('hidden');
    } else {
        customInput.classList.add('hidden');
        if (hint) hint.classList.add('hidden');
    }
}

// Toggle between Keywords and Links input mode for Google Maps campaigns
function switchMapsInputMode(mode) {
    const keywordsSection = document.getElementById('keywordsInputSection');
    const linksSection = document.getElementById('linksInputSection');
    const tabs = document.querySelectorAll('.input-mode-tabs .mode-tab');

    // Update tab styles
    tabs.forEach(tab => {
        if (tab.getAttribute('data-input-mode') === mode) {
            tab.style.background = 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))';
            tab.style.color = 'white';
            tab.style.border = 'none';
            tab.classList.add('active');
        } else {
            tab.style.background = 'var(--bg-tertiary)';
            tab.style.color = 'var(--text-secondary)';
            tab.style.border = '1px solid var(--border-color)';
            tab.classList.remove('active');
        }
    });

    // Toggle sections
    if (mode === 'keywords') {
        keywordsSection?.classList.remove('hidden');
        linksSection?.classList.add('hidden');
        state.mapsInputMode = 'keywords';
    } else {
        keywordsSection?.classList.add('hidden');
        linksSection?.classList.remove('hidden');
        state.mapsInputMode = 'links';
    }
}

// Bulk verify emails for current campaign
async function bulkVerifyEmails() {
    if (!state.currentCampaign) {
        showToast('No campaign selected', 'warning');
        return;
    }

    const results = state.currentCampaign.results || [];
    const emailResults = results.filter(r => r.email || r.emails?.length);

    if (emailResults.length === 0) {
        showToast('No emails to verify', 'warning');
        return;
    }

    showToast(`Verifying ${emailResults.length} emails...`, 'info');
    let verified = 0, failed = 0;

    for (const result of emailResults) {
        try {
            const email = result.email || result.emails?.[0];
            const response = await fetch('/api/enrichment/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, resultId: result.id })
            });
            const data = await response.json();
            if (data.valid) verified++;
            else failed++;
        } catch (e) {
            failed++;
        }
    }

    showToast(`Verified: ${verified} valid, ${failed} failed`, 'success');
    loadCampaignResults(state.currentCampaign.id);
}

// Bulk check WhatsApp availability for current campaign  
async function bulkCheckWhatsApp() {
    // Get phone numbers from the visible table rows
    const rows = document.querySelectorAll('#resultsTableBody tr[data-result-id]');
    const phoneData = [];

    rows.forEach(row => {
        const resultId = row.getAttribute('data-result-id');
        const phoneCell = row.cells[2]; // Phone is usually 3rd column (index 2)
        if (phoneCell) {
            const phoneText = phoneCell.textContent.trim();
            // Extract phone number (10+ digits)
            const phoneMatch = phoneText.match(/[0-9]{10,}/);
            if (phoneMatch) {
                phoneData.push({ id: resultId, phone: phoneMatch[0] });
            }
        }
    });

    if (phoneData.length === 0) {
        showToast('No phone numbers found in table', 'warning');
        return;
    }

    showToast(`Checking ${phoneData.length} numbers for WhatsApp...`, 'info');
    let found = 0;

    for (const item of phoneData) {
        try {
            const response = await fetch(`/api/enrichment/whatsapp/${item.id}`);
            const data = await response.json();
            if (data.available) found++;
        } catch (e) {
            // Continue
        }
    }

    showToast(`Found ${found} WhatsApp numbers`, 'success');
    if (state.currentCampaign) loadCampaignResults(state.currentCampaign.id);
}

// Bulk find missing emails
async function bulkEnrichEmail() {
    // Get rows with websites but no emails from table
    const rows = document.querySelectorAll('#resultsTableBody tr[data-result-id]');
    const toEnrich = [];

    rows.forEach(row => {
        const resultId = row.getAttribute('data-result-id');
        const emailCell = row.cells[3]; // Email is 4th column (index 3)
        const websiteCell = row.cells[5]; // Website is 6th column (index 5)

        const hasEmail = emailCell && !emailCell.textContent.includes('-');
        const websiteLink = websiteCell?.querySelector('a');

        if (!hasEmail && websiteLink) {
            toEnrich.push({ id: resultId, website: websiteLink.href });
        }
    });

    if (toEnrich.length === 0) {
        showToast('All results have emails or no websites to search', 'info');
        return;
    }

    showToast(`Finding emails for ${toEnrich.length} businesses...`, 'info');
    let found = 0;

    for (const item of toEnrich) {
        try {
            const response = await fetch(`/api/enrichment/email/${item.id}`);
            const data = await response.json();
            if (data.email) found++;
        } catch (e) {
            // Continue
        }
    }

    showToast(`Found ${found} new emails`, 'success');
    if (state.currentCampaign) loadCampaignResults(state.currentCampaign.id);
}

// Bulk calculate lead scores
async function bulkEnrichScore() {
    // Get result IDs from the visible table rows
    const rows = document.querySelectorAll('#resultsTableBody tr[data-result-id]');
    const toScore = [];

    rows.forEach(row => {
        const resultId = row.getAttribute('data-result-id');
        const scoreCell = row.cells[0]; // Score is first column
        // Check if score cell shows "-" (no score)
        if (scoreCell && scoreCell.textContent.includes('-')) {
            toScore.push(resultId);
        }
    });

    if (toScore.length === 0) {
        showToast('All visible results already have scores', 'info');
        return;
    }

    showToast(`Calculating scores for ${toScore.length} leads...`, 'info');
    let scored = 0;

    for (const resultId of toScore) {
        try {
            const response = await fetch(`/api/enrichment/score/${resultId}`);
            const data = await response.json();
            if (data.score) scored++;
        } catch (e) {
            // Continue
        }
    }

    showToast(`Scored ${scored} leads`, 'success');
    if (state.currentCampaign) loadCampaignResults(state.currentCampaign.id);
}

// Switch settings tab
function switchSettingsTab(tabId) {
    document.querySelectorAll('.settings-tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));

    const targetTab = document.getElementById('settingsTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (targetTab) targetTab.classList.remove('hidden');

    event?.target?.classList.add('active');
}

// Switch marketing tab
function switchMarketingTab(tabId) {
    document.querySelectorAll('.marketing-tab-content').forEach(tab => tab.classList.add('hidden'));
    document.querySelectorAll('.marketing-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));

    const targetTab = document.getElementById('marketingTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (targetTab) targetTab.classList.remove('hidden');

    event?.target?.classList.add('active');
}

// Marketing file upload state
const marketingState = {
    smsPhones: [],
    emailAddresses: []
};

// Initialize marketing page event handlers
document.addEventListener('DOMContentLoaded', function () {
    // SMS source change handler
    const smsSource = document.getElementById('smsRecipientSource');
    if (smsSource) {
        smsSource.addEventListener('change', function () {
            const uploadDiv = document.getElementById('smsFileUpload');
            if (this.value === 'upload') {
                uploadDiv?.classList.remove('hidden');
            } else {
                uploadDiv?.classList.add('hidden');
            }
        });
    }

    // Email source change handler
    const emailSource = document.getElementById('emailRecipientSource');
    if (emailSource) {
        emailSource.addEventListener('change', function () {
            const uploadDiv = document.getElementById('emailFileUpload');
            if (this.value === 'upload') {
                uploadDiv?.classList.remove('hidden');
            } else {
                uploadDiv?.classList.add('hidden');
            }
        });
    }

    // SMS file upload handler
    const smsFileInput = document.getElementById('smsPhoneFile');
    if (smsFileInput) {
        smsFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const content = event.target.result;
                    const lines = content.split('\n').map(l => l.trim()).filter(l => l.match(/[0-9]{10,}/));
                    marketingState.smsPhones = lines;
                    document.getElementById('smsFileInfo').textContent = `✅ Loaded ${lines.length} phone numbers from ${file.name}`;
                    document.getElementById('smsRecipientCount').textContent = `📊 ${lines.length} recipients from file`;
                };
                reader.readAsText(file);
            }
        });
    }

    // Email file upload handler
    const emailFileInput = document.getElementById('emailAddressFile');
    if (emailFileInput) {
        emailFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const content = event.target.result;
                    const lines = content.split('\n').map(l => l.trim()).filter(l => l.includes('@'));
                    marketingState.emailAddresses = lines;
                    document.getElementById('emailFileInfo').textContent = `✅ Loaded ${lines.length} email addresses from ${file.name}`;
                    document.getElementById('emailRecipientCount').textContent = `📊 ${lines.length} recipients from file`;
                };
                reader.readAsText(file);
            }
        });
    }
});

// ===================================
// WebSocket Connection for Live Data
// ===================================

function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${window.location.host}`;

    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
        console.log('WebSocket connected');
        state.wsConnected = true;

        // Subscribe to current campaign if there is one
        if (state.currentCampaign) {
            state.ws.send(JSON.stringify({
                type: 'subscribe',
                campaignId: state.currentCampaign.id
            }));
        }
    };

    state.ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting in 3s...');
        state.wsConnected = false;
        setTimeout(initWebSocket, 3000);
    };

    state.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    state.ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        } catch (e) {
            console.error('WebSocket message parse error:', e);
        }
    };
}

function handleWebSocketMessage(data) {
    console.log('WS received:', data.type);

    switch (data.type) {
        case 'connected':
            console.log('WS client ID:', data.clientId);
            break;

        case 'result':
        case 'result_found': // Handle domain extraction real-time results
            let resultData = data.business || data.result;

            // Normalize data if it's from domain extractor (result_found event)
            if (data.result && !data.business) {
                // Check if this result belongs to the currently viewed campaign
                if (state.currentCampaign && state.currentCampaign.id !== resultData.campaignId) {
                    return; // Ignore updates from other campaigns
                }

                // Construct a standardized "business" object from the partial result
                // Domain Extractor returns { dataType, value, domain, sourceUrl }
                const businessObj = {
                    domain: resultData.domain,
                    name: resultData.domain, // Use domain as name if name is missing
                    website: resultData.sourceUrl || `http://${resultData.domain}`,
                    partial: true // Flag to indicate this is a streaming result
                };

                // data.type is 'result_found', so resultData.dataType tells us what it is
                if (resultData.dataType === 'email') businessObj.email = resultData.value;
                if (resultData.dataType === 'phone') businessObj.phone = resultData.value;
                if (resultData.dataType === 'social') businessObj.social = resultData.value;
                if (resultData.dataType === 'technology') businessObj.technology = resultData.value;
                if (resultData.dataType === 'image' || resultData.dataType === 'video' || resultData.dataType === 'pdf') {
                    businessObj.media = `${resultData.dataType}: ${resultData.value?.substring(0, 20)}...`;
                }

                addLiveResultToTable(businessObj, data.keyword || 'Domain Scan');

                // Also update status text
                updateCampaignStatus(`Found ${resultData.dataType} on ${resultData.domain}`);
            } else {
                // Standard Maps Result
                addLiveResultToTable(resultData, data.keyword);
            }
            break;

        case 'log':
            // Show log message in status area AND append to log console
            // updateCampaignStatus(data.message); // Optional: keep status update if needed, but log is better

            const logConsole = document.getElementById('progressLog');
            if (logConsole) {
                const entry = document.createElement('div');
                entry.style.marginBottom = '4px';
                entry.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                entry.style.paddingBottom = '2px';

                const time = new Date().toLocaleTimeString();
                entry.innerHTML = `<span style="opacity:0.6; margin-right:8px;">[${time}]</span> ${data.message}`;

                logConsole.appendChild(entry);
                logConsole.scrollTop = logConsole.scrollHeight;
            }
            break;

        case 'keyword_complete':
            showToast(`Completed: ${data.keyword} (${data.count} found)`, 'info');
            break;

        case 'extraction_complete':
            showToast('Extraction complete!', 'success');
            if (state.currentCampaign) {
                loadCampaignResults(state.currentCampaign.id);
            }
            break;

        case 'screenshot_result':
            const cardId = `shot-card-${data.urlIndex}-${data.device}`;
            const card = document.getElementById(cardId);
            if (card) {
                const statusBadge = card.querySelector('.status-badge');
                const resultImage = card.querySelector('.result-image');
                if (data.success) {
                    statusBadge.textContent = '✅ Success';
                    statusBadge.style.background = 'rgba(34, 197, 94, 0.2)';
                    statusBadge.style.color = '#22c55e';
                    if (resultImage && data.image) {
                        resultImage.style.display = 'block';
                        resultImage.innerHTML = `<img src="${data.image}" style="width:100%; border-radius:8px; margin-top:8px;">`;
                    }
                } else {
                    statusBadge.textContent = '❌ Failed';
                    statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
                    statusBadge.style.color = '#ef4444';
                }
            }
            break;

        case 'domain_complete':
            updateCampaignStatus(`Completed: ${data.domain}`);
            const logSuccess = document.getElementById('progressLog');
            if (logSuccess) {
                const entry = document.createElement('div');
                entry.style.marginBottom = '4px';
                entry.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                entry.style.paddingBottom = '2px';
                entry.style.color = '#22c55e'; // Green

                const time = new Date().toLocaleTimeString();
                entry.innerHTML = `<span style="opacity:0.6; margin-right:8px;">[${time}]</span> ✅ Finished processing ${data.domain} (${data.resultsCount} items found)`;

                logSuccess.appendChild(entry);
                logSuccess.scrollTop = logSuccess.scrollHeight;
            }
            break;

        case 'domain_error':
            updateCampaignStatus(`Error: ${data.domain}`);
            const logError = document.getElementById('progressLog');
            if (logError) {
                const entry = document.createElement('div');
                entry.style.marginBottom = '4px';
                entry.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
                entry.style.paddingBottom = '2px';
                entry.style.color = '#ef4444'; // Red

                const time = new Date().toLocaleTimeString();
                entry.innerHTML = `<span style="opacity:0.6; margin-right:8px;">[${time}]</span> ❌ Failed processing ${data.domain}: ${data.error}`;

                logError.appendChild(entry);
                logError.scrollTop = logError.scrollHeight;
            }
            break;

        case 'progress':
            // Update progress bar for Bulk Screenshots
            if (typeof data.processed !== 'undefined' && typeof data.total !== 'undefined') {
                updateScreenshotProgress(data.processed, data.total);
            }
            break;

        case 'tool_log':
            // Handle Visual Tools logs
            if (data.tool === 'traffic') {
                appendLog(document.getElementById('trafficConsole'), data.message);
            } else if (data.tool === 'downloader') {
                appendLog(document.getElementById('downloadConsole'), data.message);
            }
            break;
    }
}

function addLiveResultToTable(business, keyword) {
    const tbody = document.getElementById('resultsTableBody');
    const thead = document.querySelector('#resultsTable thead tr');
    if (!tbody) return;

    // Determine if this is a Domain Extraction result (has 'domain' property) or Maps
    const isDomainResult = !!business.domain || business.partial;

    // Dynamic Headers Update
    if (thead) {
        if (isDomainResult) {
            // Domain Extraction Headers - Force update if headers don't match our 7-column layout
            // We verify by checking if the first header is 'Status' (our new layout)
            if (!thead.children[0].textContent.includes('Status')) {
                thead.innerHTML = `
                    <th>Status</th>
                    <th>Domain</th>
                    <th>Emails</th>
                    <th>Phones</th>
                    <th>Technology</th>
                    <th>Social Links</th>
                    <th>Media</th>
                `;
            }
        } else {
            // Maps Extraction Headers
            if (thead.children.length !== 7 || thead.children[1].textContent !== 'Business Name') {
                thead.innerHTML = `
                    <th>Score</th>
                    <th>Business Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Rating</th>
                    <th>Website</th>
                    <th>Actions</th>
                `;
            }
        }
    }

    // Remove "no data" placeholder
    if (tbody.querySelector('td[colspan]')) {
        tbody.innerHTML = '';
    }

    // Unique ID
    const uniqueId = business.domain || business.placeId || (business.name ? business.name.replace(/[^a-zA-Z0-9]/g, '') : 'unknown');

    // Check upsert
    let row = tbody.querySelector(`tr[data-business-id="${uniqueId}"]`);
    const isUpdate = !!row;

    // Prepare Data for Domain View
    const nameStr = business.name || business.domain || 'Unknown';

    // For Emails/Phones/Social/Tech/Media, we want to accumulate them
    let displayEmails = business.email || business.emails?.join(', ') || '-';
    let displayPhones = business.phone || business.phones?.join(', ') || '-';
    let displaySocial = business.social || (Array.isArray(business.socials) ? business.socials.join(', ') : '-');
    let displayTech = business.technology || (Array.isArray(business.technologies) ? business.technologies.join(', ') : '-');
    let displayMedia = business.media || '-'; // Placeholder for media counts

    if (isUpdate) {
        // Merge logic
        if (isDomainResult) {
            // Helper to merge lists
            const merge = (newVal, oldVal) => {
                if (!newVal || newVal === '-') return oldVal;
                if (oldVal === '-' || !oldVal) return newVal;
                if (oldVal.includes(newVal)) return oldVal;
                return oldVal + ', ' + newVal;
            };

            displayEmails = merge(displayEmails, row.cells[2].textContent);
            displayPhones = merge(displayPhones, row.cells[3].textContent);
            displayTech = merge(displayTech, row.cells[4].textContent); // Index 4 is now Tech
            displaySocial = merge(displaySocial, row.cells[5].textContent); // Index 5 is now Social
            // Media merging is complex, simplified for now
            if (business.media) displayMedia = merge(business.media, row.cells[6].textContent);
            else displayMedia = row.cells[6].textContent;
        } else {
            // Maps merge (simpler)
            const oldPhone = row.cells[2].textContent;
            const oldEmail = row.cells[3].textContent;

            // Re-initialize for maps context
            displayPhones = business.phone || '-';
            displayEmails = business.email || business.emails?.join(', ') || '-';

            if (displayPhones === '-' && oldPhone !== '-') displayPhones = oldPhone;
            else if (displayPhones !== '-' && oldPhone !== '-' && !oldPhone.includes(displayPhones)) displayPhones = oldPhone + ', ' + displayPhones;

            if (displayEmails === '-' && oldEmail !== '-') displayEmails = oldEmail;
            else if (displayEmails !== '-' && oldEmail !== '-' && !oldEmail.includes(displayEmails)) displayEmails = oldEmail + ', ' + displayEmails;
        }
    }

    // Construct Row HTML based on Type
    let rowHtml = '';

    if (isDomainResult) {
        rowHtml = `
            <td><span style="color:var(--text-muted)">${business.partial ? '⏳' : '✅'}</span></td>
            <td class="domain-cell">
                <div style="font-weight:600;"><a href="http://${business.domain}" target="_blank">${business.domain}</a></div>
                <div style="font-size:0.75em;opacity:0.7">${business.sourceUrl || ''}</div>
            </td>
            <td style="font-size:0.9em; word-break:break-all;">${displayEmails}</td>
            <td style="font-size:0.9em;">${displayPhones}</td>
            <td style="font-size:0.85em;">${displayTech}</td>
            <td style="font-size:0.85em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:150px;">
                ${displaySocial !== '-' ? displaySocial.split(',').map(s => `<a href="${s}" target="_blank">Link</a>`).join(' ') : '-'}
            </td>
            <td style="font-size:0.85em;">${displayMedia}</td>
        `;
    } else {
        // Maps Row
        const displayWebsite = business.website ? `<a href="${business.website}" target="_blank" class="source-link">Visit</a>` : '-';
        rowHtml = `
            <td><span style="color:var(--text-muted)">${business.partial ? '⏳' : '✅'}</span></td>
            <td class="domain-cell">
                <div style="font-weight:600">${business.name || '-'}</div>
                <div style="font-size:0.75em;opacity:0.7">${business.category || ''}</div>
                <div style="font-size:0.7em;opacity:0.5">${keyword || ''}</div>
            </td>
            <td>${displayPhones}</td>
            <td>${displayEmails}</td>
            <td>
                <div style="display:flex;align-items:center;gap:4px">
                    <span>★</span> <span>${business.rating || '-'}</span>
                </div>
            </td>
            <td>${displayWebsite}</td>
            <td>-</td>
        `;
    }

    if (!row) {
        row = document.createElement('tr');
        row.setAttribute('data-business-id', uniqueId);
        row.innerHTML = rowHtml;
        tbody.appendChild(row);

        // Scroll to bottom
        const container = tbody.closest('.results-table-container');
        if (container) container.scrollTop = container.scrollHeight;

        // Update counters
        const foundEl = document.getElementById('campaignDetailFound');
        if (foundEl) {
            let current = parseInt(foundEl.textContent.replace(/,/g, '')) || 0;
            foundEl.textContent = (current + 1).toLocaleString();
        }
    } else {
        row.innerHTML = rowHtml;
    }
}

function updateCampaignStatus(message) {
    const statusEl = document.getElementById('campaignStatus') || document.getElementById('extractionStatus');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

// Subscribe to campaign when viewing
function subscribeToCampaign(campaignId) {
    if (state.ws && state.wsConnected) {
        state.ws.send(JSON.stringify({
            type: 'subscribe',
            campaignId: campaignId
        }));
        console.log('Subscribed to campaign:', campaignId);
    }
}

// Initialize WebSocket on page load
document.addEventListener('DOMContentLoaded', initWebSocket);

// ===================================
// WhatsApp Web Functions
// ===================================

const whatsappState = {
    sessions: [],
    uploadedPhones: []
};

// Load WhatsApp sessions
async function loadWhatsAppSessions() {
    try {
        const response = await fetch('/api/whatsapp/sessions');
        const data = await response.json();
        whatsappState.sessions = data.sessions || [];
        renderWhatsAppSessions();
    } catch (e) {
        console.error('Error loading WhatsApp sessions:', e);
    }
}

// Render sessions list
function renderWhatsAppSessions() {
    const container = document.getElementById('whatsappSessionsList');

    // All session selector dropdowns that need to be populated
    const sessionSelectors = [
        'waSessionSelector',      // Bulk Sender
        'waExtractSession',       // Group Members Extractor
        'waJoinSession',          // Bulk Group Joiner
        'verifyWhatsAppSession'   // WhatsApp Number Verification
    ];

    // Get active sessions
    const activeSessions = whatsappState.sessions.filter(s => s.active);
    const allSessions = whatsappState.sessions;

    // Update all session selector dropdowns
    sessionSelectors.forEach(selectorId => {
        const selector = document.getElementById(selectorId);
        if (selector) {
            selector.innerHTML = '<option value="">-- Select a session --</option>' +
                allSessions.map(s => `<option value="${s.name}">${s.name} ${s.active ? '(Active ✅)' : '(Saved)'}</option>`).join('');

            // If only one active session, auto-select it
            if (activeSessions.length === 1) {
                selector.value = activeSessions[0].name;
            }
        }
    });

    if (!container) return;

    if (whatsappState.sessions.length === 0) {
        container.innerHTML = `
            <div style="padding: 10px 16px; background: var(--bg-card); border-radius: 8px; border: 1px dashed var(--border-color);">
                <span style="color: var(--text-muted);">No sessions yet. Add one below.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = whatsappState.sessions.map(session => `
        <div style="padding: 10px 16px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-color); display: flex; align-items: center; gap: 10px;">
            <span style="color: ${session.active ? '#25D366' : 'var(--text-muted)'};">●</span>
            <span style="font-weight: 600;">${session.name}</span>
            <span style="font-size: 0.8em; color: var(--text-muted);">${session.active ? 'Active' : 'Saved'}</span>
            <button onclick="initWhatsAppSession('${session.name}')" style="margin-left: auto; padding: 4px 12px; background: #25D366; color: white; border-radius: 4px; font-size: 0.85em; cursor: pointer;">
                ${session.active ? '🔄 Refresh' : '▶️ Start'}
            </button>
            <button onclick="deleteWhatsAppSession('${session.name}')" style="padding: 4px 12px; background: #ef4444; color: white; border-radius: 4px; font-size: 0.85em; cursor: pointer;" title="Delete session">
                🗑️ Delete
            </button>
        </div>
    `).join('');
}

// Add new session
async function addWhatsAppSession() {
    const nameInput = document.getElementById('newSessionName');
    const name = nameInput.value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!name) {
        showToast('Please enter a session name', 'warning');
        return;
    }

    if (whatsappState.sessions.find(s => s.name === name)) {
        showToast('Session already exists', 'warning');
        return;
    }

    nameInput.value = '';
    showToast(`Initializing session "${name}"...`, 'info');

    await initWhatsAppSession(name);
}

// Initialize session (opens browser, shows QR)
async function initWhatsAppSession(sessionName) {
    try {
        showToast(`Starting WhatsApp Web for "${sessionName}"...`, 'info');

        const response = await fetch(`/api/whatsapp/session/${sessionName}/init`, {
            method: 'POST'
        });
        const data = await response.json();

        if (data.qrCode) {
            // Show QR code
            const qrSection = document.getElementById('whatsappQRSection');
            const qrImage = document.getElementById('whatsappQRImage');
            qrSection.classList.remove('hidden');
            qrImage.src = data.qrCode;
            showToast('Scan QR code with WhatsApp', 'info');
        }

        if (data.loggedIn) {
            document.getElementById('whatsappQRSection')?.classList.add('hidden');
            showToast(`Session "${sessionName}" logged in!`, 'success');
        }

        // Reload sessions
        await loadWhatsAppSessions();

    } catch (e) {
        showToast('Error initializing session: ' + e.message, 'error');
    }
}

// Delete WhatsApp session
async function deleteWhatsAppSession(sessionName) {
    if (!confirm(`Are you sure you want to delete session "${sessionName}"? This will remove all saved login data.`)) {
        return;
    }

    try {
        showToast(`Deleting session "${sessionName}"...`, 'info');

        const response = await fetch(`/api/whatsapp/session/${sessionName}`, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
            showToast(`Session "${sessionName}" deleted successfully`, 'success');
            // Remove from local state
            whatsappState.sessions = whatsappState.sessions.filter(s => s.name !== sessionName);
            renderWhatsAppSessions();
        } else {
            showToast('Error deleting session: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        showToast('Error deleting session: ' + e.message, 'error');
    }
}


// Send bulk WhatsApp messages
async function sendBulkWhatsApp() {
    const messageTemplate = document.getElementById('waMessageTemplate').value.trim();
    const delay = parseInt(document.getElementById('waMessageDelay').value) * 1000;
    const rotate = document.getElementById('waRotateSessions').checked;
    const selectedSession = document.getElementById('waSessionSelector')?.value;

    if (!messageTemplate) {
        showToast('Please enter a message template', 'warning');
        return;
    }

    // Get recipients from uploaded file
    let recipients = [];
    if (whatsappState.uploadedPhones && whatsappState.uploadedPhones.length > 0) {
        recipients = whatsappState.uploadedPhones.map(p => typeof p === 'object' ? p : { phone: p });
    } else {
        // Try to get from current campaign table
        const rows = document.querySelectorAll('#resultsTableBody tr[data-result-id]');
        rows.forEach(row => {
            const phoneCell = row.cells[2];
            if (phoneCell) {
                const phoneMatch = phoneCell.textContent.trim().match(/[0-9]{10,}/);
                if (phoneMatch) {
                    recipients.push({ phone: phoneMatch[0] });
                }
            }
        });
    }

    if (recipients.length === 0) {
        showToast('No recipients found', 'warning');
        return;
    }

    // Check if we have sessions (they will be auto-started on backend if not active)
    if (whatsappState.sessions.length === 0) {
        showToast('No WhatsApp sessions configured. Please add a session first.', 'warning');
        return;
    }

    // Show progress
    const progressDiv = document.getElementById('waProgress');
    const progressBar = document.getElementById('waProgressBar');
    const progressText = document.getElementById('waProgressText');
    progressDiv.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressText.textContent = `0 / ${recipients.length}`;

    // Simulate progress updates while API is processing
    let currentProgress = 0;
    const totalRecipients = recipients.length;
    const estimatedTimePerMessage = delay + 3000; // delay + ~3s for sending

    const progressInterval = setInterval(() => {
        if (currentProgress < totalRecipients - 1) {
            currentProgress++;
            const percent = Math.round((currentProgress / totalRecipients) * 100);
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `${currentProgress} / ${totalRecipients} (sending...)`;
        }
    }, estimatedTimePerMessage);

    try {
        showToast(`Sending to ${recipients.length} recipients...`, 'info');

        const response = await fetch('/api/whatsapp/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipients,
                messageTemplate,
                delay,
                rotate
            })
        });

        clearInterval(progressInterval);
        const data = await response.json();

        if (data.success) {
            progressBar.style.width = '100%';
            progressText.textContent = `✅ ${data.sent} sent, ❌ ${data.failed} failed`;
            showToast(`Sent: ${data.sent}, Failed: ${data.failed}`, 'success');

            // Store results for export
            whatsappCampaignResults = {
                sent: data.results ? data.results.filter(r => r.success).map(r => r.phone) : [],
                failed: data.results ? data.results.filter(r => !r.success).map(r => ({ phone: r.phone, error: r.error })) : [],
                all: data.results || []
            };

            // Show results section
            const resultsDiv = document.getElementById('waCampaignResults');
            if (resultsDiv) {
                resultsDiv.classList.remove('hidden');
                document.getElementById('waSentCount').textContent = data.sent;
                document.getElementById('waFailedCount').textContent = data.failed;
            }
        } else {
            progressText.textContent = `❌ Error: ${data.error}`;
            showToast('Error: ' + data.error, 'error');
        }

    } catch (e) {
        clearInterval(progressInterval);
        progressText.textContent = `❌ Error: ${e.message}`;
        showToast('Error sending messages: ' + e.message, 'error');
    }
}

// Store campaign results for export
let whatsappCampaignResults = { sent: [], failed: [], all: [] };
let smsCampaignResults = { sent: [], failed: [], all: [] };

// Export WhatsApp campaign results
function exportWhatsAppCampaignResults(type) {
    let content = '';
    let filename = '';

    if (type === 'sent') {
        if (whatsappCampaignResults.sent.length === 0) {
            showToast('No sent numbers to export', 'warning');
            return;
        }
        content = whatsappCampaignResults.sent.join('\n');
        filename = `whatsapp_sent_${Date.now()}.txt`;
    } else if (type === 'failed') {
        if (whatsappCampaignResults.failed.length === 0) {
            showToast('No failed numbers to export', 'warning');
            return;
        }
        content = whatsappCampaignResults.failed.map(f => `${f.phone}\t${f.error || 'Failed'}`).join('\n');
        filename = `whatsapp_failed_${Date.now()}.txt`;
    } else if (type === 'all') {
        if (whatsappCampaignResults.all.length === 0) {
            showToast('No results to export', 'warning');
            return;
        }
        content = 'Phone\tStatus\tError\n' + whatsappCampaignResults.all.map(r =>
            `${r.phone}\t${r.success ? 'Sent' : 'Failed'}\t${r.error || ''}`
        ).join('\n');
        filename = `whatsapp_report_${Date.now()}.csv`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${type} results`, 'success');
}

// Export SMS campaign results
function exportSmsCampaignResults(type) {
    let content = '';
    let filename = '';

    if (type === 'sent') {
        if (smsCampaignResults.sent.length === 0) {
            showToast('No sent numbers to export', 'warning');
            return;
        }
        content = smsCampaignResults.sent.join('\n');
        filename = `sms_sent_${Date.now()}.txt`;
    } else if (type === 'failed') {
        if (smsCampaignResults.failed.length === 0) {
            showToast('No failed numbers to export', 'warning');
            return;
        }
        content = smsCampaignResults.failed.map(f => `${f.phone}\t${f.error || 'Failed'}`).join('\n');
        filename = `sms_failed_${Date.now()}.txt`;
    } else if (type === 'all') {
        if (smsCampaignResults.all.length === 0) {
            showToast('No results to export', 'warning');
            return;
        }
        content = 'Phone\tStatus\tError\n' + smsCampaignResults.all.map(r =>
            `${r.phone}\t${r.success ? 'Sent' : 'Failed'}\t${r.error || ''}`
        ).join('\n');
        filename = `sms_report_${Date.now()}.csv`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${type} results`, 'success');
}

// Insert variable into SMS message template
function insertSmsVariable(variable) {
    const textarea = document.getElementById('smsMessageTemplate');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    textarea.value = text.substring(0, start) + variable + text.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    textarea.focus();

    // Update character count
    updateSmsCharCount();
}

// Update SMS character count
function updateSmsCharCount() {
    const textarea = document.getElementById('smsMessageTemplate');
    const countEl = document.getElementById('smsCharCount');
    if (!textarea || !countEl) return;

    const len = textarea.value.length;
    const segments = Math.ceil(len / 160) || 1;
    countEl.textContent = `${len}/160 chars (${segments} segment${segments > 1 ? 's' : ''})`;
}

// Send SMS Campaign with results tracking and all Advanced Options
async function sendSmsCampaign() {
    const messageTemplate = document.getElementById('smsMessageTemplate').value.trim();
    const senderId = document.getElementById('smsSenderId').value.trim();

    // Get Advanced Options
    const scheduleType = document.querySelector('input[name="smsSchedule"]:checked')?.value || 'now';
    const scheduleTime = document.getElementById('smsScheduleTime')?.value || '';
    const rateLimit = parseInt(document.getElementById('smsRateLimit')?.value) || 10;
    const ratePeriod = document.getElementById('smsRatePeriod')?.value || 'minute';
    const delay = parseInt(document.getElementById('smsDelay')?.value) || 2;
    const includeOptOut = document.getElementById('smsOptOut')?.checked || false;
    const optOutText = document.getElementById('smsOptOutText')?.value || 'Reply STOP to unsubscribe';
    const trackLinks = document.getElementById('smsTrackLinks')?.checked || false;
    const testMode = document.getElementById('smsTestMode')?.checked || false;

    if (!messageTemplate) {
        showToast('Please enter a message template', 'warning');
        return;
    }

    // Check for scheduled send
    if (scheduleType === 'later' && !scheduleTime) {
        showToast('Please select a schedule time', 'warning');
        return;
    }

    // Get recipients from parsed file or fallback to file input
    let recipients = smsRecipients.length > 0 ? smsRecipients : [];
    if (recipients.length === 0) {
        const smsFileInput = document.getElementById('smsPhoneFile');
        if (smsFileInput && smsFileInput.files.length > 0) {
            const file = smsFileInput.files[0];
            const text = await file.text();
            recipients = text.split('\n').map(l => l.trim()).filter(l => l.match(/[0-9]{10,}/)).map(phone => ({ phone }));
        }
    }

    if (recipients.length === 0) {
        showToast('No recipients found. Please upload a file with phone numbers.', 'warning');
        return;
    }

    // Build final message with opt-out if enabled
    let finalTemplate = messageTemplate;
    if (includeOptOut && optOutText) {
        finalTemplate += '\n\n' + optOutText;
    }

    // Test mode simulation
    if (testMode) {
        showToast(`🧪 TEST MODE: Would send to ${recipients.length} recipients`, 'info');

        // Simulate results
        smsCampaignResults = {
            sent: recipients.map(r => r.phone),
            failed: [],
            all: recipients.map(r => ({ phone: r.phone, success: true, error: '' }))
        };

        const resultsDiv = document.getElementById('smsCampaignResults');
        if (resultsDiv) {
            resultsDiv.classList.remove('hidden');
            document.getElementById('smsSentCount').textContent = recipients.length;
            document.getElementById('smsFailedCount').textContent = 0;
        }

        showToast(`🧪 TEST: Simulated sending to ${recipients.length} recipients`, 'success');
        return;
    }

    showToast(`Sending SMS to ${recipients.length} recipients...`, 'info');

    try {
        const response = await fetch('/api/sms/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipients,
                messageTemplate: finalTemplate,
                senderId,
                options: {
                    scheduleType,
                    scheduleTime,
                    rateLimit,
                    ratePeriod,
                    delay,
                    trackLinks
                }
            })
        });

        const data = await response.json();

        if (data.success) {
            // Store results for export
            smsCampaignResults = {
                sent: data.results ? data.results.filter(r => r.success).map(r => r.phone) : [],
                failed: data.results ? data.results.filter(r => !r.success).map(r => ({ phone: r.phone, error: r.error })) : [],
                all: data.results || []
            };

            // Show results section
            const resultsDiv = document.getElementById('smsCampaignResults');
            if (resultsDiv) {
                resultsDiv.classList.remove('hidden');
                document.getElementById('smsSentCount').textContent = data.sent || smsCampaignResults.sent.length;
                document.getElementById('smsFailedCount').textContent = data.failed || smsCampaignResults.failed.length;
            }

            showToast(`SMS Campaign complete! Sent: ${data.sent || smsCampaignResults.sent.length}, Failed: ${data.failed || smsCampaignResults.failed.length}`, 'success');
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('Error sending SMS campaign: ' + e.message, 'error');
    }
}

// Initialize SMS Advanced Options handlers
document.addEventListener('DOMContentLoaded', function () {
    // SMS schedule radio change
    const scheduleRadios = document.querySelectorAll('input[name="smsSchedule"]');
    scheduleRadios.forEach(radio => {
        radio.addEventListener('change', function () {
            const dateDiv = document.getElementById('smsScheduleDate');
            if (dateDiv) {
                dateDiv.classList.toggle('hidden', this.value !== 'later');
            }
        });
    });

    // SMS character count
    const smsTextarea = document.getElementById('smsMessageTemplate');
    if (smsTextarea) {
        smsTextarea.addEventListener('input', updateSmsCharCount);
    }
});

// Store parsed recipients for campaigns
let smsRecipients = [];
let waRecipients = [];
let emailRecipients = [];

// Parse SMS file (txt, csv, xlsx)
async function parseSmsFile(input) {
    const file = input.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    let recipients = [];

    try {
        if (ext === 'txt') {
            const text = await file.text();
            recipients = text.split('\n').map(line => {
                const phone = line.trim().replace(/[^0-9+]/g, '');
                return phone.length >= 10 ? { phone, name: '', company: '', city: '', website: '' } : null;
            }).filter(r => r);
        } else if (ext === 'csv') {
            recipients = await parseCSV(file, 'phone');
        } else if (ext === 'xlsx' || ext === 'xls') {
            showToast('For Excel files, please save as CSV first', 'info');
            return;
        }

        smsRecipients = recipients;
        document.getElementById('smsRecipientCount').textContent = `📊 ${recipients.length} recipients loaded`;
        document.getElementById('smsFileInfo').textContent = `✅ ${file.name} loaded`;
        showToast(`Loaded ${recipients.length} recipients from ${file.name}`, 'success');
    } catch (e) {
        showToast('Error parsing file: ' + e.message, 'error');
    }
}

// Parse WhatsApp file
async function parseWhatsAppFile(input) {
    const file = input.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    let recipients = [];

    try {
        if (ext === 'txt') {
            const text = await file.text();
            recipients = text.split('\n').map(line => {
                const phone = line.trim().replace(/[^0-9]/g, '');
                return phone.length >= 10 ? { phone, name: '', company: '', city: '', website: '' } : null;
            }).filter(r => r);
        } else if (ext === 'csv') {
            recipients = await parseCSV(file, 'phone');
        } else if (ext === 'xlsx' || ext === 'xls') {
            showToast('For Excel files, please save as CSV first', 'info');
            return;
        }

        waRecipients = recipients;
        whatsappState.uploadedPhones = recipients.map(r => r.phone);
        document.getElementById('waRecipientCount').textContent = `📊 ${recipients.length} recipients loaded`;
        document.getElementById('waFileInfo').textContent = `✅ ${file.name} loaded`;
        showToast(`Loaded ${recipients.length} recipients from ${file.name}`, 'success');
    } catch (e) {
        showToast('Error parsing file: ' + e.message, 'error');
    }
}

// Parse Email file
async function parseEmailFile(input) {
    const file = input.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    let recipients = [];

    try {
        if (ext === 'txt') {
            const text = await file.text();
            recipients = text.split('\n').map(line => {
                const email = line.trim();
                return email.includes('@') ? { email, name: '', company: '', city: '', website: '' } : null;
            }).filter(r => r);
        } else if (ext === 'csv') {
            recipients = await parseCSV(file, 'email');
        } else if (ext === 'xlsx' || ext === 'xls') {
            showToast('For Excel files, please save as CSV first', 'info');
            return;
        }

        emailRecipients = recipients;
        document.getElementById('emailRecipientCount').textContent = `📊 ${recipients.length} recipients loaded`;
        document.getElementById('emailFileInfo').textContent = `✅ ${file.name} loaded`;
        showToast(`Loaded ${recipients.length} recipients from ${file.name}`, 'success');
    } catch (e) {
        showToast('Error parsing file: ' + e.message, 'error');
    }
}

// Parse CSV file
async function parseCSV(file, primaryField) {
    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) return [];

    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const recipients = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });

        // Only include if primary field exists
        if (row[primaryField]) {
            recipients.push({
                phone: row.phone || '',
                email: row.email || '',
                name: row.name || '',
                company: row.company || '',
                city: row.city || '',
                website: row.website || ''
            });
        }
    }

    return recipients;
}

// Download sample file
function downloadSampleFile(type) {
    let content = '';
    let filename = '';

    if (type === 'sms') {
        content = 'phone,name,company,city,website\n+919876543210,John Doe,ABC Corp,Mumbai,abc.com\n+14155551234,Jane Smith,XYZ Inc,New York,xyz.com\n+447911123456,Bob Wilson,UK Ltd,London,ukltd.co.uk';
        filename = 'sms_sample.csv';
    } else if (type === 'whatsapp') {
        content = 'phone,name,company,city,website\n919876543210,John Doe,ABC Corp,Mumbai,abc.com\n14155551234,Jane Smith,XYZ Inc,New York,xyz.com\n447911123456,Bob Wilson,UK Ltd,London,ukltd.co.uk';
        filename = 'whatsapp_sample.csv';
    } else if (type === 'email') {
        content = 'email,name,company,city,website\njohn@example.com,John Doe,ABC Corp,Mumbai,abc.com\njane@company.com,Jane Smith,XYZ Inc,New York,xyz.com\nbob@business.co.uk,Bob Wilson,UK Ltd,London,ukltd.co.uk';
        filename = 'email_sample.csv';
    }

    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Downloaded ${filename}`, 'success');
}

// Initialize WhatsApp UI event handlers
document.addEventListener('DOMContentLoaded', function () {
    // WhatsApp recipient source change
    const waSource = document.getElementById('waRecipientSource');
    if (waSource) {
        waSource.addEventListener('change', function () {
            const uploadDiv = document.getElementById('waFileUpload');
            if (this.value === 'upload') {
                uploadDiv?.classList.remove('hidden');
            } else {
                uploadDiv?.classList.add('hidden');
            }
        });
    }

    // WhatsApp file upload
    const waFileInput = document.getElementById('waPhoneFile');
    if (waFileInput) {
        waFileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const content = event.target.result;
                    const lines = content.split('\n').map(l => l.trim()).filter(l => l.match(/[0-9]{10,}/));
                    whatsappState.uploadedPhones = lines;
                    document.getElementById('waFileInfo').textContent = `✅ Loaded ${lines.length} phone numbers from ${file.name}`;
                    document.getElementById('waRecipientCount').textContent = `📊 ${lines.length} recipients from file`;
                };
                reader.readAsText(file);
            }
        });
    }

    // Load sessions when Marketing page is viewed
    loadWhatsAppSessions();
});

// State for extracted members
let extractedGroupMembers = [];

// Update session dropdowns
function updateSessionDropdowns() {
    const selects = ['waExtractSession', 'waJoinSession'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Select session...</option>';
            whatsappState.sessions.forEach(session => {
                const opt = document.createElement('option');
                opt.value = session.name;
                opt.textContent = `${session.name} ${session.active ? '(Active)' : ''}`;
                select.appendChild(opt);
            });
            select.value = currentValue;
        }
    });
}

// Extract group members
async function extractGroupMembers() {
    const sessionName = document.getElementById('waExtractSession').value;
    const groupSelect = document.getElementById('waGroupsList');
    const groupName = groupSelect ? groupSelect.value : '';

    if (!sessionName) {
        showToast('Please select a WhatsApp session', 'warning');
        return;
    }

    if (!groupName) {
        showToast('Please select a group from the dropdown (click Load Groups first)', 'warning');
        return;
    }

    showToast(`Extracting members from "${groupName}"...`, 'info');

    try {
        const response = await fetch('/api/whatsapp/extract-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName, groupName })
        });

        const data = await response.json();

        if (data.success) {
            extractedGroupMembers = data.members || [];
            document.getElementById('waExtractResult').classList.remove('hidden');
            document.getElementById('waExtractCount').textContent = `${extractedGroupMembers.length} members found`;
            showToast(`Extracted ${extractedGroupMembers.length} phone numbers`, 'success');
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Download extracted numbers
function downloadExtractedNumbers() {
    if (extractedGroupMembers.length === 0) {
        showToast('No numbers to download', 'warning');
        return;
    }

    const content = extractedGroupMembers.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whatsapp_group_numbers.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded!', 'success');
}

// Bulk join groups
async function bulkJoinGroups() {
    const sessionName = document.getElementById('waJoinSession').value;
    const linksText = document.getElementById('waInviteLinks').value.trim();
    const delay = parseInt(document.getElementById('waJoinDelay').value) * 1000;

    if (!sessionName) {
        showToast('Please select a WhatsApp session', 'warning');
        return;
    }

    const inviteLinks = linksText.split('\n').map(l => l.trim()).filter(l => l.includes('chat.whatsapp.com'));

    if (inviteLinks.length === 0) {
        showToast('Please enter valid WhatsApp group invite links', 'warning');
        return;
    }

    showToast(`Joining ${inviteLinks.length} groups...`, 'info');
    document.getElementById('waJoinProgress').classList.remove('hidden');
    document.getElementById('waJoinProgressText').textContent = `0 / ${inviteLinks.length} processed`;

    try {
        const response = await fetch('/api/whatsapp/join-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName, inviteLinks, delay })
        });

        const data = await response.json();

        if (data.success) {
            document.getElementById('waJoinProgressText').textContent = `✅ Joined: ${data.joined}, ❌ Failed: ${data.failed}`;
            showToast(`Joined ${data.joined} groups, ${data.failed} failed`, 'success');
        } else {
            showToast('Error: ' + data.error, 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Override loadWhatsAppSessions to also update session dropdowns
const _originalLoadSessions = loadWhatsAppSessions;
loadWhatsAppSessions = async function () {
    await _originalLoadSessions();
    updateSessionDropdowns();
};

// ===================================
// Settings Page Functions
// ===================================

// Switch settings tabs
function switchSettingsTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.settings-tab-content').forEach(tab => {
        tab.classList.add('hidden');
        tab.classList.remove('active');
    });

    // Remove active class from buttons
    document.querySelectorAll('.settings-tabs .tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById('settingsTab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
        selectedTab.classList.add('active');
    }

    // Set active button
    event?.target?.classList?.add('active');
}

// AI settings removed - toggleGeminiSettings function deleted

// Load settings into UI
async function loadSettingsUI() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();

        // Proxy
        const proxyEnabled = document.getElementById('settingsProxyEnabled');
        const proxyRotateError = document.getElementById('settingsProxyRotateError');
        const webshareApiKey = document.getElementById('settingsWebshareApiKey');

        if (proxyEnabled) proxyEnabled.checked = settings.proxy?.enabled || false;
        if (proxyRotateError) proxyRotateError.checked = settings.proxy?.rotateOnError ?? true;
        if (webshareApiKey) webshareApiKey.value = settings.proxy?.webshareApiKey || '';

        // SMTP
        const smtpHost = document.getElementById('settingsSmtpHost');
        const smtpPort = document.getElementById('settingsSmtpPort');
        const smtpUser = document.getElementById('settingsSmtpUser');
        const smtpPass = document.getElementById('settingsSmtpPass');
        const smtpEnabled = document.getElementById('settingsSmtpEnabled');

        if (smtpHost) smtpHost.value = settings.smtp?.host || '';
        if (smtpPort) smtpPort.value = settings.smtp?.port || 587;
        if (smtpUser) smtpUser.value = settings.smtp?.user || '';
        if (smtpPass) smtpPass.value = settings.smtp?.pass || '';
        if (smtpEnabled) smtpEnabled.checked = settings.smtp?.enabled || false;

        // Twilio
        const twilioSid = document.getElementById('settingsTwilioSid');
        const twilioToken = document.getElementById('settingsTwilioToken');
        const twilioPhone = document.getElementById('settingsTwilioPhone');
        const twilioEnabled = document.getElementById('settingsTwilioEnabled');

        if (twilioSid) twilioSid.value = settings.twilio?.accountSid || '';
        if (twilioToken) twilioToken.value = settings.twilio?.authToken || '';
        if (twilioPhone) twilioPhone.value = settings.twilio?.fromNumber || '';
        if (twilioEnabled) twilioEnabled.checked = settings.twilio?.enabled || false;

        // API Keys (only zerobounce now)
        const zerobounce = document.getElementById('settingsApiZerobounce');
        if (zerobounce) zerobounce.value = settings.apiKeys?.zerobounce || '';

        // AI settings removed
    } catch (e) {
        console.error('Error loading settings:', e);
    }
}

// Save settings from UI
async function saveSettingsUI() {
    try {
        const settings = {
            proxy: {
                enabled: document.getElementById('settingsProxyEnabled')?.checked || false,
                rotateOnError: document.getElementById('settingsProxyRotateError')?.checked || false,
                webshareApiKey: document.getElementById('settingsWebshareApiKey')?.value || ''
            },
            smtp: {
                host: document.getElementById('settingsSmtpHost')?.value || '',
                port: parseInt(document.getElementById('settingsSmtpPort')?.value) || 587,
                user: document.getElementById('settingsSmtpUser')?.value || '',
                pass: document.getElementById('settingsSmtpPass')?.value || '',
                enabled: document.getElementById('settingsSmtpEnabled')?.checked || false
            },
            twilio: {
                accountSid: document.getElementById('settingsTwilioSid')?.value || '',
                authToken: document.getElementById('settingsTwilioToken')?.value || '',
                fromNumber: document.getElementById('settingsTwilioPhone')?.value || '',
                enabled: document.getElementById('settingsTwilioEnabled')?.checked || false
            },
            apiKeys: {
                zerobounce: document.getElementById('settingsApiZerobounce')?.value || ''
            }
        };

        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });

        const data = await response.json();
        if (data.success) {
            showToast('Settings saved successfully!', 'success');
        } else {
            showToast('Error saving settings', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Test SMTP connection
async function testSmtpConnection() {
    try {
        showToast('Testing SMTP connection...', 'info');
        const response = await fetch('/api/settings/test-smtp', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            showToast('SMTP connection successful!', 'success');
        } else {
            showToast('SMTP failed: ' + data.message, 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Test Twilio connection
async function testTwilioConnection() {
    try {
        // First save the current settings
        await saveSettingsUI();

        showToast('Testing Twilio connection...', 'info');
        const response = await fetch('/api/settings/test-twilio', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            showToast(data.message, 'success');
        } else {
            showToast('Twilio failed: ' + data.message, 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Initialize settings page
document.addEventListener('DOMContentLoaded', function () {
    // Load settings when page loads
    loadSettingsUI();

    // Save settings button
    const saveBtn = document.getElementById('btnSaveSettings');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettingsUI);
    }

    // Test SMTP button
    const testSmtpBtn = document.getElementById('btnTestSmtp');
    if (testSmtpBtn) {
        testSmtpBtn.addEventListener('click', testSmtpConnection);
    }

    // Test Twilio button
    const testTwilioBtn = document.getElementById('btnTestTwilio');
    if (testTwilioBtn) {
        testTwilioBtn.addEventListener('click', testTwilioConnection);
    }
});

// ===================================
// WhatsApp List Groups Feature
// ===================================

// List all WhatsApp groups for extraction
async function listWhatsAppGroups() {
    const sessionName = document.getElementById('waExtractSession').value;

    if (!sessionName) {
        showToast('Please select a WhatsApp session', 'warning');
        return;
    }

    showToast('Loading groups...', 'info');

    try {
        const response = await fetch('/api/whatsapp/list-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName })
        });

        const data = await response.json();

        if (data.success && data.groups) {
            // Display groups in a dropdown or list
            const groupsList = document.getElementById('waGroupsList');
            const container = document.getElementById('waGroupsListContainer');
            if (groupsList) {
                groupsList.innerHTML = '<option value="">Select a group...</option>' + data.groups.map(g =>
                    `<option value="${g.name}">${g.name} (${g.memberCount || '?'} members)</option>`
                ).join('');
            }
            if (container) {
                container.classList.remove('hidden');
            }
            showToast(`Found ${data.groups.length} groups`, 'success');
        } else {
            showToast('Error: ' + (data.error || 'No groups found'), 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Load groups for extraction (uses waExtractSession dropdown)
async function loadWhatsAppGroups() {
    const sessionName = document.getElementById('waExtractSession')?.value;
    if (!sessionName) {
        showToast('Please select a WhatsApp session first', 'warning');
        return;
    }
    await listWhatsAppGroups();
}

// ===================================
// Webshare Proxy Functions
// ===================================

async function testWebshareConnection() {
    const apiKey = document.getElementById('settingsWebshareApiKey')?.value;
    const statusEl = document.getElementById('proxyConnectionStatus');

    if (!apiKey) {
        showToast('Please enter Webshare API key', 'warning');
        return;
    }

    statusEl.textContent = '⏳ Testing...';
    statusEl.style.background = 'var(--bg-tertiary)';

    try {
        const response = await fetch('/api/settings/test-webshare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey })
        });
        const data = await response.json();

        if (data.success) {
            statusEl.textContent = `✅ ${data.proxyCount} proxies`;
            statusEl.style.background = 'rgba(34, 197, 94, 0.2)';
            showToast(data.message, 'success');
        } else {
            statusEl.textContent = '❌ Failed';
            statusEl.style.background = 'rgba(239, 68, 68, 0.2)';
            showToast('Error: ' + data.message, 'error');
        }
    } catch (e) {
        statusEl.textContent = '❌ Error';
        statusEl.style.background = 'rgba(239, 68, 68, 0.2)';
        showToast('Error: ' + e.message, 'error');
    }
}

async function fetchWebshareProxies() {
    const apiKey = document.getElementById('settingsWebshareApiKey')?.value;
    const resultEl = document.getElementById('proxyFetchResult');
    const countEl = document.getElementById('proxyCount');

    if (!apiKey) {
        showToast('Please enter Webshare API key', 'warning');
        return;
    }

    showToast('Fetching proxies from Webshare...', 'info');

    try {
        const response = await fetch('/api/settings/fetch-webshare-proxies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey })
        });
        const data = await response.json();

        if (data.success) {
            resultEl.style.display = 'block';
            countEl.textContent = `✅ ${data.count} proxies loaded and ready for extraction`;
            showToast(data.message, 'success');
        } else {
            showToast('Error: ' + data.message, 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ===================================
// Verification Functions
// ===================================

let verifyEmailList = [];
let verifyWhatsAppList = [];
let verifiedEmails = { valid: [], invalid: [] };
let verifiedWhatsApp = { valid: [], invalid: [] };

// Email file upload handler
document.addEventListener('DOMContentLoaded', function () {
    const emailFile = document.getElementById('verifyEmailFile');
    if (emailFile) {
        emailFile.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const content = event.target.result;
                    const emails = content.split('\n')
                        .map(l => l.trim())
                        .filter(l => l.includes('@'));
                    verifyEmailList = emails;
                    document.getElementById('verifyEmailInfo').textContent = `✅ Loaded ${emails.length} emails from ${file.name}`;
                };
                reader.readAsText(file);
            }
        });
    }

    // WhatsApp file upload handler
    const waFile = document.getElementById('verifyWhatsAppFile');
    if (waFile) {
        waFile.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const content = event.target.result;
                    const phones = content.split('\n')
                        .map(l => l.trim().replace(/[^0-9+]/g, ''))
                        .filter(l => l.length >= 10);
                    verifyWhatsAppList = phones;
                    document.getElementById('verifyWhatsAppInfo').textContent = `✅ Loaded ${phones.length} phone numbers from ${file.name}`;
                };
                reader.readAsText(file);
            }
        });
    }

    // Add verifyWhatsAppSession to session dropdown updates
    const origUpdateDropdowns = updateSessionDropdowns;
    if (typeof origUpdateDropdowns === 'function') {
        window.updateSessionDropdowns = function () {
            origUpdateDropdowns();
            const verifySelect = document.getElementById('verifyWhatsAppSession');
            if (verifySelect && whatsappState?.sessions) {
                verifySelect.innerHTML = '<option value="">Select session...</option>';
                whatsappState.sessions.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.name;
                    opt.textContent = `${s.name} ${s.active ? '(Active)' : ''}`;
                    verifySelect.appendChild(opt);
                });
            }
        };
    }
});

// Verify emails
async function verifyEmails() {
    if (verifyEmailList.length === 0) {
        showToast('Please upload an email file first', 'warning');
        return;
    }

    const method = document.getElementById('emailVerifyMethod')?.value || 'mx';

    verifiedEmails = { valid: [], invalid: [] };
    document.getElementById('verifyEmailProgress').classList.remove('hidden');
    document.getElementById('verifyEmailResults').classList.add('hidden');

    for (let i = 0; i < verifyEmailList.length; i++) {
        const email = verifyEmailList[i];
        document.getElementById('verifyEmailCount').textContent = `${i + 1} / ${verifyEmailList.length}`;

        try {
            const response = await fetch('/api/enrichment/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, method })
            });
            const data = await response.json();

            if (data.valid) {
                verifiedEmails.valid.push(email);
            } else {
                verifiedEmails.invalid.push(email);
            }
        } catch (e) {
            verifiedEmails.invalid.push(email);
        }
    }

    document.getElementById('verifyEmailProgress').classList.add('hidden');
    document.getElementById('verifyEmailResults').classList.remove('hidden');
    document.getElementById('validEmailCount').textContent = verifiedEmails.valid.length;
    document.getElementById('invalidEmailCount').textContent = verifiedEmails.invalid.length;
    showToast(`Verification complete! ${verifiedEmails.valid.length} valid emails`, 'success');
}

// Export verified emails
function exportVerifiedEmails() {
    if (verifiedEmails.valid.length === 0) {
        showToast('No valid emails to export', 'warning');
        return;
    }

    const content = verifiedEmails.valid.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verified_emails.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${verifiedEmails.valid.length} valid emails`, 'success');
}

// Verify WhatsApp numbers
async function verifyWhatsAppNumbers() {
    const sessionName = document.getElementById('verifyWhatsAppSession').value;

    if (!sessionName) {
        showToast('Please select a WhatsApp session', 'warning');
        return;
    }

    if (verifyWhatsAppList.length === 0) {
        showToast('Please upload a phone number file first', 'warning');
        return;
    }

    verifiedWhatsApp = { valid: [], invalid: [] };
    document.getElementById('verifyWhatsAppProgress').classList.remove('hidden');
    document.getElementById('verifyWhatsAppResults').classList.add('hidden');

    for (let i = 0; i < verifyWhatsAppList.length; i++) {
        const phone = verifyWhatsAppList[i];
        document.getElementById('verifyWhatsAppCount').textContent = `${i + 1} / ${verifyWhatsAppList.length}`;

        try {
            const response = await fetch('/api/whatsapp/check-number', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionName, phone })
            });
            const data = await response.json();

            if (data.exists) {
                verifiedWhatsApp.valid.push(phone);
            } else {
                verifiedWhatsApp.invalid.push(phone);
            }
        } catch (e) {
            verifiedWhatsApp.invalid.push(phone);
        }

        // Small delay between checks
        await new Promise(r => setTimeout(r, 1000));
    }

    document.getElementById('verifyWhatsAppProgress').classList.add('hidden');
    document.getElementById('verifyWhatsAppResults').classList.remove('hidden');
    document.getElementById('hasWhatsAppCount').textContent = verifiedWhatsApp.valid.length;
    document.getElementById('noWhatsAppCount').textContent = verifiedWhatsApp.invalid.length;
    showToast(`Verification complete! ${verifiedWhatsApp.valid.length} have WhatsApp`, 'success');
}

// Export verified WhatsApp numbers
function exportVerifiedWhatsApp() {
    if (verifiedWhatsApp.valid.length === 0) {
        showToast('No valid WhatsApp numbers to export', 'warning');
        return;
    }

    const content = verifiedWhatsApp.valid.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verified_whatsapp_numbers.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${verifiedWhatsApp.valid.length} WhatsApp numbers`, 'success');
}

// ===================================
// SMS & Email Campaign Functions
// ===================================

let smsRecipientList = [];
let emailRecipientList = [];

// Initialize SMS/Email campaign event listeners
document.addEventListener('DOMContentLoaded', function () {
    // SMS Campaign button
    const btnSendSms = document.getElementById('btnSendSms');
    if (btnSendSms) {
        btnSendSms.addEventListener('click', sendSmsCampaign);
    }

    // Email Campaign button
    const btnSendEmail = document.getElementById('btnSendEmail');
    if (btnSendEmail) {
        btnSendEmail.addEventListener('click', sendEmailCampaign);
    }

    // SMS file upload
    const smsFile = document.getElementById('smsPhoneFile');
    if (smsFile) {
        smsFile.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const phones = event.target.result.split('\n')
                        .map(l => l.trim().replace(/[^0-9+]/g, ''))
                        .filter(l => l.length >= 10);
                    smsRecipientList = phones.map(p => ({ phone: p }));
                    const info = document.getElementById('smsFileInfo');
                    if (info) info.textContent = `✅ Loaded ${phones.length} phone numbers`;
                    updateSmsRecipientCount();
                };
                reader.readAsText(file);
            }
        });
    }

    // Email file upload
    const emailFile = document.getElementById('emailAddressFile');
    if (emailFile) {
        emailFile.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (event) {
                    const emails = event.target.result.split('\n')
                        .map(l => l.trim())
                        .filter(l => l.includes('@'));
                    emailRecipientList = emails.map(e => ({ email: e }));
                    const info = document.getElementById('emailFileInfo');
                    if (info) info.textContent = `✅ Loaded ${emails.length} email addresses`;
                    updateEmailRecipientCount();
                };
                reader.readAsText(file);
            }
        });
    }

    // Source selector changes
    const smsSource = document.getElementById('smsRecipientSource');
    if (smsSource) {
        smsSource.addEventListener('change', function () {
            const fileUpload = document.getElementById('smsFileUpload');
            if (fileUpload) {
                fileUpload.classList.toggle('hidden', this.value !== 'upload');
            }
            updateSmsRecipientCount();
        });
    }

    const emailSource = document.getElementById('emailRecipientSource');
    if (emailSource) {
        emailSource.addEventListener('change', function () {
            const fileUpload = document.getElementById('emailFileUpload');
            if (fileUpload) {
                fileUpload.classList.toggle('hidden', this.value !== 'upload');
            }
            updateEmailRecipientCount();
        });
    }
});

function updateSmsRecipientCount() {
    const source = document.getElementById('smsRecipientSource')?.value || 'current';
    const countEl = document.getElementById('smsRecipientCount');
    if (!countEl) return;

    if (source === 'upload') {
        countEl.textContent = `📊 ${smsRecipientList.length} recipients from file`;
    } else {
        countEl.textContent = `📊 Will use phone numbers from campaign results`;
    }
}

function updateEmailRecipientCount() {
    const source = document.getElementById('emailRecipientSource')?.value || 'current';
    const countEl = document.getElementById('emailRecipientCount');
    if (!countEl) return;

    if (source === 'upload') {
        countEl.textContent = `📊 ${emailRecipientList.length} recipients from file`;
    } else {
        countEl.textContent = `📊 Will use email addresses from campaign results`;
    }
}

// Send SMS Campaign
async function sendSmsCampaign() {
    const source = document.getElementById('smsRecipientSource')?.value || 'current';
    const message = document.getElementById('smsMessageTemplate')?.value;

    if (!message) {
        showToast('Please enter a message template', 'warning');
        return;
    }

    let recipients = [];

    if (source === 'upload') {
        recipients = smsRecipientList;
    } else {
        // Get phones from current campaign results
        const rows = document.querySelectorAll('#resultsTable tbody tr');
        rows.forEach(row => {
            const phone = row.querySelector('td:nth-child(5)')?.textContent?.trim();
            const name = row.querySelector('td:nth-child(2)')?.textContent?.trim();
            if (phone && phone !== '-') {
                recipients.push({ phone, name: name || '' });
            }
        });
    }

    if (recipients.length === 0) {
        showToast('No recipients found. Upload a file or run a campaign first.', 'warning');
        return;
    }

    showToast(`Sending SMS to ${recipients.length} recipients...`, 'info');

    try {
        const response = await fetch('/api/marketing/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipients, message })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`SMS Campaign sent! ${data.sent} sent, ${data.failed} failed`, 'success');
        } else {
            showToast('Error: ' + (data.error || 'Failed to send SMS'), 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Send Email Campaign
async function sendEmailCampaign() {
    const source = document.getElementById('emailRecipientSource')?.value || 'current';
    const subject = document.getElementById('emailSubject')?.value;
    const html = document.getElementById('emailBodyTemplate')?.value;

    if (!subject || !html) {
        showToast('Please enter subject and email body', 'warning');
        return;
    }

    let recipients = [];

    if (source === 'upload') {
        recipients = emailRecipientList;
    } else {
        // Get emails from current campaign results
        const rows = document.querySelectorAll('#resultsTable tbody tr');
        rows.forEach(row => {
            const email = row.querySelector('td:nth-child(6)')?.textContent?.trim();
            const name = row.querySelector('td:nth-child(2)')?.textContent?.trim();
            if (email && email !== '-' && email.includes('@')) {
                recipients.push({ email, name: name || '' });
            }
        });
    }

    if (recipients.length === 0) {
        showToast('No recipients found. Upload a file or run a campaign first.', 'warning');
        return;
    }

    showToast(`Sending emails to ${recipients.length} recipients...`, 'info');

    try {
        const response = await fetch('/api/marketing/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipients, subject, html })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Email Campaign sent! ${data.sent} sent, ${data.failed} failed`, 'success');
        } else {
            showToast('Error: ' + (data.error || 'Failed to send emails'), 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// ===================================
// LinkedIn Sales Navigator Functions
// ===================================

let linkedinState = {
    sessionName: null,
    loggedIn: false,
    searchResults: [],
    jobResults: []
};

// Initialize LinkedIn session
async function initLinkedInSession() {
    const sessionName = document.getElementById('linkedinSessionName')?.value || 'default-linkedin';
    const statusEl = document.getElementById('linkedinSessionStatus');

    if (!sessionName) {
        showToast('Please enter a session name', 'warning');
        return;
    }

    statusEl.innerHTML = '⏳ Starting session...';
    showToast('Starting LinkedIn session. Please log in if needed...', 'info');

    try {
        const response = await fetch('/api/linkedin/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName })
        });
        const data = await response.json();

        if (data.success) {
            linkedinState.sessionName = sessionName;
            linkedinState.loggedIn = data.loggedIn;

            if (data.loggedIn) {
                statusEl.innerHTML = '🟢 Session active and logged in';
                showToast('LinkedIn session ready!', 'success');
            } else {
                statusEl.innerHTML = '🟡 Browser opened - Log in, then click "✅ Confirm Login"';
                showToast('Please log in to LinkedIn in the opened browser window, then click Confirm Login', 'info');
            }
        } else {
            statusEl.innerHTML = '❌ Failed to start session';
            showToast('Failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        statusEl.innerHTML = '❌ Error';
        showToast('Error: ' + e.message, 'error');
    }
}

// Close LinkedIn session
async function closeLinkedInSession() {
    const sessionName = linkedinState.sessionName || document.getElementById('linkedinSessionName')?.value;

    if (!sessionName) {
        showToast('No session to close', 'warning');
        return;
    }

    try {
        await fetch('/api/linkedin/close', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName })
        });

        linkedinState.sessionName = null;
        linkedinState.loggedIn = false;
        document.getElementById('linkedinSessionStatus').innerHTML = '⚪ Session closed';
        showToast('LinkedIn session closed', 'success');
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Confirm LinkedIn login after user has logged in manually
async function confirmLinkedInLogin() {
    const sessionName = linkedinState.sessionName || document.getElementById('linkedinSessionName')?.value;
    const statusEl = document.getElementById('linkedinSessionStatus');

    if (!sessionName) {
        showToast('No session found. Start a session first.', 'warning');
        return;
    }

    statusEl.innerHTML = '⏳ Confirming login... (please wait)';
    showToast('Navigating to LinkedIn feed to confirm login...', 'info');

    try {
        const response = await fetch('/api/linkedin/confirm-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName })
        });
        const data = await response.json();

        console.log('[LinkedIn UI] Confirm response:', data);

        if (data.success && data.loggedIn) {
            linkedinState.loggedIn = true;
            statusEl.innerHTML = '🟢 Logged in and ready!';
            showToast('LinkedIn login confirmed! You can now search.', 'success');
        } else if (data.error) {
            statusEl.innerHTML = '❌ Error: ' + data.error;
            showToast('Error: ' + data.error, 'error');
        } else {
            statusEl.innerHTML = '🔴 Not logged in yet - please log in first';
            showToast('Not logged in yet. Please log in in the browser window first.', 'warning');
        }
    } catch (e) {
        console.error('[LinkedIn UI] Confirm error:', e);
        statusEl.innerHTML = '❌ Error: ' + e.message;
        showToast('Error: ' + e.message, 'error');
    }
}

// Force login - skip all checks and mark as logged in
async function forceLinkedInLogin() {
    const sessionName = linkedinState.sessionName || document.getElementById('linkedinSessionName')?.value;
    const statusEl = document.getElementById('linkedinSessionStatus');

    if (!sessionName) {
        showToast('No session found. Start a session first.', 'warning');
        return;
    }

    statusEl.innerHTML = '⏳ Forcing login...';

    try {
        const response = await fetch('/api/linkedin/confirm-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName, force: true })
        });
        const data = await response.json();

        if (data.success && data.loggedIn) {
            linkedinState.loggedIn = true;
            statusEl.innerHTML = '🟢 Logged in (forced) - Ready!';
            showToast('Session force-marked as logged in! You can now search.', 'success');
        } else {
            statusEl.innerHTML = '❌ Force login failed';
            showToast('Force login failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        statusEl.innerHTML = '❌ Error';
        showToast('Error: ' + e.message, 'error');
    }
}

// Search for people on LinkedIn
async function searchLinkedInPeople() {
    const sessionName = linkedinState.sessionName || document.getElementById('linkedinSessionName')?.value;

    if (!sessionName) {
        showToast('Please start a LinkedIn session first', 'warning');
        return;
    }

    const keywords = document.getElementById('linkedinSearchKeywords')?.value;
    const company = document.getElementById('linkedinSearchCompany')?.value;
    const title = document.getElementById('linkedinSearchTitle')?.value;
    const limit = parseInt(document.getElementById('linkedinSearchLimit')?.value) || 25;

    if (!keywords && !company && !title) {
        showToast('Enter at least one search criteria', 'warning');
        return;
    }

    showToast('Searching LinkedIn...', 'info');

    try {
        const response = await fetch('/api/linkedin/search-people', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName, keywords, company, title, limit })
        });
        const data = await response.json();

        if (data.success) {
            linkedinState.searchResults = data.profiles || [];
            displayLinkedInResults(linkedinState.searchResults);
            showToast(`Found ${data.count} profiles!`, 'success');
        } else {
            showToast('Search failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Display LinkedIn search results
function displayLinkedInResults(profiles) {
    const container = document.getElementById('linkedinResultsContainer');
    const list = document.getElementById('linkedinResultsList');
    const countEl = document.getElementById('linkedinResultCount');

    container?.classList.remove('hidden');
    countEl.textContent = profiles.length;

    list.innerHTML = profiles.map((p, i) => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-card); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--border-color);">
            <input type="checkbox" id="liProfile${i}" checked style="width: 18px; height: 18px;">
            <img src="${p.imageUrl || 'https://via.placeholder.com/48'}" 
                style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">
            <div style="flex: 1;">
                <div style="font-weight: 600;">${p.name || 'Unknown'}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">${p.title || '-'}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${p.location || '-'}</div>
            </div>
            <a href="${p.profileUrl}" target="_blank" 
                style="padding: 6px 12px; background: #0077b5; color: white; border-radius: 4px; text-decoration: none; font-size: 0.8rem;">
                View Profile
            </a>
        </div>
    `).join('');
}

// Extract selected profiles in detail
async function extractSelectedProfiles() {
    const sessionName = linkedinState.sessionName;
    if (!sessionName) {
        showToast('Please start a LinkedIn session first', 'warning');
        return;
    }

    const selectedUrls = [];
    linkedinState.searchResults.forEach((p, i) => {
        const checkbox = document.getElementById(`liProfile${i}`);
        if (checkbox?.checked && p.profileUrl) {
            selectedUrls.push(p.profileUrl);
        }
    });

    if (selectedUrls.length === 0) {
        showToast('No profiles selected', 'warning');
        return;
    }

    showToast(`Extracting ${selectedUrls.length} profiles... This may take a while.`, 'info');

    try {
        const response = await fetch('/api/linkedin/extract-profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName, profileUrls: selectedUrls })
        });
        const data = await response.json();

        if (data.success) {
            linkedinState.searchResults = data.profiles;
            displayLinkedInResults(data.profiles);
            showToast(`Extracted ${data.count} profiles with detailed info!`, 'success');
        } else {
            showToast('Extraction failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Export LinkedIn results to CSV
function exportLinkedInResults() {
    if (linkedinState.searchResults.length === 0) {
        showToast('No results to export', 'warning');
        return;
    }

    const headers = ['Name', 'Title', 'Company', 'Location', 'Profile URL', 'Email', 'About'];
    const rows = linkedinState.searchResults.map(p => [
        p.name || '',
        p.headline || p.title || '',
        p.currentCompany || '',
        p.location || '',
        p.profileUrl || '',
        p.email || '',
        (p.about || '').replace(/,/g, ' ').substring(0, 200)
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin_leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${linkedinState.searchResults.length} profiles to CSV`, 'success');
}

// ===================================
// LinkedIn Job Search Functions
// ===================================

// Search for jobs on LinkedIn
async function searchLinkedInJobs() {
    const sessionName = linkedinState.sessionName || document.getElementById('linkedinSessionName')?.value;

    if (!sessionName) {
        showToast('Please start a LinkedIn session first', 'warning');
        return;
    }

    const keywords = document.getElementById('linkedinJobKeywords')?.value;
    const location = document.getElementById('linkedinJobLocation')?.value;
    const jobType = document.getElementById('linkedinJobType')?.value;
    const experience = document.getElementById('linkedinJobExperience')?.value;

    if (!keywords && !location) {
        showToast('Enter job title or location', 'warning');
        return;
    }

    showToast('Searching LinkedIn Jobs...', 'info');

    try {
        const response = await fetch('/api/linkedin/search-jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionName, keywords, location, jobType, experience, limit: 25 })
        });
        const data = await response.json();

        if (data.success) {
            linkedinState.jobResults = data.jobs || [];
            displayLinkedInJobs(linkedinState.jobResults);
            showToast(`Found ${data.count} jobs!`, 'success');
        } else {
            showToast('Job search failed: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Display LinkedIn job results
function displayLinkedInJobs(jobs) {
    const container = document.getElementById('linkedinJobResultsContainer');
    const list = document.getElementById('linkedinJobResultsList');
    const countEl = document.getElementById('linkedinJobResultCount');

    container?.classList.remove('hidden');
    countEl.textContent = jobs.length;

    list.innerHTML = jobs.map((job, i) => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-card); border-radius: 8px; margin-bottom: 8px; border: 1px solid var(--border-color);">
            <img src="${job.logoUrl || 'https://via.placeholder.com/48?text=🏢'}" 
                style="width: 48px; height: 48px; border-radius: 8px; object-fit: cover;">
            <div style="flex: 1;">
                <div style="font-weight: 600;">${job.title || 'Unknown Position'}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">${job.company || '-'}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">📍 ${job.location || '-'} ${job.salary ? '| 💰 ' + job.salary : ''}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">🕒 ${job.posted || '-'}</div>
            </div>
            <a href="${job.jobUrl}" target="_blank" 
                style="padding: 6px 12px; background: #22c55e; color: white; border-radius: 4px; text-decoration: none; font-size: 0.8rem;">
                View Job
            </a>
        </div>
    `).join('');
}

// Export LinkedIn job results to CSV
function exportLinkedInJobs() {
    if (!linkedinState.jobResults || linkedinState.jobResults.length === 0) {
        showToast('No jobs to export', 'warning');
        return;
    }

    const headers = ['Title', 'Company', 'Location', 'Salary', 'Posted', 'Job URL'];
    const rows = linkedinState.jobResults.map(j => [
        (j.title || '').replace(/,/g, ' '),
        (j.company || '').replace(/,/g, ' '),
        (j.location || '').replace(/,/g, ' '),
        (j.salary || '').replace(/,/g, ' '),
        (j.posted || '').replace(/,/g, ' '),
        j.jobUrl || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin_jobs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${linkedinState.jobResults.length} jobs to CSV`, 'success');
}

// ===================================
// Settings Functions
// ===================================

async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();

        // Proxy
        if (elements.settingsProxyEnabled) elements.settingsProxyEnabled.checked = settings.proxy?.enabled || false;
        if (elements.settingsProxyRotateError) elements.settingsProxyRotateError.checked = settings.proxy?.rotateOnError ?? true;
        if (elements.settingsWebshareApiKey) elements.settingsWebshareApiKey.value = settings.proxy?.webshareApiKey || '';

        // SMTP
        if (elements.settingsSmtpEnabled) elements.settingsSmtpEnabled.checked = settings.smtp?.enabled || false;
        if (elements.settingsSmtpHost) elements.settingsSmtpHost.value = settings.smtp?.host || '';
        if (elements.settingsSmtpPort) elements.settingsSmtpPort.value = settings.smtp?.port || 587;
        if (elements.settingsSmtpUser) elements.settingsSmtpUser.value = settings.smtp?.user || '';
        // Show dots matching password length when saved
        if (elements.settingsSmtpPass) {
            if (settings.smtp?.pass && settings.smtp.pass.startsWith('***:')) {
                const length = parseInt(settings.smtp.pass.split(':')[1]) || 8;
                elements.settingsSmtpPass.value = '•'.repeat(length);
                elements.settingsSmtpPass.dataset.masked = 'true';
            } else {
                elements.settingsSmtpPass.value = settings.smtp?.pass || '';
            }
        }

        // Twilio
        if (elements.settingsTwilioEnabled) elements.settingsTwilioEnabled.checked = settings.twilio?.enabled || false;
        if (elements.settingsTwilioSid) elements.settingsTwilioSid.value = settings.twilio?.accountSid || '';
        // Show dots matching token length when saved
        if (elements.settingsTwilioToken) {
            if (settings.twilio?.authToken && settings.twilio.authToken.startsWith('***:')) {
                const length = parseInt(settings.twilio.authToken.split(':')[1]) || 8;
                elements.settingsTwilioToken.value = '•'.repeat(length);
                elements.settingsTwilioToken.dataset.masked = 'true';
            } else {
                elements.settingsTwilioToken.value = settings.twilio?.authToken || '';
            }
        }
        if (elements.settingsTwilioPhone) elements.settingsTwilioPhone.value = settings.twilio?.fromNumber || '';

        // AI settings removed

        // API Keys
        if (elements.settingsApiZerobounce) elements.settingsApiZerobounce.value = settings.apiKeys?.zerobounce || '';

        console.log('Settings loaded');
    } catch (error) {
        console.error('Failed to load settings:', error);
        showToast('Failed to load settings', 'error');
    }
}

async function saveSettings() {
    const settings = {
        proxy: {
            enabled: elements.settingsProxyEnabled?.checked || false,
            rotateOnError: elements.settingsProxyRotateError?.checked || false,
            webshareApiKey: elements.settingsWebshareApiKey?.value || ''
        },
        smtp: {
            enabled: elements.settingsSmtpEnabled?.checked || false,
            host: elements.settingsSmtpHost?.value || '',
            port: parseInt(elements.settingsSmtpPort?.value) || 587,
            user: elements.settingsSmtpUser?.value || '',
            // Send '***' if showing masked dots or empty - preserve existing password
            pass: (/^•+$/.test(elements.settingsSmtpPass?.value) || !elements.settingsSmtpPass?.value) ? '***' : elements.settingsSmtpPass.value
        },
        twilio: {
            enabled: elements.settingsTwilioEnabled?.checked || false,
            accountSid: elements.settingsTwilioSid?.value || '',
            // Send '***' if showing masked dots or empty - preserve existing token
            authToken: (/^•+$/.test(elements.settingsTwilioToken?.value) || !elements.settingsTwilioToken?.value) ? '***' : elements.settingsTwilioToken.value,
            fromNumber: elements.settingsTwilioPhone?.value || ''
        },
        ai: {
            provider: elements.settingsAiProvider?.value || 'openai',
            apiKey: elements.settingsAiKey?.value || '',
            geminiModel: elements.settingsGeminiModel?.value || 'gemini-1.5-flash',
            baseUrl: elements.settingsAiBaseUrl?.value || '',
            model: elements.settingsAiModel?.value || ''
        },
        apiKeys: {
            zerobounce: elements.settingsApiZerobounce?.value || ''
        }
    };

    try {
        elements.btnSaveSettings.disabled = true;
        elements.btnSaveSettings.textContent = 'Saving...';

        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        const data = await response.json();

        if (data.success) {
            showToast('Settings saved successfully!', 'success');
        } else {
            showToast('Error saving settings: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    } finally {
        elements.btnSaveSettings.disabled = false;
        elements.btnSaveSettings.textContent = '💾 Save Settings';
    }
}

// ===================================
// Enhanced Marketing Functions
// ===================================

function updateSmsCharCount() {
    const textarea = document.getElementById('smsMessageTemplate');
    const countDisplay = document.getElementById('smsCharCount');
    if (!textarea || !countDisplay) return;

    const text = textarea.value;
    const length = text.length;
    const gsm7bit = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1b\f^{}\\[~]|€";
    let isGsm = true;

    // Check if GSM 7-bit compatible
    for (let i = 0; i < length; i++) {
        if (!gsm7bit.includes(text[i]) && !text[i].match(/[a-zA-Z0-9 !\"#%&'()*+,-./:;<=>?]/)) {
            isGsm = false;
            break;
        }
    }

    const maxPerSegment = isGsm ? 160 : 70;
    const segments = Math.ceil(length / maxPerSegment) || 1;

    countDisplay.textContent = `${length} chars (${segments} segment${segments > 1 ? 's' : ''}) ${isGsm ? '' : '(Unicode)'}`;
}

function insertSmsVariable(variable) {
    const textarea = document.getElementById('smsMessageTemplate');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    textarea.value = text.substring(0, start) + variable + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + variable.length;

    updateSmsCharCount();
}

function insertEmailVariable(variable) {
    const textarea = document.getElementById('emailBodyTemplate');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    textarea.value = text.substring(0, start) + variable + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + variable.length;
}

function loadEmailTemplate() {
    const select = document.getElementById('emailTemplateSelect');
    const subjectResult = document.getElementById('emailSubject');
    const bodyResult = document.getElementById('emailBodyTemplate');

    if (!select || !subjectResult || !bodyResult) return;

    const template = select.value;

    const templates = {
        'intro': {
            subject: 'Introducing our services to {{company}}',
            body: '<h1>Hello {{name}},</h1>\n<p>I hope this email finds you well.</p>\n<p>We provide top-notch services that could benefit {{company}} greatly.</p>\n<p>Best,<br>The Team</p>'
        },
        'followup': {
            subject: 'Quick follow up regarding {{company}}',
            body: '<h1>Hi {{name}},</h1>\n<p>Just wanted to circle back on our previous conversation.</p>\n<p>Let me know if you have any questions.</p>'
        },
        'offer': {
            subject: 'Exclusive offer for {{company}}',
            body: '<h1>Special Deal!</h1>\n<p>Hi {{name}}, we have a special offer just for you.</p>'
        },
        'partnership': {
            subject: 'Partnership opportunity with {{company}}',
            body: '<h1>Partnership Proposal</h1>\n<p>Dear {{name}},</p>\n<p>We are interested in exploring a partnership with {{company}}.</p>'
        }
    };

    if (templates[template]) {
        subjectResult.value = templates[template].subject;
        bodyResult.value = templates[template].body;
    }
}

function toggleEmailPreview() {
    const previewPane = document.getElementById('emailPreviewPane');
    const previewContent = document.getElementById('emailPreviewContent');
    const body = document.getElementById('emailBodyTemplate').value;

    if (previewPane.classList.contains('hidden')) {
        previewContent.innerHTML = body.replace(/{{name}}/g, 'John Doe')
            .replace(/{{company}}/g, 'Acme Corp')
            .replace(/{{email}}/g, 'john@example.com');
        previewPane.classList.remove('hidden');
    } else {
        previewPane.classList.add('hidden');
    }
}

// Initialize Marketing Send Buttons
document.addEventListener('DOMContentLoaded', function () {
    const btnSendSms = document.getElementById('btnSendSms');
    if (btnSendSms) {
        btnSendSms.addEventListener('click', () => sendMarketingCampaign('sms'));
    }

    const btnTestSms = document.getElementById('btnTestSms');
    if (btnTestSms) {
        btnTestSms.addEventListener('click', () => sendMarketingCampaign('sms', true));
    }

    const btnSendEmail = document.getElementById('btnSendEmail');
    if (btnSendEmail) {
        btnSendEmail.addEventListener('click', () => sendMarketingCampaign('email'));
    }

    const btnTestEmail = document.getElementById('btnTestEmail');
    if (btnTestEmail) {
        btnTestEmail.addEventListener('click', () => sendMarketingCampaign('email', true));
    }

    // Attach event listeners for email attachments
    const emailAttachments = document.getElementById('emailAttachments');
    if (emailAttachments) {
        emailAttachments.addEventListener('change', handleEmailAttachments);
    }
});

let emailAttachmentFiles = [];

function handleEmailAttachments(e) {
    const files = Array.from(e.target.files);

    // Add to global list
    emailAttachmentFiles = [...emailAttachmentFiles, ...files];

    renderEmailAttachments();
}

function renderEmailAttachments() {
    const list = document.getElementById('emailAttachmentsList');
    if (!list) return;

    list.innerHTML = emailAttachmentFiles.map((file, i) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); padding: 8px; border-radius: 4px; border: 1px solid var(--border-color); margin-top: 4px;">
            <span style="font-size: 0.9em;">📎 ${file.name} (${(file.size / 1024).toFixed(1)} KB)</span>
            <button onclick="removeEmailAttachment(${i})" style="color: #ef4444; background: none; border: none; cursor: pointer;">×</button>
        </div>
    `).join('');
}

window.removeEmailAttachment = function (index) {
    emailAttachmentFiles.splice(index, 1);
    renderEmailAttachments();
};

async function sendMarketingCampaign(type, isTest = false) {
    try {
        const endpoint = type === 'sms' ? '/api/marketing/send-sms' : '/api/marketing/send-email';
        let payload = {};

        if (type === 'sms') {
            const senderId = document.getElementById('smsSenderId')?.value?.trim();
            const message = document.getElementById('smsMessageTemplate')?.value?.trim();
            const source = document.getElementById('smsRecipientSource')?.value;
            const schedule = document.querySelector('input[name="smsSchedule"]:checked')?.value;
            const scheduleTime = schedule === 'later' ? document.getElementById('smsScheduleTime')?.value : null;
            const rateLimit = document.getElementById('smsRateLimit')?.value;
            const delay = document.getElementById('smsDelay')?.value;
            const optOut = document.getElementById('smsOptOut')?.checked;
            const trackLinks = document.getElementById('smsTrackLinks')?.checked;
            const testMode = document.getElementById('smsTestMode')?.checked || isTest;

            if (!message) throw new Error('Message is required');

            // Gather recipients
            let recipients = [];
            if (testMode && isTest) {
                const phone = prompt("Enter test phone number:");
                if (!phone) return;
                recipients = [{ phone, name: 'Test User' }];
            } else if (source === 'upload') {
                recipients = marketingState.smsPhones.map(p => ({ phone: p }));
            } else if (source === 'current') {
                const rows = document.querySelectorAll('#resultsTableBody tr[data-result-id]');
                rows.forEach(row => {
                    const phoneCell = row.cells[2];
                    const nameCell = row.cells[1];
                    if (phoneCell) {
                        const phoneMatch = phoneCell.textContent.trim().match(/[0-9]{10,}/);
                        if (phoneMatch) {
                            const name = nameCell ? nameCell.querySelector('div')?.textContent.trim() : '';
                            recipients.push({ phone: phoneMatch[0], name });
                        }
                    }
                });
            }

            if (recipients.length === 0) throw new Error('No recipients found');

            payload = {
                recipients,
                message,
                senderId,
                scheduleTime,
                rateLimit: parseInt(rateLimit),
                delay: parseInt(delay),
                optOut,
                trackLinks
            };

            if (testMode && isTest) {
                const res = await fetch('/api/marketing/send-single-sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: recipients[0].phone, message, senderId })
                });
                const data = await res.json();
                if (data.success || data.sid) showToast('Test SMS Sent!', 'success');
                else showToast('Test failed: ' + (data.error || data.message), 'error');
                return;
            }

        } else if (type === 'email') {
            const subject = document.getElementById('emailSubject')?.value?.trim();
            const html = document.getElementById('emailBodyTemplate')?.value?.trim();
            const fromName = document.getElementById('emailFromName')?.value?.trim();
            const replyTo = document.getElementById('emailReplyTo')?.value?.trim();
            const cc = document.getElementById('emailCc')?.value?.trim();
            const bcc = document.getElementById('emailBcc')?.value?.trim();
            const source = document.getElementById('emailRecipientSource')?.value;
            const schedule = document.querySelector('input[name="emailSchedule"]:checked')?.value;
            const scheduleTime = schedule === 'later' ? document.getElementById('emailScheduleTime')?.value : null;
            const rateLimit = document.getElementById('emailRateLimit')?.value;
            const trackOpens = document.getElementById('emailTrackOpens')?.checked;
            const trackClicks = document.getElementById('emailTrackClicks')?.checked;
            const includeUnsubscribe = document.getElementById('emailUnsubscribe')?.checked;
            const priority = document.getElementById('emailPriority')?.value;
            const testMode = document.getElementById('emailTestMode')?.checked || isTest;

            if (!subject) throw new Error('Subject is required');
            if (!html) throw new Error('Email body is required');

            // Gather recipients
            let recipients = [];
            if (testMode && isTest) {
                const email = prompt("Enter test email address:");
                if (!email) return;
                recipients = [{ email, name: 'Test User' }];
            } else if (source === 'upload') {
                recipients = marketingState.emailAddresses.map(e => ({ email: e }));
            } else if (source === 'current') {
                const rows = document.querySelectorAll('#resultsTableBody tr[data-result-id]');
                rows.forEach(row => {
                    const emailCell = row.cells[3];
                    const nameCell = row.cells[1];
                    if (emailCell && emailCell.textContent.includes('@')) {
                        const name = nameCell ? nameCell.querySelector('div')?.textContent.trim() : '';
                        recipients.push({ email: emailCell.textContent.trim(), name });
                    }
                });
            }

            if (recipients.length === 0) throw new Error('No recipients found');

            const processedAttachments = await Promise.all(emailAttachmentFiles.map(async file => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = e => resolve({
                        filename: file.name,
                        content: e.target.result.split(',')[1],
                        contentType: file.type
                    });
                    reader.readAsDataURL(file);
                });
            }));

            payload = {
                recipients,
                subject,
                html,
                text: html.replace(/<[^>]*>/g, ''),
                fromName,
                replyTo,
                cc,
                bcc,
                scheduleTime,
                rateLimit: parseInt(rateLimit),
                trackOpens,
                trackClicks,
                includeUnsubscribe,
                priority,
                attachments: processedAttachments
            };

            if (testMode && isTest) {
                const res = await fetch('/api/marketing/send-single-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: recipients[0].email,
                        subject,
                        html,
                        fromName,
                        replyTo
                    })
                });
                const data = await res.json();
                if (data.success || data.messageId) showToast('Test Email Sent!', 'success');
                else showToast('Test failed: ' + (data.error || data.message), 'error');
                return;
            }
        }

        showToast(`Sending ${type.toUpperCase()} campaign to ${payload.recipients.length} recipients...`, 'info');

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            showToast(`${type.toUpperCase()} Campaign Sent! Success: ${data.sent || 0}, Failed: ${data.failed || 0}`, 'success');
            if (data.scheduled) showToast('Campaign scheduled successfully!', 'success');
        } else {
            showToast('Campaign Error: ' + (data.error || 'Unknown error'), 'error');
        }

    } catch (e) {
        showToast('Error: ' + e.message, 'error');
        console.error(e);
    }
}
// Bulk Screenshots Logic
let screenshotFile = null;

document.addEventListener('DOMContentLoaded', () => {
    // Tab Switching for Tools
    const toolsNavItem = document.querySelector('[data-page="tools"]');
    if (toolsNavItem) {
        toolsNavItem.addEventListener('click', (e) => {
            e.preventDefault();
            // Hide all pages
            document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

            // Show Tools page
            document.getElementById('pageTools').classList.remove('hidden');
            toolsNavItem.classList.add('active');
        });
    }

    // File Drop Zone
    const dropZone = document.getElementById('screenshotDropZone');
    const fileInput = document.getElementById('screenshotFile');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => handleScreenshotFile(e.target.files[0]));

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--accent-primary)';
            dropZone.style.background = 'var(--bg-tertiary)';
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color)';
            dropZone.style.background = 'transparent';
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--border-color)';
            dropZone.style.background = 'transparent';
            if (e.dataTransfer.files.length) {
                handleScreenshotFile(e.dataTransfer.files[0]);
            }
        });
    }

    // Start Button
    const btnStart = document.getElementById('btnStartScreenshots');
    if (btnStart) {
        btnStart.addEventListener('click', startBulkScreenshots);
    }
});

function handleScreenshotFile(file) {
    if (!file) return;
    screenshotFile = file;
    document.getElementById('screenshotFileInfo').textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
}

async function startBulkScreenshots() {
    if (!screenshotFile) {
        showToast('Please upload a domains list first', 'error');
        return;
    }

    const browser = document.getElementById('screenshotBrowser').value;
    // Get selected devices from checkboxes
    const devices = Array.from(document.querySelectorAll('input[name="screenshotDevice"]:checked')).map(cb => cb.value);

    if (devices.length === 0) {
        showToast('Please select at least one device type', 'error');
        return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const urls = text.split('\n').map(l => l.trim()).filter(l => l);

        if (urls.length === 0) {
            showToast('No valid URLs found in file', 'error');
            return;
        }

        // Reset UI
        document.getElementById('screenshotProgressSection').classList.remove('hidden');
        document.getElementById('screenshotResultsGrid').innerHTML = '';

        // Calculate total tasks (urls * devices)
        const totalTasks = urls.length * devices.length;
        updateScreenshotProgress(0, totalTasks);

        // Show initial cards for each URL + Device combo
        urls.forEach((url, urlIndex) => {
            devices.forEach((device) => {
                const cardId = `shot-card-${urlIndex}-${device}`;
                const card = document.createElement('div');
                card.id = cardId;
                card.className = 'card';
                card.style.padding = '16px';

                let deviceIcon = '🖥️';
                if (device === 'laptop') deviceIcon = '💻';
                if (device === 'tablet') deviceIcon = '📱';
                if (device === 'mobile') deviceIcon = '📱';

                card.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${url}">${url}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">${deviceIcon} ${device}</div>
                    <div class="status-badge" style="background: var(--bg-tertiary); display: inline-block;">Waiting...</div>
                    <div class="result-image" style="margin-top: 12px; display: none;"></div>
                 `;
                document.getElementById('screenshotResultsGrid').appendChild(card);
            });
        });

        try {
            const screenshotId = 'screenshot-' + Date.now(); // Pseudo-ID for WS updates

            // Subscribe to WS updates for this ID
            if (typeof subscribeToCampaign === 'function') {
                subscribeToCampaign(screenshotId);
            }

            showToast(`Starting capture for ${urls.length} URLs on ${devices.length} devices...`, 'info');

            const response = await fetch('/api/tools/screenshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urls,
                    browser,
                    devices,
                    campaignId: screenshotId
                })
            });

            const data = await response.json();
            if (data.success) {
                document.getElementById('screenshotSavePath').textContent = data.savePath;
                showToast('Screenshot job started!', 'success');
            } else {
                showToast('Error: ' + data.error, 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Request failed', 'error');
        }
    };
    reader.readAsText(screenshotFile);
}

function updateScreenshotProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    document.getElementById('screenshotProgressText').textContent = `${current} / ${total}`;
    document.getElementById('screenshotProgressBar').style.width = `${percent}%`;
}

// Update WS handler to catch screenshot events if not already generic
// (Assuming generic 'progress' and 'result' events will work with existing or new logic)
// I will explicitly check for 'screenshot_result' type in the existing WS handler or add a specific listener here if possible.
// Since app.js structure is monolithic, better to rely on the server sending standard 'result' or handled here.
// Let's modify the generic broadcast handler in app.js later if needed, but for now we rely on standard 'progress' events.

// ===================================
// Email Verification Functions
// ===================================

// Store verification results
let emailVerificationResults = { valid: [], invalid: [] };

async function verifyEmails() {
    const fileInput = document.getElementById('verifyEmailFile');
    const method = document.getElementById('emailVerifyMethod').value;

    if (!fileInput.files.length) {
        showToast('Please upload an email list first', 'error');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        const text = e.target.result;
        const emails = text.split('\n').map(l => l.trim()).filter(l => l && l.includes('@'));

        if (emails.length === 0) {
            showToast('No valid emails found in file', 'error');
            return;
        }

        // Reset results
        emailVerificationResults = { valid: [], invalid: [] };

        // Show progress
        document.getElementById('verifyEmailProgress').classList.remove('hidden');
        document.getElementById('verifyEmailResults').classList.add('hidden');
        document.getElementById('verifyEmailStatus').textContent = 'Verifying...';
        document.getElementById('verifyEmailCount').textContent = `0 / ${emails.length}`;

        showToast(`Starting verification of ${emails.length} emails...`, 'info');

        try {
            const response = await fetch('/api/verify/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails, method })
            });

            const data = await response.json();

            if (data.success) {
                emailVerificationResults = data.results || { valid: [], invalid: [] };

                // Update UI
                document.getElementById('verifyEmailProgress').classList.add('hidden');
                document.getElementById('verifyEmailResults').classList.remove('hidden');
                document.getElementById('validEmailCount').textContent = emailVerificationResults.valid.length;
                document.getElementById('invalidEmailCount').textContent = emailVerificationResults.invalid.length;

                showToast(`Verification complete! ${emailVerificationResults.valid.length} valid, ${emailVerificationResults.invalid.length} invalid`, 'success');
            } else {
                showToast('Verification failed: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Verification request failed', 'error');
        }
    };

    reader.readAsText(file);
}

function exportVerifiedEmails(type = 'valid') {
    const emails = emailVerificationResults[type] || [];

    if (emails.length === 0) {
        showToast(`No ${type} emails to export. Run verification first.`, 'error');
        return;
    }

    const content = emails.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_emails_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${emails.length} ${type} emails`, 'success');
}

// ===================================
// WhatsApp Number Verification Functions
// ===================================

// Store WhatsApp verification results
let whatsappVerificationResults = { valid: [], invalid: [] };

// NOTE: verifyWhatsAppNumbers function is defined earlier in the file (line ~4456)
// That version correctly uses /api/whatsapp/check-number API

function exportVerifiedWhatsApp(type = 'valid') {
    // Use verifiedWhatsApp from the verification function (line ~4333)
    const numbers = verifiedWhatsApp[type] || [];

    if (numbers.length === 0) {
        showToast(`No ${type} WhatsApp numbers to export. Run verification first.`, 'error');
        return;
    }

    const content = numbers.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp_${type}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${numbers.length} ${type} WhatsApp numbers`, 'success');
}

// Delete a WhatsApp session
async function deleteWhatsAppSession(sessionName) {
    if (!confirm(`Are you sure you want to delete session "${sessionName}"? This will remove all saved login data.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/whatsapp/session/${encodeURIComponent(sessionName)}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Session "${sessionName}" deleted successfully`, 'success');
            // Refresh sessions list
            loadWhatsAppSessions();
        } else {
            showToast('Error deleting session: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (err) {
        console.error('Delete session error:', err);
        showToast('Error deleting session: ' + err.message, 'error');
    }
}

// Note: loadWhatsAppSessions is defined at line 3172
// This duplicate was removed to fix session dropdown population
