'use strict';

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { parseTasks } = require('./yamlParser');

/**
 * Scan workspace for .yml/.yaml files AND bare category folders.
 * Structure: /Category Name/Topic Name.yaml
 */
async function scanWorkspace() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return [];

  const root = folders[0].uri.fsPath;

  // ── collect categories from the filesystem directly ──────────────────────
  // This catches empty category folders that have no YAML files yet.
  const categoryMap = new Map();

  let rootEntries = [];
  try { rootEntries = fs.readdirSync(root, { withFileTypes: true }); } catch { return []; }

  for (const entry of rootEntries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const folderPath = path.join(root, entry.name);
    categoryMap.set(entry.name, { name: entry.name, folderPath, topics: [] });
  }

  // ── find all YAML files and attach to categories ──────────────────────────
  const uris = await vscode.workspace.findFiles('**/*.{yml,yaml}', '**/node_modules/**');

  for (const uri of uris) {
    const abs = uri.fsPath;
    const rel = path.relative(root, abs);
    const parts = rel.split(path.sep);
    if (parts.length < 2) continue; // skip root-level files

    const categoryName = parts[0];
    if (!categoryMap.has(categoryName)) continue; // not a direct child folder

    const topicName = path.basename(abs, path.extname(abs));

    let content = '';
    try { content = fs.readFileSync(abs, 'utf8'); } catch { continue; }

    const tasks = parseTasks(content);

    categoryMap.get(categoryName).topics.push({
      name: topicName,
      relativePath: rel,
      absolutePath: abs,
      tasks
    });
  }

  const categories = Array.from(categoryMap.values())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const cat of categories) {
    cat.topics.sort((a, b) => a.name.localeCompare(b.name));
  }

  return categories;
}

module.exports = { scanWorkspace };
