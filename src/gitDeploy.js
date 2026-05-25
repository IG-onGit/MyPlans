'use strict';

const { execSync } = require('child_process');
const vscode = require('vscode');

/**
 * Stage all changes, commit with a timestamped message, and push to origin.
 * Runs in the workspace root directory.
 */
async function gitDeploy() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    throw new Error('No workspace folder open.');
  }

  const cwd = workspaceFolders[0].uri.fsPath;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const message = `MyPlans: update tasks [${timestamp}]`;

  const run = (cmd) => execSync(cmd, { cwd, stdio: 'pipe' }).toString().trim();

  // Check if git repo
  try {
    run('git rev-parse --git-dir');
  } catch {
    throw new Error('This workspace is not a Git repository.');
  }

  // Stage all changes
  run('git add -A');

  // Check if there is anything staged to commit
  let staged = '';
  try {
    staged = run('git diff --cached --name-only');
  } catch {
    staged = '';
  }

  if (!staged) {
    return { committed: false, message: 'Nothing to commit — all tasks are up to date.' };
  }

  // Commit
  run(`git commit -m "${message}"`);

  // Push
  try {
    run('git push');
  } catch (e) {
    throw new Error(`Commit succeeded but push failed: ${e.message}`);
  }

  return { committed: true, message: `Deployed: "${message}"` };
}

module.exports = { gitDeploy };
