"use client";

import { Keyboard, Settings, Terminal, Code, FileCode, Layers } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const navItems: NavItem[] = [
  {
    id: "nvim",
    label: "Neovim",
    icon: <Code className="h-4 w-4" />,
    color: "from-emerald-500 to-green-500"
  },
  {
    id: "tmux",
    label: "Tmux",
    icon: <Terminal className="h-4 w-4" />,
    color: "from-cyan-500 to-teal-500"
  },
  {
    id: "vscode",
    label: "VS Code",
    icon: <FileCode className="h-4 w-4" />,
    color: "from-blue-500 to-indigo-500"
  },
];

interface SidebarProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  onSettingsClick: () => void;
}

export function Sidebar({ activeCategory, onCategoryChange, onSettingsClick }: SidebarProps) {
  return (
    <aside className="flex h-screen w-72 flex-col border-r border-sidebar-border bg-sidebar-bg backdrop-blur-xl">
      {/* Logo */}
      <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 blur-lg opacity-60" />
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg">
            <Keyboard className="h-6 w-6 text-white" />
          </div>
        </div>
        <div>
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Awesome
          </span>
          <span className="block text-sm text-gray-500 dark:text-gray-400 -mt-0.5">
            Shortcuts
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
          Categories
        </p>
        {navItems.map((item) => {
          const isActive = activeCategory === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onCategoryChange(item.id)}
              className={`
                group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium
                transition-all duration-200
                ${isActive
                  ? "bg-card-bg border border-card-border text-foreground"
                  : "text-gray-500 hover:text-foreground hover:bg-card-bg/50"
                }
              `}
            >
              {/* Active indicator */}
              {isActive && (
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full bg-gradient-to-b ${item.color}`} />
              )}

              {/* Icon with gradient background when active */}
              <div className={`
                flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200
                ${isActive
                  ? `bg-gradient-to-br ${item.color} text-white`
                  : "bg-card-bg text-gray-500 group-hover:text-foreground"
                }
              `}>
                {item.icon}
              </div>

              <span className="flex-1 text-left">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Shortcuts Tips */}
      <div className="border-t border-sidebar-border p-4">
        <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
          Quick Tips
        </p>
        <div className="space-y-2 px-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <kbd className="inline-flex h-5 items-center justify-center px-1.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 font-mono text-[10px]">⌘</kbd>
            <kbd className="inline-flex h-5 items-center justify-center px-1.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 font-mono text-[10px]">K</kbd>
            <span className="text-gray-400">Search</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <kbd className="inline-flex h-5 items-center justify-center px-1.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 font-mono text-[10px]">↑</kbd>
            <kbd className="inline-flex h-5 items-center justify-center px-1.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 font-mono text-[10px]">↓</kbd>
            <span className="text-gray-400">Navigate</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <button
          onClick={onSettingsClick}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-500 transition-all duration-300 hover:bg-white/50 dark:hover:bg-gray-800/50 hover:text-foreground group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 transition-all group-hover:bg-gray-200 dark:group-hover:bg-gray-700">
            <Settings className="h-4 w-4 transition-transform group-hover:rotate-90 duration-500" />
          </div>
          <span>Settings</span>
        </button>

        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs text-gray-400 dark:text-gray-500">Theme</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
