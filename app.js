const secondaryContainers = [
  document.querySelector('#secondaryTimersLeft'),
  document.querySelector('#secondaryTimersRight'),
];
const timerElements = new Map();
let audioContext;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function createSecondaryTimer(id) {
  const card = document.createElement('article');
  card.className = 'secondary-timer';
  card.innerHTML = `
    <div class="timer-card" data-timer-id="${id}">
      <div class="card-header-line">
        <label class="timer-name-label" for="timer-name-${id}">Nombre</label>
        <span class="status-badge" data-status>Listo</span>
      </div>
      <input id="timer-name-${id}" class="form-control timer-name" type="text" value="Temporizador ${id}" maxlength="40" data-name aria-label="Nombre del temporizador ${id}">
      <div class="timer-display" data-display>05:00</div>
      <div class="progress timer-progress" role="progressbar" aria-label="Progreso del temporizador ${id}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        <div class="progress-bar" data-progress></div>
      </div>
      <div class="timer-controls mt-3">
        <div class="btn-group">
          <button class="btn btn-sm btn-primary" data-action="toggle">Iniciar</button>
          <button class="btn btn-sm btn-outline-secondary" data-action="reset">Reiniciar</button>
        </div>
      </div>
    </div>`;
  secondaryContainers[id <= 4 ? 0 : 1].append(card);
}

for (let id = 1; id <= 8; id += 1) createSecondaryTimer(id);

document.querySelectorAll('[data-timer-id]').forEach((element) => {
  const minutesInput = element.querySelector('[data-minutes]');
  const secondsInput = element.querySelector('[data-seconds]');
  const initialSeconds = minutesInput
    ? Number(minutesInput.value) * 60 + Number(secondsInput.value)
    : 300;
  timerElements.set(element.dataset.timerId, {
    element,
    total: initialSeconds,
    remaining: initialSeconds,
    running: false,
    paused: false,
    interval: null,
  });
});

function readDuration(timer) {
  const minutes = Math.max(0, Math.min(999, Number.parseInt(timer.element.querySelector('[data-minutes]').value, 10) || 0));
  const seconds = Math.max(0, Math.min(59, Number.parseInt(timer.element.querySelector('[data-seconds]').value, 10) || 0));
  timer.element.querySelector('[data-minutes]').value = minutes;
  timer.element.querySelector('[data-seconds]').value = seconds;
  return minutes * 60 + seconds;
}

function syncSecondaryDurations(seconds) {
  timerElements.forEach((timer) => {
    if (timer.element.dataset.timerId !== 'main') {
      pauseTimer(timer);
      timer.total = seconds;
      timer.remaining = seconds;
      render(timer);
    }
  });
}
function renderSummary() {
  const mainTimer = timerElements.get('main');
  const anyPaused = [...timerElements.values()].some((timer) => timer.paused);
  const summary = document.querySelector('#participantSummary');
  if (!mainTimer || (!anyPaused && mainTimer.remaining !== 0)) {
    summary.hidden = true;
    return;
  }

  summary.hidden = false;
  const list = summary.querySelector('[data-summary-list]');
  const rows = [];
  timerElements.forEach((timer) => {
    if (timer.element.dataset.timerId === 'main') return;
    const row = document.createElement('div');
    const name = document.createElement('span');
    const elapsed = document.createElement('strong');
    row.className = 'summary-row';
    name.textContent = timer.element.querySelector('[data-name]').value || 'Sin nombre';
    elapsed.textContent = formatTime(timer.total - timer.remaining);
    row.append(name, elapsed);
    rows.push(row);
  });
  list.replaceChildren(...rows);
}

