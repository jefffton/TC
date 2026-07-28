// ==================== TEST CASE ANALYSIS ENGINE ====================
// Golden Standards-based analyzer

function analyzeAllTestCases(testCases) {
  const results = testCases.map((tc, index) => analyzeTestCase(tc, index + 1));
  results.forEach(r => {
    r.improved = generateImprovedTC(r._originalTC, r);
    delete r._originalTC;
  });
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

  const titleResult = rateTitleGolden(tc);
  criteria.push({ name: 'Title Quality', score: titleResult.score, maxScore: 10, weight: 2, feedback: titleResult.feedback });

  const stepsResult = rateStepsGolden(tc);
  criteria.push({ name: 'Steps Structure & Clarity', score: stepsResult.score, maxScore: 10, weight: 3, feedback: stepsResult.feedback });

  const expectedResult = rateExpectedResultGolden(tc);
  criteria.push({ name: 'Expected Results', score: expectedResult.score, maxScore: 10, weight: 3, feedback: expectedResult.feedback });

  const relevanceResult = rateTitleStepsRelevance(tc);
  criteria.push({ name: 'Title ↔ Steps Relevance', score: relevanceResult.score, maxScore: 10, weight: 2, feedback: relevanceResult.feedback });

  // Info only — not scored
  const dataResult = rateTestDataGolden(tc);
  criteria.push({ name: 'Test Data & Prerequisites', score: dataResult.score, maxScore: 10, weight: 0, feedback: dataResult.feedback });

  const scoredCriteria = criteria.filter(c => c.weight > 0);
  const totalWeight = scoredCriteria.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = scoredCriteria.reduce((sum, c) => sum + (c.score * c.weight), 0);
  const overallRating = Math.round((weightedSum / totalWeight) * 10) / 10;

  return {
    testCaseIndex: index,
    testCaseId: tc.testCaseId || `TC-${String(index).padStart(3, '0')}`,
    title: tc.title || tc.description || 'Untitled',
    overallRating,
    grade: getGrade(overallRating),
    aiDetected: false,
    criteria,
    suggestions: generateSuggestions(criteria),
    improved: null,
    _originalTC: tc,
  };
}

// ==================== TITLE QUALITY (Golden Standard) ====================
// Must be 8-12 words, Format: [Component] + [Action] + [Expected Outcome]
function rateTitleGolden(tc) {
  let score = 0;
  const feedback = [];
  const title = (tc.title || tc.description || '').trim();

  if (!title) { feedback.push('Missing title'); return { score: 0, feedback }; }

  const wordCount = title.split(/\s+/).length;

  // Word count check (8-12 words ideal)
  if (wordCount >= 8 && wordCount <= 12) {
    score += 3;
    feedback.push(`✓ Good length (${wordCount} words)`);
  } else if (wordCount >= 5 && wordCount <= 15) {
    score += 2;
    feedback.push(`Title is ${wordCount} words (ideal: 8-12 words)`);
  } else if (wordCount < 5) {
    score += 0;
    feedback.push(`Title too short (${wordCount} words) — should be 8-12 words`);
  } else {
    score += 1;
    feedback.push(`Title too long (${wordCount} words) — trim to 8-12 words`);
  }

  // Format check: [Component] + [Action] + [Expected Outcome]
  // Should mention a component/feature
  const hasComponent = /(?:login|dashboard|search|cart|payment|profile|settings|menu|form|page|modal|popup|button|table|list|report|account|notification|email|api|service|module|screen|panel|tab|header|footer|sidebar|navigation)/i.test(title);
  if (hasComponent) {
    score += 2;
  } else {
    feedback.push('Title should mention the component being tested (e.g., dashboard, login page, cart)');
  }

  // Should have an action verb
  const hasAction = /(?:verify|confirm|validate|check|ensure|test)/i.test(title);
  if (hasAction) {
    score += 2;
  } else if (/(?:can|should|will|does|is able)/i.test(title)) {
    score += 1;
    feedback.push('Prefer starting with: Verify, Confirm, Validate');
  } else {
    feedback.push('Title should include an action (Verify, Confirm, Validate)');
  }

  // Should indicate expected outcome
  const hasOutcome = /(?:success|fail|error|display|show|redirect|load|update|create|delete|disable|enable|accept|reject|deny|block|allow|receive|send|with|without)/i.test(title);
  if (hasOutcome) {
    score += 3;
  } else {
    score += 1;
    feedback.push('Title should hint at expected outcome (successfully, with error, displays correctly)');
  }

  if (feedback.length === 0 || (score >= 8 && feedback.every(f => f.startsWith('✓')))) {
    feedback.unshift('✓ Title follows [Component] + [Action] + [Outcome] format');
  }

  return { score: Math.min(score, 10), feedback };
}

