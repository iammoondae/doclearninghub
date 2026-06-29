// ==========================================================================
// 🧪 CHEMISTRY STOCKROOM LIMS CORE MODULES - IMPLEMENTATION
// ==========================================================================
let activeLimsTransactionFilter = 'all';
let limsTransactionSearchQuery = '';
let loadedLimsTransactions = [];

let limsStudentSearchQuery = '';
let activeLimsSelectedStudentEmail = null;
let loadedLimsStudents = [];

let generatedReportRows = [];
let generatedReportCategory = '';

function runFirestoreMigration() {
  if (localStorage.getItem('firestore_migration_done_v2') === 'true') {
    return;
  }
  
  console.log("Starting client-side Firestore collection migration...");
  
  firestore.collection('requisitions').get()
    .then(snapshot => {
      const batch = firestore.batch();
      let count = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        let changed = false;
        const updateData = {};
        
        // Old 'returned' (returned to student for revision) -> 'returned_for_revision'
        if (data.status === 'returned') {
          updateData.status = 'returned_for_revision';
          changed = true;
        }
        // Old 'cleared' (requisition cleared) -> 'completed'
        else if (data.status === 'cleared') {
          updateData.status = 'completed';
          changed = true;
        }
        
        if (changed) {
          batch.update(doc.ref, updateData);
          count++;
        }
      });
      
      if (count > 0) {
        return batch.commit().then(() => {
          console.log(`Successfully migrated ${count} requisition records.`);
        });
      } else {
        console.log("No requisitions needed migration.");
      }
    })
    .then(() => {
      localStorage.setItem('firestore_migration_done_v2', 'true');
      console.log("Firestore migration marked as complete.");
    })
    .catch(err => {
      console.error("Firestore migration failed:", err);
    });
}

function getDefaultSemester() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  if (year < 2026 || (year === 2026 && month < 8)) {
    return "AY2026-2027, First Semester";
  }
  let ayStart = year;
  let term = "First Semester";
  if (month >= 8) {
    ayStart = year;
    term = "First Semester";
  } else if (month >= 1 && month <= 5) {
    ayStart = year - 1;
    term = "Second Semester";
  } else {
    ayStart = year - 1;
    term = "Summer Semester";
  }
  return `AY${ayStart}-${ayStart + 1}, ${term}`;
}

function openActionDrawer(title, bodyHTML, footerHTML) {
  const overlay = document.getElementById('action-drawer-overlay');
  const drawer = document.getElementById('action-drawer');
  const elTitle = document.getElementById('action-drawer-title');
  const elBody = document.getElementById('action-drawer-body');
  const elFooter = document.getElementById('action-drawer-footer');

  if (!overlay || !drawer) return;

  if (elTitle) elTitle.innerText = title;
  if (elBody) elBody.innerHTML = bodyHTML || '';
  if (elFooter) elFooter.innerHTML = footerHTML || '';

  overlay.classList.add('active');
  drawer.classList.add('active');
}

function closeActionDrawer() {
  const overlay = document.getElementById('action-drawer-overlay');
  const drawer = document.getElementById('action-drawer');
  if (overlay) overlay.classList.remove('active');
  if (drawer) drawer.classList.remove('active');
}

// 1. TRANSACTIONS VIEW AND LOGIC
// --------------------------------------------------------------------------
function renderLabTransactionsView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <div class="home-greeting-card" style="padding: 24px; background: rgba(13,148,136,0.05); border: 1px solid rgba(13,148,136,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
      <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--accent); margin: 0 0 8px 0;">📋 Transactions Management</h2>
      <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Process requisitions, track active borrowings, and sign off lab clearance certificates.</p>
    </div>

    <!-- Double Pane Layout -->
    <div style="display: grid; grid-template-columns: 360px 1fr; gap: 20px; text-align: left;">
      
      <!-- Left Pane: Search, Status, and Transactions List -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 14px; max-height: calc(100vh - 250px); overflow-y: auto;">
        
        <!-- Search bar -->
        <div style="position: relative;">
          <input type="text" id="lims-tx-search" class="lims-search-input" placeholder="Search group name, course..." value="${escapeHtml(limsTransactionSearchQuery)}" oninput="updateLimsTransactionSearch(this.value)" style="width: 100%; box-sizing: border-box; padding-left: 36px;">
          <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; opacity: 0.6;">🔍</span>
        </div>

        <!-- Filter Selector -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <label style="font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Filter Status:</label>
          <select id="lims-tx-filter" onchange="updateLimsTransactionFilter(this.value)" style="padding: 10px; border-radius: 8px; border: 1px solid var(--border-card); background: var(--bg-body); color: var(--text-main); font-size: 13px; font-weight: 600; cursor: pointer; outline: none; width: 100%;">
            <option value="all" ${activeLimsTransactionFilter === 'all' ? 'selected' : ''}>All Transactions</option>
            <option value="pending" ${activeLimsTransactionFilter === 'pending' ? 'selected' : ''}>⏳ Awaiting Approval</option>
            <option value="approved" ${activeLimsTransactionFilter === 'approved' ? 'selected' : ''}>📦 Approved (Awaiting Release)</option>
            <option value="borrowed" ${activeLimsTransactionFilter === 'borrowed' ? 'selected' : ''}>🧪 Borrowed (Session Active)</option>
            <option value="returned" ${activeLimsTransactionFilter === 'returned' ? 'selected' : ''}>⏰ Returned (Awaiting Clearance)</option>
            <option value="completed" ${activeLimsTransactionFilter === 'completed' ? 'selected' : ''}>✅ Completed / Cleared</option>
            <option value="returned_for_revision" ${activeLimsTransactionFilter === 'returned_for_revision' ? 'selected' : ''}>⚠️ Returned for Revision</option>
          </select>
        </div>

        <!-- List Container -->
        <div id="lims-tx-list-container" style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
          <div class="empty-playlist-msg" style="padding: 20px;">Loading list...</div>
        </div>
      </div>

      <!-- Right Pane: Details & Timeline Operations -->
      <div id="lims-tx-detail-container" style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 24px; min-height: 450px;">
        <div class="empty-playlist-msg" style="padding: 80px 20px; text-align: center; color: var(--text-muted);">
          <span style="font-size: 40px; display: block; margin-bottom: 12px;">📋</span>
          Select a transaction from the list to view details and perform operations.
        </div>
      </div>

    </div>
  `;

  loadLimsTransactionsData();
}

function updateLimsTransactionSearch(val) {
  limsTransactionSearchQuery = val;
  filterAndRenderLimsTransactionsList();
}

function updateLimsTransactionFilter(val) {
  activeLimsTransactionFilter = val;
  filterAndRenderLimsTransactionsList();
}

function loadLimsTransactionsData() {
  if (typeof firestore === 'undefined' || !firestore) return;

  firestore.collection('requisitions').get()
    .then(snapshot => {
      loadedLimsTransactions = [];
      snapshot.forEach(doc => {
        loadedLimsTransactions.push({ id: doc.id, ...doc.data() });
      });
      filterAndRenderLimsTransactionsList();
    })
    .catch(err => {
      console.error("Error loading transactions:", err);
      const container = document.getElementById('lims-tx-list-container');
      if (container) {
        container.innerHTML = `<div style="color:var(--incorrect); font-size:13px; text-align:center;">⚠️ Load Failed: ${err.message}</div>`;
      }
    });
}

function filterAndRenderLimsTransactionsList() {
  const container = document.getElementById('lims-tx-list-container');
  if (!container) return;

  let filtered = [...loadedLimsTransactions];

  // Apply search query
  if (limsTransactionSearchQuery.trim()) {
    const q = limsTransactionSearchQuery.toLowerCase().trim();
    filtered = filtered.filter(tx => 
      (tx.groupName && tx.groupName.toLowerCase().includes(q)) ||
      (tx.courseId && tx.courseId.toLowerCase().includes(q)) ||
      (tx.submittedBy && tx.submittedBy.toLowerCase().includes(q))
    );
  }

  // Apply status filter
  if (activeLimsTransactionFilter !== 'all') {
    filtered = filtered.filter(tx => tx.status === activeLimsTransactionFilter);
  }

  // Sort by date/timestamp desc
  filtered.sort((a, b) => {
    const tA = a.timestamp ? (a.timestamp.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime()) : 0;
    const tB = b.timestamp ? (b.timestamp.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime()) : 0;
    return tB - tA;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-playlist-msg" style="padding: 20px; border: 1px dashed var(--border-card); border-radius: 8px;">No matching transactions found.</div>`;
    return;
  }

  container.innerHTML = filtered.map(tx => {
    let badgeBg = 'rgba(255,255,255,0.05)';
    let badgeColor = 'var(--text-muted)';
    
    if (tx.status === 'pending') {
      badgeBg = 'rgba(245,158,11,0.1)';
      badgeColor = '#f59e0b';
    } else if (tx.status === 'approved') {
      badgeBg = 'rgba(59,130,246,0.1)';
      badgeColor = '#3b82f6';
    } else if (tx.status === 'borrowed') {
      badgeBg = 'rgba(168,85,247,0.1)';
      badgeColor = '#a855f7';
    } else if (tx.status === 'returned') {
      badgeBg = 'rgba(236,72,153,0.1)';
      badgeColor = '#ec4899';
    } else if (tx.status === 'completed') {
      badgeBg = 'rgba(16,185,129,0.1)';
      badgeColor = '#10b981';
    } else if (tx.status === 'returned_for_revision') {
      badgeBg = 'rgba(239,68,68,0.1)';
      badgeColor = '#ef4444';
    }

    const dateStr = tx.scheduleDate || 'No date';

    return `
      <div onclick="showLimsTransactionDetails('${tx.id}')" style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:10px; padding:12px; cursor:pointer; display:flex; flex-direction:column; gap:6px; transition:all 0.2s;" class="tx-list-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:700; font-size:13px; color:var(--text-main); font-family:'Outfit',sans-serif;">${escapeHtml(tx.groupName || 'Unassigned Group')}</span>
          <span style="font-size:10px; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:4px; background:${badgeBg}; color:${badgeColor};">${tx.status || 'Unknown'}</span>
        </div>
        <div style="font-size:11.5px; color:var(--text-muted);">
          Subject: <strong>${escapeHtml(tx.courseId ? tx.courseId.toUpperCase() : '')} (Sec ${escapeHtml(tx.section)})</strong>
        </div>
        <div style="font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between; margin-top:2px;">
          <span>📅 ${escapeHtml(dateStr)}</span>
          <span>By: ${escapeHtml(tx.submittedBy ? tx.submittedBy.split('@')[0] : '')}</span>
        </div>
      </div>
    `;
  }).join('');
}

