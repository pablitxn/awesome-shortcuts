import type { ConfigParser, ParsedShortcut } from '@/lib/types';

/**
 * Neovim configuration parser
 *
 * Supports:
 * - Lua: vim.keymap.set('n', '<leader>ff', ':Telescope find_files<CR>', { desc = 'Find Files' })
 * - VimScript: nnoremap <leader>w :w<CR>
 * - LazyVim/lazy.nvim style: keys = { { '<leader>e', '<cmd>Oil<CR>', desc = 'File Explorer' } }
 */

// Mode mappings for readability
const MODE_NAMES: Record<string, string> = {
  n: 'Normal',
  i: 'Insert',
  v: 'Visual',
  x: 'Visual Block',
  s: 'Select',
  o: 'Operator-pending',
  c: 'Command-line',
  t: 'Terminal',
};

// VimScript map command patterns
const VIMSCRIPT_MAP_COMMANDS = [
  'map',
  'nmap',
  'vmap',
  'imap',
  'xmap',
  'smap',
  'omap',
  'cmap',
  'tmap',
  'noremap',
  'nnoremap',
  'vnoremap',
  'inoremap',
  'xnoremap',
  'snoremap',
  'onoremap',
  'cnoremap',
  'tnoremap',
];

export const neovimParser: ConfigParser = {
  appId: 'nvim',

  detect: (filePath: string): boolean => {
    const normalizedPath = filePath.toLowerCase();

    // Check for nvim config directory patterns
    if (normalizedPath.includes('nvim') || normalizedPath.includes('.config/nvim')) {
      if (
        normalizedPath.endsWith('.lua') ||
        normalizedPath.endsWith('.vim') ||
        normalizedPath.endsWith('init.lua') ||
        normalizedPath.endsWith('init.vim')
      ) {
        return true;
      }
    }

    // Check for common neovim-specific file names
    if (
      normalizedPath.endsWith('init.lua') ||
      normalizedPath.endsWith('init.vim') ||
      normalizedPath.includes('/lua/') ||
      normalizedPath.includes('/plugin/')
    ) {
      return true;
    }

    return false;
  },

  parse: (fileContent: string): ParsedShortcut[] => {
    const shortcuts: ParsedShortcut[] = [];
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Skip comments and empty lines
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('--') || trimmedLine.startsWith('"') || trimmedLine === '') {
        continue;
      }

      // Try parsing different formats
      const luaKeymap = parseLuaKeymap(line);
      if (luaKeymap) {
        shortcuts.push({ ...luaKeymap, sourceLine: lineNumber });
        continue;
      }

      const vimscriptMap = parseVimscriptMap(line);
      if (vimscriptMap) {
        shortcuts.push({ ...vimscriptMap, sourceLine: lineNumber });
        continue;
      }

      const lazyKeys = parseLazyKeysFormat(line, lines, i);
      if (lazyKeys.length > 0) {
        for (const key of lazyKeys) {
          shortcuts.push({ ...key, sourceLine: lineNumber });
        }
      }
    }

    return shortcuts;
  },

  inject: (fileContent: string, shortcut: ParsedShortcut): string => {
    const lines = fileContent.split('\n');
    let insertIndex = lines.length;
    // Detect Lua file by checking for Lua-specific patterns
    const isLuaFile =
      fileContent.includes('vim.keymap.set') ||
      fileContent.includes('vim.api') ||
      fileContent.includes('vim.g.') ||
      fileContent.includes('vim.opt') ||
      fileContent.includes('require(') ||
      lines.some(l => l.trim().startsWith('--')); // Lua comments
    let lastKeymapLine = -1;

    // Find the last keymap line to insert after it
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('vim.keymap.set') || VIMSCRIPT_MAP_COMMANDS.some(cmd => line.includes(cmd))) {
        lastKeymapLine = i;
        break;
      }
    }

    if (lastKeymapLine >= 0) {
      insertIndex = lastKeymapLine + 1;
    }

    // Generate the keymap line
    const keysStr = formatKeysForVim(shortcut.keys);
    const command = shortcut.description || shortcut.title;
    let newLine: string;

    if (isLuaFile) {
      // Lua format
      const escapedDesc = (shortcut.title || shortcut.description || '').replace(/'/g, "\\'");
      newLine = `vim.keymap.set('n', '${keysStr}', '${command}', { desc = '${escapedDesc}' })`;
    } else {
      // VimScript format
      newLine = `nnoremap ${keysStr} ${command}`;
    }

    lines.splice(insertIndex, 0, newLine);
    return lines.join('\n');
  },
};

/**
 * Parse Lua vim.keymap.set() calls
 * Format: vim.keymap.set('n', '<leader>ff', ':Telescope find_files<CR>', { desc = 'Find Files' })
 */
