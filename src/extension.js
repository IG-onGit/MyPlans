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
}

function deactivate() {}
module.exports = { activate, deactivate };
