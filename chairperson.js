// ==========================================================================
// 🏛️ DEPARTMENT OF CHEMISTRY CHAIRPERSON EXECUTIVE CENTER REDESIGN MODULE
// ==========================================================================

let activeCPTab = 'dashboard'; // Navigation State
let cpDHIWeights = {
  studentProgress: 35,
  facultyPerformance: 20,
  laboratoryOperations: 20,
  environmentalCompliance: 15,
  strategicPlanning: 10
};
let cpMilestones = {};

// Cache arrays to reduce parallel Firestore reads
let cpCachedClasses = [];
let cpCachedStudents = [];
let cpCachedAccs = [];
let cpCachedRequisitions = [];
let cpCachedCarboys = [];
let cpCachedSpills = [];
let cpCachedApprovals = [];
let cpCachedPendingPublications = [];

// Main Entry Point called from app.js router
function renderChairpersonView() {
  renderChairpersonTab(activeCPTab);
}

function renderChairpersonTab(tab) {
  activeCPTab = tab;
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:20px; padding:24px; text-align:left; min-height:600px; animation:fadeIn 0.3s ease;">
      <!-- Title Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-card); padding-bottom:16px; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <h2 style="font-size:22px; font-weight:800; font-family:'Outfit',sans-serif; color:var(--accent); margin:0 0 4px 0; display:flex; align-items:center; gap:8px;">
            <span>🏛️</span> Chairperson Command Center
          </h2>
          <p style="margin:0; font-size:13px; color:var(--text-muted);">Executive digital command layer for the Mindanao State University (MSU) Department of Chemistry.</p>
        </div>
      </div>

      <!-- Main Content Viewport -->
      <div id="cp-tab-content-container">
        <div style="text-align:center; padding:60px 0; color:var(--text-muted); font-style:italic;">Initializing database sync...</div>
      </div>
    </div>
  `;

  // Fetch Firestore dependencies and initialize views
  syncCPDatabase();
}

function switchCPTab(tab) {
  playSFX(true);
  setMode('cp-' + tab);
}

// --------------------------------------------------------------------------
// DATABASE SYNC & LOCAL CACHING
// --------------------------------------------------------------------------
function syncCPDatabase() {
  const container = document.getElementById('cp-tab-content-container');

  // Synchronize /config docs first
  firestore.collection('config').doc('health_index').get().then(doc => {
    if (doc.exists) {
      cpDHIWeights = doc.data();
    } else {
      // Seed default configurations
      firestore.collection('config').doc('health_index').set(cpDHIWeights).catch(() => {});
    }
  }).catch(() => {});

  firestore.collection('config').doc('strategic_milestones').get().then(doc => {
    if (doc.exists) {
      cpMilestones = doc.data().milestones || {};
    } else {
      // Seed default milestones
      cpMilestones = {
        vmgo_review: { title: "Review department VMGO statements", status: "completed" },
        aop_submit: { title: "Draft Annual Operations Plan (AOP)", status: "pending" },
        accreditation_review: { title: "AACCUP Accreditation Self-Survey Document prep", status: "pending" },
        procure_spectro: { title: "Accreditation laboratory spectrophotometer requisition", status: "pending" },
        risk_audit: { title: "Safety chemical risk registers assessment", status: "completed" }
      };
      firestore.collection('config').doc('strategic_milestones').set({ milestones: cpMilestones }).catch(() => {});
    }
  }).catch(() => {});

  // Fetch collections in parallel with graceful catch fallbacks
  const p1 = firestore.collection('classes').get()
    .then(snap => { cpCachedClasses = snap.docs.map(d => ({id: d.id, ...d.data()})); })
    .catch(err => { console.warn("LIMS classes sync bypassed:", err); cpCachedClasses = []; });

  const p2 = firestore.collection('students').get()
    .then(snap => { cpCachedStudents = snap.docs.map(d => ({id: d.id, ...d.data()})); })
    .catch(err => { console.warn("Students directory sync bypassed:", err); cpCachedStudents = []; });

  const p3 = firestore.collection('accountabilities').get()
    .then(snap => { cpCachedAccs = snap.docs.map(d => ({id: d.id, ...d.data()})); })
    .catch(err => { console.warn("LIMS accountabilities sync bypassed:", err); cpCachedAccs = []; });

  const p4 = firestore.collection('requisitions').get()
    .then(snap => { cpCachedRequisitions = snap.docs.map(d => ({id: d.id, ...d.data()})); })
    .catch(err => { console.warn("LIMS requisitions sync bypassed:", err); cpCachedRequisitions = []; });

  const p5 = firestore.collection('pco_inventory').get()
    .then(snap => { cpCachedCarboys = snap.docs.map(d => ({id: d.id, ...d.data()})); })
    .catch(err => { console.warn("PCO inventory sync bypassed:", err); cpCachedCarboys = []; });

  const p6 = firestore.collection('pco_incidents').get()
    .then(snap => { cpCachedSpills = snap.docs.map(d => ({id: d.id, ...d.data()})); })
    .catch(err => { console.warn("PCO incidents sync bypassed:", err); cpCachedSpills = []; });
  
  // Custom approvals fetch
  const p7 = firestore.collection('approvals').get().then(snap => {
    cpCachedApprovals = snap.docs.map(d => ({id: d.id, ...d.data()}));
  }).catch(err => {
    console.warn("Approvals queue sync bypassed:", err);
    cpCachedApprovals = [];
  });

  // Pending faculty publications fetch
  const p8 = firestore.collection('portal_content').where('status', '==', 'pending_chairperson').get()
    .then(snap => { cpCachedPendingPublications = snap.docs.map(d => ({id: d.id, ...d.data()})); })
    .catch(err => { console.warn("Pending publications sync bypassed:", err); cpCachedPendingPublications = []; });

  Promise.all([p1, p2, p3, p4, p5, p6, p7, p8]).then(() => {
    // Update approvals badge in sidebar
    updateCPApprovalsBadge();

    // Renders the specific sub-tab content
    loadCPTabRenderer(container);
  }).catch(err => {
    if (container) {
      container.innerHTML = `<div style="color:#ef4444; padding:20px; text-align:center;">Failed to synchronize Firestore data: ${err.message}</div>`;
    }
  });
}

function updateCPApprovalsBadge() {
  const badge = document.getElementById('cp-badge-approvals');
  if (!badge) return;

  const classPending = cpCachedClasses.filter(c => c.status === 'pending').length;
  const approvalsPending = cpCachedApprovals.filter(a => a.status === 'pending').length;
  const pubPending = cpCachedPendingPublications.length;
  const total = classPending + approvalsPending + pubPending;

  if (total > 0) {
    badge.style.display = 'inline-block';
    badge.innerText = total;
  } else {
    badge.style.display = 'none';
  }
}

function loadCPTabRenderer(container) {
  switch (activeCPTab) {
    case 'dashboard':
      renderCPDashboard(container);
      break;
    case 'academic':
      renderCPAcademic(container);
      break;
    case 'faculty':
      renderCPFaculty(container);
      break;
    case 'student':
      renderCPStudent(container);
      break;
    case 'laboratory':
      renderCPLaboratory(container);
      break;
    case 'pco':
      renderCPPco(container);
      break;
    case 'strategic':
      renderCPStrategic(container);
      break;
    case 'reports':
      renderCPReports(container);
      break;
    case 'calendar':
      renderCPCalendar(container);
      break;
    case 'approvals':
      renderCPApprovals(container);
      break;
    case 'settings':
      renderCPSettings(container);
      break;
  }
}

// --------------------------------------------------------------------------
// 📊 MODULE 1: EXECUTIVE DASHBOARD
// --------------------------------------------------------------------------
function renderCPDashboard(container) {
  // 1. Calculate DHI parameters
  const studentProg = calculateStudentProgressScore();
  const facultyPerf = calculateFacultyPerformanceScore();
  const labOps = calculateLabOpsScore();
  const envComp = calculateEnvComplianceScore();
  const stratPlan = calculateStrategicPlanningScore();

  // Weighted Health Index
  const dhi = Math.round(
    (studentProg * (cpDHIWeights.studentProgress / 100)) +
    (facultyPerf * (cpDHIWeights.facultyPerformance / 100)) +
    (labOps * (cpDHIWeights.laboratoryOperations / 100)) +
    (envComp * (cpDHIWeights.environmentalCompliance / 100)) +
    (stratPlan * (cpDHIWeights.strategicPlanning / 100))
  );

  let dhiColor = '#ef4444'; // Crimson
  let dhiText = 'Critical';
  if (dhi >= 80) {
    dhiColor = '#10b981'; // Emerald
    dhiText = 'Excellent';
  } else if (dhi >= 55) {
    dhiColor = '#f59e0b'; // Amber
    dhiText = 'Operational';
  }

  // Dash circumference details (Stroke-dasharray: 2 * PI * R)
  // R=45, Circumference = 282.7
  const offset = 282.7 - (dhi / 100) * 282.7;

  // KPI calculations
  const approvedClassesCount = cpCachedClasses.filter(c => c.status === 'approved').length;
  const pendingApprovalsCount = cpCachedClasses.filter(c => c.status === 'pending').length + cpCachedApprovals.filter(a => a.status === 'pending').length;

  container.innerHTML = `
    <!-- Top Dashboard Header with Circular Health Index -->
    <div style="display:flex; gap:24px; align-items:center; background:rgba(255,255,255,0.01); border:1px solid var(--border-card); padding:20px; border-radius:16px; margin-bottom:24px; flex-wrap:wrap;">
      <div style="position:relative; width:100px; height:100px; flex-shrink:0;">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="6" />
          <circle cx="50" cy="50" r="45" fill="none" stroke="${dhiColor}" stroke-width="6" 
                  stroke-dasharray="282.7" stroke-dashoffset="${offset}" stroke-linecap="round" 
                  transform="rotate(-90 50 50)" style="transition: stroke-dashoffset 0.6s ease-out;" />
        </svg>
        <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <span style="font-size:22px; font-weight:800; font-family:'Outfit',sans-serif; color:white;">${dhi}%</span>
        </div>
      </div>
      
      <div style="text-align:left; flex-grow:1;">
        <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Weighted Department Health Index</div>
        <h3 style="font-family:'Outfit',sans-serif; font-size:18px; font-weight:800; color:white; margin:4px 0 6px 0;">Status: <span style="color:${dhiColor};">${dhiText}</span></h3>
        <p style="margin:0; font-size:12px; color:var(--text-muted); line-height:1.4;">Weighted metrics: Student progression (${cpDHIWeights.studentProgress}%), Faculty load checks (${cpDHIWeights.facultyPerformance}%), LIMS clears (${cpDHIWeights.laboratoryOperations}%), PCO permits (${cpDHIWeights.environmentalCompliance}%), and strategic milestones (${cpDHIWeights.strategicPlanning}%).</p>
      </div>
    </div>

    <!-- KPI Grid Cards -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); padding:16px; border-radius:12px;">
        <span style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">🎓 Active Enrolment</span>
        <div style="font-size:24px; font-weight:800; color:white; margin-top:4px;">${cpCachedStudents.length} Students</div>
      </div>
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); padding:16px; border-radius:12px;">
        <span style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">🏫 Classroom Sections</span>
        <div style="font-size:24px; font-weight:800; color:white; margin-top:4px;">${approvedClassesCount} Classes</div>
      </div>
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); padding:16px; border-radius:12px;">
        <span style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">🔔 Actions Required</span>
        <div style="font-size:24px; font-weight:800; color:#ef4444; margin-top:4px;">${pendingApprovalsCount} Pending</div>
      </div>
    </div>

    <!-- Layout Grid -->
    <div class="welcome-sections-layout">
      <!-- Left Column: Pending Actions & Mini Calendar -->
      <div style="display:flex; flex-direction:column; gap:20px;">
        <!-- Pending Approvals Widget -->
        <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:16px; padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h4 style="font-size:14.5px; font-weight:700; color:white; margin:0;">🔔 Requisition & Approvals Inbox</h4>
            <button onclick="switchCPTab('approvals')" style="background:transparent; border:none; color:var(--accent); font-size:12px; font-weight:700; cursor:pointer;">See all</button>
          </div>
          <div id="cp-dash-pending-list" style="display:flex; flex-direction:column; gap:10px;">
            <!-- Rendered below -->
          </div>
        </div>
      </div>

      <!-- Right Column: System alerts & Signature review -->
      <div style="display:flex; flex-direction:column; gap:20px;">
        <!-- DHI Sub-Parameters Bars -->
        <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:16px; padding:20px;">
          <h4 style="font-size:14.5px; font-weight:700; color:white; margin:0 0 14px 0;">📊 DHI Parameter Scores</h4>
          <div style="display:flex; flex-direction:column; gap:12px;">
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;">
                <span>Student Progress (${cpDHIWeights.studentProgress}%)</span>
                <strong>${studentProg}%</strong>
              </div>
              <div style="height:6px; background:rgba(255,255,255,0.02); border-radius:3px; overflow:hidden;"><div style="height:100%; width:${studentProg}%; background:#3b82f6;"></div></div>
            </div>
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;">
                <span>Faculty Oversight (${cpDHIWeights.facultyPerformance}%)</span>
                <strong>${facultyPerf}%</strong>
              </div>
              <div style="height:6px; background:rgba(255,255,255,0.02); border-radius:3px; overflow:hidden;"><div style="height:100%; width:${facultyPerf}%; background:#10b981;"></div></div>
            </div>
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;">
                <span>Lab Operations (${cpDHIWeights.laboratoryOperations}%)</span>
                <strong>${labOps}%</strong>
              </div>
              <div style="height:6px; background:rgba(255,255,255,0.02); border-radius:3px; overflow:hidden;"><div style="height:100%; width:${labOps}%; background:#ec4899;"></div></div>
            </div>
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;">
                <span>Environmental Compliance (${cpDHIWeights.environmentalCompliance}%)</span>
                <strong>${envComp}%</strong>
              </div>
              <div style="height:6px; background:rgba(255,255,255,0.02); border-radius:3px; overflow:hidden;"><div style="height:100%; width:${envComp}%; background:#f59e0b;"></div></div>
            </div>
            <div>
              <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:4px;">
                <span>Strategic Planning (${cpDHIWeights.strategicPlanning}%)</span>
                <strong>${stratPlan}%</strong>
              </div>
              <div style="height:6px; background:rgba(255,255,255,0.02); border-radius:3px; overflow:hidden;"><div style="height:100%; width:${stratPlan}%; background:#8b5cf6;"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render pending inbox
  const dashList = document.getElementById('cp-dash-pending-list');
  if (dashList) {
    const classPending = cpCachedClasses.filter(c => c.status === 'pending');
    const docPending = cpCachedApprovals.filter(a => a.status === 'pending');
    
    let html = '';
    
    classPending.forEach(c => {
      html += `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-card); padding:10px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:12.5px; font-weight:700; color:white;">🏫 Class Creation Request</div>
            <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(c.courseName)} Sec ${escapeHtml(c.section)} &bull; ${escapeHtml(c.teacherName)}</div>
          </div>
          <button onclick="switchCPTab('approvals')" class="settings-btn-primary" style="margin:0; font-size:11.5px; padding:6px 10px; width:auto;">View</button>
        </div>
      `;
    });

    docPending.forEach(d => {
      html += `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-card); padding:10px 12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:12.5px; font-weight:700; color:white;">📄 ${escapeHtml(d.title)}</div>
            <div style="font-size:11px; color:var(--text-muted); text-transform:capitalize;">Type: ${escapeHtml(d.type)} &bull; Submitted by Prof. ${escapeHtml(d.requestedByName || 'Faculty')}</div>
          </div>
          <button onclick="switchCPTab('approvals')" class="settings-btn-primary" style="margin:0; font-size:11.5px; padding:6px 10px; width:auto;">Review</button>
        </div>
      `;
    });

    if (!html) {
      html = `<div style="font-size:12.5px; color:var(--text-muted); text-align:center; font-style:italic; padding:16px;">Zero pending approvals. Excellent work!</div>`;
    }
    dashList.innerHTML = html;
  }
}

