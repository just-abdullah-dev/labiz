# 🎓 Lab Viva Marker PWA

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-purple.svg?logo=pwa)](https://web.dev/progressive-web-apps/)
[![Offline First](https://img.shields.io/badge/IndexedDB-Dexie.js-blue.svg)](https://dexie.com/)
[![Excel Compatibility](https://img.shields.io/badge/Excel-SheetJS-green.svg)](https://sheetjs.com/)
[![Light Theme Only](https://img.shields.io/badge/UI-Light%20Theme-yellow.svg)](#)

> **A phone-first, 100% offline Progressive Web App (PWA) built specifically for university instructors, lab engineers, teaching assistants (TAs), and professors to grade lab viva voce and oral assessments on the move with single-tap speed.**

---

## 📌 GitHub Repository Description (Under 350 Characters)

```text
Phone-first offline PWA for lab engineers, university teachers & instructors to rapidly mark viva exams. Features instant 1-tap grading, smart university Excel (.xlsx) roster import/export, haptic feedback, PIN privacy lock, and local IndexedDB storage. Zero server calls, 100% private.
```
*(Character count: 284)*

---

## 💡 The Problem It Solves

During laboratory sessions (Engineering, Computer Science, Sciences, Medical labs), instructors and lab engineers walk between desks to conduct oral evaluations (viva voce) for 30–60 students per section:
- **Paper rubrics and clipboards** get crumpled, smudged, or lost, requiring manual data re-entry into Excel sheets late at night.
- **Desktop grading systems and university portals (LMS/CMS)** are sluggish, require continuous internet connectivity, and are impractical to use standing up with one hand.
- **Campus Wi-Fi** in basement or specialized laboratories is frequently unreliable or completely absent.
- **Spreadsheets on mobile phones** (Google Sheets, mobile Excel) have microscopic touch targets, require keyboard zoom, and lead to accidental misclicks and data corruption.

**Lab Viva Marker** is purpose-built to solve this. It provides a tactile, smartphone-optimized interface designed specifically for one-handed operation while standing, storing every mark instantly in local browser storage (`IndexedDB`) with zero reliance on cloud connections.

---

## 🚀 Key Features & Capabilities

### ⚡ Ultra-Fast 1-Tap Marking Flow (FR4)
- **Instant Save**: Every evaluation is persisted to IndexedDB immediately before any animation finishes — zero lag, no save buttons, zero risk of data loss on tab close.
- **Large 2×3 Touch Targets**: Thumb-friendly buttons (minimum 56px height) styled with high-contrast, accessible colors.
- **Haptic Tactile Feedback**: Short vibration pulse (`navigator.vibrate`) provides physical confirmation of registered marks without needing to look away from the student.
- **Automatic Next-Student Advance**: Smoothly auto-scrolls to the next unmarked student immediately upon grading.
- **5-Second Undo Toast**: Floating snackbar allows 1-tap cancellation if you mishear or re-evaluate an answer.
- **Sticky Header & Search**: Real-time case-insensitive search by student name or registration number, live progress bar (`38/40 marked - 95%`), and quick filter chips (`All` | `Unmarked` | `Marked`).
- **Hidden Numerical Marks**: Grade numbers remain strictly hidden on the evaluation screen to prevent peer anxiety or screen peeking during lab walkabouts.
- **Secondary Notes**: Quick inline note popover for any student (e.g. *"Redo experiment 3"*, *"Needs follow-up viva"*) without interrupting grading flow.

### 📊 Smart University Excel Roster Import & Sync (FR2)
- **Automatic Header Detection**: Detects column headers dynamically by searching for the `"Reg No."` cell rather than relying on hardcoded row indexes.
- **Automatic Metadata Extraction**: Automatically parses `Course Title`, `Section`, and `Session` (e.g., *Programming Fundamentals Lab*, *Section M*, *FALL-2026*) directly from header rows.
- **Name Normalization**: Trims leading/trailing whitespace and collapses duplicated middle spaces (`"Raja  Sheryar "` → `"Raja Sheryar"`).
- **Strict Privacy Compliance**: Extracts **only** academic identification fields (`serialNo`, `regNo`, `name`, `batch`). Contact numbers, private emails, and personal identifiers are completely discarded.
- **Non-Destructive Roster Re-Import**: Updates student names if changed and adds newcomers while safely preserving students missing from updated rosters. **Never auto-deletes student records.**
- **Manual Student Management**: Add, edit, or delete individual students manually with safety confirmation prompts.

### 🔒 On-Screen Privacy PIN Lock (FR1)
- **Local Security Lock**: Designed as a privacy shield to prevent students from tampering with or viewing grade books when the phone is left on a desk.
- **Cryptographic Hashing**: PIN is secured using salted **PBKDF2 with SHA-256 (100,000 iterations)** via the Web Crypto API (`crypto.subtle`).
- **Auto-Lock Timer**: Automatically locks on app launch and whenever the browser remains in the background for **5 minutes** (`visibilitychange`).
- **Emergency Recovery**: Direct **Restore Backup** and **Reset App** shortcuts prominently visible on the lock screen.

### 📁 Official Excel (.xlsx) & CSV Export (FR5)
- **Official Roster Format**: Exports marks for individual lab sessions or all semester sessions into standardized spreadsheets with the exact schema:
  ```text
  Name | Reg No | Lab No | Date Time | Remarks | Marks | Notes
  ```
- **Unmarked Absentees**: Students without recorded remarks export as blank with `0` marks.
- **Summary Sheet Option**: Generates an optional second sheet tab with all lab session marks side-by-side plus cumulative student totals.
- **Web Share API**: One-tap sharing directly to WhatsApp, Google Drive, Email, or instant browser file download.

### 💾 Backup, Restore & Data Durability (FR6)
- **1-Click JSON Backup**: Downloads or shares a single structured `.json` snapshot of all classes, rosters, sessions, entries, and settings.
- **Interactive Restore Preview**: Displays total classes, students, labs, and mark counts before replacing existing data.
- **Proactive Backup Reminders**: Notification banner appears on Home whenever backups are older than 7 days or immediately after completing a lab.
- **Persistent Storage**: Proactively requests browser storage exemption via `navigator.storage.persist()`.

### ⚙️ Customizable Grading Scale (FR7)
- Customizable remark titles, numerical marks, and color scales (defaults to 6 academic levels: *Excellent [10]*, *Very Good [8]*, *Good [7]*, *Satisfactory [5]*, *Weak [3]*, *Unsatisfactory [1]*).
- Numerical marks stay strictly concealed on evaluation screens and only surface during official exports.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | High-speed static generation with TypeScript safety |
| **Output Mode** | Static Export (`output: 'export'`) | Zero Node.js runtime required; deployable to any CDN / static host |
| **Database** | IndexedDB via [Dexie.js](https://dexie.com/) | High-performance, offline-native relational querying on device |
| **Spreadsheet Engine** | [SheetJS (`xlsx`)](https://sheetjs.com/) | 100% in-browser Excel parsing and workbook generation |
| **PWA Engine** | Custom Service Worker (`sw.js`) | Offline cache-first static shell with stale-while-revalidate |
| **Styling** | Tailwind CSS v4 | Lightweight, clean light theme, `touch-action: manipulation` |
| **Cryptography** | Web Crypto API (`crypto.subtle`) | Native browser hardware-accelerated PBKDF2/SHA-256 |
| **Icons** | Lucide React | Clean, recognizable stroke iconography |

---

## 📲 How to Install as a Native PWA

### Android (Chrome / Edge / Firefox)
1. Open the deployed application URL in your mobile browser.
2. Tap the browser options menu (`⋮`) and select **"Add to Home screen"** or **"Install app"**.
3. The app icon will appear on your phone's home screen and run in standalone full-screen mode without browser address bars.

### iOS (Apple Safari)
1. Navigate to the app URL in Safari.
2. Tap the **Share** button (square with arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add**. The app launches as a standalone iOS app with full safe-area support.

---

## 🚀 Deployment Guide (Vercel, Netlify, GitHub Pages)

Because this app produces a purely static export (`out/` directory), it can be hosted permanently for **free** with zero backend infrastructure.

### Deploying to Vercel
1. Fork or push this repository to GitHub.
2. Log into [vercel.com](https://vercel.com/) and click **"Add New Project"**.
3. Import your repository.
4. **Build Settings**:
   - Framework Preset: `Next.js`
   - Build Command: `npm run build`
   - Output Directory: `out` (handled automatically)
5. Click **Deploy**. Your PWA is live with automatic SSL.

---

## 🧑‍💻 Local Development & Verification

### Prerequisites
- Node.js 18+ or 20+
- npm or pnpm

### Quick Start
```bash
# Clone the repository
git clone https://github.com/your-username/lab-viva-marker.git
cd lab-viva-marker

# Install dependencies
npm install

# Start local development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) on your desktop or phone (via local LAN IP).

### Build Verification
```bash
# Compile production static export
npm run build
```

### Run Automated Acceptance Test Suite
```bash
# Verifies Excel parsing, reconciliation, export columns, and backup serialization
node scripts/test-acceptance.js
```

---

## 🛡️ Privacy & Security Model

- **No Remote Telemetry**: Zero external tracking, zero analytics, zero external network requests.
- **Client-Side Storage**: All academic data, marks, notes, and rosters are stored solely on the evaluator's physical device in `IndexedDB`.
- **Minimal PII Collection**: Email addresses, student mobile numbers, and personal identifiers from institutional sheets are filtered out upon import and never persisted.
- **Local Privacy Lock**: The PIN lock provides physical access restriction on the device screen; it is intended as a convenience screen privacy lock for roaming educators.

---

## 📜 License

Distributed under the **MIT License**. Free for university departments, schools, educators, and independent developers. Contributions, issues, and feature suggestions are welcome!
