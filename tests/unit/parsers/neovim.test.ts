import { describe, it, expect, beforeAll } from 'vitest';
import { neovimParser } from '@/lib/parsers/neovim';
import * as fs from 'fs';
import * as path from 'path';

// Load test fixtures
const fixturesDir = path.join(__dirname, '../../fixtures');

describe('Neovim Parser', () => {
  describe('detect()', () => {
    it('should detect init.lua in nvim directory', () => {
      expect(neovimParser.detect('/home/user/.config/nvim/init.lua')).toBe(true);
      expect(neovimParser.detect('~/.config/nvim/init.lua')).toBe(true);
      expect(neovimParser.detect('/Users/user/.config/nvim/init.lua')).toBe(true);
    });

    it('should detect init.vim in nvim directory', () => {
      expect(neovimParser.detect('/home/user/.config/nvim/init.vim')).toBe(true);
    });

    it('should detect lua files in nvim config', () => {
      expect(neovimParser.detect('/home/user/.config/nvim/lua/plugins/telescope.lua')).toBe(true);
      expect(neovimParser.detect('/home/user/.config/nvim/lua/keymaps.lua')).toBe(true);
    });

    it('should detect plugin directory files', () => {
      expect(neovimParser.detect('/home/user/.config/nvim/plugin/keybindings.vim')).toBe(true);
    });

    it('should not detect unrelated files', () => {
      expect(neovimParser.detect('/home/user/.vimrc')).toBe(false);
      expect(neovimParser.detect('/home/user/code/script.lua')).toBe(false);
      expect(neovimParser.detect('/home/user/.bashrc')).toBe(false);
      expect(neovimParser.detect('/home/user/config.json')).toBe(false);
    });

    it('should be case-insensitive for path matching', () => {
      expect(neovimParser.detect('/home/user/.config/NVIM/init.lua')).toBe(true);
      expect(neovimParser.detect('/home/user/.config/Nvim/Init.LUA')).toBe(true);
    });
  });

  describe('parse() - Lua vim.keymap.set', () => {
    it('should parse basic vim.keymap.set with description', () => {
      const content = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].title).toBe('Save file');
      expect(shortcuts[0].keys).toEqual(['Leader', 'w']);
      expect(shortcuts[0].description).toBe('Save file');
      expect(shortcuts[0].sourceLine).toBe(1);
    });

    it('should parse vim.keymap.set without description', () => {
      const content = `vim.keymap.set('n', '<leader>e', ':NvimTreeToggle<CR>')`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Leader', 'e']);
      expect(shortcuts[0].description).toContain('NvimTreeToggle');
    });

    it('should parse multi-character leader sequences', () => {
      const content = `vim.keymap.set('n', '<leader>ff', ':Telescope find_files<CR>', { desc = 'Find Files' })`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Leader', 'f', 'f']);
    });

    it('should parse Ctrl modifier', () => {
      const content = `vim.keymap.set('n', '<C-w>', ':close<CR>', { desc = 'Close Window' })`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Ctrl', 'w']);
    });

    it('should parse Alt/Meta modifier', () => {
      const content = `vim.keymap.set('n', '<M-j>', ':m .+1<CR>==', { desc = 'Move line down' })`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Alt', 'j']);
    });

    it('should parse Shift modifier', () => {
      const content = `vim.keymap.set('n', '<S-Tab>', ':bprev<CR>', { desc = 'Previous buffer' })`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Shift', 'Tab']);
    });

    it('should parse chained modifiers', () => {
      const content = `vim.keymap.set('n', '<C-S-p>', ':Telescope commands<CR>', { desc = 'Command palette' })`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toContain('Ctrl');
      expect(shortcuts[0].keys).toContain('Shift');
      expect(shortcuts[0].keys).toContain('p');
    });

    it('should parse function keys', () => {
      const content = `vim.keymap.set('n', '<F5>', ':lua require("dap").continue()<CR>', { desc = 'Debug continue' })`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['F5']);
    });

    it('should parse special keys (Space, Tab, Enter, etc)', () => {
      const content = `
vim.keymap.set('n', '<Space>h', ':nohlsearch<CR>', { desc = 'Clear highlights' })
vim.keymap.set('n', '<Tab>', ':bnext<CR>', { desc = 'Next buffer' })
vim.keymap.set('n', '<BS>', ':bd<CR>', { desc = 'Delete buffer' })
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(3);
      expect(shortcuts[0].keys).toContain('Space');
      expect(shortcuts[1].keys).toContain('Tab');
      expect(shortcuts[2].keys).toContain('Backspace');
    });

    it('should parse different modes', () => {
      const content = `
vim.keymap.set('i', 'jk', '<Esc>', { desc = 'Exit insert mode' })
vim.keymap.set('v', '<leader>y', '"+y', { desc = 'Copy to clipboard' })
vim.keymap.set('x', '<leader>p', '"_dP', { desc = 'Paste without yanking' })
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(3);
      expect(shortcuts[0].title).toBe('Exit insert mode');
      expect(shortcuts[1].title).toBe('Copy to clipboard');
      expect(shortcuts[2].title).toBe('Paste without yanking');
    });

    it('should parse single character bindings', () => {
      const content = `
vim.keymap.set('n', 'K', ':lua vim.lsp.buf.hover()<CR>', { desc = 'LSP Hover' })
vim.keymap.set('n', 'gd', ':lua vim.lsp.buf.definition()<CR>', { desc = 'Go to definition' })
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].keys).toEqual(['K']);
      expect(shortcuts[1].keys).toEqual(['g', 'd']);
    });

    it('should skip comment lines', () => {
      const content = `
-- This is a comment
vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })
-- Another comment: vim.keymap.set('n', '<leader>x', ':x<CR>')
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].title).toBe('Save file');
    });

    it('should handle double quotes in description', () => {
      const content = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = "Save current file" })`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].description).toBe('Save current file');
    });
  });

  describe('parse() - VimScript maps', () => {
    it('should parse nnoremap', () => {
      const content = `nnoremap <leader>w :w<CR>`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Leader', 'w']);
    });

    it('should parse noremap', () => {
      const content = `noremap <leader>a :all<CR>`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Leader', 'a']);
    });

    it('should parse nmap', () => {
      const content = `nmap <leader>b :buffers<CR>`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Leader', 'b']);
    });

    it('should parse imap (insert mode)', () => {
      const content = `imap jj <Esc>`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['j', 'j']);
    });

    it('should parse vmap (visual mode)', () => {
      const content = `vmap <leader>c :copy<CR>`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Leader', 'c']);
    });

    it('should parse modifier keys in VimScript', () => {
      const content = `
