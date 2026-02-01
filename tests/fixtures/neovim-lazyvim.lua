-- Sample LazyVim/lazy.nvim plugin configuration for testing
-- This demonstrates the keys = {} format used by lazy.nvim

return {
  -- Oil.nvim plugin
  {
    "stevearc/oil.nvim",
    opts = {},
    keys = {
      { "<leader>e", "<cmd>Oil<CR>", desc = "File Explorer" },
      { "-", "<cmd>Oil<CR>", desc = "Open parent directory" },
    },
  },

  -- Telescope plugin
  {
    "nvim-telescope/telescope.nvim",
    keys = {
      { "<leader>ff", "<cmd>Telescope find_files<CR>", desc = "Find Files" },
      { "<leader>fg", "<cmd>Telescope live_grep<CR>", desc = "Live Grep" },
      { "<leader>fb", "<cmd>Telescope buffers<CR>", desc = "Buffers" },
      { "<leader>fh", "<cmd>Telescope help_tags<CR>", desc = "Help Tags" },
      { "<leader><space>", "<cmd>Telescope find_files<CR>", desc = "Find Files (alt)" },
    },
  },

  -- LSP-related keymaps
  {
    "neovim/nvim-lspconfig",
    keys = {
      { "gd", "<cmd>lua vim.lsp.buf.definition()<CR>", desc = "Go to Definition" },
      { "gr", "<cmd>lua vim.lsp.buf.references()<CR>", desc = "References" },
      { "K", "<cmd>lua vim.lsp.buf.hover()<CR>", desc = "Hover" },
      { "<leader>ca", "<cmd>lua vim.lsp.buf.code_action()<CR>", desc = "Code Action" },
      { "<leader>rn", "<cmd>lua vim.lsp.buf.rename()<CR>", desc = "Rename" },
    },
  },

  -- Git integration
  {
    "lewis6991/gitsigns.nvim",
    keys = {
      { "]c", "<cmd>Gitsigns next_hunk<CR>", desc = "Next Hunk" },
      { "[c", "<cmd>Gitsigns prev_hunk<CR>", desc = "Previous Hunk" },
      { "<leader>hs", "<cmd>Gitsigns stage_hunk<CR>", desc = "Stage Hunk" },
      { "<leader>hr", "<cmd>Gitsigns reset_hunk<CR>", desc = "Reset Hunk" },
    },
  },
}
