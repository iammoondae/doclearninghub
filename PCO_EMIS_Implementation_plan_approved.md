# PCO / Environmental Management Information System (EMIS)
## Approved Master Implementation Plan (Version 1)

This document presents the approved master implementation plan to integrate the **PCO / Environmental Management Information System (EMIS)** module into the **Department of Chemistry (DoC) Learning Hub** portal. 

---

## 1. Vision & Core Principles

The PCO EMIS module transforms the portal into a university-wide environmental tracking ledger operated by the Pollution Control Officer (PCO). 

### Core Objectives:
*   **Workflow-Driven Architecture:** Track operational processes (e.g., hazardous waste lifecycle and incident investigations) through structured steps.
*   **Single Source of Truth:** Replace paper-based environmental records with secure, centralized Firestore logs.
*   **Mobile-Friendly Data Entry:** Optimized for "paper-first" encoding by stockroom technicians and campus maintenance personnel.
*   **ISO 14001 Readiness:** Formulate database schemas and directories aligned with environmental aspects registry and compliance tracking.

---

## 2. Information Architecture (The 12 EMIS Areas)

The PCO module navigation will organize functionality into twelve key regions:

1.  **Dashboard:** Executive indicators (Overall Compliance Score, Active Carboy Liters, Wastewater Discharge Warnings, Generator Run Hours, Open Spills, Expiring Permits). Read-only by default.
2.  **Compliance Center:** Obligations calendar, monitoring schedules, and digital corrective/preventive action cards (CAPA).
3.  **Hazardous Waste Ledger:** Tracks chemical containers through the standard lifecycle:
    `Generation → Collection → Container Assignment (Carboy) → Storage (90-day alert) → Inspection → HWSF Transfer → Transport & Treatment (Manifests) → COT Archiving`.
4.  **Solid Waste Ledger:** Logs daily General Services Office (GSO) weights by category (Biodegradable, Recyclable, Residual).
5.  **Wastewater Ledger:** Daily laboratory pH tracking, neutralization logs, and BOD/COD lab test document uploads.
6.  **Air Emissions (Generator Use) Tracker:** Runtime hours, fuel inventories, fuel consumption logs, and emission/opacity inspection records for backup generators.
7.  **Permits & Licenses Repository:** Tracking expirations, documents, and renewal logs for WDP, PTO, HWID, PCO Accreditation, and TSD/Transporter agreements.
8.  **Incidents & Emergency Response:** 24-hour spill notification reporting, emergency contacts directory, and interactive ERCP (SPEED COUNTS) guidelines.
9.  **Environmental Documents:** Digital files organizer for laboratory analyses, official correspondences, university environmental policies, and training rosters.
10. **SMR & Reports Compiler:** Aggregates and pre-formats quarterly Self-Monitoring Report (SMR) and semi-annual Compliance Monitoring Report (CMR) modules for easy manual submission to the DENR-EMB portal.
11. **Analytics Hub:** Dynamic trends charting waste generation rates, water consumption, and energy parameters over time.
12. **Administration Settings:** Setup roles, designate storage facilities, configure warning thresholds (e.g., 90-day limits), and audit logs.

---

## 3. Database Collection Blueprints (Firestore Schema)

To support future platform scaling and multi-role access, the database utilizes entity-based collections linked by reference IDs:

### 1. Collection: `pco_inventory` (Hazardous Waste Containers)
Tracks chemical carboys from start of accumulation to final TSD treatment:
```json
{
  "containerId": "CB-CNMS-2026-003",
  "wasteCode": "G703", // Halogenated Organic Solvents
  "description": "Spent Solvents (Chloroform, DCM) from CNMS Lab",
  "capacityLiters": 20.0,
  "currentVolume": 15.2,
  "location": "CNMS Chemistry Stockroom",
  "status": "active", // "active", "transferred_to_hwsf", "transported", "treated"
  "dateStarted": "2026-05-15T08:00:00Z",
  "daysLimit": 90,
  "deposits": [
    {
      "date": "2026-05-15T09:30:00Z",
      "volume": 5.0,
      "loggedBy": "laboratory@msugensan.edu.ph"
    },
    {
      "date": "2026-06-10T14:15:00Z",
      "volume": 10.2,
      "loggedBy": "laboratory@msugensan.edu.ph"
    }
  ],
  "transporterName": null,
  "tsdName": null,
  "manifestNo": null,
  "cotRef": null
}
```

### 2. Collection: `pco_generators` (Standby Generator Logs)
Tracks runtime and fuel to compute SMR emission logs:
```json
{
  "logId": "GEN-LOG-2026-015",
  "generatorId": "fatima_gen_1", // "fatima_gen_1" (Fatima Main Campus) or "admin_gen_2" (Admin Building)
  "date": "2026-06-25",
  "runHours": 5.5,
  "fuelConsumedLiters": 42.0,
  "fuelAddedLiters": 120.0,
  "purpose": "Power outage support / PPD testing",
  "loggedBy": "laboratory@msugensan.edu.ph",
  "timestamp": "2026-06-25T17:00:00Z"
}
```

