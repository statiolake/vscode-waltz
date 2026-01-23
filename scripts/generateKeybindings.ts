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

// Simple motions
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

// g-prefix commands (fixed mappings)
const gPrefixCommands = [
    // Navigation
    { key: 'g g', command: 'cursorTop' },
    { key: 'g e', command: 'cursorWordEndLeft' },
    { key: 'g shift+e', command: 'cursorWordEndLeft' },  // gE (same as ge in VS Code)
    { key: 'g j', command: 'cursorDisplayDown' },
    { key: 'g k', command: 'cursorDisplayUp' },
    { key: 'g 0', command: 'cursorHomeSelect' },  // Display line start
    { key: 'g shift+4', command: 'cursorEndSelect' },  // g$ - Display line end
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
];

// Commands that are marked as "generated" and will be replaced on regeneration
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
    'cursorHomeSelect',
    'cursorEndSelect',
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
]);

function generateKeybindings(): Keybinding[] {
    const keybindings: Keybinding[] = [];
    const normalWhen = "editorTextFocus && waltz.mode == 'normal'";
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

    return keybindings;
}

function isGeneratedKeybinding(kb: Keybinding): boolean {
    // Check if it's an operator with args
    if (GENERATED_COMMANDS.has(kb.command)) {
        // For operator commands, only consider those with args as generated
        if (kb.command === 'waltz.delete' || kb.command === 'waltz.change' || kb.command === 'waltz.yank') {
            return !!kb.args;
        }
        // For g-prefix commands, check if the key starts with 'g '
        if (kb.key.startsWith('g ')) {
            return true;
        }
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
