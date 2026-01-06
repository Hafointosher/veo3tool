// ============================================================
// AUTO FLOW PRO - CONTENT SCRIPT v8.0.0
// ============================================================

// ============================================================
// LOGGER MODULE
// ============================================================
const Logger = {
    logs: [],
    MAX_LOGS: 500,
    MAX_DATA_LENGTH: 300,

    log(type, message, data = {}) {
        try {
            let dataStr = '';
            try {
                dataStr = typeof data === 'string' ? data : JSON.stringify(data);
                if (dataStr.length > this.MAX_DATA_LENGTH) {
                    dataStr = dataStr.substring(0, this.MAX_DATA_LENGTH) + '...';
                }
            } catch (e) {
                dataStr = '[Serialization Error]';
            }

            const entry = {
                timestamp: new Date().toISOString(),
                type,
                message: String(message).substring(0, 200),
                data: dataStr
            };
            this.logs.push(entry);

            const logFn = type === 'error' ? console.error : type === 'warn' ? console.warn : console.log;
            logFn(`[AutoFlow ${type.toUpperCase()}]`, message, data);

            // Strict log size limit - keep only last MAX_LOGS entries
            if (this.logs.length > this.MAX_LOGS) {
                this.logs = this.logs.slice(-Math.floor(this.MAX_LOGS * 0.8));
            }
        } catch (e) {
            console.error('[AutoFlow] Logger error:', e);
        }
    },

    info(message, data) { this.log('info', message, data); },
    warn(message, data) { this.log('warn', message, data); },
    error(message, data) { this.log('error', message, data); },
    success(message, data) { this.log('success', message, data); },

    export() { return [...this.logs]; },
    
    clear() { this.logs = []; }
};

