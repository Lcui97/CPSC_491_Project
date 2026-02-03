import { useNavigate } from 'react-router-dom';

export default function QuickActions() {
  const navigate = useNavigate();

  function handleUploadNotes() {
    alert('Upload Notes — coming soon.');
  }

  function handleUploadTextbook() {
    alert('Upload Textbook — coming soon.');
  }

  function handleOpenBrainMap() {
    navigate('/brain');
  }

  return (
    <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
      <h2 className="text-sm font-medium text-[rgb(var(--text))] mb-3">Quick Actions</h2>
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleUploadNotes}
          className="w-full py-2 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium text-left transition-colors"
        >
          Upload Notes
        </button>
        <button
          type="button"
          onClick={handleUploadTextbook}
          className="w-full py-2 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium text-left transition-colors"
        >
          Upload Textbook
        </button>
        <button
          type="button"
          onClick={handleOpenBrainMap}
          className="w-full py-2 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium text-left transition-colors"
        >
          Open Brain Map
        </button>
      </div>
    </div>
  );
}
