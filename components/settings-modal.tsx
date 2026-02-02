"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import {
  X,
  Moon,
  Sun,
  FolderOpen,
  Save,
  Code,
  Terminal,
  FileCode,
  Sparkles,
  Monitor,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { LLMProvider, ConfigPath } from "@/lib/types";

interface ConfigPathInput {
  id?: number; // DB id if exists
  appId: string;
  label: string;
  path: string;
  enabled: boolean;
  icon: React.ReactNode;
  placeholder: string;
}

interface LLMConfigInput {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (configPaths: ConfigPathInput[], llmConfig: LLMConfigInput) => void;
  onRefresh?: () => Promise<void>;
  initialConfigPaths?: ConfigPathInput[];
  initialLLMConfig?: LLMConfigInput;
}

// App configurations with icons and placeholders
const APP_CONFIGS: Record<string, { label: string; icon: React.ReactNode; placeholder: string }> = {
  nvim: {
    label: "Neovim",
    icon: <Code className="h-4 w-4" />,
    placeholder: "~/.config/nvim/init.lua",
  },
  tmux: {
    label: "Tmux",
    icon: <Terminal className="h-4 w-4" />,
    placeholder: "~/.tmux.conf",
  },
  zsh: {
    label: "Zsh",
    icon: <Terminal className="h-4 w-4" />,
    placeholder: "~/.zshrc",
  },
  vscode: {
    label: "VS Code",
    icon: <FileCode className="h-4 w-4" />,
    placeholder: "~/.config/Code/User/keybindings.json",
  },
};

const defaultConfigPaths: ConfigPathInput[] = Object.entries(APP_CONFIGS).map(
  ([appId, config]) => ({
    appId,
    label: config.label,
    path: "",
    enabled: false,
    icon: config.icon,
    placeholder: config.placeholder,
  })
);

const defaultLLMConfig: LLMConfigInput = {
  provider: "openai",
  model: "gpt-4",
  apiKey: "",
};

const llmProviders: { value: LLMProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "ollama", label: "Ollama (Local)" },
];

const llmModels: Record<LLMProvider, string[]> = {
  openai: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
  ollama: ["llama3", "codellama", "mistral"],
};

