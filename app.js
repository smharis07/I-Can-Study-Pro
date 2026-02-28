// = 'use strict';
// =================================================================================================================================================
// == I CAN STUDY-Pro :: cute like you, my love . .. 
// =================================================================================================================================================
(function() {
  'use strict';

  // ======== Data, State & Constants ========
  const DB_NAME = 'ICanStudyDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'keyval';
  const HEAVY_DATA_THRESHOLD = 5;
  const SAVE_THROTTLE_MS = 1000;
  const TEAL_COLOR = '#2E6C63'; // Teal from the palette
  
  let model = { subjects: [], activityDates: [], streak: 0, lastActivityDate: null, lastDailyCheck: null, journalEntries: [], todoList: [], beehiveTags: [], beehiveLayouts: {}, promptResponses: {}, ideaLabs: [] };
  let uiState = { openCards: {}, scrollY: 0 };
  let saveTimeout = null;
  let revertKaomojiTimeout = null;
  let greetingTimeout = null;
  
  let focusSession = {
      isActive: false,
      schedule: [],
      currentIndex: -1,
      timerInterval: null,
      remainingTime: 0,
      isPaused: false,
      pointsEarned: 0
  };

  // ==========================================================
  // ==    Frame Templates for Idea Labs                     ==
  // ==========================================================
  const FRAME_TEMPLATES = {
      argument: {
          title: 'Argument & Evidence',
          type: 'argument',
          content: { claim: '', evidence: '', counter: '', rebuttal: '', conclusion: '' },
          render(container, content, saveCallback) {
              container.className = 'idea-lab-frame-content frame-argument';
              container.innerHTML = `
                  <div>
                      <div class="frame-argument-label" style="color: ${TEAL_COLOR}">Claim (What is your opinion?)</div>
                      <div class="frame-editable" data-key="claim" contenteditable="true">${content.claim}</div>
                  </div>
                  <div>
                      <div class="frame-argument-label" style="color: ${TEAL_COLOR}">Evidence (Give examples, facts, etc.)</div>
                      <div class="frame-editable" data-key="evidence" contenteditable="true">${content.evidence}</div>
                  </div>
                  <div>
                      <div class="frame-argument-label" style="color: ${TEAL_COLOR}">Counterargument (What might others say?)</div>
                      <div class="frame-editable" data-key="counter" contenteditable="true">${content.counter}</div>
                  </div>
                  <div>
                      <div class="frame-argument-label" style="color: ${TEAL_COLOR}">Rebuttal (What would you say to those who disagree?)</div>
                      <div class="frame-editable" data-key="rebuttal" contenteditable="true">${content.rebuttal}</div>
                  </div>
                  <div style="grid-column: 1 / -1;">
                      <div class="frame-argument-label" style="color: ${TEAL_COLOR}">Conclusion (Restate your claim in a powerful way)</div>
                      <div class="frame-editable" data-key="conclusion" contenteditable="true">${content.conclusion}</div>
                  </div>
              `;
              container.querySelectorAll('.frame-editable').forEach(el => {
                  el.addEventListener('blur', () => {
                      IdeaLabEditor.processMentions(el);
                      saveCallback(el.dataset.key, el.innerHTML);
                  });
                  IdeaLabEditor.processMentions(el);
              });
          }
      },
      compare: {
          title: 'Compare & Contrast',
          type: 'compare',
          content: { compare: '', contrast: '', common: '' }, 
          render(container, content, saveCallback) {
              container.className = 'idea-lab-frame-content';
              container.innerHTML = `
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                      <div>
                          <div class="frame-argument-label" style="color: ${TEAL_COLOR}">Compare (How things are alike)</div>
                          <div class="frame-editable" data-key="compare" contenteditable="true">${content.compare}</div>
                      </div>
                      <div>
                          <div class="frame-argument-label" style="color: ${TEAL_COLOR}">Contrast (How things are different)</div>
                          <div class="frame-editable" data-key="contrast" contenteditable="true">${content.contrast}</div>
                      </div>
                  </div>
                  <div>
                       <div class="frame-argument-label" style="color: ${TEAL_COLOR}">Common Points (Shared characteristics)</div>
                       <div class="frame-editable" data-key="common" contenteditable="true" style="min-height: 60px;">${content.common || ''}</div>
                  </div>
              `;
              container.querySelectorAll('.frame-editable').forEach(el => {
                  el.addEventListener('blur', () => {
                      IdeaLabEditor.processMentions(el);
                      saveCallback(el.dataset.key, el.innerHTML);
                  });
                  IdeaLabEditor.processMentions(el);
              });
          }
      },
      cause: {
          title: 'Cause & Effect',
          type: 'cause',
          content: { causes: [''], effects: [''] },
          render(container, content, saveCallback, refreshFrame) {
              container.className = 'idea-lab-frame-content frame-cause-effect';
              if (!Array.isArray(content.causes)) content.causes = [content.cause || ''];
              if (!Array.isArray(content.effects)) content.effects = [content.effect1 || ''];

              const generateList = (items, key) => {
                  return items.map((item, index) => `
                    <div class="dynamic-input-row" style="margin-bottom: 8px; display:flex; gap:4px; align-items:start;">
                        <div class="frame-editable" data-array-key="${key}" data-index="${index}" contenteditable="true" style="flex:1; min-height:40px;">${item}</div>
                         <button class="btn btn-ghost btn-mini remove-item-btn" data-array-key="${key}" data-index="${index}" style="color:var(--danger-main); padding: 4px;"><i class="fa-solid fa-minus"></i></button>
                    </div>
                  `).join('');
              };

              container.innerHTML = `
                  <div class="frame-cause-effect-cause">
                      <div class="frame-argument-label" style="color: ${TEAL_COLOR}; display:flex; justify-content:space-between; align-items:center;">
                        Causes 
                        <button class="btn btn-ghost btn-mini add-item-btn" data-target="causes"><i class="fa-solid fa-plus"></i> Add</button>
                      </div>
                      <div id="causes-list">${generateList(content.causes, 'causes')}</div>
                  </div>
                  <div class="frame-cause-effect-effects">
                      <div class="frame-argument-label" style="color: ${TEAL_COLOR}; display:flex; justify-content:space-between; align-items:center;">
                        Effects
                        <button class="btn btn-ghost btn-mini add-item-btn" data-target="effects"><i class="fa-solid fa-plus"></i> Add</button>
                      </div>
                      <div id="effects-list">${generateList(content.effects, 'effects')}</div>
                  </div>
              `;

              container.querySelectorAll('.frame-editable').forEach(el => {
                  el.addEventListener('blur', () => {
                      IdeaLabEditor.processMentions(el);
                      const key = el.dataset.arrayKey;
                      const idx = parseInt(el.dataset.index);
                      content[key][idx] = el.innerHTML;
                      saveCallback(key, content[key]); 
                  });
                  IdeaLabEditor.processMentions(el);
              });

              container.querySelectorAll('.add-item-btn').forEach(btn => {
                  btn.onclick = () => {
                      const target = btn.dataset.target;
                      content[target].push('');
                      saveCallback(target, content[target]);
                      refreshFrame(); 
                  };
              });

              container.querySelectorAll('.remove-item-btn').forEach(btn => {
                  btn.onclick = () => {
                      const target = btn.dataset.arrayKey;
                      const idx = parseInt(btn.dataset.index);
                      if(content[target].length > 1) {
                          content[target].splice(idx, 1);
                          saveCallback(target, content[target]);
                          refreshFrame();
                      } else {
                          content[target][0] = '';
                          saveCallback(target, content[target]);
                          refreshFrame();
                      }
                  };
              });
          }
      },
      note: {
          title: 'Sticky Note',
          type: 'note',
          content: { text: '' },
          render(container, content, saveCallback) {
              container.className = 'idea-lab-frame-content frame-sticky-note';
              container.innerHTML = `
                  <div class="frame-editable" data-key="text" contenteditable="true" style="white-space: pre-wrap;">${content.text}</div>
              `;
              container.querySelectorAll('.frame-editable').forEach(el => {
                  el.addEventListener('blur', () => {
                      IdeaLabEditor.processMentions(el);
                      saveCallback(el.dataset.key, el.innerHTML);
                  });
                  IdeaLabEditor.processMentions(el);
              });
          }
      }
  };
  
  const biscuits = [
    { key: 'facts', label: 'Confidence recalling facts', options: [{ text: 'Very Low', w: 10 }, { text: 'Low', w: 25 }, { text:'Medium', w: 50 }, { text: 'High', w: 75 }, { text: 'Very High', w: 100 }] },
    { key: 'curve', label: 'Answering curveball questions', options: [{ text: 'Not Confident', w: 20 }, { text: 'Somewhat', w: 50 },{ text: 'Confident', w: 75 }, { text: 'Very Confident', w: 100 }] },
    { key: 'study', label: 'Time spent studying', options: [{ text: 'Minimal', w: 10 }, { text: 'Light', w: 25 }, { text: 'Moderate', w: 40 }, { text: 'Extensive', w: 55 }, { text: 'Very Extensive', w: 70 }, { text: 'Integrated', w: 85 }, { text: 'Deep', w: 100 }] },
    { key: 'relearn', label: 'Time spent relearning', options: [{ text: 'Rarely', w: 100 }, { text: 'Interval', w: 75 }, { text: 'Sometimes', w: 50 }, { text: 'Often', w: 25 }] }
  ];

  const noteColors = [
    { name: 'default', icon: 'fa-ban' }, { name: 'red' }, { name: 'orange' }, 
    { name: 'white' }, { name: 'teal' }, { name: 'blue' }, { name: 'indigo' }, 
    { name: 'purple' }, { name: 'pink' }, { name: 'gray' }
  ];

  const journalPrompts = [
    "What was the most challenging concept you tackled today, and what made it difficult?", "Describe a 'lightbulb' moment you had while studying. What clicked into place?", "If you had to teach one thing you learned today to a friend, how you would explain it?", "What a a study technique was most effective for you today, and why do you think it worked well?", "Identify one area where you still feel uncertain. What's one specific question you have about it?", "How does something you learned today connect to what you already know?", "What was your biggest distraction today, and how can you minimize it tomorrow?", "Reflect on your energy and focus levels. When were you most productive, and when did you struggle?", "What are you most proud of accomplishing in your study session today?", "What is one small, actionable goal you can set for your next study session to improve?", "Did you encounter any surprising connections between different topics today?", "How did you handle a moment of frustration or feeling 'stuck' during your study?", "What's one thing you could do differently next time to make your study session even better?", "Summarize the most important takeaway from today's study in a single sentence.", "If you were to create a quiz question about what you learned, what would it be?", "Based on today's session, what topic needs the most attention next time?", "Was this a 'deep work' session or a 'shallow work' session? Why?", "Describe your thought process when you encountered a particularly tricky problem.", "How effective were your breaks? Did you come back feeling refreshed or more distracted?", "How well did you stick to your study plan? What went right, and what went wrong?", "If you had to create a metaphor or analogy for the main topics, what would it be?", "What's one thing you did today just for yourself, outside of studying?", "How are you feeling as you sit down to study today? What's on your mind?", "What are you grateful for in this moment?", "Describe a moment of confusion. What was the exact point where you got lost?", "What is one thing you will start doing, stop doing, and continue doing in your studies?", "Who is one person you could talk to about what you learned today? Why them?", "On a scale of 1-10, how would you rate the efficiency of your study session? What would it take to make it a 10?", "Did your mood affect your studies today? If so, how?", "Hey, just take a deep breath. Regardless of how much you understood or how much you finished, you showed up for yourself today. What's one kind thought you can offer yourself for that effort?", "Could you maybe share a little bit about yourself, I'd love to get to know you! (⸝⸝ò﹏ò⸝⸝)"
  ];
  
  const journalOptions = [
      { id: 'breakthrough', text: 'A major breakthrough' }, { id: 'progress', text: 'A small step forward' }, { id: 'confusion', text: 'A point of confusion' }, { id: 'review', text: 'A moment of review' }
  ];

  // ======== IndexedDB Module ========
  const idb = {
    db: null,
    async open() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject("Error opening database");
        request.onsuccess = (event) => { this.db = event.target.result; resolve(this.db); };
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) { db.createObjectStore(STORE_NAME); }
        };
      });
    },
    async get(key) {
      if (!this.db) await this.open();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onerror = () => reject("Error getting data");
        request.onsuccess = () => resolve(request.result);
      });
    },
    async set(key, value) {
      if (!this.db) await this.open();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onerror = () => reject("Error setting data");
        request.onsuccess = () => resolve(request.result);
      });
    },
    async delete(key) {
        if (!this.db) await this.open();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);
            request.onerror = () => reject("Error deleting data");
            request.onsuccess = () => resolve();
        });
    }
  };

  // ======== Data Persistence & Utils ========
  const loadModel = async () => {
      const defaultModel = { subjects: [], activityDates: [], streak: 0, lastActivityDate: null, lastDailyCheck: null, journalEntries: [], todoList: [], beehiveTags: [], beehiveLayouts: {}, promptResponses: {}, ideaLabs: [] };
      try {
          const loaded = await idb.get('model') || defaultModel;
          model = { ...defaultModel, ...loaded };
           if (!model.beehiveLayouts) model.beehiveLayouts = {}; 
           if (!model.ideaLabs) model.ideaLabs = [];
          if (model.todoList) { model.todoList.forEach(task => { if (!task.id) task.id = uid(); }); }
          if (model.customFrames) delete model.customFrames;
      } catch { model = defaultModel; }
  };
  const saveModel = async () => { await idb.set('model', model); };
  const saveModelThrottled = () => { clearTimeout(saveTimeout); saveTimeout = setTimeout(saveModel, SAVE_THROTTLE_MS); };
  const loadUiState = async () => { try { uiState = await idb.get('uiState') || { openCards: {}, scrollY: 0 }; } catch { uiState = { openCards: {}, scrollY: 0 }; } };
  const saveUiState = async () => {
      uiState.openCards = {};
      document.querySelectorAll('.card-body-wrapper.open').forEach(body => {
          const card = body.closest('.card');
          if (card?.dataset.id) uiState.openCards[card.dataset.id] = true;
      });
      await idb.set('uiState', uiState);
  };
  
  const uid = () => Date.now().toString(36) + Math.random().toString(36).substring(2);
  const el = (tag, className, textContent) => { const e = document.createElement(tag); if (className) e.className = className; if (textContent != null) e.textContent = textContent; return e; };
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const debounce = (func, delay) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; };
  const toYYYYMMDD = (date) => date.toISOString().split('T')[0];
    
  // --- Streak Logic ---
  const logActivityAndAddPoint = (points = 1, skipUpdate = false) => {
    model.streak = (model.streak || 0) + points;
    const todayStr = toYYYYMMDD(new Date());
    model.lastActivityDate = todayStr;
    model.activityDates = model.activityDates || [];
    if (!new Set(model.activityDates).has(todayStr)) { model.activityDates.push(todayStr); }
    saveModelThrottled();
    if (!skipUpdate) {
        updateDashboardIfVisible();
    }
  };

  const deductStreakPoint = (points = 1, skipUpdate = false) => {
      model.streak = Math.max(0, (model.streak || 0) - points);
      saveModelThrottled();
      if (!skipUpdate) {
          updateDashboardIfVisible();
      }
  };

  const runDailyCheck = () => {
    const todayStr = toYYYYMMDD(new Date());
    if (model.lastDailyCheck === todayStr) return;
    let modelChanged = false;
    if (model.lastActivityDate) {
        const lastActivity = new Date(model.lastActivityDate);
        const todayNormalized = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
        const lastActivityNormalized = new Date(lastActivity.getFullYear(), lastActivity.getMonth(), lastActivity.getDate());
        const daysMissed = Math.round((todayNormalized - lastActivityNormalized) / (1000 * 60 * 60 * 24));
        if (daysMissed >= 2) {
            if (model.streak === 1) { model.streak = 0; modelChanged = true; } 
            else if (model.streak > 1) { model.streak = Math.max(0, model.streak - 2); modelChanged = true; }
        }
    }
    model.lastDailyCheck = todayStr;
    if (modelChanged) { saveModel(); }
  };
  
  let savedRange = null;
  const saveSelection = (containerEl) => {
      if (!containerEl) return;
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (containerEl.contains(range.commonAncestorContainer)) savedRange = range;
      } else { savedRange = null; }
  };
  const restoreSelection = () => {
      if (savedRange) {
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(savedRange);
      }
  };
  
  // ======== Core UI & Interaction Logic ========
  const smoothScrollTo = (element) => {
    if (!element) return;
    requestAnimationFrame(() => {
        const appbarHeight = document.querySelector('.appbar')?.offsetHeight || 0;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - appbarHeight - 20;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    });
  };
  
  const slideToggle = (bodyWrapper, twist) => {
    const isOpen = bodyWrapper.classList.contains('open');
    if (isOpen) {
        bodyWrapper.classList.remove('open');
        twist.classList.add('closed');
    } else {
        bodyWrapper.classList.add('open');
        twist.classList.remove('closed');
    }
    setTimeout(saveUiState, 450);
  };
   
  function revealAndScroll(targetId) {
    const targetCard = document.querySelector(`.card[data-id="${targetId}"]`);
    if (!targetCard) return;
    let current = targetCard;
    while (current) {
        const body = current.querySelector('.card-body-wrapper');
        const twist = current.querySelector('.twist');
        if (body && !body.classList.contains('open')) {
            body.style.transition = 'none'; 
            body.classList.add('open');
            if(twist) twist.classList.remove('closed');
            setTimeout(() => { body.style.transition = ''; }, 50); 
        }
        current = current.parentElement.closest('.card');
    }
    setTimeout(() => smoothScrollTo(targetCard), 400);
    targetCard.style.transition = 'box-shadow 0.3s ease-in-out';
    targetCard.style.boxShadow = '0 0 25px 5px var(--yellow-glow)';
    setTimeout(() => { targetCard.style.boxShadow = ''; }, 2500);
    saveUiState();
  }

  function navigateToCard(targetId) {
    if (!targetId) return;
    if (!mainView.classList.contains('hidden')) { revealAndScroll(targetId); } 
    else { backBtn.click(); setTimeout(() => revealAndScroll(targetId), 600); }
  }

  const editable = (tag, text, onDone) => {
    const h = el(tag, 'title', text);
    h.contentEditable = "true";
    h.spellcheck = false;
    h.onfocus = () => {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(h);
        selection.removeAllRanges();
        selection.addRange(range);
    };
    h.onkeydown = e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); h.blur(); } };
    h.onblur = () => { onDone(h.innerText.trim() || text); };
    return h;
  };
  
  const customModal = {
    el: document.getElementById('customModal'),
    messageEl: document.getElementById('modalMessage'),
    okBtn: document.getElementById('modalOk'),
    cancelBtn: document.getElementById('modalCancel'),
    resolvePromise: null,
    init() {
      this.okBtn.onclick = () => this.close(true);
      this.cancelBtn.onclick = () => this.close(false);
      this.el.onclick = (e) => { if (e.target === this.el) this.close(false); };
    },
    show(message, showCancel = false) {
      return new Promise(resolve => {
        this.resolvePromise = resolve;
        this.messageEl.textContent = message;
        this.cancelBtn.style.display = showCancel ? '' : 'none';
        
        // appear above dynamic heavy overlays 
        this.el.style.zIndex = '9999';
        
        this.el.classList.add('visible');
        this.okBtn.focus();
      });
    },
    close(value) {
      this.el.classList.remove('visible');
      // transition finish before resolving the massive z-index out
      setTimeout(() => { this.el.style.zIndex = ''; }, 300);
      
      if (this.resolvePromise) { this.resolvePromise(value); this.resolvePromise = null; }
    }
  };

  // ======== Data Calculation & UI Update Helpers ========
  const topicScore = t => avg((t.sel || []).map(x => x.w));
  const chapterScore = c => avg((c.topics || []).map(topicScore));
  const subjectScore = s => avg((s.chapters || []).map(chapterScore));
  const getScoreColorClass = (score) => { if (score >= 75) return "good"; if (score >= 50) return "mid"; if (score > 0) return "warn"; return "bad"; }
    
  const updateDashboardIfVisible = debounce(() => {
    if (document.getElementById('dashboard').style.display === 'block') {
      renderDashboard();
    }
  }, 300);

  function updateTopicProgress(topicCard, t) {
      const score = topicScore(t);
      const scoreVal = topicCard.querySelector('.score-line .badge:last-child');
      const feedback = topicCard.querySelector('.feedback');
      scoreVal.textContent = score + '%';
      feedback.innerHTML = score >= 90 ? "Now, it's honey-sweet! <i class='fa-solid fa-clover' style='color: #ff80ab'></i> Your hard work is paying off." 
                        : score >= 75 ? "<i class='fa-solid fa-tree' style='color: var(--ok-main)'></i> Keep growing! You've planted a strong foundation." 
                        : score >= 50 ? "<i class='fa-solid fa-seedling' style='color: #9ccc65'></i> Needs more caring. Let's tend to your garden."
                        : score >= 30 ? "<i class='fa-solid fa-leaf' style='color: var(--yellow-main)'></i> A sprout is showing! Keep nurturing it to see it grow."
                        : score > 0 ? "<i class='fa-solid fa-leaf' style='color: var(--yellow-main)'></i> Needs Attention. A little extra effort will help you bloom." 
                        : "Select cookies to see score.";
  }
  function updateChapterProgress(chapterCard, c) {
      if (!chapterCard || !c) return;
      const score = chapterScore(c);
      const progress = chapterCard.querySelector('.card-progress');
      if (progress) {
          const fill = progress.querySelector('.meter-mini > div');
          progress.lastChild.textContent = ` ${score}%`;
          fill.style.width = `${score}%`;
          fill.className = getScoreColorClass(score);
      }
  }
  function updateSubjectProgress(subjectCard, s) {
      if (!subjectCard || !s) return;
      const score = subjectScore(s);
      const progress = subjectCard.querySelector('.card-progress');
      if (progress) {
          const fill = progress.querySelector('.meter-mini > div');
          progress.lastChild.textContent = ` ${score}%`;
          fill.style.width = `${score}%`;
          fill.className = getScoreColorClass(score);
      }
  }
  
  // ======== Renderer Functions ========
  const mainContent = document.getElementById('contentArea');

  function renderTopicBody(t, s, c, container) {
    container.innerHTML = ''; 

    if (typeof t.notes === 'string' || !t.notes) t.notes = { normal: t.notes || '', cues: '', main: '', summary: '' };
    if (!t.noteType) t.noteType = 'normal';
    if (!t.beehiveLabels) t.beehiveLabels = [];

    biscuits.forEach(g => {
        const gBox = el('div', 'group');
        gBox.appendChild(el('span', 'group-label', g.label));
        g.options.forEach(o => {
            const biscuitEl = el('span', 'biscuit', o.text);
            if ((t.sel || []).some(x => x.group === g.key && x.w === o.w)) biscuitEl.classList.add('selected');
            biscuitEl.onclick = () => {
                const currentScore = topicScore(t);
                let oldSubjectScore = -1;
                const subjectCardEl = biscuitEl.closest('.subject-card');
                if (subjectCardEl && s) { oldSubjectScore = subjectScore(s); }

                t.sel = t.sel || [];
                const existingIndex = t.sel.findIndex(x => x.group === g.key);
                const isAlreadySelected = (existingIndex !== -1 && t.sel[existingIndex].w === o.w);
                if (existingIndex !== -1) t.sel.splice(existingIndex, 1);
                gBox.querySelectorAll('.biscuit').forEach(b => b.classList.remove('selected'));
                if (!isAlreadySelected) {
                    t.sel.push({ group: g.key, w: o.w });
                    biscuitEl.classList.add('selected');
                }
                const newScore = topicScore(t);
                if (newScore < currentScore) { deductStreakPoint(); }
                else if (newScore > currentScore) { logActivityAndAddPoint(); }
                
                const topicCard = biscuitEl.closest('.topic-card, #focusContent, .topic-sidebar-card');
                updateTopicProgress(topicCard, t);

                if (!biscuitEl.closest('#focusContent') && !biscuitEl.closest('.topic-sidebar-card')) {
                    const chapterCard = biscuitEl.closest('.chapter-card');
                    updateChapterProgress(chapterCard, c);
                    updateSubjectProgress(subjectCardEl, s);
                }
                
                saveModelThrottled();
                updateDashboardIfVisible();

                if (subjectCardEl && s) {
                    const newSubjectScore = subjectScore(s);
                    if (newSubjectScore === 100 && oldSubjectScore !== -1 && oldSubjectScore < 100) {
                        triggerConfetti();
                    }
                }
            };
            gBox.appendChild(biscuitEl);
        });
        container.appendChild(gBox);
    });

    const scoreLine = el('div', 'score-line');
    scoreLine.appendChild(el('span', 'badge', 'Score:'));
    scoreLine.appendChild(el('span', 'badge', topicScore(t) + '%'));
    const feedback = el('div', 'feedback');
    container.append(scoreLine, feedback);
    updateTopicProgress({querySelector: (sel) => container.querySelector(sel)}, t);

    const notesContainer = el('div', 'notes-container');
    const notes = el('div', 'notes');
    notes.contentEditable = true;
    notes.dataset.placeholder = 'Notes (supports bold, italics, lists, and images)...';
    notes.innerHTML = t.notes.normal || '';

    const cornellContainer = el('div', 'cornell-notes-container');
    const cornellCues = el('div', 'cornell-cues');
    cornellCues.contentEditable = true;
    cornellCues.dataset.placeholder = 'Cues & Questions...';
    cornellCues.innerHTML = t.notes.cues || '';
    const cornellMain = el('div', 'cornell-main');
    cornellMain.contentEditable = true;
    cornellMain.dataset.placeholder = 'Main Notes...';
    cornellMain.innerHTML = t.notes.main || '';
    const cornellSummary = el('div', 'cornell-summary');
    cornellSummary.contentEditable = true;
    cornellSummary.dataset.placeholder = 'Summary...';
    cornellSummary.innerHTML = t.notes.summary || '';
    cornellContainer.append(cornellCues, cornellMain, cornellSummary);
    notesContainer.append(notes, cornellContainer);

    const toolbar = el('div', 'notes-toolbar');

    const createToolbarButton = (command, iconClass, title) => {
        const button = el('button', 'btn');
        button.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
        button.title = title;
        button.onclick = (e) => { e.preventDefault(); document.execCommand(command, false, null); activeEditor?.focus(); updateToolbarState(); };
        return button;
    };
    
    const createHeadingButton = (level) => {
      const tagName = `h${level}`;
      const button = el('button', 'btn', `H${level}`);
      button.title = `Heading ${level}`;
      button.onclick = (e) => {
        e.preventDefault();
        const currentFormat = document.queryCommandValue('formatBlock');
        const format = (currentFormat.toLowerCase() === tagName) ? 'p' : tagName;
        document.execCommand('formatBlock', false, format);
        activeEditor?.focus(); updateToolbarState();
      };
      return button;
    };
    
    const h1Btn = createHeadingButton(1);
    const h2Btn = createHeadingButton(2);
    const boldBtn = createToolbarButton('bold', 'fa-bold', 'Bold');
    const italicBtn = createToolbarButton('italic', 'fa-italic', 'Italic');
    const ulBtn = createToolbarButton('insertUnorderedList', 'fa-list-ul', 'Bulleted List');
    const olBtn = createToolbarButton('insertOrderedList', 'fa-list-ol', 'Numbered List');
    const outdentBtn = createToolbarButton('outdent', 'fa-outdent', 'Decrease Indent');
    const indentBtn = createToolbarButton('indent', 'fa-indent', 'Increase Indent');
    
    const highlighterBtn = el('button', 'btn');
    highlighterBtn.innerHTML = '<i class="fa-solid fa-highlighter"></i>';
    highlighterBtn.title = 'Highlight Text';
    highlighterBtn.onclick = (e) => {
        e.preventDefault(); activeEditor?.focus(); restoreSelection();
        if (savedRange && !savedRange.collapsed) {
            const isHighlighted = document.queryCommandValue('backColor').toLowerCase() === 'rgb(255, 193, 7)';
            document.execCommand('backColor', false, isHighlighted ? 'transparent' : '#FFC107');
            const selection = window.getSelection();
            if (selection.rangeCount > 0) { const range = selection.getRangeAt(0); range.collapse(false); selection.removeAllRanges(); selection.addRange(range); }
        }
        updateToolbarState();
    };

    const imgBtn = el('button', 'btn');
    imgBtn.innerHTML = '<i class="fa-solid fa-image"></i>'; imgBtn.title = "Add Image";
    imgBtn.onclick = (e) => {
        e.preventDefault();
        const fileInput = document.createElement('input');
        fileInput.type = 'file'; fileInput.accept = 'image/*';
        fileInput.onchange = () => {
            const file = fileInput.files[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) { customModal.show("Image is too large (max 5MB)."); return; }
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_WIDTH = 800, MAX_HEIGHT = 800;
                    let width = img.width, height = img.height;
                    if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                    else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                    canvas.width = width; canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    activeEditor?.focus(); restoreSelection();
                    document.execCommand('insertImage', false, dataUrl);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        };
        fileInput.click();
    };

    const colorGroup = el('div', 'toolbar-group');
    const colorBtn = el('button', 'btn');
    colorBtn.innerHTML = '<i class="fa-solid fa-palette"></i>'; colorBtn.title = 'Change note color';
    const colorPalette = el('div', 'color-palette');
    noteColors.forEach(color => {
        const swatch = el('div', 'color-swatch');
        swatch.dataset.color = color.name;
        if (color.icon) swatch.innerHTML = `<i class="fa-solid ${color.icon}"></i>`;
        swatch.onclick = (e) => {
            e.stopPropagation();
            t.noteColor = (color.name === 'default') ? null : color.name;
            contentEditables.forEach(editor => {
                editor.removeAttribute('data-note-color');
                if (t.noteColor) editor.dataset.noteColor = t.noteColor;
            });
            colorPalette.querySelector('.active')?.classList.remove('active');
            swatch.classList.add('active');
            colorPalette.classList.remove('visible');
            saveModelThrottled();
        };
        colorPalette.appendChild(swatch);
    });
    colorGroup.append(colorBtn, colorPalette);
    
    const outsideClickListener = (event) => {
        if (!colorGroup.contains(event.target) && colorPalette.classList.contains('visible')) {
            colorPalette.classList.remove('visible'); document.removeEventListener('click', outsideClickListener);
        }
    };
    colorBtn.onclick = (e) => {
        e.stopPropagation();
        const isVisible = colorPalette.classList.toggle('visible');
        if (isVisible) {
            const currentSwatch = colorPalette.querySelector(`[data-color="${t.noteColor || 'default'}"]`);
            if (currentSwatch) { colorPalette.querySelector('.active')?.classList.remove('active'); currentSwatch.classList.add('active'); }
            document.addEventListener('click', outsideClickListener);
        } else { document.removeEventListener('click', outsideClickListener); }
    };

    const noteTypeGroup = el('div', 'toolbar-group');
    const normalBtn = el('button', 'btn', 'Normal'); normalBtn.title = 'Standard notes view';
    const cornellBtn = el('button', 'btn', 'Cornell'); cornellBtn.title = 'Cornell notes view';
    noteTypeGroup.append(normalBtn, cornellBtn);
    
    const beehiveHint = el('span', '', '⌬ Type #tobuildaBeeHive');
    beehiveHint.style.cssText = 'color: var(--ink-muted); font-size: 12px; margin-left: auto;';
    
    toolbar.append(boldBtn, italicBtn, el('div','toolbar-separator'), h1Btn, h2Btn, el('div','toolbar-separator'), ulBtn, olBtn, el('div','toolbar-separator'), outdentBtn, indentBtn, el('div','toolbar-separator'), highlighterBtn, imgBtn, el('div','toolbar-separator'), colorGroup, el('div', 'toolbar-separator'), noteTypeGroup, beehiveHint);
    
    container.appendChild(notesContainer);
    container.appendChild(toolbar);
    
    const contentEditables = [notes, cornellCues, cornellMain, cornellSummary];
    let activeEditor = notes;
    const updateActiveEditor = (e) => { activeEditor = e.target; };
    const switchNoteView = (type) => {
        t.noteType = type;
        normalBtn.classList.remove('active'); cornellBtn.classList.remove('active');
        notes.classList.add('hidden-transition'); cornellContainer.classList.remove('visible');
        if (type === 'cornell') { cornellBtn.classList.add('active'); cornellContainer.classList.add('visible'); } 
        else { normalBtn.classList.add('active'); notes.classList.remove('hidden-transition'); }
    };
    normalBtn.onclick = () => { switchNoteView('normal'); saveModelThrottled(); };
    cornellBtn.onclick = () => { switchNoteView('cornell'); saveModelThrottled(); };
    switchNoteView(t.noteType);
    if (t.noteColor) { contentEditables.forEach(editor => editor.dataset.noteColor = t.noteColor); }
    
    const syncNotesAndTagsDebounced = debounce((editor) => {
        const noteType = editor.classList.contains('cornell-cues') ? 'cues' : editor.classList.contains('cornell-main') ? 'main' : editor.classList.contains('cornell-summary') ? 'summary' : 'normal';
        t.notes[noteType] = editor.innerHTML;
        BeeHive.syncTagsFromEditor(t, editor);
        saveModelThrottled();
    }, 300);

    const updateToolbarState = () => {
        if (!contentEditables.includes(document.activeElement)) return;
        saveSelection(activeEditor);
        const format = document.queryCommandValue('formatBlock').toLowerCase();
        h1Btn.classList.toggle('active', format === 'h1'); h2Btn.classList.toggle('active', format === 'h2');
        boldBtn.classList.toggle('active', document.queryCommandState('bold'));
        italicBtn.classList.toggle('active', document.queryCommandState('italic'));
        ulBtn.classList.toggle('active', document.queryCommandState('insertUnorderedList'));
        olBtn.classList.toggle('active', document.queryCommandState('insertOrderedList'));
        highlighterBtn.classList.toggle('active', document.queryCommandValue('backColor').toLowerCase() === 'rgb(255, 193, 7)');
    };
    
    contentEditables.forEach(editor => {
        BeeHive.renderInitialTags(editor);
        editor.addEventListener('input', (e) => {
            BeeHive.handleTagUnwrapping(e);
            syncNotesAndTagsDebounced(editor);
            BeeHive.handleTagAutocomplete(e, editor);
        });
        editor.addEventListener('keyup', updateToolbarState);
        editor.addEventListener('keydown', e => { 
            if (BeeHive.handleKeyDown(e, editor)) return;
        });
        editor.addEventListener('mouseup', updateToolbarState);
        editor.addEventListener('focus', (e) => { updateActiveEditor(e); updateToolbarState(); BeeHive.handleTagUnwrapping(e); });
        editor.addEventListener('click', (e) => {
            const clickedTag = e.target.closest('.beehive-tag');
            if (clickedTag) {
                BeeHive.unwrapTag(clickedTag, clickedTag.textContent.length);
            }
            BeeHive.hideAutocomplete(); 
            updateActiveEditor(e); updateToolbarState(); 
        });
        editor.addEventListener('blur', () => { setTimeout(BeeHive.hideAutocomplete, 200); });
    });
  }

  function renderTopic(t, s, c) {
    if (!t.id) t.id = uid();
    const card = el('div', 'card topic-card');
    card.dataset.id = t.id;
    card.dataset.type = 'topic';
    
    const header = el('div', 'card-header');
    const dragHandle = el('span', 'card-drag-handle');
    dragHandle.draggable = true;
    dragHandle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
    dragHandle.title = 'Drag to reorder';
    header.appendChild(dragHandle);

    const twist = el('button', 'btn-mini twist closed', '▾'); header.appendChild(twist);
    const title = editable('h4', t.name, v => { t.name = v; saveModelThrottled(); }); header.appendChild(title);
    header.appendChild(el('div', 'space'));
    const delBtn = el('button', 'btn btn-danger btn-mini');
    delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    header.appendChild(delBtn);
    card.appendChild(header);

    const bodyWrapper = el('div', 'card-body-wrapper');
    const bodyContent = el('div', 'card-body-content');
    bodyWrapper.appendChild(bodyContent);
    card.appendChild(bodyWrapper);
    
    const renderBodyOnOpen = () => {
        if (!bodyContent.hasChildNodes()) {
            renderTopicBody(t,s,c, bodyContent);
        }
        slideToggle(bodyWrapper, twist);
    };
    twist.onclick = renderBodyOnOpen;
    
    delBtn.onclick = async () => {
      if (!(await customModal.show('Remove this topic?', true))) return;
      deductStreakPoint();
      const chapterCard = card.closest('.chapter-card');
      const subjectCard = card.closest('.subject-card');
      c.topics = c.topics.filter(x => x.id !== t.id);
      
      if (BeeHive.pruneUnusedTags()) { saveModelThrottled(); }
      BeeHive.refreshData();

      card.classList.add('is-deleting');
      card.addEventListener('animationend', async () => {
          card.remove();
          await saveModel();
          updateChapterProgress(chapterCard, c);
          updateSubjectProgress(subjectCard, s);
          updateDashboardIfVisible();
      });
    };
    return card;
  }
  
  function renderChapter(c, s) {
    if (!c.id) c.id = uid();
    const card = el('div', 'card chapter-card');
    card.dataset.id = c.id;
    card.dataset.type = 'chapter';
    
    const header = el('div', 'card-header');
    const dragHandle = el('span', 'card-drag-handle');
    dragHandle.draggable = true;
    dragHandle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
    dragHandle.title = 'Drag to reorder';
    header.appendChild(dragHandle);

    const twist = el('button', 'btn-mini twist closed', '▾'); header.appendChild(twist);
    const title = editable('h3', c.name, v => { c.name = v; saveModelThrottled(); }); header.appendChild(title);
    
    const dueDateGroup = el('div', 'due-date-input-group');
    const dueDateLabel = el('span', 'due-date-label');
    dueDateLabel.innerHTML = '<i class="fa-solid fa-bullseye"></i>';
    dueDateLabel.title = 'Set due date';
    const dueDateInput = el('input', 'due-date-input'); 
    dueDateInput.type = 'date';
    if (c.dueDate) dueDateInput.value = c.dueDate;
    dueDateInput.onchange = () => {
        c.dueDate = dueDateInput.value;
        if (c.deadlineStatus) {
            c.deadlineStatus = null;
            c.deadlineSummary = null;
        }
        saveModelThrottled();
        updateDashboardIfVisible();
    };
    dueDateGroup.append(dueDateLabel, dueDateInput);
    header.appendChild(dueDateGroup);

    const progress = el('div', 'card-progress');
    progress.innerHTML = `<div class="meter-mini"><div></div></div> <span>${chapterScore(c)}%</span>`;
    header.appendChild(progress);
    header.appendChild(el('div', 'space'));
    const addBtn = el('button', 'btn btn-primary btn-mini', 'Add Topic');
    const delBtn = el('button', 'btn btn-danger btn-mini');
    delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    header.append(addBtn, delBtn);
    card.appendChild(header);

    const bodyWrapper = el('div', 'card-body-wrapper');
    const bodyContent = el('div', 'card-body-content');
    bodyContent.dataset.dropZoneFor = 'topic';
    bodyWrapper.appendChild(bodyContent);
    card.appendChild(bodyWrapper);

    (c.topics || []).forEach(t => bodyContent.appendChild(renderTopic(t, s, c)));

    addBtn.onclick = async () => {
        const newTopic = { id: uid(), name: 'New Topic', sel: [], notes: {normal:'',cues:'',main:'',summary:''}, noteType:'normal', beehiveLabels:[] };
        c.topics = c.topics || [];
        c.topics.push(newTopic);
        const newTopicCard = renderTopic(newTopic, s, c);
        newTopicCard.classList.add('new-item');
        newTopicCard.addEventListener('animationend', () => newTopicCard.classList.remove('new-item'));
        bodyContent.appendChild(newTopicCard);
        if (!bodyWrapper.classList.contains('open')) { slideToggle(bodyWrapper, twist); setTimeout(() => smoothScrollTo(newTopicCard), 450); } 
        else { smoothScrollTo(newTopicCard); }
        logActivityAndAddPoint();
        await saveModel();

        const chapterCard = newTopicCard.closest('.chapter-card');
        const subjectCard = newTopicCard.closest('.subject-card');
        updateChapterProgress(chapterCard, c);
        updateSubjectProgress(subjectCard, s);
        
        updateDashboardIfVisible();
    };
    
    delBtn.onclick = async () => {
      if (!(await customModal.show('Remove this chapter and all its topics?', true))) return;
      deductStreakPoint();
      const subjectCard = card.closest('.subject-card');
      s.chapters = s.chapters.filter(x => x.id !== c.id);
      
      if (BeeHive.pruneUnusedTags()) { saveModelThrottled(); }
      BeeHive.refreshData();

      card.classList.add('is-deleting');
      card.addEventListener('animationend', async () => {
          card.remove();
          await saveModel();
          updateSubjectProgress(subjectCard, s);
          updateDashboardIfVisible();
      });
    };
    twist.onclick = () => slideToggle(bodyWrapper, twist);
    updateChapterProgress(card, c);
    return card;
  }

  function renderSubject(s) {
    if (!s.id) s.id = uid();
    const card = el('div', 'card subject-card');
    card.dataset.id = s.id;
    card.dataset.type = 'subject';

    const header = el('div', 'card-header');
    const dragHandle = el('span', 'card-drag-handle');
    dragHandle.draggable = true;
    dragHandle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
    dragHandle.title = 'Drag to reorder';
    header.appendChild(dragHandle);
    
    const twist = el('button', 'btn-mini twist closed', '▾'); header.appendChild(twist);
    const title = editable('h2', s.name, v => { s.name = v; saveModelThrottled(); }); header.appendChild(title);
    const dueDateGroup = el('div', 'due-date-input-group');
    const dueDateLabel = el('span', 'due-date-label');
    dueDateLabel.innerHTML = '<i class="fa-solid fa-bullseye"></i>';
    dueDateLabel.title = 'Set due date';
    const dueDateInput = el('input', 'due-date-input');
    dueDateInput.type = 'date';
    if (s.dueDate) dueDateInput.value = s.dueDate;
    dueDateInput.onchange = () => {
        s.dueDate = dueDateInput.value;
        if (s.deadlineStatus) {
            s.deadlineStatus = null;
            s.deadlineSummary = null;
        }
        saveModelThrottled();
        updateDashboardIfVisible();
    };
    dueDateGroup.append(dueDateLabel, dueDateInput);
    header.appendChild(dueDateGroup);
    
    const progress = el('div', 'card-progress');
    progress.innerHTML = `<div class="meter-mini"><div></div></div> <span>${subjectScore(s)}%</span>`;
    header.appendChild(progress);
    header.appendChild(el('div', 'space'));
    const addBtn = el('button', 'btn btn-primary btn-mini', 'Add Chapter');
    const delBtn = el('button', 'btn btn-danger btn-mini');
    delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    header.append(addBtn, delBtn);
    card.appendChild(header);

    const bodyWrapper = el('div', 'card-body-wrapper');
    const bodyContent = el('div', 'card-body-content');
    bodyContent.dataset.dropZoneFor = 'chapter';
    bodyWrapper.appendChild(bodyContent);
    card.appendChild(bodyWrapper);

    addBtn.onclick = async () => {
        const newChapter = { id: uid(), name: 'New Chapter', topics: [] };
        s.chapters = s.chapters || [];
        s.chapters.push(newChapter);
        const newChapterCard = renderChapter(newChapter, s);
        newChapterCard.classList.add('new-item');
        newChapterCard.addEventListener('animationend', () => newChapterCard.classList.remove('new-item'));
        bodyContent.appendChild(newChapterCard);
        if (!bodyWrapper.classList.contains('open')) { slideToggle(bodyWrapper, twist); setTimeout(() => smoothScrollTo(newChapterCard), 450); } 
        else { smoothScrollTo(newChapterCard); }
        logActivityAndAddPoint();
        await saveModel();

        const subjectCard = newChapterCard.closest('.subject-card');
        updateSubjectProgress(subjectCard, s);
        
        updateDashboardIfVisible();
    };
    
    delBtn.onclick = async () => {
      if (!(await customModal.show('Remove this subject and all its content?', true))) return;
      deductStreakPoint();
      model.subjects = model.subjects.filter(x => x.id !== s.id);
      
      if (BeeHive.pruneUnusedTags()) { saveModelThrottled(); }
      BeeHive.pruneUnusedIdeaLabs(s.id);
      
      card.classList.add('is-deleting');
      card.addEventListener('animationend', async () => { card.remove(); await saveModel(); checkEmptyState(); updateDashboardIfVisible(); });
    };

    (s.chapters || []).forEach(c => bodyContent.appendChild(renderChapter(c, s)));
    twist.onclick = () => slideToggle(bodyWrapper, twist);
    updateSubjectProgress(card, s);
    return card;
  }
  
  function checkEmptyState() {
    const isEmpty = !model.subjects || model.subjects.length === 0;
    document.getElementById('emptyState').classList.toggle('hidden', !isEmpty);
  }

  async function renderModelAsync() {
    return new Promise(resolve => {
        mainContent.innerHTML = '';
        checkEmptyState();
        const subjects = model.subjects || [];
        if (subjects.length === 0) { hideGlobalLoader(); resolve(); return; }
        let index = 0;
        const batchSize = 1;
        function processBatch() {
            const frag = document.createDocumentFragment();
            const end = Math.min(index + batchSize, subjects.length);
            for (let i = index; i < end; i++) { frag.appendChild(renderSubject(subjects[i])); }
            mainContent.appendChild(frag);
            index = end;
            if (index < subjects.length) { requestAnimationFrame(processBatch); } 
            else { applyUiState(); hideGlobalLoader(); resolve(); }
        }
        processBatch();
    });
  }

  function applyUiState() {
    Object.keys(uiState.openCards || {}).forEach(id => {
      const card = document.querySelector(`.card[data-id="${id}"]`);
      if (card) {
          const body = card.querySelector('.card-body-wrapper');
          const twist = card.querySelector('.twist');
          if (body && !body.classList.contains('open')) {
              body.classList.add('open');
              if (twist) twist.classList.remove('closed');
              const topicCard = card.closest('.topic-card');
              if(topicCard) {
                  const [s, c, t] = findTopicById(topicCard.dataset.id);
                  if(t) {
                      const bodyContent = topicCard.querySelector('.card-body-content');
                      if(!bodyContent.hasChildNodes()){
                         renderTopicBody(t,s,c, bodyContent);
                      }
                  }
              }
          }
      }
    });

    setTimeout(() => { if (uiState.scrollY > 0 && mainView.style.display !== 'none') window.scrollTo(0, uiState.scrollY); }, 50);
  }

  // ======== DASHBOARD & CHART RENDERING LOGIC ========
  function renderStudyStreak() {
      const container = document.getElementById('studyStreak');
      container.innerHTML = '';
      const streak = model.streak || 0;
      const display = el('div', 'streak-display');
      display.innerHTML = `<div class="streak-number">${streak}</div><div class="streak-label">Streak Points</div>`;
      const weekContainer = el('div', 'streak-week');
      const activityDatesSet = new Set(model.activityDates || []);
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      for (let i = 6; i >= 0; i--) {
          const day = new Date();
          day.setDate(new Date().getDate() - i);
          const dateString = toYYYYMMDD(day);
          const dayEl = el('div', 'streak-day', dayNames[day.getDay()]);
          if (activityDatesSet.has(dateString)) { dayEl.classList.add('active'); }
          weekContainer.appendChild(dayEl);
      }
      display.appendChild(weekContainer);
      container.appendChild(display);
  }
  
  function checkAllTasksComplete() {
      if (!model.todoList || model.todoList.length === 0 || dashboardView.style.display !== 'block') return;
      const allCompleted = model.todoList.every(task => task.completed);
      const honeyIcon = document.querySelector('.dashboard-title .vibrating-icon');
      if (!honeyIcon) return;

      if (allCompleted) {
          const originalContent = honeyIcon.innerHTML;
          const originalClasses = honeyIcon.className;

          honeyIcon.innerHTML = '⁽⁽ଘ( ˊᵕˋ )ଓ⁾⁾';
          honeyIcon.className = 'vibrating-icon happy-dance-animation';
          
          setTimeout(() => {
              if (honeyIcon.innerHTML === '⁽⁽ଘ( ˊᵕˋ )ଓ⁾⁾') {
                  honeyIcon.innerHTML = originalContent;
                  honeyIcon.className = originalClasses;
              }
          }, 5000); 
      }
  }

  function renderTodoList() {
      const container = document.getElementById('todoListContainer');
      const form = document.getElementById('newTodoForm');
      const input = document.getElementById('newTodoInput');
      const clearBtn = document.getElementById('clearCompletedBtn');
      container.innerHTML = '';

      (model.todoList || []).forEach(task => { 
          const item = el('div', 'todo-item');
          item.dataset.id = task.id; item.dataset.type = 'todo';
          const dragHandle = el('span', 'todo-drag-handle');
          dragHandle.draggable = true;
          dragHandle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>'; item.appendChild(dragHandle);

          const checkbox = el('input');
          checkbox.type = 'checkbox'; checkbox.checked = task.completed;
          checkbox.onchange = () => {
              const taskToUpdate = model.todoList.find(t => t.id === task.id);
              if (!taskToUpdate) return;
              const wasCompleted = taskToUpdate.completed;
              taskToUpdate.completed = checkbox.checked;
              textEl.classList.toggle('completed', checkbox.checked);
              if (checkbox.checked && !wasCompleted) { logActivityAndAddPoint(); } 
              else if (!checkbox.checked && wasCompleted) { deductStreakPoint(); }
              saveModelThrottled();
              checkAllTasksComplete();
          };
          item.appendChild(checkbox);

          const textEl = el('span', 'todo-text', task.text);
          textEl.contentEditable = "plaintext-only";
          if (task.completed) textEl.classList.add('completed');
          textEl.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); textEl.blur(); }};
          textEl.onblur = () => {
              const taskToUpdate = model.todoList.find(t => t.id === task.id);
              if (taskToUpdate && taskToUpdate.text !== textEl.textContent) {
                  taskToUpdate.text = textEl.textContent.trim(); saveModelThrottled();
              }
          };
          item.appendChild(textEl);

          const deleteBtn = el('button', 'todo-delete');
          deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
          deleteBtn.onclick = () => {
              model.todoList = model.todoList.filter(t => t.id !== task.id);
              item.style.opacity = '0'; item.style.transition = 'opacity 0.3s';
              setTimeout(() => { item.remove(); saveModelThrottled(); updateDashboardIfVisible();}, 300);
          };
          item.appendChild(deleteBtn);
          container.appendChild(item);
      });
      
      form.onsubmit = (e) => {
          e.preventDefault();
          if (input.value.trim() !== '') {
              model.todoList.push({ id: uid(), text: input.value.trim(), completed: false });
              input.value = ''; saveModelThrottled(); renderTodoList(); 
          }
      };

      clearBtn.onclick = () => { model.todoList = model.todoList.filter(task => !task.completed); saveModelThrottled(); renderTodoList(); };
  }
  
  function renderHoneysJournal() {
      const container = document.getElementById('journalContent');
      container.innerHTML = '';
      const todayStr = toYYYYMMDD(new Date());
      const todaysEntry = (model.journalEntries || []).find(e => e.date === todayStr);
      const promptIndex = (new Date().getDate() - 1) % journalPrompts.length;
      const currentPrompt = journalPrompts[promptIndex];
      container.appendChild(el('div', 'journal-prompt', `${currentPrompt}`));
      
      if (todaysEntry) {
          const responseContainer = el('div', 'journal-response');
          const selectedOption = journalOptions.find(o => o.id === todaysEntry.responseOption);
          responseContainer.innerHTML = `<div class="response-option">${selectedOption ? selectedOption.text : 'Your reflection:'}</div><p>${todaysEntry.responseText || 'No additional notes.'}</p>`;
          container.appendChild(responseContainer);
      } else {
          const optionsContainer = el('div', 'journal-options');
          let selectedOptionId = null;
          journalOptions.forEach(opt => {
              const optBtn = el('button', 'btn journal-option', opt.text);
              optBtn.dataset.id = opt.id;
              optBtn.onclick = () => { optionsContainer.querySelectorAll('.journal-option').forEach(btn => btn.classList.remove('selected')); optBtn.classList.add('selected'); selectedOptionId = opt.id; };
              optionsContainer.appendChild(optBtn);
          });
          const textArea = el('textarea', 'journal-textarea');
          textArea.placeholder = "Elaborate on your thoughts here...";
          const saveBtn = el('button', 'btn btn-primary', 'Save Journal Entry');
          saveBtn.onclick = () => {
              if (!selectedOptionId) { customModal.show("Please select an option before saving."); return; }
              const newEntry = { date: todayStr, prompt: currentPrompt, responseOption: selectedOptionId, responseText: textArea.value.trim() };
              model.journalEntries = model.journalEntries || [];
              model.journalEntries.push(newEntry);
              logActivityAndAddPoint();
              renderHoneysJournal();
          };
          container.append(optionsContainer, textArea, saveBtn);
      }
  }

  function renderDashboard() {
    const allTopics = model.subjects.flatMap(s => s.chapters?.flatMap(c => c.topics || []) || []);
    const overall = avg(allTopics.map(topicScore));
    document.getElementById('overallPct').textContent = overall + '%';
    const fill = document.getElementById('overallFill');
    fill.style.width = overall + '%';
    fill.className = getScoreColorClass(overall);
    const adviceTiers = {
        tier0: ["We'll start with something you'll truly love ⸜(｡˃ ᵕ ˂ )⸝♡", "Let's plant the first seed of knowledge together! ε(´｡•᎑•`)っ","Ready to turn the first page? A new adventure in learning awaits! (づ ｡˃ ᵕ ˂ )づ"],
        tier1: ["You've planted the first seeds! 🌱 Focus on short, daily sessions and active recall to help them sprout.", "Great start! A little bit of consistent effort goes a long way. Keep watering your knowledge garden.","Like a young sprout, your knowledge needs daily sun. A little bit of practice each day makes all the difference."], tier25: ["Your garden is growing! 🪻 Concentrate on weak topics to strengthen their roots.", "Good progress! Now is a great time to revisit tricky concepts and fill in the gaps.","Time to do some weeding! Let's clear out any confusing points to make room for stronger understanding."], tier50: ["Excellent momentum! 🌲 Your knowledge is branching out. Sharpen your skills by practicing a mix of different topics.", "You're building a strong forest of facts! Try explaining a concept to someone else to test your understanding.","Your tree of knowledge is growing tall! Let's see how the branches connect by tackling problems that mix concepts."], tier75: ["You've built a strong foundation! 🧩 Challenge yourself with curveball questions and try explaining concepts to solidify your mastery.", "Amazing work! You're approaching mastery. Look for connections between topics to build a web of knowledge.","The best way to learn is to teach. Try breaking down a complex topic for a friend."], tier90: ["Honey-sweet success! 🌺 Your hard work has blossomed. Now, integrate your knowledge and see how different concepts connect.", "You've achieved mastery! Keep reviewing periodically to ensure this knowledge stays fresh for the long term.", "Your garden is in full bloom! Enjoy the fruits of your labor and see the beautiful connections you've cultivated."]
    };
    let adviceKey;
    if (overall >= 90) adviceKey = 'tier90'; else if (overall >= 75) adviceKey = 'tier75'; else if (overall >= 50) adviceKey = 'tier50'; else if (overall >= 25) adviceKey = 'tier25'; else if (overall > 0) adviceKey = 'tier1'; else adviceKey = 'tier0';
    let advice = adviceTiers[adviceKey][Math.floor(Math.random() * adviceTiers[adviceKey].length)];
    const groupAvgs = biscuits.map(b => ({ label: b.label, score: avg(allTopics.flatMap(t => (t.sel || []).filter(sel => sel.group === b.key).map(sel => sel.w))) })).sort((a,b) => a.score - b.score);
    if (groupAvgs[0] && groupAvgs[0].score < 60 && groupAvgs[0].score > 1 && allTopics.length > 2) { advice += ` It feels like there's a little bee-hive that's just waiting for some gentle attention and a sprinkle of focus on "${groupAvgs[0].label}" (ӦᴗӦ｡)`; }
    document.getElementById('overallAdvice').textContent = advice;

    const biscuitList = document.getElementById("biscuitStats");
    biscuitList.innerHTML = "";
    groupAvgs.forEach(g => { const li = el('li'); li.innerHTML = `<span class="dot ${getScoreColorClass(g.score)}"></span><span class="label"><strong>${g.label}</strong></span><span class="score-tag ${getScoreColorClass(g.score)}">${g.score}%</span>`; biscuitList.appendChild(li); });

    renderStudyStreak(); renderTodoList(); renderHoneysJournal();

    const now = new Date();
    const INTERACTION_WINDOW_MS = 24 * 60 * 60 * 1000;
    const MISSED_PROMPT_WINDOW_MS = 4 * 60 * 60 * 1000;
    const AUTO_MISS_WINDOW_MS = INTERACTION_WINDOW_MS + MISSED_PROMPT_WINDOW_MS;
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    let modelWasUpdatedByAutoMiss = false;

    model.subjects.forEach(s => {
        const checkAndMarkMissed = (item) => {
            if (item.dueDate && !item.deadlineStatus) {
                const autoMissTime = new Date(new Date(item.dueDate + 'T23:59:59').getTime() + AUTO_MISS_WINDOW_MS);
                if (now > autoMissTime) {
                    item.deadlineStatus = 'missed';
                    item.deadlineSummary = 'Oops! Looks like this one played hide-and-seek & wasn\'t found..';
                    modelWasUpdatedByAutoMiss = true;
                }
            }
        };
        checkAndMarkMissed(s);
        (s.chapters || []).forEach(c => checkAndMarkMissed(c));
    });

    if (modelWasUpdatedByAutoMiss) {
        saveModelThrottled();
    }

    const deadlinesContainer = document.getElementById('upcomingDeadlines');
    deadlinesContainer.innerHTML = ''; deadlinesContainer.className = 'scrollable-dash-list';
    const deadlines = [];
    model.subjects.forEach(s => {
        if (s.dueDate) deadlines.push({ name: s.name, dueDate: s.dueDate, id: s.id, type: 'subject', status: s.deadlineStatus, summary: s.deadlineSummary });
        (s.chapters || []).forEach(c => { if (c.dueDate) deadlines.push({ name: `${s.name} > ${c.name}`, dueDate: c.dueDate, id: c.id, type: 'chapter', subjectId: s.id, status: c.deadlineStatus, summary: c.deadlineSummary }); });
    });

    deadlines.map(d => ({ ...d, dueDateObj: new Date(d.dueDate) })).filter(d => (d.dueDateObj >= yesterday)).sort((a, b) => a.dueDateObj - b.dueDateObj)
    .forEach(d => {
        const daysLeft = Math.ceil((d.dueDateObj - new Date()) / (1000 * 60 * 60 * 24));
        let colorClass = 'good'; if (daysLeft < 3) colorClass = 'bad'; else if (daysLeft < 7) colorClass = 'warn';
        
        const deadlineItemContainer = el('div', 'deadline-item-container');
        const deadlineRow = el('div', 'summary-row'); 
        deadlineRow.style.cursor = 'pointer';
        deadlineRow.innerHTML = `<div style="display:flex; align-items:center; gap:8px;"><span class="dot ${colorClass}"></span><strong>${d.name}</strong></div><span class="score-tag ${colorClass}">${daysLeft >= 0 ? `${daysLeft} days left` : 'Due'}</span>`;
        deadlineRow.onclick = () => navigateToCard(d.id);
        deadlineItemContainer.appendChild(deadlineRow);

        const promptStartTime = new Date(d.dueDate + 'T00:00:00');
        const promptEndTime = new Date(promptStartTime.getTime() + INTERACTION_WINDOW_MS);
        const missedPromptEndTime = new Date(promptEndTime.getTime() + MISSED_PROMPT_WINDOW_MS);

        const isDueForPrompt = now >= promptStartTime && now <= promptEndTime;
        const isMissedButInWindow = now > promptEndTime && now <= missedPromptEndTime;
        
        const renderPermanentDeadlineStatus = (container, deadlineData) => {
            container.innerHTML = '';
            container.className = 'deadline-prompt';
            const feedbackEl = el('div', 'deadline-feedback');
            if (deadlineData.status === 'completed') {
                feedbackEl.innerHTML = deadlineData.summary
                    ? `<strong>Completed!</strong><br><p style="white-space:pre-wrap; font-style:normal; margin-top:8px;"><em>Your summary:</em> ${deadlineData.summary}</p>`
                    : '<strong>Completed!</strong> Great work!';
            } else { // missed
                feedbackEl.innerHTML = deadlineData.summary
                    ? `<strong>Missed.</strong><br><p style="white-space:pre-wrap; font-style:normal; margin-top:8px;"><em>Your notes:</em> ${deadlineData.summary}</p>`
                    : 'That\'s just how the cookie crumbles sometimes ( ´･･)ﾉ No Biggie.';
            }
            container.appendChild(feedbackEl);
        };

        if (isDueForPrompt && !d.status) {
            const promptContainer = el('div', 'deadline-prompt');
            const summaryInput = el('textarea', 'deadline-summary-input');
            summaryInput.placeholder = 'Add a quick summary or notes...';
            
            const deadlinePrompts = [ "Did you conquer this quest? How did it go?", "Deadline day! Did you cross the finish line on this one?", "It's due! How do you feel about your work on this?" ];
            const randomPrompt = deadlinePrompts[Math.floor(Math.random() * deadlinePrompts.length)];

            const actionsContainer = el('div', 'deadline-actions');
            const noBtn = el('button', 'btn btn-ghost btn-deadline-no'); 
            noBtn.innerHTML = '<i class="fa-solid fa-xmark"></i> No';
            const yesBtn = el('button', 'btn btn-primary btn-deadline-yes'); 
            yesBtn.innerHTML = '<i class="fa-solid fa-check"></i> Yes!';

            const handleCompletion = (status) => {
                let item;
                if (d.type === 'subject') { item = model.subjects.find(s => s.id === d.id); } 
                else { const subject = model.subjects.find(s => s.id === d.subjectId); if (subject) item = subject.chapters.find(c => c.id === d.id); }
                
                if (item) {
                    item.deadlineStatus = status;
                    item.deadlineSummary = summaryInput.value.trim();
                    saveModelThrottled();

                    const feedbackEl = el('div', 'deadline-feedback');
                    if (status === 'completed') {
                        logActivityAndAddPoint(1, true); // skip update
                        feedbackEl.innerHTML = item.deadlineSummary ? 'Great job! Summary saved and point awarded (• ֊ •｡)' : 'Great job! Point awarded (• ֊ •｡)';
                    } else {
                        deductStreakPoint(1, true); // skip update
                        feedbackEl.innerHTML = item.deadlineSummary ? 'Notes saved. Little by little, we will get there .ᐟ' : 'Whoops, a tiny detour.. Little by little, we will get there .ᐟ (•˕ •ゝ';
                    }
                    
                    promptContainer.innerHTML = '';
                    promptContainer.appendChild(feedbackEl);

                    setTimeout(() => {
                        renderPermanentDeadlineStatus(promptContainer, item);
                        renderDashboard(); // Re-render dashboard after timeout
                    }, 3500);
                }
            };
            
            noBtn.onclick = () => handleCompletion('missed');
            yesBtn.onclick = () => handleCompletion('completed');
            actionsContainer.append(noBtn, yesBtn);
            promptContainer.append(el('p', '', randomPrompt), summaryInput, actionsContainer);
            deadlineItemContainer.appendChild(promptContainer);
        } else if (isMissedButInWindow && !d.status) {
             const promptContainer = el('div', 'deadline-prompt');
             promptContainer.innerHTML = `<div class="deadline-feedback"><strong>Missed.</strong><br>The deadline for this has passed.</div>`;
             deadlineItemContainer.appendChild(promptContainer);
        } else if (d.status) {
            const statusContainer = el('div');
            deadlineItemContainer.appendChild(statusContainer);
            renderPermanentDeadlineStatus(statusContainer, d);
        }
        deadlinesContainer.appendChild(deadlineItemContainer);
    });

    if (deadlinesContainer.children.length === 0) { deadlinesContainer.className = ''; deadlinesContainer.innerHTML = '<p style="color: var(--ink-muted); text-align:center;">No upcoming due dates.</p>'; }
    
    const existingTrigger = document.querySelector('.focus-session-trigger');
    if (existingTrigger) existingTrigger.remove();
    
    const reviewContainer = document.getElementById('reviewNeeded');
    reviewContainer.innerHTML = ''; reviewContainer.className = 'scrollable-dash-list';
    
    const allRankedTopics = [];
    model.subjects.forEach(s => { (s.chapters || []).forEach(c => { (c.topics || []).forEach(t => { allRankedTopics.push({ sId: s.id, cId: c.id, tId: t.id, sName: s.name, cName: c.name, tName: t.name, score: topicScore(t) }); }); }); });
    const topicsToReview = allRankedTopics.filter(item => item.score < 75).sort((a, b) => a.score - b.score);
    if (topicsToReview.length > 0) {
        topicsToReview.forEach(item => {
            const reviewRow = el('div', 'summary-row'); reviewRow.style.cursor = 'pointer';
            reviewRow.innerHTML = `<div style="display:flex; flex-direction:column; align-items: flex-start; gap: 2px; flex:1;"><strong>${item.tName}</strong><small style="color:var(--ink-muted)">${item.sName} > ${item.cName}</small></div><span class="score-tag ${getScoreColorClass(item.score)}">${item.score}%</span>`;
            reviewRow.onclick = () => navigateToCard(item.tId);
            reviewContainer.appendChild(reviewRow);
        });
        if (topicsToReview.length >= 2) {
            const triggerBtn = el('button', 'btn btn-primary btn-mini focus-session-trigger');
            triggerBtn.innerHTML = '</i> Start Focus Session ⩇⩇:⩇⩇';
            triggerBtn.onclick = () => initFocusSessionSetup(topicsToReview);
            reviewContainer.parentElement.appendChild(triggerBtn);
        }
    } else {
        reviewContainer.className = '';
        if (allRankedTopics.length === 0) { reviewContainer.innerHTML = '<p style="color: var(--ink-muted); text-align:center;">Let\'s get buzzing! Add some topics to start your analysis.</p>'; } 
        else { reviewContainer.innerHTML = '<p style="color: var(--ink-muted); text-align:center;">Great! No topics require immediate review (all are 75% or higher).</p>'; } 
    }
    
    const ideaLabsCard = document.getElementById('ideaLabsCard');
    const ideaLabsList = document.getElementById('ideaLabsList');
    if(ideaLabsList) ideaLabsList.innerHTML = '';
    if (ideaLabsCard && model.ideaLabs && model.ideaLabs.length > 0) {
        ideaLabsCard.style.display = 'flex';
        model.ideaLabs.forEach(lab => {
            const subject = model.subjects.find(s => s.id === lab.subjectId);
            const labRow = el('div', 'summary-row');
            labRow.style.cursor = 'pointer';
            labRow.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items: flex-start; gap: 2px; flex:1;">
                    <strong>${lab.title}</strong>
                    <small style="color:var(--ink-muted)">${subject ? `In: ${subject.name}` : 'In: Unlinked Subject'}</small>
                </div>
                <span class="score-tag mid">${(lab.frames || []).length} Frames</span>
                <span class="score-tag mid" style="margin-left: 5px;">${(lab.linkedTopics || []).length} Topics</span>
            `;
            labRow.onclick = () => IdeaLabEditor.open(lab.id);
            ideaLabsList.appendChild(labRow);
        });
    } else if (ideaLabsCard) {
        ideaLabsCard.style.display = 'none';
    }

    renderWavyChart();

    const list = document.getElementById('summaryList');
    list.innerHTML = '';
    model.subjects.forEach(s => {
        const sScore = subjectScore(s);
        const sRow = el('div', 'summary-row');
        const dot = el('span', `dot ${getScoreColorClass(sScore)}`);
        const titleDiv = el('div',''); titleDiv.style.cssText = 'display:flex; align-items:center; gap:8px;';
        titleDiv.append(dot, el('strong','', s.name));
        sRow.append(titleDiv, el('span', `score-tag ${getScoreColorClass(sScore)}`, `${sScore}%`));
        sRow.onclick = () => navigateToCard(s.id);
        sRow.style.cursor = 'pointer'; 
        list.appendChild(sRow);

        const sortedChapters = (s.chapters || []).slice().sort((a, b) => chapterScore(a) - chapterScore(b));
        sortedChapters.forEach(c => {
            const cScore = chapterScore(c);
            const cRow = el('div', 'summary-row'); cRow.style.marginLeft = '20px'; cRow.style.cursor = 'pointer'; cRow.onclick = () => navigateToCard(c.id);
            cRow.innerHTML = `<div style="display:flex; align-items:center; gap:8px;"><span class="dot ${getScoreColorClass(cScore)}"></span><span>${c.name}</span></div><span class="score-tag ${getScoreColorClass(cScore)}">${cScore}%</span>`;
            list.appendChild(cRow);
        });
    });
  }
  
  function renderWavyChart() {
    const chartContainer = document.getElementById("subjectChart");
    chartContainer.innerHTML = "";
    const subjects = model.subjects || [];
    if (subjects.length === 0) { chartContainer.innerHTML = '<p style="text-align:center; color: var(--ink-muted);">Add some subjects to see your performance chart.</p>'; return; }
    const data = subjects.map(s => ({ id: s.id, name: s.name, score: subjectScore(s) }));
    const MAX_SUBJECTS_BEFORE_SCROLL = 8, MIN_WIDTH_PER_SUBJECT = 160, MAX_LABEL_LENGTH = 20;
    let svgWidth;
    if (data.length > MAX_SUBJECTS_BEFORE_SCROLL) { chartContainer.style.overflowX = 'auto'; svgWidth = data.length * MIN_WIDTH_PER_SUBJECT; } 
    else { chartContainer.style.overflowX = 'hidden'; svgWidth = chartContainer.clientWidth; }
    const svgHeight = 370, margin = { top: 40, right: 20, bottom: 130, left: 20 };
    const chartWidth = svgWidth - margin.left - margin.right, chartHeight = svgHeight - margin.top - margin.bottom;
    const bandWidth = chartWidth / data.length;
    const points = data.map((d, i) => ({ x: margin.left + (i * bandWidth) + (bandWidth / 2), y: margin.top + chartHeight - (d.score / 100) * chartHeight, ...d }));
    const line = (points) => { let d = `M ${points[0].x} ${points[0].y}`; for (let i = 0; i < points.length - 1; i++) { const p0 = i > 0 ? points[i - 1] : points[i], p1 = points[i], p2 = points[i + 1], p3 = i < points.length - 2 ? points[i + 2] : p2, tension = 0.5, cp1x = p1.x + (p2.x - p0.x) / 6 * tension, cp1y = p1.y + (p2.y - p0.y) / 6 * tension, cp2x = p2.x - (p3.x - p1.x) / 6 * tension, cp2y = p2.y - (p3.y - p1.y) / 6 * tension; d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`; } return d; };
    const pathData = points.length > 1 ? line(points) : `M ${points[0].x},${points[0].y} L ${points[0].x},${points[0].y}`;
    const areaData = `${pathData} L ${points[points.length-1].x},${svgHeight - margin.bottom} L ${points[0].x},${svgHeight - margin.bottom} Z`;
    let svgContent = `<svg class="chart-svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}"><defs><linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="var(--yellow-main)" stop-opacity="0.5" /><stop offset="100%" stop-color="var(--yellow-main)" stop-opacity="0" /></linearGradient></defs><g id="chart-content"></g></svg>`;
    chartContainer.innerHTML = svgContent;

    const svgContentGroup = chartContainer.querySelector('#chart-content');

    const pathFill = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathFill.setAttribute("class", "chart-wave-fill"); pathFill.setAttribute("d", areaData); pathFill.setAttribute("fill", "url(#waveGradient)");
    
    const pathStroke = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pathStroke.setAttribute("class", "chart-wave-stroke"); pathStroke.setAttribute("d", pathData); pathStroke.setAttribute("stroke", "var(--yellow-main)");
    
    svgContentGroup.append(pathFill, pathStroke);
    
    points.forEach(p => { 
        const colorVar = { good: 'var(--ok-main)', mid: 'var(--blue-main)', warn: 'var(--yellow-main)', bad: 'var(--danger-main)'}[getScoreColorClass(p.score)];
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("class", "chart-dot");
        circle.setAttribute("r", "8"); circle.setAttribute("cx", p.x); circle.setAttribute("cy", p.y);
        circle.setAttribute("fill", colorVar);
        circle.onclick = () => BeeHive.open(p.id);
        group.appendChild(circle);

        let labelY = svgHeight - margin.bottom + 25; let words = p.name.split(' '), line1 = p.name, line2 = ''; 
        if (p.name.length > MAX_LABEL_LENGTH && words.length > 1) { const middle = p.name.length / 2; let bestSplit = -1, minDiff = Infinity; for (let j = 0; j < words.length - 1; j++) { const potentialSplitPoint = words.slice(0, j + 1).join(' ').length, diff = Math.abs(middle - potentialSplitPoint); if (diff < minDiff) { minDiff = diff; bestSplit = j; } } line1 = words.slice(0, bestSplit + 1).join(' '); line2 = words.slice(bestSplit + 1).join(' '); } 
       
        const addText = (content, y, className) => {
            const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textEl.setAttribute("x", p.x); textEl.setAttribute("y", y); textEl.setAttribute("class", className); textEl.setAttribute("text-anchor", "middle");
            textEl.textContent = content; return textEl;
        }

        const addTextWithTspan = (l1, l2, y, className) => {
            const textEl = document.createElementNS("http://www.w3.org/2000/svg", "text");
            textEl.setAttribute("x", p.x); textEl.setAttribute("y", y); textEl.setAttribute("class", className); textEl.setAttribute("text-anchor", "middle");
            const tspan1 = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            tspan1.setAttribute("x", p.x); tspan1.setAttribute("dy", 0); tspan1.textContent = l1; textEl.appendChild(tspan1);
            if (l2) { const tspan2 = document.createElementNS("http://www.w3.org/2000/svg", "tspan"); tspan2.setAttribute("x", p.x); tspan2.setAttribute("dy", "1.2em"); tspan2.textContent = l2; textEl.appendChild(tspan2); }
            return textEl;
        };

        group.appendChild(addText(`${p.score}%`, p.y - 20, "chart-pct-label-bg"));
        group.appendChild(addText(`${p.score}%`, p.y - 20, "chart-pct-label"));
        group.appendChild(addTextWithTspan(line1, line2, labelY, "chart-name-label"));
        svgContentGroup.appendChild(group);
    });
  }
  
  // ======== Search Functionality ========
  const searchInput = document.getElementById('search'), mainView = document.getElementById('main'), searchView = document.getElementById('searchResults'), dashboardView = document.getElementById('dashboard'), backBtn = document.getElementById('backBtn');
  const highlight = (text, term) => { if (!term || !text) return text || ''; const regex = new RegExp(`(${term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'); return text.replace(regex, '<mark>$1</mark>'); };
  const performSearch = () => {
    const term = searchInput.value.trim().toLowerCase();
    if (!term) { mainView.classList.remove('hidden'); searchView.classList.add('hidden'); return; }
    mainView.classList.add('hidden'); dashboardView.style.display = 'none'; backBtn.classList.remove('hidden'); searchView.classList.remove('hidden'); searchView.innerHTML = '';
    const results = [];
    model.subjects.forEach(s => {
        if (s.name.toLowerCase().includes(term)) results.push({ type: 'subject', s, text: s.name });
        (s.chapters || []).forEach(c => {
            if (c.name.toLowerCase().includes(term)) results.push({ type: 'chapter', s, c, text: c.name });
            (c.topics || []).forEach(t => {
                if (t.name.toLowerCase().includes(term)) results.push({ type: 'topic', s, c, t, text: t.name });
                if (typeof t.notes === 'object' && t.notes !== null) {
                    for (const key of ['normal', 'cues', 'main', 'summary']) {
                        if (t.notes[key] && t.notes[key].toLowerCase().includes(term)) {
                            results.push({ type: 'topic', s, c, t, text: t.notes[key], fromNotes: true });
                            break; 
                        }
                    }
                } else if (typeof t.notes === 'string' && t.notes.toLowerCase().includes(term)) { results.push({ type: 'topic', s, c, t, text: t.notes, fromNotes: true }); }
            });
        });
    });
    (model.ideaLabs || []).forEach(lab => {
        const subject = model.subjects.find(s => s.id === lab.subjectId);
        if (lab.title.toLowerCase().includes(term)) results.push({type: 'ideaLab', lab, subject, text: lab.title});
        (lab.frames || []).forEach(frame => {
            if (frame.title && frame.title.toLowerCase().includes(term)) results.push({type: 'ideaLab', lab, subject, text: `Frame: ${frame.title}`});
            if (frame.content) {
                for(const key in frame.content) {
                    if(frame.content[key] && typeof frame.content[key] === 'string' && frame.content[key].toLowerCase().includes(term)) {
                        results.push({type: 'ideaLab', lab, subject, text: frame.content[key]});
                        break; 
                    } else if (Array.isArray(frame.content[key])) {
                        const found = frame.content[key].some(item => item.toLowerCase().includes(term));
                        if(found) { results.push({type: 'ideaLab', lab, subject, text: `Cause/Effect list match`}); break; }
                    }
                }
            }
        });
    });
    
    if (results.length === 0) { searchView.innerHTML = '<p>No results found.</p>'; return; }
    results.forEach(r => {
        const item = el('div', 'search-result-item');
        const path = el('div', 'search-result-path'); const preview = el('div', 'search-result-notes');
        const tempDiv = document.createElement('div'); tempDiv.innerHTML = r.text; const plainText = tempDiv.textContent || tempDiv.innerText || "";
        const snippetIndex = plainText.toLowerCase().indexOf(term);
        const start = Math.max(0, snippetIndex - 50); const end = Math.min(plainText.length, snippetIndex + 50);

        if (r.type === 'ideaLab') {
            path.innerHTML = `<i class="fa-solid fa-lightbulb"></i> Idea Lab: ${highlight(r.lab.title, term)} ${r.subject ? `(in ${r.subject.name})` : ''}`;
            preview.innerHTML = '... ' + highlight(plainText.substring(start, end), term) + ' ...';
            item.onclick = () => IdeaLabEditor.open(r.lab.id);
        } else {
            let fullPath = highlight(r.s.name, term);
            if(r.c) fullPath += ' &gt; ' + highlight(r.c.name, term); if(r.t) fullPath += ' &gt; ' + highlight(r.t.name, term);
            path.innerHTML = fullPath;
            if (r.fromNotes) { preview.innerHTML = '... ' + highlight(plainText.substring(start, end), term) + ' ...'; } 
            else { preview.innerHTML = r.type + ' name matches.'; }
            item.onclick = () => navigateToCard(r.t?.id || r.c?.id || r.s?.id);
        }
        item.append(path, preview); searchView.appendChild(item);
    });
  };
    
  // ======== Centralized Drag-and-Drop System ========
  let dragState = { element: null, type: null, sourceContainer: null };
  const dropIndicator = el('div', 'drop-indicator');
  
  // --- Mouse D&D Handlers ---
  function onDragStart(e) {
      const handle = e.target.closest('[draggable="true"]'); if (!handle) return;
      const draggable = handle.closest('.card, .todo-item'); if (!draggable) return;
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', draggable.dataset.id);
      dragState.element = draggable; dragState.type = draggable.dataset.type; dragState.sourceContainer = draggable.parentElement;
      requestAnimationFrame(() => { draggable.classList.add('dragging'); });
  }
  function onDragOver(e) {
      e.preventDefault(); if (!dragState.element) return;
      const dropZone = (target => { const zone = target.closest('[data-drop-zone-for]'); if (zone && zone.dataset.dropZoneFor === dragState.type && !dragState.element.contains(zone)) { return zone; } return null; })(e.target);
      if (dropZone) {
          const afterElement = ((container, y) => { const draggableElements = [...container.querySelectorAll(`:scope > .card, :scope > .todo-item`)].filter(el => !el.classList.contains('dragging')); return draggableElements.reduce((closest, child) => { const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2; if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; } }, { offset: Number.NEGATIVE_INFINITY }).element; })(dropZone, e.clientY);
          if (afterElement) { dropZone.insertBefore(dropIndicator, afterElement); } else { dropZone.appendChild(dropIndicator); }
      } else { if (dropIndicator.parentElement) dropIndicator.remove(); }
  }
  function onDrop(e) { e.preventDefault(); if (!dragState.element || !dropIndicator.parentElement) { onDragEnd(); return; } dropIndicator.parentElement.insertBefore(dragState.element, dropIndicator); updateModelOrder(dropIndicator.parentElement); onDragEnd(); }
  function onDragEnd() { if (dragState.element) { dragState.element.classList.remove('dragging'); } if (dropIndicator.parentElement) { dropIndicator.remove(); } dragState = { element: null, type: null, sourceContainer: null }; }
  
  // --- Touch D&D Handlers ---
  let touchDragState = { isDragging: false, scrollInterval: null };

  function onTouchStartDrag(e) {
      const handle = e.target.closest('[draggable="true"]');
      if (!handle) return;
      const draggable = handle.closest('.card, .todo-item');
      if (!draggable) return;
      e.preventDefault();
      touchDragState.isDragging = true;
      dragState.element = draggable;
      dragState.type = draggable.dataset.type;
      dragState.sourceContainer = draggable.parentElement;
      setTimeout(() => {
          if (touchDragState.isDragging && dragState.element) {
              requestAnimationFrame(() => { dragState.element.classList.add('dragging'); });
          }
      }, 150);
  }

  function onTouchMoveDrag(e) {
      if (!touchDragState.isDragging || !dragState.element) return;
      e.preventDefault();
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      onDragOver({ preventDefault: () => {}, target: target, clientY: touch.clientY });
      const scrollThreshold = 80; 
      if (touch.clientY < scrollThreshold) {
          if (!touchDragState.scrollInterval) { touchDragState.scrollInterval = setInterval(() => window.scrollBy(0, -10), 16); }
      } else if (touch.clientY > window.innerHeight - scrollThreshold) {
          if (!touchDragState.scrollInterval) { touchDragState.scrollInterval = setInterval(() => window.scrollBy(0, 10), 16); }
      } else {
          clearInterval(touchDragState.scrollInterval); touchDragState.scrollInterval = null;
      }
  }

  function onTouchEndDrag(e) {
      if (!touchDragState.isDragging) return;
      clearInterval(touchDragState.scrollInterval);
      touchDragState.scrollInterval = null;
      if (dragState.element) {
          if (dropIndicator.parentElement) { onDrop({ preventDefault: () => {} }); } else { onDragEnd(); }
      }
      touchDragState.isDragging = false;
  }
  
  function updateModelOrder(container) {
      const newOrderIds = [...container.children].filter(child => child.dataset.id).map(child => child.dataset.id);
      const type = container.dataset.dropZoneFor;
      if (type === 'todo') { model.todoList.sort((a, b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id)); } 
      else if (type === 'subject') { model.subjects.sort((a,b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id)); } 
      else if (type === 'chapter') { const subject = model.subjects.find(s => s.id === container.closest('.subject-card').dataset.id); if (subject) { subject.chapters.sort((a,b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id)); } } 
      else if (type === 'topic') { const subject = model.subjects.find(s => s.id === container.closest('.subject-card').dataset.id); if (subject) { const chapter = subject.chapters.find(c => c.id === container.closest('.chapter-card').dataset.id); if (chapter) { chapter.topics.sort((a,b) => newOrderIds.indexOf(a.id) - newOrderIds.indexOf(b.id)); } } }
      saveModelThrottled();
  }
  
  // ======== Event Handlers ========
  const globalLoader = document.getElementById('globalLoader');
  const showGlobalLoader = () => globalLoader.classList.remove('hidden');
  const hideGlobalLoader = () => globalLoader.classList.add('hidden');
  
  async function handleAddSubject() {
    const newSubject = { id: uid(), name: 'New Subject', chapters: [] };
    model.subjects.push(newSubject);
    checkEmptyState();
    const newSubjectCard = renderSubject(newSubject);
    newSubjectCard.classList.add('new-item'); newSubjectCard.addEventListener('animationend', () => newSubjectCard.classList.remove('new-item'));
    mainContent.appendChild(newSubjectCard); smoothScrollTo(newSubjectCard);
    logActivityAndAddPoint(); await saveModel();
  }

  document.getElementById('addSubject').onclick = handleAddSubject;
  document.getElementById('addFirstSubject').onclick = handleAddSubject;
  document.getElementById('dashboardBtn').onclick = () => {
    mainView.classList.add('hidden'); searchView.classList.add('hidden');
    dashboardView.style.display = 'block'; backBtn.classList.remove('hidden');
    renderDashboard();
    applyTimeOfDayTheme();
    const cards = document.querySelectorAll('#dashboard .dash-card');
    cards.forEach((card, index) => {
      card.classList.remove('play-animation-once');
      void card.offsetWidth;
      card.style.animationDelay = `${index * 50}ms`;
      card.classList.add('play-animation-once');
    });
  };
  backBtn.onclick = () => {
    const cards = document.querySelectorAll('#dashboard .dash-card');
    if (dashboardView.style.display === 'block' && cards.length > 0) {
        let maxDelay = 0;
        cards.forEach((card, index) => { const delay = (cards.length - 1 - index) * 30; card.style.animationDelay = `${delay}ms`; card.classList.add('play-animation-out'); if(delay > maxDelay) maxDelay = delay; });
        setTimeout(() => {
            dashboardView.style.display = 'none'; mainView.classList.remove('hidden'); backBtn.classList.add('hidden');
            cards.forEach(card => { card.classList.remove('play-animation-out'); card.style.animationDelay = ''; });
        }, 400 + maxDelay + 50);
    } else {
        dashboardView.style.display = 'none'; searchView.classList.add('hidden');
        mainView.classList.remove('hidden'); backBtn.classList.add('hidden');
    }
    searchInput.value = '';
  };
  document.getElementById('clearAll').onclick = async () => { if (!(await customModal.show('(?・・)σ This will permanently delete ALL study data. Have you downloaded a backup ?', true))) return; if (!(await customModal.show('( o O ") Are you ABSOLUTELY sure ? This cannot be undone !', true))) return; await idb.delete('model'); await idb.delete('uiState'); model = { subjects: [], activityDates: [], streak: 0, lastActivityDate: null, lastDailyCheck: null, journalEntries: [], todoList: [], beehiveTags: [], beehiveLayouts: {}, promptResponses: {}, ideaLabs: [], customFrames: [] }; uiState = { openCards: {}, scrollY: 0 }; window.location.reload(); };
  document.getElementById('backupBtn').onclick = () => { const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' }); const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `icanstudy-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); };
  
  const restoreFromFile = (isMerge) => {
    const input = el('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        (async () => {
          let wasLoaderShown = false;
          try {
           const incomingModel = JSON.parse(ev.target.result);

// --- NEW VALIDATION ---
// 1. if it's a valid object at all
if (!incomingModel || typeof incomingModel !== 'object') { 
    throw new Error('Invalid backup file format'); 
}

// 2. Ensuring subjects is an Array if it exists 
if (incomingModel.subjects && !Array.isArray(incomingModel.subjects)) {
    throw new Error('Invalid backup file format: "subjects" data is corrupted.'); 
}

// 3. Fallbacks
if (!Array.isArray(incomingModel.journalEntries)) incomingModel.journalEntries = [];
if (!Array.isArray(incomingModel.todoList)) incomingModel.todoList = [];
if (!Array.isArray(incomingModel.ideaLabs)) incomingModel.ideaLabs = [];
if (!Array.isArray(incomingModel.activityDates)) incomingModel.activityDates = [];
if (!Array.isArray(incomingModel.beehiveTags)) incomingModel.beehiveTags = [];
// --- END OF VALIDATION ---
            if (incomingModel.subjects && incomingModel.subjects.length > HEAVY_DATA_THRESHOLD) { showGlobalLoader(); wasLoaderShown = true; await new Promise(resolve => setTimeout(resolve, 50)); }
            let successMessage = '';
            if (isMerge) { deepMergeModel(incomingModel); successMessage = 'Data merged successfully.'; } 
            else { const defaultModel = { subjects: [], activityDates: [], streak: 0, lastActivityDate: null, lastDailyCheck: null, journalEntries: [], todoList: [], beehiveTags: [], beehiveLayouts: {}, promptResponses: {}, ideaLabs: [] }; model = { ...defaultModel, ...incomingModel }; successMessage = 'Data restored successfully.'; }
            await saveModel(); await renderModelAsync(); await customModal.show(successMessage);
            updateDashboardIfVisible();
          } catch (error) { if (wasLoaderShown) hideGlobalLoader(); await customModal.show('Error: Invalid or corrupted backup file.'); }
        })();
      };
      reader.readAsText(file);
    }; input.click();
  };
  function deepMergeModel(incoming) {
    const mergeDate = new Date().toLocaleDateString();
    const defaultModel = { subjects: [], activityDates: [], streak: 0, lastActivityDate: null, lastDailyCheck: null, journalEntries: [], todoList: [], beehiveTags: [], beehiveLayouts: {}, promptResponses: {}, ideaLabs: [] };
    model = { ...defaultModel, ...model }; 
    incoming = { ...defaultModel, ...incoming }; 

    model.activityDates = Array.from(new Set([...model.activityDates, ...incoming.activityDates]));
    model.beehiveTags = Array.from(new Set([...model.beehiveTags, ...incoming.beehiveTags]));
    
    const existingJournalDates = new Set(model.journalEntries.map(e => e.date));
    incoming.journalEntries.forEach(incEntry => { if (!existingJournalDates.has(incEntry.date)) { model.journalEntries.push(incEntry); } });

    const existingTodoTexts = new Set(model.todoList.map(t => t.text));
    incoming.todoList.forEach(incTask => { if (!existingTodoTexts.has(incTask.text)) { if(!incTask.id) incTask.id = uid(); model.todoList.push(incTask); } });

    const existingLabTitles = new Set(model.ideaLabs.map(l => l.title));
    incoming.ideaLabs.forEach(incLab => { if (!existingLabTitles.has(incLab.title)) { model.ideaLabs.push(incLab); } });

    (incoming.subjects || []).forEach(incS => {
        let currentS = model.subjects.find(s => s.name === incS.name);
        if (!currentS) { model.subjects.push(incS); } 
        else {
            (incS.chapters || []).forEach(incC => {
                let currentC = (currentS.chapters || []).find(c => c.name === incC.name);
                if (!currentC) { currentS.chapters = currentS.chapters || []; currentS.chapters.push(incC); } 
                else {
                    (incC.topics || []).forEach(incT => {
                        let currentT = (currentC.topics || []).find(t => t.name === incT.name);
                        currentC.topics = currentC.topics || [];
                        if (currentT) {
                            if (incT.beehiveLabels) { currentT.beehiveLabels = Array.from(new Set([...(currentT.beehiveLabels || []), ...incT.beehiveLabels])); }
                            const ensureNoteObjectFormat = (topic) => { if (!topic) return; if (typeof topic.notes === 'string' || !topic.notes) { topic.notes = { normal: topic.notes || '', cues: '', main: '', summary: '' }; } };
                            ensureNoteObjectFormat(currentT); ensureNoteObjectFormat(incT);
                            const separator = `<hr><p><em>MERGED FROM BACKUP (${mergeDate})</em></p>`;
                            const mergeNoteIfNeeded = (noteType) => { const currentNote = currentT.notes[noteType] || '', incomingNote = incT.notes[noteType] || ''; if (incomingNote && incomingNote.trim() && currentNote.trim() !== incomingNote.trim()) { currentT.notes[noteType] += (currentNote.trim() ? separator : '') + incomingNote; } };
                            ['normal', 'cues', 'main', 'summary'].forEach(mergeNoteIfNeeded);
                        } else { currentC.topics.push(incT); }
                    });
                }
            });
        }
    });
  }

  document.getElementById('restoreBtn').onclick = () => restoreFromFile(false);
  document.getElementById('mergeBtn').onclick = () => restoreFromFile(true);
  const adjustLayoutForAppBar = () => { const appbar = document.querySelector('.appbar'); if (appbar) { document.body.style.paddingTop = `${appbar.offsetHeight}px`; } };
  
  let lastScrollY = window.scrollY;
  const handleAppBarScroll = () => { const appbar = document.querySelector('.appbar'); if (!appbar) return; const currentScrollY = window.scrollY; if (currentScrollY > lastScrollY && currentScrollY > appbar.offsetHeight) { appbar.classList.add('appbar--hidden'); } else if (currentScrollY < lastScrollY) { appbar.classList.remove('appbar--hidden'); } lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY; };

  // ======== Time of Day and Celebration Logic ========
  function applyTimeOfDayTheme() {
    const dashboardEl = document.getElementById('dashboard');
    const greetingEl = document.getElementById('timeOfDayGreeting');
    const titleIcon = document.querySelector('.dashboard-title .vibrating-icon');

    if (!dashboardEl || !greetingEl || !titleIcon) return;
    
    clearTimeout(revertKaomojiTimeout);
    clearTimeout(greetingTimeout);

    const todayStr = toYYYYMMDD(new Date());
    model.promptResponses = model.promptResponses || {};
    model.promptResponses[todayStr] = model.promptResponses[todayStr] || {};
    
    const hour = new Date().getHours();
    let themeClass, kaomoji, animationClass, greetingText, showPrompt = false, period;

    if (hour >= 7 && hour < 12) { 
        themeClass = 'theme-morning'; kaomoji = '(⑅Ő ༝ Ő)'; animationClass = 'kaomoji-morning'; greetingText = '☁︎ Good Morning, Love!';
    } else if (hour >= 12 && hour < 17) {
        themeClass = 'theme-afternoon'; kaomoji = '(｡ㆁ ㆁ)'; animationClass = 'kaomoji-afternoon'; greetingText = "☀︎ May your spirit be as bright and hopeful as this day.";
    } else if (hour >= 17 && hour < 21) {
        themeClass = 'theme-evening'; kaomoji = '( · ❛ ֊ ❛)'; animationClass = 'kaomoji-evening'; greetingText = ' ֶָ.𓂃☂ The day is settling down..'; showPrompt = true; period = 'evening';
    } else { 
        themeClass = 'theme-night'; kaomoji = '(⑅ • ˕ •˶)'; animationClass = 'kaomoji-night'; greetingText = '<i class="fa-solid fa-moon"></i> Hey, love.. Are you resting in quiet harbor or exploring its depths?'; showPrompt = true; period = 'night';
    }

    dashboardEl.classList.remove('theme-morning', 'theme-afternoon', 'theme-evening', 'theme-night');
    dashboardEl.classList.add(themeClass);
    titleIcon.innerHTML = kaomoji;
    titleIcon.className = 'vibrating-icon';
    titleIcon.classList.add(animationClass);
    greetingEl.innerHTML = `<p>${greetingText}</p>`;
    
    if (showPrompt && !model.promptResponses[todayStr][period]) {
        const buttonContainer = el('div', 'time-of-day-prompt-buttons');
        const btnOpt1Text = period === 'evening' ? 'Winding Down' : 'Calling it a Night';
        const btnOpt2Text = period === 'evening' ? 'Let breeze with the wind' : 'Night Owl';
        const btnOpt1 = el('button', 'btn btn-ghost btn-mini', btnOpt1Text);
        const btnOpt2 = el('button', 'btn btn-ghost btn-mini', btnOpt2Text);

        const handlePromptResponse = (choice) => {
            clearTimeout(greetingTimeout);
            logActivityAndAddPoint(2);
            model.promptResponses[todayStr][period] = choice;
            saveModelThrottled();
            customModal.show("Awesome! 2 streak points have been added.");

            let responseText = '';
            if (period === 'evening') {
                responseText = choice === 'opt1' ? 'Yep, take a rest. I\'m so grateful you were here. Enjoy your time.' : 'That little chill is just the soft wind guiding you home. Soon, you\'ll get there; keep walking towards it.';
            } else { 
                responseText = choice === 'opt1' ? 'Aww... Time for bed now. Talk to you tomorrow! xoxo' : 'The quiet of the night. May your silence bring you the peace you are seeking, love.';
            }
            greetingEl.innerHTML = `<p>${responseText}</p>`;
        };
        
        btnOpt1.onclick = () => handlePromptResponse('opt1');
        btnOpt2.onclick = () => handlePromptResponse('opt2');
        buttonContainer.append(btnOpt1, btnOpt2);
        greetingEl.appendChild(buttonContainer);
    } else if (showPrompt && model.promptResponses[todayStr][period]) {
        const choice = model.promptResponses[todayStr][period];
        let responseText = '';
         if (period === 'evening') {
            responseText = choice === 'opt1' ? 'Yep, take a rest. I\'m so grateful you were here. Enjoy your time.' : 'That little chill is just the soft wind guiding you home. Soon, you\'ll get there; keep walking towards it.';
        } else {
            responseText = choice === 'opt1' ? 'Aww... Time for bed now. Talk to you tomorrow! xoxo' : 'The quiet of the night. May your silence bring you the peace you are seeking, love.';
        }
        greetingEl.innerHTML = `<p>${responseText}</p>`;
    }
    
    greetingTimeout = setTimeout(() => {
        if (greetingEl) {
            greetingEl.style.transition = 'opacity 0.5s ease-out'; greetingEl.style.opacity = '0';
            setTimeout(() => { greetingEl.innerHTML = ''; greetingEl.style.opacity = '1'; greetingEl.style.transition = ''; }, 500);
        }
    }, 5 * 60 * 1000);

    revertKaomojiTimeout = setTimeout(() => {
        const currentTitleIcon = document.querySelector('.dashboard-title .vibrating-icon');
        if (currentTitleIcon && currentTitleIcon.innerHTML === kaomoji) {
            currentTitleIcon.innerHTML = '(｡˃ ᵕ ˂)';
            currentTitleIcon.className = 'vibrating-icon';
        }
    }, 5 * 60 * 1000);
  }
  
  function triggerConfetti() {
    const overlay = document.getElementById('celebrationOverlay');
    if (!overlay) return;
    overlay.innerHTML = '';
    overlay.classList.remove('hidden');
    const petals = ['🍂', '🍁', '🌿', '🌸', '🌼', '🪷'];
    for (let i = 0; i < 60; i++) {
        const petal = el('div', 'petal', petals[Math.floor(Math.random() * petals.length)]);
        petal.style.left = `${Math.random() * 100}vw`;
        petal.style.animationDuration = `${Math.random() * 2 + 3}s`; // 3-5 seconds
        petal.style.animationDelay = `${Math.random() * 2}s`;
        petal.style.fontSize = `${Math.random() * 16 + 16}px`;
        const initialRotate = `rotate(${Math.random() * 360}deg)`;
        const finalTranslateX = `translateX(${(Math.random() - 0.5) * 20}vw)`;
        petal.style.transform = initialRotate;
        petal.style.setProperty('--final-translateX', finalTranslateX);
        petal.animate([ { transform: `translateY(-10vh) ${initialRotate}`, opacity: 1 }, { transform: `translateY(110vh) ${finalTranslateX} rotate(720deg)`, opacity: 0 } ], { duration: parseFloat(petal.style.animationDuration) * 1000, delay: parseFloat(petal.style.animationDelay) * 1000, easing: 'linear', fill: 'forwards' });
        overlay.appendChild(petal);
    }
    setTimeout(() => { overlay.classList.add('hidden'); overlay.innerHTML = ''; }, 7000);
  }

  // ======== FOCUS SESSION IMPLEMENTATION ========
  const focusModal = document.getElementById('focusSessionModal');
  const focusOverlay = document.getElementById('focusModeOverlay');
  
  function findTopicById(topicId) {
    for (const s of model.subjects) {
        for (const c of (s.chapters || [])) {
            const t = (c.topics || []).find(topic => topic.id === topicId);
            if (t) return [s, c, t];
        }
    }
    return [null, null, null];
  }

  function initFocusSessionSetup(weakTopics) {
      const listContainer = document.getElementById('focusTopicsList');
      const startBtn = document.getElementById('focusStartBtn');
      const warning = document.getElementById('focusTopicWarning');
      listContainer.innerHTML = '';
      weakTopics.forEach(topic => {
          const item = el('div', 'focus-topic-item');
          item.innerHTML = `<input type="checkbox" id="focus_${topic.tId}" data-topic-id="${topic.tId}"><label for="focus_${topic.tId}" style="flex:1;">${topic.tName} <small>(${topic.sName})</small></label><span class="score-tag ${getScoreColorClass(topic.score)}">${topic.score}%</span>`;
          listContainer.appendChild(item);
      });
      const checkSelection = () => {
          const selected = listContainer.querySelectorAll('input:checked');
          const count = selected.length;
          const isValid = count >= 2 && count <= 4;
          startBtn.disabled = !isValid;
          warning.style.display = (count > 0 && !isValid) ? 'block' : 'none';
      };
      listContainer.addEventListener('change', checkSelection);
      checkSelection();
      focusModal.classList.add('visible');
  }
  
  document.getElementById('focusCancelBtn').onclick = () => focusModal.classList.remove('visible');
  document.getElementById('focusStartBtn').onclick = () => {
      const selectedIds = [...document.querySelectorAll('#focusTopicsList input:checked')].map(cb => cb.dataset.topicId);
      const hours = parseInt(document.getElementById('focusHours').value) || 0;
      const minutes = parseInt(document.getElementById('focusMinutes').value) || 0;
      const totalMinutes = (hours * 60) + minutes;
      if (totalMinutes < 5) { customModal.show("Please set a duration of at least 5 minutes."); return; }
      focusModal.classList.remove('visible');
      startFocusSession(selectedIds, totalMinutes);
  };
  
  function startFocusSession(topicIds, totalMinutes) {
      const numTopics = topicIds.length;
      const totalReviewTime = Math.floor(totalMinutes * 0.6);
      const practiceTimePerTopic = Math.floor((totalMinutes - totalReviewTime) / numTopics);
      const reviewTimePerTopic = Math.floor(totalReviewTime / numTopics);
      
      focusSession.schedule = [];
      topicIds.forEach(id => { focusSession.schedule.push({ type: 'review', topicId: id, duration: reviewTimePerTopic * 60, completed: false }); });
      topicIds.forEach(id => { focusSession.schedule.push({ type: 'practice', topicId: id, duration: practiceTimePerTopic * 60, completed: false }); });

      focusSession.isActive = true; focusSession.currentIndex = -1; focusSession.isPaused = false; focusSession.pointsEarned = 0;
      setupFocusModeEventListeners();
      focusOverlay.classList.remove('hidden'); document.body.style.overflow = 'hidden';
      nextFocusStage();
  }
  
  function loadFocusStage(stageIndex) {
      const content = document.getElementById('focusContent');
      content.classList.add('fade-out');
      setTimeout(() => {
        focusSession.currentIndex = stageIndex;
        const stage = focusSession.schedule[stageIndex];
        const [s, c, t] = findTopicById(stage.topicId);
        if (!t) { endFocusSession(true); return; }
        document.getElementById('focusStageTitle').textContent = `${stage.type === 'review' ? 'Review' : 'Simplify'}: ${t.name}`;
        renderTopicBody(t, s, c, content);
        const promptEl = document.getElementById('focusPrompt');
        if (stage.type === 'practice') {
            promptEl.textContent = `Can you explain '${t.name}' to me in the simplest way possible? What parts were fuzzy? Use Cornell notes.`;
            promptEl.classList.remove('hidden');
        } else { promptEl.classList.add('hidden'); }
        focusSession.remainingTime = stage.duration;
        updateFocusTimerDisplay(); startFocusTimer(); updateFocusControls();
        content.classList.remove('fade-out');
      }, 400);
  }

  function nextFocusStage() {
    if (focusSession.currentIndex >= 0) {
        const prevStage = focusSession.schedule[focusSession.currentIndex];
        if (!prevStage.completed) { prevStage.completed = true; if (prevStage.type === 'practice') { focusSession.pointsEarned += 5; } }
    }
    const nextIndex = focusSession.currentIndex + 1;
    if (nextIndex < focusSession.schedule.length) { loadFocusStage(nextIndex); } else { endFocusSession(false); }
  }

  function prevFocusStage() { if (focusSession.currentIndex > 0) { loadFocusStage(focusSession.currentIndex - 1); } }
  
  function updateFocusTimerDisplay() {
    const minutes = Math.floor(focusSession.remainingTime / 60);
    const seconds = focusSession.remainingTime % 60;
    document.getElementById('focusTimerDisplay').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  
  function startFocusTimer() {
    clearInterval(focusSession.timerInterval);
    focusSession.isPaused = false;
    document.getElementById('focusPlayPauseBtn').innerHTML = '<i class="fa-solid fa-pause"></i>';
    focusSession.timerInterval = setInterval(() => {
        if (focusSession.remainingTime > 0) { focusSession.remainingTime--; updateFocusTimerDisplay(); } 
        else { clearInterval(focusSession.timerInterval); nextFocusStage(); }
    }, 1000);
  }
  
  function pauseFocusTimer() { clearInterval(focusSession.timerInterval); focusSession.isPaused = true; document.getElementById('focusPlayPauseBtn').innerHTML = '<i class="fa-solid fa-play"></i>'; }
  function updateFocusControls() { document.getElementById('focusPrevBtn').disabled = focusSession.currentIndex <= 0; document.getElementById('focusNextBtn').disabled = focusSession.currentIndex >= focusSession.schedule.length - 1; }
  
  async function endFocusSession(interrupted = false) {
    clearInterval(focusSession.timerInterval); focusSession.isActive = false; focusOverlay.classList.add('hidden'); document.body.style.overflow = '';
    let message = '';
    if (focusSession.pointsEarned > 0) {
        logActivityAndAddPoint(focusSession.pointsEarned);
        message = interrupted ? `Session ended early. You earned ${focusSession.pointsEarned} points for the stages you fully completed.` : `Session complete! You earned a total of ${focusSession.pointsEarned} streak points. Great work!`;
    } else { message = interrupted ? "Session ended. No, Biggie keep practicing, until next time!" : "Session complete! Keep up the great work."; }
    await customModal.show(message); renderDashboard();
  }
  
  let focusListenersAttached = false;
  function setupFocusModeEventListeners() {
      if (focusListenersAttached) return;
      document.getElementById('focusPlayPauseBtn').onclick = () => { focusSession.isPaused ? startFocusTimer() : pauseFocusTimer(); };
      document.getElementById('focusNextBtn').onclick = nextFocusStage;
      document.getElementById('focusPrevBtn').onclick = prevFocusStage;
      document.getElementById('focusAddTimeBtn').onclick = () => { focusSession.remainingTime += 300; updateFocusTimerDisplay(); };
      document.getElementById('focusExitBtn').onclick = async () => { if (await customModal.show("Are you sure you want to end this session early? You won't earn points for the current stage.", true)) { endFocusSession(true); } };
      focusListenersAttached = true;
  }
  
  // ======== BEEHIVE & IDEA LAB IMPLEMENTATION ========
  const BeeHive = (() => {
    let autocomplete = { active: false, element: null, editor: null, range: null, searchTerm: '', selectedIndex: -1 };
    
    let canvasState = {
        isActive: false, currentSubjectId: null, overlay: null, canvas: null, ctx: null,
        nodes: [], links: [], particles: [], animationFrame: null,
        transform: { x: 0, y: 0, scale: 1 }, isAnimating: false,
        drag: { startX: 0, startY: 0, isDraggingNode: false, isPanning: false, node: null },
        touch: {panning: false, pinchDist: 0}, hoverNode: null, tooltip: null, mainControls: null,
    };
    
    // Core external refresh hook (Instant creation)
    function refreshData() {
        if(canvasState.isActive) openHive(canvasState.currentSubjectId, true);
    }

    return {
        init, open: openHive, close: closeHive,
        refreshData,
        renderInitialTags, syncTagsFromEditor, handleTagAutocomplete, handleKeyDown,
        handleTagUnwrapping, hideAutocomplete, unwrapTag,
        pruneUnusedTags, pruneUnusedIdeaLabs,
    };

    function init() {
        createAutocompleteElement();
        canvasState.overlay = document.getElementById('beehiveCanvasOverlay');
        canvasState.canvas = document.getElementById('beehiveCanvas');
        canvasState.ctx = canvasState.canvas.getContext('2d');
        canvasState.tooltip = document.getElementById('beehiveTooltip');
        document.getElementById('beehiveExitBtn').onclick = closeHive;
        const createLabBtn = document.getElementById('beehiveCreateLabBtn');
        if(createLabBtn) createLabBtn.onclick = createIdeaLab; 
        addCanvasEventListeners();
        initParticles(50);
    }
    
    function pruneUnusedTags() {
      const allUsedTags = new Set(model.subjects.flatMap(s => s.chapters?.flatMap(c => c.topics || []) || []).flatMap(t => t.beehiveLabels || []));
      const originalTagCount = model.beehiveTags.length;
      model.beehiveTags = model.beehiveTags.filter(tag => allUsedTags.has(tag));
      return originalTagCount !== model.beehiveTags.length;
    }

    function pruneUnusedIdeaLabs(subjectId) {
        const originalCount = (model.ideaLabs || []).length;
        model.ideaLabs = (model.ideaLabs || []).filter(lab => lab.subjectId !== subjectId);
        if (originalCount !== model.ideaLabs.length) { saveModelThrottled(); }
    }

    function renderInitialTags(editor) {
        if (!editor || !editor.childNodes) return;
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        let node; const nodesToProcess = [];
        while(node = walker.nextNode()) { if (!node.parentElement.closest('.beehive-tag')) { nodesToProcess.push(node); } }
        nodesToProcess.forEach(node => {
            const text = node.nodeValue; const matches = [...text.matchAll(/(#\w+)/g)];
            if (matches.length > 0) {
              const frag = document.createDocumentFragment(); let lastIndex = 0;
              matches.forEach(match => {
                  const index = match.index;
                  if (index > lastIndex) frag.appendChild(document.createTextNode(text.substring(lastIndex, index)));
                  const span = el('span', 'beehive-tag', match[0]); frag.appendChild(span);
                  lastIndex = index + match[0].length;
              });
              if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.substring(lastIndex)));
              node.parentNode.replaceChild(frag, node);
            }
        });
    }

    function syncTagsFromEditor(topic, editor) {
        const tagsInEditor = new Set([...editor.querySelectorAll('.beehive-tag')].map(span => span.textContent.substring(1)));
        const oldTags = new Set(topic.beehiveLabels || []);
        const tagsChanged = tagsInEditor.size !== oldTags.size || ![...tagsInEditor].every(tag => oldTags.has(tag));
        topic.beehiveLabels = Array.from(tagsInEditor);
        tagsInEditor.forEach(tag => { if (!model.beehiveTags.includes(tag)) model.beehiveTags.push(tag); });
        if (tagsChanged && canvasState.isActive) { refreshData(); }
        return tagsChanged;
    }
   
    function unwrapTag(span, cursorOffset) {
      if (!span.parentNode) return;
      const text = span.textContent; const textNode = document.createTextNode(text);
      span.parentNode.replaceChild(textNode, span);
      const sel = window.getSelection(); const range = document.createRange();
      range.setStart(textNode, Math.min(cursorOffset, textNode.length)); range.collapse(true);
      sel.removeAllRanges(); sel.addRange(range);
    }
    
    function handleTagUnwrapping(e) {
      const sel = window.getSelection(); if (!sel.rangeCount) return; const parentTag = sel.anchorNode.parentElement?.closest('.beehive-tag');
      if (parentTag) unwrapTag(parentTag, sel.anchorOffset);
    }

    function handleKeyDown(e, editor) {
        if (handleAutocompleteKeydown(e)) return true;
        if (e.key === ' ') {
            const sel = window.getSelection();
            if (!sel.rangeCount || sel.rangeCount === 0) return false;
            const range = sel.getRangeAt(0);
            const node = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE && !node.parentElement.closest('.beehive-tag')) {
                const textBeforeCursor = node.textContent.substring(0, range.startOffset);
                const match = textBeforeCursor.match(/#(\w+)$/);
                if (match) {
                    e.preventDefault();
                    const fullTagText = match[0];
                    const replacementRange = document.createRange();
                    replacementRange.setStart(node, match.index);
                    replacementRange.setEnd(node, match.index + fullTagText.length);
                    replacementRange.deleteContents();
                    const tagSpan = el('span', 'beehive-tag', fullTagText);
                    replacementRange.insertNode(tagSpan);
                    const spaceNode = document.createTextNode('\u00A0');
                    const rangeAfter = document.createRange();
                    rangeAfter.setStartAfter(tagSpan);
                    rangeAfter.collapse(true);
                    rangeAfter.insertNode(spaceNode);
                    const finalRange = document.createRange();
                    finalRange.setStartAfter(spaceNode);
                    finalRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(finalRange);
                    hideAutocomplete();
                    const syncEvent = new Event('input', { bubbles: true, cancelable: true });
                    editor.dispatchEvent(syncEvent);
                    return true; 
                }
            }
        }
    
        if (e.key === 'Backspace') {
            const sel = window.getSelection(); if (!sel.rangeCount || !sel.isCollapsed) return false;
            const range = sel.getRangeAt(0); const node = range.startContainer; const offset = range.startOffset;
            if (offset === 0 && node.previousSibling?.nodeName === 'SPAN' && node.previousSibling.classList.contains('beehive-tag')) {
                e.preventDefault(); unwrapTag(node.previousSibling, node.previousSibling.textContent.length); return true;
            }
        }
        
        if (e.key === 'Tab') { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent', false, null); return true; }
        return false;
    }

    function handleTagAutocomplete(event, editor) {
        const sel = window.getSelection(); if (!sel.rangeCount) return; const range = sel.getRangeAt(0); const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE || node.parentElement.classList.contains('beehive-tag')) return hideAutocomplete();
        const text = node.textContent; const cursor = range.startOffset; const match = text.slice(0, cursor).match(/#(\w*)$/);
        if (match) {
            autocomplete.active = true; autocomplete.editor = editor; autocomplete.searchTerm = match[1].toLowerCase();
            const tempRange = range.cloneRange(); tempRange.setStart(node, match.index); autocomplete.range = tempRange; showAutocomplete();
        } else { hideAutocomplete(); }
    }
    function showAutocomplete() {
        const suggestions = model.beehiveTags.filter(tag => tag.toLowerCase().includes(autocomplete.searchTerm)).slice(0, 10);
        if (suggestions.length === 0) return hideAutocomplete();
        const rect = autocomplete.range.getBoundingClientRect(); autocomplete.element.style.left = `${rect.left + window.scrollX}px`; autocomplete.element.style.top = `${rect.bottom + window.scrollY + 5}px`;
        autocomplete.element.innerHTML = suggestions.map(tag => `<div class="tag-suggestion" data-tag="${tag}">${tag.replace(new RegExp(autocomplete.searchTerm, 'gi'), match => `<strong>${match}</strong>`)}</div>`).join('');
        autocomplete.element.style.display = 'block';
        autocomplete.element.querySelectorAll('.tag-suggestion').forEach(el => { el.onmousedown = (e) => { e.preventDefault(); selectTag(el.dataset.tag); }; });
        autocomplete.selectedIndex = -1;
    }
    function hideAutocomplete() { if (!autocomplete.active) return; autocomplete.active = false; if (autocomplete.element) autocomplete.element.style.display = 'none'; autocomplete.selectedIndex = -1; }
    
    function selectTag(tag) {
        const range = autocomplete.range; const editor = autocomplete.editor; range.deleteContents(); const span = el('span', 'beehive-tag', `#${tag}`); range.insertNode(span);
        const spaceNode = document.createTextNode('\u00A0');
        range.setStartAfter(span); range.insertNode(spaceNode); range.setStartAfter(spaceNode); range.collapse(true);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        hideAutocomplete(); editor.focus();
        const noteType = editor.classList.contains('cornell-cues') ? 'cues' : editor.classList.contains('cornell-main') ? 'main' : editor.classList.contains('cornell-summary') ? 'summary' : 'normal';
        const topicCard = editor.closest('[data-id]');
        const [,,t] = findTopicById(topicCard.dataset.id);
        if(t) {
            t.notes[noteType] = editor.innerHTML;
            syncTagsFromEditor(t, editor);
            saveModelThrottled();
        }
    }

    function handleAutocompleteKeydown(e) {
        if (!autocomplete.active) return false;
        const suggestions = autocomplete.element.querySelectorAll('.tag-suggestion'); if (!suggestions.length && !autocomplete.searchTerm) return false;
        const updateSelection = () => { suggestions.forEach((el, i) => el.classList.toggle('active', i === autocomplete.selectedIndex)); suggestions[autocomplete.selectedIndex]?.scrollIntoView({ block: 'nearest' }); };
        if (e.key === 'ArrowDown') { e.preventDefault(); autocomplete.selectedIndex = (autocomplete.selectedIndex + 1) % suggestions.length; updateSelection(); } 
        else if (e.key === 'ArrowUp') { e.preventDefault(); autocomplete.selectedIndex = (autocomplete.selectedIndex - 1 + suggestions.length) % suggestions.length; updateSelection(); } 
        else if (e.key === 'Enter' || e.key === 'Tab') { 
            e.preventDefault();
            if (autocomplete.selectedIndex > -1) { selectTag(suggestions[autocomplete.selectedIndex].dataset.tag); } 
            else if (autocomplete.searchTerm) { selectTag(autocomplete.searchTerm); } else { hideAutocomplete(); }
        } 
        else if (e.key === 'Escape') { e.preventDefault(); hideAutocomplete(); } 
        else { return false; } return true;
    }

    // Canvas Logic
    function openHive(subjectId, isTransition = false) {
        if (!isTransition) {
             canvasState.overlay.classList.add('visible'); canvasState.canvas.style.opacity = 1; document.body.style.overflow = 'hidden';
        }
        canvasState.isActive = true; canvasState.currentSubjectId = subjectId;
        const { nodes, links } = gatherDataForSubject(subjectId);
        canvasState.nodes = nodes; canvasState.links = links;
        if (!isTransition) {
            canvasState.transform = { x: canvasState.canvas.width / 2, y: canvasState.canvas.height / 2, scale: 1 };
             const layoutId = `view_${canvasState.currentSubjectId}`;
            const savedView = model.beehiveLayouts[layoutId];
            if (savedView) {
                const maxScale = 2.0; const minScale = 0.2;
                const scale = Math.max(minScale, Math.min(maxScale, savedView.scale));
                 if (scale > maxScale || scale < minScale){
                     canvasState.transform = { x: canvasState.canvas.width / 2, y: canvasState.canvas.height / 2, scale: 1 };
                 } else { canvasState.transform = { ...savedView }; }
            }
        }
        initializeNodePositions(); 
        startAnimation();
    }
    
    function closeHive() {
        stopAnimation(); 
        if(canvasState.currentSubjectId){
            const layoutId = `view_${canvasState.currentSubjectId}`;
            model.beehiveLayouts[layoutId] = { ...canvasState.transform };
            saveModelThrottled();
        }
        canvasState.isActive = false; canvasState.currentSubjectId = null; 
        canvasState.overlay.classList.remove('visible'); document.body.style.overflow = '';
    }
    
    function gatherDataForSubject(subjectId) {
        const nodes = []; const links = []; const nodeMap = new Map();
        const addNode = (data) => {
            if (!nodeMap.has(data.id)) {
                // Modified assigning x,y to honor dynamically spawned Idea Labs positioning
                const node = { ...data, x: data.x || 0, y: data.y || 0, wx: data.x || 0, wy: data.y || 0, wtx: data.x || 0, wty: data.y || 0, size: 0 };
                nodeMap.set(data.id, node); nodes.push(node);
            } return nodeMap.get(data.id);
        };
        const subject = model.subjects.find(s => s.id === subjectId); if(!subject) return {nodes, links};

        // 1. Subject Node
        const subjectNode = addNode({ id: subject.id, type: 'subject', label: subject.name, size: 20 });
        
        // 2. adding topics that have #tags, or are linked via a tag
        const subjectTags = new Set();
        (subject.chapters || []).forEach(c => {
            (c.topics || []).forEach(t => {
                // Visual filtering: Only show topic if it has tags
                if (t.beehiveLabels && t.beehiveLabels.length > 0) {
                    const topicNode = addNode({ id: t.id, type: 'topic', label: t.name, sId: subject.id, sName: subject.name, cName: c.name, isExternal: false, beehiveLabels: t.beehiveLabels || [], size: 12 });
                    (t.beehiveLabels || []).forEach(label => subjectTags.add(label));
                }
            });
        });

        // 3. Add tag nodes
        subjectTags.forEach(label => {
            const tagNode = addNode({ id: `tag_${label}`, type: 'tag', label: `#${label}`, size: 8 });
            links.push({ source: subjectNode, target: tagNode }); 
            nodes.filter(n => n.type === 'topic' && !n.isExternal && n.beehiveLabels.includes(label))
                 .forEach(topicNode => links.push({ source: tagNode, target: topicNode })); 
        });

        // 4. Add external topics that share tags
        const allExternalTopics = model.subjects
            .filter(s => s.id !== subjectId)
            .flatMap(s => s.chapters?.flatMap(c => c.topics?.map(t => ({...t, sId: s.id, sName: s.name, cName: c.name})) || []) || []);
        
        allExternalTopics.forEach(t => {
             // including external topics if they have beehive labels
            if (t.beehiveLabels && t.beehiveLabels.length > 0) {
                const sharedTags = (t.beehiveLabels || []).filter(l => subjectTags.has(l));
                if(sharedTags.length > 0) {
                    const topicNode = addNode({ id: t.id, type: 'topic', label: t.name, sId: t.sId, sName: t.sName, cName: t.cName, isExternal: true, beehiveLabels: t.beehiveLabels || [], size: 12});
                    sharedTags.forEach(label => {
                        const tagNode = nodeMap.get(`tag_${label}`);
                        if (tagNode) links.push({ source: tagNode, target: topicNode });
                    });
                }
            }
        });
        
        // 5. Add Idea labs (linked by Mentions + Core Subject Connective String)
        (model.ideaLabs || []).filter(lab => lab.subjectId === subjectId).forEach(lab => {
            const linkedTopics = IdeaLabEditor.getLinkedTopicsForLab(lab.id);
            const labNode = addNode({ ...lab, type: 'ideaLab', linkedTopics: linkedTopics, size: 40 }); 
            links.push({ source: subjectNode, target: labNode });

            linkedTopics.forEach(t => {
                let targetTopicNode = nodeMap.get(t.id);
                if (!targetTopicNode) {
                    // Force the mentioned topic specifically to show up and display string correlation, ahhhh
                    targetTopicNode = addNode({ id: t.id, type: 'topic', label: t.name, sId: t.sId, sName: t.sName, cName: t.cName, isExternal: t.sId !== subjectId, beehiveLabels: t.beehiveLabels || [], size: 12 });
                }
                links.push({ source: labNode, target: targetTopicNode });
            });
        });

        return { nodes, links };
    }
    function initializeNodePositions() {
        const layoutId = `hive_${canvasState.currentSubjectId}`;
        const layouts = model.beehiveLayouts[layoutId] || {};
        const { width, height } = canvasState.canvas;
        canvasState.nodes.forEach(n => {
            if(layouts[n.id]) { n.x = layouts[n.id].x; n.y = layouts[n.id].y; }
            else if (n.x === 0 && n.y === 0) { 
                // Initial randomize logic if coordinates strictly uncomputed
                n.x = Math.random() * width - width / 2; n.y = Math.random() * height - height / 2; 
            }
            n.wtx = n.x; n.wty = n.y; n.wx = n.x; n.wy = n.y;
        });
    }
    function startAnimation() {
        stopAnimation();
        const tick = () => { updateAnimation(); draw(); canvasState.animationFrame = requestAnimationFrame(tick); };
        canvasState.animationFrame = requestAnimationFrame(tick);
    }
    function stopAnimation() { if (canvasState.animationFrame) cancelAnimationFrame(canvasState.animationFrame); canvasState.animationFrame = null; }
    
    function updateAnimation() {
      canvasState.nodes.forEach(n => {
        if (n !== canvasState.drag.node) {
            if (Math.hypot(n.wx - n.wtx, n.wy-n.wty) < 1) {
                n.wtx = n.x + Math.random() * 80 - 40; n.wty = n.y + Math.random() * 80 - 40;
            }
            n.wx += (n.wtx - n.wx) * 0.002;
            n.wy += (n.wty - n.wy) * 0.002;
        }
      });
      for (let i = 0; i < canvasState.nodes.length; i++) {
        const a = canvasState.nodes[i];
        for (let j = i + 1; j < canvasState.nodes.length; j++) {
            const b = canvasState.nodes[j];
            const dx = b.wx - a.wx, dy = b.wy - a.wy; let distSq = dx * dx + dy * dy;
            let aSize = a.type === 'ideaLab' ? 90 : (a.size || 20);
            let bSize = b.type === 'ideaLab' ? 90 : (b.size || 20);
            const minDist = aSize + bSize + 20;
            if(distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq) || 1;
              const force = (dist - minDist) * 0.005;
              const fx = (dx / dist) * force, fy = (dy / dist) * force;
              if (a !== canvasState.drag.node) { a.wx += fx; a.wy += fy; }
              if (b !== canvasState.drag.node) { b.wx -= fx; b.wy -= fy; }
            }
        }
        if (a !== canvasState.drag.node) {
            a.wx += (a.x - a.wx) * 0.01;
            a.wy += (a.y - a.wy) * 0.01;
        }
      }
      updateParticles();
    }
    
    function initParticles(count) {
        for(let i=0; i<count; i++) canvasState.particles.push({
            x: Math.random(), y: Math.random(),
            vx: Math.random() * 0.2 - 0.1, vy: Math.random() * 0.2 - 0.1,
            life: Math.random() * 100
        });
    }
    function updateParticles() {
        const { particles, canvas } = canvasState;
        particles.forEach(p=> {
            p.x += p.vx / canvas.width; p.y += p.vy / canvas.height;
            p.life--;
            if(p.life <= 0) { p.x = Math.random(); p.y = Math.random(); p.life = Math.random() * 100 + 50; }
        });
    }

    function draw() {
        const { ctx, canvas, transform } = canvasState;
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        canvasState.particles.forEach(p => {
            ctx.fillStyle = `rgba(255, 193, 7, ${Math.sin(p.life * 0.1) * 0.5 + 0.2})`;
            ctx.fillRect(p.x * canvas.width, p.y * canvas.height, 2, 2);
        });
        
        ctx.save(); 
        ctx.translate(transform.x, transform.y); 
        ctx.scale(transform.scale, transform.scale);
        
        const isHovering = canvasState.hoverNode || canvasState.drag.node;
        const connectedNodes = new Set(isHovering ? [isHovering] : []);
        const connectedLinks = new Set();
        
        if (isHovering) {
            canvasState.links.forEach(l => {
                if (l.source === isHovering) { connectedNodes.add(l.target); connectedLinks.add(l); }
                if (l.target === isHovering) { connectedNodes.add(l.source); connectedLinks.add(l); 
                    canvasState.links.forEach(l2 => { if (l2.target === l.source) { connectedNodes.add(l2.source); connectedLinks.add(l2); } });
                }
            });
        }

        canvasState.links.forEach(link => {
            const isConnected = connectedLinks.has(link);
            ctx.globalAlpha = isHovering ? (isConnected ? 0.9 : 0.1) : 0.6;
            ctx.strokeStyle = isConnected ? '#f0f0f0' : (link.source.type==='subject' ? 'var(--blue-main)' : 'var(--yellow-main)');
            
            // Adding prominent connection logic specifically highlighting IdeaLabs String Interlinks
            if (link.source.type === 'ideaLab' || link.target.type === 'ideaLab') {
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2; 
                if (isHovering && !isConnected) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // Dropped back fade
                } 
            } else {
                ctx.lineWidth = 1.5;
            }

            ctx.beginPath(); ctx.moveTo(link.source.wx, link.source.wy); ctx.lineTo(link.target.wx, link.target.wy); ctx.stroke();
        });
        ctx.globalAlpha = 1.0;
        
        canvasState.nodes.forEach(node => {
            // Apply text centering 
            ctx.font = 'bold 12px Inter'; 
            ctx.textAlign = 'center';
            const textMetrics = ctx.measureText(node.label || node.title); 
            const textWidth = textMetrics.width;
            const isHovered = (node === canvasState.hoverNode || node === canvasState.drag.node);
            const isRelated = connectedNodes.has(node);
            
            ctx.globalAlpha = isHovering ? (isRelated ? 1.0 : 0.3) : 1.0;

            if (node.type === 'subject') {
                const padding = 10; ctx.fillStyle = 'rgba(33, 150, 243, 0.9)'; const rectPath = new Path2D();
                rectPath.roundRect(node.wx - textWidth/2 - padding, node.wy - 15, textWidth + padding*2, 30, 8);
                ctx.fill(rectPath); ctx.fillStyle = '#fff'; ctx.fillText(node.label, node.wx, node.wy + 4);
                node.size = textWidth/2 + padding;
            } else if (node.type === 'tag') {
                const padding = 8; ctx.fillStyle = '#3c3c3c'; const rectPath = new Path2D();
                rectPath.roundRect(node.wx - textWidth/2 - padding, node.wy - 12, textWidth + padding*2, 24, 12);
                ctx.fill(rectPath); ctx.fillStyle = '#f0f0f0'; ctx.fillText(node.label, node.wx, node.wy + 4);
                node.size = textWidth/2 + padding;
            } else if (node.type === 'topic') {
                const size = 30 + Math.min(20, textWidth/3);
                node.size = size;
                ctx.fillStyle = isHovered ? '#FFD60A' : '#FFC107';
                ctx.strokeStyle = node.isExternal ? '#FFFFFF' : '#111'; 
                ctx.lineWidth = node.isExternal ? 3.5 : 1.5;
                drawHexagon(ctx, node.wx, node.wy, size);
                if(isHovered) { ctx.shadowColor = 'var(--yellow-glow)'; ctx.shadowBlur = 15; }
                ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
                ctx.fillStyle = '#111'; ctx.font = '11px Inter';
                const label = node.label.length > 15 ? node.label.substring(0, 14) + '…' : node.label;
                ctx.fillText(label, node.wx, node.wy + 4);
            } else if (node.type === 'ideaLab') {
                const width = 180, height = 100;
                ctx.fillStyle = TEAL_COLOR;
                ctx.strokeStyle = isHovered ? 'var(--yellow-main)' : '#fff';
                ctx.lineWidth = isHovered ? 3 : 1;
                if(isHovered) { ctx.shadowColor = 'var(--yellow-glow)'; ctx.shadowBlur = 20; }
                
                const path = new Path2D(); path.roundRect(node.wx - width/2, node.wy - height/2, width, height, 12);
                ctx.fill(path); ctx.stroke(path); ctx.shadowBlur = 0;
                
                ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Inter';
                ctx.fillText(node.title, node.wx, node.wy - height/2 + 22);

                // Render topics linked via Mentions
                ctx.font = '9px Inter';
                let yOffset = node.wy - height/2 + 35;
                (node.linkedTopics || []).slice(0, 3).forEach(topic => {
                     ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                     const topicLabel = topic.name.length > 20 ? topic.name.substring(0, 19) + '...' : topic.name;
                     const pillWidth = ctx.measureText(topicLabel).width + 10;
                     const pillPath = new Path2D();
                     pillPath.roundRect(node.wx - pillWidth/2, yOffset, pillWidth, 16, 8);
                     ctx.fill(pillPath);
                     ctx.fillStyle = '#fff';
                     ctx.fillText(topicLabel, node.wx, yOffset + 11);
                     yOffset += 18;
                });
                if((node.linkedTopics || []).length > 3) {
                    ctx.fillStyle = '#e0e0e0';
                    ctx.fillText(`+ ${ (node.linkedTopics || []).length - 3} more`, node.wx, yOffset + 11);
                }
                node.size = 90; // Maintains layout constraint properly
            }
        });
        ctx.restore();
    }

    function drawHexagon(ctx, x, y, size) {
        ctx.beginPath(); 
        for (let i = 0; i < 6; i++) { 
            const angle = (Math.PI / 3) * i; 
            ctx.lineTo(x + size * Math.cos(angle), y + size * Math.sin(angle)); 
        } 
        ctx.closePath();
    }

    function addCanvasEventListeners() {
        const { canvas } = canvasState;
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseUp);
        canvas.addEventListener('wheel', onWheel, { passive: false });
        canvas.addEventListener('dblclick', onDoubleClick);
        canvas.addEventListener('touchstart', onTouchStart, { passive: false });
        canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        canvas.addEventListener('touchend', onTouchEnd);
        canvas.addEventListener('touchcancel', onTouchEnd);
    }
    function getMousePos(e) { const rect = canvasState.canvas.getBoundingClientRect(); return { x: e.clientX - rect.left, y: e.clientY - rect.top }; }
    function getTransformedPos(pos) { return { x: (pos.x - canvasState.transform.x) / canvasState.transform.scale, y: (pos.y - canvasState.transform.y) / canvasState.transform.scale }; }
    
    function getNodeAtPos(pos) {
        for (const node of [...canvasState.nodes].reverse()) {
            let inNode = false;
            if(node.type === 'ideaLab') {
                inNode = Math.abs(pos.x - node.wx) < 180 / 2 && Math.abs(pos.y - node.wy) < 100 / 2;
            } else {
                inNode = Math.hypot(pos.x - node.wx, pos.y - node.wy) < (node.size || 20);
            }
            if(inNode) return node;
        }
        return null;
    }

    function onMouseDown(e) {
        e.preventDefault();
        canvasState.isAnimating = false; 
        const mousePos = getMousePos(e);
        const pos = getTransformedPos(mousePos);
        const node = getNodeAtPos(pos);
        if (node) {
            canvasState.drag.isDraggingNode = true;
            canvasState.drag.node = node;
            canvasState.drag.node.wx = pos.x; canvasState.drag.node.wy = pos.y;
        } else {
            canvasState.drag.isPanning = true;
            canvasState.drag.isDraggingNode = false;
            canvasState.drag.startX = mousePos.x - canvasState.transform.x;
            canvasState.drag.startY = mousePos.y - canvasState.transform.y;
        }
    }
    function onMouseMove(e) {
        const mousePos = getMousePos(e);
        if (canvasState.drag.isDraggingNode && canvasState.drag.node) {
            const pos = getTransformedPos(mousePos);
            canvasState.drag.node.x = pos.x;
            canvasState.drag.node.y = pos.y;
            canvasState.drag.node.wx = pos.x;
            canvasState.drag.node.wy = pos.y;
        } else if (canvasState.drag.isPanning) { 
            canvasState.transform.x = mousePos.x - canvasState.drag.startX;
            canvasState.transform.y = mousePos.y - canvasState.drag.startY;
        } else { 
            const pos = getTransformedPos(mousePos);
            canvasState.hoverNode = getNodeAtPos(pos);
            updateTooltip(canvasState.hoverNode, e);
        }
    }
    function onMouseUp() {
        if(canvasState.drag.isDraggingNode && canvasState.drag.node) {
            const droppedNode = canvasState.drag.node;
            const layoutId = `hive_${canvasState.currentSubjectId}`;
            if (!model.beehiveLayouts[layoutId]) model.beehiveLayouts[layoutId] = {};
            model.beehiveLayouts[layoutId][droppedNode.id] = { x: droppedNode.x, y: droppedNode.y };
            saveModelThrottled();
        }
        canvasState.drag.isDraggingNode = false;
        canvasState.drag.isPanning = false;
        canvasState.drag.node = null;
    }
    function onDoubleClick(e) {
        const node = canvasState.hoverNode;
        if (!node) return;
        if (node.type === 'ideaLab') {
            IdeaLabEditor.open(node.id);
        } else if (node.type === 'topic') {
            if (node.isExternal) {
                 canvasState.canvas.style.opacity = 0;
                 setTimeout(() => {
                     openHive(node.sId, true);
                     canvasState.canvas.style.opacity = 1;
                 }, 400);
            } else {
                closeHive(); 
                navigateToCard(node.id); 
            }
        }
    }
    function onWheel(e) {
        e.preventDefault();
        canvasState.isAnimating = false;
        const scaleAmount = 1.1;
        const pos = getMousePos(e);
        const scaleFactor = e.deltaY < 0 ? scaleAmount : 1 / scaleAmount;
        const newScale = canvasState.transform.scale * scaleFactor;
        if(newScale < 0.1 || newScale > 5) return; 
        canvasState.transform.x = pos.x - (pos.x - canvasState.transform.x) * scaleFactor;
        canvasState.transform.y = pos.y - (pos.y - canvasState.transform.y) * scaleFactor;
        canvasState.transform.scale = newScale;
    }
    function onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) { onMouseDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, preventDefault: () => {} }); }
        else if (e.touches.length >= 2) { 
            canvasState.drag.isDraggingNode = false; canvasState.drag.node = null;
            canvasState.touch.panning = true;
            const t1 = e.touches[0], t2 = e.touches[1];
            canvasState.touch.pinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const midX = (t1.clientX + t2.clientX)/2; const midY = (t1.clientY + t2.clientY)/2;
            canvasState.drag.startX = midX - canvasState.transform.x; canvasState.drag.startY = midY - canvasState.transform.y;
        }
    }
    function onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && !canvasState.touch.panning) { onMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }); }
        else if (e.touches.length >= 2 && canvasState.touch.panning) {
            const t1 = e.touches[0], t2 = e.touches[1];
            const newDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const midX = (t1.clientX + t2.clientX)/2; const midY = (t1.clientY + t2.clientY)/2;
            const scaleFactor = newDist / canvasState.touch.pinchDist;
            canvasState.touch.pinchDist = newDist;
            canvasState.transform.scale *= scaleFactor;
            canvasState.transform.x = midX - (midX - canvasState.transform.x) * scaleFactor;
            canvasState.transform.y = midY - (midY - canvasState.transform.y) * scaleFactor;
            canvasState.transform.x = midX - canvasState.drag.startX; canvasState.transform.y = midY - canvasState.drag.startY;
        }
    }
    function onTouchEnd(e) { onMouseUp(); canvasState.touch.panning = false; }
    
    function updateTooltip(node, e) {
        if (node) {
            let html = '';
            if (node.type === 'topic') {
                html = `<strong>${node.label}</strong><small>${node.isExternal ? `From: ${node.sName}` : node.cName}</small><br><small style="color: var(--yellow-main); opacity: 0.9;"><em>Double-tap to ${node.isExternal ? 'visit hive' : 'open topic'}</em></small>`;
            } else if (node.type === 'subject') html = `<strong>${node.label}</strong><small>Current Subject</small>`;
            else if (node.type === 'tag') html = `<strong>${node.label}</strong><small>Connection Tag</small>`;
            else if (node.type === 'ideaLab') html = `<strong>${node.title}</strong><small>Idea Lab (Double-tap to enter)</small>`;
            
            if (html) {
                canvasState.tooltip.innerHTML = html;
                canvasState.tooltip.style.left = `${e.clientX}px`;
                canvasState.tooltip.style.top = `${e.clientY}px`;
                canvasState.tooltip.classList.add('visible');
                return;
            }
        }
        canvasState.tooltip.classList.remove('visible');
    }

    function createIdeaLab() {
        const newLab = {
            id: 'lab_' + uid(),
            subjectId: canvasState.currentSubjectId,
            title: 'New Idea Lab',
            // Assigning explicitly default placement in current visual canvas middle
            x: (-canvasState.transform.x + canvasState.canvas.width / 2) / canvasState.transform.scale,
            y: (-canvasState.transform.y + canvasState.canvas.height / 2) / canvasState.transform.scale,
            frames: [],
            linkedTopics: [] 
        };
        if (!model.ideaLabs) model.ideaLabs = [];
        model.ideaLabs.push(newLab);
        saveModelThrottled();
        // Force synchronous instantiation
        refreshData();
        updateDashboardIfVisible();
    }
    function createAutocompleteElement() { if (document.querySelector('.tag-autocomplete')) return; const el = document.createElement('div'); el.className = 'tag-autocomplete'; document.body.appendChild(el); autocomplete.element = el; }

  })();
  
  // ==========================================================
  // ==    Idea Lab Editor Logic                             ==
  // ==========================================================
  const IdeaLabEditor = (() => {
      let activeLabId = null;
      let activeFrameId = null;
      const overlay = document.getElementById('ideaLabOverlay');
      const sidebarsContainer = document.getElementById('ideaLabSidebars');
      let openSidebars = []; 
      
      function init() {
          document.getElementById('ideaLabExitBtn').onclick = close;
          
          // Added fully implemented Delete Lab directly from UI bounds
          document.getElementById('ideaLabDeleteBtn').onclick = async () => {
              if (!activeLabId) return;
              if (await customModal.show("Are you sure you want to permanently delete this Idea Lab? This cannot be undone.", true)) {
                  model.ideaLabs = model.ideaLabs.filter(l => l.id !== activeLabId);
                  await saveModel(); // Immediate save ensuring storage writes it 
                  activeLabId = null;
                  close(); // Close panel first to release locks
                  
                  // Force instantaneous visual wipe if Beehive happens to still be resident
                  if (typeof BeeHive !== 'undefined') {
                      BeeHive.refreshData(); 
                  }
                  // Force Instant Dashboard update so user visually feels the deletion in real-time, uff
                  if (document.getElementById('dashboard').style.display === 'block') {
                      renderDashboard();
                  }
              }
          };

          const titleEl = document.getElementById('ideaLabTitle');
          titleEl.addEventListener('blur', () => {
              const lab = model.ideaLabs.find(l => l.id === activeLabId);
              if (lab && lab.title !== titleEl.textContent) {
                  lab.title = titleEl.textContent.trim();
                  saveModelThrottled();
                  BeeHive.refreshData();
                  // Force instant update explicitly when renaming instead of debouncer gap
                  if (document.getElementById('dashboard').style.display === 'block') {
                      renderDashboard();
                  }
              }
          });
          
          overlay.addEventListener('click', e => {
              const mention = e.target.closest('.topic-mention');
              if (mention) openTopicInSidebar(mention.dataset.topicId);
          });
          
          document.getElementById('addFrameArgBtn').onclick = () => addFrame('argument');
          document.getElementById('addFrameCompBtn').onclick = () => addFrame('compare');
          document.getElementById('addFrameCauseBtn').onclick = () => addFrame('cause');
          document.getElementById('addFrameNoteBtn').onclick = () => addFrame('note');
      }

      function open(labId) {
          activeLabId = labId;
          const lab = model.ideaLabs.find(l => l.id === labId);
          if (!lab) return close();

          closeSidebars();
          BeeHive.close();
          document.getElementById('ideaLabTitle').textContent = lab.title;
          
          renderTopicSearchInHeader();

          activeFrameId = (lab.frames && lab.frames.length > 0) ? lab.frames[0].id : null;
          renderFrameList();
          renderActiveFrame();
          overlay.classList.add('visible');
      }
      
      function renderTopicSearchInHeader() {
          const header = document.querySelector('.idea-lab-header');
          let searchContainer = document.getElementById('ideaLabTopicSearchContainer');
          if(!searchContainer) {
              searchContainer = el('div');
              searchContainer.id = 'ideaLabTopicSearchContainer';
              searchContainer.style.position = 'relative';
              searchContainer.style.marginRight = '16px';
              searchContainer.innerHTML = `
                 <input type="text" placeholder="Search & Open Topic..." style="padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line-accent); background: var(--bg-panel-light); color: var(--ink-main); width: 240px;">
                 <div id="ideaLabTopicSearchResults" style="display:none; position:absolute; top: 100%; left: 0; width: 100%; max-height: 200px; overflow-y: auto; background: var(--bg-panel); border: 1px solid var(--line-accent); z-index: 10; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>
              `;
              header.insertBefore(searchContainer, header.lastElementChild);

              const input = searchContainer.querySelector('input');
              const resList = searchContainer.querySelector('#ideaLabTopicSearchResults');
              
              input.addEventListener('input', (e) => {
                  const term = e.target.value.toLowerCase();
                  if(!term) { resList.style.display = 'none'; return; }
                  
                  const matches = [];
                  model.subjects.forEach(s => s.chapters?.forEach(c => c.topics?.forEach(t => {
                      if(t.name.toLowerCase().includes(term)) matches.push({t, s, c});
                  })));
                  
                  if(matches.length > 0) {
                      resList.innerHTML = matches.slice(0, 10).map(m => `
                         <div class="topic-search-item" data-id="${m.t.id}" style="padding:8px; cursor:pointer; border-bottom:1px solid var(--line-accent);">
                            <div style="font-weight:bold;">${m.t.name.replace(new RegExp(term, 'gi'), `<strong>$&</strong>`)}</div>
                            <div style="font-size:10px; color:var(--ink-muted);">${m.s.name} > ${m.c.name}</div>
                         </div>
                      `).join('');
                      resList.style.display = 'block';
                      resList.querySelectorAll('.topic-search-item').forEach(item => {
                          item.addEventListener('click', () => {
                              openTopicInSidebar(item.dataset.id);
                              input.value = '';
                              resList.style.display = 'none';
                          });
                      });
                  } else {
                      resList.style.display = 'none';
                  }
              });
              
              document.addEventListener('click', (e) => {
                  if(!searchContainer.contains(e.target)) resList.style.display = 'none';
              });
          }
      }

      function close() {
          overlay.classList.remove('visible');
          activeLabId = null;
          activeFrameId = null;
      }
      
      function addFrame(type) {
          if (!activeLabId) return;
          const lab = model.ideaLabs.find(l => l.id === activeLabId);
          if (!lab) return;
          const template = FRAME_TEMPLATES[type];
          const newFrame = {
              id: 'frame_' + uid(),
              type: type,
              title: template.title,
              content: JSON.parse(JSON.stringify(template.content)), 
          };
          lab.frames = lab.frames || [];
          lab.frames.push(newFrame);
          activeFrameId = newFrame.id;
          renderFrameList();
          renderActiveFrame();
          saveModelThrottled();
          updateDashboardIfVisible(); 
      }

      function renderFrameList() {
          const container = document.querySelector('.idea-lab-frames-list');
          container.innerHTML = '';
          const lab = model.ideaLabs.find(l => l.id === activeLabId);
          if (!lab || !lab.frames) return;

          lab.frames.forEach(frame => {
              const item = el('div', 'frame-list-item');
              item.dataset.frameId = frame.id;
              if (frame.id === activeFrameId) item.classList.add('active');

              const iconClass = { argument: 'fa-gavel', compare: 'fa-right-left', cause: 'fa-diagram-project', note: 'fa-note-sticky'}[frame.type];
              item.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span class="frame-list-item-title">${frame.title}</span>`;
              
              const delBtn = el('button', 'btn btn-danger btn-mini');
              delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
              delBtn.onclick = (e) => {
                  e.stopPropagation();
                  lab.frames = lab.frames.filter(f => f.id !== frame.id);
                  if (activeFrameId === frame.id) {
                      activeFrameId = lab.frames.length > 0 ? lab.frames[0].id : null;
                  }
                  renderFrameList();
                  renderActiveFrame();
                  saveModelThrottled();
                  updateDashboardIfVisible(); 
              };
              item.appendChild(delBtn);
              item.onclick = () => {
                  activeFrameId = frame.id;
                  renderFrameList();
                  renderActiveFrame();
              };
              container.appendChild(item);
          });
      }

      function renderActiveFrame() {
          const contentContainer = document.getElementById('ideaLabFrameContent');
          const titleEl = document.getElementById('ideaLabEditorTitle');
          contentContainer.innerHTML = '';
          titleEl.textContent = '';
          titleEl.onblur = null;
          titleEl.contentEditable = "false";

          const lab = model.ideaLabs.find(l => l.id === activeLabId);
          if (!lab) return;

          if (!lab.frames || lab.frames.length === 0) {
              contentContainer.innerHTML = `<div class="idea-lab-empty-state"><h3>Welcome to your Idea Lab!</h3><p>Get started by adding your first frame using the buttons in the header.</p></div>`;
              titleEl.textContent = 'No Frames Created Yet';
              return;
          }
          if (!activeFrameId) {
              contentContainer.innerHTML = `<div class="idea-lab-empty-state"><h3>Select a Frame</h3><p>Choose a frame from the list on the left to start editing.</p></div>`;
              titleEl.textContent = 'No Frame Selected';
              return;
          }

          const frame = lab.frames.find(f => f.id === activeFrameId);
          if (!frame) return;

          titleEl.textContent = frame.title;
          titleEl.contentEditable = "true";
          titleEl.onblur = () => {
              if (frame.title !== titleEl.textContent) {
                  frame.title = titleEl.textContent.trim();
                  saveModelThrottled();
                  renderFrameList();
              }
          };
          
          const saveCallback = (key, value) => {
              frame.content[key] = value;
              syncLinkedTopics();
              saveModelThrottled();
          };
          
          const refreshFrame = () => renderActiveFrame();

          const template = FRAME_TEMPLATES[frame.type];
          if(template) template.render(contentContainer, frame.content, saveCallback, refreshFrame);
      }

      function syncLinkedTopics() {
            const lab = model.ideaLabs.find(l => l.id === activeLabId);
            if (!lab) return;
            let allContent = '';
            (lab.frames || []).forEach(f => {
                if (f.type === 'cause') {
                   allContent += f.content.causes.join(' ') + ' ' + f.content.effects.join(' ');
                } else {
                   Object.values(f.content).forEach(val => allContent += val);
                }
            });
            const tempDiv = el('div');
            tempDiv.innerHTML = allContent;
            
            // Reassign IDs specifically dynamically saved as .topic-mentions elements.
            const linkedIds = new Set([...tempDiv.querySelectorAll('.topic-mention')].map(el => el.dataset.topicId));
            const currentIds = new Set(lab.linkedTopics || []);
            
            if (linkedIds.size !== currentIds.size || ![...linkedIds].every(id => currentIds.has(id))) {
                lab.linkedTopics = Array.from(linkedIds);
                updateDashboardIfVisible();
                BeeHive.refreshData(); 
            }
      }

       function getLinkedTopicsForLab(labId) {
            const lab = model.ideaLabs.find(l => l.id === labId);
            if (!lab) return [];
            return (lab.linkedTopics || []).map(topicId => {
                const [s, c, t] = findTopicById(topicId);
                if (t) {
                    return { ...t, sId: s.id, sName: s.name, cName: c.name };
                }
                return null;
            }).filter(Boolean);
       }
      
      function openTopicInSidebar(topicId) {
          const existingIndex = openSidebars.findIndex(s => s.topicId === topicId);
          if (existingIndex > -1) { 
              const card = sidebarsContainer.children[existingIndex];
              [...sidebarsContainer.children].forEach(c => c.classList.remove('active-focus'));
              card.classList.add('active-focus');
              card.scrollIntoView({ behavior: 'smooth' });
              return;
          }
          const [s, c, t] = findTopicById(topicId);
          if (!t) return;
          if (openSidebars.length >= 2) {
              openSidebars.shift(); 
              sidebarsContainer.firstChild.remove();
          }
          openSidebars.push({ topicId, s, c, t });
          renderSidebars();
      }

      function closeSidebars() { openSidebars = []; renderSidebars(); }

      function renderSidebars() {
          sidebarsContainer.innerHTML = '';
          sidebarsContainer.className = `idea-lab-sidebars visible-${openSidebars.length}`;
          openSidebars.forEach(({ topicId, s, c, t }) => {
              const card = el('div', 'topic-sidebar-card');
              card.dataset.topicId = topicId;
              const header = el('div', 'topic-sidebar-header');
              header.innerHTML = `<span style="color: ${TEAL_COLOR}">${t.name}</span>`;
              const closeBtn = el('button', 'btn btn-ghost btn-mini', 'X');
              closeBtn.style.marginLeft = 'auto';
              closeBtn.onclick = () => { openSidebars = openSidebars.filter(sb => sb.topicId !== topicId); renderSidebars(); };
              header.appendChild(closeBtn);
              const content = el('div', 'topic-sidebar-content');
              renderTopicBody(t, s, c, content); 
              card.append(header, content);
              sidebarsContainer.appendChild(card);
          });
          if(sidebarsContainer.lastChild) {
              [...sidebarsContainer.children].forEach(c => c.classList.remove('active-focus'));
              sidebarsContainer.lastChild.classList.add('active-focus');
          }
      }
      
      // Maintained specifically handling space strips safely processing robust mentions linking topics correctly
      function processMentions(editor) {
             const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
             let node; const nodesToProcess = [];
             while(node = walker.nextNode()) { if (!node.parentElement.closest('.topic-mention')) nodesToProcess.push(node); }
             nodesToProcess.forEach(node => {
                const text = node.nodeValue; 
                // Matches cleanly written alpha-numeric tags starting with @
                const matches = [...text.matchAll(/@([a-zA-Z0-9-]{2,})/g)];
                if (matches.length > 0) {
                  const frag = document.createDocumentFragment(); let lastIndex = 0;
                  const allTopics = model.subjects.flatMap(s => s.chapters?.flatMap(c => c.topics || []) || []);
                  
                  // Helper function ignoring spaces allowing robust exact lookup seamlessly
                  const normalizeStr = str => str.replace(/\s+/g, '').toLowerCase();

                  matches.forEach(match => {
                      const userMentionStr = normalizeStr(match[1]);
                      const topic = allTopics.find(t => normalizeStr(t.name) === userMentionStr);
                      const index = match.index;
                      
                      if (index > lastIndex) { frag.appendChild(document.createTextNode(text.substring(lastIndex, index))); }
                      if(topic) {
                          const span = el('span', 'topic-mention', match[0]);
                          span.contentEditable = "false";
                          span.dataset.topicId = topic.id;
                          frag.appendChild(span);
                      } else { 
                          frag.appendChild(document.createTextNode(match[0])); 
                      }
                      lastIndex = index + match[0].length;
                  });
                  if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.substring(lastIndex)));
                  if(lastIndex > 0) node.parentNode.replaceChild(frag, node);
                }
            });
      }

      return { init, open, close, processMentions, getLinkedTopicsForLab };
  })();

  // ======== Main Init ========
  async function init() {
    customModal.init();
    BeeHive.init();
    IdeaLabEditor.init(); 
    setupFocusModeEventListeners();
    await loadModel();
    runDailyCheck();
    await loadUiState();
    adjustLayoutForAppBar();
    if(model.subjects && model.subjects.length > HEAVY_DATA_THRESHOLD) { showGlobalLoader(); await new Promise(res => setTimeout(res, 50)); }
    await renderModelAsync();
    
    searchInput.addEventListener('input', debounce(performSearch, 300));
    window.addEventListener('scroll', debounce(() => { if (!mainView.classList.contains('hidden')) uiState.scrollY = window.scrollY; saveUiState(); }, 200));
    window.addEventListener('resize', debounce(() => { adjustLayoutForAppBar(); if(dashboardView.style.display === 'block') { renderWavyChart(); } }, 200));
    window.addEventListener('scroll', handleAppBarScroll, { passive: true });
    
    document.body.addEventListener('dragstart', onDragStart); 
    document.body.addEventListener('dragover', onDragOver); 
    document.body.addEventListener('drop', onDrop); 
    document.body.addEventListener('dragend', onDragEnd);
    document.body.addEventListener('touchstart', onTouchStartDrag, { passive: false });
    document.body.addEventListener('touchmove', onTouchMoveDrag, { passive: false });
    document.body.addEventListener('touchend', onTouchEndDrag);
    document.body.addEventListener('touchcancel', onTouchEndDrag);

    window.addEventListener('beforeunload', saveModel);
  }

  init();

})();
