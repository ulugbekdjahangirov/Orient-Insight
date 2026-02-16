import { useState, useEffect } from 'react';

/**
 * Custom hook for media query detection
 * @param {string} query - CSS media query string
 * @returns {boolean} - Whether the media query matches
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    // Initialize with actual media query result to avoid flash
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const media = window.matchMedia(query);

    // Update state if different from initial
    setMatches(media.matches);

    // Create listener for changes
    const listener = () => setMatches(media.matches);

    // Modern browsers
    if (media.addEventListener) {
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
    // Fallback for older browsers
    else {
      media.addListener(listener);
      return () => media.removeListener(listener);
    }
  }, [query]);

  return matches;
}

/**
 * Hook to detect mobile viewport (< 768px)
 * @returns {boolean} - True if viewport is mobile size
 */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');

/**
 * Hook to detect tablet viewport (768px - 1023px)
 * @returns {boolean} - True if viewport is tablet size
 */
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

/**
 * Hook to detect desktop viewport (>= 1024px)
 * @returns {boolean} - True if viewport is desktop size
 */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

/**
 * Hook to get current breakpoint name
 * @returns {string} - 'mobile', 'tablet', or 'desktop'
 */
export const useBreakpoint = () => {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  if (isDesktop) return 'desktop';
  return 'mobile'; // Fallback
};
