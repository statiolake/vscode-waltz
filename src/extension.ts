import * as vscode from 'vscode';
import {
    type ConfigurationChangeEvent,
    type ExtensionContext,
    Range,
    StatusBarAlignment,
    type TextEditor,
    type TextEditorSelectionChangeEvent,
} from 'vscode';
import { buildActions, delegateAction } from './action/actions';
import type { Context } from './context';
import { createCommentConfigProvider, createVimState } from './contextInitializers';
import { escapeHandler } from './escapeHandler';
import { enterMode, reinitUiForState as reinitUiElement } from './modes';
import { typeHandler } from './typeHandler';
import type { CommentConfigProvider } from './utils/comment';
import type { VimState } from './vimState';

// グローバルな CommentConfigProvider（起動時に一度だけ初期化）
export let globalCommentConfigProvider: CommentConfigProvider;

async function onDidChangeTextEditorSelection(vimState: VimState, e: TextEditorSelectionChangeEvent): Promise<void> {
    // マウスで吹っ飛んだ後適当に入力したらキーコンビネーションとして認識されたとかはうれしくないので、選択範囲が変更さ
    // れたら入力されたキーはリセットする。
    vimState.keysPressed = [];

    const allEmpty = e.selections.every((selection) => selection.isEmpty);
    if (allEmpty && e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
        // マウスによる選択解除の場合はノーマルモードに戻る
        await enterMode(vimState, e.textEditor, 'normal');
    } else if (allEmpty && vimState.mode !== 'insert') {
        // 選択範囲が無になった場合は、ノーマルモードに戻る。この条件だと visual モードにいて移動したあと逆方向に動かし
        // て選択範囲が無になったときもノーマルモードに'るが、まあ良'とす'。というのは、und' などの VS Code 組み込み
        // コマンドが一時的に非空の選択範囲を作成することがあるのだ。最終的には空になるものの、途中で非空の選択範囲が作
        // られた瞬間 visual モードに移行してしまうので、最後の空になった瞬間にノーマルモードに戻れるようにしない
        // と、undo 後に勝手に visual モードになっているなどの不便が生じる。ただ当然ながら、そのようなケースと `vlh` は
        // 区別がつかないので、`vlh` の方が若干違和感を生じるのは避けられなかった。
        await enterMode(vimState, e.textEditor, 'normal');
    } else if (!allEmpty && !['visual', 'visualLine'].includes(vimState.mode)) {
        // 選択状態になった場合は Visual モードへ移行する
        // (すでに Visual 系モードの場合はそのまま維持)
        await enterMode(vimState, e.textEditor, 'visual');
    }

    if (e.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
        // マウスでない場合は選択範囲の先頭が表示されるようにスクロールする
        // マウスの場合は、reveal によって勝手にスクロールされると画面上部の単語をダブルクリックしたいときに困るため除外
        // している。

        // マルチカーソルの場合、最後のカーソル位置を reveal したいので最後のカーソルを見る
        const lastSelection = e.selections[e.selections.length - 1];
        // VisualLine モードの場合、通常行末にカーソルがあるが目線は行頭にあってほしいので、行頭を見る
        const focusAt =
            vimState.mode === 'visualLine' ? lastSelection.active.with({ character: 0 }) : lastSelection.active;
        e.textEditor.revealRange(new Range(focusAt, focusAt));
    }
}

async function onDidChangeActiveTextEditor(vimState: VimState, editor: TextEditor | undefined): Promise<void> {
    console.log(`Active editor changed: ${editor?.document.uri.toString()}`);

    // 選択の状態によってノーマルモードまたはビジュアルモードに遷移
    // エディタが存在しない場合 (巨大ファイル、エディタグループが空など) はとりあえずノーマルモードへ
    if (editor === undefined || editor.selections.every((selection) => selection.isEmpty)) {
        await enterMode(vimState, editor, 'normal');
    } else {
        await enterMode(vimState, editor, 'visual');
    }

    vimState.keysPressed = [];
}