function parseLuaKeymap(line: string): Omit<ParsedShortcut, 'sourceLine'> | null {
  // Match vim.keymap.set with various argument formats
  const keymapSetRegex =
    /vim\.keymap\.set\s*\(\s*['"]([^'"]+)['"],\s*['"]([^'"]+)['"],\s*(['"][^'"]*['"]|[^,\)]+)/;

  const match = line.match(keymapSetRegex);
  if (!match) return null;

  const [, mode, keys, commandPart] = match;

  // Extract the command (remove quotes if present)
  let command = commandPart.trim();
  if ((command.startsWith("'") && command.endsWith("'")) || (command.startsWith('"') && command.endsWith('"'))) {
    command = command.slice(1, -1);
  }

  // Extract description from options table
  const descMatch = line.match(/desc\s*=\s*['"]([^'"]+)['"]/);
  const description = descMatch ? descMatch[1] : undefined;

  // Build title
  const modePrefix = MODE_NAMES[mode] ? `[${MODE_NAMES[mode]}] ` : '';
  const title = description || `${modePrefix}${command.substring(0, 40)}`;

  return {
    title,
    keys: parseVimKeys(keys),
    description: description || command,
  };
}

// VimScript map options that should be skipped
const VIMSCRIPT_MAP_OPTIONS = ['silent', 'buffer', 'nowait', 'expr', 'unique', 'script'];

/**
 * Parse VimScript map commands
 * Format: nnoremap <leader>w :w<CR>
 * Format: nnoremap <silent> <leader>w :w<CR>
 */
