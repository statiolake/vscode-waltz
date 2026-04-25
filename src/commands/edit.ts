import * as vscode from 'vscode';
import { Position, Range, Selection } from 'vscode';
import { globalCommentConfigProvider } from '../extension';
import { enterMode } from '../modes';
import { collapseSelections } from '../utils/selection';
import type { VimState } from '../vimState';

/**
 * Get a character via QuickPick
 */
async function getCharViaQuickPick(prompt: string): Promise<string | null> {
    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = prompt;
    quickPick.items = [];

    const char = await new Promise<string>((resolve) => {
        quickPick.onDidChangeValue((value) => {
            if (value.length > 0) {
                quickPick.hide();
                resolve(value[0]);
            }
        });

        quickPick.onDidHide(() => {
            resolve('');
            quickPick.dispose();
        });

        quickPick.show();
    });

    return char || null;
}

/**
 * 編集コマンド (Visual モード c、ペースト、段落移動など)
 */

async function visualChange(vimState: VimState): Promise<void> {
    await vscode.commands.executeCommand('editor.action.clipboardCutAction');
    await enterMode(vimState, vscode.window.activeTextEditor, 'insert');
}

async function visualCut(vimState: VimState): Promise<void> {
    await vscode.commands.executeCommand('editor.action.clipboardCutAction');
    await enterMode(vimState, vscode.window.activeTextEditor, 'normal');
}

async function visualYank(vimState: VimState): Promise<void> {
    await vscode.commands.executeCommand('editor.action.clipboardCopyAction');
    await collapseSelections(vscode.window.activeTextEditor);
    await enterMode(vimState, vscode.window.activeTextEditor, 'normal');
}

async function changeToEndOfLine(vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    await vscode.commands.executeCommand('cursorEndSelect');
    // 選択がすべて非空のときだけ cut。空選択での "cut whole line" 副作用を避けるため。
    // editor が取れないときは check できないので常時 cut にフォールバック (行末カーソルだと
    // 行が消える可能性があるが巨大ファイルのエッジケース)。
    const shouldCut = !editor || editor.selections.every((s) => !s.isEmpty);
    if (shouldCut) {
        await vscode.commands.executeCommand('editor.action.clipboardCutAction');
    } else {
        await collapseSelections(editor);
    }
    enterMode(vimState, editor, 'insert');
}

async function deleteChar(_vimState: VimState): Promise<void> {
    await vscode.commands.executeCommand('deleteRight');
}

async function substituteChar(vimState: VimState): Promise<void> {
    // Delete the character after cursor position
    await vscode.commands.executeCommand('deleteRight');

    // Enter insert mode
    enterMode(vimState, vscode.window.activeTextEditor, 'insert');
}

/**
 * r コマンド：単一文字置換
 * カーソル位置の文字を指定した文字で置換する（ノーマルモードのまま）
 */
async function replaceChar(_vimState: VimState): Promise<void> {
    // QuickPickで置換文字を入力待ち
    const char = await getCharViaQuickPick('Type a character to replace with...');
    if (!char) return;

    await vscode.commands.executeCommand('deleteRight');
    await vscode.commands.executeCommand('default:type', { text: char });
}

async function deleteToEnd(_vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    await vscode.commands.executeCommand('cursorEndSelect');
    // 選択がすべて非空のときだけ cut。空選択での "cut whole line" 副作用を避けるため。
    // editor が取れないときは check できないので常時 cut にフォールバック。
    const shouldCut = !editor || editor.selections.every((s) => !s.isEmpty);
    if (shouldCut) {
        await vscode.commands.executeCommand('editor.action.clipboardCutAction');
    } else {
        await collapseSelections(editor);
    }
}

/**
 * J: editor.action.joinLines と同等の挙動に、継続行のコメント接頭辞除去を加えたもの。
 * 1つの edit として適用するために結合結果を計算して replace する。
 * editor が取れないときだけ native にフォールバック。
 */
async function joinLines(_vimState: VimState): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        await vscode.commands.executeCommand('editor.action.joinLines');
        return;
    }

    const doc = editor.document;
    const lineComment = globalCommentConfigProvider.getConfig(doc.languageId)?.lineComment;

    type JoinOp = {
        edit?: { range: Range; text: string };
        newSelection: Selection;
    };

    const ops: JoinOp[] = [];

    for (const sel of editor.selections) {
        const startLine = sel.start.line;
        let endLine: number;

        // 空選択・単一行選択は次の行と結合（native と同じ）
        if (sel.isEmpty || sel.start.line === sel.end.line) {
            if (startLine >= doc.lineCount - 1) {
                ops.push({ newSelection: sel });
                continue;
            }
            endLine = startLine + 1;
        } else {
            endLine = sel.end.line;
        }

        // 先頭行がコメント行のときだけ継続行のコメント接頭辞を剥がす
        const firstLineText = doc.lineAt(startLine).text;
        const shouldStrip = lineComment !== undefined && firstLineText.trimStart().startsWith(lineComment);

        let joined = firstLineText;
        // 最後の継続行追加時の "content + separator" 長。空選択のカーソル位置計算に使う
        let columnDeltaOffset = 0;

        for (let i = startLine + 1; i <= endLine; i++) {
            const lineText = doc.lineAt(i).text;
            let content = lineText.trimStart();

            if (shouldStrip && content.startsWith(lineComment)) {
                content = content.substring(lineComment.length).trimStart();
            }

            if (content.length === 0) {
                columnDeltaOffset = 0;
                continue;
            }

            // 既存末尾の空白は削って単一スペースにまとめる
            joined = joined.replace(/[\s\uFEFF\xA0]+$/, '');

            if (joined.length === 0) {
                joined = content;
                columnDeltaOffset = content.length;
            } else {
                // 両端とも非 ASCII (日本語等) の境界ではスペースを挿入しない (vim の formatoptions+=M 相当)
                const lastChar = joined.charAt(joined.length - 1);
                const firstChar = content.charAt(0);
                const insertSpace = lastChar.charCodeAt(0) < 128 || firstChar.charCodeAt(0) < 128;
                if (insertSpace) {
                    joined = `${joined} ${content}`;
                    columnDeltaOffset = content.length + 1;
                } else {
                    joined = `${joined}${content}`;
                    columnDeltaOffset = content.length;
                }
            }
        }

        const endLineText = doc.lineAt(endLine).text;
        const range = new Range(startLine, 0, endLine, endLineText.length);

        let newSelection: Selection;
        if (sel.isEmpty) {
            // 空選択: 最後の継続行が付け足された直前 (= seam) にカーソルを置く
            const col = joined.length - columnDeltaOffset;
            const pos = new Position(startLine, col);
            newSelection = new Selection(pos, pos);
        } else {
            // 非空選択: 元の end 行の行末からのオフセットを保ったまま新しい end を決める
            const origEndText = doc.lineAt(sel.end.line).text;
            const tailOffset = origEndText.length - sel.end.character;
            const newEndCol = Math.max(0, joined.length - tailOffset);
            newSelection = new Selection(sel.start, new Position(startLine, newEndCol));
        }

        ops.push({ edit: { range, text: joined }, newSelection });
    }

    if (!ops.some((op) => op.edit !== undefined)) return;

    await editor.edit((editBuilder) => {
        for (const op of ops) {
            if (op.edit) {
                editBuilder.replace(op.edit.range, op.edit.text);
            }
        }
    });

    editor.selections = ops.map((op) => op.newSelection);
}

