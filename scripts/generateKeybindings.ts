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

function generateKeybindings(): Keybinding[] {
    const keybindings: Keybinding[] = [];
    const when = "editorTextFocus && waltz.mode == 'normal'";

    // Generate operator + textObject combinations
    for (const op of operators) {
        for (const obj of textObjects) {
            keybindings.push({
                key: `${op.key} ${obj.keys}`,
                command: op.command,
                args: { textObject: obj.id },
                when,
            });
        }

        // Generate operator + motion combinations
        for (const motion of motions) {
            keybindings.push({
                key: `${op.key} ${motion.keys}`,
                command: op.command,
                args: { motion: motion.id },
                when,
            });
        }

        // Generate line operations (dd, cc, yy)
        keybindings.push({
            key: `${op.key} ${op.key}`,
            command: op.command,
            args: { line: true },
            when,
        });
    }

    return keybindings;
}

function main() {
    const keybindings = generateKeybindings();

    console.log(`Generated ${keybindings.length} keybindings`);

    // Read package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Find the marker comment position or filter out old generated keybindings
    const existingKeybindings: Keybinding[] = packageJson.contributes.keybindings || [];

    // Remove any existing generated keybindings (those with waltz.delete/change/yank + args)
    const filteredKeybindings = existingKeybindings.filter((kb: Keybinding) => {
        const isGenerated =
            (kb.command === 'waltz.delete' ||
             kb.command === 'waltz.change' ||
             kb.command === 'waltz.yank') &&
            kb.args;
        return !isGenerated;
    });

    // Add new generated keybindings
    packageJson.contributes.keybindings = [...filteredKeybindings, ...keybindings];

    // Write back
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4) + '\n');
    console.log(`Updated package.json with ${keybindings.length} generated keybindings`);
    console.log(`Total keybindings: ${packageJson.contributes.keybindings.length}`);
}

main();
