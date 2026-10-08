import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  BarChart3, Building2, CalendarClock, CalendarDays, ClipboardCheck, FileText, Handshake, LayoutDashboard, LifeBuoy, Map, MessageCircle, MessageSquareHeart, Store, Ticket, UserCog, Users,
} from 'lucide-react';
import { PageLoader } from './components/ui/index.jsx';
import { GuestOnly, RequireRole } from './components/layout/Guards.jsx';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import AttendeeLayout from './components/layout/AttendeeLayout.jsx';

const L = (loader) => lazy(loader);

// public + auth
const Landing = L(() => import('./pages/Landing.jsx'));
const Login = L(() => import('./pages/auth/Login.jsx'));
const Register = L(() => import('./pages/auth/Register.jsx'));
const ForgotPassword = L(() => import('./pages/auth/ForgotPassword.jsx'));
const ResetPassword = L(() => import('./pages/auth/ResetPassword.jsx'));
const NotFound = L(() => import('./pages/shared/NotFound.jsx'));
// shared
const Notifications = L(() => import('./pages/shared/Notifications.jsx'));
const AccountSettings = L(() => import('./pages/shared/AccountSettings.jsx'));
const FeedbackPage = L(() => import('./pages/shared/FeedbackPage.jsx'));
// organizer
const A = {
  Dashboard: L(() => import('./pages/admin/Dashboard.jsx')), Expos: L(() => import('./pages/admin/Expos.jsx')), ExpoForm: L(() => import('./pages/admin/ExpoForm.jsx')),
  FloorPlan: L(() => import('./pages/admin/FloorPlanManager.jsx')), Applications: L(() => import('./pages/admin/Applications.jsx')), Schedule: L(() => import('./pages/admin/Schedule.jsx')),
  Analytics: L(() => import('./pages/admin/Analytics.jsx')), Support: L(() => import('./pages/admin/Support.jsx')), Feedback: L(() => import('./pages/admin/FeedbackAdmin.jsx')), Users: L(() => import('./pages/admin/Users.jsx')),
};
// exhibitor
const E = {
  Dashboard: L(() => import('./pages/exhibitor/Dashboard.jsx')), Profile: L(() => import('./pages/exhibitor/Profile.jsx')), Staff: L(() => import('./pages/exhibitor/Staff.jsx')),
  Expos: L(() => import('./pages/exhibitor/Expos.jsx')), Applications: L(() => import('./pages/exhibitor/Applications.jsx')), Booths: L(() => import('./pages/exhibitor/Booths.jsx')),
  Inquiries: L(() => import('./pages/exhibitor/Inquiries.jsx')), Messages: L(() => import('./pages/exhibitor/Messages.jsx')), Support: L(() => import('./pages/exhibitor/Support.jsx')),
};
// attendee
const T = {
  Home: L(() => import('./pages/attendee/Home.jsx')), Expos: L(() => import('./pages/attendee/Expos.jsx')), ExpoDetail: L(() => import('./pages/attendee/ExpoDetail.jsx')),
  Exhibitors: L(() => import('./pages/attendee/Exhibitors.jsx')), ExhibitorDetail: L(() => import('./pages/attendee/ExhibitorDetail.jsx')), Schedule: L(() => import('./pages/attendee/Schedule.jsx')),
  FloorPlan: L(() => import('./pages/attendee/FloorPlanViewer.jsx')), Agenda: L(() => import('./pages/attendee/Agenda.jsx')), Inquiries: L(() => import('./pages/attendee/Inquiries.jsx')),
};

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Overview' },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, group: 'Overview' },
  { to: '/admin/expos', label: 'Expo events', icon: Ticket, group: 'Manage' },
  { to: '/admin/floor-plan', label: 'Floor plan & booths', icon: Map, group: 'Manage' },
  { to: '/admin/applications', label: 'Exhibitor applications', icon: ClipboardCheck, group: 'Manage' },
  { to: '/admin/schedule', label: 'Schedule & sessions', icon: CalendarClock, group: 'Manage' },
  { to: '/admin/support', label: 'Support tickets', icon: LifeBuoy, group: 'People & support' },
  { to: '/admin/users', label: 'Users', icon: Users, group: 'People & support' },
  { to: '/admin/feedback', label: 'Feedback', icon: MessageSquareHeart, group: 'People & support' },
  { to: '/admin/settings', label: 'Account & privacy', icon: UserCog, group: 'Account' },
];
const EXHIBITOR_NAV = [
  { to: '/exhibitor', label: 'Dashboard', icon: LayoutDashboard, end: true, group: 'Overview' },
  { to: '/exhibitor/expos', label: 'Find expos & apply', icon: Ticket, group: 'Participation' },
  { to: '/exhibitor/applications', label: 'My applications', icon: ClipboardCheck, group: 'Participation' },
  { to: '/exhibitor/booths', label: 'Booth selection', icon: Map, group: 'Participation' },
  { to: '/exhibitor/profile', label: 'Company profile', icon: Building2, group: 'Company' },
  { to: '/exhibitor/staff', label: 'Staff', icon: Users, group: 'Company' },
  { to: '/exhibitor/inquiries', label: 'Visitor inquiries', icon: Handshake, group: 'Communication' },
  { to: '/exhibitor/messages', label: 'Exhibitor messages', icon: MessageCircle, group: 'Communication' },
  { to: '/exhibitor/support', label: 'Support tickets', icon: LifeBuoy, group: 'Communication' },
  { to: '/exhibitor/feedback', label: 'Feedback', icon: MessageSquareHeart, group: 'Account' },
  { to: '/exhibitor/settings', label: 'Account & privacy', icon: UserCog, group: 'Account' },
];

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<RequireRole roles={['admin']} />}>
          <Route path="/admin" element={<DashboardLayout nav={ADMIN_NAV} portal="Organizer" settingsHref="/admin/settings" notificationsHref="/admin/notifications" />}>
            <Route index element={<A.Dashboard />} />
            <Route path="analytics" element={<A.Analytics />} />
            <Route path="expos" element={<A.Expos />} />
            <Route path="expos/new" element={<A.ExpoForm />} />
            <Route path="expos/:id/edit" element={<A.ExpoForm />} />
            <Route path="floor-plan" element={<A.FloorPlan />} />
            <Route path="applications" element={<A.Applications />} />
            <Route path="schedule" element={<A.Schedule />} />
            <Route path="support" element={<A.Support />} />
            <Route path="users" element={<A.Users />} />
            <Route path="feedback" element={<A.Feedback />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<AccountSettings />} />
          </Route>
        </Route>

        <Route element={<RequireRole roles={['exhibitor']} />}>
          <Route path="/exhibitor" element={<DashboardLayout nav={EXHIBITOR_NAV} portal="Exhibitor" settingsHref="/exhibitor/settings" notificationsHref="/exhibitor/notifications" />}>
            <Route index element={<E.Dashboard />} />
            <Route path="expos" element={<E.Expos />} />
            <Route path="applications" element={<E.Applications />} />
            <Route path="booths" element={<E.Booths />} />
            <Route path="profile" element={<E.Profile />} />
            <Route path="staff" element={<E.Staff />} />
            <Route path="inquiries" element={<E.Inquiries />} />
            <Route path="messages" element={<E.Messages />} />
            <Route path="support" element={<E.Support />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<AccountSettings />} />
          </Route>
        </Route>

        <Route element={<RequireRole roles={['attendee']} />}>
          <Route path="/attendee" element={<AttendeeLayout />}>
            <Route index element={<T.Home />} />
            <Route path="expos" element={<T.Expos />} />
            <Route path="expos/:id" element={<T.ExpoDetail />} />
            <Route path="exhibitors" element={<T.Exhibitors />} />
            <Route path="exhibitors/:id" element={<T.ExhibitorDetail />} />
            <Route path="schedule" element={<T.Schedule />} />
            <Route path="floor-plan" element={<T.FloorPlan />} />
            <Route path="agenda" element={<T.Agenda />} />
            <Route path="inquiries" element={<T.Inquiries />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<AccountSettings />} />
          </Route>
        </Route>

        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
