"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { MessageSquare, X, Send, Bot, User, Sparkles } from "lucide-react";

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface AIChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isTyping?: boolean;
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500">
        <Bot className="h-4 w-4 text-white" />
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none bg-gray-100 dark:bg-gray-800 px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-pink-400" />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser
            ? "bg-gradient-to-br from-indigo-500 to-purple-500"
            : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 dark:from-indigo-500/30 dark:to-purple-500/30"
          }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
        )}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isUser
            ? "rounded-tr-none bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25"
            : "rounded-tl-none bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          }`}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        <time
          className={`mt-1.5 block text-[10px] ${isUser ? "text-white/60" : "text-gray-400"
            }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
    </div>
  );
}

export function AIChatWidget({
  isOpen,
  onToggle,
  messages,
  onSendMessage,
  isTyping = false,
}: AIChatWidgetProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onSendMessage(trimmed);
      setInputValue("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Window */}
      <div
        className={`
          absolute bottom-20 right-0 
          flex h-[520px] w-[400px] flex-col 
          overflow-hidden rounded-2xl 
          border border-white/20 dark:border-gray-700/50
          bg-white/80 dark:bg-gray-900/80
          backdrop-blur-xl
          shadow-2xl shadow-indigo-500/10
          transition-all duration-500 ease-out
          ${isOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-8 scale-95 opacity-0"
          }
        `}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 blur opacity-50" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            </div>
            <div>
              <span className="font-semibold text-foreground">AI Assistant</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-gray-200/50 dark:hover:bg-gray-700/50 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 blur-xl opacity-30" />
                <div className="relative rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-5">
                  <MessageSquare className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
                </div>
              </div>
              <h3 className="mb-2 font-semibold text-foreground">How can I help?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                Ask me to create, find, or modify shortcuts in your config files.
              </p>
            </div>
          ) : (
            <div className="py-2">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-gray-200/50 dark:border-gray-700/50 p-4 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about shortcuts..."
              className="h-11 flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 text-sm text-foreground placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Button */}
      <button
        onClick={onToggle}
        className={`
          group relative flex h-14 w-14 items-center justify-center rounded-2xl 
          bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 
          text-white shadow-xl shadow-indigo-500/30
          transition-all duration-300 
          hover:shadow-2xl hover:shadow-indigo-500/40 hover:scale-110
          ${isOpen ? "rotate-0 scale-95" : "rotate-0 scale-100"}
        `}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />

        {/* Pulse ring */}
        {!isOpen && (
          <div className="absolute inset-0 rounded-2xl border-2 border-white/30 animate-ping opacity-75" />
        )}

        <div className="relative">
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageSquare className="h-6 w-6" />
          )}
        </div>
      </button>
    </div>
  );
}
