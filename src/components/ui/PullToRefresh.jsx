import { useState, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

const THRESHOLD = 70;

export default function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const containerRef = useRef(null);

  const onTouchStart = useCallback((e) => {
    const el = containerRef.current;
    if (el && el.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      setPullY(Math.min(delta * 0.5, THRESHOLD));
    }
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (pullY >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullY(0);
      await onRefresh();
      setRefreshing(false);
    } else {
      setPullY(0);
    }
    startY.current = null;
  }, [pullY, refreshing, onRefresh]);

  const indicatorOpacity = Math.min(pullY / THRESHOLD, 1);

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      {(pullY > 0 || refreshing) && (
        <div
          className="flex items-center justify-center py-2 transition-all"
          style={{ height: refreshing ? 44 : pullY, opacity: refreshing ? 1 : indicatorOpacity }}
        >
          <Loader2
            size={20}
            className={`text-primary ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${(pullY / THRESHOLD) * 180}deg)` }}
          />
        </div>
      )}
      {children}
    </div>
  );
}