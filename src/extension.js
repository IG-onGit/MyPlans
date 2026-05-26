'use strict';

const vscode = require('vscode');
const { MyPlansWebviewProvider } = require('./webviewProvider');
const scanner = require('./scanner');

function activate(context) {
  const provider = new MyPlansWebviewProvider(context, scanner);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('myplans.mainView', provider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('myplans.refresh', () => provider._refresh())
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('myplans.deploy',  () => provider._deploy())
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('myplans.addCategory', () => provider._addCategory())
  );

  // Ctrl+Shift+M: always bring focus into the webview.
  // Only retreat to the editor when the webview is already the active element.
  context.subscriptions.push(
    vscode.commands.registerCommand('myplans.toggleSidebar', async () => {
      const view = provider._view;
      const webviewFocused = view && view.visible && view.webview.active === true;
      if (webviewFocused) {
        // Already focused inside webview — return focus to editor
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
      } else {
        // Reveal the sidebar view and grab focus regardless of where cursor is
        await vscode.commands.executeCommand('myplans.mainView.focus');
        // Give the webview frame time to mount, then focus first nav item
        setTimeout(() => {
          if (provider._view) {
            provider._view.webview.postMessage({ command: 'focusFirst' });
          }
        }, 100);
      }
    })
  );
}

function deactivate() {}
module.exports = { activate, deactivate };
