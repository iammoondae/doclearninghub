# Project Summary: Department of Chemistry Learning Hub

This document provides an architectural summary of the Department of Chemistry (DoC) Learning Hub, detailing the current system design, implemented milestones, future roadmap, and recommendations for automating quality assurance.

---

## 1. Project Description
The **Department of Chemistry (DoC) Learning Hub** is a responsive, client-side Learning Management System (LMS) designed for chemistry students and faculty. The system runs as a clean, lightweight HTML/CSS/JavaScript static application, optimized for compatibility with desktop browsers, mobile devices, and Android WebViews (packaged as an APK). 

The platform connects to **Firebase Firestore** for real-time synchronization of grades, announcements, student rosters, custom classroom resources, and custom teacher-imported assessments. It uses client-side libraries (like KaTeX and Mammoth.js) to keep performance fast and offline-capable without requiring a heavy node backend compiling step.

---

## 2. Implemented Features (Portals & Phase 2)
The codebase has been updated with the following core modules:

*   **Role-Based Access Control (RBAC)**: Supports roles for **Students**, **Teachers**, and **System Administrators** with dynamic menu lists in the sidebar. Bypasses or integrates Google OAuth.
*   **Instructor Dashboard & Tools**:
    *   **Section Manager**: Class section scheduling, custom announcements, and supplementary links.
    *   **Class Roster**: Text-based and CSV/TXT student roster file extractor.
    *   **Spreadsheet Gradebook**: Dynamic columns representing assessments with stats analysis (Mean, Median, Pass Rate, Performance Boundaries), manual grade override controls, and client-side CSV downloads.
    *   **Lab Group Coordinator**: Allows setting up experiment files and assigning members to lab groups.
*   **System Administrator Dashboard**:
    *   Dynamic metrics query cards (student counts, classrooms catalog, pending request counters).
    *   Approval requests inbox and active classroom archiver.
    *   User Directory role promotions/demotions.
*   **Chemistry Autorendering & Math Formats**:
    *   KaTeX auto-render integration supporting display math (`$$`), inline math (`$`), and structural chemical formulas via the `mhchem` extension (`\ce{...}`).
    *   Text-node walker that automatically identifies raw `\ce{...}` patterns in descriptions and wraps them in KaTeX delimiters safely.
*   **Interactive Periodic Table Modal**:
    *   An 18-column IUPAC grid mapping elements 1–36 (Hydrogen to Krypton) with oxidation states, electronic configurations, and description details visible via a contextual floating helper trigger.
*   **DOCX Exam Importer**:
    *   Mammoth.js parser to import Microsoft Word `.docx` custom exams on the fly.
    *   Supports multiple-choice, true/false, and short-answer identification types with custom point mapping and preview options.
*   **Progressive Learning Paths**:
    *   Lecture notes checklist tracking with Firestore-backed completed arrays.
    *   Gating rules that block student quiz entry until notes are completed.

---

## 3. Future Roadmap
*   **Offline Mode Synchronization**: Automatic synchronization queue that caches student answers in IndexedDB or local storage when internet drops, and commits to Firestore when online connectivity returns.
*   **Adaptive Assessment Engines**: Algorithms that adjust subsequent question difficulties based on cumulative correct response rates in previous modules.
*   **Advanced Analytics & Notifications**: Integration of Firebase Cloud Messaging (FCM) to alert students about scheduled quizzes, syllabus overrides, or class announcements.
*   **University Website Server Hosting Migration**: Transition deployment and static assets hosting from GitHub Pages to the official Mindanao State University (MSU) General Santos server. Update Google Cloud OAuth client configurations, Firebase Auth Authorized Domains, and the Android APK WebView target endpoints, and replace GitHub REST API calls with dynamic backend fallbacks (like a simple local listing script or static registry) for lecture notes.

---

## 4. Architectural Quality Assurance Recommendations
To maintain the integrity of the project during rapid features scaling, the following strategies from the `Matts Files_apk` scratchboard are highly recommended:

### A. Syntax & Structural Checking (`check_brackets.py`)
*   **Recommendation**: Implement a brackets validation pre-commit hook or script based on the lexical scanner found in `check_brackets.py`.
*   **Rationale**: Because the project relies on a single large client-side script (`app.js`), manual merges or string replacements are highly prone to unbalanced brackets, parentheses, or string template literals. A lightweight scanner checks brackets, comments, and escape sequences in seconds, preventing blank screens in Android WebViews.

### B. Database Schema & Quality Gate Enforcement (`validate_db.py`)
*   **Recommendation**: Build a specialized schema checker for `manifest.json` and custom quiz configurations based on `validate_db.py`.
*   **Rationale**: As teachers import custom exams via Mammoth, the data formats must strictly match student runner expectations (such as multiple choice choices length, valid answer indexes, correct data types, and image file references). Running a python checker verifies JSON formats, counts questions, checks for forbidden prefixes, and confirms image asset existence prior to updates.

### C. Automated Documentation Auditing (Moon Standards)
*   **Recommendation**: Integrate checkers checking for presence of standards files (`moon_standards.md`, `code_map.md`, `master_context.md`) to guarantee that system guidelines are updated alongside major codebase modifications.
