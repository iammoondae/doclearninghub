# DoC Learning Hub - Codebase Mapping & Debug References

This index maps the main architectural structures, layouts, controllers, styles, and logic files across the codebase. Developers and AI assistants must refer to these sections directly for debugging and edits.

---

## 📱 1. Web Frontend Layer

### A. Main HTML Layout (`index.html`)
* **File Path**: [index.html](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/index.html)
* **Key Components**:
  * **Theme Configuration Meta**: Line 6 (`#theme-meta`)
  * **Sidebar Navigation**: Lines 26-51 (`#sidebar-nav`) - user profile card, dynamic sidebar tabs loader, overlay.
  * **Main Header & Toolbar**: Lines 57-73 (`header-container`) - hamburger toggle, course details, settings button, theme switcher, sign-out button.
  * **Main Viewport Body**: Line 90 (`#viewport-body`) - main content render target.
  * **Interactive Assessment Footer**: Lines 95-101 (`#viewport-footer`) - next/prev buttons for slides or quiz navigation.
  * **Background Music Player Bar**: Lines 104-121 (`#music-player-bar`) - control toggles and volume sliders.
  * **Settings Drawer Menu**: Lines 126-241 (`#settings-drawer`) - student profile naming, course settings selection, music uploader, update triggers, admin credential locks.
  * **Onboarding Overlay Screens**: Lines 245-316 (`#onboarding-overlay`) - stages 1 and 2 of profile onboarding.
  * **Developer Debug Quick-Roles Bar**: Lines 273-281 (`.developer-debug-bar`) - debug button bypasses for student, teacher, and admin profiles.
  * **Modals**:
    * **Changelog Modal**: Line 325 (`#changelog-modal`)
    * **About Modal**: Line 338 (`#about-modal`)
    * **Class Request Modal**: Line 351 (`#class-request-modal`)
    * **Student Enrollment Modal**: Line 378 (`#student-enrollment-modal`)
    * **Score Override Modal**: Line 404 (`#score-editor-modal`)

### B. Core Styling System (`index.css`)
* **File Path**: [index.css](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/index.css)
* **Key Components**:
  * **Theme Variables (`:root` & `body.light-mode`)**: Lines 1-52 - dark and light mode color palette tokens, layout spacing, HSL variables.
  * **Developer Debug Bar styles**: Lines 530-555
  * **Teacher portal dashboard grids**: Lines 650-685
  * **Roster spreadsheets & Gradebook tables**: Lines 690-750 (`.gradebook-table`)
  * **Dynamic metric banners**: Lines 755-790 (`.gradebook-stats-banner`)

### C. Client Script Engine (`app.js`)
* **File Path**: [app.js](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/app.js)
* **Key Components**:
  * **Module Scheduling Queries**: Line 39 (`isQuizScheduled`) and Line 48 (`isAssignScheduled`).
  * **Firebase Firestore Initialization**: Line 57
  * **Onboarding Student profile setup**: Line 169 (`submitOnboardingStage2`)
  * **Developer Mock Bypass (`debugSetRole`)**: Line 220
  * **Database authorization and cache loaders**: Line 276 (`loadStudentClassData`) and Line 299 (`loadUserSession`).
  * **Sidebar Navigation renderer**: Line 661 (`renderSidebarNavigation`)
  * **Navigation Mode Router**: Line 821 (`setMode`)
  * **Screen Render Dispatcher**: Line 836 (`renderCurrentModeView`)
  * **Dashboard Layouts (Home)**: Line 916 (`renderDashboardView`)
  * **Syllabus Rendering Engine**: Line 1249 (`renderSyllabusView`)
  * **Lecture Notes PDF Viewer**: Line 1966 (`renderLectureNotesView`)
  * **Objective Assessment Engine (Quiz)**: Line 2194 (`renderAssessmentsView`)
  * **Student Profile Grades Tracker**: Line 2585 (`renderStudentProgressView`)
  * **Background Music Engine**: Line 2832 (`renderTracklistUI`)
  * **Teacher Portals**:
    * **My Classrooms Dashboard**: Line 3645 (`renderTeacherClassesView`)
    * **Gradebook Spreadsheet Grid**: Line 3735 (`renderTeacherGradebookView`)
    * **Gradebook Data Loader**: Line 3765 (`loadGradebookData`)
    * **Laboratory Groups Organizer**: Line 4174 (`renderTeacherGroupsView`)
    * **Classroom Resource tabs**: Line 4803 (`renderTeacherClassDetailsView`)
  * **Admin Portals**:
    * **Pending Class Requests & Catalog**: Line 4488 (`renderAdminRequestsView`)
    * **User Directory promotions**: Line 4637 (`renderAdminUsersView`)
  * **Database Custom Overrides**:
    * **Syllabus URL Updates**: Line 5124 (`updateClassSyllabusUrl`)
    * **Gradebook CSV Exporter**: Line 5141 (`exportGradebookToCSV`)
