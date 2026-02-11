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

const textObjectSelections = [
    // Traditional text objects (inner/around)
    { keys: 'i w', selectCommand: 'waltz.innerWordSelect' },
    { keys: 'a w', selectCommand: 'waltz.aroundWordSelect' },
    { keys: 'i shift+w', selectCommand: 'waltz.innerBigWordSelect' },
    { keys: 'a shift+w', selectCommand: 'waltz.aroundBigWordSelect' },
    // Parentheses: shift+8 and shift+9 on JIS
    { keys: 'i shift+8', selectCommand: 'waltz.innerParenSelect' },
    { keys: 'a shift+8', selectCommand: 'waltz.aroundParenSelect' },
    { keys: 'i shift+9', selectCommand: 'waltz.innerParenRightSelect' },
    { keys: 'a shift+9', selectCommand: 'waltz.aroundParenRightSelect' },
    // Braces: shift+[ and shift+]
    { keys: 'i shift+[', selectCommand: 'waltz.innerBraceSelect' },
    { keys: 'a shift+[', selectCommand: 'waltz.aroundBraceSelect' },
    { keys: 'i shift+]', selectCommand: 'waltz.innerBraceRightSelect' },
    { keys: 'a shift+]', selectCommand: 'waltz.aroundBraceRightSelect' },
    // Brackets: [ and ]
    { keys: 'i [', selectCommand: 'waltz.innerBracketSelect' },
    { keys: 'a [', selectCommand: 'waltz.aroundBracketSelect' },
    { keys: 'i ]', selectCommand: 'waltz.innerBracketRightSelect' },
    { keys: 'a ]', selectCommand: 'waltz.aroundBracketRightSelect' },
    // Angle brackets: shift+, and shift+.
    { keys: 'i shift+,', selectCommand: 'waltz.innerAngleSelect' },
    { keys: 'a shift+,', selectCommand: 'waltz.aroundAngleSelect' },
    { keys: 'i shift+.', selectCommand: 'waltz.innerAngleRightSelect' },
    { keys: 'a shift+.', selectCommand: 'waltz.aroundAngleRightSelect' },
    // Quotes: shift+7 for ', shift+2 for "
    { keys: 'i shift+7', selectCommand: 'waltz.innerSingleQuoteSelect' },
    { keys: 'a shift+7', selectCommand: 'waltz.aroundSingleQuoteSelect' },
    { keys: 'i shift+2', selectCommand: 'waltz.innerDoubleQuoteSelect' },
    { keys: 'a shift+2', selectCommand: 'waltz.aroundDoubleQuoteSelect' },
    { keys: 'i shift+[BracketLeft]', selectCommand: 'waltz.innerBacktickSelect' },
    { keys: 'a shift+[BracketLeft]', selectCommand: 'waltz.aroundBacktickSelect' },
];

const operatorSelections: SelectionBinding[] = [
    ...textObjectSelections.map((obj) => ({
        keys: obj.keys,
        selectCommand: obj.selectCommand,
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
    // Find (f, t, F, T, ;, ,)
    { key: 'f', normal: 'waltz.findCharForward', visual: 'waltz.findCharForwardSelect' },
    { key: 't', normal: 'waltz.findCharForwardBefore', visual: 'waltz.findCharForwardBeforeSelect' },
    { key: 'shift+f', normal: 'waltz.findCharBackward', visual: 'waltz.findCharBackwardSelect' },
    { key: 'shift+t', normal: 'waltz.findCharBackwardBefore', visual: 'waltz.findCharBackwardBeforeSelect' },
    { key: ';', normal: 'waltz.repeatFindChar', visual: 'waltz.repeatFindChar' },
    { key: ',', normal: 'waltz.repeatFindCharReverse', visual: 'waltz.repeatFindCharReverse' },
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
// Surround commands (ys, cs, ds, visual S)
// ============================================================

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
            keybindings.push({
                key: `${op.key} ${selection.keys}`,
                command: op.command,
                args: { selectCommand: selection.selectCommand },
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
    for (const obj of textObjectSelections) {
        keybindings.push({
            key: obj.keys,
            command: obj.selectCommand,
            when: VISUAL,
        });
    }

    // Surround: ys{selectionTarget} then prompt surroundWith
    for (const selection of operatorSelections) {
        keybindings.push({
            key: `y s ${selection.keys}`,
            command: 'waltz.surround',
            args: { selectCommand: selection.selectCommand },
            when: NORMAL,
        });
    }

    // Surround: cs then prompt from/to
    keybindings.push({
        key: 'c s',
        command: 'waltz.changeSurround',
        when: NORMAL,
    });

    // Surround: ds then prompt target
    keybindings.push({
        key: 'd s',
        command: 'waltz.deleteSurround',
        when: NORMAL,
    });

    // Surround: S then prompt surroundWith in visual mode
    keybindings.push({
        key: 'shift+s',
        command: 'waltz.visualSurround',
        when: VISUAL,
    });

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