function showLimsTransactionDetails(id) {
  const detailContainer = document.getElementById('lims-tx-detail-container');
  if (!detailContainer) return;

  const tx = loadedLimsTransactions.find(t => t.id === id);
  if (!tx) return;

  // Render items lists
  let chemListHTML = `<div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">No chemicals requested.</div>`;
  if (tx.chemicals && tx.chemicals.length > 0) {
    chemListHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
        <thead>
          <tr style="border-bottom:1px dashed var(--border-card); color:var(--text-muted); font-size:10px; text-transform:uppercase;">
            <th style="padding:6px 4px;">Chemical Name</th>
            <th style="padding:6px 4px; width:80px;">Volume</th>
            <th style="padding:6px 4px; width:80px;">Conc.</th>
            ${tx.status === 'borrowed' ? `<th style="padding:6px 4px; text-align:center; width:90px;">Lost/Broken</th>` : ''}
            ${tx.status === 'returned' || tx.status === 'completed' ? `<th style="padding:6px 4px; text-align:center; width:90px;">Obligation</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${tx.chemicals.map((c, i) => {
            let obligCell = '';
            if (tx.status === 'borrowed') {
              obligCell = `<td style="padding:6px 4px; text-align:center;"><input type="checkbox" id="chem-damaged-${i}" style="width:16px; height:16px; cursor:pointer;"></td>`;
            } else if (tx.status === 'returned' || tx.status === 'completed') {
              const wasDamaged = tx.damagedChemicals && tx.damagedChemicals.includes(i);
              obligCell = `<td style="padding:6px 4px; text-align:center; font-weight:700; color:${wasDamaged ? 'var(--incorrect)' : 'var(--correct)'};">${wasDamaged ? '❌ Lost/Broken' : '✅ Clear'}</td>`;
            }
            return `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                <td style="padding:6px 4px; color:var(--text-main); font-weight:600;">${escapeHtml(c.name)}</td>
                <td style="padding:6px 4px; color:var(--text-muted);">${escapeHtml(c.volume)}</td>
                <td style="padding:6px 4px; color:var(--text-muted);">${escapeHtml(c.concentration)}</td>
                ${obligCell}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  let matListHTML = `<div style="font-size:12.5px; color:var(--text-muted); font-style:italic;">No glassware or materials requested.</div>`;
  if (tx.materials && tx.materials.length > 0) {
    matListHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
        <thead>
          <tr style="border-bottom:1px dashed var(--border-card); color:var(--text-muted); font-size:10px; text-transform:uppercase;">
            <th style="padding:6px 4px;">Material/Glassware</th>
            <th style="padding:6px 4px; width:70px;">Quantity</th>
            ${tx.status === 'borrowed' ? `<th style="padding:6px 4px; text-align:center; width:90px;">Lost/Broken</th>` : ''}
            ${tx.status === 'returned' || tx.status === 'completed' ? `<th style="padding:6px 4px; text-align:center; width:90px;">Obligation</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${tx.materials.map((m, i) => {
            let obligCell = '';
            if (tx.status === 'borrowed') {
              obligCell = `<td style="padding:6px 4px; text-align:center;"><input type="checkbox" id="mat-damaged-${i}" style="width:16px; height:16px; cursor:pointer;"></td>`;
            } else if (tx.status === 'returned' || tx.status === 'completed') {
              const wasDamaged = tx.damagedMaterials && tx.damagedMaterials.includes(i);
              obligCell = `<td style="padding:6px 4px; text-align:center; font-weight:700; color:${wasDamaged ? 'var(--incorrect)' : 'var(--correct)'};">${wasDamaged ? '❌ Lost/Broken' : '✅ Clear'}</td>`;
            }
            return `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                <td style="padding:6px 4px; color:var(--text-main); font-weight:600;">${escapeHtml(m.name)}</td>
                <td style="padding:6px 4px; color:var(--text-muted);">${m.quantity}</td>
                ${obligCell}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // Stepper Timeline states
  const steps = [
    { key: 'pending', title: 'Submitted', desc: 'Request sent by student' },
    { key: 'approved', title: 'Approved', desc: 'Custodian approved request' },
    { key: 'borrowed', title: 'Issued', desc: 'Items out in laboratory' },
    { key: 'returned', title: 'Returned', desc: 'Glassware received back' },
    { key: 'completed', title: 'Completed', desc: 'Clearance finalized' }
  ];

  let currentStepIdx = 0;
  if (tx.status === 'approved') currentStepIdx = 1;
  else if (tx.status === 'borrowed') currentStepIdx = 2;
  else if (tx.status === 'returned') currentStepIdx = 3;
  else if (tx.status === 'completed') currentStepIdx = 4;
  else if (tx.status === 'returned_for_revision') currentStepIdx = 0;

  const timelineHTML = `
    <div class="lims-timeline">
      ${steps.map((st, idx) => {
        const isActive = idx <= currentStepIdx;
        const isCurrent = idx === currentStepIdx;
        const bold = isCurrent ? 'font-weight:700; color:var(--text-main);' : '';
        return `
          <div class="lims-timeline-item ${isActive ? 'active' : ''}">
            <div class="lims-timeline-title" style="${bold}">${st.title}</div>
            <div class="lims-timeline-desc">${st.desc}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Action Buttons Section
  let actionButtonsHTML = '';
  if (tx.status === 'pending') {
    actionButtonsHTML = `
      <div style="display:flex; flex-direction:column; gap:12px; width:100%;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Remarks for Revision (if returning):</label>
          <input type="text" id="tx-remarks-input" placeholder="e.g. Please clarify chemical volume requested..." style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; box-sizing:border-box;">
        </div>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button class="settings-btn-primary" onclick="returnLimsForRevision('${tx.id}')" style="width:auto; margin:0; padding:10px 18px; font-size:13px; font-weight:600; background:#ef4444;">⚠️ Return for Revision</button>
          <button class="settings-btn-primary" onclick="approveLimsTransaction('${tx.id}')" style="width:auto; margin:0; padding:10px 18px; font-size:13px; font-weight:600; background:#10b981;">✅ Approve Requisition</button>
        </div>
      </div>
    `;
  } else if (tx.status === 'approved') {
    actionButtonsHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:12px;">
        <span style="font-size:12.5px; color:var(--text-muted);">Ready to release glasswares to student group.</span>
        <button class="settings-btn-primary" onclick="releaseLimsTransaction('${tx.id}')" style="width:auto; margin:0; padding:10px 20px; font-size:13px; font-weight:600; background:#3b82f6;">📦 Release Items to Group</button>
      </div>
    `;
  } else if (tx.status === 'borrowed') {
    actionButtonsHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:12px;">
        <span style="font-size:12.5px; color:var(--text-muted);">Flag any items that are broken or lost before receiving returns.</span>
        <button class="settings-btn-primary" onclick="receiveLimsTransaction('${tx.id}')" style="width:auto; margin:0; padding:10px 20px; font-size:13px; font-weight:600; background:#ec4899;">🧪 Receive Returns Check</button>
      </div>
    `;
  } else if (tx.status === 'returned') {
    actionButtonsHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:12px;">
        <span style="font-size:12.5px; color:var(--text-muted);">Review return receipts. Finalizing clearance registers obligations.</span>
        <button class="settings-btn-primary" onclick="finalizeLimsClearance('${tx.id}')" style="width:auto; margin:0; padding:10px 20px; font-size:13px; font-weight:600; background:#10b981;">✅ Finalize Group Clearance</button>
      </div>
    `;
  } else if (tx.status === 'completed') {
    actionButtonsHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:12px;">
        <span style="font-size:12.5px; color:var(--text-muted); font-weight:600; color:#10b981;">✅ Transaction completed, group is cleared.</span>
        <button class="settings-btn-primary" onclick="revertLimsTransactionStatus('${tx.id}', 'returned')" style="width:auto; margin:0; padding:8px 14px; font-size:11.5px; font-weight:600; background:#6b7280;">✏️ Revert Status</button>
      </div>
    `;
  } else if (tx.status === 'returned_for_revision') {
    actionButtonsHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; flex-wrap:wrap; gap:12px;">
        <span style="font-size:12.5px; color:var(--text-muted);">Student group notified to edit requisition details.</span>
        <button class="settings-btn-primary" onclick="revertLimsTransactionStatus('${tx.id}', 'pending')" style="width:auto; margin:0; padding:8px 14px; font-size:11.5px; font-weight:600; background:#6b7280;">✏️ Put Back in Inbox</button>
      </div>
    `;
  }

  detailContainer.innerHTML = `
    <!-- Top toolbar -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px dashed var(--border-card); padding-bottom:14px; margin-bottom:18px;">
      <div>
        <h3 style="margin:0; font-size:18px; font-weight:800; font-family:'Outfit',sans-serif; color:var(--text-main);">${escapeHtml(tx.groupName || 'Unassigned Group')}</h3>
        <p style="margin:4px 0 0 0; font-size:12px; color:var(--text-muted);">
          Course: <strong>${escapeHtml(tx.courseId ? tx.courseId.toUpperCase() : '')} (Sec ${escapeHtml(tx.section)})</strong> | Faculty: <strong>${escapeHtml(tx.facultyName)}</strong>
        </p>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="settings-btn-primary" onclick="window.print()" style="width:auto; margin:0; padding:8px 12px; font-size:12px; background:rgba(255,255,255,0.06); border:1px solid var(--border-card); color:var(--text-main);">🖨️ Print</button>
      </div>
    </div>

    <!-- Main columns -->
    <div style="display:grid; grid-template-columns: 1fr 240px; gap:20px;">
      
      <!-- Left side: Items & Details -->
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Chemicals Section -->
        <div style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:12px; padding:16px;">
          <h4 style="margin:0 0 10px 0; font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">🧪 Chemicals / Reagents</h4>
          ${chemListHTML}
        </div>

        <!-- Glassware Section -->
        <div style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:12px; padding:16px;">
          <h4 style="margin:0 0 10px 0; font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">🔬 Glasswares & Materials</h4>
          ${matListHTML}
        </div>

        ${tx.unknowns ? `
          <div style="background:rgba(255,255,255,0.01); border-left:3px solid var(--accent); border-radius:6px; padding:12px; font-size:12.5px;">
            <strong>🧪 Unknown Samples / Specifications:</strong>
            <p style="margin:4px 0 0 0; font-family:monospace; color:var(--text-main); white-space:pre-wrap;">${escapeHtml(tx.unknowns)}</p>
          </div>
        ` : ''}

        ${tx.remarks ? `
          <div style="background:rgba(239,68,68,0.02); border-left:3px solid #ef4444; border-radius:6px; padding:12px; font-size:12.5px;">
            <strong style="color:#ef4444;">⚠️ Stockroom Remarks:</strong>
            <p style="margin:4px 0 0 0; color:var(--text-main);">${escapeHtml(tx.remarks)}</p>
          </div>
        ` : ''}

      </div>

      <!-- Right side: Status Stepper Timeline -->
      <div style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:12px;">
        <h4 style="margin:0; font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">📈 Workflow Tracking</h4>
        ${timelineHTML}
      </div>

    </div>

    <!-- Footer Actions panel -->
    <div style="border-top:1px solid var(--border-card); margin-top:20px; padding-top:16px;">
      ${actionButtonsHTML}
    </div>
  `;
}

function approveLimsTransaction(id) {
  if (!confirm("Approve this laboratory requisition?")) return;
  
  firestore.collection('requisitions').doc(id).update({
    status: 'approved',
    approvedBy: currentUser.email,
    approvedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    alert("Requisition approved successfully!");
    loadLimsTransactionsData();
  })
  .catch(err => alert("Error: " + err.message));
}

function returnLimsForRevision(id) {
  const remarks = document.getElementById('tx-remarks-input').value.trim();
  if (!remarks) {
    alert("Please enter a reason/remarks for return.");
    return;
  }

  firestore.collection('requisitions').doc(id).update({
    status: 'returned_for_revision',
    remarks: remarks,
    returnedBy: currentUser.email,
    returnedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    alert("Requisition returned to student for edits.");
    loadLimsTransactionsData();
  })
  .catch(err => alert("Error: " + err.message));
}

function releaseLimsTransaction(id) {
  if (!confirm("Release chemicals and equipment to the student group?")) return;

  firestore.collection('requisitions').doc(id).update({
    status: 'borrowed',
    releasedBy: currentUser.email,
    releasedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    alert("Equipment issued. Session status is now Borrowed.");
    loadLimsTransactionsData();
  })
  .catch(err => alert("Error: " + err.message));
}

function receiveLimsTransaction(id) {
  const tx = loadedLimsTransactions.find(t => t.id === id);
  if (!tx) return;

  const damagedChems = [];
  if (tx.chemicals) {
    tx.chemicals.forEach((c, idx) => {
      const chk = document.getElementById(`chem-damaged-${idx}`);
      if (chk && chk.checked) {
        damagedChems.push(idx);
      }
    });
  }

  const damagedMats = [];
  if (tx.materials) {
    tx.materials.forEach((m, idx) => {
      const chk = document.getElementById(`mat-damaged-${idx}`);
      if (chk && chk.checked) {
        damagedMats.push(idx);
      }
    });
  }

  firestore.collection('requisitions').doc(id).update({
    status: 'returned',
    damagedChemicals: damagedChems,
    damagedMaterials: damagedMats,
    receivedBy: currentUser.email,
    receivedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    alert("Returns received. Requisition status set to Returned.");
    loadLimsTransactionsData();
  })
  .catch(err => alert("Error: " + err.message));
}

function finalizeLimsClearance(id) {
  const tx = loadedLimsTransactions.find(t => t.id === id);
  if (!tx) return;

  const confirmMsg = (tx.damagedChemicals?.length > 0 || tx.damagedMaterials?.length > 0)
    ? "This return contains lost/broken items. Finalizing clearance will automatically log individual accountabilities for all group members. Proceed?"
    : "No lost/broken items recorded. Finalize clearance for this group?";

  if (!confirm(confirmMsg)) return;

  const batch = firestore.batch();
  
  // Update requisition status
  const txRef = firestore.collection('requisitions').doc(id);
  batch.update(txRef, {
    status: 'completed',
    clearedBy: currentUser.email,
    clearedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // Log accountabilities if any item was lost/broken
  const currentSem = getDefaultSemester();
  const damagedChems = tx.damagedChemicals || [];
  const damagedMats = tx.damagedMaterials || [];

  if (damagedChems.length > 0 || damagedMats.length > 0) {
    // Generate descriptions of damages
    const itemsDescription = [];
    damagedChems.forEach(idx => {
      const c = tx.chemicals[idx];
      itemsDescription.push(`Chemical: ${c.name} (${c.volume})`);
    });
    damagedMats.forEach(idx => {
      const m = tx.materials[idx];
      itemsDescription.push(`Glassware: ${m.name} (Qty: ${m.quantity})`);
    });

    const description = "Lost/Broken during lab: " + itemsDescription.join(', ');

    // Register accountability for each student in group
    const studentEmails = tx.studentEmails || [];
    const studentNames = tx.studentNames || [];

    studentEmails.forEach((email, idx) => {
      const sName = studentNames[idx] || email.split('@')[0];
      const accRef = firestore.collection('accountabilities').doc();
      batch.set(accRef, {
        studentEmail: email.toLowerCase().trim(),
        studentName: sName,
        courseId: tx.courseId,
        section: tx.section,
        subject: tx.courseId.toUpperCase(),
        description: description,
        status: 'pending',
        semester: currentSem,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.email,
        requisitionId: id
      });
    });
  }

  batch.commit()
    .then(() => {
      alert("Clearance finalized and accountabilities updated successfully!");
      loadLimsTransactionsData();
    })
    .catch(err => alert("Error: " + err.message));
}

function revertLimsTransactionStatus(id, targetStatus) {
  if (!confirm(`Are you sure you want to revert this transaction's status back to ${targetStatus.toUpperCase()}?`)) return;

  firestore.collection('requisitions').doc(id).update({
    status: targetStatus
  })
  .then(() => {
    alert("Transaction status reverted.");
    loadLimsTransactionsData();
  })
  .catch(err => alert("Error: " + err.message));
}


// 2. STUDENTS DIRECTORY AND PROFILE
// --------------------------------------------------------------------------
function renderLabStudentsView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <div class="home-greeting-card" style="padding: 24px; background: rgba(13,148,136,0.05); border: 1px solid rgba(13,148,136,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
      <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--accent); margin: 0 0 8px 0;">👨‍🎓 Student Obligation Directory</h2>
      <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Manage student clearance records, review pending liability logs, and print clearance stamp sheets.</p>
    </div>

    <!-- Double Pane Layout -->
    <div style="display: grid; grid-template-columns: 360px 1fr; gap: 20px; text-align: left;">
      
      <!-- Left Pane: Search & Students List -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 14px; max-height: calc(100vh - 250px); overflow-y: auto;">
        
        <!-- Search bar -->
        <div style="position: relative;">
          <input type="text" id="lims-std-search" class="lims-search-input" placeholder="Search name or email..." value="${escapeHtml(limsStudentSearchQuery)}" oninput="updateLimsStudentSearch(this.value)" style="width: 100%; box-sizing: border-box; padding-left: 36px;">
          <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; opacity: 0.6;">🔍</span>
        </div>

        <!-- List Container -->
        <div id="lims-std-list-container" style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
          <div class="empty-playlist-msg" style="padding: 20px;">Loading directory...</div>
        </div>
      </div>

      <!-- Right Pane: Details, Clearance status, Liabilities -->
      <div id="lims-std-detail-container" style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 24px; min-height: 450px;">
        <div class="empty-playlist-msg" style="padding: 80px 20px; text-align: center; color: var(--text-muted);">
          <span style="font-size: 40px; display: block; margin-bottom: 12px;">👨‍🎓</span>
          Select a student from the directory to review their clearance logs, active obligations, and history.
        </div>
      </div>

    </div>
  `;

  loadLimsStudentsData();
}

function updateLimsStudentSearch(val) {
  limsStudentSearchQuery = val;
  filterAndRenderLimsStudentsList();
}

function loadLimsStudentsData() {
  if (typeof firestore === 'undefined' || !firestore) return;

  firestore.collection('students').get()
    .then(snapshot => {
      loadedLimsStudents = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.role === 'student') {
          loadedLimsStudents.push({ email: doc.id, ...d });
        }
      });
      
      // Sort alphabetically
      loadedLimsStudents.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      filterAndRenderLimsStudentsList();
    })
    .catch(err => {
      console.error("Error loading student profiles:", err);
      const container = document.getElementById('lims-std-list-container');
      if (container) {
        container.innerHTML = `<div style="color:var(--incorrect); text-align:center;">Failed loading profiles.</div>`;
      }
    });
}

function filterAndRenderLimsStudentsList() {
  const container = document.getElementById('lims-std-list-container');
  if (!container) return;

  let filtered = [...loadedLimsStudents];

  if (limsStudentSearchQuery.trim()) {
    const q = limsStudentSearchQuery.toLowerCase().trim();
    filtered = filtered.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.studentId && s.studentId.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-playlist-msg" style="padding: 20px;">No students match criteria.</div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const name = s.name || s.email.split('@')[0];
    const activeClass = s.email === activeLimsSelectedStudentEmail ? 'active' : '';
    const style = s.email === activeLimsSelectedStudentEmail ? 'background:rgba(13,148,136,0.06); border-color:var(--accent);' : '';
    
    return `
      <div onclick="showLimsStudentDetails('${s.email}')" style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:10px; padding:12px; cursor:pointer; display:flex; flex-direction:column; gap:4px; transition:all 0.2s; ${style}" class="std-list-card ${activeClass}">
        <div style="font-weight:700; font-size:13px; color:var(--text-main); font-family:'Outfit',sans-serif;">${escapeHtml(name)}</div>
        <div style="font-size:11.5px; color:var(--text-muted); display:flex; justify-content:space-between;">
          <span>ID: ${escapeHtml(s.studentId || 'N/A')}</span>
          <span>Sec ${escapeHtml((s.subjects && s.subjects[0]?.split('_')[1]?.toUpperCase()) || 'A')}</span>
        </div>
      </div>
    `;
  }).join('');
}

function showLimsStudentDetails(email) {
  activeLimsSelectedStudentEmail = email;
  
  // Re-highlight active card in left list
  const activeCards = document.querySelectorAll('.std-list-card');
  activeCards.forEach(c => c.style.borderColor = 'var(--border-card)');
  filterAndRenderLimsStudentsList();

  const detailContainer = document.getElementById('lims-std-detail-container');
  if (!detailContainer) return;

  const std = loadedLimsStudents.find(s => s.email === email);
  if (!std) return;

  detailContainer.innerHTML = `<div class="empty-playlist-msg">Loading student accountabilities...</div>`;

  // Fetch active accountabilities for this student
  firestore.collection('accountabilities').where('studentEmail', '==', email.toLowerCase().trim()).get()
    .then(snap => {
      let accs = [];
      snap.forEach(doc => {
        accs.push({ id: doc.id, ...doc.data() });
      });

      const pendingAccs = accs.filter(a => a.status === 'pending');
      const clearedAccs = accs.filter(a => a.status === 'cleared');

      const isStudentUncleared = pendingAccs.length > 0;
      const statusBadge = isStudentUncleared 
        ? `<span style="font-size:11px; font-weight:700; text-transform:uppercase; padding:4px 8px; border-radius:6px; background:rgba(239,68,68,0.1); color:#ef4444;">⚠️ Uncleared (${pendingAccs.length} obligation)</span>`
        : `<span style="font-size:11px; font-weight:700; text-transform:uppercase; padding:4px 8px; border-radius:6px; background:rgba(16,185,129,0.1); color:#10b981;">✅ Cleared (No Obligations)</span>`;

      // Build active obligations list table
      let obligationsTable = `<div style="font-size:12.5px; color:var(--text-muted); font-style:italic; padding: 12px 0;">No active accountabilities found.</div>`;
      if (pendingAccs.length > 0) {
        obligationsTable = `
          <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px dashed var(--border-card); color:var(--text-muted); font-size:10px; text-transform:uppercase;">
                <th style="padding:8px 4px;">Subject</th>
                <th style="padding:8px 4px;">Obligation Description</th>
                <th style="padding:8px 4px; width:120px;">Logged Date</th>
                <th style="padding:8px 4px; text-align:center; width:90px;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${pendingAccs.map(a => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                  <td style="padding:8px 4px; color:var(--text-main); font-weight:700;">${escapeHtml(a.subject || '')}</td>
                  <td style="padding:8px 4px; color:var(--text-muted);">${escapeHtml(a.description)}</td>
                  <td style="padding:8px 4px; color:var(--text-muted);">${a.timestamp ? new Date(a.timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                  <td style="padding:8px 4px; text-align:center;">
                    <button class="settings-btn-primary" onclick="settleLimsAccountability('${a.id}')" style="width:auto; margin:0; padding:4px 8px; font-size:11.5px; background:#10b981;">Settle</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      // Build cleared history list table
      let historyTable = `<div style="font-size:12.5px; color:var(--text-muted); font-style:italic; padding: 8px 0;">No past accountability logs.</div>`;
      if (clearedAccs.length > 0) {
        historyTable = `
          <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
            <thead>
              <tr style="border-bottom:1px dashed var(--border-card); color:var(--text-muted); font-size:10px; text-transform:uppercase;">
                <th style="padding:6px 4px;">Subject</th>
                <th style="padding:6px 4px;">Obligation Description</th>
                <th style="padding:6px 4px; width:120px;">Cleared Date</th>
              </tr>
            </thead>
            <tbody>
              ${clearedAccs.map(a => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.01);">
                  <td style="padding:6px 4px; color:var(--text-muted);">${escapeHtml(a.subject || '')}</td>
                  <td style="padding:6px 4px; color:var(--text-muted); text-decoration:line-through;">${escapeHtml(a.description)}</td>
                  <td style="padding:6px 4px; color:var(--text-muted);">${a.clearedAt ? new Date(a.clearedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      detailContainer.innerHTML = `
        <!-- Profile Header -->
        <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px dashed var(--border-card); padding-bottom:18px; margin-bottom:18px;">
          <div>
            <h3 style="margin:0; font-size:20px; font-weight:800; font-family:'Outfit',sans-serif; color:var(--text-main);">${escapeHtml(std.name || std.email.split('@')[0])}</h3>
            <p style="margin:4px 0 0 0; font-size:13px; color:var(--text-muted);">
              Email: <strong>${escapeHtml(std.email)}</strong> | ID: <strong>${escapeHtml(std.studentId || 'N/A')}</strong> | Year: <strong>${escapeHtml(std.year || '1')}</strong>
            </p>
          </div>
          <div>
            ${statusBadge}
          </div>
        </div>

        <!-- Clearance Stamp Sheet Preview -->
        <div style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:12px; padding:20px; text-align:center; margin-bottom:24px; position:relative;" id="lims-clearance-stamp-sheet">
          <div style="font-size:12px; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.5px; margin-bottom:14px; text-align:left;">📋 DEPARTMENT CLEARANCE SHEET</div>
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
            <div style="width:100px; height:100px; border-radius:50%; border:3px solid ${isStudentUncleared ? '#ef4444' : '#10b981'}; display:flex; justify-content:center; align-items:center; font-size:32px; font-weight:800; color:${isStudentUncleared ? '#ef4444' : '#10b981'}; background:rgba(255,255,255,0.01);">
              ${isStudentUncleared ? '❌' : 'APPROVED'}
            </div>
            <div style="font-weight:700; font-size:14px; color:var(--text-main); margin-top:6px;">Chemistry Stockroom Stamp</div>
            <div style="font-size:12px; color:var(--text-muted);">${isStudentUncleared ? 'Clearance blocked by outstanding obligations' : 'Signed off and cleared from all obligations'}</div>
          </div>

          <!-- Print / Action trigger -->
          <div style="display:flex; justify-content:center; gap:10px; margin-top:16px; border-top:1px dashed var(--border-card); padding-top:14px;">
            <button class="settings-btn-primary" onclick="printLimsStudentClearance()" style="width:auto; margin:0; padding:8px 16px; font-size:12.5px; background:var(--accent); color:white;">🖨️ Print Clearance Certificate</button>
            <button class="settings-btn-primary" onclick="triggerManualAccountabilityForm('${std.email}')" style="width:auto; margin:0; padding:8px 16px; font-size:12.5px; background:rgba(255,255,255,0.06); border:1px solid var(--border-card); color:var(--text-main);">➕ Add Manual Liability</button>
          </div>
        </div>

        <!-- Active Obligations Table -->
        <div style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:12px; padding:20px; margin-bottom:24px; text-align:left;">
          <h4 style="margin:0 0 12px 0; font-size:12.5px; font-weight:700; color:var(--text-main); text-transform:uppercase; letter-spacing:0.5px;">⌛ Outstanding obligations & Liabilities</h4>
          ${obligationsTable}
        </div>

        <!-- Cleared History Table -->
        <div style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:12px; padding:20px; text-align:left;">
          <h4 style="margin:0 0 12px 0; font-size:12.5px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">📋 Clearance Obligation History</h4>
          ${historyTable}
        </div>
      `;
    })
    .catch(err => {
      console.error("Error loading accountabilities:", err);
      detailContainer.innerHTML = `<div class="empty-playlist-msg" style="color:var(--incorrect);">⚠️ Error fetching accountabilities.</div>`;
    });
}

function settleLimsAccountability(id) {
  if (!confirm("Settle and clear this student accountability?")) return;

  firestore.collection('accountabilities').doc(id).update({
    status: 'cleared',
    clearedBy: currentUser.email,
    clearedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    alert("Obligation marked as settled!");
    if (activeLimsSelectedStudentEmail) {
      showLimsStudentDetails(activeLimsSelectedStudentEmail);
    }
  })
  .catch(err => alert("Error: " + err.message));
}

function triggerManualAccountabilityForm(email) {
  const std = loadedLimsStudents.find(s => s.email === email);
  if (!std) return;

  const bodyHTML = `
    <form id="lims-manual-acc-form" style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Subject Code:</label>
        <input type="text" id="manual-acc-subject" required placeholder="e.g. CHEM101" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Class Section:</label>
        <input type="text" id="manual-acc-section" required placeholder="e.g. A" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
      </div>
      <div style="display:flex; flex-direction:column; gap:4px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Liability / Damage Description:</label>
        <textarea id="manual-acc-description" required placeholder="e.g. Broken 50mL burette, or unreturned graduated cylinder..." style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; height:100px; resize:vertical; outline:none; font-family:inherit;"></textarea>
      </div>
    </form>
  `;

  const footerHTML = `
    <button class="settings-btn-primary" onclick="closeActionDrawer()" style="width:auto; margin:0; padding:10px 16px; font-size:13px; background:rgba(255,255,255,0.06); color:var(--text-muted); border:1px solid var(--border-card);">Cancel</button>
    <button class="settings-btn-primary" onclick="submitLimsManualAccountability('${email}')" style="width:auto; margin:0; padding:10px 20px; font-size:13px; font-weight:600; background:var(--accent); color:white;">💾 Save Liability</button>
  `;

  openActionDrawer(`➕ Log Manual Liability: ${std.name || email.split('@')[0]}`, bodyHTML, footerHTML);
}

function submitLimsManualAccountability(email) {
  const subject = document.getElementById('manual-acc-subject').value.trim();
  const section = document.getElementById('manual-acc-section').value.trim();
  const desc = document.getElementById('manual-acc-description').value.trim();

  if (!subject || !section || !desc) {
    alert("Please fill in all manual accountability fields.");
    return;
  }

  const std = loadedLimsStudents.find(s => s.email === email);
  const currentSem = getDefaultSemester();

  firestore.collection('accountabilities').add({
    studentEmail: email.toLowerCase().trim(),
    studentName: std ? (std.name || email.split('@')[0]) : email.split('@')[0],
    courseId: subject.toLowerCase().trim(),
    section: section.toLowerCase().trim(),
    subject: subject.toUpperCase().trim(),
    description: desc,
    status: 'pending',
    semester: currentSem,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: currentUser.email
  })
  .then(() => {
    alert("Manual liability logged successfully!");
    closeActionDrawer();
    showLimsStudentDetails(email);
  })
  .catch(err => alert("Error saving accountability: " + err.message));
}

function printLimsStudentClearance() {
  const printContent = document.getElementById('lims-std-detail-container').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>Student Clearance Certificate</title>
        <style>
          body { font-family: 'Outfit', sans-serif; padding: 40px; color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5f5f5; }
          button { display: none !important; }
          .settings-btn-primary { display: none !important; }
          #lims-clearance-stamp-sheet { border: 2px solid #ccc; padding: 20px; border-radius: 12px; margin-bottom: 24px; text-align: center; }
          span[style*="rgba(16,185,129"] { color: #10b981; font-weight: 700; border: 2px solid #10b981; padding: 6px 12px; border-radius: 6px; }
          span[style*="rgba(239,68"] { color: #ef4444; font-weight: 700; border: 2px solid #ef4444; padding: 6px 12px; border-radius: 6px; }
        </style>
      </head>
      <body>
        <div style="text-align: center; margin-bottom: 24px;">
          <h2>Mindanao State University - General Santos</h2>
          <h3>Department of Chemistry Laboratory Clearance</h3>
        </div>
        ${printContent}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}


// 3. REPORTS DASHBOARD
// --------------------------------------------------------------------------
function renderLabReportsView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <div class="home-greeting-card" style="padding: 24px; background: rgba(13,148,136,0.05); border: 1px solid rgba(13,148,136,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
      <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--accent); margin: 0 0 8px 0;">📊 Consolidated Reports</h2>
      <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Generate analytical damage summary reports and export clearance logs as CSV or Excel sheets.</p>
    </div>

    <!-- Configuration panel -->
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left; display:flex; gap:16px; align-items:flex-end; flex-wrap:wrap; margin-bottom:24px;">
      <div style="display:flex; flex-direction:column; gap:6px; min-width:200px;">
        <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Report Category:</label>
        <select id="report-category" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; font-weight:600; outline:none; cursor:pointer;">
          <option value="liabilities">Outstanding Liabilities (Damaged/Lost Items)</option>
          <option value="transactions">Transaction Volume and Lifecycle Logs</option>
          <option value="clearance">Clearance Logs</option>
        </select>
      </div>

      <div style="display:flex; flex-direction:column; gap:6px; min-width:180px;">
        <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Semester:</label>
        <select id="report-semester" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; cursor:pointer;">
          <option value="all">All Semesters</option>
          <option value="${escapeHtml(getDefaultSemester())}" selected>${escapeHtml(getDefaultSemester())}</option>
        </select>
      </div>

      <button class="settings-btn-primary" onclick="generateLimsReport()" style="width:auto; margin:0; padding:10px 24px; font-size:13px; font-weight:600; background:var(--accent); color:white;">📊 Generate Report</button>
    </div>

    <!-- Output results panel -->
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:24px; text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:12px;">
        <h3 style="margin:0; font-size:15px; font-weight:700; font-family:'Outfit',sans-serif; color:var(--text-main);">Report Output</h3>
        <div style="display:flex; gap:6px;">
          <button class="settings-btn-primary" onclick="exportLimsReport('csv')" style="width:auto; margin:0; padding:8px 12px; font-size:12px; background:rgba(255,255,255,0.06); border:1px solid var(--border-card); color:var(--text-main);">📥 Export CSV</button>
          <button class="settings-btn-primary" onclick="exportLimsReport('excel')" style="width:auto; margin:0; padding:8px 12px; font-size:12px; background:rgba(255,255,255,0.06); border:1px solid var(--border-card); color:var(--text-main);">📥 Export Excel</button>
          <button class="settings-btn-primary" onclick="printLimsReport()" style="width:auto; margin:0; padding:8px 12px; font-size:12px; background:rgba(255,255,255,0.06); border:1px solid var(--border-card); color:var(--text-main);">🖨️ Print Report</button>
        </div>
      </div>

      <div id="report-output-container" style="overflow-x:auto;">
        <div class="empty-playlist-msg" style="padding:40px 0;">Configure parameters and click "Generate Report" to view analytics.</div>
      </div>
    </div>
  `;
}

function generateLimsReport() {
  const category = document.getElementById('report-category').value;
  const semester = document.getElementById('report-semester').value;
  const container = document.getElementById('report-output-container');

  if (!container) return;

  container.innerHTML = `<div class="empty-playlist-msg">Generating analytics...</div>`;
  generatedReportCategory = category;

  if (category === 'liabilities') {
    let query = firestore.collection('accountabilities');
    if (semester !== 'all') {
      query = query.where('semester', '==', semester);
    }

    query.get().then(snap => {
      generatedReportRows = [];
      snap.forEach(doc => {
        generatedReportRows.push({ id: doc.id, ...doc.data() });
      });

      if (generatedReportRows.length === 0) {
        container.innerHTML = `<div class="empty-playlist-msg">No accountability logs matching the filters.</div>`;
        return;
      }

      container.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid var(--border-card); color:var(--text-muted); font-size:11px; text-transform:uppercase;">
              <th style="padding:10px 6px;">Student Name</th>
              <th style="padding:10px 6px;">Email</th>
              <th style="padding:10px 6px;">Subject</th>
              <th style="padding:10px 6px;">Liability Description</th>
              <th style="padding:10px 6px; width:100px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${generatedReportRows.map(row => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                <td style="padding:10px 6px; font-weight:700; color:var(--text-main);">${escapeHtml(row.studentName)}</td>
                <td style="padding:10px 6px; color:var(--text-muted);">${escapeHtml(row.studentEmail)}</td>
                <td style="padding:10px 6px; color:var(--text-main);">${escapeHtml(row.subject)}</td>
                <td style="padding:10px 6px; color:var(--text-muted);">${escapeHtml(row.description)}</td>
                <td style="padding:10px 6px; font-weight:700; color:${row.status === 'pending' ? 'var(--incorrect)' : 'var(--correct)'};">${escapeHtml(row.status.toUpperCase())}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    });
  } else if (category === 'transactions') {
    firestore.collection('requisitions').get().then(snap => {
      generatedReportRows = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (semester === 'all' || d.semester === semester) {
          generatedReportRows.push({ id: doc.id, ...d });
        }
      });

      if (generatedReportRows.length === 0) {
        container.innerHTML = `<div class="empty-playlist-msg">No transactions found.</div>`;
        return;
      }

      container.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid var(--border-card); color:var(--text-muted); font-size:11px; text-transform:uppercase;">
              <th style="padding:10px 6px;">Group Name</th>
              <th style="padding:10px 6px;">Subject</th>
              <th style="padding:10px 6px;">Schedule Date</th>
              <th style="padding:10px 6px;">Submitted By</th>
              <th style="padding:10px 6px; width:120px;">Current Status</th>
            </tr>
          </thead>
          <tbody>
            ${generatedReportRows.map(row => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                <td style="padding:10px 6px; font-weight:700; color:var(--text-main);">${escapeHtml(row.groupName)}</td>
                <td style="padding:10px 6px; color:var(--text-muted);">${escapeHtml(row.courseId?.toUpperCase())} (Sec ${escapeHtml(row.section)})</td>
                <td style="padding:10px 6px; color:var(--text-main);">${escapeHtml(row.scheduleDate)} @ ${escapeHtml(row.scheduleTime)}</td>
                <td style="padding:10px 6px; color:var(--text-muted);">${escapeHtml(row.submittedBy)}</td>
                <td style="padding:10px 6px; font-weight:700; text-transform:uppercase;">${escapeHtml(row.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    });
  } else if (category === 'clearance') {
    // Generate overall student clearance stamps summary
    firestore.collection('students').where('role', '==', 'student').get().then(studSnap => {
      firestore.collection('accountabilities').where('status', '==', 'pending').get().then(accSnap => {
        // Collect emails of students with active accountabilities
        const unclearedEmails = new Set();
        accSnap.forEach(doc => {
          unclearedEmails.add(doc.data().studentEmail?.toLowerCase().trim());
        });

        generatedReportRows = [];
        studSnap.forEach(doc => {
          const d = doc.data();
          const email = doc.id.toLowerCase().trim();
          const isCleared = !unclearedEmails.has(email);
          generatedReportRows.push({
            name: d.name || email.split('@')[0],
            email: doc.id,
            studentId: d.studentId || 'N/A',
            clearanceStatus: isCleared ? 'CLEARED' : 'UNCLEARED'
          });
        });

        container.innerHTML = `
          <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
            <thead>
              <tr style="border-bottom:2px solid var(--border-card); color:var(--text-muted); font-size:11px; text-transform:uppercase;">
                <th style="padding:10px 6px;">Student Name</th>
                <th style="padding:10px 6px;">Student ID</th>
                <th style="padding:10px 6px;">Email</th>
                <th style="padding:10px 6px; width:120px;">Clearance Status</th>
              </tr>
            </thead>
            <tbody>
              ${generatedReportRows.map(row => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                  <td style="padding:10px 6px; font-weight:700; color:var(--text-main);">${escapeHtml(row.name)}</td>
                  <td style="padding:10px 6px; color:var(--text-muted);">${escapeHtml(row.studentId)}</td>
                  <td style="padding:10px 6px; color:var(--text-muted);">${escapeHtml(row.email)}</td>
                  <td style="padding:10px 6px; font-weight:700; color:${row.clearanceStatus === 'CLEARED' ? 'var(--correct)' : 'var(--incorrect)'};">${row.clearanceStatus}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      });
    });
  }
}

function exportLimsReport(format) {
  if (generatedReportRows.length === 0) {
    alert("Please generate a report first.");
    return;
  }

  // Define column mappings based on category
  let csvContent = "";
  let headers = [];
  let rows = [];

  if (generatedReportCategory === 'liabilities') {
    headers = ["Student Name", "Email", "Subject", "Description", "Status"];
    rows = generatedReportRows.map(r => [r.studentName, r.studentEmail, r.subject, r.description, r.status]);
  } else if (generatedReportCategory === 'transactions') {
    headers = ["Group Name", "Subject", "Schedule Date", "Submitted By", "Status"];
    rows = generatedReportRows.map(r => [r.groupName, r.courseId, r.scheduleDate, r.submittedBy, r.status]);
  } else if (generatedReportCategory === 'clearance') {
    headers = ["Name", "Student ID", "Email", "Clearance Status"];
    rows = generatedReportRows.map(r => [r.name, r.studentId, r.email, r.clearanceStatus]);
  }

  if (format === 'csv') {
    csvContent = [headers.join(','), ...rows.map(r => r.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `lims_report_${generatedReportCategory}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else if (format === 'excel') {
    // Generate spreadsheet using SheetsJS XLSX library
    try {
      const worksheetData = [headers, ...rows];
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "LIMS Report");
      XLSX.writeFile(workbook, `lims_report_${generatedReportCategory}_${Date.now()}.xlsx`);
    } catch(err) {
      alert("Spreadsheet library load failed: " + err.message);
    }
  }
}

function printLimsReport() {
  const printContent = document.getElementById('report-output-container').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>Chemistry Stockroom Report</title>
        <style>
          body { font-family: sans-serif; padding: 40px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h2>Mindanao State University - General Santos</h2>
        <h3>Chemistry Stockroom Operations Summary</h3>
        <p>Report Category: ${generatedReportCategory.toUpperCase()} | Printed on: ${new Date().toLocaleString()}</p>
        ${printContent}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}


// 4. COMMUNICATION ANNOUNCEMENTS & DISPATCH
// --------------------------------------------------------------------------
function renderLabCommunicationView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <div class="home-greeting-card" style="padding: 24px; background: rgba(13,148,136,0.05); border: 1px solid rgba(13,148,136,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
      <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--accent); margin: 0 0 8px 0;">📢 Communication Hub</h2>
      <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Publish announcements to students and faculty, dispatch reminder alerts, and send clearance targets.</p>
    </div>

    <!-- Bulk Semester Reminders Section -->
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; margin-bottom:24px; text-align:left;">
      <h3 style="margin:0 0 8px 0; font-size:15px; font-weight:700; font-family:'Outfit',sans-serif; color:var(--text-main);">🔔 Send Clearance Reminders</h3>
      <p style="margin:0 0 16px 0; font-size:13px; color:var(--text-muted);">Trigger automated notifications for students and faculty regarding outstanding stockroom obligations.</p>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <button class="settings-btn-primary" onclick="sendBulkReminders('current')" style="width:auto; margin:0; padding:12px 20px; font-size:13px; font-weight:600; background:#f59e0b;">🔔 Remind Active Semester</button>
        <button class="settings-btn-primary" onclick="sendBulkReminders('past')" style="width:auto; margin:0; padding:12px 20px; font-size:13px; font-weight:600; background:#ef4444;">📣 Remind Past Semesters (Uncleared)</button>
      </div>
    </div>

    <!-- Create Announcement Form Section -->
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; margin-bottom:24px; text-align:left;">
      <h3 id="stock-ann-form-title" style="margin:0 0 14px 0; font-size:15px; font-weight:700; font-family:'Outfit',sans-serif; color:var(--text-main);">📢 Publish New Announcement</h3>
      <form id="stock-announcement-form" onsubmit="handleStockroomAnnouncementSubmit(event)" style="display:flex; flex-direction:column; gap:12px;">
        <input type="hidden" id="stock-ann-id" value="">
        
        <div style="display:flex; flex-direction:column; gap:6px;">
          <label style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Announcement Message:</label>
          <textarea id="stock-ann-content" required placeholder="Type the announcement details here (e.g. Broken glassware checklist must be settled by Friday, or Reagent preparation schedule updates...)" style="padding:12px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; height:100px; resize:vertical; font-family:inherit; outline:none;"></textarea>
        </div>

        <div style="display:flex; flex-direction:column; gap:6px; width:220px;">
          <label style="font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase;">Send Notice To:</label>
          <select id="stock-ann-send-to" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; cursor:pointer;">
            <option value="both" selected>Both (Students & Faculty)</option>
            <option value="students">Students Only</option>
            <option value="faculty">Faculty Only</option>
          </select>
        </div>

        <div style="display:flex; gap:8px; margin-top:6px;">
          <button type="submit" class="settings-btn-primary" style="width:auto; margin:0; padding:10px 20px; font-size:13px; font-weight:600; background:var(--accent);">📢 Publish Announcement</button>
          <button type="button" id="stock-ann-cancel-btn" onclick="cancelStockroomAnnouncementEdit()" style="display:none; width:auto; margin:0; padding:10px 18px; font-size:13px; background:rgba(255,255,255,0.08); color:var(--text-muted); border:1px solid var(--border-card); border-radius:8px; cursor:pointer;">Cancel</button>
        </div>
      </form>
    </div>

    <!-- Past Announcements List -->
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left;">
      <h3 style="margin:0 0 14px 0; font-size:15px; font-weight:700; font-family:'Outfit',sans-serif; color:var(--text-main);">📋 Published Announcements History</h3>
      <div id="stock-announcements-list-container">
        <div class="empty-playlist-msg" style="padding:20px;">Loading announcements history...</div>
      </div>
    </div>
  `;

  loadStockroomAnnouncements();
}

function loadStockroomAnnouncements() {
  if (typeof firestore === 'undefined' || !firestore) return;

  firestore.collection('stockroom_announcements').get()
    .then(snap => {
      const container = document.getElementById('stock-announcements-list-container');
      if (!container) return;

      if (snap.empty) {
        container.innerHTML = `<div class="empty-playlist-msg" style="padding:20px; border:1px dashed var(--border-card); border-radius:8px; background:rgba(255,255,255,0.01);">No past announcements found.</div>`;
        return;
      }

      let anns = [];
      snap.forEach(doc => {
        anns.push({ id: doc.id, ...doc.data() });
      });

      // Sort by newest first
      anns.sort((a, b) => {
        const timeA = a.createdAt ? (a.createdAt.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime()) : 0;
        const timeB = b.createdAt ? (b.createdAt.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime()) : 0;
        return timeB - timeA;
      });

      let html = '<div style="display:flex; flex-direction:column; gap:14px;">';
      anns.forEach(ann => {
        const dateStr = ann.createdAt ? new Date(ann.createdAt.seconds ? ann.createdAt.seconds * 1000 : ann.createdAt).toLocaleString() : 'Just now';
        
        let sendToLabel = 'Both';
        let sendToColor = '#0ea5e9';
        let sendToBg = 'rgba(14,165,233,0.1)';
        if (ann.sendTo === 'students') {
          sendToLabel = 'Students';
          sendToColor = '#f59e0b';
          sendToBg = 'rgba(245,158,11,0.1)';
        } else if (ann.sendTo === 'faculty') {
          sendToLabel = 'Faculty';
          sendToColor = '#a855f7';
          sendToBg = 'rgba(168,85,247,0.1)';
        }

        html += `
          <div style="background:var(--bg-body); border:1px solid var(--border-card); border-radius:8px; padding:16px; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:8px;">
              <span style="font-size:10px; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:4px; background:${sendToBg}; color:${sendToColor};">
                Target: ${sendToLabel}
              </span>
              <span style="font-size:11px; color:var(--text-muted); font-family:monospace;">
                ${dateStr}
              </span>
            </div>
            <p style="margin:0 0 12px 0; font-size:13px; color:var(--text-main); line-height:1.5; white-space:pre-wrap;">${escapeHtml(ann.content)}</p>
            
            <div style="display:flex; gap:8px; justify-content:flex-end; border-top:1px dashed var(--border-card); padding-top:10px; margin-top:6px;">
              <button onclick="editStockroomAnnouncement('${escapeJsString(ann.id)}', '${escapeJsString(ann.content)}', '${escapeJsString(ann.sendTo)}')" style="background:none; border:none; color:#3b82f6; cursor:pointer; font-size:12px; font-weight:600; display:flex; align-items:center; gap:4px; padding:4px 8px;">
                ✏️ Edit
              </button>
              <button onclick="deleteStockroomAnnouncement('${escapeJsString(ann.id)}')" style="background:none; border:none; color:var(--incorrect); cursor:pointer; font-size:12px; font-weight:600; display:flex; align-items:center; gap:4px; padding:4px 8px;">
                ❌ Delete
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    })
    .catch(err => {
      console.error("Error loading stockroom announcements:", err);
    });
}

function handleStockroomAnnouncementSubmit(event) {
  event.preventDefault();

  const id = document.getElementById('stock-ann-id').value;
  const content = document.getElementById('stock-ann-content').value.trim();
  const sendTo = document.getElementById('stock-ann-send-to').value;

  if (!content) {
    alert("Please enter the announcement message content.");
    return;
  }

  const payload = {
    content: content,
    sendTo: sendTo,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: currentUser.email,
    createdByName: currentUser.name
  };

  const dbPromise = id 
    ? firestore.collection('stockroom_announcements').doc(id).update(payload)
    : firestore.collection('stockroom_announcements').add(payload);

  dbPromise
    .then(() => {
      alert(id ? "Announcement updated successfully!" : "Announcement published successfully!");
      cancelStockroomAnnouncementEdit();
      loadStockroomAnnouncements();
    })
    .catch(err => {
      console.error("Error saving announcement:", err);
      alert("Failed to save announcement: " + err.message);
    });
}

function editStockroomAnnouncement(id, content, sendTo) {
  document.getElementById('stock-ann-id').value = id;
  document.getElementById('stock-ann-content').value = content;
  document.getElementById('stock-ann-send-to').value = sendTo;

  document.getElementById('stock-ann-form-title').innerText = "✏️ Edit Announcement";
  document.getElementById('stock-ann-cancel-btn').style.display = 'inline-block';
}

function cancelStockroomAnnouncementEdit() {
  document.getElementById('stock-ann-id').value = '';
  document.getElementById('stock-announcement-form').reset();
  
  document.getElementById('stock-ann-form-title').innerText = "📢 Publish New Announcement";
  document.getElementById('stock-ann-cancel-btn').style.display = 'none';
}

function deleteStockroomAnnouncement(id) {
  if (!confirm("Are you sure you want to permanently delete this announcement?")) return;

  firestore.collection('stockroom_announcements').doc(id).delete()
    .then(() => {
      alert("Announcement deleted.");
      loadStockroomAnnouncements();
    })
    .catch(err => alert("Failed to delete: " + err.message));
}


// 5. SETTINGS MODULE
// --------------------------------------------------------------------------
function renderLabSettingsView() {
  const viewport = document.getElementById('viewport-body');
  if (!viewport || !currentUser) return;

  viewport.innerHTML = `
    <div class="home-greeting-card" style="padding: 24px; background: rgba(13,148,136,0.05); border: 1px solid rgba(13,148,136,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
      <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--accent); margin: 0 0 8px 0;">⚙ Settings Dashboard</h2>
      <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Adjust academic calendar schedules, configure stockroom policies, and manage database record roles.</p>
    </div>

    <!-- Active Semester configuration -->
    <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left;">
      <h3 style="margin:0 0 14px 0; font-size:15px; font-weight:700; font-family:'Outfit',sans-serif;">📅 Semester Configuration</h3>
      <form id="lims-semester-settings-form" onsubmit="saveLimsSemesterSettings(event)" style="display:flex; flex-direction:column; gap:12px; max-width:400px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Semester Start Date:</label>
          <input type="date" id="lims-sem-start" value="${escapeHtml(semesterStartDate || '')}" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Semester End Date:</label>
          <input type="date" id="lims-sem-end" value="${escapeHtml(semesterEndDate || '')}" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
        <button type="submit" class="settings-btn-primary" style="width:auto; margin-top:8px; padding:10px 20px; font-size:13px; font-weight:600; background:var(--accent); color:white;">💾 Save Semester Calendar</button>
      </form>
    </div>
  `;
}

function saveLimsSemesterSettings(event) {
  event.preventDefault();
  const start = document.getElementById('lims-sem-start').value;
  const end = document.getElementById('lims-sem-end').value;

  if (!start || !end) {
    alert("Please fill in both semester dates.");
    return;
  }

  firestore.collection('config').doc('semester').set({
    startDate: start,
    endDate: end,
    updatedBy: currentUser.email,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    alert("Semester dates updated successfully!");
    semesterStartDate = start;
    semesterEndDate = end;
  })
  .catch(err => alert("Error saving config: " + err.message));
}

// 6. FACULTY ACCESS TO CLASS ACCOUNTABILITIES (LOADER FUNCTION)
// --------------------------------------------------------------------------
function loadFacultyClassAccountabilities(courseId, section) {
  const container = document.getElementById('class-details-tab-content');
  if (!container) return;

  container.innerHTML = `<div class="empty-playlist-msg">Loading class accountabilities...</div>`;

  firestore.collection('accountabilities')
    .where('courseId', '==', courseId.toLowerCase().trim())
    .where('section', '==', section.toLowerCase().trim())
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        container.innerHTML = `
          <div class="empty-playlist-msg" style="padding:40px 0; border:1px dashed var(--border-card); border-radius:12px;">
            🎉 No outstanding student accountabilities found for this class section.
          </div>
        `;
        return;
      }

      let accs = [];
      snapshot.forEach(doc => {
        accs.push({ id: doc.id, ...doc.data() });
      });

      // Sort pending first, then by name
      accs.sort((a, b) => {
        if (a.status === b.status) {
          return (a.studentName || '').localeCompare(b.studentName || '');
        }
        return a.status === 'pending' ? -1 : 1;
      });

      container.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:20px; text-align:left;">
          <h3 style="margin:0 0 14px 0; font-size:15px; font-weight:700; font-family:'Outfit',sans-serif; color:var(--text-main);">📋 Roster Lab Obligations</h3>
          <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;">
            <thead>
              <tr style="border-bottom:2px solid var(--border-card); color:var(--text-muted); font-size:10px; text-transform:uppercase;">
                <th style="padding:10px 6px;">Student Name</th>
                <th style="padding:10px 6px;">Email</th>
                <th style="padding:10px 6px;">Obligation Details</th>
                <th style="padding:10px 6px; width:120px; text-align:center;">Clearance Status</th>
              </tr>
            </thead>
            <tbody>
              ${accs.map(a => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                  <td style="padding:10px 6px; font-weight:700; color:var(--text-main);">${escapeHtml(a.studentName)}</td>
                  <td style="padding:10px 6px; color:var(--text-muted);">${escapeHtml(a.studentEmail)}</td>
                  <td style="padding:10px 6px; color:var(--text-muted);">${escapeHtml(a.description)}</td>
                  <td style="padding:10px 6px; text-align:center; font-weight:700; color:${a.status === 'pending' ? 'var(--incorrect)' : 'var(--correct)'};">
                    ${escapeHtml(a.status.toUpperCase())}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    })
    .catch(err => {
      console.error("Error loading class obligations:", err);
      container.innerHTML = `<div class="empty-playlist-msg" style="color:var(--incorrect);">⚠️ Failed to load class obligations: ${err.message}</div>`;
    });
}

// Bind all LIMS function exports to the window object
window.renderLabTransactionsView = renderLabTransactionsView;
window.renderLabStudentsView = renderLabStudentsView;
window.renderLabReportsView = renderLabReportsView;
window.renderLabCommunicationView = renderLabCommunicationView;
window.renderLabSettingsView = renderLabSettingsView;
window.updateLimsTransactionSearch = updateLimsTransactionSearch;
window.updateLimsTransactionFilter = updateLimsTransactionFilter;
window.loadLimsTransactionsData = loadLimsTransactionsData;
window.showLimsTransactionDetails = showLimsTransactionDetails;
window.approveLimsTransaction = approveLimsTransaction;
window.returnLimsForRevision = returnLimsForRevision;
window.releaseLimsTransaction = releaseLimsTransaction;
window.receiveLimsTransaction = receiveLimsTransaction;
window.finalizeLimsClearance = finalizeLimsClearance;
window.revertLimsTransactionStatus = revertLimsTransactionStatus;
window.updateLimsStudentSearch = updateLimsStudentSearch;
window.loadLimsStudentsData = loadLimsStudentsData;
window.showLimsStudentDetails = showLimsStudentDetails;
window.settleLimsAccountability = settleLimsAccountability;
window.triggerManualAccountabilityForm = triggerManualAccountabilityForm;
window.submitLimsManualAccountability = submitLimsManualAccountability;
window.printLimsStudentClearance = printLimsStudentClearance;
window.generateLimsReport = generateLimsReport;
window.exportLimsReport = exportLimsReport;
window.printLimsReport = printLimsReport;
window.loadStockroomAnnouncements = loadStockroomAnnouncements;
window.handleStockroomAnnouncementSubmit = handleStockroomAnnouncementSubmit;
window.editStockroomAnnouncement = editStockroomAnnouncement;
window.cancelStockroomAnnouncementEdit = cancelStockroomAnnouncementEdit;
window.deleteStockroomAnnouncement = deleteStockroomAnnouncement;
window.saveLimsSemesterSettings = saveLimsSemesterSettings;
window.lookupUserForPromotion = lookupUserForPromotion;
window.confirmLimsPromotion = confirmLimsPromotion;
window.loadFacultyClassAccountabilities = loadFacultyClassAccountabilities;
window.runFirestoreMigration = runFirestoreMigration;
window.getDefaultSemester = getDefaultSemester;
window.openActionDrawer = openActionDrawer;
window.closeActionDrawer = closeActionDrawer;

// Trigger migration on load
document.addEventListener('DOMContentLoaded', () => {
  runFirestoreMigration();
});
