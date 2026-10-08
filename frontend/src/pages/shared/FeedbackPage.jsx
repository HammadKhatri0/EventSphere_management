import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Send, Star } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, fieldErrors, post } from '../../lib/api.js';
import { cn } from '../../lib/utils.js';
import { useForm } from '../../hooks/index.js';
import { Button, Card, Chips, EmptyState, PageHeader, Textarea } from '../../components/ui/index.jsx';

const TYPES = [{ value: 'suggestion', label: 'Suggestion' }, { value: 'issue', label: 'Report an issue' }, { value: 'other', label: 'Other' }];

export default function FeedbackPage() {
  const { values, set, bind, errors, setErrors, reset } = useForm({ type: 'suggestion', message: '', rating: 0 });
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: (body) => post('/feedback', body),
    onSuccess: () => { setSent(true); reset(); toast.success('Thanks for your feedback!'); },
    onError: (e) => { setErrors(fieldErrors(e)); toast.error(errorMessage(e)); },
  });
  const submit = (e) => {
    e.preventDefault();
    if (values.message.trim().length < 5) return setErrors({ message: 'Please tell us a little more' });
    send.mutate({ type: values.type, message: values.message.trim(), rating: values.rating || undefined });
  };

  return (
    <>
      <PageHeader title="Feedback & support" subtitle="Suggest an improvement or report a problem — every message is read by the EventSphere team." />
      <Card className="max-w-2xl" data-reveal>
        {sent ? (
          <EmptyState icon={CheckCircle2} title="Feedback received" text="Thank you! We’ll review it shortly and let you know if it’s resolved." action={<Button variant="secondary" onClick={() => setSent(false)}>Send another</Button>} />
        ) : (
          <form onSubmit={submit} className="p-6 space-y-5" noValidate>
            <Chips label="Feedback type" options={TYPES} value={values.type} onChange={(v) => set('type', v)} />
            <Textarea label="Your message" rows={6} required placeholder="What’s on your mind?" {...bind('message')} error={errors.message} />
            <fieldset>
              <legend className="text-sm font-semibold mb-1.5">Rate your experience (optional)</legend>
              <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={values.rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => set('rating', values.rating === n ? 0 : n)}
                    className="size-10 grid place-items-center rounded-lg hover:bg-surface-2"><Star className={cn('size-6', n <= values.rating ? 'fill-warning text-warning' : 'text-muted')} aria-hidden /></button>
                ))}
              </div>
            </fieldset>
            <Button type="submit" icon={Send} loading={send.isPending}>Send feedback</Button>
          </form>
        )}
      </Card>
    </>
  );
}
