import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { brainKeys } from '../../api/brainQueries';

const API_URL = import.meta.env.VITE_API_URL ?? '';
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff';

/**
 * Upload a PDF or image from the class landing page → OCR → new note (handwritten split when linked to a file).
 */
export default function BrainHandwrittenUpload({ brainId }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !brainId) return;

    setError('');
    setPhase('ocr');
    try {
      const form = new FormData();
      form.append('brain_id', brainId);
      form.append('file', file);
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_URL}/api/brain/ocr`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not read this file.');

      const markdown = (data.markdown || '').trim();
      if (!markdown) {
        throw new Error('No text was recognized. Try a clearer scan or a higher-resolution image.');
      }

      setPhase('save');
      const gen = await api('/api/brain/generate-nodes', {
        method: 'POST',
        body: JSON.stringify({
          brain_id: brainId,
          markdown,
          source_file_id: data.source_file_id ?? undefined,
          node_type: data.source_file_id != null ? 'handwritten' : 'note',
        }),
      });
      const nodeId = gen?.node_ids?.[0];
      if (!nodeId) throw new Error('The note could not be created.');

      await queryClient.invalidateQueries({ queryKey: ['brains', brainId, 'nodes'] });
      await queryClient.invalidateQueries({ queryKey: brainKeys.sources(brainId) });
      setPhase('idle');
      navigate(`/brain/${brainId}/notes/${nodeId}`);
    } catch (err) {
      setError(err.message || 'Something went wrong.');
      setPhase('idle');
    }
  }

  const busy = phase !== 'idle';
  const label =
    phase === 'ocr' ? 'Reading scan…' : phase === 'save' ? 'Creating note…' : 'Upload handwritten note (PDF or image)';

  return (
    <section className="panel-rgb brain-handwritten-upload">
      <h2 className="brain-handwritten-upload-title">New note from a scan</h2>
      <p className="brain-handwritten-upload-desc">
        Upload a <strong>PDF</strong> or <strong>PNG</strong> (or other image) of handwritten notes. We run OCR, create a
        new note, and open it — scans stay beside the Markdown editor when supported.
      </p>
      <input
        ref={inputRef}
        id="brain-handwritten-file"
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={(ev) => void handleFileChange(ev)}
      />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={busy || !brainId}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
      {error ? <p className="brain-handwritten-upload-error">{error}</p> : null}
    </section>
  );
}
