import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useNode, useUpdateNode, useBrains, useBrainNodes, useBrainSources, useDeleteNode } from '../api/brainQueries';
import NoteSidebar from '../components/note/NoteSidebar';
import MarkdownEditor from '../components/note/MarkdownEditor';
import BrainLanding from '../components/note/BrainLanding';
import HandwrittenSplitEditor from '../components/note/HandwrittenSplitEditor';
import TopBar from '../components/home/TopBar';
import BrainExplorerHeader from '../components/note/BrainExplorerHeader';

const DEFAULT_TITLE = 'Untitled';

export default function NoteView() {
  const { classId, nodeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [title, setTitle] = useState('');
  const [localContent, setLocalContent] = useState('');
  const titleInputRef = useRef(null);
  const titleDebounceRef = useRef(null);

  const { data: node } = useNode(nodeId);
  const updateMutation = useUpdateNode(nodeId);
  const { data: brains = [] } = useBrains();
  const { data: listData } = useBrainNodes(classId, { page: 1, per_page: 1 });
  const { data: sources = [] } = useBrainSources(classId);
  const deleteNode = useDeleteNode();

  const displayNode = node || null;
  const classTitle = brains.find((b) => b.id === classId)?.name || 'Your class';
  const totalNotesInClass = listData?.total ?? 0;
  const sourceMeta =
    displayNode?.source_file_id != null ? sources.find((s) => s.id === displayNode.source_file_id) : null;
  const sourceFileName = sourceMeta?.filename || '';
  const showHandwrittenSplit =
    !!nodeId &&
    !!displayNode?.source_file_id &&
    (sourceMeta?.file_type === 'image' || sourceMeta?.file_type === 'pdf');

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
        navigate(`/class/${classId}/notes`);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nodeId, localContent, title, classId, navigate, updateMutation]);

  const dateLabel =
    displayNode?.updated_at || displayNode?.created_at
      ? new Date(displayNode.updated_at || displayNode.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

  return (
    <div className="note-page">
      <TopBar compact breadcrumb={`Home › ${classTitle} › Notes`} />
      <BrainExplorerHeader
        title={displayNode?.title || (nodeId ? 'Note' : null)}
        backHref={nodeId && classId ? `/class/${classId}/notes` : undefined}
        backTitle={nodeId ? 'Back to class notes' : undefined}
        right={
          <div className="explorer-header-actions">
            <button
              type="button"
              onClick={() => navigate(`/ingest?class=${encodeURIComponent(classId)}`)}
              className="text-link"
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => navigate(`/class/${classId}/sources`)}
              className="text-link"
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
                    { nodeId, brainId: classId },
                    {
                      onSuccess: () => navigate(`/class/${classId}/notes`),
                    }
                  );
                }}
                className="text-link text-danger"
                style={{ opacity: deleteNode.isPending ? 0.5 : 1 }}
              >
                Delete note
              </button>
            ) : null}
          </div>
        }
      />
      <div className="note-body">
        <NoteSidebar onSelectNode={() => {}} />
        <main className="note-main">
          {nodeId ? (
            showHandwrittenSplit ? (
              <HandwrittenSplitEditor
                classId={classId}
                sourceFileId={displayNode.source_file_id}
                filename={sourceFileName}
                fileType={sourceMeta?.file_type === 'pdf' ? 'pdf' : 'image'}
              >
                <MarkdownEditor
                  title={title}
                  onTitleChange={setTitle}
                  onTitleBlur={handleTitleBlur}
                  titleInputRef={titleInputRef}
                  metadata={{
                    dateLabel,
                    tags: displayNode?.tags || [],
                  }}
                  sourceLabel={sourceFileName}
                  saveStatus={updateMutation.isPending ? 'saving' : 'saved'}
                  totalNotesInClass={totalNotesInClass}
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
                  tags: displayNode?.tags || [],
                }}
                sourceLabel={sourceFileName}
                saveStatus={updateMutation.isPending ? 'saving' : 'saved'}
                totalNotesInClass={totalNotesInClass}
                value={localContent}
                onChange={handleContentChange}
                onSave={handleSaveContent}
              />
            )
          ) : (
            <BrainLanding classTitle={classTitle} />
          )}
        </main>
      </div>
    </div>
  );
}
