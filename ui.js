// ==================== UI LOGIC ====================
let uploadedData = null;
let uploadedHeaders = [];
let columnMapping = {};

const FIELD_DEFINITIONS = [
  { key: 'testCaseId', label: 'Test Case ID', aliases: ['test case id','tc id','id','test_case_id','tcid','case id','c_id','case_id'] },
  { key: 'title', label: 'Title', aliases: ['title','name','test name','test title','tc name','summary','test case title','case title'] },
  { key: 'description', label: 'Description / Objective', aliases: ['description','desc','objective','test description','purpose','goal'] },
  { key: 'preConditions', label: 'Prerequisites / Setup', aliases: ['pre-conditions','preconditions','pre conditions','prerequisites','setup','precondition','pre_conditions','pre-requisites'] },
  { key: 'testData', label: 'Test Data / Accounts', aliases: ['test data','test_data','input data','input','data','inputs','test accounts','accounts','test_accounts'] },
  { key: 'steps', label: 'Steps', aliases: ['steps','test steps','test_steps','actions','procedure','execution steps','steps_sep','step_content'] },
  { key: 'expectedResult', label: 'Expected Result', aliases: ['expected result','expected','expected_result','expected outcome','expected output','expected results'] },
  { key: 'status', label: 'Status', aliases: ['status','result','pass/fail','test status','test_status','status_label'] },
];

// Tab switching
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
}

// ==================== FILE UPLOAD ====================
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('upload-zone');
  if (!zone) return;
  zone.addEventListener('click', () => document.getElementById('file-input').click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); });
});

function handleFileSelect(event) { if (event.target.files[0]) processFile(event.target.files[0]); }

function processFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!['.csv','.xlsx','.xls'].includes(ext)) { alert('Please upload a .csv, .xlsx, or .xls file.'); return; }
  document.getElementById('file-info').style.display = 'block';
  document.getElementById('file-name').textContent = `${file.name} (${formatFileSize(file.size)})`;
  const reader = new FileReader();
  if (ext === '.csv') { reader.onload = (e) => parseCSV(e.target.result); reader.readAsText(file); }
  else { reader.onload = (e) => parseExcel(new Uint8Array(e.target.result)); reader.readAsArrayBuffer(file); }
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { alert('CSV needs at least a header and one data row.'); return; }
  const parseRow = (row) => { const result = []; let current = '', inQ = false; for (let i = 0; i < row.length; i++) { const c = row[i]; if (c === '"') { if (inQ && row[i+1] === '"') { current += '"'; i++; } else inQ = !inQ; } else if (c === ',' && !inQ) { result.push(current.trim()); current = ''; } else current += c; } result.push(current.trim()); return result; };
  uploadedHeaders = parseRow(lines[0]);
  uploadedData = lines.slice(1).map(line => { const values = parseRow(line); const row = {}; uploadedHeaders.forEach((h,i) => { row[h] = values[i] || ''; }); return row; }).filter(row => Object.values(row).some(v => v.trim()));
  showMappingAndPreview();
}

function parseExcel(data) {
  try { const wb = XLSX.read(data, {type:'array'}); const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''}); if (!json.length) { alert('Excel file is empty.'); return; } uploadedHeaders = Object.keys(json[0]); uploadedData = json; showMappingAndPreview(); }
  catch (e) { alert('Error parsing Excel: ' + e.message); }
}

function showMappingAndPreview() {
  columnMapping = {};
  FIELD_DEFINITIONS.forEach(field => {
    const match = uploadedHeaders.find(h =>
      field.aliases.some(a => h.toLowerCase().trim() === a) ||
      h.toLowerCase().replace(/[_\-\s]/g,'').includes(field.key.toLowerCase().replace(/[_\-\s]/g,''))
    );
    if (match) columnMapping[field.key] = match;
  });

  document.getElementById('mapping-fields').innerHTML = FIELD_DEFINITIONS.map(f => `
    <div class="mapping-item form-group">
      <label>${f.label}</label>
      <select onchange="columnMapping['${f.key}']=this.value">
        <option value="">-- Not mapped --</option>
        ${uploadedHeaders.map(h => `<option value="${h}" ${columnMapping[f.key]===h?'selected':''}>${h}</option>`).join('')}
      </select>
    </div>`).join('');
  document.getElementById('column-mapping').style.display = 'block';

  const rows = uploadedData.slice(0, 5);
  document.getElementById('preview-count').textContent = `(${uploadedData.length} test cases found, showing first ${rows.length})`;
  let html = '<thead><tr>' + uploadedHeaders.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach(row => { html += '<tr>' + uploadedHeaders.map(h => `<td title="${row[h]||''}">${(row[h]||'').toString().substring(0, 60)}</td>`).join('') + '</tr>'; });
  document.getElementById('preview-table').innerHTML = html + '</tbody>';
  document.getElementById('file-preview').style.display = 'block';
  document.getElementById('file-actions').style.display = 'flex';
}

