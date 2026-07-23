// ==================== UI LOGIC ====================
let formCount = 0;
let uploadedData = null;
let uploadedHeaders = [];
let columnMapping = {};

const FIELD_DEFINITIONS = [
  { key: 'testCaseId', label: 'Test Case ID', aliases: ['test case id','tc id','id','test_case_id','tcid','case id'] },
  { key: 'title', label: 'Title', aliases: ['title','name','test name','test title','tc name'] },
  { key: 'description', label: 'Description', aliases: ['description','desc','objective','test description'] },
  { key: 'module', label: 'Module', aliases: ['module','feature','component','area'] },
  { key: 'preConditions', label: 'Pre-Conditions', aliases: ['pre-conditions','preconditions','pre conditions','prerequisites'] },
  { key: 'postConditions', label: 'Post-Conditions', aliases: ['post-conditions','postconditions','post conditions'] },
  { key: 'steps', label: 'Test Steps', aliases: ['steps','test steps','test_steps','actions','procedure'] },
  { key: 'testData', label: 'Test Data', aliases: ['test data','test_data','input data','input','data'] },
  { key: 'expectedResult', label: 'Expected Result', aliases: ['expected result','expected','expected_result','expected outcome'] },
  { key: 'actualResult', label: 'Actual Result', aliases: ['actual result','actual','actual_result','actual outcome'] },
  { key: 'status', label: 'Status', aliases: ['status','result','pass/fail','test status'] },
  { key: 'priority', label: 'Priority', aliases: ['priority','severity','importance'] },
];

// Tab switching
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
}

// Form management
function addTestCaseForm() {
  formCount++;
  const container = document.getElementById('test-case-forms');
  const entry = document.createElement('div');
  entry.className = 'test-case-entry';
  entry.id = `tc-form-${formCount}`;
  entry.innerHTML = `
    <div class="entry-header"><h4>Test Case #${formCount}</h4><button class="remove-btn" onclick="removeForm(${formCount})">&times;</button></div>
    <div class="form-row"><div class="form-group"><label>Test Case ID</label><input type="text" class="tc-id" placeholder="e.g., TC-001"></div><div class="form-group"><label>Module/Feature</label><input type="text" class="tc-module" placeholder="e.g., Login"></div></div>
    <div class="form-group"><label>Title</label><input type="text" class="tc-title" placeholder="e.g., Verify login with valid credentials"></div>
    <div class="form-group"><label>Objective / Description</label><textarea class="tc-objective" placeholder="What is this test case testing?"></textarea></div>
    <div class="form-row"><div class="form-group"><label>Pre-Conditions</label><textarea class="tc-pre" placeholder="e.g., User account exists, App is running"></textarea></div><div class="form-group"><label>Post-Conditions</label><textarea class="tc-post" placeholder="e.g., User is logged in"></textarea></div></div>
    <div class="form-group"><label>Test Steps (one per line)</label><textarea class="tc-steps" placeholder="1. Navigate to login page&#10;2. Enter username&#10;3. Enter password&#10;4. Click Login"></textarea></div>
    <div class="form-group"><label>Test Data</label><textarea class="tc-data" placeholder="e.g., username: testuser@email.com, password: Test@123"></textarea></div>
    <div class="form-group"><label>Expected Result</label><textarea class="tc-expected" placeholder="e.g., User is redirected to dashboard with welcome message"></textarea></div>
    <div class="form-row-3"><div class="form-group"><label>Actual Result</label><input type="text" class="tc-actual" placeholder="What actually happened"></div><div class="form-group"><label>Status</label><select class="tc-status"><option value="">Select...</option><option value="Pass">Pass</option><option value="Fail">Fail</option><option value="Blocked">Blocked</option><option value="Not Executed">Not Executed</option></select></div><div class="form-group"><label>Priority</label><select class="tc-priority"><option value="">Select...</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></div></div>`;
  container.appendChild(entry);
}

function removeForm(id) { const el = document.getElementById(`tc-form-${id}`); if (el) el.remove(); }
function clearForms() { document.getElementById('test-case-forms').innerHTML = ''; formCount = 0; document.getElementById('results').style.display = 'none'; }

