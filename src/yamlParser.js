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
 *   { text: string, lineIndex: number, commented: boolean }
 *
 * NOTE: lineIndex values refer to lines in the NORMALIZED (LF-only) content.
 * All functions in this module normalize before processing, so they are
 * consistent with each other. When writing back to disk the normalized form
 * is used (CRLF → LF conversion is intentional and safe for YAML).
 */

/** Normalize any line-ending style to LF. */
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
    // Strip leading # characters and optional space to get the "effective" content
    const effective = isCommented ? trimmed.replace(/^#+\s*/, '') : trimmed;
    const indent = raw.length - trimmed.length;

    // ── Task header: zero indent, not a list item, ends with ":" ──────────
    // Accepts any number of colons in the name ("Task: setup env:").
    // The name is everything before the trailing colon.
    if (!isCommented && indent === 0 && /^[^-\s#].*:\s*$/.test(effective)) {
      const name = effective.replace(/:\s*$/, '').trim();
      currentTask = { name, taskLineIndex: i, steps: [] };
      tasks.push(currentTask);
      continue;
    }

    // ── Step: "  - text" at any indent level > 0, or commented "  # - text" ─
    const stepMatch = effective.match(/^-\s+(.+)$/);
    if (stepMatch && currentTask) {
      currentTask.steps.push({
        text: stepMatch[1].trim(),
        lineIndex: i,
        commented: isCommented
      });
    }
  }

  return tasks;
}

/**
 * Toggle the comment state of a single line identified by lineIndex.
 * lineIndex must match the index in the normalized (LF) split of the file.
 * Returns the full updated content (LF line endings).
 */
function toggleLineComment(content, lineIndex) {
  const lines = normalize(content).split('\n');
  const idx = Number(lineIndex);
  if (idx < 0 || idx >= lines.length) return content;

  const raw = lines[idx];
  const trimmed = raw.trimStart();
  const indentStr = raw.slice(0, raw.length - trimmed.length);

  if (trimmed.startsWith('#')) {
    // Uncomment: remove leading "# " or "#"
    lines[idx] = indentStr + trimmed.replace(/^#+\s*/, '');
  } else {
    // Comment out
    lines[idx] = indentStr + '# ' + trimmed;
  }

  return lines.join('\n');
}

/**
 * Append a new task block at the end of the file.
 * Returns updated content (LF line endings).
 */
function appendTask(content, taskName) {
  const body = normalize(content).trimEnd();
  const sep = body.length > 0 ? '\n\n' : '';
  return body + sep + taskName + ':\n';
}

/**
 * Insert a new step immediately after the last existing step of the task
 * that starts at taskLineIndex. If the task has no steps yet, inserts on
 * the line right after the task header.
 * Returns updated content (LF line endings).
 */
function appendStep(content, taskLineIndex, stepText) {
  const lines = normalize(content).split('\n');
  const start = Number(taskLineIndex);

  // Walk forward from the task header to find the last step line.
  // Stop when we hit a non-indented, non-blank, non-comment line (= next task header).
  let lastStepLine = start;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trimStart();
    if (t && l[0] !== ' ' && l[0] !== '\t' && !t.startsWith('-') && !t.startsWith('#')) {
      break; // next task header
    }
    if (t.startsWith('-') || (t.startsWith('#') && t.replace(/^#+\s*/, '').startsWith('-'))) {
      lastStepLine = i;
    }
  }

  lines.splice(lastStepLine + 1, 0, '  - ' + stepText);
  return lines.join('\n');
}

module.exports = { parseTasks, toggleLineComment, appendTask, appendStep };