// ==================== STEPS STRUCTURE & CLARITY (Golden Standard) ====================
// Max 7-8 steps, specific verbs (Click, Enter, Select, Verify, Navigate), first step = starting point
function rateStepsGolden(tc) {
  let score = 0;
  const feedback = [];

  let steps = tc.steps || tc.testSteps || [];
  if (typeof steps === 'string') {
    steps = steps.split(/[\n\r]+/).map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(s => s);
  }
  if (!Array.isArray(steps) || steps.length === 0) {
    feedback.push('Missing test steps');
    return { score: 0, feedback };
  }

  // Step count check (ideal: 3-8 steps)
  if (steps.length >= 3 && steps.length <= 8) {
    score += 2;
    feedback.push(`✓ Good step count (${steps.length} steps)`);
  } else if (steps.length > 8) {
    score += 1;
    feedback.push(`Too many steps (${steps.length}) — max 7-8 per test case. Consider splitting.`);
  } else {
    score += 1;
    feedback.push(`Only ${steps.length} step(s) — add more detail for reproducibility`);
  }

  // First step should establish starting point
  const firstStep = (typeof steps[0] === 'string' ? steps[0] : (steps[0].action || '')).toLowerCase();
  if (/^(navigate|open|go to|launch|access|log\s*in|sign\s*in|visit)/i.test(firstStep)) {
    score += 2;
  } else {
    feedback.push('First step should establish starting point (Navigate to..., Open..., Log in to...)');
  }

  // Action verb quality — prefer specific verbs
  const goodVerbs = /^(click|enter|type|select|navigate|open|verify|observe|scroll|drag|submit|press|expand|collapse|upload|download|hover|switch|close|fill|clear|refresh|wait|go to|log\s*in|sign\s*in)/i;
  const vagueVerbs = /^(check|ensure|make sure|validate|confirm|do|try|test|see|look|perform)/i;

  let goodVerbCount = 0;
  let vagueVerbCount = 0;
  let hasUIElements = 0;

  steps.forEach(s => {
    const text = (typeof s === 'string' ? s : (s.action || '')).trim();
    if (goodVerbs.test(text)) goodVerbCount++;
    else if (vagueVerbs.test(text)) vagueVerbCount++;

    // Check for specific UI element names (quoted text or specific identifiers)
    if (/['"][^'"]+['"]|button|field|dropdown|checkbox|link|tab|menu|modal|icon|input|textarea|label|header/i.test(text)) {
      hasUIElements++;
    }
  });

  // Score verb quality
  const goodVerbRatio = goodVerbCount / steps.length;
  if (goodVerbRatio >= 0.7) {
    score += 3;
    feedback.push('✓ Uses specific action verbs (Click, Enter, Select, Navigate)');
  } else if (goodVerbRatio >= 0.4) {
    score += 2;
    if (vagueVerbCount > 0) feedback.push(`${vagueVerbCount} step(s) use vague verbs — replace Check/Ensure with Click/Enter/Select/Verify`);
  } else {
    score += 1;
    feedback.push('Steps should use specific verbs: Click, Enter, Select, Navigate, Verify (avoid Check, Ensure, Validate)');
  }

  // UI element specificity
  const uiRatio = hasUIElements / steps.length;
  if (uiRatio >= 0.5) {
    score += 2;
    feedback.push('✓ References specific UI elements');
  } else {
    score += 1;
    feedback.push('Include exact UI element names (e.g., "Click the \'Submit\' button" not just "Click submit")');
  }

  // No assumptions — each step is self-contained (length check)
  const shortSteps = steps.filter(s => {
    const text = typeof s === 'string' ? s : (s.action || '');
    return text.length < 10;
  });
  if (shortSteps.length === 0) {
    score += 1;
  } else {
    feedback.push(`${shortSteps.length} step(s) too brief — no assumptions about tester knowledge`);
  }

  return { score: Math.min(score, 10), feedback };
}

