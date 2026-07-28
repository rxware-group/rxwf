import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Blocks in-app navigation when `when` is true (works with BrowserRouter).
 * Tab close / refresh should use `beforeunload` separately.
 */
export function useUnsavedNavigationGuard(
  when: boolean,
  onConfirmLeave: () => Promise<boolean>,
): void {
  const location = useLocation();
  const navigate = useNavigate();
  const whenRef = useRef(when);
  const confirmRef = useRef(onConfirmLeave);
  const pathRef = useRef(location.pathname);

  whenRef.current = when;
  confirmRef.current = onConfirmLeave;
  pathRef.current = location.pathname;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!whenRef.current) return;
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element).closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (href.startsWith('http://') || href.startsWith('https://')) return;

      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      const target = url.pathname + url.search + url.hash;
      void confirmRef.current().then((ok) => {
        if (ok) navigate(target);
      });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [navigate]);
}
