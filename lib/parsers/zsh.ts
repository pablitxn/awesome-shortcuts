import type { ConfigParser, ParsedShortcut } from '@/lib/types';

// Control sequence to human-readable key mapping
const CONTROL_SEQUENCES: Record<string, string[]> = {
  // Ctrl+letter sequences (^A to ^Z)
  '^A': ['Ctrl', 'A'], '^B': ['Ctrl', 'B'], '^C': ['Ctrl', 'C'],
  '^D': ['Ctrl', 'D'], '^E': ['Ctrl', 'E'], '^F': ['Ctrl', 'F'],
  '^G': ['Ctrl', 'G'], '^H': ['Ctrl', 'H'], '^I': ['Ctrl', 'I'],
  '^J': ['Ctrl', 'J'], '^K': ['Ctrl', 'K'], '^L': ['Ctrl', 'L'],
  '^M': ['Ctrl', 'M'], '^N': ['Ctrl', 'N'], '^O': ['Ctrl', 'O'],
  '^P': ['Ctrl', 'P'], '^Q': ['Ctrl', 'Q'], '^R': ['Ctrl', 'R'],
  '^S': ['Ctrl', 'S'], '^T': ['Ctrl', 'T'], '^U': ['Ctrl', 'U'],
  '^V': ['Ctrl', 'V'], '^W': ['Ctrl', 'W'], '^X': ['Ctrl', 'X'],
  '^Y': ['Ctrl', 'Y'], '^Z': ['Ctrl', 'Z'],
  // Special keys
  '^?': ['Backspace'],
  '^[[': ['Escape'],
  // Arrow keys
  '\\e[A': ['Up'],
  '\\e[B': ['Down'],
  '\\e[C': ['Right'],
  '\\e[D': ['Left'],
  '$terminfo[kcuu1]': ['Up'],
  '$terminfo[kcud1]': ['Down'],
  '$terminfo[kcuf1]': ['Right'],
  '$terminfo[kcub1]': ['Left'],
  // Ctrl+Arrow keys
  '\\e[1;5A': ['Ctrl', 'Up'],
  '\\e[1;5B': ['Ctrl', 'Down'],
  '\\e[1;5C': ['Ctrl', 'Right'],
  '\\e[1;5D': ['Ctrl', 'Left'],
  // Alt+Arrow keys
  '\\e[1;3A': ['Alt', 'Up'],
  '\\e[1;3B': ['Alt', 'Down'],
  '\\e[1;3C': ['Alt', 'Right'],
  '\\e[1;3D': ['Alt', 'Left'],
  // Function keys
  '\\e[11~': ['F1'], '\\eOP': ['F1'],
  '\\e[12~': ['F2'], '\\eOQ': ['F2'],
  '\\e[13~': ['F3'], '\\eOR': ['F3'],
  '\\e[14~': ['F4'], '\\eOS': ['F4'],
  '\\e[15~': ['F5'],
  '\\e[17~': ['F6'],
  '\\e[18~': ['F7'],
  '\\e[19~': ['F8'],
  '\\e[20~': ['F9'],
  '\\e[21~': ['F10'],
  '\\e[23~': ['F11'],
  '\\e[24~': ['F12'],
  // Home/End/PageUp/PageDown
  '\\e[H': ['Home'],
  '\\e[F': ['End'],
  '\\e[1~': ['Home'],
  '\\e[4~': ['End'],
  '\\e[5~': ['PageUp'],
  '\\e[6~': ['PageDown'],
  '\\e[2~': ['Insert'],
  '\\e[3~': ['Delete'],
};

/**
 * Parse a control sequence string into human-readable keys
 */
