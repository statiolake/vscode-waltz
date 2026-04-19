interface CommentConfig {
    lineComment?: string;
}

/**
 * 言語別コメント設定
 */
const LANGUAGE_COMMENT_CONFIG: Record<string, CommentConfig> = {
    // JavaScript/TypeScript系
    javascript: { lineComment: '//' },
    typescript: { lineComment: '//' },
    typescriptreact: { lineComment: '//' },
    javascriptreact: { lineComment: '//' },
    // Python
    python: { lineComment: '#' },
    // Java
    java: { lineComment: '//' },
    // C/C++
    c: { lineComment: '//' },
    cpp: { lineComment: '//' },
    // C#
    csharp: { lineComment: '//' },
    // Go
    go: { lineComment: '//' },
    // Rust
    rust: { lineComment: '//' },
    // Ruby
    ruby: { lineComment: '#' },
    // PHP
    php: { lineComment: '//' },
    // Shell
    shellscript: { lineComment: '#' },
    bash: { lineComment: '#' },
    sh: { lineComment: '#' },
    powershell: { lineComment: '#' },
    // HTML/XML
    html: { lineComment: undefined },
    xml: { lineComment: undefined },
    // CSS/SCSS
    css: { lineComment: undefined },
    scss: { lineComment: undefined },
    less: { lineComment: undefined },
    // SQL
    sql: { lineComment: '--' },
    // Lua
    lua: { lineComment: '--' },
    // Vim
    vim: { lineComment: '"' },
    // Config / data formats
    toml: { lineComment: '#' },
    yaml: { lineComment: '#' },
    ini: { lineComment: ';' },
    properties: { lineComment: '#' },
    dockerfile: { lineComment: '#' },
    makefile: { lineComment: '#' },
    // その他の言語
    perl: { lineComment: '#' },
    r: { lineComment: '#' },
    julia: { lineComment: '#' },
    elixir: { lineComment: '#' },
    swift: { lineComment: '//' },
    kotlin: { lineComment: '//' },
    dart: { lineComment: '//' },
    scala: { lineComment: '//' },
    groovy: { lineComment: '//' },
    haskell: { lineComment: '--' },
    tex: { lineComment: '%' },
    latex: { lineComment: '%' },
    bibtex: { lineComment: '%' },
};

export class CommentConfigProvider {
    /**
     * 指定された言語のコメント設定を取得
     */
    getConfig(languageId: string): CommentConfig | null {
        return LANGUAGE_COMMENT_CONFIG[languageId] || null;
    }
}
