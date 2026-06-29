// DoC Learning Hub — PCO / EMIS System Module
// Mindanao State University - General Santos, Department of Chemistry

(function() {
  // PCO Active Sub-tabs State
  let activeSubTabs = {
    dashboard: 'overview',
    waste: 'hazardous',
    permits: 'repository',
    incidents: 'spills'
  };

  // Cache for loaded data
  let cache = {
    inventory: [],
    generators: [],
    solidWaste: [],
    wastewater: [],
    incidents: [],
    permits: []
  };

  // Standard PCO Reference Data
  const EMERGENCY_CONTACTS = [
    { role: 'ERT Team Leader', name: 'Randy P. Asturias, D.Eng.', phone: '09189230369' },
    { role: 'First Aid / Fire Brigade', name: 'Maychelou R. Castillo, LPT', phone: '09228151436' },
    { role: 'Solid Waste Management', name: 'Sheila J. Loable, MS.', phone: '09081078430' },
    { role: 'HAZMAT / Chemical Mgmt', name: 'Ramon M. Eduque, Jr., R.Ch.', phone: '09431354100' }
  ];

  const PUBLIC_HOTLINES = [
    { agency: 'Barangay Fatima Police Station', phone: '(083) 552-4022' },
    { agency: 'Bureau of Fire Protection (BFP) GenSan', phone: '(083) 552-3119' },
    { agency: 'General Santos Doctors Hospital', phone: '(083) 552-6101' },
    { agency: 'St. Elizabeth Hospital', phone: '(083) 552-2812' },
    { agency: 'DENR-EMB Region XII Office', phone: '(083) 301-2360' }
  ];

  // PCO Subrole write permissions check helper
  function hasPcoWriteAccess(area) {
    if (typeof currentUserRole === 'undefined' || !currentUser) return false;
    if (currentUserRole === 'admin') return true;
    const subrole = currentUser.role || 'pco_college';
    if (subrole === 'pco_head') return true;

    if (area === 'waste' || area === 'wastewater' || area === 'generators') {
      return subrole === 'pco_laboratory';
    }
    if (area === 'permits' || area === 'incidents') {
      return subrole === 'pco_office';
    }
    return false;
  }

  // Helper to get formatted status badge
  function getStatusBadge(status) {
    let color = 'var(--text-muted)';
    let bg = 'rgba(255,255,255,0.05)';
    if (['active', 'reported', 'open'].includes(status)) {
      color = '#f59e0b';
      bg = 'rgba(245,158,11,0.1)';
    } else if (['treated', 'closed', 'remediated', 'verified'].includes(status)) {
      color = '#10b981';
      bg = 'rgba(16,185,129,0.1)';
    } else if (['transferred_to_hwsf', 'investigation'].includes(status)) {
      color = '#3b82f6';
      bg = 'rgba(59,130,246,0.1)';
    } else if (['transported'].includes(status)) {
      color = '#a855f7';
      bg = 'rgba(168,85,247,0.1)';
    }
    return `<span style="padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 11px; background:${bg}; color:${color};">${status.toUpperCase().replace(/_/g, ' ')}</span>`;
  }

  // Switch Sub-tabs
  function switchPcoSubTab(viewportName, tabId) {
    activeSubTabs[viewportName] = tabId;
    
    // Toggle tab active button classes
    const container = document.getElementById(`pco-${viewportName}-subtabs`);
    if (container) {
      container.querySelectorAll('.pco-subtab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
      });
    }

    // Toggle content visibility
    const viewEl = document.getElementById(`pco-${viewportName}-view-container`);
    if (viewEl) {
      viewEl.querySelectorAll('.pco-subtab-content').forEach(content => {
        content.classList.toggle('active', content.id === `pco-${viewportName}-sub-${tabId}`);
      });
    }
  }
  window.switchPcoSubTab = switchPcoSubTab;

  // Render Sub-tab Navigation
  function renderSubTabs(viewportName, tabsArray) {
    return `
      <div class="pco-subtabs-container" id="pco-${viewportName}-subtabs">
        ${tabsArray.map(t => `
          <button class="pco-subtab-btn ${activeSubTabs[viewportName] === t.id ? 'active' : ''}" 
                  data-tab="${t.id}" 
                  onclick="switchPcoSubTab('${viewportName}', '${t.id}')">
            ${t.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  // Seeding Sample Data helper
  function checkAndSeedSampleData() {
    firestore.collection('pco_inventory').limit(1).get().then(snap => {
      if (snap.empty) {
        console.log("Seeding sample PCO inventory records...");
        const samples = [
          {
            containerId: "CB-CNMS-2026-001",
            wasteCode: "G703",
            description: "Spent Chloroform/DCM CNMS OrgChem",
            capacityLiters: 20.0,
            currentVolume: 12.5,
            location: "CNMS Chemistry Stockroom",
            status: "active",
            dateStarted: "2026-05-01T08:00:00Z",
            daysLimit: 90,
            deposits: [{ date: "2026-05-01T09:00:00Z", volume: 12.5, loggedBy: "ramon.eduque@msugensan.edu.ph" }],
            transporterName: null, tsdName: null, manifestNo: null, cotRef: null
          },
          {
            containerId: "CB-CNMS-2026-002",
            wasteCode: "G704",
            description: "Spent Ethanol/Acetone CNMS GenChem",
            capacityLiters: 20.0,
            currentVolume: 18.0,
            location: "CNMS Chemistry Stockroom",
            status: "active",
            dateStarted: "2026-04-10T08:00:00Z", // Aging carboy
            daysLimit: 90,
            deposits: [{ date: "2026-04-10T09:00:00Z", volume: 18.0, loggedBy: "ramon.eduque@msugensan.edu.ph" }],
            transporterName: null, tsdName: null, manifestNo: null, cotRef: null
          }
        ];
        samples.forEach(s => firestore.collection('pco_inventory').doc(s.containerId).set(s));
      }
    });

    firestore.collection('pco_permits').limit(1).get().then(snap => {
      if (snap.empty) {
        console.log("Seeding sample PCO permit records...");
        const samples = [
          {
            permitId: "PERMIT-WDP-2026",
            permitType: "Wastewater Discharge Permit",
            permitNo: "WDP-R12-2026-049",
            dateIssued: "2026-01-15",
            expiryDate: "2027-01-15",
            attachedFileUrl: "",
            reminderDaysBefore: [90, 60, 30],
            status: "active"
          },
          {
            permitId: "PERMIT-PTO-2026",
            permitType: "Permit to Operate (Air)",
            permitNo: "PTO-R12-2026-881",
            dateIssued: "2026-02-10",
            expiryDate: "2027-02-10",
            attachedFileUrl: "",
            reminderDaysBefore: [90, 60, 30],
            status: "active"
          },
          {
            permitId: "PERMIT-HWID-2026",
            permitType: "Hazardous Waste ID",
            permitNo: "GR-R12-47-0091",
            dateIssued: "2025-08-20",
            expiryDate: "2028-08-20",
            attachedFileUrl: "",
            reminderDaysBefore: [90, 60, 30],
            status: "active"
          }
        ];
        samples.forEach(s => firestore.collection('pco_permits').doc(s.permitId).set(s));
      }
    });
  }

  // 1. DASHBOARD VIEW RENDERER
  function renderPcoDashboardView() {
    const viewport = document.getElementById('viewport-body');
    if (!viewport) return;

    viewport.innerHTML = `
      <div class="home-greeting-card" style="padding: 24px; background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
        <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--pco-primary); margin: 0 0 8px 0;">🌿 PCO Executive Center</h2>
        <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Real-time university environmental compliance tracking, waste registers, and air emissions monitoring ledger.</p>
      </div>

      ${renderSubTabs('dashboard', [
        { id: 'overview', label: '📊 Dashboard Overview' },
        { id: 'analytics', label: '📈 Analytics Hub' },
        { id: 'admin', label: '⚙️ PCO Settings & Registry' }
      ])}

      <div id="pco-dashboard-view-container">
        <!-- Overview Sub-Tab -->
        <div class="pco-subtab-content active" id="pco-dashboard-sub-overview">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; text-align: left;">
            <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px;">
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Overall Compliance</div>
              <div style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: var(--pco-primary);">96%</div>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px;">
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Active Carboys</div>
              <div id="pco-dash-carboys-liters" style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: var(--text-main);">...</div>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px;">
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Generator Run Hours</div>
              <div id="pco-dash-gen-hours" style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: #3b82f6;">...</div>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border-card); padding: 18px; border-radius: 14px;">
              <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Open Spills / Incidents</div>
              <div id="pco-dash-active-spills" style="font-size: 28px; font-weight: 800; font-family: 'Outfit', sans-serif; margin-top: 6px; color: var(--pco-alert);">...</div>
            </div>
          </div>

          <!-- Compliance Summary Panels -->
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align:left;">
            <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 20px;">
              <h3 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; font-family: 'Outfit', sans-serif; color: var(--text-main);">📋 Environmental Permit Expirations</h3>
              <div id="pco-dash-permits-container" style="display:flex; flex-direction:column; gap:10px;">
                <div style="font-size:12.5px; color:var(--text-muted);">Loading permit states...</div>
              </div>
            </div>

            <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 20px;">
              <h3 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; font-family: 'Outfit', sans-serif; color: var(--text-main);">🌿 Critical Compliance Alerts</h3>
              <div id="pco-dash-alerts-container" style="display:flex; flex-direction:column; gap:10px;">
                <div style="font-size:12.5px; color:var(--text-muted);">Scanning files and databases...</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Analytics Sub-Tab -->
        <div class="pco-subtab-content" id="pco-dashboard-sub-analytics">
          <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 24px; text-align: left; margin-bottom:20px;">
            <h3 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif;">📊 Dynamic Solid Waste Divert Rate</h3>
            <p style="margin: 0 0 18px 0; font-size:13px; color:var(--text-muted);">Daily diversion tracking of biodegradable vs. recyclable waste parameters on campus.</p>
            <div style="height:200px; display:flex; align-items:flex-end; gap:20px; border-bottom: 2px solid var(--border-card); padding-bottom:10px; margin-top:20px;" id="pco-solid-waste-chart">
              <!-- Rendered dynamically -->
            </div>
          </div>
          <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 24px; text-align: left;">
            <h3 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif;">🧪 Wastewater Laboratory sink pH Trends</h3>
            <p style="margin: 0 0 18px 0; font-size:13px; color:var(--text-muted);">pH measurements of student laboratory sink discharges over the last 10 records.</p>
            <div style="height:200px; display:flex; align-items:flex-end; gap:10px; border-bottom: 2px solid var(--border-card); padding-bottom:10px; margin-top:20px;" id="pco-ph-trend-chart">
              <!-- Rendered dynamically -->
            </div>
          </div>
        </div>

        <!-- Administration Sub-Tab -->
        <div class="pco-subtab-content" id="pco-dashboard-sub-admin">
          <div style="background: var(--bg-card); border: 1px solid var(--border-card); border-radius: 16px; padding: 24px; text-align: left; margin-bottom:20px;">
            <h3 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 700; font-family: 'Outfit', sans-serif;">🌿 Configure Threshold Limits</h3>
            <form onsubmit="savePcoSettings(event)" style="display:flex; flex-direction:column; gap:12px; max-width:400px;">
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">90-day Hazardous Storage Alert (Days):</label>
                <input type="number" id="pco-setting-days" value="80" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
              </div>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Wastewater pH Warning Threshold Low:</label>
                <input type="number" id="pco-setting-ph-low" value="6.0" step="0.1" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
              </div>
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Wastewater pH Warning Threshold High:</label>
                <input type="number" id="pco-setting-ph-high" value="9.0" step="0.1" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
              </div>
              <button type="submit" class="settings-btn-primary" style="width:auto; margin:0; padding:10px 20px; font-size:13px; background:var(--pco-primary); color:white;">💾 Save Threshold Values</button>
            </form>
          </div>
        </div>
      </div>
    `;

    loadPcoDashboardData();
  }

  function loadPcoDashboardData() {
    // 1. Query carboys
    firestore.collection('pco_inventory').where('status', '==', 'active').get().then(snap => {
      cache.inventory = [];
      let totalVol = 0;
      snap.forEach(doc => {
        const d = doc.data();
        cache.inventory.push(d);
        totalVol += parseFloat(d.currentVolume || 0);
      });
      const carboyLabel = document.getElementById('pco-dash-carboys-liters');
      if (carboyLabel) carboyLabel.innerText = `${totalVol.toFixed(1)} L`;
      renderDashboardAlerts();
    });

    // 2. Query generators
    firestore.collection('pco_generators').get().then(snap => {
      cache.generators = [];
      let totalHrs = 0;
      snap.forEach(doc => {
        const d = doc.data();
        cache.generators.push(d);
        totalHrs += parseFloat(d.runHours || 0);
      });
      const genLabel = document.getElementById('pco-dash-gen-hours');
      if (genLabel) genLabel.innerText = `${totalHrs.toFixed(1)} hrs`;
    });

    // 3. Query spills
    firestore.collection('pco_incidents').where('status', '!=', 'closed').get().then(snap => {
      cache.incidents = [];
      snap.forEach(doc => {
        cache.incidents.push(doc.data());
      });
      const spillLabel = document.getElementById('pco-dash-active-spills');
      if (spillLabel) spillLabel.innerText = snap.size;
    });

    // 4. Query permits & count expiry
    firestore.collection('pco_permits').get().then(snap => {
      cache.permits = [];
      let html = '';
      const today = new Date();
      snap.forEach(doc => {
        const d = doc.data();
        cache.permits.push(d);

        const expDateObj = new Date(d.expiryDate);
        const diffTime = expDateObj - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let stateColor = 'var(--correct)';
        if (diffDays < 0) {
          stateColor = 'var(--pco-alert)';
        } else if (diffDays <= 30) {
          stateColor = 'var(--pco-warning)';
        }

        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.02); padding: 8px 0;">
            <div>
              <strong style="color:var(--text-main); font-size:13px;">${escapeHtml(d.permitType)}</strong>
              <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(d.permitNo)}</div>
            </div>
            <div style="text-align:right;">
              <span style="color:${stateColor}; font-weight:700; font-size:12px;">
                ${diffDays < 0 ? 'Expired' : `${diffDays} days left`}
              </span>
              <div style="font-size:10px; color:var(--text-muted);">Expiry: ${d.expiryDate}</div>
            </div>
          </div>
        `;
      });
      const permContainer = document.getElementById('pco-dash-permits-container');
      if (permContainer) {
        permContainer.innerHTML = html || `<div style="font-size:12.5px; color:var(--text-muted);">No permits in database.</div>`;
      }
    });

    // 5. Query wastewater
    firestore.collection('pco_wastewater').get().then(snap => {
      cache.wastewater = [];
      snap.forEach(doc => cache.wastewater.push(doc.data()));
      renderWastewaterChart();
    });

    // 6. Query solid waste
    firestore.collection('pco_solid_waste').get().then(snap => {
      cache.solidWaste = [];
      snap.forEach(doc => cache.solidWaste.push(doc.data()));
      renderSolidWasteChart();
    });
  }

  function renderDashboardAlerts() {
    const alertsContainer = document.getElementById('pco-dash-alerts-container');
    if (!alertsContainer) return;

    let alertsHTML = '';
    
    // Check Carboy ages and capacities
    const thresholdDays = parseInt(document.getElementById('pco-setting-days')?.value || '80', 10);
    const today = new Date();

    cache.inventory.forEach(c => {
      const started = new Date(c.dateStarted);
      const diffTime = today - started;
      const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const isOverCapacity = c.currentVolume >= c.capacityLiters * 0.9;
      
      if (ageDays >= thresholdDays) {
        alertsHTML += `
          <div style="background:rgba(239,68,68,0.06); border-left:4px solid var(--pco-alert); padding:10px; border-radius:4px; font-size:12.5px; margin-bottom:8px;">
            ⚠️ <strong>Carboy ${c.containerId} Limit Alert</strong>: Spent solvent container has accumulated for <strong>${ageDays} days</strong> (limit ${c.daysLimit} days). Immediate transfer to HWSF required.
          </div>
        `;
      }
      if (isOverCapacity) {
        alertsHTML += `
          <div style="background:rgba(245,158,11,0.06); border-left:4px solid var(--pco-warning); padding:10px; border-radius:4px; font-size:12.5px; margin-bottom:8px;">
            ⚡ <strong>Carboy ${c.containerId} Capacity Warning</strong>: Container volume is at <strong>${((c.currentVolume/c.capacityLiters)*100).toFixed(0)}%</strong> (${c.currentVolume}L / ${c.capacityLiters}L).
          </div>
        `;
      }
    });

    // Pathological waste alert (mock or from documents catalog findings)
    alertsHTML += `
      <div style="background:rgba(239,68,68,0.06); border-left:4px solid var(--pco-alert); padding:10px; border-radius:4px; font-size:12.5px; margin-bottom:8px;">
        ⚠️ <strong>College of Medicine Pathological Waste</strong>: 420 liters of pathological waste (formalin) has accumulated on-site. Immediate TSD disposal agreement required.
      </div>
    `;

    alertsContainer.innerHTML = alertsHTML || `<div style="font-size:12.5px; color:var(--text-muted);">✅ All environmental aspects within normal boundaries. No active alerts.</div>`;
  }

  function renderSolidWasteChart() {
    const chart = document.getElementById('pco-solid-waste-chart');
    if (!chart) return;

    if (cache.solidWaste.length === 0) {
      chart.innerHTML = `<div style="font-size:12.5px; color:var(--text-muted); text-align:center; width:100%;">No solid waste records available.</div>`;
      return;
    }

    // Sort logs by date
    const sorted = [...cache.solidWaste].sort((a,b) => a.date.localeCompare(b.date)).slice(-5);
    
    let html = '';
    sorted.forEach(log => {
      const total = log.biodegradableKg + log.recyclableKg + log.residualKg;
      const bioPct = total > 0 ? (log.biodegradableKg / total) * 100 : 0;
      const recPct = total > 0 ? (log.recyclableKg / total) * 100 : 0;
      const resPct = total > 0 ? (log.residualKg / total) * 100 : 0;

      html += `
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:8px;">
          <div style="width:100%; display:flex; flex-direction:column; height:150px; background:rgba(255,255,255,0.03); border-radius:4px; overflow:hidden; justify-content:flex-end;">
            <div style="height:${bioPct}%; background:#10b981;" title="Biodegradable: ${log.biodegradableKg}kg"></div>
            <div style="height:${recPct}%; background:#3b82f6;" title="Recyclable: ${log.recyclableKg}kg"></div>
            <div style="height:${resPct}%; background:#ef4444;" title="Residual: ${log.residualKg}kg"></div>
          </div>
          <div style="font-size:10px; color:var(--text-muted); font-family:monospace;">${log.date.substring(5)}</div>
        </div>
      `;
    });
    
    chart.innerHTML = html;
  }

  function renderWastewaterChart() {
    const chart = document.getElementById('pco-ph-trend-chart');
    if (!chart) return;

    if (cache.wastewater.length === 0) {
      chart.innerHTML = `<div style="font-size:12.5px; color:var(--text-muted); text-align:center; width:100%;">No wastewater pH records available.</div>`;
      return;
    }

    const sorted = [...cache.wastewater].sort((a,b) => a.date.localeCompare(b.date)).slice(-10);
    const lowLimit = parseFloat(document.getElementById('pco-setting-ph-low')?.value || '6.0');
    const highLimit = parseFloat(document.getElementById('pco-setting-ph-high')?.value || '9.0');

    let html = '';
    sorted.forEach(log => {
      const ph = log.phValue;
      const heightPct = (ph / 14) * 100;
      const isViolating = ph < lowLimit || ph > highLimit;
      const barColor = isViolating ? 'var(--pco-alert)' : 'var(--pco-primary)';

      html += `
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:8px;">
          <div style="width:100%; display:flex; flex-direction:column; height:150px; background:rgba(255,255,255,0.03); border-radius:4px; overflow:hidden; justify-content:flex-end; position:relative;">
            <!-- Low limit line marker -->
            <div style="position:absolute; bottom:${(lowLimit/14)*100}%; left:0; width:100%; border-bottom:1px dashed rgba(239,68,68,0.4);"></div>
            <!-- High limit line marker -->
            <div style="position:absolute; bottom:${(highLimit/14)*100}%; left:0; width:100%; border-bottom:1px dashed rgba(239,68,68,0.4);"></div>
            <div style="height:${heightPct}%; background:${barColor};" title="pH: ${ph} on ${log.date}"></div>
          </div>
          <div style="font-size:11px; font-weight:700; color:var(--text-main);">${ph.toFixed(1)}</div>
          <div style="font-size:9.5px; color:var(--text-muted); font-family:monospace;">${log.date.substring(5)}</div>
        </div>
      `;
    });

    chart.innerHTML = html;
  }

  function savePcoSettings(event) {
    event.preventDefault();
    showCustomAlert("PCO configuration thresholds saved successfully!", "success");
    renderDashboardAlerts();
    renderWastewaterChart();
  }
  window.savePcoSettings = saveSettings => {}; // bind to window
  

  // 2. WASTE LEDGER VIEW RENDERER
  function renderPcoWasteView() {
    const viewport = document.getElementById('viewport-body');
    if (!viewport) return;

    viewport.innerHTML = `
      <div class="home-greeting-card" style="padding: 24px; background: rgba(13,148,136,0.05); border: 1px solid rgba(13,148,136,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
        <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--pco-primary); margin: 0 0 8px 0;">📋 Campus Waste & Effluent Ledger</h2>
        <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Detailed records tracking chemical carboy liquid volumes, GSO solid wastes weight, and sink discharge pH neutralizing audits.</p>
      </div>

      ${renderSubTabs('waste', [
        { id: 'hazardous', label: '🧪 Hazardous Chemical Waste' },
        { id: 'solid', label: '🍂 GSO Solid Waste weights' },
        { id: 'wastewater', label: '💧 Laboratory Wastewater pH logs' }
      ])}

      <div id="pco-waste-view-container">
        <!-- Hazardous Waste Sub-tab -->
        <div class="pco-subtab-content active" id="pco-waste-sub-hazardous">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="margin:0; font-size:15px; font-weight:700; font-family:'Outfit',sans-serif;">Active Accumulation Carboys</h3>
            <button class="settings-btn-primary" onclick="triggerPcoCarboyForm()" style="width:auto; margin:0; padding:8px 16px; font-size:12px; background:var(--pco-primary); color:white;">➕ Log New Carboy</button>
          </div>
          <div id="pco-carboys-list" class="carboy-grid">
            <div style="font-size:12.5px; color:var(--text-muted);">Loading active carboys...</div>
          </div>
        </div>

        <!-- Solid Waste Sub-tab -->
        <div class="pco-subtab-content" id="pco-waste-sub-solid">
          <div style="display:grid; grid-template-columns: 1fr 320px; gap:20px; text-align:left;">
            <!-- Table List -->
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px;">
              <h3 style="margin:0 0 14px 0; font-size:14px; font-weight:700;">GSO Daily Waste Logs</h3>
              <div style="overflow-x:auto;">
                <table class="gradebook-table" style="width:100%;">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Source Location</th>
                      <th>Biodegradable (kg)</th>
                      <th>Recyclable (kg)</th>
                      <th>Residual (kg)</th>
                      <th>Logged By</th>
                    </tr>
                  </thead>
                  <tbody id="pco-solid-waste-table-body">
                    <tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Loading logs...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            <!-- Log Form -->
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; height:fit-content;">
              <h3 style="margin:0 0 14px 0; font-size:14px; font-weight:700;">🍂 Log GSO Waste Weights</h3>
              <form id="pco-solid-waste-form" onsubmit="submitPcoSolidWaste(event)" style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Source Campus Location:</label>
                  <input type="text" id="pco-sw-location" placeholder="e.g. CNSM Ladies Dormitory Main" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Date:</label>
                  <input type="date" id="pco-sw-date" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Biodegradable (kg):</label>
                  <input type="number" id="pco-sw-biodegradable" step="0.1" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Recyclable (kg):</label>
                  <input type="number" id="pco-sw-recyclable" step="0.1" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Residual / Non-Recyclable (kg):</label>
                  <input type="number" id="pco-sw-residual" step="0.1" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <button type="submit" class="settings-btn-primary" style="width:100%; margin-top:8px; background:var(--pco-primary); color:white;">💾 Save Solid Waste Log</button>
              </form>
            </div>
          </div>
        </div>

        <!-- Wastewater Sub-tab -->
        <div class="pco-subtab-content" id="pco-waste-sub-wastewater">
          <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left;">
            <h3 style="margin:0 0 14px 0; font-size:14px; font-weight:700;">💧 Lab Sinks Neutralization & pH Audit Ledger</h3>
            <div style="overflow-x:auto;">
              <table class="gradebook-table" style="width:100%;">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Location</th>
                    <th>pH Value</th>
                    <th>Volume (L)</th>
                    <th>Neutralized?</th>
                    <th>Agent Used</th>
                    <th>Logged By</th>
                  </tr>
                </thead>
                <tbody id="pco-wastewater-table-body">
                  <tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">Loading wastewater logs...</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    loadPcoWasteData();
  }

  function loadPcoWasteData() {
    // 1. Carboys
    firestore.collection('pco_inventory').get().then(snap => {
      const container = document.getElementById('pco-carboys-list');
      if (!container) return;

      if (snap.empty) {
        container.innerHTML = `<div class="empty-playlist-msg" style="width:100%;">No chemical carboys in inventory. Log a new container to begin accumulation.</div>`;
        return;
      }

      let html = '';
      const today = new Date();
      snap.forEach(doc => {
        const c = doc.data();
        const fillPct = (c.currentVolume / c.capacityLiters) * 100;
        
        const started = new Date(c.dateStarted);
        const diffTime = today - started;
        const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let barClass = '';
        if (ageDays >= 80) {
          barClass = 'alert';
        } else if (fillPct >= 90) {
          barClass = 'warning';
        }

        html += `
          <div class="carboy-card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <span style="font-weight:800; font-family:'Outfit',sans-serif; color:var(--text-main); font-size:14px;">${c.containerId}</span>
              ${getStatusBadge(c.status)}
            </div>
            
            <div style="margin:10px 0;">
              <div class="carboy-indicator-container">
                <div class="carboy-liquid ${barClass}" style="height:${Math.min(100, fillPct)}%;"></div>
              </div>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--text-muted);">
              <div>Code: <strong style="color:var(--text-main);">${c.wasteCode}</strong></div>
              <div>Vol: <strong style="color:var(--text-main);">${c.currentVolume.toFixed(1)}L / ${c.capacityLiters}L</strong></div>
              <div>Accumulated: <span style="color:${ageDays >= 80 ? 'var(--pco-alert)' : 'var(--text-main)'}; font-weight:700;">${ageDays} days</span></div>
              <div style="font-size:10px; font-family:monospace; margin-top:2px;">Location: ${escapeHtml(c.location)}</div>
            </div>

            <button class="settings-btn-primary" onclick="showPcoCarboyDetails('${c.containerId}')" style="width:100%; margin:4px 0 0 0; padding:6px 12px; font-size:11px; background:rgba(255,255,255,0.06); border:1px solid var(--border-card); color:var(--text-main);">🔍 View Deposits</button>
          </div>
        `;
      });
      container.innerHTML = html;
    });

    // 2. Solid Waste table
    firestore.collection('pco_solid_waste').get().then(snap => {
      const tbody = document.getElementById('pco-solid-waste-table-body');
      if (!tbody) return;

      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No solid waste weight logs recorded.</td></tr>`;
        return;
      }

      let logs = [];
      snap.forEach(doc => logs.push(doc.data()));
      logs.sort((a,b) => b.date.localeCompare(a.date));

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td style="font-weight:700; color:var(--text-main);">${l.date}</td>
          <td>${escapeHtml(l.sourceLocation)}</td>
          <td>${l.biodegradableKg.toFixed(1)} kg</td>
          <td>${l.recyclableKg.toFixed(1)} kg</td>
          <td>${l.residualKg.toFixed(1)} kg</td>
          <td style="font-size:11px; color:var(--text-muted);">${escapeHtml(l.loggedBy)}</td>
        </tr>
      `).join('');
    });

    // 3. Wastewater table
    firestore.collection('pco_wastewater').get().then(snap => {
      const tbody = document.getElementById('pco-wastewater-table-body');
      if (!tbody) return;

      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">No wastewater records in database.</td></tr>`;
        return;
      }

      let logs = [];
      snap.forEach(doc => logs.push(doc.data()));
      logs.sort((a,b) => b.date.localeCompare(a.date));

      const lowLimit = parseFloat(document.getElementById('pco-setting-ph-low')?.value || '6.0');
      const highLimit = parseFloat(document.getElementById('pco-setting-ph-high')?.value || '9.0');

      tbody.innerHTML = logs.map(l => {
        const outOfBounds = l.phValue < lowLimit || l.phValue > highLimit;
        const phColor = outOfBounds ? 'var(--pco-alert)' : 'var(--pco-primary)';

        return `
          <tr>
            <td>${l.date}</td>
            <td>${escapeHtml(l.location)}</td>
            <td style="font-weight:900; color:${phColor}; font-size:13.5px;">${l.phValue.toFixed(2)}</td>
            <td>${l.volumeLiters.toFixed(1)} L</td>
            <td>${l.neutralizationDone ? '<span style="color:var(--pco-primary); font-weight:700;">YES</span>' : '<span style="color:var(--text-muted);">NO</span>'}</td>
            <td>${escapeHtml(l.neutralizingAgent || 'None')}</td>
            <td style="font-size:11px; color:var(--text-muted);">${escapeHtml(l.loggedBy)}</td>
          </tr>
        `;
      }).join('');
    });
  }

  function triggerPcoCarboyForm() {
    const todayStr = new Date().toISOString().substring(0,10);
    const bodyHTML = `
      <form id="pco-carboy-register-form" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Carboy ID Code:</label>
          <input type="text" id="pco-cb-id" required placeholder="e.g. CB-CNMS-2026-003" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Waste Code (RA 6969):</label>
          <select id="pco-cb-waste-code" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; cursor:pointer;">
            <option value="G703">G703 (Halogenated Organic Solvents)</option>
            <option value="G704">G704 (Non-Halogenated Organic Solvents)</option>
            <option value="F610">F610 (Formalin / Formaldehyde)</option>
            <option value="B201">B201 (Sulfuric Acid)</option>
            <option value="B202">B202 (Hydrochloric Acid)</option>
            <option value="C301">C301 (Caustic Soda - NaOH)</option>
            <option value="I101">I101 (Used Industrial / Generator Oil)</option>
            <option value="I102">I102 (Used Cooking Oil)</option>
          </select>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Liters Capacity:</label>
          <input type="number" id="pco-cb-capacity" required value="20" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Campus Storage Location:</label>
          <input type="text" id="pco-cb-location" required value="CNMS Chemistry Stockroom" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Accumulation Start Date:</label>
          <input type="date" id="pco-cb-start" required value="${todayStr}" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
      </form>
    `;
    const footerHTML = `
      <button class="settings-btn-primary" onclick="closeActionDrawer()" style="width:auto; margin:0; padding:10px 16px; background:rgba(255,255,255,0.06); color:var(--text-muted); border:1px solid var(--border-card);">Cancel</button>
      <button class="settings-btn-primary" onclick="submitPcoCarboy()" style="width:auto; margin:0; padding:10px 20px; background:var(--pco-primary); color:white;">💾 Register Container</button>
    `;
    openActionDrawer("➕ Register Accumulation Carboy", bodyHTML, footerHTML);
  }
  window.triggerPcoCarboyForm = triggerPcoCarboyForm;

  function submitPcoCarboy() {
    if (!hasPcoWriteAccess('waste')) {
      alert("Permission Denied: Only PCO Head or PCO Laboratory subroles can register waste carboys.");
      return;
    }
    const id = document.getElementById('pco-cb-id').value.trim().toUpperCase();
    const wasteCode = document.getElementById('pco-cb-waste-code').value;
    const capacity = parseFloat(document.getElementById('pco-cb-capacity').value);
    const location = document.getElementById('pco-cb-location').value.trim();
    const startDate = document.getElementById('pco-cb-start').value;

    if (!id || !capacity || !location || !startDate) {
      alert("Please fill in all carboy parameters.");
      return;
    }

    firestore.collection('pco_inventory').doc(id).set({
      containerId: id,
      wasteCode: wasteCode,
      description: `Active carboy spent chemicals: ${wasteCode}`,
      capacityLiters: capacity,
      currentVolume: 0.0,
      location: location,
      status: "active",
      dateStarted: startDate + "T08:00:00Z",
      daysLimit: 90,
      deposits: [],
      transporterName: null, tsdName: null, manifestNo: null, cotRef: null
    })
    .then(() => {
      alert("Carboy registered successfully!");
      closeActionDrawer();
      loadPcoWasteData();
    })
    .catch(err => alert("Error: " + err.message));
  }
  window.submitPcoCarboy = submitPcoCarboy;

  function showPcoCarboyDetails(containerId) {
    firestore.collection('pco_inventory').doc(containerId).get().then(doc => {
      if (!doc.exists) return;
      const c = doc.data();
      const depositsHTML = c.deposits && c.deposits.length > 0 
        ? c.deposits.map(d => `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed var(--border-card); padding:8px 0; font-size:12px;">
              <div>
                <strong>+${parseFloat(d.volume).toFixed(1)} Liters</strong>
                <div style="font-size:10px; color:var(--text-muted);">By: ${escapeHtml(d.loggedBy)}</div>
              </div>
              <div style="font-family:monospace; color:var(--text-muted);">${new Date(d.date).toLocaleString()}</div>
            </div>
          `).join('')
        : `<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:12.5px;">No chemical deposits logged in this container yet.</div>`;

      const bodyHTML = `
        <div style="text-align:left; font-family:'Outfit',sans-serif;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; background:rgba(255,255,255,0.01); border:1px solid var(--border-card); padding:12px; border-radius:8px;">
            <div>
              <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted);">Current Volume Status</div>
              <div style="font-size:20px; font-weight:800; color:var(--pco-primary);">${c.currentVolume}L / ${c.capacityLiters}L</div>
            </div>
            <div>
              <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted); text-align:right;">Waste Code</div>
              <div style="font-size:18px; font-weight:800; text-align:right;">${c.wasteCode}</div>
            </div>
          </div>
          <h4 style="font-size:12px; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">Deposits Log History</h4>
          <div style="max-height:220px; overflow-y:auto; padding-right:6px;">
            ${depositsHTML}
          </div>
        </div>
      `;
      const footerHTML = `
        <button class="settings-btn-primary" onclick="closeActionDrawer()" style="width:auto; margin:0; padding:10px 18px; background:rgba(255,255,255,0.06); color:var(--text-muted); border:1px solid var(--border-card);">Close</button>
      `;
      openActionDrawer(`Carboy Log: ${c.containerId}`, bodyHTML, footerHTML);
    });
  }
  window.showPcoCarboyDetails = showPcoCarboyDetails;

  function submitPcoSolidWaste(event) {
    event.preventDefault();
    if (!hasPcoWriteAccess('waste')) {
      alert("Permission Denied: Only PCO Head or PCO Laboratory subroles can log solid waste weights.");
      return;
    }
    const loc = document.getElementById('pco-sw-location').value.trim();
    const date = document.getElementById('pco-sw-date').value;
    const bio = parseFloat(document.getElementById('pco-sw-biodegradable').value);
    const rec = parseFloat(document.getElementById('pco-sw-recyclable').value);
    const res = parseFloat(document.getElementById('pco-sw-residual').value);

    if (!loc || !date || isNaN(bio) || isNaN(rec) || isNaN(res)) return;

    firestore.collection('pco_solid_waste').add({
      logId: "SW-LOG-" + Date.now(),
      date: date,
      biodegradableKg: bio,
      recyclableKg: rec,
      residualKg: res,
      sourceLocation: loc,
      loggedBy: currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      alert("Solid waste entry logged!");
      document.getElementById('pco-solid-waste-form').reset();
      loadPcoWasteData();
    })
    .catch(err => alert("Error: " + err.message));
  }
  window.submitPcoSolidWaste = submitPcoSolidWaste;


  // 3. AIR EMISSIONS VIEW RENDERER
  function renderPcoGeneratorsView() {
    const viewport = document.getElementById('viewport-body');
    if (!viewport) return;

    viewport.innerHTML = `
      <div class="home-greeting-card" style="padding: 24px; background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
        <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: #3b82f6; margin: 0 0 8px 0;">⚡ Air Emissions (Generator Logs)</h2>
        <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Monitor and record campus standby diesel generators (APSE) runtime hours, fuel inventories, and smoke opacity compliance audits.</p>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 340px; gap:20px; text-align:left;">
        <!-- Logs List Table -->
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px;">
          <h3 style="margin:0 0 14px 0; font-size:14px; font-weight:700;">Generator Operation History</h3>
          <div style="overflow-x:auto;">
            <table class="gradebook-table" style="width:100%;">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Generator Unit</th>
                  <th>Run Hours</th>
                  <th>Fuel Used (L)</th>
                  <th>Fuel Added (L)</th>
                  <th>Purpose</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody id="pco-generators-table-body">
                <tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">Loading logs...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Log Entry Form -->
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; height:fit-content;">
          <h3 style="margin:0 0 14px 0; font-size:14px; font-weight:700;">⚡ Log Generator Run</h3>
          <form id="pco-generator-form" onsubmit="submitPcoGeneratorLog(event)" style="display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Generator Unit:</label>
              <select id="pco-gen-id" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none; cursor:pointer;">
                <option value="fatima_gen_1">Fatima Main Campus Gen 1 (150 kVA)</option>
                <option value="admin_gen_2">Admin Building Gen 2 (75 kVA)</option>
              </select>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Date:</label>
              <input type="date" id="pco-gen-date" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Runtime Hours:</label>
              <input type="number" id="pco-gen-hours" step="0.1" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Fuel Consumed (Liters):</label>
              <input type="number" id="pco-gen-fuel-used" step="0.1" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Fuel Added (Liters):</label>
              <input type="number" id="pco-gen-fuel-added" step="0.1" value="0" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Run Purpose / remarks:</label>
              <input type="text" id="pco-gen-purpose" placeholder="e.g. Campus brownout support / PPD tests" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
            </div>
            <button type="submit" class="settings-btn-primary" style="width:100%; margin-top:8px; background:#3b82f6; color:white;">💾 Save Generator Log</button>
          </form>
        </div>
      </div>
    `;

    loadPcoGeneratorsData();
  }

  function loadPcoGeneratorsData() {
    firestore.collection('pco_generators').get().then(snap => {
      const tbody = document.getElementById('pco-generators-table-body');
      if (!tbody) return;

      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-muted);">No generator run logs recorded.</td></tr>`;
        return;
      }

      let logs = [];
      snap.forEach(doc => logs.push(doc.data()));
      logs.sort((a,b) => b.date.localeCompare(a.date));

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td>${l.date}</td>
          <td style="font-weight:700; color:var(--text-main);">${l.generatorId === 'fatima_gen_1' ? 'Fatima Campus Gen 1' : 'Admin Building Gen 2'}</td>
          <td>${l.runHours.toFixed(1)} hrs</td>
          <td>${l.fuelConsumedLiters.toFixed(1)} L</td>
          <td>${l.fuelAddedLiters.toFixed(1)} L</td>
          <td style="font-size:12px; color:var(--text-muted);">${escapeHtml(l.purpose)}</td>
          <td style="font-size:11px; color:var(--text-muted);">${escapeHtml(l.loggedBy)}</td>
        </tr>
      `).join('');
    });
  }

  function submitPcoGeneratorLog(event) {
    event.preventDefault();
    if (!hasPcoWriteAccess('generators')) {
      alert("Permission Denied: Only PCO Head or PCO Laboratory subroles can log generator emissions.");
      return;
    }
    const unit = document.getElementById('pco-gen-id').value;
    const date = document.getElementById('pco-gen-date').value;
    const hrs = parseFloat(document.getElementById('pco-gen-hours').value);
    const used = parseFloat(document.getElementById('pco-gen-fuel-used').value);
    const added = parseFloat(document.getElementById('pco-gen-fuel-added').value);
    const purpose = document.getElementById('pco-gen-purpose').value.trim();

    if (!unit || !date || isNaN(hrs) || isNaN(used) || isNaN(added) || !purpose) return;

    firestore.collection('pco_generators').add({
      logId: "GEN-LOG-" + Date.now(),
      generatorId: unit,
      date: date,
      runHours: hrs,
      fuelConsumedLiters: used,
      fuelAddedLiters: added,
      purpose: purpose,
      loggedBy: currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      alert("Generator usage logged successfully!");
      document.getElementById('pco-generator-form').reset();
      loadPcoGeneratorsData();
    })
    .catch(err => alert("Error: " + err.message));
  }
  window.submitPcoGeneratorLog = submitPcoGeneratorLog;


  // 4. PERMITS & COMPLIANCE VIEW RENDERER
  function renderPcoPermitsView() {
    const viewport = document.getElementById('viewport-body');
    if (!viewport) return;

    viewport.innerHTML = `
      <div class="home-greeting-card" style="padding: 24px; background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
        <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--pco-primary); margin: 0 0 8px 0;">📜 Permits Repository & Corrective Actions</h2>
        <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Manage official DENR-EMB compliance certificates, accreditations, and track corrective action plan registers (CAPA).</p>
      </div>

      ${renderSubTabs('permits', [
        { id: 'repository', label: '📁 Permits Repository' },
        { id: 'capa', label: '🛠️ Corrective & Preventive Action (CAPA)' }
      ])}

      <div id="pco-permits-view-container">
        <!-- Permits Repository Sub-tab -->
        <div class="pco-subtab-content active" id="pco-permits-sub-repository">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="margin:0; font-size:15px; font-weight:700;">University Environmental Certificates</h3>
            <button class="settings-btn-primary" onclick="triggerPcoPermitForm()" style="width:auto; margin:0; padding:8px 16px; font-size:12px; background:var(--pco-primary); color:white;">➕ Record Permit</button>
          </div>
          <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left;">
            <table class="gradebook-table" style="width:100%;">
              <thead>
                <tr>
                  <th>Permit Type</th>
                  <th>Permit/License No.</th>
                  <th>Date Issued</th>
                  <th>Expiry Date</th>
                  <th>Countdown / Status</th>
                </tr>
              </thead>
              <tbody id="pco-permits-table-body">
                <tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Loading certificates...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- CAPA Sub-tab -->
        <div class="pco-subtab-content" id="pco-permits-sub-capa">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <h3 style="margin:0; font-size:15px; font-weight:700;">Corrective Action Plan Registers (CAPA)</h3>
            <button class="settings-btn-primary" onclick="triggerPcoCapaForm()" style="width:auto; margin:0; padding:8px 16px; font-size:12px; background:var(--pco-primary); color:white;">➕ Log CAPA Action</button>
          </div>
          <div id="pco-capa-cards-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px; text-align:left;">
            <div style="font-size:12.5px; color:var(--text-muted);">Loading CAPA logs...</div>
          </div>
        </div>
      </div>
    `;

    loadPcoPermitsData();
  }

  function loadPcoPermitsData() {
    // 1. Permits
    firestore.collection('pco_permits').get().then(snap => {
      const tbody = document.getElementById('pco-permits-table-body');
      if (!tbody) return;

      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">No recorded permits. Log a permit certificate to begin tracking.</td></tr>`;
        return;
      }

      let certs = [];
      snap.forEach(doc => certs.push(doc.data()));
      certs.sort((a,b) => a.expiryDate.localeCompare(b.expiryDate));

      const today = new Date();
      tbody.innerHTML = certs.map(c => {
        const expDate = new Date(c.expiryDate);
        const diffTime = expDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let stateBadge = '';
        if (diffDays < 0) {
          stateBadge = `<span style="padding: 4px 8px; border-radius:6px; font-weight:700; font-size:11px; background:rgba(239,68,68,0.1); color:var(--pco-alert);">EXPIRED</span>`;
        } else if (diffDays <= 30) {
          stateBadge = `<span style="padding: 4px 8px; border-radius:6px; font-weight:700; font-size:11px; background:rgba(245,158,11,0.1); color:var(--pco-warning);">${diffDays} Days Left</span>`;
        } else {
          stateBadge = `<span style="padding: 4px 8px; border-radius:6px; font-weight:700; font-size:11px; background:rgba(16,185,129,0.1); color:var(--pco-primary);">${diffDays} Days Left</span>`;
        }

        return `
          <tr>
            <td style="font-weight:700; color:var(--text-main);">${escapeHtml(c.permitType)}</td>
            <td>${escapeHtml(c.permitNo)}</td>
            <td>${c.dateIssued}</td>
            <td>${c.expiryDate}</td>
            <td>${stateBadge}</td>
          </tr>
        `;
      }).join('');
    });

    // 2. CAPA Cards
    firestore.collection('pco_capa').get().then(snap => {
      const container = document.getElementById('pco-capa-cards-container');
      if (!container) return;

      if (snap.empty) {
        container.innerHTML = `<div class="empty-playlist-msg" style="width:100%;">No active CAPA cases. Log a corrective action card when resolving audits.</div>`;
        return;
      }

      let cards = [];
      snap.forEach(doc => cards.push({ id: doc.id, ...doc.data() }));

      container.innerHTML = cards.map(c => `
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:700; color:var(--text-main); font-size:13px;">${escapeHtml(c.aspect)}</span>
            ${getStatusBadge(c.status)}
          </div>
          <div style="font-size:12.5px; color:var(--text-muted);">
            <div><strong>Finding:</strong> ${escapeHtml(c.description)}</div>
            <div style="margin-top:6px;"><strong>Action Plan:</strong> ${escapeHtml(c.correctiveAction)}</div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed var(--border-card); padding-top:10px; margin-top:4px;">
            <span style="font-size:10.5px; color:var(--text-muted);">Due: ${c.dueDate}</span>
            ${c.status === 'open' ? `<button class="settings-btn-primary" onclick="resolveCapaCard('${c.id}')" style="width:auto; margin:0; padding:4px 8px; font-size:10.5px; background:var(--pco-primary); color:white;">Close CAPA</button>` : ''}
          </div>
        </div>
      `).join('');
    });
  }

  function triggerPcoPermitForm() {
    const todayStr = new Date().toISOString().substring(0,10);
    const bodyHTML = `
      <form id="pco-permit-register-form" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Permit Type / Name:</label>
          <input type="text" id="pco-perm-name" required placeholder="e.g. Wastewater Discharge Permit" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Permit / License No.:</label>
          <input type="text" id="pco-perm-no" required placeholder="e.g. WDP-R12-2026-XXXX" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Date Issued:</label>
          <input type="date" id="pco-perm-issued" required value="${todayStr}" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Expiry Date:</label>
          <input type="date" id="pco-perm-expiry" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
      </form>
    `;
    const footerHTML = `
      <button class="settings-btn-primary" onclick="closeActionDrawer()" style="width:auto; margin:0; padding:10px 16px; background:rgba(255,255,255,0.06); color:var(--text-muted); border:1px solid var(--border-card);">Cancel</button>
      <button class="settings-btn-primary" onclick="submitPcoPermit()" style="width:auto; margin:0; padding:10px 20px; background:var(--pco-primary); color:white;">💾 Register Certificate</button>
    `;
    openActionDrawer("➕ Record Permit Certificate", bodyHTML, footerHTML);
  }
  window.triggerPcoPermitForm = triggerPcoPermitForm;

  function submitPcoPermit() {
    if (!hasPcoWriteAccess('permits')) {
      alert("Permission Denied: Only PCO Head or PCO Office subroles can register compliance certificates.");
      return;
    }
    const name = document.getElementById('pco-perm-name').value.trim();
    const no = document.getElementById('pco-perm-no').value.trim();
    const issued = document.getElementById('pco-perm-issued').value;
    const expiry = document.getElementById('pco-perm-expiry').value;

    if (!name || !no || !issued || !expiry) {
      alert("Please fill in all permit details.");
      return;
    }

    firestore.collection('pco_permits').add({
      permitId: "PERMIT-" + Date.now(),
      permitType: name,
      permitNo: no,
      dateIssued: issued,
      expiryDate: expiry,
      attachedFileUrl: "",
      reminderDaysBefore: [90, 60, 30],
      status: "active"
    })
    .then(() => {
      alert("Permit saved!");
      closeActionDrawer();
      loadPcoPermitsData();
    })
    .catch(err => alert("Error: " + err.message));
  }
  window.submitPcoPermit = submitPcoPermit;

  function triggerPcoCapaForm() {
    const todayStr = new Date().toISOString().substring(0,10);
    const bodyHTML = `
      <form id="pco-capa-register-form" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Aspect / Area affected:</label>
          <input type="text" id="pco-capa-aspect" required placeholder="e.g. Hazardous Waste Storage" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Audit Finding / Hazard Description:</label>
          <textarea id="pco-capa-desc" required placeholder="Describe what went wrong..." style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; height:80px; resize:vertical; outline:none; font-family:inherit;"></textarea>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Corrective & Preventive Action Plan:</label>
          <textarea id="pco-capa-action" required placeholder="Describe the plan to prevent recurrence..." style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; height:80px; resize:vertical; outline:none; font-family:inherit;"></textarea>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Due Date for Completion:</label>
          <input type="date" id="pco-capa-due" required value="${todayStr}" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
        </div>
      </form>
    `;
    const footerHTML = `
      <button class="settings-btn-primary" onclick="closeActionDrawer()" style="width:auto; margin:0; padding:10px 16px; background:rgba(255,255,255,0.06); color:var(--text-muted); border:1px solid var(--border-card);">Cancel</button>
      <button class="settings-btn-primary" onclick="submitPcoCapa()" style="width:auto; margin:0; padding:10px 20px; background:var(--pco-primary); color:white;">💾 Save CAPA Card</button>
    `;
    openActionDrawer("➕ Log Corrective Action (CAPA)", bodyHTML, footerHTML);
  }
  window.triggerPcoCapaForm = triggerPcoCapaForm;

  function submitPcoCapa() {
    if (!hasPcoWriteAccess('permits')) {
      alert("Permission Denied: Only PCO Head or PCO Office subroles can register CAPA cards.");
      return;
    }
    const aspect = document.getElementById('pco-capa-aspect').value.trim();
    const desc = document.getElementById('pco-capa-desc').value.trim();
    const action = document.getElementById('pco-capa-action').value.trim();
    const due = document.getElementById('pco-capa-due').value;

    if (!aspect || !desc || !action || !due) {
      alert("Please fill in all CAPA details.");
      return;
    }

    firestore.collection('pco_capa').add({
      aspect: aspect,
      description: desc,
      correctiveAction: action,
      dueDate: due,
      status: "open",
      loggedBy: currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      alert("CAPA Card logged!");
      closeActionDrawer();
      loadPcoPermitsData();
    })
    .catch(err => alert("Error: " + err.message));
  }
  window.submitPcoCapa = submitPcoCapa;

  function resolveCapaCard(id) {
    if (!hasPcoWriteAccess('permits')) {
      alert("Permission Denied: Only PCO Head or PCO Office subroles can close CAPA cases.");
      return;
    }
    if (!confirm("Are you sure you want to mark this CAPA as resolved/closed?")) return;
    firestore.collection('pco_capa').doc(id).update({
      status: 'closed',
      closedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      alert("CAPA card closed successfully!");
      loadPcoPermitsData();
    })
    .catch(err => alert("Error: " + err.message));
  }
  window.resolveCapaCard = resolveCapaCard;


  // 5. INCIDENTS & ERCP VIEW RENDERER
  function renderPcoIncidentsView() {
    const viewport = document.getElementById('viewport-body');
    if (!viewport) return;

    viewport.innerHTML = `
      <div class="home-greeting-card" style="padding: 24px; background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
        <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--pco-alert); margin: 0 0 8px 0;">🚨 Incidents & Spill Emergency Response</h2>
        <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Log spills, review interactive SPEED COUNTS guidelines, and auto-generate regional EMB incident report forms.</p>
      </div>

      ${renderSubTabs('incidents', [
        { id: 'spills', label: '⚠️ Active Spill Incidents' },
        { id: 'ercp', label: '📖 ERCP Guidelines (SPEED COUNTS)' },
        { id: 'letter', label: '✉️ EMB Region XII Letter Generator' }
      ])}

      <div id="pco-incidents-view-container">
        <!-- Spills Sub-tab -->
        <div class="pco-subtab-content active" id="pco-incidents-sub-spills">
          <div style="display:grid; grid-template-columns: 1fr 320px; gap:20px; text-align:left;">
            <!-- Active list -->
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px;">
              <h3 style="margin:0 0 14px 0; font-size:14px; font-weight:700;">Recorded Spill incidents</h3>
              <div style="overflow-x:auto;">
                <table class="gradebook-table" style="width:100%;">
                  <thead>
                    <tr>
                      <th>Date / Time</th>
                      <th>Location</th>
                      <th>Substance</th>
                      <th>Est Vol (L)</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody id="pco-spills-table-body">
                    <tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Loading logs...</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Report Form -->
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; height:fit-content;">
              <h3 style="margin:0 0 14px 0; font-size:14px; font-weight:700;">⚠️ Report Incident / Spill</h3>
              <form id="pco-incident-form" onsubmit="submitPcoIncident(event)" style="display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Substance Spilled:</label>
                  <input type="text" id="pco-inc-substance" placeholder="e.g. Spent Solvents (G703)" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Date:</label>
                  <input type="date" id="pco-inc-date" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Time:</label>
                  <input type="time" id="pco-inc-time" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Estimated Volume (Liters):</label>
                  <input type="number" id="pco-inc-vol" step="0.1" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Location:</label>
                  <input type="text" id="pco-inc-location" placeholder="e.g. CNSM Chemistry Stockroom" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Response Action taken:</label>
                  <input type="text" id="pco-inc-response" placeholder="e.g. Deployed absorbent pads, locked drainage" required style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; outline:none;">
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Description / Cause:</label>
                  <textarea id="pco-inc-desc" required placeholder="Describe the cause of the leak..." style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; height:60px; resize:vertical; outline:none; font-family:inherit;"></textarea>
                </div>
                <button type="submit" class="settings-btn-primary" style="width:100%; margin-top:8px; background:var(--pco-alert); color:white;">💾 Log Spill Incident</button>
              </form>
            </div>
          </div>
        </div>

        <!-- ERCP (SPEED COUNTS) Sub-tab -->
        <div class="pco-subtab-content" id="pco-incidents-sub-ercp">
          <div style="display:grid; grid-template-columns: 1fr 340px; gap:20px; text-align:left;">
            
            <!-- Protocol Mnemonic Guidelines -->
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:24px;">
              <h3 style="margin:0 0 16px 0; font-size:16px; font-weight:800; font-family:'Outfit',sans-serif; color:var(--pco-alert);">📖 SPEED COUNTS Spill Containment Protocol</h3>
              <p style="font-size:13.5px; color:var(--text-muted); margin-bottom:20px;">Use this mnemonic protocol for immediate spill confinement in stockrooms, laboratories, and engine rooms:</p>
              
              <div style="display:flex; flex-direction:column; gap:14px; font-size:13px;">
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">S</div>
                  <div><strong>Secure the Area & Alert Personnel:</strong> Keep students out of the spill perimeter. Alert nearby stockroom technicians.</div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">P</div>
                  <div><strong>Protect Yourself (PPE):</strong> Immediately put on laboratory goggles, thick nitrile gloves, and chemical aprons before approaching.</div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">E</div>
                  <div><strong>Eliminate Ignition Sources:</strong> Shut off hotplates, electrical outlets, and gas supplies near solvent spills.</div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">E</div>
                  <div><strong>Evaluate Severity & Substance:</strong> Estimate volume and check Safety Data Sheet (SDS) profiles.</div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">D</div>
                  <div><strong>Divert & Dam:</strong> Surround the spill with booms or spill kit absorbent socks. Block drains leading to Sarangani Bay.</div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">C</div>
                  <div><strong>Contain and Absorb:</strong> Deploy chemical absorbent pads or dry sand over the liquid surface.</div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">O</div>
                  <div><strong>Obtain Neutralizers:</strong> Use Sodium Bicarbonate for acids, or Citric Acid for base spills.</div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">U</div>
                  <div><strong>Undertake Decontamination:</strong> Clean the floor surfaces and tools with mild detergent.</div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">N</div>
                  <div><strong>Notify Authorities:</strong> Inform the PCO office and VC for Planning and Development. Notify EMB Region XII within 24h.</div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">T</div>
                  <div><strong>Treat Waste Residues:</strong> Scoop up used absorbents and seal them in yellow bags labeled "Hazardous Waste".</div>
                </div>
                <div style="display:flex; gap:12px; align-items:flex-start;">
                  <div style="font-size:18px; font-weight:900; background:rgba(239,68,68,0.15); color:var(--pco-alert); padding:4px 10px; border-radius:6px; line-height:1.2;">S</div>
                  <div><strong>Submit Incident Log:</strong> Update the digital spill registry for compliance record reviews.</div>
                </div>
              </div>
            </div>
            
            <!-- Side Directories -->
            <div style="display:flex; flex-direction:column; gap:20px;">
              <!-- ERT Contacts -->
              <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px;">
                <h4 style="margin:0 0 12px 0; font-size:13.5px; font-weight:700; font-family:'Outfit',sans-serif; color:var(--text-main);">📞 Campus Emergency Response Team</h4>
                <div style="display:flex; flex-direction:column; gap:10px;">
                  ${EMERGENCY_CONTACTS.map(c => `
                    <div style="border-bottom: 1px dashed rgba(255,255,255,0.02); padding-bottom: 6px;">
                      <div style="font-size:11px; text-transform:uppercase; color:var(--text-muted);">${escapeHtml(c.role)}</div>
                      <div style="font-size:13px; font-weight:700; color:var(--text-main);">${escapeHtml(c.name)}</div>
                      <div style="font-size:12px; font-family:monospace; color:var(--pco-primary); margin-top:2px;">📞 ${c.phone}</div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Hotlines -->
              <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px;">
                <h4 style="margin:0 0 12px 0; font-size:13.5px; font-weight:700; font-family:'Outfit',sans-serif; color:var(--text-main);">📞 Local Emergency Hotlines</h4>
                <div style="display:flex; flex-direction:column; gap:10px;">
                  ${PUBLIC_HOTLINES.map(h => `
                    <div style="border-bottom: 1px dashed rgba(255,255,255,0.02); padding-bottom: 6px;">
                      <div style="font-size:13px; font-weight:700; color:var(--text-main);">${escapeHtml(h.agency)}</div>
                      <div style="font-size:12px; font-family:monospace; color:var(--pco-alert); margin-top:2px;">📞 ${h.phone}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Letter Generator Sub-tab -->
        <div class="pco-subtab-content" id="pco-incidents-sub-letter">
          <div style="display:grid; grid-template-columns: 320px 1fr; gap:20px; text-align:left;">
            <!-- Select incident -->
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; height:fit-content;">
              <h3 style="margin:0 0 12px 0; font-size:14px; font-weight:700;">Select Incident</h3>
              <div style="display:flex; flex-direction:column; gap:8px;" id="pco-letter-incidents-list">
                <!-- Loaded dynamically -->
              </div>
            </div>
            
            <!-- Output Letter -->
            <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-card); padding-bottom:12px; margin-bottom:14px;">
                <h3 style="margin:0; font-size:15px; font-weight:700;">✉️ Prepared Notice Letter</h3>
                <button class="settings-btn-primary" onclick="copyEmbLetterText()" style="width:auto; margin:0; padding:6px 12px; font-size:11px; background:var(--pco-primary); color:white;">📋 Copy Letter Text</button>
              </div>
              <div id="pco-prepared-letter-container" style="background:var(--bg-body); border:1px solid var(--border-card); padding:24px; border-radius:8px; font-family:'Courier New', monospace; font-size:12.5px; color:var(--text-main); white-space:pre-wrap; max-height:480px; overflow-y:auto; line-height:1.4;">
                Select an incident spill from the left list to generate an official 24-hour notification report letter directed to the EMB Region XII office.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    loadPcoIncidentsData();
  }

  function loadPcoIncidentsData() {
    firestore.collection('pco_incidents').get().then(snap => {
      const tbody = document.getElementById('pco-spills-table-body');
      const letterList = document.getElementById('pco-letter-incidents-list');
      if (!tbody) return;

      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">No incident records logged.</td></tr>`;
        if (letterList) letterList.innerHTML = `<div style="font-size:12.5px; color:var(--text-muted);">No incidents logged.</div>`;
        return;
      }

      let list = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      list.sort((a,b) => b.date.localeCompare(a.date));

      // 1. Spills Table
      tbody.innerHTML = list.map(l => `
        <tr>
          <td>${l.date} @ ${l.time}</td>
          <td>${escapeHtml(l.location)}</td>
          <td style="font-weight:700; color:var(--text-main);">${escapeHtml(l.substance)}</td>
          <td>${l.estimatedVolumeLiters.toFixed(1)} L</td>
          <td>${getStatusBadge(l.status)}</td>
          <td>
            ${l.status !== 'closed' ? `<button class="settings-btn-primary" onclick="resolveSpillIncident('${l.id}')" style="width:auto; margin:0; padding:4px 8px; font-size:11px; background:var(--pco-primary); color:white;">Remediate</button>` : '<span style="color:var(--pco-primary); font-weight:700;">RESOLVED</span>'}
          </td>
        </tr>
      `).join('');

      // 2. Letter incident select list
      if (letterList) {
        letterList.innerHTML = list.map(l => `
          <button class="settings-btn-primary" onclick="generatePcoEmbLetter('${l.id}')" style="width:100%; margin:0; padding:10px; font-size:12px; text-align:left; background:rgba(255,255,255,0.02); border:1px solid var(--border-card); color:var(--text-main);">
            ⚠️ ${escapeHtml(l.substance)} (${l.date})
          </button>
        `).join('');
      }
    });
  }

  function submitPcoIncident(event) {
    event.preventDefault();
    if (!hasPcoWriteAccess('incidents')) {
      alert("Permission Denied: Only PCO Head or PCO Office subroles can report/log spill incidents.");
      return;
    }
    const substance = document.getElementById('pco-inc-substance').value.trim();
    const date = document.getElementById('pco-inc-date').value;
    const time = document.getElementById('pco-inc-time').value;
    const vol = parseFloat(document.getElementById('pco-inc-vol').value);
    const location = document.getElementById('pco-inc-location').value.trim();
    const response = document.getElementById('pco-inc-response').value.trim();
    const desc = document.getElementById('pco-inc-desc').value.trim();

    if (!substance || !date || !time || isNaN(vol) || !location || !response || !desc) return;

    firestore.collection('pco_incidents').add({
      incidentId: "INC-" + Date.now(),
      date: date,
      time: time,
      location: location,
      substance: substance,
      estimatedVolumeLiters: vol,
      description: desc,
      responseAction: response,
      status: "reported",
      embNotified24h: true,
      loggedBy: currentUser.email
    })
    .then(() => {
      alert("Spill incident reported and recorded!");
      document.getElementById('pco-incident-form').reset();
      loadPcoIncidentsData();
    })
    .catch(err => alert("Error: " + err.message));
  }
  window.submitPcoIncident = submitPcoIncident;

  function resolveSpillIncident(id) {
    if (!hasPcoWriteAccess('incidents')) {
      alert("Permission Denied: Only PCO Head or PCO Office subroles can close spill incident records.");
      return;
    }
    if (!confirm("Confirm that containment and cleanup decontamination are complete, and this case can be closed?")) return;
    firestore.collection('pco_incidents').doc(id).update({
      status: 'closed',
      responseAction: 'Spill confinement kit deployed. Decontamination and containment complete (Closed).'
    })
    .then(() => {
      alert("Spill incident marked as closed!");
      loadPcoIncidentsData();
    })
    .catch(err => alert("Error: " + err.message));
  }
  window.resolveSpillIncident = resolveSpillIncident;

  function generatePcoEmbLetter(incidentId) {
    firestore.collection('pco_incidents').doc(incidentId).get().then(doc => {
      if (!doc.exists) return;
      const l = doc.data();
      const letterText = `Date: ${new Date().toLocaleDateString()}

THE REGIONAL DIRECTOR
Environmental Management Bureau - Region XII
DENR-EMB Office, Koronadal City

SUBJECT: 24-HOUR ENVIRONMENTAL SPILL INCIDENT NOTIFICATION

Dear Sir/Madam,

In compliance with the reporting guidelines of Republic Act 6969 and the university's Emergency Response and Contingency Plan (ERCP), we are officially submitting this notification regarding an environmental spill on campus:

1. DATE & TIME OF INCIDENT: ${l.date} @ ${l.time}
2. SPECIFIC LOCATION: ${l.location}
3. SUBSTANCE SPILLED: ${l.substance}
4. ESTIMATED QUANTITY: ${l.estimatedVolumeLiters.toFixed(1)} Liters
5. CAUSE & DESCRIPTION: ${l.description}
6. RESPONSE ACTIONS EXECUTED:
   ${l.responseAction}
   SPEED COUNTS safety protocol was immediately executed. Containment booms and spill kits were deployed.

We are currently conducting a detailed post-incident assessment and will submit the final cleanup validation report within the mandated period.

For any immediate verification, please contact our PCO office at 09431354100 or ramon.eduque@msugensan.edu.ph.

Respectfully submitted,

RAMON M. EDUQUE, JR., R.Ch., M.S.
Head Pollution Control Officer
Mindanao State University - General Santos`;

      const box = document.getElementById('pco-prepared-letter-container');
      if (box) box.innerText = letterText;
    });
  }
  window.generatePcoEmbLetter = generatePcoEmbLetter;

  function copyEmbLetterText() {
    const box = document.getElementById('pco-prepared-letter-container');
    if (!box || box.innerText.startsWith('Select')) {
      alert("Please select an incident first.");
      return;
    }
    navigator.clipboard.writeText(box.innerText)
      .then(() => alert("Letter text copied to clipboard!"))
      .catch(err => alert("Clipboard copy failed: " + err.message));
  }
  window.copyEmbLetterText = copyEmbLetterText;


  // 6. SMR COMPILER VIEW RENDERER
  function renderPcoSmrCompiler() {
    const viewport = document.getElementById('viewport-body');
    if (!viewport) return;

    const currentYear = new Date().getFullYear();

    viewport.innerHTML = `
      <div class="home-greeting-card" style="padding: 24px; background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.25); border-radius: 20px; text-align: left; margin-bottom: 24px;">
        <h2 style="font-size: 22px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--pco-primary); margin: 0 0 8px 0;">📊 SMR & Reports Compiler</h2>
        <p style="margin: 0; font-size: 13.5px; color: var(--text-muted);">Quarterly consolidation compiler. Auto-sum and organize wastewater pH audits, solid waste diversion rates, and generator run hours for easy DENR SMR entry.</p>
      </div>

      <!-- Configuration and triggers -->
      <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:20px; text-align:left; display:flex; gap:16px; align-items:flex-end; flex-wrap:wrap; margin-bottom:24px;">
        <div style="display:flex; flex-direction:column; gap:6px; min-width:180px;">
          <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Select Reporting Year:</label>
          <select id="smr-year" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; font-weight:600; outline:none; cursor:pointer;">
            <option value="${currentYear}">${currentYear}</option>
            <option value="${currentYear-1}">${currentYear-1}</option>
          </select>
        </div>
        
        <div style="display:flex; flex-direction:column; gap:6px; min-width:180px;">
          <label style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Select Quarter:</label>
          <select id="smr-quarter" style="padding:10px; border-radius:8px; border:1px solid var(--border-card); background:var(--bg-body); color:var(--text-main); font-size:13px; font-weight:600; outline:none; cursor:pointer;">
            <option value="q1">1st Quarter (Jan - Mar)</option>
            <option value="q2">2nd Quarter (Apr - Jun)</option>
            <option value="q3">3rd Quarter (Jul - Sep)</option>
            <option value="q4" selected>4th Quarter (Oct - Dec)</option>
          </select>
        </div>

        <button class="settings-btn-primary" onclick="compilePcoSmrReport()" style="width:auto; margin:0; padding:10px 24px; font-size:13px; font-weight:600; background:var(--pco-primary); color:white;">📊 Compile SMR Data</button>
      </div>

      <!-- Output details -->
      <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:16px; padding:24px; text-align:left;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; flex-wrap:wrap; gap:12px;">
          <h3 style="margin:0; font-size:15px; font-weight:700;">Compiled SMR Output Table</h3>
          <div style="display:flex; gap:6px;">
            <button class="settings-btn-primary" onclick="exportSmrToExcel()" style="width:auto; margin:0; padding:8px 12px; font-size:12px; background:rgba(255,255,255,0.06); border:1px solid var(--border-card); color:var(--text-main);">📥 Download Excel (.xlsx)</button>
            <button class="settings-btn-primary" onclick="exportSmrToCsv()" style="width:auto; margin:0; padding:8px 12px; font-size:12px; background:rgba(255,255,255,0.06); border:1px solid var(--border-card); color:var(--text-main);">📥 Download CSV</button>
          </div>
        </div>

        <div id="smr-compilation-results" style="overflow-x:auto;">
          <div class="empty-playlist-msg" style="padding:40px 0;">Configure parameters and click "Compile SMR Data" to analyze collections.</div>
        </div>
      </div>
    `;
  }

  // Global cache for compiled results to make download/export simple
  let compiledSmrRows = [];

  let pcoUserMap = {};
  function fetchPcoUserMap() {
    return firestore.collection('students').get().then(snap => {
      snap.forEach(doc => {
        const u = doc.data();
        pcoUserMap[u.email] = u;
      });
    });
  }

  function compilePcoSmrReport() {
    const year = parseInt(document.getElementById('smr-year').value, 10);
    const quarter = document.getElementById('smr-quarter').value;
    const container = document.getElementById('smr-compilation-results');
    if (!container) return;

    container.innerHTML = `<div class="empty-playlist-msg">Compiling database collections...</div>`;

    // Map quarter to months (0-indexed)
    let months = [];
    let monthNames = [];
    if (quarter === 'q1') { months = [0,1,2]; monthNames = ['January', 'February', 'March']; }
    else if (quarter === 'q2') { months = [3,4,5]; monthNames = ['April', 'May', 'June']; }
    else if (quarter === 'q3') { months = [6,7,8]; monthNames = ['July', 'August', 'September']; }
    else if (quarter === 'q4') { months = [9,10,11]; monthNames = ['October', 'November', 'December']; }

    // Fetch user map first to ensure filtering data is accurate
    fetchPcoUserMap().then(() => {
      const subrole = getPcoSubrole();
      const userAff = getPcoAffiliationUnit();
      const userOff = getPcoOffice();

      // Log filter predicate based on hierarchy
      const filterLog = (l) => {
        if (subrole === 'pco_head') return true;
        const logger = pcoUserMap[l.loggedBy || l.submittedBy] || {};
        if (subrole === 'pco_college' || subrole === 'pco_office') {
          return logger.affiliationUnit === userAff || (l.loggedBy === currentUser.email);
        }
        // Laboratory / PPD / GSO / Sanitary: match specific office/location
        return logger.office === userOff || (l.loggedBy === currentUser.email);
      };

      compiledSmrRows = [];

      monthNames.forEach((mName, idx) => {
        const mVal = months[idx];
        
        // Filter generators
        const genLogs = cache.generators.filter(l => {
          const d = new Date(l.date);
          return d.getFullYear() === year && d.getMonth() === mVal && filterLog(l);
        });
        const genHours = genLogs.reduce((sum, l) => sum + parseFloat(l.runHours || 0), 0);
        const fuelUsed = genLogs.reduce((sum, l) => sum + parseFloat(l.fuelConsumedLiters || 0), 0);

        // Filter solid waste
        const swLogs = cache.solidWaste.filter(l => {
          const d = new Date(l.date);
          return d.getFullYear() === year && d.getMonth() === mVal && filterLog(l);
        });
        const bioKg = swLogs.reduce((sum, l) => sum + parseFloat(l.biodegradableKg || 0), 0);
        const recKg = swLogs.reduce((sum, l) => sum + parseFloat(l.recyclableKg || 0), 0);
        const resKg = swLogs.reduce((sum, l) => sum + parseFloat(l.residualKg || 0), 0);

        // Filter wastewater Low/High pH counts
        const wwLogs = cache.wastewater.filter(l => {
          const d = new Date(l.date);
          return d.getFullYear() === year && d.getMonth() === mVal && filterLog(l);
        });
        let phOOBCount = 0;
        wwLogs.forEach(l => {
          if (l.phValue < 6.0 || l.phValue > 9.0) phOOBCount++;
        });

        compiledSmrRows.push({
          month: mName,
          genHours: genHours,
          fuelUsedLiters: fuelUsed,
          biodegradableKg: bioKg,
          recyclableKg: recKg,
          residualKg: resKg,
          wastewaterOOBCount: phOOBCount
        });
      });

      // Check approvals database
      firestore.collection('pco_approvals')
        .where('year', '==', year)
        .where('quarter', '==', quarter)
        .get()
        .then(snap => {
          let statusBadgeHTML = '';
          let actionButtonHTML = '';
          let submissionsHTML = '';

          if (subrole === 'pco_head') {
            if (snap.empty) {
              statusBadgeHTML = '<span style="color:var(--text-muted); font-size:12.5px; font-style:italic;">No category submissions received for this period.</span>';
            } else {
              submissionsHTML = `
                <div style="margin-top: 16px; margin-bottom: 20px; overflow-x:auto;">
                  <h4 style="font-size:13px; color:var(--text-main); margin-bottom:8px; font-weight:700;">Received Sub-category Submissions:</h4>
                  <table class="gradebook-table" style="width:100%; text-align:left; font-size:12px;">
                    <thead>
                      <tr style="background:var(--bg-body); border-bottom:1px solid var(--border-card);">
                        <th style="padding:10px;">Reporter</th>
                        <th style="padding:10px;">Affiliated Unit</th>
                        <th style="padding:10px;">Submission Remarks</th>
                        <th style="padding:10px; text-align:center;">Status</th>
                        <th style="padding:10px; text-align:center;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${snap.docs.map(doc => {
                        const app = doc.data();
                        const docId = doc.id;
                        let badge = '';
                        if (app.status === 'pending_head_approval') {
                          badge = `<span style="color:#f59e0b; font-weight:700;">PENDING</span>`;
                        } else if (app.status === 'approved') {
                          badge = `<span style="color:#10b981; font-weight:700;">APPROVED</span>`;
                        }
                        
                        let actions = '';
                        if (app.status === 'pending_head_approval') {
                          actions = `
                            <div style="display:flex; gap:6px; justify-content:center;">
                              <button class="settings-btn-primary" onclick="approvePcoSmrReport('${docId}')" style="width:auto; margin:0; padding:4px 8px; font-size:11px; background:#10b981; color:white; border-color:#10b981;">Approve</button>
                              <button class="settings-btn-primary" onclick="rejectPcoSmrReport('${docId}')" style="width:auto; margin:0; padding:4px 8px; font-size:11px; background:#ef4444; color:white; border-color:#ef4444;">Reject</button>
                            </div>
                          `;
                        } else {
                          actions = `<span style="color:var(--text-muted); font-size:11px; font-style:italic;">Locked</span>`;
                        }

                        return `
                          <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                            <td style="padding:10px;">${escapeHtml(app.submittedBy)}</td>
                            <td style="padding:10px; font-weight:600; font-family:monospace;">${escapeHtml(app.affiliationUnit || 'N/A')}</td>
                            <td style="padding:10px; color:var(--text-muted);">${escapeHtml(app.remarks || '')}</td>
                            <td style="padding:10px; text-align:center;">${badge}</td>
                            <td style="padding:10px; text-align:center;">${actions}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `;
            }
          } else {
            // Subrole view: check if this specific user has submitted a report
            const mySub = snap.docs.find(d => d.data().submittedBy === currentUser.email);
            if (mySub) {
              const app = mySub.data();
              if (app.status === 'pending_head_approval') {
                statusBadgeHTML = `<span style="padding: 6px 12px; border-radius:6px; background:rgba(245,158,11,0.1); color:#f59e0b; font-weight:700; font-size:12.5px;">⏳ Pending PCO Head Approval (Submitted by You)</span>`;
              } else if (app.status === 'approved') {
                statusBadgeHTML = `<span style="padding: 6px 12px; border-radius:6px; background:rgba(16,185,129,0.1); color:#10b981; font-weight:700; font-size:12.5px;">✅ Approved by PCO Head (Signed)</span>`;
              }
            } else {
              statusBadgeHTML = '<span style="color:var(--text-muted); font-size:12.5px; font-style:italic;">Report Status: Draft (Not Submitted)</span>';
              if (subrole !== 'pco_college') {
                actionButtonHTML = `<button class="settings-btn-primary" onclick="requestPcoHeadApproval()" style="width:auto; margin:0; padding:10px 20px; background:#f59e0b; border-color:rgba(245,158,11,0.3); color:white; font-weight:600; font-size:12.5px;">📤 Submit SMR for Head Approval</button>`;
              }
            }
          }

          container.innerHTML = `
            ${statusBadgeHTML || actionButtonHTML ? `
              <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.01); border:1px dashed var(--border-card); border-radius:10px; padding:16px; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
                <div>${statusBadgeHTML}</div>
                <div>${actionButtonHTML}</div>
              </div>
            ` : ''}

            ${submissionsHTML}

            <table class="gradebook-table" style="width:100%; text-align:left;">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Gen Run Hours</th>
                  <th>Gen Fuel Used (L)</th>
                  <th>Biodegradable (kg)</th>
                  <th>Recyclable (kg)</th>
                  <th>Residual (kg)</th>
                  <th>Effluent pH Violations</th>
                </tr>
              </thead>
              <tbody>
                ${compiledSmrRows.map(r => `
                  <tr>
                    <td style="font-weight:700; color:var(--text-main);">${r.month}</td>
                    <td>${r.genHours.toFixed(1)} hrs</td>
                    <td>${r.fuelUsedLiters.toFixed(1)} L</td>
                    <td>${r.biodegradableKg.toFixed(1)} kg</td>
                    <td>${r.recyclableKg.toFixed(1)} kg</td>
                    <td>${r.residualKg.toFixed(1)} kg</td>
                    <td style="font-weight:700; color:${r.wastewaterOOBCount > 0 ? 'var(--pco-alert)' : 'var(--pco-primary)'};">${r.wastewaterOOBCount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        });
    }).catch(err => {
      container.innerHTML = `<div class="empty-playlist-msg" style="color:#ef4444;">Failed compilation: ${err.message}</div>`;
    });
  }

  function requestPcoHeadApproval() {
    if (compiledSmrRows.length === 0) {
      alert("Please compile report data first.");
      return;
    }
    const year = parseInt(document.getElementById('smr-year').value, 10);
    const quarter = document.getElementById('smr-quarter').value;
    
    const subrole = getPcoSubrole();
    const parts = (currentUser.name || '').split(' ');
    const lastName = parts.length > 0 ? parts[parts.length - 1] : currentUser.email.split('@')[0];
    const categoryName = subrole.replace('pco_', 'PCO ').replace(/\b\w/g, c => c.toUpperCase());
    const officeName = getPcoOffice() || 'Unassigned Office';
    const roomLoc = currentUser.location || 'Unassigned Location';
    const remarks = `Submitted by ${categoryName}, ${lastName}, ${officeName}, ${roomLoc}`;

    firestore.collection('pco_approvals').add({
      year: year,
      quarter: quarter,
      status: 'pending_head_approval',
      submittedBy: currentUser.email,
      affiliationUnit: getPcoAffiliationUnit() || 'N/A',
      remarks: remarks,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      alert("SMR Report draft submitted successfully for PCO Head approval!");
      compilePcoSmrReport();
    })
    .catch(err => alert("Error: " + err.message));
  }

  function approvePcoSmrReport(docId) {
    if (!confirm("Are you sure you want to sign and approve this quarterly SMR report?")) return;
    firestore.collection('pco_approvals').doc(docId).update({
      status: 'approved',
      approvedBy: currentUser.email,
      approvedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      alert("SMR Report successfully approved and signed by PCO Head!");
      compilePcoSmrReport();
    })
    .catch(err => alert("Error: " + err.message));
  }

  function rejectPcoSmrReport(docId) {
    if (!confirm("Are you sure you want to reject this SMR draft report?")) return;
    firestore.collection('pco_approvals').doc(docId).delete()
    .then(() => {
      alert("SMR Draft rejected and cleared.");
      compilePcoSmrReport();
    })
    .catch(err => alert("Error: " + err.message));
  }

  window.compilePcoSmrReport = compilePcoSmrReport;

  function exportSmrToExcel() {
    if (compiledSmrRows.length === 0) {
      alert("Please compile report data first.");
      return;
    }
    try {
      const headers = ["Month", "Gen Run Hours (hrs)", "Gen Fuel Used (L)", "Biodegradable (kg)", "Recyclable (kg)", "Residual (kg)", "Effluent pH Violations"];
      const rows = compiledSmrRows.map(r => [
        r.month, r.genHours, r.fuelUsedLiters, r.biodegradableKg, r.recyclableKg, r.residualKg, r.wastewaterOOBCount
      ]);
      const worksheetData = [headers, ...rows];
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Quarterly SMR Report");
      XLSX.writeFile(workbook, `pco_smr_report_${Date.now()}.xlsx`);
    } catch(err) {
      alert("Export Excel failed: " + err.message);
    }
  }
  window.exportSmrToExcel = exportSmrToExcel;

  function exportSmrToCsv() {
    if (compiledSmrRows.length === 0) {
      alert("Please compile report data first.");
      return;
    }
    const headers = ["Month", "Gen Run Hours (hrs)", "Gen Fuel Used (L)", "Biodegradable (kg)", "Recyclable (kg)", "Residual (kg)", "Effluent pH Violations"];
    const rows = compiledSmrRows.map(r => [
      r.month, r.genHours, r.fuelUsedLiters, r.biodegradableKg, r.recyclableKg, r.residualKg, r.wastewaterOOBCount
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(v => `"${v}"`).join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pco_smr_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  window.exportSmrToCsv = exportSmrToCsv;


  // Initialize and Bind
  checkAndSeedSampleData();

  const MSU_GENSAN_UNITS = [
    { code: 'CNSM', name: 'College of Natural Sciences and Mathematics', type: 'college' },
    { code: 'COE', name: 'College of Engineering', type: 'college' },
    { code: 'COA', name: 'College of Agriculture', type: 'college' },
    { code: 'CBAA', name: 'College of Business Administration and Accountancy', type: 'college' },
    { code: 'COED', name: 'College of Education', type: 'college' },
    { code: 'COFAS', name: 'College of Fisheries & Aquatic Sciences', type: 'college' },
    { code: 'COHS', name: 'College of Health Sciences', type: 'college' },
    { code: 'COL', name: 'College of Law', type: 'college' },
    { code: 'COM', name: 'College of Medicine', type: 'college' },
    { code: 'CSSH', name: 'College of Social Sciences and Humanities', type: 'college' },
    { code: 'IIAIS', name: 'Institute of Islamic, Arabic and International Studies', type: 'college' },
    { code: 'OC', name: 'Office of the Chancellor', type: 'office' },
    { code: 'OVCAA', name: 'Office of the Vice Chancellor for Academic Affairs', type: 'office' },
    { code: 'OVCAF', name: 'Office of the Vice Chancellor for Administration and Finance', type: 'office' },
    { code: 'OVCREI', name: 'Office of the Vice Chancellor for Research, Extension, and Innovation', type: 'office' },
    { code: 'OVCSAS', name: 'Office of the Vice Chancellor for Student Affairs and Services', type: 'office' },
    { code: 'OVCPD', name: 'Office of the Vice Chancellor for Planning and Development', type: 'office' },
    { code: 'PPD', name: 'Physical Plant Division', type: 'office' },
    { code: 'GSO', name: 'General Services Office', type: 'office' },
    { code: 'ICTO', name: 'Information Communication Technology Office', type: 'office' },
    { code: 'BO', name: 'Budget Office', type: 'office' },
    { code: 'IPDM', name: 'Institute of Peace & Development in Mindanao', type: 'office' },
    { code: 'CAO', name: 'Cultural Affairs Office', type: 'office' },
    { code: 'CSU', name: 'Civil Security Unit', type: 'office' },
    { code: 'OIA', name: 'Office of the International Affairs', type: 'office' },
    { code: 'ARO', name: 'Alumni Relations Office', type: 'office' },
    { code: 'IAS', name: 'Internal Audit Services', type: 'office' },
    { code: 'PEMO', name: 'Planning, Evaluation, & Monitoring Office', type: 'office' }
  ];

  let pcoDirectorySortKey = 'code';
  let pcoDirectorySortDesc = false;

  function renderPcoDirectoriesView() {
    const mainContainer = document.getElementById('viewport-body');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div style="padding: 24px; max-width: 1200px; margin: 0 auto; display:flex; flex-direction:column; gap:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-card); padding-bottom:16px;">
          <div>
            <h2 style="font-size:24px; font-weight:800; color:var(--text-main); margin:0;">🏛️ College & Office PCO Directories</h2>
            <p style="font-size:13px; color:var(--text-muted); margin:4px 0 0 0;">Manage, edit, and assign PCO Category Accounts to MSU GenSan Colleges and Offices.</p>
          </div>
        </div>
        <div id="pco-directories-loading" style="text-align:center; padding:40px; color:var(--text-muted);">
          ⏳ Loading University PCO Directory...
        </div>
      </div>
    `;

    firestore.collection('students').get().then(snap => {
      const pcoUsers = [];
      snap.forEach(doc => {
        const u = doc.data();
        const roles = u.roles || [];
        const isPco = roles.some(r => ['pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'].includes(r));
        if (isPco) {
          pcoUsers.push(u);
        }
      });

      let rows = MSU_GENSAN_UNITS.map(unit => {
        const assigned = pcoUsers.filter(u => u.affiliationUnit === unit.code);
        
        let pcoNames = [];
        let pcoRoles = [];
        let lastLogin = null;
        let loggedHours = 0;

        if (assigned.length > 0) {
          assigned.forEach(u => {
            const parts = (u.name || '').split(' ');
            let formattedName = u.name || u.email;
            if (parts.length >= 2) {
              const lastName = parts[parts.length - 1];
              const firstName = parts.slice(0, parts.length - 1).join(' ');
              formattedName = `${lastName}, ${firstName}`;
            }
            pcoNames.push(formattedName);
            pcoRoles.push(u.role ? u.role.replace('pco_', '').toUpperCase() : 'PCO');
            if (u.lastLoginDate) {
              const dateVal = u.lastLoginDate.toDate ? u.lastLoginDate.toDate() : new Date(u.lastLoginDate);
              if (!lastLogin || dateVal > lastLogin) {
                lastLogin = dateVal;
              }
            }
            loggedHours += u.totalLoggedHours || 0;
          });
        }

        return {
          code: unit.code,
          name: unit.name,
          type: unit.type,
          pcoName: pcoNames.join('; ') || '🔴 Unassigned',
          pcoRole: pcoRoles.join('; ') || 'N/A',
          lastLogin: lastLogin,
          hours: loggedHours,
          status: assigned.length > 0 ? 'Assigned' : 'Unassigned',
          usersList: assigned
        };
      });

      rows.sort((a, b) => {
        let valA, valB;
        if (pcoDirectorySortKey === 'code') {
          valA = a.code; valB = b.code;
        } else if (pcoDirectorySortKey === 'name') {
          valA = a.name; valB = b.name;
        } else if (pcoDirectorySortKey === 'pco') {
          valA = a.pcoName; valB = b.pcoName;
        } else if (pcoDirectorySortKey === 'status') {
          valA = a.status; valB = b.status;
        } else if (pcoDirectorySortKey === 'login') {
          valA = a.lastLogin ? a.lastLogin.getTime() : 0;
          valB = b.lastLogin ? b.lastLogin.getTime() : 0;
        } else if (pcoDirectorySortKey === 'hours') {
          valA = a.hours; valB = b.hours;
        } else {
          valA = a.code; valB = b.code;
        }

        if (typeof valA === 'string') {
          return pcoDirectorySortDesc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        } else {
          return pcoDirectorySortDesc ? valB - valA : valA - valB;
        }
      });

      let tableHtml = `
        <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; overflow:hidden;">
          <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
            <thead>
              <tr style="background:var(--bg-body); border-bottom:1px solid var(--border-card); color:var(--text-muted); font-size:11px; text-transform:uppercase; font-weight:700;">
                <th onclick="sortPcoDirectory('code')" style="padding:14px 16px; cursor:pointer; user-select:none;">Unit Code ${pcoDirectorySortKey === 'code' ? (pcoDirectorySortDesc ? '▼' : '▲') : ''}</th>
                <th onclick="sortPcoDirectory('name')" style="padding:14px 16px; cursor:pointer; user-select:none;">Full Unit Name ${pcoDirectorySortKey === 'name' ? (pcoDirectorySortDesc ? '▼' : '▲') : ''}</th>
                <th onclick="sortPcoDirectory('pco')" style="padding:14px 16px; cursor:pointer; user-select:none;">Assigned PCO Account ${pcoDirectorySortKey === 'pco' ? (pcoDirectorySortDesc ? '▼' : '▲') : ''}</th>
                <th onclick="sortPcoDirectory('login')" style="padding:14px 16px; cursor:pointer; user-select:none;">Last Login ${pcoDirectorySortKey === 'login' ? (pcoDirectorySortDesc ? '▼' : '▲') : ''}</th>
                <th onclick="sortPcoDirectory('hours')" style="padding:14px 16px; cursor:pointer; user-select:none;">Logged Hours ${pcoDirectorySortKey === 'hours' ? (pcoDirectorySortDesc ? '▼' : '▲') : ''}</th>
                <th onclick="sortPcoDirectory('status')" style="padding:14px 16px; cursor:pointer; user-select:none;">Status ${pcoDirectorySortKey === 'status' ? (pcoDirectorySortDesc ? '▼' : '▲') : ''}</th>
                <th style="padding:14px 16px; text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody>
      `;

      rows.forEach(r => {
        let statusBadge = r.status === 'Assigned' 
          ? `<span style="background:rgba(16,185,129,0.08); color:#10b981; padding:4px 8px; border-radius:6px; font-weight:700; font-size:11px;">ASSIGNED</span>`
          : `<span style="background:rgba(239,68,68,0.08); color:#ef4444; padding:4px 8px; border-radius:6px; font-weight:700; font-size:11px;">UNASSIGNED</span>`;

        let lastLoginText = 'Never';
        if (r.lastLogin) {
          lastLoginText = r.lastLogin.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }

        tableHtml += `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.02); transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='transparent'">
            <td style="padding:14px 16px; font-weight:700; color:var(--text-main); font-family:monospace;">${r.code}</td>
            <td style="padding:14px 16px; color:var(--text-main);">${r.name}</td>
            <td style="padding:14px 16px;">
              <div style="font-weight:600; color:${r.status === 'Assigned' ? 'var(--text-main)' : 'var(--text-muted)'}">${r.pcoName}</div>
              ${r.status === 'Assigned' ? `<div style="font-size:10px; color:var(--accent); font-weight:700; margin-top:2px;">Category: ${r.pcoRole}</div>` : ''}
            </td>
            <td style="padding:14px 16px; color:var(--text-muted); font-size:12px;">${lastLoginText}</td>
            <td style="padding:14px 16px; font-family:monospace; color:var(--text-main); font-weight:600;">${r.hours.toFixed(1)} hrs</td>
            <td style="padding:14px 16px;">${statusBadge}</td>
            <td style="padding:14px 16px; text-align:center;">
              <button class="settings-btn-primary" onclick="openPcoAssignmentModal('${r.code}', '${escapeJsString(r.name)}')" style="width:auto; margin:0; padding:6px 12px; font-size:12px; font-weight:600;">Assign / Edit</button>
            </td>
          </tr>
        `;
      });

      tableHtml += `
            </tbody>
          </table>
        </div>
      `;

      mainContainer.innerHTML = `
        <div style="padding: 24px; max-width: 1200px; margin: 0 auto; display:flex; flex-direction:column; gap:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-card); padding-bottom:16px;">
            <div>
              <h2 style="font-size:24px; font-weight:800; color:var(--text-main); margin:0;">🏛️ College & Office PCO Directories</h2>
              <p style="font-size:13px; color:var(--text-muted); margin:4px 0 0 0;">Manage, edit, and assign PCO Category Accounts to MSU GenSan Colleges and Offices.</p>
            </div>
          </div>
          ${tableHtml}
        </div>
      `;
    }).catch(err => {
      mainContainer.innerHTML = `<div style="padding:40px; color:var(--pco-danger); text-align:center;">Failed to load directories: ${err.message}</div>`;
    });
  }

  function sortPcoDirectory(key) {
    if (pcoDirectorySortKey === key) {
      pcoDirectorySortDesc = !pcoDirectorySortDesc;
    } else {
      pcoDirectorySortKey = key;
      pcoDirectorySortDesc = false;
    }
    renderPcoDirectoriesView();
  }

  function openPcoAssignmentModal(unitCode, unitName) {
    const email = prompt(`Enter the student/staff institutional email address (@msugensan.edu.ph) to assign as the PCO for ${unitCode} (${unitName}):`);
    if (email === null) return;
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.endsWith('@msugensan.edu.ph')) {
      alert("Invalid email: Must be a valid @msugensan.edu.ph address.");
      return;
    }

    const roleChoice = prompt(`Select the PCO Category Role to assign to ${trimmedEmail} (type the number):\n1. PCO Laboratory\n2. PCO College\n3. PCO Office\n4. PCO PPD\n5. PCO GSO\n6. PCO Sanitary\n7. Remove/Clear Assignment`);
    if (roleChoice === null) return;

    let targetRole = '';
    if (roleChoice === '1') targetRole = 'pco_laboratory';
    else if (roleChoice === '2') targetRole = 'pco_college';
    else if (roleChoice === '3') targetRole = 'pco_office';
    else if (roleChoice === '4') targetRole = 'pco_ppd';
    else if (roleChoice === '5') targetRole = 'pco_gso';
    else if (roleChoice === '6') targetRole = 'pco_sanitary';
    else if (roleChoice === '7') targetRole = 'remove';
    else {
      alert("Invalid choice.");
      return;
    }

    const userRef = firestore.collection('students').doc(trimmedEmail);
    if (targetRole === 'remove') {
      userRef.get().then(doc => {
        if (!doc.exists) {
          alert("User not found in system.");
          return;
        }
        const data = doc.data();
        let roles = data.roles || [];
        roles = roles.filter(r => !['pco', 'pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'].includes(r));
        if (roles.length === 0) roles = ['student'];
        userRef.update({
          roles: roles,
          role: roles[0],
          affiliationUnit: firebase.firestore.FieldValue.delete()
        }).then(() => {
          alert(`Successfully removed PCO assignment for ${trimmedEmail}`);
          if (typeof renderPcoDirectoriesView === 'function') renderPcoDirectoriesView();
        }).catch(err => alert("Error: " + err.message));
      });
    } else {
      userRef.get().then(doc => {
        let name = trimmedEmail.split('@')[0];
        let roles = [targetRole, 'pco'];
        let updateData = {
          role: targetRole,
          roles: roles,
          affiliationUnit: unitCode
        };

        if (doc.exists) {
          const data = doc.data();
          name = data.name || name;
          roles = data.roles || [];
          if (!roles.includes(targetRole)) roles.push(targetRole);
          if (!roles.includes('pco')) roles.push('pco');
          roles = roles.filter(r => r !== 'unassigned' && r !== 'student');
          updateData.roles = roles;
        } else {
          updateData.name = name;
          updateData.email = trimmedEmail;
          updateData.totalLoggedHours = 0;
        }

        userRef.set(updateData, { merge: true }).then(() => {
          alert(`Successfully assigned ${trimmedEmail} to ${unitCode} as ${targetRole.toUpperCase().replace('_', ' ')}`);
          if (typeof renderPcoDirectoriesView === 'function') renderPcoDirectoriesView();
        }).catch(err => alert("Error: " + err.message));
      });
    }
  }

  function renderPcoNoticesView() {
    const mainContainer = document.getElementById('viewport-body');
    if (!mainContainer) return;

    mainContainer.innerHTML = `
      <div style="padding: 24px; max-width: 1000px; margin: 0 auto; display:flex; flex-direction:column; gap:20px;">
        <div style="border-bottom:1px solid var(--border-card); padding-bottom:16px;">
          <h2 style="font-size:24px; font-weight:800; color:var(--text-main); margin:0;">🔔 PCO Compliance Notice Center</h2>
          <p style="font-size:13px; color:var(--text-muted); margin:4px 0 0 0;">View warnings, inactive accounts, reported incidents, and overdue compliance submissions requiring action.</p>
        </div>
        <div id="pco-notices-list" style="display:flex; flex-direction:column; gap:16px;">
          <div style="text-align:center; padding:40px; color:var(--text-muted);">⏳ Compiling compliance notices...</div>
        </div>
      </div>
    `;

    Promise.all([
      firestore.collection('students').get(),
      firestore.collection('pco_incidents').get(),
      firestore.collection('role_applications').where('affiliationUnit', '==', 'OTHER').get()
    ]).then(([studentsSnap, incidentsSnap, appsSnap]) => {
      const pcoUsers = [];
      studentsSnap.forEach(doc => {
        const u = doc.data();
        const roles = u.roles || [];
        const isPco = roles.some(r => ['pco_head', 'pco_laboratory', 'pco_office', 'pco_college', 'pco_ppd', 'pco_gso', 'pco_sanitary'].includes(r));
        if (isPco) pcoUsers.push(u);
      });

      const notices = [];

      // Audit 1: Unassigned Units
      MSU_GENSAN_UNITS.forEach(unit => {
        const hasAssigned = pcoUsers.some(u => u.affiliationUnit === unit.code);
        if (!hasAssigned) {
          notices.push({
            type: 'danger',
            icon: '⚠️',
            title: `Unassigned Unit: ${unit.code}`,
            message: `The campus unit <strong>${unit.name}</strong> currently has no assigned PCO Category Account.`,
            action: `<button class="settings-btn-primary" onclick="openPcoAssignmentModal('${unit.code}', '${escapeJsString(unit.name)}')" style="width:auto; margin:0; padding:6px 12px; font-size:11px;">Assign PCO</button>`
          });
        }
      });

      // Audit 2: Inactivity (> 15 days)
      const now = new Date();
      pcoUsers.forEach(u => {
        if (u.role === 'pco_head') return;
        if (u.lastLoginDate) {
          const lastLogin = u.lastLoginDate.toDate ? u.lastLoginDate.toDate() : new Date(u.lastLoginDate);
          const elapsedDays = Math.floor((now - lastLogin) / 86400000);
          if (elapsedDays > 15) {
            notices.push({
              type: 'warning',
              icon: '⏳',
              title: `Inactive PCO Account: ${u.email}`,
              message: `PCO <strong>${u.name || u.email.split('@')[0]}</strong> assigned to unit <strong>${u.affiliationUnit || 'N/A'}</strong> has not logged in for <strong>${elapsedDays} days</strong>.`,
              action: `
                <div style="display:flex; gap:8px;">
                  <button class="settings-btn-primary" onclick="remindInactivePco('${u.email}', ${elapsedDays})" style="width:auto; margin:0; padding:6px 12px; font-size:11px; background:rgba(245,158,11,0.1); color:#f59e0b; border-color:rgba(245,158,11,0.2);">Remind</button>
                  <button class="settings-btn-primary" onclick="openPcoAssignmentModal('${u.affiliationUnit || ''}', '${escapeJsString(u.office || '')}')" style="width:auto; margin:0; padding:6px 12px; font-size:11px;">Reassign</button>
                </div>
              `
            });
          }
        } else {
          notices.push({
            type: 'warning',
            icon: '⏳',
            title: `Never Logged In: ${u.email}`,
            message: `PCO account <strong>${u.name || u.email.split('@')[0]}</strong> for unit <strong>${u.affiliationUnit || 'N/A'}</strong> has never logged into the portal.`,
            action: `<button class="settings-btn-primary" onclick="remindInactivePco('${u.email}', 'never')" style="width:auto; margin:0; padding:6px 12px; font-size:11px; background:rgba(245,158,11,0.1); color:#f59e0b; border-color:rgba(245,158,11,0.2);">Remind</button>`
          });
        }
      });

      // Audit 3: Open Spill Incidents
      incidentsSnap.forEach(doc => {
        const inc = doc.data();
        if (inc.status !== 'closed' && inc.status !== 'remediated') {
          notices.push({
            type: 'danger',
            icon: '🚨',
            title: `Active Spill Incident: ${inc.substance || 'Chemical'} Spill`,
            message: `A spill incident was reported at <strong>${inc.location || 'Stockroom'}</strong> on ${inc.date || 'today'} involving <strong>${inc.volume || 'unknown'} L</strong> of ${inc.substance || 'chemical'}.`,
            action: `<button class="settings-btn-primary" onclick="setMode('pco-incidents')" style="width:auto; margin:0; padding:6px 12px; font-size:11px; background:#ef4444; color:white; border-color:rgba(239,68,68,0.2);">View Incident</button>`
          });
        }
      });

      // Audit 4: Other Affiliation Requests Clarification
      appsSnap.forEach(doc => {
        const app = doc.data();
        if (app.status === 'pending' || app.status === 'approved') {
          const reqRole = app.requestedRole ? app.requestedRole.replace('pco_', '').toUpperCase() : 'PCO';
          notices.push({
            type: 'warning',
            icon: '❓',
            title: `Other Affiliation Request: ${app.email}`,
            message: `Applicant <strong>${app.name}</strong> applied for <strong>${reqRole}</strong> with affiliation <strong>'Other'</strong>.<br>Specific Unit: <em>${app.officeName || 'N/A'}</em> | Room: <em>${app.office || 'N/A'}</em>.`,
            action: `
              <a href="mailto:${app.email}?subject=MSU%20GenSan%20DoC%20Portal%20-%20PCO%20Affiliation%20Clarification&body=Hi%20${encodeURIComponent(app.name)},%0A%0AWe%20received%20your%20PCO%20access%20request%20with%20affiliation%20unit%20specified%20as%20'Other'.%20Could%20you%20please%20clarify%20which%20college%20or%20office%20you%20are%20affiliated%20with,%20so%20we%20can%20update%20our%20directories%20list?%0A%0AThanks!" class="settings-btn-primary" style="width:auto; margin:0; padding:6px 12px; font-size:11px; text-decoration:none; display:inline-block; border-color:rgba(245,158,11,0.2); background:rgba(245,158,11,0.06); color:#f59e0b; text-align:center;">✉️ Email Clarification</a>
            `
          });
        }
      });

      const listContainer = document.getElementById('pco-notices-list');
      if (notices.length === 0) {
        listContainer.innerHTML = `
          <div style="background:var(--bg-card); border:1px solid var(--border-card); border-radius:12px; padding:32px; text-align:center; color:#10b981;">
            <div style="font-size:32px; margin-bottom:12px;">✅</div>
            <div style="font-weight:700; font-size:16px;">All Systems Compliant</div>
            <p style="font-size:13px; color:var(--text-muted); margin:6px 0 0 0;">No active alerts, unassigned units, or inactive users detected.</p>
          </div>
        `;
      } else {
        let html = '';
        notices.forEach(n => {
          let borderColor = n.type === 'danger' ? '#ef4444' : '#f59e0b';
          let bgColor = n.type === 'danger' ? 'rgba(239,68,68,0.02)' : 'rgba(245,158,11,0.02)';
          
          html += `
            <div style="background:${bgColor}; border:1px solid var(--border-card); border-left:4px solid ${borderColor}; border-radius:8px; padding:16px; display:flex; justify-content:space-between; align-items:center; gap:16px;">
              <div style="display:flex; gap:12px; align-items:flex-start;">
                <div style="font-size:20px; line-height:1;">${n.icon}</div>
                <div>
                  <h4 style="margin:0; font-size:14px; font-weight:700; color:var(--text-main);">${n.title}</h4>
                  <p style="margin:4px 0 0 0; font-size:12.5px; color:var(--text-muted); line-height:1.5;">${n.message}</p>
                </div>
              </div>
              <div>${n.action}</div>
            </div>
          `;
        });
        listContainer.innerHTML = html;
      }
    }).catch(err => {
      document.getElementById('pco-notices-list').innerHTML = `<div style="color:var(--pco-danger); text-align:center; padding:20px;">Failed compilation: ${err.message}</div>`;
    });
  }

  function remindInactivePco(email, days) {
    const noticeText = days === 'never'
      ? "NOTICE: Please log into the DoC Portal to complete your PCO Category onboarding setup."
      : `NOTICE: Your PCO Category Account has been inactive for ${days} days. Please log in to audit active tasks.`;
      
    firestore.collection('notifications').add({
      email: email,
      title: "⏳ PCO Account Inactivity Notice",
      message: noticeText,
      status: 'unread',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      alert(`Reminder notification successfully dispatched to ${email}`);
    }).catch(err => alert("Dispatch failed: " + err.message));
  }

  window.renderPcoDashboardView = renderPcoDashboardView;
  window.renderPcoWasteView = renderPcoWasteView;
  window.renderPcoGeneratorsView = renderPcoGeneratorsView;
  window.renderPcoPermitsView = renderPcoPermitsView;
  window.renderPcoIncidentsView = renderPcoIncidentsView;
  window.renderPcoSmrCompiler = renderPcoSmrCompiler;
  window.renderPcoDirectoriesView = renderPcoDirectoriesView;
  window.sortPcoDirectory = sortPcoDirectory;
  window.openPcoAssignmentModal = openPcoAssignmentModal;
  window.renderPcoNoticesView = renderPcoNoticesView;
  window.remindInactivePco = remindInactivePco;
  
  console.log("🌿 pco.js successfully initialized and loaded!");
})();
