"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { ShortcutsTable } from "@/components/shortcuts-table";
import { AIChatWidget, Message } from "@/components/ai-chat-widget";
import { SettingsModal } from "@/components/settings-modal";
import type { Shortcut } from "@/lib/types";

// Category info for header
const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  all: { label: "All Shortcuts", color: "from-purple-500 to-pink-500" },
  nvim: { label: "Neovim", color: "from-emerald-500 to-green-500" },
  tmux: { label: "Tmux", color: "from-cyan-500 to-teal-500" },
  zsh: { label: "Zsh", color: "from-orange-500 to-amber-500" },
  vscode: { label: "VS Code", color: "from-blue-500 to-indigo-500" },
};

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch shortcuts from API
  const fetchShortcuts = useCallback(async () => {
    try {
      const res = await fetch('/api/shortcuts');
      const data = await res.json();
      if (data.success && data.data?.shortcuts) {
        setShortcuts(data.data.shortcuts);
      }
    } catch (error) {
      console.error('Failed to fetch shortcuts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load shortcuts on mount
  useEffect(() => {
    fetchShortcuts();
  }, [fetchShortcuts]);

  // Refresh handler for settings modal
  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchShortcuts();
  };

  const categoryInfo = CATEGORY_INFO[activeCategory] || CATEGORY_INFO.nvim;

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
            isLoading={isLoading}
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
          console.log("Settings saved:", { configPaths, llmConfig });
          // Refresh shortcuts after saving config paths
          handleRefresh();
        }}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
