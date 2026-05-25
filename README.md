# MyPlans - VS Code Extension

A personal task manager that reads your `.yml` / `.yaml` project files and gives you a Monokai-themed sidebar panel to plan, track, and deploy your work - without leaving VS Code.

---

## Features

| Feature | Description |
|---|---|
| **Hierarchical tree** | Categories → Topics → Tasks → Steps, all collapsible |
| **Expandable tasks** | Click a task header to expand/collapse its steps |
| **Check to complete** | Checking a step comments it out in the YAML file (marks it done) |
| **Inline editing** | ✎ edit button on every category, topic, task, and step |
| **Delete anywhere** | ✕ delete button on every category, topic, task, and step (with confirmation) |
| **Add anywhere** | "+ Category", "+ Topic", "+ Task", "+ Step" buttons throughout the UI |
| **Progress bar** | Global and per-category progress bars showing done/total steps |
| **Go-to line** | Hover any row and click ↗ to jump directly to that line in the editor |
| **Deploy** | One-click `git add → commit → push` of all YAML changes |
| **Live refresh** | Panel updates automatically whenever a YAML file changes on disk |

---

## Installation

### From the VS Code Marketplace

Search for **MyPlans** in the Extensions panel (`Ctrl+Shift+X`) and click **Install**.

### From a `.vsix` file

```bash
code --install-extension myplans-1.0.1.vsix
```

Or: Extensions panel → `⋯` menu → **Install from VSIX…**

### From source (development)

**Prerequisites:** Node.js 18+, VS Code 1.85+

```bash
# 1 – Copy the extension folder into your workspace
cd myplans

# 2 – Install dev dependencies
npm install

# 3 – Open in VS Code
code .

# 4 – Press F5 to launch the Extension Development Host
```

---

## Getting Started

1. Open any workspace folder in VS Code.
2. Click the **MyPlans** icon in the Activity Bar (left sidebar).
3. Click **+ Category** to create your first folder.
4. Inside the category, click **+ Topic** to create a YAML file.
5. Inside the topic, click **+ Task** to add a task.
6. Inside the task, click **+ Step** to add steps.
7. Check steps off as you complete them!

---

## YAML File Format

MyPlans uses a simple, hand-editable YAML structure:

```yaml
# Work/sprint-12.yaml

Set up CI pipeline:
  - Install GitHub Actions runner
  - Write build.yml workflow
  - Add test step

Write API documentation:
  - Draft endpoint list
  - Add request/response examples
  - Review with team
```

**Completing a step** comments out that line in the file:

```yaml
Set up CI pipeline:
  # - Install GitHub Actions runner   ← checked (done)
  # - Write build.yml workflow         ← checked (done)
  - Add test step                      ← still to do
```

**Un-checking** removes the comment and restores the original line.

---

## UI Controls

### Hover actions (appear on hover)

| Button | Where | What it does |
|---|---|---|
| **✎** | Category / Topic / Task / Step | Opens an input box to rename/edit |
| **✕** | Category / Topic / Task / Step | Deletes with a confirmation dialog |
| **↗** | Topic / Task / Step | Opens the YAML file at that exact line |

### Header buttons (always visible)

| Button | Where | What it does |
|---|---|---|
| **+ Category** | Top header | Creates a new category folder |
| **⟳** | Top header | Manually refreshes the panel |
| **+ Topic** | Category row | Creates a new `.yaml` file in that category |
| **+ Task** | Topic row | Appends a new task to that topic file |
| **+ Step** | Task row | Appends a new step to that task |

### Collapse / Expand

Click any **category**, **topic**, or **task** header to collapse or expand it. The chevron (▶) rotates to indicate the open/closed state.

---

## Git Deploy

The **Deploy to Git** button at the bottom of the panel runs:

```bash
git add *.yml *.yaml
git commit -m "MyPlans: update tasks [YYYY-MM-DD HH:MM:SS]"
git push
```

**Requirements:**
- The workspace must be a Git repository (`git init` or cloned).
- A remote must be configured (`git remote add origin …`).
- Your credentials or SSH key must allow push access.

---

## Color Theme Reference (Monokai)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#272822` | Main background |
| `--green` | `#a6e22e` | Progress bar, done tasks, deploy button |
| `--orange` | `#fd971f` | Category names, folder icon |
| `--blue` | `#66d9ef` | Topic names, edit button hover |
| `--yellow` | `#e6db74` | Task names, metric values |
| `--red` | `#f92672` | Error states, delete button hover |
| `--muted` | `#75715e` | Comments, secondary text, inactive icons |

---

## Keyboard Shortcuts

There are no default keybindings. You can assign your own via **File → Preferences → Keyboard Shortcuts** and search for `MyPlans`.

Available commands:
- `myplans.refresh` - Refresh the panel
- `myplans.deploy` - Deploy to Git
- `myplans.addCategory` - Add a new category

---

## Requirements

- VS Code **1.85** or later
- Node.js **18+** (development only)
- Git in `PATH` (for Deploy feature)

---

## Known Limitations

- Only `.yml` and `.yaml` files are scanned.
- YAML files must use the `Task Name:\n  - step` format; arbitrary YAML schemas are not supported.
- The Deploy button commits **all** changed YAML files in the workspace.

---

## License

MIT
