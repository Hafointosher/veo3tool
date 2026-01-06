// ============================================================
// AUTO FLOW PRO - PANEL LOGIC v8.0.0
// ============================================================

// ============================================================
// CONSTANTS & STATE
// ============================================================
const UUID_PREFIX = "AF_";
const VERSION = "8.0.0";

// State
let prompts = [];
let imageTasks = [];
let currentMode = 'text-mode';
let isRunning = false;
let isPaused = false;
let processInterval = null;
let targetTabId = null;
let logs = [];
let editingIndex = -1;
let taskStartTimes = {};
let completionTimes = [];

// Settings
let settings = {
    model: 'Veo 3.1 fast',
    ratio: 'Ngang',
    count: '1',
    batchSize: 4,
    restTime: 60,
    timeout: 300,
    queueStrategy: 'fifo',
    promptStyle: 'none',
    autoDownload: true,
    ratePerMinute: 12,
    ratePerHour: 120,
    maxRetries: 3,
    retryDelay: 2000,
    notifyComplete: true,
    notifyError: true
};

// Webhook
let webhook = {
    url: '',
    events: ['task_complete', 'queue_complete']
};

// ============================================================
// PROMPT ENHANCER - SMART VERSION
// ============================================================

// Global Scene Context for consistency across prompts
let sceneContext = {
    character: '',      // Main character description
    location: '',       // Scene location/setting
    style: '',          // Visual style
    mood: '',           // Mood/atmosphere
    cameraStyle: ''     // Camera work style
};

const SmartEnhancer = {
    // Style templates
    styles: {
        cinematic: ", cinematic lighting, 4K resolution, professional color grading, shallow depth of field, film grain",
        anime: ", anime style, vibrant colors, studio ghibli inspired, cel shading, dynamic composition",
        realistic: ", photorealistic, natural lighting, 8K UHD, hyperdetailed, professional photography",
        vintage: ", vintage film grain, nostalgic color palette, retro aesthetic, 35mm film look, warm tones",
        documentary: ", documentary style, handheld camera feel, natural lighting, authentic atmosphere",
        noir: ", film noir style, high contrast, dramatic shadows, black and white tones, moody atmosphere",
        scifi: ", sci-fi aesthetic, futuristic elements, neon lighting, holographic effects, cyberpunk vibes"
    },

    // Camera movements
    cameraStyles: {
        tracking: "smooth tracking shot, following subject",
        dolly: "dolly zoom effect, dramatic perspective",
        aerial: "aerial drone shot, sweeping view from above",
        handheld: "handheld camera, authentic movement",
        static: "static locked-off shot, stable composition",
        crane: "crane shot, rising or descending movement",
        pov: "point of view shot, first person perspective"
    },

    // Enhance a single prompt with context
    enhance(prompt, options = {}) {
        const { style, applyContext = true } = options;
        let enhanced = prompt.trim();

        // Apply style suffix
        if (style && style !== 'none' && this.styles[style]) {
            if (!enhanced.includes(this.styles[style])) {
                enhanced += this.styles[style];
            }
        }

        // Apply scene context for consistency
        if (applyContext && this.hasContext()) {
            enhanced = this.applyContext(enhanced);
        }

        return enhanced;
    },

    // Check if context has any values
    hasContext() {
        return sceneContext.character || sceneContext.location ||
            sceneContext.style || sceneContext.mood || sceneContext.cameraStyle;
    },

    // Apply context to prompt
    applyContext(prompt) {
        let enhanced = prompt;
        const ctx = sceneContext;

        // Only add if not already present in prompt
        if (ctx.character && !prompt.toLowerCase().includes(ctx.character.toLowerCase())) {
            enhanced += `, featuring ${ctx.character}`;
        }
        if (ctx.location && !prompt.toLowerCase().includes(ctx.location.toLowerCase())) {
            enhanced += `, set in ${ctx.location}`;
        }
        if (ctx.style && !prompt.toLowerCase().includes(ctx.style.toLowerCase())) {
            enhanced += `, ${ctx.style}`;
        }
        if (ctx.mood && !prompt.toLowerCase().includes(ctx.mood.toLowerCase())) {
            enhanced += `, ${ctx.mood} atmosphere`;
        }
        if (ctx.cameraStyle && this.cameraStyles[ctx.cameraStyle]) {
            enhanced += `, ${this.cameraStyles[ctx.cameraStyle]}`;
        }

        return enhanced;
    },

    // Generate scene number prefix
    getScenePrefix(sceneIndex) {
        return `[Scene ${sceneIndex}] `;
    },

    // Optimize prompt for better results
    optimize(prompt) {
        let optimized = prompt.trim();

        // Remove duplicate commas
        optimized = optimized.replace(/,\s*,/g, ',');

        // Ensure proper spacing
        optimized = optimized.replace(/\s+/g, ' ');

        // Capitalize first letter
        optimized = optimized.charAt(0).toUpperCase() + optimized.slice(1);

        // Remove trailing comma
        optimized = optimized.replace(/,\s*$/, '');

        return optimized;
    },

    // Generate variations with different camera angles
    generateVariations(basePrompt, count = 4) {
        const variations = [];
        const cameras = Object.values(this.cameraStyles);
        const times = ['morning light', 'sunset glow', 'blue hour twilight', 'golden hour', 'night time'];

        for (let i = 0; i < count; i++) {
            const camera = cameras[i % cameras.length];
            const time = times[i % times.length];
            variations.push(`${basePrompt}, ${camera}, ${time}`);
        }

        return variations;
    }
};

// Backward compatibility
const PromptEnhancer = SmartEnhancer;

// ============================================================
// SMART QUEUE
// ============================================================
const SmartQueue = {
    reorder(tasks, strategy) {
        switch (strategy) {
            case 'fifo':
                return tasks;

            case 'priority':
                return [...tasks].sort((a, b) => (b.priority || 2) - (a.priority || 2));

            case 'short-first':
                return [...tasks].sort((a, b) => (a.text?.length || 0) - (b.text?.length || 0));

            case 'shuffle':
                return [...tasks].sort(() => Math.random() - 0.5);

            default:
                return tasks;
        }
    }
};

// ============================================================
// LOGGER
// ============================================================
const MAX_PANEL_LOGS = 300;

function addLog(type, message, data = {}) {
    try {
        let dataStr = '';
        try {
            dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
            if (dataStr.length > 150) {
                dataStr = dataStr.substring(0, 150) + '...';
            }
        } catch (e) {
            dataStr = '[Serialization Error]';
        }
        
        const entry = {
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString(),
            type,
            message: String(message).substring(0, 200),
            data: dataStr
        };
        logs.unshift(entry);

        // Strict log limit
        if (logs.length > MAX_PANEL_LOGS) {
            logs = logs.slice(0, Math.floor(MAX_PANEL_LOGS * 0.8));
        }

        renderLogs();
    } catch (e) {
        console.error('[Panel] Logger error:', e);
    }
}

function clearLogs() {
    logs = [];
    renderLogs();
}

