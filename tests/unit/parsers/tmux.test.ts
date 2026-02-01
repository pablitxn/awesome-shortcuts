import { describe, it, expect } from 'vitest';
import { tmuxParser } from '@/lib/parsers/tmux';
import * as fs from 'fs';
import * as path from 'path';

describe('tmuxParser', () => {
  describe('detect', () => {
    it('should detect .tmux.conf files', () => {
      expect(tmuxParser.detect('/home/user/.tmux.conf')).toBe(true);
      expect(tmuxParser.detect('~/.tmux.conf')).toBe(true);
    });

    it('should detect tmux.conf without leading dot', () => {
      expect(tmuxParser.detect('/etc/tmux.conf')).toBe(true);
    });

    it('should detect tmux config files with .conf extension', () => {
      expect(tmuxParser.detect('/home/user/.config/tmux/tmux.conf')).toBe(true);
    });

    it('should not detect non-tmux files', () => {
      expect(tmuxParser.detect('/home/user/.vimrc')).toBe(false);
      expect(tmuxParser.detect('/home/user/.zshrc')).toBe(false);
      expect(tmuxParser.detect('/home/user/config.json')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse basic bind commands with default prefix', () => {
      const content = `
bind c new-window
bind d detach-client
`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0]).toMatchObject({
        title: 'new-window',
        keys: ['Ctrl+B', 'C'],
        description: 'new-window',
      });
      expect(shortcuts[1]).toMatchObject({
        title: 'detach-client',
        keys: ['Ctrl+B', 'D'],
        description: 'detach-client',
      });
    });

    it('should detect custom prefix', () => {
      const content = `
set-option -g prefix C-a
bind c new-window
`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].keys).toEqual(['Ctrl+A', 'C']);
    });

    it('should handle -n flag (no prefix)', () => {
      const content = `
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].keys).toEqual(['Alt+←']);
      expect(shortcuts[1].keys).toEqual(['Alt+→']);
    });

    it('should handle -r flag (repeatable)', () => {
      const content = `
bind -r H resize-pane -L 5
`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts).toHaveLength(1);
      expect(shortcuts[0].description).toBe('resize-pane -L 5 (repeatable)');
    });

    it('should extract comments as titles', () => {
      const content = `
# Split pane vertically
bind % split-window -h

# Navigate left pane
bind h select-pane -L
`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].title).toBe('Split pane vertically');
      expect(shortcuts[1].title).toBe('Navigate left pane');
    });

    it('should handle bind-key command', () => {
      const content = `
bind-key c new-window
bind-key -n F1 select-window -t 1
`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      expect(shortcuts[0].keys).toEqual(['Ctrl+B', 'C']);
      expect(shortcuts[1].keys).toEqual(['F1']);
    });

    it('should handle -T flag for key tables', () => {
      const content = `
bind -T copy-mode-vi v send-keys -X begin-selection
bind -T root F12 display-message "Hello"
`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts).toHaveLength(2);
      // -T root means no prefix
      expect(shortcuts[1].keys).toEqual(['F12']);
    });

    it('should track source line numbers', () => {
      const content = `# Comment
bind c new-window

bind d detach-client`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts[0].sourceLine).toBe(2);
      expect(shortcuts[1].sourceLine).toBe(4);
    });

    it('should format special keys correctly', () => {
      const content = `
bind -n C-PageUp previous-window
bind -n C-PageDown next-window
bind BSpace delete-word
bind Enter confirm-before kill-window
`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts[0].keys).toEqual(['Ctrl+PageUp']);
      expect(shortcuts[1].keys).toEqual(['Ctrl+PageDown']);
      expect(shortcuts[2].keys).toEqual(['Ctrl+B', 'Backspace']);
      expect(shortcuts[3].keys).toEqual(['Ctrl+B', 'Enter']);
    });

    it('should parse the fixture file correctly', () => {
      const fixturePath = path.join(
        __dirname,
        '../../fixtures/tmux/.tmux.conf'
      );
      const content = fs.readFileSync(fixturePath, 'utf-8');
      const shortcuts = tmuxParser.parse(content);

      // Should have multiple shortcuts
      expect(shortcuts.length).toBeGreaterThan(20);

      // Check custom prefix is detected (C-a)
      const splitVertical = shortcuts.find((s) =>
        s.title.includes('Split pane vertically')
      );
      expect(splitVertical).toBeDefined();
      expect(splitVertical?.keys[0]).toBe('Ctrl+A');

      // Check no-prefix bindings
      const noPrefix = shortcuts.filter((s) => !s.keys.includes('Ctrl+A'));
      expect(noPrefix.length).toBeGreaterThan(0);
    });
  });

  describe('inject', () => {
    it('should inject a new binding at the end of bindings section', () => {
      const content = `
set-option -g prefix C-a
bind c new-window
bind d detach-client
`;
      const newShortcut = {
        title: 'Reload config',
        keys: ['Ctrl+A', 'R'],
        description: 'source-file ~/.tmux.conf',
      };

      const result = tmuxParser.inject(content, newShortcut);

      expect(result).toContain('# Reload config');
      expect(result).toContain('bind-key r source-file ~/.tmux.conf');
    });

    it('should inject no-prefix bindings correctly', () => {
      const content = `
bind c new-window
`;
      const newShortcut = {
        title: 'Quick window switch',
        keys: ['F5'],
        description: 'select-window -t 5',
      };

      const result = tmuxParser.inject(content, newShortcut);

      expect(result).toContain('bind-key -n F5 select-window -t 5');
    });

    it('should preserve existing formatting', () => {
      const content = `# Header comment
set-option -g prefix C-a

# Window management
bind c new-window
`;
      const newShortcut = {
        title: 'Kill window',
        keys: ['Ctrl+A', 'X'],
        description: 'kill-window',
      };

      const result = tmuxParser.inject(content, newShortcut);
      const lines = result.split('\n');

      // Original content should be preserved
      expect(lines[0]).toBe('# Header comment');
      expect(result).toContain('# Window management');
    });

    it('should handle empty content', () => {
      const content = '';
      const newShortcut = {
        title: 'New window',
        keys: ['Ctrl+B', 'C'],
        description: 'new-window',
      };

      const result = tmuxParser.inject(content, newShortcut);

      expect(result).toContain('# New window');
      expect(result).toContain('bind-key c new-window');
    });

    it('should not add comment when title matches description', () => {
      const content = 'bind c new-window';
      const newShortcut = {
        title: 'kill-pane',
        keys: ['Ctrl+B', 'X'],
        description: 'kill-pane',
      };

      const result = tmuxParser.inject(content, newShortcut);
      const lines = result.split('\n').filter((l) => l.trim());

      // Should not have a duplicate comment
      const commentLines = lines.filter((l) => l.startsWith('# kill-pane'));
      expect(commentLines.length).toBe(0);
    });

    it('should handle repeatable bindings', () => {
      const content = 'bind c new-window';
      const newShortcut = {
        title: 'Resize left',
        keys: ['Ctrl+B', 'H'],
        description: 'resize-pane -L 5 (repeatable)',
      };

      const result = tmuxParser.inject(content, newShortcut);

      expect(result).toContain('bind-key -r h resize-pane -L 5');
    });
  });

  describe('key formatting', () => {
    it('should format Ctrl combinations', () => {
      const content = 'bind -n C-a send-prefix';
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts[0].keys).toEqual(['Ctrl+A']);
    });

    it('should format Alt combinations', () => {
      const content = 'bind -n M-h select-pane -L';
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts[0].keys).toEqual(['Alt+H']);
    });

    it('should format arrow keys', () => {
      const content = `
bind -n Up select-pane -U
bind -n Down select-pane -D
bind -n Left select-pane -L
bind -n Right select-pane -R
`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts[0].keys).toEqual(['↑']);
      expect(shortcuts[1].keys).toEqual(['↓']);
      expect(shortcuts[2].keys).toEqual(['←']);
      expect(shortcuts[3].keys).toEqual(['→']);
    });

    it('should format function keys', () => {
      const content = `
bind -n F1 select-window -t 1
bind -n F12 display-message "Hello"
`;
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts[0].keys).toEqual(['F1']);
      expect(shortcuts[1].keys).toEqual(['F12']);
    });

    it('should format combined modifiers', () => {
      const content = 'bind -n C-M-x kill-pane';
      const shortcuts = tmuxParser.parse(content);

      expect(shortcuts[0].keys).toEqual(['Ctrl+Alt+X']);
    });
  });
});
