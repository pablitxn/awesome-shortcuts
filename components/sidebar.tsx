"use client";

import { Keyboard, Settings, Terminal, Code, FileCode } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: "all", label: "All Shortcuts", icon: <Keyboard className="h-4 w-4" /> },
  { id: "nvim", label: "Neovim", icon: <Code className="h-4 w-4" /> },
  { id: "tmux", label: "Tmux", icon: <Terminal className="h-4 w-4" /> },
  { id: "vscode", label: "VS Code", icon: <FileCode className="h-4 w-4" /> },
];

interface SidebarProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

export function Sidebar({ activeCategory, onCategoryChange }: SidebarProps) {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar-bg">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <Keyboard className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold text-foreground">
          Awesome Shortcuts
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onCategoryChange(item.id)}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeCategory === item.id
                ? "bg-primary-light text-primary"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-sidebar-border p-4">
        <button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100">
          <Settings className="h-4 w-4" />
          Settings
        </button>
        <ThemeToggle />
      </div>
    </aside>
  );
}
