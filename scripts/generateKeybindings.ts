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

// When clauses
const NORMAL = "editorTextFocus && waltz.mode != 'insert' && waltz.mode != 'visual'";
const VISUAL = "editorTextFocus && waltz.mode == 'visual'";
const NOT_INSERT = "editorTextFocus && waltz.mode != 'insert'";
const ALL_MODES = "editorTextFocus";

// ============================================================
// Operators (d, c, y) with motions and text objects
// ============================================================

const operators = [
    { key: 'd', command: 'waltz.delete' },
    { key: 'c', command: 'waltz.change' },
    { key: 'y', command: 'waltz.yank' },
];

const textObjects = [
    { keys: 'i w', id: 'iw' },
    { keys: 'a w', id: 'aw' },
    { keys: 'i W', id: 'iW' },
    { keys: 'a W', id: 'aW' },
    { keys: 'i (', id: 'i(' },
    { keys: 'a (', id: 'a(' },
    { keys: 'i )', id: 'i)' },
    { keys: 'a )', id: 'a)' },
    { keys: 'i {', id: 'i{' },
    { keys: 'a {', id: 'a{' },
    { keys: 'i }', id: 'i}' },
    { keys: 'a }', id: 'a}' },
    { keys: 'i [', id: 'i[' },
    { keys: 'a [', id: 'a[' },
    { keys: 'i ]', id: 'i]' },
    { keys: 'a ]', id: 'a]' },
    { keys: 'i <', id: 'i<' },
    { keys: 'a <', id: 'a<' },
    { keys: 'i >', id: 'i>' },
    { keys: 'a >', id: 'a>' },
    { keys: "i '", id: "i'" },
    { keys: "a '", id: "a'" },
    { keys: 'i "', id: 'i"' },
    { keys: 'a "', id: 'a"' },
    { keys: 'i `', id: 'i`' },
    { keys: 'a `', id: 'a`' },
];

const operatorMotions = [
    { keys: 'w', id: 'w' },
    { keys: 'W', id: 'W' },
    { keys: 'b', id: 'b' },
    { keys: 'B', id: 'B' },
    { keys: 'e', id: 'e' },
    { keys: 'E', id: 'E' },
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
    // Line movement
    { key: '0', normal: 'cursorHome', visual: 'cursorHomeSelect' },
    { key: 'shift+4', normal: 'cursorEnd', visual: 'cursorEndSelect' },  // $
    { key: 'shift+6', normal: 'cursorHome', visual: 'cursorHomeSelect' },  // ^ (simplified)
    // Document movement
    { key: 'shift+g', normal: 'cursorBottom', visual: 'cursorBottomSelect' },  // G
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
// g-prefix commands
// ============================================================

const gPrefixCommands = [
    { key: 'g g', normal: 'cursorTop', visual: 'cursorTopSelect' },
    { key: 'g e', normal: 'cursorWordEndLeft', visual: 'cursorWordEndLeftSelect' },
    { key: 'g shift+e', normal: 'cursorWordEndLeft', visual: 'cursorWordEndLeftSelect' },
    { key: 'g j', normal: 'cursorDisplayDown', visual: 'cursorDisplayDownSelect' },
    { key: 'g k', normal: 'cursorDisplayUp', visual: 'cursorDisplayUpSelect' },
    { key: 'g 0', normal: 'cursorLineStart', visual: 'cursorLineStartSelect' },
    { key: 'g shift+4', normal: 'cursorLineEnd', visual: 'cursorLineEndSelect' },
    // LSP / IDE (no visual variant)
    { key: 'g d', normal: 'editor.action.revealDefinition', visual: null },
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
    { key: 'a', command: 'waltz.enterInsertAfter', when: NORMAL },
    { key: 'shift+i', command: 'waltz.enterInsertLineStart', when: NORMAL },
    { key: 'shift+a', command: 'waltz.enterInsertLineEnd', when: NORMAL },
    { key: 'o', command: 'waltz.enterInsertBelow', when: NORMAL },
    { key: 'shift+o', command: 'waltz.enterInsertAbove', when: NORMAL },
    { key: 'v', command: 'waltz.enterVisual', when: NORMAL },
    { key: 'shift+v', command: 'waltz.enterVisualLine', when: NORMAL },
];

// ============================================================
// Edit commands
// ============================================================

const editCommands = [
    // Normal mode edits
    { key: 'x', command: 'waltz.deleteChar', when: NORMAL },
    { key: 's', command: 'waltz.substituteChar', when: NORMAL },
    { key: 'shift+d', command: 'waltz.deleteToEnd', when: NORMAL },
    { key: 'shift+c', command: 'waltz.changeToEndOfLine', when: NORMAL },
    { key: 'shift+j', command: 'editor.action.joinLines', when: NORMAL },
    { key: 'p', command: 'waltz.pasteAfter', when: NORMAL },
    { key: 'shift+p', command: 'waltz.pasteBefore', when: NORMAL },
    { key: 'u', command: 'undo', when: NORMAL },
    { key: 'ctrl+r', command: 'redo', when: NORMAL },
    // Visual mode edits
    { key: 'd', command: 'waltz.visualDelete', when: VISUAL },
    { key: 'x', command: 'waltz.visualDelete', when: VISUAL },
    { key: 'c', command: 'waltz.visualChange', when: VISUAL },
    { key: 's', command: 'waltz.visualChange', when: VISUAL },
    { key: 'y', command: 'waltz.visualYank', when: VISUAL },
];

// ============================================================
// Find commands (f, t, F, T, ;, ,)
// ============================================================

const findCommands = [
    { key: 'f', command: 'waltz.findCharForward', when: NOT_INSERT },
    { key: 't', command: 'waltz.findCharForwardBefore', when: NOT_INSERT },
    { key: 'shift+f', command: 'waltz.findCharBackward', when: NOT_INSERT },
    { key: 'shift+t', command: 'waltz.findCharBackwardBefore', when: NOT_INSERT },
    { key: ';', command: 'waltz.repeatFindChar', when: NOT_INSERT },
    { key: ',', command: 'waltz.repeatFindCharReverse', when: NOT_INSERT },
];

// ============================================================
// Viewport / scroll commands
// ============================================================

const viewportCommands = [
    { key: 'ctrl+d', command: 'editorScroll', args: { to: 'down', by: 'halfPage' }, when: NOT_INSERT },
    { key: 'ctrl+u', command: 'editorScroll', args: { to: 'up', by: 'halfPage' }, when: NOT_INSERT },
    { key: 'z z', command: 'revealLine', args: { lineNumber: '', at: 'center' }, when: NORMAL },
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

    // Operator + textObject combinations
    for (const op of operators) {
        for (const obj of textObjects) {
            keybindings.push({
                key: `${op.key} ${obj.keys}`,
                command: op.command,
                args: { textObject: obj.id },
                when: NORMAL,
            });
        }

        // Operator + motion combinations
        for (const motion of operatorMotions) {
            keybindings.push({
                key: `${op.key} ${motion.keys}`,
                command: op.command,
                args: { motion: motion.id },
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

    // Basic movement (normal and visual)
    for (const cmd of basicMovement) {
        keybindings.push({ key: cmd.key, command: cmd.normal, when: NORMAL });
        keybindings.push({ key: cmd.key, command: cmd.visual, when: VISUAL });
    }

    // g-prefix commands
    for (const cmd of gPrefixCommands) {
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
        keybindings.push({ key: cmd.key, command: cmd.command, when: cmd.when });
    }

    // Find commands
    for (const cmd of findCommands) {
        keybindings.push({ key: cmd.key, command: cmd.command, when: cmd.when });
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
