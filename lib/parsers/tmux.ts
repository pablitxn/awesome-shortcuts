import type { ConfigParser, ParsedShortcut } from '@/lib/types';

const DEFAULT_PREFIX = 'Ctrl+B';

/**
 * Parses tmux configuration files to extract key bindings.
 * Supports bind-key/bind syntax with prefix detection.
 */
export const tmuxParser: ConfigParser = {
  appId: 'tmux',

  detect: (filePath: string): boolean => {
    const normalizedPath = filePath.toLowerCase();
    return (
      normalizedPath.endsWith('.tmux.conf') ||
      normalizedPath.endsWith('tmux.conf') ||
      normalizedPath.includes('tmux') && normalizedPath.endsWith('.conf')
    );
  },

  parse: (fileContent: string): ParsedShortcut[] => {
    const lines = fileContent.split('\n');
    const shortcuts: ParsedShortcut[] = [];
    const prefix = detectPrefix(fileContent);

    let pendingComment: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Capture comment for next binding
      if (trimmedLine.startsWith('#') && !trimmedLine.startsWith('#!')) {
        pendingComment = trimmedLine.slice(1).trim();
        continue;
      }

      // Skip empty lines but preserve comment
      if (trimmedLine === '') {
        continue;
      }

      // Parse bind/bind-key commands
      const binding = parseBindCommand(trimmedLine, prefix);
      if (binding) {
        shortcuts.push({
          title: pendingComment || binding.command,
          keys: binding.keys,
          description: binding.command,
          sourceLine: i + 1,
        });
        pendingComment = null;
      } else {
        // Reset pending comment if line is not a binding
        pendingComment = null;
      }
    }

    return shortcuts;
  },

  inject: (fileContent: string, shortcut: ParsedShortcut): string => {
    const lines = fileContent.split('\n');
    const prefix = detectPrefix(fileContent);

    // Build the bind command
    const bindCommand = buildBindCommand(shortcut, prefix);

    // Find the best insertion point (after last bind command or at end)
    let insertIndex = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('bind-key') || trimmed.startsWith('bind ')) {
        insertIndex = i + 1;
        break;
      }
    }

    // Build the new content
    const newLines: string[] = [];

    // Add comment if we have a title different from the command
    if (shortcut.title && shortcut.title !== shortcut.description) {
      newLines.push(`# ${shortcut.title}`);
    }
    newLines.push(bindCommand);

    // Insert the new lines
    lines.splice(insertIndex, 0, ...newLines);

    return lines.join('\n');
  },
};

/**
 * Detects custom prefix from set-option or set commands
 */
function detectPrefix(fileContent: string): string {
  const lines = fileContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Match: set-option -g prefix C-a
    // Match: set -g prefix C-a
    const prefixMatch = trimmed.match(
      /^set(?:-option)?\s+(?:-g\s+)?prefix\s+(.+)$/
    );

    if (prefixMatch) {
      return formatKey(prefixMatch[1].trim());
    }
  }

  return DEFAULT_PREFIX;
}

/**
 * Parses a bind/bind-key command line
 */
function parseBindCommand(
  line: string,
  prefix: string
): { keys: string[]; command: string } | null {
  // Match bind or bind-key commands
  // bind-key [-cnr] [-T key-table] key command [arguments]
  // bind [-cnr] [-T key-table] key command [arguments]

  const bindMatch = line.match(/^bind(?:-key)?\s+(.+)$/);
  if (!bindMatch) {
    return null;
  }

  const args = bindMatch[1];
  let remaining = args;
  let noPrefix = false;
  let isRepeatable = false;
  let keyTable: string | null = null;

  // Parse flags
  while (remaining.length > 0) {
    // -n flag (no prefix, root table)
    if (remaining.startsWith('-n')) {
      noPrefix = true;
      remaining = remaining.slice(2).trim();
      continue;
    }

    // -r flag (repeatable)
    if (remaining.startsWith('-r')) {
      isRepeatable = true;
      remaining = remaining.slice(2).trim();
      continue;
    }

    // -T flag (key table)
    const tableMatch = remaining.match(/^-T\s+(\S+)\s*/);
    if (tableMatch) {
      keyTable = tableMatch[1];
      if (keyTable === 'root') {
        noPrefix = true;
      }
      remaining = remaining.slice(tableMatch[0].length);
      continue;
    }

    // Skip other flags we don't recognize
    if (remaining.startsWith('-')) {
      const flagMatch = remaining.match(/^-\S+\s*/);
      if (flagMatch) {
        remaining = remaining.slice(flagMatch[0].length);
        continue;
      }
    }

    break;
  }

  // Now parse the key and command
  // The key is the first non-flag argument
  const parts = remaining.match(/^(\S+)\s+(.+)$/);
  if (!parts) {
    // Could be just a key with no command (unlikely but handle it)
    const keyOnly = remaining.trim();
    if (keyOnly) {
      const keys = noPrefix ? [formatKey(keyOnly)] : [prefix, formatKey(keyOnly)];
      return { keys, command: '' };
    }
    return null;
  }

  const key = parts[1];
  const command = parts[2].trim();

  // Build the keys array
  const keys: string[] = [];
  if (!noPrefix) {
    keys.push(prefix);
  }
  keys.push(formatKey(key));

  // Add note about repeatable if applicable
  const commandWithFlags = isRepeatable ? `${command} (repeatable)` : command;

  return { keys, command: commandWithFlags };
}