/**
 * Find paragraph boundary (first or last non-empty line of current paragraph)
 * - 'up': find first non-empty line of current paragraph (or previous paragraph if already at start)
 * - 'down': find last non-empty line of current paragraph (or next paragraph if already at end)
 */
function findParagraphBoundary(document: vscode.TextDocument, startLine: number, direction: 'up' | 'down'): number {
    const lineCount = document.lineCount;
    let line = startLine;

    // If on empty line, first find a paragraph in the given direction
    if (document.lineAt(line).isEmptyOrWhitespace) {
        while (line >= 0 && line < lineCount) {
            if (!document.lineAt(line).isEmptyOrWhitespace) break;
            line += direction === 'up' ? -1 : 1;
        }
        // If we went out of bounds, clamp
        if (line < 0 || line >= lineCount) {
            return Math.max(0, Math.min(lineCount - 1, line));
        }
    }

    // Now we're on a non-empty line, find the boundary of this paragraph
    if (direction === 'up') {
        // Find first non-empty line of paragraph (go up until empty or start)
        while (line > 0 && !document.lineAt(line - 1).isEmptyOrWhitespace) {
            line--;
        }
        // If we're already at the start and haven't moved, go to previous paragraph
        if (line === startLine && line > 0) {
            line--;
            // Skip empty lines
            while (line > 0 && document.lineAt(line).isEmptyOrWhitespace) {
                line--;
            }
            // Find start of that paragraph
            while (line > 0 && !document.lineAt(line - 1).isEmptyOrWhitespace) {
                line--;
            }
        }
    } else {
        // Find last non-empty line of paragraph (go down until empty or end)
        while (line < lineCount - 1 && !document.lineAt(line + 1).isEmptyOrWhitespace) {
            line++;
        }
        // If we're already at the end and haven't moved, go to next paragraph
        if (line === startLine && line < lineCount - 1) {
            line++;
            // Skip empty lines
            while (line < lineCount - 1 && document.lineAt(line).isEmptyOrWhitespace) {
                line++;
            }
            // Find end of that paragraph
            while (line < lineCount - 1 && !document.lineAt(line + 1).isEmptyOrWhitespace) {
                line++;
            }
        }
    }

    return line;
}

function paragraphMove(_vimState: VimState, direction: 'up' | 'down', select: boolean): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    editor.selections = editor.selections.map((selection) => {
        const targetLine = findParagraphBoundary(editor.document, selection.active.line, direction);
        const targetPos = new Position(targetLine, 0);

        if (select) {
            return new Selection(selection.anchor, targetPos);
        }
        return new Selection(targetPos, targetPos);
    });

    // Reveal cursor
    editor.revealRange(editor.selection);
}

export function registerEditCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.visualChange', () => visualChange(getVimState())),
        vscode.commands.registerCommand('waltz.visualCut', () => visualCut(getVimState())),
        vscode.commands.registerCommand('waltz.visualYank', () => visualYank(getVimState())),
        vscode.commands.registerCommand('waltz.changeToEndOfLine', () => changeToEndOfLine(getVimState())),
        vscode.commands.registerCommand('waltz.deleteChar', () => deleteChar(getVimState())),
        vscode.commands.registerCommand('waltz.substituteChar', () => substituteChar(getVimState())),
        vscode.commands.registerCommand('waltz.replaceChar', () => replaceChar(getVimState())),
        vscode.commands.registerCommand('waltz.deleteToEnd', () => deleteToEnd(getVimState())),
        vscode.commands.registerCommand('waltz.joinLines', () => joinLines(getVimState())),
        vscode.commands.registerCommand('waltz.paragraphUp', () => paragraphMove(getVimState(), 'up', false)),
        vscode.commands.registerCommand('waltz.paragraphDown', () => paragraphMove(getVimState(), 'down', false)),
        vscode.commands.registerCommand('waltz.paragraphUpSelect', () => paragraphMove(getVimState(), 'up', true)),
        vscode.commands.registerCommand('waltz.paragraphDownSelect', () => paragraphMove(getVimState(), 'down', true)),
    );
}