// ============================================================
// SELECTOR ENGINE - DYNAMIC & LEARNING
// ============================================================
const SelectorEngine = {
    cache: new Map(),

    patterns: {
        generateButton: [
            "//button[.//span[contains(text(), 'Generate')]]",
            "//button[.//span[contains(text(), 'Tạo')]]",
            "//button[contains(@aria-label, 'Send prompt')]",
            "//button[contains(@aria-label, 'Gửi')]",
            "//button[.//i[contains(text(), 'arrow_forward')]]",
            "//button[.//span[contains(text(), 'arrow_forward')]]",
            "//button[.//i[contains(text(), 'send')]]",
            "//button[.//span[contains(text(), 'send')]]",
            "//button[contains(@class, 'mat-mdc-fab')]",
            "button.generate-button"
        ],
        promptInput: [
            "textarea",
            "div[contenteditable='true']",
            "[data-testid='prompt-input']",
            ".prompt-textarea"
        ],
        tuneButton: [
            "//button[contains(@aria-label, 'Settings')]",
            "//button[.//span[contains(text(), 'Tune')]]",
            "//button[.//i[contains(text(), 'tune')]]",
            "//button[.//span[contains(text(), 'tune')]]"
        ],
        textTab: [
            "//button[.//span[contains(text(), 'Text')]]",
            "//div[contains(text(), 'Text to Video')]",
            "//span[contains(text(), 'Từ văn bản sang video')]",
            "//div[contains(text(), 'Từ văn bản sang video')]",
            "//button[contains(., 'Text')]",
            "//div[@role='tab'][contains(., 'Text')]",
            "//div[contains(@class, 'tab')][contains(., 'Text')]",
            "//span[contains(text(), 'Text to video')]",
            "[data-tab='text']",
            ".text-tab"
        ],
        imageTab: [
            "//button[.//span[contains(text(), 'Image')]]",
            "//div[contains(text(), 'Image to Video')]",
            "//span[contains(text(), 'Tạo video từ các khung hình')]",
            "//div[contains(text(), 'Tạo video từ các khung hình')]"
        ],
        uploadButton: [
            "//span[contains(text(), 'Tải lên')]",
            "//div[contains(text(), 'Tải lên')]",
            "//li[contains(., 'Tải lên')]",
            "//button[contains(., 'Tải lên')]",
            "//span[contains(text(), 'Upload')]",
            "//button[contains(., 'Upload')]"
        ],
        addButton: [
            "//button[.//span[contains(@class, 'material-icons') and contains(text(), 'add')]]",
            "//div[@role='button'][.//span[contains(text(), '+')]]",
            "//button[contains(@aria-label, 'Add')]",
            ".add-button",
            "//div[contains(@class, 'placeholder')][.//span[contains(text(), '+')]]"
        ],
        cropSaveButton: [
            "//span[contains(text(), 'Cắt và lưu')]",
            "//button[contains(., 'Cắt và lưu')]",
            "//span[contains(text(), 'Crop and save')]",
            "//button[contains(., 'Crop and save')]"
        ],
        downloadButton: [
            "//button[contains(@aria-label, 'Download')]",
            "//button[contains(@aria-label, 'Tải xuống')]",
            "//button[.//i[contains(text(), 'download')]]",
            "//button[.//span[contains(text(), 'download')]]"
        ],
        retryButton: [
            "//button[@title='Sử dụng lại câu lệnh']",
            "//button[@aria-label='Sử dụng lại câu lệnh']",
            "//button[@title='Use prompt again']",
            "//button[@aria-label='Use prompt again']",
            "//button[.//span[contains(text(), 'reuse')]]"
        ]
    },

    async find(elementType, options = {}) {
        const { timeout = 5000, retries = 3 } = options;

        // Check cache first
        if (this.cache.has(elementType)) {
            const cachedSelector = this.cache.get(elementType);
            const el = this.querySelector(cachedSelector);
            if (el) {
                Logger.info(`Found ${elementType} from cache`);
                return el;
            }
            // Cache invalid, remove
            this.cache.delete(elementType);
        }

        // Try all patterns with retry
        const patterns = this.patterns[elementType] || [];

        for (let attempt = 0; attempt < retries; attempt++) {
            for (const pattern of patterns) {
                const el = this.querySelector(pattern);
                if (el) {
                    this.cache.set(elementType, pattern);
                    Logger.success(`Found ${elementType} using: ${pattern}`, { attempt });
                    return el;
                }
            }

            if (attempt < retries - 1) {
                await sleep(timeout / retries);
            }
        }

        Logger.warn(`Element not found: ${elementType}`);
        return null;
    },

    querySelector(pattern) {
        if (pattern.startsWith('//')) {
            return getElementByXpath(pattern);
        }
        return document.querySelector(pattern);
    },

    // Learn new selector from user
    learn(elementType, selector) {
        if (!this.patterns[elementType]) {
            this.patterns[elementType] = [];
        }
        // Add to beginning for priority
        this.patterns[elementType].unshift(selector);
        Logger.info(`Learned new selector for ${elementType}: ${selector}`);

        // Save to storage
        chrome.storage.local.get('selectorPatterns', (data) => {
            const patterns = data.selectorPatterns || {};
            patterns[elementType] = this.patterns[elementType];
            chrome.storage.local.set({ selectorPatterns: patterns });
        });
    },

    // Load learned patterns from storage
    async loadPatterns() {
        const data = await chrome.storage.local.get('selectorPatterns');
        if (data.selectorPatterns) {
            for (const [type, patterns] of Object.entries(data.selectorPatterns)) {
                if (Array.isArray(patterns)) {
                    this.patterns[type] = [...patterns, ...(this.patterns[type] || [])];
                }
            }
            Logger.info('Loaded selector patterns from storage');
        }
    }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function getElementByXpath(path) {
    try {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (e) {
        return null;
    }
}

function getAllElementsByXpath(path) {
    try {
        const result = document.evaluate(path, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const elements = [];
        for (let i = 0; i < result.snapshotLength; i++) {
            elements.push(result.snapshotItem(i));
        }
        return elements;
    } catch (e) {
        return [];
    }
}

function findElementByText(tag, text) {
    return getElementByXpath(`//${tag}[contains(., '${text}')]`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// RETRY MECHANISM
// ============================================================
async function withRetry(fn, options = {}) {
    const { maxRetries = 3, delay = 1000, backoff = 1.5, onRetry = null } = options;

    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;
            Logger.warn(`Retry ${i + 1}/${maxRetries}: ${e.message}`);

            if (onRetry) onRetry(i, e);

            if (i < maxRetries - 1) {
                await sleep(delay * Math.pow(backoff, i));
            }
        }
    }
    throw lastError;
}

// Wait for element with timeout
async function waitForElement(selectorOrFn, timeout = 10000, interval = 500) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        let el;
        if (typeof selectorOrFn === 'function') {
            el = selectorOrFn();
        } else if (selectorOrFn.startsWith('//')) {
            el = getElementByXpath(selectorOrFn);
        } else {
            el = document.querySelector(selectorOrFn);
        }

        if (el) return el;
        await sleep(interval);
    }

    throw new Error(`Element not found after ${timeout}ms`);
}

// ============================================================
// RATE LIMITER
// ============================================================
const RateLimiter = {
    requests: [],
    limits: {
        perMinute: 12,
        perHour: 120
    },

    async checkAndWait() {
        const now = Date.now();

        // Clean old requests
        this.requests = this.requests.filter(t => now - t < 3600000);

        // Check minute limit
        const lastMinute = this.requests.filter(t => now - t < 60000);
        if (lastMinute.length >= this.limits.perMinute) {
            const waitTime = 60000 - (now - lastMinute[0]) + 1000;
            Logger.warn(`Rate limit reached. Waiting ${Math.round(waitTime / 1000)}s...`);
            await sleep(waitTime);
        }

        // Check hour limit
        if (this.requests.length >= this.limits.perHour) {
            const waitTime = 3600000 - (now - this.requests[0]) + 1000;
            Logger.warn(`Hourly limit reached. Waiting ${Math.round(waitTime / 60000)}min...`);
            await sleep(waitTime);
        }
    },

    record() {
        this.requests.push(Date.now());
    },

    getStats() {
        const now = Date.now();
        return {
            lastMinute: this.requests.filter(t => now - t < 60000).length,
            lastHour: this.requests.filter(t => now - t < 3600000).length
        };
    }
};

// ============================================================
// FIND ALL PROMPT CONTAINERS (Fixed!)
// ============================================================
function findAllPromptContainers() {
    // Try multiple selectors for job containers
    const selectors = [
        '.job-container',
        '[data-prompt-container]',
        '.generation-card',
        '.video-generation-item',
        '.prompt-result-container',
        'div[class*="generation"]',
        'div[class*="result-card"]'
    ];

    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            return Array.from(elements);
        }
    }

    // Fallback: Find containers that have both prompt text and video/progress
    const allDivs = document.querySelectorAll('div');
    const containers = [];

    allDivs.forEach(div => {
        const hasPromptText = div.querySelector('p, span, div.prompt-text');
        const hasVideoOrProgress = div.querySelector('video, [class*="progress"], [class*="percent"]');
        if (hasPromptText && hasVideoOrProgress && div.offsetHeight > 100) {
            containers.push(div);
        }
    });

    return containers;
}

// ============================================================
// 1. SETUP ZOOM
// ============================================================
async function setZoom(factor = 1.0) {
    try {
        await chrome.runtime.sendMessage({ action: "SET_BROWSER_ZOOM", zoomFactor: factor });
        Logger.success(`Zoom set to ${factor * 100}%`);
    } catch (e) {
        Logger.error("Failed to set zoom", e);
    }
}

