(() => {
  'use strict';

  const STORAGE_KEY = 'digital-pet-state-v1';
  const DAY_MS = 86_400_000;
  const TICK_MS = 60_000;
  const BOOT_KEY = 'digital-pet-booted-v1';

  const FORMS = [
    { level: 1, name: 'FORM_01 // SPROUT', art: ['    ▄▄▄    ', '  ▄█████▄  ', ' ▐█ ▀ ▀ █▌ ', ' ▐█  ▄  █▌ ', '  ▀█████▀  ', '   ▀ █ ▀   '].join('\n') },
    { level: 3, name: 'FORM_02 // SIGNAL', art: [' ▄▄     ▄▄ ', '████▄▄▄████', '██ ▀   ▀ ██', '██   ▄   ██', ' ▀██▄▄▄██▀ ', '  ▀█ █ █▀  '].join('\n') },
    { level: 6, name: 'FORM_03 // VOID', art: ['▄██▄   ▄██▄', '███████████', '██ ▄   ▄ ██', '██   ▀   ██', '▀██▄▄▄▄▄██▀', ' ▀█▄ █ ▄█▀ '].join('\n') }
  ];

  const DEFAULT_STATE = {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hunger: 80,
    energy: 70,
    bond: 25,
    mood: 65,
    xp: 0,
    level: 1,
    sleeping: false,
    logs: []
  };

  const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
  const stamp = () => new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' }).format(new Date());

  function safeState(raw) {
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_STATE,
      ...parsed,
      createdAt: Number(parsed.createdAt) || Date.now(),
      updatedAt: Number(parsed.updatedAt) || Date.now(),
      logs: Array.isArray(parsed.logs) ? parsed.logs.slice(0, 5) : []
    };
  }

  function loadState() {
    try {
      const state = safeState(localStorage.getItem(STORAGE_KEY));
      const minutesAway = Math.min(720, Math.floor((Date.now() - state.updatedAt) / TICK_MS));
      if (minutesAway > 0) {
        state.hunger = clamp(state.hunger - minutesAway * 0.18);
        state.energy = clamp(state.energy - minutesAway * (state.sleeping ? -0.35 : 0.12));
        state.mood = clamp(state.mood - minutesAway * 0.08);
        state.logs.unshift({ time: stamp(), text: `SYNCED AFTER ${minutesAway}M OFFLINE.` });
      }
      return state;
    } catch {
      return { ...DEFAULT_STATE, logs: [] };
    }
  }

  let state = loadState();

  const boot = document.querySelector('#boot');
  const skipBoot = document.querySelector('#skipBoot');

  function finishBoot() {
    document.body.classList.remove('booting');
    boot.classList.add('hidden');
    try { sessionStorage.setItem(BOOT_KEY, '1'); } catch {}
  }

  let bootedThisSession = false;
  try { bootedThisSession = sessionStorage.getItem(BOOT_KEY) === '1'; } catch {}
  if (bootedThisSession) finishBoot();
  else {
    skipBoot.addEventListener('click', finishBoot);
    setTimeout(finishBoot, 1950);
  }

  const els = {
    pet: document.querySelector('#pet'), evolution: document.querySelector('#evolution'),
    age: document.querySelector('#age'), level: document.querySelector('#level'),
    status: document.querySelector('#statusText'), xpText: document.querySelector('#xpText'),
    xpBar: document.querySelector('#xpBar'), log: document.querySelector('#log')
  };

  function formForLevel(level) {
    return [...FORMS].reverse().find((form) => level >= form.level) || FORMS[0];
  }

  function addLog(text) {
    state.logs.unshift({ time: stamp(), text });
    state.logs = state.logs.slice(0, 5);
  }

  function gainXp(amount) {
    state.xp += amount;
    while (state.xp >= 100) {
      state.xp -= 100;
      state.level += 1;
      state.bond = clamp(state.bond + 8);
      addLog(`LEVEL UP // ${String(state.level).padStart(2, '0')}`);
    }
  }

  function save() {
    state.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function moodLabel() {
    if (state.sleeping) return 'SLEEP CYCLE // ACTIVE';
    if (state.hunger < 25) return 'AWAKE // HUNGRY';
    if (state.energy < 20) return 'AWAKE // DRAINED';
    if (state.mood >= 80) return 'AWAKE // THRIVING';
    if (state.mood < 35) return 'AWAKE // STATIC';
    return 'AWAKE // CURIOUS';
  }

  function render() {
    const form = formForLevel(state.level);
    const day = Math.floor((Date.now() - state.createdAt) / DAY_MS) + 1;
    els.pet.textContent = form.art;
    els.pet.classList.toggle('sleeping', state.sleeping);
    els.evolution.textContent = form.name;
    els.age.textContent = `DAY ${String(day).padStart(3, '0')}`;
    els.level.textContent = String(state.level).padStart(2, '0');
    els.status.textContent = moodLabel();
    els.xpText.textContent = `${state.xp} / 100`;
    els.xpBar.style.width = `${state.xp}%`;

    ['hunger', 'energy', 'bond', 'mood'].forEach((stat) => {
      document.querySelector(`#${stat}Value`).textContent = state[stat];
      document.querySelector(`#${stat}Bar`).style.width = `${state[stat]}%`;
    });

    document.querySelector('[data-action="sleep"]').innerHTML = state.sleeping
      ? '<span>04</span>WAKE'
      : '<span>04</span>SLEEP';
    els.log.innerHTML = state.logs.map((entry) => `<li><time>[${entry.time}]</time> ${entry.text}</li>`).join('');
  }

  const actions = {
    feed() {
      if (state.sleeping) return addLog('FEED BLOCKED // NØVA IS ASLEEP.');
      state.hunger = clamp(state.hunger + 24);
      state.energy = clamp(state.energy + 3);
      state.mood = clamp(state.mood + 4);
      gainXp(12);
      addLog('NUTRIENT PACKET ACCEPTED. +12 XP');
    },
    pet() {
      if (state.sleeping) {
        state.bond = clamp(state.bond + 1);
        return addLog('QUIET CONTACT // BOND +1.');
      }
      state.bond = clamp(state.bond + 10);
      state.mood = clamp(state.mood + 12);
      gainXp(8);
      addLog('CONTACT RECOGNIZED. +8 XP');
    },
    play() {
      if (state.sleeping) return addLog('PLAY BLOCKED // WAKE NØVA FIRST.');
      if (state.energy < 12 || state.hunger < 10) return addLog('PLAY BLOCKED // LOW RESOURCES.');
      state.energy = clamp(state.energy - 14);
      state.hunger = clamp(state.hunger - 9);
      state.mood = clamp(state.mood + 16);
      state.bond = clamp(state.bond + 5);
      gainXp(20);
      addLog('SIMULATION COMPLETE. +20 XP');
    },
    sleep() {
      state.sleeping = !state.sleeping;
      if (state.sleeping) {
        state.energy = clamp(state.energy + 18);
        state.hunger = clamp(state.hunger - 4);
        addLog('SLEEP CYCLE INITIALIZED.');
      } else {
        state.mood = clamp(state.mood + 5);
        addLog('SLEEP CYCLE ENDED.');
      }
    }
  };

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.action;
      actions[action]();
      save();
      render();
      button.classList.add('active');
      els.pet.classList.add('react');
      setTimeout(() => { button.classList.remove('active'); els.pet.classList.remove('react'); }, 180);
    });
  });

  if (!state.logs.length) addLog('NØVA CORE INITIALIZED.');
  save();
  render();

  setInterval(() => {
    state.hunger = clamp(state.hunger - 1);
    state.energy = clamp(state.energy + (state.sleeping ? 3 : -1));
    if (state.hunger < 30 || state.energy < 25) state.mood = clamp(state.mood - 1);
    save();
    render();
  }, TICK_MS);

  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
})();
