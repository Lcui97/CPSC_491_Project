import { useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/home/TopBar';

export default function DocumentIngestion() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer?.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  }

  function removeFile(index) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleIngest() {
    alert('Document ingestion — backend coming soon.');
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
              accept=".pdf,.txt,.md,.doc,.docx"
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
              <button
                type="button"
                onClick={handleIngest}
                className="w-full py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white font-medium transition-colors"
              >
                Ingest Documents
              </button>
            </div>
          )}

          <p className="text-sm text-[rgb(var(--muted))]">
            Supported formats: PDF, TXT, Markdown, Word (.doc, .docx)
          </p>
        </div>
      </main>
    </div>
  );
}