### 3. Collection: `pco_solid_waste` (GSO Daily Weights)
Logs campus solid waste diversion and residual metrics:
```json
{
  "logId": "SW-LOG-2026-024",
  "date": "2026-06-26",
  "biodegradableKg": 52.4,
  "recyclableKg": 44.1,
  "residualKg": 75.8,
  "sourceLocation": "OSHD Ladies Dormitory Main",
  "loggedBy": "pco@msugensan.edu.ph",
  "timestamp": "2026-06-26T11:00:00Z"
}
```

### 4. Collection: `pco_wastewater` (pH & Effluent Audit)
Logs daily laboratory discharges to monitor effluent compliance:
```json
{
  "logId": "WW-LOG-2026-042",
  "date": "2026-06-27",
  "location": "CNMS General Laboratory Sinks",
  "phValue": 7.2,
  "neutralizationDone": true,
  "neutralizingAgent": "Sodium Bicarbonate (NaHCO3)",
  "volumeLiters": 40.0,
  "loggedBy": "laboratory@msugensan.edu.ph",
  "timestamp": "2026-06-27T16:30:00Z"
}
```

### 5. Collection: `pco_incidents` (Spills & Compliance Violations)
Logs environmental events and the response steps:
```json
{
  "incidentId": "INC-2026-002",
  "date": "2026-06-28",
  "time": "09:30",
  "location": "CNSM Chemistry Stockroom Area",
  "substance": "Spent Solvents (G703 / G704)",
  "estimatedVolumeLiters": 2.5,
  "description": "Minor container spill during transfer to secondary cart.",
  "responseAction": "Confinement using stockroom spill kit pads (SPEED COUNTS protocol executed).",
  "status": "investigation", // "reported", "verified", "investigation", "remediated", "closed"
  "embNotified24h": true,
  "loggedBy": "pco@msugensan.edu.ph"
}
```

### 6. Collection: `pco_permits` (Repository Registry)
Stores renewal schedules and document attachments for tracking:
```json
{
  "permitId": "PERMIT-WDP-2026",
  "permitType": "Wastewater Discharge Permit",
  "permitNo": "WDP-R12-2026-XXXX",
  "dateIssued": "2026-01-15",
  "expiryDate": "2027-01-15",
  "attachedFileUrl": "gs://doc-learning-hub.appspot.com/pco_documents/wdp_signed_2026.pdf",
  "reminderDaysBefore": [90, 60, 30],
  "status": "active"
}
```

---

## 4. UI/UX & Codebase Integration

The PCO EMIS module will hook directly into the existing single-page layout of the `DoC Learning Hub` portal.

### 1. HTML Layout Changes (`index.html`)
*   **Sidebar Navigation (`#sidebar-dynamic-tabs`)**: Inject dynamic HTML block rendering PCO tabs when the user switches to the `pco` role.
*   **Viewport View Panel (`#viewport-body`)**: Add dedicated CSS viewport panels to render forms, checklists, and spreadsheets:
    *   `#pco-dashboard-view`: Render indicators and alarm gauges.
    *   `#pco-waste-view`: Interactive carboy registries displaying liquid columns and a "Log Carboy Entry" modal form.
    *   `#pco-generators-view`: Logs for standby generators. Form elements allow inputting run hours, fuel additions/consumptions, and purposes.
    *   `#pco-permits-view`: Status dashboard of compliance parameters and certificates.
    *   `#pco-incidents-view`: Forms mapping incident checklists, emergency guides, and an automated Letter Generator which outputs standard request forms directed to the EMB Region XII office.
    *   `#pco-smr-view`: Output grid detailing SMR Modules (General Info, Wastewater Discharge, Standby Generator logs, Solid Waste, and Hazardous Waste manifest logs) so the PCO can easily copy values into the government's SMR Portal.
*   **Chairperson View Placeholder**: Add a navigation placeholder tab (`#tab-chairperson`) inside the admin/faculty sidebar. It will map to `#chairperson-view` where a placeholder text card reads: *"Chairperson Executive Center: Integration planned in next development phase. Active PCO indicators and reports status will be mirrored here."*

### 2. CSS Styling Changes (`index.css`)
*   Add custom variables for PCO-specific themes:
    *   `--pco-primary: #10b981;` (compliance emerald green)
    *   `--pco-warning: #f59e0b;` (90-day storage warning gold)
    *   `--pco-alert: #ef4444;` (incident/expiry crimson)
