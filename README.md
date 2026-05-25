# 🌌 Zen Tab Suspender

Automatically suspends inactive background tabs to save **70% to 80% of your system RAM**. Tailored specifically for **Zen Browser** and **Firefox** utilizing modern WebExtensions Manifest V3 architecture.

This extension is heavily inspired by Sergey Drpa's excellent work on [Tab-Suspender](https://github.com/sergey-drpa/Tab-Suspender), modernized and redesigned with a premium, high-aesthetic glassmorphic UI and advanced diagnostics.

---

## ✨ Core Features

### 1. 💤 Multi-Mode Hibernation
*   **Visual Hibernation (Visual Mode)**: Redirects inactive tabs to a gorgeous glassmorphic parked screen showing the page's original favicon, title, and hostname, backed by a breathing "hibernation heartbeat" pulse ring. Clicking anywhere, pressing space/enter, or focusing the tab instantly restores it.
*   **Silent Unloading (Native Mode)**: Silently unloads background tabs natively without changing their URLs. The tab reloads automatically the millisecond you click it.

### 2. 📊 Precise RAM Diagnostics (Zero-RAM-Tax)
Unlike standard extensions that use static baselines, Zen Tab Suspender runs a **Scientific Tab Resource Profiling Engine** inside the tab's content script context only milliseconds before suspension:
*   Calculates baseline tab overhead (~50MB).
*   Weighs DOM Tree Complexity (~3KB per element node).
*   Measures uncompressed decodes bitmaps in graphics memory (`width * height * 4 bytes` per image).
*   Weighs compiled JS script tags (~250KB each) and stylesheet link files (~150KB each).
*   Counts UTF-16 character byte counts inside local and session storage.
*   **Zero-RAM-Tax**: Because the profiler runs right before the tab is natively discarded, its entire memory space—including the page and our temporary JS variables—is **instantly wiped from your RAM**, yielding accurate statistics for a 0% active memory footprint.

### 3. ⚡ Premium Active Power Toggle
*   Redesigned popup features a large, breathing circular neon power switch.
*   Pulsates **breathing green (`#10b981`)** when active.
*   Transitions to a **pulsing orange/red (`#ef4444`)** when auto-suspension is disabled.

### 4. ⏱️ Auto-Suspend Range Slider with Chevron Adjustments
*   Custom range slider bar inside the Options Dashboard and Action Popup to fine-tune timeout intervals.
*   Flanked by chevron arrow buttons (`◀` and `▶`) to easily increment or decrement timeout values in 5-minute steps.
*   Dynamically formats scale labels (e.g. `2 Hours 15 Mins`).

### 5. ⏸️ Temporary Pause pills with Live Countdowns
*   Quickly pause auto-suspension for **10 minutes, 1 hour, 5 hours, or 24 hours** with glassmorphic pill selectors.
*   Active pauses hide the selector grid, showing a ticking live countdown clock (`HH:MM:SS`) and a glowing "Resume Auto-Suspend" button to override the pause instantly.

### 6. 🛡️ Absolute Data & Input Protections
*   **Active Form typing protection**: A lightweight content script listens for inputs on textareas and text fields. If you have typed meaningful text, it locks the tab as exempt from suspension, avoiding accidental data loss.
*   **Audible Exclusions**: Protects tabs actively playing media (YouTube, Spotify, etc.) from being suspended.
*   **Pinned Tab Protection**: Exempts important pinned browser tabs.
*   **Domain Whitelisting**: An inline card manager supporting exact hostname or wildcard rules (e.g. `*mail.google.com*`) to bypass suspension entirely.

### 7. 🗂️ Suspension History Dashboard & Safe Exports
*   **Grid Cards**: Review, search, or restore your suspended pages chronologically. Cards include relative suspension times (e.g. `Just now`, `5h ago`) and dynamic individual RAM badge counters showing exactly how much memory that tab saved!
*   **Search bar**: Filter suspended entries in real-time by title or URL.
*   **Backup Export**: Downloads a clean `.md` markdown list of all suspended URLs. This guarantees you **never lose your tabs** even if you clear cache, wipe browser local storage, or format your computer.
*   **Action Popup Quick-Link**: A sleek horizontal summary row at the bottom of the popup displaying a live tab counter and total actual RAM saved. Clicking it opens the dashboard and automatically focuses the history tab.

---

## 🛠️ Installation & Developer Mode Setup

Zen Tab Suspender is built specifically for Gecko/Firefox based frameworks. You can load it in Zen Browser or Firefox Developer mode instantly:

### Step 1: Open Runtime Debugging
Type **`about:debugging`** in your Zen Browser or Firefox address bar and press Enter.

### Step 2: Load Temporary Add-on
1.  Click on **This Firefox** (or **This Browser**) in the left sidebar.
2.  Click the **Load Temporary Add-on...** button.
3.  Navigate to your extension workspace folder: `c:\Antigrav projects\zen fix\Zen-Tab-Suspender\Tab-Suspender-for-zen\`.
4.  Select the **`manifest.json`** file and click **Open**.

### Step 3: Verify the Extension
*   The glowing Zen icon will appear in your action toolbar.
*   Click it to open the popup, or click the gear icon to open the full Options Panel!

---

## 👨‍💻 Developer & Support

This project was built and designed by **Utkarsh Kale**.

*   **Instagram**: you can follow me at [**@cavemannath**](https://www.instagram.com/cavemannath/)
*   **PayPal**: If you like the extension, find it useful, and want to support future upgrades or buy me a coffee, supporting at [**paypal.me/NathKale**](https://paypal.me/NathKale) will be massive!

---

## 📄 License
This project is open-source. Feel free to fork, customize, or contribute!
