// split view: picture on left, typing on right after ocr
export default function HandwrittenNotesSplitView({
  imageUrl,
  imageFile,
  markdown = '',
  loading = false,
  onConvert,
  onSaveAsNode,
  onSkip,
  saveLabel = 'Save as node',
  skipLabel = 'Skip',
}) {
  const previewUrl = imageUrl || (imageFile ? URL.createObjectURL(imageFile) : null);

  return (
    <div className="handwritten-split-grid">
      <div className="handwritten-pane">
        {previewUrl ? (
          <img src={previewUrl} alt="Note" />
        ) : (
          <span style={{ color: 'rgb(var(--muted))', fontSize: '0.875rem' }}>No image</span>
        )}
      </div>
      <div className="handwritten-pane-right">
        {loading ? (
          <div className="handwritten-loading">Converting to Markdown…</div>
        ) : !markdown ? (
          <div className="flex flex-col items-center justify-center text-center" style={{ flex: 1 }}>
            <p style={{ color: 'rgb(var(--muted))', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
              Generate Markdown from this note
            </p>
            {onConvert && (
              <button type="button" onClick={onConvert} className="btn-sm-ocr">
                Convert to Markdown
              </button>
            )}
          </div>
        ) : (
          <>
            <pre className="ocr-md-pre" style={{ flex: 1 }}>
              {markdown}
            </pre>
            <div className="handwritten-actions">
              {onSaveAsNode && (
                <button type="button" onClick={onSaveAsNode} className="btn-sm-ocr">
                  {saveLabel}
                </button>
              )}
              {onSkip && (
                <button type="button" onClick={onSkip} className="btn-outline-muted">
                  {skipLabel}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
