import type * as vscode from 'vscode';

/**
 * g プレフィックスコマンド
 * 全て package.json のキーバインドで定義するため、ここでは何も登録しない
 *
 * キーバインド例:
 * - g g → cursorTop
 * - g d → editor.action.revealDefinition
 * - g e → cursorWordEndLeft
 * - g j → cursorDisplayDown
 */

export function registerGotoCommands(_context: vscode.ExtensionContext): void {
    // 全て package.json keybindings で定義
}