// ============================================================
// 2. CONFIGURE FLOW SETTINGS
// ============================================================
async function configureSettings(config) {
    Logger.info("Configuring settings", config);

    try {
        // A. Click Tune/Settings button
        const tuneBtn = await SelectorEngine.find('tuneButton', { timeout: 3000, retries: 2 });

        if (tuneBtn) {
            tuneBtn.click();
            await sleep(1000);
        } else {
            Logger.warn("Tune button not found. Panel might be open.");
        }

        // B. Set Model
        if (config.model) {
            await selectDropdownOption("Model", config.model);
        }

        // C. Set Aspect Ratio
        if (config.ratio) {
            await selectDropdownOption("Aspect ratio", config.ratio);
        }

        // D. Set Duration/Count
        if (config.count) {
            let countVal = String(config.count);
            if (countVal === "100") countVal = "4";
            await selectDropdownOption("Duration", countVal);
        }

        Logger.success("Settings configured");
    } catch (e) {
        Logger.error("Failed to configure settings", e);
        throw e;
    }
}

async function selectDropdownOption(labelText, optionText) {
    Logger.info(`Setting ${labelText} to ${optionText}`);

    try {
        // Define label variations (English + Vietnamese)
        const labelVariations = {
            "Model": ["Model", "Mô hình", "model"],
            "Aspect ratio": ["Aspect ratio", "Tỷ lệ khung hình", "Tỷ lệ", "ratio"],
            "Duration": ["Duration", "Thời lượng", "Number", "Số lượng", "Count"]
        };

        const labelsToTry = labelVariations[labelText] || [labelText];

        // Try each label variation
        let label = null;
        for (const lblTry of labelsToTry) {
            label = findElementByText('span', lblTry) ||
                findElementByText('div', lblTry) ||
                findElementByText('label', lblTry);
            if (label) break;
        }

        // Fallback: Try to find any clickable element with partial text
        if (!label) {
            const allElements = document.querySelectorAll('span, div, label');
            for (const el of allElements) {
                const txt = el.textContent?.toLowerCase() || '';
                if (labelsToTry.some(l => txt.includes(l.toLowerCase()))) {
                    label = el;
                    break;
                }
            }
        }

        if (label) {
            // Click to open dropdown
            label.click();
            await sleep(600);

            // Define option text variations
            const optionVariations = {
                "Veo 3.1 fast": ["Veo 3.1", "fast", "3.1 fast", "Veo 3.1 (Fast)"],
                "Veo 3.1 Quality": ["Quality", "3.1 Quality", "Veo 3.1 (Quality)"],
                "Ngang": ["Ngang", "16:9", "Landscape", "Horizontal"],
                "Dọc": ["Dọc", "9:16", "Portrait", "Vertical"],
                "Vuông": ["Vuông", "1:1", "Square"]
            };

            const optionsToTry = optionVariations[optionText] || [optionText];

            // Try to find option with variations
            let option = null;
            for (const optTry of optionsToTry) {
                option = getElementByXpath(`//li[contains(., '${optTry}')]`) ||
                    getElementByXpath(`//div[@role='option'][contains(., '${optTry}')]`) ||
                    getElementByXpath(`//mat-option[contains(., '${optTry}')]`) ||
                    getElementByXpath(`//*[@role='menuitem'][contains(., '${optTry}')]`);
                if (option) break;
            }

            // Fallback: Search all menu items
            if (!option) {
                const menuItems = document.querySelectorAll('li, [role="option"], [role="menuitem"], mat-option');
                for (const item of menuItems) {
                    const itemText = item.textContent?.toLowerCase() || '';
                    if (optionsToTry.some(o => itemText.includes(o.toLowerCase()))) {
                        option = item;
                        break;
                    }
                }
            }

            if (option) {
                option.click();
                await sleep(400);
                Logger.success(`Set ${labelText} to ${optionText}`);
            } else {
                // Click somewhere else to close dropdown
                document.body.click();
                Logger.warn(`Option "${optionText}" not found for ${labelText}`);
            }
        } else {
            Logger.warn(`Label "${labelText}" not found - trying direct dropdown access`);

            // Try finding dropdown directly by clicking settings area
            const settingsArea = document.querySelector('[class*="settings"], [class*="config"], [class*="options"]');
            if (settingsArea) {
                const buttons = settingsArea.querySelectorAll('button, [role="button"]');
                for (const btn of buttons) {
                    const btnText = btn.textContent?.toLowerCase() || '';
                    if (labelsToTry.some(l => btnText.includes(l.toLowerCase()))) {
                        btn.click();
                        await sleep(500);
                        break;
                    }
                }
            }
        }
    } catch (e) {
        Logger.error(`Failed to set ${labelText}`, e);
    }
}

// ============================================================
// 3. SUBMIT TEXT PROMPT
// ============================================================
async function submitPrompt(fullText) {
    Logger.info("Submitting prompt", { text: fullText.substring(0, 100) });

    return withRetry(async () => {
        // Rate limit check
        await RateLimiter.checkAndWait();

        // A. Ensure Text Mode Tab is Active
        const textTab = await SelectorEngine.find('textTab', { timeout: 3000, retries: 2 });

        if (textTab) {
            let clickTarget = textTab;
            if (textTab.tagName === 'SPAN') {
                clickTarget = textTab.closest('button') || textTab.closest('div[role="tab"]') || textTab;
            }
            clickTarget.click();
            await sleep(1000);
        }

        // B. Find Text Area
        const textarea = await waitForElement(() => {
            return document.querySelector('textarea') ||
                document.querySelector('div[contenteditable="true"]');
        }, 5000);

        if (!textarea) {
            throw new Error("Prompt input not found");
        }

        // C. Clear and Enter Text
        textarea.focus();
        await sleep(200);

        // Handle React controlled inputs
        if (textarea.tagName === 'TEXTAREA') {
            const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype, "value"
            ).set;

            if (nativeTextAreaValueSetter) {
                nativeTextAreaValueSetter.call(textarea, fullText);
            } else {
                textarea.value = fullText;
            }
        } else {
            // ContentEditable div
            textarea.textContent = fullText;
        }

        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(500);

        // D. Click Generate Button
        const genBtn = await SelectorEngine.find('generateButton', { timeout: 5000, retries: 3 });

        if (genBtn) {
            // Wait if disabled
            let waitCount = 0;
            while (genBtn.disabled && waitCount < 10) {
                Logger.info("Generate button disabled, waiting...");
                await sleep(500);
                waitCount++;
            }

            genBtn.click();
            RateLimiter.record();
            Logger.success("Prompt submitted");
        } else {
            throw new Error("Generate button not found");
        }
    }, { maxRetries: 3, delay: 2000 });
}

