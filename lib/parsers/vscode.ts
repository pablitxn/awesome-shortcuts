import type { ConfigParser, ParsedShortcut } from '@/lib/types';

/**
 * VS Code keybinding entry from keybindings.json
 */
interface VSCodeKeybinding {
  key: string;
  command: string;
  when?: string;
  args?: unknown;
}

/**
 * Maps VS Code key modifiers to display format
 */
const KEY_MODIFIER_MAP: Record<string, string> = {
  ctrl: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  cmd: 'Cmd',
  meta: 'Meta',
  win: 'Win',
};

/**
 * Capitalizes a single key (e.g., "p" → "P", "enter" → "Enter")
 */
function capitalizeKey(key: string): string {
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
}

/**
 * Converts a single key combo (e.g., "ctrl+shift+p") to display format (e.g., "Ctrl+Shift+P")
 * Handles negative keys (unbinding) that start with "-"
 */
function formatKeyCombo(keyCombo: string): string {
  // Handle negative key (unbinding) prefix
  let prefix = '';
  let combo = keyCombo;
  if (combo.startsWith('-')) {
    prefix = '-';
    combo = combo.slice(1);
  }

  const parts = combo.split('+').map((part) => {
    const trimmed = part.trim().toLowerCase();
    return KEY_MODIFIER_MAP[trimmed] || capitalizeKey(trimmed);
  });
  return prefix + parts.join('+');
}

/**
 * Parses VS Code key notation into display format
 * Handles chord sequences like "ctrl+k ctrl+s" → ["Ctrl+K", "Ctrl+S"]
 */
function parseKeyNotation(key: string): string[] {
  // VS Code uses space to separate chord sequences
  const chords = key.trim().split(/\s+/);
  return chords.map(formatKeyCombo);
}

/**
 * Generates a title from a VS Code command
 * Converts "workbench.action.showCommands" → "Show Commands"
 */
function generateTitleFromCommand(command: string): string {
  // Handle negative commands (removing a binding)
  if (command.startsWith('-')) {
    return `Remove: ${generateTitleFromCommand(command.slice(1))}`;
  }

  // Get the last part of the command (most descriptive)
  const parts = command.split('.');
  const lastPart = parts[parts.length - 1];

  // Convert camelCase to Title Case with spaces
  const withSpaces = lastPart.replace(/([A-Z])/g, ' $1').trim();

  // Capitalize first letter of each word
  return withSpaces
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Builds a description from keybinding metadata
 */
function buildDescription(keybinding: VSCodeKeybinding): string {
  let description = keybinding.command;

  if (keybinding.when) {
    description += ` (when: ${keybinding.when})`;
  }

  if (keybinding.args !== undefined) {
    description += ` [has args]`;
  }

  return description;
}

/**
 * Validates that the content is a valid VS Code keybindings.json
 */
function validateKeybindingsJson(content: string): VSCodeKeybinding[] {
  let parsed: unknown;

  try {
    // VS Code keybindings.json allows comments (JSONC)
    // Strip single-line comments for parsing
    const withoutComments = content.replace(/\/\/.*$/gm, '');
    parsed = JSON.parse(withoutComments);
  } catch {
    throw new Error('Invalid JSON in keybindings.json');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('keybindings.json must be an array');
  }

  // Validate each entry has required fields
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error('Each keybinding must be an object');
    }

    const keybinding = entry as Record<string, unknown>;

    if (typeof keybinding.key !== 'string') {
      throw new Error('Each keybinding must have a "key" string');
    }

    if (typeof keybinding.command !== 'string') {
      throw new Error('Each keybinding must have a "command" string');
    }
  }

  return parsed as VSCodeKeybinding[];
}

/**
 * VS Code keybindings.json parser
 */
export const vscodeParser: ConfigParser = {
  appId: 'vscode',

  /**
   * Detects if a file is a VS Code keybindings.json
   */
  detect: (filePath: string): boolean => {
    const normalized = filePath.toLowerCase();
    return (
      normalized.endsWith('keybindings.json') ||
      normalized.includes('/code/user/keybindings.json') ||
      normalized.includes('/code - insiders/user/keybindings.json')
    );
  },

  /**
   * Parses VS Code keybindings.json content into shortcuts
   */
  parse: (fileContent: string): ParsedShortcut[] => {
    if (!fileContent.trim()) {
      return [];
    }

    const keybindings = validateKeybindingsJson(fileContent);
    const shortcuts: ParsedShortcut[] = [];

    // Track line numbers for source mapping
    const lines = fileContent.split('\n');
    let currentLine = 0;

    for (const keybinding of keybindings) {
      // Find the line containing this keybinding's key
      // This is approximate but useful for source mapping
      const keyPattern = `"key":\\s*"${keybinding.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`;
      const keyRegex = new RegExp(keyPattern);

      let sourceLine: number | undefined;
      for (let i = currentLine; i < lines.length; i++) {
        if (keyRegex.test(lines[i])) {
          sourceLine = i + 1; // 1-indexed
          currentLine = i + 1;
          break;
        }
      }

      shortcuts.push({
        title: generateTitleFromCommand(keybinding.command),
        keys: parseKeyNotation(keybinding.key),
        description: buildDescription(keybinding),
        sourceLine,
      });
    }

    return shortcuts;
  },

  /**
   * Injects a new keybinding into the file content
   * Maintains JSON structure and pretty-prints
   */
  inject: (fileContent: string, shortcut: ParsedShortcut): string => {
    let keybindings: VSCodeKeybinding[];

    if (!fileContent.trim() || fileContent.trim() === '[]') {
      keybindings = [];
    } else {
      keybindings = validateKeybindingsJson(fileContent);
    }

    // Convert ParsedShortcut back to VS Code format
    // Keys array like ["Ctrl+K", "Ctrl+S"] → "ctrl+k ctrl+s"
    const keyString = shortcut.keys
      .map((combo) =>
        combo
          .split('+')
          .map((part) => part.toLowerCase())
          .join('+')
      )
      .join(' ');

    // Extract command from description if present, otherwise generate from title
    let command = shortcut.description || '';
    // Remove "(when: ...)" and "[has args]" suffixes if present
    command = command.replace(/\s*\(when:.*?\)/g, '').replace(/\s*\[has args\]/g, '').trim();

    // If no valid command, generate from title
    if (!command || command.includes(' ')) {
      // Convert "Show Commands" → "workbench.action.showCommands"
      const camelCase = shortcut.title
        .split(' ')
        .map((word, i) => (i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
        .join('');
      command = `user.${camelCase}`;
    }

    const newKeybinding: VSCodeKeybinding = {
      key: keyString,
      command,
    };

    keybindings.push(newKeybinding);

    // Pretty-print with 2-space indentation
    return JSON.stringify(keybindings, null, 2) + '\n';
  },
};

export default vscodeParser;
