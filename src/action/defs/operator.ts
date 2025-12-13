import * as vscode from 'vscode';
import { Range, type TextDocument, type TextEditor } from 'vscode';
import type { Context } from '../../context';
import { enterMode } from '../../modes';
import type { Mode } from '../../modesTypes';
import { setRegisterContents } from '../../register';
import { newWholeLineTextObject } from '../../textObject/textObjectBuilder';
import type { TextObject } from '../../textObject/textObjectTypes';
import { findNextLineStart } from '../../utils/positionFinder';
import { newAction, newOperatorAction } from '../actionBuilder';
import type { Action, ActionResult } from '../actionTypes';

/**
 * Strip leading newline from text, handling both LF and CRLF line endings
 */
function trimFirstNewline(text: string): string {
    if (text.startsWith('\r\n')) {
        return text.slice(2);
    } else if (text.startsWith('\n')) {
        return text.slice(1);
    }
    return text;
}

/**
 * Strip trailing newline from text, handling both LF and CRLF line endings
 */
function trimLastNewline(text: string): string {
    if (text.endsWith('\r\n')) {
        return text.slice(0, -2);
    } else if (text.endsWith('\n')) {
        return text.slice(0, -1);
    }
    return text;
}

/**
 * オペレータアクション (d, y, c)
 */
