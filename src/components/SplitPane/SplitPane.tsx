import React, { useRef, useCallback, useState, useEffect } from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  maxLeftWidth = 80,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
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
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.max(minLeftWidth, Math.min(maxLeftWidth, pct)));
    };

    const onMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
      <div style={{ width: `${leftWidth}%` }} className="h-full overflow-hidden border-r border-neutral-800">
        {left}
      </div>
      <div
        onMouseDown={onMouseDown}
        className={`w-1.5 cursor-col-resize shrink-0 relative z-10 group ${
          isDragging ? 'bg-blue-500/30' : 'bg-transparent hover:bg-blue-500/20'
        } transition-colors`}
      >
        <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-px ${
          isDragging ? 'bg-blue-400' : 'bg-neutral-700 group-hover:bg-neutral-500'
        } transition-colors`} />
      </div>
      <div style={{ width: `${100 - leftWidth}%` }} className="h-full overflow-hidden">
        {right}
      </div>
    </div>
  );
};
