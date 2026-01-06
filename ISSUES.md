# GitHub Issues - Veo3Tool Improvement Plan

Copy nội dung từng issue bên dưới vào GitHub Issues.

---

## Issue #1: [COMPLETED] Fix deprecated chrome.extension.getViews() API

**Labels:** `bug`, `priority:high`, `phase-1`

### Description
The `forwardToPanel` function in `background.js` uses the deprecated `chrome.extension.getViews()` API which may cause issues in newer Chrome versions.

### Solution Implemented
- Replaced with `chrome.runtime.sendMessage()` for modern message broadcasting
- Added fallback to send messages to all tabs with content script

### Files Changed
- `background.js` (lines 77-95)

### Status: ✅ COMPLETED

---

## Issue #2: [TODO] Update Selector Engine for new VEO UI

**Labels:** `enhancement`, `priority:high`, `phase-1`

### Description
Google VEO AI frequently changes its UI. The XPath selectors in `SelectorEngine.patterns` need to be updated to match the current UI.

### Tasks
- [ ] Audit current selectors against live VEO interface
- [ ] Add new selectors for updated UI elements
- [ ] Implement selector fallback chain
- [ ] Add user-facing selector learning UI

### Files to Update
- `content.js` - `SelectorEngine.patterns`

---

## Issue #3: [COMPLETED] Comprehensive Error Handling

**Labels:** `bug`, `priority:high`, `phase-1`

### Description
Add try-catch blocks to all critical functions to prevent extension crashes and provide better error feedback.

### Solution Implemented
- Added try-catch for each action in message listener
- Validate request parameters before processing
- Log execution time for performance monitoring
- Graceful error responses instead of crashes
- Added new actions: `CLEAR_LOGS`, `DISCONNECT_WATCHER`

### Files Changed
- `content.js` (message listener, Logger module)
- `panel.js` (addLog function)

### Status: ✅ COMPLETED

---

## Issue #4: [COMPLETED] Fix Memory Leaks

**Labels:** `bug`, `priority:high`, `phase-1`

### Description
Multiple memory leak issues:
1. DOMWatcher has no `disconnect()` method
2. Logs accumulate without proper limits
3. Video scan interval never cleared

### Solution Implemented
- **Logger**: Strict 500 entry limit, trim to 80% when exceeded
- **DOMWatcher**: Added `disconnect()` method with full cleanup:
  - Disconnect MutationObserver
  - Clear video scan interval
  - Clear debounce timer
  - Clear knownVideos Set
  - Added `isDestroyed` flag
- **Panel logs**: Limited to 300 entries

### Files Changed
- `content.js` (Logger, DOMWatcher)
- `panel.js` (addLog, clearLogs)

### Status: ✅ COMPLETED

---

## Issue #5: [TODO] AI Prompt Generator Integration

**Labels:** `enhancement`, `priority:medium`, `phase-2`

### Description
Integrate GPT/Claude API to automatically generate video prompts from keywords.

### Tasks
- [ ] Add API key configuration UI
- [ ] Implement prompt generation service
- [ ] Add "Generate from keywords" button
- [ ] Support batch generation

---

## Issue #6: [TODO] Batch Preview Feature

**Labels:** `enhancement`, `priority:medium`, `phase-2`

### Description
Allow users to preview video thumbnails before downloading.

### Tasks
- [ ] Capture video thumbnails during generation
- [ ] Add preview modal with gallery view
- [ ] Implement selective download

---

## Issue #7: [TODO] Multi-Tab Support

**Labels:** `enhancement`, `priority:medium`, `phase-2`

### Description
Enable running video generation in parallel across multiple VEO tabs.

### Tasks
- [ ] Track active tabs with content script
- [ ] Implement load balancing across tabs
- [ ] Add tab status indicators in dashboard

---

## Issue #8: [TODO] Resume Queue After Crash

**Labels:** `enhancement`, `priority:high`, `phase-2`

### Description
Save queue state to chrome.storage.local to allow resuming after browser crash or refresh.

### Tasks
- [ ] Persist queue state on each task completion
- [ ] Detect incomplete queue on startup
- [ ] Add "Resume" button for interrupted queues

---

## Issue #9: [TODO] Template System

**Labels:** `enhancement`, `priority:low`, `phase-2`

### Description
Allow users to save and reuse prompt templates with variable placeholders.

### Tasks
- [ ] Design template format with {{variables}}
- [ ] Add template management UI
- [ ] Implement variable substitution
- [ ] Export/import templates

---

## Issue #10: [TODO] Statistics Export

**Labels:** `enhancement`, `priority:low`, `phase-2`

### Description
Export performance reports in CSV/Excel format.

### Tasks
- [ ] Track generation metrics (time, success rate, etc.)
- [ ] Implement CSV export
- [ ] Add Excel export option

---

## Issue #11: [TODO] Dark/Light Theme Toggle

**Labels:** `enhancement`, `priority:low`, `phase-3`

### Description
Add theme switching capability for user preference.

### Tasks
- [ ] Define light theme CSS variables
- [ ] Add theme toggle button
- [ ] Persist theme preference

---

## Issue #12: [TODO] TypeScript Migration

**Labels:** `refactor`, `priority:low`, `phase-4`

### Description
Migrate codebase to TypeScript for better type safety and maintainability.

### Tasks
- [ ] Set up TypeScript configuration
- [ ] Convert content.js to TypeScript
- [ ] Convert panel.js to TypeScript
- [ ] Convert background.js to TypeScript
- [ ] Add type definitions for Chrome APIs

---

## Issue #13: [TODO] Add Unit Tests

**Labels:** `testing`, `priority:low`, `phase-4`

### Description
Add Jest tests for core functions to ensure reliability.

### Tasks
- [ ] Set up Jest testing environment
- [ ] Write tests for Logger module
- [ ] Write tests for SelectorEngine
- [ ] Write tests for RateLimiter
- [ ] Write tests for SmartQueue
