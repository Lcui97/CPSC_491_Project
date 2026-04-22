import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import TopBar from '../components/home/TopBar';
import { api, apiUpload } from '../api/client';
import { useUploadSyllabus } from '../api/brainQueries';

const ALLOWED_EXT = [
  '.pdf', '.docx', '.pptx', '.txt', '.md', '.markdown',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff',
];

function isDocument(file) {
  const ext = '.' + (file.name?.split('.').pop() || '').toLowerCase();
  return ALLOWED_EXT.includes(ext);
}

export default function DocumentIngestion() {
  const [searchParams] = useSearchParams();
  const brainFromQuery = (searchParams.get('brain') || '').trim();

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
      .then((r) => setBrains(r.brains || []))
      .catch(() => setBrains([]));
  }, []);

  useEffect(() => {
    if (!brains.length) {
      setSelectedBrainId('');
      return;
    }
    if (brainFromQuery && brains.some((b) => b.id === brainFromQuery)) {
      setSelectedBrainId(brainFromQuery);
      return;
    }
    setSelectedBrainId((prev) => (prev && brains.some((b) => b.id === prev) ? prev : brains[0].id));
  }, [brains, brainFromQuery]);

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
      setMessage({
        error: 'Add at least one supported file: PDF, DOCX, PPTX, text/Markdown, or a scan (JPG, PNG, WebP, etc.).',
      });
      return;
    }
    setIngesting(true);
    try {
      const result = await apiUpload('/api/brain/ingest', { brain_id: selectedBrainId }, files);
      const nodes = result?.nodes_created ?? 0;
      const errors = result?.errors ?? [];
      const errText = errors.length ? errors.join(' ') : '';

      if (result?.processing) {
        window.dispatchEvent(new CustomEvent('atlus-ingest-pending', { detail: { pending: true } }));
        setMessage({
          info: result?.message || 'Upload received. Processing runs in the background — Sources in the brain view can take several minutes to update (longer for large files).',
        });
        setSelectedFiles([]);
      } else if (errors.length > 0 && nodes === 0) {
        window.dispatchEvent(new CustomEvent('atlus-ingest-pending', { detail: { pending: false } }));
        setMessage({ error: errText });
      } else if (errors.length > 0 && nodes > 0) {
        window.dispatchEvent(new CustomEvent('atlus-ingest-pending', { detail: { pending: false } }));
        setMessage({ info: `Ingested ${nodes} note(s). Some files had issues: ${errText}` });
        setSelectedFiles([]);
      } else {
        window.dispatchEvent(new CustomEvent('atlus-ingest-pending', { detail: { pending: false } }));
        setMessage({ success: `Ingested ${nodes} note(s).` });
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

  const dropStyle = {
    border: dragActive ? '2px dashed rgb(var(--accent))' : '2px dashed rgb(var(--border))',
    background: dragActive ? 'rgba(19, 181, 234, 0.08)' : 'rgb(var(--panel))',
  };

  const msgBoxStyle = message?.error
    ? { border: '1px solid rgba(220, 38, 38, 0.4)', background: 'rgba(254, 226, 226, 0.5)', color: '#991b1b' }
    : message?.success
      ? { border: '1px solid rgba(16, 185, 129, 0.4)', background: 'rgba(209, 250, 229, 0.5)', color: '#065f46' }
      : { border: '1px solid rgba(245, 158, 11, 0.35)', background: 'rgba(254, 243, 199, 0.4)', color: '#92400e' };

  return (
    <div className="ingest-page">
      <TopBar breadcrumb="Home › Ingest" />
      <main className="ingest-main">
        <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: 'rgb(var(--text))' }}>Document Ingestion</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {brainFromQuery && brains.some((b) => b.id === brainFromQuery) ? (
              <Link
                to={`/brain/${encodeURIComponent(brainFromQuery)}/notes`}
                className="text-link"
                style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))' }}
              >
                ← Back to class notes
              </Link>
            ) : null}
            <Link to="/home" className="text-link" style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))' }}>
              ← Back to Home
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {brains.length > 0 ? (
            <div className="panel-rgb">
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: 'rgb(var(--text))' }}>
                Ingest into brain
              </label>
              <select
                value={selectedBrainId}
                onChange={(e) => setSelectedBrainId(e.target.value)}
                className="input"
              >
                {brains.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="panel-rgb">
              <p style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))', margin: 0 }}>Create a brain first in Home before uploading documents or syllabus.</p>
            </div>
          )}

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className="ingest-drop"
            style={dropStyle}
          >
            <p style={{ color: 'rgb(var(--muted))', marginBottom: '1rem' }}>
              Drag and drop here, or browse — includes PDFs, Office docs, Markdown/text, and photos (JPG, PNG, …) for OCR.
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-input"
            />
            <label htmlFor="file-input" className="btn btn-primary" style={{ cursor: 'pointer' }}>
              Select Files
            </label>
          </div>

          <div className="panel-rgb">
            <h2 style={{ fontSize: '0.875rem', fontWeight: 500, margin: '0 0 0.5rem', color: 'rgb(var(--text))' }}>Syllabus to calendar</h2>
            <p style={{ fontSize: '0.75rem', color: 'rgb(var(--muted))', margin: '0 0 0.75rem' }}>
              Upload one syllabus and Atlus will extract quizzes, tests, midterms, finals, and project deadlines into your calendar.
            </p>
            <div className="flex flex-col gap-2" style={{ alignItems: 'stretch' }}>
              <input
                type="file"
                accept=".pdf,.docx,.pptx,.txt,.md,.markdown"
                onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                className="flex-1"
                style={{ fontSize: '0.875rem', color: 'rgb(var(--text))' }}
              />
              <button
                type="button"
                onClick={handleSyllabusUpload}
                disabled={uploadSyllabus.isPending}
                className="btn btn-primary"
              >
                {uploadSyllabus.isPending ? 'Parsing syllabus…' : 'Upload syllabus'}
              </button>
            </div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'rgb(var(--muted))' }}>
              Selected: {syllabusFile?.name || 'No syllabus file selected'}
              {selectedBrainId ? '' : ' · Select a brain above first'}
            </p>
            {syllabusResult?.events?.length ? (
              <div style={{ marginTop: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgb(var(--border))', background: 'rgb(var(--panel2))', padding: '0.75rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'rgb(var(--muted))', margin: '0 0 0.5rem' }}>Extracted events (saved, editable in Calendar):</p>
                <ul style={{ maxHeight: '13rem', overflow: 'auto', margin: 0, paddingLeft: '1.25rem' }}>
                  {syllabusResult.events.map((ev) => (
                    <li key={ev.id} style={{ fontSize: '0.875rem', color: 'rgb(var(--text))' }}>
                      {new Date(ev.due_at).toLocaleDateString()} - [{ev.event_type}] {ev.title}
                    </li>
                  ))}
                </ul>
                <Link to={`/brain/${selectedBrainId}/calendar`} className="text-link" style={{ fontSize: '0.75rem', display: 'inline-block', marginTop: '0.5rem' }}>
                  Open brain calendar
                </Link>
              </div>
            ) : null}
          </div>

          {selectedFiles.length > 0 && (
            <div className="panel-rgb">
              <h2 style={{ fontSize: '0.875rem', fontWeight: 500, margin: '0 0 0.75rem', color: 'rgb(var(--text))' }}>
                Selected files ({selectedFiles.length})
              </h2>
              <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0 }}>
                {selectedFiles.map((file, i) => (
                  <li
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between"
                    style={{
                      padding: '0.5rem 0.75rem',
                      marginBottom: '0.5rem',
                      borderRadius: '0.5rem',
                      background: 'rgb(var(--panel2))',
                      border: '1px solid rgb(var(--border))',
                    }}
                  >
                    <span className="truncate flex-1" style={{ fontSize: '0.875rem', color: 'rgb(var(--text))' }}>
                      {file.name}
                    </span>
                    <button type="button" onClick={() => removeFile(i)} className="text-link" style={{ fontSize: '0.75rem', marginLeft: '0.5rem', color: 'rgb(var(--muted))' }}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleIngest}
                disabled={ingesting || !selectedBrainId}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                {ingesting ? 'Processing… (large PDFs can take several minutes)' : 'Ingest documents'}
              </button>
            </div>
          )}

          {message && (
            <div style={{ borderRadius: '0.75rem', padding: '1rem', fontSize: '0.875rem', ...msgBoxStyle }}>
              {message.error || message.success || message.info}
            </div>
          )}

          <p style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))' }}>
            Supported formats: PDF, DOCX, PPTX, TXT, Markdown, and scans (JPG, PNG, etc.). With the default SQLite setup, ingest finishes in this tab and you get a note count or error details. If the server uses a different database, ingest may run in the background and Sources will update when done.
          </p>
        </div>
      </main>
    </div>
  );
}
