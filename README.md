# 🧪 Test Case Analyzer

Analyze and rate your test cases against software testing best practices. Get scores, grades, and improvement suggestions for each test case.

## 🚀 Live Demo

Host this on GitHub Pages for free — no server required!

## Features

- **Form Input** — Add test cases via structured form fields
- **JSON Input** — Paste test cases as JSON array
- **File Upload** — Upload CSV or Excel (.xlsx/.xls) files with auto column mapping
- **Sample Data** — Try with pre-built examples of varying quality

## Rating Criteria (Weighted)

| Criteria | Weight | What it checks |
|----------|--------|---------------|
| Test Case ID & Description | 1.5x | Unique ID, naming convention, descriptive text |
| Test Objective Clarity | 2x | Action verbs, specificity, feature mention |
| Pre/Post Conditions | 1x | Defined conditions before and after execution |
| Test Steps Quality | 2x | Structured steps, sufficient detail, clarity |
| Test Data | 1.5x | Input data specified with values |
| Expected Result | 2x | Specific, measurable, no vague terms |
| Actual Result & Status | 1x | Recorded result, proper status values |

## Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload all files (`index.html`, `analyzer.js`, `ui.js`)
3. Go to **Settings → Pages**
4. Source: **Deploy from a branch** → select `main` → `/ (root)`
5. Click Save — your site will be live at `https://<username>.github.io/<repo-name>`

## Files

```
index.html    — UI structure and styles
analyzer.js   — Scoring/analysis engine
ui.js         — User interaction logic
```

## Local Development

Just open `index.html` in a browser, or:

```bash
python3 -m http.server 8080
# Visit http://localhost:8080
```

No build step, no dependencies, no server needed.
