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

  // Toggle sidebar: focus if not visible/focused, hide otherwise
  context.subscriptions.push(
    vscode.commands.registerCommand('myplans.toggleSidebar', async () => {
      const view = provider._view;
      // If the view is visible and focused, move focus back to editor
      if (view && view.visible) {
        await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
      } else {
        // Show and focus the sidebar panel, then focus first item in webview
        await vscode.commands.executeCommand('myplans.mainView.focus');
        // Notify webview to focus first navigable item
        if (provider._view) {
          provider._view.webview.postMessage({ command: 'focusFirst' });
        }
      }
    })
  );
}

function deactivate() {}
module.exports = { activate, deactivate };