function parseControlSequence(sequence: string): string[] {
  // Remove surrounding quotes if present
  const cleaned = sequence.replace(/^['"]|['"]$/g, '');

  // Check direct mapping first
  if (CONTROL_SEQUENCES[cleaned]) {
    return CONTROL_SEQUENCES[cleaned];
  }

  // Handle ^[letter pattern (Alt+letter)
  const altMatch = cleaned.match(/^\^?\[([a-zA-Z])$/);
  if (altMatch) {
    return ['Alt', altMatch[1].toUpperCase()];
  }

  // Handle \e followed by letter (Alt+letter)
  const escAltMatch = cleaned.match(/^\\e([a-zA-Z])$/);
  if (escAltMatch) {
    return ['Alt', escAltMatch[1].toUpperCase()];
  }

  // Handle ^letter pattern (Ctrl+letter)
  const ctrlMatch = cleaned.match(/^\^([a-zA-Z])$/);
  if (ctrlMatch) {
    return ['Ctrl', ctrlMatch[1].toUpperCase()];
  }

  // Handle multiple key combinations like ^X^E (Ctrl+X Ctrl+E)
  const multiCtrlMatch = cleaned.match(/^\^([a-zA-Z])\^([a-zA-Z])$/);
  if (multiCtrlMatch) {
    return ['Ctrl', multiCtrlMatch[1].toUpperCase(), 'Ctrl', multiCtrlMatch[2].toUpperCase()];
  }

  // If no pattern matches, return the cleaned sequence as-is
  return [cleaned];
}

/**
 * Convert human-readable keys back to zsh bindkey format
 */
function keysToBindkeySequence(keys: string[]): string {
  if (keys.length === 2 && keys[0] === 'Ctrl') {
    return `'^${keys[1].toUpperCase()}'`;
  }
  if (keys.length === 2 && keys[0] === 'Alt') {
    return `'\\e${keys[1].toLowerCase()}'`;
  }
  // For complex sequences, return a simple representation
  return `'^${keys[keys.length - 1].toUpperCase()}'`;
}

/**
 * Extract title from comment on the line before
 */
function extractCommentTitle(lines: string[], lineIndex: number): string | undefined {
  if (lineIndex > 0) {
    const prevLine = lines[lineIndex - 1].trim();
    if (prevLine.startsWith('#')) {
      return prevLine.slice(1).trim();
    }
  }
  return undefined;
}

/**
 * Parse bindkey command
 * Examples:
 *   bindkey '^R' history-incremental-search-backward
 *   bindkey -e '^T' fzf-file-widget
 *   bindkey -M viins '^R' history-incremental-search-backward
 */
function parseBindkeyLine(line: string, lines: string[], lineIndex: number): ParsedShortcut | null {
  // Match bindkey with optional flags and key sequence
  // Flags: -e (emacs), -v (vi), -a (vi cmd), -M <keymap> (specific keymap)
  const bindkeyRegex = /^bindkey\s+(?:-[eva]\s+)?(?:-M\s+\w+\s+)?(['"]?[^'"\s]+['"]?|\$\w+(?:\[\w+\])?)\s+(.+)$/;
  const match = line.match(bindkeyRegex);

  if (!match) return null;

  const [, keySequence, widget] = match;
  const keys = parseControlSequence(keySequence.trim());
  const title = extractCommentTitle(lines, lineIndex) || widget.trim();

  return {
    title,
    keys,
    description: widget.trim(),
    sourceLine: lineIndex + 1,
  };
}

/**
 * Parse alias command
 * Examples:
 *   alias gs='git status'
 *   alias ll="ls -la"
 *   alias -g L='| less'
 */
function parseAliasLine(line: string, lines: string[], lineIndex: number): ParsedShortcut | null {
  // Match alias with optional flags
  const aliasRegex = /^alias\s+(?:-[gs]\s+)?(\w+)=['"]?(.+?)['"]?$/;
  const match = line.match(aliasRegex);

  if (!match) return null;

  const [, aliasName, command] = match;
  const title = extractCommentTitle(lines, lineIndex) || aliasName;

  return {
    title,
    keys: [aliasName],
    description: command.replace(/['"]$/, ''),
    sourceLine: lineIndex + 1,
  };
}

/**
 * Parse oh-my-zsh plugin bindings
 * These are typically in the plugins=(...) array
 */
function parseOhMyZshPlugins(content: string): ParsedShortcut[] {
  const shortcuts: ParsedShortcut[] = [];

  // Match plugins=(...) declaration
  const pluginsMatch = content.match(/plugins=\(([^)]+)\)/);
  if (!pluginsMatch) return shortcuts;

  const plugins = pluginsMatch[1].split(/\s+/).filter(Boolean);

  // Known plugin shortcuts
  const pluginShortcuts: Record<string, ParsedShortcut[]> = {
    'git': [
      { title: 'Git Status', keys: ['gst'], description: 'git status' },
      { title: 'Git Add', keys: ['ga'], description: 'git add' },
      { title: 'Git Commit', keys: ['gc'], description: 'git commit' },
      { title: 'Git Push', keys: ['gp'], description: 'git push' },
      { title: 'Git Pull', keys: ['gl'], description: 'git pull' },
    ],
    'z': [
      { title: 'Jump to Directory', keys: ['z'], description: 'jump to frecent directory' },
    ],
    'fzf': [
      { title: 'FZF File Widget', keys: ['Ctrl', 'T'], description: 'fzf-file-widget' },
      { title: 'FZF History', keys: ['Ctrl', 'R'], description: 'fzf-history-widget' },
      { title: 'FZF CD Widget', keys: ['Alt', 'C'], description: 'fzf-cd-widget' },
    ],
  };

  for (const plugin of plugins) {
    if (pluginShortcuts[plugin]) {
      shortcuts.push(...pluginShortcuts[plugin]);
    }
  }

  return shortcuts;
}

export const zshParser: ConfigParser = {
  appId: 'zsh',

  detect: (filePath: string): boolean => {
    const normalizedPath = filePath.toLowerCase();
    return (
      normalizedPath.endsWith('.zshrc') ||
      normalizedPath.endsWith('.zsh_aliases') ||
      normalizedPath.endsWith('.zshenv') ||
      normalizedPath.endsWith('.zprofile') ||
      normalizedPath.includes('/.zsh/') ||
      normalizedPath.includes('/zsh/') && normalizedPath.endsWith('.zsh')
    );
  },

  parse: (fileContent: string): ParsedShortcut[] => {
    const shortcuts: ParsedShortcut[] = [];
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;

      // Try parsing as bindkey
      if (line.startsWith('bindkey')) {
        const shortcut = parseBindkeyLine(line, lines, i);
        if (shortcut) {
          shortcuts.push(shortcut);
        }
        continue;
      }

      // Try parsing as alias
      if (line.startsWith('alias')) {
        const shortcut = parseAliasLine(line, lines, i);
        if (shortcut) {
          shortcuts.push(shortcut);
        }
        continue;
      }
    }

    // Also parse oh-my-zsh plugins
    const pluginShortcuts = parseOhMyZshPlugins(fileContent);
    shortcuts.push(...pluginShortcuts);

    return shortcuts;
  },

  inject: (fileContent: string, shortcut: ParsedShortcut): string => {
    const lines = fileContent.split('\n');
    const isAlias = shortcut.keys.length === 1 && /^[a-zA-Z_]\w*$/.test(shortcut.keys[0]);

    let newLine: string;
    if (isAlias) {
      // Inject as alias
      newLine = `alias ${shortcut.keys[0]}='${shortcut.description || ''}'`;
    } else {
      // Inject as bindkey
      const keySequence = keysToBindkeySequence(shortcut.keys);
      newLine = `bindkey ${keySequence} ${shortcut.description || 'undefined-widget'}`;
    }

    // Add comment with title if title differs from the key/command
    const aliasName = shortcut.keys[0];
    const shouldAddComment = shortcut.title && shortcut.title !== aliasName && shortcut.title !== shortcut.description;

    // Find a good place to insert (after last bindkey/alias or at end)
    let insertIndex = lines.length;

    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (isAlias && trimmed.startsWith('alias')) {
        insertIndex = i + 1;
        break;
      }
      if (!isAlias && trimmed.startsWith('bindkey')) {
        insertIndex = i + 1;
        break;
      }
    }

    // Build the new lines to insert
    const newLines: string[] = [];
    if (shouldAddComment) {
      newLines.push(`# ${shortcut.title}`);
    }
    newLines.push(newLine);

    // Insert the new lines
    lines.splice(insertIndex, 0, ...newLines);

    return lines.join('\n');
  },
};

export default zshParser;