function render(timer) {
  const percent = timer.total > 0 ? ((timer.total - timer.remaining) / timer.total) * 100 : 0;
  timer.element.querySelector('[data-display]').textContent = formatTime(timer.remaining);
  timer.element.querySelector('[data-progress]').style.width = `${percent}%`;
  timer.element.querySelector('.timer-progress').style.setProperty('--remaining-progress', `${100 - percent}%`);
  if (timer.element.dataset.timerId === 'main') {
    const secondAngle = (timer.remaining % 60) * 6;
    const minuteAngle = (timer.remaining % 3600) * 0.1;
    timer.element.style.setProperty('--second-angle', `${secondAngle}deg`);
    timer.element.style.setProperty('--minute-angle', `${minuteAngle}deg`);
  }
  const status = timer.element.querySelector('[data-status]');
  const toggle = timer.element.querySelector('[data-action="toggle"]');
  status.className = 'status-badge';
  timer.element.classList.remove('done', 'paused');
  if (timer.running) {
    status.textContent = 'En curso';
    status.classList.add('running');
    if (toggle) toggle.textContent = 'Pausar';
  } else if (timer.remaining === 0) {
    status.textContent = 'Finalizado';
    status.classList.add('finished');
    if (toggle) toggle.textContent = 'Iniciar';
    timer.element.classList.add('done');
  } else if (timer.paused) {
    status.textContent = 'Pausado';
    status.classList.add('paused');
    if (toggle) toggle.textContent = 'Continuar';
    timer.element.classList.add('paused');
  } else {
    status.textContent = 'Listo';
    if (toggle) toggle.textContent = 'Iniciar';
  }
  renderSummary();
}

function beep(duration = 3, volume = 0.45) {
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const endTime = audioContext.currentTime + duration;
    oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, endTime);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(endTime);
  } catch (error) {
    // El sonido es opcional y puede estar bloqueado por el navegador.
  }
}

function pauseTimer(timer, markPaused = true) {
  timer.running = false;
  timer.paused = markPaused && timer.remaining > 0;
  clearInterval(timer.interval);
  timer.interval = null;
  render(timer);
}

function startTimer(timer) {
  if (timer.remaining === 0) resetTimer(timer);
  timer.running = true;
  timer.paused = false;
  clearInterval(timer.interval);
  timer.interval = setInterval(() => {
    timer.remaining -= 1;
    if (timer.remaining <= 0) {
      timer.remaining = 0;
      pauseTimer(timer, false);
      beep();
    } else {
      render(timer);
      if (timer.remaining <= 10) beep(0.18, 0.28);
    }
  }, 1000);
  render(timer);
}

function resetTimer(timer) {
  pauseTimer(timer, false);
  timer.total = timer.element.dataset.timerId === 'main'
    ? readDuration(timer)
    : timerElements.get('main').total;
  timer.remaining = timer.total;
  render(timer);
}

function toggleTimer(timer) {
  if (timer.running) pauseTimer(timer);
  else startTimer(timer);
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (action) {
    const timer = timerElements.get(action.closest('[data-timer-id]').dataset.timerId);
    if (action.dataset.action === 'toggle') toggleTimer(timer);
    if (action.dataset.action === 'reset') resetTimer(timer);
    return;
  }
  const preset = event.target.closest('[data-preset]');
  if (preset) {
    const timer = timerElements.get('main');
    const seconds = Number(preset.dataset.preset);
    timer.element.querySelector('[data-minutes]').value = Math.floor(seconds / 60);
    timer.element.querySelector('[data-seconds]').value = seconds % 60;
    resetTimer(timer);
    syncSecondaryDurations(timer.total);
  }
});

document.querySelectorAll('#mainTimer [data-minutes], #mainTimer [data-seconds]').forEach((input) => {
  input.addEventListener('change', () => {
    const mainTimer = timerElements.get('main');
    resetTimer(mainTimer);
    syncSecondaryDurations(mainTimer.total);
  });
});

document.querySelector('#startAll').addEventListener('click', () => timerElements.forEach(startTimer));
document.querySelector('#pauseAll').addEventListener('click', () => timerElements.forEach(pauseTimer));
document.querySelector('#resetAll').addEventListener('click', () => timerElements.forEach(resetTimer));

timerElements.forEach(render);