function parseVimscriptMap(line: string): Omit<ParsedShortcut, 'sourceLine'> | null {
  // Build regex pattern for all map commands, accounting for optional flags like <silent>
  const optionsPattern = VIMSCRIPT_MAP_OPTIONS.map(opt => `<${opt}>`).join('|');
  const mapPattern = new RegExp(
    `^\\s*(${VIMSCRIPT_MAP_COMMANDS.join('|')})\\s+(?:(?:${optionsPattern})\\s+)*(<[^>]+>|\\S+)\\s+(.+)$`,
    'i'
  );

  const match = line.match(mapPattern);
  if (!match) return null;

  const [, mapCmd, keys, command] = match;

  // Skip if the captured "keys" is actually an option (shouldn't happen with the updated regex, but safety check)
  if (VIMSCRIPT_MAP_OPTIONS.some(opt => keys.toLowerCase() === `<${opt}>`)) {
    return null;
  }

  // Determine mode from command
  let mode = 'n';
  if (mapCmd.startsWith('i')) mode = 'i';
  else if (mapCmd.startsWith('v')) mode = 'v';
  else if (mapCmd.startsWith('x')) mode = 'x';
  else if (mapCmd.startsWith('s')) mode = 's';
  else if (mapCmd.startsWith('o')) mode = 'o';
  else if (mapCmd.startsWith('c')) mode = 'c';
  else if (mapCmd.startsWith('t')) mode = 't';

  // Look for comment-based description
  const commentMatch = line.match(/["']\s*(.+)\s*$/);
  const description = commentMatch ? commentMatch[1] : undefined;

  const modePrefix = MODE_NAMES[mode] ? `[${MODE_NAMES[mode]}] ` : '';
  const title = description || `${modePrefix}${command.trim().substring(0, 40)}`;

  return {
    title,
    keys: parseVimKeys(keys),
    description: description || command.trim(),
  };
}

/**
 * Parse LazyVim/lazy.nvim keys format
 * Format: keys = { { '<leader>e', '<cmd>Oil<CR>', desc = 'File Explorer' } }
 */
function parseLazyKeysFormat(
  line: string,
  allLines: string[],
  currentIndex: number
): Omit<ParsedShortcut, 'sourceLine'>[] {
  const shortcuts: Omit<ParsedShortcut, 'sourceLine'>[] = [];

  // Look for keys = { pattern
  if (!line.includes('keys') || !line.includes('=')) return shortcuts;

  // Try to find key definitions in this line or subsequent lines
  // Pattern: { '<keys>', '<command>', desc = 'description' }
  const keyDefRegex = /\{\s*['"]([^'"]+)['"],\s*['"]([^'"]+)['"](?:,\s*desc\s*=\s*['"]([^'"]+)['"])?\s*\}/g;

  // Collect lines that might contain key definitions
  let searchContent = line;
  for (let j = currentIndex + 1; j < Math.min(currentIndex + 20, allLines.length); j++) {
    searchContent += '\n' + allLines[j];
    // Stop if we hit another major section
    if (allLines[j].match(/^\s*(return|local|function|end)\s/)) break;
  }

  let keyMatch;
  while ((keyMatch = keyDefRegex.exec(searchContent)) !== null) {
    const [, keys, command, desc] = keyMatch;
    shortcuts.push({
      title: desc || command.substring(0, 40),
      keys: parseVimKeys(keys),
      description: desc || command,
    });
  }

  return shortcuts;
}

/**
 * Parse Vim key notation into an array of individual keys
 * Examples:
 * - '<leader>ff' -> ['Leader', 'f', 'f']
 * - '<C-w>' -> ['Ctrl', 'w']
 * - '<M-S-x>' -> ['Alt', 'Shift', 'x']
 * - '<Space>' -> ['Space']
 */
function parseVimKeys(keyStr: string): string[] {
  const keys: string[] = [];
  let remaining = keyStr;

  while (remaining.length > 0) {
    // Match special keys like <leader>, <C-w>, <Space>, etc.
    const specialMatch = remaining.match(/^<([^>]+)>/i);

    if (specialMatch) {
      const special = specialMatch[1].toLowerCase();
      remaining = remaining.substring(specialMatch[0].length);

      // Handle leader key
      if (special === 'leader') {
        keys.push('Leader');
        continue;
      }

      // Handle space
      if (special === 'space') {
        keys.push('Space');
        continue;
      }

      // Handle special keys
      if (special === 'cr' || special === 'enter') {
        keys.push('Enter');
        continue;
      }
      if (special === 'esc' || special === 'escape') {
        keys.push('Esc');
        continue;
      }
      if (special === 'tab') {
        keys.push('Tab');
        continue;
      }
      if (special === 'bs' || special === 'backspace') {
        keys.push('Backspace');
        continue;
      }

      // Handle modifier combinations like C-w, M-x, S-Tab, C-S-p
      const modifierMatch = special.match(/^([cmas])-(.+)$/i);
      if (modifierMatch) {
        const [, modifier, rest] = modifierMatch;
        const mod = modifier.toUpperCase();

        if (mod === 'C') keys.push('Ctrl');
        else if (mod === 'M' || mod === 'A') keys.push('Alt');
        else if (mod === 'S') keys.push('Shift');

        // Handle chained modifiers like C-S-p
        let restKey = rest;
        while (restKey) {
          const chainedMatch = restKey.match(/^([cmas])-(.+)$/i);
          if (chainedMatch) {
            const [, chainedMod, chainedRest] = chainedMatch;
            const cMod = chainedMod.toUpperCase();
            if (cMod === 'C') keys.push('Ctrl');
            else if (cMod === 'M' || cMod === 'A') keys.push('Alt');
            else if (cMod === 'S') keys.push('Shift');
            restKey = chainedRest;
          } else {
            // Capitalize the final key properly
            keys.push(capitalizeSpecialKey(restKey));
            break;
          }
        }
        continue;
      }

      // Handle function keys
      if (special.match(/^f\d+$/i)) {
        keys.push(special.toUpperCase());
        continue;
      }

      // Default: add as-is (capitalized)
      keys.push(special.charAt(0).toUpperCase() + special.slice(1));
    } else {
      // Regular character
      keys.push(remaining.charAt(0));
      remaining = remaining.substring(1);
    }
  }

  return keys;
}

/**
 * Capitalize special keys consistently
 */
function capitalizeSpecialKey(key: string): string {
  const lowerKey = key.toLowerCase();

  // Map of special keys to their proper capitalized form
  const specialKeys: Record<string, string> = {
    tab: 'Tab',
    cr: 'Enter',
    enter: 'Enter',
    esc: 'Esc',
    escape: 'Esc',
    space: 'Space',
    bs: 'Backspace',
    backspace: 'Backspace',
    up: 'Up',
    down: 'Down',
    left: 'Left',
    right: 'Right',
    home: 'Home',
    end: 'End',
    pageup: 'PageUp',
    pagedown: 'PageDown',
    insert: 'Insert',
    delete: 'Delete',
  };

  if (specialKeys[lowerKey]) {
    return specialKeys[lowerKey];
  }

  // Handle function keys (F1-F12)
  if (lowerKey.match(/^f\d+$/)) {
    return lowerKey.toUpperCase();
  }

  // For single characters or unknown keys, return as-is
  return key;
}

/**
 * Format keys array back to Vim notation for injection
 */
function formatKeysForVim(keys: string[]): string {
  const parts: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (key === 'Leader') {
      parts.push('<leader>');
    } else if (key === 'Ctrl') {
      // Combine with next key
      if (i + 1 < keys.length) {
        parts.push(`<C-${keys[i + 1].toLowerCase()}>`);
        i++;
      }
    } else if (key === 'Alt') {
      if (i + 1 < keys.length) {
        parts.push(`<M-${keys[i + 1].toLowerCase()}>`);
        i++;
      }
    } else if (key === 'Shift') {
      if (i + 1 < keys.length) {
        parts.push(`<S-${keys[i + 1].toLowerCase()}>`);
        i++;
      }
    } else if (key === 'Space') {
      parts.push('<Space>');
    } else if (key === 'Enter') {
      parts.push('<CR>');
    } else if (key === 'Esc') {
      parts.push('<Esc>');
    } else if (key === 'Tab') {
      parts.push('<Tab>');
    } else if (key === 'Backspace') {
      parts.push('<BS>');
    } else if (key.match(/^F\d+$/)) {
      parts.push(`<${key}>`);
    } else {
      parts.push(key);
    }
  }

  return parts.join('');
}

export default neovimParser;
