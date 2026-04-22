import { useState, useCallback, useMemo, useEffect } from 'react';
import { api, apiUpload } from '../../api/client';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const ACCEPT = '.pdf,.docx,.pptx,.txt,.md,.markdown,.jpg,.jpeg,.png,.webp,.gif';
const BADGES = ['Notes', 'Textbook', 'Compare'];

export default function BrainCreateModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [badge, setBadge] = useState('Notes');
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('form');
  const [createdBrain, setCreatedBrain] = useState(null);
  const [pendingImages, setPendingImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [ocrResult, setOcrResult] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const isImage = (file) => /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(file.name);
  const isPdfFile = (file) => /\.pdf$/i.test(file?.name || '');
  const pdfOrText = (file) => /\.(pdf|docx|pptx|txt|md|markdown)$/i.test(file.name);

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

  const handwrittenFiles = files.filter((f) => isImage(f) || isPdfFile(f));
  const documentFiles = files.filter((f) => pdfOrText(f) && !isImage(f) && !isPdfFile(f));

  const handleCreate = async () => {
    setError(null);
    setCreating(true);
    try {
      const payload = { name: (name || 'New class').trim(), badge };
      let brain;
      if (documentFiles.length > 0) {
        brain = await apiUpload('/api/brain/create', payload, documentFiles);
      } else {
        brain = await api('/api/brain/create', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      const brainData = brain.brain;
      setCreatedBrain(brainData);

      if (handwrittenFiles.length > 0) {
        setPendingImages(handwrittenFiles);
        setCurrentImageIndex(0);
        setStep('handwritten');
        setOcrResult(null);
      } else {
        setStep('done');
        onCreated?.(brainData);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to create class');
    } finally {
      setCreating(false);
    }
  };

  const currentImage = pendingImages[currentImageIndex];
  const showHandwrittenStep = step === 'handwritten' && currentImage;

  const localPreviewUrl = useMemo(() => {
    if (!currentImage) return null;
    return URL.createObjectURL(currentImage);
  }, [currentImage]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

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
          source_file_id: ocrResult.source_file_id ?? undefined,
          node_type: ocrResult.source_file_id != null ? 'handwritten' : undefined,
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
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="modal-card-header">
          <h2 className="modal-card-title">
            {showHandwrittenStep ? 'Handwritten note' : 'Create class'}
          </h2>
          <button type="button" onClick={onClose} className="modal-close-btn" aria-label="Close">
            ✕
          </button>
        </div>

        <div className={`modal-card-body ${!showHandwrittenStep ? 'stack' : ''}`}>
          {!showHandwrittenStep && (
            <>
              <div>
                <label className="form-label" htmlFor="brain-create-name">
                  Name
                </label>
                <input
                  id="brain-create-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CS 101 Notes"
                  className="field-input"
                />
              </div>
              <div>
                <span className="form-label">Type</span>
                <div className="badge-pill-group">
                  {BADGES.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBadge(b)}
                      className={`badge-pill ${badge === b ? 'is-on' : ''}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="form-label" htmlFor="brain-create-files">
                  Add documents (at creation)
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`drop-zone ${dragActive ? 'is-active' : ''}`}
                >
                  <p style={{ color: 'rgb(var(--muted))', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                    PDF, DOCX, PPTX, TXT, Markdown, or JPEG/PNG (handwriting uses OCR after create)
                  </p>
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    id="brain-create-files"
                  />
                  <label htmlFor="brain-create-files" className="btn-sm-ocr" style={{ display: 'inline-block', cursor: 'pointer' }}>
                    Select files
                  </label>
                </div>
                {files.length > 0 && (
                  <ul style={{ listStyle: 'none', margin: '0.5rem 0 0', padding: 0 }}>
                    {files.map((file, i) => (
                      <li key={`${file.name}-${i}`} className="file-list-row">
                        <span className="truncate">{file.name}</span>
                        <button type="button" onClick={() => removeFile(i)} className="btn-ghost-danger">
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
            <div className="brain-create-ocr-grid">
              <div className="ocr-preview-box">
                {localPreviewUrl ? (
                  isPdfFile(currentImage) ? (
                    <iframe title="Uploaded PDF" src={localPreviewUrl} className="ocr-preview-iframe" />
                  ) : (
                    <img src={localPreviewUrl} alt="Note" />
                  )
                ) : null}
              </div>
              <div className="ocr-md-box">
                {!ocrResult ? (
                  <div className="flex flex-col items-center justify-center text-center" style={{ flex: 1, minHeight: 180 }}>
                    {ocrLoading ? (
                      <p style={{ color: 'rgb(var(--muted))', fontSize: '0.875rem', margin: 0 }}>
                        Converting to Markdown… This can take a few minutes for PDFs or scans.
                      </p>
                    ) : (
                      <>
                        <p style={{ color: 'rgb(var(--muted))', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                          Generate Markdown from this note
                        </p>
                        <button type="button" onClick={runOcr} className="btn-sm-ocr">
                          Convert to Markdown
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <pre className="ocr-md-pre">{ocrResult.markdown}</pre>
                    <div className="flex gap-2" style={{ marginTop: '0.5rem' }}>
                      <button type="button" onClick={saveOcrAsNode} className="btn-sm-ocr">
                        Save as node
                      </button>
                      <button type="button" onClick={skipHandwritten} className="btn-outline-muted">
                        {currentImageIndex + 1 >= pendingImages.length ? 'Done' : 'Skip'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {error ? (
          <div className="modal-error">
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        ) : null}

        {!showHandwrittenStep ? (
          <div className="modal-card-footer">
            <button type="button" onClick={onClose} className="btn-outline-muted" style={{ padding: '0.5rem 1rem' }}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="btn-sm-ocr"
              style={{ padding: '0.5rem 1rem', opacity: creating ? 0.6 : 1 }}
            >
              {creating ? 'Creating…' : 'Create class'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
