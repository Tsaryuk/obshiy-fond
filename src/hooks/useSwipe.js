import { useRef, useCallback } from 'react';

export default function useSwipe(onSwipeRight, onSwipeLeft) {
  const startX = useRef(null);
  const onTouchStart = useCallback(e => { startX.current = e.touches[0].clientX; }, []);
  const onTouchEnd = useCallback(e => {
    if (startX.current === null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 60) { dx > 0 ? onSwipeRight?.() : onSwipeLeft?.(); }
    startX.current = null;
  }, [onSwipeRight, onSwipeLeft]);
  return { onTouchStart, onTouchEnd };
}
