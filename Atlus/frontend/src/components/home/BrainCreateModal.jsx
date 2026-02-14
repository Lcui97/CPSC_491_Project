import { useState, useCallback } from 'react';
import { api, apiUpload } from '../../api/client';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const ACCEPT = '.pdf,.txt,.md,.markdown,.jpg,.jpeg,.png';
const BADGES = ['Notes', 'Textbook', 'Compare'];

export default function BrainCreateModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [badge, setBadge] = useState('Notes');
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('form'); // 'form' | 'handwritten' | 'done'
  const [createdBrain, setCreatedBrain] = useState(null);
  const [pendingImages, setPendingImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const isImage = (file) => /\.(jpe?g|png)$/i.test(file.name);
  const pdfOrText = (file) => /\.(pdf|txt|md|markdown)$/i.test(file.name);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = Array.from(e.dataTransfer?.files || []).filter(
      (f) => f.name && (isImage(f) || pdfOrText(f))
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const selected = Array.from(e.target.files || []).filter(
      (f) => f.name && (isImage(f) || pdfOrText(f))
    );
    setFiles((prev) => [...prev, ...selected]);
    e.target.value = '';
  }, []);

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const imageFiles = files.filter(isImage);
  const documentFiles = files.filter(pdfOrText);

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const payload = { name: (name || 'New Brain').trim(), badge };
      let brain;
      if (documentFiles.length > 0 && imageFiles.length === 0) {
        brain = await apiUpload('/api/brain/create', payload, documentFiles);
      } else {
        brain = await apiUpload('/api/brain/create', payload, documentFiles);
      }
      const brainData = brain.brain;
      setCreatedBrain(brainData);

      if (imageFiles.length > 0) {
        setPendingImages(imageFiles);
        setCurrentImageIndex(0);
        setStep('handwritten');
        setOcrResult(null);
      } else {
        setStep('done');
        onCreated?.(brainData);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to create brain');
    } finally {
      setCreating(false);
    }
  };

  const currentImage = pendingImages[currentImageIndex];
  const showHandwrittenStep = step === 'handwritten' && currentImage;

  const runOcr = async () => {
    if (!createdBrain || !currentImage) return;
    setOcrLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('brain_id', createdBrain.id);
      form.append('file', currentImage);
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/brain/ocr`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OCR failed');
      setOcrResult(data);
    } catch (err) {
      setError(err.message || 'OCR failed');
    } finally {
      setOcrLoading(false);
    }
  };

  const saveOcrAsNode = async () => {
    if (!createdBrain || !ocrResult?.markdown) return;
    setError(null);
    try {
      await api('/api/brain/generate-nodes', {
        method: 'POST',
        body: JSON.stringify({
          brain_id: createdBrain.id,
          markdown: ocrResult.markdown,
        }),
      });
      if (currentImageIndex + 1 >= pendingImages.length) {
        setStep('done');
        onCreated?.(createdBrain);
        onClose();
      } else {
        setCurrentImageIndex((i) => i + 1);
        setOcrResult(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to save note');
    }
  };

  const skipHandwritten = () => {
    if (currentImageIndex + 1 >= pendingImages.length) {
      setStep('done');
      onCreated?.(createdBrain);
      onClose();
    } else {
      setCurrentImageIndex((i) => i + 1);
      setOcrResult(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-[rgb(var(--panel))] border border-[rgb(var(--border))] rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--border))]">
          <h2 className="text-lg font-semibold text-[rgb(var(--text))]">
            {showHandwrittenStep ? 'Handwritten note' : 'Create Brain'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[rgb(var(--muted))] hover:bg-[rgb(var(--panel2))] hover:text-[rgb(var(--text))]"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!showHandwrittenStep && (
            <>
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--text))] mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CS 101 Notes"
                  className="w-full px-3 py-2 rounded-lg bg-[rgb(var(--bg))] border border-[rgb(var(--border))] text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[rgb(var(--text))] mb-1">Type</label>
                <div className="flex gap-2 flex-wrap">
                  {BADGES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBadge(b)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        badge === b
                          ? 'bg-[rgb(var(--accent))] text-white'
                          : 'bg-[rgb(var(--panel2))] text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[rgb(var(--text))] mb-2">
                  Add documents (at creation)
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                    dragActive ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10' : 'border-[rgb(var(--border))] bg-[rgb(var(--panel2))]'
                  }`}
                >
                  <p className="text-[rgb(var(--muted))] text-sm mb-3">
                    PDF, JPEG/PNG, TXT, Markdown
                  </p>
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT}
                    onChange={handleFileSelect}
                    className="hidden"
                    id="brain-create-files"
                  />
                  <label
                    htmlFor="brain-create-files"
                    className="inline-block py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium cursor-pointer transition-colors"
                  >
                    Select files
                  </label>
                </div>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((file, i) => (
                      <li
                        key={`${file.name}-${i}`}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-[rgb(var(--panel2))] text-sm text-[rgb(var(--text))]"
                      >
                        <span className="truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="shrink-0 ml-2 text-[rgb(var(--muted))] hover:text-red-500"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {showHandwrittenStep && (
            <div className="grid grid-cols-2 gap-4 min-h-[320px]">
              <div className="border border-[rgb(var(--border))] rounded-lg overflow-hidden bg-[rgb(var(--bg))] flex items-center justify-center p-2">
                <img
                  src={URL.createObjectURL(currentImage)}
                  alt="Note"
                  className="max-w-full max-h-[300px] object-contain"
                />
              </div>
              <div className="border border-[rgb(var(--border))] rounded-lg overflow-hidden bg-[rgb(var(--bg))] p-3">
                {!ocrResult ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    {ocrLoading ? (
                      <p className="text-[rgb(var(--muted))] text-sm">Converting to Markdown…</p>
                    ) : (
                      <>
                        <p className="text-[rgb(var(--muted))] text-sm mb-3">
                          Generate Markdown from this note
                        </p>
                        <button
                          type="button"
                          onClick={runOcr}
                          className="py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium"
                        >
                          Convert to Markdown
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    <pre className="flex-1 overflow-auto text-xs text-[rgb(var(--text))] whitespace-pre-wrap font-sans">
                      {ocrResult.markdown}
                    </pre>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={saveOcrAsNode}
                        className="py-1.5 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm"
                      >
                        Save as node
                      </button>
                      <button
                        type="button"
                        onClick={skipHandwritten}
                        className="py-1.5 px-3 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] text-sm hover:text-[rgb(var(--text))]"
                      >
                        {currentImageIndex + 1 >= pendingImages.length ? 'Done' : 'Skip'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="px-4 pb-2">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[rgb(var(--border))]">
          {!showHandwrittenStep && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white font-medium disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create Brain'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
