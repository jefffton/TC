// ==================== UI: Auto-analyze, table, expand, filter ====================
let uploadedData = null, uploadedHeaders = [], columnMapping = {};

const FIELDS = [
  { key: 'testCaseId', aliases: ['test case id','tc id','id','test_case_id','tcid','case id','c_id'] },
  { key: 'title', aliases: ['title','name','test name','test title','summary','case title'] },
  { key: 'description', aliases: ['description','desc','objective','test description','purpose'] },
  { key: 'preConditions', aliases: ['pre-conditions','preconditions','prerequisites','setup','pre_conditions'] },
  { key: 'testData', aliases: ['test data','test_data','input data','input','data','test accounts'] },
  { key: 'steps', aliases: ['steps','test steps','test_steps','actions','procedure','step_content'] },
  { key: 'expectedResult', aliases: ['expected result','expected','expected_result','expected outcome'] },
  { key: 'status', aliases: ['status','result','pass/fail','test status'] },
];

// ==================== UPLOAD ====================
document.addEventListener('DOMContentLoaded', () => {
  const zone = document.getElementById('upload-zone');
  zone.addEventListener('click', () => document.getElementById('file-input').click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); });
});

function handleFileSelect(e) { if (e.target.files[0]) processFile(e.target.files[0]); }

function processFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!['.csv','.xlsx','.xls'].includes(ext)) { alert('Upload .csv, .xlsx, or .xls'); return; }
  const reader = new FileReader();
  if (ext === '.csv') { reader.onload = e => { parseCSV(e.target.result); autoAnalyze(); }; reader.readAsText(file); }
  else { reader.onload = e => { parseExcel(new Uint8Array(e.target.result)); autoAnalyze(); }; reader.readAsArrayBuffer(file); }
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { alert('File needs header + data.'); return; }
  const parseRow = row => { const r = []; let c = '', q = false; for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '"') { if (q && row[i+1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { r.push(c.trim()); c = ''; } else c += ch; } r.push(c.trim()); return r; };
  uploadedHeaders = parseRow(lines[0]);
  uploadedData = lines.slice(1).map(l => { const v = parseRow(l); const row = {}; uploadedHeaders.forEach((h,i) => row[h] = v[i] || ''); return row; }).filter(r => Object.values(r).some(v => v.trim()));
}

function parseExcel(data) {
  const wb = XLSX.read(data, {type:'array'});
  const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:''});
  if (!json.length) { alert('File is empty.'); return; }
  uploadedHeaders = Object.keys(json[0]);
  uploadedData = json;
}

function autoAnalyze() {
  if (!uploadedData || !uploadedData.length) return;
  // Auto-map columns
  columnMapping = {};
  FIELDS.forEach(f => { const m = uploadedHeaders.find(h => f.aliases.some(a => h.toLowerCase().trim() === a) || h.toLowerCase().replace(/[_\-\s]/g,'').includes(f.key.toLowerCase())); if (m) columnMapping[f.key] = m; });

  // Build test cases
  const raw = uploadedData.map(row => {
    const tc = {};
    FIELDS.forEach(f => { const col = columnMapping[f.key]; if (col && row[col]) { let v = row[col].toString().trim(); if (f.key === 'steps' && v) { tc[f.key] = v.split(/[\n\r]+/).map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(s => s); } else if (f.key === 'testData' && v.includes(':')) { const o = {}; v.split(/[,;\n]/).forEach(p => { const [k,...val] = p.split(':'); if (k && val.length) o[k.trim()] = val.join(':').trim(); }); tc[f.key] = Object.keys(o).length ? o : v; } else tc[f.key] = v; } });
    return tc;
  });

  // Group by ID
  const idCol = columnMapping['testCaseId'];
  let cases;
  if (idCol) {
    const g = {}, order = [];
    raw.forEach(tc => { const id = (tc.testCaseId||'').trim(); if (!id) { if (Object.values(tc).some(v=>v&&v.toString().trim())) order.push(tc); return; } if (!g[id]) { g[id] = {...tc, steps: Array.isArray(tc.steps)?[...tc.steps]:[]}; order.push(g[id]); } else { if (Array.isArray(tc.steps)) g[id].steps = g[id].steps.concat(tc.steps); FIELDS.forEach(f => { if (f.key!=='steps'&&f.key!=='testCaseId'&&tc[f.key]&&!g[id][f.key]) g[id][f.key]=tc[f.key]; }); } });
    cases = order;
  } else cases = raw;
  cases.forEach(tc => { if (Array.isArray(tc.steps) && !tc.steps.length) delete tc.steps; });
  const valid = cases.filter(tc => Object.values(tc).some(v => v && v.toString().trim()));
  if (!valid.length) { alert('No valid test cases found.'); return; }

  // Collapse upload, show results
  document.getElementById('upload-panel').style.display = 'none';
  renderResults(analyzeAllTestCases(valid));
}

