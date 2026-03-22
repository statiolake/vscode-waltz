import * as vscode from 'vscode';
import {
    type ConfigurationChangeEvent,
    type ExtensionContext,
    Range,
    StatusBarAlignment,
    type TextEditor,
    type TextEditorSelectionChangeEvent,
} from 'vscode';
import { registerCommands } from './commands';
import { createCommentConfigProvider, createVimState } from './contextInitializers';
import { enterMode } from './modes';
import type { Mode } from './modesTypes';
import type { CommentConfigProvider } from './utils/comment';
import { getPreferredMode } from './utils/preferredMode';
import { collapseSelections } from './utils/selection';
import type { VimState } from './vimState';

// グローバルな CommentConfigProvider（起動時に一度だけ初期化）
export let globalCommentConfigProvider: CommentConfigProvider;

function getSelectionModeForSourceMode(mode: Mode): 'visual' | 'select' {
    if (getPreferredMode() !== 'insert') {
        return 'visual';
    }

    return mode === 'insert' || mode === 'select' ? 'select' : 'visual';
}

async function onDidChangeTextEditorSelection(vimState: VimState, e: TextEditorSelectionChangeEvent): Promise<void> {
    const allEmpty = e.selections.every((selection) => selection.isEmpty);

    // 選択が空になった場合、Visual モード入室後 10ms 以内であれば preferredMode に戻す
    // (Undo などで一時的に選択状態になり、すぐに戻った場合の自動復帰用)
    if (
        allEmpty &&
        vimState.mode === 'visual' &&
        vimState.visualModeEnteredAt !== undefined &&
        Date.now() - vimState.visualModeEnteredAt < 10
    ) {
        await enterMode(vimState, e.textEditor, getPreferredMode());
    }

    // マウスクリックによってカーソルがゼロ幅になった場合は、設定に応じたモードへ遷移する
    else if (allEmpty && e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
        await enterMode(vimState, e.textEditor, getPreferredMode());
    }
    // select モードで選択がなくなったら insert モードへ戻す（入力で置換後の自然な遷移）
    else if (allEmpty && vimState.mode === 'select') {
        await enterMode(vimState, e.textEditor, 'insert');
    }

    // 選択範囲が非空になった場合、未選択系モードから visual/select へ入る。
    // preferredMode=insert のときだけ遷移元モードで分岐する。
    // preferredMode=normal のときは常に visual へ入る。
    else if (!allEmpty && vimState.mode !== 'visual' && vimState.mode !== 'select') {
        await enterMode(vimState, e.textEditor, getSelectionModeForSourceMode(vimState.mode));
    }
    // それ以外（選択が空になった場合、すでに Visual モードで選択範囲が変化）は
    // 自動的にモードを変更しない

    if (e.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
        // マウスでない場合は選択範囲の先頭が表示されるようにスクロールする
        // マウスの場合は、reveal によって勝手にスクロールされると画面上部の単語をダブルクリックしたいときに困るため除外
        // している。

        // マルチカーソルの場合、最後のカーソル位置を reveal したいので最後のカーソルを見る
        const lastSelection = e.selections[e.selections.length - 1];
        e.textEditor.revealRange(new Range(lastSelection.active, lastSelection.active));
    }
}

async function onDidChangeActiveTextEditor(vimState: VimState, editor: TextEditor | undefined): Promise<void> {
    console.log(`Active editor changed: ${editor?.document.uri.toString()}`);

    // 選択の状態によって preferredMode / visual / select に遷移
    // エディタが存在しない場合 (巨大ファイル、エディタグループが空など) は allEmpty 扱いにする
    const allEmpty = !editor || editor.selections.every((selection) => selection.isEmpty);
    if (!allEmpty) {
        await enterMode(vimState, editor, getSelectionModeForSourceMode(vimState.mode));
    } else if (vimState.mode === 'visual' || vimState.mode === 'select') {
        await enterMode(vimState, editor, getPreferredMode());
    } else {
        // インサートモードではインサートモードをキープする
    }
}

async function onDidChangeConfiguration(vimState: VimState, e: ConfigurationChangeEvent): Promise<void> {
    if (!e.affectsConfiguration('waltz')) return;

    await enterMode(vimState, vscode.window.activeTextEditor, vimState.mode);
}

