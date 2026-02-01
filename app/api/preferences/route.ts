import { NextRequest, NextResponse } from 'next/server';
import { userPreferences } from '@/lib/db/queries';
import {
  PREFERENCE_KEYS,
  DEFAULT_PREFERENCES,
  isValidTheme,
  isValidLLMConfig,
  isValidShortcutsPerPage,
  isValidDefaultCategory,
  sanitizeLLMConfig,
  type UserPreferences,
  type UserPreferencesInput,
  type LLMConfigPreference,
  type PreferenceKey,
  type Theme,
} from '@/lib/types/preferences';

// GET /api/preferences - Get all preferences with defaults
export async function GET() {
  try {
    const allPrefs = userPreferences.getAll();
    const prefsMap = new Map(allPrefs.map((p) => [p.key, p.value]));

    // Build response with defaults for missing values
    const theme = parsePreference<Theme>(
      prefsMap.get(PREFERENCE_KEYS.THEME),
      DEFAULT_PREFERENCES.theme
    );

    const llmConfigRaw = parsePreference<LLMConfigPreference>(
      prefsMap.get(PREFERENCE_KEYS.LLM_CONFIG),
      DEFAULT_PREFERENCES.llm_config
    );

    const shortcutsPerPage = parsePreference<number>(
      prefsMap.get(PREFERENCE_KEYS.SHORTCUTS_PER_PAGE),
      DEFAULT_PREFERENCES.shortcuts_per_page
    );

    const defaultCategory = parsePreference<string>(
      prefsMap.get(PREFERENCE_KEYS.DEFAULT_CATEGORY),
      DEFAULT_PREFERENCES.default_category
    );

    const response: UserPreferences = {
      theme,
      llm_config: sanitizeLLMConfig(llmConfigRaw),
      shortcuts_per_page: shortcutsPerPage,
      default_category: defaultCategory,
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch preferences: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

// POST /api/preferences - Update preferences (upsert)
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UserPreferencesInput;
    const updated: PreferenceKey[] = [];
    const errors: string[] = [];

    // Validate and update theme
    if (body.theme !== undefined) {
      if (isValidTheme(body.theme)) {
        userPreferences.set(PREFERENCE_KEYS.THEME, JSON.stringify(body.theme));
        updated.push(PREFERENCE_KEYS.THEME);
      } else {
        errors.push('Invalid theme value. Must be "dark" or "light".');
      }
    }

    // Validate and update LLM config
    if (body.llm_config !== undefined) {
      if (isValidLLMConfig(body.llm_config)) {
        // Get existing config to preserve API key if not provided
        const existingRaw = userPreferences.get(PREFERENCE_KEYS.LLM_CONFIG);
        let existingConfig: LLMConfigPreference | null = null;

        if (existingRaw) {
          try {
            existingConfig = JSON.parse(existingRaw);
          } catch {
            // Ignore parse errors for existing config
          }
        }

        // Merge with existing config to preserve API key if not explicitly set
        const newConfig: LLMConfigPreference = {
          ...DEFAULT_PREFERENCES.llm_config,
          ...existingConfig,
          ...body.llm_config,
        };

        // If apiKey is empty string, remove it
        if (newConfig.apiKey === '') {
          delete newConfig.apiKey;
        }

        userPreferences.set(PREFERENCE_KEYS.LLM_CONFIG, JSON.stringify(newConfig));
        updated.push(PREFERENCE_KEYS.LLM_CONFIG);
      } else {
        errors.push(
          'Invalid llm_config. Must have valid provider (openai|anthropic|ollama) and model.'
        );
      }
    }

    // Validate and update shortcuts per page
    if (body.shortcuts_per_page !== undefined) {
      if (isValidShortcutsPerPage(body.shortcuts_per_page)) {
        userPreferences.set(
          PREFERENCE_KEYS.SHORTCUTS_PER_PAGE,
          JSON.stringify(body.shortcuts_per_page)
        );
        updated.push(PREFERENCE_KEYS.SHORTCUTS_PER_PAGE);
      } else {
        errors.push('Invalid shortcuts_per_page. Must be an integer between 5 and 100.');
      }
    }

    // Validate and update default category
    if (body.default_category !== undefined) {
      if (isValidDefaultCategory(body.default_category)) {
        userPreferences.set(
          PREFERENCE_KEYS.DEFAULT_CATEGORY,
          JSON.stringify(body.default_category)
        );
        updated.push(PREFERENCE_KEYS.DEFAULT_CATEGORY);
      } else {
        errors.push('Invalid default_category. Must be a non-empty string (max 50 chars).');
      }
    }

    // If there were validation errors, return them
    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: errors.join(' '),
        },
        { status: 400 }
      );
    }

    // If nothing was updated (empty body), return success with empty array
    return NextResponse.json({
      success: true,
      data: { updated },
    });
  } catch (error) {
    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: `Failed to update preferences: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

// Helper to parse stored JSON preference with fallback to default
function parsePreference<T>(stored: string | undefined, defaultValue: T): T {
  if (!stored) return defaultValue;

  try {
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}