function analyzeFromFile() {
  if (!uploadedData || !uploadedData.length) { alert('No data loaded. Upload a file first.'); return; }

  // First pass: build raw test case objects from each row
  const rawCases = uploadedData.map(row => {
    const tc = {};
    FIELD_DEFINITIONS.forEach(f => {
      const col = columnMapping[f.key];
      if (col && row[col]) {
        let v = row[col].toString().trim();
        if (f.key === 'steps' && v) {
          // Split multi-line steps within a single cell into an array
          const sl = v.split(/[\n\r]+/).map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(s => s);
          tc[f.key] = sl;
        } else if (f.key === 'testData' && v.includes(':')) {
          const obj = {};
          v.split(/[,;\n]/).forEach(p => { const [k,...val] = p.split(':'); if (k && val.length) obj[k.trim()] = val.join(':').trim(); });
          tc[f.key] = Object.keys(obj).length ? obj : v;
        } else {
          tc[f.key] = v;
        }
      }
    });
    return tc;
  });

  // Second pass: group rows by Test Case ID
  // Many tools (TestRail, etc.) export each step as a separate row with the same TC ID
  const idCol = columnMapping['testCaseId'];
  let testCases;

  if (idCol) {
    const grouped = {};
    const order = [];

    rawCases.forEach(tc => {
      const id = (tc.testCaseId || '').trim();
      if (!id) {
        // No ID — treat as standalone
        if (Object.values(tc).some(v => v && v.toString().trim())) order.push(tc);
        return;
      }
      if (!grouped[id]) {
        grouped[id] = { ...tc, steps: Array.isArray(tc.steps) ? [...tc.steps] : [] };
        order.push(grouped[id]);
      } else {
        // Merge this row's steps into the existing grouped case
        const rowSteps = tc.steps || [];
        if (Array.isArray(rowSteps)) {
          grouped[id].steps = grouped[id].steps.concat(rowSteps);
        }
        // Fill in empty fields from subsequent rows
        FIELD_DEFINITIONS.forEach(f => {
          if (f.key !== 'steps' && f.key !== 'testCaseId') {
            if (tc[f.key] && !grouped[id][f.key]) {
              grouped[id][f.key] = tc[f.key];
            }
          }
        });
      }
    });
    testCases = order;
  } else {
    testCases = rawCases;
  }

  // Clean up: remove empty steps arrays
  testCases.forEach(tc => {
    if (Array.isArray(tc.steps) && tc.steps.length === 0) delete tc.steps;
  });

  const valid = testCases.filter(tc => Object.values(tc).some(v => v && v.toString().trim()));
  if (!valid.length) { alert('No valid test cases found. Check your column mapping.'); return; }
  renderResults(analyzeAllTestCases(valid));
}

function clearFile() {
  uploadedData = null; uploadedHeaders = []; columnMapping = {};
  document.getElementById('file-input').value = '';
  ['file-info','column-mapping','file-preview','file-actions'].forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById('results').style.display = 'none';
}

// ==================== TESTRAIL IMPORT ====================
function importFromTestRail() {
  const url = document.getElementById('testrail-url').value.trim();
  if (!url) { alert('Please enter a TestRail export URL or paste CSV content'); return; }

  // If it looks like a URL, show instructions
  if (url.startsWith('http')) {
    alert('To import from TestRail:\n\n1. Open your TestRail test suite/run\n2. Click "Export" → "Export to CSV"\n3. Save the file\n4. Upload it using the File Upload tab\n\nDirect API access is not supported in this static app.');
    return;
  }

  // If pasted CSV content
  try {
    parseCSV(url);
    switchTab('file');
  } catch (e) {
    alert('Could not parse content. Please export from TestRail as CSV and upload the file.');
  }
}