// ============================================================
// 4. SCAN PROGRESS - SIMPLE COUNTING VERSION
// ============================================================
function scanProgress(uuids) {
    const results = [];

    // Step 1: Count completed videos on page (these are done tasks)
    const completedVideos = countCompletedVideos();

    // Step 2: Get current progress percentage (for the generating task)
    const currentProgress = getCurrentGeneratingProgress();

    // Step 3: Check for any errors on page
    const hasError = checkForErrors();

    Logger.info(`Scan: ${completedVideos} completed, current progress: ${currentProgress}%`);

    // Step 4: Assign status to each task based on simple logic
    uuids.forEach((uuid, taskIndex) => {
        // Tasks 0 to (completedVideos-1) are DONE
        if (taskIndex < completedVideos) {
            results.push({
                uuid,
                process: 100,
                isDone: true,
                videoUrls: [] // Will be filled later if needed
            });
        }
        // Task at index = completedVideos is CURRENTLY GENERATING
        else if (taskIndex === completedVideos) {
            if (currentProgress > 0) {
                results.push({
                    uuid,
                    process: currentProgress,
                    isDone: currentProgress >= 100,
                    isError: hasError
                });
            } else if (hasError) {
                results.push({
                    uuid,
                    process: 0,
                    isDone: true,
                    isError: true
                });
            } else {
                // Generating but no progress shown yet
                results.push({
                    uuid,
                    process: 0,
                    isDone: false
                });
            }
        }
        // Remaining tasks are PENDING
        else {
            results.push({
                uuid,
                process: 0,
                isDone: false
            });
        }
    });

    return results;
}

// Count unique completed videos on page
function countCompletedVideos() {
    const videos = document.querySelectorAll('video');
    const uniqueUrls = new Set();

    videos.forEach(video => {
        const src = video.src || video.querySelector('source')?.src;
        if (src && (src.startsWith('http') || src.startsWith('blob:'))) {
            uniqueUrls.add(src);
        }
    });

    // Also count video thumbnails (completed generations shown as images)
    const thumbnails = document.querySelectorAll('img[src*="video"], img[src*="thumbnail"]');

    return Math.max(uniqueUrls.size, 0);
}

// Get the current progress percentage of generating task
function getCurrentGeneratingProgress() {
    // Find all percentage text elements
    const allElements = document.querySelectorAll('*');
    let maxProgress = 0;

    for (const el of allElements) {
        const text = el.textContent?.trim();
        // Match XX% pattern, only leaf nodes
        if (text && /^\d+%$/.test(text) && el.children.length === 0) {
            const percent = parseInt(text);
            if (percent > 0 && percent <= 100) {
                // Take the highest progress (the actively generating one)
                maxProgress = Math.max(maxProgress, percent);
            }
        }
    }

    return maxProgress;
}

// Check for error indicators
function checkForErrors() {
    const errorTexts = ['error', 'failed', 'lỗi', 'không thể', 'try a different'];
    const alerts = document.querySelectorAll('[role="alert"], .error, .toast, .snackbar');

    for (const alert of alerts) {
        const text = alert.textContent?.toLowerCase() || '';
        if (errorTexts.some(e => text.includes(e))) {
            return true;
        }
    }

    // Also check the main content area
    const mainContent = document.querySelector('main, [role="main"], .content');
    if (mainContent) {
        const text = mainContent.textContent?.toLowerCase() || '';
        if (errorTexts.some(e => text.includes(e))) {
            return true;
        }
    }

    return false;
}

// Find all generation cards and extract their status (kept for compatibility)
function findGenerationCardsWithStatus() {
    const cards = [];

    // Strategy: Find elements with progress percentages and collect their parent cards
    const progressContainers = new Map();

    // Find all percentage indicators
    document.querySelectorAll('*').forEach(el => {
        const text = el.textContent?.trim();
        if (text && /^\d+%$/.test(text) && el.children.length === 0) {
            const percent = parseInt(text);
            if (percent >= 0 && percent <= 100) {
                // Find the card container for this progress
                let card = el;
                for (let i = 0; i < 15 && card.parentElement; i++) {
                    card = card.parentElement;
                    const rect = card.getBoundingClientRect();
                    // A card is usually >100px wide and >80px tall
                    if (rect.width > 100 && rect.height > 80) {
                        // Avoid duplicates - only keep the first (innermost) card per progress
                        if (!progressContainers.has(card)) {
                            progressContainers.set(card, {
                                container: card,
                                progress: percent,
                                isDone: false,
                                isError: false,
                                top: rect.top,
                                left: rect.left
                            });
                        }
                        break;
                    }
                }
            }
        }
    });

    // Find video containers (completed generations)
    document.querySelectorAll('video').forEach(video => {
        const src = video.src || video.querySelector('source')?.src;
        if (src) {
            let card = video;
            for (let i = 0; i < 10 && card.parentElement; i++) {
                card = card.parentElement;
                const rect = card.getBoundingClientRect();
                if (rect.width > 100 && rect.height > 80) {
                    if (!progressContainers.has(card)) {
                        progressContainers.set(card, {
                            container: card,
                            progress: 100,
                            isDone: true,
                            isError: false,
                            videoUrls: [src],
                            top: rect.top,
                            left: rect.left
                        });
                    } else {
                        // Update existing entry to mark as done
                        const existing = progressContainers.get(card);
                        existing.isDone = true;
                        existing.progress = 100;
                        existing.videoUrls = [src];
                    }
                    break;
                }
            }
        }
    });

    // Convert to array and sort by visual position
    const cardArray = Array.from(progressContainers.values());
    cardArray.sort((a, b) => {
        // Sort by row first (top), then column (left)
        if (Math.abs(a.top - b.top) < 50) {
            return a.left - b.left;
        }
        return a.top - b.top;
    });

    return cardArray;
}