// ============================================================
// UI INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved state
    await loadState();

    // Initialize tabs
    initTabs();

    // Initialize Text Mode
    initTextMode();

    // Initialize Image Mode
    initImageMode();

    // Initialize Dashboard
    initDashboard();

    // Initialize Scheduler
    initScheduler();

    // Initialize Modals
    initModals();

    // Initialize Main Actions
    initMainActions();

    // Initialize Keyboard Shortcuts
    initKeyboardShortcuts();

    // Listen for messages from content script and background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case "EXECUTE_SCHEDULED_JOB":
                executeScheduledJob(request.job);
                break;
            case "PROGRESS_UPDATE":
                handleProgressUpdate(request);
                break;
            case "VIDEO_COMPLETED":
                handleVideoCompleted(request);
                break;
            case "DOM_CHANGED":
                monitor();
                break;
        }
    });

    // Initialize event delegation for list items
    initEventDelegation();

    // Start dashboard update interval
    startDashboardInterval();

    addLog('info', 'Auto Flow Pro v' + VERSION + ' initialized');
});

// ============================================================
// TABS
// ============================================================
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.mode-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            document.getElementById(tabId).classList.add('active');
            currentMode = tabId;

            // Show/hide controls panel based on tab
            const controlsPanel = document.getElementById('controlsPanel');
            if (tabId === 'dashboard-mode' || tabId === 'scheduler-mode') {
                controlsPanel.style.display = 'none';
            } else {
                controlsPanel.style.display = 'block';
            }

            // Update dashboard when switching to it
            if (tabId === 'dashboard-mode') {
                updateDashboard();
            }
        });
    });
}

// ============================================================
// TEXT MODE
// ============================================================
function initTextMode() {
    document.getElementById('btnImport').addEventListener('click', () => {
        document.getElementById('promptFile').click();
    });

    document.getElementById('promptFile').addEventListener('change', handleTextFile);

    document.getElementById('btnAddData').addEventListener('click', () => {
        const box = document.getElementById('manualInputBox');
        box.style.display = box.style.display === 'none' ? 'flex' : 'none';
        if (box.style.display === 'flex') {
            document.getElementById('txtManualInput').focus();
        }
    });

    document.getElementById('btnConfirmAdd').addEventListener('click', () => {
        const txt = document.getElementById('txtManualInput').value;
        if (txt.trim()) {
            addPrompts(txt);
            document.getElementById('txtManualInput').value = '';
            document.getElementById('manualInputBox').style.display = 'none';
        }
    });

    document.getElementById('btnGenerateVariations').addEventListener('click', () => {
        const txt = document.getElementById('txtManualInput').value.trim();
        if (txt) {
            const variations = PromptEnhancer.generateVariations(txt, 4);
            document.getElementById('txtManualInput').value = variations.join('\n');
        }
    });

    document.getElementById('btnEnhanceAll').addEventListener('click', () => {
        const style = document.getElementById('settingPromptStyle').value;

        // Update scene context from UI
        updateSceneContextFromUI();

        prompts = prompts.map(p => {
            const enhanced = SmartEnhancer.enhance(p.originalText || p.text, {
                style,
                applyContext: true
            });
            const optimized = SmartEnhancer.optimize(enhanced);
            return {
                ...p,
                originalText: p.originalText || p.text,
                text: optimized
            };
        });

        renderPromptList();
        saveState();
        addLog('success', `Enhanced ${prompts.length} prompts with style: ${style || 'none'} + context`);
    });

    document.getElementById('btnClear').addEventListener('click', () => {
        if (prompts.length > 0 && confirm('Xóa tất cả text prompts?')) {
            prompts = [];
            renderPromptList();
            saveState();
        }
    });

    // Consistency Panel Toggle
    document.getElementById('consistencyToggle').addEventListener('click', () => {
        const panel = document.querySelector('.consistency-panel');
        const content = document.getElementById('consistencyContent');
        panel.classList.toggle('expanded');
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });

    // Apply Context Button
    document.getElementById('btnApplyContext').addEventListener('click', () => {
        updateSceneContextFromUI();
        addLog('success', 'Scene context applied');

        // Show preview of enhanced prompt
        if (prompts.length > 0) {
            const sample = SmartEnhancer.enhance(prompts[0].originalText || prompts[0].text, {
                style: document.getElementById('settingPromptStyle').value,
                applyContext: true
            });
            addLog('info', `Preview: ${sample.substring(0, 80)}...`);
        }
    });

    // Clear Context Button
    document.getElementById('btnClearContext').addEventListener('click', () => {
        sceneContext = { character: '', location: '', style: '', mood: '', cameraStyle: '' };
        document.getElementById('contextCharacter').value = '';
        document.getElementById('contextLocation').value = '';
        document.getElementById('contextStyle').value = '';
        document.getElementById('contextMood').value = '';
        document.getElementById('contextCamera').value = '';
        addLog('info', 'Scene context cleared');
    });

    // Retry Failed Button
    document.getElementById('btnRetryFailed').addEventListener('click', () => {
        const failed = prompts.filter(p => p.status === 'failed');
        if (failed.length === 0) {
            addLog('info', 'No failed scenes to retry');
            return;
        }

        failed.forEach(p => {
            if ((p.retryCount || 0) < settings.maxRetries) {
                p.retryCount = (p.retryCount || 0) + 1;
                p.status = 'pending';
                p.progress = 0;
            }
        });

        renderPromptList();
        saveState();
        addLog('info', `Queued ${failed.length} failed scenes for retry`);

        // Auto-start if not running
        if (!isRunning) {
            if (confirm('Bắt đầu chạy lại?')) {
                startQueue();
            }
        }
    });
}

// Helper to update sceneContext from UI inputs
function updateSceneContextFromUI() {
    sceneContext.character = document.getElementById('contextCharacter').value.trim();
    sceneContext.location = document.getElementById('contextLocation').value.trim();
    sceneContext.style = document.getElementById('contextStyle').value.trim();
    sceneContext.mood = document.getElementById('contextMood').value.trim();
    sceneContext.cameraStyle = document.getElementById('contextCamera').value;
}

function handleTextFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        addPrompts(evt.target.result);
        addLog('success', `Imported prompts from ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = '';
}

function addPrompts(text) {
    const lines = text.split('\n').filter(l => l.trim());

    // Get the next scene index (continue from existing prompts)
    const maxSceneIndex = prompts.length > 0
        ? Math.max(...prompts.map(p => p.sceneIndex || 0))
        : 0;

    const newItems = lines.map((l, i) => ({
        id: prompts.length + i + 1,
        uuid: `${UUID_PREFIX}TXT_${Date.now()}_${prompts.length + i}`,
        sceneIndex: maxSceneIndex + i + 1,  // Fixed scene position
        sceneLabel: `S${maxSceneIndex + i + 1}`,
        text: l.trim(),
        originalText: l.trim(),
        status: 'pending',
        progress: 0,
        priority: 2,
        videoUrls: [],
        isDownloaded: false,
        retryCount: 0,
        createdAt: Date.now()
    }));

    prompts = prompts.concat(newItems);
    renderPromptList();
    saveState();
    addLog('info', `Added ${newItems.length} scenes (S${maxSceneIndex + 1} - S${maxSceneIndex + newItems.length})`);
}

function renderPromptList() {
    const list = document.getElementById('promptsList');
    list.innerHTML = '';
    document.getElementById('lblCount').textContent = `${prompts.length} Prompts`;

    // Apply queue strategy for display (doesn't affect actual order in array)
    const strategy = document.getElementById('settingQueueStrategy').value;
    const displayOrder = SmartQueue.reorder([...prompts], strategy);

    displayOrder.forEach((p, displayIdx) => {
        const actualIdx = prompts.findIndex(x => x.uuid === p.uuid);
        const div = document.createElement('div');
        div.className = `list-item ${p.status}`;
        div.draggable = true;
        div.dataset.idx = actualIdx;

        let statusText = p.progress + '%';
        if (p.status === 'done') statusText = '✓ Done';
        if (p.status === 'failed') statusText = '✗ Fail';
        if (p.status === 'pending') statusText = '--';
        if (p.status === 'generating') statusText = '⏳ ' + p.progress + '%';
        if (p.retryCount > 0 && p.status !== 'done') statusText = `⟳${p.retryCount} ` + statusText;

        const priorityLabels = { 1: 'Low', 2: 'Norm', 3: 'High' };
        const priorityClass = { 1: 'priority-low', 2: '', 3: 'priority-high' };
        const sceneLabel = p.sceneLabel || `S${p.sceneIndex || actualIdx + 1}`;

        div.innerHTML = `
      <span class="item-idx">${actualIdx + 1}</span>
      <span class="scene-badge">[${sceneLabel}]</span>
      <span class="item-text" title="${escapeHtml(p.text)}">${escapeHtml(p.text)}</span>
      <span class="item-priority ${priorityClass[p.priority || 2]}">${priorityLabels[p.priority || 2]}</span>
      <span class="item-status">${statusText}</span>
      <span class="item-actions">
        <button class="btn-mini" data-action="edit" data-idx="${actualIdx}" title="Edit">
          <span class="material-icons">edit</span>
        </button>
        <button class="btn-mini" data-action="duplicate" data-idx="${actualIdx}" title="Duplicate">
          <span class="material-icons">content_copy</span>
        </button>
        <button class="btn-mini danger" data-action="delete" data-idx="${actualIdx}" title="Delete">
          <span class="material-icons">delete</span>
        </button>
      </span>
    `;

        // Drag events
        div.addEventListener('dragstart', handleDragStart);
        div.addEventListener('dragover', handleDragOver);
        div.addEventListener('drop', handleDrop);
        div.addEventListener('dragend', handleDragEnd);

        list.appendChild(div);
    });
}

// Drag & Drop handlers
let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    if (draggedItem !== this) {
        const fromIdx = parseInt(draggedItem.dataset.idx);
        const toIdx = parseInt(this.dataset.idx);

        const item = prompts.splice(fromIdx, 1)[0];
        prompts.splice(toIdx, 0, item);

        renderPromptList();
        saveState();
        addLog('info', `Reordered prompt from ${fromIdx + 1} to ${toIdx + 1}`);
    }
    this.classList.remove('drag-over');
}

function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.list-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

// Prompt actions
function editPrompt(idx) {
    editingIndex = idx;
    const p = prompts[idx];
    document.getElementById('editPromptText').value = p.text;
    document.getElementById('editPromptPriority').value = p.priority || 2;
    document.getElementById('editModal').classList.remove('hidden');
}

function duplicatePrompt(idx) {
    const p = prompts[idx];
    const newP = {
        ...p,
        id: prompts.length + 1,
        uuid: `${UUID_PREFIX}TXT_${Date.now()}_${prompts.length}`,
        status: 'pending',
        progress: 0,
        isDownloaded: false,
        createdAt: Date.now()
    };
    prompts.splice(idx + 1, 0, newP);
    renderPromptList();
    saveState();
    addLog('info', `Duplicated prompt ${idx + 1}`);
}

function deletePrompt(idx) {
    if (confirm(`Xóa prompt #${idx + 1}?`)) {
        prompts.splice(idx, 1);
        renderPromptList();
        saveState();
        addLog('info', `Deleted prompt ${idx + 1}`);
    }
}

// Make functions global for onclick
window.editPrompt = editPrompt;
window.duplicatePrompt = duplicatePrompt;
window.deletePrompt = deletePrompt;

// ============================================================
// IMAGE MODE
// ============================================================
function initImageMode() {
    document.getElementById('btnSelectImages').addEventListener('click', () => {
        document.getElementById('imgFiles').value = '';
        document.getElementById('imgFiles').click();
    });

    document.getElementById('imgFiles').addEventListener('change', handleImageFiles);

    document.getElementById('btnImpImgPrompts').addEventListener('click', () => {
        document.getElementById('imgPromptFile').click();
    });

    document.getElementById('imgPromptFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => applyPromptsToImages(evt.target.result);
        reader.readAsText(file);
        e.target.value = '';
    });

    document.getElementById('btnAddImgPrompts').addEventListener('click', () => {
        const box = document.getElementById('imgManualInputBox');
        box.style.display = box.style.display === 'none' ? 'flex' : 'none';
        if (box.style.display === 'flex') {
            document.getElementById('txtImgManualInput').focus();
        }
    });

    document.getElementById('btnConfirmImgPrompts').addEventListener('click', () => {
        const txt = document.getElementById('txtImgManualInput').value;
        if (txt.trim()) {
            applyPromptsToImages(txt);
            document.getElementById('imgManualInputBox').style.display = 'none';
            document.getElementById('txtImgManualInput').value = '';
        }
    });

    document.getElementById('btnClearImages').addEventListener('click', () => {
        if (imageTasks.length > 0 && confirm('Xóa tất cả images?')) {
            imageTasks = [];
            renderImageList();
            saveState();
        }
    });

    document.getElementById('sortImages').addEventListener('change', (e) => {
        sortImageTasks(e.target.value);
    });
}

async function handleImageFiles(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const base64 = await readFileAsBase64(f);

        imageTasks.push({
            id: imageTasks.length + i + 1,
            uuid: `${UUID_PREFIX}IMG_${Date.now()}_${imageTasks.length + i}`,
            file: f,
            fileData: base64,
            name: f.name,
            prompt: "",
            status: 'pending',
            progress: 0,
            priority: 2,
            videoUrls: [],
            isDownloaded: false,
            createdAt: Date.now()
        });
    }

    renderImageList();
    saveState();
    addLog('success', `Added ${files.length} images`);
    e.target.value = '';
}

function applyPromptsToImages(rawText) {
    const lines = rawText.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    if (imageTasks.length === 0) {
        alert("Chưa có ảnh nào! Vui lòng chọn ảnh trước.");
        return;
    }

    imageTasks.forEach((t, i) => {
        t.prompt = lines[i % lines.length].trim();
    });

    renderImageList();
    saveState();
    addLog('info', `Applied ${lines.length} prompts to ${imageTasks.length} images`);
    alert(`Đã áp dụng ${lines.length} dòng prompt cho ${imageTasks.length} ảnh.`);
}

function sortImageTasks(criteria) {
    if (criteria === 'name_asc') imageTasks.sort((a, b) => a.name.localeCompare(b.name));
    if (criteria === 'name_desc') imageTasks.sort((a, b) => b.name.localeCompare(a.name));
    renderImageList();
    saveState();
}

function renderImageList() {
    const list = document.getElementById('imageList');
    list.innerHTML = '';
    document.getElementById('imgFooterCount').textContent = `${imageTasks.length} ảnh đã chọn`;

    imageTasks.forEach((t, idx) => {
        const div = document.createElement('div');
        div.className = `list-item ${t.status}`;

        let statusText = t.progress + '%';
        if (t.status === 'done') statusText = '✓ Done';
        if (t.status === 'failed') statusText = '✗ Fail';
        if (t.status === 'pending') statusText = '--';

        const thumbSrc = t.fileData || '';

        div.innerHTML = `
      <span class="item-idx">${idx + 1}</span>
      <span class="item-thumb">
        ${thumbSrc ? `<img src="${thumbSrc}" alt="${t.name}">` : '<span class="material-icons">image</span>'}
      </span>
      <span class="item-text" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</span>
      <span class="item-text prompt-preview" title="${escapeHtml(t.prompt)}">${escapeHtml(t.prompt) || '(No prompt)'}</span>
      <span class="item-status">${statusText}</span>
    `;

        list.appendChild(div);
    });
}

