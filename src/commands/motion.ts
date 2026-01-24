import * as vscode from 'vscode';
import { type Position, Selection } from 'vscode';
import type { VimState } from '../vimState';

/**
 * Find the next WORD start (whitespace-delimited) forward
 */
function findNextWORDStart(document: vscode.TextDocument, position: Position): Position {
    const text = document.getText();
    let offset = document.offsetAt(position);
    const maxOffset = text.length;

    // Skip current non-whitespace
    while (offset < maxOffset && !/\s/.test(text[offset])) {
        offset++;
    }

    // Skip whitespace
    while (offset < maxOffset && /\s/.test(text[offset])) {
        offset++;
    }

    if (offset >= maxOffset) {
        // End of document
        return document.positionAt(maxOffset);
    }

    return document.positionAt(offset);
}

/**
 * Find the previous WORD start (whitespace-delimited) backward
 */
function findPrevWORDStart(document: vscode.TextDocument, position: Position): Position {
    const text = document.getText();
    let offset = document.offsetAt(position);

    // If at start, return start
    if (offset === 0) return position;

    // Move back one to check previous character
    offset--;

    // Skip whitespace backward
    while (offset > 0 && /\s/.test(text[offset])) {
        offset--;
    }

    // Skip non-whitespace backward to find word start
    while (offset > 0 && !/\s/.test(text[offset - 1])) {
        offset--;
    }

    return document.positionAt(offset);
}

/**
 * Execute W motion (forward WORD)
 */
function executeWORDForward(editor: vscode.TextEditor, vimState: VimState): void {
    const isVisual = vimState.mode === 'visual';

    editor.selections = editor.selections.map((selection) => {
        const newPos = findNextWORDStart(editor.document, selection.active);
        if (isVisual) {
            return new Selection(selection.anchor, newPos);
        }
        return new Selection(newPos, newPos);
    });

    // Reveal cursor
    editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/**
 * Execute B motion (backward WORD)
 */
function executeWORDBackward(editor: vscode.TextEditor, vimState: VimState): void {
    const isVisual = vimState.mode === 'visual';

    editor.selections = editor.selections.map((selection) => {
        const newPos = findPrevWORDStart(editor.document, selection.active);
        if (isVisual) {
            return new Selection(selection.anchor, newPos);
        }
        return new Selection(newPos, newPos);
    });

    // Reveal cursor
    editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

export function registerMotionCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('waltz.WORDForward', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) executeWORDForward(editor, getVimState());
        }),
        vscode.commands.registerCommand('waltz.WORDBackward', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) executeWORDBackward(editor, getVimState());
        }),
    );
}