// ==================== EXPECTED RESULTS (Golden Standard) ====================
// Must be specific, measurable. Answer: what should tester see/observe?
function rateExpectedResultGolden(tc) {
  let score = 0;
  const feedback = [];
  const expected = (tc.expectedResult || tc.expected || '').toString().trim();

  if (!expected) {
    feedback.push('Missing expected result — tester cannot determine pass/fail');
    return { score: 0, feedback };
  }

  score += 2; // Has expected result

  // Specific and measurable — mentions what tester SEES
  if (/(?:displays?|shows?|appears?|visible|message|text|page|screen|toast|alert|popup|notification|field|button|count|value|label|icon|banner|modal)/i.test(expected)) {
    score += 3;
    feedback.push('✓ Describes observable outcome');
  } else {
    feedback.push('Should describe what the tester sees/observes (displays, shows, appears, message text)');
  }

  // Contains specific values (quoted text, numbers, exact messages)
  if (/['"][^'"]+['"]|:\s*\S+|\d+|http|@/i.test(expected)) {
    score += 2;
    feedback.push('✓ Contains specific expected values');
  } else {
    feedback.push('Include exact expected values (message text, counts, states) — not just "loads successfully"');
  }

  // Not vague
  const vaguePatterns = /^(should work|works|it works|properly|correctly|as expected|fine|good|ok|success|pass|no error|no issue|loads? successfully|works? fine|works? properly|works? correctly)$/i;
  const endsVague = /(?:should work|works fine|works properly|works correctly|as expected|successfully|loads correctly)\s*\.?$/i;

  if (!vaguePatterns.test(expected) && !endsVague.test(expected)) {
    score += 2;
  } else {
    score += 0;
    feedback.push('Too vague — "loads successfully" doesn\'t tell tester what to observe. Describe exact UI state.');
  }

  // Length check — must have enough detail
  if (expected.length >= 30) {
    score += 1;
  } else {
    feedback.push('Expected result too brief — add more detail about what tester should observe');
  }

  if (feedback.every(f => f.startsWith('✓'))) {
    feedback.unshift('✓ Clear, measurable expected result');
  }

  return { score: Math.min(score, 10), feedback };
}

// ==================== TEST DATA & PREREQUISITES (Golden Standard - Info Only) ====================
// Not scored, but flags if generic placeholders are used
function rateTestDataGolden(tc) {
  const feedback = [];
  const hasPrereqs = tc.preConditions || tc.prerequisites || tc.setup || '';
  const hasTestData = tc.testData || tc.inputData || tc.data || '';
  const stepsText = Array.isArray(tc.steps) ? tc.steps.join(' ') : (tc.steps || '').toString();
  const allText = (hasPrereqs + ' ' + hasTestData + ' ' + stepsText).toLowerCase();

  // Check for generic placeholders (bad practice)
  const genericPatterns = /(?:enter valid email|use test data|valid credentials|enter valid password|enter valid username|some data|test data|sample data|any valid|any email|placeholder)/i;

  if (genericPatterns.test(allText)) {
    feedback.push('⚠️ Contains generic placeholders — provide exact values or reference test data lake');
  }

  if (hasPrereqs) {
    // Check if prerequisites mention specific things
    if (/(?:role|permission|environment|account|user:|email:|url:|state:)/i.test(hasPrereqs)) {
      feedback.push('✓ Prerequisites specify roles/environment/data');
    } else {
      feedback.push('Prerequisites could be more specific (user roles, environment, system state)');
    }
  } else {
    feedback.push('ℹ️ No prerequisites specified');
  }

  if (hasTestData) {
    if (/(?:@|\.com|\d{3,}|http|specific|exact)/i.test(typeof hasTestData === 'object' ? JSON.stringify(hasTestData) : hasTestData)) {
      feedback.push('✓ Test data has specific values');
    } else {
      feedback.push('Test data should have exact values or reference test data lake');
    }
  } else {
    feedback.push('ℹ️ No test data specified');
  }

  const score = feedback.some(f => f.startsWith('⚠️')) ? 4 : feedback.some(f => f.startsWith('✓')) ? 8 : 5;
  return { score, feedback };
}