// ==================== RENDER ====================
let allResults = [];

function renderResults(data) {
  document.getElementById('results').style.display = 'block';
  window._lastResults = data;
  allResults = data.results;
  const s = data.summary;
  document.getElementById('metrics').innerHTML = `
    <div class="metric"><div class="val">${s.totalTestCases}</div><div class="lbl">Total</div></div>
    <div class="metric"><div class="val" style="color:${scoreColor(s.overallScore)}">${s.overallScore}</div><div class="lbl">Avg Score</div></div>
    <div class="metric"><div class="val">${s.grade}</div><div class="lbl">Grade</div></div>
    <div class="metric"><div class="val" style="color:var(--success)">${s.passCount}</div><div class="lbl">Good</div></div>
    <div class="metric"><div class="val" style="color:var(--warning)">${s.needsImprovementCount}</div><div class="lbl">Needs Work</div></div>
    <div class="metric"><div class="val" style="color:var(--danger)">${s.poorCount}</div><div class="lbl">Poor</div></div>`;

  document.getElementById('toolbar').innerHTML = `
    <select id="filter-grade" onchange="applyFilters()"><option value="">All Grades</option><option value="fail">Poor (F/D)</option><option value="mid">Needs Work (C)</option><option value="good">Good (A/B)</option></select>
    <select id="sort-by" onchange="applyFilters()"><option value="score-asc">Score ↑ (worst first)</option><option value="score-desc">Score ↓ (best first)</option><option value="id">By ID</option></select>
    <button class="btn" onclick="resetView()">↺ New file</button>`;

  applyFilters();
}

function applyFilters() {
  const filter = document.getElementById('filter-grade').value;
  const sort = document.getElementById('sort-by').value;

  let filtered = [...allResults];
  if (filter === 'fail') filtered = filtered.filter(r => r.overallRating < 5);
  else if (filter === 'mid') filtered = filtered.filter(r => r.overallRating >= 5 && r.overallRating < 7);
  else if (filter === 'good') filtered = filtered.filter(r => r.overallRating >= 7);

  if (sort === 'score-asc') filtered.sort((a,b) => a.overallRating - b.overallRating);
  else if (sort === 'score-desc') filtered.sort((a,b) => b.overallRating - a.overallRating);

  document.getElementById('result-count').textContent = `Showing ${filtered.length} of ${allResults.length}`;
  renderTable(filtered);
}

function renderTable(results) {
  const tbody = document.getElementById('tc-body');
  tbody.innerHTML = results.map(r => {
    const issues = r.suggestions.length;
    const pillClass = r.overallRating >= 7 ? 'pill-high' : r.overallRating >= 4 ? 'pill-mid' : 'pill-low';
    return `
      <tr onclick="toggleDetail('${r.testCaseId}')">
        <td>${esc(r.testCaseId)}</td>
        <td>${esc(r.title.substring(0,60))}${r.title.length>60?'...':''}</td>
        <td><span class="score-pill ${pillClass}">${r.overallRating}</span></td>
        <td><span class="badge badge-grade">${r.grade}</span></td>
        <td>${issues ? `<span style="color:var(--danger)">${issues} issue${issues>1?'s':''}</span>` : '<span class="pass-badge">✓</span>'}</td>
      </tr>
      <tr class="detail-row" id="detail-${r.testCaseId}"><td colspan="5">${renderDetail(r)}</td></tr>`;
  }).join('');
}