export function SettingsModal({
  isOpen,
  onClose,
  onSave,
  onRefresh,
  initialConfigPaths,
  initialLLMConfig,
}: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [configPaths, setConfigPaths] = useState<ConfigPathInput[]>(
    initialConfigPaths || defaultConfigPaths
  );
  const [llmConfig, setLLMConfig] = useState<LLMConfigInput>(
    initialLLMConfig || defaultLLMConfig
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch existing config paths from API when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setErrors({});

      fetch('/api/config-paths')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data?.paths) {
            // Merge API data with default configs
            const apiPaths: ConfigPath[] = data.data.paths;
            const merged = defaultConfigPaths.map(defaultPath => {
              const existing = apiPaths.find(p => p.app_id === defaultPath.appId);
              if (existing) {
                return {
                  ...defaultPath,
                  id: existing.id,
                  path: existing.path,
                  enabled: Boolean(existing.enabled),
                };
              }
              return { ...defaultPath, enabled: false };
            });
            setConfigPaths(merged);
          } else {
            setConfigPaths(defaultConfigPaths);
          }
        })
        .catch(err => {
          console.error('Failed to fetch config paths:', err);
          setConfigPaths(defaultConfigPaths);
        })
        .finally(() => {
          setIsLoading(false);
        });

      setLLMConfig(initialLLMConfig || defaultLLMConfig);
    }
  }, [isOpen, initialLLMConfig]);

  // Handle ESC key to close modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Handle click outside to close modal
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleConfigPathChange = (appId: string, value: string) => {
    setConfigPaths((prev) =>
      prev.map((cp) => (cp.appId === appId ? { ...cp, path: value } : cp))
    );
    // Clear error when user types
    if (errors[appId]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[appId];
        return newErrors;
      });
    }
  };

  const handleConfigPathToggle = (appId: string) => {
    setConfigPaths((prev) =>
      prev.map((cp) =>
        cp.appId === appId ? { ...cp, enabled: !cp.enabled } : cp
      )
    );
  };

  const handleLLMConfigChange = (
    field: keyof LLMConfigInput,
    value: string
  ) => {
    setLLMConfig((prev) => {
      const updated = { ...prev, [field]: value };
      // Reset model when provider changes
      if (field === "provider") {
        updated.model = llmModels[value as LLMProvider][0];
      }
      return updated;
    });
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate that at least one config path is enabled and has a path
    const enabledPaths = configPaths.filter((cp) => cp.enabled);
    if (enabledPaths.length === 0) {
      newErrors.general = "At least one config path must be enabled";
    }

    // Validate LLM API key if not using Ollama
    if (llmConfig.provider !== "ollama" && !llmConfig.apiKey.trim()) {
      newErrors.apiKey = "API key is required for this provider";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    const saveErrors: Array<{ appId: string; error: string }> = [];

    try {
      // Process each config path
      for (const config of configPaths) {
        // Skip if no path provided and not in DB
        if (!config.path.trim() && !config.id) {
          continue;
        }

        // If exists in DB, update it
        if (config.id) {
          const res = await fetch(`/api/config-paths/${config.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: config.path,
              enabled: config.enabled,
            }),
          });
          const data = await res.json();
          if (!data.success) {
            saveErrors.push({ appId: config.appId, error: data.error || 'Failed to update' });
          }
        }
        // If has path but not in DB, create it
        else if (config.path.trim()) {
          const res = await fetch('/api/config-paths', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              app_id: config.appId,
              path: config.path,
              enabled: config.enabled,
            }),
          });
          const data = await res.json();
          if (!data.success) {
            saveErrors.push({ appId: config.appId, error: data.error || 'Failed to create' });
          }
        }
      }

      if (saveErrors.length > 0) {
        const errorMessages = saveErrors.map(e => `${e.appId}: ${e.error}`).join('; ');
        setErrors({ general: errorMessages });
      } else {
        await onSave(configPaths, llmConfig);
        onClose();
      }
    } catch {
      setErrors({ general: "Failed to save settings. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/shortcuts/refresh', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        if (onRefresh) {
          await onRefresh();
        }
      } else {
        setErrors({ general: data.error || 'Failed to refresh shortcuts' });
      }
    } catch {
      setErrors({ general: "Failed to refresh shortcuts. Please try again." });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div
        ref={modalRef}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-background shadow-2xl dark:border-gray-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-700">
          <div>
            <h2
              id="settings-modal-title"
              className="text-h3 font-semibold text-foreground"
            >
              Settings
            </h2>
            <p className="mt-1 text-small text-gray-500 dark:text-gray-400">
              Configure your config paths and preferences
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* General Error */}
          {errors.general && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {errors.general}
            </div>
          )}

          {/* Theme Section */}
          <section>
            <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Monitor className="h-4 w-4" />
              Appearance
            </h3>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                {mounted && theme === "dark" ? (
                  <Moon className="h-5 w-5 text-primary" />
                ) : (
                  <Sun className="h-5 w-5 text-primary" />
                )}
                <div>
                  <p className="font-medium text-foreground">Theme</p>
                  <p className="text-small text-gray-500 dark:text-gray-400">
                    {mounted
                      ? theme === "dark"
                        ? "Dark mode"
                        : "Light mode"
                      : "Loading..."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="relative h-7 w-14 rounded-full bg-gray-200 transition-colors dark:bg-gray-700"
                role="switch"
                aria-checked={theme === "dark"}
                aria-label="Toggle dark mode"
              >
                <span
                  className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                    mounted && theme === "dark" ? "translate-x-7" : ""
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Config Paths Section */}
          <section>
            <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <FolderOpen className="h-4 w-4" />
              Configuration Files
            </h3>
            <div className="space-y-3">
              {configPaths.map((config) => (
                <div
                  key={config.appId}
                  className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 font-medium text-foreground">
                      {config.icon}
                      {config.label}
                    </label>
                    <button
                      onClick={() => handleConfigPathToggle(config.appId)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        config.enabled
                          ? "bg-primary"
                          : "bg-gray-200 dark:bg-gray-700"
                      }`}
                      role="switch"
                      aria-checked={config.enabled}
                      aria-label={`Enable ${config.label} config`}
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                          config.enabled ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={config.path}
                      onChange={(e) =>
                        handleConfigPathChange(config.appId, e.target.value)
                      }
                      placeholder={config.placeholder}
                      disabled={!config.enabled}
                      className={`flex-1 rounded-lg border border-gray-200 bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-700 ${
                        !config.enabled ? "cursor-not-allowed opacity-50" : ""
                      }`}
                    />
                    <button
                      disabled={!config.enabled}
                      className={`flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 ${
                        !config.enabled ? "cursor-not-allowed opacity-50" : ""
                      }`}
                      aria-label={`Browse for ${config.label} config file`}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Browse
                    </button>
                  </div>
                  {errors[config.appId] && (
                    <p className="mt-2 text-sm text-red-500">
                      {errors[config.appId]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* LLM Configuration Section */}
          <section>
            <h3 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Sparkles className="h-4 w-4" />
              AI Configuration
            </h3>
            <div className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
              {/* Provider */}
              <div>
                <label
                  htmlFor="llm-provider"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Provider
                </label>
                <select
                  id="llm-provider"
                  value={llmConfig.provider}
                  onChange={(e) =>
                    handleLLMConfigChange(
                      "provider",
                      e.target.value as LLMProvider
                    )
                  }
                  className="w-full rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-700"
                >
                  {llmProviders.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div>
                <label
                  htmlFor="llm-model"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Model
                </label>
                <select
                  id="llm-model"
                  value={llmConfig.model}
                  onChange={(e) =>
                    handleLLMConfigChange("model", e.target.value)
                  }
                  className="w-full rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-700"
                >
                  {llmModels[llmConfig.provider].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              {llmConfig.provider !== "ollama" && (
                <div>
                  <label
                    htmlFor="llm-apikey"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    API Key
                  </label>
                  <input
                    id="llm-apikey"
                    type="password"
                    value={llmConfig.apiKey}
                    onChange={(e) =>
                      handleLLMConfigChange("apiKey", e.target.value)
                    }
                    placeholder="Enter your API key"
                    className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                      errors.apiKey
                        ? "border-red-500 dark:border-red-500"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  />
                  {errors.apiKey && (
                    <p className="mt-2 text-sm text-red-500">{errors.apiKey}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Your API key is stored locally and never sent to any server
                    except the LLM provider.
                  </p>
                </div>
              )}

              {llmConfig.provider === "ollama" && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ollama runs locally on your machine. Make sure Ollama is
                  running with the selected model installed.
                </p>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isSaving}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? "Refreshing..." : "Refresh Shortcuts"}
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
