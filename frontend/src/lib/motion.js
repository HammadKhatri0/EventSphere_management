import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);
gsap.defaults({ ease: 'power3.out', duration: 0.6 });

export { gsap, useGSAP, ScrollTrigger };

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Staggered fade/slide-in. Skipped (elements shown immediately) for reduced-motion users. */
export function revealIn(targets, { y = 18, stagger = 0.06, delay = 0, duration = 0.55 } = {}) {
  if (prefersReducedMotion()) { gsap.set(targets, { clearProps: 'all' }); return null; }
  return gsap.fromTo(targets, { opacity: 0, y }, { opacity: 1, y: 0, stagger, delay, duration, clearProps: 'transform,opacity' });
}