// ============================================================
// DASHBOARD
// ============================================================
function initDashboard() {
    document.getElementById('btnDownloadAll').addEventListener('click', downloadAllVideos);
    document.getElementById('btnExportLogs').addEventListener('click', exportLogs);
    document.getElementById('btnClearLogs').addEventListener('click', () => {
        if (confirm('Xóa tất cả logs?')) {
            logs = [];
            renderLogs();
        }
    });
}

function updateDashboard() {
    const all = [...prompts, ...imageTasks];

    const stats = {
        total: all.length,
        done: all.filter(t => t.status === 'done').length,
        running: all.filter(t => t.status === 'generating').length,
        failed: all.filter(t => t.status === 'failed').length,
        pending: all.filter(t => t.status === 'pending').length
    };

    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statDone').textContent = stats.done;
    document.getElementById('statRunning').textContent = stats.running;
    document.getElementById('statFailed').textContent = stats.failed;

    // Calculate ETA
    const avgTime = calculateAverageTime();
    const remaining = stats.pending + stats.running;
    if (remaining > 0 && avgTime > 0) {
        const etaMinutes = Math.ceil((remaining * avgTime) / 60000);
        document.getElementById('etaText').textContent = `ETA: ~${etaMinutes} phút (${remaining} tasks còn lại)`;
    } else if (remaining === 0) {
        document.getElementById('etaText').textContent = 'ETA: Đã hoàn thành!';
    } else {
        document.getElementById('etaText').textContent = 'ETA: Đang tính...';
    }

    // Update rate limit display
    sendMessage({ action: "GET_RATE_STATS" }).then(res => {
        if (res && res.stats) {
            document.getElementById('rateLimitText').textContent =
                `Rate: ${res.stats.lastMinute}/min, ${res.stats.lastHour}/hr`;
        }
    });

    // Render timeline
    renderTimeline(all);

    // Render video gallery
    renderVideoGallery(all);
}

function calculateAverageTime() {
    if (completionTimes.length === 0) return 120000; // Default 2 min
    const sum = completionTimes.reduce((a, b) => a + b, 0);
    return sum / completionTimes.length;
}

function renderTimeline(tasks) {
    const container = document.getElementById('progressTimeline');
    container.innerHTML = '';

    const recent = tasks.slice(0, 20); // Show last 20

    recent.forEach(t => {
        const item = document.createElement('div');
        item.className = `timeline-item ${t.status}`;

        let icon = 'pending';
        if (t.status === 'done') icon = 'check_circle';
        if (t.status === 'failed') icon = 'error';
        if (t.status === 'generating') icon = 'sync';

        const text = t.text || t.prompt || t.name || 'Task';

        item.innerHTML = `
      <span class="material-icons timeline-icon">${icon}</span>
      <span class="timeline-text">${escapeHtml(text.substring(0, 40))}${text.length > 40 ? '...' : ''}</span>
      <span class="timeline-progress">${t.progress}%</span>
    `;

        container.appendChild(item);
    });
}

function renderVideoGallery(tasks) {
    const container = document.getElementById('videoGallery');
    container.innerHTML = '';

    const completed = tasks.filter(t => t.status === 'done' && t.videoUrls && t.videoUrls.length > 0);

    if (completed.length === 0) {
        container.innerHTML = '<p class="empty-text">Chưa có video nào hoàn thành</p>';
        return;
    }

    completed.forEach(t => {
        t.videoUrls.forEach((url, i) => {
            const card = document.createElement('div');
            card.className = 'video-card';

            const text = t.text || t.prompt || 'Video';

            card.innerHTML = `
        <video src="${url}" controls muted loop preload="metadata"></video>
        <div class="video-info">
          <p class="video-title">${escapeHtml(text.substring(0, 30))}...</p>
          <div class="video-actions">
            <a href="${url}" download class="btn-mini" title="Download">
              <span class="material-icons">download</span>
            </a>
            <button class="btn-mini" onclick="copyToClipboard('${url}')" title="Copy URL">
              <span class="material-icons">link</span>
            </button>
          </div>
        </div>
      `;

            container.appendChild(card);
        });
    });
}

async function downloadAllVideos() {
    const all = [...prompts, ...imageTasks];
    const videos = all.filter(t => t.videoUrls && t.videoUrls.length > 0)
        .flatMap(t => t.videoUrls);

    if (videos.length === 0) {
        alert('Không có video nào để tải!');
        return;
    }

    addLog('info', `Downloading ${videos.length} videos...`);

    for (let i = 0; i < videos.length; i++) {
        try {
            const link = document.createElement('a');
            link.href = videos[i];
            link.download = `autoflow_video_${i + 1}.mp4`;
            link.click();
            await sleep(1000);
        } catch (e) {
            addLog('error', `Failed to download video ${i + 1}`, e);
        }
    }

    addLog('success', `Downloaded ${videos.length} videos`);
}

function renderLogs() {
    const container = document.getElementById('logsContainer');
    if (!container) return;

    container.innerHTML = '';

    logs.slice(0, 100).forEach(log => {
        const item = document.createElement('div');
        item.className = `log-item log-${log.type}`;
        item.innerHTML = `
      <span class="log-time">${log.time}</span>
      <span class="log-type">${log.type.toUpperCase()}</span>
      <span class="log-message">${escapeHtml(log.message)}</span>
    `;
        container.appendChild(item);
    });
}

