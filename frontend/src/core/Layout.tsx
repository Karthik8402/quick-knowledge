import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { DocumentMetadata } from '../types';
import ToastContainer from '../shared/Toast';
import { useAuth } from '../hooks/useAuth';
import { authEnabled } from '../lib/supabase';
import { BRAND } from '../config/branding';
import { useTheme } from '../hooks/useTheme';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { useAppData } from '../hooks/useAppData';



export default function Layout() {
  const { loading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { documents } = useAppData();
  const [pageKey, setPageKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);



  /* ── Scroll main to top + close mobile sidebar on route change ── */
  useEffect(() => {
    setPageKey((k) => k + 1);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    setSidebarOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);


  /* ── Close user menu on outside click ── */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  type NavItem = {
    icon: string;
    label: string;
    path: string;
  };

  type NavGroup = {
    groupLabel: string;
    items: NavItem[];
  };

  const NAV_GROUPS: NavGroup[] = [
    {
      groupLabel: 'Knowledge',
      items: [
        { icon: 'dashboard',    label: 'Dashboard',       path: '/dashboard' },
        { icon: 'folder_open',  label: 'Documents',       path: '/documents' },
        { icon: 'chat',         label: 'Knowledge Chat',  path: '/chat' },
        { icon: 'segment',      label: 'Chunks',          path: '/chunks' },
      ],
    },
    {
      groupLabel: 'System',
      items: [
        { icon: 'analytics',    label: 'System Status',   path: '/status' },
        { icon: 'settings',     label: 'Settings',        path: '/settings' },
      ],
    },
    {
      groupLabel: 'Insights',
      items: [
        { icon: 'bar_chart',      label: 'Analytics',     path: '/analytics' },
        { icon: 'model_training', label: 'AI Models',     path: '/models' },
        { icon: 'history',        label: 'Sessions',      path: '/sessions' },
        { icon: 'timeline',       label: 'Activity',      path: '/activity' },
        { icon: 'notifications',  label: 'Notifications', path: '/notifications' },
      ],
    },
  ];

  const PAGE_TITLES: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/documents': 'Documents',
    '/chat': 'Knowledge Chat',
    '/chunks': 'Chunks Explorer',
    '/status': 'System Status',
    '/settings': 'Settings',
    '/profile': 'Profile',
    '/analytics': 'Analytics',
    '/models': 'AI Models',
    '/sessions': 'Sessions',
    '/activity': 'Activity',
    '/notifications': 'Notifications',
    '/help': 'Help & Support',
    '/about': 'About',
  };

  const isChat = location.pathname === '/chat';
  const profileName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const profileInitials = profileName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('') || 'U';

  return (
    <div className="flex h-screen bg-background text-on-surface font-body overflow-hidden">
      <ToastContainer />

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden animate-fade-in-up"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed left-0 top-0 h-screen flex flex-col z-40 w-72 border-none bg-surface-container-lowest shadow-none
        transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <div className="px-6 py-8 flex items-center justify-between border-b border-outline-variant/30 mb-4">
          <NavLink to="/dashboard" className="group">
            <h1 className="font-['Space_Grotesk'] font-bold text-primary tracking-tighter text-2xl animate-fade-in-down group-hover:opacity-80 transition-opacity">
              {BRAND.name}
            </h1>
            <div className="h-[2px] w-12 bg-gradient-to-r from-primary to-secondary mt-2 rounded-full" />
          </NavLink>
          {/* Close button — mobile only */}
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-surface-container rounded-xl transition-colors">
            <span className="material-symbols-outlined text-outline">close</span>
          </button>
        </div>

        <nav className="flex-grow font-['Space_Grotesk'] text-sm tracking-tight overflow-y-auto custom-scrollbar flex flex-col gap-6 px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.groupLabel}>
              {/* Section label */}
              <p className="px-2 mb-1 text-xs font-semibold uppercase tracking-widest text-on-surface-variant/50 select-none">
                {group.groupLabel}
              </p>
              {/* Items */}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                        }`
                      }
                    >
                      <span className="material-symbols-outlined text-[20px] shrink-0">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Quick stats */}
          <div className="mt-8 px-6">
            <p className="text-[10px] uppercase tracking-[0.2em] text-outline font-black mb-3">Quick Stats</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm text-primary/50">description</span>
                  Documents
                </span>
                <span className="text-on-surface font-bold">{documents.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm text-tertiary/50">segment</span>
                  Total Chunks
                </span>
                <span className="text-on-surface font-bold">{documents.reduce((s, d) => s + d.chunks, 0)}</span>
              </div>
            </div>
          </div>
        </nav>

        {/* ── User Menu (bottom of sidebar) ── */}
        <div className="p-4 mt-auto border-t border-outline-variant/10 relative" ref={userMenuRef}>
          {/* User dropdown menu */}
          {userMenuOpen && user && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-surface-container border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden animate-fade-in-up z-50">
              <div className="px-4 py-3 border-b border-outline-variant/10">
                <p className="text-sm font-bold text-on-surface truncate">{profileName}</p>
                <p className="text-[11px] text-outline truncate">{user.email}</p>
              </div>
              <NavLink to="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-base">person</span>
                My Profile
              </NavLink>
              <NavLink to="/settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-base">settings</span>
                Settings
              </NavLink>
              <NavLink to="/help" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-base">help</span>
                Help & Support
              </NavLink>
              <NavLink to="/about" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined text-base">info</span>
                About
              </NavLink>
              <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors w-full text-left">
                <span className="material-symbols-outlined text-base">logout</span>
                Sign Out
              </button>
            </div>
          )}

          <div
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-container transition-all duration-300 cursor-pointer group"
            onClick={() => user ? setUserMenuOpen(!userMenuOpen) : navigate('/login')}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-on-primary-container font-black text-xs transition-transform duration-300 group-hover:scale-110 animate-gradient-shift" style={{ backgroundSize: '200% 200%' }}>
              {user ? profileInitials : 'GU'}
            </div>
            <div className="flex-grow overflow-hidden">
              <p className="text-xs font-bold text-on-surface truncate tracking-tight">{user ? profileName : 'Guest User'}</p>
              <p className="text-[10px] text-outline truncate">{user ? 'Authenticated' : 'Click to Sign In'}</p>
            </div>
            {user && (
              <span className="material-symbols-outlined text-sm text-outline group-hover:text-on-surface transition-colors">
                {userMenuOpen ? 'expand_more' : 'expand_less'}
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main
        ref={mainRef}
        className={`
          flex-1 h-screen overflow-x-hidden relative w-full bg-background custom-scrollbar
          ml-0 lg:ml-72
          ${isChat ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}
        `}
      >

        <header className="flex justify-between items-center w-full px-4 sm:px-6 py-4 sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-outline-variant/15 shadow-[0_40px_60px_-15px_rgba(var(--color-primary),0.08)] flex-shrink-0">
          <div className="flex items-center gap-3 animate-fade-in-down">
            {/* Hamburger — mobile only */}
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-surface-container rounded-xl transition-colors">
              <span className="material-symbols-outlined text-outline">menu</span>
            </button>
            <h2 className="font-['Space_Grotesk'] font-medium text-base sm:text-lg text-primary">
              {PAGE_TITLES[location.pathname] || 'Quick Knowledge'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
          </div>
        </header>

        {/* Chat route gets flex-1 to fill remaining space; other routes scroll normally */}
        {isChat ? (
          <div key={pageKey} className="relative z-10 flex-1 min-h-0 animate-fade-in-up">
            <Outlet />
          </div>
        ) : (
          <section key={pageKey} className="relative z-10 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in-up">
            <Outlet />
          </section>
        )}
      </main>
    </div>
  );
}
