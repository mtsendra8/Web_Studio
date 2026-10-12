const STORAGE_KEY = 'diario-estudio-sesiones';

const form = document.getElementById('study-form');
const dateInput = document.getElementById('session-date');
const themeInput = document.getElementById('session-theme');
const minutesInput = document.getElementById('session-minutes');
const sessionsList = document.getElementById('sessions-list');
const streakCount = document.getElementById('streak-count');
const streakLabel = document.getElementById('streak-label');
const bestStreakCount = document.getElementById('best-streak-count');
const clearHistoryButton = document.getElementById('clear-history');

const todayValue = toDateInputValue(new Date());
dateInput.value = todayValue;

init();

form.addEventListener('submit', (event) => {
  event.preventDefault();

  const date = dateInput.value;
  const topic = themeInput.value.trim();
  const minutes = Number(minutesInput.value);

  if (!date) {
    alert('Selecciona una fecha.');
    return;
  }

  if (!topic) {
    alert('El tema es obligatorio.');
    themeInput.focus();
    return;
  }

  if (!Number.isInteger(minutes) || minutes <= 0) {
    alert('Los minutos deben ser un número mayor que 0.');
    minutesInput.focus();
    return;
  }

  const sessions = getSessions();
  sessions.push({
    id: createSessionId(),
    date,
    topic,
    minutes,
  });

  saveSessions(sessions);
  form.reset();
  dateInput.value = todayValue;
  render();
});

clearHistoryButton.addEventListener('click', () => {
  const hasSessions = getSessions().length > 0;

  if (!hasSessions) {
    return;
  }

  const confirmed = window.confirm('¿Seguro que quieres borrar todo el historial?');
  if (!confirmed) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  render();
});

function init() {
  const sessions = getSessions();
  saveSessions(sessions);
  render();
}

function getSessions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((session) => normalizeSession(session))
      .filter((session) => session.date && session.topic && session.minutes > 0);
  } catch (error) {
    return [];
  }
}

function normalizeSession(session) {
  const minutes = Number(session.minutes);

  return {
    id: String(session.id ?? createSessionId()),
    date: String(session.date || ''),
    topic: String(session.topic ?? session.theme ?? ''),
    minutes: Number.isFinite(minutes) ? minutes : 0,
  };
}

function saveSessions(sessions) {
  const normalized = sessions.map((session) => normalizeSession(session));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

function createSessionId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function render() {
  const sessions = getSessions();
  const ordered = [...sessions].sort((a, b) => compareLocalDateStrings(b.date, a.date));

  if (ordered.length === 0) {
    sessionsList.innerHTML = '<li class="empty-state">Todavía no hay sesiones registradas.</li>';
    updateStreak([]);
    updateBestStreak([]);
    return;
  }

  sessionsList.innerHTML = ordered
    .map(
      (session) => `
        <li class="session-item">
          <div class="session-details">
            <div>
              <span class="session-theme">${escapeHtml(session.topic)}</span>
              <span class="session-date">${formatDate(session.date)}</span>
            </div>
          </div>
          <div class="session-actions">
            <span class="session-minutes">${session.minutes} min</span>
            <button type="button" class="delete-button" data-session-id="${session.id}">Eliminar</button>
          </div>
        </li>
      `
    )
    .join('');

  const deleteButtons = document.querySelectorAll('.delete-button');
  deleteButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const sessionId = button.dataset.sessionId;
      const sessions = getSessions();
      const filteredSessions = sessions.filter((session) => session.id !== sessionId);

      saveSessions(filteredSessions);
      render();
    });
  });

  updateStreak(sessions);
  updateBestStreak(sessions);
}

function updateStreak(sessions) {
  const datesWithSession = new Set(sessions.map((session) => session.date));
  const today = new Date();
  const todayKey = toDateInputValue(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = toDateInputValue(yesterday);

  let streak = 0;
  let currentDate = new Date(today);

  if (datesWithSession.has(todayKey)) {
    currentDate = new Date(today);
  } else if (datesWithSession.has(yesterdayKey)) {
    currentDate = new Date(yesterday);
  } else {
    streakCount.textContent = '0';
    streakLabel.textContent = 'Todavía no hay racha activa.';
    return;
  }

  while (datesWithSession.has(toDateInputValue(currentDate))) {
    streak += 1;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  streakCount.textContent = String(streak);

  if (datesWithSession.has(todayKey)) {
    streakLabel.textContent =
      streak === 1 ? '¡Has empezado tu racha!' : `Llevas ${streak} días seguidos estudiando.`;
  } else {
    streakLabel.textContent = 'La racha sigue viva: hoy aún no has estudiado, pero ayer sí.';
  }
}

function updateBestStreak(sessions) {
  const validDates = [...new Set(sessions.map((session) => session.date))]
    .filter((dateString) => !isFutureDate(dateString))
    .sort((a, b) => compareLocalDateStrings(a, b));

  const bestStreak = calculateBestStreak(validDates);
  bestStreakCount.textContent = String(bestStreak);
}

function calculateBestStreak(dates) {
  if (dates.length === 0) {
    return 0;
  }

  let best = 1;
  let current = 1;

  for (let index = 1; index < dates.length; index += 1) {
    const previousDate = dates[index - 1];
    const currentDate = dates[index];

    if (differenceInCalendarDays(previousDate, currentDate) === 1) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

function isFutureDate(dateString) {
  const today = toDateInputValue(new Date());
  return compareLocalDateStrings(dateString, today) > 0;
}

function differenceInCalendarDays(dateA, dateB) {
  const left = parseLocalDate(dateA);
  const right = parseLocalDate(dateB);
  const utcLeft = Date.UTC(left.getFullYear(), left.getMonth(), left.getDate());
  const utcRight = Date.UTC(right.getFullYear(), right.getMonth(), right.getDate());
  return Math.round((utcRight - utcLeft) / 86400000);
}

function compareLocalDateStrings(dateA, dateB) {
  const left = parseLocalDate(dateA);
  const right = parseLocalDate(dateB);
  return left.getTime() - right.getTime();
}

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
