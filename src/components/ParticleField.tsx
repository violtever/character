import { useEffect, useRef } from 'react';
import type { ThemeMode } from '../types/archive';

interface ParticleFieldProps {
  theme: ThemeMode;
  density?: number;
  className?: string;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
  isStar: boolean;
}

export function ParticleField({
  theme,
  density = 46,
  className = '',
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio);
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };

    window.addEventListener('resize', handleResize);

    const particles: DustParticle[] = Array.from({ length: density }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.22 * window.devicePixelRatio,
      vy: (-0.12 - Math.random() * 0.24) * window.devicePixelRatio,
      radius: (0.8 + Math.random() * 1.9) * window.devicePixelRatio,
      alpha: 0.16 + Math.random() * 0.48,
      phase: Math.random() * Math.PI * 2,
      isStar: idx % 7 === 0,
    }));

    let rafId = 0;

    const renderFrame = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      const primaryRgb = theme === 'dark' ? '234, 198, 200' : '96, 152, 232';
      const secondaryRgb = theme === 'dark' ? '205, 138, 150' : '226, 146, 184';
      const starRgb = theme === 'dark' ? '216, 94, 114' : '142, 126, 224';

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          if (p.y < -12) p.y = height + 12;
          if (p.x < -12) p.x = width + 12;
          if (p.x > width + 12) p.x = -12;
        }

        const twinkle = 0.65 + 0.35 * Math.sin(time * 0.0014 + p.phase);
        const currentAlpha = p.alpha * twinkle;

        if (p.isStar) {
          const s = p.radius * 2.5;
          ctx.strokeStyle = `rgba(${starRgb}, ${currentAlpha * 0.92})`;
          ctx.lineWidth = 0.95 * window.devicePixelRatio;
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y);
          ctx.lineTo(p.x + s, p.y);
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x, p.y + s);
          ctx.stroke();
        } else {
          const dotRgb = i % 3 === 0 ? secondaryRgb : primaryRgb;
          ctx.fillStyle = `rgba(${dotRgb}, ${currentAlpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme, density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none h-full w-full ${className}`}
    />
  );
}
