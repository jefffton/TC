# 🧪 Test Case Analyzer

Upload your test cases (Excel/CSV) and get instant quality ratings, improvement suggestions, and AI-generated content detection for each test case.

## What It Checks

| Criteria | Weight | Description |
|----------|--------|-------------|
| **Title Quality** | 2x | Is the title crisp, specific, and actionable? |
| **Steps Clarity** | 3x | Can a new tester easily follow the steps? |
| **Expected Result** | 3x | Is it clear enough to determine pass/fail? |
| **Test Data & Prerequisites** | 1.5x | Are inputs/setup provided? (optional but noted) |
| **AI Detection** | 1x | Flags AI-generated content patterns |

## Input Options

- **Excel / CSV Upload** — drag & drop or browse for .xlsx, .xls, .csv files
- **TestRail Import** — export from TestRail as CSV, then upload
- **Sample Data** — try with built-in examples

## Deploy to GitHub Pages (Free)

1. Create a new GitHub repository
2. Upload: `index.html`, `analyzer.js`, `ui.js`
3. Settings → Pages → Source: `main` branch, `/ (root)`
4. Your site is live at `https://<username>.github.io/<repo-name>`

## Local Use

Open `index.html` in any browser. No server needed.

## Files

```
index.html    — UI layout and styles
analyzer.js   — Scoring engine + AI detection
ui.js         — File upload, rendering, interactions
```
