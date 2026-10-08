import { useState } from 'react';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { Button, ConfirmModal } from '../../components/ui/index.jsx';
import { expoPhase, useExpoRegistration } from './attendeeShared.js';

/** Register for / cancel registration of an expo. `expo` must be the detail payload (carries `registered`). */
export default function RegisterButton({ expo, size = 'lg', className }) {
  const mutation = useExpoRegistration(expo?._id);
  const [confirming, setConfirming] = useState(false);
  if (!expo) return null;

  if (['ended', 'cancelled'].includes(expoPhase(expo))) return <Button size={size} variant="secondary" disabled className={className}>Registration closed</Button>;
  if (expo.registered) {
    return (
      <>
        <Button size={size} variant="secondary" icon={CheckCircle2} className={className} aria-haspopup="dialog" aria-label="Registered. Activate to cancel your registration." title="Click to cancel your registration" onClick={() => setConfirming(true)}>
          Registered
        </Button>
        <ConfirmModal open={confirming} onClose={() => setConfirming(false)} loading={mutation.isPending} title="Cancel registration?" confirmText="Cancel registration"
          message="You will lose the sessions you registered for at this expo. You can register again at any time."
          onConfirm={() => mutation.mutate(false, { onSettled: () => setConfirming(false) })} />
      </>
    );
  }
  return <Button size={size} icon={UserPlus} loading={mutation.isPending} className={className} onClick={() => mutation.mutate(true)}>Register for this expo</Button>;
}
