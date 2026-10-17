import { Component, type ErrorInfo, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CommunityPlanScreen, CommunityScreen } from '../ui/Community';
import { Day } from '../ui/Day';
import { DietPlanScreen, Food } from '../ui/Diet';
import { ExerciseDetail, ExercisePicker } from '../ui/Exercises';
import { FoodPicker } from '../ui/FoodPicker';
import { ToastProvider } from '../ui/hooks';
import { PrivacyPolicy, TermsOfService } from '../ui/Legal';
import { ProfileScreen } from '../ui/ProfileScreen';
import { Today } from '../ui/Today';
import { Tracker } from '../ui/Tracker';
import { TrainingPlanScreen } from '../ui/TrainingPlanScreen';
import { Workouts } from '../ui/Workouts';

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

/** A bug in one screen should show a message and a way out, not a blank page. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="empty" role="alert">
        <p>Something went wrong on this screen.</p>
        <button className="btn" onClick={() => window.location.assign('/')}>Back to Today</button>
      </div>
    );
  }
}

export const App = () => {
  // The tab bar belongs to the top-level screens; detail screens have a back button instead.
  const { pathname } = useLocation();
  const showTabs = TABS.some((t) => t.path === pathname);
  return (
    <ToastProvider>
      <div className="app">
        <main className="screen">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/day/:date" element={<Day />} />
              <Route path="/workouts" element={<Workouts />} />
              <Route path="/workouts/plan/:id" element={<TrainingPlanScreen />} />
              <Route path="/exercises/pick" element={<ExercisePicker />} />
              <Route path="/exercises/:id" element={<ExerciseDetail />} />
              <Route path="/food" element={<Food />} />
              <Route path="/food/plan/:id" element={<DietPlanScreen />} />
              <Route path="/food/pick" element={<FoodPicker />} />
              <Route path="/tracker" element={<Tracker />} />
              <Route path="/profile" element={<ProfileScreen />} />
              <Route path="/community" element={<CommunityScreen />} />
              <Route path="/community/:id" element={<CommunityPlanScreen />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
        {showTabs && (
          <nav className="tabbar" aria-label="Main">
            {TABS.map((tab) => (
              <NavLink key={tab.path} to={tab.path} end={tab.path === '/'} className="tab">
                {tab.icon}
                <span>{tab.label}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </ToastProvider>
  );
};
