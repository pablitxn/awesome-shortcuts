"use client";

import { useState } from "react";
import { Search, Command } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { ShortcutsTable } from "@/components/shortcuts-table";
import { AIChatWidget, Message } from "@/components/ai-chat-widget";
import { SettingsModal } from "@/components/settings-modal";
import type { Shortcut } from "@/lib/types";

// Mock data for development/testing
const MOCK_SHORTCUTS: Shortcut[] = [
  {
    id: 1,
    app_id: "nvim",
    title: "Find Files",
    keys: ["Leader", "f", "f"],
    description: "Open Telescope file finder",
    source_file: "~/.config/nvim/init.lua",
    source_line: 42,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    app_id: "nvim",
    title: "Save File",
    keys: ["Leader", "w"],
    description: "Save the current buffer",
    source_file: "~/.config/nvim/init.lua",
    source_line: 45,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 3,
    app_id: "nvim",
    title: "Close Buffer",
    keys: ["Leader", "b", "d"],
    description: "Close the current buffer",
    source_file: "~/.config/nvim/init.lua",
    source_line: 48,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 4,
    app_id: "nvim",
    title: "Split Vertical",
    keys: ["Leader", "v"],
    description: "Split window vertically",
    source_file: "~/.config/nvim/init.lua",
    source_line: 51,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 5,
    app_id: "tmux",
    title: "Split Pane Horizontal",
    keys: ["Ctrl", "b", "%"],
    description: "Split the current pane horizontally",
    source_file: "~/.tmux.conf",
    source_line: 12,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 6,
    app_id: "tmux",
    title: "Split Pane Vertical",
    keys: ["Ctrl", "b", '"'],
    description: "Split the current pane vertically",
    source_file: "~/.tmux.conf",
    source_line: 13,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 7,
    app_id: "tmux",
    title: "Navigate Left",
    keys: ["Ctrl", "b", "h"],
    description: "Move to the pane on the left",
    source_file: "~/.tmux.conf",
    source_line: 20,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 8,
    app_id: "tmux",
    title: "New Window",
    keys: ["Ctrl", "b", "c"],
    description: "Create a new tmux window",
    source_file: "~/.tmux.conf",
    source_line: 25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 9,
    app_id: "vscode",
    title: "Command Palette",
    keys: ["Cmd", "Shift", "P"],
    description: "Open the command palette",
    source_file: "~/Library/Application Support/Code/User/keybindings.json",
    source_line: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 10,
    app_id: "vscode",
    title: "Quick Open",
    keys: ["Cmd", "P"],
    description: "Quickly open files by name",
    source_file: "~/Library/Application Support/Code/User/keybindings.json",
    source_line: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 11,
    app_id: "vscode",
    title: "Toggle Sidebar",
    keys: ["Cmd", "B"],
    description: "Show or hide the sidebar",
    source_file: "~/Library/Application Support/Code/User/keybindings.json",
    source_line: 15,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 12,
    app_id: "vscode",
    title: "Go to Definition",
    keys: ["F12"],
    description: "Navigate to the definition of a symbol",
    source_file: "~/Library/Application Support/Code/User/keybindings.json",
    source_line: 20,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Category info for header
const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  nvim: { label: "Neovim", color: "from-emerald-500 to-green-500" },
  tmux: { label: "Tmux", color: "from-cyan-500 to-teal-500" },
  vscode: { label: "VS Code", color: "from-blue-500 to-indigo-500" },
};

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("nvim");
  const [searchQuery, setSearchQuery] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const shortcuts = MOCK_SHORTCUTS;
  const categoryInfo = CATEGORY_INFO[activeCategory] || CATEGORY_INFO.all;

  const handleSendMessage = (content: string) => {
    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, userMessage]);

    setIsTyping(true);
    setTimeout(() => {
      const botMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content:
          "I understand you want help with shortcuts. AI integration is coming soon! For now, you can browse your shortcuts using the sidebar.",
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Content Area */}
        <div className="flex-1 overflow-auto p-8">
          <ShortcutsTable
            shortcuts={shortcuts}
            selectedCategory={activeCategory}
            searchQuery={searchQuery}
          />
        </div>
      </main>

      {/* AI Chat Widget */}
      <AIChatWidget
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        isTyping={isTyping}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={(configPaths, llmConfig) => {
          console.log("Saving settings:", { configPaths, llmConfig });
        }}
      />
    </div>
  );
}
