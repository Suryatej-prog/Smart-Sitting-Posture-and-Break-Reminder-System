import { Route, Routes } from 'react-router-dom';
import { LiveProvider } from './context/LiveContext';
import Shell from './components/Shell';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Sessions from './pages/Sessions';
import SessionDetail from './pages/SessionDetail';
import Device from './pages/Device';
import Settings from './pages/Settings';

export default function App() {
  return (
    <LiveProvider>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="sessions/:id" element={<SessionDetail />} />
          <Route path="device" element={<Device />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<p className="empty">That page doesn't exist.</p>} />
        </Route>
      </Routes>
    </LiveProvider>
  );
}