function onDidChangeConfiguration(vimState: VimState, e: ConfigurationChangeEvent): void {
    if (!e.affectsConfiguration('waltz')) return;

    vimState.actions = buildActions();

    reinitUiElement(vimState, vscode.window.activeTextEditor);
}

export async function activate(context: ExtensionContext): Promise<{ getVimState: () => VimState }> {
    // Create comment config provider
    globalCommentConfigProvider = createCommentConfigProvider();

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(StatusBarAlignment.Left, 100);
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
        // 保存する前にはノーマルモードに戻る - 本当は別に保存に限る必要はないが、「保存」という操作がある一定の処理の完
        // 了を意味するため。
        vscode.workspace.onWillSaveTextDocument(() => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                enterMode(vimState, editor, 'normal');
            }
        }),
        vscode.workspace.onDidChangeTextDocument((e) => {
            // ドキュメントが Undo, Redo によって変更された場合、ノーマルモードへ戻る
            if (
                e.reason !== vscode.TextDocumentChangeReason.Undo &&
                e.reason !== vscode.TextDocumentChangeReason.Redo
            ) {
                return;
            }
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                enterMode(vimState, editor, 'normal');
            }
        }),
        vscode.commands.registerCommand('waltz.escapeKey', async () => {
            await vscode.commands.executeCommand('hideSuggestWidget');
            await escapeHandler(vimState);
        }),
        vscode.commands.registerCommand('waltz.noop', () => {
            // Do nothing - used to ignore keys in certain modes
        }),
        vscode.commands.registerCommand('waltz.send', async (args: unknown) => {
            // バリデーション
            if (!args || typeof args !== 'object' || !('keys' in args) || !Array.isArray(args.keys)) {
                console.error('waltz.send: keys argument must be an array');
                return;
            }

            for (const char of args.keys) {
                await typeHandler(vimState, char);
            }
        }),
        vscode.commands.registerCommand('waltz.execute', async (args: unknown) => {
            // バリデーション
            if (!args || typeof args !== 'object' || !('keys' in args) || !Array.isArray(args.keys)) {
                console.error('waltz.execute: keys argument must be an array');
                return;
            }

            // アクティブなエディタの確認
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                console.error('waltz.execute: no active editor');
                return;
            }

            // Context の構築
            const context: Context = {
                editor,
                vimState,
                commentConfigProvider: globalCommentConfigProvider,
            };

            // delegateAction で実行
            const result = await delegateAction(vimState.actions, context, args.keys);

            // 結果の出力
            if (result === 'noMatch') {
                vscode.window.showWarningMessage(`Waltz: No action match: ${args.keys.join('')}`);
            }
        }),
    );

    // 起動時に normal モードに入る (big file で activeEditor が undefined でも)
    const activeEditor = vscode.window.activeTextEditor;
    await enterMode(vimState, activeEditor, 'normal');
    await onDidChangeActiveTextEditor(vimState, activeEditor);

    // Return API for testing
    return {
        getVimState: () => vimState,
    };
}

/**
 * type コマンドを登録する。
 * normal/visual モードで呼び出す。
 */
export function registerTypeCommand(vimState: VimState): void {
    if (vimState.typeCommandDisposable) {
        // すでに登録済み
        return;
    }

    vimState.typeCommandDisposable = vscode.commands.registerCommand('type', async (e: { text: string }) => {
        // editor が undefined (巨大ファイル等) でも typeHandler を呼び出す。
        // typeHandler 内で fallback のある action は実行される。
        await typeHandler(vimState, e.text);
    });
}

/**
 * type コマンドの登録を解除する。
 * insert モードで呼び出す。VSCode ネイティブの入力処理に任せる。
 */
export function unregisterTypeCommand(vimState: VimState): void {
    if (vimState.typeCommandDisposable) {
        vimState.typeCommandDisposable.dispose();
        vimState.typeCommandDisposable = null;
    }
}
