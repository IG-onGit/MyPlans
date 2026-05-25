'use strict';

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { appendTask, appendStep, deleteLine, renameTask, editStep, deleteTask } = require('./yamlParser');

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

/** Rename a category folder */
function renameCategory(oldFolderPath, newName) {
  const parent = path.dirname(oldFolderPath);
  const newPath = path.join(parent, newName);
  fs.renameSync(oldFolderPath, newPath);
}

/** Delete a category folder and all contents */
function deleteCategory(folderPath) {
  fs.rmSync(folderPath, { recursive: true, force: true });
}

/** Rename a topic file */
function renameTopic(filePath, newName) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const newPath = path.join(dir, newName + ext);
  fs.renameSync(filePath, newPath);
}

/** Delete a topic file */
function deleteTopic(filePath) {
  fs.unlinkSync(filePath);
}

/** Edit a task name in a topic file */
function editTask(filePath, taskLineIndex, newName) {
  const content = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, renameTask(content, taskLineIndex, newName), 'utf8');
}

/** Delete a task (header + all its steps) from a topic file */
function removeTask(filePath, taskLineIndex, stepLineIndices) {
  const content = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, deleteTask(content, taskLineIndex, stepLineIndices), 'utf8');
}

/** Edit a step text in a topic file */
function editStepText(filePath, lineIndex, newText) {
  const content = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, editStep(content, lineIndex, newText), 'utf8');
}

/** Delete a step line from a topic file */
function deleteStep(filePath, lineIndex) {
  const content = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, deleteLine(content, lineIndex), 'utf8');
}

module.exports = {
  createCategory, createTopic, addTask, addStep,
  renameCategory, deleteCategory,
  renameTopic, deleteTopic,
  editTask, removeTask,
  editStepText, deleteStep
};
