/**
 * Split layout for handwritten notes:
 * - Left: original scanned note preview (image URL or file)
 * - Right: automatically generated Markdown version (from OCR pipeline)
 * Use when displaying OCR result or when adding a handwritten note to a Brain.
 */
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[320px]">
      <div className="border border-[rgb(var(--border))] rounded-lg overflow-hidden bg-[rgb(var(--bg))] flex items-center justify-center p-2 min-h-[280px]">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Note"
            className="max-w-full max-h-[300px] object-contain"
          />
        ) : (
          <span className="text-[rgb(var(--muted))] text-sm">No image</span>
        )}
      </div>
      <div className="border border-[rgb(var(--border))] rounded-lg overflow-hidden bg-[rgb(var(--bg))] p-3 flex flex-col min-h-[280px]">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[rgb(var(--muted))] text-sm">
            Converting to Markdown…
          </div>
        ) : !markdown ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-[rgb(var(--muted))] text-sm mb-3">
              Generate Markdown from this note
            </p>
            {onConvert && (
              <button
                type="button"
                onClick={onConvert}
                className="py-2 px-4 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium"
              >
                Convert to Markdown
              </button>
            )}
          </div>
        ) : (
          <>
            <pre className="flex-1 overflow-auto text-xs text-[rgb(var(--text))] whitespace-pre-wrap font-sans">
              {markdown}
            </pre>
            <div className="flex gap-2 mt-2 shrink-0">
              {onSaveAsNode && (
                <button
                  type="button"
                  onClick={onSaveAsNode}
                  className="py-1.5 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm"
                >
                  {saveLabel}
                </button>
              )}
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="py-1.5 px-3 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--muted))] text-sm hover:text-[rgb(var(--text))]"
                >
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