async function exportLogs() {
    const logsData = {
        exportedAt: new Date().toISOString(),
        version: VERSION,
        logs: logs
    };

    const blob = new Blob([JSON.stringify(logsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoflow_logs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addLog('success', 'Logs exported');
}

// ============================================================
// SCHEDULER
// ============================================================
function initScheduler() {
    // Set default time to now + 1 hour
    const now = new Date();
    now.setHours(now.getHours() + 1);
    document.getElementById('scheduleTime').value = now.toISOString().slice(0, 16);

    document.getElementById('btnScheduleJob').addEventListener('click', scheduleJob);

    // Profile management
    document.getElementById('btnExportProfile').addEventListener('click', exportProfile);
    document.getElementById('btnImportProfile').addEventListener('click', () => {
        document.getElementById('profileFileInput').click();
    });
    document.getElementById('profileFileInput').addEventListener('change', importProfile);

    // Webhook
    document.getElementById('btnSaveWebhook').addEventListener('click', saveWebhook);

    // Load scheduled jobs
    loadScheduledJobs();
}

async function scheduleJob() {
    const timeInput = document.getElementById('scheduleTime').value;
    const repeat = document.getElementById('scheduleRepeat').value;
    const taskSource = document.getElementById('scheduleTaskSource').value;

    if (!timeInput) {
        alert('Vui lòng chọn thời gian!');
        return;
    }

    const scheduledTime = new Date(timeInput).getTime();
    if (scheduledTime < Date.now()) {
        alert('Thời gian phải ở tương lai!');
        return;
    }

    let tasks = [];
    if (taskSource === 'current') {
        tasks = currentMode === 'text-mode' ? [...prompts] : [...imageTasks];
    }

    if (tasks.length === 0) {
        alert('Không có tasks trong queue hiện tại!');
        return;
    }

    const jobId = `job_${Date.now()}`;

    await chrome.runtime.sendMessage({
        action: "SCHEDULE_JOB",
        jobId,
        scheduledTime,
        repeat: repeat || null,
        tasks: tasks.map(t => ({ ...t, file: undefined })), // Don't include File objects
        settings: getCurrentSettings()
    });

    addLog('success', `Scheduled job for ${new Date(scheduledTime).toLocaleString()}`);
    alert(`Đã lên lịch thành công!\nThời gian: ${new Date(scheduledTime).toLocaleString()}`);

    loadScheduledJobs();
}

async function loadScheduledJobs() {
    const response = await chrome.runtime.sendMessage({ action: "GET_SCHEDULED_JOBS" });
    const jobs = response?.jobs || [];

    const container = document.getElementById('scheduledJobsList');
    container.innerHTML = '';

    if (jobs.length === 0) {
        container.innerHTML = '<p class="empty-text">Không có job nào được lên lịch</p>';
        return;
    }

    jobs.filter(j => j.status === 'scheduled').forEach(job => {
        const div = document.createElement('div');
        div.className = 'scheduled-job-item';

        const time = new Date(job.scheduledTime).toLocaleString();
        const repeatText = job.repeat ? ` (Lặp: ${job.repeat})` : ' (Một lần)';

        div.innerHTML = `
      <div class="job-info">
        <span class="material-icons">schedule</span>
        <span class="job-time">${time}${repeatText}</span>
        <span class="job-tasks">${job.tasks.length} tasks</span>
      </div>
      <button class="btn-mini danger" onclick="cancelScheduledJob('${job.id}')">
        <span class="material-icons">cancel</span>
      </button>
    `;

        container.appendChild(div);
    });
}

async function cancelScheduledJob(jobId) {
    if (confirm('Hủy job này?')) {
        await chrome.runtime.sendMessage({
            action: "CANCEL_SCHEDULED_JOB",
            jobId
        });
        addLog('info', `Cancelled scheduled job: ${jobId}`);
        loadScheduledJobs();
    }
}

window.cancelScheduledJob = cancelScheduledJob;

async function executeScheduledJob(job) {
    addLog('info', 'Executing scheduled job', { jobId: job.id });

    // Load tasks from job
    prompts = job.tasks.filter(t => t.uuid.includes('TXT'));
    imageTasks = job.tasks.filter(t => t.uuid.includes('IMG'));

    // Apply settings
    if (job.settings) {
        applySettings(job.settings);
    }

    // Start queue
    await startQueue();
}

async function exportProfile() {
    const profile = {
        version: VERSION,
        exportedAt: new Date().toISOString(),
        settings: getCurrentSettings(),
        prompts: prompts.map(p => ({ ...p, file: undefined })),
        imageTasks: imageTasks.map(t => ({ ...t, file: undefined })),
        webhook: webhook
    };

    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoflow_profile_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addLog('success', 'Profile exported');
}

async function importProfile(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const profile = JSON.parse(text);

        if (!profile.version) {
            throw new Error('Invalid profile format');
        }

        // Apply settings
        if (profile.settings) {
            applySettings(profile.settings);
        }

        // Load tasks
        if (profile.prompts) {
            prompts = profile.prompts.map(p => ({
                ...p,
                status: 'pending',
                progress: 0,
                isDownloaded: false
            }));
            renderPromptList();
        }

        if (profile.imageTasks) {
            imageTasks = profile.imageTasks.map(t => ({
                ...t,
                status: 'pending',
                progress: 0,
                isDownloaded: false
            }));
            renderImageList();
        }

        if (profile.webhook) {
            webhook = profile.webhook;
            document.getElementById('webhookUrl').value = webhook.url || '';
        }

        saveState();
        addLog('success', `Imported profile from ${file.name}`);
        alert('Profile imported successfully!');
    } catch (err) {
        addLog('error', 'Failed to import profile', err);
        alert('Lỗi khi import profile: ' + err.message);
    }

    e.target.value = '';
}

function saveWebhook() {
    webhook.url = document.getElementById('webhookUrl').value.trim();
    webhook.events = [];

    if (document.getElementById('webhookTaskComplete').checked) {
        webhook.events.push('task_complete');
    }
    if (document.getElementById('webhookQueueComplete').checked) {
        webhook.events.push('queue_complete');
    }
    if (document.getElementById('webhookError').checked) {
        webhook.events.push('error');
    }

    chrome.storage.local.set({ webhook });
    addLog('success', 'Webhook saved');
    alert('Webhook đã được lưu!');
}

// ============================================================
// MODALS
// ============================================================
function initModals() {
    // Settings Modal
    document.getElementById('btnSettings').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('hidden');
    });

    document.getElementById('btnCloseSettings').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('hidden');
    });

    document.getElementById('btnSaveSettings').addEventListener('click', () => {
        settings.ratePerMinute = parseInt(document.getElementById('settingRatePerMinute').value);
        settings.ratePerHour = parseInt(document.getElementById('settingRatePerHour').value);
        settings.maxRetries = parseInt(document.getElementById('settingMaxRetries').value);
        settings.retryDelay = parseInt(document.getElementById('settingRetryDelay').value);
        settings.notifyComplete = document.getElementById('settingNotifyComplete').checked;
        settings.notifyError = document.getElementById('settingNotifyError').checked;

        saveState();
        document.getElementById('settingsModal').classList.add('hidden');
        addLog('success', 'Settings saved');
    });

    // Help Modal
    document.getElementById('btnHelp').addEventListener('click', () => {
        document.getElementById('helpModal').classList.remove('hidden');
    });

    document.getElementById('btnCloseHelp').addEventListener('click', () => {
        document.getElementById('helpModal').classList.add('hidden');
    });

    // Edit Modal
    document.getElementById('btnCloseEdit').addEventListener('click', () => {
        document.getElementById('editModal').classList.add('hidden');
        editingIndex = -1;
    });

    document.getElementById('btnCancelEdit').addEventListener('click', () => {
        document.getElementById('editModal').classList.add('hidden');
        editingIndex = -1;
    });

    document.getElementById('btnSaveEdit').addEventListener('click', () => {
        if (editingIndex >= 0 && editingIndex < prompts.length) {
            prompts[editingIndex].text = document.getElementById('editPromptText').value;
            prompts[editingIndex].originalText = prompts[editingIndex].text;
            prompts[editingIndex].priority = parseInt(document.getElementById('editPromptPriority').value);
            renderPromptList();
            saveState();
            addLog('info', `Updated prompt ${editingIndex + 1}`);
        }
        document.getElementById('editModal').classList.add('hidden');
        editingIndex = -1;
    });

    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
}