// Analyze an element to find its progress/completion status
function analyzeElementForProgress(uuid, element) {
    let container = element;
    for (let i = 0; i < 10 && container.parentElement; i++) {
        container = container.parentElement;
        if (container.offsetHeight > 100) break;
    }

    // Check for video
    const videos = container.querySelectorAll('video[src], video source[src]');
    if (videos.length > 0) {
        const urls = Array.from(videos)
            .map(v => v.src || v.getAttribute('src'))
            .filter(s => s && s.startsWith('http'));
        if (urls.length > 0) {
            return { uuid, process: 100, isDone: true, videoUrls: urls };
        }
    }

    // Check for progress percentage
    const progElements = container.querySelectorAll('*');
    for (const el of progElements) {
        const text = el.textContent?.trim();
        if (text && /^\d+%$/.test(text) && el.children.length === 0) {
            return { uuid, process: parseInt(text), isDone: false };
        }
    }

    // Check for error
    const containerText = container.textContent?.toLowerCase() || '';
    if (['error', 'failed', 'lỗi', 'không thể'].some(e => containerText.includes(e))) {
        return { uuid, process: 0, isDone: true, isError: true };
    }

    return { uuid, process: 0, isDone: false };
}

// Also scan globally for videos and notify panel
function performGlobalVideoScan() {
    const videos = document.querySelectorAll('video[src], video source[src]');
    const urls = [];
    videos.forEach(v => {
        const src = v.src || v.getAttribute('src');
        if (src && src.startsWith('http')) {
            urls.push(src);
        }
    });
    return urls;
}

// ============================================================
// 5. RETRY FROM HISTORY
// ============================================================
async function retryFromHistory() {
    try {
        const retryBtn = await SelectorEngine.find('retryButton', { timeout: 3000, retries: 2 });

        if (retryBtn) {
            Logger.info("Found retry button, clicking...");
            retryBtn.click();
            await sleep(1000);

            // Click Generate after reuse
            const genBtn = await SelectorEngine.find('generateButton', { timeout: 3000 });

            if (genBtn) {
                genBtn.click();
                Logger.success("Retry initiated");
                return true;
            }
        }

        Logger.warn("Retry button not found");
        return false;
    } catch (e) {
        Logger.error("Retry failed", e);
        return false;
    }
}

// ============================================================
// 6. UI DOWNLOAD TRIGGER
// ============================================================
async function triggerUiDownloadByText(text, uuid) {
    try {
        // Find container with specific text
        let container = null;
        const all = findAllPromptContainers();

        for (const c of all) {
            if (c.textContent.includes(text) || c.textContent.includes(uuid)) {
                container = c;
                break;
            }
        }

        if (!container) {
            Logger.warn("Container not found for download", { text: text.substring(0, 50), uuid });
            return { status: "error", message: "Container not found" };
        }

        // Find Download Button
        const buttons = Array.from(container.querySelectorAll('button'));
        let downBtn = buttons.find(b => {
            const html = b.innerHTML.toLowerCase();
            const label = (b.ariaLabel || '').toLowerCase();
            return html.includes('download') || html.includes('tải xuống') ||
                label.includes('download') || label.includes('tải');
        });

        if (!downBtn) {
            // Try Material Icon text
            downBtn = buttons.find(b => b.textContent?.includes('download'));
        }

        if (downBtn) {
            downBtn.click();
            await sleep(1000);

            // Find quality option in menu (attached to body)
            const options = Array.from(document.querySelectorAll('li, div[role="menuitem"], span, button'));
            const targetOpt = options.find(o => {
                const text = o.textContent.toLowerCase();
                return text.includes('720p') || text.includes('kích thước gốc') ||
                    text.includes('original') || text.includes('1080p');
            });

            if (targetOpt) {
                targetOpt.click();
                Logger.success("Download triggered");
                return { status: "clicked" };
            } else {
                Logger.info("No quality menu found, might be direct download");
                return { status: "direct_download" };
            }
        }

        Logger.warn("Download button not found");
        return { status: "btn_not_found" };
    } catch (e) {
        Logger.error("Download trigger failed", e);
        return { status: "error", message: e.message };
    }
}