function analyzeFromForm() {
  const entries = document.querySelectorAll('.test-case-entry');
  if (entries.length === 0) { alert('Please add at least one test case'); return; }
  const testCases = [];
  entries.forEach(entry => {
    const stepsText = entry.querySelector('.tc-steps').value;
    const steps = stepsText.split('\n').map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(s => s);
    const dataText = entry.querySelector('.tc-data').value;
    let testData = dataText;
    if (dataText.includes(':')) { const obj = {}; dataText.split(/[,\n]/).forEach(pair => { const [key,...val] = pair.split(':'); if (key && val.length) obj[key.trim()] = val.join(':').trim(); }); if (Object.keys(obj).length > 0) testData = obj; }
    testCases.push({ testCaseId: entry.querySelector('.tc-id').value, title: entry.querySelector('.tc-title').value, description: entry.querySelector('.tc-objective').value, objective: entry.querySelector('.tc-objective').value, module: entry.querySelector('.tc-module').value, preConditions: entry.querySelector('.tc-pre').value, postConditions: entry.querySelector('.tc-post').value, steps: steps.length > 0 ? steps : undefined, testData: testData || undefined, expectedResult: entry.querySelector('.tc-expected').value, actualResult: entry.querySelector('.tc-actual').value, status: entry.querySelector('.tc-status').value, priority: entry.querySelector('.tc-priority').value });
  });
  renderResults(analyzeAllTestCases(testCases));
}

function analyzeFromJSON() {
  const input = document.getElementById('json-input').value.trim();
  if (!input) { alert('Please paste JSON test cases'); return; }
  try { const testCases = JSON.parse(input); if (!Array.isArray(testCases)) { alert('JSON must be an array'); return; } renderResults(analyzeAllTestCases(testCases)); }
  catch (e) { alert('Invalid JSON: ' + e.message); }
}

function loadAndAnalyzeSamples() {
  const sampleData = [
    { testCaseId:"TC-001", title:"Verify login with valid credentials", description:"Test that a registered user can successfully log in with correct username and password", objective:"Verify that the login functionality accepts valid credentials and grants access", module:"Authentication", preConditions:"User account exists in the system, Application is accessible", postConditions:"User is logged in and session is created", steps:["Navigate to the login page","Enter valid username 'testuser@email.com'","Enter valid password 'Test@123'","Click the Login button","Verify redirect to dashboard"], testData:{username:"testuser@email.com",password:"Test@123"}, expectedResult:"User is redirected to dashboard page with welcome message 'Hello, Test User' displayed", actualResult:"User redirected to dashboard with welcome message displayed", status:"Pass", priority:"High" },
    { testCaseId:"TC-002", title:"Login fails with wrong password", description:"Verify error message when invalid password is entered", objective:"Check that login rejects invalid password and shows appropriate error", module:"Authentication", preConditions:"User account exists", postConditions:"User remains on login page", steps:["Navigate to login page","Enter valid username","Enter incorrect password","Click Login"], testData:{username:"testuser@email.com",password:"wrongpass"}, expectedResult:"Error message 'Invalid credentials' is displayed and user stays on login page", actualResult:"Error message displayed correctly", status:"Pass", priority:"High" },
    { testCaseId:"TC-003", title:"Empty fields validation", description:"Check validation", steps:["Leave fields empty","Click login"], expectedResult:"Shows error", status:"Pass" },
    { title:"Search works", steps:"type something and search", expectedResult:"results show up properly" },
    { testCaseId:"TC-005", title:"Verify password reset email delivery", description:"Validate that clicking Forgot Password sends a reset email to the registered address", objective:"Verify the password reset flow sends email correctly with valid reset link", module:"Authentication", feature:"Password Reset", preConditions:"User account exists with verified email, SMTP service is running, User is on login page", postConditions:"Reset email is in users inbox, Reset link is valid for 24 hours", steps:["Navigate to the login page","Click Forgot Password link","Enter registered email address","Click Send Reset Link button","Check email inbox for reset email","Verify email contains valid reset link","Verify link expires after 24 hours"], testData:{email:"testuser@email.com",expectedSender:"noreply@app.com",linkExpiry:"24 hours"}, expectedResult:"Password reset email is received within 2 minutes containing a valid reset link that expires in 24 hours. Success message displayed on screen.", actualResult:"Email received in 45 seconds with valid reset link. Expiry confirmed at 24 hours. Success message displayed.", status:"Pass", priority:"High" }
  ];
  renderResults(analyzeAllTestCases(sampleData));
}

