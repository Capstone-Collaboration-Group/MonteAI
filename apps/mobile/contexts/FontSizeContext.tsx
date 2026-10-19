import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  FONT_SIZE_SCALES,
  FONT_SIZE_STORAGE_KEY,
  type FontSizeChoice,
} from '@/constants/theme';

type FontSizeContextValue = {
  /** Currently selected preference (Small | Medium | Large). */
  choice: FontSizeChoice;
  /** Multiplier derived from `choice` — feed styles through `scaleStyle`. */
  scale: number;
  /** False until the persisted preference has been read (gates first paint). */
  ready: boolean;
  setChoice: (choice: FontSizeChoice) => void;
};

const FontSizeContext = createContext<FontSizeContextValue | null>(null);

function isChoice(value: string): value is FontSizeChoice {
  return value in FONT_SIZE_SCALES;
}

/**
 * Holds the in-app font-size preference and keeps it persisted in
 * AsyncStorage (`monteai.settings.fontSize`).
 *
 * The provider sits at the root, but screens do NOT re-render through the
 * normal parent cascade — the app runs with the React Compiler, which
 * memoizes JSX and bails out on unchanged props. Instead, the leaf text
 * components (`components/ui/ScaledText.tsx`) consume this context directly;
 * context propagation bypasses memoized parents, so every Text/TextInput on
 * screen re-renders when the selection changes. Each of those re-renders
 * derives a fresh scaled style (see `scaleStyle`), which is what actually
 * changes the rendered font size.
 */
export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<FontSizeChoice>('Medium');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(FONT_SIZE_STORAGE_KEY)
      .then((stored) => {
        if (!cancelled && stored !== null && isChoice(stored)) {
          setChoiceState(stored);
        }
      })
      .catch(() => {
        // best-effort — fall back to the Medium default
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setChoice = useCallback((next: FontSizeChoice) => {
    setChoiceState(next);
    AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, next).catch(() => {
      // preference is best-effort — next launch retries
    });
  }, []);

  const value = useMemo<FontSizeContextValue>(
    () => ({
      choice,
      scale: FONT_SIZE_SCALES[choice],
      ready,
      setChoice,
    }),
    [choice, ready, setChoice],
  );

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize(): FontSizeContextValue {
  const context = useContext(FontSizeContext);
  if (context === null) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
}