// ============================================================
// MAIN ACTIONS
// ============================================================
function initMainActions() {
    document.getElementById('btnStart').addEventListener('click', startQueue);

    document.getElementById('btnPause').addEventListener('click', () => {
        isPaused = !isPaused;
        const btn = document.getElementById('btnPause');
        if (isPaused) {
            btn.innerHTML = '<span class="material-icons">play_circle</span>';
            updateStatus("Tạm dừng", "paused");
            addLog('info', 'Queue paused');
        } else {
            btn.innerHTML = '<span class="material-icons">pause_circle</span>';
            updateStatus("Đang chạy...", "running");
            addLog('info', 'Queue resumed');
            processNext();
        }
    });

    document.getElementById('btnStop').addEventListener('click', stopQueue);
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl + Enter: Start
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            if (!isRunning) startQueue();
        }

        // Escape: Stop
        if (e.key === 'Escape') {
            if (isRunning) stopQueue();
            // Close modals
            document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        }
    });
}

// ============================================================
// QUEUE EXECUTION
// ============================================================
async function startQueue() {
    const tasks = currentMode === 'text-mode' || currentMode === 'dashboard-mode'
        ? prompts
        : imageTasks;

    if (tasks.length === 0 || tasks.every(p => p.status === 'done')) {
        alert('Danh sách trống hoặc đã hoàn thành!');
        return;
    }

    isRunning = true;
    isPaused = false;

    document.getElementById('btnStart').disabled = true;
    document.getElementById('btnPause').disabled = false;
    document.getElementById('btnStop').disabled = false;

    updateStatus("Đang khởi tạo...", "running");
    addLog('info', 'Starting queue execution');

    // Init Tab
    await initTab();

    // Config settings
    const config = getCurrentSettings();
    await sendMessage({ action: "CONFIGURE_SETTINGS", config });

    // Reorder by strategy
    if (currentMode === 'text-mode') {
        prompts = SmartQueue.reorder(prompts, settings.queueStrategy);
        renderPromptList();
    }

    updateStatus("Đang chạy...", "running");

    // Start processing
    processNext();

    // Start monitor
    if (processInterval) clearInterval(processInterval);
    processInterval = setInterval(monitor, 3000);
}

function stopQueue() {
    isRunning = false;
    isPaused = false;

    document.getElementById('btnStart').disabled = false;
    document.getElementById('btnPause').disabled = true;
    document.getElementById('btnStop').disabled = true;

    updateStatus("Đã dừng", "idle");
    clearInterval(processInterval);
    addLog('info', 'Queue stopped');
}

async function processNext() {
    if (!isRunning || isPaused) return;

    const list = currentMode === 'text-mode' || currentMode === 'dashboard-mode'
        ? prompts
        : imageTasks;

    // Find next pending/failed(retryable) scene by sceneIndex ORDER
    const pendingScenes = list
        .filter(p => p.status === 'pending' || (p.status === 'failed' && (p.retryCount || 0) < settings.maxRetries))
        .sort((a, b) => (a.sceneIndex || 0) - (b.sceneIndex || 0));

    if (pendingScenes.length === 0) {
        // Check if any scenes are still generating
        const generating = list.filter(p => p.status === 'generating');
        if (generating.length > 0) {
            // Wait for generating scenes to complete
            setTimeout(processNext, 5000);
            return;
        }

        // Verify scene order before marking complete
        const verification = verifySceneOrder(list);
        if (!verification.valid) {
            addLog('warn', `Scene order verification: ${verification.message}`);
        }

        // All done
        await checkDownload(list);
        stopQueue();
        updateStatus("Hoàn tất!", "idle");
        addLog('success', `Queue completed! ${list.filter(t => t.status === 'done').length}/${list.length} scenes done`);

        // Send notifications
        if (settings.notifyComplete) {
            chrome.runtime.sendMessage({
                action: "SEND_NOTIFICATION",
                title: "Auto Flow Pro",
                message: "Queue đã hoàn thành!",
                type: "success"
            });
        }

        // Send webhook
        await sendWebhookEvent('queue_complete', {
            total: list.length,
            done: list.filter(t => t.status === 'done').length,
            failed: list.filter(t => t.status === 'failed').length
        });

        return;
    }

    // Get the next scene to process (lowest sceneIndex)
    const item = pendingScenes[0];
    const itemIdx = list.findIndex(p => p.uuid === item.uuid);

    // Handle retry
    if (item.status === 'failed') {
        item.retryCount = (item.retryCount || 0) + 1;
        item.status = 'pending';
        addLog('info', `Retrying scene ${item.sceneLabel || item.sceneIndex} (attempt ${item.retryCount})`);
    }

    // Batch pause logic
    const batchSize = parseInt(document.getElementById('settingBatchSize').value) || 4;
    const restTime = parseInt(document.getElementById('settingRestTime').value) || 60;

    // Count completed in this batch
    const doneCount = list.filter(p => p.status === 'done' || p.status === 'generating').length;

    if (doneCount > 0 && doneCount % batchSize === 0 && !item.hasRestedBatch) {
        addLog('info', `Batch limit reached. Resting ${restTime}s...`);
        item.hasRestedBatch = true;

        let secondsLeft = restTime;
        updateStatus(`Nghỉ: ${secondsLeft}s...`, "running");

        const countdownInterval = setInterval(() => {
            secondsLeft--;
            if (secondsLeft <= 0 || !isRunning) {
                clearInterval(countdownInterval);
                if (isRunning) {
                    updateStatus("Tiếp tục...", "running");
                    processNext();
                }
            } else {
                updateStatus(`Nghỉ: ${secondsLeft}s...`, "running");
            }
        }, 1000);

        return;
    }

    // Process item
    item.status = 'generating';
    taskStartTimes[item.uuid] = Date.now();

    if (currentMode === 'text-mode' || currentMode === 'dashboard-mode') {
        renderPromptList();
    } else {
        renderImageList();
    }

    updateDashboard();
    updateStatus(`Đang xử lý Scene ${item.sceneIndex}...`, "running");

    try {
        if (item.uuid.includes('TXT')) {
            // Text Mode - Apply smart enhancement with context
            const style = document.getElementById('settingPromptStyle').value;
            const enhancedText = SmartEnhancer.enhance(item.text, { style, applyContext: true });
            const optimizedText = SmartEnhancer.optimize(enhancedText);
            const textPayload = `[${item.uuid}] ${optimizedText}`;

            addLog('info', `Scene ${item.sceneIndex}: ${optimizedText.substring(0, 50)}...`);
            await sendMessage({ action: "SUBMIT_PROMPT", text: textPayload });
        } else {
            // Image Mode
            const base64 = item.fileData;
            const payload = {
                uuid: item.uuid,
                prompt: item.prompt,
                imageBase64: base64,
                mimeType: 'image/png'
            };

            addLog('info', `Scene ${item.sceneIndex}: Image task`);
            await sendMessage({ action: "SUBMIT_IMAGE_TASK", task: payload });
        }

        // Wait before next
        setTimeout(processNext, 8000);

    } catch (e) {
        addLog('error', `Scene ${item.sceneIndex} failed: ${e.message}`);
        item.status = 'failed';

        // Auto-retry logic - will be picked up in next processNext cycle
        if ((item.retryCount || 0) < settings.maxRetries) {
            addLog('info', `Scene ${item.sceneIndex} will be retried (${item.retryCount || 0}/${settings.maxRetries})`);
        } else {
            addLog('error', `Scene ${item.sceneIndex} permanently failed after ${settings.maxRetries} retries`);
            if (settings.notifyError) {
                chrome.runtime.sendMessage({
                    action: "SEND_NOTIFICATION",
                    title: "Auto Flow Pro - Error",
                    message: `Scene ${item.sceneIndex} failed`,
                    type: "error"
                });
            }
            await sendWebhookEvent('error', { taskId: item.uuid, scene: item.sceneIndex, error: e.message });
        }

        renderPromptList();
        setTimeout(processNext, 3000);
    }
}