export function buildOperatorActions(
    textObjects: TextObject[],
    delegateAction: (actions: Action[], context: Context, keys: string[]) => Promise<ActionResult>,
): Action[] {
    const actions: Action[] = [];

    // Normal モード
    actions.push(
        // d - 削除
        newOperatorAction({
            operatorKeys: ['d'],
            modes: ['normal'],
            textObjects: [newWholeLineTextObject({ keys: ['d'], includeLineBreak: true }), ...textObjects],
            execute: async (context, matches) => {
                if (matches.length === 0) return;
                const editor = context.editor;
                const contents = matches.map((match) => {
                    let text = editor.document.getText(match.range);
                    const isLinewise = match.isLinewise ?? false;

                    // For linewise operations, strip leading/trailing newlines from register content
                    if (isLinewise) {
                        text = trimFirstNewline(text);
                        text = trimLastNewline(text);
                    }

                    return { text, isLinewise };
                });

                await setRegisterContents(context.vimState, contents);

                await editor.edit((editBuilder) => {
                    for (const match of matches) {
                        editBuilder.delete(match.range);
                    }
                });
            },
        }),
        newAction({
            keys: ['D'],
            modes: ['normal'],
            execute: async (context) => {
                await delegateAction(actions, context, ['d', '$']);
            },
        }),

        // y - ヤンク
        newOperatorAction({
            operatorKeys: ['y'],
            modes: ['normal'],
            textObjects: [newWholeLineTextObject({ keys: ['y'], includeLineBreak: true }), ...textObjects],
            execute: async (context, matches) => {
                if (matches.length === 0) return;
                const editor = context.editor;
                const contents = matches.map((match) => {
                    let text = editor.document.getText(match.range);
                    const isLinewise = match.isLinewise ?? false;

                    // For linewise operations, strip leading/trailing newlines from register content
                    if (isLinewise) {
                        text = trimFirstNewline(text);
                        text = trimLastNewline(text);
                    }

                    return { text, isLinewise };
                });

                await setRegisterContents(context.vimState, contents);
            },
        }),
        newAction({
            keys: ['Y'],
            modes: ['normal'],
            execute: async (context) => {
                await delegateAction(actions, context, ['y', 'y']);
            },
        }),

        // c - 変更
        newOperatorAction({
            operatorKeys: ['c'],
            modes: ['normal'],
            textObjects: [newWholeLineTextObject({ keys: ['c'], includeLineBreak: false }), ...textObjects],
            execute: async (context, matches) => {
                if (matches.length === 0) return;
                const editor = context.editor;
                const contents = matches.map((match) => {
                    let text = editor.document.getText(match.range);
                    const isLinewise = match.isLinewise ?? false;

                    // For linewise operations, strip leading/trailing newlines from register content
                    if (isLinewise) {
                        text = trimFirstNewline(text);
                        text = trimLastNewline(text);
                    }

                    return { text, isLinewise };
                });

                await setRegisterContents(context.vimState, contents);

                await context.editor.edit((editBuilder) => {
                    for (const match of matches) {
                        editBuilder.delete(match.range);
                    }
                });
                await enterMode(context.vimState, context.editor, 'insert');
                if (matches[0].isLinewise) {
                    // なぜか一回につき一つしかインデントしてくれないので回数分呼び出す
                    for (let i = 0; i < matches.length; i++) {
                        await vscode.commands.executeCommand('editor.action.reindentselectedlines');
                    }
                }
            },
        }),
        newAction({
            keys: ['C'],
            modes: ['normal'],
            execute: async (context) => {
                await delegateAction(actions, context, ['c', '$']);
            },
        }),

        // s, S - 変更のエイリアス
        newAction({
            keys: ['s'],
            modes: ['normal'],
            execute: async (context) => {
                await delegateAction(actions, context, ['c', 'l']);
            },
        }),
        newAction({
            keys: ['S'],
            modes: ['normal'],
            execute: async (context) => {
                await delegateAction(actions, context, ['c', 'c']);
            },
        }),
    );

    // Visual モード
    actions.push(
        // d - 削除
        newAction({
            keys: ['d'],
            modes: ['visual', 'visualLine'],
            execute: async (context) => {
                const editor = context.editor;
                const ranges = getAdjustedSelectionRangesIfVisualLine(editor, context.vimState.mode);
                const isLinewise = context.vimState.mode === 'visualLine';
                const contents = ranges.map((range) => {
                    let text = editor.document.getText(range);

                    // For linewise operations, strip ONLY the final trailing newline from register content
                    // This preserves blank lines in the middle of the selection
                    if (isLinewise) {
                        text = trimLastNewline(text);
                    }

                    return { text, isLinewise };
                });

                await setRegisterContents(context.vimState, contents);

                await context.editor.edit((editBuilder) => {
                    for (const range of ranges) editBuilder.delete(range);
                });

                enterMode(context.vimState, context.editor, 'normal');
            },
        }),

        // y - ヤンク
        newAction({
            keys: ['y'],
            modes: ['visual', 'visualLine'],
            execute: async (context) => {
                const editor = context.editor;
                const ranges = getAdjustedSelectionRangesIfVisualLine(editor, context.vimState.mode);
                const isLinewise = context.vimState.mode === 'visualLine';
                const contents = ranges.map((range) => {
                    let text = editor.document.getText(range);

                    // For linewise operations, strip ONLY the final trailing newline from register content
                    // This preserves blank lines in the middle of the selection
                    if (isLinewise) {
                        text = trimLastNewline(text);
                    }

                    return { text, isLinewise };
                });

                await setRegisterContents(context.vimState, contents);

                enterMode(context.vimState, context.editor, 'normal');
            },
        }),

        // c - 変更
        newAction({
            keys: ['c'],
            modes: ['visual', 'visualLine'],
            execute: async (context) => {
                const editor = context.editor;
                const ranges = getAdjustedSelectionRangesIfVisualLine(editor, context.vimState.mode);
                const isLinewise = context.vimState.mode === 'visualLine';
                const contents = ranges.map((range) => {
                    let text = editor.document.getText(range);

                    // For linewise operations, strip ONLY the final trailing newline from register content
                    // This preserves blank lines in the middle of the selection
                    if (isLinewise) {
                        text = trimLastNewline(text);
                    }

                    return { text, isLinewise };
                });

                await setRegisterContents(context.vimState, contents);

                await context.editor.edit((editBuilder) => {
                    for (const range of ranges) editBuilder.delete(range);
                });
                enterMode(context.vimState, context.editor, 'insert');
            },
        }),

        // s - 変更のエイリアス
        newAction({
            keys: ['s'],
            modes: ['visual', 'visualLine'],
            execute: async (context) => {
                await delegateAction(actions, context, ['c']);
            },
        }),
    );

    return actions;
}

export const adjustRangeForVisualLine = (document: TextDocument, range: Range): Range => {
    // Visual Line モードは行末までしか選択しないので改行が含まれず、直接追加する必要がある
    return new Range(range.start, findNextLineStart(document, range.end));
};

const getAdjustedSelectionRangesIfVisualLine = (editor: TextEditor, mode: Mode) => {
    return editor.selections.map((selection) => {
        if (mode === 'visualLine') {
            return adjustRangeForVisualLine(editor.document, selection);
        } else {
            return selection;
        }
    });
};