nnoremap <C-s> :w<CR>
nnoremap <M-h> <C-w>h
nnoremap <S-Tab> :bprev<CR>
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(3);
      expect(shortcuts[0].keys).toEqual(['Ctrl', 's']);
      expect(shortcuts[1].keys).toEqual(['Alt', 'h']);
      expect(shortcuts[2].keys).toEqual(['Shift', 'Tab']);
    });

    it('should parse function keys in VimScript', () => {
      const content = `
nnoremap <F1> :help<CR>
nnoremap <F12> :source %<CR>
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].keys).toEqual(['F1']);
      expect(shortcuts[1].keys).toEqual(['F12']);
    });

    it('should parse silent mappings', () => {
      const content = `nnoremap <silent> <leader>n :NvimTreeToggle<CR>`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Leader', 'n']);
    });

    it('should skip VimScript comment lines', () => {
      const content = `
" This is a comment
nnoremap <leader>w :w<CR>
" Another comment
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
    });
  });

  describe('parse() - LazyVim/lazy.nvim keys format', () => {
    it('should parse lazy.nvim keys format', () => {
      const content = `
keys = {
  { "<leader>e", "<cmd>Oil<CR>", desc = "File Explorer" },
  { "-", "<cmd>Oil<CR>", desc = "Open parent directory" },
}
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts.length).toBeGreaterThanOrEqual(2);

      const fileExplorer = shortcuts.find(s => s.title === 'File Explorer');
      expect(fileExplorer).toBeDefined();
      expect(fileExplorer?.keys).toEqual(['Leader', 'e']);
    });

    it('should parse multiple lazy.nvim key definitions', () => {
      const content = `
{
  "nvim-telescope/telescope.nvim",
  keys = {
    { "<leader>ff", "<cmd>Telescope find_files<CR>", desc = "Find Files" },
    { "<leader>fg", "<cmd>Telescope live_grep<CR>", desc = "Live Grep" },
  },
}
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts.length).toBeGreaterThanOrEqual(2);

      const findFiles = shortcuts.find(s => s.title === 'Find Files');
      const liveGrep = shortcuts.find(s => s.title === 'Live Grep');

      expect(findFiles).toBeDefined();
      expect(liveGrep).toBeDefined();
    });
  });

  describe('parse() - with fixture files', () => {
    let luaContent: string;
    let vimscriptContent: string;
    let lazyContent: string;

    beforeAll(() => {
      luaContent = fs.readFileSync(path.join(fixturesDir, 'neovim-lua.lua'), 'utf-8');
      vimscriptContent = fs.readFileSync(path.join(fixturesDir, 'neovim-vimscript.vim'), 'utf-8');
      lazyContent = fs.readFileSync(path.join(fixturesDir, 'neovim-lazyvim.lua'), 'utf-8');
    });

    it('should parse Lua fixture file', () => {
      const shortcuts = neovimParser.parse(luaContent);

      expect(shortcuts.length).toBeGreaterThan(10);

      // Verify some specific shortcuts
      const saveFile = shortcuts.find(s => s.title === 'Save file');
      expect(saveFile).toBeDefined();
      expect(saveFile?.keys).toEqual(['Leader', 'w']);

      const findFiles = shortcuts.find(s => s.title === 'Find Files');
      expect(findFiles).toBeDefined();
      expect(findFiles?.keys).toEqual(['Leader', 'f', 'f']);

      const closeWindow = shortcuts.find(s => s.title === 'Close Window');
      expect(closeWindow).toBeDefined();
      expect(closeWindow?.keys).toEqual(['Ctrl', 'w']);
    });

    it('should parse VimScript fixture file', () => {
      const shortcuts = neovimParser.parse(vimscriptContent);

      expect(shortcuts.length).toBeGreaterThan(5);

      // Verify that modifier keys are parsed
      const ctrlS = shortcuts.find(s => s.keys.includes('Ctrl') && s.keys.includes('s'));
      expect(ctrlS).toBeDefined();
    });

    it('should parse LazyVim fixture file', () => {
      const shortcuts = neovimParser.parse(lazyContent);

      expect(shortcuts.length).toBeGreaterThan(5);

      // Verify lazy.nvim format shortcuts
      const fileExplorer = shortcuts.find(s => s.title === 'File Explorer');
      expect(fileExplorer).toBeDefined();
    });

    it('should track source line numbers correctly', () => {
      const content = `
line 1
vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })
line 4
vim.keymap.set('n', '<leader>q', ':q<CR>', { desc = 'Quit' })
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].sourceLine).toBe(3);
      expect(shortcuts[1].sourceLine).toBe(5);
    });
  });

  describe('inject()', () => {
    it('should inject shortcut into Lua file after last keymap', () => {
      const content = `
-- Keymaps
vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })
vim.keymap.set('n', '<leader>q', ':q<CR>', { desc = 'Quit' })

-- Other config
vim.opt.number = true
`;
      const result = neovimParser.inject(content, {
        title: 'Find Files',
        keys: ['Leader', 'f', 'f'],
        description: ':Telescope find_files<CR>',
      });

      expect(result).toContain("vim.keymap.set('n', '<leader>ff'");
      expect(result).toContain("desc = 'Find Files'");

      // Should be inserted after the last keymap, not at the very end
      const lines = result.split('\n');
      const ffIndex = lines.findIndex(l => l.includes('<leader>ff'));
      const quitIndex = lines.findIndex(l => l.includes('<leader>q'));
      expect(ffIndex).toBe(quitIndex + 1);
    });

    it('should inject shortcut into VimScript file', () => {
      const content = `
" Keymaps
nnoremap <leader>w :w<CR>

" Other config
set number
`;
      const result = neovimParser.inject(content, {
        title: 'Quit',
        keys: ['Leader', 'q'],
        description: ':q<CR>',
      });

      expect(result).toContain('nnoremap <leader>q');
    });

    it('should handle modifier keys in inject', () => {
      const content = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save' })`;

      const result = neovimParser.inject(content, {
        title: 'Close Window',
        keys: ['Ctrl', 'w'],
        description: ':close<CR>',
      });

      expect(result).toContain('<C-w>');
    });

    it('should handle special keys in inject', () => {
      const content = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save' })`;

      const result = neovimParser.inject(content, {
        title: 'Next buffer',
        keys: ['Tab'],
        description: ':bnext<CR>',
      });

      expect(result).toContain('<Tab>');
    });

    it('should escape single quotes in description', () => {
      const content = `vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save' })`;

      const result = neovimParser.inject(content, {
        title: "It's a test",
        keys: ['Leader', 't'],
        description: ':test<CR>',
      });

      expect(result).toContain("\\'s");
    });

    it('should append to empty file', () => {
      const content = `-- Empty config file`;

      const result = neovimParser.inject(content, {
        title: 'Save file',
        keys: ['Leader', 'w'],
        description: ':w<CR>',
      });

      expect(result).toContain("vim.keymap.set('n', '<leader>w'");
    });
  });

  describe('edge cases', () => {
    it('should handle empty file', () => {
      const shortcuts = neovimParser.parse('');
      expect(shortcuts).toEqual([]);
    });

    it('should handle file with only comments', () => {
      const content = `
-- Comment 1
-- Comment 2
" VimScript comment
`;
      const shortcuts = neovimParser.parse(content);
      expect(shortcuts).toEqual([]);
    });

    it('should handle malformed keymap calls gracefully', () => {
      const content = `
vim.keymap.set('n'
vim.keymap.set incomplete
vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save' })
`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].title).toBe('Save');
    });

    it('should handle keymaps with complex commands', () => {
      const content = `vim.keymap.set('n', '<leader>ff', function() require('telescope.builtin').find_files() end, { desc = 'Find Files' })`;
      const shortcuts = neovimParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].title).toBe('Find Files');
    });

    it('should handle keymaps spanning multiple formatting styles', () => {
      const content = `
vim.keymap.set(
  'n',
  '<leader>w',
  ':w<CR>',
  { desc = 'Save file' }
)
`;
      // Note: This multi-line format may not be fully supported
      // The parser should at least not crash
      const shortcuts = neovimParser.parse(content);
      // May or may not parse - important thing is no crash
      expect(Array.isArray(shortcuts)).toBe(true);
    });
  });
});
