import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssistantPanel } from '../../context/AssistantPanelContext';
import ClassAssistantChat, { IconAssistantPerson } from './ClassAssistantChat';

/** Fixed right dock: resize by dragging the left edge; minimize to a slim rail. */
export default function AssistantSlidePanel() {
  const navigate = useNavigate();
  const {
    isOpen,
    closePanel,
    minimizePanel,
    restorePanel,
    isMinimized,
    panelWidth,
    setPanelWidth,
  } = useAssistantPanel();

  const onResizeMouseDown = useCallback(
    (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = panelWidth;
      function move(ev) {
        const dx = startX - ev.clientX;
        setPanelWidth(startW + dx);
      }
      function up() {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      }
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    },
    [panelWidth, setPanelWidth]
  );

  if (!isOpen) return null;

  if (isMinimized) {
    return (
      <div className="assistant-slide-rail" role="complementary" aria-label="Assistant collapsed">
        <button type="button" className="assistant-slide-rail-btn" onClick={restorePanel} title="Expand assistant">
          <IconAssistantPerson className="assistant-slide-rail-ico" />
          <span className="assistant-slide-rail-text">AI</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      className="assistant-slide-panel"
      style={{ width: panelWidth }}
      role="complementary"
      aria-label="Class assistant"
    >
      <div
        className="assistant-slide-resize"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize assistant panel"
        title="Drag to resize width"
        onMouseDown={onResizeMouseDown}
      />
      <div className="assistant-slide-head">
        <span className="assistant-slide-title">Assistant</span>
        <div className="assistant-slide-head-actions">
          <button type="button" className="assistant-slide-icon-btn" onClick={() => navigate('/assistant')} title="Open full page">
            ⛶
          </button>
          <button type="button" className="assistant-slide-icon-btn" onClick={minimizePanel} title="Minimize to strip">
            ─
          </button>
          <button type="button" className="assistant-slide-icon-btn" onClick={closePanel} title="Close">
            ×
          </button>
        </div>
      </div>
      <div className="assistant-slide-body">
        <ClassAssistantChat embedded />
      </div>
    </aside>
  );
}
