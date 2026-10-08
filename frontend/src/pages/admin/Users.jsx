import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users as UsersIcon } from 'lucide-react';
import { errorMessage, get, patch } from '../../lib/api.js';
import { fmtDate, ROLE_LABEL, timeAgo } from '../../lib/utils.js';
import { useDebounced, useReveal } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Avatar, Badge, Card, Chips, ConfirmModal, DataTable, EmptyState, ErrorState, PageHeader, Pagination, SearchInput, Select, Skeleton, Toggle } from '../../components/ui/index.jsx';

const ROLE_TONE = { admin: 'primary', exhibitor: 'info', attendee: 'neutral' };
const ROLE_OPTIONS = Object.entries(ROLE_LABEL).map(([value, label]) => ({ value, label }));
const ACTIVE_OPTIONS = [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Deactivated' }];

export default function Users() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const q = useDebounced(search, 350).trim();
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(null);
  const cancelPending = useCallback(() => setPending(null), []);
  useEffect(() => setPage(1), [q, role, active]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['users', { q, role, active, page }],
    queryFn: () => get('/users', { q: q || undefined, role: role || undefined, active: active || undefined, page, limit: 10 }),
    placeholderData: keepPreviousData,
  });
  const update = useMutation({
    mutationFn: ({ user, changes }) => patch(`/users/${user._id}`, changes),
    onSuccess: (_r, { user, changes }) => {
      toast.success(changes.role ? `${user.name} is now ${ROLE_LABEL[changes.role]}` : `${user.name} was ${changes.isActive ? 'activated' : 'deactivated'}`);
      qc.invalidateQueries({ queryKey: ['users'] });
      cancelPending();
    },
    onError: (err) => { toast.error(errorMessage(err)); cancelPending(); },
  });
  const ref = useReveal('[data-reveal]', [!!data]);

  const counts = data?.counts || {};
  const total = Object.values(counts).reduce((n, c) => n + c, 0);
  const busy = (u) => update.isPending && update.variables?.user._id === u._id;

  const columns = [
    {
      key: 'user', header: 'User', render: (u) => (
        <div className="flex items-center gap-3 min-w-56">
          <Avatar name={u.name} src={u.avatar} />
          <div className="min-w-0">
            <p className="font-semibold flex items-center gap-2">{u.name}{u._id === me._id && <Badge tone="primary">You</Badge>}</p>
            <p className="text-[13px] text-muted truncate">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'company', header: 'Company', render: (u) => u.company || <span className="text-muted">—</span> },
    {
      key: 'role', header: 'Role', render: (u) => (
        <div className="flex items-center gap-2">
          <Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
          <Select aria-label={`Change role for ${u.name}`} value={u.role} options={ROLE_OPTIONS} className="h-9 w-36" disabled={u._id === me._id || busy(u)}
            onChange={(e) => setPending({ user: u, changes: { role: e.target.value } })} />
        </div>
      ),
    },
    { key: 'joined', header: 'Joined', render: (u) => <span className="whitespace-nowrap">{fmtDate(u.createdAt)}</span> },
    { key: 'last', header: 'Last sign-in', render: (u) => <span className="whitespace-nowrap text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</span> },
    {
      key: 'active', header: 'Active', render: (u) => (
        <div className="flex items-center gap-2">
          <Toggle checked={u.isActive} label={`${u.isActive ? 'Deactivate' : 'Activate'} ${u.name}`} disabled={u._id === me._id || busy(u)}
            onChange={(next) => (next ? update.mutate({ user: u, changes: { isActive: true } }) : setPending({ user: u, changes: { isActive: false } }))} />
          <span className="text-sm">{u.isActive ? 'Active' : 'Deactivated'}</span>
        </div>
      ),
    },
  ];

  const isRoleChange = !!pending?.changes.role;

  return (
    <>
      <PageHeader title="Users" subtitle="Everyone with an EventSphere account. Change roles or deactivate accounts." />

      <Card className="p-4 mb-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] items-end">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email or company" />
          <Select label="Account status" value={active} onChange={(e) => setActive(e.target.value)} placeholder="All accounts" options={ACTIVE_OPTIONS} />
        </div>
        <Chips label="Filter by role" value={role} onChange={setRole}
          options={[{ value: '', label: `All (${total})` }, ...ROLE_OPTIONS.map((r) => ({ value: r.value, label: `${r.label}s (${counts[r.value] || 0})` }))]} />
      </Card>

      <div ref={ref}>
        {isLoading ? <Skeleton className="h-96" /> : isError ? <ErrorState error={error} onRetry={refetch} /> : (
          <Card data-reveal className="overflow-hidden">
            <DataTable columns={columns} rows={data.items} caption="User directory"
              empty={<EmptyState icon={UsersIcon} title="No users found" text="Try a different search or clear the filters." />} />
            <div className="px-4 pb-4"><Pagination pagination={data.pagination} onPage={setPage} /></div>
          </Card>
        )}
      </div>

      <ConfirmModal open={!!pending} onClose={cancelPending} loading={update.isPending} onConfirm={() => update.mutate(pending)}
        tone={isRoleChange ? 'primary' : 'danger'} confirmText={isRoleChange ? 'Change role' : 'Deactivate account'}
        title={isRoleChange ? `Make ${pending?.user.name} ${ROLE_LABEL[pending?.changes.role]}?` : `Deactivate ${pending?.user.name}?`}
        message={isRoleChange
          ? 'Their access and navigation change immediately the next time they sign in.'
          : 'They are signed out everywhere and cannot sign in until you activate the account again. Their data is kept.'} />
    </>
  );
}
