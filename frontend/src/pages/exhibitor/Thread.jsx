import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../../components/ui/index.jsx';
import { cn, fmtDateTime } from '../../lib/utils.js';
import { prefersReducedMotion } from '../../lib/motion.js';

/**
 * Chat-style message list. `messages`: [{ id, mine, author, body, at }].
 * Own messages are right-aligned; the list scrolls to the newest message and announces updates politely.
 */
export function MessageList({ messages, label, empty }) {
  const ref = useRef(null);
  const count = messages.length;

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [count]);

  return (
    <div ref={ref} role="log" aria-live="polite" aria-label={label} className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
      {count === 0 && empty}
      {messages.map((m) => (
        <div key={m.id} className={cn('flex flex-col max-w-[85%] sm:max-w-[75%]', m.mine ? 'ml-auto items-end' : 'items-start')}>
          <p className="text-xs text-muted mb-1 px-1">{m.mine ? 'You' : m.author} · <time dateTime={new Date(m.at).toISOString()}>{fmtDateTime(m.at)}</time></p>
          <p className={cn('rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words', m.mine ? 'bg-primary text-white rounded-br-md' : 'bg-surface-2 border border-line rounded-bl-md')}>{m.body}</p>
        </div>
      ))}
    </div>
  );
}

/** Reply box: Enter sends, Shift+Enter adds a line. `onSend(body)` must return a promise; the text is kept if it rejects. */
export function Composer({ onSend, pending, disabled, label = 'Write a message', maxLength = 2000 }) {
  const [text, setText] = useState('');
  const body = text.trim();

  const submit = async (e) => {
    e?.preventDefault();
    if (!body || pending || disabled) return;
    try {
      await onSend(body);
      setText('');
    } catch {
      /* the caller already surfaced the error; keep the draft so nothing is lost */
    }
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  };

  return (
    <form onSubmit={submit} className="border-t border-line p-3 flex items-end gap-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} rows={2} maxLength={maxLength} disabled={disabled}
        aria-label={label} placeholder={`${label}… (Enter to send, Shift+Enter for a new line)`}
        className="flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary disabled:opacity-60 disabled:bg-surface-2" />
      <Button type="submit" icon={Send} loading={pending} disabled={!body || disabled} aria-label="Send message">Send</Button>
    </form>
  );
}
