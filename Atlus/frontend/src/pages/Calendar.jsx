import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/home/TopBar';
import {
  useBrainCalendarEvents,
  useGlobalCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
} from '../api/brainQueries';

const EVENT_TYPES = ['quiz', 'midterm', 'test', 'project', 'assignment', 'final', 'other'];

function toInputDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CalendarPage() {
  const { brainId } = useParams();
  const [typeFilter, setTypeFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    event_type: 'assignment',
    due_at: '',
    course_label: '',
    notes: '',
  });

  const isBrainView = !!brainId;
  const eventsQuery = isBrainView
    ? useBrainCalendarEvents(brainId, { type: typeFilter })
    : useGlobalCalendarEvents({ type: typeFilter });
  const createMutation = useCreateCalendarEvent(brainId || '');
  const updateMutation = useUpdateCalendarEvent(brainId || '');
  const deleteMutation = useDeleteCalendarEvent(brainId || '');

  const events = useMemo(() => eventsQuery.data || [], [eventsQuery.data]);

  function resetForm() {
    setForm({ title: '', event_type: 'assignment', due_at: '', course_label: '', notes: '' });
    setEditingId(null);
  }

  async function submitForm(e) {
    e.preventDefault();
    if (!isBrainView) return;
    if (!form.title.trim() || !form.due_at) return;
    const body = {
      title: form.title.trim(),
      event_type: form.event_type,
      due_at: new Date(form.due_at).toISOString(),
      course_label: form.course_label.trim(),
      notes: form.notes.trim(),
    };
    if (editingId) {
      await updateMutation.mutateAsync({ eventId: editingId, body });
    } else {
      await createMutation.mutateAsync(body);
    }
    resetForm();
  }

  function startEdit(event) {
    setEditingId(event.id);
    setForm({
      title: event.title || '',
      event_type: event.event_type || 'other',
      due_at: toInputDateTime(event.due_at),
      course_label: event.course_label || '',
      notes: event.notes || '',
    });
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <TopBar breadcrumb={isBrainView ? 'Home › Brain Calendar' : 'Home › Calendar'} />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h1 className="text-2xl font-semibold text-[var(--text1)]">
            {isBrainView ? 'Brain Calendar' : 'Global Calendar'}
          </h1>
          <div className="flex items-center gap-2">
            {isBrainView ? (
              <Link to="/calendar" className="text-sm text-[var(--accent)] hover:underline">
                View global
              </Link>
            ) : (
              <Link to="/home" className="text-sm text-[var(--accent)] hover:underline">
                Back home
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--hairline)] bg-[var(--bg2)] p-4 mb-4">
          <label className="text-xs text-[var(--text3)] mono mr-2">Filter type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-lg border border-[color:var(--hairline)] bg-[var(--bg3)] text-[var(--text1)] px-3 text-sm"
          >
            <option value="">All</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {isBrainView ? (
          <form onSubmit={submitForm} className="rounded-xl border border-[color:var(--hairline)] bg-[var(--bg2)] p-4 mb-4 grid md:grid-cols-2 gap-3">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Event title"
              className="h-10 rounded-lg border border-[color:var(--hairline)] bg-[var(--bg3)] px-3 text-sm text-[var(--text1)]"
              required
            />
            <input
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
              className="h-10 rounded-lg border border-[color:var(--hairline)] bg-[var(--bg3)] px-3 text-sm text-[var(--text1)]"
              required
            />
            <select
              value={form.event_type}
              onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
              className="h-10 rounded-lg border border-[color:var(--hairline)] bg-[var(--bg3)] px-3 text-sm text-[var(--text1)]"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={form.course_label}
              onChange={(e) => setForm((f) => ({ ...f, course_label: e.target.value }))}
              placeholder="Course label (optional)"
              className="h-10 rounded-lg border border-[color:var(--hairline)] bg-[var(--bg3)] px-3 text-sm text-[var(--text1)]"
            />
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="md:col-span-2 min-h-[80px] rounded-lg border border-[color:var(--hairline)] bg-[var(--bg3)] p-3 text-sm text-[var(--text1)]"
            />
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="h-9 px-4 rounded-lg bg-[var(--accent)] text-white text-sm font-medium">
                {editingId ? 'Update event' : 'Add event'}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="h-9 px-4 rounded-lg border border-[color:var(--hairline)] text-sm text-[var(--text1)]">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        <div className="rounded-xl border border-[color:var(--hairline)] bg-[var(--bg2)] overflow-hidden">
          {eventsQuery.isLoading ? (
            <p className="p-4 text-sm text-[var(--text3)]">Loading events…</p>
          ) : events.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text3)]">No events yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg3)]">
                <tr className="text-left text-[var(--text2)]">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Course</th>
                  <th className="px-3 py-2">Brain</th>
                  {isBrainView ? <th className="px-3 py-2">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-t border-[color:var(--hairline)]">
                    <td className="px-3 py-2 text-[var(--text1)]">{new Date(ev.due_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-[var(--text2)]">{ev.event_type}</td>
                    <td className="px-3 py-2 text-[var(--text1)]">{ev.title}</td>
                    <td className="px-3 py-2 text-[var(--text2)]">{ev.course_label || '—'}</td>
                    <td className="px-3 py-2 text-[var(--text2)]">{ev.brain_name || '—'}</td>
                    {isBrainView ? (
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => startEdit(ev)} className="text-xs text-[var(--accent)] hover:underline">
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(ev.id)}
                            className="text-xs text-red-600 hover:underline"
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