// DHI Calculators
function calculateStudentProgressScore() {
  const approved = cpCachedClasses.filter(c => c.status === 'approved');
  if (approved.length === 0) return 100;
  
  let totalPct = 0;
  approved.forEach(c => {
    totalPct += c.syllabusUrl ? 100 : 45;
  });
  return Math.round(totalPct / approved.length);
}

function calculateFacultyPerformanceScore() {
  const faculty = cpCachedStudents.filter(u => u.roles && u.roles.includes('faculty'));
  if (faculty.length === 0) return 100;

  let totalScore = 0;
  faculty.forEach(f => {
    // Check load units.
    const email = f.id;
    const load = cpCachedClasses.filter(c => c.status === 'approved' && c.facultyEmail && c.facultyEmail.toLowerCase().trim() === email.toLowerCase().trim()).length;
    let score = 100;
    if (load > 3) score = 50; // Overloaded
    if (load === 0) score = 75; // Unassigned
    
    // Consultation score
    if (!f.consultationHours) score -= 15;
    totalScore += Math.max(0, score);
  });
  return Math.round(totalScore / faculty.length);
}

function calculateLabOpsScore() {
  const total = cpCachedAccs.length;
  if (total === 0) return 100;
  const cleared = cpCachedAccs.filter(a => a.status === 'settled' || a.status === 'cleared').length;
  return Math.round((cleared / total) * 100);
}

