import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useNode, useUpdateNode, useBrains, useBrainNodes, useBrainSources, useDeleteNode } from '../api/brainQueries';
import NoteSidebar from '../components/note/NoteSidebar';
import MarkdownEditor from '../components/note/MarkdownEditor';
import ContextPanel from '../components/note/ContextPanel';
import BrainLanding from '../components/note/BrainLanding';
import HandwrittenSplitEditor from '../components/note/HandwrittenSplitEditor';
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
  const { data: brains = [] } = useBrains();
  const { data: listData } = useBrainNodes(brainId, { page: 1, per_page: 1 });
  const { data: sources = [] } = useBrainSources(brainId);
  const deleteNode = useDeleteNode();

  const displayNode = node || null;
  const brainName = brains.find((b) => b.id === brainId)?.name || 'Your brain';
  const totalNotesInBrain = listData?.total ?? 0;
  const sourceMeta =
    displayNode?.source_file_id != null ? sources.find((s) => s.id === displayNode.source_file_id) : null;
  const sourceFileName = sourceMeta?.filename || '';
  const showHandwrittenSplit =
    !!nodeId &&
    !!displayNode?.source_file_id &&
    sourceMeta?.file_type === 'image';

  useEffect(() => {
    if (!nodeId) {
      setTitle('');
      setLocalContent('');
    } else if (node) {
      setTitle(node.title || '');
      setLocalContent(node.markdown_content ?? '');
    }
  }, [nodeId, node?.title, node?.markdown_content]);

  const handleContentChange = useCallback((v) => setLocalContent(v), []);
  const handleSaveContent = useCallback(
    (markdown) => {
      if (!nodeId) return;
      updateMutation.mutate({ markdown_content: markdown });
    },
    [nodeId, updateMutation]
  );

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
        navigate(`/brain/${brainId}/notes`);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nodeId, localContent, title, brainId, navigate, updateMutation]);

  const dateLabel =
    displayNode?.updated_at || displayNode?.created_at
      ? new Date(displayNode.updated_at || displayNode.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex flex-col">
      <TopBar compact breadcrumb={`Home › ${brainName} › Notes`} activeBrainName={brainName} />
      <BrainExplorerHeader
        title={displayNode?.title || (nodeId ? 'Note' : null)}
        right={
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(`/brain/${brainId}/sources`)}
              className="text-sm text-[var(--accent)] hover:underline"
            >
              Sources
            </button>
            {nodeId ? (
              <button
                type="button"
                disabled={deleteNode.isPending}
                onClick={() => {
                  if (!window.confirm(`Delete this note? This cannot be undone.`)) return;
                  deleteNode.mutate(
                    { nodeId, brainId },
                    {
                      onSuccess: () => navigate(`/brain/${brainId}/notes`),
                    }
                  );
                }}
                className="text-sm text-red-400/90 hover:text-red-300 disabled:opacity-50"
              >
                Delete note
              </button>
            ) : null}
          </div>
        }
      />
      <div className="flex-1 flex overflow-hidden min-h-0">
        <NoteSidebar onSelectNode={() => {}} />
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {nodeId ? (
            showHandwrittenSplit ? (
              <HandwrittenSplitEditor
                brainId={brainId}
                sourceFileId={displayNode.source_file_id}
                filename={sourceFileName}
              >
                <MarkdownEditor
                  title={title}
                  onTitleChange={setTitle}
                  onTitleBlur={handleTitleBlur}
                  titleInputRef={titleInputRef}
                  metadata={{
                    dateLabel,
                    brainName,
                    tags: displayNode?.tags || [],
                    linkedCount: (displayNode?.related_node_ids || []).length,
                  }}
                  sourceLabel={sourceFileName}
                  saveStatus={updateMutation.isPending ? 'saving' : 'saved'}
                  totalNotesInBrain={totalNotesInBrain}
                  value={localContent}
                  onChange={handleContentChange}
                  onSave={handleSaveContent}
                />
              </HandwrittenSplitEditor>
            ) : (
              <MarkdownEditor
                title={title}
                onTitleChange={setTitle}
                onTitleBlur={handleTitleBlur}
                titleInputRef={titleInputRef}
                metadata={{
                  dateLabel,
                  brainName,
                  tags: displayNode?.tags || [],
                  linkedCount: (displayNode?.related_node_ids || []).length,
                }}
                sourceLabel={sourceFileName}
                saveStatus={updateMutation.isPending ? 'saving' : 'saved'}
                totalNotesInBrain={totalNotesInBrain}
                value={localContent}
                onChange={handleContentChange}
                onSave={handleSaveContent}
              />
            )
          ) : (
            <BrainLanding />
          )}
        </main>
        <ContextPanel nodeId={nodeId} />
      </div>
    </div>
  );
}
