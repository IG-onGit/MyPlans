'use strict';

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { appendTask, appendStep } = require('./yamlParser');

function getRoot() {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || !folders.length) throw new Error('No workspace open.');
  return folders[0].uri.fsPath;
}

/** Create a new category folder */
function createCategory(name) {
  const dir = path.join(getRoot(), name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Create a new topic YAML file inside a category folder */
function createTopic(categoryFolderPath, topicName) {
  const filePath = path.join(categoryFolderPath, `${topicName}.yaml`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }
  return filePath;
}

/** Add a new task block to a topic file */
function addTask(filePath, taskName) {
  const content = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, appendTask(content, taskName), 'utf8');
}

/** Add a step to an existing task in a topic file */
function addStep(filePath, taskLineIndex, stepText) {
  const content = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, appendStep(content, taskLineIndex, stepText), 'utf8');
}

module.exports = { createCategory, createTopic, addTask, addStep };
