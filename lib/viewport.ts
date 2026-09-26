'use client';

import { useSyncExternalStore } from 'react';

/** Matches Tailwind `md` — phones/small tablets use the mobile shell. */
export const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function getSnapshot() {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function getServerSnapshot() {
  return true;
}

/** Live desktop/mobile detection from the device viewport (not user-agent sniffing). */
export function useIsDesktopViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function viewportLabel(isDesktop: boolean): 'desktop' | 'mobile' {
  return isDesktop ? 'desktop' : 'mobile';
}