// ==================== FILE UPLOAD ====================
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('upload-zone');
  if (!zone) return;
  zone.addEventListener('click', () => document.getElementById('file-input').click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); });
  addTestCaseForm();
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
  FIELD_DEFINITIONS.forEach(field => { const match = uploadedHeaders.find(h => field.aliases.some(a => h.toLowerCase().trim() === a) || h.toLowerCase().replace(/[_\-\s]/g,'').includes(field.key.toLowerCase())); if (match) columnMapping[field.key] = match; });
  document.getElementById('mapping-fields').innerHTML = FIELD_DEFINITIONS.map(f => `<div class="mapping-item form-group"><label>${f.label}</label><select onchange="columnMapping['${f.key}']=this.value"><option value="">-- Not mapped --</option>${uploadedHeaders.map(h => `<option value="${h}" ${columnMapping[f.key]===h?'selected':''}>${h}</option>`).join('')}</select></div>`).join('');
  document.getElementById('column-mapping').style.display = 'block';
  const rows = uploadedData.slice(0,5);
  document.getElementById('preview-count').textContent = `(${uploadedData.length} rows, showing ${rows.length})`;
  let html = '<thead><tr>' + uploadedHeaders.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
  rows.forEach(row => { html += '<tr>' + uploadedHeaders.map(h => `<td title="${row[h]||''}">${(row[h]||'').toString().substring(0,50)}</td>`).join('') + '</tr>'; });
  document.getElementById('preview-table').innerHTML = html + '</tbody>';
  document.getElementById('file-preview').style.display = 'block';
  document.getElementById('file-actions').style.display = 'flex';
}

function analyzeFromFile() {
  if (!uploadedData || !uploadedData.length) { alert('No data loaded.'); return; }
  const testCases = uploadedData.map(row => { const tc = {}; FIELD_DEFINITIONS.forEach(f => { const col = columnMapping[f.key]; if (col && row[col]) { let v = row[col].toString().trim(); if (f.key === 'steps' && v) { const sl = v.split(/[\n\r]+|(?:\d+[\.\)])\s*/).map(s=>s.trim()).filter(s=>s); tc[f.key] = sl.length > 1 ? sl : v; } else if (f.key === 'testData' && v.includes(':')) { const obj = {}; v.split(/[,;\n]/).forEach(p => { const [k,...val] = p.split(':'); if (k && val.length) obj[k.trim()] = val.join(':').trim(); }); tc[f.key] = Object.keys(obj).length ? obj : v; } else tc[f.key] = v; } }); return tc; });
  const valid = testCases.filter(tc => Object.values(tc).some(v => v && v.toString().trim()));
  if (!valid.length) { alert('No valid test cases found. Check column mapping.'); return; }
  renderResults(analyzeAllTestCases(valid));
}

function clearFile() { uploadedData = null; uploadedHeaders = []; columnMapping = {}; document.getElementById('file-input').value = ''; ['file-info','column-mapping','file-preview','file-actions'].forEach(id => document.getElementById(id).style.display = 'none'); document.getElementById('results').style.display = 'none'; }

function downloadTemplate() {
  const headers = FIELD_DEFINITIONS.map(f => f.label);
  const sample = ['TC-001','Verify login with valid credentials','Test that user can log in with correct username and password','Authentication','User account exists, Application is running','User is logged in, Session is active','1. Navigate to login page\n2. Enter valid username\n3. Enter valid password\n4. Click Login button','username: testuser@email.com, password: Test@123','User is redirected to dashboard with welcome message displayed','User redirected to dashboard successfully','Pass','High'];
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
    <div class="summary-item"><div class="value" style="color:var(--warning)">${s.needsImprovementCount}</div><div class="label">Needs Work (4-6)</div></div>
    <div class="summary-item"><div class="value" style="color:var(--danger)">${s.poorCount}</div><div class="label">Poor (&lt;4)</div></div>`;
  document.getElementById('result-cards').innerHTML = data.results.map(r => `
    <div class="result-card"><div class="result-header"><div class="score-circle ${r.overallRating>=7?'score-high':r.overallRating>=4?'score-mid':'score-low'}">${r.overallRating}</div><div class="info"><h4>${r.testCaseId}: ${r.title}<span class="grade-badge ${getGradeClass(r.grade)}">${r.grade}</span></h4><div class="subtitle">Test Case #${r.testCaseIndex}</div></div></div>
    <div class="criteria-list">${r.criteria.map(c=>`<div class="criteria-item"><span class="name">${c.name}</span><div class="bar-container"><div class="bar" style="width:${c.score*10}%;background:${getScoreColor(c.score)}"></div></div><span class="score-text" style="color:${getScoreColor(c.score)}">${c.score}/10</span></div>`).join('')}</div>
    ${r.suggestions.length?`<div class="suggestions"><h5>💡 Suggestions</h5><ul>${r.suggestions.map(s=>`<li>${s}</li>`).join('')}</ul></div>`:''}</div>`).join('');
  el.scrollIntoView({behavior:'smooth'});
}

function getScoreColor(score) { if (score >= 7) return 'var(--success)'; if (score >= 4) return 'var(--warning)'; return 'var(--danger)'; }
function getGradeClass(grade) { if (grade.startsWith('A')) return 'grade-a'; if (grade==='B') return 'grade-b'; if (grade==='C') return 'grade-c'; if (grade==='D') return 'grade-d'; return 'grade-f'; }
