# Tab Alcove

A Chrome extension (Manifest V3) that automatically closes or shelves inactive browser tabs based on domain rules — so your workspace stays clean without losing anything important.

## Features

- **Domain Rules** — Set per-domain actions: `shelf` (save & close), `close` (close silently), or `ignore` (never touch)
- **Categories** — Group multiple domains under one label with a shared action rule
- **Shelf** — Shelved tabs are saved and can be restored individually or all at once
- **Auto-pruning** — Shelf items older than the configured retention period are removed automatically
- **Rule priority** — Individual domain rules take precedence over category rules
- **Context menu** — Right-click any page → "Send to Shelf"
- **Export / Import** — Back up and restore all rules, categories, settings, and shelf as JSON

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `tab-shelf` folder
5. Click the Tab Alcove icon in the toolbar to open the side panel

## Usage

- **Side panel** — Browse and restore shelved tabs, search, expand by domain/category
- **Settings page** — Manage domain rules, categories, shelf retention, and keyboard shortcuts
- **Shelf All Tabs** — Saves all tabs in the current window to the shelf at once
- Pinned tabs and internal Chrome pages (`chrome://`, `about:`, etc.) are always excluded

## Tech

- Chrome MV3 / Service Worker
- ES Modules (`import`/`export`)
- `chrome.storage.local` for rules, categories, settings, shelf
- `chrome.storage.session` for per-tab activity tracking (survives service worker restarts)
- `chrome.alarms` for 1-minute periodic inactive tab checks