export async function activate(context: ExtensionContext): Promise<{ getVimState: () => VimState }> {
    // Create comment config provider
    globalCommentConfigProvider = createCommentConfigProvider();

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(StatusBarAlignment.Left, 100);
    statusBarItem.command = 'waltz.toggleMode';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Create VimState with the status bar item
    const vimState = createVimState(statusBarItem);

    // vimState は insert モードで開始するので、type コマンドは登録しない。
    // normal モードに入ったときに registerTypeCommand が呼ばれる。

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            onDidChangeActiveTextEditor(vimState, editor);
        }),
        vscode.window.onDidChangeTextEditorSelection((e) => onDidChangeTextEditorSelection(vimState, e)),
        vscode.workspace.onDidChangeConfiguration((e) => onDidChangeConfiguration(vimState, e)),
        // 保存する前には preferredMode に戻る - 本当は別に保存に限る必要はないが、「保存」という操作がある一定の処
        // 理の完了を意味するため。
        vscode.workspace.onWillSaveTextDocument(async () => {
            await enterMode(vimState, vscode.window.activeTextEditor, getPreferredMode());
        }),
        vscode.commands.registerCommand('waltz.escapeKey', async () => {
            await vscode.commands.executeCommand('hideSuggestWidget');
            const editor = vscode.window.activeTextEditor;
            switch (vimState.mode) {
                case 'insert':
                    await enterMode(vimState, editor, 'normal');
                    break;
                case 'normal':
                    await vscode.commands.executeCommand('removeSecondaryCursors');
                    await vscode.commands.executeCommand('cancelSelection');
                    console.log('cancelled');
                    break;
                case 'visual': {
                    await collapseSelections(editor);
                    await enterMode(vimState, editor, 'normal');
                    break;
                }
                case 'select': {
                    await collapseSelections(editor);
                    await enterMode(vimState, editor, 'normal');
                    break;
                }
            }
        }),
        vscode.commands.registerCommand('waltz.toggleMode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (vimState.mode === 'normal') {
                await enterMode(vimState, editor, 'insert');
            } else {
                await enterMode(vimState, editor, 'normal');
            }
        }),
        vscode.commands.registerCommand('waltz.noop', () => {
            // Do nothing - used to ignore keys in certain modes
        }),
    );

    // Register new commands (goto menu, find char, operators, mode switching)
    registerCommands(context, () => vimState);

    // 起動時に preferredMode へ遷移する (big file で activeEditor が undefined でも)
    const activeEditor = vscode.window.activeTextEditor;
    await enterMode(vimState, activeEditor, getPreferredMode());
    await onDidChangeActiveTextEditor(vimState, activeEditor);

    // Return API for testing
    return {
        getVimState: () => vimState,
    };
}

/**
 * 入力を無視するため type コマンドを登録する。
 * IME 関連のコマンド (compositionStart, compositionEnd, replacePreviousChar) も
 * 無視するように登録する。
 */
export function registerTypeCommand(vimState: VimState): void {
    if (vimState.typeCommandDisposable) {
        // すでに登録済み
        return;
    }

    const typeDisposable = vscode.commands.registerCommand('type', async () => {
        // 無視
    });

    const compositionStartDisposable = vscode.commands.registerCommand('compositionStart', () => {
        // 無視
    });
    const compositionEndDisposable = vscode.commands.registerCommand('compositionEnd', () => {
        // 無視
    });
    const replacePreviousCharDisposable = vscode.commands.registerCommand('replacePreviousChar', () => {
        // 無視
    });

    vimState.typeCommandDisposable = vscode.Disposable.from(
        typeDisposable,
        compositionStartDisposable,
        compositionEndDisposable,
        replacePreviousCharDisposable,
    );
}

/**
 * type コマンドの登録を解除する。
 * insert/select モードで呼び出す。VSCode ネイティブの入力処理に任せる。
 */
export function unregisterTypeCommand(vimState: VimState): void {
    if (vimState.typeCommandDisposable) {
        vimState.typeCommandDisposable.dispose();
        vimState.typeCommandDisposable = null;
    }
}
