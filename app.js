// Doc Learning Hub — Core JavaScript Engine
// Mindanao State University - General Santos, Department of Chemistry

// ==========================================================================
// GLOBAL STATE & CONSTANTS
// ==========================================================================
const DB_NAME = 'doc_learning_hub_music_db';
const DB_VERSION = 1;
let db = null;

let manifestData = null;
let currentCourseId = null; // Active course ID
let currentMode = 'home'; // 'home', 'notes', 'assessments', 'progress'

// User Session
let currentUser = null; // { name, email, studentId, section, year, avatar }

// Quiz Session State
let activeQuizModule = null; // active module being quizzed
let activeQuizData = null; // { questions, title, timeLimitSeconds }
let currentQuestionIndex = 0;
let quizScore = 0;
let quizAnswers = []; // Array of student answers
let quizTimerInterval = null;
let quizSecondsLeft = 0;
let wrongAnswersLog = []; // [{ question, yourAnswer, correctAnswer }]

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
document.addEventListener('DOMContentLoaded', () => {
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
});

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

function loadUserSession() {
  const savedUser = localStorage.getItem('student_user_session');
  const onboardingOverlay = document.getElementById('onboarding-overlay');

  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    updateProfileUI();
    if (onboardingOverlay) {
      onboardingOverlay.style.display = 'none';
      onboardingOverlay.classList.remove('show');
    }
  } else {
    // Show Onboarding Login Overlay
    if (onboardingOverlay) {
      onboardingOverlay.style.display = 'flex';
      setTimeout(() => onboardingOverlay.classList.add('show'), 50);
      showOnboardingStage(1);
    }
  }
}

function showOnboardingStage(stageNum) {
  document.getElementById('onboarding-stage-1').style.display = stageNum === 1 ? 'block' : 'none';
  document.getElementById('onboarding-stage-2').style.display = stageNum === 2 ? 'block' : 'none';
  if (stageNum === 2) {
    renderOnboardingSelectedClasses();
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("JWT Parsing error:", e);
    return null;
  }
}

function handleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  if (!payload) {
    alert("Authentication failed: Unable to parse identity token.");
    return;
  }

  const email = payload.email || '';
  if (!email.endsWith('@msugensan.edu.ph')) {
    alert("Access Denied: Only Google accounts from the @msugensan.edu.ph domain are permitted.");
    return;
  }

  // Check if a persistent profile exists for this email
  const savedProfileStr = localStorage.getItem('doc_lms_saved_profile');
  if (savedProfileStr) {
    try {
      const savedProfile = JSON.parse(savedProfileStr);
      if (savedProfile && savedProfile.email === email && savedProfile.subjects && savedProfile.subjects.length > 0) {
        currentUser = savedProfile;
        // Log in automatically using the saved profile (skip onboarding entirely!)
        localStorage.setItem('student_user_session', JSON.stringify(currentUser));
        updateProfileUI();
        
        const overlay = document.getElementById('onboarding-overlay');
        if (overlay) {
          overlay.classList.remove('show');
          setTimeout(() => overlay.style.display = 'none', 300);
        }
        
        buildUIFromManifest();
        setMode('home');
        return;
      }
    } catch (err) {
      console.error("Error reading saved profile:", err);
    }
  }

  currentUser = {
    name: payload.name || '',
    email: email,
    studentId: '',
    subjects: [], // selected subject IDs
    year: '1',
    avatar: payload.picture || 'icon.png'
  };

  // Switch to Stage 2: Enrollment Info
  showOnboardingStage(2);
  
  // Pre-fill profile fields
  const nicknameInput = document.getElementById('onboarding-nickname');
  if (nicknameInput) {
    nicknameInput.value = currentUser.name;
  }

  const studentIdInput = document.getElementById('onboarding-studentid');
  if (studentIdInput) {
    studentIdInput.value = '';
  }

  const yearSelect = document.getElementById('onboarding-year');
  if (yearSelect) {
    yearSelect.value = '1';
  }

  renderOnboardingSelectedClasses();
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
    localStorage.setItem('student_user_session', JSON.stringify(currentUser));
    localStorage.setItem('doc_lms_saved_profile', JSON.stringify(currentUser));
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
  if (!currentUser) return;

  // Header display name & email
  document.getElementById('user-display-name').innerText = currentUser.name;
  document.getElementById('user-display-email').innerText = currentUser.email;

  // Profile pic in header
  const profilePic = document.getElementById('user-profile-pic');
  if (profilePic) {
    profilePic.src = currentUser.avatar || 'icon.png';
  }

  // Update Settings Form fields
  const settingsName = document.getElementById('settings-nickname');
  if (settingsName) settingsName.value = currentUser.name;

  const settingsId = document.getElementById('settings-studentid');
  if (settingsId) settingsId.value = currentUser.studentId;

  // Render settings chips
  renderSettingsSelectedClasses();

  const settingsYear = document.getElementById('settings-year');
  if (settingsYear) settingsYear.value = currentUser.year;

  const settingsPic = document.getElementById('settings-profile-pic');
  if (settingsPic) {
    settingsPic.src = currentUser.avatar || 'icon.png';
  }
}

