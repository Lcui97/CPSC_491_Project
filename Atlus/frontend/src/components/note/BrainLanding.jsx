import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiUpload } from '../../api/client';
import { useBrainSources, useBrainAsk, brainKeys } from '../../api/brainQueries';
import { useQueryClient } from '@tanstack/react-query';

const ALLOWED_EXT = ['.pdf', '.docx', '.pptx', '.txt', '.md', '.markdown'];

function isDocument(file) {
  const ext = '.' + (file.name?.split('.').pop() || '').toLowerCase();
  return ALLOWED_EXT.includes(ext);
}

export default function BrainLanding() {
  const { brainId } = useParams();
  const queryClient = useQueryClient();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadDots, setUploadDots] = useState(0);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState(null);

  const { data: sources = [], refetch: refetchSources } = useBrainSources(brainId);
  const askMutation = useBrainAsk(brainId);

  // Animate "Uploading." / "Uploading.." / "Uploading..." while uploading
  useEffect(() => {
    if (!uploading) {
      setUploadDots(0);
      return;
    }
    const t = setInterval(() => setUploadDots((d) => (d + 1) % 3), 400);
    return () => clearInterval(t);
  }, [uploading]);

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

  async function handleUpload() {
    if (!brainId || selectedFiles.length === 0) return;
    setUploadMessage(null);
    setUploadDone(false);
    setUploading(true);
    try {
      const result = await apiUpload('/api/brain/ingest', { brain_id: brainId }, selectedFiles);
      const errors = result?.errors ?? [];
      if (errors.length > 0) {
        setUploadMessage({ error: errors.join(' ') });
      } else if (result?.processing) {
        setUploadMessage({ success: result?.message || 'Processing started. Your document will appear in Sources when ready.' });
        setSelectedFiles([]);
        setUploading(false);
        setUploadDone(true);
        const pollId = window.setInterval(() => refetchSources(), 5000);
        window.setTimeout(() => setUploadDone(false), 2000);
        window.setTimeout(() => clearInterval(pollId), 120000);
      } else {
        const nodes = result?.nodes_created ?? 0;
        setUploadMessage({ success: `Ingested ${nodes} node(s). Ready for another.` });
        setSelectedFiles([]);
        setUploading(false);
        setUploadDone(true);
        await queryClient.invalidateQueries({ queryKey: brainKeys.sources(brainId) });
        refetchSources();
        window.setTimeout(() => setUploadDone(false), 2000);
      }
    } catch (err) {
      setUploadMessage({ error: err.message || 'Upload failed' });
      setUploading(false);
    }
  }

  async function handleAsk(mode = 'summary') {
    if (!brainId) return;
    setResponse(null);
    const userPrompt = prompt.trim() || (mode === 'summary' ? 'Summarize the above.' : '');
    try {
      const data = await askMutation.mutateAsync({ prompt: userPrompt, mode });
      setResponse(data?.response || '');
    } catch (err) {
      setResponse(`Error: ${err.message || 'Request failed'}`);
    }
  }

  function handlePromptSubmit(e) {
    e.preventDefault();
    if (prompt.trim()) handleAsk('custom');
    else handleAsk('summary');
  }

  return (
    <div className="flex-1 overflow-auto min-h-0 flex flex-col">
      <div className="max-w-2xl mx-auto w-full p-6 space-y-8">
        {/* Welcome / how to use */}
        <section>
          <h1 className="text-xl font-semibold text-[rgb(var(--text))] mb-2">Welcome to your brain</h1>
          <p className="text-sm text-[rgb(var(--muted))] mb-2">
            Use <strong className="text-[rgb(var(--text))]">Notes</strong> in the sidebar to write and link ideas. Open the <strong className="text-[rgb(var(--text))]">Graph</strong> to see connections. Upload documents below and ask for summaries or study guides.
          </p>
        </section>

        {/* Upload */}
        <section className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[rgb(var(--text))] mb-2">Upload sources</h2>
          <p className="text-sm text-[rgb(var(--muted))] mb-3">
            Add PDF, DOCX, PPTX, or text. They’ll be processed for this brain.
          </p>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
              dragActive ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10' : 'border-[rgb(var(--border))] bg-[rgb(var(--panel2))]/50'
            }`}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.pptx,.txt,.md,.markdown"
              onChange={handleFileSelect}
              className="hidden"
              id="brain-landing-files"
            />
            <label htmlFor="brain-landing-files" className="cursor-pointer text-sm text-[rgb(var(--muted))]">
              Drag and drop or <span className="text-[rgb(var(--accent))] underline">browse</span>
            </label>
          </div>
          {selectedFiles.length > 0 && (
            <div className="mt-3">
              <ul className="space-y-1 mb-2">
                {selectedFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between text-sm">
                    <span className="text-[rgb(var(--text))] truncate">{f.name}</span>
                    <button type="button" onClick={() => removeFile(i)} className="text-[rgb(var(--muted))] hover:text-red-400 ml-2">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {uploadMessage && (
                <p className={`text-sm mb-2 ${uploadMessage.error ? 'text-red-400' : 'text-green-400'}`}>
                  {uploadMessage.error || uploadMessage.success}
                </p>
              )}
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] disabled:opacity-50 text-white text-sm font-medium min-w-[140px]"
              >
                {uploadDone ? 'Done ✓' : uploading ? `Uploading${'.'.repeat(uploadDots + 1)}` : 'Ingest into brain'}
              </button>
            </div>
          )}
        </section>

        {/* Sources */}
        <section className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[rgb(var(--text))] mb-2">Sources in this brain</h2>
          {sources.length === 0 ? (
            <p className="text-sm text-[rgb(var(--muted))]">No documents yet. Upload files above.</p>
          ) : (
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-sm text-[rgb(var(--text))]">
                  <span className="truncate flex-1">{s.filename}</span>
                  <span className="text-[rgb(var(--muted))] text-xs">{s.file_type}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Gemini-style prompt + quick actions */}
        <section className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-[rgb(var(--text))] mb-2">Ask your brain</h2>
          <p className="text-sm text-[rgb(var(--muted))] mb-3">
            Get summaries, study guides, or key points from your notes.
          </p>
          <form onSubmit={handlePromptSubmit} className="flex gap-2 items-center rounded-xl bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] px-3 py-2 focus-within:ring-2 focus-within:ring-[rgb(var(--accent))]">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything about your notes..."
              className="flex-1 min-w-0 bg-transparent text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none text-sm py-1"
            />
            <button
              type="submit"
              disabled={askMutation.isPending}
              className="shrink-0 p-2 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] disabled:opacity-50 text-white"
              title="Send"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={() => handleAsk('summary')}
              disabled={askMutation.isPending}
              className="py-1.5 px-3 rounded-full bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]/50 disabled:opacity-50 text-xs font-medium"
            >
              Summarize
            </button>
            <button
              type="button"
              onClick={() => handleAsk('study_guide')}
              disabled={askMutation.isPending}
              className="py-1.5 px-3 rounded-full bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]/50 disabled:opacity-50 text-xs font-medium"
            >
              Study guide
            </button>
            <button
              type="button"
              onClick={() => handleAsk('key_points')}
              disabled={askMutation.isPending}
              className="py-1.5 px-3 rounded-full bg-[rgb(var(--panel2))] border border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--border))]/50 disabled:opacity-50 text-xs font-medium"
            >
              Key points
            </button>
          </div>
          {response !== null && (
            <div className="mt-4 p-4 rounded-lg bg-[rgb(var(--panel2))] border border-[rgb(var(--border))]">
              <div className="text-sm text-[rgb(var(--text))] whitespace-pre-wrap">{response}</div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
