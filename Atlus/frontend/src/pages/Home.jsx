import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/home/TopBar';
import WorkspaceSidebar from '../components/home/WorkspaceSidebar';
import HomeNotesChat from '../components/home/HomeNotesChat';
import { useBrains, useMeSummary } from '../api/brainQueries';

export default function Home() {
  const navigate = useNavigate();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [activeBrain, setActiveBrain] = useState(null);
  const { data: brains = [] } = useBrains();
  const { data: me } = useMeSummary();
  const [ingestPendingBanner, setIngestPendingBanner] = useState(false);
  const didAutoPickBrain = useRef(false);

  // First brain wins for chat until the user picks something else
  useEffect(() => {
    if (brains.length === 0) {
      didAutoPickBrain.current = false;
      return;
    }
    if (didAutoPickBrain.current) return;
    setActiveBrain((prev) => prev ?? brains[0]);
    didAutoPickBrain.current = true;
  }, [brains]);

  useEffect(() => {
    const fn = (e) => setIngestPendingBanner(!!e.detail?.pending);
    window.addEventListener('atlus-ingest-pending', fn);
    return () => window.removeEventListener('atlus-ingest-pending', fn);
  }, []);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    []
  );
  const stats = useMemo(
    () => [
      { label: 'TOTAL NOTES', value: me?.total_notes ?? 0 },
      { label: 'SOURCES', value: '—' },
      { label: 'SCAN NOTES', value: 'Image + MD' },
      { label: 'BRAINS', value: me?.brains_count ?? brains.length ?? 0 },
    ],
    [me, brains.length]
  );

  const brainName = activeBrain?.name || null;
  // Home tiles need a brain even if the sidebar hasn’t “focused” one yet
  const brainForActions = activeBrain || brains[0] || null;

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] flex flex-col">
      <TopBar activeBrainName={brainName} />
      <main className="flex-1 flex overflow-hidden">
        <WorkspaceSidebar
          sidebarExpanded={sidebarExpanded}
          setSidebarExpanded={setSidebarExpanded}
          activeBrain={activeBrain}
          setActiveBrain={setActiveBrain}
          brains={brains}
          me={me}
        />
        <div className="flex-1 flex flex-col p-7 overflow-auto gap-5">
          <div>
            <p className="mono text-[11px] text-[var(--text3)]">{today}</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text1)]">Good evening {me?.email?.split('@')?.[0] || 'there'} 👋</h1>
            <p className="text-sm text-[var(--text2)] mt-1">Atlus keeps your notes, sources, and connections in one place.</p>
          </div>
          {ingestPendingBanner ? (
            <div
              className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-[var(--text2)]"
              style={{ borderColor: 'var(--amber)', background: 'rgba(245, 166, 35, 0.08)' }}
            >
              <span className="inline-flex h-2 w-2 rounded-full shrink-0 animate-pulse" style={{ background: 'var(--amber)' }} />
              <span>Documents are processing in the background. Sources and notes will update when Atlus finishes indexing.</span>
            </div>
          ) : null}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-[color:var(--hairline)] bg-[var(--bg2)] p-4"
                title={s.hint}
              >
                <p className="mono text-[10px] text-[var(--text3)]">{s.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text1)]">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'All notes', desc: 'Gallery of every note — open or delete', action: () => navigate('/home/notes') },
              { label: 'Ingest file', desc: 'Upload PDF, DOCX, PPTX, or markdown', action: () => navigate('/ingest') },
              { label: 'Calendar', desc: 'Deadlines and assessment schedule', action: () => navigate('/calendar') },
              {
                label: 'Workspace',
                desc: 'Notes + uploads for the selected brain',
                action: () => brainForActions && navigate(`/brain/${brainForActions.id}/notes`),
              },
              {
                label: 'Sources',
                desc: 'View files for the selected brain',
                action: () => brainForActions && navigate(`/brain/${brainForActions.id}/sources`),
              },
            ].map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={q.action}
                disabled={q.label === 'Workspace' || q.label === 'Sources' ? !brainForActions : false}
                className="text-left rounded-xl border border-[color:var(--hairline)] bg-[var(--bg2)] p-4 hover:border-[color:var(--hairline-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <p className="text-sm font-semibold text-[var(--text1)]">{q.label}</p>
                <p className="mt-1 text-xs text-[var(--text2)]">{q.desc}</p>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-[color:var(--hairline)] p-4 bg-[var(--bg2)]">
            {activeBrain ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--text3)] mono">ACTIVE BRAIN</p>
                  <p className="text-lg font-semibold text-[var(--text1)]">{activeBrain.name}</p>
                  <p className="text-xs text-[var(--text2)] mt-1">{activeBrain.badge}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/brain/${activeBrain.id}/notes`)}
                    className="h-9 px-4 rounded-lg bg-[var(--accent)] text-white text-sm font-medium"
                  >
                    Open workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/brain/${activeBrain.id}/sources`)}
                    className="h-9 px-4 rounded-lg border border-[color:var(--hairline-strong)] text-[var(--text1)] text-sm hover:bg-[var(--bg3)]"
                  >
                    View sources
                  </button>
                  <button type="button" onClick={() => setActiveBrain(null)} className="h-9 px-3 text-sm text-[var(--text3)] hover:text-[var(--text1)]">
                    Clear selection
                  </button>
                </div>
              </div>
            ) : brains.length === 0 ? (
              <p className="text-sm text-[var(--text3)]">
                Create a brain with <strong className="text-[var(--text2)]">+</strong> in the sidebar to use workspace, sources, and chat.
              </p>
            ) : (
              <p className="text-sm text-[var(--text3)]">
                Click a brain below to focus it, or use the cards above — your first brain is used by default for chat and Workspace/Sources.
              </p>
            )}
          </div>
          <div className="flex-1 min-h-0 rounded-xl border border-[color:var(--hairline)] p-3 bg-[var(--bg2)] flex flex-col gap-3 min-h-[320px]">
            <HomeNotesChat activeBrain={activeBrain} brains={brains} onSelectBrain={(b) => setActiveBrain(b)} />
          </div>
          <button
            type="button"
            onClick={() => navigate('/ingest')}
            className="w-full rounded-xl border p-4 text-left"
            style={{ borderColor: 'var(--teal)', background: 'var(--teal-dim)' }}
          >
            <p className="text-sm font-semibold text-[var(--text1)]">Ingest a new document</p>
            <p className="text-xs text-[var(--text2)] mt-1">Drop files, process in background, and let Atlus connect ideas automatically.</p>
          </button>
        </div>
      </main>
    </div>
  );
}
