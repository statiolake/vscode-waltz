# Waltz Development Guidelines

## Core Philosophy: VS Code, Not Vim

Waltz is a modal editing extension based on **VS Code's philosophy**, not Vim's.

### Key Principles

1. **I-beam cursor**: Cursor exists between characters, not on characters
2. **Selection-oriented**: All operations work with selections
3. **Multi-cursor is mandatory**: All commands MUST handle `editor.selections` (plural), never assume single cursor

### Cursor Model: I-beam (Between Characters)

**Critical Concept**: The cursor is an I-beam that exists **between characters**, not a block that sits **on a character**.

```
Text:  H e l l o
       ↑ ↑ ↑ ↑ ↑ ↑
Pos:   0 1 2 3 4 5
```

- Position 0: Before 'H' (beginning of line)
- Position 1: Between 'H' and 'e'
- Position 5: After 'o' (end of line, where length = 5)

For a line with N characters:
- Valid positions: 0 to N (inclusive)
- Position 0 = line start
- Position N = line end

### Terminology Guidelines

**DO use:**
- "Position n" (where n is between 0 and line length)
- "Between character n-1 and character n"
- "Move cursor to position n"
- "Cursor is at position n"

**DO NOT use:**
- "Cursor is on character n" (Vim-style thinking)
- "Character under cursor" (implies block cursor)
- "Current character" (ambiguous)

### Word Movement Commands

Following VS Code naming conventions:

| Vim Key | Command | Description |
|---------|---------|-------------|
| w | `cursorWordStartRight` | Move to position before next word |
| b | `cursorWordStartLeft` | Move to position before previous word |
| e | `cursorWordEndRight` | Move to position after current/next word |
| ge | `cursorWordEndLeft` | Move to position after previous word |
| W | `cursorWhitespaceWordStartRight` | Same as w, but whitespace-delimited |
| B | `cursorWhitespaceWordStartLeft` | Same as b, but whitespace-delimited |
| E | `cursorWhitespaceWordEndRight` | Same as e, but whitespace-delimited |
| gE | `cursorWhitespaceWordEndLeft` | Same as ge, but whitespace-delimited |

### Implementation Notes

- Use VS Code's native commands when available
- Do NOT implement Visual Line mode (use VS Code's native line selection)
- Do NOT implement custom keybindings feature
- Keybindings are defined in `package.json` (generated via `scripts/generateKeybindings.ts`)

### Build Commands

```bash
npm run compile      # TypeScript compilation
npm run lint         # ESLint + Biome
npm run format       # Auto-fix lint issues
npm run generate-keybindings  # Regenerate package.json keybindings
```