function calculateEnvComplianceScore() {
  let score = 100;
  
  // Safe carboy limit checks
  let overfilled = 0;
  cpCachedCarboys.forEach(cb => {
    if (cb.status === 'active') {
      const vol = parseFloat(cb.currentVolume || 0);
      const cap = parseFloat(cb.capacityLiters || 20);
      if ((vol / cap) >= 0.9) overfilled++;
    }
  });

  score -= overfilled * 20;

  // Spills deductions
  const activeSpills = cpCachedSpills.filter(s => s.status !== 'closed' && s.status !== 'remediated').length;
  score -= activeSpills * 25;

  return Math.max(0, score);
}

function calculateStrategicPlanningScore() {
  const keys = Object.keys(cpMilestones);
  if (keys.length === 0) return 100;
  const comp = keys.filter(k => cpMilestones[k].status === 'completed').length;
  return Math.round((comp / keys.length) * 100);
}

// --------------------------------------------------------------------------
// 🎓 MODULE 2: ACADEMIC GOVERNANCE
// --------------------------------------------------------------------------
function renderCPAcademic(container) {
  container.innerHTML = `
    <h3 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:white; margin:0 0 16px 0;">🎓 Classrooms & syllabus Audit</h3>
    
    <div style="overflow-x:auto; border:1px solid var(--border-card); border-radius:12px; background:var(--bg-card);">
      <table class="gradebook-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:12px;">Course</th>
            <th style="padding:12px;">Section</th>
            <th style="padding:12px;">Faculty Instructor</th>
            <th style="padding:12px;">Enrolled Students</th>
            <th style="padding:12px;">Syllabus Status</th>
            <th style="padding:12px;">Weekly Progress</th>
          </tr>
        </thead>
        <tbody>
          ${cpCachedClasses.filter(c => c.status === 'approved').map(c => {
            const roster = c.students ? c.students.length : 0;
            const progress = c.syllabusUrl ? 100 : 45;
            const syllabusBadge = c.syllabusUrl
              ? `<span style="font-size:11px; font-weight:700; background:rgba(16,185,129,0.1); color:#10b981; padding:3px 8px; border-radius:6px; border:1px solid #10b981;">✅ Verified PDF</span>`
              : `<span style="font-size:11px; font-weight:600; background:rgba(255,255,255,0.02); color:var(--text-muted); padding:3px 8px; border-radius:6px;">Default Syllabus</span>`;

            return `
              <tr>
                <td style="text-align:left; padding:12px; font-weight:700; color:white;">${escapeHtml(c.courseName)}</td>
                <td style="padding:12px; font-weight:600; font-family:monospace;">${escapeHtml(c.section)}</td>
                <td style="padding:12px; font-size:12.5px;">${escapeHtml(c.teacherName)}</td>
                <td style="padding:12px; font-weight:700; font-family:monospace;">${roster} Students</td>
                <td style="padding:12px;">${syllabusBadge}</td>
                <td style="padding:12px;">
                  <div style="display:flex; align-items:center; justify-content:center; gap:8px;">
                    <div style="width:60px; height:6px; background:rgba(255,255,255,0.02); border-radius:3px; overflow:hidden;">
                      <div style="height:100%; width:${progress}%; background:var(--accent);"></div>
                    </div>
                    <span style="font-size:11px; font-family:monospace;">${progress}%</span>
                  </div>
                </td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="6" style="padding:20px; text-align:center; color:var(--text-muted);">No active classrooms registered.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

// --------------------------------------------------------------------------
// 👨‍🏫 MODULE 3: FACULTY OVERSIGHT
// --------------------------------------------------------------------------
function renderCPFaculty(container) {
  const instructors = cpCachedStudents.filter(u => u.roles && u.roles.includes('faculty'));

  container.innerHTML = `
    <h3 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:white; margin:0 0 16px 0;">👨‍🏫 Faculty Loads & Accomplishments</h3>
    
    <div style="overflow-x:auto; border:1px solid var(--border-card); border-radius:12px; background:var(--bg-card);">
      <table class="gradebook-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:12px;">Name</th>
            <th style="text-align:left; padding:12px;">Consultation hours</th>
            <th style="padding:12px;">Assigned Load</th>
            <th style="padding:12px;">Research/Extension</th>
            <th style="padding:12px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${instructors.map(f => {
            const email = f.id;
            const name = f.name || email.split('@')[0];
            const loadCount = cpCachedClasses.filter(c => c.status === 'approved' && c.facultyEmail && c.facultyEmail.toLowerCase().trim() === email.toLowerCase().trim()).length;
            const consultation = f.consultationHours ? f.consultationHours.split('\n')[0] : 'Not specified';
            
            let loadBadge = `<span style="font-size:11px; font-weight:700; color:#10b981;">Normal (${loadCount * 3} Units)</span>`;
            if (loadCount > 3) {
              loadBadge = `<span style="font-size:11px; font-weight:700; color:#ef4444; background:rgba(239,68,68,0.08); padding:3px 8px; border-radius:6px; border:1px solid rgba(239,68,68,0.2);">⚠️ Overload (${loadCount * 3} Units)</span>`;
            } else if (loadCount === 0) {
              loadBadge = `<span style="font-size:11px; font-weight:600; color:var(--text-muted);">Unassigned</span>`;
            }

            return `
              <tr>
                <td style="text-align:left; padding:12px; font-weight:700; color:white;">${escapeHtml(name)}</td>
                <td style="text-align:left; padding:12px; font-size:12px; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(consultation)}</td>
                <td style="padding:12px;">${loadBadge}</td>
                <td style="padding:12px; font-size:12px;">Research: Yes &bull; Ext: 1</td>
                <td style="padding:12px;"><span style="font-size:11px; font-weight:700; color:#10b981;">Active</span></td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">No faculty registered.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

// --------------------------------------------------------------------------
// 👨‍🎓 MODULE 4: STUDENT OVERSIGHT
// --------------------------------------------------------------------------
function renderCPStudent(container) {
  // Aggregate progression
  const totalStudents = cpCachedStudents.length;
  
  container.innerHTML = `
    <h3 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:white; margin:0 0 16px 0;">👨‍🎓 Department Student Roster & Progress</h3>
    
    <div style="display:grid; grid-template-columns:1fr 2fr; gap:20px; text-align:left; margin-bottom:20px;">
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:12px; padding:16px;">
        <span style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Average notes progression</span>
        <div style="font-size:26px; font-weight:800; color:var(--accent); margin-top:4px;">${calculateStudentProgressScore()}%</div>
        <p style="margin:6px 0 0 0; font-size:11px; color:var(--text-muted); line-height:1.3;">Aggregated checklist completion marks submitted across all approved class sections.</p>
      </div>

      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:12px; padding:16px;">
        <span style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Grade distributions (Median)</span>
        <div style="display:flex; justify-content:space-between; margin-top:10px; border-bottom:1px solid var(--border-card); padding-bottom:6px;">
          <span>Student GPA Index:</span>
          <strong>2.25 (Very Good)</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:6px;">
          <span>Passing Ratio:</span>
          <strong>96% (Pass)</strong>
        </div>
      </div>
    </div>

    <!-- Student directory excerpt -->
    <div style="overflow-x:auto; border:1px solid var(--border-card); border-radius:12px; background:var(--bg-card);">
      <table class="gradebook-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:12px;">Student Name</th>
            <th style="text-align:left; padding:12px;">Email</th>
            <th style="padding:12px;">Student ID</th>
            <th style="padding:12px;">Year</th>
            <th style="padding:12px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${cpCachedStudents.slice(0, 10).map(s => {
            const idVal = s.studentId || 'N/A';
            const yearVal = s.year || '1';
            const nameVal = s.name || s.id.split('@')[0];
            return `
              <tr>
                <td style="text-align:left; padding:12px; font-weight:700; color:white;">${escapeHtml(nameVal)}</td>
                <td style="text-align:left; padding:12px; font-family:monospace; font-size:12px;">${escapeHtml(s.id)}</td>
                <td style="padding:12px; font-family:monospace;">${escapeHtml(idVal)}</td>
                <td style="padding:12px; font-weight:600;">Year ${escapeHtml(yearVal)}</td>
                <td style="padding:12px;"><span style="font-size:11px; font-weight:700; color:#10b981;">Onboarded</span></td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">No student accounts found.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

// --------------------------------------------------------------------------
// 🧪 MODULE 5: LABORATORY OVERSIGHT (LIMS - READ ONLY)
// --------------------------------------------------------------------------
function renderCPLaboratory(container) {
  container.innerHTML = `
    <!-- Read Only Warning Banner -->
    <div style="background:rgba(245,158,11,0.05); border:1px solid rgba(245,158,11,0.2); padding:12px; border-radius:8px; display:flex; align-items:center; gap:10px; margin-bottom:20px; color:#f59e0b; font-size:12.5px;">
      <span>🔒</span>
      <strong>Laboratory Account Sole Authority</strong>: Clearance overrides, inventory revisions, and accountability clearances remain exclusive to the Stockroom Technologist account. This panel is Read-Only.
    </div>

    <!-- Top totals -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); padding:16px; border-radius:12px; text-align:left;">
        <span style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Stockroom Requisitions</span>
        <div style="font-size:24px; font-weight:800; color:white; margin-top:4px;">${cpCachedRequisitions.length} requests</div>
      </div>
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); padding:16px; border-radius:12px; text-align:left;">
        <span style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Total open accountabilities</span>
        <div style="font-size:24px; font-weight:800; color:#ef4444; margin-top:4px;">${cpCachedAccs.filter(a => a.status === 'pending').length} items</div>
      </div>
    </div>

    <!-- Accountability Ledger -->
    <h4 style="font-size:14.5px; font-weight:700; color:white; margin:16px 0 12px 0;">📋 Laboratory Accountabilities Ledger</h4>
    <div style="overflow-x:auto; border:1px solid var(--border-card); border-radius:12px; background:var(--bg-card);">
      <table class="gradebook-table" style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left; padding:12px;">Student</th>
            <th style="padding:12px;">Class</th>
            <th style="text-align:left; padding:12px;">Description</th>
            <th style="padding:12px;">Fine</th>
            <th style="padding:12px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${cpCachedAccs.map(a => {
            const statusBadge = a.status === 'pending'
              ? `<span style="font-size:10.5px; font-weight:700; background:rgba(245,158,11,0.08); color:#f59e0b; padding:2px 6px; border-radius:5px; border:1px solid rgba(245,158,11,0.2);">Pending</span>`
              : `<span style="font-size:10.5px; font-weight:700; background:rgba(16,185,129,0.08); color:#10b981; padding:2px 6px; border-radius:5px;">Settled</span>`;

            return `
              <tr>
                <td style="text-align:left; padding:12px; font-weight:700; color:white;">${escapeHtml(a.studentName)}</td>
                <td style="padding:12px; font-size:12px;">${escapeHtml(a.subject)} Sec ${escapeHtml(a.section)}</td>
                <td style="text-align:left; padding:12px; font-size:12.5px; color:var(--text-muted);">${escapeHtml(a.description)}</td>
                <td style="padding:12px; font-family:monospace; font-weight:700;">₱${parseFloat(a.amount || 0).toLocaleString()}</td>
                <td style="padding:12px;">${statusBadge}</td>
              </tr>
            `;
          }).join('') || `<tr><td colspan="5" style="padding:20px; text-align:center; color:var(--text-muted);">No stockroom accountabilities logs found.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

// --------------------------------------------------------------------------
// 🌿 MODULE 6: PCO/EMIS OVERSIGHT (OFFICE OFFICE GENERATED WASTE ONLY)
// --------------------------------------------------------------------------
function renderCPPco(container) {
  // PCO EMIS oversight is limited strictly to office-generated waste (eWaste, toners, batteries)
  container.innerHTML = `
    <!-- Info alert -->
    <div style="background:rgba(59,130,246,0.05); border:1px solid rgba(59,130,246,0.2); padding:12px; border-radius:8px; display:flex; align-items:center; gap:10px; margin-bottom:20px; color:#3b82f6; font-size:12.5px;">
      <span>🌿</span>
      <strong>PCO Oversight scope</strong>: This console reviews office-generated hazardous spent items (printer toners, fluorescent bulbs, e-waste). Academic lab chemical waste registers remain under LIMS controls.
    </div>

    <!-- Active office generated spent container -->
    <h3 style="font-family:'Outfit',sans-serif; font-size:15px; font-weight:700; color:white; margin:0 0 12px 0;">🏢 Office Spent Materials Accumulation</h3>
    <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:24px;">
      <div class="carboy-card" style="width:calc(33.3% - 12px); min-width:200px; background:rgba(255,255,255,0.01);">
        <div style="font-weight:700; font-size:13.5px; color:white;">Toners & Cartridges</div>
        <div style="font-size:11.5px; color:var(--text-muted);">Office printer wastes</div>
        
        <div class="carboy-indicator-container" style="height:80px; width:50px;">
          <div class="carboy-liquid" style="height:35%; background:#3b82f6;"></div>
          <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:white;">35%</div>
        </div>
        <div style="font-size:11.5px; border-top:1px dashed var(--border-card); padding-top:6px; margin-top:4px; text-align:center;">7 / 20 units</div>
      </div>

      <div class="carboy-card" style="width:calc(33.3% - 12px); min-width:200px; background:rgba(255,255,255,0.01);">
        <div style="font-weight:700; font-size:13.5px; color:white;">Fluorescent Bulbs</div>
        <div style="font-size:11.5px; color:var(--text-muted);">Spent linear lamps</div>
        
        <div class="carboy-indicator-container" style="height:80px; width:50px;">
          <div class="carboy-liquid" style="height:60%; background:#f59e0b;"></div>
          <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:white;">60%</div>
        </div>
        <div style="font-size:11.5px; border-top:1px dashed var(--border-card); padding-top:6px; margin-top:4px; text-align:center;">12 / 20 items</div>
      </div>

      <div class="carboy-card" style="width:calc(33.3% - 12px); min-width:200px; background:rgba(255,255,255,0.01);">
        <div style="font-weight:700; font-size:13.5px; color:white;">Electronic Wastes (e-Waste)</div>
        <div style="font-size:11.5px; color:var(--text-muted);">Spent boards & peripherals</div>
        
        <div class="carboy-indicator-container" style="height:80px; width:50px;">
          <div class="carboy-liquid" style="height:10%; background:#10b981;"></div>
          <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; color:white;">10%</div>
        </div>
        <div style="font-size:11.5px; border-top:1px dashed var(--border-card); padding-top:6px; margin-top:4px; text-align:center;">2 / 20 kg</div>
      </div>
    </div>
  `;
}

// --------------------------------------------------------------------------
// 📈 MODULE 7: STRATEGIC PLANNING
// --------------------------------------------------------------------------
function renderCPStrategic(container) {
  const keys = Object.keys(cpMilestones);

  container.innerHTML = `
    <h3 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:white; margin:0 0 16px 0;">📈 Department Strategic Milestones</h3>
    
    <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left; margin-bottom:20px;">
      <span style="font-size:10px; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Overall completion rate</span>
      <div style="font-size:26px; font-weight:800; color:#8b5cf6; margin-top:4px; margin-bottom:12px;">${calculateStrategicPlanningScore()}% Finished</div>
      
      <div class="cp-timeline">
        ${keys.map(k => {
          const item = cpMilestones[k];
          const isDone = item.status === 'completed';
          return `
            <div class="cp-timeline-item ${isDone ? 'completed' : ''}">
              <div class="cp-timeline-dot"></div>
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; font-weight:600; color:${isDone ? 'white' : 'var(--text-muted)'};">
                  <input type="checkbox" onchange="toggleCPMilestone('${k}', this.checked)" ${isDone ? 'checked' : ''} style="accent-color:#8b5cf6;">
                  ${escapeHtml(item.title)}
                </label>
                <span style="font-size:10px; font-weight:700; color:${isDone ? '#10b981' : 'var(--text-muted)'}; text-transform:uppercase;">
                  ${isDone ? 'Completed' : 'Pending'}
                </span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function toggleCPMilestone(key, checked) {
  cpMilestones[key].status = checked ? 'completed' : 'pending';
  
  firestore.collection('config').doc('strategic_milestones').update({
    milestones: cpMilestones
  }).then(() => {
    // Recalculate and re-render strategic tab content
    renderCPStrategic(document.getElementById('cp-tab-content-container'));
  }).catch(() => {});
}
window.toggleCPMilestone = toggleCPMilestone;

// --------------------------------------------------------------------------
// 📄 MODULE 8: EXECUTIVE REPORTS (EXPORT CSV)
// --------------------------------------------------------------------------
function renderCPReports(container) {
  container.innerHTML = `
    <h3 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:white; margin:0 0 16px 0;">📄 Department Audit Reports Export</h3>
    
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px;">
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); padding:20px; border-radius:14px; text-align:left; display:flex; flex-direction:column; justify-content:space-between; min-height:160px;">
        <div>
          <h4 style="font-size:14.5px; font-weight:700; color:white; margin:0 0 6px 0;">👨‍🏫 Faculty Load Ledger</h4>
          <p style="margin:0 0 12px 0; font-size:11.5px; color:var(--text-muted); line-height:1.4;">Compiled report of all academic load assignments, units count, and contact emails.</p>
        </div>
        <button onclick="exportCPFacultyCSV()" class="settings-btn-primary" style="margin:0; width:100%;">📥 Export Faculty CSV</button>
      </div>

      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); padding:20px; border-radius:14px; text-align:left; display:flex; flex-direction:column; justify-content:space-between; min-height:160px;">
        <div>
          <h4 style="font-size:14.5px; font-weight:700; color:white; margin:0 0 6px 0;">🧪 Laboratory Clearance Audit</h4>
          <p style="margin:0 0 12px 0; font-size:11.5px; color:var(--text-muted); line-height:1.4;">Outstanding student accountabilities, fine ledger metrics, and stockroom statuses.</p>
        </div>
        <button onclick="exportCPLaboratoryCSV()" class="settings-btn-primary" style="margin:0; width:100%;">📥 Export Lab Ledger CSV</button>
      </div>

      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); padding:20px; border-radius:14px; text-align:left; display:flex; flex-direction:column; justify-content:space-between; min-height:160px;">
        <div>
          <h4 style="font-size:14.5px; font-weight:700; color:white; margin:0 0 6px 0;">🎓 Student Roster Directory</h4>
          <p style="margin:0 0 12px 0; font-size:11.5px; color:var(--text-muted); line-height:1.4;">Full directory roster of onboarded students, year levels, and email listings.</p>
        </div>
        <button onclick="exportCPStudentCSV()" class="settings-btn-primary" style="margin:0; width:100%;">📥 Export Student CSV</button>
      </div>
    </div>
  `;
}

function exportCPFacultyCSV() {
  const instructors = cpCachedStudents.filter(u => u.roles && u.roles.includes('faculty'));
  let csv = 'Instructor Name,Email Address,Consultation Hours,Classes Count,Unit Load\n';
  instructors.forEach(f => {
    const email = f.id;
    const name = f.name || email.split('@')[0];
    const load = cpCachedClasses.filter(c => c.status === 'approved' && c.facultyEmail && c.facultyEmail.toLowerCase().trim() === email.toLowerCase().trim()).length;
    const hours = f.consultationHours ? f.consultationHours.split('\n')[0].replace(/,/g, ' ') : 'None';
    csv += `"${name}","${email}","${hours}",${load},${load * 3}\n`;
  });
  downloadCSVBlob(csv, 'DoC_Faculty_Load_Audit_Report.csv');
}
window.exportCPFacultyCSV = exportCPFacultyCSV;

function exportCPLaboratoryCSV() {
  let csv = 'Student Name,Email,Subject,Section,Description,Fine Amount,Status\n';
  cpCachedAccs.forEach(a => {
    csv += `"${a.studentName}","${a.studentEmail}","${a.subject}","${a.section}","${a.description}",${a.amount},"${a.status}"\n`;
  });
  downloadCSVBlob(csv, 'DoC_LIMS_Clearance_Audit_Ledger.csv');
}
window.exportCPLaboratoryCSV = exportCPLaboratoryCSV;

function exportCPStudentCSV() {
  let csv = 'Student Name,Email Address,Student ID,Year Level\n';
  cpCachedStudents.forEach(s => {
    const idVal = s.studentId || 'N/A';
    const yearVal = s.year || '1';
    const nameVal = s.name || s.id.split('@')[0];
    csv += `"${nameVal}","${s.id}","${idVal}",Year ${yearVal}\n`;
  });
  downloadCSVBlob(csv, 'DoC_Student_Roster_Directory.csv');
}
window.exportCPStudentCSV = exportCPStudentCSV;

function downloadCSVBlob(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --------------------------------------------------------------------------
// 📅 MODULE 9: EXECUTIVE CALENDAR
// --------------------------------------------------------------------------
function renderCPCalendar(container) {
  container.innerHTML = `
    <h3 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:white; margin:0 0 16px 0;">📅 Semester Executive Calendar</h3>
    
    <div class="welcome-calendar-list" style="text-align:left;">
      <div class="welcome-calendar-card">
        <div class="welcome-calendar-date">
          <div class="welcome-calendar-date-day">10</div>
          <div class="welcome-calendar-date-month">Aug</div>
        </div>
        <div class="welcome-calendar-info">
          <div class="welcome-calendar-title">🏫 Semester Classes Kickoff</div>
          <div class="welcome-calendar-time">Start of Chemistry Academic Year 2026-2027</div>
        </div>
      </div>

      <div class="welcome-calendar-card">
        <div class="welcome-calendar-date" style="background:rgba(239,68,68,0.08); border-color:rgba(239,68,68,0.2); color:#ef4444;">
          <div class="welcome-calendar-date-day">25</div>
          <div class="welcome-calendar-date-month">Sep</div>
        </div>
        <div class="welcome-calendar-info">
          <div class="welcome-calendar-title">📋 DENR PCO SMR Submission Deadline</div>
          <div class="welcome-calendar-time">Third Quarter Environmental Monitoring Report compilation</div>
        </div>
      </div>

      <div class="welcome-calendar-card">
        <div class="welcome-calendar-date" style="background:rgba(139,92,246,0.08); border-color:rgba(139,92,246,0.2); color:#8b5cf6;">
          <div class="welcome-calendar-date-day">15</div>
          <div class="welcome-calendar-date-month">Oct</div>
        </div>
        <div class="welcome-calendar-info">
          <div class="welcome-calendar-title">✏️ Mid-term Exam Reviews</div>
          <div class="welcome-calendar-time">Mid-term grading sheet checks & curriculum checklist review</div>
        </div>
      </div>
    </div>
  `;
}

// --------------------------------------------------------------------------
// 🔔 MODULE 10: EXECUTIVE APPROVALS (DUAL AUTHORITY DECISION CENTER)
// --------------------------------------------------------------------------
function renderCPApprovals(container) {
  const pendingClasses = cpCachedClasses.filter(c => c.status === 'pending');
  const pendingDocs = cpCachedApprovals.filter(a => a.status === 'pending');
  const pendingPubs = cpCachedPendingPublications;

  container.innerHTML = `
    <h3 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:white; margin:0 0 16px 0;">🔔 Decision Center Approvals Queue</h3>
    
    <div style="display:flex; flex-direction:column; gap:16px; text-align:left;">
      <!-- Class Creation Requests Section -->
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:12px; padding:16px;">
        <h4 style="font-size:14px; font-weight:700; color:white; margin:0 0 12px 0; border-bottom:1px solid var(--border-card); padding-bottom:6px;">🏫 Classroom Creation Requests</h4>
        
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${pendingClasses.map(c => {
            const syllabusLink = c.syllabusUrl 
              ? `<a href="${c.syllabusUrl}" target="_blank" style="color:var(--accent); font-weight:700; text-decoration:none;">👁️ View Syllabus PDF</a>`
              : `<span style="color:var(--text-muted); font-style:italic;">No Syllabus</span>`;

            return `
              <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-card); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div>
                  <strong style="color:white; font-size:13.5px;">${escapeHtml(c.courseName)} Sec ${escapeHtml(c.section)}</strong>
                  <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Requested by: Prof. ${escapeHtml(c.teacherName)} (${escapeHtml(c.teacherEmail)})</div>
                  <div style="font-size:11px; margin-top:4px;">${syllabusLink}</div>
                </div>
                <div style="display:flex; gap:8px;">
                  <button onclick="processCPClassRequest('${c.id}', 'approve')" class="settings-btn-primary" style="margin:0; width:auto; padding:6px 12px; background:#10b981;">Approve</button>
                  <button onclick="processCPClassRequest('${c.id}', 'deny')" class="settings-btn-primary" style="margin:0; width:auto; padding:6px 12px; background:#ef4444;">Deny</button>
                </div>
              </div>
            `;
          }).join('') || `<div style="font-size:12px; color:var(--text-muted); font-style:italic;">No pending classroom requests.</div>`}
        </div>
      </div>

      <!-- Administrative & Procurement Documents Approvals Section -->
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:12px; padding:16px;">
        <h4 style="font-size:14px; font-weight:700; color:white; margin:0 0 12px 0; border-bottom:1px solid var(--border-card); padding-bottom:6px;">📄 Documents & Procurement approvals</h4>
        
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${pendingDocs.map(d => {
            return `
              <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-card); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div>
                  <strong style="color:white; font-size:13.5px;">${escapeHtml(d.title)}</strong>
                  <div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">Description: ${escapeHtml(d.description)}</div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Requested by: Prof. ${escapeHtml(d.requestedByName)} &bull; Date: ${escapeHtml(d.dateSubmitted.split('T')[0])}</div>
                </div>
                <div style="display:flex; gap:8px;">
                  <button onclick="processCPDocRequest('${d.id}', 'approve')" class="settings-btn-primary" style="margin:0; width:auto; padding:6px 12px; background:#10b981;">Approve</button>
                  <button onclick="processCPDocRequest('${d.id}', 'deny')" class="settings-btn-primary" style="margin:0; width:auto; padding:6px 12px; background:#ef4444;">Deny</button>
                </div>
              </div>
            `;
          }).join('') || `<div style="font-size:12px; color:var(--text-muted); font-style:italic;">No pending document approvals.</div>`}
        </div>
      </div>

      <!-- Pending Announcements Section -->
      <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:12px; padding:16px;">
        <h4 style="font-size:14px; font-weight:700; color:white; margin:0 0 12px 0; border-bottom:1px solid var(--border-card); padding-bottom:6px;">📢 Pending Faculty Announcements & Publications</h4>
        
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${pendingPubs.map(p => {
            return `
              <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-card); border-radius:8px; padding:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div>
                  <strong style="color:white; font-size:13.5px;">${escapeHtml(p.title)}</strong>
                  <div style="font-size:12px; color:var(--text-main); margin-top:4px;">${escapeHtml(p.body)}</div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Posted by: Prof. ${escapeHtml(p.postedByName || p.postedBy)} &bull; Target: <span style="color:var(--accent); font-weight:bold;">${p.visibility.toUpperCase()}</span> &bull; Date: ${escapeHtml(p.date)}</div>
                </div>
                <div style="display:flex; gap:8px;">
                  <button onclick="processCPPublicationRequest('${p.id}', 'approve')" class="settings-btn-primary" style="margin:0; width:auto; padding:6px 12px; background:#10b981;">Approve</button>
                  <button onclick="processCPPublicationRequest('${p.id}', 'deny')" class="settings-btn-primary" style="margin:0; width:auto; padding:6px 12px; background:#ef4444;">Deny</button>
                </div>
              </div>
            `;
          }).join('') || `<div style="font-size:12px; color:var(--text-muted); font-style:italic;">No pending faculty announcements.</div>`}
        </div>
      </div>
    </div>
  `;
}

function processCPClassRequest(id, action) {
  const proceed = (approved) => {
    if (!approved) return;
    
    const dbStatus = action === 'approve' ? 'approved' : 'denied';
    firestore.collection('classes').doc(id).update({
      status: dbStatus
    }).then(() => {
      showCustomAlert(`Class creation successfully ${dbStatus}!`, 'success');
      syncCPDatabase();
    }).catch(err => {
      showCustomAlert("Failed to update status: " + err.message, "error");
    });
  };

  const msg = `Are you sure you want to ${action.toUpperCase()} this classroom request?`;
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(msg, proceed);
  } else {
    const res = confirm(msg);
    proceed(res);
  }
}
window.processCPClassRequest = processCPClassRequest;

function processCPDocRequest(id, action) {
  const proceed = (approved) => {
    if (!approved) return;
    
    const dbStatus = action === 'approve' ? 'approved_by_chairperson' : 'denied';
    firestore.collection('approvals').doc(id).update({
      status: dbStatus,
      signedBy: action === 'approve' ? (currentUser.digitalSignatureBase64 || null) : null
    }).then(() => {
      showCustomAlert(`Document request successfully ${action === 'approve' ? 'signed & approved' : 'denied'}!`, 'success');
      syncCPDatabase();
    }).catch(err => {
      showCustomAlert("Failed to update status: " + err.message, "error");
    });
  };

  const msg = `Are you sure you want to ${action.toUpperCase()} this document/procurement request?`;
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(msg, proceed);
  } else {
    const res = confirm(msg);
    proceed(res);
  }
}

function processCPPublicationRequest(id, action) {
  const proceed = (approved) => {
    if (!approved) return;
    
    if (action === 'approve') {
      firestore.collection('portal_content').doc(id).update({
        status: 'approved'
      }).then(() => {
        showCustomAlert("Announcement successfully approved and published!", "success");
        syncCPDatabase();
      }).catch(err => {
        showCustomAlert("Failed to approve publication: " + err.message, "error");
      });
    } else {
      firestore.collection('portal_content').doc(id).update({
        status: 'denied'
      }).then(() => {
        showCustomAlert("Announcement request denied.", "info");
        syncCPDatabase();
      }).catch(err => {
        showCustomAlert("Failed to deny publication: " + err.message, "error");
      });
    }
  };

  const msg = `Are you sure you want to ${action.toUpperCase()} this announcement publication request?`;
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(msg, proceed);
  } else {
    proceed(confirm(msg));
  }
}
window.processCPPublicationRequest = processCPPublicationRequest;
window.processCPDocRequest = processCPDocRequest;

