import React, { useState, useRef, useEffect } from 'react';

interface RevolvingTextProps {
  text?: string;
  className?: string;
}

/**
 * 3D revolving text ("SVG_MKR") with:
 *  - continuous Y-axis auto-rotation (slow, like OKPalette)
 *  - drag/swipe to spin with inertia
 *  - X-axis tilt clamped to ±20°
 *  - letters behind the front plane get a halftone/ASCII dither effect
 *
 * Large serif letters (72px) scattered in 3D space around the central area,
 * matching OKPalette's floating-letter spelling aesthetic.
 * Pure CSS 3D transforms — no WebGL runtime.
 */
export function RevolvingText({ text = 'SVG_MKR', className = '' }: RevolvingTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotationY, setRotationY] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [velocity, setVelocity] = useState(0);
  const lastPos = useRef(0);
  const lastTime = useRef(0);
  const rafId = useRef<number | null>(null);
  const autoRotId = useRef<number | null>(null);
  const hasStarted = useRef(false);

  const letters = text.split('');

  // Stop auto-rotation during drag; resume after inertia settles.
  const stopAuto = () => {
    if (autoRotId.current) {
      cancelAnimationFrame(autoRotId.current);
      autoRotId.current = null;
    }
  };

  const startAuto = () => {
    if (autoRotId.current) return;
    const tick = () => {
      setRotationY(r => r + 0.003); // very slow
      autoRotId.current = requestAnimationFrame(tick);
    };
    autoRotId.current = requestAnimationFrame(tick);
  };

  // Start auto-rotation once on mount (not on every render).
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      startAuto();
    }
    return () => stopAuto();
  }, []);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    stopAuto();
    setIsDragging(true);
    lastPos.current = 'touches' in e ? e.touches[0].clientX : e.clientX;
    lastTime.current = Date.now();
    setVelocity(0);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const rect = containerRef.current.getBoundingClientRect();
    const dy = (e as any).touches ? (e as any).touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    const deltaTime = Date.now() - lastTime.current || 1;
    setRotationY(r => r + (clientX - lastPos.current) * 0.005);
    if (containerRef.current) {
      const h = containerRef.current.offsetHeight || 300;
      setTilt(Math.max(-20, Math.min(20, (dy / h) * 40 - 20)));
    }
    setVelocity((clientX - lastPos.current) / deltaTime);
    lastPos.current = clientX;
    lastTime.current = Date.now();
  };

  const handleUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const inertia = velocity * 0.08;
    const start = rotationY;
    const target = start + inertia;
    const startTime = Date.now();
    const duration = Math.min(1200, Math.max(600, Math.abs(inertia) * 60));
    const step = () => {
      const t = Math.min(1, (Date.now() - startTime) / duration);
      setRotationY(start + (target - start) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) {
        rafId.current = requestAnimationFrame(step);
      } else {
        startAuto();
      }
    };
    rafId.current = requestAnimationFrame(step);
  };

  // Each letter gets a unique 3D position — scattered, not a perfect ring
  // Like OKPalette where letters float at different depths and angles
  const getLetterStyle = (index: number): React.CSSProperties => {
    const total = letters.length;
    // Use golden ratio distribution for natural-looking scatter
    const golden = 1.618;
    const angle = (index * 137.5) * Math.PI / 180; // golden angle in radians
    const distance = 180 + (index % 2) * 40; // alternate between two depths
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * 60;
    const z = Math.sin(index * 0.7) * distance * 0.6; // varying Z for 3D depth
    const behind = z < -20; // behind viewer plane

    return {
      position: 'absolute' as const,
      left: '50%',
      top: '50%',
      transform: `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px)`,
      filter: behind ? 'contrast(1.8) brightness(0.25)' : 'none',
      opacity: behind ? 0.25 : 1,
      fontFamily: '"Times New Roman", Times, Georgia, serif',
      fontSize: 'max(8rem, 15vmin)',
      fontWeight: 200,
      lineHeight: 1,
      letterSpacing: '-0.02em',
      color: '#fff',
      textShadow: behind ? '0 0 6px #fff' : '0 0 2px rgba(255,255,255,0.8)',
      pointerEvents: 'none' as const,
      whiteSpace: 'nowrap' as const,
    };
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[360px] perspective-[1400px] mx-auto ${className}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMove}
      onTouchEnd={handleUp}
    >
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateY(${rotationY}rad) rotateX(${tilt}deg)`,
        }}
      >
        {letters.map((ch, i) => (
          <span key={i} style={getLetterStyle(i)}>
            {ch === ' ' ? '\u00A0' : ch}
          </span>
        ))}
        {/* Central frame: thin white border with dotted inner (OKPalette style) */}
        <div className="absolute top-1/2 left-1/2 w-[280px] h-[280px] -translate-x-1/2 -translate-y-1/2 border border-white opacity-15" />
        <div className="absolute top-1/2 left-1/2 w-[268px] h-[268px] -translate-x-1/2 -translate-y-1/2 border border-white border-dashed opacity-8" style={{ margin: 6 }} />
      </div>
    </div>
  );
}
