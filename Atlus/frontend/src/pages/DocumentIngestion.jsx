import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/home/TopBar';
import { api, apiUpload } from '../api/client';
import { useUploadSyllabus } from '../api/brainQueries';

const ALLOWED_EXT = ['.pdf', '.docx', '.pptx', '.txt', '.md', '.markdown'];

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
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [syllabusResult, setSyllabusResult] = useState(null);
  const uploadSyllabus = useUploadSyllabus();

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
      setMessage({ error: 'Add at least one PDF, DOCX, PPTX, TXT, or Markdown file.' });
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
      } else if (result?.processing) {
        window.dispatchEvent(new CustomEvent('atlus-ingest-pending', { detail: { pending: true } }));
        setMessage({
          info:
            result?.message ||
            'Upload received. Processing runs in the background — Sources in the brain view can take several minutes to update (longer for large files).',
        });
        setSelectedFiles([]);
      } else {
        window.dispatchEvent(new CustomEvent('atlus-ingest-pending', { detail: { pending: false } }));
        setMessage({ success: `Ingested ${nodes} node(s), ${links} link(s) created.` });
        setSelectedFiles([]);
      }
    } catch (err) {
      setMessage({ error: err.message || 'Failed to fetch' });
    } finally {
      setIngesting(false);
    }
  }

  async function handleSyllabusUpload() {
    setMessage(null);
    setSyllabusResult(null);
    if (!selectedBrainId) {
      setMessage({ error: 'Select a brain first.' });
      return;
    }
    if (!syllabusFile) {
      setMessage({ error: 'Select one syllabus file (PDF, DOCX, PPTX, TXT, MD).' });
      return;
    }
    try {
      const result = await uploadSyllabus.mutateAsync({ brainId: selectedBrainId, file: syllabusFile });
      setSyllabusResult(result);
      setMessage({ success: `Parsed ${result?.count || 0} calendar event(s) from syllabus.` });
      setSyllabusFile(null);
    } catch (err) {
      setMessage({ error: err.message || 'Syllabus parsing failed.' });
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <TopBar breadcrumb="Home › Ingest" />
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
          {brains.length > 0 ? (
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
          ) : (
            <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
              <p className="text-sm text-[rgb(var(--muted))]">Create a brain first in Home before uploading documents or syllabus.</p>
            </div>
          )}

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
              accept=".pdf,.docx,.pptx,.txt,.md,.markdown"
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

          <div className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
            <h2 className="text-sm font-medium text-[rgb(var(--text))] mb-2">Syllabus to calendar</h2>
            <p className="text-xs text-[rgb(var(--muted))] mb-3">
              Upload one syllabus and Atlus will extract quizzes, tests, midterms, finals, and project deadlines into your calendar.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="file"
                accept=".pdf,.docx,.pptx,.txt,.md,.markdown"
                onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                className="flex-1 text-sm text-[rgb(var(--text))]"
              />
              <button
                type="button"
                onClick={handleSyllabusUpload}
                disabled={uploadSyllabus.isPending}
                className="h-10 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] disabled:opacity-50 text-white text-sm font-medium"
              >
                {uploadSyllabus.isPending ? 'Parsing syllabus…' : 'Upload syllabus'}
              </button>
            </div>
            <p className="mt-2 text-xs text-[rgb(var(--muted))]">
              Selected: {syllabusFile?.name || 'No syllabus file selected'}
              {selectedBrainId ? '' : ' · Select a brain above first'}
            </p>
            {syllabusResult?.events?.length ? (
              <div className="mt-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--panel2))] p-3">
                <p className="text-xs text-[rgb(var(--muted))] mb-2">Extracted events (saved, editable in Calendar):</p>
                <ul className="space-y-1 max-h-52 overflow-auto">
                  {syllabusResult.events.map((ev) => (
                    <li key={ev.id} className="text-sm text-[rgb(var(--text))]">
                      {new Date(ev.due_at).toLocaleDateString()} - [{ev.event_type}] {ev.title}
                    </li>
                  ))}
                </ul>
                <Link to={`/brain/${selectedBrainId}/calendar`} className="inline-block mt-2 text-xs text-[rgb(var(--accent))] hover:underline">
                  Open brain calendar
                </Link>
              </div>
            ) : null}
          </div>

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
              <button
                type="button"
                onClick={handleIngest}
                disabled={ingesting || !selectedBrainId}
                className="w-full py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] disabled:opacity-50 text-white font-medium transition-colors"
              >
                {ingesting ? 'Sending…' : 'Ingest documents'}
              </button>
            </div>
          )}

          {message && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                message.error
                  ? 'border-red-500/40 bg-red-500/10 text-red-800'
                  : message.success
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800'
                    : 'border-amber-500/30 bg-amber-500/5 text-amber-800'
              }`}
            >
              {message.error || message.success || message.info}
            </div>
          )}

          <p className="text-sm text-[rgb(var(--muted))]">
            Supported formats: PDF, DOCX, PPTX, TXT, Markdown. Ingest is asynchronous — the brain&apos;s Sources list updates when the server finishes (often a few minutes).
          </p>
        </div>
      </main>
    </div>
  );
}
