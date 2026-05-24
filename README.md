# MyPlans - VS Code Extension

A personal task manager that reads your `.yml` / `.yaml` project files and gives you a beautiful Monokai-themed sidebar panel to track, complete, and deploy your plans.

---

## Features

| Feature | Description |
|---|---|
| **Auto-scan** | Finds all `.yml` / `.yaml` files in your workspace and groups them by top-level folder (topic) |
| **Task tree** | Expandable topic → file → task hierarchy with checkboxes |
| **Check to complete** | Clicking a checkbox comments out that line in the source file (marking it done) |
| **Metrics bar** | Shows total / done counts per topic and an overall progress bar |
| **Go-to line** | Hover any task and click ↗ to jump straight to that line in the editor |
| **Deploy** | One-click `git add → commit → push` of all YAML changes |
| **Live refresh** | Panel updates automatically whenever a YAML file changes on disk |

---

## Installation

### From source (development)

**Prerequisites:** Node.js 18+, VS Code 1.85+

```bash
# 1 - Clone / copy the extension folder
cd myplans-extension

# 2 - Install dependencies
npm install

# 3 - Open in VS Code
code .

# 4 - Press F5 to launch Extension Development Host
```

### Package as .vsix

```bash
npm install -g @vscode/vsce
vsce package
# Produces myplans-1.0.0.vsix
# Install: code --install-extension myplans-1.0.0.vsix
```

---

## YAML Task Format

The extension treats any **key: value** line (or `- item` sequence entry) with a non-empty scalar value as a task.

```yaml
# topic: Overview.yml

daily_standup: 09:00
review_PRs: true
write_docs: "Draft API reference"

items:
  - Buy groceries
  - Call dentist
```

**Completing a task** comments out that line:

```yaml
# daily_standup: 09:00   ← checked = commented
review_PRs: true
```

**Un-checking** removes the comment.

---

## Git Deploy

The **Deploy to Git** button runs:

```bash
git add *.yml *.yaml
git commit -m "MyPlans: update tasks [YYYY-MM-DD HH:MM:SS]"
git push
```

Requirements:
- The workspace folder must be a Git repository (`git init` or cloned).
- You must have a remote configured (`git remote add origin …`).
- Your credentials / SSH key must be set up for push access.

---

## Project Structure

```
myplans-extension/
├── package.json          - Extension manifest & contributes
├── src/
│   ├── extension.js      - activate() / deactivate()
│   ├── webviewProvider.js - Sidebar webview (Monokai UI)
│   ├── scanner.js        - Workspace YAML file scanner
│   ├── yamlParser.js     - Task parser & comment toggler
│   └── gitDeploy.js      - git add / commit / push helper
└── media/
    └── icon.svg          - Activity bar icon
```

---

## Color Theme Reference (Monokai)

| Variable | Color | Usage |
|---|---|---|
| `--bg` | `#272822` | Main background |
| `--green` | `#a6e22e` | Progress, done tasks, deploy button |
| `--orange` | `#fd971f` | Topic names |
| `--blue` | `#66d9ef` | File names |
| `--yellow` | `#e6db74` | Metric values |
| `--red` | `#f92672` | Error states |
| `--muted` | `#75715e` | Comments / secondary text |
