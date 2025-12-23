import * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function getLogChannel(): vscode.OutputChannel {
  if (!channel) {
    channel = vscode.window.createOutputChannel('Skills Importer');
  }
  return channel;
}

export function logInfo(message: string): void {
  const ch = getLogChannel();
  ch.appendLine(`[INFO] ${message}`);
}

export function logError(message: string, err?: unknown): void {
  const ch = getLogChannel();
  ch.appendLine(`[ERROR] ${message}`);
  if (err instanceof Error) {
    ch.appendLine(err.stack ?? err.message);
  } else if (err) {
    ch.appendLine(String(err));
  }
}
