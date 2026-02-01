import { runMigrations } from '../lib/db/migrations';
import { configPaths, shortcuts, userPreferences } from '../lib/db/queries';

function seed(): void {
  console.log('Running migrations...');
  runMigrations();
  console.log('Migrations complete.');

  console.log('Seeding database...');

  // Create default config paths
  const defaultPaths = [
    { app_id: 'nvim', path: '~/.config/nvim' },
    { app_id: 'tmux', path: '~/.tmux.conf' },
    { app_id: 'zsh', path: '~/.zshrc' },
    { app_id: 'vscode', path: '~/.config/Code/User/keybindings.json' },
  ];

  for (const config of defaultPaths) {
    try {
      configPaths.create(config.app_id, config.path);
      console.log(`  Created config path: ${config.app_id}`);
    } catch {
      console.log(`  Config path already exists: ${config.app_id}`);
    }
  }

  // Create sample shortcuts for development
  const sampleShortcuts = [
    {
      app_id: 'nvim',
      title: 'Save file',
      keys: ['<leader>', 'w'],
      description: 'Save the current buffer',
      source_file: '~/.config/nvim/init.lua',
      source_line: 42,
    },
    {
      app_id: 'nvim',
      title: 'Find files',
      keys: ['<leader>', 'f', 'f'],
      description: 'Open Telescope file finder',
      source_file: '~/.config/nvim/lua/plugins/telescope.lua',
      source_line: 15,
    },
    {
      app_id: 'nvim',
      title: 'Live grep',
      keys: ['<leader>', 'f', 'g'],
      description: 'Search for text in files',
      source_file: '~/.config/nvim/lua/plugins/telescope.lua',
      source_line: 20,
    },
    {
      app_id: 'tmux',
      title: 'Split horizontal',
      keys: ['prefix', '-'],
      description: 'Split pane horizontally',
      source_file: '~/.tmux.conf',
      source_line: 10,
    },
    {
      app_id: 'tmux',
      title: 'Split vertical',
      keys: ['prefix', '|'],
      description: 'Split pane vertically',
      source_file: '~/.tmux.conf',
      source_line: 11,
    },
    {
      app_id: 'tmux',
      title: 'New window',
      keys: ['prefix', 'c'],
      description: 'Create a new window',
      source_file: '~/.tmux.conf',
      source_line: 15,
    },
    {
      app_id: 'zsh',
      title: 'Edit command line',
      keys: ['Ctrl', 'x', 'e'],
      description: 'Open current command in $EDITOR',
      source_file: '~/.zshrc',
      source_line: 50,
    },
    {
      app_id: 'zsh',
      title: 'Clear screen',
      keys: ['Ctrl', 'l'],
      description: 'Clear the terminal screen',
      source_file: '~/.zshrc',
      source_line: 55,
    },
    {
      app_id: 'vscode',
      title: 'Command Palette',
      keys: ['Cmd', 'Shift', 'P'],
      description: 'Open command palette',
      source_file: '~/.config/Code/User/keybindings.json',
      source_line: 5,
    },
    {
      app_id: 'vscode',
      title: 'Quick Open',
      keys: ['Cmd', 'P'],
      description: 'Quick open files',
      source_file: '~/.config/Code/User/keybindings.json',
      source_line: 10,
    },
  ];

  try {
    shortcuts.bulkCreate(sampleShortcuts);
    console.log(`  Created ${sampleShortcuts.length} sample shortcuts`);
  } catch (error) {
    console.log('  Sample shortcuts may already exist');
  }

  // Set default preferences
  userPreferences.set('theme', 'system');
  userPreferences.set('llm_provider', 'openai');
  userPreferences.set('llm_model', 'gpt-4');
  console.log('  Set default preferences');

  console.log('Seed complete!');
}

seed();
