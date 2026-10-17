import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Tab {
  readonly path: string;
  readonly label: string;
  readonly icon: ReactNode;
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

/** The bottom bar, left to right, as in the Android app. */
const TABS: readonly Tab[] = [
  { path: '/', label: 'Today', icon: <Icon d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /> },
  { path: '/workouts', label: 'Workouts', icon: <Icon d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /> },
  { path: '/food', label: 'Food', icon: <Icon d="M7 2v8a3 3 0 0 0 3 3v9M7 2v6M4 2v6a3 3 0 0 0 3 3M17 2c-2 2-3 5-3 8s1 4 3 4v8" /> },
  { path: '/tracker', label: 'Tracker', icon: <Icon d="M4 20V10M10 20V4M16 20v-8M22 20H2" /> },
  { path: '/profile', label: 'Profile', icon: <Icon d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z" /> },
];

const Placeholder = ({ title }: { title: string }) => (
  <>
    <h1>{title}</h1>
    <p className="muted">Coming next.</p>
  </>
);

export const App = () => (
  <div className="app">
    <main className="screen">
      <Routes>
        {TABS.map((tab) => (
          <Route key={tab.path} path={tab.path} element={<Placeholder title={tab.label} />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    <nav className="tabbar" aria-label="Main">
      {TABS.map((tab) => (
        <NavLink key={tab.path} to={tab.path} end={tab.path === '/'} className="tab">
          {tab.icon}
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  </div>
);
