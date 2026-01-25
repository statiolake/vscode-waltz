# Waltz Redesign Proposal

## Current State Analysis

### Dead Code (Can Be Deleted)

| File/Code | Reason |
|-----------|--------|
| `src/config.ts` | Empty file (just a comment) |
| `src/register.ts` | Only used in tests, not in actual commands |
| `src/utils/positionFinder.ts` | Only used in tests |
| `src/utils/textCursor.ts` | Only used by positionFinder.ts |
| `src/utils/unicode.ts` | Only used by positionFinder.ts |
| `src/utils/rangeUtils.ts` | Only used in tests |
| `src/utils/keysParser/` | Not imported anywhere |
| `vimState.keysPressed` | Only reset (`= []`), never read |
| `vimState.keptColumn` | Defined but never used |
| `vimState.register` | Not used (commands use clipboard directly) |

### Current Command Organization

```
edit.ts      → visualDelete, visualChange, visualYank (selection-based)
             → deleteChar, substituteChar, deleteToEnd
             → pasteAfter, pasteBefore
             → paragraphUp/Down

operator.ts  → delete, change, yank with args (text objects/motions)
             → selectTextObject

find.ts      → f/t/F/T/;/,

mode.ts      → i/a/I/A/o/O/v/V

motion.ts    → W/B/E/gE (cursorWhitespaceWord*)

viewport.ts  → revealCursorLine

goto.ts      → Empty (all in keybindings)
```

---

## Proposed Redesign

### Philosophy

1. **Keybinding-first**: Simple commands → keybinding to VS Code native command
2. **Custom commands only when needed**: VS Code doesn't provide the functionality
3. **Minimal state**: Only track what's truly necessary
4. **Clear separation**: Each file has one clear responsibility

### New Directory Structure

```
src/
├── extension.ts          # Entry point, event handling
├── state.ts              # Minimal state (mode, lastFt only)
├── modes.ts              # Mode switching & UI updates
├── commands/
│   ├── index.ts          # Registration hub
│   ├── operators.ts      # d/c/y with text objects (unified)
│   ├── findChar.ts       # f/t/F/T/;/, (character search)
│   ├── motion.ts         # W/B/E/gE (WORD movement)
│   ├── edit.ts           # x/s/D/C/p/P (simple edits)
│   └── viewport.ts       # zz/zt/zb
├── utils/
│   └── modeDisplay.ts    # Status bar text
│   └── cursorStyle.ts    # Cursor style per mode
scripts/
└── generateKeybindings.ts
```

### New State Definition

```typescript
// src/vimState.ts (keep same file name)
export type VimState = {
    mode: Mode;

    // For f/t repeat (;/,) - keep current structure
    lastFt?: {
        character: string;
        distance: 'nearer' | 'further';  // t vs f distinction for repeat
        direction: 'before' | 'after';   // F/T vs f/t
    };

    // VS Code integration
    statusBarItem: StatusBarItem;
    typeCommandDisposable: Disposable | null;
};
```

**Removed:**
- `keysPressed` - Only reset, never read
- `keptColumn` - Defined but never used
- `register` - Commands use clipboard directly

### Command Consolidation

#### operators.ts (Unified)

```typescript
// Handles both:
// 1. Normal mode: d{motion}, d{textobject}, dd
// 2. Visual mode: d, c, y on selection

interface OperatorArgs {
    textObject?: string;  // "iw", "aw", "i(", etc.
    motion?: string;      // "w", "$", "j", etc.
    line?: boolean;       // dd, cc, yy
}

// Single implementation that handles both cases:
// - If in visual mode with selection → operate on selection
// - If args provided → operate on text object/motion
async function executeOperator(
    editor: TextEditor,
    operation: 'delete' | 'change' | 'yank',
    args: OperatorArgs,
    state: WaltzState
): Promise<void>
```

#### edit.ts (Simple Operations)

```typescript
// x - delete char after cursor
// s - delete char, enter insert
// D - delete to end of line
// C - delete to end, enter insert
// p - paste after
// P - paste before
```

#### findChar.ts

```typescript
// f/t/F/T - find character
// ; - repeat find
// , - reverse repeat
```

### Keybinding Strategy

**Use VS Code native commands directly:**
```typescript
// Movement - all native
{ key: 'h', command: 'cursorLeft' }
{ key: 'j', command: 'cursorDown' }
{ key: 'w', command: 'cursorWordStartRight' }
{ key: 'e', command: 'cursorWordEndRight' }
{ key: 'b', command: 'cursorWordStartLeft' }
{ key: '0', command: 'cursorHome' }
{ key: '$', command: 'cursorEnd' }
{ key: 'gg', command: 'cursorTop' }
{ key: 'G', command: 'cursorBottom' }
// etc.
```

**Custom commands only for:**
- WORD movement (W/B/E/gE) - VS Code doesn't have whitespace-delimited word movement
- Operators with text objects (diw, ciw, etc.)
- Character finding (f/t) with repeat
- Viewport control (zz/zt/zb)
- Mode switching (i/a/o/O etc. need to enter insert mode)

### Files to Delete

**Source Files:**
```bash
rm src/config.ts
rm src/register.ts
rm src/context.ts
rm -rf src/utils/keysParser/
rm src/utils/positionFinder.ts
rm src/utils/textCursor.ts
rm src/utils/unicode.ts
rm src/utils/rangeUtils.ts
rm src/commands/goto.ts
```

**Test Files (test removed/unused code):**
```bash
rm src/test/utils/positionFinder.test.ts
rm src/test/utils/rangeUtils.test.ts
rm src/test/integration/action.test.ts  # tests old waltz.execute
```

**Test Files to Update:**
- `src/test/extension.test.ts` - Remove `Context` type usage

### Migration Steps

1. **Simplify VimState** → Create new `state.ts` with minimal state
2. **Delete unused files** → Remove dead code
3. **Consolidate operators** → Merge edit.ts visual operations into operators.ts
4. **Update imports** → Fix all references
5. **Run tests** → Ensure functionality preserved
6. **Update CLAUDE.md** → Document new architecture

---

## Benefits

1. **~50% less code** - Remove ~1000 lines of unused utilities
2. **Clearer architecture** - Each file has one responsibility
3. **Simpler state** - Only 4 fields instead of 7
4. **Easier maintenance** - Less surface area for bugs
5. **Better documentation** - New structure is self-documenting
