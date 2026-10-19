import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

const links = [
  { to: '/', label: 'Overview', end: true },
  { to: '/customers', label: 'Customers' },
  { to: '/requests', label: 'Requests' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/settings', label: 'Settings' },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  if (user && !user.businessId) return <Navigate to="/onboarding" replace />;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 animate-rise">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight">ReviewRelay</p>
          <p className="text-sm text-ink-800/60">{user?.email}</p>
        </div>
        <nav className="flex flex-wrap gap-1 rounded-xl border border-ink-800/10 bg-white/60 p-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-ink-900 text-sand-50' : 'text-ink-800/80 hover:bg-white'}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <button className="btn-secondary" data-testid="logout" onClick={() => void logout()}>
          Log out
        </button>
      </header>
      <Outlet />
    </div>
  );
}