// ==========================================================================
// COURSE MANIFEST LOADER
// ==========================================================================
function loadManifest() {
  const localCache = localStorage.getItem('doc_lms_manifest');
  if (localCache) {
    manifestData = JSON.parse(localCache);
    buildUIFromManifest();
  }

  // Fetch from configured URL (with cache-busting)
  fetch(`${REMOTE_MANIFEST_URL}?nocache=${Date.now()}`)
    .then(response => {
      if (!response.ok) throw new Error("Manifest download failed");
      return response.json();
    })
    .then(data => {
      manifestData = data;
      localStorage.setItem('doc_lms_manifest', JSON.stringify(data));
      buildUIFromManifest();
    })
    .catch(err => {
      console.error("Could not fetch latest course manifest:", err);
      if (!manifestData) {
        document.getElementById('courses-list').innerHTML = `
          <div class="empty-playlist-msg" style="color:var(--incorrect);">
            ⚠️ Failed to load courses. Please check connection and click Sync in Settings.
          </div>
        `;
      }
    });
}

function buildUIFromManifest() {
  if (!manifestData || !manifestData.courses) return;

  populateSubjectDropdowns();

  const listContainer = document.getElementById('courses-list');
  if (!listContainer) return;

  if (!currentUser || !currentUser.subjects || currentUser.subjects.length === 0) {
    listContainer.innerHTML = `<div class="empty-playlist-msg">No subjects chosen. Go to App Settings to select your courses.</div>`;
    return;
  }

  // Find all chosen courses and group them by section
  const chosenCourses = [];
  
  manifestData.courses.forEach(course => {
    const matchingSelected = currentUser.subjects.filter(subKey => subKey.startsWith(course.id + '_'));
    
    if (matchingSelected.length > 0) {
      const sectionLabels = matchingSelected.map(subKey => {
        const sectionCode = subKey.replace(course.id + '_', '');
        return sectionCode.toUpperCase();
      });
      
      chosenCourses.push({
        course: course,
        sections: sectionLabels
      });
    }
  });

  if (chosenCourses.length === 0) {
    listContainer.innerHTML = `<div class="empty-playlist-msg">No matched courses. Select your subjects in App Settings.</div>`;
    return;
  }

  let html = '';
  chosenCourses.forEach(item => {
    const course = item.course;
    const sectionsStr = item.sections.join(', ');
    const activeClass = course.id === currentCourseId ? 'active' : '';
    html += `
      <button class="course-btn ${activeClass}" id="course-btn-${course.id}" onclick="setCourse('${course.id}')">
        <span>${course.icon}</span> 
        <div style="display:flex; flex-direction:column; line-height:1.2; text-align:left;">
          <span style="font-weight:700;">${course.name}</span>
          <span style="font-size:9.5px; opacity:0.8; font-weight: 500;">Sec ${sectionsStr}</span>
        </div>
      </button>
    `;
  });
  listContainer.innerHTML = html;

  // Make sure the active course is one of the chosen courses, otherwise select the first chosen one
  const activeChosen = chosenCourses.find(item => item.course.id === currentCourseId);
  if (!activeChosen && chosenCourses.length > 0) {
    setCourse(chosenCourses[0].course.id);
  } else {
    renderCurrentModeView();
  }
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

  if (!currentUser) {
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
    default:
      renderDashboardView();
  }
}