// Verify that all scenes are in correct order
function verifySceneOrder(list) {
    const done = list.filter(p => p.status === 'done').sort((a, b) => a.sceneIndex - b.sceneIndex);
    const failed = list.filter(p => p.status === 'failed');

    if (failed.length > 0) {
        const failedScenes = failed.map(p => p.sceneLabel || `S${p.sceneIndex}`).join(', ');
        return { valid: false, message: `Failed scenes: ${failedScenes}` };
    }

    // Check for gaps
    for (let i = 0; i < done.length; i++) {
        const expected = i + 1;
        if (done[i].sceneIndex !== expected) {
            return { valid: false, message: `Gap at scene ${expected}` };
        }
    }

    return { valid: true, message: 'All scenes in order' };
}

function monitor() {
    const list = currentMode === 'text-mode' || currentMode === 'dashboard-mode'
        ? prompts
        : imageTasks;

    // Always run if we have tasks (even if not running - to catch completed videos)
    if (list.length === 0) return;

    // Scan ALL tasks, not just generating ones
    const allUUIDs = list.map(p => p.uuid);
    if (allUUIDs.length === 0) return;

    sendMessage({ action: "SCAN_PROGRESS", uuids: allUUIDs }).then(async res => {
        if (res && res.results) {
            let changed = false;

            for (const r of res.results) {
                const item = list.find(x => x.uuid === r.uuid);
                if (item) {
                    // Update progress if changed
                    if (item.progress !== r.process) {
                        item.progress = r.process;
                        changed = true;
                    }

                    // Update status if completed
                    if (r.isDone && item.status !== 'done') {
                        item.status = 'done';
                        item.completedAt = Date.now();
                        changed = true;

                        // Record completion time
                        if (taskStartTimes[item.uuid]) {
                            const elapsed = Date.now() - taskStartTimes[item.uuid];
                            completionTimes.push(elapsed);
                            if (completionTimes.length > 20) {
                                completionTimes = completionTimes.slice(-20);
                            }
                        }

                        // Send webhook
                        await sendWebhookEvent('task_complete', {
                            taskId: item.uuid,
                            prompt: item.text || item.prompt,
                            videoUrls: r.videoUrls
                        });

                        addLog('success', `Task completed: ${(item.text || item.prompt || '').substring(0, 30)}...`);
                    }

                    // Update video URLs if found
                    if (r.videoUrls && r.videoUrls.length > 0) {
                        item.videoUrls = r.videoUrls;
                        changed = true;
                    }

                    // Handle errors
                    if (r.isError && item.status !== 'failed') {
                        item.status = 'failed';
                        changed = true;
                        await sendWebhookEvent('error', { taskId: item.uuid, error: 'Generation failed' });
                    }
                }
            }

            if (changed) {
                renderPromptList();
                renderImageList();
                updateDashboard();
                saveState();
            }
        }
    });
}

async function checkDownload(list) {
    if (!document.getElementById('chkAutoDownload').checked) return;

    const toDownload = list.filter(p => p.status === 'done' && !p.isDownloaded);

    for (const p of toDownload) {
        try {
            await sendMessage({
                action: "TRIGGER_UI_DOWNLOAD",
                uuid: p.uuid,
                text: p.text || p.prompt || "video"
            });
            p.isDownloaded = true;
            addLog('success', `Downloaded: ${(p.text || p.name || '').substring(0, 30)}`);
            await sleep(2000);
        } catch (e) {
            addLog('error', 'Download failed', e);
        }
    }
}

// ============================================================
// COMMUNICATION
// ============================================================
async function initTab() {
    return new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            if (tabs[0]) {
                targetTabId = tabs[0].id;
                chrome.tabs.sendMessage(targetTabId, { action: "INIT_ENVIRONMENT" }, (response) => {
                    if (response && response.logs) {
                        // Merge content script logs
                        response.logs.forEach(log => addLog(log.type, `[Content] ${log.message}`));
                    }
                    resolve(response);
                });
            } else {
                resolve(null);
            }
        });
    });
}

function sendMessage(msg) {
    return new Promise(resolve => {
        if (targetTabId) {
            chrome.tabs.sendMessage(targetTabId, msg, (resp) => {
                if (chrome.runtime.lastError) {
                    addLog('error', 'Communication error', chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(resp);
                }
            });
        } else {
            resolve(null);
        }
    });
}

async function sendWebhookEvent(event, data) {
    if (!webhook.url || !webhook.events.includes(event)) return;

    try {
        await chrome.runtime.sendMessage({
            action: "SEND_WEBHOOK",
            url: webhook.url,
            event,
            data
        });
        addLog('info', `Webhook sent: ${event}`);
    } catch (e) {
        addLog('error', 'Webhook failed', e);
    }
}

// ============================================================
// STATE PERSISTENCE
// ============================================================
async function saveState() {
    const state = {
        prompts: prompts.map(p => ({ ...p, file: undefined })),
        imageTasks: imageTasks.map(t => ({ ...t, file: undefined })),
        settings: getCurrentSettings(),
        webhook,
        logs: logs.slice(0, 100)
    };

    await chrome.storage.local.set({ autoFlowState: state });
}

async function loadState() {
    try {
        const data = await chrome.storage.local.get(['autoFlowState', 'webhook']);

        if (data.autoFlowState) {
            const state = data.autoFlowState;

            if (state.prompts) {
                prompts = state.prompts;
                renderPromptList();
            }

            if (state.imageTasks) {
                imageTasks = state.imageTasks;
                renderImageList();
            }

            if (state.settings) {
                applySettings(state.settings);
            }

            if (state.logs) {
                logs = state.logs;
                renderLogs();
            }
        }

        if (data.webhook) {
            webhook = data.webhook;
            document.getElementById('webhookUrl').value = webhook.url || '';
            document.getElementById('webhookTaskComplete').checked = webhook.events.includes('task_complete');
            document.getElementById('webhookQueueComplete').checked = webhook.events.includes('queue_complete');
            document.getElementById('webhookError').checked = webhook.events.includes('error');
        }
    } catch (e) {
        console.error('Failed to load state', e);
    }
}

function getCurrentSettings() {
    return {
        model: document.getElementById('settingModel').value,
        ratio: document.getElementById('settingRatio').value,
        count: document.getElementById('settingCount').value,
        batchSize: parseInt(document.getElementById('settingBatchSize').value) || 4,
        restTime: parseInt(document.getElementById('settingRestTime').value) || 60,
        timeout: parseInt(document.getElementById('settingTimeout').value) || 300,
        queueStrategy: document.getElementById('settingQueueStrategy').value,
        promptStyle: document.getElementById('settingPromptStyle').value,
        autoDownload: document.getElementById('chkAutoDownload').checked
    };
}

function applySettings(s) {
    if (s.model) document.getElementById('settingModel').value = s.model;
    if (s.ratio) document.getElementById('settingRatio').value = s.ratio;
    if (s.count) document.getElementById('settingCount').value = s.count;
    if (s.batchSize) document.getElementById('settingBatchSize').value = s.batchSize;
    if (s.restTime) document.getElementById('settingRestTime').value = s.restTime;
    if (s.timeout) document.getElementById('settingTimeout').value = s.timeout;
    if (s.queueStrategy) document.getElementById('settingQueueStrategy').value = s.queueStrategy;
    if (s.promptStyle) document.getElementById('settingPromptStyle').value = s.promptStyle;
    if (s.autoDownload !== undefined) document.getElementById('chkAutoDownload').checked = s.autoDownload;
}

// ============================================================
// UTILITIES
// ============================================================
function updateStatus(msg, type = 'idle') {
    const badge = document.getElementById('appStatusBadge');
    badge.textContent = msg;
    badge.className = `badge status-${type}`;
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        addLog('info', 'Copied to clipboard');
    });
}