// ============================================================
// 7. SUBMIT IMAGE TASK
// ============================================================
async function submitImageTask(task) {
    Logger.info("Submitting Image Task", { uuid: task.uuid });

    return withRetry(async () => {
        // Rate limit check
        await RateLimiter.checkAndWait();

        // A. Set Zoom to 50% for better UI visibility
        await setZoom(0.5);
        await sleep(1500);

        // B. Switch to Image Mode
        const imgTab = await SelectorEngine.find('imageTab', { timeout: 5000, retries: 3 });

        if (imgTab) {
            let clickTarget = imgTab;
            if (imgTab.tagName === 'SPAN') {
                clickTarget = imgTab.closest('button') || imgTab.closest('div[role="tab"]') || imgTab;
            }
            clickTarget.click();
            await sleep(1000);
        } else {
            Logger.warn("Image tab not found, attempting to continue...");
        }

        // Capture existing inputs BEFORE clicking upload
        const existingInputs = Array.from(document.querySelectorAll('input[type="file"]'));

        // C. Trigger Upload Flow
        // 1. Click "+" Button
        const plusBtn = await SelectorEngine.find('addButton', { timeout: 3000 });

        if (plusBtn) {
            plusBtn.click();
            await sleep(1000);
        } else {
            Logger.warn("Add button not found. Trying upload directly.");
        }

        // 2. Click "Tải lên" (Upload)
        const uploadBtn = await SelectorEngine.find('uploadButton', { timeout: 3000 });

        if (uploadBtn) {
            uploadBtn.click();
            await sleep(1000);
        } else {
            Logger.warn("Upload menu item not found.");
        }

        // D. Find the NEW File Input
        Logger.info("Searching for file input...");
        let fileInput = null;

        for (let i = 0; i < 10; i++) {
            const currentInputs = Array.from(document.querySelectorAll('input[type="file"]'));

            // Check for NEW input (diff)
            const newInputs = currentInputs.filter(ci => !existingInputs.includes(ci));
            if (newInputs.length > 0) {
                Logger.info("Found NEW file input");
                fileInput = newInputs[0];
                break;
            }

            // Fallback: Strict image check
            const strictInput = currentInputs.find(inp =>
                inp.accept && (inp.accept.includes('image') || inp.accept.includes('.png') || inp.accept.includes('.jpg'))
            );
            if (strictInput) {
                fileInput = strictInput;
                break;
            }

            await sleep(500);
        }

        // Absolute fallback: Non-text input
        if (!fileInput) {
            const allInputs = Array.from(document.querySelectorAll('input[type="file"]'));
            fileInput = allInputs.find(i => !i.accept || !i.accept.includes('.txt'));
        }

        if (!fileInput) {
            throw new Error("File input for image not found");
        }

        // E. Convert Base64 and Assign
        const res = await fetch(task.imageBase64);
        const blob = await res.blob();
        const file = new File([blob], "input_image.png", { type: task.mimeType || 'image/png' });

        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;

        Logger.info("Dispatching file events...");
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        fileInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Wait for Crop Modal
        await sleep(3000);

        // F. Click "Cắt và lưu" (Crop and Save)
        let cropClicked = false;
        for (let i = 0; i < 15; i++) {
            const cropBtn = await SelectorEngine.find('cropSaveButton', { timeout: 500, retries: 1 });

            if (cropBtn) {
                Logger.info("Clicking Crop & Save...");
                cropBtn.click();
                cropClicked = true;
                await sleep(1000);
                break;
            }
            await sleep(500);
        }

        if (!cropClicked) {
            Logger.warn("Crop button not found or skipped.");
        }

        // G. Wait before generating (rule: 30s)
        Logger.info("Waiting 30s before generating...");
        await sleep(30000);

        // H. Set Prompt & Generate
        const promptText = task.prompt || " ";
        await submitPrompt(promptText);

        RateLimiter.record();
        Logger.success("Image task submitted");
    }, { maxRetries: 2, delay: 5000 });
}

// ============================================================
// 8. GET RATE LIMIT STATS
// ============================================================
function getRateLimitStats() {
    return RateLimiter.getStats();
}

// ============================================================
// 9. GET LOGS
// ============================================================
function getLogs() {
    return Logger.export();
}

// ============================================================
// MESSAGE LISTENER
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    (async () => {
        const startTime = Date.now();
        try {
            if (!request || !request.action) {
                sendResponse({ status: "error", message: "Invalid request: missing action" });
                return;
            }
            
            Logger.info(`Handling action: ${request.action}`);
            
            switch (request.action) {
                case "INIT_ENVIRONMENT":
                    try {
                        await SelectorEngine.loadPatterns();
                        await setZoom();
                        // Try to click grid view if available
                        const gridBtn = getElementByXpath("//button[.//i[contains(text(), 'grid_on')]]");
                        if (gridBtn) gridBtn.click();
                        sendResponse({ status: "ok", logs: Logger.export() });
                    } catch (e) {
                        Logger.error("INIT_ENVIRONMENT failed", e);
                        sendResponse({ status: "partial", message: e.message, logs: Logger.export() });
                    }
                    break;

                case "CONFIGURE_SETTINGS":
                    try {
                        await configureSettings(request.config || {});
                        sendResponse({ status: "configured" });
                    } catch (e) {
                        Logger.error("CONFIGURE_SETTINGS failed", e);
                        sendResponse({ status: "error", message: e.message });
                    }
                    break;

                case "SUBMIT_PROMPT":
                    try {
                        if (!request.text) {
                            throw new Error("Missing prompt text");
                        }
                        await submitPrompt(request.text);
                        sendResponse({ status: "submitted" });
                    } catch (e) {
                        Logger.error("SUBMIT_PROMPT failed", e);
                        sendResponse({ status: "error", message: e.message });
                    }
                    break;

                case "SUBMIT_IMAGE_TASK":
                    try {
                        if (!request.task) {
                            throw new Error("Missing task data");
                        }
                        await submitImageTask(request.task);
                        sendResponse({ status: "submitted" });
                    } catch (e) {
                        Logger.error("SUBMIT_IMAGE_TASK failed", e);
                        sendResponse({ status: "error", message: e.message });
                    }
                    break;

                case "SCAN_PROGRESS":
                    try {
                        const uuids = request.uuids || [];
                        const results = scanProgress(uuids);
                        sendResponse({ results });
                    } catch (e) {
                        Logger.error("SCAN_PROGRESS failed", e);
                        sendResponse({ results: [], error: e.message });
                    }
                    break;

                case "RETRY_FROM_HISTORY":
                    try {
                        const success = await retryFromHistory();
                        sendResponse({ status: success ? "retried" : "not_found" });
                    } catch (e) {
                        Logger.error("RETRY_FROM_HISTORY failed", e);
                        sendResponse({ status: "error", message: e.message });
                    }
                    break;

                case "TRIGGER_UI_DOWNLOAD":
                    try {
                        const res = await triggerUiDownloadByText(request.text || '', request.uuid || '');
                        sendResponse(res);
                    } catch (e) {
                        Logger.error("TRIGGER_UI_DOWNLOAD failed", e);
                        sendResponse({ status: "error", message: e.message });
                    }
                    break;

                case "GET_RATE_STATS":
                    try {
                        sendResponse({ stats: getRateLimitStats() });
                    } catch (e) {
                        sendResponse({ stats: { lastMinute: 0, lastHour: 0 }, error: e.message });
                    }
                    break;

                case "GET_LOGS":
                    sendResponse({ logs: getLogs() });
                    break;

                case "CLEAR_LOGS":
                    Logger.clear();
                    sendResponse({ status: "cleared" });
                    break;

                case "LEARN_SELECTOR":
                    try {
                        if (request.elementType && request.selector) {
                            SelectorEngine.learn(request.elementType, request.selector);
                            sendResponse({ status: "learned" });
                        } else {
                            sendResponse({ status: "error", message: "Missing elementType or selector" });
                        }
                    } catch (e) {
                        sendResponse({ status: "error", message: e.message });
                    }
                    break;

                case "DISCONNECT_WATCHER":
                    DOMWatcher.disconnect();
                    sendResponse({ status: "disconnected" });
                    break;

                case "PING":
                    sendResponse({ status: "pong", timestamp: Date.now() });
                    break;

                default:
                    Logger.warn(`Unknown action: ${request.action}`);
                    sendResponse({ status: "unknown_action", action: request.action });
            }
            
            Logger.info(`Action ${request.action} completed in ${Date.now() - startTime}ms`);
        } catch (e) {
            Logger.error(`Action ${request?.action || 'unknown'} failed with unhandled error`, e);
            sendResponse({ status: "error", message: e.toString(), logs: Logger.export() });
        }
    })();
    return true; // Keep channel open for async
});

