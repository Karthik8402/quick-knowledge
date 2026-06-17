import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useSpring, useMotionValue, useTransform, type MotionStyle } from 'framer-motion';

interface Use3DTiltOptions {
  /** Max tilt angle in degrees (default: 6) */
  maxTilt?: number;
  /** Perspective distance in px (default: 1200) */
  perspective?: number;
  /** Scale factor on hover (default: 1.02) */
  scale?: number;
  /** Spring damping (default: 20) */
  damping?: number;
  /** Spring stiffness (default: 200) */
  stiffness?: number;
}

interface Use3DTiltReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  style: MotionStyle;
  isHovered: boolean;
}

/**
 * Mouse-tracking 3D perspective tilt hook.
 *
 * Implements Spatial UI "gaze-hover effects" and "smooth scale on focus":
 * - Calculates rotateX/rotateY from mouse position relative to element center
 * - Uses requestAnimationFrame for smooth 60fps
 * - Returns spring-interpolated transform via Framer Motion
 * - Falls back to identity transform on touch devices
 * - Applies transform-style: preserve-3d for child depth layers
 */
export function use3DTilt(options: Use3DTiltOptions = {}): Use3DTiltReturn {
  const {
    maxTilt = 6,
    perspective = 1200,
    scale = 1.02,
    damping = 20,
    stiffness = 200,
  } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const rafRef = useRef<number>(0);

  // Check for touch device (no tilt on mobile) - computed once on mount
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && (
      'ontouchstart' in window || navigator.maxTouchPoints > 0
    )
  );

  // Check for reduced motion preference - cached in state with dynamic listener
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springConfig = useMemo(() => ({ damping, stiffness }), [damping, stiffness]);
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);
  const springScale = useSpring(1, springConfig);

  const transform = useTransform(
    [springRotateX, springRotateY, springScale],
    ([rx, ry, s]: number[]) =>
      `perspective(${perspective}px) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(${s}, ${s}, ${s})`
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isTouchDevice || prefersReducedMotion || !ref.current) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // Normalize mouse position to -1..1 relative to element center
        const normalizedX = (e.clientX - centerX) / (rect.width / 2);
        const normalizedY = (e.clientY - centerY) / (rect.height / 2);

        // Clamp to prevent extreme angles
        const clampedX = Math.max(-1, Math.min(1, normalizedX));
        const clampedY = Math.max(-1, Math.min(1, normalizedY));

        // rotateX is inverted (moving mouse up should tilt top toward viewer)
        rotateX.set(-clampedY * maxTilt);
        rotateY.set(clampedX * maxTilt);
      });
    },
    [isTouchDevice, prefersReducedMotion, maxTilt, rotateX, rotateY]
  );

  const handleMouseEnter = useCallback(() => {
    if (isTouchDevice || prefersReducedMotion) return;
    setIsHovered(true);
    springScale.set(scale);
  }, [isTouchDevice, prefersReducedMotion, scale, springScale]);

  const handleMouseLeave = useCallback(() => {
    if (isTouchDevice || prefersReducedMotion) return;
    setIsHovered(false);
    rotateX.set(0);
    rotateY.set(0);
    springScale.set(1);
  }, [isTouchDevice, prefersReducedMotion, rotateX, rotateY, springScale]);

  useEffect(() => {
    const el = ref.current;
    if (!el || isTouchDevice || prefersReducedMotion) return;

    el.addEventListener('mousemove', handleMouseMove, { passive: true });
    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mouseleave', handleMouseLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove, handleMouseEnter, handleMouseLeave, isTouchDevice, prefersReducedMotion]);

  const style: MotionStyle = {
    transform,
    transformStyle: 'preserve-3d' as const,
    willChange: 'transform',
  };

  return { ref, style, isHovered };
}
