# Chemistry Stockroom System Architecture Redesign

## Vision

Redesign the Chemistry Stockroom into a workflow-driven Laboratory
Information Management System (LIMS) instead of a collection of feature
pages.

## Core Principles

-   Organize by daily workflow, not technical features.
-   One responsibility per module.
-   Student-centric and transaction-centric design.
-   Minimize duplicate statistics and repeated actions.

# Proposed Modules

## 1. Home

Purpose: Show only items requiring attention.

### Dashboard Cards

-   Pending Returns
-   Pending Approval
-   Overdue Items
-   Lost/Damaged Items
-   Today's Scheduled Laboratory Classes
-   Equipment Availability (add this to future plans)
-   Chemical Availability (add this to future plans)

### Timeline

-   Upcoming laboratory schedules
-   Current releases
-   Pending returns

### Quick Actions

-   Approve Requisition
-   Issue Equipment
-   Receive Returns
-   Scan QR (add this to future plans)
-   Add Accountability
-   Send Reminder
-   Create Announcement
-   Inventory Count (add this to future plans re: inventory module)

------------------------------------------------------------------------

## 2. Transactions

Single transaction center replacing Inbox, Pending Reviews, and
scattered approval pages.

### Filters

-   All
-   Pending
-   Approved
-   Borrowed
-   Returned
-   Overdue
-   Completed
-   Archived

### Layout

Left: - Transaction list

Right: - Transaction details - Timeline - Actions

### Standard Actions

-   Approve
-   Reject
-   Release
-   Receive
-   Clear
-   Archive
-   Print
-   Export
-   Duplicate

------------------------------------------------------------------------

## 3. Students

Replaces "Accountabilities".

Student profile includes:

-   Student information
-   Current borrowings
-   Borrowing history
-   Lost items
-   Damaged items
-   Violations
-   Clearance status
-   Remarks

Actions:

-   Print Clearance
-   Send Reminder
-   Add Accountability
-   Generate Report

------------------------------------------------------------------------

## 4. Inventory (add this to future plans)

Separate from student records.

Tabs:

-   Equipment
-   Chemicals
-   Consumables
-   Storage

Each item contains:

-   Available
-   Reserved
-   Borrowed
-   Maintenance
-   Disposed
-   Expired

------------------------------------------------------------------------

## 5. Reports

Move every report here.

Categories

-   Inventory
-   Borrowing
-   Clearance
-   Damage
-   Lost Items
-   Faculty
-   Subjects
-   Semester

Exports

-   CSV
-   Excel
-   PDF
-   Print

------------------------------------------------------------------------

## 6. Communication

Merge

-   Announcements
-   Reminder Templates
-   Notifications
-   Bulk Email
-   History

------------------------------------------------------------------------

## 7. Settings

-   Semester
-   School Year
-   Categories
-   Policies (show this to student account)
-   Penalties (show this to student account)
-   QR Labels (add this to future plans)
-   Backup
-   Restore
-   User Roles

------------------------------------------------------------------------

# Universal Search

Single search for:

-   Students
-   Equipment (add this to future plans)
-   Chemicals (add this to future plans)
-   Transactions
-   Faculty
-   QR Codes (add this to future plans)
-   Announcements

------------------------------------------------------------------------

# Workflow Improvements

-   Dashboard only displays summaries.
-   Operational work occurs in dedicated modules.
-   One transaction lifecycle.
-   Student-centric clearance.
-   Independent inventory management.
-   Consistent status colors.
-   Slide-out action drawer instead of multiple modals.

------------------------------------------------------------------------

# Recommended Sidebar

    🏠 Home

    📋 Transactions
        All
        Pending
        Borrowed
        Returned
        Completed

    👨‍🎓 Students
        Records
        Clearance
        Violations

    🧪 Inventory (add this to future plans)
        Equipment
        Chemicals
        Consumables
        Storage

    📊 Reports

    📢 Communication

    ⚙ Settings

------------------------------------------------------------------------

# Version 2 Features (add this to future plans)

-   QR Checkout
-   Barcode Labels
-   Digital Signatures
-   Maintenance Scheduling
-   Chemical Expiration Monitoring
-   Low-stock Alerts
-   Inventory Audit
-   Analytics Dashboard
-   Automated Semester Clearance
-   Bulk Processing
-   Mobile Interface
-   Offline Synchronization
-   Workflow Customization
-   Chain-of-Custody Reports

------------------------------------------------------------------------

# Final Recommendation

Transform the Chemistry Stockroom into a standalone mini-LIMS. Separate
Transactions, Students, Inventory, Reports, Communication, and Settings
into independent workflow modules to eliminate redundancy, simplify
navigation, improve maintainability, and support future expansion.
