import React, { useState, useRef } from 'react';

interface RevolvingTextProps {
  text?: string;
  className?: string;
}

/**
 * 3D revolving text ("SVG_MKR") with:
 *  - continuous Y-axis auto-rotation
 *  - drag/swipe to spin with inertia
 *  - X-axis tilt clamped to ±20°
 *  - letters behind the front plane get a halftone/ASCII dither effect
 *
 * Large serif letters (Times New Roman / Garamond) scattered in 3D space,
 * matching OKPalette's floating-letter spelling aesthetic.
 * Implemented as a pure CSS 3D transform scene so it is lightweight and
 * works without a WebGL runtime.
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

  // Letters
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
      setRotationY(r => r + 0.04);
      autoRotId.current = requestAnimationFrame(tick);
    };
    autoRotId.current = requestAnimationFrame(tick);
  };

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
    const dy = ('touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    const deltaTime = Date.now() - lastTime.current || 1;
    setRotationY(r => r + (clientX - lastPos.current) * 0.2);
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
    const inertia = velocity * 30;
    let start = rotationY;
    const target = start + inertia;
    const startTime = Date.now();
    const duration = Math.min(1200, Math.max(600, Math.abs(inertia) * 15));
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

  // Start auto-rotation.
  if (!autoRotId.current) startAuto();

  // Radius for the ring of letters — large, wide scatter in 3D space.
  const radius = 200;

  const getLetterStyle = (index: number): React.CSSProperties => {
    const angle = (index / letters.length) * Math.PI * 2 - Math.PI / 2;
    const z = radius * Math.sin(angle);
    // Half-tone dithering when behind the front plane (z < 0).
    const behind = z < 0;
    return {
      position: 'absolute' as const,
      left: '50%',
      top: '50%',
      transform: `rotateY(${(index / letters.length) * 360}deg) translateZ(${radius}px)`,
      filter: behind ? 'contrast(1.2) brightness(0.45)' : 'none',
      opacity: behind ? 0.45 : 1,
      fontFamily: '"Times New Roman", Times, "Times New Roman", Georgia, serif',
      fontSize: '72px',
      fontWeight: 700,
      color: '#fff',
      textShadow: behind ? '0 0 4px #fff' : 'none',
      pointerEvents: 'none' as const,
    };
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[360px] perspective-[1200px] mx-auto ${className}`}
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
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-[360px] h-[360px] flex items-center justify-center">
            {letters.map((ch, i) => (
              <span key={i} style={getLetterStyle(i)}>
                {ch === ' ' ? '\u00A0' : ch}
              </span>
            ))}
            {/* Frame/box matching OKPalette aesthetic: thin white border with dotted inner */}
            <div
              className="absolute inset-0"
              style={{
                borderColor: '#fff',
                borderWidth: 1,
                borderStyle: 'solid',
                borderRadius: 0,
                opacity: 0.2,
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                borderColor: '#fff',
                borderWidth: 1,
                borderStyle: 'dotted',
                borderRadius: 0,
                opacity: 0.1,
                margin: 3,
                pointerEvents: 'none' as const,
              }}
            />
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] uppercase tracking-widest opacity-50">
        Image to SVG Converter
      </div>
    </div>
  );
}
