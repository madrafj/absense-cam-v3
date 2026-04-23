import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useModelsWarmup } from './hooks/useModelsWarmup';

import HomePage from './pages/HomePage';
import CameraPage from './pages/CameraPage';
import EnrollmentPage from './pages/EnrollmentPage';
import HistoryPage from './pages/HistoryPage';

export default function App() {
  useModelsWarmup();

  return (
    <BrowserRouter>
      <div className="w-full min-h-screen bg-base-100 text-base-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/camera" element={<CameraPage />} />
          <Route path="/enroll" element={<EnrollmentPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