function renderDetail(r) {
  const left = r.criteria.filter(c=>c.weight>0).map(c => `
    <div class="detail-bar"><span style="width:130px">${c.name}</span><div class="bar-bg"><div class="bar-fill" style="width:${c.score*10}%;background:${scoreColor(c.score)}"></div></div><span class="score">${c.score}</span></div>`).join('');

  const info = r.criteria.filter(c=>c.weight===0).map(c => `<div style="font-size:0.75rem;color:var(--muted);margin-top:0.2rem;">${c.name}: ${c.feedback[0]||''}</div>`).join('');

  let right = '';
  if (r.suggestions.length) {
    right += `<h5 style="font-size:0.8rem;color:var(--warning);">Issues</h5><ul class="suggestion-list">${r.suggestions.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`;
  } else {
    right += '<span class="pass-badge">✓ Meets quality standards</span>';
  }

  if (r.improved && r.improved.rewrites) {
    const rw = r.improved.rewrites;
    right += '<div class="rewrite-box"><h6>✨ Suggested rewrites</h6>';
    if (rw.title && rw.title.length) right += rw.title.map((o,i)=>`<div>${i+1}. ${esc(o.text)} <span class="reason">${esc(o.reason)}</span></div>`).join('');
    if (rw.steps && rw.steps.length) { const s = rw.steps[0]; right += `<ol>${(Array.isArray(s.text)?s.text:[s.text]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`; }
    if (rw.expectedResult && rw.expectedResult.length) right += rw.expectedResult.map((o,i)=>`<div>${i+1}. ${esc(o.text)} <span class="reason">${esc(o.reason)}</span></div>`).join('');
    right += '</div>';
  }

  return `<div class="detail-content"><div class="detail-section"><h5>Scores</h5>${left}${info}</div><div class="detail-section">${right}</div></div>`;
}

function toggleDetail(id) {
  const row = document.getElementById(`detail-${id}`);
  const parent = row.previousElementSibling;
  if (row.classList.contains('visible')) { row.classList.remove('visible'); parent.classList.remove('expanded'); }
  else { row.classList.add('visible'); parent.classList.add('expanded'); }
}

function resetView() {
  document.getElementById('results').style.display = 'none';
  document.getElementById('upload-panel').style.display = 'block';
  document.getElementById('file-input').value = '';
  uploadedData = null;
}

function scoreColor(s) { if (s >= 7) return 'var(--success)'; if (s >= 4) return 'var(--warning)'; return 'var(--danger)'; }
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ==================== EXPORT ====================
function exportToCSV() {
  if (!window._lastResults) return;
  const d = window._lastResults, today = new Date().toISOString().split('T')[0];
  const rows = ['"ID","Title","Score","Grade","Issues","Date"'];
  d.results.forEach(r => rows.push(`"${r.testCaseId}","${(r.title||'').replace(/"/g,'""')}",${r.overallRating},"${r.grade}","${r.suggestions.join('; ').replace(/"/g,'""')}","${today}"`));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'})); a.download = `tc_analysis_${today}.csv`; a.click();
}

function downloadTemplate() {
  const h = ['Test Case ID','Title','Description','Prerequisites','Test Data','Steps','Expected Result','Status'];
  const s = ['TC-001','Verify login with valid credentials','Check user can log in','User exists','username: john@test.com','1. Open login\n2. Enter creds\n3. Click Login','Dashboard shows welcome message','Pass'];
  const csv = [h.map(x=>`"${x}"`).join(','), s.map(x=>`"${x.replace(/"/g,'""')}"`).join(',')].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download = 'template.csv'; a.click();
}