/**
 * Formats a tmux key notation to human-readable format
 */
function formatKey(key: string): string {
  // Handle common tmux key notations
  // Full word mappings (checked first, longest match wins)
  const fullWordMappings: Record<string, string> = {
    'BSpace': 'Backspace',
    'Space': 'Space',
    'Enter': 'Enter',
    'Escape': 'Esc',
    'Tab': 'Tab',
    'PPage': 'PageUp',
    'NPage': 'PageDown',
    'PageUp': 'PageUp',
    'PageDown': 'PageDown',
    'Home': 'Home',
    'End': 'End',
    'IC': 'Insert',
    'DC': 'Delete',
    'Up': '↑',
    'Down': '↓',
    'Left': '←',
    'Right': '→',
  };

  // Modifier prefixes
  const modifierMappings: Record<string, string> = {
    'C-': 'Ctrl+',
    'M-': 'Alt+',
    'S-': 'Shift+',
  };

  // Handle modifier combinations (e.g., C-a, M-h, C-M-x)
  let result = '';
  let remaining = key;

  while (remaining.length > 0) {
    let matched = false;

    // Check modifiers first (C-, M-, S-)
    for (const [notation, replacement] of Object.entries(modifierMappings)) {
      if (remaining.startsWith(notation)) {
        result += replacement;
        remaining = remaining.slice(notation.length);
        matched = true;
        break;
      }
    }

    if (matched) continue;

    // Check for function keys
    const fKeyMatch = remaining.match(/^F(\d+)/i);
    if (fKeyMatch) {
      result += `F${fKeyMatch[1]}`;
      remaining = remaining.slice(fKeyMatch[0].length);
      continue;
    }

    // Check full word mappings (sorted by length, longest first)
    const sortedKeys = Object.keys(fullWordMappings).sort(
      (a, b) => b.length - a.length
    );
    for (const notation of sortedKeys) {
      if (remaining.startsWith(notation)) {
        result += fullWordMappings[notation];
        remaining = remaining.slice(notation.length);
        matched = true;
        break;
      }
    }

    if (matched) continue;

    // Add the remaining character (uppercase for display)
    if (remaining.length > 0) {
      result += remaining[0].toUpperCase();
      remaining = remaining.slice(1);
    }
  }

  return result || key;
}

/**
 * Builds a tmux bind command from a shortcut
 */
function buildBindCommand(shortcut: ParsedShortcut, currentPrefix: string): string {
  const keys = [...shortcut.keys];
  let command = shortcut.description || '';

  // Check if repeatable
  let isRepeatable = false;
  if (command.endsWith(' (repeatable)')) {
    isRepeatable = true;
    command = command.slice(0, -13);
  }

  // Determine if this is a no-prefix binding
  const hasPrefix = keys.length > 1 && keys[0] === currentPrefix;
  const bindKey = hasPrefix ? keys[1] : keys[0];

  // Convert formatted key back to tmux notation
  const tmuxKey = toTmuxNotation(bindKey);

  // Build the command
  let bindCommand = 'bind-key';

  if (!hasPrefix) {
    bindCommand += ' -n';
  }

  if (isRepeatable) {
    bindCommand += ' -r';
  }

  bindCommand += ` ${tmuxKey} ${command}`;

  return bindCommand;
}

/**
 * Converts a formatted key back to tmux notation
 */
function toTmuxNotation(key: string): string {
  const reverseMappings: Record<string, string> = {
    'Ctrl+': 'C-',
    'Alt+': 'M-',
    'Shift+': 'S-',
    'Backspace': 'BSpace',
    'Esc': 'Escape',
    '↑': 'Up',
    '↓': 'Down',
    '←': 'Left',
    '→': 'Right',
    'PageUp': 'PPage',
    'PageDown': 'NPage',
  };

  let result = key;

  for (const [formatted, notation] of Object.entries(reverseMappings)) {
    result = result.replace(formatted, notation);
  }

  // Handle single uppercase letters (convert back to lowercase for tmux)
  if (result.length === 1 && result >= 'A' && result <= 'Z') {
    result = result.toLowerCase();
  }

  return result;
}

export default tmuxParser;