window.copyToClipboard = copyToClipboard;

// ============================================================
// AUTO-SAVE ON CHANGES
// ============================================================
window.addEventListener('beforeunload', () => {
    saveState();
});

// Save settings when changed
document.addEventListener('change', (e) => {
    if (e.target.closest('.controls-panel')) {
        saveState();
    }
});

console.log('Auto Flow Pro Panel v' + VERSION + ' loaded');

// ============================================================
// EVENT DELEGATION (Fix CSP)
// ============================================================
function initEventDelegation() {
    // Prompts list event delegation
    document.getElementById('promptsList').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.idx);

        switch (action) {
            case 'edit': editPrompt(idx); break;
            case 'duplicate': duplicatePrompt(idx); break;
            case 'delete': deletePrompt(idx); break;
        }
    });

    // Image list event delegation
    document.getElementById('imageList').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.idx);

        switch (action) {
            case 'delete': deleteImage(idx); break;
        }
    });

    // Video gallery event delegation
    document.getElementById('videoGallery').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const url = btn.dataset.url;
        if (btn.dataset.action === 'copy') {
            copyToClipboard(url);
        }
    });
}

// ============================================================
// DASHBOARD INTERVAL
// ============================================================
let dashboardInterval = null;

function startDashboardInterval() {
    if (dashboardInterval) clearInterval(dashboardInterval);

    dashboardInterval = setInterval(() => {
        // Always update if running or on dashboard tab
        if (isRunning || currentMode === 'dashboard-mode') {
            updateDashboard();
        }
    }, 2000);
}

// ============================================================
// REAL-TIME PROGRESS HANDLERS
// ============================================================
function handleProgressUpdate(request) {
    const { progress, uuid } = request;

    // Find the task and update progress
    let task = prompts.find(p => p.status === 'generating');
    if (!task) task = imageTasks.find(p => p.status === 'generating');

    if (task) {
        task.progress = progress || task.progress;
        renderPromptList();
        renderImageList();
        updateDashboard();
    }
}

function handleVideoCompleted(request) {
    const { videoUrl } = request;

    addLog('success', 'Video completed: ' + videoUrl?.substring(0, 50));

    // Try to match with a generating task
    const task = [...prompts, ...imageTasks].find(t => t.status === 'generating');
    if (task) {
        task.videoUrls = task.videoUrls || [];
        if (!task.videoUrls.includes(videoUrl)) {
            task.videoUrls.push(videoUrl);
        }
        task.progress = 100;
        task.status = 'done';
        task.completedAt = Date.now();

        renderPromptList();
        renderImageList();
        updateDashboard();
        saveState();
    }

    // Trigger monitor to rescan
    monitor();
}

// ============================================================
// AUTO-RETRY FAILED TASKS
// ============================================================
function autoRetryFailed() {
    const failed = prompts.filter(p => p.status === 'failed' && (p.retryCount || 0) < settings.maxRetries);

    let retriedCount = 0;
    for (const task of failed) {
        task.retryCount = (task.retryCount || 0) + 1;
        task.status = 'pending';
        task.progress = 0;
        retriedCount++;
        addLog('info', `Auto-retry #${task.retryCount}: ${task.text?.substring(0, 30)}...`);
    }

    if (retriedCount > 0) {
        renderPromptList();
        addLog('info', `Queued ${retriedCount} tasks for retry`);
    }

    return retriedCount;
}

// ============================================================
// SMART BATCH OPTIMIZATION
// ============================================================
function optimizeBatchSize() {
    const recentTasks = [...prompts, ...imageTasks]
        .filter(t => t.status === 'done' || t.status === 'failed')
        .slice(-20);

    if (recentTasks.length < 5) return; // Not enough data

    const successRate = recentTasks.filter(t => t.status === 'done').length / recentTasks.length;

    const batchInput = document.getElementById('settingBatchSize');
    const restInput = document.getElementById('settingRestTime');

    if (successRate < 0.5) {
        // Low success rate - reduce batch, increase rest
        const newBatch = Math.max(2, parseInt(batchInput.value) - 1);
        const newRest = Math.min(120, parseInt(restInput.value) + 15);
        batchInput.value = newBatch;
        restInput.value = newRest;
        addLog('warn', `Low success (${Math.round(successRate * 100)}%). Batch: ${newBatch}, Rest: ${newRest}s`);
    } else if (successRate > 0.9 && recentTasks.length >= 10) {
        // High success rate - can increase batch
        const newBatch = Math.min(6, parseInt(batchInput.value) + 1);
        batchInput.value = newBatch;
        addLog('success', `High success (${Math.round(successRate * 100)}%). Batch: ${newBatch}`);
    }
}

// ============================================================
// ERROR THRESHOLD CHECK
// ============================================================
function checkErrorThreshold() {
    const recent = [...prompts, ...imageTasks]
        .filter(t => t.status === 'done' || t.status === 'failed')
        .slice(-10);

    const errorCount = recent.filter(t => t.status === 'failed').length;

    if (errorCount >= 3) {
        isPaused = true;
        document.getElementById('btnPause').innerHTML = '<span class="material-icons">play_circle</span>';
        updateStatus('Paused: Nhiều lỗi', 'paused');
        addLog('warn', `Queue paused: ${errorCount} errors in last 10 tasks`);

        chrome.runtime.sendMessage({
            action: "SEND_NOTIFICATION",
            title: "Auto Flow Pro",
            message: `Queue paused due to ${errorCount} errors`,
            type: "warning"
        });

        return true;
    }
    return false;
}

// ============================================================
// EXPORT RESULTS AS CSV
// ============================================================
function exportResultsCSV() {
    const tasks = [...prompts, ...imageTasks];

    const headers = ['ID', 'Type', 'Prompt', 'Status', 'Progress', 'VideoURLs', 'CreatedAt', 'CompletedAt'];
    const rows = tasks.map(t => [
        t.uuid,
        t.uuid.includes('TXT') ? 'Text' : 'Image',
        `"${(t.text || t.prompt || '').replace(/"/g, '""')}"`,
        t.status,
        t.progress,
        `"${(t.videoUrls || []).join(';')}"`,
        t.createdAt ? new Date(t.createdAt).toISOString() : '',
        t.completedAt ? new Date(t.completedAt).toISOString() : ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoflow_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    addLog('success', `Exported ${tasks.length} tasks to CSV`);
}

// Add export button handler
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('btnExportCSV');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportResultsCSV);
    }
});

// ============================================================
// DELETE IMAGE FUNCTION
// ============================================================
function deleteImage(idx) {
    if (confirm(`Xóa image #${idx + 1}?`)) {
        imageTasks.splice(idx, 1);
        renderImageList();
        saveState();
        addLog('info', `Deleted image ${idx + 1}`);
    }
}

