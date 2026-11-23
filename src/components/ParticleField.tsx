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
  kind: 'dot' | 'star' | 'glow';
  toneIndex: number;
}

export function ParticleField({
  theme,
  density = 48,
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

    const getDpr = () => Math.min(window.devicePixelRatio || 1, 2);
    let dpr = getDpr();
    let width = Math.max(1, Math.floor(canvas.offsetWidth * dpr));
    let height = Math.max(1, Math.floor(canvas.offsetHeight * dpr));
    canvas.width = width;
    canvas.height = height;

    const effectiveDensity =
      window.innerWidth < 640 ? Math.min(density, 28) : density;

    const particles: DustParticle[] = Array.from(
      { length: effectiveDensity },
      (_, idx) => {
        const kind: DustParticle['kind'] =
          idx % 8 === 0 ? 'star' : idx % 11 === 0 ? 'glow' : 'dot';
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.2 * dpr,
          vy: (-0.09 - Math.random() * 0.22) * dpr,
          radius:
            kind === 'glow'
              ? (3.2 + Math.random() * 3.6) * dpr
              : (0.85 + Math.random() * 1.85) * dpr,
          alpha:
            kind === 'glow'
              ? 0.08 + Math.random() * 0.14
              : 0.18 + Math.random() * 0.48,
          phase: Math.random() * Math.PI * 2,
          kind,
          toneIndex: idx % 3,
        };
      }
    );

    const handleResize = () => {
      if (!canvas) return;
      dpr = getDpr();
      const nextW = Math.max(1, Math.floor(canvas.offsetWidth * dpr));
      const nextH = Math.max(1, Math.floor(canvas.offsetHeight * dpr));
      if (nextW === width && nextH === height) return;
      const sx = nextW / width;
      const sy = nextH / height;
      width = canvas.width = nextW;
      height = canvas.height = nextH;
      for (let i = 0; i < particles.length; i += 1) {
        particles[i].x *= sx;
        particles[i].y *= sy;
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(handleResize)
        : null;
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', handleResize);

    let rafId = 0;

    const renderFrame = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      const tones =
        theme === 'dark'
          ? ['238, 202, 196', '205, 118, 134', '181, 43, 68']
          : ['96, 152, 232', '226, 128, 167', '158, 134, 227'];

      const starRgb = theme === 'dark' ? '224, 152, 158' : '132, 116, 224';

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        if (!prefersReducedMotion) {
          const gentleWave = Math.sin(time * 0.0007 + p.phase) * 0.08 * dpr;
          p.x += p.vx + gentleWave;
          p.y += p.vy;

          if (p.y < -18) p.y = height + 18;
          if (p.x < -18) p.x = width + 18;
          if (p.x > width + 18) p.x = -18;
        }

        const twinkle = 0.62 + 0.38 * Math.sin(time * 0.0016 + p.phase);
        const currentAlpha = p.alpha * twinkle;
        const tone = tones[p.toneIndex];

        if (p.kind === 'star') {
          const s = p.radius * 2.6;
          ctx.strokeStyle = `rgba(${starRgb}, ${currentAlpha * 0.92})`;
          ctx.lineWidth = 0.9 * dpr;
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y);
          ctx.lineTo(p.x + s, p.y);
          ctx.moveTo(p.x, p.y - s);
          ctx.lineTo(p.x, p.y + s);
          ctx.stroke();

          ctx.fillStyle = `rgba(${starRgb}, ${currentAlpha * 0.55})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.65, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'glow') {
          const grad = ctx.createRadialGradient(
            p.x,
            p.y,
            0,
            p.x,
            p.y,
            p.radius * 2.4
          );
          grad.addColorStop(0, `rgba(${tone}, ${currentAlpha})`);
          grad.addColorStop(1, `rgba(${tone}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(${tone}, ${currentAlpha})`;
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
      resizeObserver?.disconnect();
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
