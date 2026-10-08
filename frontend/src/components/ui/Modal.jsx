import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { gsap, prefersReducedMotion } from '../../lib/motion.js';
import { cn } from '../../lib/utils.js';
import { Button } from './index.jsx';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
const WIDTH = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

/** Accessible modal: focus trap, Esc to close, scroll lock, focus restoration, GSAP entrance. */
export function Modal({ open, onClose, title, description, size = 'md', children, footer }) {
  const panel = useRef(null);
  const backdrop = useRef(null);
  const previous = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // keep the latest handler without re-running the open effect

  useEffect(() => {
    if (!open) return undefined;
    previous.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!prefersReducedMotion()) {
      gsap.fromTo(backdrop.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      gsap.fromTo(panel.current, { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.4)' });
    }
    const first = panel.current?.querySelector('[data-autofocus]') || panel.current?.querySelector(FOCUSABLE);
    first?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); }
      if (e.key !== 'Tab') return;
      const nodes = [...panel.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const [a, z] = [nodes[0], nodes[nodes.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div ref={backdrop} className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className={cn('relative card w-full max-h-[90vh] flex flex-col shadow-2xl', WIDTH[size])}>
        <div className="flex items-start justify-between gap-4 p-5 border-b border-line">
          <div><h2 className="text-lg font-bold">{title}</h2>{description && <p className="text-sm text-muted mt-0.5">{description}</p>}</div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="size-9 grid place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg shrink-0"><X className="size-5" aria-hidden /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="p-4 border-t border-line flex flex-wrap justify-end gap-2 bg-surface-2/40 rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'Confirm', tone = 'danger', loading, children }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm} data-autofocus>{confirmText}</Button></>}>
      <p className="text-sm text-muted">{message}</p>
      {children}
    </Modal>
  );
}
