import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/home/TopBar';
import { api, apiUpload } from '../api/client';

const ALLOWED_EXT = ['.pdf', '.txt', '.md', '.markdown'];

function isDocument(file) {
  const ext = '.' + (file.name?.split('.').pop() || '').toLowerCase();
  return ALLOWED_EXT.includes(ext);
}

export default function DocumentIngestion() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [brains, setBrains] = useState([]);
  const [selectedBrainId, setSelectedBrainId] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api('/api/brain/list')
      .then((r) => {
        const list = r.brains || [];
        setBrains(list);
        if (list.length > 0 && !selectedBrainId) setSelectedBrainId(list[0].id);
      })
      .catch(() => setBrains([]));
  }, []);

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer?.files || []).filter(isDocument);
    setSelectedFiles((prev) => [...prev, ...files]);
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []).filter(isDocument);
    setSelectedFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  }

  function removeFile(index) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleIngest() {
    setMessage(null);
    if (!selectedBrainId) {
      setMessage({ error: 'Select a brain to ingest into.' });
      return;
    }
    const files = selectedFiles.filter(isDocument);
    if (files.length === 0) {
      setMessage({ error: 'Add at least one PDF, TXT, or Markdown file.' });
      return;
    }
    setIngesting(true);
    try {
      const result = await apiUpload('/api/brain/ingest', { brain_id: selectedBrainId }, files);
      const nodes = result?.nodes_created ?? 0;
      const links = result?.links_created ?? 0;
      const errors = result?.errors ?? [];
      if (errors.length > 0) {
        setMessage({ error: errors.join(' ') });
      } else {
        setMessage({ success: `Ingested ${nodes} node(s), ${links} link(s) created.` });
        setSelectedFiles([]);
      }
    } catch (err) {
      setMessage({ error: err.message || 'Failed to fetch' });
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-[rgb(var(--text))]">Document Ingestion</h1>
          <Link
            to="/home"
            className="text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--text))] transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        <div className="space-y-6">
          {/* Drop zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive
                ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10'
                : 'border-[rgb(var(--border))] bg-[rgb(var(--panel))]'
            }`}
          >
            <p className="text-[rgb(var(--muted))] mb-4">
              Drag and drop documents here, or click to browse
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.txt,.md,.markdown"
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="inline-block py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium cursor-pointer transition-colors"
            >
              Select Files
            </label>
          </div>

          {/* Brain selector */}
          {brains.length > 0 && (
            <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
              <label className="block text-sm font-medium text-[rgb(var(--text))] mb-2">
                Ingest into brain
              </label>
              <select
                value={selectedBrainId}
                onChange={(e) => setSelectedBrainId(e.target.value)}
                className="w-full py-2 px-3 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] text-sm"
              >
                {brains.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Selected files */}
          {selectedFiles.length > 0 && (
            <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
              <h2 className="text-sm font-medium text-[rgb(var(--text))] mb-3">
                Selected files ({selectedFiles.length})
              </h2>
              <ul className="space-y-2 mb-4">
                {selectedFiles.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))]"
                  >
                    <span className="text-sm text-[rgb(var(--text))] truncate flex-1">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="ml-2 text-xs text-[rgb(var(--muted))] hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {message && (
                <p className={`mb-3 text-sm ${message.error ? 'text-red-500' : 'text-green-600'}`}>
                  {message.error || message.success}
                </p>
              )}
              <button
                type="button"
                onClick={handleIngest}
                disabled={ingesting || !selectedBrainId}
                className="w-full py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] disabled:opacity-50 text-white font-medium transition-colors"
              >
                {ingesting ? 'Ingesting…' : 'Ingest Documents'}
              </button>
            </div>
          )}

          <p className="text-sm text-[rgb(var(--muted))]">
            Supported formats: PDF, TXT, Markdown. Select a brain above, add files, then click Ingest.
          </p>
        </div>
      </main>
    </div>
  );
}
