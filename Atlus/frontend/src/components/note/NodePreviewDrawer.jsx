import ReactMarkdown from 'react-markdown';
import { useNavigate, useParams } from 'react-router-dom';

export default function NodePreviewDrawer({ node, onClose }) {
  const navigate = useNavigate();
  const { brainId } = useParams();
  const bid = node?.brain_id || brainId;

  if (!node) return null;

  const openInNoteView = () => {
    navigate(`/brain/${bid}/notes/${node.id}`);
    onClose?.();
  };

  return (
    <div className="w-96 shrink-0 border-l border-[rgb(var(--border))] bg-[rgb(var(--panel))] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[rgb(var(--border))]">
        <h3 className="text-sm font-semibold text-[rgb(var(--text))] truncate">{node.title || 'Untitled'}</h3>
        <button type="button" onClick={onClose} className="p-1 rounded text-[rgb(var(--muted))] hover:text-[rgb(var(--text))]">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="prose prose-sm max-w-none text-[rgb(var(--text))]">
          <ReactMarkdown
            components={{
              p: ({ node: n, ...p }) => <p className="my-1 text-sm" {...p} />,
              h1: ({ node: n, ...p }) => <h1 className="text-base font-bold mt-2 mb-1" {...p} />,
              h2: ({ node: n, ...p }) => <h2 className="text-sm font-semibold mt-2 mb-1" {...p} />,
              ul: ({ node: n, ...p }) => <ul className="list-disc pl-4 my-1 text-sm" {...p} />,
            }}
          >
            {(node.markdown_content || '').slice(0, 2000) || '_No content_'}
          </ReactMarkdown>
        </div>
      </div>
      <div className="p-3 border-t border-[rgb(var(--border))]">
        <button
          type="button"
          onClick={openInNoteView}
          className="w-full py-2 px-3 rounded-lg bg-[rgb(var(--accent))] hover:bg-[rgb(var(--accentHover))] text-white text-sm font-medium"
        >
          Open in Note View
        </button>
      </div>
    </div>
  );
}
