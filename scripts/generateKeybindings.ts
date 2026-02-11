/**
 * Generate ALL keybindings for Waltz
 * This is the single source of truth for keybindings.
 * Run with: npx ts-node scripts/generateKeybindings.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface Keybinding {
    key: string;
    command: string;
    args?: Record<string, unknown>;
    when: string;
}

interface SelectionBinding {
    keys: string;
    selectCommand: string;
    selectArgs?: Record<string, unknown>;
}

// When clauses
const NORMAL = "editorTextFocus && waltz.mode != 'insert' && waltz.mode != 'visual'";
const VISUAL = "editorTextFocus && waltz.mode == 'visual'";
const NOT_INSERT = "editorTextFocus && waltz.mode != 'insert'";
const ALL_MODES = 'editorTextFocus';

// ============================================================
// Operators (d, c, y) with text objects
// ============================================================

const operators = [
    { key: 'd', command: 'waltz.delete' },
    { key: 'c', command: 'waltz.change' },
    { key: 'y', command: 'waltz.yank' },
];

const explicitTextObjects = [
    // Traditional text objects (inner/around)
    { keys: 'i w', id: 'iw' },
    { keys: 'a w', id: 'aw' },
    { keys: 'i shift+w', id: 'iW' },
    { keys: 'a shift+w', id: 'aW' },
    // Parentheses: shift+8 and shift+9 on JIS
    { keys: 'i shift+8', id: 'i(' },
    { keys: 'a shift+8', id: 'a(' },
    { keys: 'i shift+9', id: 'i)' },
    { keys: 'a shift+9', id: 'a)' },
    // Braces: shift+[ and shift+]
    { keys: 'i shift+[', id: 'i{' },
    { keys: 'a shift+[', id: 'a{' },
    { keys: 'i shift+]', id: 'i}' },
    { keys: 'a shift+]', id: 'a}' },
    // Brackets: [ and ]
    { keys: 'i [', id: 'i[' },
    { keys: 'a [', id: 'a[' },
    { keys: 'i ]', id: 'i]' },
    { keys: 'a ]', id: 'a]' },
    // Angle brackets: shift+, and shift+.
    { keys: 'i shift+,', id: 'i<' },
    { keys: 'a shift+,', id: 'a<' },
    { keys: 'i shift+.', id: 'i>' },
    { keys: 'a shift+.', id: 'a>' },
    // Quotes: shift+7 for ', shift+2 for "
    { keys: 'i shift+7', id: "i'" },
    { keys: 'a shift+7', id: "a'" },
    { keys: 'i shift+2', id: 'i"' },
    { keys: 'a shift+2', id: 'a"' },
    { keys: 'i shift+[BracketLeft]', id: 'i`' },
    { keys: 'a shift+[BracketLeft]', id: 'a`' },
];

// Positional targets (cursor to target)
const motionTargets = [
    { keys: 'w', id: 'w' },
    { keys: 'shift+w', id: 'W' },
    { keys: 'b', id: 'b' },
    { keys: 'shift+b', id: 'B' },
    { keys: 'e', id: 'e' },
    { keys: 'shift+e', id: 'E' },
    { keys: '0', id: '0' },
    { keys: 'shift+4', id: '$' },
    { keys: 'shift+6', id: '^' },
    { keys: 'j', id: 'j' },
    { keys: 'k', id: 'k' },
    { keys: 'h', id: 'h' },
    { keys: 'l', id: 'l' },
    { keys: 'g g', id: 'gg' },
    { keys: 'shift+g', id: 'G' },
];

// Find character targets (f/t/F/T)
const findTargets = [
    { keys: 'f', id: 'f' },
    { keys: 't', id: 't' },
    { keys: 'shift+f', id: 'F' },
    { keys: 'shift+t', id: 'T' },
];

// Keep full target list for text-object-like commands (surround, etc.)
const textObjects = [...explicitTextObjects, ...motionTargets, ...findTargets];

const operatorSelections: SelectionBinding[] = [
    ...explicitTextObjects.map((obj) => ({
        keys: obj.keys,
        selectCommand: 'waltz.selectTextObject',
        selectArgs: { target: obj.id },
    })),
    { keys: 'w', selectCommand: 'cursorWordStartRightSelect' },
    { keys: 'shift+w', selectCommand: 'waltz.cursorWhitespaceWordStartRightSelect' },
    { keys: 'b', selectCommand: 'cursorWordStartLeftSelect' },
    { keys: 'shift+b', selectCommand: 'waltz.cursorWhitespaceWordStartLeftSelect' },
    { keys: 'e', selectCommand: 'cursorWordEndRightSelect' },
    { keys: 'shift+e', selectCommand: 'waltz.cursorWhitespaceWordEndRightSelect' },
    { keys: '0', selectCommand: 'cursorLineStartSelect' },
    { keys: 'shift+4', selectCommand: 'cursorEndSelect' },
    { keys: 'shift+6', selectCommand: 'cursorHomeSelect' },
    { keys: 'j', selectCommand: 'cursorDownSelect' },
    { keys: 'k', selectCommand: 'cursorUpSelect' },
    { keys: 'h', selectCommand: 'cursorLeftSelect' },
    { keys: 'l', selectCommand: 'cursorRightSelect' },
    { keys: 'g g', selectCommand: 'cursorTopSelect' },
    { keys: 'shift+g', selectCommand: 'cursorBottomSelect' },
    { keys: 'f', selectCommand: 'waltz.findCharForwardSelect' },
    { keys: 't', selectCommand: 'waltz.findCharForwardBeforeSelect' },
    { keys: 'shift+f', selectCommand: 'waltz.findCharBackwardSelect' },
    { keys: 'shift+t', selectCommand: 'waltz.findCharBackwardBeforeSelect' },
];

// ============================================================
// Basic movement (hjkl, wbe, etc.)
// ============================================================

const basicMovement = [
    // hjkl
    { key: 'h', normal: 'cursorLeft', visual: 'cursorLeftSelect' },
    { key: 'j', normal: 'cursorDown', visual: 'cursorDownSelect' },
    { key: 'k', normal: 'cursorUp', visual: 'cursorUpSelect' },
    { key: 'l', normal: 'cursorRight', visual: 'cursorRightSelect' },
    // Word movement
    { key: 'w', normal: 'cursorWordStartRight', visual: 'cursorWordStartRightSelect' },
    { key: 'b', normal: 'cursorWordStartLeft', visual: 'cursorWordStartLeftSelect' },
    { key: 'e', normal: 'cursorWordEndRight', visual: 'cursorWordEndRightSelect' },
    { key: 'g e', normal: 'cursorWordEndLeft', visual: 'cursorWordEndLeftSelect' },
    // WORD movement (whitespace-delimited)
    { key: 'shift+w', normal: 'waltz.cursorWhitespaceWordStartRight', visual: 'waltz.cursorWhitespaceWordStartRightSelect' },  // W
    { key: 'shift+b', normal: 'waltz.cursorWhitespaceWordStartLeft', visual: 'waltz.cursorWhitespaceWordStartLeftSelect' },  // B
    { key: 'shift+e', normal: 'waltz.cursorWhitespaceWordEndRight', visual: 'waltz.cursorWhitespaceWordEndRightSelect' },  // E
    { key: 'g shift+e', normal: 'waltz.cursorWhitespaceWordEndLeft', visual: 'waltz.cursorWhitespaceWordEndLeftSelect' },  // gE
    // Line movement
    { key: '0', normal: 'cursorLineStart', visual: 'cursorLineStartSelect' },  // Absolute beginning
    { key: 'shift+4', normal: 'cursorEnd', visual: 'cursorEndSelect' },  // $
    { key: '[Equal]', normal: 'cursorHome', visual: 'cursorHomeSelect' },  // ^ on JIS keyboard
    { key: 'g 0', normal: 'cursorLineStart', visual: 'cursorLineStartSelect' },
    { key: 'g shift+4', normal: 'cursorLineEnd', visual: 'cursorLineEndSelect' },
    // Document movement
    { key: 'shift+g', normal: 'cursorBottom', visual: 'cursorBottomSelect' },  // G
    { key: 'g g', normal: 'cursorTop', visual: 'cursorTopSelect' },
    // Arrow keys
    { key: 'up', normal: 'cursorUp', visual: 'cursorUpSelect' },
    { key: 'down', normal: 'cursorDown', visual: 'cursorDownSelect' },
    { key: 'left', normal: 'cursorLeft', visual: 'cursorLeftSelect' },
    { key: 'right', normal: 'cursorRight', visual: 'cursorRightSelect' },
    // Page keys
    { key: 'pageup', normal: 'cursorPageUp', visual: 'cursorPageUpSelect' },
    { key: 'pagedown', normal: 'cursorPageDown', visual: 'cursorPageDownSelect' },
    // Home/End
    { key: 'home', normal: 'cursorHome', visual: 'cursorHomeSelect' },
    { key: 'end', normal: 'cursorEnd', visual: 'cursorEndSelect' },
    // Ctrl+arrows
    { key: 'ctrl+left', normal: 'cursorWordLeft', visual: 'cursorWordLeftSelect' },
    { key: 'ctrl+right', normal: 'cursorWordRight', visual: 'cursorWordRightSelect' },
    { key: 'alt+left', normal: 'cursorWordLeft', visual: 'cursorWordLeftSelect' },
    { key: 'alt+right', normal: 'cursorWordEndRight', visual: 'cursorWordEndRightSelect' },
    // Ctrl+Home/End
    { key: 'ctrl+home', normal: 'cursorTop', visual: 'cursorTopSelect' },
    { key: 'ctrl+end', normal: 'cursorBottom', visual: 'cursorBottomSelect' },
    // Paragraph movement
    { key: 'shift+[', normal: 'waltz.paragraphUp', visual: 'waltz.paragraphUpSelect' },  // {
    { key: 'shift+]', normal: 'waltz.paragraphDown', visual: 'waltz.paragraphDownSelect' },  // }
    // Match bracket
    { key: 'shift+5', normal: 'editor.action.jumpToBracket', visual: 'editor.action.selectToBracket' },  // %
];

// ============================================================
// LSP keybindings
// ============================================================

const lspCommands = [
    { key: 'g o', normal: 'editor.action.revealDefinition', visual: null },
    { key: 'g d', normal: 'editor.action.showHover', visual: null },
    { key: 'g shift+d', normal: 'editor.action.revealDeclaration', visual: null },
    { key: 'g y', normal: 'editor.action.goToTypeDefinition', visual: null },
    { key: 'g shift+i', normal: 'editor.action.goToImplementation', visual: null },
    { key: 'g r', normal: 'editor.action.goToReferences', visual: null },
    { key: 'g shift+r', normal: 'editor.action.rename', visual: null },
    { key: 'g h', normal: 'editor.action.showHover', visual: null },
    { key: 'g .', normal: 'editor.action.quickFix', visual: null },
    { key: 'g f', normal: 'editor.action.formatDocument', visual: null },
    { key: 'g p', normal: 'workbench.actions.view.problems', visual: null },
];

// ============================================================
// Mode switching
// ============================================================

const modeSwitching = [
    { key: 'Escape', command: 'waltz.escapeKey', when: ALL_MODES },
    { key: 'i', command: 'waltz.enterInsert', when: NORMAL },
    { key: 'a', command: 'waltz.enterInsert', when: NORMAL },  // Same as i (I-beam model)
    { key: 'i', command: 'waltz.enterInsertAtSelectionStart', when: VISUAL },
    { key: 'a', command: 'waltz.enterInsertAtSelectionEnd', when: VISUAL },
    { key: 'shift+i', command: 'waltz.enterInsertAtLineStart', when: NORMAL },
    { key: 'shift+a', command: 'waltz.enterInsertAtLineEnd', when: NORMAL },
    { key: 'o', command: 'waltz.enterInsertAtNewLineBelow', when: NORMAL },
    { key: 'shift+o', command: 'waltz.enterInsertAtNewLineAbove', when: NORMAL },
    { key: 'v', command: 'waltz.enterVisual', when: NORMAL },
    { key: 'shift+v', command: 'expandLineSelection', when: NOT_INSERT },
];

// ============================================================
// Edit commands
// ============================================================

const editCommands = [
    // Normal mode edits
    { key: 'x', command: 'waltz.deleteChar', when: NORMAL },
    { key: 's', command: 'waltz.substituteChar', when: NORMAL },
    { key: 'shift+s', command: 'waltz.change', args: { line: true }, when: NORMAL },  // S = cc
    { key: 'shift+d', command: 'waltz.deleteToEnd', when: NORMAL },
    { key: 'shift+c', command: 'waltz.changeToEndOfLine', when: NORMAL },
    { key: 'shift+j', command: 'editor.action.joinLines', when: NORMAL },
    { key: 'p', command: 'editor.action.clipboardPasteAction', when: NORMAL },
    { key: 'shift+p', command: 'editor.action.clipboardPasteAction', when: NORMAL },
    // Visual mode edits (use native commands - mode change handled by selection event)
    { key: 'd', command: 'editor.action.clipboardCutAction', when: VISUAL },
    { key: 'x', command: 'editor.action.clipboardCutAction', when: VISUAL },
    { key: 'c', command: 'waltz.visualChange', when: VISUAL },
    { key: 's', command: 'waltz.visualChange', when: VISUAL },
    { key: 'y', command: 'editor.action.clipboardCopyAction', when: VISUAL },
    { key: 'p', command: 'editor.action.clipboardPasteAction', when: VISUAL },
];

// ============================================================
// Find commands (f, t, F, T, ;, ,)
// ============================================================

const findCommands = [
    { key: 'f', normal: 'waltz.findCharForward', visual: 'waltz.findCharForwardSelect' },
    { key: 't', normal: 'waltz.findCharForwardBefore', visual: 'waltz.findCharForwardBeforeSelect' },
    { key: 'shift+f', normal: 'waltz.findCharBackward', visual: 'waltz.findCharBackwardSelect' },
    { key: 'shift+t', normal: 'waltz.findCharBackwardBefore', visual: 'waltz.findCharBackwardBeforeSelect' },
    { key: ';', normal: 'waltz.repeatFindChar', visual: 'waltz.repeatFindChar' },
    { key: ',', normal: 'waltz.repeatFindCharReverse', visual: 'waltz.repeatFindCharReverse' },
];

// ============================================================
// Surround commands (ys, cs, ds, visual S)
// ============================================================

// Surround targets (JIS keyboard layout)
const surroundTargets = [
    // Parentheses: shift+8 for (, shift+9 for )
    { keys: 'shift+8', id: '(' },
    { keys: 'shift+9', id: ')' },
    { keys: 'b', id: 'b' },        // Vim alias for ()
    // Braces: shift+[ for {, shift+] for }
    { keys: 'shift+[', id: '{' },
    { keys: 'shift+]', id: '}' },
    { keys: 'shift+b', id: 'B' },  // Vim alias for {}
    // Brackets
    { keys: '[', id: '[' },
    { keys: ']', id: ']' },
    // Angle brackets: shift+, for <, shift+. for >
    { keys: 'shift+,', id: '<' },
    { keys: 'shift+.', id: '>' },
    // Quotes: shift+7 for ', shift+2 for "
    { keys: 'shift+7', id: "'" },
    { keys: 'shift+2', id: '"' },
    { keys: 'shift+[BracketLeft]', id: '`' },
    // Tag
    { keys: 't', id: 't' },
];

// ============================================================
// Viewport / scroll commands
// ============================================================

const viewportCommands = [
    { key: 'z z', command: 'waltz.revealCursorLine', args: { at: 'center' }, when: NOT_INSERT },
    { key: 'z t', command: 'waltz.revealCursorLine', args: { at: 'top' }, when: NOT_INSERT },
    { key: 'z b', command: 'waltz.revealCursorLine', args: { at: 'bottom' }, when: NOT_INSERT },
];

// ============================================================
// Misc / ignored keys (prevent typing in normal mode)
// ============================================================

const ignoredKeys = [
    { key: 'backspace', command: 'waltz.noop', when: NORMAL },
    { key: 'delete', command: 'waltz.noop', when: NORMAL },
    { key: 'tab', command: 'waltz.noop', when: NORMAL },
];

// ============================================================
// Generate all keybindings
// ============================================================

function generateKeybindings(): Keybinding[] {
    const keybindings: Keybinding[] = [];

    // Operator + selection-command combinations (d, c, y)
    for (const op of operators) {
        for (const selection of operatorSelections) {
            const args: Record<string, unknown> = {
                selectCommand: selection.selectCommand,
            };
            if (selection.selectArgs) {
                args.selectArgs = selection.selectArgs;
            }

            keybindings.push({
                key: `${op.key} ${selection.keys}`,
                command: op.command,
                args,
                when: NORMAL,
            });
        }

        // Line operations (dd, cc, yy)
        keybindings.push({
            key: `${op.key} ${op.key}`,
            command: op.command,
            args: { line: true },
            when: NORMAL,
        });
    }

    // Visual mode text object selection (viw, vaw, vi(, etc.)
    for (const obj of explicitTextObjects) {
        keybindings.push({
            key: obj.keys,
            command: 'waltz.selectTextObject',
            args: { target: obj.id },
            when: VISUAL,
        });
    }

    // Surround: ys{textObject}{surroundWith}
    for (const obj of textObjects) {
        for (const surround of surroundTargets) {
            keybindings.push({
                key: `y s ${obj.keys} ${surround.keys}`,
                command: 'waltz.surround',
                args: { target: obj.id, surroundWith: surround.id },
                when: NORMAL,
            });
        }
    }

    // Surround: cs{from}{to}
    for (const from of surroundTargets) {
        for (const to of surroundTargets) {
            keybindings.push({
                key: `c s ${from.keys} ${to.keys}`,
                command: 'waltz.changeSurround',
                args: { from: from.id, to: to.id },
                when: NORMAL,
            });
        }
    }

    // Surround: ds{target}
    for (const target of surroundTargets) {
        keybindings.push({
            key: `d s ${target.keys}`,
            command: 'waltz.deleteSurround',
            args: { target: target.id },
            when: NORMAL,
        });
    }

    // Surround: S{surroundWith} in visual mode
    for (const surround of surroundTargets) {
        keybindings.push({
            key: `shift+s ${surround.keys}`,
            command: 'waltz.visualSurround',
            args: { surroundWith: surround.id },
            when: VISUAL,
        });
    }

    // Basic movement (normal and visual)
    for (const cmd of basicMovement) {
        keybindings.push({ key: cmd.key, command: cmd.normal, when: NORMAL });
        keybindings.push({ key: cmd.key, command: cmd.visual, when: VISUAL });
    }

    // g-prefix commands
    for (const cmd of lspCommands) {
        keybindings.push({ key: cmd.key, command: cmd.normal, when: NORMAL });
        if (cmd.visual) {
            keybindings.push({ key: cmd.key, command: cmd.visual, when: VISUAL });
        }
    }

    // Mode switching
    for (const cmd of modeSwitching) {
        keybindings.push({ key: cmd.key, command: cmd.command, when: cmd.when });
    }

    // Edit commands
    for (const cmd of editCommands) {
        if ('args' in cmd && cmd.args) {
            keybindings.push({ key: cmd.key, command: cmd.command, args: cmd.args, when: cmd.when });
        } else {
            keybindings.push({ key: cmd.key, command: cmd.command, when: cmd.when });
        }
    }

    // Find commands
    for (const cmd of findCommands) {
        keybindings.push({ key: cmd.key, command: cmd.normal, when: NORMAL });
        keybindings.push({ key: cmd.key, command: cmd.visual, when: VISUAL });
    }

    // Viewport commands
    for (const cmd of viewportCommands) {
        if (cmd.args) {
            keybindings.push({ key: cmd.key, command: cmd.command, args: cmd.args, when: cmd.when });
        } else {
            keybindings.push({ key: cmd.key, command: cmd.command, when: cmd.when });
        }
    }

    // Ignored keys
    for (const cmd of ignoredKeys) {
        keybindings.push({ key: cmd.key, command: cmd.command, when: cmd.when });
    }

    return keybindings;
}

function main() {
    const keybindings = generateKeybindings();

    console.log(`Generated ${keybindings.length} keybindings`);

    // Read package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Replace all keybindings
    packageJson.contributes.keybindings = keybindings;

    // Write back
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n');
    console.log(`Updated package.json with ${keybindings.length} keybindings`);
}

main();