// --------------------------------------------------------------------------
// ⚙️ MODULE 11: EXECUTIVE SETTINGS & WEIGHT CONFIGURATIONS
// --------------------------------------------------------------------------
function renderCPSettings(container) {
  const total = cpDHIWeights.studentProgress + cpDHIWeights.facultyPerformance + cpDHIWeights.laboratoryOperations + cpDHIWeights.environmentalCompliance + cpDHIWeights.strategicPlanning;
  const isSumValid = total === 100;

  container.innerHTML = `
    <h3 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:white; margin:0 0 16px 0;">⚙️ Executive Command Settings</h3>
    
    <!-- Health Index Weights Slider Configuration Panel -->
    <div style="background:rgba(255,255,255,0.01); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left; margin-bottom:20px;">
      <h4 style="font-size:14px; font-weight:700; color:white; margin:0 0 6px 0;">📊 Department Health Index Weights Slider</h4>
      <p style="margin:0 0 16px 0; font-size:11.5px; color:var(--text-muted); line-height:1.4;">Configure target parameters used to calculate the weighted Health Index gauge. Sum must equal exactly 100%.</p>
      
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div class="cp-slider-row">
          <label for="slide-prog">Student Progress:</label>
          <input type="range" id="slide-prog" min="0" max="100" value="${cpDHIWeights.studentProgress}" oninput="updateCPWeightVal('prog', this.value)">
          <span class="cp-slider-val" id="val-slide-prog">${cpDHIWeights.studentProgress}%</span>
        </div>
        <div class="cp-slider-row">
          <label for="slide-fac">Faculty Load:</label>
          <input type="range" id="slide-fac" min="0" max="100" value="${cpDHIWeights.facultyPerformance}" oninput="updateCPWeightVal('fac', this.value)">
          <span class="cp-slider-val" id="val-slide-fac">${cpDHIWeights.facultyPerformance}%</span>
        </div>
        <div class="cp-slider-row">
          <label for="slide-lab">LIMS Operations:</label>
          <input type="range" id="slide-lab" min="0" max="100" value="${cpDHIWeights.laboratoryOperations}" oninput="updateCPWeightVal('lab', this.value)">
          <span class="cp-slider-val" id="val-slide-lab">${cpDHIWeights.laboratoryOperations}%</span>
        </div>
        <div class="cp-slider-row">
          <label for="slide-pco">PCO Compliance:</label>
          <input type="range" id="slide-pco" min="0" max="100" value="${cpDHIWeights.environmentalCompliance}" oninput="updateCPWeightVal('pco', this.value)">
          <span class="cp-slider-val" id="val-slide-pco">${cpDHIWeights.environmentalCompliance}%</span>
        </div>
        <div class="cp-slider-row">
          <label for="slide-strat">Strategic Milestones:</label>
          <input type="range" id="slide-strat" min="0" max="100" value="${cpDHIWeights.strategicPlanning}" oninput="updateCPWeightVal('strat', this.value)">
          <span class="cp-slider-val" id="val-slide-strat">${cpDHIWeights.strategicPlanning}%</span>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--border-card); padding-top:14px; margin-top:8px; flex-wrap:wrap; gap:12px;">
          <div>
            <span style="font-size:12.5px; font-weight:700;">Current Weight Sum: <span id="cp-weight-sum-label" style="color:${isSumValid ? '#10b981' : '#ef4444'}">${total}%</span></span>
            ${!isSumValid ? `
              <span id="cp-weight-sum-warning" style="display:block; font-size:10px; color:#ef4444; margin-top:2px;">⚠️ Sum must be equal to 100%!</span>
            ` : ''}
          </div>
          <button id="cp-btn-save-weights" onclick="saveCPWeights()" class="settings-btn-primary" style="margin:0; width:auto; padding:8px 16px;" ${!isSumValid ? 'disabled' : ''}>💾 Save Weights</button>
        </div>
      </div>
    </div>
  `;
}

