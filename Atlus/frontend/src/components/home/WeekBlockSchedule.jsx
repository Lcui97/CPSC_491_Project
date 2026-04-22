import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** Column order Sun → Sat (matches Date.getDay()). */
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Expand common syllabus / registrar abbreviations before day-name parsing.
 * Examples: MoWe → Mon+Wed, TuTh / TTh → Tue+Thu, TR → Tue+Thu, MWF → Mon+Wed+Fri.
 */
export function normalizeMeetingDaysString(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';

  // Longest concatenated patterns first (order matters).
  s = s.replace(/MoWeFr/gi, 'Monday Wednesday Friday');
  s = s.replace(/MoWe/gi, 'Monday Wednesday');
  s = s.replace(/TuTh|TTh|Tuth/gi, 'Tuesday Thursday');
  s = s.replace(/Tu\s*\/\s*Th|T\s*\/\s*Th|T\/Th\b/gi, 'Tuesday Thursday');
  s = s.replace(/WeFr/gi, 'Wednesday Friday');
  s = s.replace(/ThFr/gi, 'Thursday Friday');
  s = s.replace(/MoTu/gi, 'Monday Tuesday');

  // Space- or punctuation-separated letter codes (TR = Tue/Thu in US college notation).
  s = s.replace(/\bT\s*[,/&]\s*R\b/gi, 'Tuesday Thursday');
  s = s.replace(/\bT\s*[,/&]\s*Th\b/gi, 'Tuesday Thursday');

  // Standalone bundles.
  s = s.replace(/\bMWF\b/gi, 'Monday Wednesday Friday');
  s = s.replace(/\bMW\b/gi, 'Monday Wednesday');
  s = s.replace(/\bTR\b/gi, 'Tuesday Thursday');

  // Two-letter day tokens (campus shorthand); word boundaries avoid breaking "Tuesday".
  s = s.replace(/\bMo\b/g, 'Monday');
  s = s.replace(/\bTu\b/g, 'Tuesday');
  s = s.replace(/\bWe\b/g, 'Wednesday');
  s = s.replace(/\bTh\b/g, 'Thursday');
  s = s.replace(/\bFr\b/g, 'Friday');
  s = s.replace(/\bSa\b/g, 'Saturday');
  s = s.replace(/\bSu\b/g, 'Sunday');

  return s.trim();
}

/** M T W R F S U → Date.getDay() — u=Sunday, m=Monday, …, s=Saturday (R = Thursday). */
function addCompactLetterCodes(originalRaw, days) {
  const stripped = originalRaw.replace(/[^mtwrfsu]/gi, '').toLowerCase();
  if (stripped.length < 1 || stripped.length > 14) return;
  if (!/^[mtwrfsu]+$/i.test(stripped)) return;
  const map = { m: 1, t: 2, w: 3, r: 4, f: 5, s: 6, u: 0 };
  for (const c of stripped) {
    const idx = map[c];
    if (idx !== undefined) days.add(idx);
  }
}

/**
 * @returns {Set<number>} weekday indices matching Date.getDay(): 0 = Sunday … 6 = Saturday
 */