function renderDashboardView() {
  const viewport = document.getElementById('viewport-body');
  const activeCourse = manifestData.courses.find(c => c.id === currentCourseId);
  
  if (!activeCourse) {
    viewport.innerHTML = `<div class="empty-playlist-msg">No course selected</div>`;
    return;
  }

  // Compute stats for current course
  const totalQuizzes = activeCourse.modules.filter(m => m.quiz).length;
  const completedQuizzes = activeCourse.modules.filter(m => 
    localStorage.getItem(`quiz_score_${currentUser.email}_${m.id}`) !== null
  ).length;

  const totalAssignments = activeCourse.modules.filter(m => m.assignment).length;
  const completedAssignments = activeCourse.modules.filter(m => 
    localStorage.getItem(`assignment_submitted_${currentUser.email}_${m.id}`) === 'true'
  ).length;

  // Compute quiz average score percentage
  let totalQuizScore = 0;
  let totalQuizMax = 0;
  activeCourse.modules.forEach(m => {
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
    const hasQuiz = m.quiz && m.quiz.questions && m.quiz.questions.length > 0;
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
                      m.assignment.formUrl.trim() !== '';
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
    return `
      <tr>
        <td style="font-weight:700;">W: ${row.weeks}<br><span style="font-size:11px; color:var(--text-muted);">${row.hours} hrs</span></td>
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
  const faculty = details.faculty || {};
  const consultList = (faculty.consultation || []).map(c => `<li>${c}</li>`).join('');

  const facultyHTML = `
    <div class="faculty-info-container">
      <div class="faculty-contact-row">
        <span class="faculty-contact-icon">👤</span>
        <div class="faculty-contact-details">
          <span class="faculty-contact-label">Instructor Name</span>
          <span class="faculty-contact-value">${faculty.name || 'N/A'}</span>
        </div>
      </div>
      <div class="faculty-contact-row">
        <span class="faculty-contact-icon">📧</span>
        <div class="faculty-contact-details">
          <span class="faculty-contact-label">Academic Email</span>
          <span class="faculty-contact-value">${faculty.email || 'N/A'}</span>
        </div>
      </div>
      <div class="faculty-contact-row">
        <span class="faculty-contact-icon">📱</span>
        <div class="faculty-contact-details">
          <span class="faculty-contact-label">Mobile Number</span>
          <span class="faculty-contact-value">${faculty.mobile || 'N/A'}</span>
        </div>
      </div>
      <div class="faculty-contact-row">
        <span class="faculty-contact-icon">🏢</span>
        <div class="faculty-contact-details">
          <span class="faculty-contact-label">Faculty Office</span>
          <span class="faculty-contact-value">${faculty.office || 'N/A'}</span>
        </div>
      </div>
      <div class="faculty-contact-row" style="flex-direction:column; align-items:flex-start; gap:6px;">
        <span class="faculty-contact-label" style="margin-left:42px;">📅 Consultation Schedule</span>
        <ul style="margin:0; padding-left:58px; font-size:13px; font-weight:700; color:var(--text-main); list-style-type:square;">
          ${consultList || '<li>No consultation schedule specified.</li>'}
        </ul>
      </div>
    </div>
  `;

  // Resolve QR codes for instructors
  let qrCodesHTML = '';
  const facultyName = (faculty.name || '').toLowerCase();
  if (facultyName.includes('eduque')) {
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
    </div>
  `;
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
  window.open(pdfUrl, '_blank');
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

  fetch('https://api.github.com/repos/iammoondae/doclearninghub/contents/lecturenotes')
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
        <a href="mailto:${activeCourse.faculty ? activeCourse.faculty.split(' | ')[1] : 'faculty@msugensan.edu.ph'}" class="settings-btn-primary" style="display: inline-flex; width: auto; align-items: center; gap: 8px; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600;">
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
      const downloadUrl = file.download_url || `https://raw.githubusercontent.com/iammoondae/doclearninghub/main/lecturenotes/${encodeURIComponent(file.name)}`;

      html += `
        <div class="module-card">
          <div class="module-info">
            <span class="module-title">${title}</span>
            <span class="module-desc">${desc}</span>
            <span style="font-size: 11px; color: var(--text-muted); margin-top: 5px;">File size: ${sizeFormatted} • Source: GitHub Repository</span>
          </div>
          <div class="module-actions">
            <button class="pdf-action-btn" onclick="viewPDFInApp('${downloadUrl}', '${title}')">👁️ View</button>
            <button class="pdf-action-btn" style="background:#475569;" onclick="exportPDFExternally('${downloadUrl}')">📤 Download</button>
          </div>
        </div>
      `;
    });
  }

  html += `</div>`;
  viewport.innerHTML = html;
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
    html += `
      <div class="module-card" id="note-card-${m.id}">
        <div class="module-info">
          <span class="module-title">${m.title} Notes</span>
          <span class="module-desc">Current active syllabus chapter handouts</span>
          <span style="font-size: 11px; color: var(--text-muted); margin-top: 5px;">File size: ${m.pdfSize || 'N/A'} • Source: Faculty Server</span>
        </div>
        <div class="module-actions" id="note-actions-${m.id}">
          <button class="pdf-action-btn" onclick="viewPDFInApp('${m.pdfUrl}', '${m.title}')">👁️ View</button>
          <button class="pdf-action-btn" style="background:#475569;" onclick="exportPDFExternally('${m.pdfUrl}')">📤 Download</button>
        </div>
      </div>
    `;
  });
  html += `</div>`;

  viewport.innerHTML = html;

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
  window.open(pdfUrl, '_blank');
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
    let quizSectionHTML = '';
    const hasQuiz = m.quiz && m.quiz.questions && m.quiz.questions.length > 0;
    
    if (hasQuiz) {
      const savedScore = localStorage.getItem(`quiz_score_${currentUser.email}_${m.id}`);
      const savedMax = localStorage.getItem(`quiz_max_${currentUser.email}_${m.id}`);
      
      if (savedScore !== null) {
        quizSectionHTML = `
          <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius: 8px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2);">
            <span style="font-size: 13px; font-weight: 600; color: var(--correct);">✅ Completed Quiz Grade: ${savedScore}/${savedMax}</span>
          </div>
        `;
      } else {
        quizSectionHTML = `
          <button class="restart-btn" style="margin-top: 10px; width: 100%; padding: 12px; margin-bottom: 0;" onclick="startQuizRunner('${m.id}')">
            ✍️ Start Module Quiz
          </button>
        `;
      }
    } else {
      quizSectionHTML = `
        <span style="font-size: 12px; color: var(--incorrect); font-weight: 500; display: block; margin-top: 10px;">
          ⚠️ Please wait while the assigned faculty uploads the files or contact the faculty through email.
        </span>
      `;
    }

    let assignmentSectionHTML = '';
    const hasPreparedForm = m.assignment && m.assignment.formUrl && 
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
    } else if (m.assignment) {
      assignmentSectionHTML = `
        <div style="margin-top: 15px; border-top: 1px dashed var(--border-card); padding-top: 12px;">
          <span style="font-weight: 700; font-size: 13.5px; color: var(--text-main); display: block;">📂 Performance Assignment: ${m.assignment.title || 'Assignment'}</span>
          <span style="font-size: 12px; color: var(--incorrect); font-weight: 500; display: block; margin-top: 8px;">
            ⚠️ Please wait while the assigned faculty uploads the files or contact the faculty through email.
          </span>
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
  viewport.innerHTML = html;
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

function renderQuizQuestion() {
  const viewport = document.getElementById('viewport-body');
  const question = activeQuizData.questions[currentQuestionIndex];
  
  // Update Header progress
  const pct = Math.round((currentQuestionIndex / activeQuizData.questions.length) * 100);
  document.getElementById('progress-bar').style.width = `${pct}%`;
  document.getElementById('slide-num-label').innerText = `Question ${currentQuestionIndex + 1} of ${activeQuizData.questions.length}`;

  let contentHTML = `
    <div class="question-container">
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
}

