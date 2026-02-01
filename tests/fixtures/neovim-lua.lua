-- Sample Neovim Lua configuration for testing
-- This file contains various keymap formats

-- Leader key setup
vim.g.mapleader = " "
vim.g.maplocalleader = "\\"

-- Basic vim.keymap.set usage
vim.keymap.set('n', '<leader>w', ':w<CR>', { desc = 'Save file' })
vim.keymap.set('n', '<leader>q', ':q<CR>', { desc = 'Quit' })
vim.keymap.set('n', '<leader>ff', ':Telescope find_files<CR>', { desc = 'Find Files' })

-- Without description
vim.keymap.set('n', '<leader>e', ':NvimTreeToggle<CR>')

-- With modifier keys
vim.keymap.set('n', '<C-w>', ':close<CR>', { desc = 'Close Window' })
vim.keymap.set('n', '<M-j>', ':m .+1<CR>==', { desc = 'Move line down' })
vim.keymap.set('n', '<S-Tab>', ':bprev<CR>', { desc = 'Previous buffer' })

-- Chained modifiers
vim.keymap.set('n', '<C-S-p>', ':Telescope commands<CR>', { desc = 'Command palette' })

-- Different modes
vim.keymap.set('i', 'jk', '<Esc>', { desc = 'Exit insert mode' })
vim.keymap.set('v', '<leader>y', '"+y', { desc = 'Copy to clipboard' })
vim.keymap.set('x', '<leader>p', '"_dP', { desc = 'Paste without yanking' })

-- Function keys
vim.keymap.set('n', '<F5>', ':lua require("dap").continue()<CR>', { desc = 'Debug continue' })
vim.keymap.set('n', '<F10>', ':lua require("dap").step_over()<CR>', { desc = 'Debug step over' })

-- Special keys
vim.keymap.set('n', '<Space>h', ':nohlsearch<CR>', { desc = 'Clear highlights' })
vim.keymap.set('n', '<BS>', ':bd<CR>', { desc = 'Delete buffer' })
vim.keymap.set('n', '<Tab>', ':bnext<CR>', { desc = 'Next buffer' })

-- Single character bindings
vim.keymap.set('n', 'K', ':lua vim.lsp.buf.hover()<CR>', { desc = 'LSP Hover' })
vim.keymap.set('n', 'gd', ':lua vim.lsp.buf.definition()<CR>', { desc = 'Go to definition' })
