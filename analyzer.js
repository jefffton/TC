// ==================== ANALYSIS ENGINE (client-side) ====================

function analyzeAllTestCases(testCases) {
  const results = testCases.map((tc, index) => analyzeTestCase(tc, index + 1));
  const overallScore = results.reduce((sum, r) => sum + r.overallRating, 0) / results.length;
  return {
    summary: {
      totalTestCases: results.length,
      overallScore: Math.round(overallScore * 10) / 10,
      maxScore: 10,
      grade: getGrade(overallScore),
      passCount: results.filter(r => r.overallRating >= 7).length,
      needsImprovementCount: results.filter(r => r.overallRating >= 4 && r.overallRating < 7).length,
      poorCount: results.filter(r => r.overallRating < 4).length,
    },
    results,
  };
}

function analyzeTestCase(tc, index) {
  const criteria = [];
  const idScore = rateIdentification(tc);
  criteria.push({ name: 'Test Case ID & Description', score: idScore.score, maxScore: 10, weight: 1.5, feedback: idScore.feedback });
  const objectiveScore = rateObjective(tc);
  criteria.push({ name: 'Test Objective Clarity', score: objectiveScore.score, maxScore: 10, weight: 2, feedback: objectiveScore.feedback });
  const conditionsScore = rateConditions(tc);
  criteria.push({ name: 'Pre/Post Conditions', score: conditionsScore.score, maxScore: 10, weight: 1, feedback: conditionsScore.feedback });
  const stepsScore = rateSteps(tc);
  criteria.push({ name: 'Test Steps Quality', score: stepsScore.score, maxScore: 10, weight: 2, feedback: stepsScore.feedback });
  const dataScore = rateTestData(tc);
  criteria.push({ name: 'Test Data', score: dataScore.score, maxScore: 10, weight: 1.5, feedback: dataScore.feedback });
  const expectedScore = rateExpectedResult(tc);
  criteria.push({ name: 'Expected Result', score: expectedScore.score, maxScore: 10, weight: 2, feedback: expectedScore.feedback });
  const actualScore = rateActualResult(tc);
  criteria.push({ name: 'Actual Result & Status', score: actualScore.score, maxScore: 10, weight: 1, feedback: actualScore.feedback });

  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = criteria.reduce((sum, c) => sum + (c.score * c.weight), 0);
  const overallRating = Math.round((weightedSum / totalWeight) * 10) / 10;

  return {
    testCaseIndex: index,
    testCaseId: tc.testCaseId || `TC-${String(index).padStart(3, '0')}`,
    title: tc.title || tc.description || 'Untitled',
    overallRating,
    grade: getGrade(overallRating),
    criteria,
    suggestions: generateSuggestions(criteria),
  };
}

function rateIdentification(tc) {
  let score = 0; const feedback = [];
  if (tc.testCaseId && tc.testCaseId.trim()) { score += 4; if (/^[A-Z]{2,}-\d+/.test(tc.testCaseId.trim())) score += 1; }
  else feedback.push('Missing test case ID');
  if (tc.description && tc.description.trim()) { score += 3; if (tc.description.trim().length >= 20) score += 1; if (tc.description.trim().length >= 50) score += 1; }
  else feedback.push('Missing description');
  if (feedback.length === 0) feedback.push('Well identified');
  return { score: Math.min(score, 10), feedback };
}

function rateObjective(tc) {
  let score = 0; const feedback = [];
  const objective = tc.objective || tc.title || tc.description || '';
  if (objective.trim()) {
    score += 3;
    if (/(?:verify|validate|check|ensure|test|confirm)/i.test(objective)) score += 3;
    else feedback.push('Objective should use action verbs (verify, validate, check, ensure)');
    if (objective.length >= 30) score += 2;
    else feedback.push('Objective could be more specific');
    if (tc.module || tc.feature) score += 2;
    else if (/(?:login|logout|search|payment|cart|profile|register|dashboard)/i.test(objective)) score += 1;
  } else feedback.push('Missing test objective');
  if (feedback.length === 0) feedback.push('Clear and well-defined objective');
  return { score: Math.min(score, 10), feedback };
}