// ==================== SAMPLE DATA ====================
function loadSampleData() {
  uploadedData = [
    { 'Test Case ID': 'TC-001', 'Title': 'Verify login with valid credentials', 'Description': 'Check that registered user can log in', 'Prerequisites': 'User account exists, app is running', 'Test Data': 'username: john@test.com, password: Pass@123', 'Steps': '1. Open login page\n2. Enter username john@test.com\n3. Enter password Pass@123\n4. Click Login button', 'Expected Result': 'User is redirected to dashboard. Welcome message "Hello, John" is displayed in the top-right corner.', 'Status': 'Pass' },
    { 'Test Case ID': 'TC-002', 'Title': 'Ensure that the system seamlessly validates the user credentials and subsequently navigates to the appropriate dashboard', 'Description': 'Validate the functionality of the authentication module to ensure robust and comprehensive credential verification', 'Prerequisites': '', 'Test Data': '', 'Steps': '1. Navigate to the login page of the application\n2. Enter the valid user credentials in the respective fields\n3. Click on the submit button to initiate the authentication process\n4. Verify that the system redirects the user to the appropriate dashboard', 'Expected Result': 'The system should seamlessly authenticate the user and redirect to the appropriate dashboard in a timely manner', 'Status': '' },
    { 'Test Case ID': 'TC-003', 'Title': 'Search', 'Description': '', 'Prerequisites': '', 'Test Data': '', 'Steps': 'search something', 'Expected Result': 'works fine', 'Status': 'Pass' },
    { 'Test Case ID': 'TC-004', 'Title': 'Verify error message for invalid password', 'Description': '', 'Prerequisites': 'Valid user exists in system', 'Test Data': 'username: john@test.com, password: wrongpass', 'Steps': '1. Open login page\n2. Enter valid username\n3. Enter wrong password "wrongpass"\n4. Click Login', 'Expected Result': 'Error toast appears: "Invalid username or password". User stays on login page. Password field is cleared.', 'Status': 'Fail' },
    { 'Test Case ID': 'TC-005', 'Title': 'Check cart total updates when quantity changes', 'Description': '', 'Prerequisites': 'User is logged in, cart has 1 item (Widget A, $10.00)', 'Test Data': 'item: Widget A, initial qty: 1, new qty: 3', 'Steps': '1. Go to cart page\n2. Find Widget A row\n3. Change quantity dropdown from 1 to 3\n4. Wait for price to update', 'Expected Result': 'Line total shows $30.00. Cart subtotal updates to $30.00. "Cart updated" confirmation appears.', 'Status': 'Pass' },
  ];
  uploadedHeaders = Object.keys(uploadedData[0]);
  showMappingAndPreview();
  document.getElementById('file-info').style.display = 'block';
  document.getElementById('file-name').textContent = 'sample_test_cases.xlsx (5 test cases)';
}

function downloadTemplate() {
  const headers = ['Test Case ID','Title','Description','Prerequisites/Setup','Test Data/Accounts','Steps','Expected Result','Status'];
  const sample = ['TC-001','Verify login with valid credentials','Check that registered user can log in','User account exists, app is running','username: john@test.com, password: Pass@123','1. Open login page\n2. Enter username\n3. Enter password\n4. Click Login','User is redirected to dashboard with welcome message displayed','Pass'];
  const csv = [headers.map(h=>`"${h}"`).join(','), sample.map(v=>`"${v.replace(/"/g,'""')}"`).join(',')].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'test_case_template.csv'; a.click();
}