// ==================== TITLE ↔ STEPS RELEVANCE ====================
function rateTitleStepsRelevance(tc) {
  let score = 0;
  const feedback = [];
  const title = (tc.title || tc.description || '').toLowerCase().trim();
  let steps = tc.steps || tc.testSteps || [];
  if (typeof steps === 'string') steps = steps.split(/[\n\r]+/).map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(s => s);

  if (!title || steps.length === 0) {
    feedback.push('Cannot check relevance — title or steps missing');
    return { score: 0, feedback };
  }

  const stepsText = (Array.isArray(steps) ? steps.join(' ') : steps.toString()).toLowerCase();
  const stopWords = ['verify','validate','check','ensure','test','confirm','that','the','a','an','is','are','with','for','to','on','in','of','and','or','when','should','can','be','it','by','from','this','user','able','successfully','correctly'];
  const titleWords = title.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

  if (titleWords.length === 0) { return { score: 5, feedback: ['Title has no specific keywords to compare'] }; }

  const matchedWords = titleWords.filter(word => stepsText.includes(word));
  const matchRatio = matchedWords.length / titleWords.length;

  if (matchRatio >= 0.4) {
    score = 10;
    feedback.push('✓ Title and steps are well aligned');
  } else if (matchRatio >= 0.25) {
    score = 7;
    feedback.push('Title and steps mostly align');
  } else if (matchRatio > 0) {
    score = 4;
    feedback.push('Weak connection between title and steps');
    feedback.push(`Title mentions "${titleWords.slice(0, 4).join(', ')}" but steps don't cover most of these`);
  } else {
    score = 2;
    feedback.push('Title and steps appear disconnected');
  }

  return { score: Math.min(score, 10), feedback };
}

// ==================== HELPERS ====================
function generateSuggestions(criteria) {
  const suggestions = [];
  criteria.forEach(c => {
    if (c.weight > 0 && c.score < 6) {
      c.feedback.forEach(f => {
        if (!f.startsWith('✓') && !f.includes('appears human') && !f.includes('Looks human') && !f.startsWith('ℹ️')) {
          suggestions.push(`[${c.name}] ${f}`);
        }
      });
    }
  });
  return suggestions;
}

function getGrade(score) {
  if (score >= 9) return 'A+'; if (score >= 8) return 'A'; if (score >= 7) return 'B';
  if (score >= 6) return 'C'; if (score >= 5) return 'D'; return 'F';
}

// ==================== IMPROVED TEST CASE GENERATOR ====================
function generateImprovedTC(tc, analysisResult) {
  if (analysisResult.overallRating >= 8) return null;

  const improved = { rewrites: {} };
  const title = (tc.title || tc.description || '').trim();
  const steps = tc.steps || tc.testSteps || [];
  const expected = (tc.expectedResult || tc.expected || '').trim();

  // Generate title rewrites if score < 8
  const titleCriteria = analysisResult.criteria.find(c => c.name === 'Title Quality');
  if (titleCriteria && titleCriteria.score < 8) {
    improved.rewrites.title = generateTitleRewrites(title, tc);
  }

  // Generate steps rewrites if score < 8
  const stepsCriteria = analysisResult.criteria.find(c => c.name === 'Steps Structure & Clarity');
  if (stepsCriteria && stepsCriteria.score < 8) {
    improved.rewrites.steps = generateStepsRewrite(steps, tc);
  }

  // Generate expected result rewrites if score < 8
  const expectedCriteria = analysisResult.criteria.find(c => c.name === 'Expected Results');
  if (expectedCriteria && expectedCriteria.score < 8) {
    improved.rewrites.expectedResult = generateExpectedRewrites(expected, tc);
  }

  if (Object.keys(improved.rewrites).length === 0) return null;
  return improved;
}

