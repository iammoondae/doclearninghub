# Implementation Plan: Admin Console Upgrade & Multi-Account Enhancements

This plan details the styling, structural, and behavioral upgrades for the **Department of Chemistry Portal** administration console, user feedback loops, notice workflows, and release lifecycle management.

---

## User Review Required

> [!IMPORTANT]
> **Firestore Schema & Persistence**:
> * We are adding two new Firestore collections:
>   1. `feedback_submissions`: Stores bug reports and feature requests submitted by students, faculty, and custodians.
>   2. `notices_tasks`: Stores notifications, user-created tasks, and inbox messages.
> * We will add a document `system_settings/config` to track the global environment phase (`live` vs. `testing`) and the current active live version.
> * **Permissions**: Firestore security rules will be updated in `firestore.rules` to allow users to read/write their own feedback and tasks, while restricting admin-only fields.

> [!WARNING]
> **Local Backup Sync & Python CLI Update**:
> * The backup limits will be increased from 10 to 30.
> * We will modify `qa-tools/backup_restore.py` to enforce a 30-backup rotation cap instead of 10.
> * The status (`Live` or `Testing Phase`) will be written to `backups/backup_index.json` during the local backup generation process by checking the current phase from Firestore.

---

## Proposed Changes

### 1. Core Architecture & Future Roadmap Planning
#### [MODIFY] [task.md](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/task.md)
* Document upcoming priorities requested by the user:
  * **Priority 1**: Android App Admin Module integration.
  * **Priority 2**: Codebase modularization: separating large features into dedicated JavaScript files (e.g. `lims.js`, `pco.js`, `chairperson.js`, `admin.js`, etc.).

---

### 2. Admin Module Layout Redesign (Enterprise Higher-Ed Standard)
#### [MODIFY] [app.js](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/app.js)
* **Multi-Column Fluid Grid Layout**:
  * Instead of rendering separate pages for admin sub-views, we will introduce a cohesive **Admin Console Workspace** (`renderAdminConsoleView`) that uses a dual-sidebar layout similar to the Chairperson Center.
  * **Admin Left Sub-Sidebar**: A fixed vertical column for navigating admin sections:
    * `📊 System Overview`: General statistics, environment control, and semester configuration.
    * `🔔 Class Requests`: Approved/denied requests, active catalog listing.
    * `👥 User Directory`: User listing, role promotions, and single/bulk provisioning.
    * `📋 Access Applications`: Role-based access requests.
    * `🐛 User Feedback & Bugs`: Bug reports and feature request management.
    * `💾 Backups & Restore`: Index of system backups.
    * `📜 System Activity Logs`: Audit trails.
  * **Admin Right Content Viewport**: Renders the selected sub-view dynamically without page reloads, ensuring a highly scannable, smooth experience.
* **Premium Card UI Pattern**:
  * Group related administrative actions and stats into responsive grid-aligned containers with curated gradients, soft drop shadows, and visual indicators.
* **Granular Table Filters & Cmd+K Command Palette**:
  * Add a search text box at the top of the Admin Console that acts as a quick-search palette.
  * Implement frontend state caching of user directories and class lists to enable instant search results.
* **Inline Quick Actions & Detail Drawers**:
  * Replace heavy forms with inline actions (like quick promote buttons or approval ticks).
  * Clicking on a log or a user will slide open the detail drawer (`action-drawer`) to display full details (audit logs, role history).

#### [MODIFY] [index.css](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/index.css)
* Add layouts styles for the nested admin console:
  * `.admin-layout-container`: Flex container for admin sidebar + admin viewport.
  * `.admin-sidebar`: Sub-menu column styling with active highlights.
  * `.admin-viewport`: Right-side card body wrapper.
  * Reusable styling classes for high-usage tables, badges (`.badge-live`, `.badge-testing`), and hover micro-animations.

---

### 3. Bug Report & Feature Request Section
#### [MODIFY] [app.js](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/app.js)
* **Feedback Submission Form**:
  * Add a form section under the dynamic settings drawer (`renderSettingsDrawerContent`) for all user roles except `admin`.
  * Fields: Category (`Bug Report` / `Feature Request`), Subject, Detailed Description, Priority (`Low` / `Medium` / `High`), and an option to attach diagnostic device specs.
  * Save submissions to the Firestore `feedback_submissions` collection.
* **Admin Feedback Workspace**:
  * Display submissions in the new `User Feedback & Bugs` sub-view.
  * Render an inbox-style dashboard showing all submissions, sorted by urgency and status (`Pending Review`, `In Progress`, `Resolved`, `Dismissed`).
  * Add quick action buttons: Mark Reviewed, Update Status, and Reply.

