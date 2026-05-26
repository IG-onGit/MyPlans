'use strict';

const vscode = require('vscode');
const fs = require('fs');
const { toggleLineComment, toggleAsap } = require('./yamlParser');
const { getGitStatus } = require('./gitDeploy');
const {
  createCategory, createTopic, addTask, addStep,
  renameCategory, deleteCategory,
  renameTopic, deleteTopic,
  editTask, removeTask,
  editStepText, deleteStep
} = require('./fileOps');

class MyPlansWebviewProvider {
  constructor(context, scanner) {
    this._context = context;
    this._scanner = scanner;
    this._view = null;
    this._openSections = new Set();
    this._focusLineIndex = null; // lineIndex to restore focus to after refresh
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this._refresh();

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{yml,yaml}');
    watcher.onDidChange(() => this._refresh());
    watcher.onDidCreate(() => this._refresh());
    watcher.onDidDelete(() => this._refresh());
    this._context.subscriptions.push(watcher);

    const dirWatcher = vscode.workspace.createFileSystemWatcher('**/');
    dirWatcher.onDidCreate(() => this._refresh());
    dirWatcher.onDidDelete(() => this._refresh());
    this._context.subscriptions.push(dirWatcher);

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.command) {
        case 'refresh':           await this._refresh();                                                              break;
        case 'toggleStep':        await this._toggleStep(msg.filePath, msg.lineIndex);               break;
        case 'toggleAsap':        await this._toggleAsap(msg.filePath, msg.lineIndex);                               break;
        case 'openFile':          await this._openFile(msg.filePath, msg.lineIndex);                                 break;
        case 'addCategory':       await this._addCategory();                                                         break;
        case 'addTopic':          await this._addTopic(msg.categoryFolder);                                          break;
        case 'addTask':           await this._addTask(msg.filePath);                                                 break;
        case 'addStep':           await this._addStep(msg.filePath, msg.taskLineIndex);                              break;
        case 'deploy':            await this._deploy();                                                              break;
        // edit
        case 'editCategory':      await this._editCategory(msg.folderPath, msg.currentName);                        break;
        case 'editTopic':         await this._editTopic(msg.filePath, msg.currentName);                             break;
        case 'editTask':          await this._editTask(msg.filePath, msg.taskLineIndex, msg.currentName);           break;
        case 'editStep':          await this._editStep(msg.filePath, msg.lineIndex, msg.currentText);               break;
        // delete
        case 'deleteCategory':    await this._deleteCategory(msg.folderPath, msg.name);                             break;
        case 'deleteTopic':       await this._deleteTopic(msg.filePath, msg.name);                                  break;
        case 'deleteTask':        await this._deleteTask(msg.filePath, msg.taskLineIndex, msg.stepLineIndices);     break;
        case 'deleteStep':        await this._deleteStep(msg.filePath, msg.lineIndex);                              break;
        case 'saveState':          this._openSections = new Set(msg.openSections);                                   break;
      }
    });
  }

  async _refresh() {
    const cats = await this._scanner.scanWorkspace();
    if (this._view) {
      const gitStatus = getGitStatus();
      const focusLineIndex = this._focusLineIndex;
      this._focusLineIndex = null;
      this._view.webview.html = buildHtml(cats, gitStatus, this._openSections, focusLineIndex);
    }
  }

  async _toggleStep(filePath, lineIndex) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      fs.writeFileSync(filePath, toggleLineComment(content, Number(lineIndex)), 'utf8');
      this._focusLineIndex = Number(lineIndex); // bake focus target into next render
      await this._refresh();
    } catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _toggleAsap(filePath, lineIndex) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      fs.writeFileSync(filePath, toggleAsap(content, Number(lineIndex)), 'utf8');
      await this._refresh();
    } catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _openFile(filePath, lineIndex) {
    try {
      const doc = await vscode.workspace.openTextDocument(filePath);
      const ed  = await vscode.window.showTextDocument(doc, { preserveFocus: false });
      const pos = new vscode.Position(Number(lineIndex) || 0, 0);
      ed.selection = new vscode.Selection(pos, pos);
      ed.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    } catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _addCategory() {
    const name = await vscode.window.showInputBox({ title: 'MyPlans - New Category', prompt: 'Enter category name', placeHolder: 'e.g. Work Projects', ignoreFocusOut: true });
    if (!name || !name.trim()) return;
    try { createCategory(name.trim()); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _addTopic(categoryFolder) {
    const name = await vscode.window.showInputBox({ title: 'MyPlans - New Topic', prompt: 'Enter topic file name', placeHolder: 'e.g. Sprint 12', ignoreFocusOut: true });
    if (!name || !name.trim()) return;
    try { createTopic(categoryFolder, name.trim()); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _addTask(filePath) {
    const name = await vscode.window.showInputBox({ title: 'MyPlans - New Task', prompt: 'Enter task name', placeHolder: 'e.g. Set up CI pipeline', ignoreFocusOut: true });
    if (!name || !name.trim()) return;
    try { addTask(filePath, name.trim()); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _addStep(filePath, taskLineIndex) {
    const text = await vscode.window.showInputBox({ title: 'MyPlans - New Step', prompt: 'Enter step description', placeHolder: 'e.g. Install dependencies', ignoreFocusOut: true });
    if (!text || !text.trim()) return;
    try { addStep(filePath, Number(taskLineIndex), text.trim()); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  // ── edit handlers ────────────────────────────────────────────────────────

  async _editCategory(folderPath, currentName) {
    const name = await vscode.window.showInputBox({ title: 'MyPlans - Rename Category', prompt: 'Enter new name', value: currentName, ignoreFocusOut: true });
    if (!name || !name.trim() || name.trim() === currentName) return;
    try { renameCategory(folderPath, name.trim()); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _editTopic(filePath, currentName) {
    const name = await vscode.window.showInputBox({ title: 'MyPlans - Rename Topic', prompt: 'Enter new name', value: currentName, ignoreFocusOut: true });
    if (!name || !name.trim() || name.trim() === currentName) return;
    try { renameTopic(filePath, name.trim()); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _editTask(filePath, taskLineIndex, currentName) {
    const name = await vscode.window.showInputBox({ title: 'MyPlans - Rename Task', prompt: 'Enter new task name', value: currentName, ignoreFocusOut: true });
    if (!name || !name.trim() || name.trim() === currentName) return;
    try { editTask(filePath, Number(taskLineIndex), name.trim()); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _editStep(filePath, lineIndex, currentText) {
    const text = await vscode.window.showInputBox({ title: 'MyPlans - Edit Step', prompt: 'Enter new step text', value: currentText, ignoreFocusOut: true });
    if (!text || !text.trim() || text.trim() === currentText) return;
    try { editStepText(filePath, Number(lineIndex), text.trim()); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  // ── delete handlers ──────────────────────────────────────────────────────

  async _deleteCategory(folderPath, name) {
    const choice = await vscode.window.showWarningMessage(
      `Delete category "${name}" and ALL its topics?`, { modal: true }, 'Delete'
    );
    if (choice !== 'Delete') return;
    try { deleteCategory(folderPath); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _deleteTopic(filePath, name) {
    const choice = await vscode.window.showWarningMessage(
      `Delete topic "${name}"?`, { modal: true }, 'Delete'
    );
    if (choice !== 'Delete') return;
    try { deleteTopic(filePath); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _deleteTask(filePath, taskLineIndex, stepLineIndices) {
    const choice = await vscode.window.showWarningMessage(
      `Delete this task and all its steps?`, { modal: true }, 'Delete'
    );
    if (choice !== 'Delete') return;
    try { removeTask(filePath, Number(taskLineIndex), stepLineIndices); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _deleteStep(filePath, lineIndex) {
    const choice = await vscode.window.showWarningMessage(
      `Delete this step?`, { modal: true }, 'Delete'
    );
    if (choice !== 'Delete') return;
    try { deleteStep(filePath, Number(lineIndex)); await this._refresh(); }
    catch (e) { vscode.window.showErrorMessage(`MyPlans: ${e.message}`); }
  }

  async _deploy() {
    if (this._view) this._view.webview.postMessage({ command: 'deploying' });
    try {
      const { gitDeploy } = require('./gitDeploy');
      const result = await gitDeploy();
      vscode.window.showInformationMessage(`MyPlans: ${result.message}`);
      if (this._view) this._view.webview.postMessage({ command: 'deployDone', success: true, message: result.message });
    } catch (e) {
      vscode.window.showErrorMessage(`MyPlans Deploy: ${e.message}`);
      if (this._view) this._view.webview.postMessage({ command: 'deployDone', success: false, message: e.message });
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* HTML builder                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

function attr(v) { return String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }
function esc(v)  { return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function buildHtml(categories, gitStatus, openSections, focusLineIndex) {
  openSections = openSections || new Set();
  const isOpen = (id) => openSections.has(id);
  const isGit = gitStatus && gitStatus.isGit;
  const hasChanges = gitStatus && gitStatus.hasChanges;
  const deployDisabled = !isGit || !hasChanges;
  let totalSteps = 0, doneSteps = 0, totalTasks = 0, totalTopics = 0;
  for (const cat of categories) {
    totalTopics += cat.topics.length;
    for (const topic of cat.topics) {
      totalTasks += topic.tasks.length;
      for (const task of topic.tasks) {
        totalSteps += task.steps.length;
        doneSteps  += task.steps.filter(s => s.commented).length;
      }
    }
  }
  const pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;

  let catsHtml = '';

  if (categories.length === 0) {
    catsHtml = `<div class="empty">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No categories found</div>
      <div>Click "+ Category" to create your first folder.</div>
    </div>`;
  } else {
    for (let ci = 0; ci < categories.length; ci++) {
      const cat = categories[ci];
      let catSteps = 0, catDone = 0;
      let catHasAsap = false;
      for (const t of cat.topics)
        for (const tk of t.tasks) {
          catSteps += tk.steps.length;
          catDone  += tk.steps.filter(s => s.commented).length;
          if (tk.steps.some(s => s.asap)) catHasAsap = true;
        }
      const catPct = catSteps > 0 ? Math.round((catDone / catSteps) * 100) : 0;

      let topicsHtml = '';
      for (let ti = 0; ti < cat.topics.length; ti++) {
        const topic = cat.topics[ti];
        let topicSteps = 0, topicDone = 0;
        let topicHasAsap = false;
        for (const tk of topic.tasks) {
          topicSteps += tk.steps.length;
          topicDone  += tk.steps.filter(s => s.commented).length;
          if (tk.steps.some(s => s.asap)) topicHasAsap = true;
        }

        let tasksHtml = '';
        for (let tki = 0; tki < topic.tasks.length; tki++) {
          const task = topic.tasks[tki];
          const taskDone = task.steps.filter(s => s.commented).length;
          const taskHasAsap = task.steps.some(s => s.asap);
          const stepIndices = task.steps.map(s => s.lineIndex);

          let stepsHtml = '';
          for (let si = 0; si < task.steps.length; si++) {
            const step = task.steps[si];
            stepsHtml += `
            <div class="step-row${step.commented ? ' done' : ''}${step.asap ? ' asap' : ''}"
                 tabindex="0"
                 data-nav="step"
                 data-filepath="${attr(topic.absolutePath)}"
                 data-lineindex="${step.lineIndex}">
              <label class="check-wrap">
                <input type="checkbox" class="step-cb"
                  ${step.commented ? 'checked' : ''}
                  data-action="toggleStep"
                  data-filepath="${attr(topic.absolutePath)}"
                  data-lineindex="${step.lineIndex}"
                  tabindex="-1"
                />
              </label>
              <span class="asap-dot${step.asap ? ' active' : ''}"
                    title="${step.asap ? 'Remove ASAP flag' : 'Mark as ASAP'}"
                    data-action="toggleAsap"
                    data-filepath="${attr(topic.absolutePath)}"
                    data-lineindex="${step.lineIndex}"></span>
              <span class="step-text">${esc(step.text)}</span>
              <div class="row-actions">
                <button class="goto-btn always-visible" title="Open file at this line"
                  data-action="openFile"
                  data-filepath="${attr(topic.absolutePath)}"
                  data-lineindex="${step.lineIndex}"
                  tabindex="-1">↗</button>
                <button class="icon-btn edit-btn" title="Edit step"
                  data-action="editStep"
                  data-filepath="${attr(topic.absolutePath)}"
                  data-lineindex="${step.lineIndex}"
                  data-currenttext="${attr(step.text)}"
                  tabindex="-1">✎</button>
                <button class="icon-btn del-btn" title="Delete step"
                  data-action="deleteStep"
                  data-filepath="${attr(topic.absolutePath)}"
                  data-lineindex="${step.lineIndex}"
                  tabindex="-1">✕</button>
              </div>
            </div>`;
          }

          tasksHtml += `
          <div class="task-block">
            <div class="task-header" data-toggle="tkb-${ci}-${ti}-${tki}"
                 tabindex="0" data-nav="task" data-bodyid="tkb-${ci}-${ti}-${tki}">
              <span class="task-chevron${isOpen(`tkb-${ci}-${ti}-${tki}`) ? ' open' : ''}" data-chevron="tkb-${ci}-${ti}-${tki}">▶</span>
              ${taskHasAsap ? '<span class="bubble-dot" title="Has ASAP steps"></span>' : ''}
              <span class="task-name">${esc(task.name)}</span>
              <span class="task-badge">${taskDone}/${task.steps.length}</span>
              <div class="row-actions task-actions">
                <button class="add-btn"
                  data-action="addStep"
                  data-filepath="${attr(topic.absolutePath)}"
                  data-tasklineindex="${task.taskLineIndex}"
                  tabindex="-1">+ Step</button>
                <button class="goto-btn" title="Open file at task"
                  data-action="openFile"
                  data-filepath="${attr(topic.absolutePath)}"
                  data-lineindex="${task.taskLineIndex}"
                  tabindex="-1">↗</button>
                <button class="icon-btn edit-btn" title="Rename task"
                  data-action="editTask"
                  data-filepath="${attr(topic.absolutePath)}"
                  data-tasklineindex="${task.taskLineIndex}"
                  data-currentname="${attr(task.name)}"
                  tabindex="-1">✎</button>
                <button class="icon-btn del-btn" title="Delete task"
                  data-action="deleteTask"
                  data-filepath="${attr(topic.absolutePath)}"
                  data-tasklineindex="${task.taskLineIndex}"
                  data-steplineindices="${attr(JSON.stringify(stepIndices))}"
                  tabindex="-1">✕</button>
              </div>
            </div>
            <div class="steps-body${isOpen(`tkb-${ci}-${ti}-${tki}`) ? '' : ' closed'}" id="tkb-${ci}-${ti}-${tki}">
              ${stepsHtml || '<div class="no-items">No steps yet — click + Step to add one</div>'}
            </div>
          </div>`;
        }

        topicsHtml += `
        <div class="topic-block">
          <div class="topic-header" data-toggle="tpb-${ci}-${ti}"
               tabindex="0" data-nav="topic" data-bodyid="tpb-${ci}-${ti}">
            <span class="topic-chevron${isOpen(`tpb-${ci}-${ti}`) ? ' open' : ''}" data-chevron="tpb-${ci}-${ti}">▶</span>
            ${topicHasAsap ? '<span class="bubble-dot" title="Has ASAP steps"></span>' : ''}
            <span class="topic-name">${esc(topic.name)}</span>
            <span class="topic-badge">${topicDone}/${topicSteps}</span>
            <div class="row-actions topic-actions">
              <button class="add-btn"
                data-action="addTask"
                data-filepath="${attr(topic.absolutePath)}"
                tabindex="-1">+ Task</button>
              <button class="goto-btn" title="Open file"
                data-action="openFile"
                data-filepath="${attr(topic.absolutePath)}"
                data-lineindex="0"
                tabindex="-1">↗</button>
              <button class="icon-btn edit-btn" title="Rename topic"
                data-action="editTopic"
                data-filepath="${attr(topic.absolutePath)}"
                data-currentname="${attr(topic.name)}"
                tabindex="-1">✎</button>
              <button class="icon-btn del-btn" title="Delete topic"
                data-action="deleteTopic"
                data-filepath="${attr(topic.absolutePath)}"
                data-name="${attr(topic.name)}"
                tabindex="-1">✕</button>
            </div>
          </div>
          <div class="topic-body${isOpen(`tpb-${ci}-${ti}`) ? '' : ' closed'}" id="tpb-${ci}-${ti}">
            ${tasksHtml || '<div class="no-items" style="padding-left:32px">No tasks yet — click + Task to add one</div>'}
          </div>
        </div>`;
      }

      catsHtml += `
      <div class="cat-section">
        <div class="cat-header" data-toggle="cb-${ci}"
             tabindex="0" data-nav="cat" data-bodyid="cb-${ci}">
          <span class="cat-chevron${isOpen(`cb-${ci}`) ? ' open' : ''}" data-chevron="cb-${ci}">▶</span>
          ${catHasAsap ? '<span class="bubble-dot" title="Has ASAP steps"></span>' : ''}
          <span class="cat-name">${esc(cat.name)}</span>
          <div class="mini-bar" title="${catDone}/${catSteps}">
            <div class="mini-fill" style="width:${catPct}%"></div>
          </div>
          <span class="cat-badge">${catDone}/${catSteps}</span>
          <div class="row-actions cat-actions">
            <button class="add-btn"
              data-action="addTopic"
              data-categoryfolder="${attr(cat.folderPath)}"
              tabindex="-1">+ Topic</button>
            <button class="icon-btn edit-btn" title="Rename category"
              data-action="editCategory"
              data-folderpath="${attr(cat.folderPath)}"
              data-currentname="${attr(cat.name)}"
              tabindex="-1">✎</button>
            <button class="icon-btn del-btn" title="Delete category"
              data-action="deleteCategory"
              data-folderpath="${attr(cat.folderPath)}"
              data-name="${attr(cat.name)}"
              tabindex="-1">✕</button>
          </div>
        </div>
        <div class="cat-body${isOpen(`cb-${ci}`) ? '' : ' closed'}" id="cb-${ci}">
          ${topicsHtml || '<div class="no-items" style="padding-left:28px">No topics yet — click + Topic to add one</div>'}
        </div>
      </div>`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MyPlans</title>
<style>
:root {
  --bg:      #272822;
  --bg2:     #1e1f1a;
  --bg3:     #2d2e27;
  --bg4:     #3a3b32;
  --surface: #32332c;
  --border:  #464741;
  --text:    #f8f8f2;
  --muted:   #75715e;
  --yellow:  #e6db74;
  --green:   #a6e22e;
  --orange:  #fd971f;
  --red:     #f92672;
  --blue:    #66d9ef;
  --mono:    'Cascadia Code','Fira Code','JetBrains Mono',Consolas,monospace;
  --ui:      'Segoe UI',system-ui,sans-serif;
  --r:       4px;
  --ease:    0.14s ease;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: var(--bg); color: var(--text);
  font-family: var(--ui); font-size: 12px; line-height: 1.5;
  overflow-x: hidden;
}
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: var(--bg2); }
::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }

/* ── focus ring for keyboard nav ── */
[tabindex="0"]:focus { outline: 1px solid var(--blue); outline-offset: -1px; }
[tabindex="0"]:focus:not(:focus-visible) { outline: none; }
[tabindex="0"]:focus-visible { outline: 1px solid var(--blue); outline-offset: -1px; }

/* ── header ── */
.header {
  background: var(--bg2); border-bottom: 1px solid var(--border);
  padding: 9px 10px 7px; position: sticky; top: 0; z-index: 100;
}
.header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
.logo { display: flex; align-items: center; gap: 5px; font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--green); letter-spacing: .04em; }
.header-right { display: flex; gap: 4px; align-items: center; }
.top-btn {
  background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r);
  color: var(--text); cursor: pointer; font-family: var(--mono); font-size: 10px;
  padding: 3px 8px; transition: all var(--ease); white-space: nowrap;
}
.top-btn:hover { background: var(--bg4); border-color: var(--muted); }
.top-btn.cat { color: var(--orange); border-color: var(--orange); }
.top-btn.cat:hover { background: rgba(253,151,31,.15); }
.top-btn.refresh { color: var(--muted); font-size: 13px; padding: 2px 7px; }
.top-btn.refresh:hover { color: var(--text); }

/* ── progress ── */
.prog-row { display: flex; align-items: center; gap: 7px; }
.prog-counts { font-family: var(--mono); font-size: 10px; color: var(--muted); min-width: 44px; }
.prog-bg { flex: 1; height: 4px; background: var(--bg4); border-radius: 9px; overflow: hidden; }
.prog-fill { height: 100%; background: linear-gradient(90deg, var(--green), var(--blue)); border-radius: 9px; transition: width .4s ease; }
.prog-pct { font-family: var(--mono); font-size: 10px; color: var(--green); min-width: 30px; text-align: right; }

/* ── metrics ── */
.metrics {
  padding: 6px 10px; display: flex; gap: 5px; flex-wrap: wrap;
  border-bottom: 1px solid var(--border); background: var(--bg2);
}
.chip { background: var(--bg3); border: 1px solid var(--border); border-radius: 3px; padding: 2px 7px; display: flex; align-items: center; gap: 4px; font-size: 10px; font-family: var(--mono); }
.chip .cl { color: var(--muted); }
.chip .cv { color: var(--yellow); font-weight: 700; }
.chip.g .cv { color: var(--green); }
.chip.b .cv { color: var(--blue); }

/* ── content ── */
.content { padding-bottom: 72px; }

/* ── row-actions group (edit + delete + goto) ── */
.row-actions {
  display: flex; align-items: center; gap: 2px;
  opacity: 0; transition: opacity var(--ease); flex-shrink: 0; margin-left: auto;
}
.cat-header:hover .cat-actions,
.topic-header:hover .topic-actions,
.task-header:hover .task-actions,
.step-row:hover .row-actions { opacity: 1; }
.step-row .row-actions { opacity: 0; }
.step-row:hover .row-actions { opacity: 1; }

/* ── icon buttons (edit / delete) ── */
.icon-btn {
  background: transparent; border: none; cursor: pointer;
  font-size: 11px; padding: 1px 4px; border-radius: 2px;
  transition: all var(--ease); flex-shrink: 0; line-height: 1;
}
.edit-btn { color: var(--muted); }
.edit-btn:hover { color: var(--blue); background: rgba(102,217,239,.12); }
.del-btn { color: var(--muted); }
.del-btn:hover { color: var(--red); background: rgba(249,38,114,.12); }

/* ── ASAP dot on step ── */
.asap-dot {
  width: 9px; height: 9px; border-radius: 50%;
  flex-shrink: 0; cursor: pointer;
  border: 1.5px solid var(--border);
  background: transparent;
  transition: all var(--ease);
  margin-right: 5px;
}
.asap-dot:hover { border-color: var(--red); background: rgba(249,38,114,.2); }
.asap-dot.active {
  background: var(--red);
  border-color: var(--red);
  box-shadow: 0 0 5px rgba(249,38,114,.6);
  animation: pulse-asap 2s ease-in-out infinite;
}
@keyframes pulse-asap {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.82); }
}

/* ── bubble dot for task/topic/category ── */
.bubble-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--red);
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(249,38,114,.5);
}

/* ── step row ASAP highlight ── */
.step-row.asap { background: rgba(249,38,114,.06); }
.step-row.asap .step-text { color: #ffb3c6; }

/* ── category ── */
.cat-section { border-bottom: 1px solid var(--border); }
.cat-header {
  display: flex; align-items: center; gap: 5px; padding: 7px 10px;
  background: var(--bg3); cursor: pointer; user-select: none;
  border-bottom: 1px solid var(--border);
  position: sticky; top: 72px; z-index: 50;
}
.cat-header:hover { background: var(--bg4); }
.cat-chevron, .topic-chevron, .task-chevron {
  font-size: 7px; color: var(--muted); transition: transform var(--ease);
  flex-shrink: 0; width: 9px; display: inline-block;
}
.cat-chevron.open, .topic-chevron.open, .task-chevron.open { transform: rotate(90deg); }
.folder-icon { color: var(--orange); font-size: 11px; }
.cat-name { font-family: var(--mono); font-size: 11px; color: var(--orange); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.cat-badge { font-family: var(--mono); font-size: 9px; color: var(--muted); background: var(--bg4); border: 1px solid var(--border); border-radius: 2px; padding: 1px 5px; }
.mini-bar { width: 36px; height: 3px; background: var(--bg4); border-radius: 9px; overflow: hidden; flex-shrink: 0; }
.mini-fill { height: 100%; background: var(--green); border-radius: 9px; }
.cat-body.closed { display: none; }

/* ── topic ── */
.topic-block { border-bottom: 1px solid var(--bg3); }
.topic-header {
  display: flex; align-items: center; gap: 5px; padding: 5px 10px 5px 20px;
  background: var(--bg2); cursor: pointer; user-select: none;
}
.topic-header:hover { background: var(--surface); }
.file-icon { color: var(--blue); font-size: 11px; flex-shrink: 0; }
.topic-name { font-family: var(--mono); font-size: 11px; color: var(--blue); }
.topic-badge { font-family: var(--mono); font-size: 9px; color: var(--muted); }
.topic-body.closed { display: none; }

/* ── task ── */
.task-block { }
.task-header {
  display: flex; align-items: center; gap: 5px; padding: 4px 10px 4px 32px;
  background: var(--bg3); cursor: pointer; border-top: 1px solid var(--bg4); user-select: none;
}
.task-name { font-family: var(--mono); font-size: 10px; color: var(--yellow); font-weight: 600; }
.task-badge { font-family: var(--mono); font-size: 9px; color: var(--muted); }
.steps-body { display: block; }
.steps-body.closed { display: none; }

/* ── step ── */
.step-row {
  display: flex; align-items: center;
  padding: 3px 8px 3px 40px;
  transition: background var(--ease);
}
.step-row:hover { background: var(--surface); }
.step-row.done .step-text {
  color: var(--muted);
  text-decoration: line-through;
  text-decoration-color: var(--border);
}

/* checkbox */
.check-wrap {
  display: flex; align-items: center; flex-shrink: 0;
  padding-right: 6px; cursor: pointer;
}
.step-cb {
  appearance: none; -webkit-appearance: none;
  width: 13px; height: 13px;
  border: 1.5px solid var(--border); border-radius: 2px;
  background: var(--bg3); cursor: pointer;
  position: relative; flex-shrink: 0;
  transition: border-color var(--ease), background var(--ease);
}
.step-cb:hover { border-color: var(--green); }
.step-cb:checked { background: var(--green); border-color: var(--green); }
.step-cb:checked::after {
  content: '';
  position: absolute; left: 2px; top: 0px;
  width: 5px; height: 8px;
  border: 2px solid var(--bg2);
  border-top: none; border-left: none;
  transform: rotate(40deg);
}

.step-text { font-family: var(--mono); font-size: 11px; color: var(--text); flex: 1; word-break: break-word; }

/* ── shared buttons ── */
.add-btn {
  background: transparent; border: 1px solid var(--border); border-radius: 2px;
  color: var(--muted); cursor: pointer; font-family: var(--mono); font-size: 9px;
  padding: 1px 5px; transition: all var(--ease); flex-shrink: 0; white-space: nowrap;
}
.add-btn:hover { border-color: var(--green); color: var(--green); background: rgba(166,226,46,.08); }

.goto-btn {
  background: transparent; border: none; color: var(--muted); cursor: pointer;
  font-size: 12px; padding: 1px 4px; border-radius: 2px;
  transition: all var(--ease); flex-shrink: 0;
}
.goto-btn.always-visible { opacity: 0.35; }
.goto-btn:hover { color: var(--blue); }

/* ── no items ── */
.no-items { padding: 5px 10px; font-size: 10px; color: var(--muted); font-family: var(--mono); }

/* ── deploy bar ── */
.change-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--orange); flex-shrink: 0;
  box-shadow: 0 0 5px rgba(253,151,31,.6);
  animation: pulse-dot 2s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.85); }
}
.no-git-badge {
  font-family: var(--mono); font-size: 9px; color: var(--muted);
  background: var(--bg4); border: 1px solid var(--border);
  border-radius: 3px; padding: 1px 5px; flex-shrink: 0;
}
.deploy-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  padding: 7px 10px; background: var(--bg2); border-top: 1px solid var(--border); z-index: 200;
}
.btn-deploy {
  width: 100%; padding: 6px 12px;
  background: linear-gradient(135deg, var(--green), #7ec524);
  border: none; border-radius: var(--r); color: var(--bg2);
  font-family: var(--mono); font-size: 11px; font-weight: 700; letter-spacing: .07em;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;
  transition: all var(--ease); text-transform: uppercase;
}
.btn-deploy:hover { background: linear-gradient(135deg,#c0e86b,var(--green)); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(166,226,46,.22); }
.btn-deploy:active { transform: translateY(0); }
.btn-deploy.deploying { background: var(--bg4); color: var(--muted); cursor: not-allowed; transform: none; box-shadow: none; }
.btn-deploy:disabled { background: var(--bg4); color: var(--muted); cursor: not-allowed; transform: none; box-shadow: none; opacity: 0.55; }
.btn-deploy:disabled:hover { background: var(--bg4); transform: none; box-shadow: none; }
.deploy-status { margin-top: 4px; font-family: var(--mono); font-size: 10px; color: var(--muted); text-align: center; min-height: 13px; }
.deploy-status.ok { color: var(--green); }
.deploy-status.err { color: var(--red); }

/* ── empty ── */
.empty { padding: 40px 20px; text-align: center; color: var(--muted); font-family: var(--mono); font-size: 11px; }
.empty-icon { font-size: 28px; margin-bottom: 8px; opacity: .5; }
.empty-title { color: var(--text); margin-bottom: 5px; font-size: 12px; }
</style>
</head>
<body>

<div class="header">
  <div class="header-top">
    <div class="logo">☑ MyPlans${hasChanges ? '<span class=\"change-dot\" title=\"Uncommitted changes\"></span>' : ''}${!isGit ? '<span class=\"no-git-badge\" title=\"Git not initialized\">no git</span>' : ''}</div>
    <div class="header-right">
      <button class="top-btn cat" data-action="addCategory">+ Category</button>
      <button class="top-btn refresh" data-action="refresh" title="Refresh">⟳</button>
    </div>
  </div>
  <div class="prog-row">
    <span class="prog-counts">${doneSteps}/${totalSteps}</span>
    <div class="prog-bg"><div class="prog-fill" style="width:${pct}%"></div></div>
    <span class="prog-pct">${pct}%</span>
  </div>
</div>

<div class="metrics">
  <div class="chip"><span class="cl">cats</span><span class="cv" style="color:var(--orange);">${categories.length}</span></div>
  <div class="chip b"><span class="cl">topics</span><span class="cv">${totalTopics}</span></div>
  <div class="chip"><span class="cl">tasks</span><span class="cv">${totalTasks}</span></div>
  <div class="chip g"><span class="cl">done</span><span class="cv" style="color:var(--green);">${doneSteps}</span></div>
  <div class="chip"><span class="cl">left</span><span class="cv" style="color:var(--text);">${totalSteps - doneSteps}</span></div>
</div>

<div class="content">
${catsHtml}
</div>

<div class="deploy-bar">
  <button class="btn-deploy" id="deployBtn" data-action="deploy"${deployDisabled ? ' disabled title="' + (!isGit ? 'Git not initialized' : 'No uncommitted changes') + '"' : ''}>
    <span id="deployIcon">↑</span>
    <span id="deployLabel">Deploy</span>
  </button>
  <div class="deploy-status" id="deployStatus"></div>
</div>

<script>
(function() {
  const vscode = acquireVsCodeApi();

  /* ─── Boot: restore focus after keyboard-triggered toggle ── */
  const _bootFocusLineIndex = ${focusLineIndex !== null && focusLineIndex !== undefined ? focusLineIndex : 'null'};
  if (_bootFocusLineIndex !== null) {
    requestAnimationFrame(function() {
      const target = document.querySelector('.step-row[data-lineindex="' + _bootFocusLineIndex + '"]');
      if (target) target.focus();
    });
  }

  /* ─── Click handler ─────────────────────────────────────── */
  document.addEventListener('click', function(e) {
    const toggleTarget = e.target.closest('[data-toggle]');
    const actionTarget = e.target.closest('[data-action]');

    if (actionTarget) {
      e.stopPropagation();
      handleAction(actionTarget);
      return;
    }
    if (toggleTarget) {
      toggleSection(toggleTarget.dataset.toggle);
    }
  });

  document.addEventListener('change', function(e) {
    if (e.target.matches('.step-cb')) {
      const el = e.target;
      vscode.postMessage({
        command: 'toggleStep',
        filePath:  el.dataset.filepath,
        lineIndex: Number(el.dataset.lineindex)
      });
    }
  });

  /* ─── Keyboard navigation ───────────────────────────────── */
  // Build flat list of all focusable nav items in DOM order
  function getNavItems() {
    return Array.from(document.querySelectorAll('[data-nav]')).filter(el => {
      // Skip items inside closed containers
      let parent = el.parentElement;
      while (parent) {
        if (parent.classList.contains('closed')) return false;
        parent = parent.parentElement;
      }
      return true;
    });
  }

  document.addEventListener('keydown', function(e) {
    const focused = document.activeElement;
    if (!focused || !focused.dataset.nav) return;

    const nav = focused.dataset.nav; // cat | topic | task | step
    const bodyId = focused.dataset.bodyid;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const items = getNavItems();
        const idx = items.indexOf(focused);
        if (idx < items.length - 1) items[idx + 1].focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const items = getNavItems();
        const idx = items.indexOf(focused);
        if (idx > 0) items[idx - 1].focus();
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (nav === 'step') break; // steps have no children
        if (bodyId) {
          const body = document.getElementById(bodyId);
          if (body && body.classList.contains('closed')) {
            // Open it
            openSection(bodyId);
          } else {
            // Already open — move focus to first child
            const items = getNavItems();
            const idx = items.indexOf(focused);
            if (idx < items.length - 1) items[idx + 1].focus();
          }
        }
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (nav === 'step') {
          // Move focus to parent task header
          const taskHeader = focused.closest('.steps-body')
            && focused.closest('.steps-body').previousElementSibling;
          if (taskHeader && taskHeader.dataset.nav) taskHeader.focus();
          break;
        }
        if (bodyId) {
          const body = document.getElementById(bodyId);
          if (body && !body.classList.contains('closed')) {
            // Collapse it
            closeSection(bodyId);
          } else {
            // Already closed — move to parent
            moveToParent(focused);
          }
        }
        break;
      }
      case 'Enter': {
        if (nav === 'step') {
          e.preventDefault();
          // Toggle checkbox; focus is restored via _bootFocusLineIndex baked into next render
          const cb = focused.querySelector('.step-cb');
          if (cb) {
            vscode.postMessage({
              command: 'toggleStep',
              filePath: cb.dataset.filepath,
              lineIndex: Number(cb.dataset.lineindex)
            });
          }
        } else if (bodyId) {
          e.preventDefault();
          toggleSection(bodyId);
        }
        break;
      }
    }
  });

  function moveToParent(el) {
    const nav = el.dataset.nav;
    let parentHeader = null;
    if (nav === 'task') {
      // Find parent topic-header
      const topicBody = el.closest('.topic-body');
      if (topicBody) parentHeader = topicBody.previousElementSibling;
    } else if (nav === 'topic') {
      // Find parent cat-header
      const catBody = el.closest('.cat-body');
      if (catBody) parentHeader = catBody.previousElementSibling;
    }
    if (parentHeader && parentHeader.dataset.nav) parentHeader.focus();
  }

  function openSection(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    body.classList.remove('closed');
    const chev = document.querySelector('[data-chevron="' + bodyId + '"]');
    if (chev) chev.classList.add('open');
    _openSet.add(bodyId);
    _saveState();
  }

  function closeSection(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    body.classList.add('closed');
    const chev = document.querySelector('[data-chevron="' + bodyId + '"]');
    if (chev) chev.classList.remove('open');
    _openSet.delete(bodyId);
    _saveState();
  }

  /* ─── Action dispatcher ────────────────────────────────── */
  function handleAction(el) {
    const action = el.dataset.action;
    const d = el.dataset;

    switch (action) {
      case 'addCategory':
        vscode.postMessage({ command: 'addCategory' }); break;
      case 'addTopic':
        vscode.postMessage({ command: 'addTopic', categoryFolder: d.categoryfolder }); break;
      case 'addTask':
        vscode.postMessage({ command: 'addTask', filePath: d.filepath }); break;
      case 'addStep':
        vscode.postMessage({ command: 'addStep', filePath: d.filepath, taskLineIndex: Number(d.tasklineindex) }); break;
      case 'openFile':
        vscode.postMessage({ command: 'openFile', filePath: d.filepath, lineIndex: Number(d.lineindex) }); break;
      case 'refresh':
        vscode.postMessage({ command: 'refresh' }); break;
      case 'deploy':
        doDeploy(); break;
      case 'toggleAsap':
        vscode.postMessage({ command: 'toggleAsap', filePath: d.filepath, lineIndex: Number(d.lineindex) }); break;
      // edit
      case 'editCategory':
        vscode.postMessage({ command: 'editCategory', folderPath: d.folderpath, currentName: d.currentname }); break;
      case 'editTopic':
        vscode.postMessage({ command: 'editTopic', filePath: d.filepath, currentName: d.currentname }); break;
      case 'editTask':
        vscode.postMessage({ command: 'editTask', filePath: d.filepath, taskLineIndex: Number(d.tasklineindex), currentName: d.currentname }); break;
      case 'editStep':
        vscode.postMessage({ command: 'editStep', filePath: d.filepath, lineIndex: Number(d.lineindex), currentText: d.currenttext }); break;
      // delete
      case 'deleteCategory':
        vscode.postMessage({ command: 'deleteCategory', folderPath: d.folderpath, name: d.name }); break;
      case 'deleteTopic':
        vscode.postMessage({ command: 'deleteTopic', filePath: d.filepath, name: d.name }); break;
      case 'deleteTask':
        vscode.postMessage({ command: 'deleteTask', filePath: d.filepath, taskLineIndex: Number(d.tasklineindex), stepLineIndices: JSON.parse(d.steplineindices || '[]') }); break;
      case 'deleteStep':
        vscode.postMessage({ command: 'deleteStep', filePath: d.filepath, lineIndex: Number(d.lineindex) }); break;
    }
  }

  /* ─── Section state ────────────────────────────────────── */
  const _openSet = new Set(
    Array.from(document.querySelectorAll('[id]')).filter(el =>
      (el.classList.contains('cat-body') ||
       el.classList.contains('topic-body') ||
       el.classList.contains('steps-body')) &&
      !el.classList.contains('closed')
    ).map(el => el.id)
  );

  function _saveState() {
    vscode.postMessage({ command: 'saveState', openSections: Array.from(_openSet) });
  }

  function toggleSection(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const isClosed = body.classList.toggle('closed');
    const chev = document.querySelector('[data-chevron="' + bodyId + '"]');
    if (chev) chev.classList.toggle('open', !isClosed);
    if (isClosed) { _openSet.delete(bodyId); } else { _openSet.add(bodyId); }
    _saveState();
  }

  /* ─── Deploy ───────────────────────────────────────────── */
  function doDeploy() {
    const btn   = document.getElementById('deployBtn');
    if (btn.disabled) return;
    const label = document.getElementById('deployLabel');
    const icon  = document.getElementById('deployIcon');
    btn.classList.add('deploying');
    btn.disabled = true;
    label.textContent = 'Deploying\u2026';
    icon.textContent  = '\u27F3';
    setStatus('', '');
    vscode.postMessage({ command: 'deploy' });
  }

  function setStatus(msg, type) {
    const el = document.getElementById('deployStatus');
    el.textContent = msg;
    el.className = 'deploy-status' + (type ? ' ' + type : '');
  }

  /* ─── Messages from extension ──────────────────────────── */
  window.addEventListener('message', function(e) {
    const msg = e.data;
    if (msg.command === 'deployDone') {
      const btn   = document.getElementById('deployBtn');
      const label = document.getElementById('deployLabel');
      const icon  = document.getElementById('deployIcon');
      btn.classList.remove('deploying');
      btn.disabled = false;
      label.textContent = 'Deploy';
      icon.textContent  = '\u2191';
      setStatus(msg.message, msg.success ? 'ok' : 'err');
      if (msg.success) setTimeout(function() { setStatus('', ''); }, 5000);
    }
    if (msg.command === 'focusFirst') {
      // Focus first navigable item
      const first = document.querySelector('[data-nav]');
      if (first) first.focus();
    }
  });
})();
</script>
</body>
</html>`;
}

module.exports = { MyPlansWebviewProvider };
