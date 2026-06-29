# DoC Learning Hub - Quality Control Standards (Moon Standards)

This document establishes the official quality gate guidelines for development and integration within the **DoC Learning Hub**. All changes, updates, and database modifications must satisfy these rules.

---

## 🔐 1. Authentication & Security Gates
* **Domain Restrictions**: Only accounts ending in `@msugensan.edu.ph` must pass authentication filters (except debug-level overrides).
* **Testing Mode Integrity**: The developer quick-role selection bar (`#dev-debug-role-bar`) must only render during non-production testing deployments.
* **Role Check Lock**: Direct file path routing or navigation state switches must trigger authorization checks on the active database profile. If profile role matches do not allow access (e.g. standard student trying to execute a teacher routing path), they must be silently returned to their dashboard view.

---

## 🏛️ 2. Firestore Schema & Array Updates
* **Class Configuration**: Updating schedules (e.g., active assessments visibility) must use Firebase array operators (`FieldValue.arrayUnion` or `FieldValue.arrayRemove`) to avoid data overwrite conflicts between concurrent teacher requests.
* **Class Enrolment**: Pasted lists or roster files must validate that emails belong to the `@msugensan.edu.ph` domain prior to appending the student IDs.

---

## 📈 3. Gradebook Analytics & CSV Export Standards
* **Calculations**:
  * **Mean (Average)**: Must represent the class-wide cumulative percentage average (total score / total maximum possible points across all active assessments).
  * **Median**: Must compute the exact midpoint of student cumulative percentages.
  * **Pass Rate**: Must count the number of students with average grades `>= 60%` out of the total enrolled student count.
* **CSV Columns**: Headers must contain Student Name, Student ID, Email, and all Quiz/Task titles. Double quotes must escape names containing commas or special characters.
* **Blob Exporter**: Must utilize standard client-side download buffers ensuring compatibility with modern Android WebViews.

---

## 📋 4. Custom Classroom Syllabus Override Gate
* **Overriding Condition**: If `syllabusUrl` exists in the active classroom document:
  * Sidebar navigation for `Syllabus` must show a section stating that a custom syllabus is active.
  * Clicking "View Syllabus" must launch `viewSyllabusInApp` pointing to the database-driven `syllabusUrl` instead of using default manifest assets.

---

## 🎨 5. Theme & Contrast Alignment
* **Variables System**: All color modifiers must refer to custom HSL variables declared in `:root` and `body.light-mode`. Direct hex colors in structural classes are prohibited.
* **Default Theme**: Dark mode remains the application's default visual presentation. Color variables must support high contrast accessibility guidelines.

---

## 📂 6. Metadata and Documentation Lifecycle
* **Documentation Maintenance**: After any major architectural update, feature addition, or database schema change, the following documentation files must be updated to keep them in sync:
  * [project_summary.md](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/project_summary.md): General feature description and roadmap status.
  * [master_context.md](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/master_context.md): Firestore schemas, role definitions, and collections structures.
  * [code_map.md](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/code_map.md): Map of codebase file structure, sizes, and main entry points.
  * [security.md](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/security.md): Authentication gates, OAuth flows, whitelists, and database rules references.
  * [moon_standards.md](file:///home/moondae/Antigravity%20Projects/DoC%20Learning%20Hub/moon_standards.md): Quality control standards.
* **Verification Scripts**: Validate changes using checking and parsing utilities (like `validate_db.py` or `check_brackets.py`) before final push.

---

## 🔐 8. External Reference Drive Verification
* **PCO Reference Drive**: Before performing PCO-related tasks, verify that the reference directory `/run/media/moondae/Data/Aa_Home/PCO Matters/PCO_Antigravity` is mounted and accessible. If the drive is not mounted, stop and inform the user immediately.


---

## 🌐 7. External Configurations & Integrations Gate (Firebase, Google Cloud, GitHub)
* **Out-of-Code Sync Checks**: Whenever a code modification or schema update requires updating configurations or rules on external services (such as Firestore Security Rules, Firebase Authentication settings, Google Cloud Console setups, or GitHub repositories):
  * The agent **must** explicitly describe the exact external changes/updates required.
  * The agent **must** pause and ask the user directly if they have completed those updates.
  * The agent **must** wait for the user's confirmation before executing any subsequent tasks that depend on these external configurations.
* **Firestore Rules Update Recommendation**: Whenever the local file `firestore.rules` is modified, the agent **must** display the following notification to prompt the user to manually update their Firebase console settings:
  
  🔒 Firebase Security Rules Update Recommendation
  Yes, you should manually update the security rules in your live Firebase Console using the configurations set up in our local firestore.rules file. Since client-side code cannot programmatically change live security settings:
  
  Open the Firebase Console Firestore Security Rules Tab.
  Open the local firestore.rules file.
  Select and copy all content in the local file, paste it over the existing rules in the Firebase console web editor, and click Publish.
  
  link: https://console.firebase.google.com/u/8/project/doc-learning-hub-web/firestore/databases/-default-/security/rules
* **System Backups Execution**: The agent **must not** automatically run the backup script (`qa-tools/backup_restore.py`). The agent must first ask the user if the latest changes produced a working output. Only if the user responds with "yes" or says "proceed to backup version" should the agent execute the backup version tool.

