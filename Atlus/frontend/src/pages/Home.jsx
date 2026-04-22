import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/home/TopBar';
import WeekBlockSchedule from '../components/home/WeekBlockSchedule';
import {
  useClasses,
  useCreateClassManual,
  useCreateClassFromSyllabus,
  useGlobalCalendarEvents,
  useDeleteBrain,
  useUpdateClass,
  useClassSyllabusPreview,
} from '../api/brainQueries';

const CLASS_ORDER_KEY = 'atlus_class_order_v1';

function dateKeyFromIso(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// little subtitle line under calendar stuff (code + name)
function upcomingEventClassLine(ev, titleById) {
  const code = (ev.course_label || '').trim();
  const title = (ev.brain_name || '').trim() || (titleById.get(String(ev.brain_id)) || '').trim();
  if (code && title) return `(${code}) · ${title}`;
  if (code) return `(${code})`;
  if (title) return title;
  return '';
}

// turns iso date into like "April 27" without the year
function formatUpcomingWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export default function Home() {
  const navigate = useNavigate();
  const { data: classes = [], isLoading: classesLoading } = useClasses();
  const { data: events = [] } = useGlobalCalendarEvents();
  const createManual = useCreateClassManual();
  const createFromSyllabus = useCreateClassFromSyllabus();
  const deleteClass = useDeleteBrain();
  const updateClass = useUpdateClass();

  const [manual, setManual] = useState({
    title: '',
    class_number: '',
    section: '',
    professor: '',
    meeting_days: '',
    meeting_time: '',
    classroom: '',
    office_hours: '',
    term: '',
  });
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [syllabusUploadProgress, setSyllabusUploadProgress] = useState(0);
  const [syllabusStage, setSyllabusStage] = useState('idle'); // idle | uploading | parsing | done | error
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [addMode, setAddMode] = useState('manual');
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [editClass, setEditClass] = useState(null);
  const [syllabusPreviewClass, setSyllabusPreviewClass] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    class_number: '',
    section: '',
    professor: '',
    meeting_days: '',
    meeting_time: '',
    classroom: '',
    office_hours: '',
    term: '',
  });

  const [classOrder, setClassOrder] = useState([]);
  const [draggingId, setDraggingId] = useState(null);

  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDateKey, setSelectedDateKey] = useState(() => dateKeyFromIso(new Date().toISOString()));

  const {
    data: syllabusPreviewData,
    isLoading: syllabusPreviewLoading,
    error: syllabusPreviewError,
  } = useClassSyllabusPreview(syllabusPreviewClass?.id, !!syllabusPreviewClass);

  function cardThemeIndex(cls) {
    const seed = `${cls?.title || ''}-${cls?.id || ''}`;
    let acc = 0;
    for (let i = 0; i < seed.length; i += 1) acc += seed.charCodeAt(i);
    return acc % 6;
  }

  // top of the card - class # and section only
  function formatClassCardMeta(profile) {
    if (!profile) return null;
    const num = (profile.class_number || '').trim();
    const sec = (profile.section || '').trim();
    if (num && sec) return `${num} · Section ${sec}`;
    if (num) return num;
    if (sec) return `Section ${sec}`;
    return null;
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CLASS_ORDER_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setClassOrder(parsed);
    } catch {
      setClassOrder([]);
    }
  }, []);

  useEffect(() => {
    const ids = classes.map((c) => c.id);
    if (!ids.length) return;
    setClassOrder((prev) => {
      const filtered = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !filtered.includes(id));
      const next = [...filtered, ...missing];
      try {
        localStorage.setItem(CLASS_ORDER_KEY, JSON.stringify(next));
      } catch {
        // ignore storage write issues
      }
      return next;
    });
  }, [classes]);

  const orderedClasses = useMemo(() => {
    const rank = new Map(classOrder.map((id, idx) => [id, idx]));
    return [...classes].sort((a, b) => {
      const ai = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bi = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }, [classes, classOrder]);

  const classTitleById = useMemo(() => {
    const m = new Map();
    orderedClasses.forEach((c) => {
      if (c?.id != null) m.set(String(c.id), (c.title || '').trim());
    });
    return m;
  }, [orderedClasses]);

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

  const selectedDayEvents = useMemo(() => eventsByDate.get(selectedDateKey) || [], [eventsByDate, selectedDateKey]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    return events
      .filter((e) => {
        const d = new Date(e.due_at);
        return d >= now && d <= end;
      })
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  }, [events]);

  const navBadges = useMemo(() => {
    const now = new Date();
    const week = new Date(now);
    week.setDate(week.getDate() + 7);
    const dueSoon = events.filter((ev) => {
      const d = new Date(ev.due_at);
      return d >= now && d <= week;
    }).length;
    return { calendar: dueSoon, assistant: null };
  }, [events]);

  const classColorMap = useMemo(() => {
    const palette = ['#3B82F6', '#16A34A', '#334155', '#0F766E', '#1D4ED8', '#6D28D9', '#0F766E', '#BE123C'];
    const map = new Map();
    orderedClasses.forEach((cls, idx) => {
      const label = cls.profile?.class_number || cls.title || `Class ${idx + 1}`;
      map.set(label, palette[idx % palette.length]);
    });
    return map;
  }, [orderedClasses]);

  useEffect(() => {
    function onDocClick() {
      setMenuOpenFor(null);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  async function handleCreateManual(e) {
    e.preventDefault();
    try {
      await createManual.mutateAsync(manual);
      setManual({
        title: '',
        class_number: '',
        section: '',
        professor: '',
        meeting_days: '',
        meeting_time: '',
        classroom: '',
        office_hours: '',
        term: '',
      });
      setAddClassOpen(false);
    } catch {
      // UI shows mutation errors
    }
  }

  async function handleUploadSyllabus(e) {
    e.preventDefault();
    if (!syllabusFile) return;
    setSyllabusUploadProgress(0);
    setSyllabusStage('uploading');
    try {
      await createFromSyllabus.mutateAsync({
        file: syllabusFile,
        onProgress: (pct) => {
          setSyllabusUploadProgress(pct);
          setSyllabusStage(pct >= 100 ? 'parsing' : 'uploading');
        },
      });
      setSyllabusStage('done');
      setSyllabusFile(null);
      await new Promise((resolve) => setTimeout(resolve, 450));
      setAddClassOpen(false);
      setSyllabusUploadProgress(0);
      setSyllabusStage('idle');
    } catch {
      setSyllabusStage('error');
      // UI shows mutation errors
    }
  }

  function openEditModal(cls) {
    setEditClass(cls);
    setEditForm({
      title: cls.title || '',
      class_number: cls.profile?.class_number || '',
      section: cls.profile?.section || '',
      professor: cls.profile?.professor || '',
      meeting_days: cls.profile?.meeting_days || '',
      meeting_time: cls.profile?.meeting_time || '',
      classroom: cls.profile?.classroom || '',
      office_hours: cls.profile?.office_hours || '',
      term: cls.profile?.term || '',
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editClass) return;
    await updateClass.mutateAsync({ classId: editClass.id, body: editForm });
    setEditClass(null);
  }

  async function handleDeleteClass(classId) {
    const ok = window.confirm('Delete this class and all associated notes/events?');
    if (!ok) return;
    await deleteClass.mutateAsync(classId);
  }

  function saveClassOrder(next) {
    setClassOrder(next);
    try {
      localStorage.setItem(CLASS_ORDER_KEY, JSON.stringify(next));
    } catch {
      // ignore storage write issues
    }
  }

  function handleCardDrop(targetId) {
    if (!draggingId || draggingId === targetId) return;
    const next = [...classOrder];
    const from = next.indexOf(draggingId);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, draggingId);
    saveClassOrder(next);
    setDraggingId(null);
  }

  return (
    <div className="home-root">
      <TopBar />
      <main className="home-main">
        <aside className="home-nav">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: '⌂', badge: null, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
            { id: 'calendar', label: 'Calendar', icon: '◷', badge: navBadges.calendar, onClick: () => navigate('/calendar') },
            { id: 'assistant', label: 'Assistant', icon: '✦', badge: navBadges.assistant, onClick: () => navigate('/assistant') },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className="home-nav-btn"
            >
              <span className="home-nav-icon">{item.icon}</span>
              {item.label}
              {item.badge ? (
                <span className="home-nav-badge">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </button>
          ))}
        </aside>

        <div className="home-body-split">
          <div className="home-content home-stack">
          <section id="dashboard">
            <p className="mono home-date-line">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <h1 className="home-title">Class Planner Home</h1>
          </section>

          <section id="courses-section" className="section-panel">
            <div className="section-head">
              <h2>My classes</h2>
              <button
                type="button"
                onClick={() => {
                  setAddMode('manual');
                  setAddClassOpen(true);
                }}
                className="btn btn-primary btn-xs"
              >
                + Add class
              </button>
            </div>
            {classesLoading ? (
              <p className="text-muted">Loading classes…</p>
            ) : orderedClasses.length === 0 ? (
              <p className="text-muted">No classes yet. Add one manually or upload a syllabus.</p>
            ) : (
              <div className="class-grid">
                {orderedClasses.map((cls) => {
                  const metaLine = formatClassCardMeta(cls.profile);
                  return (
                  <div
                    key={cls.id}
                    role="button"
                    tabIndex={0}
                    draggable
                    onClick={() => navigate(`/class/${cls.id}/notes`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/class/${cls.id}/notes`);
                      }
                    }}
                    onDragStart={(e) => {
                      setDraggingId(cls.id);
                      e.dataTransfer.setData('text/plain', cls.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const source = e.dataTransfer.getData('text/plain') || draggingId;
                      if (source && source !== cls.id) {
                        setDraggingId(source);
                        handleCardDrop(cls.id);
                      }
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    className="class-card"
                    title={`Open ${cls.title}`}
                  >
                    <div className={`class-card-header t${cardThemeIndex(cls)}`}>
                      <div className="class-card-tint" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenFor((prev) => (prev === cls.id ? null : cls.id));
                        }}
                        className="class-card-menu-btn"
                        title="Class actions"
                      >
                        ⋮
                      </button>
                      <div className="class-card-header-inner">
                        {metaLine ? <p className="class-card-meta">{metaLine}</p> : null}
                        <p className="class-card-name">{cls.title?.trim() || 'Untitled class'}</p>
                      </div>
                    </div>
                    <div className="class-card-body">
                      <p className="line line-muted">Professor: {cls.profile?.professor || 'Not set'}</p>
                      <p className="line line-muted">
                        Meets: {cls.profile?.meeting_days || '—'} {cls.profile?.meeting_time || ''}
                      </p>
                      <p className="line line-muted">Room: {cls.profile?.classroom || '—'}</p>
                      <p className="line line-muted">Office hours: {cls.profile?.office_hours || '—'}</p>
                      <p className="line line-muted">Term: {cls.profile?.term || 'Not set'}</p>
                      <div className="class-card-footer">
                        <span>{cls.event_count || 0} events</span>
                        <span className="open-hint">Open class</span>
                      </div>
                    </div>
                    {menuOpenFor === cls.id ? (
                      <div
                        className="class-dropdown"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button type="button" onClick={() => navigate(`/class/${cls.id}/notes`)}>Open</button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpenFor(null);
                            openEditModal(cls);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpenFor(null);
                            setSyllabusPreviewClass(cls);
                          }}
                        >
                          Syllabus preview
                        </button>
                        <button type="button" onClick={() => navigate(`/class/${cls.id}/calendar`)}>Calendar</button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            setMenuOpenFor(null);
                            handleDeleteClass(cls.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="section-panel">
            <div className="section-head">
              <h2>Upcoming (next month)</h2>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-muted">No upcoming class deadlines.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {upcoming.slice(0, 50).map((ev) => {
                  const classMeta = upcomingEventClassLine(ev, classTitleById);
                  return (
                    <li key={ev.id} style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      {formatUpcomingWhen(ev.due_at)} — [{ev.event_type}] {ev.title}
                      {classMeta ? <span className="text-muted"> — {classMeta}</span> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section id="week-schedule-section" className="section-panel">
            <div className="section-head">
              <h2>Weekly schedule</h2>
            </div>
            <WeekBlockSchedule classes={orderedClasses} />
          </section>
          </div>

          <aside className="home-calendar-rail" id="calendar-grid-section" aria-label="Calendar">
            <div className="section-panel home-calendar-panel">
              <div className="section-head">
                <h2>Calendar</h2>
              </div>
              <div className="cal-widget-stack">
                <div className="cal-mini">
                  <div className="cal-mini-head">
                    <button
                      type="button"
                      onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      aria-label="Previous month"
                    >
                      ‹
                    </button>
                    <p className="cal-mini-title">
                      {monthCursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      aria-label="Next month"
                    >
                      ›
                    </button>
                  </div>
                  <div className="cal-weekdays">
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>
                  <div className="cal-days">
                    {monthGrid.map((cell) => {
                      const todayKey = dateKeyFromIso(new Date().toISOString());
                      const isSelected = cell.key === selectedDateKey;
                      const isToday = cell.key === todayKey;
                      const hasEvents = cell.events.length > 0;
                      let dayClass = 'cal-day-btn';
                      if (cell.inMonth) {
                        if (isSelected) dayClass += ' is-selected';
                        else if (hasEvents) dayClass += ' has-events';
                        else if (isToday) dayClass += ' is-today';
                      }
                      return (
                        <button
                          key={`${cell.key}-${cell.dayNumber}-${cell.inMonth ? 'in' : 'out'}`}
                          type="button"
                          disabled={!cell.inMonth}
                          onClick={() => cell.inMonth && setSelectedDateKey(cell.key)}
                          className={dayClass}
                        >
                          {cell.dayNumber}
                        </button>
                      );
                    })}
                  </div>

                  <div className="cal-sidebar-label">
                    <p>▼ CALENDARS</p>
                  </div>
                  <div className="cal-class-list">
                    {orderedClasses.length === 0 ? (
                      <p className="text-muted" style={{ fontSize: '0.75rem' }}>No classes yet.</p>
                    ) : (
                      orderedClasses.map((cls) => {
                        const label = cls.profile?.class_number || cls.title;
                        const color = classColorMap.get(label) || '#3B82F6';
                        return (
                          <div key={`cal-${cls.id}`} className="cal-class-row">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="cal-swatch" style={{ background: color }} />
                              <p className="cal-class-name">{label}</p>
                            </div>
                            <button type="button" className="text-muted" style={{ border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => navigate(`/class/${cls.id}/calendar`)}>
                              ⋮
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="cal-detail-panel">
                  <p className="cal-detail-date">
                    {new Date(selectedDateKey).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  {selectedDayEvents.length ? (
                    <ul className="cal-event-list">
                      {selectedDayEvents.map((ev) => {
                        const label = ev.course_label || 'Class';
                        const color = classColorMap.get(label) || '#3B82F6';
                        return (
                          <li key={ev.id}>
                            <div className="cal-event-row">
                              <p style={{ fontWeight: 600, margin: 0 }}>
                                [{ev.event_type}] {ev.title}
                              </p>
                              <span className="cal-dot" style={{ background: color }} />
                            </div>
                            <p className="cal-event-sub">
                              {new Date(ev.due_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {label}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-muted">No events on this date.</p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {addClassOpen ? (
        <div className="modal-backdrop" onClick={() => setAddClassOpen(false)}>
          <div
            className="home-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-head">
              <h3 style={{ margin: 0, fontSize: '0.875rem' }}>Add class</h3>
              <div className="modal-tabs">
                <button type="button" onClick={() => setAddMode('manual')} className={`modal-tab ${addMode === 'manual' ? 'is-on' : ''}`}>Manual</button>
                <button type="button" onClick={() => setAddMode('syllabus')} className={`modal-tab ${addMode === 'syllabus' ? 'is-on' : ''}`}>Syllabus</button>
              </div>
            </div>

            {addMode === 'manual' ? (
              <form onSubmit={handleCreateManual} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                <input value={manual.title} onChange={(e) => setManual((m) => ({ ...m, title: e.target.value }))} placeholder="Class title (e.g. Software Engineering)" className="input" />
                <div className="form-grid-2">
                  <input value={manual.class_number} onChange={(e) => setManual((m) => ({ ...m, class_number: e.target.value }))} placeholder="Class number (CPSC 491)" className="input" />
                  <input value={manual.section} onChange={(e) => setManual((m) => ({ ...m, section: e.target.value }))} placeholder="Section" className="input" />
                </div>
                <input value={manual.professor} onChange={(e) => setManual((m) => ({ ...m, professor: e.target.value }))} placeholder="Professor" className="input" />
                <div className="form-grid-2">
                  <input value={manual.meeting_days} onChange={(e) => setManual((m) => ({ ...m, meeting_days: e.target.value }))} placeholder="Meets (e.g. Tue/Thu)" className="input" />
                  <input value={manual.meeting_time} onChange={(e) => setManual((m) => ({ ...m, meeting_time: e.target.value }))} placeholder="Time (e.g. 1:00-2:15 PM)" className="input" />
                </div>
                <div className="form-grid-2">
                  <input value={manual.classroom} onChange={(e) => setManual((m) => ({ ...m, classroom: e.target.value }))} placeholder="Classroom" className="input" />
                  <input value={manual.office_hours} onChange={(e) => setManual((m) => ({ ...m, office_hours: e.target.value }))} placeholder="Office hours" className="input" />
                </div>
                <input value={manual.term} onChange={(e) => setManual((m) => ({ ...m, term: e.target.value }))} placeholder="Term (Spring 2026)" className="input" />
                <button disabled={createManual.isPending} type="submit" className="btn btn-primary">
                  {createManual.isPending ? 'Creating…' : 'Create class'}
                </button>
                {createManual.error ? <p className="text-danger" style={{ fontSize: '0.75rem' }}>{createManual.error.message}</p> : null}
              </form>
            ) : (
              <form onSubmit={handleUploadSyllabus} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Upload one syllabus (PDF, DOCX, PPTX, TXT, MD). Atlus parses class details and calendar dates.
                </p>
                <input
                  id="syllabus-file-input"
                  type="file"
                  accept=".pdf,.docx,.pptx,.txt,.md,.markdown"
                  onChange={(e) => {
                    setSyllabusFile(e.target.files?.[0] || null);
                    setSyllabusUploadProgress(0);
                    setSyllabusStage('idle');
                  }}
                  style={{ display: 'none' }}
                />
                <div className="flex flex-col gap-2" style={{ flexWrap: 'wrap' }}>
                  <label
                    htmlFor="syllabus-file-input"
                    className="file-label-btn"
                  >
                    Choose File
                  </label>
                  <p className="text-muted truncate flex-1" style={{ fontSize: '0.75rem', minWidth: 0 }}>
                    Selected: {syllabusFile?.name || 'No file selected'}
                  </p>
                  <button
                    disabled={createFromSyllabus.isPending || !syllabusFile}
                    type="submit"
                    className="btn btn-primary"
                  >
                    {createFromSyllabus.isPending ? 'Uploading…' : 'Upload Selected File'}
                  </button>
                </div>
                {createFromSyllabus.isPending || syllabusStage === 'done' || syllabusStage === 'error' ? (
                  <div>
                    <div className="progress-track">
                      {syllabusStage === 'parsing' ? (
                        <div className="progress-fill parsing" style={{ width: '100%' }} />
                      ) : syllabusStage === 'done' ? (
                        <div className="progress-fill ok" style={{ width: '100%' }} />
                      ) : syllabusStage === 'error' ? (
                        <div className="progress-fill err" style={{ width: `${Math.max(3, syllabusUploadProgress)}%` }} />
                      ) : (
                        <div
                          className="progress-fill"
                          style={{ width: `${Math.max(3, syllabusUploadProgress)}%` }}
                        />
                      )}
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      {syllabusStage === 'uploading'
                        ? `Uploading file: ${syllabusUploadProgress}%`
                        : syllabusStage === 'parsing'
                          ? 'Upload complete. Parsing syllabus with AI…'
                          : syllabusStage === 'done'
                            ? 'Done. Class and calendar events were created.'
                            : 'Upload failed. Please try again.'}
                    </p>
                  </div>
                ) : null}
                {createFromSyllabus.error ? <p className="text-danger" style={{ fontSize: '0.75rem' }}>{createFromSyllabus.error.message}</p> : null}
              </form>
            )}
          </div>
        </div>
      ) : null}

      {editClass ? (
        <div className="modal-backdrop" onClick={() => setEditClass(null)}>
          <form
            onSubmit={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="home-modal"
          >
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>Edit class</h3>
            <input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} placeholder="Class title" className="input" style={{ marginBottom: '0.5rem' }} />
            <div className="form-grid-2">
              <input value={editForm.class_number} onChange={(e) => setEditForm((f) => ({ ...f, class_number: e.target.value }))} placeholder="Class number" className="input" />
              <input value={editForm.section} onChange={(e) => setEditForm((f) => ({ ...f, section: e.target.value }))} placeholder="Section" className="input" />
            </div>
            <input value={editForm.professor} onChange={(e) => setEditForm((f) => ({ ...f, professor: e.target.value }))} placeholder="Professor" className="input" style={{ marginTop: '0.5rem' }} />
            <div className="form-grid-2" style={{ marginTop: '0.5rem' }}>
              <input value={editForm.meeting_days} onChange={(e) => setEditForm((f) => ({ ...f, meeting_days: e.target.value }))} placeholder="Meeting days" className="input" />
              <input value={editForm.meeting_time} onChange={(e) => setEditForm((f) => ({ ...f, meeting_time: e.target.value }))} placeholder="Meeting time" className="input" />
            </div>
            <div className="form-grid-2" style={{ marginTop: '0.5rem' }}>
              <input value={editForm.classroom} onChange={(e) => setEditForm((f) => ({ ...f, classroom: e.target.value }))} placeholder="Classroom" className="input" />
              <input value={editForm.office_hours} onChange={(e) => setEditForm((f) => ({ ...f, office_hours: e.target.value }))} placeholder="Office hours" className="input" />
            </div>
            <input value={editForm.term} onChange={(e) => setEditForm((f) => ({ ...f, term: e.target.value }))} placeholder="Term" className="input" style={{ marginTop: '0.5rem' }} />
            <div className="flex gap-2" style={{ marginTop: '0.75rem' }}>
              <button type="submit" disabled={updateClass.isPending} className="btn btn-primary">
                {updateClass.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditClass(null)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {syllabusPreviewClass ? (
        <div className="modal-backdrop" onClick={() => setSyllabusPreviewClass(null)}>
          <div
            className="home-modal home-modal-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="section-head">
              <h3 style={{ margin: 0, fontSize: '1rem' }}>
                Syllabus Preview · {syllabusPreviewClass.title}
              </h3>
              <button type="button" onClick={() => setSyllabusPreviewClass(null)} className="text-link">
                Close
              </button>
            </div>

            {syllabusPreviewLoading ? (
              <p className="text-muted">Loading syllabus preview…</p>
            ) : syllabusPreviewError ? (
              <p className="text-danger">{syllabusPreviewError.message || 'Failed to load preview'}</p>
            ) : !syllabusPreviewData?.has_syllabus ? (
              <p className="text-muted">No syllabus text found for this class yet. Upload a syllabus first.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2" style={{ marginBottom: '0.75rem' }}>
                  {syllabusPreviewData?.source?.file_path ? (
                    <a
                      href={syllabusPreviewData.source.file_path}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-xs"
                    >
                      Open original file
                    </a>
                  ) : null}
                  {syllabusPreviewData?.source?.filename ? (
                    <span className="text-muted" style={{ fontSize: '0.75rem', alignSelf: 'center' }}>
                      Source: {syllabusPreviewData.source.filename}
                    </span>
                  ) : null}
                </div>
                <div>
                  {(syllabusPreviewData?.sections || []).map((s, idx) => (
                    <div key={`${s.title}-${idx}`} className="syllabus-preview-block">
                      <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>{s.title}</p>
                      <pre>
                        {s.content}
                      </pre>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
