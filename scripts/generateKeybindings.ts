/**
 * Generate keybindings for operator + motion/textObject combinations
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

// Operators
const operators = [
    { key: 'd', command: 'waltz.delete' },
    { key: 'c', command: 'waltz.change' },
    { key: 'y', command: 'waltz.yank' },
];

// Text objects (inner/around)
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

// Simple motions for operators
const motions = [
    { keys: 'w', id: 'w' },
    { keys: 'W', id: 'W' },
    { keys: 'b', id: 'b' },
    { keys: 'B', id: 'B' },
    { keys: 'e', id: 'e' },
    { keys: 'E', id: 'E' },
    { keys: '0', id: '0' },
    { keys: 'shift+4', id: '$' },  // $
    { keys: 'shift+6', id: '^' },  // ^
    { keys: 'j', id: 'j' },
    { keys: 'k', id: 'k' },
    { keys: 'h', id: 'h' },
    { keys: 'l', id: 'l' },
    { keys: 'g g', id: 'gg' },
    { keys: 'shift+g', id: 'G' },
];

// Movement commands that have normal/visual variants
// key: the key binding, normal: command for normal mode, visual: command for visual mode (with Select)
const movementCommands = [
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
    // Word movement with Ctrl/Alt
    { key: 'ctrl+left', normal: 'cursorWordLeft', visual: 'cursorWordLeftSelect' },
    { key: 'ctrl+right', normal: 'cursorWordRight', visual: 'cursorWordRightSelect' },
    { key: 'alt+left', normal: 'cursorWordLeft', visual: 'cursorWordLeftSelect' },
    { key: 'alt+right', normal: 'cursorWordEndRight', visual: 'cursorWordEndRightSelect' },
    // Document start/end
    { key: 'ctrl+home', normal: 'cursorTop', visual: 'cursorTopSelect' },
    { key: 'ctrl+end', normal: 'cursorBottom', visual: 'cursorBottomSelect' },
];

// g-prefix commands (fixed mappings)
const gPrefixCommands = [
    // Navigation
    { key: 'g g', command: 'cursorTop' },
    { key: 'g e', command: 'cursorWordEndLeft' },
    { key: 'g shift+e', command: 'cursorWordEndLeft' },  // gE (same as ge in VS Code)
    { key: 'g j', command: 'cursorDisplayDown' },
    { key: 'g k', command: 'cursorDisplayUp' },
    { key: 'g 0', command: 'cursorLineStart' },  // Display line start
    { key: 'g shift+4', command: 'cursorLineEnd' },  // g$ - Display line end
    // LSP / IDE
    { key: 'g d', command: 'editor.action.revealDefinition' },
    { key: 'g shift+d', command: 'editor.action.revealDeclaration' },
    { key: 'g y', command: 'editor.action.goToTypeDefinition' },
    { key: 'g shift+i', command: 'editor.action.goToImplementation' },
    { key: 'g r', command: 'editor.action.goToReferences' },
    { key: 'g shift+r', command: 'editor.action.rename' },
    { key: 'g h', command: 'editor.action.showHover' },
    { key: 'g .', command: 'editor.action.quickFix' },
    { key: 'g f', command: 'editor.action.formatDocument' },
    { key: 'g p', command: 'workbench.actions.view.problems' },
];

// g-prefix commands for visual mode (with Select variants)
const gPrefixVisualCommands = [
    { key: 'g g', command: 'cursorTopSelect' },
    { key: 'g e', command: 'cursorWordEndLeftSelect' },
    { key: 'g shift+e', command: 'cursorWordEndLeftSelect' },
    { key: 'g j', command: 'cursorDisplayDownSelect' },
    { key: 'g k', command: 'cursorDisplayUpSelect' },
    { key: 'g 0', command: 'cursorLineStartSelect' },
    { key: 'g shift+4', command: 'cursorLineEndSelect' },
];

// All commands that are managed by this generator (will be replaced on regeneration)
const GENERATED_COMMANDS = new Set([
    'waltz.delete',
    'waltz.change',
    'waltz.yank',
    // g-prefix native commands
    'cursorTop',
    'cursorTopSelect',
    'cursorWordEndLeft',
    'cursorWordEndLeftSelect',
    'cursorDisplayDown',
    'cursorDisplayDownSelect',
    'cursorDisplayUp',
    'cursorDisplayUpSelect',
    'cursorLineStart',
    'cursorLineStartSelect',
    'cursorLineEnd',
    'cursorLineEndSelect',
    'editor.action.revealDefinition',
    'editor.action.revealDeclaration',
    'editor.action.goToTypeDefinition',
    'editor.action.goToImplementation',
    'editor.action.goToReferences',
    'editor.action.rename',
    'editor.action.showHover',
    'editor.action.quickFix',
    'editor.action.formatDocument',
    'workbench.actions.view.problems',
    // Movement commands
    'cursorUp',
    'cursorUpSelect',
    'cursorDown',
    'cursorDownSelect',
    'cursorLeft',
    'cursorLeftSelect',
    'cursorRight',
    'cursorRightSelect',
    'cursorPageUp',
    'cursorPageUpSelect',
    'cursorPageDown',
    'cursorPageDownSelect',
    'cursorHome',
    'cursorHomeSelect',
    'cursorEnd',
    'cursorEndSelect',
    'cursorWordLeft',
    'cursorWordLeftSelect',
    'cursorWordRight',
    'cursorWordRightSelect',
    'cursorWordEndRight',
    'cursorWordEndRightSelect',
    'cursorBottom',
    'cursorBottomSelect',
]);

// Keys that are managed by this generator
const GENERATED_KEYS = new Set([
    'up', 'down', 'left', 'right',
    'pageup', 'pagedown',
    'home', 'end',
    'ctrl+left', 'ctrl+right',
    'alt+left', 'alt+right',
    'ctrl+home', 'ctrl+end',
]);

function generateKeybindings(): Keybinding[] {
    const keybindings: Keybinding[] = [];
    // Use != 'insert' && != 'visual' instead of == 'normal' so it works before extension activation
    const normalWhen = "editorTextFocus && waltz.mode != 'insert' && waltz.mode != 'visual'";
    const visualWhen = "editorTextFocus && waltz.mode == 'visual'";

    // Generate operator + textObject combinations
    for (const op of operators) {
        for (const obj of textObjects) {
            keybindings.push({
                key: `${op.key} ${obj.keys}`,
                command: op.command,
                args: { textObject: obj.id },
                when: normalWhen,
            });
        }

        // Generate operator + motion combinations
        for (const motion of motions) {
            keybindings.push({
                key: `${op.key} ${motion.keys}`,
                command: op.command,
                args: { motion: motion.id },
                when: normalWhen,
            });
        }

        // Generate line operations (dd, cc, yy)
        keybindings.push({
            key: `${op.key} ${op.key}`,
            command: op.command,
            args: { line: true },
            when: normalWhen,
        });
    }

    // Add g-prefix commands for normal mode
    for (const cmd of gPrefixCommands) {
        keybindings.push({
            key: cmd.key,
            command: cmd.command,
            when: normalWhen,
        });
    }

    // Add g-prefix commands for visual mode
    for (const cmd of gPrefixVisualCommands) {
        keybindings.push({
            key: cmd.key,
            command: cmd.command,
            when: visualWhen,
        });
    }

    // Add movement commands for visual mode
    for (const cmd of movementCommands) {
        keybindings.push({
            key: cmd.key,
            command: cmd.visual,
            when: visualWhen,
        });
    }

    return keybindings;
}

function isGeneratedKeybinding(kb: Keybinding): boolean {
    if (!kb.key || !kb.command) return false;

    // Check if it's an operator with args
    if (kb.command === 'waltz.delete' || kb.command === 'waltz.change' || kb.command === 'waltz.yank') {
        return !!kb.args;
    }

    // Check if the key starts with 'g ' and command is in generated commands
    if (kb.key.startsWith('g ') && GENERATED_COMMANDS.has(kb.command)) {
        return true;
    }

    // Check if it's a movement key with a generated command
    if (GENERATED_KEYS.has(kb.key) && GENERATED_COMMANDS.has(kb.command)) {
        return true;
    }

    return false;
}

function main() {
    const keybindings = generateKeybindings();

    console.log(`Generated ${keybindings.length} keybindings`);

    // Read package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Filter out old generated keybindings
    const existingKeybindings: Keybinding[] = packageJson.contributes.keybindings || [];
    const filteredKeybindings = existingKeybindings.filter((kb: Keybinding) => !isGeneratedKeybinding(kb));

    // Add new generated keybindings
    packageJson.contributes.keybindings = [...filteredKeybindings, ...keybindings];

    // Write back
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n');
    console.log(`Updated package.json with ${keybindings.length} generated keybindings`);
    console.log(`Total keybindings: ${packageJson.contributes.keybindings.length}`);
}

main();