// ============================================================
// INITIALIZATION
// ============================================================
Logger.info("Auto Flow Pro Content Script v8.0.0 loaded");
SelectorEngine.loadPatterns().catch(e => Logger.error("Failed to load patterns", e));

// ============================================================
// MUTATION OBSERVER - Watch for DOM Changes
// ============================================================
const DOMWatcher = {
    observer: null,
    debounceTimer: null,
    videoScanInterval: null,
    knownVideos: new Set(),
    lastProgressValue: -1,
    isDestroyed: false,

    init() {
        if (this.observer) {
            this.disconnect();
        }
        
        this.isDestroyed = false;
        this.observer = new MutationObserver((mutations) => {
            if (!this.isDestroyed) {
                this.handleMutations(mutations);
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            characterDataOldValue: true
        });

        // Start periodic video scan with stored interval reference
        this.videoScanInterval = setInterval(() => {
            if (!this.isDestroyed) {
                this.scanForVideos();
            }
        }, 3000);

        Logger.info("DOM Watcher initialized");
    },

    disconnect() {
        this.isDestroyed = true;
        
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        
        if (this.videoScanInterval) {
            clearInterval(this.videoScanInterval);
            this.videoScanInterval = null;
        }
        
        this.knownVideos.clear();
        this.lastProgressValue = -1;
        
        Logger.info("DOM Watcher disconnected");
    },

    handleMutations(mutations) {
        if (this.isDestroyed) return;
        
        // Debounce to avoid excessive processing
        if (this.debounceTimer) clearTimeout(this.debounceTimer);

        this.debounceTimer = setTimeout(() => {
            if (this.isDestroyed) return;
            
            try {
                // Check for progress updates
                this.checkProgressChanges(mutations);

                // Check for new videos
                this.scanForVideos();

                // Notify panel of DOM changes
                this.notifyDOMChange();
            } catch (e) {
                Logger.error("DOM mutation handling error", e);
            }
        }, 500);
    },

    checkProgressChanges(mutations) {
        for (const mutation of mutations) {
            const text = mutation.target?.textContent || '';

            // Look for percentage patterns
            const percentMatch = text.match(/(\d+)\s*%/);
            if (percentMatch) {
                const progress = parseInt(percentMatch[1]);
                if (progress !== this.lastProgressValue && progress >= 0 && progress <= 100) {
                    this.lastProgressValue = progress;
                    this.notifyProgress(progress);
                }
            }

            // Look for completion indicators
            if (text.includes('Hoàn tất') || text.includes('Complete') || text.includes('Done')) {
                this.notifyProgress(100);
            }
        }
    },

    scanForVideos() {
        const videos = document.querySelectorAll('video[src], video source[src]');
        videos.forEach(el => {
            const src = el.src || el.getAttribute('src');
            if (src && !this.knownVideos.has(src) && src.startsWith('http')) {
                this.knownVideos.add(src);
                Logger.success("New video detected: " + src.substring(0, 50));
                this.notifyVideoCompleted(src);
            }
        });

        // Also check for blob URLs in video elements
        document.querySelectorAll('video').forEach(v => {
            if (v.src && v.src.startsWith('blob:') && !this.knownVideos.has(v.src)) {
                // Try to get the actual URL from nearby elements
                const container = v.closest('[class*="video"], [class*="result"], [class*="card"]');
                if (container) {
                    const link = container.querySelector('a[href*="http"]');
                    if (link && !this.knownVideos.has(link.href)) {
                        this.knownVideos.add(link.href);
                        this.notifyVideoCompleted(link.href);
                    }
                }
            }
        });
    },

    notifyProgress(progress) {
        try {
            chrome.runtime.sendMessage({
                action: "PROGRESS_UPDATE",
                progress: progress,
                timestamp: Date.now()
            });
        } catch (e) {
            // Extension context might be invalid
        }
    },

    notifyVideoCompleted(videoUrl) {
        try {
            chrome.runtime.sendMessage({
                action: "VIDEO_COMPLETED",
                videoUrl: videoUrl,
                timestamp: Date.now()
            });
        } catch (e) {
            // Extension context might be invalid
        }
    },

    notifyDOMChange() {
        try {
            chrome.runtime.sendMessage({
                action: "DOM_CHANGED",
                timestamp: Date.now()
            });
        } catch (e) {
            // Extension context might be invalid
        }
    }
};

// Initialize DOM Watcher
DOMWatcher.init();

// ============================================================
// ENHANCED PROGRESS SCANNING
// ============================================================
function getProgressFromPage() {
    const results = [];

    // Strategy 1: Look for explicit progress text
    const progressTexts = document.body.innerText.match(/(\d+)\s*%/g);
    if (progressTexts) {
        progressTexts.forEach(t => {
            const num = parseInt(t);
            if (num >= 0 && num <= 100) {
                results.push({ percent: num, source: 'text' });
            }
        });
    }

    // Strategy 2: Look for progress bars
    document.querySelectorAll('[role="progressbar"], .progress-bar, [class*="progress"]').forEach(el => {
        const value = el.getAttribute('aria-valuenow') || el.style.width?.replace('%', '');
        if (value) {
            results.push({ percent: parseInt(value), source: 'progressbar' });
        }
    });

    // Strategy 3: Look for loading/processing indicators
    const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="processing"], [class*="generating"]');
    if (loadingIndicators.length > 0) {
        // If loading but no specific progress, estimate based on time
        results.push({ percent: 50, source: 'loading-indicator' });
    }

    // Strategy 4: Check for completion states
    const doneIndicators = document.querySelectorAll('[class*="done"], [class*="complete"], [class*="success"]');
    if (doneIndicators.length > 0) {
        results.push({ percent: 100, source: 'done-indicator' });
    }

    return results;
}

