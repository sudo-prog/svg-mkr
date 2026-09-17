import { useEffect } from 'react';

/**
 * Auto-dismissing toast. Fires `onDone` after 1800ms so the parent
 * can remove it from the DOM.
 */
export function Toast({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 right-6 z-50 px-4 py-2 bg-black border-2 border-white text-white text-[10px] font-mono uppercase tracking-widest animate-pulse">
      {message}
    </div>
  );
}