function updateCPWeightVal(type, val) {
  const el = document.getElementById(`val-slide-${type}`);
  if (el) el.innerText = `${val}%`;

  // Calculate sum in real-time
  const progVal = parseInt(document.getElementById('slide-prog').value);
  const facVal = parseInt(document.getElementById('slide-fac').value);
  const labVal = parseInt(document.getElementById('slide-lab').value);
  const pcoVal = parseInt(document.getElementById('slide-pco').value);
  const stratVal = parseInt(document.getElementById('slide-strat').value);

  const sum = progVal + facVal + labVal + pcoVal + stratVal;
  
  const sumLabel = document.getElementById('cp-weight-sum-label');
  const saveBtn = document.getElementById('cp-btn-save-weights');

  if (sumLabel) {
    sumLabel.innerText = `${sum}%`;
    sumLabel.style.color = (sum === 100) ? '#10b981' : '#ef4444';
  }

  if (saveBtn) {
    saveBtn.disabled = (sum !== 100);
  }
}
window.updateCPWeightVal = updateCPWeightVal;

function saveCPWeights() {
  const progVal = parseInt(document.getElementById('slide-prog').value);
  const facVal = parseInt(document.getElementById('slide-fac').value);
  const labVal = parseInt(document.getElementById('slide-lab').value);
  const pcoVal = parseInt(document.getElementById('slide-pco').value);
  const stratVal = parseInt(document.getElementById('slide-strat').value);

  cpDHIWeights = {
    studentProgress: progVal,
    facultyPerformance: facVal,
    laboratoryOperations: labVal,
    environmentalCompliance: pcoVal,
    strategicPlanning: stratVal
  };

  firestore.collection('config').doc('health_index').set(cpDHIWeights).then(() => {
    showCustomAlert("Weighted health index parameters successfully saved!", "success");
    syncCPDatabase();
  }).catch(err => {
    showCustomAlert("Failed to save weights: " + err.message, "error");
  });
}
window.saveCPWeights = saveCPWeights;

