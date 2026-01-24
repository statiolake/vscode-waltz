import * as vscode from 'vscode';

/**
 * Register viewport commands
 */
export function registerViewportCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.revealCursorLine', async (args: unknown) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const at = args && typeof args === 'object' && 'at' in args ? (args.at as string) : 'center';

            await vscode.commands.executeCommand('revealLine', {
                lineNumber: editor.selection.active.line,
                at,
            });
        }),
    );
}
