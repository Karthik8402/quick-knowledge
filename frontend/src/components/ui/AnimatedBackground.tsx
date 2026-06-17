import { useMemo, memo } from 'react';

type Variant = 'aurora' | 'particles' | 'mesh';

interface AnimatedBackgroundProps {
  variant: Variant;
  /** Optional className for the container */
  className?: string;
}

/**
 * Ambient animated background for Spatial UI pages.
 *
 * Variants:
 * - aurora: 2-3 slow-drifting gradient blobs (auth pages)
 * - particles: Floating translucent geometric shapes (home hero)
 * - mesh: 3 overlapping radial gradients with position animation (register)
 *
 * All animations use CSS-only (no canvas/JS timers).
 * Respects prefers-reduced-motion via the .motion-safe prefix.
 */
export const AnimatedBackground = memo(function AnimatedBackground({ variant, className = '' }: AnimatedBackgroundProps) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}
      style={{ contain: 'strict' }}
      aria-hidden="true"
    >
      {variant === 'aurora' && <Aurora />}
      {variant === 'particles' && <Particles />}
      {variant === 'mesh' && <Mesh />}
    </div>
  );
});

/* ────────────────────────────────────────────────
   AURORA — Slow-drifting ambient light blobs
   ──────────────────────────────────────────────── */
const Aurora = memo(function Aurora() {
  return (
    <>
      {/* Blob 1 — Primary indigo */}
      <div
        className="absolute -top-[30%] -left-[20%] h-[70vh] w-[70vh] rounded-full opacity-[0.12]"
        style={{
          background: 'radial-gradient(circle, rgb(var(--color-primary)) 0%, transparent 70%)',
          filter: 'blur(80px)',
          animation: 'morphBlob 18s ease-in-out infinite',
          willChange: 'transform',
        }}
      />
      {/* Blob 2 — Secondary violet */}
      <div
        className="absolute -right-[15%] top-[10%] h-[60vh] w-[60vh] rounded-full opacity-[0.10]"
        style={{
          background: 'radial-gradient(circle, rgb(var(--color-secondary)) 0%, transparent 70%)',
          filter: 'blur(100px)',
          animation: 'morphBlob 22s ease-in-out infinite reverse',
          willChange: 'transform',
        }}
      />
      {/* Blob 3 — Tertiary warm */}
      <div
        className="absolute -bottom-[25%] left-[30%] h-[50vh] w-[50vh] rounded-full opacity-[0.08]"
        style={{
          background: 'radial-gradient(circle, rgb(var(--color-tertiary)) 0%, transparent 70%)',
          filter: 'blur(90px)',
          animation: 'morphBlob 25s ease-in-out infinite 2s',
          willChange: 'transform',
        }}
      />
    </>
  );
});

/* ────────────────────────────────────────────────
   PARTICLES — Floating translucent geometric shapes
   ──────────────────────────────────────────────── */

interface ParticleConfig {
  size: number;
  x: string;
  y: string;
  delay: number;
  duration: number;
  color: string;
  shape: 'circle' | 'hexagon' | 'square';
  opacity: number;
}

const Particles = memo(function Particles() {
  const particles = useMemo<ParticleConfig[]>(
    () => [
      { size: 120, x: '10%', y: '15%', delay: 0, duration: 20, color: 'var(--color-primary)', shape: 'circle', opacity: 0.08 },
      { size: 80, x: '75%', y: '20%', delay: 3, duration: 25, color: 'var(--color-secondary)', shape: 'hexagon', opacity: 0.06 },
      { size: 60, x: '50%', y: '70%', delay: 5, duration: 22, color: 'var(--color-tertiary)', shape: 'square', opacity: 0.07 },
      { size: 100, x: '85%', y: '60%', delay: 2, duration: 28, color: 'var(--color-primary)', shape: 'circle', opacity: 0.05 },
      { size: 45, x: '25%', y: '85%', delay: 7, duration: 18, color: 'var(--color-secondary)', shape: 'hexagon', opacity: 0.09 },
      { size: 70, x: '60%', y: '40%', delay: 4, duration: 24, color: 'var(--color-primary)', shape: 'square', opacity: 0.06 },
      { size: 55, x: '40%', y: '25%', delay: 6, duration: 26, color: 'var(--color-tertiary)', shape: 'circle', opacity: 0.07 },
      { size: 90, x: '15%', y: '55%', delay: 1, duration: 21, color: 'var(--color-secondary)', shape: 'circle', opacity: 0.05 },
    ],
    []
  );

  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animation: `particleDrift ${p.duration}s ease-in-out infinite ${p.delay}s`,
            filter: 'blur(1px)',
            willChange: 'transform',
          }}
        >
          <div
            className="h-full w-full"
            style={{
              animation: `orbit ${p.duration * 1.5}s linear infinite`,
              background: `radial-gradient(circle, rgb(${p.color}) 0%, transparent 70%)`,
              borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'hexagon' ? '25%' : '15%',
              transform: p.shape === 'square' ? 'rotate(45deg)' : undefined,
              willChange: 'transform',
            }}
          />
        </div>
      ))}
    </>
  );
});

/* ────────────────────────────────────────────────
   MESH — 3 wandering radial gradients
   ──────────────────────────────────────────────── */
const Mesh = memo(function Mesh() {
  return (
    <>
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 20% 50%, rgb(var(--color-primary)) 0%, transparent 100%)',
          filter: 'blur(60px)',
          animation: 'meshDrift1 20s ease-in-out infinite',
          willChange: 'transform',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.10]"
        style={{
          background: 'radial-gradient(ellipse 50% 60% at 80% 30%, rgb(var(--color-secondary)) 0%, transparent 100%)',
          filter: 'blur(70px)',
          animation: 'meshDrift2 25s ease-in-out infinite',
          willChange: 'transform',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          background: 'radial-gradient(ellipse 55% 45% at 50% 80%, rgb(var(--color-tertiary)) 0%, transparent 100%)',
          filter: 'blur(80px)',
          animation: 'meshDrift3 30s ease-in-out infinite',
          willChange: 'transform',
        }}
      />
    </>
  );
});