function generateTitleRewrites(title, tc) {
  const stepsText = Array.isArray(tc.steps) ? tc.steps.join(' ').toLowerCase() : (tc.steps || '').toLowerCase();
  const expected = (tc.expectedResult || tc.expected || '').toLowerCase();
  const context = (title + ' ' + stepsText + ' ' + expected).toLowerCase();

  // Detect component from context
  let component = 'Application';
  if (/login|sign\s*in|auth|credential|password/i.test(context)) component = 'Login page';
  else if (/dashboard/i.test(context)) component = 'Dashboard';
  else if (/search|find|filter/i.test(context)) component = 'Search';
  else if (/cart|basket|order/i.test(context)) component = 'Cart';
  else if (/payment|checkout|billing/i.test(context)) component = 'Payment';
  else if (/profile|account|settings/i.test(context)) component = 'User profile';
  else if (/register|sign\s*up|create account/i.test(context)) component = 'Registration';
  else if (/email|notification|alert/i.test(context)) component = 'Notifications';
  else if (/report|analytics/i.test(context)) component = 'Reports';
  else if (/api|endpoint|request/i.test(context)) component = 'API';

  // Detect action
  let action = 'functions correctly';
  if (/valid|correct|success/i.test(context)) action = 'works with valid inputs';
  if (/invalid|wrong|error|fail/i.test(context)) action = 'shows error for invalid inputs';
  if (/empty|blank|missing/i.test(context)) action = 'handles empty fields';
  if (/update|edit|modify/i.test(context)) action = 'updates successfully';
  if (/delete|remove/i.test(context)) action = 'removes item correctly';
  if (/display|show|load/i.test(context)) action = 'displays correct information';

  const options = [];

  // Option 1: Clean up existing title
  let cleaned = title.replace(/\bensure that the system\b/gi, 'Verify')
    .replace(/\bseamlessly\b/gi, '').replace(/\bsubsequently\b/gi, '')
    .replace(/\bin a timely manner\b/gi, '').replace(/\bthe appropriate\b/gi, 'the')
    .replace(/\bcomprehensive\b/gi, '').replace(/\brobust\b/gi, '')
    .replace(/\s{2,}/g, ' ').trim();
  if (!/^(verify|confirm|validate)/i.test(cleaned)) cleaned = 'Verify ' + cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  if (cleaned.split(/\s+/).length > 12) cleaned = cleaned.split(/\s+/).slice(0, 12).join(' ');
  if (cleaned !== title) options.push({ text: cleaned, reason: 'Cleaned up — removed fluff, added action verb' });

  // Option 2: Rewrite in golden format
  options.push({ text: `Verify ${component.toLowerCase()} ${action}`, reason: 'Format: [Component] + [Action] + [Outcome]' });

  // Option 3: More specific rewrite
  if (/error|fail|invalid/i.test(context)) {
    options.push({ text: `Verify ${component.toLowerCase()} displays error message for invalid input`, reason: 'Specific error scenario format' });
  } else {
    options.push({ text: `Verify user can successfully interact with ${component.toLowerCase()}`, reason: 'User-centric format with clear outcome' });
  }

  return options.filter((o, i, arr) => arr.findIndex(x => x.text === o.text) === i).slice(0, 3);
}

