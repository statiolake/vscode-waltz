import * as vscode from 'vscode';

/**
 * g プレフィックスメニュー
 * QuickPick + onDidChangeValue で即時発火
 */
const gotoCommands: Array<{ key: string; label: string; command: string; args?: unknown }> = [
    { key: 'g', label: 'Go to top of file', command: 'cursorTop' },
    { key: 'd', label: 'Go to definition', command: 'editor.action.revealDefinition' },
    { key: 'D', label: 'Go to declaration', command: 'editor.action.revealDeclaration' },
    { key: 'y', label: 'Go to type definition', command: 'editor.action.goToTypeDefinition' },
    { key: 'I', label: 'Go to implementation', command: 'editor.action.goToImplementation' },
    { key: 'r', label: 'Go to references', command: 'editor.action.goToReferences' },
    { key: 'R', label: 'Rename symbol', command: 'editor.action.rename' },
    { key: 'h', label: 'Show hover', command: 'editor.action.showHover' },
    { key: '.', label: 'Quick fix', command: 'editor.action.quickFix' },
    { key: 'f', label: 'Format document', command: 'editor.action.formatDocument' },
    { key: 'p', label: 'Open problems panel', command: 'workbench.actions.view.problems' },
    { key: 'e', label: 'Go to end of previous word', command: 'waltz.send', args: { keys: ['g', 'e'] } },
    { key: 'E', label: 'Go to end of previous WORD', command: 'waltz.send', args: { keys: ['g', 'E'] } },
    { key: 'j', label: 'Move down (wrapped line)', command: 'waltz.send', args: { keys: ['g', 'j'] } },
    { key: 'k', label: 'Move up (wrapped line)', command: 'waltz.send', args: { keys: ['g', 'k'] } },
];

export async function gotoMenuCommand(): Promise<void> {
    const quickPick = vscode.window.createQuickPick();
    quickPick.items = gotoCommands.map(({ key, label }) => ({
        label: key,
        description: label,
    }));
    quickPick.placeholder = 'Press one of the below keys (g prefix)';

    const result = await new Promise<string>((resolve) => {
        quickPick.onDidChangeValue((value) => {
            if (value.length > 0) {
                quickPick.hide();
                resolve(value[0]);
            }
        });

        quickPick.onDidAccept(() => {
            const selected = quickPick.selectedItems[0];
            quickPick.hide();
            resolve(selected?.label ?? '');
        });

        quickPick.onDidHide(() => {
            resolve('');
            quickPick.dispose();
        });

        quickPick.show();
    });

    if (!result) return;

    const cmd = gotoCommands.find((c) => c.key === result);
    if (cmd) {
        await vscode.commands.executeCommand(cmd.command, cmd.args);
    }
}

export function registerGotoCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(vscode.commands.registerCommand('waltz.gotoMenu', gotoMenuCommand));
}