function formatFileSize(b) { if (b < 1024) return b+' B'; if (b < 1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }

// ==================== RENDER RESULTS ====================
function renderResults(data) {
  const el = document.getElementById('results'); el.style.display = 'block';
  const s = data.summary;
  document.getElementById('summary-grid').innerHTML = `
    <div class="summary-item"><div class="value">${s.totalTestCases}</div><div class="label">Test Cases</div></div>
    <div class="summary-item"><div class="value" style="color:${getScoreColor(s.overallScore)}">${s.overallScore}/10</div><div class="label">Overall Score</div></div>
    <div class="summary-item"><div class="value">${s.grade}</div><div class="label">Grade</div></div>
    <div class="summary-item"><div class="value" style="color:var(--success)">${s.passCount}</div><div class="label">Good (≥7)</div></div>
    <div class="summary-item"><div class="value" style="color:var(--warning)">${s.needsImprovementCount}</div><div class="label">Needs Work</div></div>
    <div class="summary-item"><div class="value" style="color:var(--danger)">${s.poorCount}</div><div class="label">Poor</div></div>
    ${s.aiDetectedCount > 0 ? `<div class="summary-item"><div class="value" style="color:#7c3aed">🤖 ${s.aiDetectedCount}</div><div class="label">AI Detected</div></div>` : ''}`;

  document.getElementById('result-cards').innerHTML = data.results.map(r => `
    <div class="result-card ${r.aiDetected ? 'ai-flagged' : ''}">
      <div class="result-header">
        <div class="score-circle ${r.overallRating>=7?'score-high':r.overallRating>=4?'score-mid':'score-low'}">${r.overallRating}</div>
        <div class="info">
          <h4>${r.testCaseId}: ${escapeHtml(r.title)}
            <span class="grade-badge ${getGradeClass(r.grade)}">${r.grade}</span>
            ${r.aiDetected ? '<span class="grade-badge ai-badge">🤖 AI Detected</span>' : ''}
          </h4>
          <div class="subtitle">Test Case #${r.testCaseIndex}</div>
        </div>
      </div>
      <div class="criteria-list">
        ${r.criteria.map(c => `
          <div class="criteria-item ${c.weight === 0 ? 'criteria-info' : ''}">
            <span class="name">${c.name}${c.weight === 0 ? ' <em style="font-size:0.75rem;color:var(--muted)">(info only)</em>' : ''}</span>
            ${c.weight > 0 ? `<div class="bar-container"><div class="bar" style="width:${c.score*10}%;background:${getScoreColor(c.score)}"></div></div>
            <span class="score-text" style="color:${getScoreColor(c.score)}">${c.score}/10</span>` : `<span class="score-text" style="color:var(--muted);width:auto;">${c.feedback.join(', ')}</span>`}
          </div>`).join('')}
      </div>
      ${r.suggestions.length ? `<div class="suggestions"><h5>💡 Improvements Needed</h5><ul>${r.suggestions.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ul></div>` : '<div class="pass-note">✅ This test case is well-written</div>'}
      ${r.improved ? renderImprovedTC(r.improved, r.testCaseId) : ''}
    </div>`).join('');

  el.scrollIntoView({ behavior: 'smooth' });
}

function escapeHtml(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getScoreColor(score) { if (score >= 7) return 'var(--success)'; if (score >= 4) return 'var(--warning)'; return 'var(--danger)'; }
function getGradeClass(grade) { if (grade.startsWith('A')) return 'grade-a'; if (grade==='B') return 'grade-b'; if (grade==='C') return 'grade-c'; if (grade==='D') return 'grade-d'; return 'grade-f'; }

// ==================== IMPROVED TC RENDERER ====================
function renderImprovedTC(improved, tcId) {
  if (!improved || !improved.rewrites) return '';

  let sections = '';

  // Title rewrites
  if (improved.rewrites.title && improved.rewrites.title.length > 0) {
    sections += `<div class="rewrite-section">
      <h6>📝 Title — Rewrite Options</h6>
      ${improved.rewrites.title.map((opt, i) => `
        <div class="rewrite-option">
          <div class="rewrite-text"><strong>Option ${i+1}:</strong> ${escapeHtml(opt.text)}</div>
          <div class="rewrite-reason">↳ ${escapeHtml(opt.reason)}</div>
        </div>`).join('')}
    </div>`;
  }

  // Steps rewrite
  if (improved.rewrites.steps && improved.rewrites.steps.length > 0) {
    const stepsOpt = improved.rewrites.steps[0];
    const stepsList = Array.isArray(stepsOpt.text) ? stepsOpt.text : [stepsOpt.text];
    sections += `<div class="rewrite-section">
      <h6>📋 Steps — Rewritten</h6>
      <div class="rewrite-option">
        <ol class="rewrite-steps">${stepsList.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
        <div class="rewrite-reason">↳ ${escapeHtml(stepsOpt.reason)}</div>
      </div>
    </div>`;
  }

  // Expected result rewrites
  if (improved.rewrites.expectedResult && improved.rewrites.expectedResult.length > 0) {
    sections += `<div class="rewrite-section">
      <h6>✅ Expected Result — Rewrite Options</h6>
      ${improved.rewrites.expectedResult.map((opt, i) => `
        <div class="rewrite-option">
          <div class="rewrite-text"><strong>Option ${i+1}:</strong> ${escapeHtml(opt.text)}</div>
          <div class="rewrite-reason">↳ ${escapeHtml(opt.reason)}</div>
        </div>`).join('')}
    </div>`;
  }

  if (!sections) return '';

  return `
    <div class="improved-section">
      <div class="improved-header" onclick="toggleImproved('${tcId}')">
        <h5>✨ Rewrite Suggestions</h5>
        <span class="toggle-icon" id="toggle-${tcId}">▼</span>
      </div>
      <div class="improved-body" id="improved-${tcId}">
        ${sections}
      </div>
    </div>`;
}

function toggleImproved(tcId) {
  const body = document.getElementById(`improved-${tcId}`);
  const icon = document.getElementById(`toggle-${tcId}`);
  if (body.style.display === 'none') {
    body.style.display = 'block';
    icon.textContent = '▲';
  } else {
    body.style.display = 'none';
    icon.textContent = '▼';
  }
}