*   Formulate visual styling for the carboys list:
    *   Dynamic bar filling matching the container's volume-to-capacity ratio.
    *   Warning timers reflecting the accumulation limit (turning red if storage age exceeds 80 days).
*   Add mobile-responsive data tables matching the existing class `.gradebook-table`.

### 3. JavaScript Router Changes (`app.js`)
*   **Role Mapping**: Modify `determineUserRole(email)` and `updateProfileUI` to recognize Ramon M. Eduque, Jr.'s email (`ramon.eduque@msugensan.edu.ph`) and add `'pco'` as one of his active roles in `currentUser.roles`.
*   **Role Switcher**: Update `switchActiveRole` to support toggling into `'pco'` style viewports.
*   **View Controllers**: Write Javascript renderers mapping queries to DOM targets:
    *   `renderPcoDashboardView()`: Fetch permit counts, active carboys, and open spills.
    *   `renderPcoWasteView()`: Handle carboy creation, adding deposits, and translocating waste.
    *   `renderPcoGeneratorsView()`: Support data entry for runtime logs (allowing both PCO, authorized laboratory accounts, and Physical Plant to write to `pco_generators`).
    *   `renderPcoPermitsView()`: Compute countdowns to permit expiration.
    *   `renderPcoIncidentsView()`: Interactive list of spills, SPEED COUNTS directory, and form validation for rapid reporting.
    *   `renderPcoSmrCompiler()`: Compile inputs (total organic waste weight, total liters of F610/G703, total runtime hours of Fatima Gen 1) and sum them by month for SMR Modules.
*   **LIMS Integration (`lims.js`)**: Add a "Chemical Waste Deposit" form modal inside the Stockroom dashboard (`currentUserRole === 'laboratory'`). It permits stockroom technicians to record daily spent chemicals and select an active carboy from `pco_inventory` to assign the deposit to.
*   **Wastewater Logger**: Add a pH and neutralization entry form within the LIMS panel so technicians can log daily laboratory sink effluent status to `pco_wastewater`.

---

## 5. Security Rules (`firestore.rules`)

Add granular path permissions to Firestore to secure PCO data:
```javascript
match /pco_inventory/{docId} {
  allow read: if request.auth != null && (getRole() == 'pco' || getRole() == 'laboratory' || getRole() == 'admin');
  allow write: if request.auth != null && (getRole() == 'pco' || getRole() == 'laboratory' || getRole() == 'admin');
}
match /pco_generators/{docId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && (getRole() == 'pco' || getRole() == 'laboratory' || getRole() == 'admin');
}
match /pco_solid_waste/{docId} {
  allow read: if request.auth != null && (getRole() == 'pco' || getRole() == 'admin');
  allow write: if request.auth != null && (getRole() == 'pco' || getRole() == 'admin');
}
match /pco_wastewater/{docId} {
  allow read: if request.auth != null && (getRole() == 'pco' || getRole() == 'laboratory' || getRole() == 'admin');
  allow write: if request.auth != null && (getRole() == 'pco' || getRole() == 'laboratory' || getRole() == 'admin');
}
match /pco_incidents/{docId} {
  allow read: if request.auth != null && (getRole() == 'pco' || getRole() == 'laboratory' || getRole() == 'admin');
  allow write: if request.auth != null && (getRole() == 'pco' || getRole() == 'admin');
}
match /pco_permits/{docId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && (getRole() == 'pco' || getRole() == 'admin');
}
```

---

## 6. Verification & Test Plan

Since this tracking ledger runs inside a client-side Firebase static environment, we will verify the code updates through the following offline tests:

1.  **Syntactic Integrity**: Run the brackets scanning script `check_brackets.py` to confirm that adding code modules to `app.js` has not broken parenthesization or template strings.
2.  **Authentication and Switching**:
    *   Sign in as a mock user representing `ramon.eduque@msugensan.edu.ph`.
    *   Verify the role switcher displays buttons for `Faculty` and `PCO`.
    *   Verify switching to `PCO` alters the dynamic sidebar tabs and reveals all 6 PCO EMIS tabs.
3.  **Wastewater Deposit Linkage**:
    *   Sign in as a `Laboratory` Stockroom account.
    *   Open the Stockroom dashboard and select "Log Chemical Waste".
    *   Record a deposit of 2.0L organic solvent and link it to carboy `CB-CNMS-2026-003`.
    *   Sign in as the `PCO` and verify the carboy's volume has updated to 17.2L.
4.  **Standby Generator Use Verification**:
    *   Input a log for `fatima_gen_1` with 3.0 run hours and 25L fuel.
    *   Input a second log with 2.0 run hours and 15L fuel.
    *   Verify the SMR Compiler tab (Module 4) displays aggregated values: **5.0 Total Run Hours** and **40L Total Fuel Consumed**.
