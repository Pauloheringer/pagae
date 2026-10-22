import React, { useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function KeepAliveOutlet({ keepPaths = [] }) {
  const location = useLocation();
  const outlet = useOutlet();
  const cacheRef = useRef(new Map());

  if (keepPaths.includes(location.pathname)) {
    cacheRef.current.set(location.pathname, outlet);
  }

  const isKeptPath = keepPaths.includes(location.pathname);

  return (
    <div className="h-full relative">
      {Array.from(cacheRef.current.entries()).map(([path, element]) => {
        const isActive = path === location.pathname;
        return (
          <div
            key={path}
            className="h-full overflow-y-auto scrollbar-thin absolute inset-0"
            style={{
              opacity: isActive ? 1 : 0,
              pointerEvents: isActive ? 'auto' : 'none',
              zIndex: isActive ? 10 : 0,
              transition: 'opacity 0.2s ease',
              overscrollBehavior: 'contain',
            }}
          >
            {element}
          </div>
        );
      })}
      {!isKeptPath && (
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="h-full overflow-y-auto scrollbar-thin absolute inset-0 z-10"
          style={{ overscrollBehavior: 'contain' }}
        >
          {outlet}
        </motion.div>
      )}
    </div>
  );
}
