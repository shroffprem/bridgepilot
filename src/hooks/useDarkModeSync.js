import { useEffect } from 'react';

export function useDarkModeSync() {
  useEffect(() => {
    const apply = (dark) => {
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    apply(mq.matches);

    const handler = (e) => apply(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
}