// Doc Learning Hub — Core JavaScript Engine
// Mindanao State University - General Santos, Department of Chemistry

// ==========================================================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCurNjFwsOTL_zjMevhGkojc_pxMDfA6MI",
  authDomain: "doc-learning-hub-web.firebaseapp.com",
  projectId: "doc-learning-hub-web",
  storageBucket: "doc-learning-hub-web.firebasestorage.app",
  messagingSenderId: "148696552118",
  appId: "1:148696552118:web:55be0502a4f3f24423cc17",
  measurementId: "G-1J5XXGBRW4"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const firestore = firebase.firestore();
const storage = firebase.storage();

// Enable Firestore Offline Persistence
firestore.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Firestore persistence failed: Multiple tabs open.");
    } else if (err.code == 'unimplemented') {
      console.warn("Firestore persistence is not supported in this browser.");
    }
  });

// Dynamically load lims.js with cache-busting to bypass stale browser caches
if (!document.querySelector('script[src*="lims.js"]')) {
  console.log("Dynamically injecting lims.js script tag with cache-buster...");
  const script = document.createElement('script');
  script.src = (window.versionPathPrefix || '') + 'lims.js?v=' + Date.now();
  document.head.appendChild(script);
}

// Dynamically load pco.js with cache-busting
if (!document.querySelector('script[src*="pco.js"]')) {
  console.log("Dynamically injecting pco.js script tag with cache-buster...");
  const script = document.createElement('script');
  script.src = (window.versionPathPrefix || '') + 'pco.js?v=' + Date.now();
  document.head.appendChild(script);
}

// Dynamically load chairperson.js with cache-busting
if (!document.querySelector('script[src*="chairperson.js"]')) {
  console.log("Dynamically injecting chairperson.js script tag with cache-buster...");
  const script = document.createElement('script');
  script.src = (window.versionPathPrefix || '') + 'chairperson.js?v=' + Date.now();
  document.head.appendChild(script);
}

// ==========================================================================
// GLOBAL STATE & CONSTANTS
// ==========================================================================
const DB_NAME = 'doc_learning_hub_music_db';
const DB_VERSION = 1;

let semesterStartDate = "2026-08-10";

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJsString(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/</g, '\\x3c')
    .replace(/>/g, '\\x3e')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function getLocalStudentScore(email, moduleId, mode, maxScore) {
  const normEmail = email.toLowerCase().trim();
  const overrideVal = localStorage.getItem(`override_score_${normEmail}_${moduleId}`);
  if (overrideVal !== null) {
    return { score: parseFloat(overrideVal), override: true };
  }
  if (mode === 'quiz') {
    const saved = localStorage.getItem(`quiz_score_${normEmail}_${moduleId}`);
    if (saved !== null) {
      return { score: parseFloat(saved), override: false };
    }
  } else if (mode === 'assignment') {
    const submitted = localStorage.getItem(`assignment_submitted_${normEmail}_${moduleId}`);
    if (submitted === 'true') {
      return { score: maxScore, override: false };
    }
  }
  return null;
}


function isQuizScheduled(module) {
  if (currentUserRole !== 'student') return true;
  const courseId = currentCourseId;
  if (!courseId) return false;
  const classData = activeStudentClassData[courseId];
  if (!classData || !classData.scheduledQuizzes) return false;
  return classData.scheduledQuizzes.includes(module.id);
}

function isAssignScheduled(module) {
  if (currentUserRole !== 'student') return true;
  const courseId = currentCourseId;
  if (!courseId) return false;
  const classData = activeStudentClassData[courseId];
  if (!classData || !classData.scheduledAssignments) return false;
  return classData.scheduledAssignments.includes(module.id);
}

function getWeekDateRange(weeksStr) {
  if (!weeksStr) return '';
  let startWeek = 1;
  let endWeek = 1;
  if (weeksStr.includes('-')) {
    const parts = weeksStr.split('-');
    startWeek = parseInt(parts[0], 10);
    endWeek = parseInt(parts[1], 10);
  } else {
    startWeek = parseInt(weeksStr, 10);
    endWeek = startWeek;
  }
  if (isNaN(startWeek) || isNaN(endWeek)) {
    return '';
  }
  const baseDate = new Date(semesterStartDate);
  const startDate = new Date(baseDate);
  startDate.setDate(baseDate.getDate() + (startWeek - 1) * 7);
  const endDate = new Date(baseDate);
  endDate.setDate(baseDate.getDate() + (endWeek - 1) * 7 + 4);
  
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const startMonth = months[startDate.getMonth()];
  const startDay = startDate.getDate();
  const startYear = startDate.getFullYear();
  const endMonth = months[endDate.getMonth()];
  const endDay = endDate.getDate();
  const endYear = endDate.getFullYear();
  
  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
    }
  } else {
    return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
  }
}

let db = null;

let manifestData = null;
let currentCourseId = null; // Active course ID
let currentMode = 'home'; // 'home', 'notes', 'assessments', 'progress'

// User Session
let currentUser = null; // { name, email, studentId, section, year, avatar }
let uploadedSyllabusUrl = "";

// Quiz Session State
let activeQuizModule = null; // active module being quizzed
let activeQuizData = null; // { questions, title, timeLimitSeconds }
let currentQuestionIndex = 0;
let quizScore = 0;
let quizAnswers = []; // Array of student answers
let quizTimerInterval = null;
let quizSecondsLeft = 0;
let questionTimerInterval = null;
let questionSecondsLeft = 0;
let wrongAnswersLog = []; // [{ question, yourAnswer, correctAnswer }]

const GLOBAL_SAMPLE_CUSTOM_QUIZ = {
  id: "sample_timed_quiz",
  title: "Timed Chemistry Diagnostic Quiz",
  timeLimitSeconds: null,
  questions: [
    {
      type: "mc",
      question: "Which of the following is an alkaline earth metal? \\ce{Ca} or \\ce{Na}?",
      choices: ["Na (Sodium)", "Ca (Calcium)", "Cl (Chlorine)", "H (Hydrogen)"],
      answer: 1,
      points: 2,
      timeLimitSeconds: 5
    },
    {
      type: "id",
      question: "State the name of the lightest element in the periodic table (Helium or Hydrogen):",
      answer: "Hydrogen",
      points: 2,
      timeLimitSeconds: 15
    },
    {
      type: "tf",
      question: "The chemical formula of water is \\ce{H2O}. (True/False)",
      answer: true,
      points: 1,
      timeLimitSeconds: 10
    }
  ]
};

const GLOBAL_SAMPLE_CUSTOM_QUIZ_2 = {
  id: "sample_timed_quiz_2",
  title: "Inorganic Chemistry Quiz 2",
  timeLimitSeconds: null,
  questions: [
    {
      id: "q_1",
      type: "mc",
      question: "Which element has the chemical symbol \"O\"?",
      choices: ["Osmium", "Oxygen", "Gold", "Helium"],
      answer: 1,
      points: 2,
      timeLimitSeconds: 5
    },
    {
      id: "q_2",
      type: "tf",
      question: "Water consists of hydrogen and oxygen. (True/False)",
      answer: true,
      points: 1,
      timeLimitSeconds: 5
    },
    {
      id: "q_3",
      type: "id",
      question: "What is the atomic symbol of Carbon?",
      answer: "C",
      points: 2,
      timeLimitSeconds: 8
    },
    {
      id: "q_4",
      type: "mc",
      question: "which is color red? (mcq)",
      choices: ["golf ball", "red roses", "red basketball", "red car"],
      answer: 0,
      points: 2,
      timeLimitSeconds: 8
    }
  ]
};

const GLOBAL_SAMPLE_CLASS = {
  id: "sample_class_49c",
  courseId: "chm151",
  courseName: "Inorganic Chemistry 1",
  section: "49C",
  year: "2026-2027",
  facultyName: "Prof. Ramon M. Eduque, Jr.",
  facultyEmail: atob("cmFtb24uZWR1cXVlQG1zdWdlbnNhbi5lZHUucGg="),
  status: "approved",
  students: [],
  announcements: [
    {
      id: "ann_sample_1",
      title: "Welcome to GenChem 1!",
      content: "This is a sample classroom seeded automatically for testing timed quizzes and progressive paths.",
      createdAt: 1782432000000
    }
  ],
  customMaterials: [
    {
      id: "material_sample_pdf",
      name: "PPT for Class Orientation (PDF)",
      url: "https://raw.githubusercontent.com/iammoondae/doclearninghub/main/PPT%20for%20Class%20Orientation.pdf",
      createdAt: 1782432000000
    }
  ],
  scheduledQuizzes: ["sample_timed_quiz", "sample_timed_quiz_2"],
  scheduledAssignments: [],
  customQuizzes: [GLOBAL_SAMPLE_CUSTOM_QUIZ, GLOBAL_SAMPLE_CUSTOM_QUIZ_2],
  syllabusUrl: ""
};

// Music Player State
let audioPlayer = new Audio();
let musicPlaylist = []; // Array of { id, name, fileBlob }
let currentTrackIndex = -1;
let isMusicPlaying = false;
let musicPlayMode = 'loop'; // 'loop' (loop sequential), 'shuffle' (random shuffle)
let shufflePlayOrder = []; // Shuffled array indices
let musicVolume = 0.5;

let safetyActiveSubTab = 'conduct';
let githubLectureNotes = null;

let REMOTE_SHEETS_SCRIPT_URL = localStorage.getItem('google_sheets_script_url') || '';
let REMOTE_MANIFEST_URL = localStorage.getItem('remote_manifest_url') || 'https://raw.githubusercontent.com/iammoondae/doclearninghub/main/data/manifest.json';

// Admin panel secret tap gesture counter
let brandTitleTaps = 0;
function handleBrandTitleClick() {
  brandTitleTaps++;
  if (brandTitleTaps >= 5) {
    brandTitleTaps = 0;
    const adminPortal = document.getElementById('settings-admin-portal');
    if (adminPortal) {
      const isHidden = adminPortal.style.display === 'none';
      adminPortal.style.display = isHidden ? 'block' : 'none';
      alert(isHidden ? "🔓 LMS Admin Portal Unlocked!" : "🔒 LMS Admin Portal Locked!");
      
      // Populate fields with current configured endpoints
      const sheetsInput = document.getElementById('admin-sheets-url');
      const manifestInput = document.getElementById('admin-manifest-url');
      if (sheetsInput) sheetsInput.value = REMOTE_SHEETS_SCRIPT_URL;
      if (manifestInput) manifestInput.value = REMOTE_MANIFEST_URL;
    }
  }
}

function updateAdminSheetsURL(val) {
  REMOTE_SHEETS_SCRIPT_URL = val.trim();
  localStorage.setItem('google_sheets_script_url', REMOTE_SHEETS_SCRIPT_URL);
}

function updateAdminManifestURL(val) {
  REMOTE_MANIFEST_URL = val.trim();
  localStorage.setItem('remote_manifest_url', REMOTE_MANIFEST_URL);
}

function saveSemesterDateConfig() {
  const startInput = document.getElementById('admin-semester-start-date');
  const endInput = document.getElementById('admin-semester-end-date');
  if (!startInput || !endInput) return;
  const startVal = startInput.value;
  const endVal = endInput.value;
  if (!startVal || !endVal) {
    showCustomAlert("Please select both start and end dates.", 'warning');
    return;
  }
  
  firestore.collection('config').doc('semester').set({
    startDate: startVal,
    endDate: endVal,
    updatedBy: currentUser.email,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    semesterStartDate = startVal;
    semesterEndDate = endVal;
    logAdminActivity('semester_config', { startDate: startVal, endDate: endVal });
    showCustomAlert("Semester date configuration successfully saved!", 'success');
  })
  .catch(err => {
    console.error("Error saving semester date config:", err);
    showCustomAlert("Failed to save date config: " + err.message, 'error');
  });
}
window.saveSemesterDateConfig = saveSemesterDateConfig;
window.saveSemesterEndDate = saveSemesterDateConfig;

function goToFacultyGroups(classId) {
  facultySelectedClassId = classId;
  setMode('faculty-groups');
}
window.goToFacultyGroups = goToFacultyGroups;

function dismissGroupingNotice(classId) {
  firestore.collection('classes').doc(classId).update({
    dismissedGroupingNotice: true
  })
  .then(() => {
    const noticeEl = document.getElementById('notice-grouping-' + classId);
    if (noticeEl) {
      noticeEl.style.opacity = '0';
      noticeEl.style.transform = 'translateY(-10px)';
      noticeEl.style.transition = 'all 0.3s ease';
      setTimeout(() => noticeEl.remove(), 300);
    }
  })
  .catch(err => {
    console.error("Error dismissing grouping notice:", err);
    alert("Failed to dismiss notice: " + err.message);
  });
}
window.dismissGroupingNotice = dismissGroupingNotice;

function populateSubjectDropdowns() {
  if (!manifestData || !manifestData.courses) return;

  const onboardingSelect = document.getElementById('onboarding-subject-select');
  const settingsSelect = document.getElementById('settings-subject-select');

  const optionsHTML = manifestData.courses.map(c => {
    const courseCode = (c.syllabusDetails && c.syllabusDetails.courseNumber) ? c.syllabusDetails.courseNumber : c.id.toUpperCase();
    return `<option value="${c.id}">${courseCode} - ${c.name}</option>`;
  }).join('');

  if (onboardingSelect) {
    onboardingSelect.innerHTML = optionsHTML;
    syncSectionDropdown('onboarding-subject-select', 'onboarding-section-select');
  }
  if (settingsSelect) {
    settingsSelect.innerHTML = optionsHTML;
    syncSectionDropdown('settings-subject-select', 'settings-section-select');
  }
}

function syncSectionDropdown(subjectSelectId, sectionSelectId) {
  const subjectSelect = document.getElementById(subjectSelectId);
  const sectionSelect = document.getElementById(sectionSelectId);
  if (!subjectSelect || !sectionSelect || !manifestData || !manifestData.courses) return;

  const courseId = subjectSelect.value;
  const course = manifestData.courses.find(c => c.id === courseId);
  if (!course) return;

  const sections = (course.sections && course.sections.length > 0) ? course.sections : ['a', 'b', 'c', 'd'];

  sectionSelect.innerHTML = sections.map(sec => `
    <option value="${sec}">Sec ${sec.toUpperCase()}</option>
  `).join('');
}

// ==========================================================================
// INITIALIZATION & ONBOARDING
// ==========================================================================
function initializeApp() {
  // 1. Initialize IndexedDB for Background Music
  initMusicDB(() => {
    loadPlaylistFromDB(() => {
      setupMusicPlayerListeners();
    });
  });

  // 2. Load settings and preferences
  loadPreferences();

  // 3. Load user session
  loadUserSession();

  // 4. Fetch Course Manifest
  loadManifest();

  // 5. Setup dynamic subject dropdown event listeners
  const onboardingSub = document.getElementById('onboarding-subject-select');
  if (onboardingSub) {
    onboardingSub.addEventListener('change', () => {
      syncSectionDropdown('onboarding-subject-select', 'onboarding-section-select');
    });
  }
  const settingsSub = document.getElementById('settings-subject-select');
  if (settingsSub) {
    settingsSub.addEventListener('change', () => {
      syncSectionDropdown('settings-subject-select', 'settings-section-select');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

function loadPreferences() {
  // Theme
  const isLight = localStorage.getItem('theme_light_mode') === 'true';
  if (isLight) {
    document.body.classList.add('light-mode');
  }



  // Music settings
  musicPlayMode = localStorage.getItem('music_play_mode') || 'loop';
  musicVolume = parseFloat(localStorage.getItem('music_volume') || '0.5');
  audioPlayer.volume = musicVolume;
  
  const volSlider = document.getElementById('music-volume');
  if (volSlider) volSlider.value = musicVolume;

  const modeBtn = document.getElementById('music-mode-btn');
  if (modeBtn) {
    modeBtn.innerText = musicPlayMode === 'shuffle' ? '🔀 Random' : '🔁 Loop';
    if (musicPlayMode === 'shuffle') modeBtn.classList.add('active');
  }
}

function determineUserRole(email) {
  if (!email) return 'student';
  const lowerEmail = email.toLowerCase().trim();
  const encoded = btoa(lowerEmail);
  // Admin: ramon.eduque@msugensan.edu.ph (Department Chairperson & System Admin)
  if (encoded === 'cmFtb24uZWR1cXVlQG1zdWdlbnNhbi5lZHUucGg=') {
    return 'admin';
  }
  return 'student';
}

let activeStudentClassData = {};

function loadStudentClassData() {
  if (!currentUser || currentUserRole !== 'student') {
    activeStudentClassData = {};
    return Promise.resolve();
  }
  
  console.log("Loading classroom schedules for student email:", currentUser.email);
  return firestore.collection('classes')
    .where('students', 'array-contains', currentUser.email)
    .get()
    .then(querySnapshot => {
      activeStudentClassData = {};
      querySnapshot.forEach(doc => {
        const classData = doc.data();
        activeStudentClassData[classData.courseId] = classData;
      });
      console.log("Loaded student classroom schedules:", activeStudentClassData);
    })
    .catch(err => {
      console.error("Error loading student class data:", err);
    });
}

function sanitizeUserRoles(user) {
  if (!user) return;
  if (user.role === 'teacher') {
    user.role = 'faculty';
  }
  if (user.roles) {
    user.roles = user.roles.map(r => r === 'teacher' ? 'faculty' : r);
  } else {
    user.roles = [user.role || 'student'];
  }

  const email = (user.email || '').toLowerCase().trim();

  // Cleanup legacy 'pco' role for non-admin accounts
  const isAdmin = user.role === 'admin' || user.roles.includes('admin');
  if (!isAdmin && user.roles.includes('pco')) {
    const hasSpecificPcoRole = user.roles.some(r => ['pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'].includes(r));
    if (hasSpecificPcoRole) {
      user.roles = user.roles.filter(r => r !== 'pco');
      if (user.role === 'pco') {
        const firstSpecific = user.roles.find(r => ['pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'].includes(r));
        user.role = firstSpecific || 'student';
      }
    } else {
      user.roles = user.roles.map(r => r === 'pco' ? 'pco_head' : r);
      if (user.role === 'pco') {
        user.role = 'pco_head';
      }
    }
  }

  // Administrators get access to all roles for rapid quality checking
  if (user.role === 'admin' || user.roles.includes('admin')) {
    user.roles = ['admin', 'faculty', 'laboratory', 'pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary', 'student', 'chairperson'];
  }

  user.roles = [...new Set(user.roles)].filter(Boolean);
}

// Background database migration helper
function migrateLegacyRoles() {
  if (typeof firestore === 'undefined' || !firestore) return;
  console.log("Admin session: checking database for legacy 'teacher' and 'pco' roles...");
  firestore.collection('students').get().then(snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data();
      let needsUpdate = false;
      let updatedRole = data.role;
      let updatedRoles = data.roles || [data.role || 'student'];
      
      if (data.role === 'teacher') {
        updatedRole = 'faculty';
        needsUpdate = true;
      }
      if (updatedRoles.includes('teacher')) {
        updatedRoles = updatedRoles.map(r => r === 'teacher' ? 'faculty' : r);
        needsUpdate = true;
      }

      // Migrate legacy 'pco' role to 'pco_head' for non-admin accounts
      const isAdmin = data.role === 'admin' || updatedRoles.includes('admin');
      if (!isAdmin && updatedRoles.includes('pco')) {
        const hasSpecificPcoRole = updatedRoles.some(r => ['pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'].includes(r));
        if (hasSpecificPcoRole) {
          updatedRoles = updatedRoles.filter(r => r !== 'pco');
          if (updatedRole === 'pco') {
            const firstSpecific = updatedRoles.find(r => ['pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'].includes(r));
            updatedRole = firstSpecific || 'student';
          }
        } else {
          updatedRoles = updatedRoles.map(r => r === 'pco' ? 'pco_head' : r);
          if (updatedRole === 'pco') {
            updatedRole = 'pco_head';
          }
        }
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        const updateData = { 
          role: updatedRole,
          roles: [...new Set(updatedRoles)].filter(Boolean)
        };
        firestore.collection('students').doc(doc.id).update(updateData)
          .then(() => console.log(`Successfully migrated legacy roles for ${doc.id}`))
          .catch(err => console.error(`Failed migration for ${doc.id}:`, err));
      }
    });
  }).catch(err => console.error("Error migrating legacy roles:", err));
}

function loadUserSession() {
  const savedUser = localStorage.getItem('student_user_session');
  const onboardingOverlay = document.getElementById('onboarding-overlay');

  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    sanitizeUserRoles(currentUser);
    currentUserRole = currentUser.role || determineUserRole(currentUser.email);
    if (!currentUser.roles) {
      currentUser.roles = [currentUserRole];
    }
    updateProfileUI();
    
    // Hide onboarding overlay by default
    if (onboardingOverlay) {
      onboardingOverlay.style.display = 'none';
      onboardingOverlay.classList.remove('show');
    }

    if (currentUserRole === 'admin') {
      // Admin skips landing page and goes straight to Admin Console
      setMode('admin-dashboard');
    } else {
      // All other accounts go to Portal Home first
      setMode('welcome');
    }
  } else {
    // Unregistered or not logged in: go to Portal Home first
    currentUser = null;
    currentUserRole = 'unassigned';
    updateProfileUI();
    if (onboardingOverlay) {
      onboardingOverlay.style.display = 'none';
      onboardingOverlay.classList.remove('show');
    }
    setMode('welcome');
  }
}

function showOnboardingStage(stageNum) {
  document.getElementById('onboarding-stage-1').style.display = stageNum === 1 ? 'block' : 'none';
  document.getElementById('onboarding-stage-2').style.display = stageNum === 2 ? 'block' : 'none';
  if (stageNum === 2) {
    renderOnboardingSelectedClasses();
  }
}

// Session Unload Handler to save logged hours
window.addEventListener('beforeunload', () => {
  if (currentUser && currentUser.email && window.sessionStartTime) {
    const elapsedHours = (Date.now() - window.sessionStartTime) / 3600000;
    if (elapsedHours > 0.001) {
      firestore.collection("students").doc(currentUser.email).update({
        totalLoggedHours: firebase.firestore.FieldValue.increment(elapsedHours)
      }).catch(() => {});
    }
  }
});

// Firebase Auth State Listener
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log("Firebase user logged in:", user.email);
    
    // Enforce email domain
    if (!user.email.endsWith('@msugensan.edu.ph')) {
      showCustomAlert("Access Denied: Only @msugensan.edu.ph accounts are allowed.", "error", () => {
        auth.signOut();
      });
      return;
    }
    
    // Start session timer
    window.sessionStartTime = Date.now();
    
    // Load student profile from Firestore
    loadOrCreateUserProfile(user);
  } else {
    console.log("Firebase user logged out.");
    if (currentUser && currentUser.email && window.sessionStartTime) {
      const elapsedHours = (Date.now() - window.sessionStartTime) / 3600000;
      if (elapsedHours > 0.001) {
        firestore.collection("students").doc(currentUser.email).update({
          totalLoggedHours: firebase.firestore.FieldValue.increment(elapsedHours)
        }).catch(() => {});
      }
    }
    stopSessionTracker();
    currentUser = null;
    localStorage.removeItem('student_user_session');
    
    // Reset UI profile info
    document.getElementById('user-display-name').innerText = "Guest Student";
    document.getElementById('user-display-email').innerText = "Not Signed In";
    const profilePic = document.getElementById('user-profile-pic');
    if (profilePic) profilePic.src = 'chemistry_logo.png';
    
    // Ensure onboarding overlay is hidden by default to show landing page
    const onboardingOverlay = document.getElementById('onboarding-overlay');
    if (onboardingOverlay) {
      onboardingOverlay.style.display = 'none';
      onboardingOverlay.classList.remove('show');
    }
    setMode('welcome');
  }
});

function handleCredentialResponse(response) {
  const credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
  auth.signInWithCredential(credential)
    .catch((error) => {
      console.error("Firebase Sign-in Error:", error);
      alert("Authentication failed: " + error.message);
    });
}

function loadOrCreateUserProfile(firebaseUser) {
  const email = firebaseUser.email;
  
  // Try loading from Firestore first
  firestore.collection("students").doc(email).get()
    .then((doc) => {
      const isPcoRoleName = (r) => ['pco', 'pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'].includes(r);
      
      if (doc.exists) {
        // Profile exists in Firestore!
        currentUser = doc.data();
        sanitizeUserRoles(currentUser);
        currentUserRole = currentUser.role || determineUserRole(currentUser.email);
        
        if (isPcoRoleName(currentUserRole)) {
          currentUserRole = 'pco';
        }
        
        if (!currentUser.roles) {
          currentUser.roles = [currentUser.role || currentUserRole];
        }
        if (currentUserRole === 'admin') {
          migrateLegacyRoles();
        }

        // Update login metadata
        firestore.collection("students").doc(email).update({
          lastLoginDate: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
        
        // Save locally for quick access
        localStorage.setItem('student_user_session', JSON.stringify(currentUser));
        localStorage.setItem('doc_lms_saved_profile', JSON.stringify(currentUser));
        
        // Sync UI
        updateProfileUI();
        
        // Hide onboarding overlay
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) {
          overlay.classList.remove('show');
          setTimeout(() => overlay.style.display = 'none', 300);
        }

        if (currentUserRole === 'admin') {
          setMode('admin-dashboard');
        } else {
          setMode('welcome');
          if (window.pendingWorkspaceRedirect) {
            const redirect = window.pendingWorkspaceRedirect;
            window.pendingWorkspaceRedirect = null;
            handleWelcomeModuleClick(redirect);
          }
        }
      } else {
        // Profile doesn't exist in Firestore yet!
        // Check if there is a local cached profile as fallback
        const savedProfileStr = localStorage.getItem('doc_lms_saved_profile');
        let localProfile = null;
        if (savedProfileStr) {
          try {
            const parsed = JSON.parse(savedProfileStr);
            if (parsed && parsed.email === email) {
              localProfile = parsed;
            }
          } catch(e) {}
        }
        
        if (localProfile) {
          currentUser = localProfile;
          sanitizeUserRoles(currentUser);
          currentUserRole = currentUser.role || determineUserRole(currentUser.email);
          
          if (isPcoRoleName(currentUserRole)) {
            currentUserRole = 'pco';
          }
          if (!currentUser.roles) {
            currentUser.roles = [currentUser.role || currentUserRole];
          }
          
          saveStudentSession();
          updateProfileUI();
          const overlay = document.getElementById('onboarding-overlay');
          if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => overlay.style.display = 'none', 300);
          }

          if (currentUserRole === 'admin') {
            setMode('admin-dashboard');
          } else {
            setMode('welcome');
            if (window.pendingWorkspaceRedirect) {
              const redirect = window.pendingWorkspaceRedirect;
              window.pendingWorkspaceRedirect = null;
              handleWelcomeModuleClick(redirect);
            }
          }
        } else {
          // Determine role before deciding on onboarding
          currentUserRole = determineUserRole(email);
          const isFreshPco = isPcoRoleName(currentUserRole);
          
          if (currentUserRole === 'admin' || currentUserRole === 'faculty' || currentUserRole === 'laboratory' || isFreshPco) {
            currentUser = {
              name: firebaseUser.displayName || email.split('@')[0],
              email: email,
              studentId: '',
              subjects: [],
              year: '',
              role: currentUserRole,
              roles: [currentUserRole],
              avatar: firebaseUser.photoURL || 'chemistry_logo.png'
            };
            if (isFreshPco) {
              currentUserRole = 'pco';
            }
          } else if (currentUserRole === 'unassigned') {
            currentUser = {
              name: firebaseUser.displayName || email.split('@')[0],
              email: email,
              studentId: '',
              subjects: [],
              year: '',
              role: 'unassigned',
              roles: ['unassigned'],
              avatar: firebaseUser.photoURL || 'chemistry_logo.png'
            };
          } else {
            // Student
            currentUser = {
              name: firebaseUser.displayName || '',
              email: email,
              studentId: '',
              subjects: [],
              year: '1',
              role: 'student',
              roles: ['student'],
              avatar: firebaseUser.photoURL || 'chemistry_logo.png'
            };
          }

          saveStudentSession();
          updateProfileUI();
          
          const overlay = document.getElementById('onboarding-overlay');
          if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => overlay.style.display = 'none', 300);
          }

          if (currentUserRole === 'admin') {
            setMode('admin-dashboard');
          } else {
            setMode('welcome');
            if (window.pendingWorkspaceRedirect) {
              const redirect = window.pendingWorkspaceRedirect;
              window.pendingWorkspaceRedirect = null;
              handleWelcomeModuleClick(redirect);
            }
          }
        }
      }
    })
    .catch((err) => {
      console.error("Error loading user profile from Firestore:", err);
      // Fallback to local storage if offline/network error
      const savedProfileStr = localStorage.getItem('doc_lms_saved_profile');
      if (savedProfileStr) {
        try {
          const parsed = JSON.parse(savedProfileStr);
          if (parsed && parsed.email === email) {
            currentUser = parsed;
            currentUserRole = currentUser.role || determineUserRole(currentUser.email);
            updateProfileUI();
            
            if (currentUserRole === 'student' && (!currentUser.name || !currentUser.studentId || !currentUser.subjects || currentUser.subjects.length === 0)) {
              showOnboardingStage(2);
            } else {
              const overlay = document.getElementById('onboarding-overlay');
              if (overlay) {
                overlay.classList.remove('show');
                setTimeout(() => overlay.style.display = 'none', 300);
              }
              buildUIFromManifest();
              setMode('home');
            }
            return;
          }
        } catch(e) {}
      }
      alert("Error logging in: Could not load user profile.");
    });
}

window.handleCredentialResponse = handleCredentialResponse;

function addClassOnboarding() {
  if (!currentUser) return;
  const subSelect = document.getElementById('onboarding-subject-select');
  const secSelect = document.getElementById('onboarding-section-select');
  if (!subSelect || !secSelect) return;
  const subVal = subSelect.value;
  const secVal = secSelect.value;
  const combined = `${subVal}_${secVal}`;
  
  if (!currentUser.subjects) currentUser.subjects = [];
  if (currentUser.subjects.includes(combined)) {
    alert("This subject and section combination is already added.");
    return;
  }
  
  currentUser.subjects.push(combined);
  renderOnboardingSelectedClasses();
}

function removeClassOnboarding(combined) {
  if (!currentUser || !currentUser.subjects) return;
  currentUser.subjects = currentUser.subjects.filter(s => s !== combined);
  renderOnboardingSelectedClasses();
}

function renderOnboardingSelectedClasses() {
  const container = document.getElementById('onboarding-selected-classes');
  if (!container || !currentUser || !currentUser.subjects) return;
  
  if (currentUser.subjects.length === 0) {
    container.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">No classes added yet.</span>';
    return;
  }
  
  let html = '';
  currentUser.subjects.forEach(subKey => {
    const parts = subKey.split('_');
    const courseId = parts[0];
    const section = parts[1].toUpperCase();
    
    let courseName = courseId;
    const selectOpt = document.querySelector(`#onboarding-subject-select option[value="${courseId}"]`);
    if (selectOpt) {
      courseName = selectOpt.text;
    }
    
    html += `
      <div class="class-chip">
        <span>🧪 ${courseName} - Sec ${section}</span>
        <button type="button" class="class-chip-remove" onclick="removeClassOnboarding('${subKey}')">&times;</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function saveStudentSession() {
  if (currentUser) {
    if (!currentUser.role) {
      currentUser.role = currentUserRole;
    }
    localStorage.setItem('student_user_session', JSON.stringify(currentUser));
    localStorage.setItem('doc_lms_saved_profile', JSON.stringify(currentUser));
    
    // Sync profile to Firestore if signed in
    if (auth.currentUser && currentUser.email === auth.currentUser.email) {
      firestore.collection("students").doc(currentUser.email).set(currentUser)
        .then(() => {
          console.log("Profile synced to Firestore successfully.");
        })
        .catch((err) => {
          console.error("Failed to sync profile to Firestore:", err);
        });
    }
  }
}

function submitOnboardingProfile() {
  const nicknameInput = document.getElementById('onboarding-nickname').value.trim();
  const studentIdInput = document.getElementById('onboarding-studentid').value.trim();
  const yearSelect = document.getElementById('onboarding-year').value;

  if (!nicknameInput || !studentIdInput || !currentUser.subjects || currentUser.subjects.length === 0) {
    alert("Please fill in display name, student ID, and choose at least one subject/section.");
    return;
  }

  currentUser.name = nicknameInput;
  currentUser.studentId = studentIdInput;
  currentUser.year = yearSelect;

  // Save Session
  saveStudentSession();
  updateProfileUI();
  playSFX(true);
  
  if (typeof matchUnlinkedAccountabilities === 'function') {
    matchUnlinkedAccountabilities(currentUser.email, currentUser.name);
  }

  // Close onboarding overlay
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.classList.remove('show');
    setTimeout(() => overlay.style.display = 'none', 300);
  }
  
  // Re-build sidebar courses
  buildUIFromManifest();

  // Navigate to Dashboard
  setMode('home');
}

function updateProfileUI() {
  if (!currentUser) {
    document.getElementById('user-display-name').innerText = "Guest Portal";
    document.getElementById('user-display-email').innerText = "Please connect account";
    
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.style.display = 'none';
    const switcher = document.getElementById('role-switcher-container');
    if (switcher) switcher.innerHTML = '';
    
    const themeBtn = document.getElementById('theme-btn');
    if (themeBtn) themeBtn.style.display = '';
    
    const signOutBtn = document.getElementById('header-signout-btn');
    if (signOutBtn) {
      signOutBtn.innerHTML = `🔑 <span>Sign In</span>`;
      signOutBtn.style.background = 'var(--accent)';
      signOutBtn.style.color = 'white';
      signOutBtn.style.borderColor = 'var(--accent)';
      signOutBtn.onclick = () => {
        const onboardingOverlay = document.getElementById('onboarding-overlay');
        if (onboardingOverlay) {
          onboardingOverlay.style.display = 'flex';
          setTimeout(() => onboardingOverlay.classList.add('show'), 50);
          showOnboardingStage(1);
        }
      };
    }
    
    document.getElementById('header-icon').innerText = '🏛️';
    document.getElementById('header-title').innerText = 'Chemistry Portal';
    document.getElementById('header-subtitle').innerText = 'Please sign in to access';
    document.body.classList.remove('pco-active-role');
    return;
  }

  // Restore signout button style
  const signOutBtn = document.getElementById('header-signout-btn');
  if (signOutBtn) {
    if (currentUserRole === 'unassigned') {
      signOutBtn.innerHTML = `🔑 <span>Sign In</span>`;
      signOutBtn.style.background = 'var(--accent)';
      signOutBtn.style.color = 'white';
      signOutBtn.style.borderColor = 'var(--accent)';
      signOutBtn.onclick = () => {
        const onboardingOverlay = document.getElementById('onboarding-overlay');
        if (onboardingOverlay) {
          onboardingOverlay.style.display = 'flex';
          setTimeout(() => onboardingOverlay.classList.add('show'), 50);
          showOnboardingStage(1);
        }
      };
    } else {
      signOutBtn.innerHTML = `🚪 <span>Sign Out</span>`;
      signOutBtn.style.background = '';
      signOutBtn.style.color = '';
      signOutBtn.style.borderColor = '';
      signOutBtn.onclick = signOutStudent;
    }
  }
  
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.style.display = (currentUserRole === 'unassigned') ? 'none' : 'inline-flex';
  }

  // Header display name & email
  document.getElementById('user-display-name').innerText = (currentUserRole === 'unassigned') ? 'Guest Student' : currentUser.name;
  document.getElementById('user-display-email').innerText = (currentUserRole === 'unassigned') ? 'Not Signed In' : currentUser.email;

  // Profile pic in header
  const profilePic = document.getElementById('user-profile-pic');
  if (profilePic) {
    profilePic.src = currentUser.avatar || 'chemistry_logo.png';
  }

  // Update Settings Form fields if they exist in the DOM (depending on active drawer content)
  const settingsName = document.getElementById('settings-nickname');
  if (settingsName) settingsName.value = currentUser.name;

  const settingsId = document.getElementById('settings-studentid');
  if (settingsId) settingsId.value = currentUser.studentId || '';

  const settingsYear = document.getElementById('settings-year');
  if (settingsYear) settingsYear.value = currentUser.year || '1';

  const settingsPic = document.getElementById('settings-profile-pic');
  if (settingsPic) {
    settingsPic.src = currentUser.avatar || 'chemistry_logo.png';
  }

  // Faculty specific settings updates
  const facultyContact = document.getElementById('settings-faculty-contact');
  if (facultyContact) facultyContact.value = currentUser.contactNumber || '';

  const facultyOffice = document.getElementById('settings-faculty-office');
  if (facultyOffice) facultyOffice.value = currentUser.officeAddress || '';

  const facultyMessenger = document.getElementById('settings-faculty-messenger');
  if (facultyMessenger) facultyMessenger.value = currentUser.messengerLink || '';

  const facultyMessengerGc = document.getElementById('settings-faculty-messenger-gc');
  if (facultyMessengerGc) facultyMessengerGc.value = currentUser.messengerGc || '';

  const facultyTelegramGc = document.getElementById('settings-faculty-telegram-gc');
  if (facultyTelegramGc) facultyTelegramGc.value = currentUser.telegramGc || '';

  const facultyConsultation = document.getElementById('settings-faculty-consultation');
  if (facultyConsultation) facultyConsultation.value = currentUser.consultationHours || '';

  // Render settings chips
  renderSettingsSelectedClasses();
  
  // Toggle active role branding header updates
  if (currentUserRole === 'admin') {
    document.getElementById('header-icon').innerText = '🛠️';
    document.getElementById('header-title').innerText = 'Admin Console';
    document.getElementById('header-subtitle').innerText = 'System administration & approvals';
    document.body.classList.remove('pco-active-role');
  } else if (currentUserRole === 'pco') {
    document.getElementById('header-icon').innerText = '🌿';
    document.getElementById('header-title').innerText = 'PCO/EIS';
    document.getElementById('header-subtitle').innerText = 'EMIS monitoring & SMR compiler';
    document.body.classList.add('pco-active-role');
  } else if (currentUserRole === 'laboratory') {
    document.getElementById('header-icon').innerText = '🧪';
    document.getElementById('header-title').innerText = 'Chemistry Stockroom';
    document.getElementById('header-subtitle').innerText = 'LIMS Inventory & Requisitions';
    document.body.classList.remove('pco-active-role');
  } else if (currentUserRole === 'faculty') {
    document.getElementById('header-icon').innerText = '👨‍🏫';
    document.getElementById('header-title').innerText = 'Faculty Portal';
    document.getElementById('header-subtitle').innerText = 'Classroom management & gradebooks';
    document.body.classList.remove('pco-active-role');
  } else if (currentUserRole === 'unassigned') {
    document.getElementById('header-icon').innerText = '🏛️';
    document.getElementById('header-title').innerText = 'Chemistry Portal';
    document.getElementById('header-subtitle').innerText = 'Please sign in to access';
    document.body.classList.remove('pco-active-role');
  } else {
    document.getElementById('header-icon').innerText = '🧪';
    document.getElementById('header-title').innerText = 'Department of Chemistry';
    document.getElementById('header-subtitle').innerText = 'Student Portal';
    document.body.classList.remove('pco-active-role');
  }
  // Render alternate role switcher buttons
  renderRoleSwitcher();
  
  // Sync system phase and access shield
  if (typeof syncSystemPhase === 'function') {
    syncSystemPhase();
  }
  // Keep theme switcher button visible
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) {
    themeBtn.style.display = '';
  }
  
  // Start tracking user session activity
  startSessionTracker();
  
  // Render dynamic sidebar navigation tabs
  renderSidebarNavigation();
}

// User Session Activity & Heartbeat Tracking
let sessionTrackerEmail = null;
let activeSessionTrackerInterval = null;
let lastHeartbeatTimestamp = Date.now();

function startSessionTracker() {
  if (!currentUser || !currentUser.email) return;
  
  // If already tracking this email, don't restart interval
  if (sessionTrackerEmail === currentUser.email) return;
  sessionTrackerEmail = currentUser.email;

  // Clear existing tracker if any
  if (activeSessionTrackerInterval) {
    clearInterval(activeSessionTrackerInterval);
  }

  // Update last active initially
  const initialNow = Date.now();
  currentUser.lastActive = initialNow;
  firestore.collection('students').doc(currentUser.email).update({
    lastActive: firebase.firestore.Timestamp.fromMillis(initialNow)
  }).catch(err => {});

  lastHeartbeatTimestamp = Date.now();
  activeSessionTrackerInterval = setInterval(() => {
    if (!currentUser || !currentUser.email) return;
    const now = Date.now();
    const elapsedMs = now - lastHeartbeatTimestamp;
    lastHeartbeatTimestamp = now;

    // Convert elapsed ms to hours
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    // Update locally
    currentUser.totalHoursLogged = (currentUser.totalHoursLogged || 0) + elapsedHours;
    currentUser.lastActive = now;

    localStorage.setItem('student_user_session', JSON.stringify(currentUser));
    localStorage.setItem('doc_lms_saved_profile', JSON.stringify(currentUser));

    // Update Firestore
    firestore.collection('students').doc(currentUser.email).update({
      totalHoursLogged: firebase.firestore.FieldValue.increment(elapsedHours),
      lastActive: firebase.firestore.Timestamp.fromMillis(now)
    }).catch(err => {
      console.error("Heartbeat sync error:", err);
    });
  }, 60000); // 1 minute
}

function stopSessionTracker() {
  if (activeSessionTrackerInterval) {
    clearInterval(activeSessionTrackerInterval);
    activeSessionTrackerInterval = null;
  }
  sessionTrackerEmail = null;
}

window.startSessionTracker = startSessionTracker;
window.stopSessionTracker = stopSessionTracker;

function renderRoleSwitcher() {
  const container = document.getElementById('role-switcher-container');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = '';
    return;
  }

  let roles = currentUser.roles || [];
  const primaryRole = currentUser.role || determineUserRole(currentUser.email);
  if (primaryRole && !roles.includes(primaryRole)) {
    roles = [primaryRole, ...roles];
  }
  roles = [...new Set(roles)].filter(Boolean);

  if (roles.includes('admin')) {
    container.innerHTML = `
      <button onclick="switchActiveRole('unassigned')" 
              class="role-switch-btn student ${currentUserRole === 'unassigned' ? 'active' : ''}" 
              title="Simulate Guest/Unregistered Onboarding"
              style="border-color: #6b7280; color: #9ca3af; background: transparent;">
        👤 Unregistered
      </button>
      <button onclick="switchActiveRole('student')" 
              class="role-switch-btn student ${currentUserRole === 'student' ? 'active' : ''}" 
              title="Switch profile to Student Portal">
        🎓 Student
      </button>
      <button onclick="switchActiveRole('faculty')" 
              class="role-switch-btn faculty ${currentUserRole === 'faculty' ? 'active' : ''}" 
              title="Switch profile to Faculty Portal">
        👨‍🏫 Faculty
      </button>
      <button onclick="switchActiveRole('chairperson')" 
              class="role-switch-btn chairperson ${currentUserRole === 'chairperson' ? 'active' : ''}" 
              title="Switch profile to Chairperson Executive">
        🏛️ Chairperson
      </button>
      <button onclick="switchActiveRole('laboratory')" 
              class="role-switch-btn laboratory ${currentUserRole === 'laboratory' ? 'active' : ''}" 
              title="Switch profile to Chemistry Stockroom">
        🧪 Chemistry Stockroom
      </button>
      <div class="role-switch-dropdown-container" style="position: relative; display: inline-block;">
        <button onclick="togglePcoSubroleDropdown(event)" 
                class="role-switch-btn pco ${currentUserRole === 'pco' ? 'active' : ''}" 
                title="Switch profile to PCO/EIS & Choose Category"
                style="display: flex; align-items: center; gap: 4px;">
          🌿 PCO/EIS ▾
        </button>
        <div id="pco-subrole-dropdown-menu" style="display: none; position: absolute; top: 100%; left: 0; background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.6); z-index: 9999; min-width: 250px; margin-top: 6px; padding: 6px 0;">
          <div style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; padding: 6px 12px; letter-spacing: 0.5px;">Choose PCO View Mode:</div>
          <a href="#" onclick="switchActivePcoSubrole('pco_head', event)" style="display: flex; align-items: center; padding: 8px 12px; color: var(--text-main); text-decoration: none; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">👑 PCO Head (Master View)</a>
          <a href="#" onclick="switchActivePcoSubrole('pco_college', event)" style="display: flex; align-items: center; padding: 8px 12px; color: var(--text-main); text-decoration: none; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">🏛️ PCO College (CNSM Dean)</a>
          <a href="#" onclick="switchActivePcoSubrole('pco_office', event)" style="display: flex; align-items: center; padding: 8px 12px; color: var(--text-main); text-decoration: none; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">🏢 PCO Office (OVCREI Director)</a>
          <a href="#" onclick="switchActivePcoSubrole('pco_laboratory', event)" style="display: flex; align-items: center; padding: 8px 12px; color: var(--text-main); text-decoration: none; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">🧪 PCO Laboratory (Chem Custodian)</a>
          <a href="#" onclick="switchActivePcoSubrole('pco_ppd', event)" style="display: flex; align-items: center; padding: 8px 12px; color: var(--text-main); text-decoration: none; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">⚡ PCO PPD (Power Plant Tech)</a>
          <a href="#" onclick="switchActivePcoSubrole('pco_gso', event)" style="display: flex; align-items: center; padding: 8px 12px; color: var(--text-main); text-decoration: none; font-size: 12px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">🧹 PCO GSO (Solid Waste Clerk)</a>
          <a href="#" onclick="switchActivePcoSubrole('pco_sanitary', event)" style="display: flex; align-items: center; padding: 8px 12px; color: var(--text-main); text-decoration: none; font-size: 12px; font-weight: 600; transition: background 0.2s;">💧 PCO Sanitary (Water Safety Inspector)</a>
        </div>
      </div>
      <button onclick="switchActiveRole('admin')" 
              class="role-switch-btn admin ${currentUserRole === 'admin' ? 'active' : ''}" 
              title="Switch profile to Admin Console">
        🛡️ Admin Console
      </button>
    `;
  } else if (roles.includes('chairperson') && roles.includes('faculty')) {
    container.innerHTML = `
      <button onclick="switchActiveRole('faculty')" 
              class="role-switch-btn faculty ${currentUserRole === 'faculty' ? 'active' : ''}" 
              title="Switch profile to Faculty Portal">
        👨‍🏫 Faculty
      </button>
      <button onclick="switchActiveRole('chairperson')" 
              class="role-switch-btn chairperson ${currentUserRole === 'chairperson' ? 'active' : ''}" 
              title="Switch profile to Chairperson Executive">
        🏛️ Chairperson
      </button>
    `;
  } else if (roles.length >= 2) {
    let html = '';
    roles.forEach(r => {
      if (r !== currentUserRole) {
        let label = '';
        if (r === 'faculty') { label = '👨‍🏫 Faculty'; }
        else if (r === 'admin') { label = '🛡️ Admin'; }
        else if (r === 'laboratory') { label = '🧪 Laboratory'; }
        else if (r === 'student') { label = '🎓 Student'; }
        else if (r === 'pco') { label = '🌿 PCO'; }
        else if (r === 'chairperson') { label = '🏛️ Chairperson'; }

        html += `
          <button onclick="switchActiveRole('${r}')" 
                  class="role-switch-btn ${r}" 
                  title="Switch profile to ${label}">
            ${label}
          </button>
        `;
      }
    });
    container.innerHTML = html;
  } else {
    container.innerHTML = '';
  }
}

function togglePcoSubroleDropdown(event) {
  event.stopPropagation();
  const menu = document.getElementById('pco-subrole-dropdown-menu');
  if (menu) {
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
  }
}

function switchActivePcoSubrole(subrole, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const menu = document.getElementById('pco-subrole-dropdown-menu');
  if (menu) menu.style.display = 'none';

  window.simulatedPcoSubrole = subrole;
  
  if (subrole === 'pco_college') {
    window.simulatedAffiliationUnit = 'CNSM';
    window.simulatedOffice = 'College of Natural Sciences and Mathematics';
  } else if (subrole === 'pco_office') {
    window.simulatedAffiliationUnit = 'OVCREI';
    window.simulatedOffice = 'Office of the Vice Chancellor for Research, Extension & Innovation';
  } else if (subrole === 'pco_laboratory') {
    window.simulatedAffiliationUnit = 'CNSM';
    window.simulatedOffice = 'CNMS Chemistry Stockroom';
  } else if (subrole === 'pco_ppd') {
    window.simulatedAffiliationUnit = 'PPD';
    window.simulatedOffice = 'Fatima Standby Generator House';
  } else if (subrole === 'pco_gso') {
    window.simulatedAffiliationUnit = 'GSO';
    window.simulatedOffice = 'General Services Office';
  } else if (subrole === 'pco_sanitary') {
    window.simulatedAffiliationUnit = 'CNSM';
    window.simulatedOffice = 'Sanitary discharge division';
  } else {
    window.simulatedAffiliationUnit = '';
    window.simulatedOffice = '';
  }

  switchActiveRole('pco');
}

// Close dropdown on document click
document.addEventListener('click', () => {
  const menu = document.getElementById('pco-subrole-dropdown-menu');
  if (menu) menu.style.display = 'none';
});

window.togglePcoSubroleDropdown = togglePcoSubroleDropdown;
window.switchActivePcoSubrole = switchActivePcoSubrole;

function switchActiveRole(newRole) {
  if (!currentUser) return;
  
  const proceed = (approved) => {
    if (!approved) return;

    if (newRole !== 'pco') {
      window.simulatedPcoSubrole = null;
      window.simulatedAffiliationUnit = null;
      window.simulatedOffice = null;
    }

    currentUserRole = newRole;
    currentUser.role = newRole;
    localStorage.setItem('student_user_session', JSON.stringify(currentUser));
    
    // Reload the navigation sidebar and views
    updateProfileUI();
    renderSidebarNavigation();
    buildUIFromManifest();
    if (newRole === 'chairperson') {
      setMode('cp-dashboard');
    } else if (newRole === 'pco') {
      setMode('pco-dashboard');
    } else if (newRole === 'unassigned') {
      setMode('welcome');
    } else {
      setMode('home');
    }
  };

  const confirmMsg = `Switch active session to ${newRole.toUpperCase()}?`;
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(confirmMsg, proceed);
  } else {
    const res = confirm(confirmMsg);
    proceed(res);
  }
}

window.renderRoleSwitcher = renderRoleSwitcher;
window.switchActiveRole = switchActiveRole;

// ==========================================================================
// COURSE MANIFEST LOADER
// ==========================================================================
function loadManifest() {
  const localCache = localStorage.getItem('doc_lms_manifest');
  if (localCache && !window.versionPathPrefix) {
    manifestData = JSON.parse(localCache);
    buildUIFromManifest();
  }

  let url = REMOTE_MANIFEST_URL;
  if (window.versionPathPrefix) {
    url = window.versionPathPrefix + 'data/manifest.json';
  }

  // Fetch from configured URL (with cache-busting)
  fetch(`${url}?nocache=${Date.now()}`)
    .then(response => {
      if (!response.ok) throw new Error("Manifest download failed");
      return response.json();
    })
    .then(data => {
      manifestData = data;
      if (!window.versionPathPrefix) {
        localStorage.setItem('doc_lms_manifest', JSON.stringify(data));
      }
      buildUIFromManifest();
    })
    .catch(err => {
      console.error("Could not fetch latest course manifest:", err);
      // Fallback to local server path if remote fetch fails and we are not versioned
      if (!window.versionPathPrefix && url !== 'data/manifest.json') {
        console.log("Attempting fallback to local course manifest...");
        fetch(`data/manifest.json?nocache=${Date.now()}`)
          .then(res => {
            if (!res.ok) throw new Error("Local fallback manifest download failed");
            return res.json();
          })
          .then(data => {
            manifestData = data;
            localStorage.setItem('doc_lms_manifest', JSON.stringify(data));
            buildUIFromManifest();
          })
          .catch(fallbackErr => {
            console.error("Local fallback manifest failed:", fallbackErr);
            showManifestError();
          });
      } else {
        showManifestError();
      }
    });
}

function showManifestError() {
  if (!manifestData) {
    document.getElementById('courses-list').innerHTML = `
      <div class="empty-playlist-msg" style="color:var(--incorrect);">
        ⚠️ Failed to load courses. Please check connection and click Sync in Settings.
      </div>
    `;
  }
}

let currentUserRole = 'student'; // 'student', 'faculty', 'admin', 'laboratory'
let semesterEndDate = null; // Loaded from Firestore config/semester

function loadSemesterConfig() {
  if (typeof firestore === 'undefined' || !firestore) {
    return Promise.resolve();
  }
  return firestore.collection('config').doc('semester').get()
    .then(doc => {
      if (doc.exists) {
        semesterEndDate = doc.data().endDate;
        semesterStartDate = doc.data().startDate || "2026-08-10";
        console.log("Loaded semester date configs - Start:", semesterStartDate, "End:", semesterEndDate);
      }
    })
    .catch(err => {
      console.error("Error loading semester config:", err);
    });
}

function getPcoSubrole() {
  if (window.simulatedPcoSubrole && currentUserRole === 'pco') {
    return window.simulatedPcoSubrole;
  }
  if (!currentUser) return 'pco_college';
  const specificPco = (currentUser.roles || []).find(r => ['pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'].includes(r));
  if (specificPco) return specificPco;
  if (currentUser.role && currentUser.role !== 'pco') return currentUser.role;
  return 'pco_college';
}
window.getPcoSubrole = getPcoSubrole;

function getPcoAffiliationUnit() {
  if (window.simulatedAffiliationUnit && currentUserRole === 'pco') {
    return window.simulatedAffiliationUnit;
  }
  if (!currentUser) return '';
  return currentUser.affiliationUnit || '';
}
window.getPcoAffiliationUnit = getPcoAffiliationUnit;

function getPcoOffice() {
  if (window.simulatedOffice && currentUserRole === 'pco') {
    return window.simulatedOffice;
  }
  if (!currentUser) return '';
  return currentUser.office || '';
}
window.getPcoOffice = getPcoOffice;

function renderSidebarNavigation() {
  const container = document.getElementById('sidebar-dynamic-tabs');
  if (!container) return;

  let html = '';

  if (currentUserRole === 'unassigned') {
    // Guest/Unregistered Navigation
    html += `
      <div class="nav-section-title">Portal Navigation</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn active" id="tab-welcome" onclick="setMode('welcome')">🏛️ Portal Home</button>
      </div>
    `;

  } else if (currentUserRole === 'admin') {
    // Admin navigation
    html += `
      <div class="nav-section-title">Admin Core</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn" id="tab-welcome" onclick="setMode('welcome')">🏛️ Portal Home</button>
        <button class="mode-tab-btn active" id="tab-admin-dashboard" onclick="setMode('admin-dashboard')">📊 System Overview</button>
        <button class="mode-tab-btn" id="tab-notice-tasks" onclick="setMode('notice-tasks')">📬 Notice/Tasks</button>
        <button class="mode-tab-btn" id="tab-admin-requests" onclick="setMode('admin-requests')">🔔 Class Requests</button>
        <button class="mode-tab-btn" id="tab-admin-users" onclick="setMode('admin-users')">👥 User Directory</button>
        <button class="mode-tab-btn" id="tab-admin-applications" onclick="setMode('admin-applications')">📋 Role Applications</button>
        <button class="mode-tab-btn" id="tab-admin-feedback" onclick="setMode('admin-feedback')">🐛 Feedback & Bugs</button>
      </div>
      <div class="nav-section-title">Maintenance</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn" id="tab-admin-roadmap" onclick="setMode('admin-roadmap')">🗺️ Portal Roadmap</button>
        <button class="mode-tab-btn" id="tab-admin-backups" onclick="setMode('admin-backups')">💾 Backups & Restore</button>
        <button class="mode-tab-btn" id="tab-admin-logs" onclick="setMode('admin-logs')">📜 System Activity Logs</button>
      </div>
    `;
  } else if (currentUserRole === 'pco') {
    const subrole = getPcoSubrole();
    
    html += `
      <div class="nav-section-title">PCO / EMIS Tools</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn" id="tab-welcome" onclick="setMode('welcome')">🏛️ Portal Home</button>
        <button class="mode-tab-btn active" id="tab-pco-dashboard" onclick="setMode('pco-dashboard')">🏠 Dashboard</button>
        <button class="mode-tab-btn" id="tab-notice-tasks" onclick="setMode('notice-tasks')">📬 Notice/Tasks</button>
    `;
    if (['pco_head', 'pco_laboratory', 'pco_gso', 'pco_sanitary'].includes(subrole)) {
      html += `<button class="mode-tab-btn" id="tab-pco-waste" onclick="setMode('pco-waste')">📋 Waste Ledger</button>`;
    }
    
    // Air Emissions (Generators)
    if (['pco_head', 'pco_office', 'pco_ppd'].includes(subrole)) {
      html += `<button class="mode-tab-btn" id="tab-pco-generators" onclick="setMode('pco-generators')">⚡ Air Emissions</button>`;
    }
    
    // Permits & CAPA
    if (['pco_head', 'pco_office'].includes(subrole)) {
      html += `<button class="mode-tab-btn" id="tab-pco-permits" onclick="setMode('pco-permits')">📜 Permits & CAPA</button>`;
    }

    // Incidents & ERCP
    if (['pco_head', 'pco_office'].includes(subrole)) {
      html += `<button class="mode-tab-btn" id="tab-pco-incidents" onclick="setMode('pco-incidents')">🚨 Incidents & ERCP</button>`;
    }
    
    // SMR Compiler
    if (['pco_head', 'pco_laboratory', 'pco_college', 'pco_sanitary'].includes(subrole)) {
      html += `<button class="mode-tab-btn" id="tab-pco-smr" onclick="setMode('pco-smr')">📊 SMR Compiler</button>`;
    }

    // PCO Directories & Notice Center (PCO Head only)
    if (subrole === 'pco_head') {
      html += `<button class="mode-tab-btn" id="tab-pco-directories" onclick="setMode('pco-directories')">🏛️ PCO Directories</button>`;
      html += `<button class="mode-tab-btn" id="tab-pco-notices" onclick="setMode('pco-notices')">🔔 Notice Center</button>`;
    }
    
    html += `
      </div>
    `;
  } else if (currentUserRole === 'laboratory') {
    // Laboratory Stockroom LIMS navigation
    html += `
      <div class="nav-section-title">Stockroom Tools</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn" id="tab-welcome" onclick="setMode('welcome')">🏛️ Portal Home</button>
        <button class="mode-tab-btn active" id="tab-home" onclick="setMode('home')">🏠 Home</button>
        <button class="mode-tab-btn" id="tab-notice-tasks" onclick="setMode('notice-tasks')">📬 Notice/Tasks</button>
        <button class="mode-tab-btn" id="tab-lab-transactions" onclick="setMode('lab-transactions')">📋 Transactions</button>
        <button class="mode-tab-btn" id="tab-lab-students" onclick="setMode('lab-students')">👨‍🎓 Students</button>
        <button class="mode-tab-btn" id="tab-lab-reports" onclick="setMode('lab-reports')">📊 Reports</button>
        <button class="mode-tab-btn" id="tab-lab-communication" onclick="setMode('lab-communication')">📢 Communication</button>
        <button class="mode-tab-btn" id="tab-lab-settings" onclick="setMode('lab-settings')">⚙️ Settings</button>
      </div>

      <div class="nav-section-title">PCO Laboratory</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn" id="tab-lab-spent-chemicals" onclick="setMode('lab-spent-chemicals')">🧪 Spent Chemicals</button>
        <button class="mode-tab-btn" id="tab-lab-effluent-ph" onclick="setMode('lab-effluent-ph')">💧 Lab Effluent pH</button>
        <button class="mode-tab-btn" id="tab-lab-hazardous-inventory" onclick="setMode('lab-hazardous-inventory')">📦 Hazardous Waste Inventory</button>
        <button class="mode-tab-btn" id="tab-lab-spill-incident" onclick="setMode('lab-spill-incident')">🚨 Spill Incident Report</button>
      </div>
    `;
  } else if (currentUserRole === 'faculty') {
    // Faculty navigation
    html += `
      <div class="nav-section-title">Faculty Tools</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn" id="tab-welcome" onclick="setMode('welcome')">🏛️ Portal Home</button>
        <button class="mode-tab-btn active" id="tab-home" onclick="setMode('home')">🏠 Dashboard</button>
        <button class="mode-tab-btn" id="tab-notice-tasks" onclick="setMode('notice-tasks')">📬 Notice/Tasks</button>
        <button class="mode-tab-btn" id="tab-faculty-classes" onclick="setMode('faculty-classes')">🏫 My Classes</button>
        <button class="mode-tab-btn" id="tab-faculty-gradebook" onclick="setMode('faculty-gradebook')">📊 Class Gradebooks</button>
        <button class="mode-tab-btn" id="tab-faculty-groups" onclick="setMode('faculty-groups')">👥 Lab Groups</button>
        <button class="mode-tab-btn" id="tab-faculty-announcements" onclick="setMode('faculty-announcements')">📢 Announcements</button>
      </div>
      
      <div class="nav-section-title">Academic Foundations</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn" id="tab-foundations" onclick="setMode('foundations')">🏛️ Foundations</button>
        <button class="mode-tab-btn" id="tab-faculty" onclick="setMode('faculty')">👨‍🏫 Faculty Info</button>
      </div>
    `;
  } else if (currentUserRole === 'chairperson') {
    html += `
      <div class="nav-section-title">Executive Tools</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn" id="tab-welcome" onclick="setMode('welcome')">🏛️ Portal Home</button>
        <button class="mode-tab-btn" id="tab-cp-dashboard" onclick="setMode('cp-dashboard')">📊 Dashboard</button>
        <button class="mode-tab-btn" id="tab-notice-tasks" onclick="setMode('notice-tasks')">📬 Notice/Tasks</button>
        <button class="mode-tab-btn" id="tab-cp-academic" onclick="setMode('cp-academic')">🎓 Academic Affairs</button>
        <button class="mode-tab-btn" id="tab-cp-faculty" onclick="setMode('cp-faculty')">👨‍🏫 Faculty Oversight</button>
        <button class="mode-tab-btn" id="tab-cp-student" onclick="setMode('cp-student')">👨‍🎓 Student Oversight</button>
        <button class="mode-tab-btn" id="tab-cp-laboratory" onclick="setMode('cp-laboratory')">🧪 Lab Oversight</button>
        <button class="mode-tab-btn" id="tab-cp-pco" onclick="setMode('cp-pco')">🌿 PCO/EMIS Oversight</button>
        <button class="mode-tab-btn" id="tab-cp-strategic" onclick="setMode('cp-strategic')">📈 Strategic Planning</button>
        <button class="mode-tab-btn" id="tab-cp-reports" onclick="setMode('cp-reports')">📄 Executive Reports</button>
        <button class="mode-tab-btn" id="tab-cp-calendar" onclick="setMode('cp-calendar')">📅 Exec Calendar</button>
        <button class="mode-tab-btn" id="tab-cp-approvals" onclick="setMode('cp-approvals')">🔔 Approvals <span id="cp-badge-approvals" style="display:none; background:#ef4444; color:white; font-size:9.5px; font-weight:800; padding:2px 6px; border-radius:10px; margin-left:auto;">0</span></button>
        <button class="mode-tab-btn" id="tab-cp-settings" onclick="setMode('cp-settings')">⚙️ Exec Settings</button>
      </div>
      
      <div class="nav-section-title">Academic Foundations</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn" id="tab-foundations" onclick="setMode('foundations')">🏛️ Foundations</button>
        <button class="mode-tab-btn" id="tab-faculty" onclick="setMode('faculty')">👨‍🏫 Faculty Info</button>
      </div>
    `;
  } else {
    // Student navigation (default)
    const coursesHtml = renderStudentCoursesList();
    
    html += `
      <div class="nav-section-title">Courses</div>
      <div class="courses-buttons-list" id="courses-list">
        ${coursesHtml}
      </div>

      <div class="nav-section-title">Student Tools</div>
      <div class="mode-tabs">
        <button class="mode-tab-btn" id="tab-welcome" onclick="setMode('welcome')">🏛️ Portal Home</button>
        <button class="mode-tab-btn active" id="tab-home" onclick="setMode('home')">🏠 Dashboard</button>
        <button class="mode-tab-btn" id="tab-notice-tasks" onclick="setMode('notice-tasks')">📬 Notice/Tasks</button>
        <button class="mode-tab-btn" id="tab-syllabus" onclick="setMode('syllabus')">📋 Syllabus</button>
        <button class="mode-tab-btn" id="tab-notes" onclick="setMode('notes')">📚 Lecture Notes</button>
        <button class="mode-tab-btn" id="tab-safety" onclick="setMode('safety')">🥽 Lab Safety Guide</button>
        ${(currentCourseId && activeStudentClassData[currentCourseId] && activeStudentClassData[currentCourseId].subjectType === 'lab') ? `
          <button class="mode-tab-btn" id="tab-requisition" onclick="setMode('requisition')">🧪 Lab Requisition</button>
        ` : ''}
        <button class="mode-tab-btn" id="tab-assessments" onclick="setMode('assessments')">✍️ Quizzes & Tasks</button>
        <button class="mode-tab-btn" id="tab-progress" onclick="setMode('progress')">📊 My Progress</button>
      </div>

      <div class="nav-section-title">Academic Foundations</div>
      <div class="mode-tabs" style="margin-bottom: 20px;">
        <button class="mode-tab-btn" id="tab-foundations" onclick="setMode('foundations')">🏛️ Institutional Foundations</button>
        <button class="mode-tab-btn" id="tab-faculty" onclick="setMode('faculty')">👨‍🏫 Faculty Information</button>
        <button class="mode-tab-btn" id="tab-requirements" onclick="setMode('requirements')">💯 Course Requirements</button>
        <button class="mode-tab-btn" id="tab-references" onclick="setMode('references')">📚 References</button>
        <button class="mode-tab-btn" id="tab-guidelines" onclick="setMode('guidelines')">💡 Course Guidelines</button>
      </div>
    `;
  }

  container.innerHTML = html;

  // Make sure active mode button has highlights
  document.querySelectorAll('.mode-tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`tab-${currentMode}`);
  if (activeBtn) activeBtn.classList.add('active');
}

function renderStudentCoursesList() {
  if (!manifestData || !manifestData.courses || !currentUser || !currentUser.subjects) {
    return `<div class="empty-playlist-msg">No subjects chosen. Go to App Settings to select your courses.</div>`;
  }

  const chosenCourses = [];
  manifestData.courses.forEach(course => {
    const matchingSelected = currentUser.subjects.filter(subKey => subKey.startsWith(course.id + '_'));
    if (matchingSelected.length > 0) {
      const sectionLabels = matchingSelected.map(subKey => subKey.replace(course.id + '_', '').toUpperCase());
      chosenCourses.push({ course: course, sections: sectionLabels });
    }
  });

  if (chosenCourses.length === 0) {
    return `<div class="empty-playlist-msg">No matched courses. Select your subjects in App Settings.</div>`;
  }

  return chosenCourses.map(item => {
    const course = item.course;
    const sectionsStr = item.sections.join(', ');
    const activeClass = course.id === currentCourseId ? 'active' : '';
    return `
      <button class="course-btn ${activeClass}" id="course-btn-${course.id}" onclick="setCourse('${course.id}')">
        <span>${course.icon}</span> 
        <div style="display:flex; flex-direction:column; line-height:1.2; text-align:left;">
          <span style="font-weight:700;">${course.name}</span>
          <span style="font-size:9.5px; opacity:0.8; font-weight: 500;">Sec ${sectionsStr}</span>
        </div>
      </button>
    `;
  }).join('');
}

function buildUIFromManifest() {
  if (!manifestData || !manifestData.courses) return;

  populateSubjectDropdowns();

  loadSemesterConfig().then(() => {
    if (currentUserRole === 'student') {
      loadStudentClassData().then(() => {
        renderSidebarNavigation();
        const activeBtn = document.querySelector('.course-btn.active');
        if (!activeBtn) {
          const firstCourseBtn = document.querySelector('.course-btn');
          if (firstCourseBtn) {
            const firstId = firstCourseBtn.id.replace('course-btn-', '');
            setCourse(firstId);
            return;
          }
        }
        renderCurrentModeView();
      });
    } else {
      renderSidebarNavigation();
      renderCurrentModeView();
      if (currentUserRole === 'laboratory' || currentUserRole === 'admin') {
        if (typeof runFirestoreMigration === 'function') {
          runFirestoreMigration();
        }
      }
    }
  });
}

function setCourse(courseId) {
  currentCourseId = courseId;
  playSFX(true);
  
  // Highlight active button in sidebar
  document.querySelectorAll('.course-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`course-btn-${courseId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Load subject specific theme colors from manifest
  const activeCourseObj = manifestData.courses.find(c => c.id === courseId);
  if (activeCourseObj && activeCourseObj.color) {
    document.documentElement.style.setProperty('--active-subject-color', activeCourseObj.color);
  }

  // Sync Header
  if (activeCourseObj) {
    document.getElementById('header-icon').innerText = activeCourseObj.icon;
    document.getElementById('header-title').innerText = activeCourseObj.name;
    document.getElementById('header-subtitle').innerText = activeCourseObj.faculty || "Faculty Not Assigned";
  }

  closeSidebar();
  renderCurrentModeView();
}

// ==========================================================================
// NAVIGATION MODE ROUTER
// ==========================================================================
function setMode(mode) {
  currentMode = mode;
  playSFX(true);

  // Toggle full-screen landing page style
  document.body.classList.toggle('landing-page-active', mode === 'welcome');

  // Update menu tab highlights
  document.querySelectorAll('.mode-tab-btn').forEach(btn => btn.classList.remove('active'));
  const tabBtn = document.getElementById(`tab-${mode}`);
  if (tabBtn) tabBtn.classList.add('active');

  // Cancel any active quiz timer/runner
  exitQuizRunnerSilently();

  renderCurrentModeView();
}

function renderCurrentModeView() {
  const viewportBody = document.getElementById('viewport-body');
  if (!viewportBody) return;

  // Hide meta headers and footers by default
  document.getElementById('view-meta').style.display = 'none';
  document.getElementById('viewport-footer').style.display = 'none';
  document.getElementById('progress-bar').style.width = '0%';
  const progContainer = document.getElementById('progress-container');
  if (progContainer) progContainer.style.display = 'none';

  if (!currentUser && currentMode !== 'welcome') {
    viewportBody.innerHTML = `
      <div class="empty-playlist-msg">
        Please complete student onboarding and sign in to access materials.
      </div>
    `;
    return;
  }

  if (!manifestData) {
    viewportBody.innerHTML = `<div class="empty-playlist-msg">Loading course materials...</div>`;
    return;
  }

  switch(currentMode) {
    case 'home':
      renderDashboardView();
      break;
    case 'syllabus':
      renderSyllabusView();
      break;
    case 'notes':
      renderLectureNotesView();
      break;
    case 'safety':
      renderSafetyView();
      break;
    case 'assessments':
      renderAssessmentsView();
      break;
    case 'progress':
      renderStudentProgressView();
      break;
    case 'foundations':
      renderFoundationsView();
      break;
    case 'faculty':
      renderFacultyView();
      break;
    case 'requirements':
      renderRequirementsView();
      break;
    case 'references':
      renderReferencesView();
      break;
    case 'guidelines':
      renderGuidelinesView();
      break;
    case 'faculty-classes':
      renderFacultyClassesView();
      break;
    case 'faculty-gradebook':
      renderFacultyGradebookView();
      break;
    case 'faculty-groups':
      renderFacultyGroupsView();
      break;
    case 'admin-requests':
      renderAdminRequestsView();
      break;
    case 'admin-users':
      renderAdminUsersView();
      break;
    case 'faculty-class-details':
      renderFacultyClassDetailsView();
      break;
    case 'lab-transactions':
      renderLabTransactionsView();
      break;
    case 'lab-students':
      renderLabStudentsView();
      break;
    case 'lab-reports':
      renderLabReportsView();
      break;
    case 'lab-communication':
      renderLabCommunicationView();
      break;
    case 'lab-settings':
      renderLabSettingsView();
      break;
    case 'lab-spent-chemicals':
      if (typeof renderLabSpentChemicalsView === 'function') renderLabSpentChemicalsView();
      break;
    case 'lab-effluent-ph':
      if (typeof renderLabEffluentPhView === 'function') renderLabEffluentPhView();
      break;
    case 'lab-hazardous-inventory':
      if (typeof renderLabHazardousInventoryView === 'function') renderLabHazardousInventoryView();
      break;
    case 'lab-spill-incident':
      if (typeof renderLabSpillIncidentView === 'function') renderLabSpillIncidentView();
      break;
    case 'requisition':
      renderStudentRequisitionView();
      break;
    case 'pco-dashboard':
      if (typeof renderPcoDashboardView === 'function') renderPcoDashboardView();
      break;
    case 'pco-waste':
      if (typeof renderPcoWasteView === 'function') renderPcoWasteView();
      break;
    case 'pco-generators':
      if (typeof renderPcoGeneratorsView === 'function') renderPcoGeneratorsView();
      break;
    case 'pco-permits':
      if (typeof renderPcoPermitsView === 'function') renderPcoPermitsView();
      break;
    case 'pco-incidents':
      if (typeof renderPcoIncidentsView === 'function') renderPcoIncidentsView();
      break;
    case 'pco-smr':
      if (typeof renderPcoSmrCompiler === 'function') renderPcoSmrCompiler();
      break;
    case 'pco-directories':
      if (typeof renderPcoDirectoriesView === 'function') renderPcoDirectoriesView();
      break;
    case 'pco-notices':
      if (typeof renderPcoNoticesView === 'function') renderPcoNoticesView();
      break;
    case 'cp-dashboard':
    case 'cp-academic':
    case 'cp-faculty':
    case 'cp-student':
    case 'cp-laboratory':
    case 'cp-pco':
    case 'cp-strategic':
    case 'cp-reports':
    case 'cp-calendar':
    case 'cp-approvals':
    case 'cp-settings':
      if (typeof renderChairpersonTab === 'function') {
        renderChairpersonTab(currentMode.replace('cp-', ''));
      }
      break;
    case 'welcome':
      renderWelcomeDashboard();
      break;
    case 'faculty-announcements':
      renderFacultyAnnouncementsView();
      break;
    case 'admin-dashboard':
      adminActiveSubTab = 'overview';
      renderAdminConsoleView();
      break;
    case 'admin-roadmap':
      adminActiveSubTab = 'roadmap';
      renderAdminConsoleView();
      break;
    case 'admin-requests':
      adminActiveSubTab = 'requests';
      renderAdminConsoleView();
      break;
    case 'admin-users':
      adminActiveSubTab = 'users';
      renderAdminConsoleView();
      break;
    case 'admin-applications':
      adminActiveSubTab = 'applications';
      renderAdminConsoleView();
      break;
    case 'admin-feedback':
      adminActiveSubTab = 'feedback';
      renderAdminConsoleView();
      break;
    case 'admin-backups':
      adminActiveSubTab = 'backups';
      renderAdminConsoleView();
      break;
    case 'admin-logs':
      adminActiveSubTab = 'logs';
      renderAdminConsoleView();
      break;
    case 'notice-tasks':
      renderNoticeTasksView();
      break;
    default:
      renderDashboardView();
  }
  updatePeriodicTableButtonVisibility();
}

function renderDashboardView() {
  const viewport = document.getElementById('viewport-body');
  
  if (currentUserRole === 'chairperson') {
    setMode('cp-dashboard');
    return;
  }
  if (currentUserRole === 'pco') {
    setMode('pco-dashboard');
    return;
  }

  if (currentUserRole === 'admin') {
    setMode('admin-dashboard');
    return;
  }
  if (currentUserRole === 'laboratory') {
    renderLaboratoryDashboard();
    return;
  }
  
  if (currentUserRole === 'faculty') {
    viewport.innerHTML = `
      <div class="home-greeting-card" style="padding: 24px; background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
        <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: #3b82f6; margin: 0 0 8px 0;">👨‍🏫 Welcome, Faculty Instructor!</h2>
        <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Manage class records, view gradebooks, assign laboratory groups, and track student statistics.</p>
      </div>
      <div id="faculty-stockroom-announcements-container" style="display:flex; flex-direction:column; gap:12px; margin-bottom: 16px;"></div>
      <div id="faculty-notices-container" style="display:flex; flex-direction:column; gap:12px; margin-bottom: 24px;"></div>
      <div class="class-grid">
        <div class="class-card" onclick="setMode('faculty-classes')">
          <div class="class-code">🏫 My Classrooms</div>
          <p style="margin:0; font-size: 13px; color: var(--text-muted); margin-top: 6px;">View requested classes and manage student roster enrollments.</p>
        </div>
        <div class="class-card" onclick="setMode('faculty-gradebook')">
          <div class="class-code">📊 Class Gradebooks</div>
          <p style="margin:0; font-size: 13px; color: var(--text-muted); margin-top: 6px;">Monitor scores and override student grades for quizzes and assignments.</p>
        </div>
        <div class="class-card" onclick="setMode('faculty-groups')">
          <div class="class-code">👥 Lab Groups</div>
          <p style="margin:0; font-size: 13px; color: var(--text-muted); margin-top: 6px;">Organize enrolled students into experiment groups.</p>
        </div>
      </div>
    `;

    // Query for lab classrooms to display grouping notices and student accountabilities
    firestore.collection('classes')
      .where('facultyEmail', '==', currentUser.email)
      .where('status', '==', 'approved')
      .get()
      .then(querySnapshot => {
        const noticesContainer = document.getElementById('faculty-notices-container');
        if (!noticesContainer) return;
        
        const activeClasses = [];
        let noticesHTML = '';
        
        querySnapshot.forEach(doc => {
          const classData = doc.data();
          const classId = doc.id;
          activeClasses.push({ id: classId, ...classData });
          
          if (classData.subjectType === 'lab') {
            const hasGroups = classData.labGroups && classData.labGroups.length > 0;
            const dismissed = classData.dismissedGroupingNotice === true;
            
            if (!hasGroups && !dismissed) {
              noticesHTML += `
                <div id="notice-grouping-${classId}" style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 16px; text-align: left; display: flex; justify-content: space-between; align-items: center; gap: 16px; animation: fadeIn 0.3s ease;">
                  <div>
                    <h4 style="margin: 0 0 4px 0; color: #f97316; font-size: 14px; font-weight: 700; font-family: 'Outfit', sans-serif;">⚠️ Action Required: Unassigned Lab Groups</h4>
                    <p style="margin: 0; font-size: 12.5px; color: var(--text-muted);">The laboratory subject <strong>${escapeHtml(classData.courseName)} (Sec ${escapeHtml(classData.section)})</strong> does not have student groups set up. Enrolled students cannot submit stockroom requisitions until they are grouped.</p>
                  </div>
                  <div style="display: flex; gap: 8px; shrink: 0;">
                    <button class="settings-btn-primary" onclick="goToFacultyGroups('${classId}')" style="width: auto; margin: 0; padding: 8px 14px; font-size: 12px; font-weight: 600; background: #3b82f6;">Assign Groups</button>
                    <button class="settings-btn-primary" onclick="dismissGroupingNotice('${classId}')" style="width: auto; margin: 0; padding: 8px 14px; font-size: 12px; font-weight: 600; background: transparent; border: 1px solid var(--border-card); color: var(--text-muted);">Dismiss</button>
                  </div>
                </div>
              `;
            }
          }
        });
        
        noticesContainer.innerHTML = noticesHTML;

        // Query pending student accountabilities matching this faculty's active classes
        if (activeClasses.length > 0) {
          firestore.collection('accountabilities')
            .where('status', '==', 'pending')
            .get()
            .then(snap => {
              const facultyAccs = [];
              snap.forEach(docAcc => {
                const d = docAcc.data();
                const matchesClass = activeClasses.some(c => 
                  c.section.toLowerCase().trim() === d.section.toLowerCase().trim() &&
                  (c.courseId.toLowerCase().trim() === d.subject.toLowerCase().trim() || c.courseName.toLowerCase().trim() === d.subject.toLowerCase().trim())
                );
                if (matchesClass) {
                  facultyAccs.push(d);
                }
              });

              if (facultyAccs.length > 0) {
                const accsListStr = facultyAccs.map(a => `<strong>${escapeHtml(a.studentName)}</strong> (${escapeHtml(a.subject)} Sec ${escapeHtml(a.section)}: ${escapeHtml(a.description)})`).join(', ');
                
                const alertHTML = `
                  <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; text-align: left; display: flex; align-items: flex-start; gap: 12px; animation: fadeIn 0.3s ease;">
                    <span style="font-size: 20px; margin-top: -2px;">⚠️</span>
                    <div>
                      <h4 style="margin: 0 0 4px 0; color: #ef4444; font-size: 14px; font-weight: 700; font-family: 'Outfit', sans-serif;">Outstanding Student Accountabilities</h4>
                      <p style="margin: 0; font-size: 12.5px; color: var(--text-muted);">The following students in your laboratory classes have outstanding stockroom requirements: ${accsListStr}. Please remind them to settle these before the end of the semester.</p>
                    </div>
                  </div>
                `;
                
                noticesContainer.insertAdjacentHTML('afterbegin', alertHTML);
              }
            })
            .catch(err => {
              console.error("Error checking faculty student accountabilities:", err);
            });
        }
      })
      .catch(err => {
        console.error("Error checking lab grouping notices:", err);
      });

    // Query stockroom announcements for faculty
    firestore.collection('stockroom_announcements').get()
      .then(snap => {
        const container = document.getElementById('faculty-stockroom-announcements-container');
        if (!container) return;
        let list = [];
        snap.forEach(doc => {
          const d = doc.data();
          if (d.sendTo === 'faculty' || d.sendTo === 'both') {
            list.push(d);
          }
        });
        if (list.length === 0) return;
        list.sort((a, b) => {
          const tA = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime()) : 0;
          const tB = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime()) : 0;
          return tB - tA;
        });
        let html = `
          <div style="background: rgba(13,148,136,0.05); border: 1px solid rgba(13,148,136,0.25); border-radius: 16px; padding: 18px; text-align: left;">
            <h3 style="font-family:'Outfit', sans-serif; font-size:15px; font-weight:700; color:#0d9488; margin:0 0 10px 0; display:flex; align-items:center; gap:6px;">
              <span>🏢</span> Chemistry Stockroom Announcements
            </h3>
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${list.map(ann => `
                <div style="border-bottom:1px dashed var(--border-card); padding-bottom:10px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:4px;">
                    <span style="font-size:10px; color:var(--text-muted); font-family:monospace;">${ann.createdAt ? new Date(ann.createdAt.seconds ? ann.createdAt.seconds * 1000 : ann.createdAt).toLocaleString() : 'Recent'}</span>
                  </div>
                  <p style="margin:0; font-size:12.5px; color:var(--text-muted); line-height:1.4; white-space:pre-wrap;">${escapeHtml(ann.content)}</p>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        container.innerHTML = html;
      })
      .catch(err => console.error("Error loading faculty stockroom announcements:", err));

    return;
  }

  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);
  
  if (!activeCourse) {
    viewport.innerHTML = `<div class="empty-playlist-msg">No course selected</div>`;
    return;
  }

  // Compute stats for current course
  const totalQuizzes = activeCourse.modules.filter(m => m.quiz && isQuizScheduled(m)).length;
  const completedQuizzes = activeCourse.modules.filter(m => 
    isQuizScheduled(m) && localStorage.getItem(`quiz_score_${currentUser.email}_${m.id}`) !== null
  ).length;

  const totalAssignments = activeCourse.modules.filter(m => m.assignment && isAssignScheduled(m)).length;
  const completedAssignments = activeCourse.modules.filter(m => 
    isAssignScheduled(m) && localStorage.getItem(`assignment_submitted_${currentUser.email}_${m.id}`) === 'true'
  ).length;

  // Compute quiz average score percentage
  let totalQuizScore = 0;
  let totalQuizMax = 0;
  activeCourse.modules.forEach(m => {
    if (!isQuizScheduled(m)) return;
    const scoreVal = localStorage.getItem(`quiz_score_${currentUser.email}_${m.id}`);
    const maxVal = localStorage.getItem(`quiz_max_${currentUser.email}_${m.id}`);
    if (scoreVal !== null && maxVal !== null) {
      totalQuizScore += parseFloat(scoreVal);
      totalQuizMax += parseFloat(maxVal);
    }
  });
  const quizAvgScore = totalQuizMax > 0 ? Math.round((totalQuizScore / totalQuizMax) * 100) : 0;

  // Compute assignment average score percentage (if scored, else fallback to completion pct)
  let totalAssignScore = 0;
  let totalAssignMax = 0;
  activeCourse.modules.forEach(m => {
    if (!isAssignScheduled(m)) return;
    const scoreVal = localStorage.getItem(`assignment_score_${currentUser.email}_${m.id}`);
    const maxVal = localStorage.getItem(`assignment_max_${currentUser.email}_${m.id}`);
    if (scoreVal !== null && maxVal !== null) {
      totalAssignScore += parseFloat(scoreVal);
      totalAssignMax += parseFloat(maxVal);
    }
  });
  const assignAvg = totalAssignMax > 0 ? Math.round((totalAssignScore / totalAssignMax) * 100) : null;
  const assignPassedVal = assignAvg !== null ? `${assignAvg}%` : (totalAssignments > 0 ? `${Math.round((completedAssignments / totalAssignments) * 100)}%` : '0%');

  // Generate dynamic upcoming tasks list
  let upcomingHTML = '';
  let upcomingCount = 0;

  activeCourse.modules.forEach(m => {
    const hasQuiz = m.quiz && m.quiz.questions && m.quiz.questions.length > 0 && isQuizScheduled(m);
    const isQuizDone = localStorage.getItem(`quiz_score_${currentUser.email}_${m.id}`) !== null;
    
    if (hasQuiz && !isQuizDone) {
      upcomingCount++;
      upcomingHTML += `
        <div class="module-card" style="border-left: 4px solid var(--accent); background: rgba(14,165,233,0.01);">
          <div class="module-info">
            <span class="module-title" style="font-weight:700;">📝 Quiz: ${m.quiz.title || m.title + ' Quiz'}</span>
            <span class="module-desc">Unit Chapter: ${m.title} • Duration: ${Math.round(m.quiz.timeLimitSeconds / 60)} mins</span>
          </div>
          <div class="module-actions">
            <button class="pdf-action-btn" onclick="launchModuleAssessments('${m.id}')">✍️ Start Quiz</button>
          </div>
        </div>
      `;
    }

    const hasAssign = m.assignment && m.assignment.formUrl && 
                      !m.assignment.formUrl.includes('placeholder') && 
                      m.assignment.formUrl.trim() !== '' && isAssignScheduled(m);
    const isAssignDone = localStorage.getItem(`assignment_submitted_${currentUser.email}_${m.id}`) === 'true';

    if (hasAssign && !isAssignDone) {
      upcomingCount++;
      upcomingHTML += `
        <div class="module-card" style="border-left: 4px solid #f59e0b; background: rgba(245,158,11,0.01);">
          <div class="module-info">
            <span class="module-title" style="font-weight:700;">📂 Assignment: ${m.assignment.title || 'Performance Sheet'}</span>
            <span class="module-desc">Unit Chapter: ${m.title} • ${m.assignment.desc || 'Complete sheet via Google Form'}</span>
          </div>
          <div class="module-actions">
            <button class="pdf-action-btn" style="background:#f59e0b;" onclick="openAssignmentForm('${m.id}', '${m.assignment.formUrl}')">🔗 Open Form</button>
          </div>
        </div>
      `;
    }
  });

  // Parse scheduled exams from the syllabus details
  if (activeCourse.syllabusDetails && activeCourse.syllabusDetails.instructionalPlan) {
    activeCourse.syllabusDetails.instructionalPlan.forEach(p => {
      const topic = p.topic || '';
      if (topic.includes('EXAMINATION')) {
        const lines = topic.split('\n');
        lines.forEach(line => {
          if (line.includes('EXAMINATION')) {
            upcomingCount++;
            let examName = line.split(':')[0].trim();
            let examDate = (line.split(':')[1] || '').trim();
            if (!examDate || examDate.toLowerCase() === 'date') {
              examDate = 'Scheduled by Faculty';
            }
            upcomingHTML += `
              <div class="module-card" style="border-left: 4px solid #10b981; background: rgba(16, 185, 129, 0.01);">
                <div class="module-info">
                  <span class="module-title" style="font-weight:700;">🏆 Exam: ${examName}</span>
                  <span class="module-desc">Target Weeks: ${p.weeks} • Schedule: ${examDate}</span>
                </div>
                <div class="module-actions">
                  <span style="font-size: 12px; color: var(--text-muted); font-weight: 600; padding: 6px 12px; border: 1px dashed var(--border-card); border-radius: 8px;">📅 In-Class</span>
                </div>
              </div>
            `;
          }
        });
      }
    });
  }

  if (upcomingCount === 0) {
    upcomingHTML = `
      <div class="empty-playlist-msg" style="text-align: center; padding: 40px 20px; border: 1px dashed var(--border-card); border-radius: 16px; background: rgba(255,255,255,0.01); width: 100%;">
        <p style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 6px;">
          🎉 There are no upcoming tasks this week
        </p>
        <p style="font-size: 12.5px; color: var(--text-muted); margin: 0;">
          You have completed all scheduled quizzes and performance assignments for this course!
        </p>
      </div>
    `;
  }

  let announcementsHTML = '';
  const classData = activeStudentClassData[currentCourseId];
  if (classData && classData.announcements && classData.announcements.length > 0) {
    const sortedAnns = [...classData.announcements].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    announcementsHTML = `
      <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 16px; padding: 18px; margin-bottom: 24px; text-align: left;">
        <h3 style="font-family:'Outfit', sans-serif; font-size:15px; font-weight:700; color:#f59e0b; margin:0 0 10px 0; display:flex; align-items:center; gap:6px;">
          <span>📢</span> Class Announcements
        </h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${sortedAnns.map(ann => `
            <div style="border-bottom:1px dashed var(--border-card); padding-bottom:10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:4px;">
                <strong style="font-size:13px; color:var(--text-main);">${ann.title}</strong>
                <span style="font-size:10px; color:var(--text-muted); font-family:monospace;">${new Date(ann.createdAt).toLocaleDateString()}</span>
              </div>
              <p style="margin:0; font-size:12.5px; color:var(--text-muted); line-height:1.4;">${ann.content}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  viewport.innerHTML = `
    <div class="dashboard-container">
      <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; margin-bottom: 25px;">
        <div class="dashboard-header-text">
          <h2 style="margin: 0;">Welcome back, ${currentUser.name}!</h2>
          <p style="margin: 6px 0 0 0; color: var(--text-muted); font-size: 13.5px; line-height: 1.5;">
            Academic Record: <strong>${currentUser.studentId}</strong> | Enrolled Classes: <strong>${currentUser.subjects.map(s => s.replace('_', ' ').toUpperCase()).join(', ')}</strong> | Year Level: <strong>${currentUser.year}</strong>
          </p>
        </div>
        <button class="settings-toggle-btn" onclick="openSettingsAndFocusSubjects()" style="border-color: var(--accent); color: var(--accent); background: rgba(14,165,233,0.05); font-weight:700;">
          🧪 Add / Remove Subjects
        </button>
      </div>

      <div id="student-clearance-alerts" style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px;"></div>

      ${announcementsHTML}
      <div id="student-stockroom-announcements-container" style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px;"></div>

      <div class="dashboard-grid">
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-value">${quizAvgScore}%</div>
          <div class="dashboard-stat-label">Quizzes Passed</div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-value">${completedQuizzes}/${totalQuizzes}</div>
          <div class="dashboard-stat-label">Completed Quizzes</div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-value">${assignPassedVal}</div>
          <div class="dashboard-stat-label">Assignments Passed</div>
        </div>
        <div class="dashboard-stat-card">
          <div class="dashboard-stat-value">${completedAssignments}/${totalAssignments}</div>
          <div class="dashboard-stat-label">Submitted Assignments</div>
        </div>
      </div>

      <div style="margin-top: 35px;">
        <h3 style="font-family: 'Outfit', sans-serif; font-size: 18px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <span>📅</span> Upcoming & Scheduled Assessments
        </h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
          Complete your remaining quiz modules, submit worksheets, and prepare for scheduled examinations.
        </p>
        
        <div class="upcoming-list" style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
          ${upcomingHTML}
      </div>
    </div>
  `;

  // Query pending accountabilities for student
  firestore.collection('accountabilities')
    .where('studentEmail', '==', currentUser.email)
    .where('status', '==', 'pending')
    .get()
    .then(snap => {
      const container = document.getElementById('student-clearance-alerts');
      if (!container) return;
      if (snap.empty) return;

      let html = '';
      snap.forEach(doc => {
        const d = doc.data();
        const docId = doc.id;

        let petitionHTML = '';
        if (d.petitionRemarks) {
          petitionHTML = `
            <div style="margin-top: 8px; padding: 10px; background: rgba(13,148,136,0.06); border: 1px solid rgba(13,148,136,0.25); border-radius: 8px; font-size: 12.5px;">
              <span style="color:#0d9488; font-weight:700;">📝 Submitted Explanation:</span>
              <span style="color:var(--text-main); font-style:italic;">"${escapeHtml(d.petitionRemarks)}"</span>
              <div style="font-size: 10.5px; color:var(--text-muted); margin-top:4px;">Awaiting Stockroom Custodian Review</div>
              <button class="settings-btn-primary" onclick="togglePetitionBox('${docId}', true)" style="font-size:11px; padding:4px 8px; margin:6px 0 0 0; width:auto; background:transparent; border:1px solid var(--border-card); color:var(--text-muted);">Update Explanation</button>
            </div>
          `;
        } else {
          petitionHTML = `
            <button class="settings-btn-primary" onclick="togglePetitionBox('${docId}', true)" style="font-size:11.5px; padding:6px 12px; margin-top:8px; width:auto; background:#0d9488;">📝 Petition Clearance</button>
          `;
        }

        html += `
          <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; text-align: left; display: flex; align-items: flex-start; gap: 12px; animation: fadeIn 0.3s ease;">
            <span style="font-size: 20px; margin-top: -2px;">⚠️</span>
            <div style="flex: 1;">
              <h4 style="margin: 0 0 2px 0; color: #ef4444; font-size: 14px; font-weight: 700; font-family: 'Outfit', sans-serif;">Outstanding Laboratory Accountability</h4>
              <p style="margin: 0; font-size: 12.5px; color: var(--text-muted);">You have a pending stockroom accountability in <strong>${escapeHtml(d.subject)} (Sec ${escapeHtml(d.section)})</strong>: ${escapeHtml(d.description)}. Please settle this requirement with the Stockroom Laboratory staff.</p>
              ${petitionHTML}
              <div id="petition-box-${docId}" style="display:none; margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                <textarea id="petition-text-${docId}" placeholder="Explain here if this has been paid, replaced, or satisfied..." style="padding:8px; border-radius:6px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12px; height:60px; font-family:inherit; outline:none; box-sizing:border-box; width:100%;">${d.petitionRemarks ? escapeHtml(d.petitionRemarks) : ''}</textarea>
                <div style="display:flex; gap:6px; justify-content:flex-end;">
                  <button class="settings-btn-primary" onclick="submitAccountabilityPetition('${docId}')" style="font-size:11px; padding:6px 12px; margin:0; width:auto; background:#0d9488;">Submit Remarks</button>
                  <button class="settings-btn-primary" onclick="togglePetitionBox('${docId}', false)" style="font-size:11px; padding:6px 12px; margin:0; width:auto; background:transparent; border:1px solid var(--border-card); color:var(--text-muted);">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
    })
    .catch(err => {
      console.error("Error querying student accountabilities:", err);
    });

  // Query stockroom announcements for student
  firestore.collection('stockroom_announcements').get()
    .then(snap => {
      const container = document.getElementById('student-stockroom-announcements-container');
      if (!container) return;

      let list = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (d.sendTo === 'students' || d.sendTo === 'both') {
          list.push(d);
        }
      });

      if (list.length === 0) return;

      // Sort by newest first
      list.sort((a, b) => {
        const tA = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime()) : 0;
        const tB = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime()) : 0;
        return tB - tA;
      });

      let html = `
        <div style="background: rgba(13,148,136,0.05); border: 1px solid rgba(13,148,136,0.2); border-radius: 16px; padding: 18px; text-align: left;">
          <h3 style="font-family:'Outfit', sans-serif; font-size:15px; font-weight:700; color:#0d9488; margin:0 0 10px 0; display:flex; align-items:center; gap:6px;">
            <span>🏢</span> Chemistry Stockroom Announcements
          </h3>
          <div style="display:flex; flex-direction:column; gap:12px;">
            ${list.map(ann => `
              <div style="border-bottom:1px dashed var(--border-card); padding-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:4px;">
                  <span style="font-size:10px; color:var(--text-muted); font-family:monospace;">${ann.createdAt ? new Date(ann.createdAt.seconds ? ann.createdAt.seconds * 1000 : ann.createdAt).toLocaleString() : 'Recent'}</span>
                </div>
                <p style="margin:0; font-size:12.5px; color:var(--text-muted); line-height:1.4; white-space:pre-wrap;">${escapeHtml(ann.content)}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      container.innerHTML = html;
    })
    .catch(err => console.error("Error loading student stockroom announcements:", err));
}

function launchModuleNotes(modId) {
  setMode('notes');
  // Load target notes view
  const targetNoteEl = document.getElementById(`note-card-${modId}`);
  if (targetNoteEl) {
    targetNoteEl.scrollIntoView({ behavior: 'smooth' });
    targetNoteEl.style.borderColor = 'var(--accent)';
    setTimeout(() => targetNoteEl.style.borderColor = '', 1500);
  }
}

function launchModuleAssessments(modId) {
  setMode('assessments');
  const targetAssessmentEl = document.getElementById(`assessment-card-${modId}`);
  if (targetAssessmentEl) {
    targetAssessmentEl.scrollIntoView({ behavior: 'smooth' });
    targetAssessmentEl.style.borderColor = 'var(--accent)';
    setTimeout(() => targetAssessmentEl.style.borderColor = '', 1500);
  }
}

// ==========================================================================
// VIEW: SYLLABUS SECTION
// ==========================================================================
function renderSyllabusView() {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);

  if (!activeCourse) {
    viewport.innerHTML = `<div class="empty-playlist-msg">No course selected</div>`;
    return;
  }

  const classData = activeStudentClassData[currentCourseId];
  const customSyllabusUrl = classData ? classData.syllabusUrl : null;

  if (customSyllabusUrl) {
    viewport.innerHTML = `
      <div class="syllabus-view-container" style="animation: fadeIn 0.3s ease; text-align: left;">
        <h2 style="font-family:'Outfit',sans-serif; font-size:22px; font-weight:800; margin-bottom: 8px;">📋 Section Syllabus</h2>
        <p style="margin-top:0; color:var(--text-muted); font-size: 13.5px; margin-bottom: 24px;">
          Your instructor has provided a custom syllabus for this classroom section. Use the actions below to view or download the document.
        </p>
        
        <div class="module-card" style="margin-bottom: 30px; border-left: 4px solid var(--accent); border-radius: 12px; padding: 18px; background:var(--bg-card); border-top:1px solid var(--border-card); border-right:1px solid var(--border-card); border-bottom:1px solid var(--border-card);">
          <div class="module-info">
            <span class="module-title" style="font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif;">Class Syllabus Override</span>
            <span class="module-desc" style="font-size: 12.5px; margin-top: 4px; display: block; color:var(--text-muted);">Custom curriculum requirements, schedule outline, and policies designated for your specific laboratory or lecture section.</span>
            <span style="font-size: 11px; color: var(--text-muted); margin-top: 8px; display: block;">Source: Classroom Syllabus URL</span>
          </div>
          <div class="module-actions" style="margin-top: 14px; display:flex; gap:10px;">
            <button class="pdf-action-btn" style="border-radius: 8px; padding: 8px 16px;" onclick="viewSyllabusInApp('${customSyllabusUrl}', 'Classroom Syllabus')">👁️ View Syllabus</button>
            <button class="pdf-action-btn" style="background:#475569; border-radius: 8px; padding: 8px 16px;" onclick="exportPDFExternally('${customSyllabusUrl}')">📤 Download</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const details = activeCourse.syllabusDetails || {};
  const outcomesHTML = (details.outcomes || []).map(co => {
    const parts = co.split(':');
    const outcomeCode = parts[0];
    const outcomeText = parts.slice(1).join(':').trim();
    return `
      <div class="outcome-card-item">
        <span style="font-weight:700; font-family:'Outfit',sans-serif; color:var(--accent); display:block; margin-bottom:4px;">${outcomeCode}</span>
        <span style="font-size:13px; color:var(--text-main);">${outcomeText || co}</span>
      </div>
    `;
  }).join('');

  const prereqsHTML = details.prerequisites ? `
    <div class="syllabus-meta-card">
      <span class="syllabus-meta-label">Prerequisites</span>
      <span class="syllabus-meta-value">${details.prerequisites}</span>
    </div>
  ` : '';

  const planRows = (details.instructionalPlan || []).map(row => {
    const dateRange = getWeekDateRange(row.weeks);
    const dateRangeHTML = dateRange ? `<br><span style="font-size:10.5px; color:var(--accent); font-weight:600; display:block; margin-top:4px; line-height:1.2;">${dateRange}</span>` : '';
    return `
      <tr>
        <td style="font-weight:700;">W: ${row.weeks}<br><span style="font-size:11px; color:var(--text-muted);">${row.hours} hrs</span>${dateRangeHTML}</td>
        <td style="white-space: pre-line;">${row.topic}</td>
        <td>
          <div style="margin-bottom:6px;"><b>Onsite:</b> ${row.onsite}</div>
          <div style="margin-bottom:6px;"><b>Online:</b> ${row.online}</div>
          <div><b>Offline:</b> ${row.offline}</div>
        </td>
        <td style="white-space: pre-line;">${row.assessment}</td>
      </tr>
    `;
  }).join('');

  viewport.innerHTML = `
    <div class="syllabus-view-container" style="animation: fadeIn 0.3s ease;">
      <h2>📋 Course Syllabus: ${details.courseTitle || activeCourse.name}</h2>
      <p style="margin-top:-10px; color:var(--text-muted); font-size: 14px; margin-bottom: 25px;">
        View the official course syllabus, learning outcomes, and instructional plan.
      </p>

      <!-- Meta Grid -->
      <div class="syllabus-meta-grid">
        <div class="syllabus-meta-card">
          <span class="syllabus-meta-label">Course Number</span>
          <span class="syllabus-meta-value">${details.courseNumber || activeCourse.id.toUpperCase()}</span>
        </div>
        <div class="syllabus-meta-card">
          <span class="syllabus-meta-label">Course Title</span>
          <span class="syllabus-meta-value">${details.courseTitle || activeCourse.name}</span>
        </div>
        <div class="syllabus-meta-card">
          <span class="syllabus-meta-label">Credit Units</span>
          <span class="syllabus-meta-value">${details.creditUnits || 'N/A'}</span>
        </div>
        <div class="syllabus-meta-card">
          <span class="syllabus-meta-label">Time Allotment</span>
          <span class="syllabus-meta-value">${details.timeAllotment || 'N/A'}</span>
        </div>
        ${prereqsHTML}
      </div>

      <!-- Description -->
      <div class="section-card" style="margin-bottom:24px; padding:20px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border-card);">
        <h3 style="margin-top:0; margin-bottom:10px; font-family:'Outfit',sans-serif;">Course Description</h3>
        <p style="font-size:13.5px; line-height:1.6; color:var(--text-main); margin:0;">${details.description || 'No description available.'}</p>
      </div>

      <!-- Course Outcomes -->
      <div class="section-card" style="margin-bottom:24px; padding:20px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border-card);">
        <h3 style="margin-top:0; margin-bottom:14px; font-family:'Outfit',sans-serif;">Course Outcomes</h3>
        <div class="outcomes-container">
          ${outcomesHTML || 'No outcomes listed.'}
        </div>
      </div>

      <!-- Instructional Plan Table -->
      <div class="section-card" style="margin-bottom:24px; padding:20px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border-card);">
        <h3 style="margin-top:0; margin-bottom:14px; font-family:'Outfit',sans-serif;">Instructional Plan</h3>

        <div class="zoomable-table-wrapper">
          <table class="zoomable-table">
            <thead>
              <tr>
                <th style="width:15%;">Timeframe</th>
                <th style="width:30%;">Topic / Content</th>
                <th style="width:35%;">Flexible Teaching-Learning Strategies</th>
                <th style="width:20%;">Assessment</th>
              </tr>
            </thead>
            <tbody>
              ${planRows || '<tr><td colspan="4" style="text-align:center;">No plan details available.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- PDF View & Export Trigger -->
      <div class="module-card" style="margin-bottom: 30px; border-left: 4px solid var(--accent); border-radius: 12px; padding: 18px;">
        <div class="module-info">
          <span class="module-title" style="font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif;">${activeCourse.syllabus?.title || 'Syllabus PDF'}</span>
          <span class="module-desc" style="font-size: 12.5px; margin-top: 4px; display: block;">Official curriculum, policies, outline, and grading system for your currently selected course.</span>
          <span style="font-size: 11px; color: var(--text-muted); margin-top: 8px; display: block;">File size: ${activeCourse.syllabus?.pdfSize || 'N/A'} • Source: GitHub Server</span>
        </div>
        <div class="module-actions" style="margin-top: 10px;">
          <button class="pdf-action-btn" style="border-radius: 8px; padding: 8px 16px;" onclick="viewSyllabusInApp('${activeCourse.syllabus?.pdfUrl}', '${activeCourse.syllabus?.title}')">👁️ View</button>
          <button class="pdf-action-btn" style="background:#475569; border-radius: 8px; padding: 8px 16px;" onclick="exportPDFExternally('${activeCourse.syllabus?.pdfUrl}')">📤 Download</button>
        </div>
      </div>

      <div id="pdf-syllabus-viewer-box" style="display: none;"></div>
    </div>
  `;
  renderChemistrySymbols(viewport);
}

function formatRichText(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (trimmed.startsWith('•') || trimmed.startsWith('\u2022') || trimmed.startsWith('*') || trimmed.startsWith('-')) {
      if (!inList) {
        html += '<ul style="margin-top: 8px; margin-bottom: 8px; padding-left: 20px; list-style-type: disc;">';
        inList = true;
      }
      let cleanLi = trimmed.replace(/^[•\u2022\*\-]\s*/, '');
      cleanLi = cleanLi.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html += `<li style="margin-bottom: 6px; font-size: 14px; color: var(--text-muted);"><span style="color: var(--text-main);">${cleanLi}</span></li>`;
    } else {
      if (inList) {
        html += '</ul>';
        inList = false;
      }
      const cleanPara = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      html += `<p style="margin-bottom: 10px; font-size: 14.5px; line-height: 1.6;">${cleanPara}</p>`;
    }
  });

  if (inList) {
    html += '</ul>';
  }
  return html;
}

function renderFoundationsView() {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId) || manifestData.courses[0];

  if (!activeCourse || !activeCourse.syllabusDetails) {
    viewport.innerHTML = `<div class="empty-playlist-msg">No course or manifest data loaded.</div>`;
    return;
  }

  const foundations = activeCourse.syllabusDetails.institutionalFoundations || {};

  viewport.innerHTML = `
    <div class="syllabus-view-container" style="animation: fadeIn 0.3s ease;">
      <h2>🏛️ Institutional Foundations</h2>
      <p style="margin-top:-10px; color:var(--text-muted); font-size: 14px; margin-bottom: 25px;">
        Mindanao State University - General Santos institutional vision, mission, and policies.
      </p>

      <div class="foundation-section">
        <!-- Vision -->
        <div class="foundation-card vision-card">
          <h3 class="foundation-title">👁️ University Vision</h3>
          <p class="foundation-text">${foundations.vision}</p>
        </div>

        <!-- Mission -->
        <div class="foundation-card mission-card">
          <h3 class="foundation-title">🎯 University Mission</h3>
          <p class="foundation-text">${foundations.mission}</p>
        </div>

        <!-- Core Values -->
        <div class="foundation-card values-card">
          <h3 class="foundation-title">⭐ University Core Values</h3>
          <p class="foundation-text">${foundations.values}</p>
        </div>

        <!-- EOMS Policy -->
        <div class="foundation-card eoms-card">
          <h3 class="foundation-title">🛡️ EOMS Policy</h3>
          <div class="foundation-text">${formatRichText(foundations.eoms)}</div>
        </div>

        <!-- Quality Policy -->
        <div class="foundation-card policy-card">
          <h3 class="foundation-title">🏅 Quality Policy Statement</h3>
          <p class="foundation-text">${foundations.qualityPolicy}</p>
        </div>
      </div>
    </div>
  `;
}

function renderRequirementsView() {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);

  if (!activeCourse || !activeCourse.syllabusDetails) {
    viewport.innerHTML = `<div class="empty-playlist-msg">No course selected</div>`;
    return;
  }

  const reqs = activeCourse.syllabusDetails.requirements || {};
  
  const weightsHTML = (reqs.gradingWeights || []).map(w => {
    return `
      <tr>
        <td style="font-weight:600;">${w.component}</td>
        <td style="text-align:right; font-weight:700; color:var(--accent);">${w.weight}%</td>
      </tr>
    `;
  }).join('');

  const systemHTML = (reqs.gradingSystem || []).map(g => {
    return `
      <tr>
        <td style="font-weight:600;">${g.rating}</td>
        <td style="font-weight:700; color:var(--accent);">${g.grade}</td>
        <td>${g.competence}</td>
      </tr>
    `;
  }).join('');

  viewport.innerHTML = `
    <div class="syllabus-view-container" style="animation: fadeIn 0.3s ease;">
      <h2>💯 Course Requirements & Grading</h2>
      <p style="margin-top:-10px; color:var(--text-muted); font-size: 14px; margin-bottom: 25px;">
        Learn about course requirements, grading distribution weights, and academic standards.
      </p>

      <!-- Course Policies & Rules -->
      <div class="section-card" style="margin-bottom:24px; padding:20px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border-card);">
        <h3 style="margin-top:0; margin-bottom:12px; font-family:'Outfit',sans-serif;">Course Requirements & Rules</h3>
        <p style="font-size:13.5px; line-height:1.7; color:var(--text-main); margin:0; white-space: pre-line;">${reqs.rules || 'No requirements specified.'}</p>
      </div>

      <!-- Grading components and weights -->
      <div style="display:grid; grid-template-columns:1fr; gap:20px; margin-bottom:24px;">
        
        <div class="section-card" style="padding:20px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border-card);">
          <h3 style="margin-top:0; margin-bottom:14px; font-family:'Outfit',sans-serif;">Grading Distribution Weights</h3>
          <div class="zoomable-table-wrapper">
            <table class="zoomable-table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th style="text-align:right; width:30%;">Weight (%)</th>
                </tr>
              </thead>
              <tbody>
                ${weightsHTML || '<tr><td colspan="2">No weights specified.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="section-card" style="padding:20px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border-card);">
          <h3 style="margin-top:0; margin-bottom:14px; font-family:'Outfit',sans-serif;">Grading Scale System</h3>
          <div class="zoomable-table-wrapper">
            <table class="zoomable-table">
              <thead>
                <tr>
                  <th>Rating (%)</th>
                  <th>Grade</th>
                  <th>Level of Competence</th>
                </tr>
              </thead>
              <tbody>
                ${systemHTML || '<tr><td colspan="3">No grading scale specified.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderFacultyView() {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);

  if (!activeCourse || !activeCourse.syllabusDetails) {
    viewport.innerHTML = `<div class="empty-playlist-msg">No course selected</div>`;
    return;
  }

  const details = activeCourse.syllabusDetails;
  const manifestFaculty = details.faculty || {};

  // Determine faculty email to query
  let facultyEmail = manifestFaculty.email || '';
  
  if (currentUserRole === 'faculty') {
    facultyEmail = currentUser.email;
  } else {
    const classData = activeStudentClassData[currentCourseId];
    if (classData && classData.facultyEmail) {
      facultyEmail = classData.facultyEmail;
    }
  }

  viewport.innerHTML = `<div class="empty-playlist-msg">Loading faculty details...</div>`;

  const renderView = (facultyProfile) => {
    // Priority: facultyProfile values > manifest syllabus values
    const facultyName = (facultyProfile && facultyProfile.name) ? facultyProfile.name : (manifestFaculty.name || 'N/A');
    const facultyEmail = (facultyProfile && facultyProfile.email) ? facultyProfile.email : (manifestFaculty.email || 'N/A');
    const facultyMobile = (facultyProfile && facultyProfile.contactNumber) ? facultyProfile.contactNumber : (manifestFaculty.mobile || 'N/A');
    const facultyOffice = (facultyProfile && facultyProfile.officeAddress) ? facultyProfile.officeAddress : (manifestFaculty.office || 'N/A');
    
    // Consultation
    let consultHTML = '';
    if (facultyProfile && facultyProfile.consultationHours) {
      const hours = facultyProfile.consultationHours.split('\n').filter(h => h.trim().length > 0);
      consultHTML = hours.map(h => `<li>${h}</li>`).join('');
    } else {
      consultHTML = (manifestFaculty.consultation || []).map(c => `<li>${c}</li>`).join('');
    }

    // Links: FB Messenger, Telegram GC, Messenger GC
    let linksHTML = '';
    if (facultyProfile) {
      if (facultyProfile.messengerLink || facultyProfile.telegramGc || facultyProfile.messengerGc) {
        linksHTML = `
          <div style="margin-top: 15px; border-top: 1px dashed var(--border-card); padding-top: 15px;">
            <h4 style="margin: 0 0 10px 0; font-size: 13.5px; font-family:'Outfit',sans-serif;">🔗 Dynamic Contact Links</h4>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              ${facultyProfile.messengerLink ? `<a href="${facultyProfile.messengerLink}" target="_blank" class="settings-btn-primary" style="display: inline-flex; width: auto; align-items: center; gap: 6px; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;">💬 FB Messenger</a>` : ''}
              ${facultyProfile.messengerGc ? `<a href="${facultyProfile.messengerGc}" target="_blank" class="settings-btn-primary" style="display: inline-flex; width: auto; align-items: center; gap: 6px; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; background: var(--secondary, #3b82f6);">👥 Class Messenger GC</a>` : ''}
              ${facultyProfile.telegramGc ? `<a href="${facultyProfile.telegramGc}" target="_blank" class="settings-btn-primary" style="display: inline-flex; width: auto; align-items: center; gap: 6px; text-decoration: none; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; background: #0088cc;">✈️ Telegram Group Chat</a>` : ''}
            </div>
          </div>
        `;
      }
    }

    // Input editor for Facultys to edit in-place
    let editSectionHTML = '';
    if (currentUserRole === 'faculty') {
      editSectionHTML = `
        <div class="section-card" style="margin-top: 24px; padding: 20px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-card);">
          <h3 style="margin-top: 0; margin-bottom: 14px; font-family: 'Outfit', sans-serif; display: flex; align-items: center; gap: 8px;">✏️ Edit Faculty Information</h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: -10px; margin-bottom: 15px;">Updates here override the default syllabus details and are instantly visible to students enrolled in your sections.</p>
          <div class="onboarding-form" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group" style="text-align: left;">
              <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-muted);">👤 Full Name</label>
              <input type="text" id="faculty-edit-name" value="${facultyProfile && facultyProfile.name ? escapeHtml(facultyProfile.name) : escapeHtml(currentUser.name)}" placeholder="e.g. Prof. Ramon M. Eduque, Jr." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 13px; box-sizing: border-box;" onchange="updateFacultyField('name', this.value)">
            </div>
            <div class="form-group" style="text-align: left;">
              <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-muted);">📧 Email</label>
              <input type="email" id="faculty-edit-email" value="${facultyProfile && facultyProfile.email ? escapeHtml(facultyProfile.email) : escapeHtml(currentUser.email)}" placeholder="e.g. email@msugensan.edu.ph" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 13px; box-sizing: border-box;" onchange="updateFacultyField('email', this.value)">
            </div>
            <div class="form-group" style="text-align: left;">
              <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-muted);">📱 Contact Number</label>
              <input type="text" id="faculty-edit-contact" value="${facultyProfile && facultyProfile.contactNumber ? escapeHtml(facultyProfile.contactNumber) : ''}" placeholder="e.g. 09123456789" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 13px; box-sizing: border-box;" onchange="updateFacultyField('contactNumber', this.value)">
            </div>
            <div class="form-group" style="text-align: left;">
              <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-muted);">🏢 Office Address</label>
              <input type="text" id="faculty-edit-office" value="${facultyProfile && facultyProfile.officeAddress ? escapeHtml(facultyProfile.officeAddress) : ''}" placeholder="e.g. Department of Chemistry, RSRC" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 13px; box-sizing: border-box;" onchange="updateFacultyField('officeAddress', this.value)">
            </div>
            <div class="form-group" style="text-align: left;">
              <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-muted);">💬 FB Messenger Profile Link</label>
              <input type="url" id="faculty-edit-messenger" value="${facultyProfile && facultyProfile.messengerLink ? escapeHtml(facultyProfile.messengerLink) : ''}" placeholder="e.g. https://m.me/username" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 13px; box-sizing: border-box;" onchange="updateFacultyField('messengerLink', this.value)">
            </div>
            <div class="form-group" style="text-align: left;">
              <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-muted);">👥 Class Messenger Group Chat (GC) Link</label>
              <input type="url" id="faculty-edit-messenger-gc" value="${facultyProfile && facultyProfile.messengerGc ? escapeHtml(facultyProfile.messengerGc) : ''}" placeholder="e.g. https://messenger.com/j/..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 13px; box-sizing: border-box;" onchange="updateFacultyField('messengerGc', this.value)">
            </div>
            <div class="form-group" style="text-align: left;">
              <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-muted);">✈️ Class Telegram Group Chat (GC) Link</label>
              <input type="url" id="faculty-edit-telegram-gc" value="${facultyProfile && facultyProfile.telegramGc ? escapeHtml(facultyProfile.telegramGc) : ''}" placeholder="e.g. https://t.me/..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 13px; box-sizing: border-box;" onchange="updateFacultyField('telegramGc', this.value)">
            </div>
            <div class="form-group" style="text-align: left;">
              <label style="font-size: 12px; font-weight: 600; display: block; margin-bottom: 4px; color: var(--text-muted);">📅 Consultation Hours (one per line)</label>
              <textarea id="faculty-edit-consultation" placeholder="e.g. MWF 9:00 AM - 11:00 AM" style="width: 100%; height: 80px; padding: 8px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 13px; font-family: sans-serif; resize: vertical; box-sizing: border-box;" onchange="updateFacultyField('consultationHours', this.value)">${facultyProfile && facultyProfile.consultationHours ? escapeHtml(facultyProfile.consultationHours) : ''}</textarea>
            </div>
          </div>
        </div>
      `;
    }

    const facultyHTML = `
      <div class="faculty-info-container">
        <div class="faculty-contact-row">
          <span class="faculty-contact-icon">👤</span>
          <div class="faculty-contact-details">
            <span class="faculty-contact-label">Instructor Name</span>
            <span class="faculty-contact-value">${facultyName}</span>
          </div>
        </div>
        <div class="faculty-contact-row">
          <span class="faculty-contact-icon">📧</span>
          <div class="faculty-contact-details">
            <span class="faculty-contact-label">Academic Email</span>
            <span class="faculty-contact-value">${facultyEmail}</span>
          </div>
        </div>
        <div class="faculty-contact-row">
          <span class="faculty-contact-icon">📱</span>
          <div class="faculty-contact-details">
            <span class="faculty-contact-label">Mobile Number</span>
            <span class="faculty-contact-value">${facultyMobile}</span>
          </div>
        </div>
        <div class="faculty-contact-row">
          <span class="faculty-contact-icon">🏢</span>
          <div class="faculty-contact-details">
            <span class="faculty-contact-label">Faculty Office</span>
            <span class="faculty-contact-value">${facultyOffice}</span>
          </div>
        </div>
        <div class="faculty-contact-row" style="flex-direction:column; align-items:flex-start; gap:6px;">
          <span class="faculty-contact-label" style="margin-left:42px;">📅 Consultation Schedule</span>
          <ul style="margin:0; padding-left:58px; font-size:13px; font-weight:700; color:var(--text-main); list-style-type:square;">
            ${consultHTML || '<li>No consultation schedule specified.</li>'}
          </ul>
        </div>
        ${linksHTML}
      </div>
    `;

    // Resolve QR codes for instructors
    let qrCodesHTML = '';
    if (facultyName.toLowerCase().includes('eduque')) {
      qrCodesHTML = `
        <div class="faculty-header-qrs" style="display: flex; gap: 15px; align-items: center; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-card); padding: 10px; border-radius: 12px;">
          <div style="text-align: center;">
            <img src="rem_qr.png" alt="FB Messenger QR" style="width: 80px; height: 80px; border-radius: 6px; border: 2px solid white; display: block; object-fit: cover; margin-bottom: 4px;">
            <span style="font-size: 9px; color: var(--text-muted); font-weight: 600;">FB Messenger</span>
          </div>
          <div style="text-align: center;">
            <img src="ree_qr.png" alt="Email QR" style="width: 80px; height: 80px; border-radius: 6px; border: 2px solid white; display: block; object-fit: cover; margin-bottom: 4px;">
            <span style="font-size: 9px; color: var(--text-muted); font-weight: 600;">Email QR</span>
          </div>
        </div>
      `;
    }

    viewport.innerHTML = `
      <div class="syllabus-view-container" style="animation: fadeIn 0.3s ease;">
        <div class="faculty-header-container" style="display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; margin-bottom: 25px;">
          <div class="faculty-header-text" style="flex: 1; min-width: 280px;">
            <h2 style="margin: 0; display: flex; align-items: center; gap: 8px;">👨‍🏫 Faculty Information</h2>
            <p style="margin: 6px 0 0 0; color: var(--text-muted); font-size: 14px; line-height: 1.5;">
              Instructor contact details, office location, and consultation hours.
            </p>
          </div>
          ${qrCodesHTML}
        </div>

        <div class="section-card" style="margin-bottom:24px; padding:20px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border-card);">
          <h3 style="margin-top:0; margin-bottom:14px; font-family:'Outfit',sans-serif;">Instructor Contact</h3>
          ${facultyHTML}
        </div>
        
        ${editSectionHTML}
      </div>
    `;
  };

  if (facultyEmail) {
    firestore.collection("students").doc(facultyEmail).get()
      .then(doc => {
        if (doc.exists) {
          renderView(doc.data());
        } else {
          renderView(null);
        }
      })
      .catch(err => {
        console.error("Error fetching faculty profile:", err);
        renderView(null);
      });
  } else {
    renderView(null);
  }
}

function renderReferencesView() {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);

  if (!activeCourse || !activeCourse.syllabusDetails) {
    viewport.innerHTML = `<div class="empty-playlist-msg">No course selected</div>`;
    return;
  }

  const details = activeCourse.syllabusDetails;
  const refsHTML = (details.references || []).map(ref => {
    return `<li style="font-size:13px; line-height:1.6; color:var(--text-main); margin-bottom:8px;">${ref}</li>`;
  }).join('');

  viewport.innerHTML = `
    <div class="syllabus-view-container" style="animation: fadeIn 0.3s ease;">
      <h2>📚 Verbatim Syllabus References</h2>
      <p style="margin-top:-10px; color:var(--text-muted); font-size: 14px; margin-bottom: 25px;">
        Required readings, textbooks, and reference materials specified in the course syllabus.
      </p>

      <div class="section-card" style="margin-bottom:24px; padding:20px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border-card);">
        <h3 style="margin-top:0; margin-bottom:14px; font-family:'Outfit',sans-serif;">References List</h3>
        <ol style="margin:0; padding-left:20px;">
          ${refsHTML || '<li>No references listed.</li>'}
        </ol>
      </div>
    </div>
  `;
}

function renderGuidelinesView() {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);

  if (!activeCourse || !activeCourse.syllabusDetails) {
    viewport.innerHTML = `<div class="empty-playlist-msg">No course selected</div>`;
    return;
  }

  const details = activeCourse.syllabusDetails;
  const guideHTML = (details.additionalGuidelines || []).map(g => {
    const parts = g.split(':');
    const title = parts[0];
    const desc = parts.slice(1).join(':').trim();
    return `
      <div style="margin-bottom:14px; padding-bottom:12px; border-bottom:1px dashed var(--border-card);">
        <b style="color:var(--accent); font-family:'Outfit',sans-serif; font-size:14px; display:block; margin-bottom:2px;">${title}</b>
        <p style="font-size:13px; line-height:1.5; color:var(--text-main); margin:0;">${desc || g}</p>
      </div>
    `;
  }).join('');

  viewport.innerHTML = `
    <div class="syllabus-view-container" style="animation: fadeIn 0.3s ease;">
      <h2>💡 Course Guidelines</h2>
      <p style="margin-top:-10px; color:var(--text-muted); font-size: 14px; margin-bottom: 25px;">
        Additional guidelines and recommendations for optimizing your study experience in this course.
      </p>

      <div class="section-card" style="margin-bottom:24px; padding:20px; border-radius:12px; background:var(--bg-card); border:1px solid var(--border-card);">
        <h3 style="margin-top:0; margin-bottom:14px; font-family:'Outfit',sans-serif;">Guidelines & Recommendations</h3>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${guideHTML || 'No guidelines listed.'}
        </div>
      </div>
    </div>
  `;
}

const fileAvailabilityCache = {};
async function checkFileExists(url) {
  if (url in fileAvailabilityCache) {
    return fileAvailabilityCache[url];
  }
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const exists = response.ok;
    fileAvailabilityCache[url] = exists;
    return exists;
  } catch (e) {
    console.error("HEAD check failed for", url, e);
    return true; 
  }
}

function viewSyllabusInApp(pdfUrl, title) {
  playSFX(true);
  let targetUrl = pdfUrl;
  if (pdfUrl && pdfUrl.includes('raw.githubusercontent.com')) {
    let newUrl = pdfUrl.replace('raw.githubusercontent.com', 'github.com');
    targetUrl = newUrl.replace(/(github\.com\/[^/]+\/[^/]+)\/([^/]+)\/(.*)/, '$1/blob/$2/$3');
  }
  window.open(targetUrl, '_blank');
}

// ==========================================================================
// VIEW: LABORATORY SAFETY GUIDE
// ==========================================================================
function renderSafetyView() {
  const viewport = document.getElementById('viewport-body');
  
  // Create three tab buttons: conduct, requisition, form
  const tabBtnStyle = (tabId) => `
    flex: 1; 
    padding: 10px; 
    font-weight: 600; 
    font-size: 12.5px; 
    border-radius: 8px; 
    border: none; 
    background: ${safetyActiveSubTab === tabId ? 'var(--accent)' : 'rgba(255,255,255,0.05)'}; 
    color: ${safetyActiveSubTab === tabId ? '#fff' : 'var(--text-main)'}; 
    cursor: pointer; 
    transition: all 0.2s;
    text-align: center;
    box-shadow: ${safetyActiveSubTab === tabId ? '0 4px 12px rgba(13, 148, 136, 0.2)' : 'none'};
  `;

  let subTabContent = '';

  if (safetyActiveSubTab === 'conduct') {
    subTabContent = `
      <div style="animation: fadeIn 0.25s ease;">
        <!-- General Conduct Card -->
        <div class="dashboard-stat-card" style="text-align: left; background: var(--bg-card); padding: 20px; border-radius: 14px; border: 1px solid var(--border-card); margin-bottom: 25px;">
          <h3 style="margin-top: 0; font-size: 16px; font-family: 'Outfit', sans-serif; color: var(--accent); display: flex; align-items: center; gap: 8px;">
            <span>🔬</span> General Laboratory Safety Standards
          </h3>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 15px;">
            All laboratory activities must be conducted under the direct supervision of an authorized Chemistry instructor or custodian. Unauthorized experiments are strictly prohibited.
          </p>
          <ul style="font-size: 13px; line-height: 1.7; padding-left: 20px; color: var(--text-main); display: flex; flex-direction: column; gap: 8px;">
            <li><strong>Know Emergency Gear Locations:</strong> Before beginning any work, locate the nearest eyewash station, safety shower, fire extinguisher, first aid kit, and emergency exits.</li>
            <li><strong>Personal Protective Equipment (PPE):</strong> Splash-proof goggles, a long-sleeved white laboratory gown, and closed-toe leather shoes must be worn at all times. Contacts are prohibited as vapor can get trapped behind them.</li>
            <li><strong>Chemical Hazards Verification:</strong> Always read label hazard signs (GHS/MSDS) twice before pouring or dispensing. Never use an unlabeled container.</li>
            <li><strong>Fume Hood Policy:</strong> Any procedure releasing noxious, volatile, or highly reactive gases must be executed exclusively inside a functional fume hood.</li>
            <li><strong>Accident Reporting:</strong> Report any injury, skin contact with chemicals, glass breakage, or equipment malfunction immediately to your instructor, regardless of how minor it seems.</li>
          </ul>
        </div>

        <!-- Dos & Don'ts Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 25px;">
          <!-- Dos Card -->
          <div class="module-card" style="flex-direction: column; align-items: stretch; border-left: 4px solid var(--correct); padding: 18px; border-radius: 12px; background: var(--bg-card);">
            <h3 style="color: var(--correct); font-size: 15px; margin-top: 0; display: flex; align-items: center; gap: 8px; font-family: 'Outfit', sans-serif;">
              <span>🟢</span> Do's (Safe Lab Conduct)
            </h3>
            <ul style="font-size: 12.5px; line-height: 1.6; padding-left: 18px; margin: 10px 0 0 0; color: var(--text-main); display: flex; flex-direction: column; gap: 8px;">
              <li><strong>Neat Workspaces:</strong> Keep bench surfaces dry and clear of unnecessary bags, coats, or laptops to prevent spills.</li>
              <li><strong>Wash Hands:</strong> Always scrub hands with soap and water before exiting the lab room, especially before eating.</li>
              <li><strong>Acid Dilution:</strong> Always add concentrated acid to water slowly, with stirring—never pour water into concentrated acid (prevents boiling/splashing).</li>
              <li><strong>Secure Containment:</strong> Use secondary containment trays when transporting large quantities of liquid reagents.</li>
              <li><strong>Glassware Inspection:</strong> Examine glassware for chips, cracks, or stars before heating. Do not use damaged glass.</li>
            </ul>
          </div>

          <!-- Don'ts Card -->
          <div class="module-card" style="flex-direction: column; align-items: stretch; border-left: 4px solid #ef4444; padding: 18px; border-radius: 12px; background: var(--bg-card);">
            <h3 style="color: #ef4444; font-size: 15px; margin-top: 0; display: flex; align-items: center; gap: 8px; font-family: 'Outfit', sans-serif;">
              <span>🔴</span> Don'ts (Strictly Prohibited)
            </h3>
            <ul style="font-size: 12.5px; line-height: 1.6; padding-left: 18px; margin: 10px 0 0 0; color: var(--text-main); display: flex; flex-direction: column; gap: 8px;">
              <li><strong>No Food or Drinks:</strong> Consuming food, drinking liquids, or chewing gum is strictly forbidden to prevent accidental chemical ingestion.</li>
              <li><strong>No Mouth Pipetting:</strong> Never draw liquids into a pipette using mouth suction. Always employ rubber bulbs or mechanical pipettors.</li>
              <li><strong>No Sniffing:</strong> Do not smell chemical vapors directly. Gently waft the fumes toward your nose with your hand if necessary.</li>
              <li><strong>No Unattended Heating:</strong> Never leave Bunsen burners, boiling setups, or hot plates unattended while they are powered on.</li>
              <li><strong>No Chemical Sink Disposal:</strong> Never pour organic solvents, heavy metals, or corrosive materials down standard sinks. Use designated waste disposal drums.</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  } else if (safetyActiveSubTab === 'requisition') {
    subTabContent = `
      <div style="animation: fadeIn 0.25s ease;">
        <!-- Mandatory 3-Day Notice Policy Info -->
        <div class="example-box" style="border-left-color: var(--incorrect); background: rgba(239, 68, 68, 0.03); margin-bottom: 25px; padding: 18px; border-radius: 12px;">
          <div class="example-title" style="color: #ef4444; font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif; display: flex; align-items: center; gap: 6px;">
            <span>⚠️</span> MANDATORY 3-DAY NOTICE POLICY
          </div>
          <p style="font-size: 13px; line-height: 1.6; margin: 8px 0 0 0; color: var(--text-main);">
            Requisitions for reagents, chemicals, apparatus, or specific instruments must be submitted <strong>at least three (3) working days prior</strong> to the scheduled laboratory schedule. Late submissions will not be accepted or prepared by the custodian staff.
          </p>
          <div style="margin-top: 12px; font-size: 12.5px; color: var(--text-muted); line-height: 1.5;">
            <strong>Why is this rule strictly enforced?</strong>
            <ul style="margin: 5px 0 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
              <li><strong>Reagent Prep & Standardizations:</strong> Technical staff must prepare, titrate, and standardize solutions (e.g. HCl, NaOH) to guarantee concentration accuracy.</li>
              <li><strong>Inventory & Chemical Compatibility:</strong> Restocking, inspecting chemical expiration records, and verifying chemical compatibility for safety layouts takes time.</li>
              <li><strong>Apparatus Calibration:</strong> Technical instruments, analytical balances, and glassware must be cleaned, tested, and cataloged for student groups.</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  } else if (safetyActiveSubTab === 'form') {
    subTabContent = `
      <div style="animation: fadeIn 0.25s ease;">
        <!-- Requisition Steps -->
        <div class="dashboard-stat-card" style="text-align: left; background: var(--bg-card); padding: 20px; border-radius: 14px; border: 1px solid var(--border-card); margin-bottom: 25px;">
          <h3 style="margin-top: 0; font-size: 16px; font-family: 'Outfit', sans-serif; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <span>📝</span> Requisition Form Guidelines
          </h3>
          <p style="font-size: 12.5px; color: var(--text-muted); margin-bottom: 15px;">Follow this step-by-step procedure to ensure your chemistry materials are approved and prepared:</p>
          
          <ol style="font-size: 13px; line-height: 1.7; padding-left: 20px; display: flex; flex-direction: column; gap: 10px; color: var(--text-main);">
            <li><strong>Secure the Official Form:</strong> Pick up a paper Requisition Form from the Department of Chemistry clerk office or download and print the official template from the department portal.</li>
            <li><strong>Header Details:</strong> Fill out the subject name, section, group number, experiment title/number, date of experiment, and names of all group members.</li>
            <li><strong>Chemical Ledger Specification:</strong> List chemical reagents required. You must specify:
              <ul style="margin: 2px 0 0 0; padding-left: 18px; font-size: 12px; color: var(--text-muted);">
                <li>The IUPAC chemical name (do not write shorthand or codes).</li>
                <li>The desired concentration (e.g., 0.1 M, 6 M, 98%).</li>
                <li>The precise volume or mass required (e.g., 250 mL, 10.0 g).</li>
              </ul>
            </li>
            <li><strong>Apparatus Ledger Specification:</strong> List glassware, instruments, and accessories. Specify descriptions and quantities (e.g., "50 mL burette (Class A) — 1 pc", "250 mL beaker — 4 pcs").</li>
            <li><strong>Instructor Endorsement:</strong> Present the completed form to your lab instructor for verification and signature. The laboratory custodian will refuse any unsigned requisition sheets.</li>
            <li><strong>Submission & Verification:</strong> Deliver the signed form to the laboratory custodian at least 3 working days prior to your lab schedule. Make sure they log it and sign your receiving copy.</li>
          </ol>
        </div>

        <!-- Sample Ledger Card -->
        <div class="module-card" style="flex-direction: column; align-items: stretch; padding: 18px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-card);">
          <h3 style="font-size: 14.5px; margin-top: 0; font-family: 'Outfit', sans-serif; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <span>📋</span> Correct Ledger Entry Example
          </h3>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: -5px; margin-bottom: 12px;">Examples of proper chemical and apparatus descriptions on the form:</p>
          
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px; text-align: left;">
              <thead>
                <tr style="border-bottom: 1.5px solid var(--border-card); color: var(--text-muted);">
                  <th style="padding: 6px 4px;">Item Category</th>
                  <th style="padding: 6px 4px;">Description / Specification</th>
                  <th style="padding: 6px 4px;">Concentration</th>
                  <th style="padding: 6px 4px;">Quantity Needed</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid var(--border-card);">
                  <td style="padding: 8px 4px; font-weight: 600;">Reagent (Chemical)</td>
                  <td style="padding: 8px 4px;">Sodium Hydroxide (NaOH)</td>
                  <td style="padding: 8px 4px;">0.100 M (A.R. Grade)</td>
                  <td style="padding: 8px 4px;">500 mL</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-card);">
                  <td style="padding: 8px 4px; font-weight: 600;">Reagent (Chemical)</td>
                  <td style="padding: 8px 4px;">Hydrochloric Acid (HCl)</td>
                  <td style="padding: 8px 4px;">6.0 M</td>
                  <td style="padding: 8px 4px;">150 mL</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-card);">
                  <td style="padding: 8px 4px; font-weight: 600;">Glassware</td>
                  <td style="padding: 8px 4px;">Volumetric Flask</td>
                  <td style="padding: 8px 4px;">N/A (Size: 250 mL)</td>
                  <td style="padding: 8px 4px;">2 pcs</td>
                </tr>
                <tr>
                  <td style="padding: 8px 4px; font-weight: 600;">Glassware</td>
                  <td style="padding: 8px 4px;">Burette with Teflon Stopcock</td>
                  <td style="padding: 8px 4px;">N/A (Size: 50 mL)</td>
                  <td style="padding: 8px 4px;">1 pc</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  viewport.innerHTML = `
    <div class="safety-guide-container" style="animation: fadeIn 0.3s ease;">
      <h2>🥽 Chemistry Lab Safety Protocols & Regulations</h2>
      <p style="margin-top:-10px; color:var(--text-muted); font-size:14px; margin-bottom: 25px;">
        Department of Chemistry Laboratory Policy Manual.
      </p>

      <!-- Sub Navigation Tabs -->
      <div style="display: flex; gap: 8px; margin-bottom: 22px; background: rgba(255,255,255,0.02); padding: 5px; border-radius: 10px; border: 1px solid var(--border-card);">
        <button onclick="setSafetySubTab('conduct')" style="${tabBtnStyle('conduct')}">🥽 Conduct & PPE</button>
        <button onclick="setSafetySubTab('requisition')" style="${tabBtnStyle('requisition')}">🗓️ Requisition Policy</button>
        <button onclick="setSafetySubTab('form')" style="${tabBtnStyle('form')}">📝 Form Guide</button>
      </div>

      <!-- Tab Content Area -->
      <div id="safety-sub-tab-content">
        ${subTabContent}
      </div>
    </div>
  `;
}

function setSafetySubTab(tab) {
  safetyActiveSubTab = tab;
  playSFX(true);
  renderSafetyView();
}

// ==========================================================================
// VIEW 2: LECTURE NOTES (PDF DOWNLOAD & VIEWING)
// ==========================================================================
function renderLectureNotesView() {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);

  if (!activeCourse) {
    viewport.innerHTML = `<div class="empty-playlist-msg">No course selected</div>`;
    return;
  }

  // If we already have fetched notes list for this session, render it immediately
  if (githubLectureNotes !== null) {
    renderLectureNotesWithFiles(githubLectureNotes);
    return;
  }

  // Otherwise, render a loading state and fetch from GitHub REST API
  viewport.innerHTML = `
    <h2>📚 Course Lecture Notes & Handouts</h2>
    <p style="margin-top:-10px; color:var(--text-muted); font-size: 14px; margin-bottom: 20px; line-height: 1.5;">
      Access active handouts for your schedule, past semester archives, and upcoming previews. Handouts will be available as soon as the faculty uploads them.
    </p>
    <div class="empty-playlist-msg" style="display:flex; flex-direction:column; gap:12px; align-items:center; padding: 40px 20px;">
      <div style="border: 3px solid rgba(255,255,255,0.1); border-radius: 50%; border-top: 3px solid var(--accent); width: 28px; height: 28px; animation: spin 1s linear infinite; margin-bottom: 8px;"></div>
      <span>Checking uploaded lecture notes on GitHub...</span>
    </div>
    <style>
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    </style>
  `;

  fetch(`https://api.github.com/repos/iammoondae/doclearninghub/contents/courses/${currentCourseId}/lecturenotes`)
    .then(res => {
      if (!res.ok) throw new Error("GitHub API failed");
      return res.json();
    })
    .then(files => {
      githubLectureNotes = Array.isArray(files) ? files : [];
      renderLectureNotesWithFiles(githubLectureNotes);
    })
    .catch(err => {
      console.error("Failed to fetch GitHub files, falling back to manifest checklist:", err);
      renderLectureNotesFallback();
    });
}

function getCustomMaterialsHTML() {
  if (currentUserRole !== 'student') return '';
  const classData = activeStudentClassData[currentCourseId];
  if (!classData || !classData.customMaterials || classData.customMaterials.length === 0) return '';
  
  let html = `
    <div style="margin-top: 25px; border-top: 1px dashed var(--border-card); padding-top: 20px;">
      <h3 style="font-family: 'Outfit', sans-serif; font-size: 16px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; text-align: left;">
        <span>📎</span> Additional Classroom Resources (Faculty Uploaded)
      </h3>
      <div class="module-list" style="display:flex; flex-direction:column; gap:12px;">
  `;
  
  classData.customMaterials.forEach(mat => {
    html += `
      <div class="module-card" style="border-left: 4px solid var(--active-subject-color, #0ea5e9);">
        <div class="module-info" style="text-align:left;">
          <span class="module-title" style="font-weight:700;">${mat.name}</span>
          <span class="module-desc">Posted on: ${new Date(mat.createdAt).toLocaleDateString()}</span>
        </div>
        <div class="module-actions">
          <button class="pdf-action-btn" style="background:#475569;" onclick="exportPDFExternally('${mat.url}')">📤 Download</button>
        </div>
      </div>
    `;
  });
  
  html += `
      </div>
    </div>
  `;
  return html;
}

function renderLectureNotesWithFiles(files) {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);
  if (!activeCourse) return;

  const pdfFiles = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));

  let html = `
    <h2>📚 Course Lecture Notes & Handouts</h2>
    <p style="margin-top:-10px; color:var(--text-muted); font-size: 14px; margin-bottom: 20px; line-height: 1.5;">
      Access active handouts for your schedule, past semester archives, and upcoming previews. Handouts will be available as soon as the faculty uploads them.
    </p>
    
    <div id="pdf-inapp-viewer-box" style="display: none;"></div>
    <div class="module-list">
  `;

  if (pdfFiles.length === 0) {
    html += `
      <div class="empty-playlist-msg" style="text-align: center; padding: 40px 20px; border: 1px dashed var(--border-card); border-radius: 16px; background: rgba(255,255,255,0.01); width: 100%;">
        <p style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 8px;">
          📂 No lecture notes or handouts found
        </p>
        <p style="font-size: 13.5px; color: var(--text-muted); margin-bottom: 20px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.5;">
          Please wait while the assigned faculty uploads the files or contact the faculty through email.
        </p>
        <a href="mailto:${activeCourse.faculty ? activeCourse.faculty.split(' | ')[1] : 'ramon.eduque@msugensan.edu.ph'}" class="settings-btn-primary" style="display: inline-flex; width: auto; align-items: center; gap: 8px; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600;">
          ✉️ Contact Faculty (${activeCourse.faculty ? activeCourse.faculty.split(' | ')[0] : 'Faculty'})
        </a>
      </div>
    `;
  } else {
    pdfFiles.forEach(file => {
      // Find matching module in manifest
      const matchedModule = activeCourse.modules.find(m => {
        if (!m.pdfUrl) return false;
        const parts = m.pdfUrl.split('/');
        const manifestFilename = parts[parts.length - 1].toLowerCase();
        return manifestFilename === file.name.toLowerCase();
      });

      let title = '';
      let desc = '';
      if (matchedModule) {
        title = matchedModule.title + " Notes";
        desc = matchedModule.desc || "Current active syllabus chapter handouts";
      } else {
        // clean up file name for additional resources
        let cleanedName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
        title = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
        desc = "Supplementary Course Resource / Handout";
      }

      const sizeFormatted = file.size ? (file.size / (1024 * 1024)).toFixed(2) + " MB" : "N/A";
      const downloadUrl = file.download_url || `https://raw.githubusercontent.com/iammoondae/doclearninghub/main/courses/${currentCourseId}/lecturenotes/${encodeURIComponent(file.name)}`;

      let completionHTML = '';
      if (matchedModule && currentUserRole === 'student') {
        const isDone = currentUser.completedMaterials && currentUser.completedMaterials.includes(matchedModule.id);
        completionHTML = `
          <label style="display:flex; align-items:center; gap:6px; margin-top:10px; font-size:12.5px; font-weight:600; cursor:pointer; text-align:left;">
            <input type="checkbox" onchange="toggleMaterialCompleted('${matchedModule.id}', this.checked)" ${isDone ? 'checked' : ''} style="accent-color:var(--active-subject-color, #0ea5e9);">
            Mark Notes as Completed
          </label>
        `;
      }

      html += `
        <div class="module-card" style="flex-direction:column; align-items:stretch;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">
            <div class="module-info" style="text-align:left; flex:1;">
              <span class="module-title">${title}</span>
              <span class="module-desc">${desc}</span>
              <span style="font-size: 11px; color: var(--text-muted); margin-top: 5px; display:block;">File size: ${sizeFormatted} • Source: GitHub Repository</span>
            </div>
            <div class="module-actions" style="flex-shrink:0; display:flex; gap:8px;">
              <button class="pdf-action-btn" style="background:#475569;" onclick="exportPDFExternally('${downloadUrl}')">📤 Download</button>
            </div>
          </div>
          ${completionHTML}
        </div>
      `;
    });
  }

  html += `</div>`;
  html += getCustomMaterialsHTML();
  viewport.innerHTML = html;
  renderChemistrySymbols(viewport);
}

function renderLectureNotesFallback() {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);
  if (!activeCourse) return;

  let html = `
    <h2>📚 Course Lecture Notes & Handouts</h2>
    <p style="margin-top:-10px; color:var(--text-muted); font-size: 14px; margin-bottom: 20px; line-height: 1.5;">
      Access active handouts for your schedule, past semester archives, and upcoming previews. Handouts will be available as soon as the faculty uploads them.
    </p>
    
    <div id="pdf-inapp-viewer-box" style="display: none;"></div>
    <div class="module-list">
  `;

  activeCourse.modules.forEach(m => {
    let completionHTML = '';
    if (currentUserRole === 'student') {
      const isDone = currentUser.completedMaterials && currentUser.completedMaterials.includes(m.id);
      completionHTML = `
        <label style="display:flex; align-items:center; gap:6px; margin-top:10px; font-size:12.5px; font-weight:600; cursor:pointer; text-align:left;">
          <input type="checkbox" onchange="toggleMaterialCompleted('${m.id}', this.checked)" ${isDone ? 'checked' : ''} style="accent-color:var(--active-subject-color, #0ea5e9);">
          Mark Notes as Completed
        </label>
      `;
    }

    html += `
      <div class="module-card" id="note-card-${m.id}" style="flex-direction:column; align-items:stretch;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:16px;">
          <div class="module-info" style="text-align:left; flex:1;">
            <span class="module-title">${m.title} Notes</span>
            <span class="module-desc">Current active syllabus chapter handouts</span>
            <span style="font-size: 11px; color: var(--text-muted); margin-top: 5px; display:block;">File size: ${m.pdfSize || 'N/A'} • Source: Faculty Server</span>
          </div>
          <div class="module-actions" id="note-actions-${m.id}" style="flex-shrink:0; display:flex; gap:8px;">
            <button class="pdf-action-btn" style="background:#475569;" onclick="exportPDFExternally('${m.pdfUrl}')">📤 Download</button>
          </div>
        </div>
        ${completionHTML}
      </div>
    `;
  });
  html += `</div>`;
  html += getCustomMaterialsHTML();

  viewport.innerHTML = html;
  renderChemistrySymbols(viewport);

  // Asynchronously verify each file availability in background
  activeCourse.modules.forEach(async (m) => {
    const exists = await checkFileExists(m.pdfUrl);
    if (!exists) {
      const actionsDiv = document.getElementById(`note-actions-${m.id}`);
      if (actionsDiv) {
        actionsDiv.innerHTML = `
          <span style="font-size: 12.5px; color: var(--incorrect); font-weight: 500; display: block; margin-top: 5px; line-height: 1.4;">
            ⚠️ Please wait while the assigned faculty uploads the files or contact the faculty through email.
          </span>
        `;
      }
    }
  });
}

function viewPDFInApp(pdfUrl, title) {
  playSFX(true);
  let targetUrl = pdfUrl;
  if (pdfUrl && pdfUrl.includes('raw.githubusercontent.com')) {
    let newUrl = pdfUrl.replace('raw.githubusercontent.com', 'github.com');
    targetUrl = newUrl.replace(/(github\.com\/[^/]+\/[^/]+)\/([^/]+)\/(.*)/, '$1/blob/$2/$3');
  }
  window.open(targetUrl, '_blank');
}

function exportPDFExternally(pdfUrl) {
  playSFX(true);
  window.open(pdfUrl, '_blank');
}

// ==========================================================================
// VIEW 3: ASSESSMENTS (IN-APP QUIZ & GOOGLE FORMS ASSIGNMENTS)
// ==========================================================================
function renderAssessmentsView() {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);

  if (!activeCourse) {
    viewport.innerHTML = `<div class="empty-playlist-msg">No course selected</div>`;
    return;
  }

  let html = `
    <h2>✍️ Quizzes & Assignments</h2>
    <p style="margin-top:-10px; color:var(--text-muted); font-size:14px; margin-bottom: 15px;">
      Complete module quizzes natively inside the app or submit assignments via pre-populated Google Forms.
    </p>
    <div style="margin-bottom: 20px; padding: 12px; border-radius: 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">⚠️</span>
      <span style="font-size: 12.5px; font-weight: 600; color: var(--incorrect, #ef4444);">Important Notice: Quiz retakes are strictly prohibited once submitted. Please review your answers carefully before starting.</span>
    </div>
    
    <div class="module-list">
  `;

  activeCourse.modules.forEach(m => {
    const quizSched = isQuizScheduled(m);
    const assignSched = isAssignScheduled(m);
    if (!quizSched && !assignSched) {
      return; // Skip this module entirely
    }

    let quizSectionHTML = '';
    const hasQuiz = quizSched && m.quiz && m.quiz.questions && m.quiz.questions.length > 0;
    
    if (hasQuiz) {
      const savedScore = localStorage.getItem(`quiz_score_${currentUser.email}_${m.id}`);
      const savedMax = localStorage.getItem(`quiz_max_${currentUser.email}_${m.id}`);
      
      // Progressive gating check
      const isLocked = currentUserRole === 'student' && 
                      (!currentUser.completedMaterials || !currentUser.completedMaterials.includes(m.id));

      if (savedScore !== null) {
        quizSectionHTML = `
          <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius: 8px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2);">
            <span style="font-size: 13px; font-weight: 600; color: var(--correct);">✅ Completed Quiz Grade: ${savedScore}/${savedMax}</span>
          </div>
        `;
      } else if (isLocked) {
        quizSectionHTML = `
          <div style="margin-top: 10px; padding: 12px; border-radius: 8px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); text-align: center; font-size: 13px; font-weight: 600; color: var(--incorrect);">
            🔒 Complete Module Lecture Notes to unlock this quiz
          </div>
        `;
      } else {
        quizSectionHTML = `
          <button class="restart-btn" style="margin-top: 10px; width: 100%; padding: 12px; margin-bottom: 0;" onclick="startQuizRunner('${m.id}')">
            ✍️ Start Module Quiz
          </button>
        `;
      }
    }

    let assignmentSectionHTML = '';
    const hasPreparedForm = assignSched && m.assignment && m.assignment.formUrl && 
      !m.assignment.formUrl.includes('placeholder') && 
      !m.assignment.formUrl.includes('FAIpQLSdBPboeAx5IznV5KF_1hp66RX7sSYYNv0xg7NpfowWafK-0GQ') &&
      m.assignment.formUrl.trim() !== '';

    if (hasPreparedForm) {
      const isDone = localStorage.getItem(`assignment_submitted_${currentUser.email}_${m.id}`) === 'true';
      assignmentSectionHTML = `
        <div style="margin-top: 15px; border-top: 1px dashed var(--border-card); padding-top: 12px;">
          <span style="font-weight: 700; font-size: 13.5px; color: var(--text-main); display: block;">📂 Performance Assignment: ${m.assignment.title}</span>
          <p style="font-size: 12px; color: var(--text-muted); margin: 4px 0 10px 0;">${m.assignment.desc}</p>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button class="pdf-action-btn" onclick="openAssignmentForm('${m.id}', '${m.assignment.formUrl}')">🔗 Open Google Form</button>
            <label class="toggle-container" style="padding: 6px 12px; margin-top: 0; background: rgba(255,255,255,0.02);">
              <input type="checkbox" id="assign-check-${m.id}" ${isDone ? 'checked' : ''} onchange="toggleAssignmentStatus('${m.id}', this.checked)">
              <div class="toggle-slider"></div>
              <span style="font-size:12px;">Mark Completed</span>
            </label>
          </div>
        </div>
      `;
    }

    html += `
      <div class="module-card" id="assessment-card-${m.id}" style="flex-direction: column; align-items: stretch; gap: 10px;">
        <div class="module-info">
          <span class="module-title">${m.title} Quizzes & Assignments</span>
          <span class="module-desc">Course requirements to complete for this unit</span>
        </div>
        ${quizSectionHTML}
        ${assignmentSectionHTML}
      </div>
    `;
  });

  html += `</div>`;

  // Merge classroom-specific custom quizzes
  const classData = activeStudentClassData[currentCourseId];
  if (classData && classData.customQuizzes && classData.customQuizzes.length > 0) {
    let hasCustomScheduled = false;
    let customHtml = `
      <div style="margin-top: 30px;">
        <h3 style="font-family:'Outfit',sans-serif; font-size:16px; margin-bottom:12px; border-bottom:1px dashed var(--border-color); padding-bottom:8px; text-align:left;">📋 Custom Classroom Exams</h3>
        <div class="module-list">
    `;

    classData.customQuizzes.forEach(cq => {
      const isSched = classData.scheduledQuizzes && classData.scheduledQuizzes.includes(cq.id);
      if (!isSched) return;

      hasCustomScheduled = true;
      let quizSectionHTML = '';
      
      const savedScore = localStorage.getItem(`quiz_score_${currentUser.email}_${cq.id}`);
      const savedMax = localStorage.getItem(`quiz_max_${currentUser.email}_${cq.id}`);
      
      if (savedScore !== null) {
        quizSectionHTML = `
          <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius: 8px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2);">
            <span style="font-size: 13px; font-weight: 600; color: var(--correct);">✅ Completed Quiz Grade: ${savedScore}/${savedMax}</span>
          </div>
        `;
      } else {
        quizSectionHTML = `
          <button class="restart-btn" style="margin-top: 10px; width: 100%; padding: 12px; margin-bottom: 0;" onclick="startCustomQuizRunner('${cq.id}')">
            ✍️ Start Custom Quiz
          </button>
        `;
      }

      let timeLimitStr = '';
      if (cq.timeLimitSeconds) {
        timeLimitStr = `${Math.round(cq.timeLimitSeconds / 60)} mins`;
      } else {
        const hasQuestionTimers = cq.questions.some(q => q.timeLimitSeconds);
        if (hasQuestionTimers) {
          timeLimitStr = '⚡ Timed Questions (Auto-Advances / Cannot Move Back)';
        } else {
          timeLimitStr = 'Untimed';
        }
      }

      customHtml += `
        <div class="module-card" id="assessment-card-${cq.id}" style="flex-direction: column; align-items: stretch; gap: 10px;">
          <div class="module-info" style="text-align:left;">
            <span class="module-title" style="font-weight:700;">${cq.title}</span>
            <span class="module-desc">Questions: ${cq.questions.length} | Time Limit: ${timeLimitStr}</span>
          </div>
          ${quizSectionHTML}
        </div>
      `;
    });

    customHtml += `</div></div>`;
    if (hasCustomScheduled) {
      html += customHtml;
    }
  }

  viewport.innerHTML = html;
  renderChemistrySymbols(viewport);
}

function openAssignmentForm(modId, formUrl) {
  playSFX(true);
  logRecordToSheets(modId, "Opened Form", 0, 0, "assignment");
  window.open(formUrl, '_blank');
}

function toggleAssignmentStatus(modId, checked) {
  playSFX(checked);
  localStorage.setItem(`assignment_submitted_${currentUser.email}_${modId}`, checked ? 'true' : 'false');
  
  if (checked) {
    logRecordToSheets(modId, "Self-Marked Complete", 1, 1, "assignment");
  }
}

// ==========================================================================
// IN-APP QUIZ RUNNER ENGINE
// ==========================================================================
function startQuizRunner(moduleId) {
  playSFX(true);
  
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);
  if (!activeCourse) return;

  const targetModule = activeCourse.modules.find(m => m.id === moduleId);
  if (!targetModule || !targetModule.quiz) return;

  // Strict check to prevent quiz retakes
  const savedScore = localStorage.getItem(`quiz_score_${currentUser.email}_${moduleId}`);
  if (savedScore !== null) {
    alert("You have already completed this quiz. Retakes are not allowed.");
    return;
  }

  // Progressive gating check
  if (currentUserRole === 'student') {
    const isLocked = !currentUser.completedMaterials || !currentUser.completedMaterials.includes(moduleId);
    if (isLocked) {
      alert("This quiz is locked. Please complete the corresponding module lecture notes first.");
      return;
    }
  }

  activeQuizModule = targetModule;
  activeQuizData = targetModule.quiz;
  currentQuestionIndex = 0;
  quizScore = 0;
  quizAnswers = [];
  wrongAnswersLog = [];

  // Setup UI elements for quiz mode
  document.getElementById('view-meta').style.display = 'flex';
  document.getElementById('slide-mode-label').innerText = 'Module Quiz Mode';
  document.getElementById('slide-num-label').innerText = `Question 1 of ${activeQuizData.questions.length}`;
  document.getElementById('progress-bar').style.width = '0%';
  const progContainer = document.getElementById('progress-container');
  if (progContainer) progContainer.style.display = 'block';

  // Setup Timer if configured
  if (activeQuizData.timeLimitSeconds) {
    quizSecondsLeft = activeQuizData.timeLimitSeconds;
    startQuizTimer();
  }

  renderQuizQuestion();
}

function startQuizTimer() {
  clearInterval(quizTimerInterval);
  quizTimerInterval = setInterval(() => {
    quizSecondsLeft--;
    if (quizSecondsLeft <= 0) {
      clearInterval(quizTimerInterval);
      submitQuizResults();
    } else {
      updateQuizTimerUI();
    }
  }, 1000);
  updateQuizTimerUI();
}

function updateQuizTimerUI() {
  const mins = Math.floor(quizSecondsLeft / 60);
  const secs = quizSecondsLeft % 60;
  const timerStr = `⏱️ ${mins}:${secs.toString().padStart(2, '0')}`;
  document.getElementById('slide-mode-label').innerText = `Quiz Mode — ${timerStr}`;
}

function startQuestionTimer(limit) {
  clearInterval(questionTimerInterval);
  questionSecondsLeft = limit;
  
  updateQuestionTimerDetailsUI();
  
  questionTimerInterval = setInterval(() => {
    questionSecondsLeft--;
    if (questionSecondsLeft <= 0) {
      clearInterval(questionTimerInterval);
      handleQuestionTimeout();
    } else {
      updateQuestionTimerDetailsUI();
    }
  }, 1000);
}

function updateQuestionTimerDetailsUI() {
  const label = document.getElementById('slide-mode-label');
  if (label) {
    label.innerText = `Quiz Mode — Question Timer: ${questionSecondsLeft}s ⚠️`;
  }
  const qTimerBadge = document.getElementById('question-timer-badge');
  if (qTimerBadge) {
    qTimerBadge.innerText = `${questionSecondsLeft}s`;
    if (questionSecondsLeft <= 3) {
      qTimerBadge.style.background = 'var(--incorrect)';
    } else {
      qTimerBadge.style.background = 'rgba(255,255,255,0.1)';
    }
  }
}

function handleQuestionTimeout() {
  playSFX(false);
  const question = activeQuizData.questions[currentQuestionIndex];
  
  // Log answer as incorrect/unanswered
  logAnswer(null, "Timed Out (Unanswered)", false);
  
  // If MCQ or TF, show correct answers briefly, then advance
  const btns = document.querySelectorAll('.choice-btn');
  btns.forEach(btn => btn.disabled = true);
  
  if (question.type === 'mc') {
    if (btns[question.answer]) {
      btns[question.answer].classList.add('correct');
    }
  } else if (question.type === 'tf') {
    const correctBtnIdx = question.answer ? 0 : 1;
    if (btns[correctBtnIdx]) {
      btns[correctBtnIdx].classList.add('correct');
    }
  } else if (question.type === 'id') {
    const inputEl = document.getElementById('identification-answer-field');
    if (inputEl) {
      inputEl.disabled = true;
      inputEl.value = `Timed Out! (Correct: ${question.answer})`;
      inputEl.style.color = 'var(--incorrect)';
    }
  }
  
  setTimeout(() => {
    advanceQuiz();
  }, 1500);
}

function renderQuizQuestion() {
  const viewport = document.getElementById('viewport-body');
  const question = activeQuizData.questions[currentQuestionIndex];
  
  // Clear any active question-level timer
  clearInterval(questionTimerInterval);
  
  // Update Header progress
  const pct = Math.round((currentQuestionIndex / activeQuizData.questions.length) * 100);
  document.getElementById('progress-bar').style.width = `${pct}%`;
  document.getElementById('slide-num-label').innerText = `Question ${currentQuestionIndex + 1} of ${activeQuizData.questions.length}`;

  let timerBadgeHTML = '';
  if (question.timeLimitSeconds) {
    timerBadgeHTML = `
      <div id="question-timer-badge" style="position: absolute; top: 15px; right: 15px; background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 13px; font-family: monospace; transition: background 0.3s ease;">
        ${question.timeLimitSeconds}s
      </div>
    `;
  }

  let contentHTML = `
    <div class="question-container" style="position: relative;">
      ${timerBadgeHTML}
      <h2>${activeQuizData.title}</h2>
      <p class="question-text">${currentQuestionIndex + 1}. ${question.question}</p>
  `;

  if (question.type === 'mc') {
    // Multiple Choice
    contentHTML += `<div class="choices-grid">`;
    question.choices.forEach((choice, idx) => {
      contentHTML += `
        <button class="choice-btn" onclick="selectQuizChoice(${idx})">
          <span>${choice}</span>
        </button>
      `;
    });
    contentHTML += `</div>`;
  } else if (question.type === 'tf') {
    // True/False
    contentHTML += `
      <div class="choices-grid" style="grid-template-columns: 1fr 1fr;">
        <button class="choice-btn" onclick="selectQuizTF(true)" style="text-align: center;">🟢 True</button>
        <button class="choice-btn" onclick="selectQuizTF(false)" style="text-align: center;">🔴 False</button>
      </div>
    `;
  } else if (question.type === 'id') {
    // Identification input
    contentHTML += `
      <div class="blank-input-wrapper">
        <input type="text" class="blank-input" id="identification-answer-field" placeholder="Type answer here..." autofocus autocomplete="off">
        <button class="blank-submit-btn" onclick="submitQuizIdentification()">Submit</button>
      </div>
    `;
  }

  contentHTML += `</div>`;
  viewport.innerHTML = contentHTML;
  renderChemistrySymbols(viewport);
  updatePeriodicTableButtonVisibility();

  // Start question timer if configured
  if (question.timeLimitSeconds) {
    startQuestionTimer(question.timeLimitSeconds);
  }
}

function selectQuizChoice(choiceIndex) {
  clearInterval(questionTimerInterval);
  const question = activeQuizData.questions[currentQuestionIndex];
  const isCorrect = choiceIndex === question.answer;

  logAnswer(choiceIndex, question.choices[choiceIndex], isCorrect);
  highlightAnswers(choiceIndex, question.answer, 'mc');
}

function selectQuizTF(tfValue) {
  clearInterval(questionTimerInterval);
  const question = activeQuizData.questions[currentQuestionIndex];
  const isCorrect = tfValue === question.answer;

  logAnswer(tfValue, tfValue ? "True" : "False", isCorrect);
  highlightAnswers(tfValue, question.answer, 'tf');
}

function submitQuizIdentification() {
  const inputEl = document.getElementById('identification-answer-field');
  if (!inputEl) return;

  const textVal = inputEl.value.trim();
  if (textVal === '') {
    alert("Please enter a response.");
    return;
  }

  clearInterval(questionTimerInterval);
  const question = activeQuizData.questions[currentQuestionIndex];
  const isCorrect = textVal.toLowerCase() === question.answer.toLowerCase();

  logAnswer(textVal, textVal, isCorrect);
  
  // Identification immediately moves forward
  advanceQuiz();
}

function logAnswer(rawValue, displayValue, isCorrect) {
  const question = activeQuizData.questions[currentQuestionIndex];
  quizAnswers.push({
    raw: rawValue,
    display: displayValue,
    correct: isCorrect
  });

  if (isCorrect) {
    quizScore++;
    playSFX(true);
  } else {
    playSFX(false);
    wrongAnswersLog.push({
      question: question.question,
      yourAnswer: displayValue,
      correctAnswer: question.type === 'mc' ? question.choices[question.answer] : String(question.answer)
    });
  }
}

function highlightAnswers(selectedIdx, correctIdx, type) {
  // Disable all choice buttons to prevent double clicking
  const btns = document.querySelectorAll('.choice-btn');
  btns.forEach(btn => btn.disabled = true);

  if (type === 'mc') {
    btns[selectedIdx].classList.add(selectedIdx === correctIdx ? 'correct' : 'incorrect');
    if (selectedIdx !== correctIdx) {
      btns[correctIdx].classList.add('correct');
    }
  } else if (type === 'tf') {
    const selectedBool = selectedIdx; // true/false
    const correctBool = correctIdx; // true/false

    // True button is index 0, False is index 1
    const selectedBtnIdx = selectedBool ? 0 : 1;
    const correctBtnIdx = correctBool ? 0 : 1;

    btns[selectedBtnIdx].classList.add(selectedBool === correctBool ? 'correct' : 'incorrect');
    if (selectedBool !== correctBool) {
      btns[correctBtnIdx].classList.add('correct');
    }
  }

  setTimeout(() => {
    advanceQuiz();
  }, 1000);
}

function advanceQuiz() {
  currentQuestionIndex++;
  if (currentQuestionIndex < activeQuizData.questions.length) {
    renderQuizQuestion();
  } else {
    submitQuizResults();
  }
}

function submitQuizResults() {
  clearInterval(quizTimerInterval);
  clearInterval(questionTimerInterval);
  playSFX(true);

  const dateStr = new Date().toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
  localStorage.setItem(`quiz_score_${currentUser.email}_${activeQuizModule.id}`, quizScore);
  localStorage.setItem(`quiz_max_${currentUser.email}_${activeQuizModule.id}`, activeQuizData.questions.length);
  localStorage.setItem(`quiz_date_${currentUser.email}_${activeQuizModule.id}`, dateStr);

  logRecordToSheets(activeQuizModule.id, activeQuizData.title, quizScore, activeQuizData.questions.length, "quiz");

  renderQuizSummary();
}

function renderQuizSummary() {
  // Clear headers
  document.getElementById('view-meta').style.display = 'none';
  document.getElementById('progress-bar').style.width = '0%';

  const viewport = document.getElementById('viewport-body');
  const pct = Math.round((quizScore / activeQuizData.questions.length) * 100);

  let reviewHTML = '';
  if (wrongAnswersLog.length > 0) {
    reviewHTML += `
      <div class="review-panel">
        <h3>🔍 Review Incorrect Answers</h3>
    `;
    wrongAnswersLog.forEach((item, idx) => {
      reviewHTML += `
        <div class="review-item">
          <p class="review-q">${idx + 1}. ${item.question}</p>
          <div class="review-ans-wrapper">
            <span>Your Answer: <strong class="review-your-ans">${item.yourAnswer}</strong></span>
            <span>Correct: <strong class="review-correct-ans">${item.correctAnswer}</strong></span>
          </div>
        </div>
      `;
    });
    reviewHTML += `</div>`;
  } else {
    reviewHTML += `
      <div class="review-panel">
        <div class="review-item correct-summary">
          🌟 Perfect Score! You answered every question correctly.
        </div>
      </div>
    `;
  }

  viewport.innerHTML = `
    <div class="summary-screen">
      <div class="score-circle">
        <span class="score-num">${quizScore}/${activeQuizData.questions.length}</span>
        <span class="score-label">Final Score</span>
      </div>
      <h2>Quiz Complete!</h2>
      <p style="margin-top:-10px; color:var(--text-muted); font-size:14px; margin-bottom: 20px;">
        Grade Score: ${pct}% • Submitted to central Google spreadsheet records.
      </p>

      <button class="restart-btn" onclick="setMode('assessments')">Back to Assessments</button>
      
      ${reviewHTML}
    </div>
  `;
  renderChemistrySymbols(viewport);
  updatePeriodicTableButtonVisibility();
}

function retakeQuiz(moduleId) {
  alert("Quiz retakes are not allowed.");
}

function exitQuizRunnerSilently() {
  clearInterval(quizTimerInterval);
  activeQuizModule = null;
  activeQuizData = null;
}

// ==========================================================================
// VIEW 4: MY PROGRESS VIEW
// ==========================================================================
function renderStudentProgressView() {
  const viewport = document.getElementById('viewport-body');
  
  let totalQuizzes = 0;
  let passedQuizzes = 0;
  let totalAssignments = 0;
  let passedAssignments = 0;

  // Compile overall details
  let courseProgressRowsHTML = '';
  // Only process courses enrolled/chosen by the student
  const enrolledCourses = manifestData.courses.filter(course => 
    currentUser && currentUser.subjects 
      ? currentUser.subjects.some(subKey => subKey.startsWith(course.id + '_')) 
      : false
  );

  enrolledCourses.forEach(course => {
    const classData = activeStudentClassData[course.id];
    let cQuizzes = course.modules.filter(m => m.quiz).length;
    let cPassedQuizzes = course.modules.filter(m => 
      localStorage.getItem(`quiz_score_${currentUser.email}_${m.id}`) !== null
    ).length;

    const cAssignments = course.modules.filter(m => m.assignment).length;
    const cPassedAssignments = course.modules.filter(m => 
      localStorage.getItem(`assignment_submitted_${currentUser.email}_${m.id}`) === 'true'
    ).length;

    // Add scheduled custom quizzes to this course's counts
    if (classData && classData.customQuizzes) {
      classData.customQuizzes.forEach(cq => {
        const isSched = classData.scheduledQuizzes && classData.scheduledQuizzes.includes(cq.id);
        if (isSched) {
          cQuizzes++;
          if (localStorage.getItem(`quiz_score_${currentUser.email}_${cq.id}`) !== null) {
            cPassedQuizzes++;
          }
        }
      });
    }

    totalQuizzes += cQuizzes;
    passedQuizzes += cPassedQuizzes;
    totalAssignments += cAssignments;
    passedAssignments += cPassedAssignments;

    const progressPct = (cQuizzes + cAssignments) > 0 
      ? Math.round(((cPassedQuizzes + cPassedAssignments) / (cQuizzes + cAssignments)) * 100) 
      : 0;

    courseProgressRowsHTML += `
      <div class="mastery-item" style="margin-bottom:15px; background:rgba(255,255,255,0.01); padding:10px; border-radius:10px; border:1px solid var(--border-card);">
        <div class="mastery-info" style="display:flex; justify-content:space-between; font-weight:600; margin-bottom:5px;">
          <span>${course.icon} ${course.name}</span>
          <span>${progressPct}% Complete</span>
        </div>
        <div class="mastery-bar-container" style="background:rgba(255,255,255,0.05); height:8px; border-radius:4px; overflow:hidden;">
          <div class="mastery-bar" style="width: ${progressPct}%; background: ${course.color}; height:100%; border-radius:4px;"></div>
        </div>
      </div>
    `;
  });

  // Compile quiz records history table
  let quizTableRows = '';
  enrolledCourses.forEach(course => {
    const classData = activeStudentClassData[course.id];
    
    // Manifest Quizzes
    course.modules.forEach(m => {
      if (m.quiz) {
        const score = localStorage.getItem(`quiz_score_${currentUser.email}_${m.id}`);
        const max = localStorage.getItem(`quiz_max_${currentUser.email}_${m.id}`);
        const date = localStorage.getItem(`quiz_date_${currentUser.email}_${m.id}`) || 'Not Taken';
        
        let status = '❌ Pending';
        let scoreDisplay = '-';
        if (score !== null) {
          scoreDisplay = `${score}/${max}`;
          const pass = (parseInt(score) / parseInt(max)) >= 0.6;
          status = pass ? '🟢 Passed' : '🟡 Needs Practice';
        }

        const topicName = m.title.includes(': ') ? m.title.split(': ')[1] : m.title;

        quizTableRows += `
          <tr>
            <td style="font-weight:600; padding:10px; border-bottom:1px solid var(--border-card);">${course.name}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border-card);">${m.title.replace("Module ", "Mod ")}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border-card);">${topicName}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border-card); text-align:center;">${scoreDisplay}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border-card); text-align:center;">${status}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border-card); text-align:center; color:var(--text-muted);">${date}</td>
          </tr>
        `;
      }
    });

    // Custom Quizzes
    if (classData && classData.customQuizzes) {
      classData.customQuizzes.forEach(cq => {
        const isSched = classData.scheduledQuizzes && classData.scheduledQuizzes.includes(cq.id);
        if (!isSched) return;

        const score = localStorage.getItem(`quiz_score_${currentUser.email}_${cq.id}`);
        const max = localStorage.getItem(`quiz_max_${currentUser.email}_${cq.id}`);
        const date = localStorage.getItem(`quiz_date_${currentUser.email}_${cq.id}`) || 'Not Taken';

        let status = '❌ Pending';
        let scoreDisplay = '-';
        if (score !== null) {
          scoreDisplay = `${score}/${max}`;
          const pass = (parseInt(score) / parseInt(max)) >= 0.6;
          status = pass ? '🟢 Passed' : '🟡 Needs Practice';
        }

        quizTableRows += `
          <tr>
            <td style="font-weight:600; padding:10px; border-bottom:1px solid var(--border-card);">${course.name}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border-card);">Exam</td>
            <td style="padding:10px; border-bottom:1px solid var(--border-card);">${cq.title}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border-card); text-align:center;">${scoreDisplay}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border-card); text-align:center;">${status}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border-card); text-align:center; color:var(--text-muted);">${date}</td>
          </tr>
        `;
      });
    }
  });

  if (quizTableRows === '') {
    quizTableRows = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No quizzes completed yet.</td></tr>`;
  }

  viewport.innerHTML = `
    <h2>📊 Student Performance & Academic Card</h2>
    <p style="margin-top:-10px; color:var(--text-muted); font-size:14px; margin-bottom: 20px;">
      Track your course completion ratios and grade books offline.
    </p>

    <div class="dashboard-grid">
      <div class="dashboard-stat-card">
        <div class="dashboard-stat-value">${passedQuizzes}/${totalQuizzes}</div>
        <div class="dashboard-stat-label">Quizzes Completed</div>
      </div>
      <div class="dashboard-stat-card">
        <div class="dashboard-stat-value">${passedAssignments}/${totalAssignments}</div>
        <div class="dashboard-stat-label">Assignments Marks</div>
      </div>
    </div>

    <div style="margin-top: 25px;">
      <h3 style="font-family: 'Outfit', sans-serif; font-size: 16px; margin-bottom: 12px;">📈 Course Progression</h3>
      ${courseProgressRowsHTML}
    </div>

    <div style="margin-top: 30px; background:var(--bg-card); border:1px solid var(--border-card); border-radius:14px; padding:15px; overflow-x:auto;">
      <h3 style="font-family: 'Outfit', sans-serif; font-size: 16px; margin-bottom: 12px;">📖 Quiz Grades Ledger</h3>
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:rgba(255,255,255,0.02); text-align:left; color:var(--text-muted);">
            <th style="padding:10px; font-weight:700;">Course</th>
            <th style="padding:10px; font-weight:700;">Module</th>
            <th style="padding:10px; font-weight:700;">Topic</th>
            <th style="padding:10px; font-weight:700; text-align:center;">Score</th>
            <th style="padding:10px; font-weight:700; text-align:center;">Status</th>
            <th style="padding:10px; font-weight:700; text-align:center;">Date</th>
          </tr>
        </thead>
        <tbody>
          ${quizTableRows}
        </tbody>
      </table>
    </div>
  `;
}

// ==========================================================================
// GOOGLE SHEETS / APPS SCRIPT WEB APP INTEGRATION
// ==========================================================================
function logRecordToSheets(modId, taskTitle, score, maxScore, mode) {
  if (!currentUser) return;

  const payload = {
    email: currentUser.email,
    studentId: currentUser.studentId,
    section: currentUser.subjects.join(', '),
    yearLevel: currentUser.year,
    courseId: currentCourseId,
    moduleId: modId,
    taskTitle: taskTitle,
    score: score,
    maxScore: maxScore,
    mode: mode,
    override: false,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  console.log("Submitting Score to Firestore:", payload);

  firestore.collection("scores").add(payload)
    .then((docRef) => {
      console.log("Score logged in Firestore successfully with ID:", docRef.id);
    })
    .catch((err) => {
      console.error("Firestore logging failed, saving locally:", err);
      payload.timestamp = new Date().toISOString();
      queueOfflineScore(payload);
    });
}

function queueOfflineScore(payload) {
  const offlineQueue = JSON.parse(localStorage.getItem('doc_lms_offline_scores') || '[]');
  offlineQueue.push(payload);
  localStorage.setItem('doc_lms_offline_scores', JSON.stringify(offlineQueue));
  
  // Toast notify
  console.log("Record queued locally (offline mode)");
}

function syncOfflineScores() {
  const offlineQueue = JSON.parse(localStorage.getItem('doc_lms_offline_scores') || '[]');
  if (offlineQueue.length === 0) return;

  console.log("Syncing offline scores queue to Firestore...");
  
  const promises = offlineQueue.map((payload, idx) => {
    payload.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    return firestore.collection("scores").add(payload)
      .then(() => {
        return idx;
      });
  });

  Promise.allSettled(promises).then(results => {
    const successIndices = [];
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        successIndices.push(r.value);
      }
    });

    // Remove successful items from queue
    const remaining = offlineQueue.filter((_, idx) => !successIndices.includes(idx));
    localStorage.setItem('doc_lms_offline_scores', JSON.stringify(remaining));
    console.log(`Synced ${successIndices.length} offline records successfully.`);
  });
}

// Trigger score syncing when app becomes online
window.addEventListener('online', syncOfflineScores);

// ==========================================================================
// INDEXEDDB BACKGROUND MUSIC COMPONENT
// ==========================================================================
function initMusicDB(callback) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = (e) => {
    const dbInst = e.target.result;
    if (!dbInst.objectStoreNames.contains('tracks')) {
      dbInst.createObjectStore('tracks', { keyPath: 'id', autoIncrement: true });
    }
  };
  request.onsuccess = (e) => {
    db = e.target.result;
    if (callback) callback();
  };
  request.onerror = (e) => {
    console.error("IndexedDB Open failed:", e.target.error);
    if (callback) callback();
  };
}

function loadPlaylistFromDB(callback) {
  if (!db) return;

  const transaction = db.transaction(['tracks'], 'readonly');
  const store = transaction.objectStore('tracks');
  const request = store.getAll();

  request.onsuccess = (e) => {
    musicPlaylist = e.target.result || [];
    renderTracklistUI();
    generatePlayOrder();
    
    // Update music player bar visibility
    const playerBar = document.getElementById('music-player-bar');
    if (playerBar) {
      playerBar.style.display = musicPlaylist.length > 0 ? 'flex' : 'none';
    }

    if (callback) callback();
  };
}

function renderTracklistUI() {
  const list = document.getElementById('playlist-tracks-list');
  if (!list) return;

  if (musicPlaylist.length === 0) {
    list.innerHTML = `<li class="empty-playlist-msg">No custom tracks uploaded</li>`;
    return;
  }

  let html = '';
  musicPlaylist.forEach((track, idx) => {
    const isCurrent = idx === currentTrackIndex ? 'font-weight:700; color:var(--accent);' : '';
    html += `
      <li class="playlist-track-item">
        <span class="playlist-track-title" style="${isCurrent}" onclick="playTrack(${idx})">${track.name}</span>
        <button class="btn-delete-track" onclick="deleteTrack(${track.id}, event)">✕</button>
      </li>
    `;
  });
  list.innerHTML = html;
}

function handleMusicUpload(files) {
  if (!files || files.length === 0 || !db) return;

  const transaction = db.transaction(['tracks'], 'readwrite');
  const store = transaction.objectStore('tracks');

  let processed = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    const trackObj = {
      name: file.name,
      blob: file
    };

    const request = store.add(trackObj);
    request.onsuccess = () => {
      processed++;
      if (processed === files.length) {
        // Reload Playlist
        loadPlaylistFromDB(() => {
          alert(`Successfully uploaded ${processed} custom tracks!`);
          playSFX(true);
        });
      }
    };
    request.onerror = (e) => {
      console.error("File write to IndexedDB failed:", e.target.error);
    };
  }
}

function deleteTrack(trackId, event) {
  if (event) event.stopPropagation();
  if (!db) return;

  const confirmDelete = confirm("Remove this track from playlist?");
  if (!confirmDelete) return;

  const transaction = db.transaction(['tracks'], 'readwrite');
  const store = transaction.objectStore('tracks');
  const request = store.delete(trackId);

  request.onsuccess = () => {
    // If playing track is deleted, stop player
    const trackIdx = musicPlaylist.findIndex(t => t.id === trackId);
    if (trackIdx === currentTrackIndex) {
      stopMusic();
    }
    
    loadPlaylistFromDB(() => {
      playSFX(true);
    });
  };
}

function clearAllMusic() {
  if (!db) return;
  const confirmClear = confirm("Clear all custom music files?");
  if (!confirmClear) return;

  const transaction = db.transaction(['tracks'], 'readwrite');
  const store = transaction.objectStore('tracks');
  const request = store.clear();

  request.onsuccess = () => {
    stopMusic();
    loadPlaylistFromDB(() => {
      playSFX(true);
    });
  };
}

// ==========================================================================
// BACKGROUND MUSIC CONTROLLER
// ==========================================================================
function generatePlayOrder() {
  shufflePlayOrder = [];
  if (musicPlaylist.length === 0) return;

  for (let i = 0; i < musicPlaylist.length; i++) {
    shufflePlayOrder.push(i);
  }

  if (musicPlayMode === 'shuffle') {
    // Fisher-Yates Shuffle algorithm
    for (let i = shufflePlayOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shufflePlayOrder[i], shufflePlayOrder[j]] = [shufflePlayOrder[j], shufflePlayOrder[i]];
    }
  }
}

function setupMusicPlayerListeners() {
  audioPlayer.addEventListener('ended', () => {
    // On track end, play next track
    nextTrack();
  });
}

function playTrack(index) {
  if (index < 0 || index >= musicPlaylist.length) return;

  currentTrackIndex = index;
  const track = musicPlaylist[index];
  
  // Revoke old object URL if active
  if (audioPlayer.src && audioPlayer.src.startsWith('blob:')) {
    URL.revokeObjectURL(audioPlayer.src);
  }

  // Generate dynamic object URL from file Blob in memory
  const blobUrl = URL.createObjectURL(track.blob);
  audioPlayer.src = blobUrl;
  audioPlayer.volume = musicVolume;
  
  audioPlayer.play()
    .then(() => {
      isMusicPlaying = true;
      document.getElementById('music-play-btn').innerText = '⏸️';
      document.getElementById('music-track-title').innerText = track.name;
      renderTracklistUI();
    })
    .catch(err => {
      console.error("Playback failed:", err);
    });
}

function togglePlayMusic() {
  if (musicPlaylist.length === 0) return;

  if (isMusicPlaying) {
    audioPlayer.pause();
    isMusicPlaying = false;
    document.getElementById('music-play-btn').innerText = '▶️';
  } else {
    if (currentTrackIndex === -1) {
      // Start from first track
      if (musicPlayMode === 'shuffle') {
        playTrack(shufflePlayOrder[0]);
      } else {
        playTrack(0);
      }
    } else {
      audioPlayer.play()
        .then(() => {
          isMusicPlaying = true;
          document.getElementById('music-play-btn').innerText = '⏸️';
        });
    }
  }
}

function stopMusic() {
  audioPlayer.pause();
  isMusicPlaying = false;
  currentTrackIndex = -1;
  document.getElementById('music-play-btn').innerText = '▶️';
  document.getElementById('music-track-title').innerText = 'Playlist Empty';
}

function nextTrack() {
  if (musicPlaylist.length === 0) return;

  if (musicPlayMode === 'shuffle') {
    const orderIdx = shufflePlayOrder.indexOf(currentTrackIndex);
    const nextOrderIdx = (orderIdx + 1) % shufflePlayOrder.length;
    playTrack(shufflePlayOrder[nextOrderIdx]);
  } else {
    const nextIdx = (currentTrackIndex + 1) % musicPlaylist.length;
    playTrack(nextIdx);
  }
}

function prevTrack() {
  if (musicPlaylist.length === 0) return;

  if (musicPlayMode === 'shuffle') {
    const orderIdx = shufflePlayOrder.indexOf(currentTrackIndex);
    let prevOrderIdx = orderIdx - 1;
    if (prevOrderIdx < 0) prevOrderIdx = shufflePlayOrder.length - 1;
    playTrack(shufflePlayOrder[prevOrderIdx]);
  } else {
    let prevIdx = currentTrackIndex - 1;
    if (prevIdx < 0) prevIdx = musicPlaylist.length - 1;
    playTrack(prevIdx);
  }
}

function setMusicVolume(val) {
  musicVolume = parseFloat(val);
  audioPlayer.volume = musicVolume;
  localStorage.setItem('music_volume', val);
}

function toggleMusicMode() {
  playSFX(true);
  const modeBtn = document.getElementById('music-mode-btn');

  if (musicPlayMode === 'loop') {
    musicPlayMode = 'shuffle';
    modeBtn.innerText = '🔀 Random';
    modeBtn.classList.add('active');
  } else {
    musicPlayMode = 'loop';
    modeBtn.innerText = '🔁 Loop';
    modeBtn.classList.remove('active');
  }

  localStorage.setItem('music_play_mode', musicPlayMode);
  generatePlayOrder();
}

// ==========================================================================
// AUDIO SFX PLAYER (DISABLED)
// ==========================================================================
function playSFX(isCorrect) {
  // Sound effects disabled
}

// ==========================================================================
// SETTINGS DRAWER CONTROLLERS
// ==========================================================================
function openSettingsAndFocusSubjects() {
  openSettings();
  setTimeout(() => {
    const subjectsLabel = document.getElementById('settings-selected-classes') || 
                          document.getElementById('settings-subject-select');
    if (subjectsLabel) {
      subjectsLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      const container = document.getElementById('settings-selected-classes');
      if (container) {
        container.style.boxShadow = '0 0 15px var(--accent)';
        container.style.transition = 'box-shadow 0.5s ease';
        setTimeout(() => {
          container.style.boxShadow = 'none';
        }, 1500);
      }
    }
  }, 350);
}

function openSettings() {
  const drawer = document.getElementById('settings-drawer');
  const overlay = document.getElementById('settings-overlay');
  
  if (drawer && overlay) {
    drawer.classList.add('open');
    overlay.classList.add('open');
  }

  // Render role-specific settings elements dynamically
  renderSettingsDrawerContent();

  const themeToggle = document.getElementById('settings-theme-toggle');
  if (themeToggle) themeToggle.checked = document.body.classList.contains('light-mode');
}

function closeSettings() {
  const drawer = document.getElementById('settings-drawer');
  const overlay = document.getElementById('settings-overlay');
  
  if (drawer && overlay) {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  }
}

function updateProfileName(val) {
  if (!currentUser) return;
  currentUser.name = val.trim();
  saveStudentSession();
  updateProfileUI();
}

function updateProfileID(val) {
  if (!currentUser) return;
  currentUser.studentId = val.trim();
  saveStudentSession();
  updateProfileUI();
}

function updateFacultyField(field, value) {
  if (!currentUser) return;
  currentUser[field] = value.trim();
  saveStudentSession();
  updateProfileUI();
  
  // If the active view is faculty, re-render it instantly to reflect changes
  if (currentMode === 'faculty') {
    renderFacultyView();
  }
}

function renderSettingsDrawerContent() {
  const container = document.getElementById('settings-body-container');
  if (!container || !currentUser) return;

  let profileHTML = '';

  if (currentUserRole === 'student') {
    profileHTML = `
      <!-- Learner Profile Section -->
      <div class="settings-section">
        <h3>👤 Student Profile</h3>
        <div class="settings-row">
          <label for="settings-nickname">Display Name:</label>
          <input type="text" id="settings-nickname" placeholder="Name" value="${escapeHtml(currentUser.name)}" onchange="updateProfileName(this.value)">
        </div>
        <div class="settings-row">
          <label for="settings-studentid">Student ID:</label>
          <input type="text" id="settings-studentid" placeholder="e.g., 2024-1234" value="${escapeHtml(currentUser.studentId)}" onchange="updateProfileID(this.value)">
        </div>
        <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 6px;">
          <label>🧪 Subjects & Sections:</label>
          <div style="display: flex; gap: 8px; margin-bottom: 10px;">
            <select id="settings-subject-select" style="flex: 2; font-size: 13px; padding: 8px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-card); color: var(--text-main);">
              <!-- Dynamically populated below -->
            </select>
            <select id="settings-section-select" style="flex: 1; font-size: 13px; padding: 8px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-card); color: var(--text-main);">
              <!-- Dynamically populated below -->
            </select>
            <button type="button" class="settings-btn-primary" onclick="addClassSettings()" style="width: auto; margin-top: 0; padding: 10px 14px; white-space: nowrap;">➕ Add</button>
          </div>
          <div id="settings-selected-classes" class="selected-classes-container">
            <!-- Rendered dynamically -->
          </div>
        </div>
        <div class="settings-row">
          <label for="settings-year">Year Level:</label>
          <select id="settings-year" onchange="updateProfileYear(this.value)">
            <option value="1" ${currentUser.year === '1' ? 'selected' : ''}>1</option>
            <option value="2" ${currentUser.year === '2' ? 'selected' : ''}>2</option>
            <option value="3" ${currentUser.year === '3' ? 'selected' : ''}>3</option>
            <option value="4" ${currentUser.year === '4' ? 'selected' : ''}>4</option>
          </select>
        </div>
        <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 8px; margin-top: 10px; border-top: 1px dashed var(--border-card); padding-top: 10px;">
          <span style="font-weight: 500;">Profile Photo:</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <img id="settings-profile-pic" src="${currentUser.avatar || 'chemistry_logo.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
            <label class="upload-btn-label" for="profile-pic-upload" style="flex: 1; margin: 0; padding: 10px 14px; text-align: center; font-size: 13px; font-weight: 600;">
              📸 Choose Image
            </label>
            <button class="settings-btn-primary" onclick="removeProfilePic()" style="width: auto; padding: 10px 14px; margin-top: 0; white-space: nowrap; font-size: 13px; background: var(--incorrect);">
              Remove
            </button>
          </div>
          <input type="file" id="profile-pic-upload" accept="image/*" style="display: none;" onchange="handleProfilePicUpload(this.files)">
        </div>
      </div>
    `;
  } else if (currentUserRole === 'faculty') {
    profileHTML = `
      <!-- Instructor Profile Section -->
      <div class="settings-section">
        <h3>👤 Faculty Profile</h3>
        <div class="settings-row" style="margin-bottom: 12px;">
          <span style="font-size: 13px; color: var(--text-muted);">Configure your contact details, consultation settings, and social links.</span>
        </div>
        <div class="settings-row">
          <label for="settings-nickname">Full Name:</label>
          <input type="text" id="settings-nickname" placeholder="e.g. Prof. Ramon M. Eduque, Jr." value="${escapeHtml(currentUser.name)}" onchange="updateFacultyField('name', this.value)">
        </div>
        <div class="settings-row">
          <label>Email Address:</label>
          <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">${escapeHtml(currentUser.email)}</span>
        </div>
        <div class="settings-row">
          <label for="settings-faculty-contact">Contact Number:</label>
          <input type="text" id="settings-faculty-contact" placeholder="e.g. 09123456789" value="${escapeHtml(currentUser.contactNumber || '')}" onchange="updateFacultyField('contactNumber', this.value)">
        </div>
        <div class="settings-row">
          <label for="settings-faculty-office">Office Address:</label>
          <input type="text" id="settings-faculty-office" placeholder="e.g. Department of Chemistry, RSRC" value="${escapeHtml(currentUser.officeAddress || '')}" onchange="updateFacultyField('officeAddress', this.value)">
        </div>
        <div class="settings-row">
          <label for="settings-faculty-messenger">Messenger Link:</label>
          <input type="url" id="settings-faculty-messenger" placeholder="e.g. https://m.me/username" value="${escapeHtml(currentUser.messengerLink || '')}" onchange="updateFacultyField('messengerLink', this.value)">
        </div>
        <div class="settings-row">
          <label for="settings-faculty-messenger-gc">Messenger GC Link:</label>
          <input type="url" id="settings-faculty-messenger-gc" placeholder="Messenger Class GC URL" value="${escapeHtml(currentUser.messengerGc || '')}" onchange="updateFacultyField('messengerGc', this.value)">
        </div>
        <div class="settings-row">
          <label for="settings-faculty-telegram-gc">Telegram GC Link:</label>
          <input type="url" id="settings-faculty-telegram-gc" placeholder="Telegram Class GC URL" value="${escapeHtml(currentUser.telegramGc || '')}" onchange="updateFacultyField('telegramGc', this.value)">
        </div>
        <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 4px;">
          <label for="settings-faculty-consultation">Consultation Hours (one per line):</label>
          <textarea id="settings-faculty-consultation" placeholder="e.g. MWF 9:00 AM - 11:00 AM" style="width: 100%; height: 60px; padding: 8px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-card); color: var(--text-main); font-size: 13px;" onchange="updateFacultyField('consultationHours', this.value)">${escapeHtml(currentUser.consultationHours || '')}</textarea>
        </div>
        <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 8px; margin-top: 10px; border-top: 1px dashed var(--border-card); padding-top: 10px;">
          <span style="font-weight: 500;">Profile Photo:</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <img id="settings-profile-pic" src="${currentUser.avatar || 'chemistry_logo.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
            <label class="upload-btn-label" for="profile-pic-upload" style="flex: 1; margin: 0; padding: 10px 14px; text-align: center; font-size: 13px; font-weight: 600;">
              📸 Choose Image
            </label>
            <button class="settings-btn-primary" onclick="removeProfilePic()" style="width: auto; padding: 10px 14px; margin-top: 0; white-space: nowrap; font-size: 13px; background: var(--incorrect);">
              Remove
            </button>
          </div>
          <input type="file" id="profile-pic-upload" accept="image/*" style="display: none;" onchange="handleProfilePicUpload(this.files)">
        </div>
      </div>
    `;
  } else if (currentUserRole === 'admin') {
    profileHTML = `
      <!-- Admin Profile Section -->
      <div class="settings-section">
        <h3>🛡️ Administrator Profile</h3>
        <div class="settings-row">
          <label for="settings-nickname">Admin Name:</label>
          <input type="text" id="settings-nickname" value="${escapeHtml(currentUser.name)}" onchange="updateProfileName(this.value)">
        </div>
        <div class="settings-row">
          <label>Email Address:</label>
          <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">${escapeHtml(currentUser.email)}</span>
        </div>
        <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 8px; margin-top: 10px; border-top: 1px dashed var(--border-card); padding-top: 10px;">
          <span style="font-weight: 500;">Profile Photo:</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <img id="settings-profile-pic" src="${currentUser.avatar || 'chemistry_logo.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
            <label class="upload-btn-label" for="profile-pic-upload" style="flex: 1; margin: 0; padding: 10px 14px; text-align: center; font-size: 13px; font-weight: 600;">
              📸 Choose Image
            </label>
            <button class="settings-btn-primary" onclick="removeProfilePic()" style="width: auto; padding: 10px 14px; margin-top: 0; white-space: nowrap; font-size: 13px; background: var(--incorrect);">
              Remove
            </button>
          </div>
          <input type="file" id="profile-pic-upload" accept="image/*" style="display: none;" onchange="handleProfilePicUpload(this.files)">
        </div>
      </div>

      <!-- Visible Admin Config Section -->
      <div class="settings-section">
        <h3>⚙️ LMS System Configuration</h3>
        <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 4px; margin-bottom: 12px;">
          <label for="admin-sheets-url" style="font-size: 11px; font-weight: 600;">Google Sheets Script URL:</label>
          <input type="text" id="admin-sheets-url" placeholder="Apps Script Web App URL" style="width: 100%;" value="${escapeHtml(REMOTE_SHEETS_SCRIPT_URL)}" onchange="updateAdminSheetsURL(this.value)">
        </div>
        <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 4px;">
          <label for="admin-manifest-url" style="font-size: 11px; font-weight: 600;">Remote Manifest URL:</label>
          <input type="text" id="admin-manifest-url" placeholder="Manifest JSON URL" style="width: 100%;" value="${escapeHtml(REMOTE_MANIFEST_URL)}" onchange="updateAdminManifestURL(this.value)">
        </div>
      </div>
    `;
  } else if (currentUserRole === 'chairperson') {
    profileHTML = `
      <!-- Chairperson Profile Section -->
      <div class="settings-section">
        <h3>🏛️ Chairperson Profile</h3>
        <div class="settings-row">
          <label for="settings-nickname">Name:</label>
          <input type="text" id="settings-nickname" value="${escapeHtml(currentUser.name)}" onchange="updateProfileName(this.value)">
        </div>
        <div class="settings-row">
          <label>Email Address:</label>
          <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">${escapeHtml(currentUser.email)}</span>
        </div>
        
        <!-- Digital Signature Uploader -->
        <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 8px; margin-top: 15px; border-top: 1px dashed var(--border-card); padding-top: 10px;">
          <span style="font-weight: 600; font-size: 12px; color: var(--text-muted); text-transform: uppercase;">✍️ Digital Signature Image:</span>
          <div style="display: flex; flex-direction: column; gap: 8px; align-items: stretch;">
            <div id="settings-signature-preview-container" style="border: 1px dashed var(--border-card); border-radius: 8px; padding: 10px; background: rgba(255,255,255,0.01); display: flex; align-items: center; justify-content: center; height: 80px; overflow: hidden;">
              ${currentUser.digitalSignatureBase64 ? `
                <img id="settings-signature-img" src="${currentUser.digitalSignatureBase64}" style="max-height: 100%; max-width: 100%; object-fit: contain;">
              ` : `
                <span id="settings-signature-placeholder" style="font-size: 11.5px; color: var(--text-muted); font-style: italic;">No signature uploaded</span>
              `}
            </div>
            <div style="display: flex; gap: 8px;">
              <label class="upload-btn-label" for="signature-pic-upload" style="flex: 1; margin: 0; padding: 10px 14px; text-align: center; font-size: 13px; font-weight: 600; cursor: pointer;">
                📁 Choose Signature Image
              </label>
              ${currentUser.digitalSignatureBase64 ? `
                <button class="settings-btn-primary" onclick="if(typeof removeChairpersonSignature === 'function') removeChairpersonSignature()" style="width: auto; padding: 10px 14px; margin-top: 0; white-space: nowrap; font-size: 13px; background: var(--incorrect);">
                  Remove
                </button>
              ` : ''}
            </div>
          </div>
          <input type="file" id="signature-pic-upload" accept="image/*" style="display: none;" onchange="if(typeof uploadChairpersonSignature === 'function') uploadChairpersonSignature(event)">
        </div>

        <div class="settings-row" style="flex-direction: column; align-items: stretch; gap: 8px; margin-top: 10px; border-top: 1px dashed var(--border-card); padding-top: 10px;">
          <span style="font-weight: 500;">Profile Photo:</span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <img id="settings-profile-pic" src="${currentUser.avatar || 'chemistry_logo.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
            <label class="upload-btn-label" for="profile-pic-upload" style="flex: 1; margin: 0; padding: 10px 14px; text-align: center; font-size: 13px; font-weight: 600; cursor: pointer;">
              📸 Choose Image
            </label>
            <button class="settings-btn-primary" onclick="removeProfilePic()" style="width: auto; padding: 10px 14px; margin-top: 0; white-space: nowrap; font-size: 13px; background: var(--incorrect);">
              Remove
            </button>
          </div>
          <input type="file" id="profile-pic-upload" accept="image/*" style="display: none;" onchange="handleProfilePicUpload(this.files)">
        </div>
      </div>
    `;
  }

  // Theme & Audio Section (Always relevant but customized slightly if needed)
  const themeAudioHTML = `
    <div class="settings-section">
      <h3>🎨 Theme & Audio</h3>
      <div class="settings-row">
        <span>🌓 Light Mode:</span>
        <label class="toggle-container">
          <input type="checkbox" id="settings-theme-toggle" onchange="toggleTheme()" ${document.body.classList.contains('light-mode') ? 'checked' : ''}>
          <div class="toggle-slider"></div>
        </label>
      </div>
      <div style="display: ${currentUserRole === 'student' ? 'block' : 'none'}; flex-direction: column; align-items: stretch; gap: 8px; margin-top: 10px; border-top: 1px dashed var(--border-card); padding-top: 10px;">
        <span style="font-weight: 500;">🎵 Custom Background Music Playlist:</span>
        <p style="font-size: 11px; color: var(--text-muted); margin: 0 0 8px 0;">Upload your own audio files (MP3/OGG). Stored locally on your device.</p>
        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
          <label class="upload-btn-label" for="music-upload" style="flex: 1; margin: 0; padding: 10px 14px; text-align: center; font-size: 13px; font-weight: 600;">
            📁 Upload Audio Files
          </label>
        </div>
        <input type="file" id="music-upload" accept="audio/*" multiple style="display: none;" onchange="handleMusicUpload(this.files)">
        
        <div class="music-playlist-manager">
          <div class="playlist-header">
            <span>Tracklist</span>
            <button onclick="clearAllMusic()" class="btn-clear-playlist">Clear All</button>
          </div>
          <ul class="playlist-tracks" id="playlist-tracks-list">
            <!-- Rendered dynamically -->
          </ul>
        </div>
      </div>
    </div>
  `;

  // LMS Sync & Maintenance Section
  let maintenanceHTML = '';
  if (currentUserRole === 'student') {
    maintenanceHTML = `
      <div class="settings-section">
        <h3>🔄 LMS Sync & Maintenance</h3>
        <button class="settings-btn-primary" id="update-topics-btn" onclick="checkWeeklyUpdates()">
          📥 Sync Courses & Notes
        </button>
        <button class="settings-btn-primary" id="changelog-btn" onclick="showChangelog()" style="margin-top: 8px; background: var(--secondary, #3b82f6);">
          📋 View App Changelog
        </button>
        <button class="settings-btn-danger" onclick="confirmClearAllProgress()" style="margin-top: 12px; width: 100%;">
          🗑️ Clear Cached Study Data
        </button>
      </div>
    `;
  } else {
    maintenanceHTML = `
      <div class="settings-section">
        <h3>🔄 LMS Maintenance</h3>
        <button class="settings-btn-primary" id="update-topics-btn" onclick="checkWeeklyUpdates()">
          📥 Sync LMS Manifest
        </button>
        <button class="settings-btn-primary" id="changelog-btn" onclick="showChangelog()" style="margin-top: 8px; background: var(--secondary, #3b82f6);">
          📋 View App Changelog
        </button>
      </div>
    `;
  }

  container.innerHTML = `
    ${profileHTML}
    ${themeAudioHTML}
    ${maintenanceHTML}
  `;

  // After rendering HTML, trigger secondary dropdowns or lists populators
  if (currentUserRole === 'student') {
    populateSubjectDropdowns();
    renderSettingsSelectedClasses();
    renderTracklistUI();
  }
}

function addClassSettings() {
  if (!currentUser) return;
  const subSelect = document.getElementById('settings-subject-select');
  const secSelect = document.getElementById('settings-section-select');
  if (!subSelect || !secSelect) return;
  const subVal = subSelect.value;
  const secVal = secSelect.value;
  const combined = `${subVal}_${secVal}`;
  
  if (!currentUser.subjects) currentUser.subjects = [];
  if (currentUser.subjects.includes(combined)) {
    alert("This subject and section combination is already added.");
    return;
  }
  
  currentUser.subjects.push(combined);
  saveStudentSession();
  
  renderSettingsSelectedClasses();
  buildUIFromManifest();
  renderCurrentModeView();
}

function removeClassSettings(combined) {
  if (!currentUser || !currentUser.subjects) return;
  currentUser.subjects = currentUser.subjects.filter(s => s !== combined);
  saveStudentSession();
  
  renderSettingsSelectedClasses();
  buildUIFromManifest();
  renderCurrentModeView();
}

function renderSettingsSelectedClasses() {
  const container = document.getElementById('settings-selected-classes');
  if (!container || !currentUser || !currentUser.subjects) return;
  
  if (currentUser.subjects.length === 0) {
    container.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">No classes added yet.</span>';
    return;
  }
  
  let html = '';
  currentUser.subjects.forEach(subKey => {
    const parts = subKey.split('_');
    const courseId = parts[0];
    const section = parts[1].toUpperCase();
    
    let courseName = courseId;
    const selectOpt = document.querySelector(`#settings-subject-select option[value="${courseId}"]`);
    if (selectOpt) {
      courseName = selectOpt.text;
    }
    
    html += `
      <div class="class-chip">
        <span>🧪 ${courseName} - Sec ${section}</span>
        <button type="button" class="class-chip-remove" onclick="removeClassSettings('${subKey}')">&times;</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function updateProfileYear(val) {
  if (!currentUser) return;
  currentUser.year = val;
  saveStudentSession();
  updateProfileUI();
}

function handleProfilePicUpload(files) {
  if (!files || files.length === 0) return;
  const file = files[0];

  if (!file.type.startsWith('image/')) {
    alert("Please upload a valid image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      currentUser.avatar = e.target.result;
      saveStudentSession();
      updateProfileUI();
      playSFX(true);
    } catch (err) {
      alert("Selected photo is too large. Please use a smaller profile avatar.");
    }
  };
  reader.readAsDataURL(file);
}

function removeProfilePic() {
  if (!currentUser) return;
  currentUser.avatar = '';
  saveStudentSession();
  updateProfileUI();
  playSFX(true);
}

function toggleTheme() {
  playSFX(true);
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('theme_light_mode', isLight ? 'true' : 'false');
  
  const settingsToggle = document.getElementById('settings-theme-toggle');
  if (settingsToggle) {
    settingsToggle.checked = isLight;
  }
}

function checkWeeklyUpdates() {
  playSFX(true);
  const btn = document.getElementById('update-topics-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = "⏳ Syncing...";
  }

  setTimeout(() => {
    loadManifest();
    syncOfflineScores();
    if (btn) {
      btn.disabled = false;
      btn.innerText = "📥 Sync Courses & Notes";
    }
    alert("Manifest sync successfully loaded!");
  }, 1000);
}

function signOutStudent() {
  playSFX(true);
  
  const proceed = (approved) => {
    if (!approved) return;

    stopSessionTracker();

    auth.signOut().then(() => {
      localStorage.removeItem('student_user_session');
      currentUser = null;
      closeSettings();
      loadUserSession();
    }).catch((err) => {
      console.error("Firebase signout error:", err);
      // Force local clear anyway
      localStorage.removeItem('student_user_session');
      currentUser = null;
      closeSettings();
      loadUserSession();
    });
  };

  const confirmMsg = "Are you sure you want to sign out? Your profile details and score history will be saved.";
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(confirmMsg, proceed);
  } else {
    const res = confirm(confirmMsg);
    proceed(res);
  }
}

function confirmClearAllProgress() {
  const proceed = (approved) => {
    if (!approved) return;

    // Find all quiz score keys and remove them
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key.startsWith('quiz_score_') || key.startsWith('quiz_max_') || key.startsWith('assignment_submitted_')) {
        localStorage.removeItem(key);
      }
    }

    playSFX(true);
    showCustomAlert("Cached academic progress records cleared successfully.", 'success');
    renderCurrentModeView();
  };

  const confirmMsg = "⚠️ Danger: Clear all local grade records, quizzes scores history, and checklist details? This cannot be undone.";
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(confirmMsg, proceed);
  } else {
    const res = confirm(confirmMsg);
    proceed(res);
  }
}

// ==========================================================================
// ABOUT & CHANGELOG VIEWS
// ==========================================================================
const APP_VERSION = "v26.06.16.1300";
const BUILD_DATE = "June 16, 2026";

const APP_CHANGELOG = [
  {
    version: "v26.06.16.1300",
    date: "June 16, 2026",
    changes: [
      "Initial launch of Doc Learning Hub chemistry LMS.",
      "Google login credentials mocking.",
      "Google Sheets uploader via Apps Script.",
      "Custom background music with IndexedDB playlist buffer."
    ]
  }
];

function showChangelog() {
  playSFX(true);
  const modal = document.getElementById('changelog-modal');
  const timeline = document.getElementById('changelog-timeline');
  if (!modal || !timeline) return;

  let html = '';
  APP_CHANGELOG.forEach(log => {
    html += `
      <div style="margin-bottom: 15px;">
        <span style="font-weight: 700; color: var(--accent); font-size: 15px;">${log.version}</span>
        <span style="font-size: 11px; color: var(--text-muted); margin-left: 8px;">${log.date}</span>
        <ul style="margin-top: 5px; padding-left: 20px; font-size: 12.5px; line-height: 1.5;">
          ${log.changes.map(c => `<li>${c}</li>`).join('')}
        </ul>
      </div>
    `;
  });
  
  timeline.innerHTML = html;
  modal.style.display = 'flex';
}

function closeChangelogModal() {
  const modal = document.getElementById('changelog-modal');
  if (modal) modal.style.display = 'none';
}

function showAbout() {
  playSFX(true);
  const modal = document.getElementById('about-modal');
  const body = document.getElementById('about-modal-body');
  if (!modal || !body) return;

  body.innerHTML = `
    <div style="text-align: center; margin-bottom: 15px;">
      <span style="font-size: 48px;">🧪</span>
      <h3 style="font-family: 'Outfit', sans-serif; font-size: 20px; margin-top: 8px;">Department of Chemistry Learning Hub</h3>
      <span style="font-size: 12px; color: var(--text-muted);">Version ${APP_VERSION} (Build: ${BUILD_DATE})</span>
    </div>
    
    <div style="font-size:13px; line-height: 1.6; display: flex; flex-direction: column; gap: 12px;">
      <p><strong>Department of Chemistry Learning Hub</strong> is a lightweight, offline-first Learning Management System custom-tailored for the Department of Chemistry.</p>
      
      <div class="example-box">
        <div class="example-title">🎓 Affiliation & Credits</div>
        <p style="font-size:12px; margin: 4px 0 0 0;">
          Created in collaboration with the Department of Chemistry Faculty. Designed to deliver learning materials and assess student metrics natively on mobile and tablet devices.
        </p>
      </div>

      <div class="example-box">
        <div class="example-title">🔒 Privacy & Data Policy</div>
        <p style="font-size:12px; margin: 4px 0 0 0;">
          All student records, quiz grades, and assignment status logs are stored locally on the device and securely uploaded to the shared faculty Google Spreadsheet using the student's authenticated email identity. No data is shared with third parties.
        </p>
      </div>
    </div>
  `;

  modal.style.display = 'flex';
}

function closeAboutModal() {
  const modal = document.getElementById('about-modal');
  if (modal) modal.style.display = 'none';
}

// ==========================================================================
// MOBILE RESPONSIVE SIDEBAR TOGGLERS
// ==========================================================================
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar-nav');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (sidebar && overlay) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar-nav');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (sidebar && overlay) {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  }
}




// ==========================================================================
// INSTRUCTOR PORTAL MODALS & UTILITIES
// ==========================================================================
function openClassRequestModal() {
  playSFX(true);
  const select = document.getElementById('request-course-id');
  if (select && manifestData && manifestData.courses) {
    select.innerHTML = manifestData.courses.map(c => `
      <option value="${c.id}">${c.name}</option>
    `).join('');
  }
  const modal = document.getElementById('class-request-modal');
  if (modal) modal.style.display = 'flex';
}

function uploadRequestSyllabus(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  const file = files[0];

  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    alert("Please upload a valid PDF file.");
    event.target.value = '';
    return;
  }

  const statusSpan = document.getElementById('request-syllabus-status');
  if (statusSpan) statusSpan.textContent = 'Uploading... 🔄';

  const storageRef = storage.ref();
  const fileRef = storageRef.child('syllabi/' + Date.now() + '_' + file.name);

  fileRef.put(file)
    .then(snapshot => snapshot.ref.getDownloadURL())
    .then(url => {
      uploadedSyllabusUrl = url;
      if (statusSpan) statusSpan.textContent = 'Syllabus uploaded! ✅';
      const submitBtn = document.getElementById('class-request-submit-btn');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
    })
    .catch(err => {
      console.error("Error uploading syllabus:", err);
      if (statusSpan) statusSpan.textContent = 'Upload failed ❌';
      alert("Failed to upload syllabus: " + err.message);
    });
}

function closeClassRequestModal() {
  const modal = document.getElementById('class-request-modal');
  if (modal) modal.style.display = 'none';
  
  // Reset syllabus upload state
  uploadedSyllabusUrl = "";
  const fileInput = document.getElementById('request-syllabus-file');
  if (fileInput) fileInput.value = '';
  const statusSpan = document.getElementById('request-syllabus-status');
  if (statusSpan) statusSpan.textContent = 'No file selected';
  const submitBtn = document.getElementById('class-request-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    submitBtn.style.cursor = 'not-allowed';
  }
}

function submitClassRequest(event) {
  event.preventDefault();
  if (!currentUser) return;
  
  const courseSelect = document.getElementById('request-course-id');
  const sectionInput = document.getElementById('request-section');
  const yearInput = document.getElementById('request-year');
  const typeSelect = document.getElementById('request-subject-type');
  if (!courseSelect || !sectionInput || !yearInput) return;

  const courseId = courseSelect.value;
  const section = sectionInput.value.trim();
  const year = yearInput.value.trim();
  const subjectType = typeSelect ? typeSelect.value : 'lecture';
  const activeCourse = manifestData.courses.find(c => c.id === courseId);
  const courseName = activeCourse ? activeCourse.name : courseId.toUpperCase();
  
  const classData = {
    courseId: courseId,
    courseName: courseName,
    section: section,
    year: year,
    subjectType: subjectType,
    facultyEmail: currentUser.email,
    facultyName: currentUser.name || currentUser.email,
    status: 'pending',
    students: [],
    labGroups: [],
    syllabusUrl: uploadedSyllabusUrl || "",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  firestore.collection('classes').add(classData)
    .then(() => {
      alert("Class creation request submitted successfully!");
      closeClassRequestModal();
      sectionInput.value = '';
      yearInput.value = '2026-2027';
      renderFacultyClassesView();
    })
    .catch(err => {
      console.error("Error submitting class request:", err);
      alert("Error submitting request: " + err.message);
    });
}

// Student Roster Enrollment Modal Logic
let currentEnrollClassId = null;

function openEnrollmentModal(classId) {
  if (!classId) {
    alert("Please select a classroom first.");
    return;
  }
  playSFX(true);
  currentEnrollClassId = classId;
  const textarea = document.getElementById('enroll-emails-textarea');
  if (textarea) textarea.value = '';
  const fileInput = document.getElementById('roster-file-upload');
  if (fileInput) fileInput.value = '';
  const modal = document.getElementById('student-enrollment-modal');
  if (modal) modal.style.display = 'flex';
}

function closeEnrollmentModal() {
  const modal = document.getElementById('student-enrollment-modal');
  if (modal) modal.style.display = 'none';
}

function handleRosterFileUpload(files) {
  if (!files || files.length === 0) return;
  const file = files[0];
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = text.match(emailRegex) || [];
    const validEmails = foundEmails.filter(email => email.trim().toLowerCase().endsWith('@msugensan.edu.ph'));
    
    const textarea = document.getElementById('enroll-emails-textarea');
    if (textarea) {
      textarea.value = validEmails.join('\n');
    }
  };
  reader.readAsText(file);
}

function submitEnrollmentRoster() {
  if (!currentEnrollClassId) return;
  const textarea = document.getElementById('enroll-emails-textarea');
  if (!textarea) return;
  
  const lines = textarea.value.split('\n');
  const emails = lines
    .map(line => line.trim().toLowerCase())
    .filter(line => line.length > 0 && line.endsWith('@msugensan.edu.ph'));
  
  if (emails.length === 0) {
    alert("No valid @msugensan.edu.ph emails found to enroll.");
    return;
  }
  
  firestore.collection('classes').doc(currentEnrollClassId).update({
    students: firebase.firestore.FieldValue.arrayUnion(...emails)
  })
  .then(() => {
    alert(`Successfully enrolled ${emails.length} student(s) into class roster.`);
    closeEnrollmentModal();
    
    if (currentMode === 'faculty-classes') {
      renderFacultyClassesView();
    } else if (currentMode === 'faculty-gradebook') {
      loadGradebookData(currentEnrollClassId);
    }
  })
  .catch(err => {
    console.error("Error enrolling students:", err);
    alert("Failed to enroll students: " + err.message);
  });
}

window.openClassRequestModal = openClassRequestModal;
window.closeClassRequestModal = closeClassRequestModal;
window.submitClassRequest = submitClassRequest;
window.uploadRequestSyllabus = uploadRequestSyllabus;
window.openEnrollmentModal = openEnrollmentModal;
window.closeEnrollmentModal = closeEnrollmentModal;
window.handleRosterFileUpload = handleRosterFileUpload;
window.submitEnrollmentRoster = submitEnrollmentRoster;


// ==========================================================================
// INSTRUCTOR DASHBOARD VIEW (MY CLASSES)
// ==========================================================================
let facultySelectedClassId = null;

function goToClassGradebook(classId) {
  facultySelectedClassId = classId;
  setMode('faculty-gradebook');
}
function goToClassGroups(classId) {
  facultySelectedClassId = classId;
  setMode('faculty-groups');
}
window.goToClassGradebook = goToClassGradebook;
window.goToClassGroups = goToClassGroups;

function renderFacultyClassesView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
      <h2 style="font-size: 20px; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0; text-align: left;">🏫 My Classrooms</h2>
      <button class="settings-btn-primary" onclick="openClassRequestModal()" style="width: auto; margin: 0; padding: 10px 18px; font-size: 13px;">➕ Request New Class</button>
    </div>
    <div class="empty-playlist-msg" id="faculty-classes-loading">Loading classrooms from database...</div>
    <div class="class-grid" id="faculty-classes-grid" style="display: none;"></div>
  `;

  const loadingEl = document.getElementById('faculty-classes-loading');
  const gridEl = document.getElementById('faculty-classes-grid');
  if (!gridEl) return;

  function renderClassesHtml(classesList) {
    if (loadingEl) loadingEl.style.display = 'none';
    gridEl.style.display = 'grid';

    if (classesList.length === 0) {
      gridEl.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: 16px; border: 1px dashed var(--border-card);">
          <p style="font-size: 15px; margin: 0 0 12px 0;">You haven't requested any classes yet.</p>
          <button class="settings-btn-primary" onclick="openClassRequestModal()" style="width: auto; margin: 0; padding: 8px 16px; font-size: 12.5px;">Request Your First Class</button>
        </div>
      `;
      return;
    }

    let html = '';
    classesList.forEach(classData => {
      const classId = classData.id;
      const studentCount = classData.students ? classData.students.length : 0;
      const status = classData.status || 'pending';
      const statusClass = status === 'approved' ? 'approved' : 'pending';
      const statusText = status.toUpperCase();

      html += `
        <div class="class-card" style="cursor: pointer;" onclick="viewClassroomDetails('${classId}')">
          <div class="class-card-header">
            <div class="class-code">${classData.courseName}</div>
            <span class="class-section">${classData.section}</span>
          </div>
          <div style="font-size: 12.5px; color: var(--text-muted); margin-top: -4px;">
            Academic Year: ${classData.year}
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
            <span class="class-status-badge ${statusClass}">${statusText}</span>
            <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">${studentCount} Enrolled Students</span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; border-top: 1px dashed var(--border-card); padding-top: 12px;">
            ${status === 'approved' ? `
              <button class="settings-btn-primary" onclick="event.stopPropagation(); openEnrollmentModal('${classId}')" style="width: 100%; margin: 0; padding: 8px; font-size: 12px; background: var(--active-subject-color, #0ea5e9);">👥 Enroll Students</button>
              <div style="display: flex; gap: 8px;">
                <button class="settings-btn-primary" onclick="event.stopPropagation(); goToClassGradebook('${classId}')" style="flex: 1; margin: 0; padding: 8px; font-size: 11.5px; background: #3b82f6;">📊 Gradebook</button>
                <button class="settings-btn-primary" onclick="event.stopPropagation(); goToClassGroups('${classId}')" style="flex: 1; margin: 0; padding: 8px; font-size: 11.5px; background: #10b981;">👥 Lab Groups</button>
              </div>
            ` : `
              <p style="font-size: 11px; font-style: italic; color: var(--text-muted); margin: 4px 0; text-align: center;">Waiting for Admin approval before enrollment.</p>
            `}
          </div>
        </div>
      `;
    });
    gridEl.innerHTML = html;
  }

  firestore.collection('classes')
    .where('facultyEmail', '==', currentUser.email)
    .get()
    .then(querySnapshot => {
      let classesList = [];
      querySnapshot.forEach(doc => {
        classesList.push({ id: doc.id, ...doc.data() });
      });

      const hasSample = classesList.some(c => c.id === 'sample_class_49c');
      const isFacultyRamon = currentUser.email.toLowerCase().trim() === atob("cmFtb24uZWR1cXVlQG1zdWdlbnNhbi5lZHUucGg=");
      
      if (!hasSample && isFacultyRamon) {
        classesList.push(GLOBAL_SAMPLE_CLASS);
      }

      renderClassesHtml(classesList);
    })
    .catch(err => {
      console.error("Error loading classes:", err);
      const isFacultyRamon = currentUser.email.toLowerCase().trim() === atob("cmFtb24uZWR1cXVlQG1zdWdlbnNhbi5lZHUucGg=");
      if (isFacultyRamon) {
        console.log("Offline fallback: rendering local sample class.");
        renderClassesHtml([GLOBAL_SAMPLE_CLASS]);
      } else if (loadingEl) {
        loadingEl.innerHTML = `<span style="color: var(--incorrect);">⚠️ Error loading classes: ${err.message}</span>`;
      }
    });
}
window.renderFacultyClassesView = renderFacultyClassesView;


// ==========================================================================
// INSTRUCTOR DASHBOARD VIEW (GRADEBOOKS & CELL OVERRIDES)
// ==========================================================================
let gradebookClassData = null;
let gradebookStudentsList = {};

function renderFacultyGradebookView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <h2 style="font-size: 20px; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0 0 16px 0;">📊 Class Gradebooks</h2>
    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
      <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">Select Class:</span>
      <select id="gradebook-class-select" onchange="loadGradebookData(this.value)" style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-card); color: var(--text-main); font-size: 13px; min-width: 200px;">
        <option value="">-- Select Class --</option>
      </select>
      <button class="settings-btn-primary" onclick="exportGradebookToCSV()" id="gradebook-export-btn" style="width: auto; margin: 0; padding: 10px 16px; font-size: 12.5px; display: none; background: #475569;">📤 Export to CSV</button>
      <button class="settings-btn-primary" onclick="openEnrollmentModal(document.getElementById('gradebook-class-select').value)" id="gradebook-enroll-btn" style="width: auto; margin: 0; padding: 10px 16px; font-size: 12.5px; display: none;">👥 Enroll Students</button>
    </div>
    <div id="gradebook-view-container">
      <div class="empty-playlist-msg">Please select a class from the dropdown above to view records.</div>
    </div>
  `;

  // Fetch approved classes
  firestore.collection('classes')
    .where('facultyEmail', '==', currentUser.email)
    .where('status', '==', 'approved')
    .get()
    .then(querySnapshot => {
      const select = document.getElementById('gradebook-class-select');
      if (!select) return;

      if (querySnapshot.empty) {
        select.innerHTML = `<option value="">No approved classes found</option>`;
        return;
      }

      let options = `<option value="">-- Select Class --</option>`;
      querySnapshot.forEach(doc => {
        const classData = doc.data();
        options += `<option value="${doc.id}">${classData.courseName} (${classData.section})</option>`;
      });
      select.innerHTML = options;

      // Check if we pre-selected a class
      if (facultySelectedClassId) {
        select.value = facultySelectedClassId;
        const enrollBtn = document.getElementById('gradebook-enroll-btn');
        if (enrollBtn) enrollBtn.style.display = 'inline-block';
        const exportBtn = document.getElementById('gradebook-export-btn');
        if (exportBtn) exportBtn.style.display = 'inline-block';
        loadGradebookData(facultySelectedClassId);
      }
    })
    .catch(err => {
      console.error("Error fetching classes for gradebook select:", err);
    });
}

function loadGradebookData(classId) {
  const container = document.getElementById('gradebook-view-container');
  if (!container) return;

  const enrollBtn = document.getElementById('gradebook-enroll-btn');
  if (enrollBtn) {
    enrollBtn.style.display = classId ? 'inline-block' : 'none';
  }

  const exportBtn = document.getElementById('gradebook-export-btn');
  if (exportBtn) {
    exportBtn.style.display = classId ? 'inline-block' : 'none';
  }

  if (!classId) {
    container.innerHTML = `<div class="empty-playlist-msg">Please select a class from the dropdown above to view records.</div>`;
    return;
  }

  container.innerHTML = `<div class="empty-playlist-msg">Loading class roster and scores...</div>`;
  currentEnrollClassId = classId;

  // Helper function to render gradebook from loaded data
  function renderGradebookViewWithData(classData, studentProfiles, allScores) {
    // Extract assessment columns from manifest
    const course = manifestData.courses.find(c => c.id === classData.courseId);
    const columns = [];
    if (course && course.modules) {
      course.modules.forEach(m => {
        if (m.quiz) {
          columns.push({
            moduleId: m.id,
            taskTitle: m.quiz.title || `${m.title} Quiz`,
            maxScore: (m.quiz.questions && m.quiz.questions.length) ? m.quiz.questions.length : 10,
            mode: 'quiz'
          });
        }
        if (m.assignment) {
          columns.push({
            moduleId: m.id,
            taskTitle: m.assignment.title || `${m.title} Task`,
            maxScore: m.assignment.maxScore || 100,
            mode: 'assignment'
          });
        }
      });
    }
    // Add custom quizzes to columns
    if (classData.customQuizzes && classData.customQuizzes.length > 0) {
      classData.customQuizzes.forEach(cq => {
        columns.push({
          moduleId: cq.id,
          taskTitle: cq.title,
          maxScore: cq.questions.length,
          mode: 'quiz'
        });
      });
    }

    // Calculate class statistics
    const studentPercentages = [];
    classData.students.forEach(studentEmail => {
      const normEmail = studentEmail.toLowerCase().trim();
      let studentObtained = 0;
      let studentTotalPossible = 0;
      
      columns.forEach(col => {
        const localMatch = getLocalStudentScore(normEmail, col.moduleId, col.mode, col.maxScore);

        const matches = allScores.filter(s => 
          s.email.toLowerCase().trim() === normEmail &&
          s.moduleId === col.moduleId &&
          s.taskTitle === col.taskTitle &&
          s.mode === col.mode
        );

        let finalScore = 0; // Default to 0 for cumulative calculation
        if (matches.length > 0) {
          const overrideScore = matches.find(s => s.override === true);
          if (overrideScore) {
            finalScore = overrideScore.score;
          } else {
            const firestoreMax = Math.max(...matches.map(s => s.score));
            if (localMatch) {
              finalScore = Math.max(firestoreMax, localMatch.score);
            } else {
              finalScore = firestoreMax;
            }
          }
        } else if (localMatch) {
          finalScore = localMatch.score;
        }
        studentObtained += finalScore;
        studentTotalPossible += col.maxScore;
      });
      
      const pct = studentTotalPossible > 0 ? (studentObtained / studentTotalPossible) * 100 : 0;
      studentPercentages.push(pct);
    });

    const mean = studentPercentages.length > 0 
      ? (studentPercentages.reduce((a, b) => a + b, 0) / studentPercentages.length).toFixed(1) 
      : "0.0";
      
    let median = "0.0";
    if (studentPercentages.length > 0) {
      const sorted = [...studentPercentages].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      median = sorted.length % 2 !== 0 ? sorted[mid].toFixed(1) : ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1);
    }
    
    const passCount = studentPercentages.filter(p => p >= 60).length;
    const passRate = studentPercentages.length > 0 
      ? ((passCount / studentPercentages.length) * 100).toFixed(0) 
      : "0";
      
    const highest = studentPercentages.length > 0 ? Math.max(...studentPercentages).toFixed(1) : "0.0";
    const lowest = studentPercentages.length > 0 ? Math.min(...studentPercentages).toFixed(1) : "0.0";

    let statsHTML = `
      <div class="gradebook-stats-banner" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 20px; text-align: left;">
        <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 16px; border-radius: 12px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Class Mean (Avg)</div>
          <div style="font-size: 24px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 4px; color: var(--accent);">${mean}%</div>
        </div>
        <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 16px; border-radius: 12px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Median Score</div>
          <div style="font-size: 24px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 4px; color: var(--text-main);">${median}%</div>
        </div>
        <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 16px; border-radius: 12px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Pass Rate (>=60%)</div>
          <div style="font-size: 24px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 4px; color: #10b981;">${passRate}%</div>
        </div>
        <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 16px; border-radius: 12px;">
          <div style="font-size: 11px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Highest / Lowest</div>
          <div style="font-size: 18px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 8px; color: var(--text-main);">${highest}% / ${lowest}%</div>
        </div>
      </div>
    `;

    // Render Gradebook Table
    let tableHTML = `
      <div class="gradebook-container">
        <table class="gradebook-table">
          <thead>
            <tr>
              <th class="sticky-col">Student Name & ID</th>
              <th>Email</th>
    `;

    columns.forEach(col => {
      tableHTML += `<th>${col.taskTitle}<br><span style="font-size:9.5px; opacity:0.6;">Max: ${col.maxScore}</span></th>`;
    });

    tableHTML += `
            </tr>
          </thead>
          <tbody>
    `;

    classData.students.forEach(studentEmail => {
      const normEmail = studentEmail.toLowerCase().trim();
      const profile = studentProfiles[normEmail] || { name: studentEmail.split('@')[0], studentId: 'Not Onboarded' };
      
      tableHTML += `
        <tr>
          <td class="sticky-col">
            <div style="font-weight: 700;">${escapeHtml(profile.name)}</div>
            <div style="font-size: 10px; color: var(--text-muted);">${escapeHtml(profile.studentId)}</div>
          </td>
          <td style="text-align: left; font-family: monospace;">${studentEmail}</td>
      `;

      columns.forEach(col => {
        const localMatch = getLocalStudentScore(normEmail, col.moduleId, col.mode, col.maxScore);

        // Find score
        const matches = allScores.filter(s => 
          s.email.toLowerCase().trim() === normEmail &&
          s.moduleId === col.moduleId &&
          s.taskTitle === col.taskTitle &&
          s.mode === col.mode
        );

        let finalScore = null;
        let isOverridden = false;
        
        if (matches.length > 0) {
          // Check if there is an override
          const overrideScore = matches.find(s => s.override === true);
          if (overrideScore) {
            finalScore = overrideScore.score;
            isOverridden = true;
          } else {
            // Take highest score
            const firestoreMax = Math.max(...matches.map(s => s.score));
            if (localMatch) {
              if (localMatch.override) {
                finalScore = localMatch.score;
                isOverridden = true;
              } else {
                finalScore = Math.max(firestoreMax, localMatch.score);
              }
            } else {
              finalScore = firestoreMax;
            }
          }
        } else if (localMatch) {
          finalScore = localMatch.score;
          isOverridden = localMatch.override;
        }

        const cellClass = finalScore === null ? 'gradebook-cell-empty' : 'gradebook-cell-interactive';
        const cellText = finalScore === null ? '-' : `${finalScore}/${col.maxScore}`;
        const overrideLabel = isOverridden ? `<span class="grade-override-flag">✏️</span>` : '';
        const escName = escapeHtml(escapeJsString(profile.name));
        const escTask = escapeHtml(escapeJsString(col.taskTitle));

        tableHTML += `
          <td class="${cellClass}" onclick="openScoreEditorModal('${studentEmail}', '${escName}', '${col.moduleId}', '${escTask}', ${col.maxScore}, '${col.mode}', ${finalScore})">
            ${cellText}${overrideLabel}
          </td>
        `;
      });

      tableHTML += `</tr>`;
    });

    tableHTML += `
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = statsHTML + tableHTML;
  }

  // Get class details
  firestore.collection('classes').doc(classId).get()
    .then(classDoc => {
      if (!classDoc.exists) {
        if (classId === 'sample_class_49c') {
          // Fall back to GLOBAL_SAMPLE_CLASS
          const classData = GLOBAL_SAMPLE_CLASS;
          gradebookClassData = classData;
          const studentProfiles = {};
          classData.students.forEach(email => {
            studentProfiles[email.toLowerCase().trim()] = { name: email.split('@')[0], studentId: 'Sample ID' };
          });
          gradebookStudentsList = studentProfiles;
          renderGradebookViewWithData(classData, studentProfiles, []);
        } else {
          container.innerHTML = `<div class="empty-playlist-msg" style="color:var(--incorrect);">Classroom not found.</div>`;
        }
        return;
      }

      const classData = classDoc.data();
      gradebookClassData = classData;

      if (!classData.students || classData.students.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: 16px;">
            <p style="font-size: 14px; margin: 0 0 12px 0;">No students enrolled in this classroom yet.</p>
            <button class="settings-btn-primary" onclick="openEnrollmentModal('${classId}')" style="width: auto; margin: 0; padding: 8px 16px; font-size: 12.5px;">👥 Enroll Students Roster</button>
          </div>
        `;
        return;
      }

      // Fetch all student profiles to map names/IDs
      firestore.collection('students').get()
        .then(studentsSnapshot => {
          const studentProfiles = {};
          studentsSnapshot.forEach(doc => {
            studentProfiles[doc.id.toLowerCase().trim()] = doc.data();
          });
          gradebookStudentsList = studentProfiles;

          // Fetch all scores for this course
          firestore.collection('scores')
            .where('courseId', '==', classData.courseId)
            .get()
            .then(scoresSnapshot => {
              const allScores = [];
              scoresSnapshot.forEach(doc => {
                allScores.push(doc.data());
              });
              renderGradebookViewWithData(classData, studentProfiles, allScores);
            })
            .catch(err => {
              console.error("Error loading scores:", err);
              // Fallback to offline local storage rendering
              renderGradebookViewWithData(classData, studentProfiles, []);
            });
        })
        .catch(err => {
          console.error("Error loading students:", err);
          // Fallback to email names mapping
          const studentProfiles = {};
          classData.students.forEach(email => {
            studentProfiles[email.toLowerCase().trim()] = { name: email.split('@')[0], studentId: 'Not Onboarded' };
          });
          gradebookStudentsList = studentProfiles;
          renderGradebookViewWithData(classData, studentProfiles, []);
        });
    })
    .catch(err => {
      console.error("Error fetching class details:", err);
      if (classId === 'sample_class_49c') {
        const classData = GLOBAL_SAMPLE_CLASS;
        gradebookClassData = classData;
        const studentProfiles = {};
        classData.students.forEach(email => {
          studentProfiles[email.toLowerCase().trim()] = { name: email.split('@')[0], studentId: 'Sample ID' };
        });
        gradebookStudentsList = studentProfiles;
        renderGradebookViewWithData(classData, studentProfiles, []);
      } else {
        container.innerHTML = `<div class="empty-playlist-msg" style="color:var(--incorrect);">Error loading classroom: ${err.message}</div>`;
      }
    });
}

// Score Override modal logic
let currentOverrideData = null;

function openScoreEditorModal(studentEmail, studentName, moduleId, taskTitle, maxScore, mode, currentScore) {
  playSFX(true);
  currentOverrideData = {
    email: studentEmail,
    name: studentName,
    moduleId: moduleId,
    taskTitle: taskTitle,
    maxScore: maxScore,
    mode: mode
  };

  const nameEl = document.getElementById('editor-student-name');
  const emailEl = document.getElementById('editor-student-email');
  const taskEl = document.getElementById('editor-task-info');
  const maxEl = document.getElementById('editor-max-score');
  const scoreInput = document.getElementById('editor-score-input');

  if (nameEl) nameEl.innerText = studentName || studentEmail;
  if (emailEl) emailEl.innerText = studentEmail;
  if (taskEl) taskEl.innerText = `Task: ${taskTitle} (${mode.toUpperCase()})`;
  if (maxEl) maxEl.innerText = maxScore;
  
  if (scoreInput) {
    scoreInput.max = maxScore;
    scoreInput.value = (currentScore !== null && currentScore !== undefined) ? currentScore : '';
  }

  const modal = document.getElementById('score-editor-modal');
  if (modal) modal.style.display = 'flex';
}

function closeScoreEditorModal() {
  const modal = document.getElementById('score-editor-modal');
  if (modal) modal.style.display = 'none';
}

function submitScoreOverride() {
  if (!currentOverrideData) return;
  const scoreInput = document.getElementById('editor-score-input');
  if (!scoreInput) return;
  
  const scoreVal = parseInt(scoreInput.value, 10);
  if (isNaN(scoreVal)) {
    alert("Please enter a valid number for the score.");
    return;
  }
  
  if (scoreVal < 0 || scoreVal > currentOverrideData.maxScore) {
    alert(`Score must be between 0 and ${currentOverrideData.maxScore}.`);
    return;
  }

  const { email, moduleId, taskTitle, maxScore, mode } = currentOverrideData;
  const studentProfile = gradebookStudentsList[email.toLowerCase().trim()] || {};
  const studentId = studentProfile.studentId || "Not Onboarded";
  const yearLevel = studentProfile.year || (gradebookClassData ? gradebookClassData.year : "1");
  const section = gradebookClassData ? gradebookClassData.section : "";
  const courseId = gradebookClassData ? gradebookClassData.courseId : "";

  // Save locally first so it updates immediately in the UI
  localStorage.setItem(`override_score_${email.toLowerCase().trim()}_${moduleId}`, scoreVal);

  // Query if an existing score doc matches to update, or make a new one
  firestore.collection('scores')
    .where('email', '==', email)
    .where('moduleId', '==', moduleId)
    .where('taskTitle', '==', taskTitle)
    .where('mode', '==', mode)
    .get()
    .then(querySnapshot => {
      const batch = firestore.batch();
      const scorePayload = {
        email: email,
        studentId: studentId,
        section: section,
        yearLevel: yearLevel,
        courseId: courseId,
        moduleId: moduleId,
        taskTitle: taskTitle,
        score: scoreVal,
        maxScore: maxScore,
        mode: mode,
        override: true,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };

      if (!querySnapshot.empty) {
        querySnapshot.forEach(doc => {
          batch.update(doc.ref, {
            score: scoreVal,
            override: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
      } else {
        const newRef = firestore.collection('scores').doc();
        batch.set(newRef, scorePayload);
      }

      return batch.commit();
    })
    .then(() => {
      alert("Grade override saved successfully!");
      closeScoreEditorModal();
      if (currentEnrollClassId) {
        loadGradebookData(currentEnrollClassId);
      } else if (facultySelectedClassId) {
        loadGradebookData(facultySelectedClassId);
      }
    })
    .catch(err => {
      console.warn("Firestore save override failed, saved locally (offline mode):", err);
      alert("Grade override saved locally (Offline mode).");
      closeScoreEditorModal();
      if (currentEnrollClassId) {
        loadGradebookData(currentEnrollClassId);
      } else if (facultySelectedClassId) {
        loadGradebookData(facultySelectedClassId);
      }
    });
}

window.renderFacultyGradebookView = renderFacultyGradebookView;
window.loadGradebookData = loadGradebookData;
window.openScoreEditorModal = openScoreEditorModal;
window.closeScoreEditorModal = closeScoreEditorModal;
window.submitScoreOverride = submitScoreOverride;


// ==========================================================================
// INSTRUCTOR DASHBOARD VIEW (LAB GROUPS ASSIGNMENT)
// ==========================================================================
let activeGroupsClassId = null;
let activeGroupsClassData = null;

function renderFacultyGroupsView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <h2 style="font-size: 20px; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0 0 16px 0;">👥 Laboratory Groups</h2>
    <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 20px; flex-wrap: wrap;">
      <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">Select Class:</span>
      <select id="groups-class-select" onchange="loadGroupsData(this.value)" style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-card); color: var(--text-main); font-size: 13px; min-width: 200px;">
        <option value="">-- Select Class --</option>
      </select>
      <button class="settings-btn-primary" onclick="createLabGroup()" id="groups-add-btn" style="width: auto; margin: 0; padding: 10px 16px; font-size: 12.5px; display: none;">➕ Create Group</button>
    </div>
    <div id="groups-view-container">
      <div class="empty-playlist-msg">Please select a class from the dropdown above to view groups.</div>
    </div>
  `;

  // Fetch approved classes
  firestore.collection('classes')
    .where('facultyEmail', '==', currentUser.email)
    .where('status', '==', 'approved')
    .get()
    .then(querySnapshot => {
      const select = document.getElementById('groups-class-select');
      if (!select) return;

      let classesList = [];
      querySnapshot.forEach(doc => {
        classesList.push({ id: doc.id, ...doc.data() });
      });

      const hasSample = classesList.some(c => c.id === 'sample_class_49c');
      const isFacultyRamon = currentUser.email.toLowerCase().trim() === atob("cmFtb24uZWR1cXVlQG1zdWdlbnNhbi5lZHUucGg=");
      if (!hasSample && isFacultyRamon) {
        classesList.push(GLOBAL_SAMPLE_CLASS);
      }

      if (classesList.length === 0) {
        select.innerHTML = `<option value="">No approved classes found</option>`;
        return;
      }

      let options = `<option value="">-- Select Class --</option>`;
      classesList.forEach(c => {
        options += `<option value="${c.id}">${c.courseName} (${c.section})</option>`;
      });
      select.innerHTML = options;

      if (facultySelectedClassId) {
        select.value = facultySelectedClassId;
        const addBtn = document.getElementById('groups-add-btn');
        if (addBtn) addBtn.style.display = 'inline-block';
        loadGroupsData(facultySelectedClassId);
      }
    })
    .catch(err => {
      console.error("Error fetching classes for groups select:", err);
      const select = document.getElementById('groups-class-select');
      if (!select) return;
      const isFacultyRamon = currentUser.email.toLowerCase().trim() === atob("cmFtb24uZWR1cXVlQG1zdWdlbnNhbi5lZHUucGg=");
      if (isFacultyRamon) {
        let options = `<option value="">-- Select Class --</option>`;
        options += `<option value="${GLOBAL_SAMPLE_CLASS.id}">${GLOBAL_SAMPLE_CLASS.courseName} (${GLOBAL_SAMPLE_CLASS.section})</option>`;
        select.innerHTML = options;
        if (facultySelectedClassId) {
          select.value = facultySelectedClassId;
          const addBtn = document.getElementById('groups-add-btn');
          if (addBtn) addBtn.style.display = 'inline-block';
          loadGroupsData(facultySelectedClassId);
        }
      } else {
        select.innerHTML = `<option value="">Error loading classes: ${err.message}</option>`;
      }
    });
}

function loadGroupsData(classId) {
  activeGroupsClassId = classId;
  const addBtn = document.getElementById('groups-add-btn');
  if (addBtn) {
    addBtn.style.display = classId ? 'inline-block' : 'none';
  }

  const container = document.getElementById('groups-view-container');
  if (!container) return;

  if (!classId) {
    container.innerHTML = `<div class="empty-playlist-msg">Please select a class from the dropdown above to view groups.</div>`;
    return;
  }

  container.innerHTML = `<div class="empty-playlist-msg">Loading laboratory groups...</div>`;

  if (classId === 'sample_class_49c') {
    const classData = JSON.parse(JSON.stringify(GLOBAL_SAMPLE_CLASS));
    activeGroupsClassData = classData;
    renderLabGroupsListHtml(classData, container);
    return;
  }

  firestore.collection('classes').doc(classId).get()
    .then(doc => {
      if (!doc.exists) {
        container.innerHTML = `<div class="empty-playlist-msg" style="color:var(--incorrect);">Classroom not found.</div>`;
        return;
      }

      const classData = doc.data();
      activeGroupsClassData = classData;
      renderLabGroupsListHtml(classData, container);
    })
    .catch(err => {
      console.error("Error loading lab groups from Firestore:", err);
      if (classId === 'sample_class_49c') {
        const classData = JSON.parse(JSON.stringify(GLOBAL_SAMPLE_CLASS));
        activeGroupsClassData = classData;
        renderLabGroupsListHtml(classData, container);
      } else {
        container.innerHTML = `<div class="empty-playlist-msg" style="color:var(--incorrect);">Error loading groups: ${err.message}</div>`;
      }
    });
}

function renderLabGroupsListHtml(classData, container) {
  if (!classData.students || classData.students.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: 16px;">
        <p style="font-size: 14px; margin: 0 0 12px 0;">No students enrolled in this classroom yet. Please enroll students first.</p>
      </div>
    `;
    return;
  }

  const groups = classData.labGroups || [];

  // Determine unassigned students
  const assignedEmails = new Set();
  groups.forEach(g => {
    if (g.members) g.members.forEach(m => assignedEmails.add(m.toLowerCase().trim()));
  });

  const unassignedStudents = classData.students.filter(email => !assignedEmails.has(email.toLowerCase().trim()));

  if (groups.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted); background: var(--bg-card); border-radius: 16px; border: 1px dashed var(--border-card);">
        <p style="font-size: 15px; margin: 0 0 12px 0;">No laboratory groups created yet.</p>
        <button class="settings-btn-primary" onclick="createLabGroup()" style="width: auto; margin: 0; padding: 8px 16px; font-size: 12.5px;">Create First Group</button>
      </div>
    `;
    return;
  }

  // Render groups view
  let html = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <!-- Unassigned Students Panel -->
      ${unassignedStudents.length > 0 ? `
        <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); padding: 16px; border-radius: 12px; margin-bottom: 8px; text-align: left;">
          <h4 style="margin:0 0 8px 0; font-size: 13.5px; color: #f59e0b; font-weight:700;">⚠️ Unassigned Students (${unassignedStudents.length})</h4>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${unassignedStudents.map(email => `<span style="font-size:11px; padding:4px 8px; border-radius:6px; background:var(--bg-card); border:1px solid var(--border-card); font-family:monospace;">${email}</span>`).join('')}
          </div>
        </div>
      ` : `
        <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); padding: 12px; border-radius: 12px; margin-bottom: 8px; text-align: center; font-size: 12.5px; color: #10b981; font-weight:600;">
          🎉 All students have been assigned to lab groups!
        </div>
      `}

      <div class="lab-groups-container">
  `;

  groups.forEach((g, idx) => {
    html += `
      <div class="lab-group-card">
        <div class="lab-group-header">
          <h3 class="lab-group-title">🧪 ${g.name}</h3>
          <button onclick="deleteLabGroup('${g.id}')" style="background:none; border:none; color:var(--incorrect); font-size:12px; font-weight:700; cursor:pointer;">❌ Delete Group</button>
        </div>
        
        <div style="margin-bottom: 12px; text-align: left;">
          <label style="font-size: 11px; font-weight:600; color:var(--text-muted); display:block; margin-bottom:4px;">Experiment Folder/Link</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="link-input-${g.id}" value="${g.experimentLink || ''}" placeholder="e.g. Google Drive folder link" style="flex:1; padding:8px; border-radius:6px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12px;">
            <button class="settings-btn-primary" onclick="saveLabGroupLink('${g.id}')" style="width:auto; margin:0; padding:8px 12px; font-size:11px; background: #3b82f6;">Save Link</button>
          </div>
          ${g.experimentLink ? `<a href="${g.experimentLink}" target="_blank" style="font-size:11px; color:var(--active-subject-color, #0ea5e9); display:inline-block; margin-top:4px; font-weight:600;">🔗 Open Link External</a>` : ''}
        </div>
        
        <div style="font-size:12px; font-weight:600; color:var(--text-muted); margin-bottom: 8px; text-align: left;">Members (${g.members ? g.members.length : 0})</div>
        <div class="lab-group-members" style="margin-bottom:12px;">
          ${(g.members && g.members.length > 0) ? g.members.map(m => `
            <div class="lab-member-row">
              <span style="font-family:monospace; font-size:12.5px;">${m}</span>
              <button class="btn-remove-member" onclick="removeStudentFromLabGroup('${g.id}', '${m}')">&times;</button>
            </div>
          `).join('') : `<div style="font-size:11.5px; font-style:italic; color:var(--text-muted); padding:4px 8px; text-align: left;">No members assigned yet.</div>`}
        </div>

        ${unassignedStudents.length > 0 ? `
          <div style="display:flex; gap:8px; align-items:center; border-top:1px dashed var(--border-card); padding-top:12px;">
            <select id="assign-select-${g.id}" style="flex:1; padding:8px; border-radius:6px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12px;">
              <option value="">-- Assign Student --</option>
              ${unassignedStudents.map(email => `<option value="${email}">${email}</option>`).join('')}
            </select>
            <button class="settings-btn-primary" onclick="addStudentToLabGroup('${g.id}')" style="width:auto; margin:0; padding:8px 12px; font-size:11.5px; background:var(--active-subject-color, #0ea5e9);">➕ Add</button>
          </div>
        ` : ''}
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function createLabGroup() {
  if (!activeGroupsClassId || !activeGroupsClassData) return;
  const groups = activeGroupsClassData.labGroups || [];
  const nextGroupNum = groups.length + 1;
  const newGroup = {
    id: 'group_' + Date.now(),
    name: `Lab Group ${nextGroupNum}`,
    members: [],
    experimentLink: ''
  };

  groups.push(newGroup);

  if (activeGroupsClassId === 'sample_class_49c') {
    GLOBAL_SAMPLE_CLASS.labGroups = groups;
  }

  firestore.collection('classes').doc(activeGroupsClassId).update({
    labGroups: groups
  })
  .then(() => {
    loadGroupsData(activeGroupsClassId);
  })
  .catch(err => {
    console.error("Error creating group in Firestore:", err);
    if (activeGroupsClassId === 'sample_class_49c') {
      loadGroupsData(activeGroupsClassId);
    } else {
      alert("Failed to create group: " + err.message);
    }
  });
}

function deleteLabGroup(groupId) {
  if (!activeGroupsClassId || !activeGroupsClassData) return;
  const confirmDelete = confirm("Are you sure you want to delete this lab group? Members will be unassigned.");
  if (!confirmDelete) return;

  const groups = (activeGroupsClassData.labGroups || []).filter(g => g.id !== groupId);

  if (activeGroupsClassId === 'sample_class_49c') {
    GLOBAL_SAMPLE_CLASS.labGroups = groups;
  }

  firestore.collection('classes').doc(activeGroupsClassId).update({
    labGroups: groups
  })
  .then(() => {
    loadGroupsData(activeGroupsClassId);
  })
  .catch(err => {
    console.error("Error deleting group in Firestore:", err);
    if (activeGroupsClassId === 'sample_class_49c') {
      loadGroupsData(activeGroupsClassId);
    } else {
      alert("Failed to delete group: " + err.message);
    }
  });
}

function saveLabGroupLink(groupId) {
  if (!activeGroupsClassId || !activeGroupsClassData) return;
  const linkInput = document.getElementById(`link-input-${groupId}`);
  if (!linkInput) return;

  const linkVal = linkInput.value.trim();
  const groups = activeGroupsClassData.labGroups || [];
  const group = groups.find(g => g.id === groupId);
  if (group) {
    group.experimentLink = linkVal;
  }

  if (activeGroupsClassId === 'sample_class_49c') {
    GLOBAL_SAMPLE_CLASS.labGroups = groups;
  }

  firestore.collection('classes').doc(activeGroupsClassId).update({
    labGroups: groups
  })
  .then(() => {
    alert("Experiment link saved successfully!");
    loadGroupsData(activeGroupsClassId);
  })
  .catch(err => {
    console.error("Error saving group link in Firestore:", err);
    if (activeGroupsClassId === 'sample_class_49c') {
      alert("Experiment link saved successfully (Local Offline Mode)!");
      loadGroupsData(activeGroupsClassId);
    } else {
      alert("Failed to save link: " + err.message);
    }
  });
}

function addStudentToLabGroup(groupId) {
  if (!activeGroupsClassId || !activeGroupsClassData) return;
  const select = document.getElementById(`assign-select-${groupId}`);
  if (!select) return;

  const studentEmail = select.value;
  if (!studentEmail) {
    alert("Please select a student to assign.");
    return;
  }

  const groups = activeGroupsClassData.labGroups || [];
  const group = groups.find(g => g.id === groupId);
  if (group) {
    if (!group.members) group.members = [];
    if (!group.members.includes(studentEmail)) {
      group.members.push(studentEmail);
    }
  }

  if (activeGroupsClassId === 'sample_class_49c') {
    GLOBAL_SAMPLE_CLASS.labGroups = groups;
  }

  firestore.collection('classes').doc(activeGroupsClassId).update({
    labGroups: groups
  })
  .then(() => {
    loadGroupsData(activeGroupsClassId);
  })
  .catch(err => {
    console.error("Error adding student to group in Firestore:", err);
    if (activeGroupsClassId === 'sample_class_49c') {
      loadGroupsData(activeGroupsClassId);
    } else {
      alert("Failed to assign student: " + err.message);
    }
  });
}

function removeStudentFromLabGroup(groupId, studentEmail) {
  if (!activeGroupsClassId || !activeGroupsClassData) return;

  const groups = activeGroupsClassData.labGroups || [];
  const group = groups.find(g => g.id === groupId);
  if (group && group.members) {
    group.members = group.members.filter(m => m.toLowerCase().trim() !== studentEmail.toLowerCase().trim());
  }

  if (activeGroupsClassId === 'sample_class_49c') {
    GLOBAL_SAMPLE_CLASS.labGroups = groups;
  }

  firestore.collection('classes').doc(activeGroupsClassId).update({
    labGroups: groups
  })
  .then(() => {
    loadGroupsData(activeGroupsClassId);
  })
  .catch(err => {
    console.error("Error removing student from group in Firestore:", err);
    if (activeGroupsClassId === 'sample_class_49c') {
      loadGroupsData(activeGroupsClassId);
    } else {
      alert("Failed to remove student: " + err.message);
    }
  });
}

window.renderFacultyGroupsView = renderFacultyGroupsView;
window.loadGroupsData = loadGroupsData;
window.createLabGroup = createLabGroup;
window.deleteLabGroup = deleteLabGroup;
window.saveLabGroupLink = saveLabGroupLink;
window.addStudentToLabGroup = addStudentToLabGroup;
window.removeStudentFromLabGroup = removeStudentFromLabGroup;
// ==========================================================================
// ADMIN CONSOLE REDESIGN & MULTI-ACCOUNT MANAGEMENT UTILITIES
// ==========================================================================
let adminActiveSubTab = 'overview';
let systemStatus = 'live';
let activeVersion = 'v2026.06.29_112223';
window.activeLiveVersion = '';
window.activeTestingVersion = '';

function syncSystemPhase() {
  return firestore.collection('system_settings').doc('config').get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      systemStatus = data.status || 'live';
      activeVersion = data.activeVersion || '';
      window.activeLiveVersion = data.liveVersion || '';
      window.activeTestingVersion = data.testingVersion || '';
    } else {
      firestore.collection('system_settings').doc('config').set({
        status: 'live',
        activeVersion: activeVersion,
        liveVersion: activeVersion,
        testingVersion: ""
      });
      window.activeLiveVersion = activeVersion;
      window.activeTestingVersion = "";
    }
    renderSystemPhaseHeader();
    enforceSystemPhaseShield();
  }).catch(err => {
    console.error("Error syncing system release phase:", err);
  });
}
window.syncSystemPhase = syncSystemPhase;

function renderSystemPhaseHeader() {
  const container = document.getElementById('system-phase-header-container');
  if (!container) return;
  
  const isAdmin = currentUser && (currentUserRole === 'admin' || (currentUser.roles && currentUser.roles.includes('admin')));
  
  if (isAdmin) {
    container.style.display = 'inline-flex';
    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 6px; font-family: 'Outfit', sans-serif;">
        <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Phase:</span>
        <button onclick="setSystemPhase('live')" class="role-switch-btn student ${systemStatus === 'live' ? 'active' : ''}" style="height: 30px; padding: 0 10px; font-size: 11.5px; border-color: #10b981; color: ${systemStatus === 'live' ? 'white' : '#10b981'}; background: ${systemStatus === 'live' ? '#10b981' : 'transparent'};">
          🟢 Live
        </button>
        <button onclick="setSystemPhase('testing')" class="role-switch-btn student ${systemStatus === 'testing' ? 'active' : ''}" style="height: 30px; padding: 0 10px; font-size: 11.5px; border-color: #f59e0b; color: ${systemStatus === 'testing' ? 'white' : '#f59e0b'}; background: ${systemStatus === 'testing' ? '#f59e0b' : 'transparent'};">
          🟡 Testing
        </button>
      </div>
    `;
  } else {
    container.style.display = 'none';
    container.innerHTML = '';
  }
}
window.renderSystemPhaseHeader = renderSystemPhaseHeader;

function setSystemPhase(phase) {
  const confirmMsg = `Switch system phase to ${phase.toUpperCase()}?`;
  
  showCustomConfirm(confirmMsg, (confirm) => {
    if (!confirm) return;
    
    firestore.collection('system_settings').doc('config').update({
      status: phase
    })
    .then(() => {
      showCustomAlert(`System phase updated to ${phase.toUpperCase()} successfully!`, "success");
      syncSystemPhase().then(() => {
        const livePref = window.activeLiveVersion ? 'backups/' + window.activeLiveVersion + '/' : '';
        const testingPref = window.activeTestingVersion ? 'backups/' + window.activeTestingVersion + '/' : '';
        
        localStorage.setItem('doc_lms_user_version_prefix', livePref);
        localStorage.setItem('doc_lms_admin_version_prefix', (phase === 'testing') ? testingPref : livePref);
        
        window.location.reload();
      });
    })
    .catch(err => {
      showCustomAlert("Error updating phase: " + err.message, "error");
    });
  });
}
window.setSystemPhase = setSystemPhase;

function enforceSystemPhaseShield() {
  // Blocking overlay is disabled. Testing Phase serves different versions dynamically!
  let shield = document.getElementById('testing-phase-shield');
  if (shield) {
    shield.remove();
  }
}
window.enforceSystemPhaseShield = enforceSystemPhaseShield;

function renderAdminConsoleView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  renderAdminSubTabContent();
}
window.renderAdminConsoleView = renderAdminConsoleView;

function switchAdminSubTab(tab) {
  const modeMap = {
    'overview': 'admin-dashboard',
    'requests': 'admin-requests',
    'roadmap': 'admin-roadmap',
    'users': 'admin-users',
    'applications': 'admin-applications',
    'feedback': 'admin-feedback',
    'backups': 'admin-backups',
    'logs': 'admin-logs'
  };
  const mode = modeMap[tab] || 'admin-dashboard';
  setMode(mode);
}
window.switchAdminSubTab = switchAdminSubTab;

function getAdminSubviewTitle() {
  switch (adminActiveSubTab) {
    case 'overview': return '📊 System Overview';
    case 'requests': return '🔔 Class Catalog & Requests';
    case 'roadmap': return '🗺️ Institutional Portal Roadmap';
    case 'users': return '👥 User Directory & Promotion';
    case 'applications': return '📋 Role Access Applications';
    case 'feedback': return '🐛 User Feedback & Bug Submissions';
    case 'backups': return '💾 Backup & Restore';
    case 'logs': return '📜 System Activity Audit Trails';
    default: return '🛡️ Admin Console';
  }
}

function handleAdminGlobalSearch(query) {
  const dropdown = document.getElementById('admin-global-search-results');
  if (!dropdown) return;
  
  if (!query || !query.trim()) {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    return;
  }
  
  const q = query.toLowerCase().trim();
  let resultsHTML = '';
  
  // 1. Users
  if (window.adminCachedUsers && window.adminCachedUsers.length > 0) {
    const matchedUsers = window.adminCachedUsers.filter(u => 
      (u.name && u.name.toLowerCase().includes(q)) || 
      (u.email && u.email.toLowerCase().includes(q))
    ).slice(0, 4);
    
    if (matchedUsers.length > 0) {
      resultsHTML += `<div style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; padding:4px 8px; border-bottom:1px solid var(--border-card);">👥 Users</div>`;
      matchedUsers.forEach(u => {
        resultsHTML += `
          <div onclick="selectGlobalSearchResult('users', '${escapeJsString(u.email)}')" class="search-result-item" style="padding:6px 12px; cursor:pointer; font-size:12px; display:flex; justify-content:space-between; align-items:center; border-radius:4px;">
            <span>👤 ${escapeHtml(u.name || u.email.split('@')[0])}</span>
            <span style="font-size:10.5px; color:var(--text-muted); text-transform:uppercase;">${escapeHtml(u.role || 'student')}</span>
          </div>
        `;
      });
    }
  }
  
  // 2. Classrooms
  if (window.adminCachedClasses && window.adminCachedClasses.length > 0) {
    const matchedClasses = window.adminCachedClasses.filter(c => 
      (c.courseName && c.courseName.toLowerCase().includes(q)) || 
      (c.section && c.section.toLowerCase().includes(q))
    ).slice(0, 4);
    
    if (matchedClasses.length > 0) {
      resultsHTML += `<div style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; padding:4px 8px; border-bottom:1px solid var(--border-card); margin-top:4px;">🏫 Classrooms</div>`;
      matchedClasses.forEach(c => {
        resultsHTML += `
          <div onclick="selectGlobalSearchResult('requests', '${escapeJsString(c.id)}')" class="search-result-item" style="padding:6px 12px; cursor:pointer; font-size:12px; display:flex; justify-content:space-between; align-items:center; border-radius:4px;">
            <span>📚 ${escapeHtml(c.courseName)} (Sec ${escapeHtml(c.section)})</span>
            <span style="font-size:10.5px; color:var(--text-muted); text-transform:uppercase;">${escapeHtml(c.status)}</span>
          </div>
        `;
      });
    }
  }

  // 3. Feedback
  if (window.adminCachedFeedback && window.adminCachedFeedback.length > 0) {
    const matchedFeedbacks = window.adminCachedFeedback.filter(f => 
      (f.subject && f.subject.toLowerCase().includes(q)) || 
      (f.description && f.description.toLowerCase().includes(q))
    ).slice(0, 4);
    
    if (matchedFeedbacks.length > 0) {
      resultsHTML += `<div style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; padding:4px 8px; border-bottom:1px solid var(--border-card); margin-top:4px;">🐛 Feedback</div>`;
      matchedFeedbacks.forEach(f => {
        resultsHTML += `
          <div onclick="selectGlobalSearchResult('feedback', '${escapeJsString(f.id)}')" class="search-result-item" style="padding:6px 12px; cursor:pointer; font-size:12px; display:flex; justify-content:space-between; align-items:center; border-radius:4px;">
            <span>${f.type === 'bug' ? '🐛' : '💡'} ${escapeHtml(f.subject)}</span>
            <span style="font-size:10.5px; color:var(--text-muted); text-transform:uppercase;">${escapeHtml(f.status)}</span>
          </div>
        `;
      });
    }
  }

  if (!resultsHTML) {
    dropdown.style.display = 'flex';
    dropdown.innerHTML = `<div style="padding:12px; text-align:center; font-size:12px; color:var(--text-muted); font-style:italic;">No matches found.</div>`;
    return;
  }
  
  dropdown.style.display = 'flex';
  dropdown.innerHTML = resultsHTML;
}
window.handleAdminGlobalSearch = handleAdminGlobalSearch;

function selectGlobalSearchResult(tab, id) {
  const modeMap = {
    'overview': 'admin-dashboard',
    'requests': 'admin-requests',
    'roadmap': 'admin-roadmap',
    'users': 'admin-users',
    'applications': 'admin-applications',
    'feedback': 'admin-feedback',
    'backups': 'admin-backups',
    'logs': 'admin-logs'
  };
  const mode = modeMap[tab] || 'admin-dashboard';
  setMode(mode);
  
  const dropdown = document.getElementById('admin-global-search-results');
  if (dropdown) dropdown.style.display = 'none';
  
  setTimeout(() => {
    if (tab === 'users') {
      const searchBox = document.getElementById('manage-accounts-search');
      if (searchBox) {
        searchBox.value = id;
        handleManageAccountsSearch(id);
      }
    } else if (tab === 'feedback') {
      const filterSelect = document.getElementById('admin-feedback-filter-status');
      if (filterSelect) {
        filterSelect.value = 'all';
        filterFeedbackList();
      }
    }
  }, 100);
}
window.selectGlobalSearchResult = selectGlobalSearchResult;

function escapeJsString(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function renderAdminSubTabContent() {
  const targetId = 'viewport-body';
  const container = document.getElementById(targetId);
  if (!container) return;

  let searchHtml = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-card); padding-bottom:12px; margin-bottom:20px; flex-wrap:wrap; gap:16px;">
      <h2 style="font-size:18px; font-weight:800; font-family:'Outfit',sans-serif; margin:0; color:var(--text-main);" id="admin-subview-title">
        ${getAdminSubviewTitle()}
      </h2>
      <div style="position:relative; width:300px; max-width:100%;">
        <input type="text" id="admin-global-search" placeholder="Quick Search (Ctrl+K)..." 
               oninput="handleAdminGlobalSearch(this.value)" 
               onfocus="handleAdminGlobalSearch(this.value)"
               style="width:100%; padding:8px 12px 8px 32px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12.5px; outline:none; box-sizing:border-box;">
        <span style="position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:14px; color:var(--text-muted);">🔍</span>
        <div id="admin-global-search-results" style="display:none; position:absolute; top:36px; right:0; left:0; z-index:9999; max-height:280px; overflow-y:auto; background:var(--bg-card); border:1px solid var(--border-card); border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.5); padding:6px; box-sizing:border-box; flex-direction:column; gap:4px;"></div>
      </div>
    </div>
  `;

  const subviewContentId = 'admin-subview-content';
  container.innerHTML = `
    ${searchHtml}
    <div id="${subviewContentId}"></div>
  `;

  switch (adminActiveSubTab) {
    case 'overview':
      loadAdminOverviewTab(subviewContentId);
      break;
    case 'requests':
      renderAdminRequestsView(subviewContentId);
      break;
    case 'users':
      renderAdminUsersView(subviewContentId);
      firestore.collection('students').get().then(snap => {
        window.adminCachedUsers = [];
        snap.forEach(doc => {
          window.adminCachedUsers.push(doc.data());
        });
      });
      break;
    case 'applications':
      renderAdminRoleApplications(subviewContentId);
      break;
    case 'feedback':
      renderAdminFeedbackView(subviewContentId);
      break;
    case 'roadmap':
      renderAdminRoadmapTab(subviewContentId);
      break;
    case 'backups':
      renderAdminBackupsTab(subviewContentId);
      break;

    case 'logs':
      renderAdminLogsTab(subviewContentId);
      break;
  }
}
window.renderAdminSubTabContent = renderAdminSubTabContent;

function loadAdminOverviewTab(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;

  container.innerHTML = `
    <div class="admin-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; text-align: left;">
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">👥 Total Enrolled Students</div>
        <div id="admin-stat-students" style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: var(--text-main);">...</div>
      </div>
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">🏫 Total Classrooms</div>
        <div id="admin-stat-classes" style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: var(--text-main);">...</div>
      </div>
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <div style="font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">🔔 Pending Approvals</div>
        <div id="admin-stat-pending" style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: #f59e0b;">...</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:24px;">
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 20px; border-radius: 14px; text-align: left;">
        <h3 style="font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif; margin: 0 0 8px 0; color: var(--text-main);">📅 Semester Configuration</h3>
        <p style="margin: 0 0 16px 0; font-size: 12.5px; color: var(--text-muted);">Configure official calendar limits for schedulers and clearance notices.</p>
        <div style="display: flex; flex-direction:column; gap: 12px;">
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <div style="display: flex; flex-direction: column; gap: 4px; flex:1; min-width: 120px;">
              <label style="font-size: 10px; font-weight: 700; color: var(--text-muted);">START DATE</label>
              <input type="date" id="admin-semester-start-date" style="padding: 8px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 12.5px; box-sizing:border-box;">
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; flex:1; min-width: 120px;">
              <label style="font-size: 10px; font-weight: 700; color: var(--text-muted);">END DATE</label>
              <input type="date" id="admin-semester-end-date" style="padding: 8px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 12.5px; box-sizing:border-box;">
            </div>
          </div>
          <button class="settings-btn-primary" onclick="saveSemesterDateConfig()" style="width: 100%; margin: 0; padding: 10px; font-size: 12.5px; font-weight:700;">Save Calendar Configuration</button>
        </div>
      </div>

      <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 20px; border-radius: 14px; text-align: left; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <h3 style="font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif; margin: 0 0 8px 0; color: var(--text-main);">🌐 Deployment Release Phase</h3>
          <p style="margin: 0 0 16px 0; font-size: 12.5px; color: var(--text-muted);">Change active release mode. Testing Phase routes admins to a separate test version while other users access the live site.</p>
        </div>
        <div style="display:flex; gap:10px;">
          <button onclick="setSystemPhase('live')" class="role-switch-btn student ${systemStatus === 'live' ? 'active' : ''}" style="flex:1; border-color: #10b981; color: ${systemStatus === 'live' ? 'white' : '#10b981'}; background: ${systemStatus === 'live' ? '#10b981' : 'transparent'}; font-weight:700; font-size:12.5px; height:38px;">🟢 Live</button>
          <button onclick="setSystemPhase('testing')" class="role-switch-btn student ${systemStatus === 'testing' ? 'active' : ''}" style="flex:1; border-color: #f59e0b; color: ${systemStatus === 'testing' ? 'white' : '#f59e0b'}; background: ${systemStatus === 'testing' ? '#f59e0b' : 'transparent'}; font-weight:700; font-size:12.5px; height:38px;">🟡 Testing Phase</button>
        </div>
      </div>
    </div>

    <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 20px; border-radius: 14px; text-align: left; margin-top: 20px;">
      <h3 style="font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif; margin: 0 0 12px 0; color: var(--text-main);">💾 Backup & Restore</h3>
      <div id="admin-overview-backups-container">
        <div style="font-size: 13.5px; color: var(--text-muted); font-style: italic; text-align:center; padding:12px;">Loading backups...</div>
      </div>
    </div>
  `;

  firestore.collection('students').get().then(snap => {
    const el = document.getElementById('admin-stat-students');
    if (el) el.innerText = snap.size;
  }).catch(() => {
    const el = document.getElementById('admin-stat-students');
    if (el) el.innerText = "0";
  });

  firestore.collection('classes').get().then(snap => {
    const elClasses = document.getElementById('admin-stat-classes');
    const elPending = document.getElementById('admin-stat-pending');
    let totalClasses = 0;
    let pendingClasses = 0;
    
    snap.forEach(doc => {
      const d = doc.data();
      totalClasses++;
      if (d.status === 'pending') pendingClasses++;
    });
    
    window.adminCachedClasses = [];
    snap.forEach(doc => {
      window.adminCachedClasses.push({ id: doc.id, ...doc.data() });
    });

    if (elClasses) elClasses.innerText = totalClasses;
    if (elPending) elPending.innerText = pendingClasses;
  }).catch(() => {
    const elClasses = document.getElementById('admin-stat-classes');
    const elPending = document.getElementById('admin-stat-pending');
    if (elClasses) elClasses.innerText = "0";
    if (elPending) elPending.innerText = "0";
  });

  const startInput = document.getElementById('admin-semester-start-date');
  const endInput = document.getElementById('admin-semester-end-date');
  if (startInput && semesterStartDate) startInput.value = semesterStartDate;
  if (endInput && semesterEndDate) endInput.value = semesterEndDate;

  loadOverviewBackupTable();
}
window.loadAdminOverviewTab = loadAdminOverviewTab;

function loadOverviewBackupTable() {
  const container = document.getElementById('admin-overview-backups-container');
  if (!container) return;

  firestore.collection('system_settings').doc('config').get()
    .then(configDoc => {
      const configData = configDoc.exists ? configDoc.data() : {};
      const liveVer = configData.liveVersion || '';
      const testingVer = configData.testingVersion || '';

      return fetch('backups/backup_index.json')
        .then(res => {
          if (!res.ok) throw new Error("No backup index found.");
          return res.json();
        })
        .then(backups => {
          return firestore.collection('backup_releases').get().then(snap => {
            const releaseStatuses = {};
            snap.forEach(doc => {
              releaseStatuses[doc.id] = doc.data().status;
            });

            if (!backups || backups.length === 0) {
              container.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); font-style: italic;">No backup versions recorded yet.</div>`;
              return;
            }

            // Resolve statuses first
            backups.forEach(b => {
              let status = b.status || 'Working';
              if (releaseStatuses[b.version]) {
                status = releaseStatuses[b.version];
              }
              if (b.version === liveVer) {
                status = 'Live';
              } else if (b.version === testingVer) {
                status = 'Testing';
              }
              b.resolvedStatus = status;
            });

            // Sort by date descending
            backups.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Select only three latest versions + live
            // If live is within the first three, show only three.
            let displayed = backups.slice(0, 3);
            const liveInTop3 = displayed.some(b => b.version === liveVer);
            if (!liveInTop3) {
              const liveBackup = backups.find(b => b.version === liveVer);
              if (liveBackup) {
                displayed.push(liveBackup);
              }
            }

            let html = `
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
                  <thead>
                    <tr style="border-bottom:1px dashed var(--border-card); color:var(--text-muted); font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">
                      <th style="padding:10px 6px;">Version Name</th>
                      <th style="padding:10px 6px; width:150px;">Backup Date</th>
                      <th style="padding:10px 6px;">Changelog Description</th>
                      <th style="padding:10px 6px; width:120px; text-align:center;">Status</th>
                    </tr>
                  </thead>
                  <tbody>
            `;

            displayed.forEach(b => {
              const dateStr = b.date ? new Date(b.date).toLocaleString() : 'N/A';
              const changelogStr = b.changelog || 'N/A';
              let statusBadge = '';

              if (b.resolvedStatus === 'Live') {
                statusBadge = '<span style="font-size:10.5px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); color:#10b981; padding:2px 6px; border-radius:4px; font-weight:700; text-transform:uppercase;">🟢 Live</span>';
              } else if (b.resolvedStatus === 'Testing') {
                statusBadge = '<span style="font-size:10.5px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); color:#f59e0b; padding:2px 6px; border-radius:4px; font-weight:700; text-transform:uppercase;">🟡 Testing</span>';
              } else if (b.resolvedStatus === 'Working') {
                statusBadge = '<span style="font-size:10.5px; background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.25); color:#0ea5e9; padding:2px 6px; border-radius:4px; font-weight:700; text-transform:uppercase;">🔵 Working</span>';
              } else if (b.resolvedStatus === 'Archived') {
                statusBadge = '<span style="font-size:10.5px; background:rgba(107,114,128,0.1); border:1px solid rgba(107,114,128,0.25); color:#9ca3af; padding:2px 6px; border-radius:4px; font-weight:700; text-transform:uppercase;">Archived</span>';
              }

              html += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                  <td style="padding:10px 6px; font-weight:700; color:var(--accent); font-family:monospace; font-size:11px;">${escapeHtml(b.version)}</td>
                  <td style="padding:10px 6px; color:var(--text-muted); font-size:11.5px;">${dateStr}</td>
                  <td style="padding:10px 6px; line-height:1.4; font-size:12px;">${escapeHtml(changelogStr)}</td>
                  <td style="padding:10px 6px; text-align:center;">${statusBadge}</td>
                </tr>
              `;
            });

            html += `
                  </tbody>
                </table>
              </div>
            `;
            container.innerHTML = html;
          });
        });
    })
    .catch(err => {
      console.error("Error loading overview backup table:", err);
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); font-style:italic;">Failed to load backup status.</div>`;
    });
}
window.loadOverviewBackupTable = loadOverviewBackupTable;



// ==========================================================================
// DYNAMIC INSTITUTIONAL PORTAL ROADMAP COMPONENT
// ==========================================================================
window.roadmapSortField = 'version';
window.roadmapSortAsc = false;
window.roadmapFilterStatus = 'active';

function compareVersions(a, b) {
  const clean = v => (v || '').replace(/[^0-9.]/g, '').split('.').map(Number);
  const partsA = clean(a);
  const partsB = clean(b);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA !== numB) return numA - numB;
  }
  return 0;
}
window.compareVersions = compareVersions;

function loadRoadmapData(callback) {
  firestore.collection('portal_roadmap').get().then(snap => {
    if (snap.empty) {
      // Seed default items
      const defaults = [
        {
          title: "Android App Admin Module",
          description: "Develop native Android app module supporting real-time push notifications and stockroom scan-clearances.",
          priority: "High",
          version: "v9.0",
          status: "active"
        },
        {
          title: "Shared Services Architecture",
          description: "Build reusable platform services: authentication, notification engine, universal search, centralized approval engine, and audit logs.",
          priority: "High",
          version: "v9.1",
          status: "active"
        },
        {
          title: "Student Progress & Clearance",
          description: "Implement learning progress tracking, automatic assessments clearance workflows, and unified student requests dashboard.",
          priority: "Medium",
          version: "v9.2",
          status: "active"
        },
        {
          title: "Faculty Advising & Workload",
          description: "Add department faculty teaching workloads, extensions/accreditation tracking, and academic advising modules.",
          priority: "Medium",
          version: "v9.3",
          status: "active"
        },
        {
          title: "Stockroom Re-engineering & Scan",
          description: "Implement logistical inventory re-engineering, barcode/QR scanning, automated safety stock alert threshold indicators, and digital locker integrations.",
          priority: "High",
          version: "v9.4",
          status: "active"
        },
        {
          title: "Hazardous Waste Management",
          description: "Develop PCO generator registration, wastewater treatment monitoring, and solid waste logging for environmental compliance.",
          priority: "High",
          version: "v9.5",
          status: "active"
        },
        {
          title: "Chairperson Executive Center",
          description: "Design and release the Chairperson dashboard with unified department KPIs, digital signatures, approval workflows, and statistics.",
          priority: "High",
          version: "v10.0",
          status: "active"
        },
        {
          title: "Workflow Standardization",
          description: "Standardize approval lifecycles, notification dispatches, and activity trails across all operational sub-modules.",
          priority: "Medium",
          version: "v10.1",
          status: "active"
        }
      ];
      
      const promises = defaults.map(item => firestore.collection('portal_roadmap').add(item));
      Promise.all(promises).then(() => {
        loadRoadmapData(callback);
      });
    } else {
      const items = [];
      snap.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      callback(items);
    }
  }).catch(err => {
    console.error("Error loading roadmap data:", err);
    callback([]);
  });
}
window.loadRoadmapData = loadRoadmapData;

function renderAdminRoadmapTab(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:20px;">
      <!-- Add New Item Form -->
      <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:14px; padding:18px; text-align:left; box-shadow:0 4px 12px rgba(0,0,0,0.02);">
        <h3 style="font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif; margin: 0 0 12px 0; color: var(--text-main); display:flex; align-items:center; gap:8px;">
          <span>➕</span> Add Roadmap Milestone
        </h3>
        <form id="add-roadmap-form" onsubmit="addRoadmapItem(event)" style="display:grid; grid-template-columns:1fr 1fr; gap:12px; align-items:end;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Module / Title:</label>
            <input type="text" id="roadmap-new-title" required placeholder="e.g. Mobile App API Integration" style="padding:8px 12px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12.5px; outline:none; box-sizing:border-box;">
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Scheduled Version:</label>
            <input type="text" id="roadmap-new-version" required placeholder="e.g. v9.2" style="padding:8px 12px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12.5px; outline:none; box-sizing:border-box;">
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Description / Scope:</label>
            <textarea id="roadmap-new-desc" required placeholder="Describe the objectives and requirements..." style="padding:8px 12px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12.5px; outline:none; min-height:60px; resize:vertical; font-family:inherit; box-sizing:border-box;"></textarea>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Priority weight:</label>
            <select id="roadmap-new-priority" style="padding:8px 12px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12.5px; outline:none; cursor:pointer; box-sizing:border-box;">
              <option value="High">🔴 High Priority</option>
              <option value="Medium" selected>🟡 Medium Priority</option>
              <option value="Low">🔵 Low Priority</option>
            </select>
          </div>
          <button type="submit" class="settings-btn-primary" style="margin:0; font-weight:700; font-size:12.5px; height:36px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;">
            <span>🚀</span> Add to Roadmap
          </button>
        </form>
      </div>

      <!-- Filters & Roadmap Table List -->
      <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:14px; padding:20px; text-align:left; box-shadow:0 4px 12px rgba(0,0,0,0.02);">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-card); padding-bottom:12px; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; gap:6px;">
            <button onclick="setRoadmapFilter('active')" class="role-switch-btn ${window.roadmapFilterStatus === 'active' ? 'active' : ''}" style="font-size:11.5px; padding:6px 12px; border-radius:6px; font-weight:600; cursor:pointer;">Active Roadmap</button>
            <button onclick="setRoadmapFilter('archived')" class="role-switch-btn ${window.roadmapFilterStatus === 'archived' ? 'active' : ''}" style="font-size:11.5px; padding:6px 12px; border-radius:6px; font-weight:600; cursor:pointer;">Archived (Done)</button>
            <button onclick="setRoadmapFilter('dismissed')" class="role-switch-btn ${window.roadmapFilterStatus === 'dismissed' ? 'active' : ''}" style="font-size:11.5px; padding:6px 12px; border-radius:6px; font-weight:600; cursor:pointer;">Dismissed</button>
            <button onclick="setRoadmapFilter('all')" class="role-switch-btn ${window.roadmapFilterStatus === 'all' ? 'active' : ''}" style="font-size:11.5px; padding:6px 12px; border-radius:6px; font-weight:600; cursor:pointer;">All Releases</button>
          </div>
          <div style="font-size:12.5px; color:var(--text-muted); font-weight:600;" id="roadmap-count-label">Loading milestones...</div>
        </div>

        <div id="roadmap-table-container" style="overflow-x:auto;"></div>
      </div>
    </div>
  `;

  loadAndRenderRoadmapTable();
}
window.renderAdminRoadmapTab = renderAdminRoadmapTab;

function loadAndRenderRoadmapTable() {
  const container = document.getElementById('roadmap-table-container');
  if (!container) return;

  loadRoadmapData(items => {
    let filtered = items;
    if (window.roadmapFilterStatus !== 'all') {
      filtered = items.filter(item => item.status === window.roadmapFilterStatus);
    }

    const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
    
    filtered.sort((a, b) => {
      let comparison = 0;
      const field = window.roadmapSortField || 'version';
      
      if (field === 'priority') {
        const wA = priorityWeight[a.priority] || 0;
        const wB = priorityWeight[b.priority] || 0;
        comparison = wA - wB;
      } else if (field === 'version') {
        comparison = compareVersions(a.version, b.version);
      } else {
        const strA = (a[field] || '').toLowerCase();
        const strB = (b[field] || '').toLowerCase();
        comparison = strA.localeCompare(strB);
      }
      
      return window.roadmapSortAsc ? comparison : -comparison;
    });

    const countLabel = document.getElementById('roadmap-count-label');
    if (countLabel) {
      countLabel.innerText = `Total items: ${filtered.length}`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-muted); font-style:italic;">No milestones matching filter found.</div>`;
      return;
    }

    const getSortArrow = field => {
      if (window.roadmapSortField === field) {
        return window.roadmapSortAsc ? '▲' : '▼';
      }
      return '<span style="opacity:0.3; font-size:10px; margin-left:4px;">↕</span>';
    };

    let tbodyHtml = filtered.map(item => {
      let priorityBadge = '';
      if (item.priority === 'High') {
        priorityBadge = '<span style="font-size:11px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#ef4444; padding:2px 8px; border-radius:4px; font-weight:700;">High</span>';
      } else if (item.priority === 'Medium') {
        priorityBadge = '<span style="font-size:11px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); color:#f59e0b; padding:2px 8px; border-radius:4px; font-weight:700;">Medium</span>';
      } else {
        priorityBadge = '<span style="font-size:11px; background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.25); color:#0ea5e9; padding:2px 8px; border-radius:4px; font-weight:700;">Low</span>';
      }

      let statusBadge = '';
      if (item.status === 'active') {
        statusBadge = '<span style="font-size:11px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); color:#10b981; padding:2px 8px; border-radius:4px; font-weight:700;">Active</span>';
      } else if (item.status === 'archived') {
        statusBadge = '<span style="font-size:11px; background:rgba(107,114,128,0.1); border:1px solid rgba(107,114,128,0.25); color:#9ca3af; padding:2px 8px; border-radius:4px; font-weight:700;">Archived (Done)</span>';
      } else {
        statusBadge = '<span style="font-size:11px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); color:#ef4444; padding:2px 8px; border-radius:4px; font-weight:700;">Dismissed</span>';
      }

      let actionButtons = '';
      if (item.status === 'active') {
        actionButtons = `
          <button class="settings-btn-primary" onclick="updateRoadmapStatus('${item.id}', 'archived')" style="width:auto; margin:0; padding:4px 8px; font-size:11px; background:#10b981; border:none; color:white; border-radius:4px; cursor:pointer;" title="Mark Done (Archive)">Done</button>
          <button class="settings-btn-primary" onclick="updateRoadmapStatus('${item.id}', 'dismissed')" style="width:auto; margin:0; padding:4px 8px; font-size:11px; background:transparent; border:1px solid var(--border-card); color:var(--text-muted); border-radius:4px; cursor:pointer;" title="Dismiss from Roadmap">Dismiss</button>
        `;
      } else {
        actionButtons = `
          <button class="settings-btn-primary" onclick="updateRoadmapStatus('${item.id}', 'active')" style="width:auto; margin:0; padding:4px 8px; font-size:11px; background:#0ea5e9; border:none; color:white; border-radius:4px; cursor:pointer;" title="Restore to Active Roadmap">Restore</button>
        `;
      }
      
      actionButtons += `
        <button class="settings-btn-primary" onclick="deleteRoadmapItem('${item.id}')" style="width:auto; margin:0; padding:4px 8px; font-size:11px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:4px; cursor:pointer; margin-left:4px;" title="Delete Permanently">Delete</button>
      `;

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
          <td style="padding:12px 8px; font-weight:700; color:var(--accent); font-size:13px;">${escapeHtml(item.title)}</td>
          <td style="padding:12px 8px; color:var(--text-muted); line-height:1.4; font-size:12.5px;">${escapeHtml(item.description)}</td>
          <td style="padding:12px 8px; text-align:center;">${priorityBadge}</td>
          <td style="padding:12px 8px; text-align:center; font-family:monospace; font-weight:600; color:var(--text-main); font-size:12px;">${escapeHtml(item.version)}</td>
          <td style="padding:12px 8px; text-align:center;">${statusBadge}</td>
          <td style="padding:12px 8px; text-align:right;">
            <div style="display:flex; gap:4px; justify-content:flex-end;">
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px; color:var(--text-main); min-width:750px;">
        <thead>
          <tr style="border-bottom:2px solid var(--border-card); background:rgba(0,0,0,0.15); color:var(--text-muted); font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">
            <th onclick="toggleRoadmapSort('title')" style="padding:12px 8px; cursor:pointer; font-weight:700;">Module / Title ${getSortArrow('title')}</th>
            <th style="padding:12px 8px; font-weight:700; width:40%;">Description</th>
            <th onclick="toggleRoadmapSort('priority')" style="padding:12px 8px; cursor:pointer; font-weight:700; text-align:center;">Priority ${getSortArrow('priority')}</th>
            <th onclick="toggleRoadmapSort('version')" style="padding:12px 8px; cursor:pointer; font-weight:700; text-align:center; width:110px;">Version ${getSortArrow('version')}</th>
            <th onclick="toggleRoadmapSort('status')" style="padding:12px 8px; cursor:pointer; font-weight:700; text-align:center; width:130px;">Status ${getSortArrow('status')}</th>
            <th style="padding:12px 8px; font-weight:700; text-align:right; width:180px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${tbodyHtml}
        </tbody>
      </table>
    `;
  });
}
window.loadAndRenderRoadmapTable = loadAndRenderRoadmapTable;

function toggleRoadmapSort(field) {
  if (window.roadmapSortField === field) {
    window.roadmapSortAsc = !window.roadmapSortAsc;
  } else {
    window.roadmapSortField = field;
    window.roadmapSortAsc = true;
  }
  loadAndRenderRoadmapTable();
}
window.toggleRoadmapSort = toggleRoadmapSort;

function setRoadmapFilter(status) {
  window.roadmapFilterStatus = status;
  renderAdminRoadmapTab('admin-subview-content');
}
window.setRoadmapFilter = setRoadmapFilter;

function addRoadmapItem(event) {
  event.preventDefault();
  const title = document.getElementById('roadmap-new-title').value.trim();
  const version = document.getElementById('roadmap-new-version').value.trim();
  const description = document.getElementById('roadmap-new-desc').value.trim();
  const priority = document.getElementById('roadmap-new-priority').value;

  if (!title || !version || !description) return;

  const newItem = {
    title: title,
    version: version,
    description: description,
    priority: priority,
    status: 'active'
  };

  firestore.collection('portal_roadmap').add(newItem).then(() => {
    showCustomAlert("Roadmap milestone added successfully!", "success");
    logAdminActivity('roadmap_add', { title: title, version: version });
    document.getElementById('add-roadmap-form').reset();
    loadAndRenderRoadmapTable();
  }).catch(err => {
    console.error("Error adding roadmap item:", err);
    showCustomAlert("Failed to add roadmap item: " + err.message, "error");
  });
}
window.addRoadmapItem = addRoadmapItem;

function updateRoadmapStatus(id, newStatus) {
  firestore.collection('portal_roadmap').doc(id).update({
    status: newStatus
  }).then(() => {
    showCustomAlert(`Milestone status updated to ${newStatus.toUpperCase()} successfully!`, "success");
    logAdminActivity('roadmap_status_update', { docId: id, status: newStatus });
    loadAndRenderRoadmapTable();
  }).catch(err => {
    console.error("Error updating roadmap status:", err);
    showCustomAlert("Failed to update milestone status: " + err.message, "error");
  });
}
window.updateRoadmapStatus = updateRoadmapStatus;

function deleteRoadmapItem(id) {
  if (!confirm("Are you sure you want to permanently delete this roadmap milestone?")) return;

  firestore.collection('portal_roadmap').doc(id).delete().then(() => {
    showCustomAlert("Roadmap milestone deleted permanently.", "success");
    logAdminActivity('roadmap_delete', { docId: id });
    loadAndRenderRoadmapTable();
  }).catch(err => {
    console.error("Error deleting roadmap item:", err);
    showCustomAlert("Failed to delete milestone: " + err.message, "error");
  });
}
window.deleteRoadmapItem = deleteRoadmapItem;


function renderAdminBackupsTab(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;

  container.innerHTML = `
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:14px; padding:20px; text-align:left; box-shadow:0 4px 12px rgba(0,0,0,0.02);">
      
      <input type="text" id="backup-search" oninput="filterBackupsTable(this.value)" placeholder="🔍 Search backups by version name or changelog description..." style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12.5px; outline:none; box-sizing:border-box; margin-bottom:12px;">

      <div id="admin-backups-container">
        <div style="font-size: 13.5px; color: var(--text-muted); font-style: italic; text-align:center; padding:24px;">Loading backups catalog index...</div>
      </div>
    </div>
  `;

  loadBackupCatalog();
}
window.renderAdminBackupsTab = renderAdminBackupsTab;

function filterBackupsTable(query) {
  const tbody = document.querySelector('#admin-backups-tbody');
  const rows = document.querySelectorAll('.backup-row-item');
  if (!tbody || !rows) return;
  
  const q = query.toLowerCase().trim();
  rows.forEach(row => {
    const text = row.innerText.toLowerCase();
    if (text.includes(q)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}
window.filterBackupsTable = filterBackupsTable;

function renderAdminLogsTab(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;

  container.innerHTML = `
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:14px; padding:20px; text-align:left; box-shadow:0 4px 12px rgba(0,0,0,0.02);">
      <p style="margin:0 0 16px 0; font-size:13px; color:var(--text-muted);">Inspect system administration audit trails and operational logging records.</p>
      <div id="admin-activity-logs-container" style="display: flex; flex-direction: column; gap: 10px; max-height: 450px; overflow-y: auto; padding-right: 6px;">
        <div style="font-size: 13.5px; color: var(--text-muted); font-style: italic; text-align:center; padding:24px;">Loading activity audit logs...</div>
      </div>
    </div>
  `;

  loadAdminActivityLogs();
}
window.renderAdminLogsTab = renderAdminLogsTab;

// ==========================================================================
// USER BUG REPORT & FEATURE REQUESTS WORKSPACE
// ==========================================================================
function submitFeedbackForm(event) {
  event.preventDefault();
  if (!currentUser) return;
  
  const type = document.getElementById('feedback-type').value;
  const subject = document.getElementById('feedback-subject').value.trim();
  const description = document.getElementById('feedback-description').value.trim();
  const priority = document.getElementById('feedback-priority').value;
  const attachDevice = document.getElementById('feedback-attach-device').checked;
  
  let deviceDetails = null;
  if (attachDevice) {
    deviceDetails = {
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      platform: navigator.platform
    };
  }
  
  const feedbackData = {
    email: currentUser.email,
    name: currentUser.name || currentUser.email.split('@')[0],
    role: currentUserRole,
    type: type,
    subject: subject,
    description: description,
    priority: priority,
    deviceDetails: deviceDetails,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'pending_review',
    reply: ''
  };
  
  firestore.collection('feedback_submissions').add(feedbackData)
  .then(() => {
    showCustomAlert("Thank you! Your feedback has been submitted successfully.", "success");
    document.getElementById('settings-feedback-form').reset();
    closeSettings();
  })
  .catch(err => {
    showCustomAlert("Error submitting feedback: " + err.message, "error");
  });
}
window.submitFeedbackForm = submitFeedbackForm;

function renderAdminFeedbackView(targetId = 'admin-viewport-body') {
  const container = document.getElementById(targetId);
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:left;">
      <p style="margin:0 0 16px 0; font-size:13px; color:var(--text-muted);">Manage bug reports and feature requests submitted by portal users.</p>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px; background:var(--bg-card); border:1px solid var(--border-card); padding:10px 16px; border-radius:12px;">
        <div style="display:flex; gap:8px;">
          <select id="admin-feedback-filter-type" onchange="filterFeedbackList()" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12.5px; cursor:pointer;">
            <option value="all">All Types</option>
            <option value="bug">🐛 Bugs</option>
            <option value="feature">💡 Features</option>
          </select>
          <select id="admin-feedback-filter-status" onchange="filterFeedbackList()" style="padding:6px 12px; border-radius:6px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12.5px; cursor:pointer;">
            <option value="all">All Statuses</option>
            <option value="pending_review">⏳ Pending Review</option>
            <option value="in_progress">⚙️ In Progress</option>
            <option value="resolved">✅ Resolved</option>
            <option value="dismissed">❌ Dismissed</option>
          </select>
        </div>
      </div>
      
      <div id="admin-feedback-list-container" style="display:flex; flex-direction:column; gap:12px;">
        <div style="text-align:center; padding:24px; color:var(--text-muted); font-style:italic;">Loading feedback submissions...</div>
      </div>
    </div>
  `;

  firestore.collection('feedback_submissions')
    .orderBy('timestamp', 'desc')
    .get()
    .then(snap => {
      window.adminCachedFeedback = [];
      snap.forEach(doc => {
        window.adminCachedFeedback.push({ id: doc.id, ...doc.data() });
      });
      filterFeedbackList();
    })
    .catch(err => {
      console.error("Error loading feedback submissions:", err);
      const listContainer = document.getElementById('admin-feedback-list-container');
      if (listContainer) {
        listContainer.innerHTML = `<div style="color:var(--incorrect); text-align:center; padding:12px;">⚠️ Failed to load feedback: ${err.message}</div>`;
      }
    });
}
window.renderAdminFeedbackView = renderAdminFeedbackView;

function filterFeedbackList() {
  const listContainer = document.getElementById('admin-feedback-list-container');
  if (!listContainer || !window.adminCachedFeedback) return;

  const typeFilter = document.getElementById('admin-feedback-filter-type').value;
  const statusFilter = document.getElementById('admin-feedback-filter-status').value;

  const filtered = window.adminCachedFeedback.filter(f => {
    if (typeFilter !== 'all' && f.type !== typeFilter) return false;
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = `<div style="text-align:center; padding:24px; color:var(--text-muted); background:var(--bg-body); border:1px solid var(--border-card); border-radius:12px; font-size:13px;">No feedback submissions found matching criteria.</div>`;
    return;
  }

  let html = '';
  filtered.forEach(f => {
    const dateStr = f.timestamp 
      ? new Date(f.timestamp.seconds * 1000).toLocaleString() 
      : new Date().toLocaleString();

    const priorityBadge = f.priority === 'high' 
      ? '<span style="color:#ef4444; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase;">High</span>' 
      : (f.priority === 'medium' 
          ? '<span style="color:#f59e0b; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase;">Medium</span>' 
          : '<span style="color:#10b981; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.2); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase;">Low</span>');

    const statusBadge = f.status === 'resolved'
      ? '<span style="color:#10b981; font-weight:700;">✅ Resolved</span>'
      : (f.status === 'in_progress'
          ? '<span style="color:#3b82f6; font-weight:700;">⚙️ In Progress</span>'
          : (f.status === 'dismissed'
              ? '<span style="color:#9ca3af; font-weight:700;">❌ Dismissed</span>'
              : '<span style="color:#f59e0b; font-weight:700;">⏳ Pending Review</span>'));

    html += `
      <div style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:10px; text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
          <div>
            <h4 style="margin:0 0 4px 0; font-size:14.5px; font-weight:700; display:flex; align-items:center; gap:8px;">
              <span>${f.type === 'bug' ? '🐛' : '💡'} ${escapeHtml(f.subject)}</span>
              ${priorityBadge}
            </h4>
            <div style="font-size:11.5px; color:var(--text-muted);">Submitted by: <strong>${escapeHtml(f.name)}</strong> (${escapeHtml(f.email)} - ${f.role.toUpperCase()}) | ${dateStr}</div>
          </div>
          <div style="font-size:12.5px;">${statusBadge}</div>
        </div>
        
        <p style="margin:0; font-size:13px; color:var(--text-main); white-space:pre-wrap; line-height:1.5;">${escapeHtml(f.description)}</p>
        
        ${f.deviceDetails ? `
          <div style="background:rgba(255,255,255,0.01); border:1px dashed var(--border-card); border-radius:8px; padding:8px 12px; font-size:11px; color:var(--text-muted); font-family:monospace; line-height:1.4;">
            📱 Client System: ${f.deviceDetails.platform} | Agent: ${f.deviceDetails.userAgent} | Size: ${f.deviceDetails.screenSize}
          </div>
        ` : ''}

        ${f.reply ? `
          <div style="background:rgba(13,148,136,0.05); border-left:3px solid var(--accent); padding:10px 14px; border-radius:0 8px 8px 0; font-size:12.5px; line-height:1.5;">
            <strong>💬 Admin Response:</strong> ${escapeHtml(f.reply)}
          </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px; border-top:1px solid rgba(255,255,255,0.02); padding-top:10px;">
          <select onchange="updateFeedbackStatus('${f.id}', this.value)" style="padding:6px; border-radius:6px; border:1px solid var(--border-card); background:var(--bg-card); color:var(--text-main); font-size:12px; cursor:pointer;">
            <option value="pending_review" ${f.status === 'pending_review' ? 'selected' : ''}>⏳ Pending Review</option>
            <option value="in_progress" ${f.status === 'in_progress' ? 'selected' : ''}>⚙️ In Progress</option>
            <option value="resolved" ${f.status === 'resolved' ? 'selected' : ''}>✅ Resolved</option>
            <option value="dismissed" ${f.status === 'dismissed' ? 'selected' : ''}>❌ Dismissed</option>
          </select>
          <button class="settings-btn-primary" onclick="replyToFeedback('${f.id}')" style="width:auto; margin:0; padding:6px 12px; font-size:12px; background:var(--accent); font-weight:600;">Reply 💬</button>
        </div>
      </div>
    `;
  });
  listContainer.innerHTML = html;
}
window.filterFeedbackList = filterFeedbackList;

function updateFeedbackStatus(docId, newStatus) {
  firestore.collection('feedback_submissions').doc(docId).update({
    status: newStatus
  })
  .then(() => {
    const f = window.adminCachedFeedback.find(item => item.id === docId);
    if (f) f.status = newStatus;
    showCustomAlert("Feedback status updated successfully!", "success");
    filterFeedbackList();
  })
  .catch(err => {
    showCustomAlert("Error updating feedback status: " + err.message, "error");
  });
}
window.updateFeedbackStatus = updateFeedbackStatus;

function replyToFeedback(docId) {
  const f = window.adminCachedFeedback.find(item => item.id === docId);
  if (!f) return;

  const replyText = prompt("Enter your response to the user:", f.reply || "");
  if (replyText === null) return;

  firestore.collection('feedback_submissions').doc(docId).update({
    reply: replyText.trim()
  })
  .then(() => {
    f.reply = replyText.trim();
    showCustomAlert("Response saved successfully!", "success");
    filterFeedbackList();
  })
  .catch(err => {
    showCustomAlert("Error saving response: " + err.message, "error");
  });
}
window.replyToFeedback = replyToFeedback;

// ==========================================================================
// NOTICE/TASKS INBOX MODULE
// ==========================================================================
function renderNoticeTasksView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <div style="text-align: left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:16px;">
        <h2 style="font-size: 20px; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0;">📬 Notice/Tasks Section</h2>
        <button class="settings-btn-primary" onclick="openAddTaskModal()" style="width:auto; margin:0; padding:8px 16px; font-size:12.5px;">➕ Create Task</button>
      </div>
      
      <p style="font-size: 13.5px; color: var(--text-muted); margin: 0 0 20px 0;">View action-required tasks and notification messages. Click any task to add personal notes, reminders, or rearrange priorities.</p>
      
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 14px; overflow-x: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; min-width: 600px;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border-card); background: rgba(255,255,255,0.01); color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 14px 16px; width: 40px; text-align:center;">Star</th>
              <th style="padding: 14px 16px; width: 160px;">From</th>
              <th style="padding: 14px 16px;">Task Content</th>
              <th style="padding: 14px 16px; width: 180px;">Action Needed</th>
              <th style="padding: 14px 16px; width: 120px; text-align:center;">Date Received</th>
              <th style="padding: 14px 16px; width: 230px; text-align:center;">Actions</th>
            </tr>
          </thead>
          <tbody id="notices-tasks-tbody">
            <tr>
              <td colspan="6" style="padding: 30px; text-align: center; color: var(--text-muted); font-style: italic;">Loading tasks list...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  loadNoticesTasks();
}
window.renderNoticeTasksView = renderNoticeTasksView;

function loadNoticesTasks() {
  const tbody = document.getElementById('notices-tasks-tbody');
  if (!tbody) return;

  firestore.collection('notices_tasks')
    .where('recipientEmail', '==', currentUser.email)
    .get()
    .then(snap => {
      let tasks = [];
      snap.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() });
      });

      if (tasks.length === 0) {
        seedMockTasks().then(() => {
          loadNoticesTasks();
        });
        return;
      }

      tasks.sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;
        const indexA = a.orderIndex || 0;
        const indexB = b.orderIndex || 0;
        if (indexA !== indexB) return indexA - indexB;
        const timeA = a.timestamp ? a.timestamp.seconds : 0;
        const timeB = b.timestamp ? b.timestamp.seconds : 0;
        return timeB - timeA;
      });

      window.adminCachedTasks = tasks;
      renderTasksTable(tasks);
    })
    .catch(err => {
      console.error("Error loading notices and tasks:", err);
      tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--incorrect);">⚠️ Error loading tasks: ${err.message}</td></tr>`;
    });
}
window.loadNoticesTasks = loadNoticesTasks;

function seedMockTasks() {
  const role = currentUserRole;
  let mockList = [];

  if (role === 'student') {
    mockList = [
      {
        recipientEmail: currentUser.email,
        senderEmail: 'ramon.eduque@msugensan.edu.ph',
        senderName: 'Prof. Ramon Eduque',
        content: 'Review CHM151 Syllabus outcomes. Ensure you understand the grading system and course policies.',
        actionNeeded: 'Read course syllabus',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        priority: true,
        personalNotes: '',
        reminderDate: '',
        orderIndex: 0
      },
      {
        recipientEmail: currentUser.email,
        senderEmail: 'ramon.eduque@msugensan.edu.ph',
        senderName: 'Lab Stockroom',
        content: 'Clearance notice: You have unreturned glassware (2 beakers, 1 graduated cylinder) from Experiment 3.',
        actionNeeded: 'Clear lab clearances',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        priority: false,
        personalNotes: '',
        reminderDate: '',
        orderIndex: 1
      }
    ];
  } else if (role === 'faculty') {
    mockList = [
      {
        recipientEmail: currentUser.email,
        senderEmail: 'ramon.eduque@msugensan.edu.ph',
        senderName: 'Lab Stockroom',
        content: 'CHM151 Section 49C student experiment groups are not set up. Students cannot submit requisitions.',
        actionNeeded: 'Assign lab groups',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        priority: true,
        personalNotes: '',
        reminderDate: '',
        orderIndex: 0
      },
      {
        recipientEmail: currentUser.email,
        senderEmail: 'ramon.eduque@msugensan.edu.ph',
        senderName: 'System Administrator',
        content: 'Reminder to publish the upcoming Midterm Quiz assessment to the student roster.',
        actionNeeded: 'Publish Midterm Quiz',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        priority: false,
        personalNotes: '',
        reminderDate: '',
        orderIndex: 1
      }
    ];
  } else if (role === 'laboratory') {
    mockList = [
      {
        recipientEmail: currentUser.email,
        senderEmail: 'ramon.eduque@msugensan.edu.ph',
        senderName: 'Prof. Ramon Eduque',
        content: 'Class CHM151 Section 49C has requested apparatus for Experiment 5 (Qualitative Analysis).',
        actionNeeded: 'Prepare apparatus kits',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        priority: true,
        personalNotes: '',
        reminderDate: '',
        orderIndex: 0
      }
    ];
  } else if (role === 'pco') {
    mockList = [
      {
        recipientEmail: currentUser.email,
        senderEmail: 'ramon.eduque@msugensan.edu.ph',
        senderName: 'Chem Lab',
        content: 'Wastewater pH log submitted. Acidic spill detected and neutralized in Room 302.',
        actionNeeded: 'Verify spill incident',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        priority: true,
        personalNotes: '',
        reminderDate: '',
        orderIndex: 0
      }
    ];
  } else {
    mockList = [
      {
        recipientEmail: currentUser.email,
        senderEmail: 'ramon.eduque@msugensan.edu.ph',
        senderName: 'Prof. Ramon Eduque',
        content: 'Class Creation Request: Inorganic Chemistry (Sec 49C). Syllabus attached.',
        actionNeeded: 'Approve class request',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        priority: true,
        personalNotes: '',
        reminderDate: '',
        orderIndex: 0
      }
    ];
  }

  const batch = firestore.batch();
  mockList.forEach(m => {
    const docRef = firestore.collection('notices_tasks').doc();
    batch.set(docRef, m);
  });
  return batch.commit();
}

function renderTasksTable(tasks) {
  const tbody = document.getElementById('notices-tasks-tbody');
  if (!tbody) return;

  let html = '';
  tasks.forEach((t, idx) => {
    const dateStr = t.timestamp 
      ? new Date(t.timestamp.seconds * 1000).toLocaleString() 
      : new Date().toLocaleString();

    const isPending = t.status !== 'completed';
    const rowStyle = isPending ? '' : 'style="opacity: 0.65; text-decoration: line-through;"';
    const starColor = t.priority ? '#f59e0b' : 'var(--text-muted)';
    const starText = t.priority ? '★' : '☆';

    html += `
      <tr ${rowStyle} style="border-bottom: 1px solid var(--border-card); cursor: pointer; transition: background 0.2s;" class="task-row" onclick="handleTaskRowClick(event, '${t.id}')">
        <td style="padding: 14px 16px; font-size: 16px; color: ${starColor}; text-align: center; cursor: pointer;" onclick="toggleTaskStar(event, '${t.id}')">${starText}</td>
        <td style="padding: 14px 16px; font-weight: 700; color: var(--text-main); line-height: 1.3;">${escapeHtml(t.senderName)}<br><span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">${escapeHtml(t.senderEmail)}</span></td>
        <td style="padding: 14px 16px; font-weight: 500; line-height: 1.5;">${escapeHtml(t.content)}
          ${t.reminderDate ? `<br><span style="font-size:10.5px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); color:#f59e0b; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block; font-family:'Outfit'; font-weight:600;">⏰ Reminder: ${new Date(t.reminderDate).toLocaleString()}</span>` : ''}
        </td>
        <td style="padding: 14px 16px; font-weight: 600;"><span style="color:var(--accent); font-family:'Outfit',sans-serif; text-transform:uppercase; font-size:11px; letter-spacing:0.5px;">${escapeHtml(t.actionNeeded)}</span></td>
        <td style="padding: 14px 16px; text-align: center; color: var(--text-muted); font-size: 11.5px;">${dateStr}</td>
        <td style="padding: 14px 16px; text-align: center;" onclick="event.stopPropagation()">
          <div style="display: flex; gap: 6px; justify-content: center; align-items:center; flex-wrap:wrap;">
            ${isPending ? `
              <button class="settings-btn-primary" onclick="markTaskDone('${t.id}')" style="width:auto; margin:0; padding:6px 10px; font-size:11.5px; background:#10b981; font-weight:700;">Done ✅</button>
            ` : ''}
            <button class="settings-btn-primary" onclick="dismissTask('${t.id}')" style="width:auto; margin:0; padding:6px 10px; font-size:11.5px; background:transparent; border:1px solid var(--border-card); color:var(--text-muted); font-weight:600;">Archive</button>
            <button class="settings-btn-primary" onclick="replyTask('${t.id}')" style="width:auto; margin:0; padding:6px 10px; font-size:11.5px; background:var(--accent); font-weight:700;">Reply 💬</button>
            <button class="settings-btn-primary" onclick="emailTaskSender('${t.id}')" style="width:auto; margin:0; padding:6px 10px; font-size:11.5px; background:#3b82f6; font-weight:700;">Email ✉️</button>
          </div>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function toggleTaskStar(event, docId) {
  event.stopPropagation();
  const t = window.adminCachedTasks.find(item => item.id === docId);
  if (!t) return;

  const newPriority = !t.priority;
  firestore.collection('notices_tasks').doc(docId).update({
    priority: newPriority
  })
  .then(() => {
    t.priority = newPriority;
    playSFX(true);
    loadNoticesTasks();
  })
  .catch(err => {
    console.error("Error updating priority:", err);
  });
}
window.toggleTaskStar = toggleTaskStar;

function markTaskDone(docId) {
  firestore.collection('notices_tasks').doc(docId).update({
    status: 'completed'
  })
  .then(() => {
    showCustomAlert("Task marked as completed!", "success");
    loadNoticesTasks();
  })
  .catch(err => {
    showCustomAlert("Error completing task: " + err.message, "error");
  });
}
window.markTaskDone = markTaskDone;

function dismissTask(docId) {
  showCustomConfirm("Are you sure you want to dismiss and delete this task notice?", (confirm) => {
    if (!confirm) return;

    firestore.collection('notices_tasks').doc(docId).delete()
    .then(() => {
      showCustomAlert("Notice dismissed successfully.", "success");
      loadNoticesTasks();
      closeActionDrawer();
    })
    .catch(err => {
      showCustomAlert("Error deleting notice: " + err.message, "error");
    });
  });
}
window.dismissTask = dismissTask;

function replyTask(docId) {
  const t = window.adminCachedTasks.find(item => item.id === docId);
  if (!t) return;

  const replyText = prompt(`Send a reply to ${t.senderName}:`);
  if (!replyText || !replyText.trim()) return;

  firestore.collection('notices_tasks').add({
    recipientEmail: t.senderEmail,
    senderEmail: currentUser.email,
    senderName: currentUser.name || currentUser.email.split('@')[0],
    content: `Reply to: "${t.content}"<br><br>💬 "${replyText.trim()}"`,
    actionNeeded: 'Reply notice',
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'pending',
    priority: true,
    personalNotes: '',
    reminderDate: '',
    orderIndex: 0
  })
  .then(() => {
    showCustomAlert("Reply sent successfully as a task notice!", "success");
  })
  .catch(err => {
    showCustomAlert("Error sending reply: " + err.message, "error");
  });
}
window.replyTask = replyTask;

function emailTaskSender(docId) {
  const t = window.adminCachedTasks.find(item => item.id === docId);
  if (!t) return;

  const subject = encodeURIComponent(`RE: ${t.actionNeeded}`);
  const body = encodeURIComponent(`Hello ${t.senderName},\n\nRegarding the task: "${t.content}"\n\n[Write your message here]\n\nBest regards,\n\n${currentUser.name || currentUser.email}`);
  
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${t.senderEmail}&su=${subject}&body=${body}`, '_blank');

  firestore.collection('notices_tasks').doc(docId).update({
    status: 'completed'
  })
  .then(() => {
    showCustomAlert("Email client opened. Task has been marked as completed!", "success");
    loadNoticesTasks();
  })
  .catch(err => {
    console.error("Error updating task status:", err);
  });
}
window.emailTaskSender = emailTaskSender;

let activeDetailTaskId = null;

function handleTaskRowClick(event, docId) {
  if (event && event.target && (event.target.tagName === 'BUTTON' || event.target.onclick)) return;

  const t = window.adminCachedTasks.find(item => item.id === docId);
  if (!t) return;
  
  activeDetailTaskId = docId;
  
  const drawer = document.getElementById('action-drawer');
  const overlay = document.getElementById('action-drawer-overlay');
  const title = document.getElementById('action-drawer-title');
  const body = document.getElementById('action-drawer-body');
  const footer = document.getElementById('action-drawer-footer');
  
  if (!drawer || !body) return;
  
  title.innerText = "📋 Task / Notice Detail";
  
  body.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:16px; text-align:left; font-family:'Outfit',sans-serif;">
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:12px; padding:16px;">
        <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-bottom:4px;">Sender</div>
        <div style="font-size:13.5px; font-weight:700; color:var(--text-main);">${escapeHtml(t.senderName)} (${escapeHtml(t.senderEmail)})</div>
        <div style="border-top:1px solid var(--border-card); margin:12px 0;"></div>
        <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-bottom:4px;">Task Message</div>
        <div style="font-size:13px; line-height:1.5; color:var(--text-main);">${escapeHtml(t.content)}</div>
        <div style="border-top:1px solid var(--border-card); margin:12px 0;"></div>
        <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700; margin-bottom:4px;">Action Needed</div>
        <div style="font-size:13px; font-weight:700; color:var(--accent); text-transform:uppercase;">${escapeHtml(t.actionNeeded)}</div>
      </div>
      
      <div style="display:flex; flex-direction:column; gap:6px;">
        <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">✍️ Personal Notes</label>
        <textarea id="task-personal-notes" placeholder="Type personal notes or checklists here. Auto-saves on change..." style="width:100%; height:80px; padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-card); color:var(--text-main); font-size:12.5px; outline:none; resize:vertical;" onchange="saveTaskPersonalNotes('${t.id}', this.value)">${escapeHtml(t.personalNotes || '')}</textarea>
      </div>

      <div style="display:flex; flex-direction:column; gap:6px;">
        <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">⏰ Set Reminder Alarm</label>
        <div style="display:flex; gap:8px;">
          <input type="datetime-local" id="task-reminder-date" value="${t.reminderDate || ''}" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-card); color:var(--text-main); font-size:12.5px; outline:none;">
          <button class="settings-btn-primary" onclick="saveTaskReminder('${t.id}')" style="width:auto; margin:0; padding:8px 14px; font-size:12px; background:var(--accent); font-weight:700;">Set</button>
          ${t.reminderDate ? `<button class="settings-btn-primary" onclick="clearTaskReminder('${t.id}')" style="width:auto; margin:0; padding:8px 10px; font-size:12px; background:var(--incorrect); border:none;">Clear</button>` : ''}
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:12px; padding:12px 16px;">
        <span style="font-size:12.5px; font-weight:600; color:var(--text-main);">Star / Pin Task</span>
        <button class="settings-btn-primary" onclick="toggleTaskPriorityInline('${t.id}')" style="width:auto; margin:0; padding:6px 12px; font-size:12px; background:${t.priority ? '#f59e0b' : 'transparent'}; border:${t.priority ? 'none' : '1px solid var(--border-card)'}; color:${t.priority ? 'white' : 'var(--text-muted)'}; font-weight:700;">
          ${t.priority ? '★ Starred' : '☆ Star Task'}
        </button>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:12px; padding:12px 16px;">
        <span style="font-size:12.5px; font-weight:600; color:var(--text-main);">Arrange Order</span>
        <div style="display:flex; gap:6px;">
          <button class="settings-btn-primary" onclick="moveTaskOrder('${t.id}', -1)" style="width:auto; margin:0; padding:6px 10px; font-size:12px; background:transparent; border:1px solid var(--border-card); color:var(--text-main); font-weight:700;">▲ Up</button>
          <button class="settings-btn-primary" onclick="moveTaskOrder('${t.id}', 1)" style="width:auto; margin:0; padding:6px 10px; font-size:12px; background:transparent; border:1px solid var(--border-card); color:var(--text-main); font-weight:700;">▼ Down</button>
        </div>
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button class="settings-btn-primary" onclick="closeActionDrawer()" style="width:auto; margin:0; padding:8px 16px; font-size:13px; background:rgba(255,255,255,0.05); border:1px solid var(--border-card); color:var(--text-main);">Close Details</button>
  `;

  if (drawer && overlay) {
    drawer.classList.add('active');
    overlay.classList.add('active');
  }
}
window.handleTaskRowClick = handleTaskRowClick;

function saveTaskPersonalNotes(docId, val) {
  firestore.collection('notices_tasks').doc(docId).update({
    personalNotes: val.trim()
  })
  .then(() => {
    const t = window.adminCachedTasks.find(item => item.id === docId);
    if (t) t.personalNotes = val.trim();
  })
  .catch(err => {
    console.error("Error saving personal notes:", err);
  });
}
window.saveTaskPersonalNotes = saveTaskPersonalNotes;

function saveTaskReminder(docId) {
  const dateInput = document.getElementById('task-reminder-date');
  if (!dateInput) return;
  const val = dateInput.value;
  
  if (!val) {
    showCustomAlert("Please select a date and time.", "error");
    return;
  }

  firestore.collection('notices_tasks').doc(docId).update({
    reminderDate: val
  })
  .then(() => {
    showCustomAlert(`Reminder scheduled for ${new Date(val).toLocaleString()}`, "success");
    const t = window.adminCachedTasks.find(item => item.id === docId);
    if (t) t.reminderDate = val;
    loadNoticesTasks();
    handleTaskRowClick(null, docId);
  })
  .catch(err => {
    showCustomAlert("Error saving reminder: " + err.message, "error");
  });
}
window.saveTaskReminder = saveTaskReminder;

function clearTaskReminder(docId) {
  firestore.collection('notices_tasks').doc(docId).update({
    reminderDate: ''
  })
  .then(() => {
    showCustomAlert("Reminder cleared.", "success");
    const t = window.adminCachedTasks.find(item => item.id === docId);
    if (t) t.reminderDate = '';
    loadNoticesTasks();
    handleTaskRowClick(null, docId);
  })
  .catch(err => {
    showCustomAlert("Error clearing reminder: " + err.message, "error");
  });
}
window.clearTaskReminder = clearTaskReminder;

function toggleTaskPriorityInline(docId) {
  const t = window.adminCachedTasks.find(item => item.id === docId);
  if (!t) return;

  const newPriority = !t.priority;
  firestore.collection('notices_tasks').doc(docId).update({
    priority: newPriority
  })
  .then(() => {
    t.priority = newPriority;
    playSFX(true);
    loadNoticesTasks();
    handleTaskRowClick(null, docId);
  })
  .catch(err => {
    console.error("Error updating priority:", err);
  });
}
window.toggleTaskPriorityInline = toggleTaskPriorityInline;

function moveTaskOrder(docId, dir) {
  const t = window.adminCachedTasks.find(item => item.id === docId);
  if (!t) return;

  const currentIdx = window.adminCachedTasks.findIndex(item => item.id === docId);
  const targetIdx = currentIdx + dir;

  if (targetIdx < 0 || targetIdx >= window.adminCachedTasks.length) return;

  const targetTask = window.adminCachedTasks[targetIdx];
  const currentOrder = t.orderIndex || 0;
  const targetOrder = targetTask.orderIndex || 0;

  const batch = firestore.batch();
  batch.update(firestore.collection('notices_tasks').doc(docId), { orderIndex: targetOrder });
  batch.update(firestore.collection('notices_tasks').doc(targetTask.id), { orderIndex: currentOrder });

  batch.commit().then(() => {
    t.orderIndex = targetOrder;
    targetTask.orderIndex = currentOrder;
    playSFX(true);
    loadNoticesTasks();
    handleTaskRowClick(null, docId);
  })
  .catch(err => {
    console.error("Error reordering tasks:", err);
  });
}
window.moveTaskOrder = moveTaskOrder;

function openAddTaskModal() {
  const modalEl = document.getElementById('role-app-modal');
  const bodyEl = document.getElementById('role-app-modal-body');
  const titleEl = document.querySelector('#role-app-modal h3');
  
  if (!modalEl || !bodyEl) {
    const content = prompt("Enter task content:");
    if (!content) return;
    const action = prompt("Enter action needed:");
    if (!action) return;
    firestore.collection('notices_tasks').add({
      recipientEmail: currentUser.email,
      senderEmail: currentUser.email,
      senderName: 'Self',
      content: content,
      actionNeeded: action,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'pending',
      priority: false,
      personalNotes: '',
      reminderDate: '',
      orderIndex: 0
    }).then(() => loadNoticesTasks());
    return;
  }

  titleEl.innerHTML = `📬 Create Personal Task / Notice`;
  bodyEl.innerHTML = `
    <form id="create-task-form" onsubmit="submitNewTask(event)" style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Recipient Email (Optional, default is Self):</label>
        <input type="email" id="task-create-recipient" placeholder="e.g. self or user@msugensan.edu.ph" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Task Content / Message:</label>
        <textarea id="task-create-content" placeholder="Describe the notification or task message..." required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; height:70px; resize:vertical; outline:none; font-family:sans-serif;"></textarea>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Action Needed Label:</label>
        <input type="text" id="task-create-action" placeholder="e.g. Review documents, Clear record" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
      </div>
      <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
        <input type="checkbox" id="task-create-priority" style="width:14px; height:14px; cursor:pointer;">
        <label for="task-create-priority" style="font-size:11.5px; color:var(--text-muted); cursor:pointer;">Flag as High Priority Task</label>
      </div>
      <button type="submit" class="settings-btn-primary" style="margin-top:10px; font-weight:700;">📤 Save Task Notice</button>
    </form>
  `;
  modalEl.style.display = 'flex';
}
window.openAddTaskModal = openAddTaskModal;

function submitNewTask(event) {
  event.preventDefault();
  const recipient = document.getElementById('task-create-recipient').value.trim() || currentUser.email;
  const content = document.getElementById('task-create-content').value.trim();
  const action = document.getElementById('task-create-action').value.trim();
  const priority = document.getElementById('task-create-priority').checked;

  const newTask = {
    recipientEmail: recipient,
    senderEmail: currentUser.email,
    senderName: recipient === currentUser.email ? 'Self' : (currentUser.name || currentUser.email.split('@')[0]),
    content: content,
    actionNeeded: action,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    status: 'pending',
    priority: priority,
    personalNotes: '',
    reminderDate: '',
    orderIndex: 0
  };

  firestore.collection('notices_tasks').add(newTask)
  .then(() => {
    showCustomAlert("Task notice created successfully!", "success");
    closeRoleAppModal();
    if (currentMode === 'notice-tasks') {
      loadNoticesTasks();
    }
  })
  .catch(err => {
    showCustomAlert("Failed to create task notice: " + err.message, "error");
  });
}
window.submitNewTask = submitNewTask;
// ==========================================================================
// ADMIN DASHBOARD VIEW (CLASS REQUESTS & USER ROLES DIRECTORY)
// ==========================================================================
function renderAdminRequestsView(targetId = 'viewport-body') {
  const viewport = document.getElementById(targetId);
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <div id="admin-requests-container" style="text-align: left;">
      <h2 style="font-size: 20px; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0 0 16px 0; text-align: left;">🔔 Pending Class Requests</h2>
      
      <!-- Bulk Operations Controls -->
      <div id="admin-bulk-controls" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px; background:var(--bg-card); border:1px solid var(--border-card); padding:12px 16px; border-radius:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="select-all-pending" onchange="toggleSelectAllPending(this.checked)" style="width:16px; height:16px; cursor:pointer;">
          <label for="select-all-pending" style="font-size:12.5px; font-weight:700; cursor:pointer; font-family:'Outfit',sans-serif; color:var(--text-main);">Select All</label>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="settings-btn-primary" onclick="bulkApproveRequests(false)" style="width:auto; margin:0; padding:8px 12px; font-size:12px; background:#10b981;">Approve Selected ✅</button>
          <button class="settings-btn-primary" onclick="bulkDenyRequests(false)" style="width:auto; margin:0; padding:8px 12px; font-size:12px; background:var(--incorrect);">Deny Selected ❌</button>
          <button class="settings-btn-primary" onclick="bulkApproveRequests(true)" style="width:auto; margin:0; padding:8px 12px; font-size:12px; background:#047857;">Approve All 🏆</button>
          <button class="settings-btn-primary" onclick="bulkDenyRequests(true)" style="width:auto; margin:0; padding:8px 12px; font-size:12px; background:#b91c1c;">Deny All 🚨</button>
        </div>
      </div>

      <div class="empty-playlist-msg" id="admin-requests-loading">Loading requested classes...</div>
      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 32px;" id="admin-requests-list"></div>
      
      <h2 style="font-size: 20px; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0 0 16px 0; text-align: left; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <span>❌ Denied Class Requests</span>
        <button class="settings-btn-primary" id="clear-all-denied-btn" onclick="clearAllDeniedRequests()" style="width:auto; margin:0; padding:8px 14px; font-size:12px; background:var(--incorrect);">Clear All Denied 🗑️</button>
      </h2>
      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 32px;" id="admin-denied-list"></div>

      <h2 style="font-size: 20px; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0 0 16px 0; text-align: left;">🏛️ Active Classroom Catalog</h2>
      <div style="display:flex; flex-direction:column; gap:12px;" id="admin-catalog-list"></div>
    </div>
  `;

  firestore.collection('classes')
    .orderBy('createdAt', 'desc')
    .get()
    .then(querySnapshot => {
      const loadingEl = document.getElementById('admin-requests-loading');
      if (loadingEl) loadingEl.style.display = 'none';

      const listEl = document.getElementById('admin-requests-list');
      const deniedEl = document.getElementById('admin-denied-list');
      const catalogEl = document.getElementById('admin-catalog-list');
      if (!listEl || !deniedEl || !catalogEl) return;

      if (querySnapshot.empty) {
        listEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; font-size: 13px;">No class creation requests found.</div>`;
        deniedEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; font-size: 13px;">No denied class creation requests.</div>`;
        catalogEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; font-size: 13px;">No active classrooms in the catalog.</div>`;
        return;
      }

      let pendingHtml = '';
      let deniedHtml = '';
      let activeHtml = '';
      let pendingCount = 0;
      let deniedCount = 0;
      let activeCount = 0;

      querySnapshot.forEach(doc => {
        const classData = doc.data();
        const classId = doc.id;
        const status = classData.status || 'pending';
        const studentCount = classData.students ? classData.students.length : 0;

        if (status === 'pending') {
          pendingCount++;
          pendingHtml += `
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; text-align: left;">
              <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:240px;">
                <input type="checkbox" class="pending-request-checkbox" data-class-id="${classId}" style="width:18px; height:18px; cursor:pointer;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="font-family:'Outfit',sans-serif; font-weight:800; font-size:16px; color:var(--text-main);">${classData.courseName}</span>
                    <span style="font-size:10px; font-weight:700; color:white; background:var(--active-subject-color,#0ea5e9); padding:2px 6px; border-radius:4px;">Sec ${classData.section}</span>
                    <span class="class-status-badge pending">PENDING</span>
                  </div>
                  <div style="font-size:12.5px; color:var(--text-muted);">
                    Faculty: <strong>${classData.facultyName}</strong> (${classData.facultyEmail})
                  </div>
                  <div style="font-size:11.5px; color:var(--text-muted);">
                    Academic Year: ${classData.year}
                  </div>
                </div>
              </div>
              
              <div style="display:flex; gap:8px;">
                <button class="settings-btn-primary" onclick="approveClassRequest('${classId}')" style="width:auto; margin:0; padding:8px 14px; font-size:12px; background:#10b981;">Approve ✅</button>
                <button class="settings-btn-primary" onclick="denyClassRequest('${classId}')" style="width:auto; margin:0; padding:8px 14px; font-size:12px; background:var(--incorrect);">Deny ❌</button>
              </div>
            </div>
          `;
        } else if (status === 'denied') {
          deniedCount++;
          deniedHtml += `
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; text-align: left;">
              <div style="display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <span style="font-family:'Outfit',sans-serif; font-weight:800; font-size:16px; color:var(--text-main);">${classData.courseName}</span>
                  <span style="font-size:10px; font-weight:700; color:white; background:var(--active-subject-color,#0ea5e9); padding:2px 6px; border-radius:4px;">Sec ${classData.section}</span>
                  <span class="class-status-badge pending" style="background:#ef4444;">DENIED</span>
                </div>
                <div style="font-size:12.5px; color:var(--text-muted);">
                  Faculty: <strong>${classData.facultyName}</strong> (${classData.facultyEmail})
                </div>
                <div style="font-size:11.5px; color:var(--text-muted);">
                  Academic Year: ${classData.year}
                </div>
              </div>
              
              <div style="display:flex; gap:8px;">
                <button class="settings-btn-primary" onclick="approveClassRequest('${classId}')" style="width:auto; margin:0; padding:8px 14px; font-size:12px; background:#10b981;">Approve ✅</button>
                <button class="settings-btn-primary" onclick="deleteClassRequest('${classId}')" style="width:auto; margin:0; padding:8px 14px; font-size:12px; background:var(--incorrect);">Delete permanently 🗑️</button>
              </div>
            </div>
          `;
        } else {
          activeCount++;
          activeHtml += `
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; text-align: left;">
              <div style="display:flex; flex-direction:column; gap:4px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-family:'Outfit',sans-serif; font-weight:800; font-size:16px; color:var(--text-main);">${classData.courseName}</span>
                  <span style="font-size:10px; font-weight:700; color:white; background:var(--active-subject-color,#0ea5e9); padding:2px 6px; border-radius:4px;">Sec ${classData.section}</span>
                  <span class="class-status-badge approved">APPROVED</span>
                </div>
                <div style="font-size:12.5px; color:var(--text-muted);">
                  Faculty: <strong>${classData.facultyName}</strong> (${classData.facultyEmail})
                </div>
                <div style="font-size:11.5px; color:var(--text-muted);">
                  Students Enrolled: <strong>${studentCount}</strong> | Academic Year: ${classData.year}
                </div>
              </div>
              
              <div style="display:flex; gap:8px;">
                <button class="settings-btn-primary" onclick="deleteClassRequest('${classId}')" style="width:auto; margin:0; padding:8px 14px; font-size:12px; background:rgba(239,68,68,0.1); color:var(--incorrect); border:1px solid var(--incorrect);">Archive / Delete 📁</button>
              </div>
            </div>
          `;
        }
      });

      if (pendingCount === 0) {
        listEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; font-size: 13px;">No pending class creation requests.</div>`;
      } else {
        listEl.innerHTML = pendingHtml;
      }

      if (deniedCount === 0) {
        deniedEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; font-size: 13px;">No denied class creation requests.</div>`;
      } else {
        deniedEl.innerHTML = deniedHtml;
      }

      if (activeCount === 0) {
        catalogEl.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; font-size: 13px;">No active classrooms in the catalog.</div>`;
      } else {
        catalogEl.innerHTML = activeHtml;
      }

      const clearBtn = document.getElementById('clear-all-denied-btn');
      if (clearBtn) {
        if (deniedCount === 0) {
          clearBtn.disabled = true;
          clearBtn.style.opacity = '0.5';
          clearBtn.style.cursor = 'not-allowed';
        } else {
          clearBtn.disabled = false;
          clearBtn.style.opacity = '1';
          clearBtn.style.cursor = 'pointer';
        }
      }
    })
    .catch(err => {
      console.error("Error loading admin class requests:", err);
      const loadingEl = document.getElementById('admin-requests-loading');
      if (loadingEl) {
        loadingEl.innerHTML = `<span style="color:var(--incorrect);">⚠️ Error loading requests: ${err.message}</span>`;
      }
    });
}

function approveClassRequest(classId) {
  firestore.collection('classes').doc(classId).get()
    .then(doc => {
      if (!doc.exists) return;
      const classData = doc.data();
      return firestore.collection('classes').doc(classId).update({
        status: 'approved'
      }).then(() => {
        logAdminActivity('class_status', {
          classId: classId,
          status: 'approved',
          courseName: classData.courseName || classData.courseId || classId,
          section: classData.section || '',
          facultyName: classData.instructorName || classData.instructorEmail || ''
        });
      });
    })
    .then(() => {
      showCustomAlert("Classroom request approved successfully!", 'success');
      renderAdminRequestsView();
    })
    .catch(err => {
      console.error("Error approving class:", err);
      showCustomAlert("Failed to approve: " + err.message, 'error');
    });
}

function denyClassRequest(classId) {
  const proceed = (approved) => {
    if (!approved) return;

    firestore.collection('classes').doc(classId).get()
      .then(doc => {
        if (!doc.exists) return;
        const classData = doc.data();
        return firestore.collection('classes').doc(classId).update({
          status: 'denied'
        }).then(() => {
          logAdminActivity('class_status', {
            classId: classId,
            status: 'denied',
            courseName: classData.courseName || classData.courseId || classId,
            section: classData.section || '',
            facultyName: classData.instructorName || classData.instructorEmail || ''
          });
        });
      })
      .then(() => {
        showCustomAlert("Classroom request denied.", 'success');
        renderAdminRequestsView();
      })
      .catch(err => {
        console.error("Error denying class request:", err);
        showCustomAlert("Failed to deny: " + err.message, 'error');
      });
  };

  const confirmMsg = "Are you sure you want to deny this class request?";
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(confirmMsg, proceed);
  } else {
    const res = confirm(confirmMsg);
    proceed(res);
  }
}

function deleteClassRequest(classId) {
  const proceed = (approved) => {
    if (!approved) return;

    firestore.collection('classes').doc(classId).get()
      .then(doc => {
        if (!doc.exists) return;
        const classData = doc.data();
        return firestore.collection('classes').doc(classId).delete().then(() => {
          logAdminActivity('class_status', {
            classId: classId,
            status: 'deleted',
            courseName: classData.courseName || classData.courseId || classId,
            section: classData.section || '',
            facultyName: classData.instructorName || classData.instructorEmail || ''
          });
        });
      })
      .then(() => {
        showCustomAlert("Classroom record deleted successfully.", 'success');
        renderAdminRequestsView();
      })
      .catch(err => {
        console.error("Error deleting class:", err);
        showCustomAlert("Failed to delete record: " + err.message, 'error');
      });
  };

  const confirmMsg = "Are you sure you want to permanently delete this class record?";
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(confirmMsg, proceed);
  } else {
    const res = confirm(confirmMsg);
    proceed(res);
  }
}

function toggleSelectAllPending(checked) {
  const checkboxes = document.querySelectorAll('.pending-request-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
  });
}

function bulkApproveRequests(allPending) {
  let targetIds = [];
  if (allPending) {
    const checkboxes = document.querySelectorAll('.pending-request-checkbox');
    checkboxes.forEach(cb => targetIds.push(cb.getAttribute('data-class-id')));
  } else {
    const checkboxes = document.querySelectorAll('.pending-request-checkbox:checked');
    checkboxes.forEach(cb => targetIds.push(cb.getAttribute('data-class-id')));
  }

  if (targetIds.length === 0) {
    showCustomAlert("No pending requests selected.", 'warning');
    return;
  }

  const proceed = (approved) => {
    if (!approved) return;

    const batch = firestore.batch();
    targetIds.forEach(id => {
      const docRef = firestore.collection('classes').doc(id);
      batch.update(docRef, { status: 'approved' });
    });

    batch.commit()
      .then(() => {
        logAdminActivity('class_status', { bulk: true, action: 'approved', count: targetIds.length });
        showCustomAlert(`Successfully approved ${targetIds.length} class request(s)!`, 'success');
        renderAdminRequestsView();
      })
      .catch(err => {
        console.error("Error bulk approving classes:", err);
        showCustomAlert("Failed to bulk approve: " + err.message, 'error');
      });
  };

  const confirmMsg = `Are you sure you want to approve ${targetIds.length} class request(s)?`;
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(confirmMsg, proceed);
  } else {
    const res = confirm(confirmMsg);
    proceed(res);
  }
}

function bulkDenyRequests(allPending) {
  let targetIds = [];
  if (allPending) {
    const checkboxes = document.querySelectorAll('.pending-request-checkbox');
    checkboxes.forEach(cb => targetIds.push(cb.getAttribute('data-class-id')));
  } else {
    const checkboxes = document.querySelectorAll('.pending-request-checkbox:checked');
    checkboxes.forEach(cb => targetIds.push(cb.getAttribute('data-class-id')));
  }

  if (targetIds.length === 0) {
    showCustomAlert("No pending requests selected.", 'warning');
    return;
  }

  const proceed = (approved) => {
    if (!approved) return;

    const batch = firestore.batch();
    targetIds.forEach(id => {
      const docRef = firestore.collection('classes').doc(id);
      batch.update(docRef, { status: 'denied' });
    });

    batch.commit()
      .then(() => {
        logAdminActivity('class_status', { bulk: true, action: 'denied', count: targetIds.length });
        showCustomAlert(`Successfully denied ${targetIds.length} class request(s)!`, 'success');
        renderAdminRequestsView();
      })
      .catch(err => {
        console.error("Error bulk denying classes:", err);
        showCustomAlert("Failed to bulk deny: " + err.message, 'error');
      });
  };

  const confirmMsg = `Are you sure you want to deny ${targetIds.length} class request(s)?`;
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(confirmMsg, proceed);
  } else {
    const res = confirm(confirmMsg);
    proceed(res);
  }
}

function clearAllDeniedRequests() {
  if (!confirm("Are you sure you want to permanently clear/delete all denied class requests?")) return;

  firestore.collection('classes')
    .where('status', '==', 'denied')
    .get()
    .then(querySnapshot => {
      if (querySnapshot.empty) {
        alert("No denied requests to clear.");
        return;
      }

      const batch = firestore.batch();
      querySnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });

      return batch.commit().then(() => {
        alert(`Successfully cleared ${querySnapshot.size} denied request(s)!`);
        renderAdminRequestsView();
      });
    })
    .catch(err => {
      console.error("Error clearing denied requests:", err);
      alert("Failed to clear denied requests: " + err.message);
    });
}

window.renderAdminRequestsView = renderAdminRequestsView;
window.approveClassRequest = approveClassRequest;
window.denyClassRequest = denyClassRequest;
window.deleteClassRequest = deleteClassRequest;
window.toggleSelectAllPending = toggleSelectAllPending;
window.bulkApproveRequests = bulkApproveRequests;
window.bulkDenyRequests = bulkDenyRequests;
window.clearAllDeniedRequests = clearAllDeniedRequests;


let adminUsersSortColumn = 'name';
let adminUsersSortOrder = 'asc';

function toggleAdminUsersSort(column) {
  if (adminUsersSortColumn === column) {
    adminUsersSortOrder = adminUsersSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    adminUsersSortColumn = column;
    adminUsersSortOrder = 'asc';
  }
  renderAdminUsersView();
}
window.toggleAdminUsersSort = toggleAdminUsersSort;
function renderAdminUsersView(targetId = 'viewport-body') {
  const viewport = document.getElementById(targetId);
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <h2 style="font-size: 20px; font-weight: 800; font-family: 'Outfit', sans-serif; margin: 0 0 16px 0; text-align: left;">👥 User Directory</h2>
    <div class="empty-playlist-msg" id="admin-users-loading">Loading users list...</div>
    
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:16px; margin-bottom:16px; text-align: left;">
      <h4 style="margin:0 0 4px 0; font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">👥 Manage Accounts</h4>
      <p style="margin:0 0 12px 0; font-size:12px; color:var(--text-muted);">Search accounts by email or last name to modify their system access privileges.</p>
      
      <div style="position:relative;">
        <input type="text" id="manage-accounts-search" oninput="handleManageAccountsSearch(this.value)" placeholder="Search by email or last name..." style="width:100%; box-sizing:border-box; padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        <div id="manage-accounts-results" style="position:absolute; top:42px; left:0; right:0; z-index:100; display:none; flex-direction:column; max-height:220px; overflow-y:auto; background:var(--bg-card); border:1px solid var(--border-card); border-radius:8px; box-shadow:0 8px 16px rgba(0,0,0,0.25); padding:6px; box-sizing:border-box;"></div>
      </div>
      
      <div id="selected-user-management-area"></div>
    </div>

    <!-- Direct Provisioning & Bulk Upload Card -->
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:16px; margin-bottom:16px; text-align: left;">
      <h4 style="margin:0 0 4px 0; font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">🔑 Direct Provisioning & Bulk Upload</h4>
      <p style="margin:0 0 12px 0; font-size:12px; color:var(--text-muted);">Assign roles to a single email address or upload a file containing multiple emails (CSV, TXT) to perform a bulk role update.</p>
      
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Single Provisioning Form -->
        <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; border-bottom:1px dashed var(--border-card); padding-bottom:14px;">
          <div style="display:flex; flex-direction:column; gap:6px; flex-grow:1; min-width:200px;">
            <label style="font-size:11px; font-weight:600; color:var(--text-muted);">EMAIL ADDRESS</label>
            <input type="email" id="admin-provision-email" placeholder="e.g. professor@msugensan.edu.ph" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; box-sizing:border-box; width:100%; outline:none;">
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; min-width:180px;">
            <label style="font-size:11px; font-weight:600; color:var(--text-muted);">ROLE TO ASSIGN</label>
            <select id="admin-provision-role" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; font-weight:600; cursor:pointer; outline:none; height:38px;">
              <option value="faculty">Faculty</option>
              <option value="laboratory">Chemistry Stockroom</option>
              <option value="chairperson">Chairperson</option>
              <option value="pco_head">PCO Head</option>
              <option value="pco_laboratory">PCO Laboratory</option>
              <option value="pco_office">PCO Office</option>
              <option value="pco_college">PCO College</option>
              <option value="pco_ppd">PCO PPD</option>
              <option value="admin">Administrator</option>
              <option value="student">Student</option>
            </select>
          </div>
          <button class="settings-btn-primary" onclick="adminProvisionSingleEmail()" style="width:auto; margin:0; padding:10px 18px; font-size:13px; background:var(--accent); height:38px;">Assign Role</button>
        </div>

        <!-- Bulk Upload Form -->
        <div style="display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;">
          <div style="display:flex; flex-direction:column; gap:6px; flex-grow:1; min-width:200px;">
            <label style="font-size:11px; font-weight:600; color:var(--text-muted);">UPLOAD EMAILS FILE (.TXT / .CSV)</label>
            <input type="file" id="admin-provision-file" accept=".txt,.csv" style="padding:8px 10px; border-radius:8px; border:1px dashed var(--border-card); background:var(--bg-body); color:var(--text-muted); font-size:12px; cursor:pointer; width:100%; box-sizing:border-box; height:38px;">
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; min-width:180px;">
            <label style="font-size:11px; font-weight:600; color:var(--text-muted);">ROLE TO ASSIGN</label>
            <select id="admin-provision-bulk-role" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; font-weight:600; cursor:pointer; outline:none; height:38px;">
              <option value="faculty">Faculty</option>
              <option value="laboratory">Chemistry Stockroom</option>
              <option value="chairperson">Chairperson</option>
              <option value="pco_head">PCO Head</option>
              <option value="pco_laboratory">PCO Laboratory</option>
              <option value="pco_office">PCO Office</option>
              <option value="pco_college">PCO College</option>
              <option value="pco_ppd">PCO PPD</option>
              <option value="admin">Administrator</option>
              <option value="student">Student</option>
            </select>
          </div>
          <button class="settings-btn-primary" onclick="adminProvisionBulkFile()" style="width:auto; margin:0; padding:10px 18px; font-size:13px; background:#10b981; height:38px;">Batch Provision</button>
        </div>
      </div>
    </div>

    <div style="overflow-x:auto; border:1px solid var(--border-card); border-radius:12px; background:var(--bg-card); -webkit-overflow-scrolling:touch;">
      <table class="gradebook-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="padding:12px; cursor:pointer; color:var(--accent);" onclick="toggleAdminUsersSort('status')">Status ${adminUsersSortColumn === 'status' ? (adminUsersSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
            <th style="text-align:left; padding:12px; cursor:pointer; color:var(--accent);" onclick="toggleAdminUsersSort('name')">Name ${adminUsersSortColumn === 'name' ? (adminUsersSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
            <th style="text-align:left; padding:12px; cursor:pointer; color:var(--accent);" onclick="toggleAdminUsersSort('email')">Email ${adminUsersSortColumn === 'email' ? (adminUsersSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
            <th style="padding:12px; cursor:pointer; color:var(--accent);" onclick="toggleAdminUsersSort('role')">Role ${adminUsersSortColumn === 'role' ? (adminUsersSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
            <th style="padding:12px; cursor:pointer; color:var(--accent);" onclick="toggleAdminUsersSort('hours')">Hours Logged ${adminUsersSortColumn === 'hours' ? (adminUsersSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
            <th style="padding:12px; cursor:pointer; color:var(--accent);" onclick="toggleAdminUsersSort('studentId')">ID Number ${adminUsersSortColumn === 'studentId' ? (adminUsersSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
            <th style="padding:12px; cursor:pointer; color:var(--accent);" onclick="toggleAdminUsersSort('year')">Year ${adminUsersSortColumn === 'year' ? (adminUsersSortOrder === 'asc' ? '▲' : '▼') : ''}</th>
            <th style="padding:12px; text-align:center; width:170px;">Action</th>
          </tr>
        </thead>
        <tbody id="admin-users-table-body"></tbody>
      </table>
    </div>
  `;

  firestore.collection('students')
    .get()
    .then(querySnapshot => {
      const loadingEl = document.getElementById('admin-users-loading');
      if (loadingEl) loadingEl.style.display = 'none';

      const tbody = document.getElementById('admin-users-table-body');
      if (!tbody) return;

      if (querySnapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="8" style="padding:20px; text-align:center; color:var(--text-muted);">No onboarded student records found.</td></tr>`;
        return;
      }

      // Convert query snapshot to array of user objects
      let usersList = [];
      querySnapshot.forEach(doc => {
        const u = { email: doc.id, ...doc.data() };
        sanitizeUserRoles(u);
        usersList.push(u);
      });

      // Save to window for search lookups
      window.loadedAdminUsers = usersList;

      // Client-side sort logic
      usersList.sort((a, b) => {
        let valA = '';
        let valB = '';

        if (adminUsersSortColumn === 'status') {
          const now = Date.now();
          const lastActiveA = a.lastActive ? ((typeof a.lastActive.toMillis === 'function') ? a.lastActive.toMillis() : a.lastActive) : 0;
          const lastActiveB = b.lastActive ? ((typeof b.lastActive.toMillis === 'function') ? b.lastActive.toMillis() : b.lastActive) : 0;
          const isActiveA = lastActiveA && (now - lastActiveA < 900000);
          const isActiveB = lastActiveB && (now - lastActiveB < 900000);
          valA = isActiveA ? 1 : 0;
          valB = isActiveB ? 1 : 0;
        } else if (adminUsersSortColumn === 'name') {
          valA = (a.name || a.email.split('@')[0]).toLowerCase();
          valB = (b.name || b.email.split('@')[0]).toLowerCase();
        } else if (adminUsersSortColumn === 'email') {
          valA = a.email.toLowerCase();
          valB = b.email.toLowerCase();
        } else if (adminUsersSortColumn === 'role') {
          valA = (a.role || determineUserRole(a.email)).toLowerCase();
          valB = (b.role || determineUserRole(b.email)).toLowerCase();
        } else if (adminUsersSortColumn === 'hours') {
          valA = a.totalHoursLogged || 0;
          valB = b.totalHoursLogged || 0;
        } else if (adminUsersSortColumn === 'studentId') {
          valA = (a.studentId || '-').toLowerCase();
          valB = (b.studentId || '-').toLowerCase();
        } else if (adminUsersSortColumn === 'year') {
          valA = (a.year || '-').toLowerCase();
          valB = (b.year || '-').toLowerCase();
        }

        if (valA < valB) return adminUsersSortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return adminUsersSortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      let html = '';
      const now = Date.now();
      usersList.forEach(userData => {
        const email = userData.email;
        const assignedRole = userData.role || determineUserRole(email);
        const isSelf = email.toLowerCase().trim() === currentUser.email.toLowerCase().trim();

        // Calculate active/inactive status
        let lastActiveMs = 0;
        if (userData.lastActive) {
          lastActiveMs = (typeof userData.lastActive.toMillis === 'function') 
            ? userData.lastActive.toMillis() 
            : userData.lastActive;
        }
        
        const isActive = lastActiveMs && (now - lastActiveMs < 900000); // 15 mins
        
        let statusBadgeHtml = '';
        if (isActive) {
          statusBadgeHtml = `<span style="font-size:11px; font-weight:700; color:#10b981; display:inline-flex; align-items:center; justify-content:center; gap:4px;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981;"></span>Active</span>`;
        } else {
          let lastActiveText = 'Never';
          if (lastActiveMs) {
            const diffSecs = Math.floor((now - lastActiveMs) / 1000);
            if (diffSecs < 60) {
              lastActiveText = 'Just now';
            } else if (diffSecs < 3600) {
              const mins = Math.floor(diffSecs / 60);
              lastActiveText = `${mins}m ago`;
            } else if (diffSecs < 86400) {
              const hrs = Math.floor(diffSecs / 3600);
              lastActiveText = `${hrs}h ago`;
            } else {
              const days = Math.floor(diffSecs / 86400);
              lastActiveText = `${days}d ago`;
            }
          }
          statusBadgeHtml = `<span style="font-size:11px; font-weight:600; color:var(--text-muted); display:inline-flex; align-items:center; justify-content:center; gap:4px;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#6b7280;"></span>Offline (${lastActiveText})</span>`;
        }

        // Format total logged-in hours
        const hoursLogged = userData.totalHoursLogged || 0;
        const hoursText = `${hoursLogged.toFixed(2)} hrs`;

        // Resolve options for role dropdown
        let userRoles = userData.roles || [];
        if (assignedRole && !userRoles.includes(assignedRole)) {
          userRoles.push(assignedRole);
        }
        userRoles = [...new Set(userRoles)].filter(Boolean);

        let optionsHtml = `<option value="" disabled selected>Manage Roles...</option>`;
        
        optionsHtml += `<optgroup label="Academic Roles">`;
        const acadRoles = ['faculty', 'laboratory', 'admin', 'chairperson'];
        acadRoles.forEach(r => {
          if (userRoles.includes(r)) {
            optionsHtml += `<option value="remove_${r}">Remove ${r.charAt(0).toUpperCase() + r.slice(1)}</option>`;
          } else {
            optionsHtml += `<option value="add_${r}">Add ${r.charAt(0).toUpperCase() + r.slice(1)}</option>`;
          }
        });
        optionsHtml += `</optgroup>`;

        optionsHtml += `<optgroup label="PCO Category Roles">`;
        const pcoRoles = ['pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'];
        pcoRoles.forEach(r => {
          let label = r.replace('pco_', 'PCO ').replace(/\b\w/g, c => c.toUpperCase());
          if (userRoles.includes(r)) {
            optionsHtml += `<option value="remove_${r}">Remove ${label}</option>`;
          } else {
            optionsHtml += `<option value="add_${r}">Add ${label}</option>`;
          }
        });
        optionsHtml += `</optgroup>`;

        if (userRoles.length > 1 || (userRoles.length === 1 && userRoles[0] !== 'student')) {
          optionsHtml += `<option value="demote_student">Demote to Student</option>`;
        }

        let rolesBadgeHtml = `<div style="display:flex; flex-direction:column; gap:4px; align-items:center;">`;
        let rolesToRender = [...userRoles];
        if (rolesToRender.includes('admin')) {
          rolesToRender = ['admin'];
        }
        rolesToRender.forEach(r => {
          const isCurrentActiveRole = (r === assignedRole);
          const highlight = isActive && isCurrentActiveRole;
          
          let bg = 'rgba(107,114,128,0.1)';
          let color = 'var(--text-muted)';
          let border = '1px solid transparent';
          let shadow = 'none';
          
          if (r === 'admin') {
            bg = highlight ? '#10b981' : 'rgba(16,185,129,0.1)';
            color = highlight ? '#ffffff' : '#10b981';
            if (highlight) {
              border = '1px solid #10b981';
              shadow = '0 0 8px rgba(16,185,129,0.4)';
            }
          } else if (r === 'faculty') {
            bg = highlight ? '#3b82f6' : 'rgba(59,130,246,0.1)';
            color = highlight ? '#ffffff' : '#3b82f6';
            if (highlight) {
              border = '1px solid #3b82f6';
              shadow = '0 0 8px rgba(59,130,246,0.4)';
            }
          } else if (r === 'laboratory') {
            bg = highlight ? '#ec4899' : 'rgba(236,72,153,0.1)';
            color = highlight ? '#ffffff' : '#ec4899';
            if (highlight) {
              border = '1px solid #ec4899';
              shadow = '0 0 8px rgba(236,72,153,0.4)';
            }
          } else if (r === 'chairperson') {
            bg = highlight ? '#ef4444' : 'rgba(239,68,68,0.1)';
            color = highlight ? '#ffffff' : '#ef4444';
            if (highlight) {
              border = '1px solid #ef4444';
              shadow = '0 0 8px rgba(239,68,68,0.4)';
            }
          } else {
            bg = highlight ? '#6b7280' : 'rgba(107,114,128,0.1)';
            color = highlight ? '#ffffff' : 'var(--text-muted)';
            if (highlight) {
              border = '1px solid #6b7280';
              shadow = '0 0 8px rgba(107,114,128,0.4)';
            }
          }

          rolesBadgeHtml += `
            <span style="font-size:10px; font-weight:700; text-transform:uppercase; padding:3px 8px; border-radius:6px; 
              background: ${bg}; color: ${color}; border: ${border}; box-shadow: ${shadow}; display:inline-flex; align-items:center; gap:4px; min-width: 90px; justify-content: center;">
              ${highlight ? '<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#ffffff; animation: modalLogoFloat 1s ease-in-out infinite;"></span>' : ''}
              ${r}
            </span>
          `;
        });
        rolesBadgeHtml += `</div>`;

        html += `
          <tr>
            <td style="padding:12px;">${statusBadgeHtml}</td>
            <td style="text-align:left; padding:12px; font-weight:700;">${userData.name || email.split('@')[0]}</td>
            <td style="text-align:left; padding:12px; font-family:monospace; font-size:12px;">${email}</td>
            <td style="padding:12px;">
              ${rolesBadgeHtml}
            </td>
            <td style="padding:12px; font-weight:600; font-family:monospace;">${hoursText}</td>
            <td style="padding:12px;">${userData.studentId || '-'}</td>
            <td style="padding:12px;">${userData.year || '-'}</td>
            <td style="padding:12px; text-align:center;">
              ${isSelf ? `<span style="font-size:11px; color:var(--text-muted); font-style:italic;">Active Session</span>` : `
                <select onchange="handleUserRoleDropdownChange('${email}', '${escapeJsString(userData.name || email.split('@')[0])}', this)" 
                        style="padding:6px 10px; border-radius:6px; border:1px solid var(--border-card); background:var(--bg-card); color:var(--text-main); font-size:12px; font-weight:600; cursor:pointer; width:100%; max-width:145px; box-sizing:border-box; outline:none;">
                  ${optionsHtml}
                </select>
              `}
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    })
    .catch(err => {
      console.error("Error loading users list:", err);
      const loadingEl = document.getElementById('admin-users-loading');
      if (loadingEl) {
        loadingEl.innerHTML = `<span style="color:var(--incorrect);">⚠️ Error loading users: ${err.message}</span>`;
      }
    });
}

function logAdminActivity(type, details) {
  if (typeof firestore === 'undefined' || !firestore || !currentUser) return;
  
  const log = {
    type: type,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    adminEmail: currentUser.email,
    adminName: currentUser.name || currentUser.email.split('@')[0],
    details: details
  };

  firestore.collection('activity_logs').add(log)
    .then(() => console.log("Admin activity logged successfully"))
    .catch(err => console.error("Error logging admin activity:", err));
}
window.logAdminActivity = logAdminActivity;

function updateUserRoleDatabase(email, role) {
  const proceed = (approved) => {
    if (!approved) return;

    firestore.collection('students').doc(email).get()
      .then(doc => {
        let currentRoles = [];
        let userData = {};
        if (doc.exists) {
          userData = doc.data();
          currentRoles = userData.roles || [];
          const currentPrimaryRole = userData.role || determineUserRole(email);
          if (currentPrimaryRole && !currentRoles.includes(currentPrimaryRole)) {
            currentRoles.push(currentPrimaryRole);
          }
        } else {
          currentRoles = [determineUserRole(email)];
        }

        if (role === 'student') {
          currentRoles = ['student'];
        } else {
          currentRoles = currentRoles.filter(r => r !== 'student');
          if (!currentRoles.includes(role)) {
            currentRoles.push(role);
          }
        }

        currentRoles = [...new Set(currentRoles)].filter(Boolean);

        const updatedData = {
          ...userData,
          role: role,
          roles: currentRoles
        };

        if (!doc.exists) {
          updatedData.name = email.split('@')[0];
          updatedData.email = email;
          updatedData.studentId = "Placeholder";
          updatedData.subjects = [];
          updatedData.year = "1";
          updatedData.avatar = "chemistry_logo.png";
        }

        if (currentUser && email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) {
          currentUser.role = role;
          currentUser.roles = currentRoles;
          currentUserRole = role;
          localStorage.setItem('student_user_session', JSON.stringify(currentUser));
          localStorage.setItem('doc_lms_saved_profile', JSON.stringify(currentUser));
        }

        return firestore.collection('students').doc(email).set(updatedData).then(() => {
          logAdminActivity('role_change', {
            targetEmail: email,
            targetName: updatedData.name || email.split('@')[0],
            action: role === 'student' ? 'demote_student' : 'add_role',
            role: role,
            roles: currentRoles
          });
        });
      })
      .then(() => {
        showCustomAlert(`Successfully assigned role ${role.toUpperCase()} to ${email}`, 'success');
        
        if (currentUser && email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) {
          updateProfileUI();
          renderSidebarNavigation();
          buildUIFromManifest();
          setMode('home');
        }
        
        renderAdminUsersView();
      })
      .catch(err => {
        console.error("Error updating user role:", err);
        showCustomAlert("Failed to update user role: " + err.message, 'error');
      });
  };

  const confirmMsg = `Are you sure you want to change the role of ${email} to ${role.toUpperCase()}?`;
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(confirmMsg, proceed);
  } else {
    const res = confirm(confirmMsg);
    proceed(res);
  }
}

function handleUserRoleDropdownChange(email, name, selectElement) {
  const action = selectElement.value;
  if (!action) return;

  const resetSelect = () => { selectElement.value = ""; };

  let confirmMsg = "";
  let targetRole = "";
  let isAdd = false;
  let isRemove = false;
  let isDemote = false;

  if (action.startsWith("add_")) {
    targetRole = action.replace("add_", "");
    isAdd = true;
    confirmMsg = `Assign ${name} (${email}) to ${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)} role?`;
  } else if (action.startsWith("remove_")) {
    targetRole = action.replace("remove_", "");
    isRemove = true;
    confirmMsg = `Remove ${name} (${email}) from ${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)} role?`;
  } else if (action === "demote_student") {
    isDemote = true;
    confirmMsg = `Demote ${name} (${email}) to Student role? (This will clear all other assigned roles)`;
  }

  const proceed = (approved) => {
    if (!approved) {
      resetSelect();
      return;
    }

    firestore.collection('students').doc(email).get()
      .then(doc => {
        let currentRoles = [];
        let userData = {};
        if (doc.exists) {
          userData = doc.data();
          currentRoles = userData.roles || [];
          const currentPrimaryRole = userData.role || determineUserRole(email);
          if (currentPrimaryRole && !currentRoles.includes(currentPrimaryRole)) {
            currentRoles.push(currentPrimaryRole);
          }
        } else {
          currentRoles = [determineUserRole(email)];
        }

        if (isDemote) {
          currentRoles = ['student'];
          userData.role = 'student';
        } else if (isAdd) {
          currentRoles = currentRoles.filter(r => r !== 'student');
          if (!currentRoles.includes(targetRole)) {
            currentRoles.push(targetRole);
          }
          userData.role = targetRole;
        } else if (isRemove) {
          currentRoles = currentRoles.filter(r => r !== targetRole);
          if (currentRoles.length === 0) {
            currentRoles = ['student'];
            userData.role = 'student';
          } else {
            userData.role = currentRoles[0];
          }
        }

        currentRoles = [...new Set(currentRoles)].filter(Boolean);

        const updatedData = {
          ...userData,
          role: userData.role,
          roles: currentRoles
        };

        if (currentUser && email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) {
          currentUser.role = updatedData.role;
          currentUser.roles = currentRoles;
          currentUserRole = updatedData.role;
          localStorage.setItem('student_user_session', JSON.stringify(currentUser));
          localStorage.setItem('doc_lms_saved_profile', JSON.stringify(currentUser));
        }

        return firestore.collection('students').doc(email).set(updatedData).then(() => {
          logAdminActivity('role_change', {
            targetEmail: email,
            targetName: name,
            action: isDemote ? 'demote_student' : (isAdd ? 'add_role' : 'remove_role'),
            role: targetRole || 'student',
            roles: currentRoles
          });
        });
      })
      .then(() => {
        showCustomAlert(`Successfully updated roles for ${name}.`, 'success');
        
        if (currentUser && email.toLowerCase().trim() === currentUser.email.toLowerCase().trim()) {
          updateProfileUI();
          renderSidebarNavigation();
          buildUIFromManifest();
          setMode('home');
        }
        
        renderAdminUsersView();
      })
      .catch(err => {
        console.error("Error updating user roles:", err);
        showCustomAlert("Failed to update role: " + err.message, 'error');
        resetSelect();
      });
  };

  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(confirmMsg, proceed);
  } else {
    const res = confirm(confirmMsg);
    proceed(res);
  }
}
window.handleUserRoleDropdownChange = handleUserRoleDropdownChange;

function handleManageAccountsSearch(query) {
  const resultsContainer = document.getElementById('manage-accounts-results');
  if (!resultsContainer) return;

  if (!query.trim()) {
    resultsContainer.style.display = 'none';
    resultsContainer.innerHTML = '';
    return;
  }

  const q = query.toLowerCase().trim();
  const matched = (window.loadedAdminUsers || []).filter(u => {
    const name = (u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const nameParts = name.split(/\s+/);
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    return email.includes(q) || name.includes(q) || lastName.includes(q);
  });

  if (matched.length === 0) {
    resultsContainer.style.display = 'flex';
    resultsContainer.innerHTML = `<div style="padding: 8px; color: var(--text-muted); font-style: italic; font-size: 13px;">No accounts found matching "${query}"</div>`;
    return;
  }

  resultsContainer.style.display = 'flex';
  resultsContainer.innerHTML = matched.map(u => {
    const name = u.name || u.email.split('@')[0];
    const roleText = u.role || determineUserRole(u.email);
    return `
      <div onclick="selectUserForManagement('${u.email}', '${escapeJsString(name)}')" 
           style="padding: 8px; cursor: pointer; border-radius: 6px; transition: background 0.2s; font-size: 13px; display: flex; justify-content: space-between; align-items: center;"
           class="search-result-item">
        <span><strong>${escapeHtml(name)}</strong> <span style="color:var(--text-muted); font-family:monospace;">(${escapeHtml(u.email)})</span></span>
        <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05);">${roleText}</span>
      </div>
    `;
  }).join('');
}
window.handleManageAccountsSearch = handleManageAccountsSearch;

function selectUserForManagement(email, name) {
  document.getElementById('manage-accounts-search').value = '';
  document.getElementById('manage-accounts-results').style.display = 'none';

  const selectedArea = document.getElementById('selected-user-management-area');
  if (!selectedArea) return;

  const userData = (window.loadedAdminUsers || []).find(u => u.email === email);
  if (!userData) return;

  let userRoles = userData.roles || [];
  const primaryRole = userData.role || determineUserRole(email);
  if (primaryRole && !userRoles.includes(primaryRole)) {
    userRoles.push(primaryRole);
  }
  userRoles = [...new Set(userRoles)].filter(Boolean);

  let optionsHtml = `<option value="" disabled selected>Manage Roles...</option>`;
  
  optionsHtml += `<optgroup label="Academic Roles">`;
  const acadRoles = ['faculty', 'laboratory', 'admin', 'chairperson'];
  acadRoles.forEach(r => {
    if (userRoles.includes(r)) {
      optionsHtml += `<option value="remove_${r}">Remove ${r.charAt(0).toUpperCase() + r.slice(1)} role</option>`;
    } else {
      optionsHtml += `<option value="add_${r}">Add ${r.charAt(0).toUpperCase() + r.slice(1)} role</option>`;
    }
  });
  optionsHtml += `</optgroup>`;

  optionsHtml += `<optgroup label="PCO Category Roles">`;
  const pcoRoles = ['pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'];
  pcoRoles.forEach(r => {
    let label = r.replace('pco_', 'PCO ').replace(/\b\w/g, c => c.toUpperCase());
    if (userRoles.includes(r)) {
      optionsHtml += `<option value="remove_${r}">Remove ${label} role</option>`;
    } else {
      optionsHtml += `<option value="add_${r}">Add ${label} role</option>`;
    }
  });
  optionsHtml += `</optgroup>`;
  if (userRoles.length > 1 || (userRoles.length === 1 && userRoles[0] !== 'student')) {
    optionsHtml += `<option value="demote_student">Demote to Student</option>`;
  }

  selectedArea.innerHTML = `
    <div style="background:var(--bg-body); border:1px solid var(--border-card); padding:16px; border-radius:12px; margin-top:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; text-align:left;">
      <div>
        <h4 style="margin:0; font-size:14px; font-weight:700; color:var(--text-main); font-family:'Outfit',sans-serif;">Selected: ${escapeHtml(name)}</h4>
        <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-muted); font-family:monospace;">${escapeHtml(email)}</p>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <select onchange="handleUserRoleDropdownChange('${email}', '${escapeJsString(name)}', this)" 
                style="padding:10px 14px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-card); color:var(--text-main); font-size:13px; font-weight:600; cursor:pointer;">
          ${optionsHtml}
        </select>
        <button class="settings-btn-primary" onclick="clearSelectedUserManagement()" style="width:auto; margin:0; padding:10px 14px; font-size:13px; background:rgba(255,255,255,0.05); color:var(--text-muted); border:1px solid var(--border-card);">Clear</button>
      </div>
    </div>
  `;
}
window.selectUserForManagement = selectUserForManagement;

function clearSelectedUserManagement() {
  const selectedArea = document.getElementById('selected-user-management-area');
  if (selectedArea) selectedArea.innerHTML = '';
}
window.clearSelectedUserManagement = clearSelectedUserManagement;

function adminProvisionSingleEmail() {
  const emailInput = document.getElementById('admin-provision-email');
  const roleSelect = document.getElementById('admin-provision-role');
  if (!emailInput || !roleSelect) return;

  const email = emailInput.value.trim().toLowerCase();
  const role = roleSelect.value;

  if (!email) {
    showCustomAlert("Please enter a valid email address.", "error");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showCustomAlert("Please enter a valid email format.", "error");
    return;
  }

  const proceed = (approved) => {
    if (!approved) return;

    firestore.collection('students').doc(email).get().then(doc => {
      let userData = {};
      let currentRoles = [];

      if (doc.exists) {
        userData = doc.data();
        currentRoles = userData.roles || [];
      } else {
        userData = {
          name: email.split('@')[0],
          email: email,
          studentId: "Placeholder",
          subjects: [],
          year: "1",
          avatar: "chemistry_logo.png"
        };
      }

      if (role === 'student') {
        currentRoles = ['student'];
        userData.role = 'student';
      } else {
        currentRoles = currentRoles.filter(r => r !== 'student');
        if (!currentRoles.includes(role)) {
          currentRoles.push(role);
        }
        userData.role = role;
      }

      currentRoles = [...new Set(currentRoles)].filter(Boolean);
      const updatedData = {
        ...userData,
        role: userData.role,
        roles: currentRoles
      };

      return firestore.collection('students').doc(email).set(updatedData).then(() => {
        logAdminActivity('role_change', {
          targetEmail: email,
          targetName: userData.name,
          action: 'provision_direct',
          role: role,
          roles: currentRoles
        });
      });
    })
    .then(() => {
      showCustomAlert(`Successfully provisioned role ${role.toUpperCase()} to ${email}`, "success");
      emailInput.value = '';
      renderAdminUsersView();
    })
    .catch(err => {
      console.error("Error provisioning user:", err);
      showCustomAlert("Failed to provision user: " + err.message, "error");
    });
  };

  const confirmMsg = `Are you sure you want to provision the ${role.toUpperCase()} role to ${email}?`;
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(confirmMsg, proceed);
  } else {
    proceed(confirm(confirmMsg));
  }
}
window.adminProvisionSingleEmail = adminProvisionSingleEmail;

function adminProvisionBulkFile() {
  const fileInput = document.getElementById('admin-provision-file');
  const roleSelect = document.getElementById('admin-provision-bulk-role');
  if (!fileInput || !roleSelect) return;

  const file = fileInput.files[0];
  const role = roleSelect.value;

  if (!file) {
    showCustomAlert("Please select a .txt or .csv file to upload.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = text.match(emailRegex) || [];
    const emails = [...new Set(foundEmails.map(email => email.toLowerCase().trim()))];

    if (emails.length === 0) {
      showCustomAlert("No valid email addresses found in the uploaded file.", "error");
      return;
    }

    const proceed = (approved) => {
      if (!approved) return;

      const batch = firestore.batch();
      const promises = [];

      emails.forEach(email => {
        const ref = firestore.collection('students').doc(email);
        const p = ref.get().then(doc => {
          let userData = {};
          let currentRoles = [];

          if (doc.exists) {
            userData = doc.data();
            currentRoles = userData.roles || [];
          } else {
            userData = {
              name: email.split('@')[0],
              email: email,
              studentId: "Placeholder",
              subjects: [],
              year: "1",
              avatar: "chemistry_logo.png"
            };
          }

          if (role === 'student') {
            currentRoles = ['student'];
            userData.role = 'student';
          } else {
            currentRoles = currentRoles.filter(r => r !== 'student');
            if (!currentRoles.includes(role)) {
              currentRoles.push(role);
            }
            userData.role = role;
          }

          currentRoles = [...new Set(currentRoles)].filter(Boolean);
          const updatedData = {
            ...userData,
            role: userData.role,
            roles: currentRoles
          };

          batch.set(ref, updatedData);
        });
        promises.push(p);
      });

      Promise.all(promises).then(() => {
        return batch.commit().then(() => {
          logAdminActivity('bulk_role_provision', {
            emailsCount: emails.length,
            role: role
          });
        });
      })
      .then(() => {
        showCustomAlert(`Successfully provisioned role ${role.toUpperCase()} to ${emails.length} email(s) in bulk!`, "success");
        fileInput.value = '';
        renderAdminUsersView();
      })
      .catch(err => {
        console.error("Error bulk provisioning users:", err);
        showCustomAlert("Failed bulk provisioning: " + err.message, "error");
      });
    };

    const confirmMsg = `Are you sure you want to provision the ${role.toUpperCase()} role to all ${emails.length} email(s) parsed from the file?`;
    if (typeof showCustomConfirm === 'function') {
      showCustomConfirm(confirmMsg, proceed);
    } else {
      proceed(confirm(confirmMsg));
    }
  };

  reader.onerror = function() {
    showCustomAlert("Failed to read the uploaded file.", "error");
  };

  reader.readAsText(file);
}
window.adminProvisionBulkFile = adminProvisionBulkFile;

// --- 1. HOME MODULE ---
function renderLaboratoryDashboard() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  // Semester End date alert
  let reminderHTML = '';
  if (semesterEndDate) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const endDateObj = new Date(semesterEndDate);
    const diffTime = endDateObj - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 14) {
      reminderHTML = `
        <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">🔔</span>
          <div>
            <h4 style="margin: 0 0 2px 0; color: #f97316; font-size: 14px; font-weight: 700; font-family: 'Outfit', sans-serif;">End of Semester Reminder</h4>
            <p style="margin: 0; font-size: 12.5px; color: var(--text-muted);">The semester is scheduled to end on <strong>${semesterEndDate}</strong> (in ${diffDays} days). Please ensure all student accountabilities have been updated.</p>
          </div>
        </div>
      `;
    }
  }

  viewport.innerHTML = `
    ${reminderHTML}
    
    <div class="home-greeting-card" style="padding: 24px; background: rgba(13,148,136,0.05); border: 1px solid rgba(13,148,136,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
      <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--accent); margin: 0 0 8px 0;">🏢 Home Dashboard</h2>
      <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Welcome to the Chemistry Stockroom LIMS. You have administrative access.</p>
    </div>

    <!-- Stats Grid -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; text-align: left;">
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px; cursor: pointer;" onclick="setMode('lab-transactions'); activeLimsTransactionFilter='pending'; loadLimsTransactionsData();">
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">⌛ Pending Approval</div>
        <div id="stat-pending-approvals" style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: #f59e0b;">...</div>
      </div>
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px; cursor: pointer;" onclick="setMode('lab-transactions'); activeLimsTransactionFilter='approved'; loadLimsTransactionsData();">
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">📦 Current Releases</div>
        <div id="stat-current-releases" style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: #3b82f6;">...</div>
      </div>
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px; cursor: pointer;" onclick="setMode('lab-transactions'); activeLimsTransactionFilter='borrowed'; loadLimsTransactionsData();">
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">🧪 Borrowed Items</div>
        <div id="stat-borrowed-items" style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: #a855f7;">...</div>
      </div>
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px; cursor: pointer;" onclick="setMode('lab-transactions'); activeLimsTransactionFilter='overdue'; loadLimsTransactionsData();">
        <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">⚠️ Overdue Returns</div>
        <div id="stat-overdue-returns" style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: #ef4444;">...</div>
      </div>
    </div>

    <!-- Double Column: Timeline Feed & Quick Actions -->
    <div style="display: grid; grid-template-columns: 1fr 340px; gap: 20px; text-align: left; margin-bottom: 24px;">
      
      <!-- Timeline Feed -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 14px;">
        <h3 style="margin: 0; font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif; color: var(--text-main);">📅 Laboratory Timeline & Releases</h3>
        <div id="dashboard-timeline" class="lims-timeline">
          <div style="font-size: 12.5px; color: var(--text-muted);">Loading timeline...</div>
        </div>
      </div>

      <!-- Quick Actions and Today's Schedule -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Quick Actions -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 20px;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; font-family: 'Outfit', sans-serif;">⚡ Quick Actions</h3>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="settings-btn-primary" onclick="setMode('lab-transactions'); activeLimsTransactionFilter='pending'; loadLimsTransactionsData();" style="width:100%; margin:0; padding:10px 12px; font-size:12.5px; text-align:left; background:rgba(245,158,11,0.06); border:1px solid rgba(245,158,11,0.2); color:#f59e0b; display:flex; align-items:center; gap:8px;">
              <span>📋</span> Approve Requisition
            </button>
            <button class="settings-btn-primary" onclick="setMode('lab-transactions'); activeLimsTransactionFilter='approved'; loadLimsTransactionsData();" style="width:100%; margin:0; padding:10px 12px; font-size:12.5px; text-align:left; background:rgba(59,130,246,0.06); border:1px solid rgba(59,130,246,0.2); color:#3b82f6; display:flex; align-items:center; gap:8px;">
              <span>📦</span> Issue / Release Equipment
            </button>
            <button class="settings-btn-primary" onclick="setMode('lab-transactions'); activeLimsTransactionFilter='borrowed'; loadLimsTransactionsData();" style="width:100%; margin:0; padding:10px 12px; font-size:12.5px; text-align:left; background:rgba(168,85,247,0.06); border:1px solid rgba(168,85,247,0.2); color:#a855f7; display:flex; align-items:center; gap:8px;">
              <span>🧪</span> Receive Returns
            </button>
            <button class="settings-btn-primary" onclick="setMode('lab-students');" style="width:100%; margin:0; padding:10px 12px; font-size:12.5px; text-align:left; background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); color:#10b981; display:flex; align-items:center; gap:8px;">
              <span>👤</span> Add Manual Accountability
            </button>
            <button class="settings-btn-primary" onclick="setMode('lab-communication');" style="width:100%; margin:0; padding:10px 12px; font-size:12.5px; text-align:left; background:rgba(13,148,136,0.06); border:1px solid rgba(13,148,136,0.2); color:#0d9488; display:flex; align-items:center; gap:8px;">
              <span>📢</span> Post Announcement / Reminder
            </button>
            <button class="settings-btn-primary" onclick="triggerLimsChemicalWasteForm()" style="width:100%; margin:0; padding:10px 12px; font-size:12.5px; text-align:left; background:rgba(244,63,94,0.06); border:1px solid rgba(244,63,94,0.2); color:#f43f5e; display:flex; align-items:center; gap:8px;">
              <span>☣️</span> Log Spent Chemical Deposit
            </button>
            <button class="settings-btn-primary" onclick="triggerLimsWastewaterForm()" style="width:100%; margin:0; padding:10px 12px; font-size:12.5px; text-align:left; background:rgba(6,182,212,0.06); border:1px solid rgba(6,182,212,0.2); color:#06b6d4; display:flex; align-items:center; gap:8px;">
              <span>💧</span> Log Lab Effluent pH
            </button>
          </div>
        </div>

        <!-- Today's Classes -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 20px; text-align: left;">
          <h3 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; font-family: 'Outfit', sans-serif;">🔬 Today's Lab Schedules</h3>
          <div id="todays-schedules-container" style="display:flex; flex-direction:column; gap:8px;">
            <div style="font-size:12px; color:var(--text-muted); font-style:italic;">Checking schedule...</div>
          </div>
        </div>
      </div>

    </div>
  `;

  loadLimsDashboardStats();
}

function loadLimsDashboardStats() {
  if (typeof firestore === 'undefined' || !firestore) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  
  firestore.collection('requisitions').get()
    .then(snapshot => {
      let pendingApprovals = 0;
      let currentReleases = 0; // approved
      let borrowedItems = 0;
      let overdueReturns = 0;
      let timelineData = [];
      let todaysSchedules = [];

      const now = new Date();
      now.setHours(0,0,0,0);

      snapshot.forEach(doc => {
        const d = doc.data();
        const id = doc.id;
        
        if (d.status === 'pending') pendingApprovals++;
        else if (d.status === 'approved') currentReleases++;
        else if (d.status === 'borrowed') {
          borrowedItems++;
          // check if overdue
          if (d.scheduleDate) {
            const schedDate = new Date(d.scheduleDate);
            if (schedDate < now) {
              overdueReturns++;
            }
          }
        }

        if (d.scheduleDate === todayStr) {
          todaysSchedules.push({ id, ...d });
        }

        if (['approved', 'borrowed', 'returned', 'completed'].includes(d.status)) {
          timelineData.push({ id, ...d });
        }
      });

      // Update counters in UI
      const elPending = document.getElementById('lims-stat-pending');
      if (elPending) elPending.innerText = pendingApprovals;
      const elReleases = document.getElementById('lims-stat-approved');
      if (elReleases) elReleases.innerText = currentReleases;
      const elBorrowed = document.getElementById('lims-stat-borrowed');
      if (elBorrowed) elBorrowed.innerText = borrowedItems;
      const elOverdue = document.getElementById('lims-stat-overdue');
      if (elOverdue) elOverdue.innerText = overdueReturns;

      // Render today's schedule table
      const scheduleTbody = document.getElementById('lims-today-schedules-tbody');
      if (scheduleTbody) {
        if (todaysSchedules.length === 0) {
          scheduleTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No schedules set for today.</td></tr>`;
        } else {
          scheduleTbody.innerHTML = todaysSchedules.map(sch => `
            <tr>
              <td><strong>${escapeHtml(sch.groupName)}</strong></td>
              <td>${escapeHtml(sch.courseId ? sch.courseId.toUpperCase() : '')} (Sec ${escapeHtml(sch.section)})</td>
              <td>${escapeHtml(sch.scheduleTime)}</td>
              <td><span class="lims-status-badge ${sch.status}">${escapeHtml(sch.status)}</span></td>
              <td><button class="settings-btn-primary" onclick="setMode('lab-transactions'); showLimsTransactionDetails('${sch.id}');" style="padding:4px 8px; font-size:11px; margin:0;">View</button></td>
            </tr>
          `).join('');
        }
      }

      // Render timeline stepper list
      const timelineContainer = document.getElementById('lims-recent-activity-timeline');
      if (timelineContainer) {
        if (timelineData.length === 0) {
          timelineContainer.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">No recent laboratory activities.</div>`;
        } else {
          // Sort by timestamp desc and take top 4
          timelineData.sort((a, b) => {
            const tA = a.timestamp ? (a.timestamp.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime()) : 0;
            const tB = b.timestamp ? (b.timestamp.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime()) : 0;
            return tB - tA;
          });
          const displayData = timelineData.slice(0, 4);

          timelineContainer.innerHTML = displayData.map(item => {
            let statusText = 'Approved';
            let statusClass = '';
            if (item.status === 'borrowed') {
              statusText = 'Items Out';
              statusClass = 'active';
            } else if (item.status === 'returned') {
              statusText = 'Returned';
              statusClass = 'active';
            } else if (item.status === 'completed') {
              statusText = 'Completed / Cleared';
              statusClass = 'active';
            }
            return `
              <div class="lims-timeline-item ${statusClass}">
                <div class="lims-timeline-title">${escapeHtml(item.groupName)} &mdash; ${escapeHtml(item.courseId ? item.courseId.toUpperCase() : '')} (Sec ${escapeHtml(item.section)})</div>
                <div class="lims-timeline-desc">${statusText} | Schedule: ${escapeHtml(item.scheduleDate)} @ ${escapeHtml(item.scheduleTime)}</div>
              </div>
            `;
          }).join('');
        }
      }
    })
    .catch(err => {
      console.error("Error loading dashboard stats:", err);
    });
}

function sendFacultyReminder(facultyEmail, facultyName, studentName, subject, description) {
  const reminder = {
    type: 'accountability_reminder',
    targetEmail: facultyEmail,
    targetName: facultyName,
    subject: subject,
    message: `Student ${studentName} has a pending accountability for ${subject}: ${description}. Please follow up.`,
    sentBy: currentUser.email,
    sentByName: currentUser.name,
    sentAt: firebase.firestore.FieldValue.serverTimestamp(),
    read: false
  };

  return firestore.collection('notifications').add(reminder)
    .then(ref => {
      if (ref) {
        alert(`Reminder sent to faculty member: ${facultyName}.`);
      }
    })
    .catch(err => {
      console.error("Error sending faculty reminder:", err);
      alert("Failed to send faculty reminder: " + err.message);
    });
}


function sendBulkReminders(mode) {
  // mode: 'current' (active semester) or 'past' (previous uncleared)
  const currentSemester = getDefaultSemester();
  
  firestore.collection('accountabilities').where('status', '==', 'pending').get()
    .then(snap => {
      const targets = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (mode === 'current' && d.semester === currentSemester) {
          targets.push(d);
        } else if (mode === 'past' && d.semester !== currentSemester) {
          targets.push(d);
        }
      });
      
      if (targets.length === 0) {
        alert(mode === 'current' 
          ? "No pending accountabilities in the current semester." 
          : "No uncleared accountabilities from previous semesters.");
        return;
      }
      
      const confirmMsg = mode === 'current'
        ? `Send reminders to ${targets.length} students/faculty with pending accountabilities in ${currentSemester}?`
        : `Send reminders to ${targets.length} students/faculty with uncleared accountabilities from previous semesters?`;
      
      if (!confirm(confirmMsg)) return;
      
      const promises = [];
      const sentEmails = new Set();
      
      targets.forEach(t => {
        // Remind student
        if (t.studentEmail && t.studentEmail !== 'Unlinked Account' && !sentEmails.has(t.studentEmail)) {
          sentEmails.add(t.studentEmail);
          promises.push(firestore.collection('notifications').add({
            type: 'accountability_reminder',
            targetEmail: t.studentEmail,
            targetName: t.studentName,
            subject: t.subject,
            message: `You have a pending accountability for ${t.subject}: ${t.description}. Please settle your obligations with the Chemistry Stockroom.`,
            sentBy: currentUser.email,
            sentByName: currentUser.name,
            sentAt: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
          }));
        }
      });
      
      return Promise.all(promises).then(() => {
        alert(`Bulk reminders sent to ${promises.length} recipient(s).`);
      });
    })
    .catch(err => {
      console.error("Error sending bulk reminders:", err);
      alert("Failed to send bulk reminders: " + err.message);
    });
}

window.renderLaboratoryDashboard = renderLaboratoryDashboard;
window.sendFacultyReminder = sendFacultyReminder;
window.sendBulkReminders = sendBulkReminders;

function handleExcelUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  const file = files[0];

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert("The Excel file seems to be empty.");
        return;
      }

      console.log("Parsed Excel rows:", jsonData);
      processAccountabilityExcelRows(jsonData);
    } catch(err) {
      console.error("Error parsing Excel file:", err);
      alert("Failed to parse Excel file. Make sure it is a valid .xlsx or .xls file.");
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = ''; // Reset input
}

function processAccountabilityExcelRows(rows) {
  firestore.collection('classes').where('status', '==', 'approved').get()
    .then(classesSnap => {
      const activeClasses = [];
      classesSnap.forEach(doc => {
        activeClasses.push({ id: doc.id, ...doc.data() });
      });

      return firestore.collection('students').get().then(studentsSnap => {
        const studentProfiles = [];
        studentsSnap.forEach(doc => {
          studentProfiles.push({ email: doc.id, ...doc.data() });
        });

        let importedCount = 0;
        const promises = [];

        let defaultSemester = "AY2026-2027, First Semester";
        if (semesterEndDate) {
          const yearPart = parseInt(semesterEndDate.substring(0, 4), 10);
          const month = parseInt(semesterEndDate.substring(5, 7), 10);
          let term = "First Semester";
          let ayStart = yearPart;
          if (month >= 8) {
            ayStart = yearPart;
            term = "First Semester";
          } else if (month >= 1 && month <= 5) {
            ayStart = yearPart - 1;
            term = "Second Semester";
          } else {
            ayStart = yearPart - 1;
            term = "Summer";
          }
          defaultSemester = `AY${ayStart}-${ayStart + 1}, ${term}`;
        }
        
        const selectedSemester = prompt("Please confirm the Semester for this accountability upload:", defaultSemester) || defaultSemester;

        rows.forEach(row => {
          let studentName = "";
          let subject = "";
          let section = "";
          let faculty = "";
          let description = "";
          let semester = selectedSemester;

          for (const key in row) {
            const val = String(row[key]).trim();
            const keyLower = key.toLowerCase();
            if (keyLower.includes('name') || keyLower.includes('student') || keyLower.includes('fullname')) {
              studentName = val;
            } else if (keyLower.includes('subject') || keyLower.includes('course') || keyLower.includes('code')) {
              subject = val;
            } else if (keyLower.includes('section') || keyLower.includes('class')) {
              section = val;
            } else if (keyLower.includes('faculty') || keyLower.includes('instructor') || keyLower.includes('faculty')) {
              faculty = val;
            } else if (keyLower.includes('account') || keyLower.includes('item') || keyLower.includes('detail') || keyLower.includes('reason') || keyLower.includes('broken')) {
              description = val;
            } else if (keyLower.includes('semester') || keyLower.includes('term')) {
              semester = val;
            }
          }

          if (!studentName || !subject || !section) {
            console.log("Row missing critical details, skipping:", row);
            return;
          }

          let matchedEmail = null;

          const matchingClass = activeClasses.find(c => 
            (c.courseId.toLowerCase().trim() === subject.toLowerCase().trim() || c.courseName.toLowerCase().trim() === subject.toLowerCase().trim()) &&
            c.section.toLowerCase().trim() === section.toLowerCase().trim()
          );

          if (matchingClass && matchingClass.students) {
            const matchingProfile = studentProfiles.find(s => {
              const inClass = matchingClass.students.some(email => email.toLowerCase().trim() === s.email.toLowerCase().trim());
              if (!inClass) return false;
              
              const nameA = s.name.toLowerCase().replace(/[^a-z]/g, '');
              const nameB = studentName.toLowerCase().replace(/[^a-z]/g, '');
              return nameA.includes(nameB) || nameB.includes(nameA);
            });

            if (matchingProfile) {
              matchedEmail = matchingProfile.email;
            } else {
              const rosterMatch = matchingClass.students.find(email => {
                const prefix = email.split('@')[0].replace(/[^a-z]/g, '').toLowerCase();
                const nameB = studentName.toLowerCase().replace(/[^a-z]/g, '');
                return prefix.includes(nameB) || nameB.includes(prefix);
              });
              if (rosterMatch) matchedEmail = rosterMatch;
            }
          }

          const record = {
            studentName: studentName,
            studentEmail: matchedEmail,
            subject: subject,
            section: section,
            faculty: faculty || (matchingClass ? matchingClass.facultyName : "Unknown Faculty"),
            faculty: faculty || (matchingClass ? matchingClass.facultyName : "Unknown Faculty"),
            description: description || "Outstanding accountability",
            semester: semester,
            status: "pending",
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          };

          const p = firestore.collection('accountabilities')
            .where('studentName', '==', studentName)
            .where('subject', '==', subject)
            .where('section', '==', section)
            .where('description', '==', description)
            .where('semester', '==', semester)
            .get()
            .then(snap => {
              if (snap.empty) {
                importedCount++;
                return firestore.collection('accountabilities').add(record);
              } else {
                const docId = snap.docs[0].id;
                return firestore.collection('accountabilities').doc(docId).update({
                  status: 'pending',
                  studentEmail: matchedEmail,
                  timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
              }
            });
          promises.push(p);
        });

        return Promise.all(promises).then(() => {
          alert(`Excel upload complete! Imported/Updated ${importedCount} accountability records.`);
          loadStockroomClearanceData();
        });
      });
    })
    .catch(err => {
      console.error("Error processing Excel records:", err);
      alert("Error importing Excel rows: " + err.message);
    });
}

function editManualAccountability(id, name, subject, section, faculty, remarks, semester) {
  const cancelBtn = document.getElementById('manual-acc-cancel');
  if (cancelBtn) cancelBtn.style.display = 'inline-block';
  
  const title = document.getElementById('manual-accountability-form-title');
  if (title) title.innerText = "✏️ Edit Accountability Record";
  
  document.getElementById('manual-acc-id').value = id;
  document.getElementById('manual-acc-name').value = name;
  document.getElementById('manual-acc-subject').value = subject;
  document.getElementById('manual-acc-section').value = section;
  const facInput = document.getElementById('manual-acc-faculty') || document.getElementById('manual-acc-faculty');
  if (facInput) facInput.value = (faculty === 'Unknown Faculty' || faculty === 'undefined') ? '' : faculty;
  document.getElementById('manual-acc-remarks').value = remarks;
  
  const semesterSelect = document.getElementById('manual-acc-semester');
  if (semesterSelect) {
    const val = semester || getDefaultSemester();
    let exists = false;
    for (let i = 0; i < semesterSelect.options.length; i++) {
      if (semesterSelect.options[i].value === val) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.text = val;
      semesterSelect.add(opt);
    }
    semesterSelect.value = val;
  }
  
  const form = document.getElementById('manual-accountability-form');
  if (form) {
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function cancelManualAccountabilityEdit() {
  const cancelBtn = document.getElementById('manual-acc-cancel');
  if (cancelBtn) cancelBtn.style.display = 'none';
  
  const title = document.getElementById('manual-accountability-form-title');
  if (title) title.innerText = "📝 Add Accountability";
  
  document.getElementById('manual-acc-id').value = '';
  document.getElementById('manual-accountability-form').reset();
  
  const semesterSelect = document.getElementById('manual-acc-semester');
  if (semesterSelect) {
    semesterSelect.value = "AY2026-2027, First Semester";
  }
}

function handleManualAccountabilitySubmit(event) {
  event.preventDefault();
  
  const id = document.getElementById('manual-acc-id').value;
  const name = document.getElementById('manual-acc-name').value.trim();
  const subject = document.getElementById('manual-acc-subject').value.trim();
  const section = document.getElementById('manual-acc-section').value.trim();
  const facInput = document.getElementById('manual-acc-faculty') || document.getElementById('manual-acc-faculty');
  const faculty = facInput ? facInput.value.trim() : '';
  const remarks = document.getElementById('manual-acc-remarks').value.trim();
  const semester = document.getElementById('manual-acc-semester').value.trim();
  
  if (!name || !subject || !section || !remarks || !semester) {
    alert("Please fill in all required fields.");
    return;
  }
  
  let matchedEmail = null;

  const savePromise = firestore.collection('students').get().then(studentsSnap => {
    const studentProfiles = [];
    studentsSnap.forEach(doc => {
      studentProfiles.push({ email: doc.id, ...doc.data() });
    });

    const matchingProfile = studentProfiles.find(s => {
      const nameA = s.name.toLowerCase().replace(/[^a-z]/g, '');
      const nameB = name.toLowerCase().replace(/[^a-z]/g, '');
      return nameA.includes(nameB) || nameB.includes(nameA);
    });

    if (matchingProfile) {
      matchedEmail = matchingProfile.email;
    }
    
    if (id) {
      return firestore.collection('accountabilities').doc(id).update({
        studentName: name,
        studentEmail: matchedEmail,
        subject: subject,
        section: section,
        faculty: faculty || "Unknown Faculty",
        faculty: faculty || "Unknown Faculty",
        description: remarks,
        semester: semester
      });
    } else {
      const mainRecord = {
        studentName: name,
        studentEmail: matchedEmail,
        subject: subject,
        section: section,
        faculty: faculty || "Unknown Faculty",
        faculty: faculty || "Unknown Faculty",
        description: remarks,
        semester: semester,
        status: "pending",
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      const promises = [firestore.collection('accountabilities').add(mainRecord)];
      
      // Auto-group population per semester: only if single name added (no commas)
      if (!name.includes(',') && matchedEmail) {
        const pGroup = firestore.collection('classes').get().then(classesSnap => {
          const classPromises = [];
          classesSnap.forEach(classDoc => {
            const c = classDoc.data();
            const isMatch = (c.courseId.toLowerCase().trim() === subject.toLowerCase().trim() ||
                             c.courseName.toLowerCase().trim() === subject.toLowerCase().trim()) &&
                            c.section.toLowerCase().trim() === section.toLowerCase().trim();
            
            if (isMatch && c.labGroups) {
              const group = c.labGroups.find(g => g.members && g.members.some(m => m.toLowerCase().trim() === matchedEmail.toLowerCase().trim()));
              if (group) {
                const otherEmails = group.members.filter(m => m.toLowerCase().trim() !== matchedEmail.toLowerCase().trim());
                
                otherEmails.forEach(email => {
                  const profile = studentProfiles.find(p => p.email.toLowerCase().trim() === email.toLowerCase().trim());
                  const memberName = profile ? profile.name : email.split('@')[0];
                  const groupRecord = {
                    studentName: memberName,
                    studentEmail: email,
                    subject: subject,
                    section: section,
                    faculty: faculty || "Unknown Faculty",
                    faculty: faculty || "Unknown Faculty",
                    description: remarks,
                    semester: semester,
                    status: "pending",
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                  };
                  classPromises.push(firestore.collection('accountabilities').add(groupRecord));
                });
              }
            }
          });
          return Promise.all(classPromises);
        });
        promises.push(pGroup);
      }
      
      return Promise.all(promises);
    }
  });

  savePromise.then(() => {
    alert(id ? "Accountability record updated successfully!" : "Accountability record added successfully!");
    cancelManualAccountabilityEdit();
    loadStockroomClearanceData();
  }).catch(err => {
    console.error("Error saving manual accountability:", err);
    alert("Failed to save accountability record: " + err.message);
  });
}

function matchUnlinkedAccountabilities(studentEmail, studentName) {
  if (!studentEmail || !studentName) return Promise.resolve();
  const nameNorm = studentName.toLowerCase().replace(/[^a-z]/g, '');
  if (!nameNorm) return Promise.resolve();

  return firestore.collection('accountabilities')
    .get()
    .then(snap => {
      const promises = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!d.studentEmail || d.studentEmail === 'Unlinked Account') {
          const accNameNorm = d.studentName.toLowerCase().replace(/[^a-z]/g, '');
          if (accNameNorm && (accNameNorm.includes(nameNorm) || nameNorm.includes(accNameNorm))) {
            console.log(`Linking accountability doc ${doc.id} to student ${studentEmail}`);
            promises.push(
              firestore.collection('accountabilities').doc(doc.id).update({
                studentEmail: studentEmail
              })
            );
          }
        }
      });
      return Promise.all(promises);
    })
    .catch(err => {
      console.error("Error matching unlinked accountabilities:", err);
    });
}



// ==========================================================================
// STUDENT LABORATORY REQUISITION PORTAL
// ==========================================================================
let activeEditRequisitionId = null;

function renderStudentRequisitionView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser || !currentCourseId) return;

  const classData = activeStudentClassData[currentCourseId];
  if (!classData) {
    viewport.innerHTML = `<div class="empty-playlist-msg">Classroom details not found for this course.</div>`;
    return;
  }

  // Resolve student group and members
  let userGroup = null;
  let groupMembersEmails = [currentUser.email];
  if (classData.labGroups) {
    userGroup = classData.labGroups.find(g => g.members && g.members.map(m => m.toLowerCase().trim()).includes(currentUser.email.toLowerCase().trim()));
    if (userGroup) {
      groupMembersEmails = userGroup.members || [];
    }
  }

  const groupName = userGroup ? userGroup.name : "Individual";

  // Resolve full names of members first, then family names
  const promises = groupMembersEmails.map(email => 
    firestore.collection('students').doc(email.toLowerCase().trim()).get()
      .then(doc => doc.exists ? doc.data().name : email.split('@')[0])
      .catch(() => email.split('@')[0])
  );

  viewport.innerHTML = `<div class="empty-playlist-msg">Loading requisition portal...</div>`;

  Promise.all(promises).then(names => {
    const familyNames = names.map(n => extractFamilyName(n)).filter(n => n !== '');
    const familyNamesStr = familyNames.join(', ') || extractFamilyName(currentUser.name);

    renderStudentRequisitionsList(classData, groupName, familyNamesStr, names);
  });
}

function extractFamilyName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return '';
  const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'iii', 'ii', 'iv', 'v'];
  let last = parts[parts.length - 1];
  if (suffixes.includes(last.toLowerCase()) && parts.length > 1) {
    return parts[parts.length - 2];
  }
  return last;
}

function renderStudentRequisitionsList(classData, groupName, familyNamesStr, fullNames) {
  const viewport = document.getElementById('viewport-body');
  if (!viewport) return;

  viewport.innerHTML = `
    <div class="home-greeting-card" style="padding: 24px; background: rgba(13,148,136,0.05); border: 1px solid rgba(13,148,136,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap;">
      <div>
        <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--active-subject-color, #0d9488); margin: 0 0 8px 0;">🧪 Requisitions Portal</h2>
        <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Submit and track laboratory requisitions for your experiment group.</p>
      </div>
      <button class="settings-btn-primary" onclick="showNewRequisitionForm('${classData.id}', '${groupName}', '${familyNamesStr}', ${JSON.stringify(fullNames)})" style="width: auto; margin: 0; padding: 10px 20px; font-size: 13px; background: var(--active-subject-color, #0d9488);">➕ New Requisition</button>
    </div>

    <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 12px; padding: 16px; text-align: left; margin-bottom: 24px;">
      <h4 style="margin:0 0 4px 0; font-size:12.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">👥 My Lab Group Details</h4>
      <p style="margin:0; font-size:14px; font-weight:600; color:var(--text-main); margin-top:4px;">Group Name: <span style="color:var(--accent);">${escapeHtml(groupName)}</span></p>
      <p style="margin:6px 0 0 0; font-size:13px; color:var(--text-muted);">Family Names: <strong>${escapeHtml(familyNamesStr)}</strong></p>
    </div>

    <h3 style="font-size:16px; font-weight:700; font-family:'Outfit',sans-serif; text-align:left; margin:0 0 12px 0;">📋 Requisition History</h3>
    <div id="student-req-history-container">
      <div class="empty-playlist-msg">Loading history...</div>
    </div>
  `;

  loadStudentRequisitionsHistory(classData.id);
}

function loadStudentRequisitionsHistory(classId) {
  firestore.collection('requisitions')
    .where('classId', '==', classId)
    .get()
    .then(snapshot => {
      const container = document.getElementById('student-req-history-container');
      if (!container) return;

      // Filter to only user's submissions
      let reqs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.studentEmails && data.studentEmails.map(e => e.toLowerCase().trim()).includes(currentUser.email.toLowerCase().trim())) {
          reqs.push({ id: doc.id, ...data });
        }
      });

      if (reqs.length === 0) {
        container.innerHTML = `<div class="empty-playlist-msg" style="padding:40px; border: 1px dashed var(--border-card); border-radius:12px; background:var(--bg-card);">No past laboratory requisitions found for your group. Click "New Requisition" to create one.</div>`;
        return;
      }

      reqs.sort((a, b) => new Date(b.timestamp ? b.timestamp.seconds * 1000 : 0) - new Date(a.timestamp ? a.timestamp.seconds * 1000 : 0));

      let html = '<div style="display:flex; flex-direction:column; gap:16px;">';
      reqs.forEach(r => {
        let statusColor = '#f59e0b';
        let statusBg = 'rgba(245,158,11,0.1)';
        if (r.status === 'approved') {
          statusColor = '#10b981';
          statusBg = 'rgba(16,185,129,0.1)';
        } else if (r.status === 'returned') {
          statusColor = '#ef4444';
          statusBg = 'rgba(239,68,68,0.1)';
        }

        html += `
          <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:18px; text-align:left; display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px;">
              <div>
                <h4 style="margin:0; font-size:15px; font-weight:700; color:var(--text-main); font-family:'Outfit',sans-serif;">Lab Conduct: ${escapeHtml(r.scheduleDate)} @ ${escapeHtml(r.scheduleTime)}</h4>
                <p style="margin:4px 0 0 0; font-size:11.5px; color:var(--text-muted);">Submitted on ${new Date(r.timestamp ? r.timestamp.seconds * 1000 : Date.now()).toLocaleString()}</p>
              </div>
              <span style="font-size:10.5px; font-weight:700; text-transform:uppercase; padding:3px 8px; border-radius:6px; background:${statusBg}; color:${statusColor};">
                ${r.status === 'returned' ? 'Returned (Needs Revision)' : r.status}
              </span>
            </div>

            <!-- Details Preview -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; background:var(--bg-body); padding:12px; border-radius:8px; border:1px solid var(--border-card);">
              <div>
                <strong style="font-size:11.5px; color:var(--text-muted); display:block; margin-bottom:4px;">Chemicals (${r.chemicals ? r.chemicals.length : 0})</strong>
                <span style="font-size:12.5px; color:var(--text-main); line-height:1.4;">
                  ${r.chemicals ? r.chemicals.map(c => `${escapeHtml(c.name)} (${escapeHtml(c.volume)} / ${escapeHtml(c.concentration)})`).join(', ') : 'None'}
                </span>
              </div>
              <div>
                <strong style="font-size:11.5px; color:var(--text-muted); display:block; margin-bottom:4px;">Glasswares (${r.materials ? r.materials.length : 0})</strong>
                <span style="font-size:12.5px; color:var(--text-main); line-height:1.4;">
                  ${r.materials ? r.materials.map(m => `${escapeHtml(m.name)} (qty: ${m.quantity})`).join(', ') : 'None'}
                </span>
              </div>
            </div>

            ${r.unknowns ? `
              <div style="font-size:12px; color:var(--text-muted); background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:6px; border-left:3px solid var(--accent);">
                <strong>Unknowns:</strong> ${escapeHtml(r.unknowns)}
              </div>
            ` : ''}

            ${r.remarks ? `
              <div style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.2); border-radius:8px; padding:12px; font-size:13px; color:#ef4444;">
                <strong>⚠️ Stockroom Remarks:</strong> ${escapeHtml(r.remarks)}
              </div>
            ` : ''}

            ${r.status === 'returned' ? `
              <div style="display:flex; justify-content:flex-end; margin-top:4px;">
                <button class="settings-btn-primary" onclick="editReturnedRequisition('${r.id}')" style="width:auto; margin:0; padding:8px 16px; font-size:12px; font-weight:600; background:#3b82f6;">✏️ Edit & Resubmit</button>
              </div>
            ` : ''}
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    })
    .catch(err => {
      console.error("Error fetching requisitions history:", err);
      const container = document.getElementById('student-req-history-container');
      if (container) {
        container.innerHTML = `<div class="empty-playlist-msg" style="color:var(--incorrect);">⚠️ Error loading history: ${err.message}</div>`;
      }
    });
}

function showNewRequisitionForm(classId, groupName, familyNamesStr, fullNames) {
  activeEditRequisitionId = null;
  renderRequisitionFormUI(classId, groupName, familyNamesStr, fullNames, null);
}

function editReturnedRequisition(reqId) {
  activeEditRequisitionId = reqId;
  const viewport = document.getElementById('viewport-body');
  if (viewport) viewport.innerHTML = `<div class="empty-playlist-msg">Loading requisition form data...</div>`;

  firestore.collection('requisitions').doc(reqId).get()
    .then(doc => {
      if (!doc.exists) {
        alert("Requisition not found.");
        renderStudentRequisitionView();
        return;
      }
      const data = doc.data();
      const promises = data.studentEmails.map(email => 
        firestore.collection('students').doc(email.toLowerCase().trim()).get()
          .then(docProfile => docProfile.exists ? docProfile.data().name : email.split('@')[0])
          .catch(() => email.split('@')[0])
      );
      
      return Promise.all(promises).then(names => {
        const familyNames = names.map(n => extractFamilyName(n)).filter(n => n !== '');
        const familyNamesStr = familyNames.join(', ');
        renderRequisitionFormUI(data.classId, data.groupName, familyNamesStr, names, data);
      });
    })
    .catch(err => {
      console.error("Error loading edit requisition:", err);
      alert("Failed to load requisition data: " + err.message);
      renderStudentRequisitionView();
    });
}

function renderRequisitionFormUI(classId, groupName, familyNamesStr, fullNames, existingData) {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser || !currentCourseId) return;

  const classData = activeStudentClassData[currentCourseId];
  if (!classData) return;

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 3);
  const minDateStr = minDate.toISOString().split('T')[0];

  const dateVal = existingData ? existingData.scheduleDate : minDateStr;
  const timeVal = existingData ? existingData.scheduleTime : '09:00';
  const unknownsVal = existingData ? existingData.unknowns || '' : '';

  viewport.innerHTML = `
    <h2 style="font-size:20px; font-weight:800; font-family:'Outfit',sans-serif; text-align:left; margin:0 0 16px 0;">
      ${existingData ? '✏️ Edit Requisition Form' : '🧪 New Laboratory Requisition'}
    </h2>

    <form id="lab-req-form" onsubmit="submitRequisitionForm(event, '${classId}', '${groupName}', ${JSON.stringify(fullNames)})" style="text-align:left; font-family:'Outfit',sans-serif; display:flex; flex-direction:column; gap:20px;">
      <!-- Metadata Group -->
      <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:18px; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:16px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <span style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Group / Individual</span>
          <span style="font-size:14px; font-weight:700; color:var(--accent);">${escapeHtml(groupName)}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <span style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Prepopulated Members</span>
          <span style="font-size:13px; font-weight:600; color:var(--text-main);">${escapeHtml(familyNamesStr)}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <span style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Subject & Section</span>
          <span style="font-size:13px; font-weight:600; color:var(--text-main);">${escapeHtml(classData.courseName)} - ${escapeHtml(classData.section.toUpperCase())}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <span style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Instructor</span>
          <span style="font-size:13px; font-weight:600; color:var(--text-main);">${escapeHtml(classData.facultyName)}</span>
        </div>
      </div>

      <!-- Schedule of Conduct -->
      <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:18px;">
        <h4 style="margin:0 0 12px 0; font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">📅 Schedule of Lab Conduct</h4>
        <div style="display:flex; gap:16px; flex-wrap:wrap;">
          <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:180px;">
            <label style="font-size:11.5px; font-weight:600; color:var(--text-muted);">Conduct Date (Must be 3+ days in advance)</label>
            <input type="date" id="req-date-input" min="${minDateStr}" value="${dateVal}" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px;">
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; flex:1; min-width:180px;">
            <label style="font-size:11.5px; font-weight:600; color:var(--text-muted);">Conduct Time</label>
            <input type="time" id="req-time-input" value="${timeVal}" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px;">
          </div>
        </div>
      </div>

      <!-- Two Columns Inputs Grid -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px; align-items:flex-start;">
        <!-- Column 1: Chemicals -->
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h4 style="margin:0; font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">🧪 Chemicals and Reagents</h4>
            <button type="button" class="settings-btn-primary" onclick="addChemicalRow()" style="width:auto; margin:0; padding:6px 12px; font-size:11.5px;">➕ Add Row</button>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="border-bottom:1px dashed var(--border-card);">
                  <th style="padding:8px 4px; font-size:11px; color:var(--text-muted);">Chemical Name</th>
                  <th style="padding:8px 4px; font-size:11px; color:var(--text-muted); width:80px;">Volume</th>
                  <th style="padding:8px 4px; font-size:11px; color:var(--text-muted); width:80px;">Conc.</th>
                  <th style="padding:8px 4px; font-size:11px; color:var(--text-muted); width:40px; text-align:center;"></th>
                </tr>
              </thead>
              <tbody id="chem-rows-container">
                <!-- Populated dynamically -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Column 2: Materials -->
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h4 style="margin:0; font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">🔬 Materials & Glasswares</h4>
            <button type="button" class="settings-btn-primary" onclick="addGlasswareRow()" style="width:auto; margin:0; padding:6px 12px; font-size:11.5px;">➕ Add Row</button>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="border-bottom:1px dashed var(--border-card);">
                  <th style="padding:8px 4px; font-size:11px; color:var(--text-muted);">Glassware Description / Specs</th>
                  <th style="padding:8px 4px; font-size:11px; color:var(--text-muted); width:70px;">Quantity</th>
                  <th style="padding:8px 4px; font-size:11px; color:var(--text-muted); width:40px; text-align:center;"></th>
                </tr>
              </thead>
              <tbody id="glass-rows-container">
                <!-- Populated dynamically -->
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Unknown Samples Option B Textbox -->
      <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:18px; display:flex; flex-direction:column; gap:8px;">
        <h4 style="margin:0; font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">🧪 Unknown Samples & Codes</h4>
        <p style="margin:0; font-size:12px; color:var(--text-muted);">List any codes or identifiers for unknown samples required in this conduct.</p>
        <textarea id="req-unknowns-input" placeholder="e.g. Unknown Code A-102, Unknown Sample B" style="width:100%; height:70px; padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; resize:vertical; box-sizing:border-box;">${escapeHtml(unknownsVal)}</textarea>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button type="button" class="settings-btn-primary" onclick="renderStudentRequisitionView()" style="width:auto; margin:0; padding:12px 20px; font-size:13.5px; background:transparent; border:1px solid var(--border-card); color:var(--text-muted);">Cancel</button>
        <button type="submit" class="settings-btn-primary" style="width:auto; margin:0; padding:12px 24px; font-size:13.5px; background:var(--active-subject-color, #0d9488);">${existingData ? 'Resubmit Requisition 🚀' : 'Submit Requisition 🚀'}</button>
      </div>
    </form>
  `;

  if (existingData) {
    if (existingData.chemicals && existingData.chemicals.length > 0) {
      existingData.chemicals.forEach(c => addChemicalRow(c.name, c.volume, c.concentration));
    } else {
      addChemicalRow();
    }
    if (existingData.materials && existingData.materials.length > 0) {
      existingData.materials.forEach(m => addGlasswareRow(m.name, m.quantity));
    } else {
      addGlasswareRow();
    }
  } else {
    addChemicalRow();
    addGlasswareRow();
  }
}

function addChemicalRow(name = '', vol = '', conc = '') {
  const container = document.getElementById('chem-rows-container');
  if (!container) return;

  const tr = document.createElement('tr');
  tr.className = 'chemical-row';
  tr.style.borderBottom = '1px solid var(--border-card)';
  tr.innerHTML = `
    <td style="padding:6px 2px;"><input type="text" placeholder="e.g. HCl" value="${escapeHtml(name)}" class="chem-name-input" required style="width:100%; border:none; background:transparent; color:var(--text-main); font-size:13px; padding:6px; box-sizing:border-box;"></td>
    <td style="padding:6px 2px;"><input type="text" placeholder="e.g. 50 mL" value="${escapeHtml(vol)}" class="chem-volume-input" required style="width:100%; border:none; background:transparent; color:var(--text-main); font-size:13px; padding:6px; box-sizing:border-box;"></td>
    <td style="padding:6px 2px;"><input type="text" placeholder="e.g. 0.1 M" value="${escapeHtml(conc)}" class="chem-conc-input" required style="width:100%; border:none; background:transparent; color:var(--text-main); font-size:13px; padding:6px; box-sizing:border-box;"></td>
    <td style="padding:6px 2px; text-align:center;"><button type="button" onclick="this.closest('tr').remove()" style="background:none; border:none; color:var(--incorrect); font-size:14px; cursor:pointer;">❌</button></td>
  `;
  container.appendChild(tr);
}

function addGlasswareRow(specs = '', qty = 1) {
  const container = document.getElementById('glass-rows-container');
  if (!container) return;

  const tr = document.createElement('tr');
  tr.className = 'glassware-row';
  tr.style.borderBottom = '1px solid var(--border-card)';
  tr.innerHTML = `
    <td style="padding:6px 2px;"><input type="text" placeholder="e.g. 50-ml beaker" value="${escapeHtml(specs)}" class="glass-specs-input" required style="width:100%; border:none; background:transparent; color:var(--text-main); font-size:13px; padding:6px; box-sizing:border-box;"></td>
    <td style="padding:6px 2px;"><input type="number" placeholder="1" min="1" value="${qty}" class="glass-qty-input" required style="width:100%; border:none; background:transparent; color:var(--text-main); font-size:13px; padding:6px; box-sizing:border-box;"></td>
    <td style="padding:6px 2px; text-align:center;"><button type="button" onclick="this.closest('tr').remove()" style="background:none; border:none; color:var(--incorrect); font-size:14px; cursor:pointer;">❌</button></td>
  `;
  container.appendChild(tr);
}

function submitRequisitionForm(event, classId, groupName, fullNames) {
  event.preventDefault();
  if (!currentUser || !currentCourseId) return;

  const classData = activeStudentClassData[currentCourseId];
  if (!classData) return;

  const dateInput = document.getElementById('req-date-input');
  const timeInput = document.getElementById('req-time-input');
  if (!dateInput || !timeInput) return;

  const scheduleDate = dateInput.value;
  const scheduleTime = timeInput.value;

  const selectedDate = new Date(scheduleDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0,0,0,0);
  const diffTime = selectedDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 3) {
    alert("Error: Requisition schedule must be at least 3 days in advance of the laboratory conduct.");
    return;
  }

  const chemRows = document.querySelectorAll('#chem-rows-container .chemical-row');
  const chemicals = [];
  chemRows.forEach(row => {
    const name = row.querySelector('.chem-name-input').value.trim();
    const volume = row.querySelector('.chem-volume-input').value.trim();
    const conc = row.querySelector('.chem-conc-input').value.trim();
    if (name) {
      chemicals.push({ name, volume, concentration: conc });
    }
  });

  const glassRows = document.querySelectorAll('#glass-rows-container .glassware-row');
  const materials = [];
  glassRows.forEach(row => {
    const specs = row.querySelector('.glass-specs-input').value.trim();
    const qtyVal = row.querySelector('.glass-qty-input').value;
    const quantity = parseInt(qtyVal, 10) || 1;
    if (specs) {
      materials.push({ name: specs, quantity });
    }
  });

  if (chemicals.length === 0 && materials.length === 0) {
    alert("Please add at least one chemical or glassware to submit the requisition.");
    return;
  }

  const unknowns = document.getElementById('req-unknowns-input').value.trim();

  let studentEmails = [currentUser.email];
  if (classData.labGroups) {
    const userGroup = classData.labGroups.find(g => g.members && g.members.map(m => m.toLowerCase().trim()).includes(currentUser.email.toLowerCase().trim()));
    if (userGroup) {
      studentEmails = userGroup.members || [];
    }
  }

  const requisitionData = {
    classId: classId,
    courseId: classData.courseId,
    section: classData.section,
    facultyEmail: classData.facultyEmail,
    facultyName: classData.facultyName,
    groupName: groupName,
    studentEmails: studentEmails,
    studentNames: fullNames,
    scheduleDate: scheduleDate,
    scheduleTime: scheduleTime,
    chemicals: chemicals,
    materials: materials,
    unknowns: unknowns,
    status: 'pending',
    remarks: '',
    submittedBy: currentUser.email,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  const submitPromise = activeEditRequisitionId 
    ? firestore.collection('requisitions').doc(activeEditRequisitionId).set(requisitionData, { merge: true })
    : firestore.collection('requisitions').add(requisitionData);

  submitPromise
    .then(() => {
      alert("Laboratory requisition form submitted successfully!");
      activeEditRequisitionId = null;
      renderStudentRequisitionView();
    })
    .catch(err => {
      console.error("Error submitting laboratory requisition:", err);
      alert("Failed to submit requisition: " + err.message);
    });
}

window.renderStudentRequisitionView = renderStudentRequisitionView;
window.extractFamilyName = extractFamilyName;
window.renderStudentRequisitionsList = renderStudentRequisitionsList;
window.loadStudentRequisitionsHistory = loadStudentRequisitionsHistory;
window.showNewRequisitionForm = showNewRequisitionForm;
window.editReturnedRequisition = editReturnedRequisition;
window.renderRequisitionFormUI = renderRequisitionFormUI;
window.addChemicalRow = addChemicalRow;
window.addGlasswareRow = addGlasswareRow;
window.submitRequisitionForm = submitRequisitionForm;


// ==========================================================================
// --- End of LIMS Old Modules Migration ---

function togglePetitionBox(docId, show) {
  const box = document.getElementById(`petition-box-${docId}`);
  if (box) {
    box.style.display = show ? 'flex' : 'none';
  }
}
window.togglePetitionBox = togglePetitionBox;

function submitAccountabilityPetition(docId) {
  const textInput = document.getElementById(`petition-text-${docId}`);
  const text = textInput ? textInput.value.trim() : '';
  if (!text) {
    alert("Please enter your explanation remarks before submitting.");
    return;
  }
  firestore.collection('accountabilities').doc(docId).update({
    petitionRemarks: text,
    petitionTimestamp: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    alert("Clearance explanation submitted successfully! The stockroom custodian will review it.");
    renderDashboardView();
  })
  .catch(err => {
    console.error("Error submitting petition:", err);
    alert("Failed to submit petition: " + err.message);
  });
}
window.submitAccountabilityPetition = submitAccountabilityPetition;


// ==========================================================================
// INSTRUCTOR DASHBOARD VIEW (CLASSROOM DETAIL MANAGEMENT)
// ==========================================================================
let activeDetailsTab = 'announcements';
let facultyClassAccSemester = 'AY2026-2027, First Semester';

function viewClassroomDetails(classId) {
  facultySelectedClassId = classId;
  activeDetailsTab = 'announcements';
  facultyClassAccSemester = typeof getDefaultSemester === 'function' ? getDefaultSemester() : 'AY2026-2027, First Semester';
  setMode('faculty-class-details');
}
window.viewClassroomDetails = viewClassroomDetails;

function setClassDetailsTab(tabName) {
  activeDetailsTab = tabName;
  renderFacultyClassDetailsView();
}
window.setClassDetailsTab = setClassDetailsTab;

function loadFacultyClassAccountabilities(courseId, section) {
  const container = document.getElementById('faculty-acc-list-container');
  if (!container) return;

  firestore.collection('accountabilities')
    .where('subject', '==', courseId)
    .where('section', '==', section)
    .where('semester', '==', facultyClassAccSemester)
    .get()
    .then(snap => {
      if (snap.empty) {
        container.innerHTML = `<div style="font-size:12.5px; font-style:italic; color:var(--text-muted); text-align:center; padding:20px; background:rgba(255,255,255,0.01); border:1px dashed var(--border-card); border-radius:8px;">No student accountabilities found for this semester section.</div>`;
        return;
      }

      let accs = [];
      snap.forEach(doc => accs.push(doc.data()));

      accs.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));

      let html = `
        <div style="overflow-x:auto; border:1px solid var(--border-card); border-radius:10px; background:var(--bg-body); -webkit-overflow-scrolling: touch;">
          <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px; min-width: 500px;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-card); background:rgba(255,255,255,0.02); color:var(--text-muted); font-weight:700;">
                <th style="padding:12px 10px;">Student Name</th>
                <th style="padding:12px 10px;">Email</th>
                <th style="padding:12px 10px;">Accountability Remarks</th>
                <th style="padding:12px 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${accs.map(a => `
                <tr style="border-bottom:1px solid var(--border-card);">
                  <td style="padding:10px; font-weight:700; color:var(--text-main);">${escapeHtml(a.studentName)}</td>
                  <td style="padding:10px; font-family:monospace; font-size:11.5px; color:var(--text-muted);">${escapeHtml(a.studentEmail || 'Unlinked')}</td>
                  <td style="padding:10px; color:var(--text-main);">${escapeHtml(a.description)}</td>
                  <td style="padding:10px;">
                    <span style="font-size:9.5px; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:4px; 
                      background: ${a.status === 'pending' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'};
                      color: ${a.status === 'pending' ? '#f59e0b' : '#10b981'};">
                      ${a.status}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      container.innerHTML = html;
    })
    .catch(err => {
      console.error("Error loading faculty class accountabilities:", err);
      container.innerHTML = `<div style="font-size:12px; color:var(--incorrect); text-align:center; padding:12px;">⚠️ Error loading records: ${err.message}</div>`;
    });
}
window.loadFacultyClassAccountabilities = loadFacultyClassAccountabilities;

function updateFacultyClassAccSemester(classId, val) {
  facultyClassAccSemester = val;
  firestore.collection('classes').doc(classId).get().then(doc => {
    if (doc.exists) {
      const c = doc.data();
      loadFacultyClassAccountabilities(c.courseId, c.section);
    }
  });
}
window.updateFacultyClassAccSemester = updateFacultyClassAccSemester;

function sendFacultyClearanceReminders(classId) {
  firestore.collection('classes').doc(classId).get().then(classDoc => {
    if (!classDoc.exists) return;
    const c = classDoc.data();
    
    firestore.collection('accountabilities')
      .where('subject', '==', c.courseId)
      .where('section', '==', c.section)
      .where('semester', '==', facultyClassAccSemester)
      .where('status', '==', 'pending')
      .get()
      .then(snap => {
        if (snap.empty) {
          alert("No pending student accountabilities found for this semester section.");
          return;
        }
        
        if (!confirm(`Send clearance notifications to the ${snap.size} student(s) with pending requirements in this section?`)) return;
        
        const promises = [];
        snap.forEach(doc => {
          const a = doc.data();
          if (a.studentEmail && a.studentEmail !== 'Unlinked Account') {
            promises.push(firestore.collection('notifications').add({
              type: 'accountability_reminder',
              targetEmail: a.studentEmail,
              targetName: a.studentName,
              subject: a.subject,
              message: `Clearance Follow-up: You have a pending laboratory accountability in ${a.subject} (Sec ${a.section}): ${a.description}. Please settle this requirement with the Chemistry Stockroom.`,
              sentBy: currentUser.email,
              sentByName: currentUser.name,
              sentAt: firebase.firestore.FieldValue.serverTimestamp(),
              read: false
            }));
          }
        });
        
        return Promise.all(promises).then(() => {
          alert(`Automated reminders sent successfully to ${promises.length} student(s).`);
        });
      })
      .catch(err => {
        console.error("Error sending reminders:", err);
        alert("Failed to send reminders: " + err.message);
      });
  });
}
window.sendFacultyClearanceReminders = sendFacultyClearanceReminders;

function renderFacultyClassDetailsView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser || !facultySelectedClassId) return;

  viewport.innerHTML = `<div class="empty-playlist-msg">Loading classroom details...</div>`;

  const isSampleClass = facultySelectedClassId === 'sample_class_49c';

  function renderDetailsWithData(classData, classId) {
    const studentCount = classData.students ? classData.students.length : 0;

    // Find matched course from manifest
    const course = manifestData.courses.find(c => c.id === classData.courseId);

    let tabContent = '';
    if (activeDetailsTab === 'announcements') {
      const anns = classData.announcements || [];
      const sortedAnns = [...anns].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      tabContent = `
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; margin-bottom:20px; text-align:left;">
          <h3 style="margin:0 0 14px 0; font-size:15px; font-family:'Outfit',sans-serif;">📢 Post New Announcement</h3>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <input type="text" id="ann-title" placeholder="Announcement Title" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px;">
            <textarea id="ann-content" placeholder="Type your announcement content here..." style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; height:80px; resize:vertical; font-family:inherit;"></textarea>
            <button class="settings-btn-primary" onclick="postClassAnnouncement('${classId}')" style="width:auto; align-self:flex-start; margin:0; padding:10px 18px; font-size:12.5px;">📢 Publish Announcement</button>
          </div>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${sortedAnns.length > 0 ? sortedAnns.map(ann => `
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:16px; display:flex; justify-content:space-between; align-items:flex-start; gap:16px; text-align:left;">
              <div style="flex:1;">
                <h4 style="margin:0 0 4px 0; font-size:14px; font-weight:700;">${ann.title}</h4>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px;">Posted on: ${new Date(ann.createdAt).toLocaleDateString()} ${new Date(ann.createdAt).toLocaleTimeString()}</div>
                <p style="margin:0; font-size:12.5px; color:var(--text-muted); line-height:1.4;">${ann.content}</p>
              </div>
              <button onclick="deleteClassAnnouncement('${classId}', '${ann.id}')" style="background:none; border:none; color:var(--incorrect); cursor:pointer; font-size:12px; font-weight:700; padding:4px;">❌ Delete</button>
            </div>
          `).join('') : `<div class="empty-playlist-msg" style="padding:20px;">No announcements posted yet.</div>`}
        </div>
      `;
    } else if (activeDetailsTab === 'materials') {
      const mats = classData.customMaterials || [];
      
      tabContent = `
        <!-- Section Syllabus URL Override -->
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; margin-bottom:20px; text-align:left;">
          <h3 style="margin:0 0 14px 0; font-size:15px; font-family:'Outfit',sans-serif;">📋 Section Syllabus PDF URL</h3>
          <p style="font-size:11.5px; color:var(--text-muted); margin-top:-8px; margin-bottom:12px;">Provide a direct PDF link or Google Drive viewable URL for this specific section. If set, this overrides the default course syllabus for your students.</p>
          <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
            <input type="url" id="class-syllabus-url" value="${classData.syllabusUrl || ''}" placeholder="Syllabus URL (e.g., https://drive.google.com/file/d/.../view)" style="flex:1; min-width:240px; padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px;">
            <button class="settings-btn-primary" onclick="updateClassSyllabusUrl('${classId}')" style="width:auto; margin:0; padding:10px 18px; font-size:12.5px;">💾 Save Syllabus Link</button>
          </div>
        </div>

        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; margin-bottom:20px; text-align:left;">
          <h3 style="margin:0 0 14px 0; font-size:15px; font-family:'Outfit',sans-serif;">📎 Share Study Resource Link</h3>
          <p style="font-size:11.5px; color:var(--text-muted); margin-top:-8px; margin-bottom:12px;">Share additional reading PDFs or links to external worksheets for this specific section.</p>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <input type="text" id="mat-name" placeholder="Resource Name (e.g. Inorganic Chemistry Handout)" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px;">
            <input type="url" id="mat-url" placeholder="Resource URL (e.g. Google Drive or GitHub link)" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px;">
            <button class="settings-btn-primary" onclick="postClassMaterial('${classId}')" style="width:auto; align-self:flex-start; margin:0; padding:10px 18px; font-size:12.5px;">📎 Add Resource Link</button>
          </div>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${mats.length > 0 ? mats.map(mat => `
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:16px; display:flex; justify-content:space-between; align-items:center; gap:16px; text-align:left;">
              <div style="flex:1;">
                <h4 style="margin:0 0 2px 0; font-size:14px; font-weight:700;">${mat.name}</h4>
                <a href="${mat.url}" target="_blank" style="font-size:12px; color:var(--active-subject-color, #0ea5e9); font-family:monospace; word-break:break-all;">${mat.url}</a>
              </div>
              <button onclick="deleteClassMaterial('${classId}', '${mat.id}')" style="background:none; border:none; color:var(--incorrect); cursor:pointer; font-size:12px; font-weight:700; padding:4px;">❌ Delete</button>
            </div>
          `).join('') : `<div class="empty-playlist-msg" style="padding:20px;">No additional study resources uploaded yet.</div>`}
        </div>
      `;
    } else if (activeDetailsTab === 'scheduler') {
      if (!course || !course.modules || course.modules.length === 0) {
        tabContent = `<div class="empty-playlist-msg">No quiz modules found in course manifest.</div>`;
      } else {
        const scheduledQuizzes = classData.scheduledQuizzes || [];
        const scheduledAssignments = classData.scheduledAssignments || [];
        const customQuizzes = classData.customQuizzes || [];

        let customQuizzesHTML = '';
        if (customQuizzes.length > 0) {
          customQuizzesHTML = `
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left; margin-bottom: 20px;">
              <h3 style="margin:0 0 6px 0; font-size:15px; font-family:'Outfit',sans-serif;">📋 Custom Classroom Exams</h3>
              <p style="font-size:12px; color:var(--text-muted); margin:0 0 16px 0; line-height:1.5;">Manage scheduling and removal of custom exams uploaded via DOCX files.</p>
              
              <div style="display:flex; flex-direction:column; gap:14px;">
                ${customQuizzes.map(cq => {
                  const isQuizActive = scheduledQuizzes.includes(cq.id);
                  return `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-card); padding-bottom:12px;">
                      <div style="display:flex; flex-direction:column; gap:2px; flex: 1;">
                        <span style="font-weight:700; font-size:13.5px; color:var(--text-main);">${cq.title}</span>
                        <span style="font-size:11.5px; color:var(--text-muted);">Questions: ${cq.questions.length} | Time: ${Math.round(cq.timeLimitSeconds / 60)} mins</span>
                      </div>
                      <div style="display:flex; gap:15px; align-items:center;">
                        <label style="display:flex; align-items:center; gap:6px; font-size:12.5px; cursor:pointer; font-weight:600;">
                          <input type="checkbox" onchange="updateModuleSchedule('${classId}', '${cq.id}', 'quiz', this.checked)" ${isQuizActive ? 'checked' : ''} style="accent-color:var(--active-subject-color, #0ea5e9);">
                          Schedule Exam
                        </label>
                        <button onclick="deleteCustomQuiz('${classId}', '${cq.id}')" style="background:none; border:none; color:var(--incorrect); font-weight:700; font-size:12px; cursor:pointer; padding:4px 8px;">❌ Delete</button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }

        tabContent = `
          <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left; margin-bottom: 20px;">
            <h3 style="margin:0 0 6px 0; font-size:15px; font-family:'Outfit',sans-serif;">✍️ Assessment Scheduler</h3>
            <p style="font-size:12px; color:var(--text-muted); margin:0 0 16px 0; line-height:1.5;">Check quizzes or performance assignments to schedule them for students. Unchecked items remain hidden from the student's dashboard.</p>
            
            <div style="display:flex; flex-direction:column; gap:14px;">
              ${course.modules.map((m, idx) => {
                const hasQuiz = !!m.quiz;
                const hasAssign = !!m.assignment;
                const isQuizActive = scheduledQuizzes.includes(m.id);
                const isAssignActive = scheduledAssignments.includes(m.id);
                
                return `
                  <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-card); padding-bottom:12px;">
                    <div style="display:flex; flex-direction:column; gap:2px; flex: 1;">
                      <span style="font-weight:700; font-size:13.5px; color:var(--text-main);">${m.title}</span>
                      <span style="font-size:11.5px; color:var(--text-muted);">${m.desc || 'No description available'}</span>
                    </div>
                    <div style="display:flex; gap:20px; align-items:center;">
                      ${hasQuiz ? `
                        <label style="display:flex; align-items:center; gap:6px; font-size:12.5px; cursor:pointer; font-weight:600;">
                          <input type="checkbox" onchange="updateModuleSchedule('${classId}', '${m.id}', 'quiz', this.checked)" ${isQuizActive ? 'checked' : ''} style="accent-color:var(--active-subject-color, #0ea5e9);">
                          Quiz Active
                        </label>
                      ` : ''}
                      ${hasAssign ? `
                        <label style="display:flex; align-items:center; gap:6px; font-size:12.5px; cursor:pointer; font-weight:600;">
                          <input type="checkbox" onchange="updateModuleSchedule('${classId}', '${m.id}', 'assignment', this.checked)" ${isAssignActive ? 'checked' : ''} style="accent-color:#f59e0b;">
                          Task Active
                        </label>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          ${customQuizzesHTML}

          <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left; margin-bottom:20px;">
            <h3 style="margin:0 0 6px 0; font-size:15px; font-family:'Outfit',sans-serif;">📋 Custom Exam Importer</h3>
            <p style="font-size:11.5px; color:var(--text-muted); margin:0 0 12px 0;">Import class-specific quizzes using Microsoft Word (.docx), Plain Text (.txt), or Markdown (.md) files. Ensure questions are numbered and specify answers and points.</p>
            
            <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
              <input type="file" id="docx-exam-file-input" accept=".docx,.txt,.md" style="display:none;" onchange="handleDocxExamFileSelect(event)">
              <button class="settings-btn-primary" onclick="document.getElementById('docx-exam-file-input').click()" style="width:auto; margin:0; padding:10px 16px; font-size:12.5px; background:#0ea5e9;">📥 Choose Exam File (.docx, .txt, .md)</button>
              <button class="settings-btn-primary" onclick="downloadDocxTemplate()" style="width:auto; margin:0; padding:10px 16px; font-size:12.5px; background:#475569;">📝 Download Text Template</button>
            </div>
          </div>
        `;
      }
    } else if (activeDetailsTab === 'roster') {
      const students = classData.students || [];
      
      tabContent = `
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
            <h3 style="margin:0; font-size:15px; font-family:'Outfit',sans-serif;">👥 Student Classroom Roster (${students.length})</h3>
            <button class="settings-btn-primary" onclick="openEnrollmentModal('${classId}')" style="width:auto; margin:0; padding:8px 14px; font-size:12px;">➕ Enroll Students</button>
          </div>
          
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${students.length > 0 ? students.map(email => `
              <div style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:8px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-family:monospace; font-size:13px; color:var(--text-main);">${email}</span>
                <button onclick="removeStudentFromClass('${classId}', '${email}')" style="background:none; border:none; color:var(--incorrect); font-weight:700; font-size:14px; cursor:pointer; padding:2px 8px;">❌</button>
              </div>
            `).join('') : `<div style="font-size:12px; font-style:italic; color:var(--text-muted); text-align:center; padding:12px;">No students enrolled yet. Click Enroll Students to build your class list.</div>`}
          </div>
        </div>
      `;
    } else if (activeDetailsTab === 'accountabilities') {
      tabContent = `
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left; display:flex; flex-direction:column; gap:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <h3 style="margin:0; font-size:15px; font-family:'Outfit',sans-serif;">📋 Student Clearance & Accountabilities</h3>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <select id="faculty-acc-semester-select" onchange="updateFacultyClassAccSemester('${classId}', this.value)" style="padding:6px 10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:12.5px; cursor:pointer;">
                <option value="AY2026-2027, First Semester" ${facultyClassAccSemester === 'AY2026-2027, First Semester' ? 'selected' : ''}>AY2026-2027, First Semester</option>
                <option value="AY2025-2026, Summer" ${facultyClassAccSemester === 'AY2025-2026, Summer' ? 'selected' : ''}>AY2025-2026, Summer</option>
                <option value="AY2025-2026, Second Semester" ${facultyClassAccSemester === 'AY2025-2026, Second Semester' ? 'selected' : ''}>AY2025-2026, Second Semester</option>
                <option value="AY2025-2026, First Semester" ${facultyClassAccSemester === 'AY2025-2026, First Semester' ? 'selected' : ''}>AY2025-2026, First Semester</option>
              </select>
              <button class="settings-btn-primary" onclick="sendFacultyClearanceReminders('${classId}')" style="width:auto; margin:0; padding:8px 14px; font-size:12px; background:#f59e0b;">🔔 Send Clearance Reminders</button>
            </div>
          </div>
          
          <div id="faculty-acc-list-container">
            <div style="font-size:12px; color:var(--text-muted); text-align:center; padding:12px;">Loading accountability records...</div>
          </div>
        </div>
      `;
    }

    viewport.innerHTML = `
      <div style="display: flex; gap:12px; align-items: center; margin-bottom: 20px; text-align:left;">
        <button class="settings-btn-primary" style="width:auto; margin:0; padding:8px 16px; font-size:12px; background:transparent; border:1px solid var(--border-card); color:var(--text-main);" onclick="setMode('faculty-classes')">← Back</button>
        <span style="font-size:12.5px; color:var(--text-muted);">Classrooms / Details</span>
      </div>
      
      <div style="display:flex; flex-direction:column; gap:20px;">
        <!-- Classroom Card Header -->
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:20px; padding:24px; text-align:left; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:20px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <h1 style="margin:0; font-family:'Outfit',sans-serif; font-size:22px; font-weight:800;">${classData.courseName}</h1>
              <span class="class-section">${classData.section}</span>
            </div>
            <p style="margin:0; font-size:13.5px; color:var(--text-muted);">
              Academic Year: <strong>${classData.year}</strong> | Status: <strong>${classData.status.toUpperCase()}</strong> | Students: <strong>${studentCount}</strong>
            </p>
          </div>
          
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="settings-btn-primary" onclick="goToClassGradebook('${classId}')" style="width:auto; margin:0; padding:10px 18px; font-size:12.5px; background:#3b82f6;">📊 Class Gradebook</button>
            <button class="settings-btn-primary" onclick="goToClassGroups('${classId}')" style="width:auto; margin:0; padding:10px 18px; font-size:12.5px; background:#10b981;">👥 Lab Groups</button>
          </div>
        </div>
        
        <!-- Detail Navigation Tabs -->
        <div style="display:flex; border-bottom:1px solid var(--border-card); gap:16px; margin-bottom:-8px; overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:6px;">
          <button onclick="setClassDetailsTab('announcements')" style="background:none; border:none; padding:8px 12px; font-size:13.5px; font-weight:700; cursor:pointer; color: ${activeDetailsTab === 'announcements' ? 'var(--active-subject-color, #0ea5e9)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeDetailsTab === 'announcements' ? 'var(--active-subject-color, #0ea5e9)' : 'transparent'};">📢 Announcements</button>
          <button onclick="setClassDetailsTab('materials')" style="background:none; border:none; padding:8px 12px; font-size:13.5px; font-weight:700; cursor:pointer; color: ${activeDetailsTab === 'materials' ? 'var(--active-subject-color, #0ea5e9)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeDetailsTab === 'materials' ? 'var(--active-subject-color, #0ea5e9)' : 'transparent'};">📚 Resources</button>
          <button onclick="setClassDetailsTab('scheduler')" style="background:none; border:none; padding:8px 12px; font-size:13.5px; font-weight:700; cursor:pointer; color: ${activeDetailsTab === 'scheduler' ? 'var(--active-subject-color, #0ea5e9)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeDetailsTab === 'scheduler' ? 'var(--active-subject-color, #0ea5e9)' : 'transparent'};">✍️ Scheduler</button>
          <button onclick="setClassDetailsTab('roster')" style="background:none; border:none; padding:8px 12px; font-size:13.5px; font-weight:700; cursor:pointer; color: ${activeDetailsTab === 'roster' ? 'var(--active-subject-color, #0ea5e9)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeDetailsTab === 'roster' ? 'var(--active-subject-color, #0ea5e9)' : 'transparent'};">👥 Roster (${studentCount})</button>
          <button onclick="setClassDetailsTab('accountabilities')" style="background:none; border:none; padding:8px 12px; font-size:13.5px; font-weight:700; cursor:pointer; color: ${activeDetailsTab === 'accountabilities' ? 'var(--active-subject-color, #0ea5e9)' : 'var(--text-muted)'}; border-bottom: 2px solid ${activeDetailsTab === 'accountabilities' ? 'var(--active-subject-color, #0ea5e9)' : 'transparent'};">📋 Accountabilities</button>
        </div>
        
        <!-- Tab content area -->
        <div id="class-details-tab-content">
          ${tabContent}
        </div>
      </div>
    `;
    renderChemistrySymbols(viewport);
    
    if (activeDetailsTab === 'accountabilities') {
      setTimeout(() => {
        loadFacultyClassAccountabilities(classData.courseId, classData.section);
      }, 50);
    }
  }

  firestore.collection('classes').doc(facultySelectedClassId).get()
    .then(classDoc => {
      if (!classDoc.exists) {
        if (isSampleClass) {
          console.log("Firestore resolved empty, but this is the sample class - falling back.");
          renderDetailsWithData(GLOBAL_SAMPLE_CLASS, 'sample_class_49c');
        } else {
          viewport.innerHTML = `<div class="empty-playlist-msg" style="color:var(--incorrect);">Classroom not found.</div>`;
        }
        return;
      }
      renderDetailsWithData(classDoc.data(), classDoc.id);
    })
    .catch(err => {
      console.error("Error loading classroom details view:", err);
      if (isSampleClass) {
        console.log("Offline fallback: Using local copy for sample class details.");
        renderDetailsWithData(GLOBAL_SAMPLE_CLASS, 'sample_class_49c');
      } else {
        viewport.innerHTML = `<div class="empty-playlist-msg" style="color:var(--incorrect);">Error loading details: ${err.message}</div>`;
      }
    });
}

function updateModuleSchedule(classId, moduleId, type, checked) {
  const field = type === 'quiz' ? 'scheduledQuizzes' : 'scheduledAssignments';

  if (classId === 'sample_class_49c') {
    if (!GLOBAL_SAMPLE_CLASS[field]) {
      GLOBAL_SAMPLE_CLASS[field] = [];
    }
    if (checked) {
      if (!GLOBAL_SAMPLE_CLASS[field].includes(moduleId)) {
        GLOBAL_SAMPLE_CLASS[field].push(moduleId);
      }
    } else {
      GLOBAL_SAMPLE_CLASS[field] = GLOBAL_SAMPLE_CLASS[field].filter(id => id !== moduleId);
    }
    firestore.collection('classes').doc(classId).update({
      [field]: checked ? firebase.firestore.FieldValue.arrayUnion(moduleId) : firebase.firestore.FieldValue.arrayRemove(moduleId)
    }).catch(err => console.warn("Firestore update failed for sample class schedule:", err));
    console.log(`Updated scheduling for ${moduleId} ${type}: ${checked} (local)`);
    return;
  }

  const op = checked ? 
    firebase.firestore.FieldValue.arrayUnion(moduleId) : 
    firebase.firestore.FieldValue.arrayRemove(moduleId);
  
  firestore.collection('classes').doc(classId).update({
    [field]: op
  })
  .then(() => {
    console.log(`Updated scheduling for ${moduleId} ${type}: ${checked}`);
  })
  .catch(err => {
    console.error("Failed to update module scheduling:", err);
    alert("Failed to update schedule: " + err.message);
  });
}

function postClassAnnouncement(classId) {
  const titleInput = document.getElementById('ann-title');
  const contentInput = document.getElementById('ann-content');
  if (!titleInput || !contentInput) return;

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !content) {
    alert("Please fill in both the announcement title and body.");
    return;
  }

  const announcement = {
    id: 'ann_' + Date.now(),
    title: title,
    content: content,
    createdAt: new Date().toISOString()
  };

  if (classId === 'sample_class_49c') {
    if (!GLOBAL_SAMPLE_CLASS.announcements) {
      GLOBAL_SAMPLE_CLASS.announcements = [];
    }
    GLOBAL_SAMPLE_CLASS.announcements.push(announcement);
    firestore.collection('classes').doc(classId).update({
      announcements: firebase.firestore.FieldValue.arrayUnion(announcement)
    }).catch(err => console.warn("Firestore update failed for sample class announcement:", err));

    titleInput.value = '';
    contentInput.value = '';
    renderFacultyClassDetailsView();
    return;
  }

  firestore.collection('classes').doc(classId).update({
    announcements: firebase.firestore.FieldValue.arrayUnion(announcement)
  })
  .then(() => {
    titleInput.value = '';
    contentInput.value = '';
    renderFacultyClassDetailsView();
  })
  .catch(err => {
    console.error("Error posting announcement:", err);
    alert("Failed to post announcement: " + err.message);
  });
}

function deleteClassAnnouncement(classId, annId) {
  const confirmDelete = confirm("Are you sure you want to delete this announcement?");
  if (!confirmDelete) return;

  if (classId === 'sample_class_49c') {
    const anns = GLOBAL_SAMPLE_CLASS.announcements || [];
    GLOBAL_SAMPLE_CLASS.announcements = anns.filter(a => a.id !== annId);
    firestore.collection('classes').doc(classId).update({
      announcements: GLOBAL_SAMPLE_CLASS.announcements
    }).catch(err => console.warn("Firestore update failed for sample class announcement delete:", err));

    renderFacultyClassDetailsView();
    return;
  }

  firestore.collection('classes').doc(classId).get()
    .then(doc => {
      if (!doc.exists) return;
      const classData = doc.data();
      const anns = (classData.announcements || []).filter(a => a.id !== annId);
      return firestore.collection('classes').doc(classId).update({
        announcements: anns
      });
    })
    .then(() => {
      renderFacultyClassDetailsView();
    })
    .catch(err => {
      console.error("Error deleting announcement:", err);
      alert("Failed to delete announcement: " + err.message);
    });
}

function postClassMaterial(classId) {
  const nameInput = document.getElementById('mat-name');
  const urlInput = document.getElementById('mat-url');
  if (!nameInput || !urlInput) return;

  const name = nameInput.value.trim();
  const url = urlInput.value.trim();

  if (!name || !url) {
    alert("Please provide both a name and a link for the study resource.");
    return;
  }

  const material = {
    id: 'mat_' + Date.now(),
    name: name,
    url: url,
    createdAt: new Date().toISOString()
  };

  if (classId === 'sample_class_49c') {
    if (!GLOBAL_SAMPLE_CLASS.customMaterials) {
      GLOBAL_SAMPLE_CLASS.customMaterials = [];
    }
    GLOBAL_SAMPLE_CLASS.customMaterials.push(material);
    firestore.collection('classes').doc(classId).update({
      customMaterials: firebase.firestore.FieldValue.arrayUnion(material)
    }).catch(err => console.warn("Firestore update failed for sample class material:", err));

    nameInput.value = '';
    urlInput.value = '';
    renderFacultyClassDetailsView();
    return;
  }

  firestore.collection('classes').doc(classId).update({
    customMaterials: firebase.firestore.FieldValue.arrayUnion(material)
  })
  .then(() => {
    nameInput.value = '';
    urlInput.value = '';
    renderFacultyClassDetailsView();
  })
  .catch(err => {
    console.error("Error posting study material:", err);
    alert("Failed to add resource: " + err.message);
  });
}

function deleteClassMaterial(classId, matId) {
  const confirmDelete = confirm("Are you sure you want to delete this study resource?");
  if (!confirmDelete) return;

  if (classId === 'sample_class_49c') {
    const mats = GLOBAL_SAMPLE_CLASS.customMaterials || [];
    GLOBAL_SAMPLE_CLASS.customMaterials = mats.filter(m => m.id !== matId);
    firestore.collection('classes').doc(classId).update({
      customMaterials: GLOBAL_SAMPLE_CLASS.customMaterials
    }).catch(err => console.warn("Firestore update failed for sample class material delete:", err));

    renderFacultyClassDetailsView();
    return;
  }

  firestore.collection('classes').doc(classId).get()
    .then(doc => {
      if (!doc.exists) return;
      const classData = doc.data();
      const mats = (classData.customMaterials || []).filter(m => m.id !== matId);
      return firestore.collection('classes').doc(classId).update({
        customMaterials: mats
      });
    })
    .then(() => {
      renderFacultyClassDetailsView();
    })
    .catch(err => {
      console.error("Error deleting study material:", err);
      alert("Failed to delete resource: " + err.message);
    });
}

function removeStudentFromClass(classId, studentEmail) {
  const confirmRemove = confirm(`Are you sure you want to remove ${studentEmail} from this classroom roster?`);
  if (!confirmRemove) return;

  if (classId === 'sample_class_49c') {
    const students = GLOBAL_SAMPLE_CLASS.students || [];
    GLOBAL_SAMPLE_CLASS.students = students.filter(email => email !== studentEmail);
    firestore.collection('classes').doc(classId).update({
      students: firebase.firestore.FieldValue.arrayRemove(studentEmail)
    }).catch(err => console.warn("Firestore update failed for sample class student remove:", err));

    renderFacultyClassDetailsView();
    return;
  }

  firestore.collection('classes').doc(classId).update({
    students: firebase.firestore.FieldValue.arrayRemove(studentEmail)
  })
  .then(() => {
    renderFacultyClassDetailsView();
  })
  .catch(err => {
    console.error("Error removing student from roster:", err);
    alert("Failed to remove student: " + err.message);
  });
}

function updateClassSyllabusUrl(classId) {
  const urlInput = document.getElementById('class-syllabus-url');
  if (!urlInput) return;
  const url = urlInput.value.trim();
  
  if (classId === 'sample_class_49c') {
    GLOBAL_SAMPLE_CLASS.syllabusUrl = url;
    firestore.collection('classes').doc(classId).update({
      syllabusUrl: url
    }).catch(err => console.warn("Firestore update failed for sample class syllabus update:", err));

    alert("Classroom syllabus URL updated successfully!");
    renderFacultyClassDetailsView();
    return;
  }

  firestore.collection('classes').doc(classId).update({
    syllabusUrl: url
  })
  .then(() => {
    alert("Classroom syllabus URL updated successfully!");
    renderFacultyClassDetailsView();
  })
  .catch(err => {
    console.error("Failed to update class syllabus URL:", err);
    alert("Failed to update: " + err.message);
  });
}

function exportGradebookToCSV() {
  const classId = currentEnrollClassId;
  if (!classId || !gradebookClassData) {
    alert("Please select a classroom first.");
    return;
  }

  playSFX(true);

  // Helper to compile the CSV with loaded data
  function generateCSV(classData, studentProfiles, allScores) {
    // Build assessment columns from manifest
    const course = manifestData.courses.find(c => c.id === classData.courseId);
    const columns = [];
    if (course && course.modules) {
      course.modules.forEach(m => {
        if (m.quiz) {
          columns.push({
            moduleId: m.id,
            taskTitle: m.quiz.title || `${m.title} Quiz`,
            maxScore: (m.quiz.questions && m.quiz.questions.length) ? m.quiz.questions.length : 10,
            mode: 'quiz'
          });
        }
        if (m.assignment) {
          columns.push({
            moduleId: m.id,
            taskTitle: m.assignment.title || `${m.title} Task`,
            maxScore: m.assignment.maxScore || 100,
            mode: 'assignment'
          });
        }
      });
    }
    // Add custom quizzes to columns
    if (classData.customQuizzes && classData.customQuizzes.length > 0) {
      classData.customQuizzes.forEach(cq => {
        columns.push({
          moduleId: cq.id,
          taskTitle: cq.title,
          maxScore: cq.questions.length,
          mode: 'quiz'
        });
      });
    }

    // Build CSV Content
    let csvRows = [];
    
    // Header Row
    let headers = ["Student Name", "Student ID", "Email"];
    columns.forEach(col => {
      headers.push(`"${col.taskTitle.replace(/"/g, '""')} (Max: ${col.maxScore})"`);
    });
    csvRows.push(headers.join(","));

    // Student Rows
    classData.students.forEach(studentEmail => {
      const normEmail = studentEmail.toLowerCase().trim();
      const profile = studentProfiles[normEmail] || { name: studentEmail.split('@')[0], studentId: 'Not Onboarded' };
      
      let row = [
        `"${profile.name.replace(/"/g, '""')}"`,
        `"${profile.studentId.replace(/"/g, '""')}"`,
        `"${studentEmail}"`
      ];

      columns.forEach(col => {
        const localMatch = getLocalStudentScore(normEmail, col.moduleId, col.mode, col.maxScore);

        const matches = allScores.filter(s => 
          s.email.toLowerCase().trim() === normEmail &&
          s.moduleId === col.moduleId &&
          s.taskTitle === col.taskTitle &&
          s.mode === col.mode
        );

        let finalScore = "";
        if (matches.length > 0) {
          const overrideScore = matches.find(s => s.override === true);
          if (overrideScore) {
            finalScore = overrideScore.score;
          } else {
            const firestoreMax = Math.max(...matches.map(s => s.score));
            if (localMatch) {
              if (localMatch.override) {
                finalScore = localMatch.score;
              } else {
                finalScore = Math.max(firestoreMax, localMatch.score);
              }
            } else {
              finalScore = firestoreMax;
            }
          }
        } else if (localMatch) {
          finalScore = localMatch.score;
        }
        row.push(finalScore);
      });

      csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${classData.courseName.replace(/\s+/g, '_')}_${classData.section}_Gradebook.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log("CSV Gradebook Exported successfully.");
  }

  if (classId === 'sample_class_49c') {
    const classData = GLOBAL_SAMPLE_CLASS;
    const studentProfiles = {};
    classData.students.forEach(email => {
      studentProfiles[email.toLowerCase().trim()] = { name: email.split('@')[0], studentId: 'Sample ID' };
    });
    generateCSV(classData, studentProfiles, []);
    return;
  }

  // Re-fetch everything to ensure we have the absolute latest scores
  Promise.all([
    firestore.collection('classes').doc(classId).get(),
    firestore.collection('students').get(),
    firestore.collection('scores').where('courseId', '==', gradebookClassData.courseId).get()
  ]).then(([classDoc, studentsSnapshot, scoresSnapshot]) => {
    if (!classDoc.exists) return;
    const classData = classDoc.data();
    
    const studentProfiles = {};
    studentsSnapshot.forEach(doc => {
      studentProfiles[doc.id.toLowerCase().trim()] = doc.data();
    });

    const allScores = [];
    scoresSnapshot.forEach(doc => {
      allScores.push(doc.data());
    });

    generateCSV(classData, studentProfiles, allScores);
  }).catch(err => {
    console.error("CSV Export failed via Firestore, falling back to loaded stats:", err);
    // Use whatever is currently loaded in memory as a fallback
    generateCSV(gradebookClassData, gradebookStudentsList, []);
  });
}

window.renderFacultyClassDetailsView = renderFacultyClassDetailsView;
window.updateModuleSchedule = updateModuleSchedule;
window.postClassAnnouncement = postClassAnnouncement;
window.deleteClassAnnouncement = deleteClassAnnouncement;
window.postClassMaterial = postClassMaterial;
window.deleteClassMaterial = deleteClassMaterial;
window.removeStudentFromClass = removeStudentFromClass;
window.updateClassSyllabusUrl = updateClassSyllabusUrl;
window.exportGradebookToCSV = exportGradebookToCSV;

// ==========================================================================
// 🔬 PHASE 2: CHEMISTRY RENDERING, PERIODIC TABLE & DOCX EXAM IMPORTER
// ==========================================================================

const periodicTableElements = [
  { number: 1, symbol: "H", name: "Hydrogen", weight: 1.008, config: "1s1", category: "pt-nonmetal", period: 1, group: 1, info: "Most abundant chemical substance in the Universe. Highly flammable diatomic gas." },
  { number: 2, symbol: "He", name: "Helium", weight: 4.0026, config: "1s2", category: "pt-noblegas", period: 1, group: 18, info: "Colorless, odorless, tasteless, non-toxic, inert, monatomic gas. First of the noble gases." },
  { number: 3, symbol: "Li", name: "Lithium", weight: 6.94, config: "[He] 2s1", category: "pt-alkalimetal", period: 2, group: 1, info: "Soft, silvery-white alkali metal. Least dense of all solid elements." },
  { number: 4, symbol: "Be", name: "Beryllium", weight: 9.0122, config: "[He] 2s2", category: "pt-alkalineearth", period: 2, group: 2, info: "Relatively rare element in the universe. Strong, lightweight alkaline earth metal." },
  { number: 5, symbol: "B", name: "Boron", weight: 10.81, config: "[He] 2s2 2p1", category: "pt-metalloid", period: 2, group: 13, info: "Low-abundance metalloid. Commonly used in fiberglass and ceramics." },
  { number: 6, symbol: "C", name: "Carbon", weight: 12.011, config: "[He] 2s2 2p2", category: "pt-nonmetal", period: 2, group: 14, info: "Tetravalent nonmetal. Tetravalent bonding makes it the chemical basis for all organic life." },
  { number: 7, symbol: "N", name: "Nitrogen", weight: 14.007, config: "[He] 2s2 2p3", category: "pt-nonmetal", period: 2, group: 15, info: "Form of diatomic gas making up about 78% of Earth's atmosphere." },
  { number: 8, symbol: "O", name: "Oxygen", weight: 15.999, config: "[He] 2s2 2p4", category: "pt-nonmetal", period: 2, group: 16, info: "Highly reactive nonmetal and oxidizing agent. Essential for cellular respiration in most living organisms." },
  { number: 9, symbol: "F", name: "Fluorine", weight: 18.998, config: "[He] 2s2 2p5", category: "pt-nonmetal", period: 2, group: 17, info: "Extremely toxic, halogen element. The most electronegative and reactive of all elements." },
  { number: 10, symbol: "Ne", name: "Neon", weight: 20.180, config: "[He] 2s2 2p6", category: "pt-noblegas", period: 2, group: 18, info: "Inert noble gas. Glows with a reddish-orange light when used in high-voltage electrical discharge signs." },
  { number: 11, symbol: "Na", name: "Sodium", weight: 22.990, config: "[Ne] 3s1", category: "pt-alkalimetal", period: 3, group: 1, info: "Soft, silvery-white, highly reactive alkali metal. Found in abundance in table salt (NaCl)." },
  { number: 12, symbol: "Mg", name: "Magnesium", weight: 24.305, config: "[Ne] 3s2", category: "pt-alkalineearth", period: 3, group: 2, info: "Shiny gray alkaline earth metal. Essential mineral for human body functions and plant chlorophyll." },
  { number: 13, symbol: "Al", name: "Aluminum", weight: 26.982, config: "[Ne] 3s2 3p1", category: "pt-posttransition", period: 3, group: 13, info: "Low density post-transition metal. Widely used in packaging, transportation, and construction." },
  { number: 14, symbol: "Si", name: "Silicon", weight: 28.085, config: "[Ne] 3s2 3p2", category: "pt-metalloid", period: 3, group: 14, info: "Hard, crystalline metalloid. The primary semiconductor material used in computer chips and electronics." },
  { number: 15, symbol: "P", name: "Phosphorus", weight: 30.974, config: "[Ne] 3s2 3p3", category: "pt-nonmetal", period: 3, group: 15, info: "Highly reactive nonmetal. Found in two major forms: white phosphorus and red phosphorus." },
  { number: 16, symbol: "S", name: "Sulfur", weight: 32.06, config: "[Ne] 3s2 3p4", category: "pt-nonmetal", period: 3, group: 16, info: "Abundant, multivalent nonmetal. Historically known as brimstone, smells like rotten eggs when compound." },
  { number: 17, symbol: "Cl", name: "Chlorine", weight: 35.45, config: "[Ne] 3s2 3p5", category: "pt-nonmetal", period: 3, group: 17, info: "Yellowish-green halogen gas. Widely used as a disinfectant and water purifier." },
  { number: 18, symbol: "Ar", name: "Argon", weight: 39.948, config: "[Ne] 3s2 3p6", category: "pt-noblegas", period: 3, group: 18, info: "Third-most abundant gas in the Earth's atmosphere. Commonly used as an inert shielding gas in welding." },
  { number: 19, symbol: "K", name: "Potassium", weight: 39.098, config: "[Ar] 4s1", category: "pt-alkalimetal", period: 4, group: 1, info: "Silvery alkali metal. Reacts violently with water. Crucial electrolyte for cell function and nerve signaling." },
  { number: 20, symbol: "Ca", name: "Calcium", weight: 40.078, config: "[Ar] 4s2", category: "pt-alkalineearth", period: 4, group: 2, info: "Essential alkaline earth metal. The primary structural element in bones and teeth." },
  { number: 21, symbol: "Sc", name: "Scandium", weight: 44.956, config: "[Ar] 3d1 4s2", category: "pt-transitionmetal", period: 4, group: 3, info: "Silvery-white transition metal. Historically classified as a rare-earth element." },
  { number: 22, symbol: "Ti", name: "Titanium", weight: 47.867, config: "[Ar] 3d2 4s2", category: "pt-transitionmetal", period: 4, group: 4, info: "Lustrous transition metal. High strength, low density, and high corrosion resistance." },
  { number: 23, symbol: "V", name: "Vanadium", weight: 50.942, config: "[Ar] 3d3 4s2", category: "pt-transitionmetal", period: 4, group: 5, info: "Hard, silvery-gray transition metal. Primarily used as an additive to strengthen steel alloys." },
  { number: 24, symbol: "Cr", name: "Chromium", weight: 51.996, config: "[Ar] 3d5 4s1", category: "pt-transitionmetal", period: 4, group: 6, info: "Steely-gray, lustrous transition metal. The main additive in stainless steel, providing high corrosion resistance." },
  { number: 25, symbol: "Mn", name: "Manganese", weight: 54.938, config: "[Ar] 3d5 4s2", category: "pt-transitionmetal", period: 4, group: 7, info: "Hard, brittle transition metal. Essential in steel production and glass purification." },
  { number: 26, symbol: "Fe", name: "Iron", weight: 55.845, config: "[Ar] 3d6 4s2", category: "pt-transitionmetal", period: 4, group: 8, info: "By mass, the most common element on Earth. The primary constituent of the Earth's core." },
  { number: 27, symbol: "Co", name: "Cobalt", weight: 58.933, config: "[Ar] 3d7 4s2", category: "pt-transitionmetal", period: 4, group: 9, info: "Ferromagnetic transition metal. Used in lithium-ion batteries and magnetic alloys." },
  { number: 28, symbol: "Ni", name: "Nickel", weight: 58.693, config: "[Ar] 3d8 4s2", category: "pt-transitionmetal", period: 4, group: 10, info: "Silvery-white, corrosion-resistant transition metal. Heavily used in stainless steel and coins." },
  { number: 29, symbol: "Cu", name: "Copper", weight: 63.546, config: "[Ar] 3d10 4s1", category: "pt-transitionmetal", period: 4, group: 11, info: "Soft, malleable metal with extremely high electrical and thermal conductivity. Essential in wiring." },
  { number: 30, symbol: "Zn", name: "Zinc", weight: 65.38, config: "[Ar] 3d10 4s2", category: "pt-transitionmetal", period: 4, group: 12, info: "Slightly brittle metal. Primarily used for galvanizing steel to prevent corrosion." },
  { number: 31, symbol: "Ga", name: "Gallium", weight: 69.723, config: "[Ar] 3d10 4s2 4p1", category: "pt-posttransition", period: 4, group: 13, info: "Metal that melts in a person's hand (melting point: 29.76°C). Used in semiconductors (GaAs)." },
  { number: 32, symbol: "Ge", name: "Germanium", weight: 72.63, config: "[Ar] 3d10 4s2 4p2", category: "pt-metalloid", period: 4, group: 14, info: "Lustrous, hard metalloid. Chemically similar to silicon; used in fiber optics and infrared optics." },
  { number: 33, symbol: "As", name: "Arsenic", weight: 74.922, config: "[Ar] 3d10 4s2 4p3", category: "pt-metalloid", period: 4, group: 15, info: "Metalloid famous for its extreme toxicity when inhaled or consumed in compounds." },
  { number: 34, symbol: "Se", name: "Selenium", weight: 78.971, config: "[Ar] 3d10 4s2 4p4", category: "pt-nonmetal", period: 4, group: 16, info: "Rare metalloid/non-metal. Exhibits photoconductivity; used in solar cells and photocopiers." },
  { number: 35, symbol: "Br", name: "Bromine", weight: 79.904, config: "[Ar] 3d10 4s2 4p5", category: "pt-nonmetal", period: 4, group: 17, info: "The only nonmetallic element that is a liquid at standard temperature and pressure. Pungent red liquid." },
  { number: 36, symbol: "Kr", name: "Krypton", weight: 83.798, config: "[Ar] 3d10 4s2 4p6", category: "pt-noblegas", period: 4, group: 18, info: "Monatomic noble gas. Used in high-speed photographic flashes and fluorescent lighting." },
  { number: 37, symbol: "Rb", name: "Rubidium", weight: 85.468, config: "[Kr] 5s1", category: "pt-alkalimetal", period: 5, group: 1, info: "Soft, highly reactive alkali metal. Silvery-white appearance, reacts violently with water." },
  { number: 38, symbol: "Sr", name: "Strontium", weight: 87.62, config: "[Kr] 5s2", category: "pt-alkalineearth", period: 5, group: 2, info: "Highly chemically reactive alkaline earth metal. Silvery metal that turns yellow when exposed to air." },
  { number: 39, symbol: "Y", name: "Yttrium", weight: 88.906, config: "[Kr] 4d1 5s2", category: "pt-transitionmetal", period: 5, group: 3, info: "Silvery-metallic transition metal. Often used in LEDs, phosphors, and superconductors." },
  { number: 40, symbol: "Zr", name: "Zirconium", weight: 91.224, config: "[Kr] 4d2 5s2", category: "pt-transitionmetal", period: 5, group: 4, info: "Lustrous, greyish-white, strong transition metal. Highly resistant to corrosion; used in nuclear reactors." },
  { number: 41, symbol: "Nb", name: "Niobium", weight: 92.906, config: "[Kr] 4d4 5s1", category: "pt-transitionmetal", period: 5, group: 5, info: "Light grey, crystalline, ductile transition metal. Superconducting at low temperatures." },
  { number: 42, symbol: "Mo", name: "Molybdenum", weight: 95.95, config: "[Kr] 4d5 5s1", category: "pt-transitionmetal", period: 5, group: 6, info: "Silvery-grey metal. High melting point; used in high-strength steel alloys." },
  { number: 43, symbol: "Tc", name: "Technetium", weight: 98, config: "[Kr] 4d5 5s2", category: "pt-transitionmetal", period: 5, group: 7, info: "Radioactive transition metal. First artificially produced element; used in medical imaging." },
  { number: 44, symbol: "Ru", name: "Ruthenium", weight: 101.07, config: "[Kr] 4d7 5s1", category: "pt-transitionmetal", period: 5, group: 8, info: "Rare transition metal of the platinum group. Highly resistant to chemical attack." },
  { number: 45, symbol: "Rh", name: "Rhodium", weight: 102.91, config: "[Kr] 4d8 5s1", category: "pt-transitionmetal", period: 5, group: 9, info: "Rare, silvery-white transition metal. Extremely reflective and used in catalysts." },
  { number: 46, symbol: "Pd", name: "Palladium", weight: 106.42, config: "[Kr] 4d10", category: "pt-transitionmetal", period: 5, group: 10, info: "Rare, lustrous silvery-white transition metal. Can absorb up to 900 times its volume of hydrogen." },
  { number: 47, symbol: "Ag", name: "Silver", weight: 107.87, config: "[Kr] 4d10 5s1", category: "pt-transitionmetal", period: 5, group: 11, info: "Transition metal. Boasts the highest electrical and thermal conductivity of any metal." },
  { number: 48, symbol: "Cd", name: "Cadmium", weight: 112.41, config: "[Kr] 4d10 5s2", category: "pt-transitionmetal", period: 5, group: 12, info: "Soft, bluish-white metal. Used in electroplating and nickel-cadmium batteries." },
  { number: 49, symbol: "In", name: "Indium", weight: 114.82, config: "[Kr] 4d10 5s2 5p1", category: "pt-posttransition", period: 5, group: 13, info: "Very soft, malleable post-transition metal. Widely used in LCD touchscreens (ITO)." },
  { number: 50, symbol: "Sn", name: "Tin", weight: 118.71, config: "[Kr] 4d10 5s2 5p2", category: "pt-posttransition", period: 5, group: 14, info: "Silvery-white post-transition metal. Combines with copper to form bronze; resists corrosion." },
  { number: 51, symbol: "Sb", name: "Antimony", weight: 121.76, config: "[Kr] 4d10 5s2 5p3", category: "pt-metalloid", period: 5, group: 15, info: "Lustrous gray metalloid. Used as a flame retardant and in lead-acid batteries." },
  { number: 52, symbol: "Te", name: "Tellurium", weight: 127.6, config: "[Kr] 4d10 5s2 5p4", category: "pt-metalloid", period: 5, group: 16, info: "Brittle, mildly toxic, rare silver-white metalloid. Used in solar panels and alloy manufacturing." },
  { number: 53, symbol: "I", name: "Iodine", weight: 126.9, config: "[Kr] 4d10 5s2 5p5", category: "pt-nonmetal", period: 5, group: 17, info: "Lustrous purple-black nonmetal (halogen). Essential nutrient for thyroid hormone synthesis." },
  { number: 54, symbol: "Xe", name: "Xenon", weight: 131.29, config: "[Kr] 4d10 5s2 5p6", category: "pt-noblegas", period: 5, group: 18, info: "Extremely heavy noble gas. Emits a blue glow in discharge lamps; used in flashbulbs and lasers." },
  { number: 55, symbol: "Cs", name: "Cesium", weight: 132.91, config: "[Xe] 6s1", category: "pt-alkalimetal", period: 6, group: 1, info: "Soft, highly reactive alkali metal. Used in atomic clocks defining the standard second." },
  { number: 56, symbol: "Ba", name: "Barium", weight: 137.33, config: "[Xe] 6s2", category: "pt-alkalineearth", period: 6, group: 2, info: "Soft, silvery alkaline earth metal. Used in spark plugs, vacuums, and barium swallow medical tests." },
  { number: 57, symbol: "La", name: "Lanthanum", weight: 138.91, config: "[Xe] 5d1 6s2", category: "pt-lanthanide", period: 9, group: 4, info: "Silvery-white lanthanide. First of the rare-earth elements; used in high-refractive glass lenses." },
  { number: 58, symbol: "Ce", name: "Cerium", weight: 140.12, config: "[Xe] 4f1 5d1 6s2", category: "pt-lanthanide", period: 9, group: 5, info: "Soft, ductile silvery lanthanide metal. The most abundant of the rare-earth elements." },
  { number: 59, symbol: "Pr", name: "Praseodymium", weight: 140.91, config: "[Xe] 4f3 6s2", category: "pt-lanthanide", period: 9, group: 6, info: "Soft, ductile, malleable lanthanide. Used in strong magnets and yellow glass goggles." },
  { number: 60, symbol: "Nd", name: "Neodymium", weight: 144.24, config: "[Xe] 4f4 6s2", category: "pt-lanthanide", period: 9, group: 7, info: "Silvery lanthanide metal. Widely used in high-strength permanent magnets (NdFeB)." },
  { number: 61, symbol: "Pm", name: "Promethium", weight: 145, config: "[Xe] 4f5 6s2", category: "pt-lanthanide", period: 9, group: 8, info: "Extremely rare, radioactive synthetic lanthanide. Used in nuclear batteries and thickness gauges." },
  { number: 62, symbol: "Sm", name: "Samarium", weight: 150.36, config: "[Xe] 4f6 6s2", category: "pt-lanthanide", period: 9, group: 9, info: "Moderately hard, silvery lanthanide. Used in Samarium-Cobalt high-temperature magnets." },
  { number: 63, symbol: "Eu", name: "Europium", weight: 151.96, config: "[Xe] 4f7 6s2", category: "pt-lanthanide", period: 9, group: 10, info: "The most reactive of the rare-earth elements. Used in red phosphors for TV and CRT screens." },
  { number: 64, symbol: "Gd", name: "Gadolinium", weight: 157.25, config: "[Xe] 4f7 5d1 6s2", category: "pt-lanthanide", period: 9, group: 11, info: "Silvery-white lanthanide. Unique magnetic properties; widely used as an MRI contrast agent." },
  { number: 65, symbol: "Tb", name: "Terbium", weight: 158.93, config: "[Xe] 4f9 6s2", category: "pt-lanthanide", period: 9, group: 12, info: "Silvery-grey lanthanide. Malleable and ductile; used in green phosphors and magneto-optical discs." },
  { number: 66, symbol: "Dy", name: "Dysprosium", weight: 162.5, config: "[Xe] 4f10 6s2", category: "pt-lanthanide", period: 9, group: 13, info: "Silvery-lustrous lanthanide. High magnetic susceptibility; used in control rods of nuclear reactors." },
  { number: 67, symbol: "Ho", name: "Holmium", weight: 164.93, config: "[Xe] 4f11 6s2", category: "pt-lanthanide", period: 9, group: 14, info: "Soft, malleable lanthanide. Possesses the highest magnetic strength of any element." },
  { number: 68, symbol: "Er", name: "Erbium", weight: 167.26, config: "[Xe] 4f12 6s2", category: "pt-lanthanide", period: 9, group: 15, info: "Silvery-white lanthanide. Used in fiber-optic amplifiers (EDFA) and medical lasers." },
  { number: 69, symbol: "Tm", name: "Thulium", weight: 168.93, config: "[Xe] 4f13 6s2", category: "pt-lanthanide", period: 9, group: 16, info: "The second rarest lanthanide metal. Easy to machine, used in portable X-ray devices." },
  { number: 70, symbol: "Yb", name: "Ytterbium", weight: 173.05, config: "[Xe] 4f14 6s2", category: "pt-lanthanide", period: 9, group: 17, info: "Soft, malleable lanthanide. Used in steel stress monitors, atomic clocks, and lasers." },
  { number: 71, symbol: "Lu", name: "Lutetium", weight: 174.97, config: "[Xe] 4f14 5d1 6s2", category: "pt-lanthanide", period: 9, group: 18, info: "The hardest and most dense lanthanide. Used in positron emission tomography (PET) scans." },
  { number: 72, symbol: "Hf", name: "Hafnium", weight: 178.49, config: "[Xe] 4f14 5d2 6s2", category: "pt-transitionmetal", period: 6, group: 4, info: "Lustrous, silvery-grey transition metal. Used in nuclear reactor control rods and microprocessors." },
  { number: 73, symbol: "Ta", name: "Tantalum", weight: 180.95, config: "[Xe] 4f14 5d3 6s2", category: "pt-transitionmetal", period: 6, group: 5, info: "Highly corrosion-resistant transition metal. Heavily used in electronic capacitors and implants." },
  { number: 74, symbol: "W", name: "Tungsten", weight: 183.84, config: "[Xe] 4f14 5d4 6s2", category: "pt-transitionmetal", period: 6, group: 6, info: "Strong metal with the highest melting point of all elements (3422°C). Used in filaments." },
  { number: 75, symbol: "Re", name: "Rhenium", weight: 186.21, config: "[Xe] 4f14 5d5 6s2", category: "pt-transitionmetal", period: 6, group: 7, info: "Extremely rare, dense transition metal. Used in high-temperature superalloys for jet engines." },
  { number: 76, symbol: "Os", name: "Osmium", weight: 190.23, config: "[Xe] 4f14 5d6 6s2", category: "pt-transitionmetal", period: 6, group: 8, info: "The densest naturally occurring element. Hard, brittle, and highly reflective." },
  { number: 77, symbol: "Ir", name: "Iridium", weight: 192.22, config: "[Xe] 4f14 5d7 6s2", category: "pt-transitionmetal", period: 6, group: 9, info: "Extremely corrosion-resistant metal. Found in high concentrations in asteroid impact clay." },
  { number: 78, symbol: "Pt", name: "Platinum", weight: 195.08, config: "[Xe] 4f14 5d9 6s1", category: "pt-transitionmetal", period: 6, group: 10, info: "Highly unreactive, precious transition metal. Widely used in jewelry, catalysts, and medicine." },
  { number: 79, symbol: "Au", name: "Gold", weight: 196.97, config: "[Xe] 4f14 5d10 6s1", category: "pt-transitionmetal", period: 6, group: 11, info: "Highly malleable and ductile precious metal. Resistant to most acids; widely used as currency and jewelry." },
  { number: 80, symbol: "Hg", name: "Mercury", weight: 200.59, config: "[Xe] 4f14 5d10 6s2", category: "pt-transitionmetal", period: 6, group: 12, info: "The only metallic element that is liquid at standard temperature and pressure. Extremely toxic." },
  { number: 81, symbol: "Tl", name: "Thallium", weight: 204.38, config: "[Xe] 4f14 5d10 6s2 6p1", category: "pt-posttransition", period: 6, group: 13, info: "Soft, highly toxic post-transition metal. Formerly used in rodenticides and insecticides." },
  { number: 82, symbol: "Pb", name: "Lead", weight: 207.2, config: "[Xe] 4f14 5d10 6s2 6p2", category: "pt-posttransition", period: 6, group: 14, info: "Heavy, soft, malleable post-transition metal. Used in batteries, radiation shielding, and weights." },
  { number: 83, symbol: "Bi", name: "Bismuth", weight: 208.98, config: "[Xe] 4f14 5d10 6s2 6p3", category: "pt-posttransition", period: 6, group: 15, info: "High-density brittle metal. Exhibits low toxicity; famously used in stomach remedies (Pepto-Bismol)." },
  { number: 84, symbol: "Po", name: "Polonium", weight: 209, config: "[Xe] 4f14 5d10 6s2 6p4", category: "pt-metalloid", period: 6, group: 16, info: "Highly radioactive and toxic metalloid. Discovered by Marie Curie; used as a static eliminator." },
  { number: 85, symbol: "At", name: "Astatine", weight: 210, config: "[Xe] 4f14 5d10 6s2 6p5", category: "pt-metalloid", period: 6, group: 17, info: "The rarest naturally occurring element on Earth. Highly radioactive; decays extremely quickly." },
  { number: 86, symbol: "Rn", name: "Radon", weight: 222, config: "[Xe] 4f14 5d10 6s2 6p6", category: "pt-noblegas", period: 6, group: 18, info: "Radioactive noble gas. Accumulates in basements; a major cause of lung cancer worldwide." },
  { number: 87, symbol: "Fr", name: "Francium", weight: 223, config: "[Rn] 7s1", category: "pt-alkalimetal", period: 7, group: 1, info: "Highly radioactive alkali metal. Second rarest element in the Earth's crust." },
  { number: 88, symbol: "Ra", name: "Radium", weight: 226, config: "[Rn] 7s2", category: "pt-alkalineearth", period: 7, group: 2, info: "Highly radioactive alkaline earth metal. Formerly used in luminous watch dials." },
  { number: 89, symbol: "Ac", name: "Actinium", weight: 227, config: "[Rn] 6d1 7s2", category: "pt-actinide", period: 10, group: 4, info: "Highly radioactive actinide element. Glows with a pale blue light in the dark." },
  { number: 90, symbol: "Th", name: "Thorium", weight: 232.04, config: "[Rn] 6d2 7s2", category: "pt-actinide", period: 10, group: 5, info: "Radioactive actinide metal. Considered a potential safer alternative fuel to uranium in reactors." },
  { number: 91, symbol: "Pa", name: "Protactinium", weight: 231.04, config: "[Rn] 5f2 6d1 7s2", category: "pt-actinide", period: 10, group: 6, info: "Dense, radioactive actinide. Highly toxic and bioaccumulative." },
  { number: 92, symbol: "U", name: "Uranium", weight: 238.03, config: "[Rn] 5f3 6d1 7s2", category: "pt-actinide", period: 10, group: 7, info: "Highly dense radioactive metal. Fissionable isotopes make it key for nuclear power and weapons." },
  { number: 93, symbol: "Np", name: "Neptunium", weight: 237, config: "[Rn] 5f4 6d1 7s2", category: "pt-actinide", period: 10, group: 8, info: "Radioactive synthetic element. First transuranium element synthesized in a laboratory." },
  { number: 94, symbol: "Pu", name: "Plutonium", weight: 244, config: "[Rn] 5f6 7s2", category: "pt-actinide", period: 10, group: 9, info: "Synthetic radioactive element. Crucial for nuclear weapons and deep space probes." },
  { number: 95, symbol: "Am", name: "Americium", weight: 243, config: "[Rn] 5f7 7s2", category: "pt-actinide", period: 10, group: 10, info: "Radioactive synthetic element. Commonly used in household ionization smoke detectors." },
  { number: 96, symbol: "Cm", name: "Curium", weight: 247, config: "[Rn] 5f7 6d1 7s2", category: "pt-actinide", period: 10, group: 11, info: "Synthetic radioactive element. Extremely radioactive; glows spontaneously from its own decay heat." },
  { number: 97, symbol: "Bk", name: "Berkelium", weight: 247, config: "[Rn] 5f9 7s2", category: "pt-actinide", period: 10, group: 12, info: "Radioactive synthetic metal. Produced in minute quantities for scientific research." },
  { number: 98, symbol: "Cf", name: "Californium", weight: 251, config: "[Rn] 5f10 7s2", category: "pt-actinide", period: 10, group: 13, info: "Extremely strong neutron emitter. Used to start nuclear reactors and synthesize heavier elements." },
  { number: 99, symbol: "Es", name: "Einsteinium", weight: 252, config: "[Rn] 5f11 7s2", category: "pt-actinide", period: 10, group: 14, info: "Highly radioactive synthetic element. Discovered in debris of the first thermonuclear bomb test." },
  { number: 100, symbol: "Fm", name: "Fermium", weight: 257, config: "[Rn] 5f12 7s2", category: "pt-actinide", period: 10, group: 15, info: "Radioactive synthetic element. The heaviest element that can be formed by neutron bombardment." },
  { number: 101, symbol: "Md", name: "Mendelevium", weight: 258, config: "[Rn] 5f13 7s2", category: "pt-actinide", period: 10, group: 16, info: "Synthetic element named after Mendeleev. Highly radioactive; only produced in particle accelerators." },
  { number: 102, symbol: "No", name: "Nobelium", weight: 259, config: "[Rn] 5f14 7s2", category: "pt-actinide", period: 10, group: 17, info: "Highly radioactive synthetic metal. Named after Alfred Nobel." },
  { number: 103, symbol: "Lr", name: "Lawrencium", weight: 262, config: "[Rn] 5f14 6d1 7s2", category: "pt-actinide", period: 10, group: 18, info: "Highly radioactive synthetic element. Synthesized by bombarding californium." },
  { number: 104, symbol: "Rf", name: "Rutherfordium", weight: 267, config: "[Rn] 5f14 6d2 7s2", category: "pt-transitionmetal", period: 7, group: 4, info: "Extremely radioactive synthetic element. First of the transactinides; very short half-life." },
  { number: 105, symbol: "Db", name: "Dubnium", weight: 268, config: "[Rn] 5f14 6d3 7s2", category: "pt-transitionmetal", period: 7, group: 5, info: "Radioactive synthetic element. Highly unstable; only a few atoms ever produced." },
  { number: 106, symbol: "Sg", name: "Seaborgium", weight: 269, config: "[Rn] 5f14 6d4 7s2", category: "pt-transitionmetal", period: 7, group: 6, info: "Synthetic transition metal. Named after Glenn Seaborg; decays via alpha emission." },
  { number: 107, symbol: "Bh", name: "Bohrium", weight: 270, config: "[Rn] 5f14 6d5 7s2", category: "pt-transitionmetal", period: 7, group: 7, info: "Synthetic radioactive element. Extremely short half-life (a few seconds)." },
  { number: 108, symbol: "Hs", name: "Hassium", weight: 269, config: "[Rn] 5f14 6d6 7s2", category: "pt-transitionmetal", period: 7, group: 8, info: "Radioactive synthetic transition metal. Named after the German state of Hesse." },
  { number: 109, symbol: "Mt", name: "Meitnerium", weight: 278, config: "[Rn] 5f14 6d7 7s2", category: "pt-transitionmetal", period: 7, group: 9, info: "Synthetic element named after Lise Meitner. Extremely unstable transuranium element." },
  { number: 110, symbol: "Ds", name: "Darmstadtium", weight: 281, config: "[Rn] 5f14 6d9 7s1", category: "pt-transitionmetal", period: 7, group: 10, info: "Synthetic element named after Darmstadt. Decays in milliseconds." },
  { number: 111, symbol: "Rg", name: "Roentgenium", weight: 282, config: "[Rn] 5f14 6d10 7s1", category: "pt-transitionmetal", period: 7, group: 11, info: "Synthetic element named after Wilhelm Röntgen. Highly unstable radioactive transuranide." },
  { number: 112, symbol: "Cn", name: "Copernicium", weight: 285, config: "[Rn] 5f14 6d10 7s2", category: "pt-transitionmetal", period: 7, group: 12, info: "Highly radioactive synthetic transition metal. Named after Nicolaus Copernicus." },
  { number: 113, symbol: "Nh", name: "Nihonium", weight: 286, config: "[Rn] 5f14 6d10 7s2 7p1", category: "pt-posttransition", period: 7, group: 13, info: "Synthetic element discovered by Japanese researchers. Decays extremely quickly." },
  { number: 114, symbol: "Fl", name: "Flerovium", weight: 289, config: "[Rn] 5f14 6d10 7s2 7p2", category: "pt-posttransition", period: 7, group: 14, info: "Extremely radioactive synthetic element. Named after Flerov Laboratory." },
  { number: 115, symbol: "Mc", name: "Moscovium", weight: 290, config: "[Rn] 5f14 6d10 7s2 7p3", category: "pt-posttransition", period: 7, group: 15, info: "Synthetic element discovered by Dubna-Livermore collaboration. Highly unstable." },
  { number: 116, symbol: "Lv", name: "Livermorium", weight: 293, config: "[Rn] 5f14 6d10 7s2 7p4", category: "pt-posttransition", period: 7, group: 16, info: "Radioactive synthetic post-transition metal. Named after Lawrence Livermore Lab." },
  { number: 117, symbol: "Ts", name: "Tennessine", weight: 294, config: "[Rn] 5f14 6d10 7s2 7p5", category: "pt-metalloid", period: 7, group: 17, info: "Synthetic superheavy element. Second heaviest known element; decays in milliseconds." },
  { number: 118, symbol: "Og", name: "Oganesson", weight: 294, config: "[Rn] 5f14 6d10 7s2 7p6", category: "pt-noblegas", period: 7, group: 18, info: "The heaviest element synthesized to date. Highly unstable transactinide element." }
];

// Walk DOM nodes safely to inject math wrapping for KaTeX auto-render
function replaceCeInTextNodes(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.textContent;
    let newText = text;
    try {
      newText = text.replace(/(?<!\$)\\ce\{([^\}]+)\}(?!\$)/g, '$\\ce{$1}$');
    } catch (e) {
      newText = text.replace(/\\ce\{([^\}]+)\}/g, (match) => {
        return '$' + match + '$';
      });
    }
    if (newText !== text) {
      node.textContent = newText;
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const tag = node.tagName.toLowerCase();
    if (tag !== 'script' && tag !== 'style' && tag !== 'textarea' && tag !== 'input' && tag !== 'code') {
      for (let child of node.childNodes) {
        replaceCeInTextNodes(child);
      }
    }
  }
}

function renderChemistrySymbols(element) {
  if (!element) return;
  
  replaceCeInTextNodes(element);

  if (typeof renderMathInElement === 'function') {
    renderMathInElement(element, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false },
        { left: "\\[", right: "\\]", display: true }
      ],
      throwOnError: false
    });
  }
}

// Interactive Periodic Table Grid populator
function buildPeriodicTableGrid() {
  const container = document.getElementById('periodic-table-grid');
  if (!container) return;

  container.innerHTML = '';
  
  // 10 periods (1-7 standard, 8 is spacer, 9 is Lanthanides, 10 is Actinides)
  for (let p = 1; p <= 10; p++) {
    if (p === 8) {
      container.insertAdjacentHTML('beforeend', `<div style="grid-column: span 18; height: 12px; visibility: hidden;"></div>`);
      continue;
    }
    for (let g = 1; g <= 18; g++) {
      if (p === 6 && g === 3) {
        const itemHTML = `
          <button class="pt-element pt-lanthanide" style="opacity: 0.85;" onclick="showGroupDetails('lanthanides')">
            <span class="pt-element-num">57-71</span>
            <span class="pt-element-sym">La-Lu</span>
            <span class="pt-element-name">Lanthanides</span>
          </button>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
      } else if (p === 7 && g === 3) {
        const itemHTML = `
          <button class="pt-element pt-actinide" style="opacity: 0.85;" onclick="showGroupDetails('actinides')">
            <span class="pt-element-num">89-103</span>
            <span class="pt-element-sym">Ac-Lr</span>
            <span class="pt-element-name">Actinides</span>
          </button>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
      } else {
        const element = periodicTableElements.find(el => el.period === p && el.group === g);
        if (element) {
          const itemHTML = `
            <button class="pt-element ${element.category}" onclick="showElementDetails(${element.number})">
              <span class="pt-element-num">${element.number}</span>
              <span class="pt-element-sym">${element.symbol}</span>
              <span class="pt-element-name">${element.name}</span>
            </button>
          `;
          container.insertAdjacentHTML('beforeend', itemHTML);
        } else {
          container.insertAdjacentHTML('beforeend', `<div class="pt-spacer"></div>`);
        }
      }
    }
  }
}

function showGroupDetails(group) {
  const detailBox = document.getElementById('pt-element-details');
  const symbolEl = document.getElementById('pt-detail-symbol');
  const nameEl = document.getElementById('pt-detail-name');
  const numberEl = document.getElementById('pt-detail-number');
  const weightEl = document.getElementById('pt-detail-weight');
  const configEl = document.getElementById('pt-detail-config');
  const infoEl = document.getElementById('pt-detail-info');

  if (!detailBox) return;

  symbolEl.className = '';
  if (group === 'lanthanides') {
    symbolEl.classList.add('pt-lanthanide');
    symbolEl.innerText = 'La-Lu';
    nameEl.innerText = 'Lanthanides';
    numberEl.innerText = 'Atomic Numbers: 57-71';
    weightEl.innerText = '138.9 - 175.0';
    configEl.innerText = '[Xe] 4f^n 5d^m 6s^2';
    infoEl.innerHTML = 'The lanthanides or lanthanoid series of chemical elements comprises the 15 metallic chemical elements with atomic numbers 57 through 71. These elements, along with chemically similar yttrium and scandium, are often collectively known as the rare-earth elements.';
  } else {
    symbolEl.classList.add('pt-actinide');
    symbolEl.innerText = 'Ac-Lr';
    nameEl.innerText = 'Actinides';
    numberEl.innerText = 'Atomic Numbers: 89-103';
    weightEl.innerText = '227 - 262';
    configEl.innerText = '[Rn] 5f^n 6d^m 7s^2';
    infoEl.innerHTML = 'The actinide or actinoid series encompasses the 15 metallic chemical elements with atomic numbers 89 through 103. They are all radioactive, and most are synthetic (man-made), with uranium and thorium being the only ones found in significant quantities in nature.';
  }

  detailBox.style.display = 'block';
  playSFX(true);
}
window.showGroupDetails = showGroupDetails;

function showElementDetails(number) {
  const element = periodicTableElements.find(el => el.number === number);
  if (!element) return;

  const detailBox = document.getElementById('pt-element-details');
  const symbolEl = document.getElementById('pt-detail-symbol');
  const nameEl = document.getElementById('pt-detail-name');
  const numberEl = document.getElementById('pt-detail-number');
  const weightEl = document.getElementById('pt-detail-weight');
  const configEl = document.getElementById('pt-detail-config');
  const infoEl = document.getElementById('pt-detail-info');

  if (!detailBox) return;

  symbolEl.className = '';
  symbolEl.classList.add(element.category);
  symbolEl.innerText = element.symbol;
  nameEl.innerText = element.name;
  numberEl.innerText = `Atomic Number: ${element.number} | Period: ${element.period} | Group: ${element.group}`;
  weightEl.innerText = element.weight;
  configEl.innerText = element.config;
  infoEl.innerHTML = element.info;

  detailBox.style.display = 'block';
  playSFX(true);
}

function togglePeriodicTable() {
  const modal = document.getElementById('periodic-table-modal');
  if (!modal) return;
  const isHidden = modal.style.display === 'none';
  if (isHidden) {
    buildPeriodicTableGrid();
    modal.style.display = 'flex';
    const detailBox = document.getElementById('pt-element-details');
    if (detailBox) detailBox.style.display = 'none';
    playSFX(true);
  } else {
    modal.style.display = 'none';
    playSFX(false);
  }
}

function updatePeriodicTableButtonVisibility() {
  const ptBtn = document.getElementById('header-pt-btn');
  if (!ptBtn) return;

  const isQuizRunning = activeQuizData !== null;
  const isEligibleMode = [
    'notes', 'assessments', 'foundations', 'syllabus', 'references', 'guidelines',
    'faculty-classes', 'faculty-gradebook', 'faculty-groups', 'faculty-class-details'
  ].includes(currentMode);
  
  if (currentUser && (currentUserRole === 'student' || currentUserRole === 'faculty') && (isEligibleMode || isQuizRunning)) {
    ptBtn.style.display = 'inline-block';
  } else {
    ptBtn.style.display = 'none';
  }
}

// DOCX Exam Template Text-Based Parser
function parseExamText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
  let title = "Custom Classroom Exam";
  let timeLimitSeconds = 600; // default 10 minutes
  let questions = [];
  let currentQuestion = null;
  let runningQuestionTimeLimit = null;
  let hasSeparatorBefore = false;

  for (let line of lines) {
    let cleanLine = line.replace(/[\*_]/g, '').trim();
    if (cleanLine.startsWith('#')) {
      cleanLine = cleanLine.replace(/^#+\s*/, '').trim();
    }

    if (cleanLine.startsWith('---')) {
      hasSeparatorBefore = true;
      continue;
    }

    if (cleanLine.toLowerCase().startsWith('title:') || cleanLine.toLowerCase().startsWith('exam title:')) {
      title = cleanLine.substring(cleanLine.indexOf(':') + 1).trim();
      continue;
    }
    if (cleanLine.toLowerCase().startsWith('time limit:') || cleanLine.toLowerCase().startsWith('duration:') || cleanLine.toLowerCase().startsWith('time:')) {
      const valStr = cleanLine.substring(cleanLine.indexOf(':') + 1).trim().toLowerCase();
      const numMatch = valStr.match(/\d+/);
      if (numMatch) {
        const num = parseInt(numMatch[0]);
        let seconds = num;
        if (valStr.includes('hour') || valStr.includes('hr')) {
          seconds = num * 3600;
        } else if (valStr.includes('second') || valStr.includes('sec')) {
          seconds = num;
        } else {
          seconds = num * 60;
        }

        if (valStr.includes('second') || valStr.includes('sec') || questions.length > 0 || hasSeparatorBefore) {
          runningQuestionTimeLimit = seconds;
        } else {
          timeLimitSeconds = seconds;
        }
      }
      continue;
    }

    const qMatch = cleanLine.match(/^(?:###\s*|[-\*\s]*)(\d+)[\.\)]\s*(.*)/);
    if (qMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        question: qMatch[2].trim(),
        choices: [],
        type: 'mc',
        answer: null,
        points: 1,
        timeLimitSeconds: runningQuestionTimeLimit
      };
      continue;
    }

    if (!currentQuestion) continue;

    const optMatch = cleanLine.match(/^(?:[-\*\s]*)([A-D])[\.\)\-]\s*(.*)/i);
    if (optMatch) {
      currentQuestion.choices.push(optMatch[2].trim());
      currentQuestion.type = 'mc';
      continue;
    }

    if (cleanLine.toLowerCase().startsWith('answer:') || cleanLine.toLowerCase().startsWith('ans:')) {
      currentQuestion.rawAnswer = cleanLine.substring(cleanLine.indexOf(':') + 1).trim();
      continue;
    }

    if (cleanLine.toLowerCase().startsWith('points:') || cleanLine.toLowerCase().startsWith('pts:')) {
      currentQuestion.points = parseInt(cleanLine.substring(cleanLine.indexOf(':') + 1).trim()) || 1;
      continue;
    }

    if (currentQuestion.choices.length === 0 && !currentQuestion.rawAnswer) {
      currentQuestion.question += ' ' + cleanLine;
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  questions = questions.map((q, idx) => {
    const rawAns = (q.rawAnswer || '').trim();
    delete q.rawAnswer;

    if (q.choices.length > 0) {
      q.type = 'mc';
      let ansIndex = -1;
      const letterMatch = rawAns.match(/^[A-D]/i);
      if (letterMatch) {
        ansIndex = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
      } else {
        ansIndex = q.choices.findIndex(c => c.toLowerCase() === rawAns.toLowerCase());
      }
      q.answer = ansIndex >= 0 ? ansIndex : 0;
    } else {
      const isTF = q.question.toLowerCase().includes('(true/false)') || 
                   rawAns.toLowerCase() === 'true' || 
                   rawAns.toLowerCase() === 'false' ||
                   rawAns.toLowerCase() === 't' || 
                   rawAns.toLowerCase() === 'f';
      if (isTF) {
        q.type = 'tf';
        q.answer = (rawAns.toLowerCase() === 'true' || rawAns.toLowerCase() === 't');
      } else {
        q.type = 'id';
        q.answer = rawAns;
      }
    }
    q.id = `q_${idx + 1}`;
    return q;
  });

  const hasAnyQuestionTimer = questions.some(q => q.timeLimitSeconds !== null && q.timeLimitSeconds !== undefined);
  return {
    title,
    timeLimitSeconds: hasAnyQuestionTimer ? null : timeLimitSeconds,
    questions
  };
}

let parsedCustomQuiz = null;

function handleDocxExamFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const fileName = file.name.toLowerCase();
  const reader = new FileReader();

  if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    reader.onload = function(e) {
      const text = e.target.result;
      processExamText(text);
    };
    reader.readAsText(file);
  } else if (fileName.endsWith('.docx')) {
    reader.onload = function(e) {
      const arrayBuffer = e.target.result;
      if (typeof mammoth === 'undefined') {
        alert("Mammoth.js library is not loaded. Please verify internet connection.");
        return;
      }
      mammoth.extractRawText({ arrayBuffer: arrayBuffer })
        .then(result => {
          const text = result.value;
          processExamText(text);
        })
        .catch(err => {
          console.error("Mammoth extraction error:", err);
          alert("Failed to parse DOCX file: " + err.message);
        });
    };
    reader.readAsArrayBuffer(file);
  } else {
    alert("Unsupported file format. Please upload a .docx, .txt, or .md file.");
  }
  event.target.value = '';
}

function processExamText(text) {
  const quiz = parseExamText(text);
  if (!quiz || quiz.questions.length === 0) {
    alert("Could not parse any questions from the document. Please check the template formatting.");
    return;
  }

  parsedCustomQuiz = quiz;
  parsedCustomQuiz.id = 'custom_quiz_' + Date.now();

  document.getElementById('pt-exam-title').innerText = quiz.title;
  document.getElementById('pt-exam-limit').innerText = `${Math.round(quiz.timeLimitSeconds / 60)} mins`;
  document.getElementById('pt-exam-qcount').innerText = quiz.questions.length;

  const qListContainer = document.getElementById('exam-preview-questions-list');
  qListContainer.innerHTML = '';

  quiz.questions.forEach((q, idx) => {
    let choicesHTML = '';
    if (q.type === 'mc') {
      choicesHTML = `<div style="margin-left: 15px; font-size:12.5px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px; margin-top:4px;">
        ${q.choices.map((c, cIdx) => `<div>${String.fromCharCode(65 + cIdx)}) ${escapeHtml(c)} ${cIdx === q.answer ? '✅' : ''}</div>`).join('')}
      </div>`;
    }

    qListContainer.insertAdjacentHTML('beforeend', `
      <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-card); border-radius:10px; padding:12px; text-align:left;">
        <div style="font-weight:700; font-size:13.5px; color:var(--text-main);">${idx + 1}. ${escapeHtml(q.question)}</div>
        ${choicesHTML}
        <div style="margin-top:8px; font-size:11.5px; color:var(--text-muted); display:flex; justify-content:space-between;">
          <span>Answer: <strong>${q.type === 'mc' ? String.fromCharCode(65 + q.answer) : escapeHtml(q.answer.toString())}</strong></span>
          <span>Points: <strong>${q.points}</strong></span>
        </div>
      </div>
    `);
  });

  document.getElementById('exam-preview-modal').style.display = 'flex';
  playSFX(true);
}

function publishImportedExam() {
  if (!parsedCustomQuiz || !facultySelectedClassId) return;

  const classId = facultySelectedClassId;

  if (classId === 'sample_class_49c') {
    if (!GLOBAL_SAMPLE_CLASS.customQuizzes) {
      GLOBAL_SAMPLE_CLASS.customQuizzes = [];
    }
    GLOBAL_SAMPLE_CLASS.customQuizzes.push(parsedCustomQuiz);
    firestore.collection('classes').doc(classId).update({
      customQuizzes: firebase.firestore.FieldValue.arrayUnion(parsedCustomQuiz)
    }).catch(err => console.warn("Firestore update failed for sample class customQuizzes:", err));

    alert("Exam successfully imported and published to class roster!");
    document.getElementById('exam-preview-modal').style.display = 'none';
    parsedCustomQuiz = null;
    playSFX(true);
    renderFacultyClassDetailsView();
    return;
  }

  firestore.collection('classes').doc(classId).update({
    customQuizzes: firebase.firestore.FieldValue.arrayUnion(parsedCustomQuiz)
  })
  .then(() => {
    alert("Exam successfully imported and published to class roster!");
    document.getElementById('exam-preview-modal').style.display = 'none';
    parsedCustomQuiz = null;
    playSFX(true);
    renderFacultyClassDetailsView();
  })
  .catch(err => {
    console.error("Failed to publish custom exam:", err);
    alert("Failed to publish custom exam: " + err.message);
  });
}

function closeExamPreviewModal() {
  document.getElementById('exam-preview-modal').style.display = 'none';
  parsedCustomQuiz = null;
  playSFX(false);
}

function deleteCustomQuiz(classId, quizId) {
  if (!confirm("Are you sure you want to delete this custom exam? This will remove all records of this exam for students.")) return;

  if (classId === 'sample_class_49c') {
    const customQuizzes = GLOBAL_SAMPLE_CLASS.customQuizzes || [];
    GLOBAL_SAMPLE_CLASS.customQuizzes = customQuizzes.filter(q => q.id !== quizId);

    const scheduledQuizzes = GLOBAL_SAMPLE_CLASS.scheduledQuizzes || [];
    GLOBAL_SAMPLE_CLASS.scheduledQuizzes = scheduledQuizzes.filter(id => id !== quizId);

    firestore.collection('classes').doc(classId).update({
      customQuizzes: GLOBAL_SAMPLE_CLASS.customQuizzes,
      scheduledQuizzes: GLOBAL_SAMPLE_CLASS.scheduledQuizzes
    }).catch(err => console.warn("Firestore delete failed for sample class:", err));

    alert("Custom exam deleted successfully.");
    renderFacultyClassDetailsView();
    return;
  }

  firestore.collection('classes').doc(classId).get()
    .then(doc => {
      if (!doc.exists) return;
      const classData = doc.data();
      const customQuizzes = classData.customQuizzes || [];
      const updatedQuizzes = customQuizzes.filter(q => q.id !== quizId);

      const scheduledQuizzes = classData.scheduledQuizzes || [];
      const updatedScheduled = scheduledQuizzes.filter(id => id !== quizId);

      return firestore.collection('classes').doc(classId).update({
        customQuizzes: updatedQuizzes,
        scheduledQuizzes: updatedScheduled
      });
    })
    .then(() => {
      alert("Custom exam deleted successfully.");
      renderFacultyClassDetailsView();
    })
    .catch(err => {
      console.error("Error deleting custom quiz:", err);
      alert("Failed to delete custom quiz: " + err.message);
    });
}

function downloadDocxTemplate() {
  const content = `Title: Inorganic Chemistry Quiz 1
Time Limit: 15 minutes

1. Which element has the chemical symbol "O"?
A) Osmium
B) Oxygen
C) Gold
D) Helium
Answer: B
Points: 2

2. Water consists of hydrogen and oxygen. (True/False)
Answer: True
Points: 1

3. What is the atomic symbol of Carbon?
Answer: C
Points: 2
`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'exam_template.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Progressive Learning Paths student checklist
function toggleMaterialCompleted(materialId, completed) {
  if (!currentUser || currentUserRole !== 'student') return;

  const email = currentUser.email;
  const op = completed ?
    firebase.firestore.FieldValue.arrayUnion(materialId) :
    firebase.firestore.FieldValue.arrayRemove(materialId);

  firestore.collection('students').doc(email).update({
    completedMaterials: op
  })
  .then(() => {
    console.log(`Updated material ${materialId} completion: ${completed}`);
    if (!currentUser.completedMaterials) {
      currentUser.completedMaterials = [];
    }
    if (completed) {
      if (!currentUser.completedMaterials.includes(materialId)) {
        currentUser.completedMaterials.push(materialId);
      }
    } else {
      currentUser.completedMaterials = currentUser.completedMaterials.filter(id => id !== materialId);
    }
    localStorage.setItem('student_user_session', JSON.stringify(currentUser));
    localStorage.setItem('doc_lms_saved_profile', JSON.stringify(currentUser));
    
    playSFX(completed);

    if (activeMode === 'notes') {
      renderLectureNotesView();
    }
  })
  .catch(err => {
    console.error("Failed to update material completion:", err);
    alert("Failed to update status: " + err.message);
  });
}

// Custom quiz runner trigger
function startCustomQuizRunner(quizId) {
  playSFX(true);
  
  const classData = activeStudentClassData[currentCourseId];
  if (!classData || !classData.customQuizzes) return;

  const targetQuiz = classData.customQuizzes.find(q => q.id === quizId);
  if (!targetQuiz) return;

  const savedScore = localStorage.getItem(`quiz_score_${currentUser.email}_${quizId}`);
  if (savedScore !== null) {
    alert("You have already completed this quiz. Retakes are not allowed.");
    return;
  }

  activeQuizModule = { id: quizId, title: targetQuiz.title };
  activeQuizData = targetQuiz;
  currentQuestionIndex = 0;
  quizScore = 0;
  quizAnswers = [];
  wrongAnswersLog = [];

  document.getElementById('view-meta').style.display = 'flex';
  document.getElementById('slide-mode-label').innerText = 'Classroom Quiz Mode';
  document.getElementById('slide-num-label').innerText = `Question 1 of ${activeQuizData.questions.length}`;
  document.getElementById('progress-bar').style.width = '0%';
  const progContainer = document.getElementById('progress-container');
  if (progContainer) progContainer.style.display = 'block';

  if (activeQuizData.timeLimitSeconds) {
    quizSecondsLeft = activeQuizData.timeLimitSeconds;
    startQuizTimer();
  }

  renderQuizQuestion();
}

function seedSampleData() {
  const seededKey = 'doc_hub_sample_seeded_v3';
  if (localStorage.getItem(seededKey)) {
    console.log("Sample classroom already seeded in this browser.");
    return;
  }

  console.log("Seeding sample classroom data...");
  firestore.collection('classes').doc('sample_class_49c').set(GLOBAL_SAMPLE_CLASS)
    .then(() => {
      localStorage.setItem(seededKey, 'true');
      console.log("Sample classroom data check/seeding complete.");
    })
    .catch(err => {
      console.error("Error seeding sample classroom data:", err);
    });
}

// Auto-run database seed check
setTimeout(() => {
  if (typeof firestore !== 'undefined') {
    seedSampleData();
  }
}, 2000);

window.togglePeriodicTable = togglePeriodicTable;
window.showElementDetails = showElementDetails;
window.handleDocxExamFileSelect = handleDocxExamFileSelect;
window.publishImportedExam = publishImportedExam;
window.closeExamPreviewModal = closeExamPreviewModal;
window.deleteCustomQuiz = deleteCustomQuiz;
window.downloadDocxTemplate = downloadDocxTemplate;
window.toggleMaterialCompleted = toggleMaterialCompleted;
window.startCustomQuizRunner = startCustomQuizRunner;
window.renderChemistrySymbols = renderChemistrySymbols;

function showCustomAlert(message, type = 'info', onOk) {
  const modal = document.getElementById('custom-alert-modal');
  const msgEl = document.getElementById('custom-alert-message');
  const okBtn = document.getElementById('custom-alert-ok-btn');

  if (!modal || !msgEl || !okBtn) {
    alert(message.replace(/<br>/g, '\n').replace(/<\/?[^>]+(>|$)/g, ""));
    if (onOk) onOk();
    return;
  }

  msgEl.innerHTML = message;
  modal.style.display = 'flex';

  const closeAlert = () => {
    modal.style.display = 'none';
    okBtn.removeEventListener('click', handleOk);
    if (onOk) onOk();
  };

  const handleOk = (e) => {
    e.preventDefault();
    closeAlert();
  };

  okBtn.addEventListener('click', handleOk);
}

function showCustomConfirm(message, callback) {
  const modal = document.getElementById('custom-confirm-modal');
  const msgEl = document.getElementById('custom-confirm-message');
  const okBtn = document.getElementById('custom-confirm-ok-btn');
  const cancelBtn = document.getElementById('custom-confirm-cancel-btn');

  if (!modal || !msgEl || !okBtn || !cancelBtn) {
    const res = confirm(message.replace(/<br>/g, '\n').replace(/<\/?[8^>]+(>|$)/g, ""));
    callback(res);
    return;
  }

  msgEl.innerHTML = message;
  modal.style.display = 'flex';

  const cleanUp = () => {
    modal.style.display = 'none';
    okBtn.removeEventListener('click', handleOk);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  const handleOk = (e) => {
    e.preventDefault();
    cleanUp();
    callback(true);
  };

  const handleCancel = (e) => {
    e.preventDefault();
    cleanUp();
    callback(false);
  };

  okBtn.addEventListener('click', handleOk);
  cancelBtn.addEventListener('click', handleCancel);
}

window.showCustomAlert = showCustomAlert;
window.showCustomConfirm = showCustomConfirm;

function loadAdminActivityLogs() {
  const container = document.getElementById('admin-activity-logs-container');
  if (!container) return;

  firestore.collection('activity_logs')
    .orderBy('timestamp', 'desc')
    .limit(15)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        container.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); font-style: italic;">No activities logged yet.</div>`;
        return;
      }

      let html = '';
      snapshot.forEach(doc => {
        const log = doc.data();
        const dateStr = log.timestamp 
          ? new Date(log.timestamp.seconds * 1000).toLocaleString() 
          : new Date().toLocaleString();
        
        let text = '';
        let icon = 'ℹ️';

        if (log.type === 'role_change') {
          icon = '👥';
          const actionText = log.details.action === 'demote_student' ? 'demoted to Student' : (log.details.action === 'add_role' ? `promoted by adding ${log.details.role.toUpperCase()} to` : `removed ${log.details.role.toUpperCase()} from`);
          text = `<strong>${escapeHtml(log.adminName)}</strong> ${actionText} <strong>${escapeHtml(log.details.targetName)}</strong> (${escapeHtml(log.details.targetEmail)}).`;
        } else if (log.type === 'class_status') {
          if (log.details.bulk) {
            icon = log.details.action === 'approved' ? '✅' : '❌';
            text = `<strong>${escapeHtml(log.adminName)}</strong> bulk-${log.details.action} <strong>${log.details.count} classroom request(s)</strong>.`;
          } else {
            icon = log.details.status === 'approved' ? '✅' : (log.details.status === 'deleted' ? '🗑️' : '❌');
            text = `<strong>${escapeHtml(log.adminName)}</strong> ${log.details.status} class request <strong>${escapeHtml(log.details.courseName)}</strong> (Sec ${escapeHtml(log.details.section)}) for instructor ${escapeHtml(log.details.facultyName)}.`;
          }
        } else if (log.type === 'semester_config') {
          icon = '📅';
          text = `<strong>${escapeHtml(log.adminName)}</strong> updated the semester calendar: Start <strong>${escapeHtml(log.details.startDate)}</strong>, End <strong>${escapeHtml(log.details.endDate)}</strong>.`;
        } else if (log.type === 'version_activate') {
          icon = '🟢';
          text = `<strong>${escapeHtml(log.adminName)}</strong> activated version <strong>${escapeHtml(log.details.version)}</strong> as ${log.details.phase.toUpperCase()}.`;
        } else if (log.type === 'version_archive') {
          icon = '⚪';
          text = `<strong>${escapeHtml(log.adminName)}</strong> archived version <strong>${escapeHtml(log.details.version)}</strong>.`;
        } else if (log.type === 'version_status_change') {
          icon = '💾';
          text = `<strong>${escapeHtml(log.adminName)}</strong> changed version <strong>${escapeHtml(log.details.version)}</strong> status to ${log.details.status.toUpperCase()}.`;
        } else if (log.type === 'version_restore') {
          icon = '🔄';
          text = `<strong>${escapeHtml(log.adminName)}</strong> prepared version <strong>${escapeHtml(log.details.version)}</strong> for restore (status set to WORKING).`;
        } else {
          text = JSON.stringify(log.details);
        }

        html += `
          <div style="padding: 10px 12px; background: var(--bg-body); border: 1px solid var(--border-card); border-radius: 8px; display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.4;">
            <span style="font-size: 16px; margin-top: 2px;">${icon}</span>
            <div style="flex: 1;">
              <div>${text}</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${dateStr} by ${escapeHtml(log.adminEmail)}</div>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
    })
    .catch(err => {
      console.error("Error loading activity logs:", err);
      container.innerHTML = `<div style="font-size: 13px; color: var(--incorrect);">⚠️ Failed to load logs: ${err.message}</div>`;
    });
}
window.loadAdminActivityLogs = loadAdminActivityLogs;

function loadBackupCatalog() {
  const container = document.getElementById('admin-backups-container');
  if (!container) return;

  firestore.collection('system_settings').doc('config').get()
    .then(configDoc => {
      const configData = configDoc.exists ? configDoc.data() : {};
      const liveVer = configData.liveVersion || '';
      const testingVer = configData.testingVersion || '';
      const systemStatus = configData.status || 'live';

      return fetch('backups/backup_index.json')
        .then(res => {
          if (!res.ok) throw new Error("No backup index found.");
          return res.json();
        })
        .then(backups => {
          return firestore.collection('backup_releases').get().then(snap => {
            const releaseStatuses = {};
            snap.forEach(doc => {
              releaseStatuses[doc.id] = doc.data().status;
            });

            if (!backups || backups.length === 0) {
              container.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); font-style: italic;">No backup versions recorded yet. Run "python3 qa-tools/backup_restore.py" in your terminal to save a version.</div>`;
              return;
            }

            // Resolve statuses first
            backups.forEach(b => {
              let status = b.status || 'Working';
              if (releaseStatuses[b.version]) {
                status = releaseStatuses[b.version];
              }
              if (b.version === liveVer) {
                status = 'Live';
              } else if (b.version === testingVer) {
                status = 'Testing';
              }
              b.resolvedStatus = status;
            });

            // Sort dynamically
            const field = window.backupsSortField || 'date';
            const asc = window.backupsSortAsc;
            backups.sort((a, b) => {
              let valA = a[field] || '';
              let valB = b[field] || '';
              if (field === 'date') {
                valA = new Date(valA || 0);
                valB = new Date(valB || 0);
              } else if (field === 'status') {
                valA = a.resolvedStatus || '';
                valB = b.resolvedStatus || '';
              }
              if (valA < valB) return asc ? -1 : 1;
              if (valA > valB) return asc ? 1 : -1;
              return 0;
            });

            const displayedBackups = backups.slice(0, 30);

            const getSortArrow = (f) => {
              if (window.backupsSortField !== f) return '';
              return window.backupsSortAsc ? ' ▲' : ' ▼';
            };

            let html = `
              <div style="display:flex; flex-direction:column; gap:10px; overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:13.5px; text-align:left; min-width: 650px;">
                  <thead>
                    <tr style="border-bottom:1px dashed var(--border-card); color:var(--text-muted); font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">
                      <th onclick="toggleBackupsSort('version')" style="padding:12px 6px; cursor:pointer; user-select:none;">Version Name${getSortArrow('version')}</th>
                      <th onclick="toggleBackupsSort('date')" style="padding:12px 6px; width:150px; cursor:pointer; user-select:none;">Backup Date${getSortArrow('date')}</th>
                      <th onclick="toggleBackupsSort('changelog')" style="padding:12px 6px; cursor:pointer; user-select:none;">Changelog Description${getSortArrow('changelog')}</th>
                      <th onclick="toggleBackupsSort('status')" style="padding:12px 6px; width:140px; text-align:center; cursor:pointer; user-select:none;">Status${getSortArrow('status')}</th>
                      <th style="padding:12px 6px; text-align:center; width:220px;">Action</th>
                    </tr>
                  </thead>
                  <tbody id="admin-backups-tbody">
            `;

            displayedBackups.forEach((b, idx) => {
              const isHidden = idx >= 5;
              const displayStyle = isHidden ? 'display: none;' : '';
              const rowClass = isHidden ? 'class="backup-row-item backup-extra-row"' : 'class="backup-row-item"';
              
              const dateStr = b.date ? new Date(b.date).toLocaleString() : 'N/A';
              const changelogStr = b.changelog || 'N/A';
              
              // Resolve status: live/testing overrides releaseStatuses or JSON
              let status = b.status || 'Working';
              if (releaseStatuses[b.version]) {
                status = releaseStatuses[b.version];
              }
              if (b.version === liveVer) {
                status = 'Live';
              } else if (b.version === testingVer) {
                status = 'Testing';
              }

              let statusBadge = '';
              let actionButtons = '';

              if (status === 'Live') {
                statusBadge = '<span style="font-size:11px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); color:#10b981; padding:2px 8px; border-radius:4px; font-weight:700; text-transform:uppercase;">🟢 Live</span>';
                actionButtons = '<span style="font-size:12px; color:var(--text-muted); font-style:italic;">No Actions Available</span>';
              } else if (status === 'Testing') {
                statusBadge = '<span style="font-size:11px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.25); color:#f59e0b; padding:2px 8px; border-radius:4px; font-weight:700; text-transform:uppercase;">🟡 Testing</span>';
                actionButtons = `
                  <div style="display:flex; gap:6px; justify-content:center;">
                    <button class="settings-btn-primary" onclick="activateVersion('${escapeJsString(b.version)}', 'Live')" style="width:auto; margin:0; padding:6px 12px; font-size:11.5px; background:#10b981; color:white; font-weight:700; border:none; border-radius:6px; cursor:pointer;">Activate</button>
                    <button class="settings-btn-primary" onclick="changeVersionStatus('${escapeJsString(b.version)}', 'Working')" style="width:auto; margin:0; padding:6px 12px; font-size:11.5px; background:transparent; border:1px solid var(--border-card); color:var(--text-muted); font-weight:600; border-radius:6px; cursor:pointer;">Set Working</button>
                    <button class="settings-btn-primary" onclick="changeVersionStatus('${escapeJsString(b.version)}', 'Archived')" style="width:auto; margin:0; padding:6px 12px; font-size:11.5px; background:transparent; border:1px solid rgba(239,68,68,0.3); color:#ef4444; font-weight:600; border-radius:6px; cursor:pointer;">Archive</button>
                  </div>
                `;
              } else if (status === 'Working') {
                statusBadge = '<span style="font-size:11px; background:rgba(14,165,233,0.1); border:1px solid rgba(14,165,233,0.25); color:#0ea5e9; padding:2px 8px; border-radius:4px; font-weight:700; text-transform:uppercase;">🔵 Working</span>';
                actionButtons = `
                  <div style="display:flex; gap:6px; justify-content:center;">
                    <button class="settings-btn-primary" onclick="activateVersion('${escapeJsString(b.version)}', null)" style="width:auto; margin:0; padding:6px 12px; font-size:11.5px; background:#10b981; color:white; font-weight:700; border:none; border-radius:6px; cursor:pointer;">Activate</button>
                    <button class="settings-btn-primary" onclick="changeVersionStatus('${escapeJsString(b.version)}', 'Archived')" style="width:auto; margin:0; padding:6px 12px; font-size:11.5px; background:transparent; border:1px solid rgba(239,68,68,0.3); color:#ef4444; font-weight:600; border-radius:6px; cursor:pointer;">Archive</button>
                  </div>
                `;
              } else if (status === 'Archived') {
                statusBadge = '<span style="font-size:11px; background:rgba(107,114,128,0.1); border:1px solid rgba(107,114,128,0.25); color:#9ca3af; padding:2px 8px; border-radius:4px; font-weight:700; text-transform:uppercase;">⚪ Archived</span>';
                actionButtons = `<button class="settings-btn-primary" onclick="restoreArchivedVersion('${escapeJsString(b.version)}')" style="width:auto; margin:0; padding:6px 16px; font-size:11.5px; background:#0ea5e9; color:white; font-weight:700; border:none; border-radius:6px; cursor:pointer;">Restore</button>`;
              }

              html += `
                <tr ${rowClass} style="border-bottom:1px solid rgba(255,255,255,0.02); ${displayStyle}">
                  <td style="padding:12px 6px; font-weight:700; color:var(--accent); font-family:monospace; font-size:11.5px; max-width:200px; word-break:break-all;">${escapeHtml(b.version)}</td>
                  <td style="padding:12px 6px; color:var(--text-muted); font-size:12px;">${dateStr}</td>
                  <td style="padding:12px 6px; line-height:1.4; font-size:12.5px;">${escapeHtml(changelogStr)}</td>
                  <td style="padding:12px 6px; text-align:center;">${statusBadge}</td>
                  <td style="padding:12px 6px; text-align:center;">${actionButtons}</td>
                </tr>
              `;

              if (idx === 4 && displayedBackups.length > 5) {
                html += `
                  <tr id="show-more-backups-row">
                    <td colspan="5" style="text-align: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.02);">
                      <button onclick="toggleBackupsVisibility()" class="settings-btn-primary" style="width:auto; margin:0; padding:6px 16px; font-size:12px; background:rgba(255,255,255,0.05); border:1px solid var(--border-card); color:var(--text-main); font-weight:600; cursor:pointer;">Show More</button>
                    </td>
                  </tr>
                `;
              }
            });

            html += `
                  </tbody>
                </table>
              </div>
            `;
            container.innerHTML = html;
          });
        });
    })
    .catch(err => {
      console.error("Error loading backups catalog:", err);
      container.innerHTML = `
        <div style="font-size: 13px; color: var(--text-muted); font-style: italic; border: 1px dashed var(--border-card); padding: 12px; border-radius: 8px; text-align: center;">
          ℹ️ No backups catalog found. Run backup command in terminal to save a version:
          <code style="display:block; margin-top:6px; font-family:monospace; padding:6px; background:var(--bg-body); border-radius:4px; font-size:12px; color:var(--accent);">python3 qa-tools/backup_restore.py</code>
        </div>
      `;
    });
}
window.loadBackupCatalog = loadBackupCatalog;

window.backupsSortField = 'date';
window.backupsSortAsc = false;

function toggleBackupsSort(field) {
  if (window.backupsSortField === field) {
    window.backupsSortAsc = !window.backupsSortAsc;
  } else {
    window.backupsSortField = field;
    window.backupsSortAsc = true;
  }
  loadBackupCatalog();
}
window.toggleBackupsSort = toggleBackupsSort;

function changeVersionStatus(versionName, newStatus) {
  const db = firestore;
  const batch = db.batch();
  
  const verRef = db.collection('backup_releases').doc(versionName);
  batch.set(verRef, {
    status: newStatus,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  if ((newStatus === 'Working' || newStatus === 'Archived') && versionName === window.activeTestingVersion) {
    const configRef = db.collection('system_settings').doc('config');
    batch.update(configRef, { testingVersion: "" });
  }

  batch.commit()
    .then(() => {
      showCustomAlert(`Successfully changed status of version ${versionName} to ${newStatus}.`, "success");
      if (newStatus === 'Archived') {
        logAdminActivity('version_archive', { version: versionName });
      } else {
        logAdminActivity('version_status_change', { version: versionName, status: newStatus });
      }
      return syncSystemPhase().then(() => {
        const livePref = window.activeLiveVersion ? 'backups/' + window.activeLiveVersion + '/' : '';
        const testingPref = window.activeTestingVersion ? 'backups/' + window.activeTestingVersion + '/' : '';
        
        localStorage.setItem('doc_lms_user_version_prefix', livePref);
        localStorage.setItem('doc_lms_admin_version_prefix', (systemStatus === 'testing') ? testingPref : livePref);
      });
    })
    .then(() => {
      loadBackupCatalog();
    })
    .catch(err => {
      console.error("Error updating version status:", err);
      showCustomAlert("Failed to update version status: " + err.message, "error");
    });
}
window.changeVersionStatus = changeVersionStatus;

function activateVersion(versionName, targetPhase) {
  const db = firestore;
  const configRef = db.collection('system_settings').doc('config');
  
  configRef.get().then(doc => {
    if (!doc.exists) throw new Error("System config does not exist.");
    const data = doc.data();
    const systemStatus = data.status || 'live';
    const previousLive = data.liveVersion || '';
    const previousTesting = data.testingVersion || '';
    
    const phase = targetPhase || (systemStatus === 'testing' ? 'testing' : 'live');
    
    const batch = db.batch();
    
    if (phase === 'live') {
      batch.update(configRef, { 
        liveVersion: versionName,
        activeVersion: versionName,
        testingVersion: (previousTesting === versionName ? "" : previousTesting)
      });
      
      batch.set(db.collection('backup_releases').doc(versionName), {
        status: 'Live',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      if (previousLive && previousLive !== versionName) {
        batch.set(db.collection('backup_releases').doc(previousLive), {
          status: 'Archived',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    } else {
      batch.update(configRef, { 
        testingVersion: versionName
      });
      
      batch.set(db.collection('backup_releases').doc(versionName), {
        status: 'Testing',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      if (previousTesting && previousTesting !== versionName) {
        batch.set(db.collection('backup_releases').doc(previousTesting), {
          status: 'Working',
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }
    
    return batch.commit().then(() => {
      showCustomAlert(`Successfully activated version ${versionName} as active ${phase.toUpperCase()} release!`, "success");
      logAdminActivity('version_activate', { version: versionName, phase: phase });
      return syncSystemPhase().then(() => {
        const livePref = window.activeLiveVersion ? 'backups/' + window.activeLiveVersion + '/' : '';
        const testingPref = window.activeTestingVersion ? 'backups/' + window.activeTestingVersion + '/' : '';
        
        localStorage.setItem('doc_lms_user_version_prefix', livePref);
        localStorage.setItem('doc_lms_admin_version_prefix', (systemStatus === 'testing') ? testingPref : livePref);
      });
    });
  })
  .then(() => {
    loadBackupCatalog();
  })
  .catch(err => {
    console.error("Error activating version:", err);
    showCustomAlert("Failed to activate version: " + err.message, "error");
  });
}
window.activateVersion = activateVersion;

function restoreArchivedVersion(versionName) {
  const proceed = (confirm) => {
    if (!confirm) return;
    
    const db = firestore;
    db.collection('backup_releases').doc(versionName).set({
      status: 'Working',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true })
    .then(() => {
      triggerRestorePrompt(versionName);
      logAdminActivity('version_restore', { version: versionName });
      return syncSystemPhase();
    })
    .then(() => {
      loadBackupCatalog();
    })
    .catch(err => {
      console.error("Error restoring version status:", err);
      showCustomAlert("Failed to update status on restore: " + err.message, "error");
    });
  };

  const confirmMsg = `Are you sure you want to restore version <strong>${escapeHtml(versionName)}</strong>?<br><br>This will set its status to Working and show you the terminal command to overwrite your files.`;
  showCustomConfirm(confirmMsg, proceed);
}
window.restoreArchivedVersion = restoreArchivedVersion;

function toggleBackupsVisibility() {
  const extraRows = document.querySelectorAll('.backup-extra-row');
  const btn = document.querySelector('#show-more-backups-row button');
  if (extraRows.length === 0) return;
  const isHidden = extraRows[0].style.display === 'none';
  extraRows.forEach(row => {
    row.style.display = isHidden ? 'table-row' : 'none';
  });
  if (btn) {
    btn.innerText = isHidden ? 'Show Less' : 'Show More';
  }
}
window.toggleBackupsVisibility = toggleBackupsVisibility;

function triggerRestorePrompt(versionName) {
  const msg = `To restore version <strong>${escapeHtml(versionName)}</strong>, please open your terminal in the project directory and execute the restore command:<br><br>
  <code style="display:block; padding:10px; background:var(--bg-body); border:1px solid var(--border-card); border-radius:6px; font-family:monospace; color:var(--accent); font-size:13px; select-all:true; text-align:center; word-break:break-all;">python3 qa-tools/backup_restore.py --restore ${versionName}</code><br>
  This will overwrite your current index.html, app.js, lims.js, and index.css with the backed up version files.`;

  showCustomAlert(msg, 'info');
}
window.triggerRestorePrompt = triggerRestorePrompt;

function renderChairpersonPlaceholder() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport) return;
  viewport.innerHTML = `
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:32px; text-align:left;">
      <h2 style="font-size:22px; font-weight:800; font-family:'Outfit',sans-serif; color:var(--accent); margin:0 0 12px 0;">🏛️ Chairperson Executive Center</h2>
      <p style="margin:0 0 16px 0; font-size:14px; line-height:1.6; color:var(--text-main);">
        Integration planned in next development phase. Active PCO indicators and reports status will be mirrored here.
      </p>
      <div style="background:rgba(255,255,255,0.02); border:1px dashed var(--border-card); border-radius:12px; padding:24px; text-align:center; font-style:italic; color:var(--text-muted);">
        🔒 Module Locked &mdash; Phase 3 Integration Roadmap Target
      </div>
    </div>
  `;
}
window.renderChairpersonPlaceholder = renderChairpersonPlaceholder;

// ==========================================================================
// DEPARTMENT OF CHEMISTRY PORTAL WELCOME DASHBOARD & ROLE APPLICATION FLOW
// ==========================================================================

window.lastUploadedUnivIdBase64 = '';

function openSignInOverlay() {
  const overlay = document.getElementById('onboarding-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.classList.add('show');
    showOnboardingStage(1);
  }
}
window.openSignInOverlay = openSignInOverlay;

function renderWelcomeDashboard() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport) return;

  viewport.innerHTML = `
    <!-- Top Wrapper with positioning context -->
    <div style="position: relative; width: 100%; box-sizing: border-box; margin-top: 0px; padding-top: 0px;">
      
      <!-- Hero Banner -->
      <div class="welcome-hero-banner" style="display:flex; justify-content:space-between; align-items:center; gap:24px; text-align:left; padding-right: 40px; margin-top: 0px;">
        <div style="flex:1;">
          <div style="font-size: 11px; font-weight:700; color:var(--accent); text-transform:uppercase; margin-bottom:14px; display:flex; flex-direction:column; gap:4px; font-family:'Outfit',sans-serif;">
            <span style="letter-spacing:0.5px;">Mindanao State University - General Santos</span>
            <span style="color:var(--text-muted); font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">College of Natural Sciences and Mathematics</span>
          </div>
          <h1 class="welcome-hero-title" style="margin:0 0 10px 0;">Department of Chemistry Portal</h1>
          <p class="welcome-hero-subtitle" style="margin:0; max-width:100%; line-height:1.6;">
            Bridging molecular innovation and academic excellence. Access your respective workspace modules, read recent announcements, or review calendar events.
          </p>
        </div>
        <img src="chemistry_logo.png" alt="Chemistry Logo" style="height:100px; width:auto; object-fit:contain; flex-shrink:0; filter:drop-shadow(0 0 16px rgba(13,148,136,0.25));">
      </div>
    </div>

    <!-- Active Portal Modules Grid -->
    <h3 style="margin: 0 0 16px 0; font-size:16px; font-weight:700; font-family:'Outfit',sans-serif; text-align:left;">💻 Portal Workspaces</h3>
    <div class="welcome-modules-grid">
      <!-- Student Module Card -->
      <div class="welcome-module-card" onclick="handleWelcomeModuleClick('student')">
        <div class="welcome-module-icon">🎓</div>
        <h4 class="welcome-module-title">Student Portal</h4>
        <p class="welcome-module-desc">Access classroom lectures, complete quizzes, check grade records, and verify clearances.</p>
      </div>

      <!-- Faculty Module Card -->
      <div class="welcome-module-card" onclick="handleWelcomeModuleClick('faculty')">
        <div class="welcome-module-icon">👨‍🏫</div>
        <h4 class="welcome-module-title">Faculty Portal</h4>
        <p class="welcome-module-desc">Manage chemistry classrooms, configure gradebooks, review lab groups, and approve requests.</p>
      </div>

      <!-- Laboratory LIMS Card -->
      <div class="welcome-module-card" onclick="handleWelcomeModuleClick('laboratory')">
        <div class="welcome-module-icon">🧪</div>
        <h4 class="welcome-module-title">Stockroom LIMS</h4>
        <p class="welcome-module-desc">Approve laboratory apparatus requisitions, manage inventories, and log spent chemical waste deposits.</p>
      </div>

      <!-- PCO EMIS Card -->
      <div class="welcome-module-card" onclick="handleWelcomeModuleClick('pco')">
        <div class="welcome-module-icon">🌿</div>
        <h4 class="welcome-module-title">PCO/EIS</h4>
        <p class="welcome-module-desc">Monitor generator runtimes, hazardous inventories, wastewater pH, and compile SMR reports.</p>
      </div>

      <!-- Chairperson Card -->
      <div class="welcome-module-card ${(currentUser && (currentUser.roles.includes('chairperson') || currentUserRole === 'admin')) ? '' : 'locked'}" onclick="handleWelcomeModuleClick('chairperson')">
        <div class="welcome-module-icon" style="background:rgba(239,68,68,0.06); color:#ef4444;">🏛️</div>
        <h4 class="welcome-module-title">Chairperson Executive</h4>
        <p class="welcome-module-desc">Carbon footprint analytics, real-time chemical tracking, and student clearances overview.</p>
      </div>
    </div>

    <!-- Management Controls Bar (Chairperson/Admin) -->
    <div id="portal-content-admin-controls" style="display:none; background:var(--bg-card); border:1px solid var(--border-card); padding:16px; border-radius:14px; text-align:left; margin-bottom:24px;">
      <h4 style="margin:0 0 10px 0; font-size:14px; font-weight:700; color:var(--accent);">🛠 ... Portal Content Manager</h4>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="settings-btn-primary" onclick="openPortalContentDrawer('news')" style="width:auto; margin:0; padding:8px 14px; font-size:12.5px;">➕ Add News Article</button>
        <button class="settings-btn-primary" onclick="openPortalContentDrawer('announcement')" style="width:auto; margin:0; padding:8px 14px; font-size:12.5px; background:#0d9488; border-color:rgba(13,148,136,0.3);">➕ Add Announcement</button>
        <button class="settings-btn-primary" onclick="openPortalContentDrawer('event')" style="width:auto; margin:0; padding:8px 14px; font-size:12.5px; background:#a855f7; border-color:rgba(168,85,247,0.3);">➕ Add Calendar Event</button>
      </div>
    </div>

    <!-- Layout Grid: News/Announcements (Left) & Calendar/Role Application (Right) -->
    <div class="welcome-sections-layout">
      <!-- Left Column: News and Announcements Wrapper -->
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- News & Announcements Card -->
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:18px; padding:24px; text-align:left; display:flex; flex-direction:column; gap:16px;">
          <h3 style="margin:0 0 4px 0; font-size:16px; font-weight:800; font-family:'Outfit',sans-serif; color:var(--text-main);">📰 News & Academic Announcements</h3>
          <div id="portal-news-container">
            <div style="font-size:13px; color:var(--text-muted); font-style:italic;">Loading portal updates...</div>
          </div>
        </div>
        
        <!-- Theme & Signin/Signout Controls at the bottom left (outside and below News section) -->
        <div style="display: flex; align-items: center; gap: 12px; padding-left: 4px;">
          <button class="theme-toggle-btn" onclick="toggleTheme()" style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:50%; width:40px; height:40px; cursor:pointer; display:flex; align-items:center; justify-content:center; color:var(--text-main); font-size: 16px; margin:0; outline:none; transition: all 0.2s ease;">
            🌓
          </button>
          ${currentUser ? `
            <button class="signout-header-btn" onclick="signOutStudent()" style="background:var(--bg-card); border:1px solid var(--border-card); color:var(--text-main); padding:8px 16px; border-radius:12px; font-weight:600; cursor:pointer; height:40px; box-sizing:border-box; display:flex; align-items:center; gap:6px; font-size:13px; outline:none; transition: all 0.2s ease; margin:0;">
              🚪 <span>Sign Out</span>
            </button>
          ` : `
            <button class="settings-btn-primary" onclick="openSignInOverlay()" style="background:var(--bg-card); border:1px solid var(--border-card); color:var(--text-main); padding:8px 16px; border-radius:12px; font-weight:600; cursor:pointer; height:40px; box-sizing:border-box; display:flex; align-items:center; gap:6px; font-size:13px; outline:none; transition: all 0.2s ease; margin:0; width:auto;">
              🔑 <span>Sign In</span>
            </button>
          `}
        </div>
      </div>

      <!-- Right Column: Calendar & Application -->
      <div style="display:flex; flex-direction:column; gap:24px;">
        <!-- Calendar Section -->
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:18px; padding:20px; text-align:left; display:flex; flex-direction:column; gap:14px;">
          <h3 style="margin:0; font-size:15px; font-weight:800; font-family:'Outfit',sans-serif; color:var(--text-main);">📅 Calendar of Events</h3>
          <div id="portal-calendar-container" class="welcome-calendar-list">
            <div style="font-size:13px; color:var(--text-muted); font-style:italic;">Loading events calendar...</div>
          </div>
        </div>

        <!-- Role Application Form -->
        <div id="portal-role-app-container">
          <!-- Form dynamically rendered here -->
        </div>
      </div>
    </div>
  `;

  // Check admin/chairperson controls visibility
  if (currentUser && (currentUserRole === 'admin' || currentUser.role === 'chairperson')) {
    const adminControls = document.getElementById('portal-content-admin-controls');
    if (adminControls) adminControls.style.display = 'block';
  }

  // Load news, announcements, and calendar
  loadPortalContent();

  // Render role application state
  renderPortalRoleApplicationForm();
}

function handleWelcomeModuleClick(module) {
  if (!currentUser) {
    window.pendingWorkspaceRedirect = module;
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      setTimeout(() => overlay.classList.add('show'), 50);
      showOnboardingStage(1);
    } else {
      showCustomAlert("Please sign in to access portal modules.", "info");
    }
    return;
  }

  if (module === 'student') {
    if (!currentUser.name || !currentUser.studentId || !currentUser.subjects || currentUser.subjects.length === 0) {
      const overlay = document.getElementById('onboarding-overlay');
      if (overlay) {
        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('show'), 50);
        showOnboardingStage(2);
        
        const nicknameInput = document.getElementById('onboarding-nickname');
        if (nicknameInput) nicknameInput.value = currentUser.name || '';
        
        const studentIdInput = document.getElementById('onboarding-studentid');
        if (studentIdInput) studentIdInput.value = currentUser.studentId || '';
        
        const yearSelect = document.getElementById('onboarding-year');
        if (yearSelect) yearSelect.value = currentUser.year || '1';
        
        renderOnboardingSelectedClasses();
      }
      return;
    }
  }

  // Check if user has this role
  let hasRole = false;
  if (currentUserRole === 'admin') {
    hasRole = true;
  } else {
    const userRoles = currentUser.roles || [];
    if (module === 'pco') {
      hasRole = ['pco', 'pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'].some(r => userRoles.includes(r));
    } else {
      hasRole = userRoles.includes(module);
    }
  }

  if (hasRole) {
    switchActiveRole(module);
  } else {
    if (module !== 'student') {
      openRoleAppModal(module);
    } else {
      showCustomAlert(`Access Restricted: Your account does not have the '${module.toUpperCase()}' role.`, "error");
    }
  }
}

function renderPortalItems(items) {
  // Render news & announcements
  const newsContainer = document.getElementById('portal-news-container');
  if (newsContainer) {
    const newsItems = items.filter(i => i.type === 'news' || i.type === 'announcement');
    newsItems.sort((a,b) => b.date.localeCompare(a.date));
    
    if (newsItems.length === 0) {
      newsContainer.innerHTML = `<div style="font-size:13px; color:var(--text-muted); font-style:italic;">No news posts available.</div>`;
    } else {
      newsContainer.innerHTML = newsItems.map(item => `
        <div class="welcome-news-item">
          <div class="welcome-news-meta">
            <span style="background:rgba(14,165,233,0.1); padding:2px 6px; border-radius:4px;">${item.type.toUpperCase()}</span>
            <span>${item.date}</span>
          </div>
          <h4 class="welcome-news-title">${escapeHtml(item.title)}</h4>
          <p class="welcome-news-body">${escapeHtml(item.body)}</p>
        </div>
      `).join('');
    }
  }

  // Render calendar timeline
  const calendarContainer = document.getElementById('portal-calendar-container');
  if (calendarContainer) {
    const events = items.filter(i => i.type === 'event');
    events.sort((a,b) => a.date.localeCompare(b.date));
    
    if (events.length === 0) {
      calendarContainer.innerHTML = `<div style="font-size:13px; color:var(--text-muted); font-style:italic;">No upcoming events.</div>`;
    } else {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      calendarContainer.innerHTML = events.map(ev => {
        const dObj = new Date(ev.date);
        const day = dObj.getDate();
        const mon = monthNames[dObj.getMonth()] || "Jun";
        
        return `
          <div class="welcome-calendar-card">
            <div class="welcome-calendar-date">
              <div class="welcome-calendar-date-day">${day}</div>
              <div class="welcome-calendar-date-month">${mon}</div>
            </div>
            <div class="welcome-calendar-info">
              <h4 class="welcome-calendar-title">${escapeHtml(ev.title)}</h4>
              <div class="welcome-calendar-time">⏰ ${escapeHtml(ev.time || 'All Day')}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function getVisiblePortalItems(items) {
  return items.filter(item => {
    // Events are public
    if (item.type === 'event') return true;

    // Filter out pending/denied items
    if (item.status === 'pending_chairperson' || item.status === 'denied') {
      return false;
    }

    const visibility = item.visibility || 'public';

    if (visibility === 'public') {
      return true;
    }

    if (visibility === 'faculty') {
      if (!currentUser) return false;
      return currentUserRole === 'faculty' || currentUserRole === 'chairperson' || currentUserRole === 'admin';
    }

    if (visibility === 'students') {
      if (!currentUser) return false;
      if (item.postedBy === currentUser.email) return true;
      if (currentUserRole === 'admin' || currentUserRole === 'chairperson') return true;
      
      if (currentUserRole === 'student') {
        const studentSubjects = currentUser.subjects || [];
        return studentSubjects.some(subj => subj.courseId === item.classId || subj.id === item.classId);
      }
      return false;
    }

    return false;
  });
}

function loadPortalContent() {
  const mockItems = [
    {
      type: 'announcement',
      title: 'Mandatory Lab Safety Training',
      body: 'All students enrolled in CHM 101/102 and CHM 151 are required to complete the safety orientation module. Uncertified students will not be permitted in lab sessions.',
      date: new Date().toISOString().substring(0,10),
      category: 'Safety',
      visibility: 'public',
      status: 'approved'
    },
    {
      type: 'news',
      title: 'Green Synthesis Research Grant Awarded',
      body: 'The Department of Chemistry has secured a PHP 1.2M grant from DOST-PCIEERD for investigating green synthesis procedures utilizing local marine algae extracts.',
      date: new Date(Date.now() - 86400000 * 2).toISOString().substring(0,10),
      category: 'Research',
      visibility: 'public',
      status: 'approved'
    },
    {
      type: 'event',
      title: 'Annual Chemical Storage Inventory',
      body: 'Stockroom audit and chemical inventory inspection.',
      date: new Date(Date.now() + 86400000 * 4).toISOString().substring(0,10),
      time: '08:00 AM - 05:00 PM',
      visibility: 'public',
      status: 'approved'
    },
    {
      type: 'event',
      title: 'Thesis Defense: CHM 200 Seminar',
      body: 'CNMS general lecture hall presentation.',
      date: new Date(Date.now() + 86400000 * 8).toISOString().substring(0,10),
      time: '01:30 PM - 03:00 PM',
      visibility: 'public',
      status: 'approved'
    }
  ];

  firestore.collection('portal_content').get().then(snap => {
    let items = [];
    if (snap.empty) {
      items = mockItems;
      items.forEach(item => {
        firestore.collection('portal_content').add(item).catch(() => {});
      });
    } else {
      snap.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
    }
    const visibleItems = getVisiblePortalItems(items);
    renderPortalItems(visibleItems);
  }).catch(err => {
    console.warn("Firestore portal_content read failed. Using fallback seed data:", err);
    renderPortalItems(mockItems);
  });
}

function renderPortalRoleApplicationForm() {
  const container = document.getElementById('portal-role-app-container');
  if (!container) return;

  const renderForm = () => {
    const isNameReadonly = currentUser && currentUser.name;
    const nameVal = currentUser && currentUser.name ? currentUser.name : '';
    const nameStyle = isNameReadonly
      ? 'padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; opacity: 0.6; cursor: not-allowed;'
      : 'padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;';
    const nameReadonlyAttr = isNameReadonly ? 'readonly' : '';

    const isEmailReadonly = currentUser && currentUser.email;
    const emailVal = currentUser && currentUser.email ? currentUser.email : '';
    const emailStyle = isEmailReadonly
      ? 'padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; font-family:monospace; opacity: 0.6; cursor: not-allowed;'
      : 'padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; font-family:monospace;';
    const emailReadonlyAttr = isEmailReadonly ? 'readonly' : '';

    container.innerHTML = `
      <div class="app-role-form-container">
        <h3 class="app-role-form-title">🏛️ Apply for Portal Access</h3>
        <p class="app-role-form-subtitle">Submit your academic details to request professional module access. Applications are verified by administrators.</p>
        
        <form id="portal-role-app-form" onsubmit="handleRoleApplicationSubmit(event)" style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Complete Name:</label>
            <input type="text" id="role-app-name" required value="${escapeHtml(nameVal)}" placeholder="e.g. Juan Dela Cruz" style="${nameStyle}" ${nameReadonlyAttr}>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Email Address:</label>
            <input type="email" id="role-app-email" required value="${escapeHtml(emailVal)}" placeholder="e.g. juan.delacruz@msugensan.edu.ph" style="${emailStyle}" ${emailReadonlyAttr}>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Office / Building Location:</label>
            <input type="text" id="role-app-office" required value="Department of Chemistry, RSRC Bldg." placeholder="e.g. Department of Chemistry, RSRC Bldg." style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Target Portal Role:</label>
            <select id="role-app-target-role" onchange="toggleRoleAppAffiliationFields(this.value, 'main')" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; cursor:pointer;">
              <option value="faculty" selected>👨‍🏫 Faculty</option>
              <option value="laboratory">🧪 Laboratory</option>
              <option value="pco_laboratory">🌿 PCO Laboratory</option>
              <option value="pco_college">🌿 PCO College</option>
              <option value="pco_office">🌿 PCO Office</option>
              <option value="pco_ppd">🌿 PCO PPD</option>
              <option value="pco_gso">🌿 PCO GSO</option>
              <option value="pco_sanitary">🌿 PCO Sanitary</option>
              <option value="chairperson">🏛️ Chairperson</option>
            </select>
          </div>

          <!-- Conditional Affiliation Group -->
          <div id="role-app-affiliation-group" style="display:none; flex-direction:column; gap:12px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Affiliated College / Office:</label>
              <select id="role-app-affiliation" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; cursor:pointer;">
                <option value="">-- Select College/Office Affiliation --</option>
                <optgroup label="Colleges (Academic)">
                  <option value="CNSM">CNSM - College of Natural Sciences and Mathematics</option>
                  <option value="COE">COE - College of Engineering</option>
                  <option value="COA">COA - College of Agriculture</option>
                  <option value="CBAA">CBAA - College of Business Administration and Accountancy</option>
                  <option value="COED">COED - College of Education</option>
                  <option value="COFAS">COFAS - College of Fisheries & Aquatic Sciences</option>
                  <option value="COHS">COHS - College of Health Sciences</option>
                  <option value="COL">COL - College of Law</option>
                  <option value="COM">COM - College of Medicine</option>
                  <option value="CSSH">CSSH - College of Social Sciences and Humanities</option>
                  <option value="IIAIS">IIAIS - Institute of Islamic, Arabic and International Studies</option>
                </optgroup>
                <optgroup label="Offices (Administrative)">
                  <option value="OC">OC - Office of the Chancellor</option>
                  <option value="OVCAA">OVCAA - Office of the Vice Chancellor for Academic Affairs</option>
                  <option value="OVCAF">OVCAF - Office of the Vice Chancellor for Administration and Finance</option>
                  <option value="OVCREI">OVCREI - Office of the Vice Chancellor for Research, Extension, and Innovation</option>
                  <option value="OVCSAS">OVCSAS - Office of the Vice Chancellor for Student Affairs and Services</option>
                  <option value="OVCPD">OVCPD - Office of the Vice Chancellor for Planning and Development</option>
                  <option value="PPD">PPD - Physical Plant Division</option>
                  <option value="GSO">GSO - General Services Office</option>
                  <option value="ICTO">ICTO - Information Communication Technology Office</option>
                  <option value="BO">BO - Budget Office</option>
                  <option value="IPDM">IPDM - Institute of Peace & Development in Mindanao</option>
                  <option value="CAO">CAO - Cultural Affairs Office</option>
                  <option value="CSU">CSU - Civil Security Unit</option>
                  <option value="OIA">OIA - Office of the International Affairs</option>
                  <option value="ARO">ARO - Alumni Relations Office</option>
                  <option value="IAS">IAS - Internal Audit Services</option>
                  <option value="PEMO">PEMO - Planning, Evaluation, & Monitoring Office</option>
                </optgroup>
                <option value="OTHER">❓ Other (Not Listed)</option>
              </select>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Specific Lab / Office Name:</label>
              <input type="text" id="role-app-office-name" placeholder="e.g. Chemistry Stockroom" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">University ID Card Card Image/PDF:</label>
            <div class="file-upload-zone" onclick="document.getElementById('role-app-univ-id').click()">
              <span style="font-size:24px;">📁</span>
              <div class="file-upload-text">Choose file or drag here to upload ID</div>
              <input type="file" id="role-app-univ-id" required style="display:none;" onchange="handleUniversityIdFileSelect(this)">
              <div id="role-app-file-preview" class="file-upload-preview"></div>
            </div>
          </div>
          <button type="submit" class="settings-btn-primary" style="margin-top:10px; font-weight:700;">📤 Submit Access Request</button>
        </form>
      </div>
    `;
    setTimeout(() => {
      const selectEl = document.getElementById('role-app-target-role');
      if (selectEl) toggleRoleAppAffiliationFields(selectEl.value, 'main');
    }, 50);
  };

  if (!currentUser) {
    renderForm();
    return;
  }

  // Query if this user has already submitted an application
  firestore.collection('role_applications').where('email', '==', currentUser.email).get().then(snap => {
    if (!snap.empty) {
      // Find the first pending application
      const pendingDoc = snap.docs.find(d => d.data().status === 'pending');
      if (pendingDoc) {
        const app = pendingDoc.data();
        container.innerHTML = `
          <div class="app-role-form-container" style="border: 1px solid var(--pco-warning); background:rgba(245,158,11,0.02);">
            <h3 class="app-role-form-title" style="color:#f59e0b; display:flex; align-items:center; gap:8px;">⏳ Application Pending</h3>
            <p class="app-role-form-subtitle">Your requested role: <strong style="color:var(--accent);">${escapeHtml(app.requestedRole.replace('pco_', 'PCO ').toUpperCase())}</strong></p>
            <div style="background:rgba(255,255,255,0.02); border:1px dashed var(--border-card); border-radius:10px; padding:16px; font-size:13px; color:var(--text-main); line-height:1.6;">
              ℹ️ Your role access request was submitted successfully. If your application is not approved within 24 hours, please see the Department of Chemistry.
            </div>
          </div>
        `;
        return;
      }
    }
    renderForm();
  });
}

function handleUniversityIdFileSelect(input) {
  const preview = document.getElementById('role-app-file-preview');
  if (input.files && input.files[0]) {
    const file = input.files[0];
    preview.innerText = `📄 ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    preview.style.display = 'block';
    
    const reader = new FileReader();
    reader.onload = function(e) {
      window.lastUploadedUnivIdBase64 = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = 'none';
    window.lastUploadedUnivIdBase64 = '';
  }
}

function toggleRoleAppAffiliationFields(role, suffix) {
  const isPco = role.startsWith('pco');
  const group = document.getElementById(suffix === 'modal' ? 'role-app-affiliation-group-modal' : 'role-app-affiliation-group');
  if (group) {
    group.style.display = isPco ? 'flex' : 'none';
  }
}
window.toggleRoleAppAffiliationFields = toggleRoleAppAffiliationFields;

function handleRoleApplicationSubmit(event) {
  event.preventDefault();
  
  const formId = event.target.id;
  const isModal = formId === 'portal-role-app-form-modal';
  
  const suffix = isModal ? '-modal' : '';
  const name = document.getElementById('role-app-name' + suffix).value.trim();
  const email = document.getElementById('role-app-email' + suffix).value.trim();
  const office = document.getElementById('role-app-office' + suffix).value.trim(); // This is Room / Building Location
  const targetRole = document.getElementById('role-app-target-role' + suffix).value;
  const idFile = document.getElementById('role-app-univ-id' + suffix).files[0];

  // Restrict to @msugensan.edu.ph
  if (!email.toLowerCase().endsWith('@msugensan.edu.ph')) {
    showCustomAlert("Access Restricted: Only MSU GenSan institutional email accounts (@msugensan.edu.ph) are permitted to apply for Portal roles.", "error");
    return;
  }

  // PCO category requirements enforcement
  const isPco = targetRole.startsWith('pco');
  let affiliationUnit = '';
  let officeName = '';
  if (isPco) {
    affiliationUnit = document.getElementById('role-app-affiliation' + suffix).value;
    officeName = document.getElementById('role-app-office-name' + suffix).value.trim();
    if (!affiliationUnit || !officeName || !office) {
      showCustomAlert("Affiliated College/Office, Specific Lab/Office Name, and Room Location are required for PCO Category applications.", "error");
      return;
    }
  }

  if (!idFile) {
    showCustomAlert("Error: Please select/upload your University ID card.", "error");
    return;
  }

  const appData = {
    applicationId: "APP-" + Date.now(),
    name: name,
    email: email,
    office: office, // Location
    requestedRole: targetRole,
    univIdFileName: idFile.name,
    univIdBase64: isModal ? (window.lastUploadedUnivIdBase64Modal || '') : (window.lastUploadedUnivIdBase64 || ''),
    status: 'pending',
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (isPco) {
    appData.affiliationUnit = affiliationUnit;
    appData.officeName = officeName;
  }

  firestore.collection('role_applications').add(appData).then(() => {
    showCustomAlert("Application was submitted successfully. If application is not approved within 24 hours, please see the Department of Chemistry.", "success");
    renderPortalRoleApplicationForm();
    if (isModal) {
      closeRoleAppModal();
    }
  }).catch(err => {
    showCustomAlert("Submission failed: " + err.message, "error");
  });
}

function openPortalContentDrawer(type) {
  let titleLabel = "Add News Article";
  if (type === 'announcement') titleLabel = "Add Announcement";
  if (type === 'event') titleLabel = "Add Calendar Event";

  const todayStr = new Date().toISOString().substring(0,10);
  const bodyHTML = `
    <form id="portal-content-form" style="display:flex; flex-direction:column; gap:12px; text-align:left;">
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Title / Heading:</label>
        <input type="text" id="pc-title" required placeholder="e.g. Seminar Series 2026" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Description / Content:</label>
        <textarea id="pc-body" required rows="4" placeholder="Enter content body here..." style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; resize:vertical;"></textarea>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Date:</label>
        <input type="date" id="pc-date" required value="${todayStr}" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
      </div>
      ${(type === 'news' || type === 'announcement') ? `
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Publish To / Audience:</label>
        <select id="pc-visibility" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; cursor:pointer;">
          <option value="public" selected>🌍 Public (anyone with or without login)</option>
          <option value="faculty">👨‍🏫 Department Faculty Only</option>
        </select>
      </div>
      ` : ''}
      ${type === 'event' ? `
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Event Time (Optional):</label>
        <input type="text" id="pc-time" placeholder="e.g. 09:00 AM - 12:00 PM" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
      </div>
      ` : ''}
      <input type="hidden" id="pc-type" value="${type}">
    </form>
  `;

  const footerHTML = `
    <button class="settings-btn-primary" onclick="closeActionDrawer()" style="width:auto; margin:0; padding:10px 16px; background:rgba(255,255,255,0.06); color:var(--text-muted); border:1px solid var(--border-card);">Cancel</button>
    <button class="settings-btn-primary" onclick="submitPortalContent()" style="width:auto; margin:0; padding:10px 20px; background:var(--accent); color:white; font-weight:600;">💾 Post Content</button>
  `;

  openActionDrawer(`➕ ${titleLabel}`, bodyHTML, footerHTML);
}

function submitPortalContent() {
  const type = document.getElementById('pc-type').value;
  const title = document.getElementById('pc-title').value.trim();
  const body = document.getElementById('pc-body').value.trim();
  const date = document.getElementById('pc-date').value;
  const time = type === 'event' ? document.getElementById('pc-time').value.trim() : '';
  const visibilitySelect = document.getElementById('pc-visibility');
  const visibility = visibilitySelect ? visibilitySelect.value : 'public';

  if (!title || !body || !date) {
    alert("Please fill in all required content fields.");
    return;
  }

  firestore.collection('portal_content').add({
    type: type,
    title: title,
    body: body,
    date: date,
    time: time,
    visibility: visibility,
    status: 'approved',
    postedBy: currentUser.email,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    alert("Portal content posted successfully!");
    closeActionDrawer();
    loadPortalContent();
  })
  .catch(err => alert("Error: " + err.message));
}
function renderAdminRoleApplications(targetId = 'viewport-body') {
  const viewport = document.getElementById(targetId);
  if (!viewport) return;

  viewport.innerHTML = `
    <div class="home-greeting-card" style="padding: 24px; background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
      <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--accent); margin: 0 0 8px 0;">📋 Role Access Applications</h2>
      <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Verify institutional credentials, check uploaded university IDs, and approve portal access requests.</p>
    </div>

    <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 24px; border-radius: 16px; text-align: left;">
      <h3 style="margin: 0 0 16px 0; font-size: 15px; font-weight: 700;">Pending Applications</h3>
      
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left; min-width: 700px;">
          <thead>
            <tr style="border-bottom:1px dashed var(--border-card); color:var(--text-muted); font-size:11px; text-transform:uppercase;">
              <th style="padding:10px 8px;">Applicant Details</th>
              <th style="padding:10px 8px;">Office</th>
              <th style="padding:10px 8px;">Requested Role</th>
              <th style="padding:10px 8px;">University ID Card</th>
              <th style="padding:10px 8px; text-align:center; width:180px;">Actions</th>
            </tr>
          </thead>
          <tbody id="admin-role-apps-tbody">
            <tr>
              <td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted); font-style:italic;">Loading pending applications...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  firestore.collection('role_applications').where('status', '==', 'pending').get().then(snap => {
    const tbody = document.getElementById('admin-role-apps-tbody');
    if (!tbody) return;
    
    if (snap.empty) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding:32px; text-align:center; color:var(--text-muted); font-style:italic;">🎉 No pending role access applications!</td>
        </tr>
      `;
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const app = doc.data();
      const docId = doc.id;
      
      let idLinkHTML = `<span style="color:var(--text-muted); font-style:italic;">No file</span>`;
      if (app.univIdBase64) {
        idLinkHTML = `<a href="${app.univIdBase64}" download="${app.univIdFileName}" style="color:var(--accent); font-weight:600; text-decoration:underline; cursor:pointer;">📥 Download ID (${escapeHtml(app.univIdFileName)})</a>`;
      } else if (app.univIdFileName) {
        idLinkHTML = `<span style="font-family:monospace; color:var(--text-main);">${escapeHtml(app.univIdFileName)}</span>`;
      }

      html += `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
          <td style="padding:14px 8px;">
            <div style="font-weight:700; color:var(--text-main);">${escapeHtml(app.name)}</div>
            <div style="font-size:11.5px; color:var(--text-muted); font-family:monospace; margin-top:2px;">${escapeHtml(app.email)}</div>
          </td>
          <td style="padding:14px 8px; color:var(--text-main);">${escapeHtml(app.office)}</td>
          <td style="padding:14px 8px;"><span style="background:rgba(59,130,246,0.08); color:var(--accent); padding:4px 8px; border-radius:6px; font-weight:700; font-size:12px;">${escapeHtml(app.requestedRole.replace('pco_', 'PCO ').toUpperCase())}</span></td>
          <td style="padding:14px 8px;">${idLinkHTML}</td>
          <td style="padding:14px 8px; text-align:center;">
            <div style="display:flex; gap:8px; justify-content:center;">
              <button class="settings-btn-primary" onclick="approveRoleApplication('${docId}', '${escapeJsString(app.email)}', '${escapeJsString(app.requestedRole)}')" style="width:auto; margin:0; padding:6px 12px; font-size:12px; background:#10b981; color:white; font-weight:600; border-color:rgba(16,185,129,0.3);">Approve</button>
              <button class="settings-btn-primary" onclick="rejectRoleApplication('${docId}')" style="width:auto; margin:0; padding:6px 12px; font-size:12px; background:#ef4444; color:white; font-weight:600; border-color:rgba(239,68,68,0.3);">Reject</button>
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  });
}

function approveRoleApplication(docId, email, role) {
  if (!confirm(`Are you sure you want to approve this application and assign ${email} to the ${role.toUpperCase()} role?`)) return;

  const appRef = firestore.collection('role_applications').doc(docId);
  const userRef = firestore.collection('students').doc(email);

  firestore.runTransaction(transaction => {
    return transaction.get(appRef).then(appDoc => {
      if (!appDoc.exists) throw new Error("Application does not exist.");
      
      return transaction.get(userRef).then(userDoc => {
        let roles = [role];
        let userData = {
          name: appDoc.data().name,
          email: email,
          role: role,
          roles: roles,
          officeAddress: appDoc.data().office,
          location: appDoc.data().office || ''
        };
        if (appDoc.data().affiliationUnit) {
          userData.affiliationUnit = appDoc.data().affiliationUnit;
        }
        if (appDoc.data().officeName) {
          userData.office = appDoc.data().officeName;
        }
        
        if (userDoc.exists) {
          const prevData = userDoc.data();
          roles = prevData.roles || [];
          if (!roles.includes(role)) {
            roles.push(role);
          }
          roles = roles.filter(r => r !== 'unassigned');
          userData = {
            ...prevData,
            role: role,
            roles: roles,
            officeAddress: appDoc.data().office,
            location: appDoc.data().office || prevData.location || ''
          };
          if (appDoc.data().affiliationUnit) {
            userData.affiliationUnit = appDoc.data().affiliationUnit;
          }
          if (appDoc.data().officeName) {
            userData.office = appDoc.data().officeName;
          }
        }
        
        transaction.update(appRef, { status: 'approved' });
        transaction.set(userRef, userData);
      });
    });
  })
  .then(() => {
    showCustomAlert("Application approved and user role assigned successfully!", "success");
    renderAdminRoleApplications();
  })
  .catch(err => {
    showCustomAlert("Approval failed: " + err.message, "error");
  });
}

function rejectRoleApplication(docId) {
  if (!confirm("Are you sure you want to reject this role application?")) return;
  
  firestore.collection('role_applications').doc(docId).update({
    status: 'rejected'
  }).then(() => {
    showCustomAlert("Application rejected successfully.", "info");
    renderAdminRoleApplications();
  }).catch(err => alert("Error: " + err.message));
}

// Window bindings
window.renderWelcomeDashboard = renderWelcomeDashboard;
window.handleWelcomeModuleClick = handleWelcomeModuleClick;
window.loadPortalContent = loadPortalContent;
window.renderPortalRoleApplicationForm = renderPortalRoleApplicationForm;
window.handleUniversityIdFileSelect = handleUniversityIdFileSelect;
window.handleRoleApplicationSubmit = handleRoleApplicationSubmit;
window.openPortalContentDrawer = openPortalContentDrawer;
window.submitPortalContent = submitPortalContent;
window.renderAdminRoleApplications = renderAdminRoleApplications;
window.approveRoleApplication = approveRoleApplication;
window.rejectRoleApplication = rejectRoleApplication;

// Faculty Publication Management Additions
function renderFacultyAnnouncementsView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport) return;

  viewport.innerHTML = `<div class="empty-playlist-msg">Loading announcements...</div>`;

  firestore.collection('classes')
    .where('facultyEmail', '==', currentUser.email)
    .where('status', '==', 'approved')
    .get()
    .then(classSnap => {
      const myClasses = classSnap.docs.map(d => ({id: d.id, ...d.data()}));

      firestore.collection('portal_content')
        .where('postedBy', '==', currentUser.email)
        .get()
        .then(snap => {
          const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
          list.sort((a, b) => b.date.localeCompare(a.date));

          viewport.innerHTML = `
            <div class="home-greeting-card" style="padding: 24px; background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
              <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: #3b82f6; margin: 0 0 8px 0; display:flex; align-items:center; gap:8px;">
                <span>📢</span> Publication Management Workspace
              </h2>
              <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Publish news and announcements to your classes, the chemistry faculty, or the general public.</p>
            </div>

            <div style="background:var(--bg-card); border:1px solid var(--border-card); padding:24px; border-radius:18px; text-align:left; margin-bottom:24px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
                <h3 style="margin:0; font-size:15px; font-weight:700;">My Publications</h3>
                <button class="settings-btn-primary" onclick="openFacultyAnnouncementDrawer()" style="width:auto; margin:0; padding:10px 18px; font-weight:600;">➕ Create Announcement</button>
              </div>

              <div style="display:flex; flex-direction:column; gap:12px;">
                ${list.map(ann => {
                  let statusBadge = '';
                  if (ann.status === 'approved') {
                    statusBadge = `<span style="background:rgba(16,185,129,0.1); color:#10b981; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">APPROVED / ACTIVE</span>`;
                  } else if (ann.status === 'pending_chairperson') {
                    statusBadge = `<span style="background:rgba(245,158,11,0.1); color:#f59e0b; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">PENDING CHAIRPERSON APPROVAL</span>`;
                  } else if (ann.status === 'denied') {
                    statusBadge = `<span style="background:rgba(239,68,68,0.1); color:#ef4444; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:700;">REJECTED</span>`;
                  }

                  let targetText = ann.visibility ? ann.visibility.toUpperCase() : 'PUBLIC';
                  if (ann.visibility === 'students' && ann.classId) {
                    const targetClass = myClasses.find(c => c.id === ann.classId);
                    if (targetClass) {
                      targetText = `CLASS: ${targetClass.courseId} (${targetClass.section})`;
                    }
                  }

                  return `
                    <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:10px; padding:14px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px;">
                      <div style="flex:1; min-width:250px;">
                        <h4 style="margin:0 0 6px 0; font-size:14px; font-weight:700; color:white;">${escapeHtml(ann.title)}</h4>
                        <p style="margin:0 0 10px 0; font-size:12.5px; color:var(--text-muted); line-height:1.5;">${escapeHtml(ann.body)}</p>
                        <div style="display:flex; align-items:center; gap:10px; font-size:11px; color:var(--text-muted); flex-wrap:wrap;">
                          <span>📅 ${ann.date}</span>
                          <span>&bull;</span>
                          <span>Target: <strong>${targetText}</strong></span>
                        </div>
                      </div>
                      <div>
                        ${statusBadge}
                      </div>
                    </div>
                  `;
                }).join('') || `<div style="font-size:13.5px; color:var(--text-muted); text-align:center; font-style:italic; padding:24px;">You haven't posted any announcements yet. Click the button above to publish!</div>`}
              </div>
            </div>
          `;

          window.facultyTaughtClasses = myClasses;
        })
        .catch(err => {
          console.error("Error loading faculty announcements:", err);
          viewport.innerHTML = `<div style="color:#ef4444; padding:20px;">Error: ${err.message}</div>`;
        });
    })
    .catch(err => {
      console.error("Error loading faculty classes:", err);
      viewport.innerHTML = `<div style="color:#ef4444; padding:20px;">Error: ${err.message}</div>`;
    });
}

function openFacultyAnnouncementDrawer() {
  const myClasses = window.facultyTaughtClasses || [];
  const todayStr = new Date().toISOString().substring(0,10);

  const bodyHTML = `
    <form id="faculty-announcement-form" style="display:flex; flex-direction:column; gap:12px; text-align:left;">
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Title / Heading:</label>
        <input type="text" id="fa-title" required placeholder="e.g. Next Week Experiment Guidelines" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Content / Body:</label>
        <textarea id="fa-body" required rows="5" placeholder="Enter announcement body text here..." style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; resize:vertical;"></textarea>
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Date:</label>
        <input type="date" id="fa-date" required value="${todayStr}" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Publish To / Target Audience:</label>
        <select id="fa-audience" onchange="toggleFacultyAnnouncementClassSelect()" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; cursor:pointer;">
          <option value="students" selected>🏫 Students of my class (auto-approved)</option>
          <option value="faculty">👨‍🏫 Department Chemistry Faculty Only (requires Chairperson approval)</option>
          <option value="public">🌍 Public Landing Page (requires Chairperson approval)</option>
        </select>
      </div>
      <div id="fa-class-target-container" style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Select Class:</label>
        <select id="fa-class-target" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; cursor:pointer;">
          ${myClasses.map(c => `<option value="${c.id}">${escapeHtml(c.courseId)} - Sec ${escapeHtml(c.section)} (${escapeHtml(c.courseName)})</option>`).join('') || '<option value="" disabled>No active classes found</option>'}
        </select>
      </div>
    </form>
  `;

  const footerHTML = `
    <button class="settings-btn-primary" onclick="closeActionDrawer()" style="width:auto; margin:0; padding:10px 16px; background:rgba(255,255,255,0.06); color:var(--text-muted); border:1px solid var(--border-card);">Cancel</button>
    <button class="settings-btn-primary" onclick="submitFacultyAnnouncement()" style="width:auto; margin:0; padding:10px 20px; background:var(--accent); color:white; font-weight:600;">💾 Post Announcement</button>
  `;

  openActionDrawer("📢 Create Announcement", bodyHTML, footerHTML);
}

function toggleFacultyAnnouncementClassSelect() {
  const aud = document.getElementById('fa-audience').value;
  const container = document.getElementById('fa-class-target-container');
  if (container) {
    container.style.display = aud === 'students' ? 'flex' : 'none';
  }
}

function submitFacultyAnnouncement() {
  const title = document.getElementById('fa-title').value.trim();
  const body = document.getElementById('fa-body').value.trim();
  const date = document.getElementById('fa-date').value;
  const audience = document.getElementById('fa-audience').value;
  const classId = audience === 'students' ? document.getElementById('fa-class-target').value : '';

  if (!title || !body || !date) {
    alert("Please fill in all required fields.");
    return;
  }

  let status = 'approved';
  let visibility = audience;
  if (audience === 'faculty' || audience === 'public') {
    status = 'pending_chairperson';
  }

  firestore.collection('portal_content').add({
    type: 'announcement',
    title: title,
    body: body,
    date: date,
    visibility: visibility,
    classId: classId,
    status: status,
    postedBy: currentUser.email,
    postedByName: currentUser.name || currentUser.email.split('@')[0],
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    showCustomAlert(status === 'approved' ? "Announcement published successfully!" : "Announcement submitted and pending Chairperson approval!", "success");
    closeActionDrawer();
    renderFacultyAnnouncementsView();
    loadPortalContent();
  }).catch(err => {
    showCustomAlert("Error submitting announcement: " + err.message, "error");
  });
}

window.renderFacultyAnnouncementsView = renderFacultyAnnouncementsView;
window.openFacultyAnnouncementDrawer = openFacultyAnnouncementDrawer;
window.toggleFacultyAnnouncementClassSelect = toggleFacultyAnnouncementClassSelect;
window.submitFacultyAnnouncement = submitFacultyAnnouncement;

// Floating Role Application Modal Functions
function openRoleAppModal(targetModule) {
  const modal = document.getElementById('role-app-modal');
  const body = document.getElementById('role-app-modal-body');
  if (!modal || !body || !currentUser) return;

  window.lastUploadedUnivIdBase64Modal = null;

  const isPcoModule = targetModule === 'pco';
  let defaultSelect = 'faculty';
  if (targetModule === 'laboratory') defaultSelect = 'laboratory';
  else if (isPcoModule) defaultSelect = 'pco_laboratory';
  else if (targetModule === 'chairperson') defaultSelect = 'chairperson';

  firestore.collection('role_applications').where('email', '==', currentUser.email).get().then(snap => {
    let pendingDoc = null;
    if (!snap.empty) {
      pendingDoc = snap.docs.find(d => d.data().status === 'pending');
    }

    if (pendingDoc) {
      const app = pendingDoc.data();
      body.innerHTML = `
        <div style="border: 1px solid var(--pco-warning); background:rgba(245,158,11,0.02); border-radius:12px; padding:16px;">
          <h3 class="app-role-form-title" style="color:#f59e0b; display:flex; align-items:center; gap:8px; margin-top:0;">⏳ Application Pending</h3>
          <p class="app-role-form-subtitle">Your requested role: <strong style="color:var(--accent);">${escapeHtml(app.requestedRole.replace('pco_', 'PCO ').toUpperCase())}</strong></p>
          <div style="background:rgba(255,255,255,0.02); border:1px dashed var(--border-card); border-radius:10px; padding:16px; font-size:13px; color:var(--text-main); line-height:1.6;">
            ℹ️ Your role access request was submitted successfully. If your application is not approved within 24 hours, please see the Department of Chemistry.
          </div>
        </div>
      `;
    } else {
      body.innerHTML = `
        <form id="portal-role-app-form-modal" onsubmit="handleRoleApplicationSubmit(event)" style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Complete Name:</label>
            <input type="text" id="role-app-name-modal" required value="${escapeHtml(currentUser.name || '')}" placeholder="e.g. Juan Dela Cruz" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; opacity: 0.6; cursor: not-allowed;" readonly>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Email Address:</label>
            <input type="email" id="role-app-email-modal" required value="${currentUser.email}" placeholder="e.g. juan.delacruz@msugensan.edu.ph" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; font-family:monospace; opacity: 0.6; cursor: not-allowed;" readonly>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Office / Building Location:</label>
            <input type="text" id="role-app-office-modal" required value="${escapeHtml(currentUser.officeAddress || 'Department of Chemistry, RSRC Bldg.')}" placeholder="e.g. Department of Chemistry, RSRC Bldg." style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Target Portal Role:</label>
            <select id="role-app-target-role-modal" onchange="toggleRoleAppAffiliationFields(this.value, 'modal')" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; cursor:pointer;">
              ${isPcoModule ? `
                <option value="pco_laboratory" selected>🌿 PCO Laboratory</option>
                <option value="pco_college">🌿 PCO College</option>
                <option value="pco_office">🌿 PCO Office</option>
                <option value="pco_ppd">🌿 PCO PPD</option>
                <option value="pco_gso">🌿 PCO GSO</option>
                <option value="pco_sanitary">🌿 PCO Sanitary</option>
              ` : `
                <option value="faculty" ${defaultSelect === 'faculty' ? 'selected' : ''}>👨‍🏫 Faculty</option>
                <option value="laboratory" ${defaultSelect === 'laboratory' ? 'selected' : ''}>🧪 Laboratory</option>
                <option value="pco_laboratory">🌿 PCO Laboratory</option>
                <option value="pco_college">🌿 PCO College</option>
                <option value="pco_office">🌿 PCO Office</option>
                <option value="pco_ppd">🌿 PCO PPD</option>
                <option value="pco_gso">🌿 PCO GSO</option>
                <option value="pco_sanitary">🌿 PCO Sanitary</option>
                <option value="chairperson" ${defaultSelect === 'chairperson' ? 'selected' : ''}>🏛️ Chairperson</option>
              `}
            </select>
          </div>
          
          <!-- Conditional Affiliation Group -->
          <div id="role-app-affiliation-group-modal" style="display:none; flex-direction:column; gap:12px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Affiliated College / Office:</label>
              <select id="role-app-affiliation-modal" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; cursor:pointer;">
                <option value="">-- Select College/Office Affiliation --</option>
                <optgroup label="Colleges (Academic)">
                  <option value="CNSM">CNSM - College of Natural Sciences and Mathematics</option>
                  <option value="COE">COE - College of Engineering</option>
                  <option value="COA">COA - College of Agriculture</option>
                  <option value="CBAA">CBAA - College of Business Administration and Accountancy</option>
                  <option value="COED">COED - College of Education</option>
                  <option value="COFAS">COFAS - College of Fisheries & Aquatic Sciences</option>
                  <option value="COHS">COHS - College of Health Sciences</option>
                  <option value="COL">COL - College of Law</option>
                  <option value="COM">COM - College of Medicine</option>
                  <option value="CSSH">CSSH - College of Social Sciences and Humanities</option>
                  <option value="IIAIS">IIAIS - Institute of Islamic, Arabic and International Studies</option>
                </optgroup>
                <optgroup label="Offices (Administrative)">
                  <option value="OC">OC - Office of the Chancellor</option>
                  <option value="OVCAA">OVCAA - Office of the Vice Chancellor for Academic Affairs</option>
                  <option value="OVCAF">OVCAF - Office of the Vice Chancellor for Administration and Finance</option>
                  <option value="OVCREI">OVCREI - Office of the Vice Chancellor for Research, Extension, and Innovation</option>
                  <option value="OVCSAS">OVCSAS - Office of the Vice Chancellor for Student Affairs and Services</option>
                  <option value="OVCPD">OVCPD - Office of the Vice Chancellor for Planning and Development</option>
                  <option value="PPD">PPD - Physical Plant Division</option>
                  <option value="GSO">GSO - General Services Office</option>
                  <option value="ICTO">ICTO - Information Communication Technology Office</option>
                  <option value="BO">BO - Budget Office</option>
                  <option value="IPDM">IPDM - Institute of Peace & Development in Mindanao</option>
                  <option value="CAO">CAO - Cultural Affairs Office</option>
                  <option value="CSU">CSU - Civil Security Unit</option>
                  <option value="OIA">OIA - Office of the International Affairs</option>
                  <option value="ARO">ARO - Alumni Relations Office</option>
                  <option value="IAS">IAS - Internal Audit Services</option>
                  <option value="PEMO">PEMO - Planning, Evaluation, & Monitoring Office</option>
                </optgroup>
                <option value="OTHER">❓ Other (Not Listed)</option>
              </select>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Specific Lab / Office Name:</label>
              <input type="text" id="role-app-office-name-modal" placeholder="e.g. Chemistry Stockroom" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:10.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">University ID Card Card Image/PDF:</label>
            <div class="file-upload-zone" onclick="document.getElementById('role-app-univ-id-modal').click()">
              <span style="font-size:24px;">📁</span>
              <div class="file-upload-text">Choose file or drag here to upload ID</div>
              <input type="file" id="role-app-univ-id-modal" required style="display:none;" onchange="handleUniversityIdFileSelectModal(this)">
              <div id="role-app-file-preview-modal" class="file-upload-preview"></div>
            </div>
          </div>
          <button type="submit" class="settings-btn-primary" style="margin-top:10px; font-weight:700;">📤 Submit Access Request</button>
        </form>
      `;
      setTimeout(() => {
        const selectEl = document.getElementById('role-app-target-role-modal');
        if (selectEl) toggleRoleAppAffiliationFields(selectEl.value, 'modal');
      }, 50);
    }
    modal.style.display = 'flex';
  }).catch(err => {
    console.error("Error querying existing applications:", err);
  });
}

function closeRoleAppModal() {
  const modal = document.getElementById('role-app-modal');
  if (modal) modal.style.display = 'none';
}

function handleUniversityIdFileSelectModal(input) {
  const preview = document.getElementById('role-app-file-preview-modal');
  if (input.files && input.files[0]) {
    const file = input.files[0];
    preview.innerText = `📄 ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
    preview.style.display = 'block';
    
    const reader = new FileReader();
    reader.onload = function(e) {
      window.lastUploadedUnivIdBase64Modal = e.target.result;
    };
    reader.readAsDataURL(file);
  } else {
    preview.style.display = 'none';
    window.lastUploadedUnivIdBase64Modal = '';
  }
}

window.openRoleAppModal = openRoleAppModal;
window.closeRoleAppModal = closeRoleAppModal;
window.handleUniversityIdFileSelectModal = handleUniversityIdFileSelectModal;


