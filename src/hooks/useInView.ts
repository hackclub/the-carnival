import { useEffect, useRef, useState } from "react";

export interface UseInViewOptions {
  /** Root margin for IntersectionObserver, e.g. "0px 0px -10% 0px" */
  rootMargin?: string;
  /** Threshold to consider as in view */
  threshold?: number | number[];
  /** If true, once element is in view, it stays true permanently */
  once?: boolean;
}

export function useInView<T extends HTMLElement>(options: UseInViewOptions = {}) {
  const { rootMargin = "0px 0px -10% 0px", threshold = 0.2, once = true } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const [hasBeenInView, setHasBeenInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      setHasBeenInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setInView(true);
          setHasBeenInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { root: null, rootMargin, threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, threshold, once]);

  return { ref, inView: once ? hasBeenInView || inView : inView } as const;
}



