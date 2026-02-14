import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useNode, useUpdateNode } from '../api/brainQueries';
import NoteSidebar from '../components/note/NoteSidebar';
import MarkdownEditor from '../components/note/MarkdownEditor';
import ContextPanel from '../components/note/ContextPanel';
import TopBar from '../components/home/TopBar';
import BrainExplorerHeader from '../components/note/BrainExplorerHeader';

const DEFAULT_TITLE = 'Untitled';

export default function NoteView() {
  const { brainId, nodeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [title, setTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const titleInputRef = useRef(null);
  const titleDebounceRef = useRef(null);

  const { data: node } = useNode(nodeId);
  const updateMutation = useUpdateNode(nodeId);

  const displayNode = node || null;

  useEffect(() => {
    if (!nodeId) { setTitle(''); setLocalContent(''); }
    else if (node) { setTitle(node.title || ''); setLocalContent(node.markdown_content ?? ''); }
  }, [nodeId, node?.title, node?.markdown_content]);

  const handleContentChange = useCallback((v) => setLocalContent(v), []);
  const handleSaveContent = useCallback((markdown) => {
    if (!nodeId) return;
    updateMutation.mutate({ markdown_content: markdown });
  }, [nodeId, updateMutation]);

  useEffect(() => {
    if (location.state?.focusTitle && nodeId && titleInputRef.current) {
      titleInputRef.current.focus();
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [nodeId, location.state?.focusTitle, navigate, location.pathname]);

  const handleTitleBlur = useCallback(() => {
    if (!nodeId || title === (displayNode?.title ?? '')) return;
    updateMutation.mutate({ title: title.trim() || DEFAULT_TITLE });
  }, [nodeId, title, displayNode?.title, updateMutation]);

  useEffect(() => {
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    if (!nodeId || title === (displayNode?.title ?? '')) return;
    titleDebounceRef.current = setTimeout(() => {
      updateMutation.mutate({ title: title.trim() || DEFAULT_TITLE });
    }, 600);
    return () => clearTimeout(titleDebounceRef.current);
  }, [title, nodeId, displayNode?.title, updateMutation]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (nodeId) updateMutation.mutate({ markdown_content: localContent, title: title.trim() || DEFAULT_TITLE });
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        navigate(`/brain/${brainId}/graph`);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nodeId, localContent, title, brainId, navigate, updateMutation]);

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex flex-col">
      <TopBar />
      <BrainExplorerHeader title={displayNode?.title || (nodeId ? 'Note' : null)} right={<button type="button" onClick={() => navigate(`/brain/${brainId}/graph`)} className="text-sm text-[rgb(var(--muted))] hover:text-[rgb(var(--accent))]">Graph</button>} />
      <div className="flex-1 flex overflow-hidden">
        <NoteSidebar onSelectNode={() => {}} />
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {nodeId ? (
            <>
              <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--panel))] px-4 py-2 flex items-center gap-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  placeholder="Note title"
                  className="flex-1 min-w-0 bg-transparent text-lg font-semibold text-[rgb(var(--text))] placeholder:text-[rgb(var(--muted))] focus:outline-none"
                />
              </div>
              <div className="flex-1 min-h-0">
                <MarkdownEditor
                  value={localContent}
                  onChange={handleContentChange}
                  onSave={handleSaveContent}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[rgb(var(--muted))]">
              Select a note from the sidebar or add a new note.
            </div>
          )}
        </main>
        <ContextPanel nodeId={nodeId} />
      </div>
    </div>
  );
}