// ============================================================
// IMPROVED SELECTOR HELPERS
// ============================================================
function findElementByMultipleStrategies(labelText) {
    // Strategy 1: Direct text match
    let el = findElementByText('span', labelText) ||
        findElementByText('div', labelText) ||
        findElementByText('label', labelText);
    if (el) return el;

    // Strategy 2: Partial text match (for Vietnamese)
    const partialMatch = {
        'Model': ['Mô hình', 'model', 'Model'],
        'Aspect ratio': ['Tỷ lệ', 'Tỉ lệ', 'Ratio', 'ratio'],
        'Duration': ['Thời lượng', 'Số lượng', 'Duration', 'Count']
    };

    const alternatives = partialMatch[labelText] || [];
    for (const alt of alternatives) {
        el = findElementByText('span', alt) ||
            findElementByText('div', alt) ||
            findElementByText('label', alt);
        if (el) {
            Logger.info(`Found ${labelText} using alternative: ${alt}`);
            return el;
        }
    }

    // Strategy 3: XPath with partial match
    const xpaths = [
        `//*[contains(text(), '${labelText}')]`,
        `//*[contains(@aria-label, '${labelText}')]`,
        `//*[contains(@placeholder, '${labelText}')]`
    ];

    for (const xpath of xpaths) {
        el = getElementByXpath(xpath);
        if (el) return el;
    }

    // Strategy 4: Look for mat-select or similar components
    const selects = document.querySelectorAll('mat-select, [role="listbox"], [role="combobox"]');
    for (const select of selects) {
        const text = select.textContent || select.getAttribute('aria-label') || '';
        if (text.toLowerCase().includes(labelText.toLowerCase())) {
            return select;
        }
    }

    return null;
}

// Override the original selectDropdownOption to use improved finder
const originalSelectDropdownOption = selectDropdownOption;
async function selectDropdownOptionEnhanced(labelText, optionText) {
    Logger.info(`Setting ${labelText} to ${optionText}`);

    try {
        // Use improved finder
        let label = findElementByMultipleStrategies(labelText);

        if (label) {
            // Click the label or its parent if it's a form control
            const clickTarget = label.closest('mat-form-field, .form-field, [class*="dropdown"]') || label;
            clickTarget.click();
            await sleep(800);

            // Look for options in various containers
            const optionSelectors = [
                `//li[contains(., '${optionText}')]`,
                `//div[@role='option'][contains(., '${optionText}')]`,
                `//mat-option[contains(., '${optionText}')]`,
                `//div[contains(@class, 'option')][contains(., '${optionText}')]`,
                `//span[contains(@class, 'option')][contains(., '${optionText}')]`
            ];

            let option = null;
            for (const xpath of optionSelectors) {
                option = getElementByXpath(xpath);
                if (option) break;
            }

            // Also try CSS selectors
            if (!option) {
                const cssOptions = document.querySelectorAll('[role="option"], .dropdown-item, li.option, mat-option');
                for (const opt of cssOptions) {
                    if (opt.textContent?.includes(optionText)) {
                        option = opt;
                        break;
                    }
                }
            }

            if (option) {
                option.click();
                await sleep(300);
                Logger.success(`Set ${labelText} to ${optionText}`);
            } else {
                Logger.warn(`Option "${optionText}" not found for ${labelText}`);
            }
        } else {
            Logger.warn(`Label "${labelText}" not found - trying direct dropdown access`);

            // Fallback: try to find any open dropdown and select option
            await sleep(500);
            const allOptions = document.querySelectorAll('[role="option"], mat-option, li[class*="option"]');
            for (const opt of allOptions) {
                if (opt.textContent?.includes(optionText)) {
                    opt.click();
                    await sleep(300);
                    Logger.success(`Set option to ${optionText} via fallback`);
                    return;
                }
            }
        }
    } catch (e) {
        Logger.error(`Failed to set ${labelText}`, e);
    }
}

// Replace the original function
window.selectDropdownOption = selectDropdownOptionEnhanced;

