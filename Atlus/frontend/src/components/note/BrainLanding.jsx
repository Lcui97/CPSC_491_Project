import { Link, useParams } from 'react-router-dom';
import { useBrainSources, useDeleteSource, useBrains } from '../../api/brainQueries';
import BrainHandwrittenUpload from './BrainHandwrittenUpload';

// parent can pass classTitle so the welcome matches the header
export default function BrainLanding({ classTitle: classTitleProp }) {
  const { classId } = useParams();

  const { data: classes = [] } = useBrains();
  const resolvedName =
    classTitleProp?.trim() ||
    classes.find((b) => String(b.id) === String(classId))?.name?.trim() ||
    null;

  const { data: sources = [], refetch: refetchSources, isFetching: sourcesFetching } = useBrainSources(classId);
  const deleteSource = useDeleteSource(classId);

  const welcomeTitle = resolvedName ? `Welcome to ${resolvedName}` : 'Welcome';

  return (
    <div className="class-landing-wrap">
      <div className="class-landing-inner">
        <section>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'rgb(var(--text))', margin: '0 0 0.5rem' }}>
            {welcomeTitle}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))', margin: '0 0 0.5rem' }}>
            Choose a note in the sidebar to open it. Handwritten scans show the image on the left and Markdown on the right.
          </p>
        </section>

        <BrainHandwrittenUpload classId={classId} />

        <section className="panel-rgb" style={{ marginTop: '1.5rem' }}>
          <div className="flex items-center justify-between gap-2" style={{ marginBottom: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'rgb(var(--text))' }}>Sources in this class</h2>
            <div className="flex gap-2 items-center">
              <Link to={`/class/${classId}/sources`} className="text-link" style={{ fontSize: '0.75rem' }}>
                Open files and previews
              </Link>
              <button
                type="button"
                onClick={() => refetchSources()}
                disabled={sourcesFetching}
                className="text-link"
                style={{ fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {sourcesFetching ? 'Refreshing…' : 'Refresh sources'}
              </button>
            </div>
          </div>
          {sources.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'rgb(var(--muted))' }}>No sources linked to this class yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2"
                  style={{
                    padding: '0.5rem 0.75rem',
                    marginBottom: '0.5rem',
                    borderRadius: '0.5rem',
                    background: 'rgb(var(--panel2))',
                    border: '1px solid rgb(var(--border))',
                    fontSize: '0.875rem',
                  }}
                >
                  <span className="truncate flex-1 min-w-0" style={{ color: 'rgb(var(--text))' }}>{s.filename}</span>
                  <span style={{ color: 'rgb(var(--muted))', fontSize: '0.75rem', flexShrink: 0 }}>{s.file_type}</span>
                  <button
                    type="button"
                    disabled={deleteSource.isPending}
                    onClick={() => {
                      if (!window.confirm(`Remove source “${s.filename}” from this class? Notes stay; only the file link is removed.`))
                        return;
                      deleteSource.mutate(s.id);
                    }}
                    style={{
                      flexShrink: 0,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: '#f87171',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