export function parseMeetingDaysToIndices(raw) {
  const days = new Set();
  if (!raw || typeof raw !== 'string') return days;
  const normalized = normalizeMeetingDaysString(raw);
  const lower = normalized.toLowerCase().trim();
  if (!lower) return days;

  function addFromFragment(str) {
    const t = str.trim();
    if (!t) return;
    if (/^th$/i.test(t)) {
      days.add(4);
      return;
    }
    if (/\bmon(day)?\b/.test(str)) days.add(1);
    if (/\btue(sday)?\b|\btues\b/.test(str)) days.add(2);
    if (/\bwed(nesday)?\b/.test(str)) days.add(3);
    if (/\bthu(rsday)?\b|\bthurs(day)?\b/.test(str)) days.add(4);
    if (/\bfri(day)?\b/.test(str)) days.add(5);
    if (/\bsat(urday)?\b/.test(str)) days.add(6);
    if (/\bsun(day)?\b/.test(str)) days.add(0);
  }

  addFromFragment(lower);

  const fragments = lower
    .split(/\s*(?:\/|,|\band\b|;|\s{2,})\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  fragments.forEach(addFromFragment);

  const letterMap = { m: 1, t: 2, w: 3, r: 4, f: 5, s: 6, u: 0 };
  lower.split(/\s+/).forEach((tok) => {
    const tt = tok.trim();
    if (/^[mtwrfsu]$/i.test(tt)) {
      const idx = letterMap[tt.toLowerCase()];
      if (idx !== undefined) days.add(idx);
    }
  });

  if (days.size === 0) {
    addCompactLetterCodes(raw, days);
  }

  return days;
}

function cardThemeIndex(cls) {
  const seed = `${cls?.title || ''}-${cls?.id || ''}`;
  let acc = 0;
  for (let i = 0; i < seed.length; i += 1) acc += seed.charCodeAt(i);
  return acc % 6;
}

/** Rough ordering within a column: earlier times first when parsable */
function meetingTimeSortKey(timeStr) {
  if (!timeStr?.trim()) return 1440;
  const m = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return 720;
  let h = parseInt(m[1], 10);
  const mins = parseInt(m[2] || '0', 10);
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 60 + mins;
}

export default function WeekBlockSchedule({ classes = [] }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('classes');

  const todayCol = useMemo(() => new Date().getDay(), []);

  const slotsByDay = useMemo(() => {
    const cols = Array.from({ length: 7 }, () => []);
    classes.forEach((cls) => {
      const profile = cls.profile || {};
      const raw =
        mode === 'office_hours'
          ? (profile.office_hours || '').trim()
          : (profile.meeting_days || '').trim();
      const indices = parseMeetingDaysToIndices(raw);
      if (indices.size === 0) return;

      const code = profile.class_number?.trim() || '';
      const courseName = (cls.title || '').trim();
      const headline = code || courseName || 'Class';
      const subtitle =
        code && courseName && courseName.toLowerCase() !== code.toLowerCase()
          ? courseName
          : '';

      const meeting_time =
        mode === 'office_hours'
          ? (profile.office_hours || '').trim()
          : (profile.meeting_time || '').trim();
      const classroom =
        mode === 'office_hours'
          ? (profile.professor ? `Prof. ${profile.professor}` : '').trim()
          : (profile.classroom || '').trim();

      const entry = {
        cls,
        headline,
        subtitle,
        meeting_time,
        classroom,
        isOffice: mode === 'office_hours',
      };
      indices.forEach((dayIdx) => {
        cols[dayIdx].push(entry);
      });
    });
    cols.forEach((col) => {
      col.sort((a, b) => meetingTimeSortKey(a.meeting_time) - meetingTimeSortKey(b.meeting_time));
    });
    return cols;
  }, [classes, mode]);

  const hasAny = slotsByDay.some((c) => c.length > 0);

  return (
    <div>
      <div className="week-schedule-filter" role="group" aria-label="Schedule view">
        <button
          type="button"
          className={`week-schedule-filter-btn ${mode === 'classes' ? 'is-on' : ''}`}
          onClick={() => setMode('classes')}
          aria-pressed={mode === 'classes'}
        >
          Class schedule
        </button>
        <button
          type="button"
          className={`week-schedule-filter-btn ${mode === 'office_hours' ? 'is-on' : ''}`}
          onClick={() => setMode('office_hours')}
          aria-pressed={mode === 'office_hours'}
        >
          Office hours
        </button>
      </div>

      {!hasAny ? (
        <p className="text-muted" style={{ fontSize: '0.875rem', margin: '0.75rem 0 0' }}>
          {mode === 'office_hours' ? (
            <>
              No <strong>office hours</strong> text found on your classes yet. Edit a class or upload a syllabus so this view can show them.
            </>
          ) : (
            <>
              Add <strong>meeting days</strong> and <strong>meeting time</strong> on each class (or upload a syllabus) to build your week view.
            </>
          )}
        </p>
      ) : (
        <div
          className="week-schedule-grid"
          role="region"
          aria-label={mode === 'office_hours' ? 'Weekly office hours' : 'Weekly class schedule'}
        >
          {WEEKDAY_SHORT.map((name, colIdx) => {
            const items = slotsByDay[colIdx];
            const isToday = colIdx === todayCol;
            return (
              <div
                key={name}
                className={`week-schedule-col ${isToday ? 'week-schedule-col-today' : ''}`}
              >
                <div className="week-schedule-col-head">
                  <span>{name}</span>
                  {isToday ? <span className="week-schedule-today-pill">Today</span> : null}
                </div>
                <div className="week-schedule-col-body">
                  {items.map(({ cls, headline, subtitle, meeting_time, classroom, isOffice }) => (
                    <button
                      key={cls.id}
                      type="button"
                      className={`week-schedule-block t${cardThemeIndex(cls)}`}
                      onClick={() => navigate(`/brain/${cls.id}/notes`)}
                      title={`Open ${cls.title || headline}`}
                    >
                      <span className="week-schedule-block-title">{headline}</span>
                      {subtitle ? (
                        <span className="week-schedule-block-subtitle">{subtitle}</span>
                      ) : null}
                      {isOffice ? (
                        <span className="week-schedule-block-oh-tag">Office hours</span>
                      ) : null}
                      {meeting_time ? (
                        <span className={`week-schedule-block-time ${isOffice ? 'week-schedule-block-time-oh' : ''}`}>
                          {meeting_time}
                        </span>
                      ) : null}
                      {classroom ? (
                        <span className="week-schedule-block-room">{classroom}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
