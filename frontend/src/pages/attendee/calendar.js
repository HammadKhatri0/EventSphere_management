const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => {
  const x = new Date(d);
  return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}Z`;
};
const escapeText = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** RFC 5545 line folding at 75 characters. */
const fold = (line) => line.match(/.{1,74}/g).map((part, i) => (i ? ` ${part}` : part)).join('\r\n');

const eventLines = (s) => {
  const speakers = (s.speakers || []).map((p) => p.name).join(', ');
  const expoTitle = s.expo?.title;
  const description = [s.description, speakers && `Speakers: ${speakers}`].filter(Boolean).join('\n\n');
  return [
    'BEGIN:VEVENT',
    `UID:${s._id}@eventsphere`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(s.startTime)}`,
    `DTEND:${stamp(s.endTime)}`,
    `SUMMARY:${escapeText(s.title)}`,
    `LOCATION:${escapeText([s.location, expoTitle].filter(Boolean).join(' · '))}`,
    description && `DESCRIPTION:${escapeText(description)}`,
    s.my?.reminderMinutes && 'BEGIN:VALARM',
    s.my?.reminderMinutes && 'ACTION:DISPLAY',
    s.my?.reminderMinutes && `DESCRIPTION:${escapeText(s.title)}`,
    s.my?.reminderMinutes && `TRIGGER:-PT${s.my.reminderMinutes}M`,
    s.my?.reminderMinutes && 'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean);
};

/** Build an .ics calendar for one or many sessions and trigger a client-side download. */
export function downloadIcs(sessions, filename = 'eventsphere-agenda') {
  const list = Array.isArray(sessions) ? sessions : [sessions];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EventSphere//Agenda//EN', 'CALSCALE:GREGORIAN', ...list.flatMap(eventLines), 'END:VCALENDAR'];
  const blob = new Blob([`${lines.map(fold).join('\r\n')}\r\n`], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
