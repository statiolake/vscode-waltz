import * as vscode from 'vscode';
import { type Position, Range } from 'vscode';
import { enterMode } from '../modes';
import { collapseSelections } from '../utils/selection';
import type { VimState } from '../vimState';
import { getCharViaQuickPick } from './find';
import { findPairRange, findQuoteRange } from './operator';

/**
 * Surround pair mapping
 */
interface SurroundPair {
    open: string;
    close: string;
}

const SURROUND_PAIRS: Record<string, SurroundPair> = {
    '(': { open: '(', close: ')' },
    ')': { open: '(', close: ')' },
    b: { open: '(', close: ')' },
    '{': { open: '{', close: '}' },
    '}': { open: '{', close: '}' },
    B: { open: '{', close: '}' },
    '[': { open: '[', close: ']' },
    ']': { open: '[', close: ']' },
    '<': { open: '<', close: '>' },
    '>': { open: '<', close: '>' },
    "'": { open: "'", close: "'" },
    '"': { open: '"', close: '"' },
    '`': { open: '`', close: '`' },
};

const PAIR_MAP: Record<string, { open: string; close: string }> = {
    '(': { open: '(', close: ')' },
    ')': { open: '(', close: ')' },
    b: { open: '(', close: ')' },
    '{': { open: '{', close: '}' },
    '}': { open: '{', close: '}' },
    B: { open: '{', close: '}' },
    '[': { open: '[', close: ']' },
    ']': { open: '[', close: ']' },
    '<': { open: '<', close: '>' },
    '>': { open: '<', close: '>' },
};

/**
 * Get tag name via InputBox
 */
async function getTagName(): Promise<string | null> {
    const tagName = await vscode.window.showInputBox({
        prompt: 'Enter tag name (e.g., div, span, p)',
        placeHolder: 'Tag name',
    });
    return tagName ?? null;
}

/**
 * Create tag pair from tag input (supports attributes)
 */
function createTagPair(tagInput: string): SurroundPair {
    const tagParts = tagInput.trim().split(/\s+/);
    const tagName = tagParts[0];
    const attributes = tagParts.slice(1).join(' ');

    const open = attributes ? `<${tagName} ${attributes}>` : `<${tagName}>`;
    const close = `</${tagName}>`;

    return { open, close };
}

/**
 * Get surround pair from character (handles tags via InputBox)
 */
async function getSurroundPair(char: string): Promise<SurroundPair | null> {
    if (char === 't') {
        const tagName = await getTagName();
        if (!tagName) return null;
        return createTagPair(tagName);
    }

    const predefined = SURROUND_PAIRS[char];
    if (predefined) return predefined;

    // Fallback: symmetric delimiter such as "*", "**", "__", etc.
    return { open: char, close: char };
}

function findDelimitedRange(document: vscode.TextDocument, position: Position, delimiter: string): Range | null {
    if (delimiter.length === 0) return null;

    const text = document.getText();
    const offset = document.offsetAt(position);

    let openStart = text.lastIndexOf(delimiter, offset);
    if (openStart === -1) return null;

    // If cursor is inside the opening delimiter, search previous one.
    if (offset > openStart && offset < openStart + delimiter.length) {
        openStart = text.lastIndexOf(delimiter, openStart - 1);
        if (openStart === -1) return null;
    }

    const closeSearchStart = Math.max(offset, openStart + delimiter.length);
    const closeStart = text.indexOf(delimiter, closeSearchStart);
    if (closeStart === -1) return null;

    const start = document.positionAt(openStart);
    const end = document.positionAt(closeStart + delimiter.length);
    return new Range(start, end);
}

/**
 * Find tag range for cs/ds operations
 */
function findTagRange(
    document: vscode.TextDocument,
    position: Position,
): { openStart: number; openEnd: number; closeStart: number; closeEnd: number; tagName: string } | null {
    const text = document.getText();
    const offset = document.offsetAt(position);

    // Search backward for opening tag
    let openStart = -1;
    let openEnd = -1;
    let tagName = '';

    for (let i = offset; i >= 0; i--) {
        if (text[i] === '<' && text[i + 1] !== '/') {
            // Found potential opening tag
            const match = text.slice(i).match(/^<(\w+)([^>]*)>/);
            if (match) {
                openStart = i;
                openEnd = i + match[0].length;
                tagName = match[1];
                break;
            }
        }
    }

    if (openStart === -1) return null;

    // Search forward for matching closing tag
    let depth = 1;
    let closeStart = -1;
    let closeEnd = -1;

    for (let i = openEnd; i < text.length; i++) {
        if (text[i] === '<') {
            if (text[i + 1] === '/') {
                // Closing tag
                const closeMatch = text.slice(i).match(/^<\/(\w+)>/);
                if (closeMatch && closeMatch[1] === tagName) {
                    depth--;
                    if (depth === 0) {
                        closeStart = i;
                        closeEnd = i + closeMatch[0].length;
                        break;
                    }
                }
            } else {
                // Opening tag of same type
                const openMatch = text.slice(i).match(/^<(\w+)([^>]*)>/);
                if (openMatch && openMatch[1] === tagName) {
                    depth++;
                }
            }
        }
    }

    if (closeStart === -1) return null;

    return { openStart, openEnd, closeStart, closeEnd, tagName };
}