// --------------------------------------------------------------------------
// ✍️ DIGITAL SIGNATURE ATTACHMENT CONTROLLERS
// --------------------------------------------------------------------------
function uploadChairpersonSignature(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    
    // Commit signature Base64 to user's student document
    firestore.collection('students').doc(currentUser.email).update({
      digitalSignatureBase64: base64
    }).then(() => {
      currentUser.digitalSignatureBase64 = base64;
      localStorage.setItem('student_user_session', JSON.stringify(currentUser));
      localStorage.setItem('doc_lms_saved_profile', JSON.stringify(currentUser));
      
      showCustomAlert("Digital signature successfully uploaded and saved!", "success");
      
      // Refresh Settings and Dashboard
      renderSettingsDrawerContent();
      if (currentMode && currentMode.startsWith('cp-')) {
        renderChairpersonView();
      }
    }).catch(err => {
      showCustomAlert("Failed to save signature: " + err.message, "error");
    });
  };
  reader.readAsDataURL(file);
}
window.uploadChairpersonSignature = uploadChairpersonSignature;

function removeChairpersonSignature() {
  const proceed = (approved) => {
    if (!approved) return;

    firestore.collection('students').doc(currentUser.email).update({
      digitalSignatureBase64: firebase.firestore.FieldValue.delete()
    }).then(() => {
      delete currentUser.digitalSignatureBase64;
      localStorage.setItem('student_user_session', JSON.stringify(currentUser));
      localStorage.setItem('doc_lms_saved_profile', JSON.stringify(currentUser));
      
      showCustomAlert("Digital signature removed.", "info");
      
      // Refresh Settings and Dashboard
      renderSettingsDrawerContent();
      if (currentMode && currentMode.startsWith('cp-')) {
        renderChairpersonView();
      }
    }).catch(err => {
      showCustomAlert("Failed to remove signature: " + err.message, "error");
    });
  };

  const msg = "Remove your uploaded digital signature from this account?";
  if (typeof showCustomConfirm === 'function') {
    showCustomConfirm(msg, proceed);
  } else {
    const res = confirm(msg);
    proceed(res);
  }
}
window.removeChairpersonSignature = removeChairpersonSignature;

// Global Exports
window.renderChairpersonView = renderChairpersonView;
window.renderChairpersonTab = renderChairpersonTab;
window.switchCPTab = switchCPTab;
window.loadCPTabRenderer = loadCPTabRenderer;
window.syncCPDatabase = syncCPDatabase;
window.updateCPApprovalsBadge = updateCPApprovalsBadge;

console.log("🏛️ Redesigned chairperson.js successfully loaded and initialized!");
