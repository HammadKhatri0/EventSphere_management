import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLE_HOME } from '../../lib/utils.js';
import { Button, EmptyState } from '../../components/ui/index.jsx';

export default function NotFound() {
  const { user } = useAuth();
  const nav = useNavigate();
  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <EmptyState icon={Compass} title="Page not found" text="The page you’re looking for doesn’t exist or has moved."
        action={<div className="flex gap-2 justify-center"><Button variant="secondary" onClick={() => nav(-1)}>Go back</Button><Button to={user ? ROLE_HOME[user.role] : '/'}>{user ? 'My portal' : 'Home'}</Button></div>} />
    </div>
  );
}