/**
 * Surround target (ys command)
 * Args: { selectCommand?: string, surroundWith?: string }
 */
async function surround(args: { selectCommand?: string; surroundWith?: string }): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    if (!args.selectCommand) return;

    try {
        await collapseSelections(editor);
        await vscode.commands.executeCommand(args.selectCommand);
    } catch {
        return;
    }

    if (editor.selections.every((selection) => selection.isEmpty)) return;

    const surroundWith =
        args.surroundWith ??
        (await getCharViaQuickPick('Type a character to surround with... (use t for HTML/XML tag)'));
    if (!surroundWith) return;

    const pair = await getSurroundPair(surroundWith);
    if (!pair) return;

    const document = editor.document;
    const edits: { range: Range; newText: string }[] = [];

    for (const selection of editor.selections) {
        if (!selection.isEmpty) {
            const text = document.getText(selection);
            edits.push({
                range: selection,
                newText: `${pair.open}${text}${pair.close}`,
            });
        }
    }

    if (edits.length > 0) {
        await editor.edit((editBuilder) => {
            for (const edit of edits) {
                editBuilder.replace(edit.range, edit.newText);
            }
        });
    }
}

/**
 * Change surround (cs command)
 * Args: { from?: string, to?: string }
 */
async function changeSurround(args: { from?: string; to?: string }): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const from = args.from ?? (await getCharViaQuickPick('Type a character to change FROM... (use t for tag)'));
    if (!from) return;

    const to = args.to ?? (await getCharViaQuickPick('Type a character to change TO... (use t for tag)'));
    if (!to) return;

    const newPair = await getSurroundPair(to);
    if (!newPair) return;

    const document = editor.document;

    // Handle tag target
    if (from === 't') {
        const edits: { range: Range; newText: string }[] = [];

        for (const selection of editor.selections) {
            const tagRange = findTagRange(document, selection.active);
            if (tagRange) {
                const openTagRange = new Range(
                    document.positionAt(tagRange.openStart),
                    document.positionAt(tagRange.openEnd),
                );
                const closeTagRange = new Range(
                    document.positionAt(tagRange.closeStart),
                    document.positionAt(tagRange.closeEnd),
                );

                // Replace close tag first (to maintain offset positions)
                edits.push({ range: closeTagRange, newText: newPair.close });
                edits.push({ range: openTagRange, newText: newPair.open });
            }
        }

        if (edits.length > 0) {
            // Sort edits by position descending to apply from end to start
            edits.sort((a, b) => b.range.start.compareTo(a.range.start));
            await editor.edit((editBuilder) => {
                for (const edit of edits) {
                    editBuilder.replace(edit.range, edit.newText);
                }
            });
        }
        return;
    }

    // Handle pair/quote/any-delimiter target
    const edits: { range: Range; newText: string }[] = [];

    for (const selection of editor.selections) {
        let range: Range | null = null;
        let openTokenLength = from.length;
        let closeTokenLength = from.length;

        const p = PAIR_MAP[from];
        if (p) {
            range = findPairRange(document, selection.active, p.open, p.close, false);
            openTokenLength = p.open.length;
            closeTokenLength = p.close.length;
        } else if (from.length === 1) {
            range = findQuoteRange(document, selection.active, from, false);
            if (!range) {
                range = findDelimitedRange(document, selection.active, from);
            }
        } else {
            range = findDelimitedRange(document, selection.active, from);
        }

        if (range) {
            // Get inner content
            const innerStartOffset = document.offsetAt(range.start) + openTokenLength;
            const innerEndOffset = document.offsetAt(range.end) - closeTokenLength;
            if (innerEndOffset < innerStartOffset) continue;
            const innerRange = new Range(document.positionAt(innerStartOffset), document.positionAt(innerEndOffset));
            const innerText = document.getText(innerRange);
            edits.push({
                range,
                newText: `${newPair.open}${innerText}${newPair.close}`,
            });
        }
    }

    if (edits.length > 0) {
        await editor.edit((editBuilder) => {
            for (const edit of edits) {
                editBuilder.replace(edit.range, edit.newText);
            }
        });
    }
}

