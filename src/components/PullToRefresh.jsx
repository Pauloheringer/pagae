import React, { useRef, useState, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
  const sentinelRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const stateRef = useRef({ startY: 0, pulling: false, pullDist: 0, refreshing: false });
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    let el = sentinel.parentElement;
    while (el) {
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') break;
      el = el.parentElement;
    }
    if (!el) return;

    const handleTouchStart = (e) => {
      if (stateRef.current.refreshing) return;
      if (el.scrollTop <= 0) {
        stateRef.current.startY = e.touches[0].clientY;
        stateRef.current.pulling = true;
        setIsPulling(true);
      } else {
        stateRef.current.pulling = false;
      }
    };

    const handleTouchMove = (e) => {
      if (!stateRef.current.pulling || stateRef.current.refreshing) return;
      const distance = e.touches[0].clientY - stateRef.current.startY;
      if (distance > 0 && el.scrollTop <= 0) {
        e.preventDefault();
        const dampened = Math.min(distance * 0.4, 80);
        stateRef.current.pullDist = dampened;
        setPullDistance(dampened);
      }
    };

    const handleTouchEnd = async () => {
      if (!stateRef.current.pulling) return;
      stateRef.current.pulling = false;
      setIsPulling(false);
      if (stateRef.current.pullDist > 60 && !stateRef.current.refreshing) {
        stateRef.current.refreshing = true;
        setRefreshing(true);
        setPullDistance(40);
        try {
          await onRefreshRef.current();
        } catch (e) {
          console.error(e);
        } finally {
          stateRef.current.refreshing = false;
          setRefreshing(false);
          setPullDistance(0);
          stateRef.current.pullDist = 0;
        }
      } else {
        setPullDistance(0);
        stateRef.current.pullDist = 0;
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  return (
    <>
      <div
        ref={sentinelRef}
        style={{
          height: pullDistance,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: isPulling ? 'none' : 'height 0.2s ease',
        }}
      >
        {(pullDistance > 5 || refreshing) && (
          refreshing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <RefreshCw
              className="w-5 h-5 text-primary"
              style={{
                opacity: Math.min(pullDistance / 60, 1),
                transform: `rotate(${pullDistance * 3}deg)`,
              }}
            />
          )
        )}
      </div>
      {children}
    </>
  );
}
