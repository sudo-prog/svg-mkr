import { useRef, useEffect, useState } from 'react';

interface Props {
  text?: string;
}

/**
 * 3D revolving text ("SVG_MKR") with:
 *  - continuous Y-axis auto-rotation (like OKPalette floating letters)
 *  - drag / swipe to spin with inertia
 *  - X-axis tilt clamped to ±20°
 *  - letters facing away get a half-tone / faded occlusion effect
 *
 * Pure CSS 3D transforms — no WebGL runtime.
 */
export function RevolvingText({ text = 'SVG_MKR' }: Props) {
  const [rotY, setRotY] = useState(0);
  const [rotX, setRotX] = useState(0);
  const isDragging = useRef(false);
  const lastX = useRef(0);
  const velocity = useRef(0);
  const chars = text.split('');

  // Auto-spin loop with inertia decay when not dragging.
  useEffect(() => {
    let frame: number;
    const animate = () => {
      if (!isDragging.current) {
        velocity.current *= 0.96;
        setRotY((y) => y + 0.35 + velocity.current);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastX.current;
    velocity.current = dx * 0.25;
    setRotY((y) => y + dx * 0.45);
    // Tilt clamped to ±20°
    setRotX((x) => Math.max(-20, Math.min(20, x + e.movementY * 0.12)));
    lastX.current = e.clientX;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div
      className="relative w-full h-[360px] flex items-center justify-center"
      style={{ perspective: '1200px' }}
    >
      <div
        className="relative w-full h-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{
          transformStyle: 'preserve-3d',
          transform: `rotateY(${rotY}deg) rotateX(${rotX}deg)`,
        }}
      >
        {chars.map((char, i) => {
          const angle = (360 / chars.length) * i;
          // If the letter faces the camera (back-facing), fade it for
          // the half-tone / occlusion depth cue.
          const facingBack =
            Math.cos(((angle + rotY) * Math.PI) / 180) < -0.15;
          return (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-5xl font-bold text-white select-none"
              style={{
                fontFamily:
                  'Georgia, "Times New Roman", Times, serif',
                textShadow: '0 0 4px rgba(255,255,255,0.6)',
                transform: `rotateY(${angle}deg) translateZ(170px)`,
                opacity: facingBack ? 0.12 : 1,
                filter: facingBack
                  ? 'contrast(1.8) brightness(0.25)'
                  : 'none',
                transformOrigin: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          );
        })}

        {/* Central ring — OKPalette-style dotted/dashed frame */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] border border-white opacity-[0.08]" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[268px] h-[268px] border border-white border-dashed opacity-[0.05]" style={{ margin: 6 }} />
      </div>
    </div>
  );
}