/**
 * Delete surround (ds command)
 * Args: { target?: string }
 */
async function deleteSurround(args: { target?: string }): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const target = args.target ?? (await getCharViaQuickPick('Type a character to delete surround... (use t for tag)'));
    if (!target) return;

    // Handle tag target
    if (target === 't') {
        const edits: { range: Range; newText: string }[] = [];

        for (const selection of editor.selections) {
            const tagRange = findTagRange(document, selection.active);
            if (tagRange) {
                const openTagRange = new Range(
                    document.positionAt(tagRange.openStart),
                    document.positionAt(tagRange.openEnd),
                );
                const closeTagRange = new Range(
                    document.positionAt(tagRange.closeStart),
                    document.positionAt(tagRange.closeEnd),
                );

                // Delete close tag first (to maintain offset positions)
                edits.push({ range: closeTagRange, newText: '' });
                edits.push({ range: openTagRange, newText: '' });
            }
        }

        if (edits.length > 0) {
            // Sort edits by position descending to apply from end to start
            edits.sort((a, b) => b.range.start.compareTo(a.range.start));
            await editor.edit((editBuilder) => {
                for (const edit of edits) {
                    editBuilder.replace(edit.range, edit.newText);
                }
            });
        }
        return;
    }

    // Handle pair/quote/any-delimiter target
    const edits: { range: Range; newText: string }[] = [];

    for (const selection of editor.selections) {
        let range: Range | null = null;
        let openTokenLength = target.length;
        let closeTokenLength = target.length;

        const p = PAIR_MAP[target];
        if (p) {
            range = findPairRange(document, selection.active, p.open, p.close, false);
            openTokenLength = p.open.length;
            closeTokenLength = p.close.length;
        } else if (target.length === 1) {
            range = findQuoteRange(document, selection.active, target, false);
            if (!range) {
                range = findDelimitedRange(document, selection.active, target);
            }
        } else {
            range = findDelimitedRange(document, selection.active, target);
        }

        if (range) {
            // Get inner content and replace the whole range with just the content
            const innerStartOffset = document.offsetAt(range.start) + openTokenLength;
            const innerEndOffset = document.offsetAt(range.end) - closeTokenLength;
            if (innerEndOffset < innerStartOffset) continue;
            const innerRange = new Range(document.positionAt(innerStartOffset), document.positionAt(innerEndOffset));
            const innerText = document.getText(innerRange);
            edits.push({
                range,
                newText: innerText,
            });
        }
    }

    if (edits.length > 0) {
        await editor.edit((editBuilder) => {
            for (const edit of edits) {
                editBuilder.replace(edit.range, edit.newText);
            }
        });
    }
}

/**
 * Visual surround (S command in visual mode)
 * Args: { surroundWith?: string }
 */
async function visualSurround(vimState: VimState, args: { surroundWith?: string }): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const surroundWith =
        args.surroundWith ??
        (await getCharViaQuickPick('Type a character to surround with... (use t for HTML/XML tag)'));
    if (!surroundWith) return;

    const pair = await getSurroundPair(surroundWith);
    if (!pair) return;

    const document = editor.document;
    const edits: { range: Range; newText: string }[] = [];

    for (const selection of editor.selections) {
        if (!selection.isEmpty) {
            const text = document.getText(selection);
            edits.push({
                range: selection,
                newText: `${pair.open}${text}${pair.close}`,
            });
        }
    }

    if (edits.length > 0) {
        await editor.edit((editBuilder) => {
            for (const edit of edits) {
                editBuilder.replace(edit.range, edit.newText);
            }
        });

        // Return to normal mode
        await enterMode(vimState, editor, 'normal');
    }
}

export function registerSurroundCommands(context: vscode.ExtensionContext, getVimState: () => VimState): void {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'waltz.surround',
            (args: { selectCommand?: string; surroundWith?: string } = {}) => {
                surround(args);
            },
        ),
        vscode.commands.registerCommand('waltz.changeSurround', (args: { from?: string; to?: string } = {}) => {
            changeSurround(args);
        }),
        vscode.commands.registerCommand('waltz.deleteSurround', (args: { target?: string } = {}) => {
            deleteSurround(args);
        }),
        vscode.commands.registerCommand('waltz.visualSurround', (args: { surroundWith?: string } = {}) => {
            visualSurround(getVimState(), args);
        }),
    );
}
