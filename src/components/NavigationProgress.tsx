"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type NavigationProgressContextValue = {
  startNavigation: () => void;
};

const NavigationProgressContext = createContext<NavigationProgressContextValue>({
  startNavigation: () => {},
});

export function useNavigationProgress() {
  return useContext(NavigationProgressContext);
}

function shouldTrackLinkClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const target = event.target;
  if (!(target instanceof Element)) return false;

  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor) return false;
  if (anchor.hasAttribute("download")) return false;

  const linkTarget = anchor.getAttribute("target");
  if (linkTarget && linkTarget !== "_self") return false;

  const nextUrl = new URL(anchor.href, window.location.href);
  if (nextUrl.origin !== window.location.origin) return false;

  const currentUrl = new URL(window.location.href);
  const samePage =
    nextUrl.pathname === currentUrl.pathname &&
    nextUrl.search === currentUrl.search;

  return !samePage;
}

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationStartPathRef = useRef<string | null>(null);

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startNavigation = useCallback(() => {
    clearPendingTimeout();
    navigationStartPathRef.current = window.location.pathname;
    setVisible(true);

    // Safety net for cancelled navigations, same-path query updates, or network failures.
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      timeoutRef.current = null;
    }, 12000);
  }, [clearPendingTimeout]);

  useEffect(() => {
    if (!visible) return;
    if (navigationStartPathRef.current === pathname) return;

    clearPendingTimeout();
    const hideTimer = setTimeout(() => {
      setVisible(false);
      navigationStartPathRef.current = null;
    }, 220);

    return () => clearTimeout(hideTimer);
  }, [clearPendingTimeout, pathname, visible]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (shouldTrackLinkClick(event)) {
        startNavigation();
      }
    };

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      clearPendingTimeout();
    };
  }, [clearPendingTimeout, startNavigation]);

  const value = useMemo(() => ({ startNavigation }), [startNavigation]);

  return (
    <NavigationProgressContext.Provider value={value}>
      {children}
      {visible ? (
        <div
          className="navigation-progress"
          role="status"
          aria-label="Navigating"
          aria-live="polite"
        >
          <div className="navigation-progress__bar" />
        </div>
      ) : null}
    </NavigationProgressContext.Provider>
  );
}
