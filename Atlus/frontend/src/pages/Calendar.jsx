import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import TopBar from '../components/home/TopBar';
import { useClasses, useGlobalCalendarEvents } from '../api/brainQueries';
import { api } from '../api/client';

const EVENT_TYPES = ['quiz', 'midterm', 'test', 'project', 'assignment', 'final', 'other'];

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dateKeyFromIso(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toInputDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function classLabel(cls) {
  const code = (cls.profile?.class_number || '').trim();
  const title = (cls.title || '').trim();
  if (code && title) return `${code} · ${title}`;
  return title || code || 'Class';
}

export default function CalendarPage() {
  const { classId: routeClassId } = useParams();
  const queryClient = useQueryClient();
  const { data: classes = [] } = useClasses();

  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateKeyFromIso(new Date().toISOString()));
  const [targetClassId, setTargetClassId] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    event_type: 'assignment',
    due_at: '',
    course_label: '',
    notes: '',
  });

  useEffect(() => {
    if (routeClassId) setTargetClassId(routeClassId);
  }, [routeClassId]);

  useEffect(() => {
    if (!targetClassId && classes.length > 0) {
      const pick = routeClassId && classes.some((c) => c.id === routeClassId) ? routeClassId : classes[0].id;
      setTargetClassId(pick);
    }
  }, [classes, targetClassId, routeClassId]);

  const monthRange = useMemo(() => {
    const y = monthCursor.getFullYear();
    const m = monthCursor.getMonth();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [monthCursor]);

  const eventsQuery = useGlobalCalendarEvents({
    start: monthRange.start,
    end: monthRange.end,
    type: typeFilter,
  });
  const events = useMemo(() => eventsQuery.data || [], [eventsQuery.data]);

  const invalidateCalendars = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    queryClient.invalidateQueries({ queryKey: ['brains'] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: ({ brainId, body }) =>
      api(`/api/brain/${brainId}/calendar-events`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: invalidateCalendars,
  });
  const updateMutation = useMutation({
    mutationFn: ({ brainId, eventId, body }) =>
      api(`/api/brain/${brainId}/calendar-events/${eventId}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: invalidateCalendars,
  });
  const deleteMutation = useMutation({
    mutationFn: ({ brainId, eventId }) =>
      api(`/api/brain/${brainId}/calendar-events/${eventId}`, { method: 'DELETE' }),
    onSuccess: invalidateCalendars,
  });

  const eventsByDate = useMemo(() => {
    const map = new Map();
    events.forEach((ev) => {
      const key = dateKeyFromIso(ev.due_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    for (const [, items] of map.entries()) {
      items.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
    }
    return map;
  }, [events]);

  const monthGrid = useMemo(() => {
    const y = monthCursor.getFullYear();
    const m = monthCursor.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const startWeekday = first.getDay();
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const cells = [];
    for (let i = 0; i < totalCells; i += 1) {
      const dayNumber = i - startWeekday + 1;
      const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
      const date = new Date(y, m, dayNumber);
      const key = dateKeyFromIso(date.toISOString());
      cells.push({
        inMonth,
        dayNumber,
        key,
        events: inMonth ? eventsByDate.get(key) || [] : [],
      });
    }
    return cells;
  }, [monthCursor, eventsByDate]);

  const selectedDayEvents = useMemo(
    () => eventsByDate.get(selectedDateKey) || [],
    [eventsByDate, selectedDateKey]
  );

  const palette = ['#3B82F6', '#16A34A', '#334155', '#0F766E', '#1D4ED8', '#6D28D9', '#BE123C'];

  const classColor = useMemo(() => {
    const map = new Map();
    classes.forEach((c, idx) => {
      map.set(c.id, palette[idx % palette.length]);
    });
    return map;
  }, [classes]);

  function resetForm() {
    setForm({ title: '', event_type: 'assignment', due_at: '', course_label: '', notes: '' });
    setEditingId(null);
  }

  async function submitForm(e) {
    e.preventDefault();
    const brainId = editingId ? null : targetClassId;
    if (!form.title.trim() || !form.due_at) return;
    const body = {
      title: form.title.trim(),
      event_type: form.event_type,
      due_at: new Date(form.due_at).toISOString(),
      course_label: form.course_label.trim(),
      notes: form.notes.trim(),
    };
    if (editingId) {
      const ev = events.find((x) => x.id === editingId);
      if (!ev?.brain_id) return;
      await updateMutation.mutateAsync({ brainId: ev.brain_id, eventId: editingId, body });
    } else {
      if (!brainId) return;
      await createMutation.mutateAsync({ brainId, body });
    }
    resetForm();
  }

  function startEdit(ev) {
    setEditingId(ev.id);
    setTargetClassId(ev.brain_id);
    setForm({
      title: ev.title || '',
      event_type: ev.event_type || 'other',
      due_at: toInputDateTime(ev.due_at),
      course_label: ev.course_label || '',
      notes: ev.notes || '',
    });
  }

  const selectedClass = classes.find((c) => c.id === targetClassId);
  const subtitle = routeClassId && selectedClass ? classLabel(selectedClass) : 'All classes';
  const todayKey = dateKeyFromIso(new Date().toISOString());

  return (
    <div className="cal-page">
      <TopBar compact breadcrumb="Home › Calendar" />
      <main className="cal-main cal-main-wide">
        <div className="cal-head">
          <div>
            <h1>Calendar</h1>
            <p className="cal-subtitle text-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
              {subtitle}
            </p>
          </div>
          <Link to="/home" className="text-link">
            Back to home
          </Link>
        </div>

        <div className="cal-toolbar cal-panel">
          <label className="cal-toolbar-field">
            <span className="mono text-muted" style={{ fontSize: '0.7rem' }}>
              Class for new events
            </span>
            <select
              className="select"
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              disabled={!!routeClassId}
              title={routeClassId ? 'Calendar for this class' : 'Choose which class new events belong to'}
            >
              {classes.length === 0 ? (
                <option value="">No classes — add one from home</option>
              ) : (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c)}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="cal-toolbar-field">
            <span className="mono text-muted" style={{ fontSize: '0.7rem' }}>
              Filter type
            </span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="select">
              <option value="">All types</option>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="cal-layout-split">
          <div className="cal-panel cal-month-panel">
            <div className="cal-full-head">
              <button
                type="button"
                onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                aria-label="Previous month"
                className="cal-nav-btn"
              >
                ‹
              </button>
              <p className="cal-full-title">
                {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </p>
              <button
                type="button"
                onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                aria-label="Next month"
                className="cal-nav-btn"
              >
                ›
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm cal-today-btn"
                onClick={() => {
                  const now = new Date();
                  setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
                  setSelectedDateKey(dateKeyFromIso(now.toISOString()));
                }}
              >
                Today
              </button>
            </div>
            <div className="cal-full-weekdays">
              {WEEKDAYS.map((d) => (
                <div key={d} className="cal-full-weekday">
                  {d}
                </div>
              ))}
            </div>
            <div className="cal-full-days">
              {monthGrid.map((cell) => {
                if (!cell.inMonth) {
                  return <div key={`pad-${cell.key}`} className="cal-full-pad" aria-hidden />;
                }
                const isSelected = cell.key === selectedDateKey;
                const isToday = cell.key === todayKey;
                const hasEvents = cell.events.length > 0;
                let dayClass = 'cal-full-day';
                if (isSelected) dayClass += ' is-selected';
                else if (hasEvents) dayClass += ' has-events';
                else if (isToday) dayClass += ' is-today';
                return (
                  <button
                    key={`${cell.key}-${cell.dayNumber}`}
                    type="button"
                    onClick={() => setSelectedDateKey(cell.key)}
                    className={dayClass}
                  >
                    <span className="cal-full-day-num">{cell.dayNumber}</span>
                    {cell.events.length > 0 ? (
                      <span className="cal-full-dots" aria-hidden>
                        {cell.events.slice(0, 4).map((ev) => (
                          <span
                            key={ev.id}
                            className="cal-dot"
                            style={{ background: classColor.get(ev.brain_id) || '#64748b' }}
                          />
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="cal-side-stack">
            <div className="cal-panel">
              <h2 className="cal-panel-title">
                {new Date(selectedDateKey).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </h2>
              {eventsQuery.isLoading ? (
                <p className="text-muted">Loading…</p>
              ) : selectedDayEvents.length === 0 ? (
                <p className="text-muted">No events on this date.</p>
              ) : (
                <ul className="cal-page-day-list">
                  {selectedDayEvents.map((ev) => (
                    <li key={ev.id}>
                      <div className="cal-page-day-row">
                        <span className="cal-dot" style={{ background: classColor.get(ev.brain_id) || '#64748b' }} />
                        <div className="cal-page-day-body">
                          <strong>{ev.title}</strong>
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {new Date(ev.due_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ·{' '}
                            {ev.event_type}
                            {ev.brain_name ? ` · ${ev.brain_name}` : ''}
                          </span>
                        </div>
                        <div className="cal-page-day-actions">
                          <button type="button" className="text-link" style={{ fontSize: '0.75rem' }} onClick={() => startEdit(ev)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-danger text-link"
                            style={{ fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (!window.confirm('Delete this event?')) return;
                              deleteMutation.mutate({ brainId: ev.brain_id, eventId: ev.id });
                              if (editingId === ev.id) resetForm();
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form onSubmit={submitForm} className="cal-panel cal-form-grid">
              <h2 className="cal-panel-title span-2">{editingId ? 'Edit event' : 'Add event'}</h2>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Event title"
                className="input"
                required
              />
              <input
                type="datetime-local"
                value={form.due_at}
                onChange={(e) => setForm((f) => ({ ...f, due_at: e.target.value }))}
                className="input"
                required
              />
              <select
                value={form.event_type}
                onChange={(e) => setForm((f) => ({ ...f, event_type: e.target.value }))}
                className="input"
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
                className="input"
              />
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Notes (optional)"
                className="span-2"
              />
              <div className="span-2 flex gap-2 flex-wrap">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    (!editingId && !targetClassId)
                  }
                >
                  {editingId ? 'Update event' : 'Add event'}
                </button>
                {editingId ? (
                  <button type="button" onClick={resetForm} className="btn btn-secondary btn-sm">
                    Cancel edit
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const base = new Date(selectedDateKey);
                      base.setHours(9, 0, 0, 0);
                      setForm((f) => ({ ...f, due_at: toInputDateTime(base.toISOString()) }));
                    }}
                  >
                    Set due time to 9:00 on selected day
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="cal-panel">
          <h2 className="cal-panel-title">All events this month</h2>
          <div className="cal-table-wrap">
            {eventsQuery.isLoading ? (
              <p className="text-muted" style={{ padding: '1rem' }}>
                Loading events…
              </p>
            ) : events.length === 0 ? (
              <p className="text-muted" style={{ padding: '1rem' }}>
                No events in this month.
              </p>
            ) : (
              <table className="cal-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Course</th>
                    <th>Class</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ color: 'var(--text1)' }}>{new Date(ev.due_at).toLocaleString()}</td>
                      <td className="text-muted">{ev.event_type}</td>
                      <td style={{ color: 'var(--text1)' }}>{ev.title}</td>
                      <td className="text-muted">{ev.course_label || '—'}</td>
                      <td className="text-muted">{ev.brain_name || '—'}</td>
                      <td>
                        <div className="cal-table-actions">
                          <button type="button" onClick={() => startEdit(ev)} className="text-link" style={{ fontSize: '0.75rem' }}>
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm('Delete this event?')) return;
                              deleteMutation.mutate({ brainId: ev.brain_id, eventId: ev.id });
                              if (editingId === ev.id) resetForm();
                            }}
                            className="text-danger text-link"
                            style={{ fontSize: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            disabled={deleteMutation.isPending}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
