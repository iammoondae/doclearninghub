# DoC Learning Hub - Universal Alignment & Context

Welcome! This document serves as the absolute single source of truth (master context) for any AI coding assistant or developer working on **DoC Learning Hub**. It catalogs all design decisions, database schemas, and architectural guidelines to prevent regression and ensure code alignment.

---

## 📌 1. Project Overview & Target Audience
* **Name**: DoC Learning Hub (Department of Chemistry Learning Hub)
* **Target Users**: Chemistry undergraduate students and faculty instructors at Mindanao State University (MSU) General Santos, Philippines.
* **Core Purpose**: A lightweight Virtual Learning Environment (VLE) and Learning Management System (LMS) designed for secure material distribution, online quiz assessments, class record gradebooks, and experimental laboratory groups organization.
* **Tech Stack**: Pure client-side frontend layer (Vanilla HTML5, CSS3, and ES6 Javascript) utilizing Firebase Compat SDK (v8/v9 compat) for Firestore. Embedded inside a standard Android WebView via Gradle wrapper. No build pipeline (Next.js/React is not used in the web deployment to ensure maximum compatibility and zero-dependency loading).

---

## 🔐 2. Authentication & User Roles
To protect academic records and assessment integrity, the system implements strict role-based access:
* **Account Domain Boundary**: Only university Google accounts ending in `@msugensan.edu.ph` are authorized to sign in (validated on auth callbacks).
* **Role Permissions**:
  * **Student**: Accesses classrooms they are enrolled in, views weekly lecture notes, completes objective assessments (quizzes), self-tracks assignments, views grade overrides, and accesses the course syllabus.
  * **Teacher**: Manages requested classes, enrolls student rosters (raw input, TXT/CSV files), organizes students into lab groups, posts announcements/materials, sets custom syllabus override URLs, sets quiz/task active scheduler states, and reviews class record gradebooks.
  * **Chairperson**: Oversees departmental activities via a read-only executive overview panel (Phase 3 Integration Roadmap target).
  * **Administrator**: System monitoring statistics (students, classes, pending counts), approves/denies class requests, archives/deletes active classrooms catalog, and manages user directory role promotions (e.g. promoting a student to a teacher).
* **Developer Debug Panel**: For quality control and local validation, a styled testing bar is provided on the onboarding screen containing Student, Teacher, and Admin bypass buttons. Clicking a button creates a mock session and saves `debug_active_role` in `localStorage` to persist across page reloads.

---

## 🏛️ 3. Database Schema Design (Cloud Firestore)
The application relies on three core collections:

### A. Classroom Records (`/classes`)
* **Document ID**: Auto-generated or custom classroom identifier.
* **Schema Fields**:
  * `courseId` (string): The manifest identifier mapping to the course details (e.g., `genchem`).
  * `courseName` (string): Human-readable name.
  * `section` (string): Class section (e.g., `49C`).
  * `year` (string): Academic Year (e.g., `2026-2027`).
  * `teacherName` (string), `teacherEmail` (string): Owner details.
  * `status` (string): Either `pending` or `approved`.
  * `students` (array of strings): Enrolled student email addresses.
  * `announcements` (array of objects): Section updates containing `{ id, title, content, createdAt }`.
  * `customMaterials` (array of objects): Shared reading files containing `{ id, name, url, createdAt }`.
  * `scheduledQuizzes` (array of strings): Module IDs where quizzes are visible to students.
  * `scheduledAssignments` (array of strings): Module IDs where assignment cards are visible.
  * `syllabusUrl` (string, optional): Custom direct link to a section-specific PDF syllabus, overriding manifest definitions.

### B. Student Profiles (`/students`)
* **Document ID**: Student's Google email address (normalized, lowercase).
* **Schema Fields**:
  * `name` (string): Display name.
  * `email` (string): User email address.
  * `studentId` (string): University identification number.
  * `year` (string), `section` (string): Onboarding identifiers.
  * `role` (string): Either `student`, `teacher`, or `admin`.
  * `timestamp` (string): Registration date.

### C. Assessment Grades (`/scores`)
* **Document ID**: Auto-generated score submission identifier.
* **Schema Fields**:
  * `email` (string): Submitting student email.
  * `studentId` (string): Submitting student ID.
  * `courseId` (string): Associated course ID.
  * `moduleId` (string): Associated module ID.
  * `taskTitle` (string): Assessment title.
  * `score` (number): Numerical score obtained.
  * `maxScore` (number): Maximum possible score.
  * `mode` (string): Either `quiz` or `assignment`.
  * `timestamp` (string): ISO submission time.
  * `override` (boolean, optional): Set to `true` if manual override was submitted by the teacher.

---

## 🎨 4. Design Aesthetics & Core UX
* **Visual Theme**: Accent color is Teal (`#0d9488`). Features dark mode by default with light mode toggle support. Styling uses HSL variables under `:root` and `body.light-mode`.
* **Sidebar Layout**: Responsive sliding panel switching dynamically between student, teacher, and administrator views based on active authentication state.
* **Background Music**: Ambient player bar located at the bottom of the screen allowing users to upload personal music files stored in IndexedDB/Local storage for study accompaniment.

---

*Keep this document updated whenever a major database or routing change is approved by the user.*