function generateStepsRewrite(steps, tc) {
  let stepsList = Array.isArray(steps) ? steps.map(s => typeof s === 'string' ? s : (s.action || '')) : [];
  if (typeof steps === 'string') stepsList = steps.split(/[\n\r]+/).map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(s => s);

  const rewritten = [];

  // Ensure first step is navigation/starting point
  if (stepsList.length > 0) {
    const first = stepsList[0];
    if (!/^(navigate|open|go to|launch|access|log\s*in|sign\s*in|visit)/i.test(first)) {
      rewritten.push('Navigate to [application/page URL]');
    }
  } else {
    rewritten.push('Navigate to [application/page URL]');
  }

  // Rewrite each step with specific verbs
  stepsList.forEach((step, i) => {
    let improved = step.trim();
    // Replace vague verbs
    improved = improved.replace(/^check\s/i, 'Verify ');
    improved = improved.replace(/^ensure\s/i, 'Verify ');
    improved = improved.replace(/^make sure\s/i, 'Verify ');
    improved = improved.replace(/^validate\s/i, 'Verify ');
    // Remove AI fluff
    improved = improved.replace(/\bof the application\b/gi, '');
    improved = improved.replace(/\bin the respective fields?\b/gi, '');
    improved = improved.replace(/\bto initiate the .+ process\b/gi, '');
    improved = improved.replace(/\s{2,}/g, ' ').trim();

    // Skip if it duplicates the first nav step we added
    if (i === 0 && rewritten.length > 0 && /^navigate/i.test(rewritten[0]) && /^(navigate|open|go to)/i.test(improved)) return;

    if (improved.length < 8) {
      improved += ' [specify exact action and UI element]';
    }
    rewritten.push(improved);
  });

  // Cap at 8 steps
  const capped = rewritten.slice(0, 8);

  return [{
    text: capped,
    reason: 'Rewritten with specific action verbs, starting point established, max 8 steps'
  }];
}

function generateExpectedRewrites(expected, tc) {
  const context = ((tc.title || '') + ' ' + (Array.isArray(tc.steps) ? tc.steps.join(' ') : '')).toLowerCase();
  const options = [];

  // Option 1: Enhance existing
  let enhanced = expected;
  enhanced = enhanced.replace(/\b(works? fine|works? properly|works? correctly|as expected|in a timely manner)\b\.?$/gi, '').trim();
  enhanced = enhanced.replace(/\bshould seamlessly\b/gi, 'should');
  enhanced = enhanced.replace(/\bloads? successfully\b/gi, 'loads and displays [specific content]');
  if (enhanced.length < 20) enhanced += ' — [describe exact UI state: what message, what page, what values are visible]';
  if (enhanced !== expected) options.push({ text: enhanced, reason: 'Enhanced with specificity — describes what tester observes' });

  // Option 2: Template based on context
  if (/login|sign\s*in/i.test(context)) {
    options.push({ text: "Dashboard page loads. 'Welcome, [username]' message displays in top-right corner. Navigation menu shows all authorized options.", reason: 'Specific observable outcome for login scenario' });
  } else if (/error|invalid|fail/i.test(context)) {
    options.push({ text: "Error message '[exact message text]' displays in red below the input field. Form is not submitted. User remains on current page.", reason: 'Specific error state observation' });
  } else if (/search/i.test(context)) {
    options.push({ text: "Search results page displays with [N] matching results. Each result shows [title, description, date]. 'Showing X results' counter is visible.", reason: 'Specific search result observation' });
  } else if (/cart|price|total/i.test(context)) {
    options.push({ text: "Cart total updates to $[amount]. Line item shows quantity [N] × $[price] = $[total]. 'Cart updated' toast notification appears.", reason: 'Specific cart/pricing observation' });
  } else {
    options.push({ text: "Page displays with [specific element/message]. [Specific field] shows value '[expected value]'. No error messages present.", reason: 'Template: specific observable state' });
  }

  // Option 3: What-to-observe format
  options.push({ text: `Tester observes: 1) [Primary visual change], 2) [Confirmation message/element], 3) [System state change if applicable]`, reason: 'Checklist format — each point independently verifiable' });

  return options.slice(0, 3);
}