---

### 4. Renamed & Redesigned Notice/Tasks Section
#### [MODIFY] [app.js](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/app.js)
* **Sidebar Tab Integration**:
  * Add a new sidebar menu item `📬 Notice/Tasks` for all logged-in roles.
* **Notice/Tasks Workspace (`renderNoticeTasksView`)**:
  * Render an email inbox-style table layout.
  * Columns: `Sender`, `Time Received`, `Notice/Task Content`, `Action Needed`, `Status`.
  * Add row buttons:
    * `Mark Done`: Completes the task.
    * `Dismiss`: Dismisses the notice.
    * `Reply`: Opens a dialog to send a reply task.
    * `Send Email`: Opens the user's default email client (`mailto:`) with pre-filled details, and automatically marks the task done.
  * Add click action on individual rows to open a details panel with advanced options:
    * **Add Personal Notes**: An auto-saved text area for personal memos.
    * **Set Reminder**: Calendar picker that schedules a visual alarm reminder.
    * **Move to Priority**: Star or flag tasks to pins them to the top of the list.
    * **Reorder Controls**: Move up/down buttons to custom-arrange tasks.

---

### 5. Admin Live/Testing Phase & Redesigned Backup Catalog
#### [MODIFY] [index.html](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/index.html)
* Add the system phase control buttons container next to the role switcher.
  ```html
  <div id="system-phase-container" style="display: none; align-items: center; margin-right: 12px; border-right: 1px solid var(--border-card); padding-right: 12px; gap: 6px;">
    <!-- Rendered dynamically -->
  </div>
  ```

#### [MODIFY] [app.js](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/app.js)
* **Live / Testing Phase Switcher**:
  * Render two buttons: `🟢 Live` and `🟡 Testing Phase` for admin accounts.
  * Read and write the state from/to `system_settings/config` in Firestore.
* **Non-Admin Shield**:
  * On app initialization and role switches, check the current system phase.
  * If the system is in `Testing Phase`, block access for all non-admin accounts and display a premium full-page maintenance overlay: *"System is undergoing development testing. Backups can be activated to live status in the admin console."*
* **Redesigned Backup Table**:
  * Expand columns to include: `Version Name`, `Backup Date`, `Description`, `Environment Status` (`Live`, `Testing Phase`, `Archived`), and `Action`.
  * If a backup is in `Testing Phase`, change the button text to `Activate`. When clicked, it activates this backup version to the public (marking the status as `Live` and updating Firestore).
  * If a backup is `Live` or archived, keep the button as `Restore` which displays the command line instructions.
  * Implement frontend filtering/search controls and paginated "Show More" viewing up to 30 items.

#### [MODIFY] [qa-tools/backup_restore.py](file:///home/moondae/Antigravity%20Projects/DoC Learning Hub/qa-tools/backup_restore.py)
* Update backup limit rotation cap from 10 to 30.
* Save the status metadata (`Testing Phase` or `Live`) inside the backup index.

---

### 6. Admin Console "Unregistered" Switcher Button
#### [MODIFY] [app.js](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/app.js)
* **Role Switcher Expansion**:
  * Render an `👤 Unregistered` button in the admin role switcher bar.
  * When clicked, switch `currentUserRole` to `'unassigned'`.
* **Guest Simulation rendering**:
  * Ensure the user profile card displays guest placeholders ("Guest Student" / "Not Signed In").
  * Ensure settings are hidden, and sign-out header button acts as "Sign In".
  * Render the top switcher bar so the admin can always click `🛡️ Admin Console` to return to admin mode.

---

## Verification Plan

### Automated Tests
* Run `python3 qa-tools/validate_project.py` to ensure all brackets and manifest schemas match perfectly.
* Run `gjs app.js` to ensure the core JavaScript parses successfully without syntax errors.

### Manual Verification
1. **Feedback Loops**: Submit feedback from a Student account. Switch to Admin and verify it shows in the "Bug Reports & Feedback" tab.
2. **Notice inbox**: Add, reply, and dismiss tasks. Test "Send Email" click behavior. Test personal notes and reminders.
3. **Environment Toggles**: Toggle to `Testing Phase` as Admin. Open the portal complex in a separate window/incognito as Student. Ensure the access shield blocks the view. Go to Admin table and click `Activate` on the backup version to restore public access.
4. **Backup Limits**: Validate that `backup_restore.py` allows storing more than 10 backups (test up to 30).
5. **Unregistered preview**: Click the unregistered button, verify the landing page and sign-in cards, and switch back using the top bar.
