// ============================================================
// AUTO FLOW PRO - BACKGROUND SERVICE WORKER v8.0.0
// ============================================================

// Initialize Side Panel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// ============================================================
// STATE MANAGEMENT
// ============================================================
let nextDownloadName = null;
let scheduledJobs = [];

// ============================================================
// MESSAGE HANDLERS
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case "SET_BROWSER_ZOOM":
          await handleSetZoom(request, sender, sendResponse);
          break;

        case "SET_NEXT_DOWNLOAD_NAME":
          nextDownloadName = request.filename;
          sendResponse({ status: "set", name: nextDownloadName });
          break;

        case "SCHEDULE_JOB":
          await handleScheduleJob(request, sendResponse);
          break;

        case "CANCEL_SCHEDULED_JOB":
          await handleCancelJob(request, sendResponse);
          break;

        case "GET_SCHEDULED_JOBS":
          const jobs = await getScheduledJobs();
          sendResponse({ jobs });
          break;

        case "SEND_NOTIFICATION":
          await handleNotification(request, sendResponse);
          break;

        case "SEND_WEBHOOK":
          await handleWebhook(request, sendResponse);
          break;

        case "EXPORT_LOGS":
          await handleExportLogs(request, sendResponse);
          break;

        // Forward real-time updates from content script to panel
        case "PROGRESS_UPDATE":
        case "VIDEO_COMPLETED":
        case "DOM_CHANGED":
          // Forward to all extension pages (including side panel)
          forwardToPanel(request);
          sendResponse({ status: "forwarded" });
          break;

        default:
          sendResponse({ status: "unknown_action" });
      }
    } catch (error) {
      console.error("Background error:", error);
      sendResponse({ status: "error", message: error.message });
    }
  })();
  return true; // Keep channel open for async
});

// Forward messages to panel using modern API
async function forwardToPanel(message) {
  try {
    // Broadcast to all extension contexts (side panel, popup, etc.)
    await chrome.runtime.sendMessage(message);
  } catch (e) {
    // Ignore errors if no listeners - this is expected when panel is closed
  }

  // Also try to send to all tabs with content script
  try {
    const tabs = await chrome.tabs.query({ url: "https://labs.google/*" });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  } catch (e) {
    // Ignore tab messaging errors
  }
}

// ============================================================
// ZOOM HANDLER
// ============================================================
async function handleSetZoom(request, sender, sendResponse) {
  try {
    await chrome.tabs.setZoom(sender.tab.id, request.zoomFactor || 0.5);
    sendResponse({ status: "zoomed", factor: request.zoomFactor });
  } catch (error) {
    sendResponse({ status: "error", message: error.message });
  }
}

// ============================================================
// DOWNLOAD HANDLER
// ============================================================
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  if (nextDownloadName) {
    suggest({ filename: nextDownloadName, conflictAction: 'uniquify' });
    nextDownloadName = null;
  } else {
    suggest();
  }
});

// ============================================================
// SCHEDULER HANDLERS
// ============================================================
async function handleScheduleJob(request, sendResponse) {
  const { jobId, scheduledTime, repeat, tasks, settings } = request;

  // Save job to storage
  const jobs = await getScheduledJobs();
  jobs.push({
    id: jobId,
    scheduledTime,
    repeat,
    tasks,
    settings,
    status: 'scheduled',
    createdAt: Date.now()
  });
  await chrome.storage.local.set({ scheduledJobs: jobs });

  // Create alarm
  await chrome.alarms.create(jobId, {
    when: scheduledTime
  });

  sendResponse({ status: "scheduled", jobId });
}

async function handleCancelJob(request, sendResponse) {
  const { jobId } = request;

  // Remove alarm
  await chrome.alarms.clear(jobId);

  // Remove from storage
  const jobs = await getScheduledJobs();
  const filtered = jobs.filter(j => j.id !== jobId);
  await chrome.storage.local.set({ scheduledJobs: filtered });

  sendResponse({ status: "cancelled", jobId });
}

async function getScheduledJobs() {
  const data = await chrome.storage.local.get('scheduledJobs');
  return data.scheduledJobs || [];
}

// Alarm listener for scheduled jobs
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const jobs = await getScheduledJobs();
  const job = jobs.find(j => j.id === alarm.name);

  if (job) {
    // Notify the panel to start the queue
    chrome.runtime.sendMessage({
      action: "EXECUTE_SCHEDULED_JOB",
      job
    });

    // Handle repeat
    if (job.repeat) {
      const nextTime = calculateNextRun(job.scheduledTime, job.repeat);
      await chrome.alarms.create(job.id, { when: nextTime });

      // Update job in storage
      job.scheduledTime = nextTime;
      job.lastRun = Date.now();
      const updatedJobs = jobs.map(j => j.id === job.id ? job : j);
      await chrome.storage.local.set({ scheduledJobs: updatedJobs });
    } else {
      // One-time job, mark as completed
      job.status = 'completed';
      const updatedJobs = jobs.map(j => j.id === job.id ? job : j);
      await chrome.storage.local.set({ scheduledJobs: updatedJobs });
    }
  }
});

function calculateNextRun(currentTime, repeat) {
  const date = new Date(currentTime);
  switch (repeat) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'hourly':
      date.setHours(date.getHours() + 1);
      break;
  }
  return date.getTime();
}

// ============================================================
// NOTIFICATION HANDLER
// ============================================================
async function handleNotification(request, sendResponse) {
  const { title, message, type } = request;

  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: title || 'Auto Flow Pro',
      message: message,
      priority: type === 'error' ? 2 : 1
    });
    sendResponse({ status: "notified" });
  } catch (error) {
    sendResponse({ status: "error", message: error.message });
  }
}

// ============================================================
// WEBHOOK HANDLER
// ============================================================
async function handleWebhook(request, sendResponse) {
  const { url, event, data } = request;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event,
        data,
        timestamp: new Date().toISOString(),
        source: 'AutoFlowPro'
      })
    });

    if (response.ok) {
      sendResponse({ status: "sent" });
    } else {
      sendResponse({ status: "error", message: `HTTP ${response.status}` });
    }
  } catch (error) {
    sendResponse({ status: "error", message: error.message });
  }
}

// ============================================================
// LOGS EXPORT HANDLER
// ============================================================
async function handleExportLogs(request, sendResponse) {
  const { logs, filename } = request;

  try {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    await chrome.downloads.download({
      url,
      filename: filename || `autoflow_logs_${Date.now()}.json`,
      saveAs: true
    });

    sendResponse({ status: "exported" });
  } catch (error) {
    sendResponse({ status: "error", message: error.message });
  }
}

// ============================================================
// STARTUP INITIALIZATION
// ============================================================
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Auto Flow Pro v8.0.0 installed/updated");

  // Initialize storage with defaults if needed
  const data = await chrome.storage.local.get(['settings', 'selectorPatterns']);

  if (!data.settings) {
    await chrome.storage.local.set({
      settings: {
        model: 'Veo 3.1 fast',
        ratio: 'Ngang',
        count: '1',
        autoDownload: true,
        timeout: 300
      }
    });
  }

  if (!data.selectorPatterns) {
    await chrome.storage.local.set({
      selectorPatterns: {}
    });
  }
});

console.log("Auto Flow Pro Background Service Worker Loaded");
