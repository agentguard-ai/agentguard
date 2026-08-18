'use client';

import { useState, useEffect } from 'react';

/**
 * Hook that listens for a CSS media query match.
 *
 * @param query - A media query string, e.g. '(min-width: 1280px)'
 * @returns `true` when the media query matches, `false` otherwise.
 *
 * On the server (SSR), returns `false` by default to avoid hydration mismatches.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
