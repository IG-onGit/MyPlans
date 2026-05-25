'use strict';

/**
 * Parse YAML files with the structure:
 *
 *   Task Name:
 *     - step one
 *     - step two
 *
 * Handles: LF / CRLF / CR line endings, spaces or tabs for indent,
 * 2-space or 4-space or tab indent, commented steps (# - text),
 * task names containing colons, blank lines between tasks.
 *
 * Returns Task[]:
 *   { name: string, taskLineIndex: number, steps: Step[] }
 * Step:
 *   { text: string, lineIndex: number, commented: boolean, asap: boolean }
 */

const ASAP_TAG = '[ASAP]';

function normalize(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseTasks(content) {
  const lines = normalize(content).split('\n');
  const tasks = [];
  let currentTask = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trimStart();
    if (!trimmed) continue;

    const isCommented = trimmed.startsWith('#');
    const effective = isCommented ? trimmed.replace(/^#+\s*/, '') : trimmed;
    const indent = raw.length - trimmed.length;

    if (!isCommented && indent === 0 && /^[^\-\s#].*:\s*$/.test(effective)) {
      const name = effective.replace(/:\s*$/, '').trim();
      currentTask = { name, taskLineIndex: i, steps: [] };
      tasks.push(currentTask);
      continue;
    }

    const stepMatch = effective.match(/^-\s+(.+)$/);
    if (stepMatch && currentTask) {
      const rawText = stepMatch[1].trim();
      const asap = rawText.startsWith(ASAP_TAG);
      const text = asap ? rawText.slice(ASAP_TAG.length).trim() : rawText;
      currentTask.steps.push({
        text,
        lineIndex: i,
        commented: isCommented,
        asap
      });
    }
  }

  return tasks;
}

function toggleLineComment(content, lineIndex) {
  const lines = normalize(content).split('\n');
  const idx = Number(lineIndex);
  if (idx < 0 || idx >= lines.length) return content;

  const raw = lines[idx];
  const trimmed = raw.trimStart();
  const indentStr = raw.slice(0, raw.length - trimmed.length);

  if (trimmed.startsWith('#')) {
    lines[idx] = indentStr + trimmed.replace(/^#+\s*/, '');
  } else {
    lines[idx] = indentStr + '# ' + trimmed;
  }

  return lines.join('\n');
}

/**
 * Toggle [ASAP] prefix on a step line.
 * Works whether the step is commented or not.
 */
function toggleAsap(content, lineIndex) {
  const lines = normalize(content).split('\n');
  const idx = Number(lineIndex);
  if (idx < 0 || idx >= lines.length) return content;

  const raw = lines[idx];
  const trimmed = raw.trimStart();
  const indentStr = raw.slice(0, raw.length - trimmed.length);

  // Strip leading comment markers to work on the effective content
  const isCommented = trimmed.startsWith('#');
  const effective = isCommented ? trimmed.replace(/^#+\s*/, '') : trimmed;

  // Match step prefix: "- " or "- [ASAP] "
  const stepMatch = effective.match(/^(-\s+)(.+)$/);
  if (!stepMatch) return content;

  const prefix = stepMatch[1];   // e.g. "- "
  const rest   = stepMatch[2];   // e.g. "[ASAP] do thing" or "do thing"

  let newRest;
  if (rest.startsWith(ASAP_TAG)) {
    // Remove ASAP
    newRest = rest.slice(ASAP_TAG.length).trim();
  } else {
    // Add ASAP
    newRest = ASAP_TAG + ' ' + rest;
  }

  const newEffective = prefix + newRest;
  lines[idx] = indentStr + (isCommented ? '# ' + newEffective : newEffective);
  return lines.join('\n');
}

function appendTask(content, taskName) {
  const body = normalize(content).trimEnd();
  const sep = body.length > 0 ? '\n\n' : '';
  return body + sep + taskName + ':\n';
}

function appendStep(content, taskLineIndex, stepText) {
  const lines = normalize(content).split('\n');
  const start = Number(taskLineIndex);

  let lastStepLine = start;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trimStart();
    if (t && l[0] !== ' ' && l[0] !== '\t' && !t.startsWith('-') && !t.startsWith('#')) {
      break;
    }
    if (t.startsWith('-') || (t.startsWith('#') && t.replace(/^#+\s*/, '').startsWith('-'))) {
      lastStepLine = i;
    }
  }

  lines.splice(lastStepLine + 1, 0, '  - ' + stepText);
  return lines.join('\n');
}

/** Delete a single line by index */
function deleteLine(content, lineIndex) {
  const lines = normalize(content).split('\n');
  const idx = Number(lineIndex);
  if (idx < 0 || idx >= lines.length) return content;
  lines.splice(idx, 1);
  return lines.join('\n');
}

/** Rename a task header at taskLineIndex */
function renameTask(content, taskLineIndex, newName) {
  const lines = normalize(content).split('\n');
  const idx = Number(taskLineIndex);
  if (idx < 0 || idx >= lines.length) return content;
  lines[idx] = newName + ':';
  return lines.join('\n');
}

/** Edit a step text at lineIndex */
function editStep(content, lineIndex, newText) {
  const lines = normalize(content).split('\n');
  const idx = Number(lineIndex);
  if (idx < 0 || idx >= lines.length) return content;
  const raw = lines[idx];
  const trimmed = raw.trimStart();
  const indentStr = raw.slice(0, raw.length - trimmed.length);
  const isCommented = trimmed.startsWith('#');
  // Preserve ASAP tag if present
  const effective = isCommented ? trimmed.replace(/^#+\s*/, '') : trimmed;
  const stepMatch = effective.match(/^-\s+(.+)$/);
  const hasAsap = stepMatch && stepMatch[1].trim().startsWith(ASAP_TAG);
  const newFull = hasAsap ? ASAP_TAG + ' ' + newText : newText;
  if (isCommented) {
    lines[idx] = indentStr + '# - ' + newFull;
  } else {
    lines[idx] = indentStr + '- ' + newFull;
  }
  return lines.join('\n');
}

/** Delete a task header + all its step lines */
function deleteTask(content, taskLineIndex, stepLineIndices) {
  const lines = normalize(content).split('\n');
  const toRemove = new Set([Number(taskLineIndex), ...stepLineIndices.map(Number)]);
  const maxIdx = Math.max(...toRemove);
  if (maxIdx + 1 < lines.length && lines[maxIdx + 1].trim() === '') {
    toRemove.add(maxIdx + 1);
  }
  const result = lines.filter((_, i) => !toRemove.has(i));
  return result.join('\n');
}

module.exports = { parseTasks, toggleLineComment, toggleAsap, appendTask, appendStep, deleteLine, renameTask, editStep, deleteTask };
