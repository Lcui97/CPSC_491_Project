import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Home from './pages/Home';
import Brain from './pages/Brain';
import NoteView from './pages/NoteView';
import NotesGallery from './pages/NotesGallery';
import BrainSourcesView from './pages/BrainSourcesView';
import DocumentIngestion from './pages/DocumentIngestion';
import KnowledgeGapAnalysis from './pages/KnowledgeGapAnalysis';
import SharedBrain from './pages/SharedBrain';
import CalendarPage from './pages/Calendar';
import AssistantPage from './pages/AssistantPage';
import QuickSwitcher from './components/note/QuickSwitcher';
import { AssistantPanelProvider } from './context/AssistantPanelContext';
import AssistantSlidePanel from './components/assistant/AssistantSlidePanel';

function App() {
  const token = localStorage.getItem('access_token');
  return (
    <AssistantPanelProvider>
    <Routes>
      <Route path="/" element={token ? <Navigate to="/home" replace /> : <Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/shared/:id" element={<SharedBrain />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/home/notes"
        element={
          <ProtectedRoute>
            <NotesGallery />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assistant"
        element={
          <ProtectedRoute>
            <AssistantPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/class"
        element={
          <ProtectedRoute>
            <Brain />
          </ProtectedRoute>
        }
      />
      <Route
        path="/class/:classId/notes"
        element={
          <ProtectedRoute>
            <NoteView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/class/:classId/notes/:nodeId"
        element={
          <ProtectedRoute>
            <NoteView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/class/:classId/sources"
        element={
          <ProtectedRoute>
            <BrainSourcesView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/class/:classId/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ingest"
        element={
          <ProtectedRoute>
            <DocumentIngestion />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge-gap"
        element={
          <ProtectedRoute>
            <KnowledgeGapAnalysis />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {token ? <QuickSwitcher /> : null}
    {token ? <AssistantSlidePanel /> : null}
    </AssistantPanelProvider>
  );
}

export default App;