function selectQuizChoice(choiceIndex) {
  const question = activeQuizData.questions[currentQuestionIndex];
  const isCorrect = choiceIndex === question.answer;

  logAnswer(choiceIndex, question.choices[choiceIndex], isCorrect);
  highlightAnswers(choiceIndex, question.answer, 'mc');
}

function selectQuizTF(tfValue) {
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
    const cQuizzes = course.modules.filter(m => m.quiz).length;
    const cPassedQuizzes = course.modules.filter(m => 
      localStorage.getItem(`quiz_score_${currentUser.email}_${m.id}`) !== null
    ).length;

    const cAssignments = course.modules.filter(m => m.assignment).length;
    const cPassedAssignments = course.modules.filter(m => 
      localStorage.getItem(`assignment_submitted_${currentUser.email}_${m.id}`) === 'true'
    ).length;

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
    timestamp: new Date().toISOString()
  };

  console.log("Mock Score Submission Payload:", payload);

  // If Sheets endpoint URL is not configured, we queue it locally and show a alert
  if (!REMOTE_SHEETS_SCRIPT_URL) {
    queueOfflineScore(payload);
    return;
  }

  // Attempt real HTTPS POST request to Google Apps Script
  // Web App script expects parameters in standard JSON request body
  fetch(REMOTE_SHEETS_SCRIPT_URL, {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  })
  .then(res => {
    // Standard Apps Script return redirection or text
    if (!res.ok) throw new Error("HTTP connection failed");
    console.log("Sheets API log successful");
  })
  .catch(err => {
    console.error("Sheets log failed, caching locally:", err);
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
  if (!REMOTE_SHEETS_SCRIPT_URL) return;
  
  const offlineQueue = JSON.parse(localStorage.getItem('doc_lms_offline_scores') || '[]');
  if (offlineQueue.length === 0) return;

  console.log("Syncing offline scores queue...");
  
  const promises = offlineQueue.map(payload => {
    return fetch(REMOTE_SHEETS_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => {
      if (!res.ok) throw new Error();
      return payload; // Success
    });
  });

  Promise.allSettled(promises).then(results => {
    const successIndices = [];
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        successIndices.push(idx);
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

  // Update Settings Form inputs values
  if (currentUser) {
    document.getElementById('settings-nickname').value = currentUser.name;
    document.getElementById('settings-studentid').value = currentUser.studentId;
    document.getElementById('settings-year').value = currentUser.year;
    
    const settingsPic = document.getElementById('settings-profile-pic');
    if (settingsPic) {
      settingsPic.src = currentUser.avatar || 'icon.png';
    }
  }

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
  const confirmOut = confirm("Are you sure you want to sign out? Your profile details and score history will be saved on this device.");
  if (!confirmOut) return;

  localStorage.removeItem('student_user_session');
  currentUser = null;
  closeSettings();
  loadUserSession();
}

function confirmClearAllProgress() {
  const confirmClear = confirm("⚠️ Danger: Clear all local grade records, quizzes scores history, and checklist details? This cannot be undone.");
  if (!confirmClear) return;

  // Find all quiz score keys and remove them
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key.startsWith('quiz_score_') || key.startsWith('quiz_max_') || key.startsWith('assignment_submitted_')) {
      localStorage.removeItem(key);
    }
  }

  playSFX(true);
  alert("Cached academic progress records cleared successfully.");
  renderCurrentModeView();
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
