import React, { useRef, useCallback, useState, useEffect } from 'react';

interface Props {
  top: React.ReactNode;
  bottom: React.ReactNode;
  defaultTopHeight?: number;
  minTopHeight?: number;
  maxTopHeight?: number;
}

export const VerticalSplitPane: React.FC<Props> = ({
  top,
  bottom,
  defaultTopHeight = 50,
  minTopHeight = 20,
  maxTopHeight = 80,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [topHeight, setTopHeight] = useState(defaultTopHeight);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setTopHeight(Math.max(minTopHeight, Math.min(maxTopHeight, pct)));
    };

    const onMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, minTopHeight, maxTopHeight]);

  return (
    <div ref={containerRef} className="flex flex-col flex-1 overflow-hidden">
      <div style={{ height: `${topHeight}%` }} className="overflow-hidden flex flex-col min-h-0">
        {top}
      </div>
      <div
        onMouseDown={onMouseDown}
        className={`h-1.5 cursor-row-resize shrink-0 relative z-10 group ${
          isDragging ? 'bg-blue-500/30' : 'bg-transparent hover:bg-blue-500/20'
        } transition-colors`}
      >
        <div
          className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-px ${
            isDragging ? 'bg-blue-400' : 'bg-neutral-700 group-hover:bg-neutral-500'
          } transition-colors`}
        />
      </div>
      <div style={{ height: `${100 - topHeight}%` }} className="overflow-hidden flex flex-col min-h-0">
        {bottom}
      </div>
    </div>
  );
};