function rateConditions(tc) {
  let score = 0; const feedback = [];
  if (tc.preConditions && tc.preConditions.trim()) { score += 5; if (tc.preConditions.split(/[,.\n;]/).filter(s => s.trim()).length >= 2) score += 1; }
  else feedback.push('Missing pre-conditions');
  if (tc.postConditions && tc.postConditions.trim()) score += 3;
  else feedback.push('Missing post-conditions');
  if (tc.priority) score += 1;
  if (feedback.length === 0) feedback.push('Pre/post conditions well defined');
  return { score: Math.min(score, 10), feedback };
}

function rateSteps(tc) {
  let score = 0; const feedback = [];
  const steps = tc.steps || tc.testSteps || [];
  const stepsText = typeof steps === 'string' ? steps : '';
  if (Array.isArray(steps) && steps.length > 0) {
    score += 4;
    if (steps.length >= 3) score += 2;
    if (steps.length <= 15) score += 1;
    const hasOrder = steps.every((s) => typeof s === 'object' ? s.stepNumber != null : true);
    if (hasOrder) score += 1;
    const clearSteps = steps.filter(s => { const text = typeof s === 'string' ? s : (s.action || s.description || ''); return text.length >= 10; });
    if (clearSteps.length === steps.length) score += 2;
    else feedback.push('Some steps lack detail');
  } else if (stepsText.trim()) { score += 3; if (stepsText.length >= 50) score += 2; feedback.push('Consider breaking steps into individual items'); }
  else feedback.push('Missing test steps');
  if (feedback.length === 0) feedback.push('Steps are clear and well-structured');
  return { score: Math.min(score, 10), feedback };
}

function rateTestData(tc) {
  let score = 0; const feedback = [];
  const testData = tc.testData || tc.inputData || tc.data;
  if (testData) {
    if (typeof testData === 'object' && !Array.isArray(testData)) {
      const keys = Object.keys(testData); score += 4;
      if (keys.length >= 2) score += 2; if (keys.length >= 4) score += 2;
      const hasValues = keys.every(k => testData[k] != null && testData[k] !== '');
      if (hasValues) score += 2; else feedback.push('Some test data fields are empty');
    } else if (typeof testData === 'string' && testData.trim()) { score += 5; if (testData.length >= 20) score += 2; }
    else if (Array.isArray(testData) && testData.length > 0) { score += 6; if (testData.length >= 2) score += 2; }
  } else feedback.push('Missing test data - specify inputs used for testing');
  if (feedback.length === 0) feedback.push('Test data is well specified');
  return { score: Math.min(score, 10), feedback };
}

function rateExpectedResult(tc) {
  let score = 0; const feedback = [];
  const expected = tc.expectedResult || tc.expected || '';
  if (expected && expected.toString().trim()) {
    score += 4; const text = expected.toString().trim();
    if (text.length >= 20) score += 2; else feedback.push('Expected result could be more specific');
    if (/(?:displayed|shown|redirected|message|error|success|equal|contain|return|status|code)/i.test(text)) score += 2;
    else feedback.push('Expected result should be measurable and verifiable');
    if (!/(?:should work|properly|correctly|as expected|fine)/i.test(text)) score += 2;
    else feedback.push('Avoid vague terms like "works properly" - be specific');
  } else feedback.push('Missing expected result');
  if (feedback.length === 0) feedback.push('Expected result is clear and verifiable');
  return { score: Math.min(score, 10), feedback };
}

function rateActualResult(tc) {
  let score = 0; const feedback = [];
  if (tc.actualResult || tc.actual) { score += 4; const actual = (tc.actualResult || tc.actual).toString().trim(); if (actual.length >= 10) score += 2; }
  else feedback.push('Missing actual result (fill after execution)');
  if (tc.status) { score += 3; if (/^(pass|fail|blocked|skipped|not executed)$/i.test(tc.status.trim())) score += 1; else feedback.push('Status should be: Pass, Fail, Blocked, Skipped, or Not Executed'); }
  else feedback.push('Missing test status');
  if (feedback.length === 0) feedback.push('Result and status properly recorded');
  return { score: Math.min(score, 10), feedback };
}

function generateSuggestions(criteria) {
  const suggestions = [];
  criteria.forEach(c => { if (c.score < 5) { c.feedback.forEach(f => { if (!f.includes('Well') && !f.includes('well') && !f.includes('Clear')) suggestions.push(`[${c.name}] ${f}`); }); } });
  return suggestions;
}

function getGrade(score) {
  if (score >= 9) return 'A+'; if (score >= 8) return 'A'; if (score >= 7) return 'B';
  if (score >= 6) return 'C'; if (score >= 5) return 'D'; return 'F';
}
