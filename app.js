/* ==========================================================================
   LIFE ORGANIZER - BULLETPROOF JAVASCRIPT LOGIC
   ========================================================================== */

// DEFENSIVE STORAGE WRAPPER (Prevents crashes if cookies/localStorage are blocked or in file:///)
const storage = {
  isAvailable() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },
  getItem(key) {
    try {
      if (this.isAvailable()) {
        return localStorage.getItem(key);
      }
    } catch (e) {
      console.warn('Storage getItem access denied:', e);
    }
    return null;
  },
  setItem(key, value) {
    try {
      if (this.isAvailable()) {
        localStorage.setItem(key, value);
        return true;
      }
    } catch (e) {
      console.warn('Storage setItem access denied:', e);
    }
    return false;
  }
};

// STATE MANAGEMENT
let tasks = [];
let streakCount = 0;
let lastCompletedDate = '';
let recognition = null;
let isRecording = false;

// DOM ELEMENTS
const liveClockEl = document.getElementById('time-display');
const pwaInstallBtn = document.getElementById('pwa-install-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeIcon = document.getElementById('theme-icon');
const taskForm = document.getElementById('task-form');
const voiceInputBtn = document.getElementById('voice-input-btn');
const alarmSound = document.getElementById('alarm-sound');
const voiceTestBtn = document.getElementById('voice-test-btn');

// Form Input Elements
const taskTitleInput = document.getElementById('task-title');
const taskDescInput = document.getElementById('task-desc');
const taskReminderInput = document.getElementById('task-reminder');
const taskPrioritySelect = document.getElementById('task-priority');
const taskCategorySelect = document.getElementById('task-category');

// Stats Elements
const statActiveCountEl = document.getElementById('stat-active-count');
const statCompletedCountEl = document.getElementById('stat-completed-count');
const statStreakCountEl = document.getElementById('stat-streak-count');
const completionRatioEl = document.getElementById('completion-ratio');
const progressCircle = document.getElementById('progress-circle');
const performanceBadge = document.getElementById('performance-badge');
const encouragementBar = document.getElementById('encouragement-bar');

// Lists Elements
const activeTasksList = document.getElementById('active-tasks-list');
const completedTasksList = document.getElementById('completed-tasks-list');
const activeBadgeCount = document.getElementById('active-badge-count');
const completedBadgeCount = document.getElementById('completed-badge-count');

// Filter & Clear Controls
const filterPriority = document.getElementById('filter-priority');
const clearArchiveBtn = document.getElementById('clear-archive-btn');

// Voice Speaking Notification Elements
const voiceIndicator = document.getElementById('voice-indicator');
const voiceIndicatorText = document.getElementById('voice-indicator-text');

// Help Modal Elements
const helpModal = document.getElementById('help-modal');
const helpModalTrigger = document.getElementById('help-modal-trigger');
const helpCloseBtn = document.getElementById('help-close-btn');
const helpOkBtn = document.getElementById('help-ok-btn');


/* ==========================================================================
   INITIALIZATION & EVENT LISTENERS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('منظم الحياة: بدء تشغيل النظام تفاعلياً...');
    
    // Load State from LocalStorage
    loadState();

    // Initialize UI & Icons
    initClock();
    initTheme();
    initPWA();
    initSpeechRecognition();
    setDefaultReminderTime();
    render();

    // Periodic Reminder Checker (Every 1 second)
    setInterval(checkReminders, 1000);

    // Setup Event Listeners
    if (taskForm) {
      taskForm.addEventListener('submit', handleTaskSubmit);
    } else {
      console.error('خطأ: لم يتم العثور على عنصر النموذج task-form');
    }
    
    if (voiceInputBtn) voiceInputBtn.addEventListener('click', toggleVoiceDictation);
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    if (voiceTestBtn) voiceTestBtn.addEventListener('click', testSoundAndSpeech);
    if (filterPriority) filterPriority.addEventListener('change', render);
    if (clearArchiveBtn) clearArchiveBtn.addEventListener('click', clearCompletedArchive);

    // Modal Listeners
    if (helpModalTrigger && helpModal) {
      helpModalTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        helpModal.showModal();
      });
    }
    if (helpCloseBtn && helpModal) helpCloseBtn.addEventListener('click', () => helpModal.close());
    if (helpOkBtn && helpModal) helpOkBtn.addEventListener('click', () => helpModal.close());

    // Trigger Lucide icons safely
    safeCreateIcons();
    console.log('منظم الحياة: تم التشغيل والتهيئة بنجاح تام! 🚀');
  } catch (error) {
    console.error('Error during DomContentLoaded initialization:', error);
    alert('تنبيه من منظم الحياة: واجهنا مشكلة أثناء إعداد الصفحة: ' + error.message);
  }
});

// Offline-safe utility to draw Lucide SVGs
function safeCreateIcons() {
  try {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    } else {
      console.warn('Lucide icons library not loaded yet.');
    }
  } catch (e) {
    console.warn('Failed to render icons:', e);
  }
}


/* ==========================================================================
   STATE PERSISTENCE
   ========================================================================== */

function loadState() {
  try {
    const storedTasks = storage.getItem('lifeorganizer_tasks') || storage.getItem('voxtask_tasks');
    if (storedTasks) {
      const parsed = JSON.parse(storedTasks);
      if (Array.isArray(parsed)) {
        tasks = parsed;
      } else {
        tasks = [];
      }
    }
  } catch (e) {
    console.error('Failed to parse tasks from storage:', e);
    tasks = [];
  }

  try {
    const storedStreak = storage.getItem('lifeorganizer_streak') || storage.getItem('voxtask_streak');
    if (storedStreak) {
      streakCount = parseInt(storedStreak, 10) || 0;
    }
  } catch (e) {
    streakCount = 0;
  }

  try {
    const storedLastDate = storage.getItem('lifeorganizer_last_completed_date') || storage.getItem('voxtask_last_completed_date');
    if (storedLastDate) {
      lastCompletedDate = storedLastDate;
    }
  } catch (e) {
    lastCompletedDate = '';
  }

  // Check if streak is broken (more than 48 hours since last completion)
  checkStreakValidity();
}

function saveState() {
  storage.setItem('lifeorganizer_tasks', JSON.stringify(tasks));
  storage.setItem('lifeorganizer_streak', streakCount.toString());
  storage.setItem('lifeorganizer_last_completed_date', lastCompletedDate);
}

// Check if streak was broken (e.g. user hasn't completed a task yesterday)
function checkStreakValidity() {
  if (!lastCompletedDate) return;
  
  try {
    const lastDate = new Date(lastCompletedDate);
    const today = new Date();
    
    // Set times to midnight for accurate date comparison
    lastDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
      streakCount = 0;
      saveState();
    }
  } catch (e) {
    console.warn('Failed to validate streak:', e);
  }
}

// Update streak when a task is completed
function updateStreak() {
  try {
    const todayStr = new Date().toDateString();
    
    if (lastCompletedDate === todayStr) {
      return;
    }
    
    const lastDate = new Date(lastCompletedDate);
    const today = new Date();
    lastDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1 || !lastCompletedDate) {
      streakCount++;
    } else {
      streakCount = 1;
    }
    
    lastCompletedDate = todayStr;
    saveState();
  } catch (e) {
    console.warn('Failed to update streak count:', e);
  }
}


/* ==========================================================================
   LIVE CLOCK & UTILITIES
   ========================================================================== */

function initClock() {
  if (!liveClockEl) return;
  const updateClock = () => {
    try {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      liveClockEl.textContent = `${hours}:${minutes}:${seconds}`;
    } catch (e) {
      console.warn('Clock tick failed:', e);
    }
  };
  updateClock();
  setInterval(updateClock, 1000);
}

function setDefaultReminderTime() {
  if (!taskReminderInput) return;
  try {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    taskReminderInput.value = `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    console.warn('Failed to set default reminder time:', e);
  }
}

// Convert date format for UI display
function formatDateTimeArabic(dateString) {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
}


/* ==========================================================================
   THEME MANAGER (LIGHT/DARK)
   ========================================================================== */

function initTheme() {
  try {
    const savedTheme = storage.getItem('lifeorganizer_theme') || storage.getItem('voxtask_theme') || 'light';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
    } else {
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
    }
    safeCreateIcons();
  } catch (e) {
    console.warn('Theme init failed:', e);
  }
}

function toggleTheme() {
  try {
    if (document.body.classList.contains('light-mode')) {
      document.body.classList.replace('light-mode', 'dark-mode');
      storage.setItem('lifeorganizer_theme', 'dark');
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
    } else {
      document.body.classList.replace('dark-mode', 'light-mode');
      storage.setItem('lifeorganizer_theme', 'light');
      if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
    }
    safeCreateIcons();
  } catch (e) {
    console.warn('Theme toggle failed:', e);
  }
}


/* ==========================================================================
   PWA INTEGRATION
   ========================================================================== */

let deferredPrompt;

function initPWA() {
  try {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('Service Worker Registered successfully', reg.scope))
          .catch((err) => console.error('Service Worker Registration Failed', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (pwaInstallBtn) pwaInstallBtn.classList.remove('hidden');
    });

    if (pwaInstallBtn) {
      pwaInstallBtn.addEventListener('click', () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              pwaInstallBtn.classList.add('hidden');
            }
            deferredPrompt = null;
          });
        }
      });
    }

    window.addEventListener('appinstalled', () => {
      console.log('Life Organizer has been installed successfully!');
      if (pwaInstallBtn) pwaInstallBtn.classList.add('hidden');
    });
  } catch (e) {
    console.warn('PWA initialization failed:', e);
  }
}


/* ==========================================================================
   SPEECH RECOGNITION (VOICE TO TEXT INPUT)
   ========================================================================== */

function initSpeechRecognition() {
  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn('Speech recognition is not supported in this browser.');
      if (voiceInputBtn) voiceInputBtn.style.display = 'none';
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'ar-EG';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isRecording = true;
      if (voiceInputBtn) {
        voiceInputBtn.classList.add('recording');
        const textLabel = voiceInputBtn.querySelector('span:last-child');
        if (textLabel) textLabel.textContent = 'جاري الاستماع...';
      }
      if (taskTitleInput) taskTitleInput.placeholder = 'تحدث الآن، أسمعك بوضوح...';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (taskTitleInput) taskTitleInput.value = transcript;
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error: ', event.error);
      alert('حدث خطأ أثناء الاستماع. يرجى التأكد من تشغيل الميكروفون وإعطاء صلاحيات الدخول.');
    };

    recognition.onend = () => {
      isRecording = false;
      if (voiceInputBtn) {
        voiceInputBtn.classList.remove('recording');
        const textLabel = voiceInputBtn.querySelector('span:last-child');
        if (textLabel) textLabel.textContent = 'إملاء صوتي';
      }
      if (taskTitleInput) taskTitleInput.placeholder = 'مثال: قراءة كتاب، موعد الطبيب...';
    };
  } catch (e) {
    console.warn('Speech Recognition setup failed:', e);
  }
}

function toggleVoiceDictation() {
  if (!recognition) {
    alert('عذراً، خاصية الإملاء الصوتي غير مدعومة في متصفحك الحالي. يرجى استخدام متصفح Google Chrome.');
    return;
  }

  try {
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  } catch (e) {
    console.error('Recognition toggle failure:', e);
  }
}


/* ==========================================================================
   OFFLINE SYNTHESIZED SOUND & VOICE ENGINES (WEB AUDIO API & SPEECH SYNTHESIS)
   ========================================================================== */

// Programmatic offline notification bell synthesizer (Bypasses files and CORS blocks completely!)
function playFallbackNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    
    // Play a gorgeous dual-tone notification chime
    // Tone 1: High pitch chime (C6 - 1046.50 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.50, ctx.currentTime);
    
    // Tone 2: Harmonious E6 (1318.51 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.12);
    
    // Smooth volume fade outs
    gain1.gain.setValueAtTime(0.18, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    
    gain2.gain.setValueAtTime(0.18, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5);
    
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.7);
    
    console.log('Web Audio API synthesized chime triggered successfully!');
  } catch (e) {
    console.warn('Web Audio synthesis blocked or failed:', e);
  }
}

// User-triggered test of the audio context & text-to-speech engine
function testSoundAndSpeech() {
  try {
    console.log('إطلاق اختبار الصوت والتنبيه الصوتي...');
    
    // 1. Play Synthesized offline chime
    playFallbackNotificationSound();
    
    // 2. Fire speech test
    speakText("تنبيه من منظم الحياة. تم تشغيل واختبار نظام التنبيه الصوتي بنجاح.", function() {
      // After speech ends, check if Arabic voice exists
      if (!cachedArabicVoice) {
        setTimeout(() => {
          alert('💡 تلميح منظم الحياة الصوتي:\n\nلقد قمنا بتشغيل التنبيه الموسيقي بنجاح! إذا سمعت جرس الرنين ولكن لم تسمع نطق الكلمات بالعربي، فهذا يعني أن نظام التشغيل بجهازك (ويندوز) يفتقر لحزمة الصوت العربي.\n\nلتفعيل نطق الكلمات باللغة العربية:\n1. اذهب لقائمة ابدأ (Start) ثم الإعدادات (Settings).\n2. اختر الوقت واللغة (Time & Language) ثم الكلام (Speech).\n3. تحت قسم إضافة أصوات (Add Voices)، ابحث عن "العربية" وقم بتثبيتها.\n4. أعد تنشيط صفحة المتصفح وستستمع للتلاوة العربية بكل وضوح!');
        }, 500);
      }
    });
    
  } catch (e) {
    console.error('Test audio failed:', e);
    alert('فشل تشغيل الصوت: ' + e.message);
  }
}

/* ==========================================================================
   CENTRALIZED SPEECH ENGINE (Solves Chrome async voice loading bug)
   ========================================================================== */

// Global voice cache - populated when browser finishes loading voices
let cachedVoices = [];
let cachedArabicVoice = null;

// Initialize voice cache immediately and on change
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  cachedVoices = window.speechSynthesis.getVoices();
  console.log('Loaded TTS voices count:', cachedVoices.length);
  
  // Try to find Arabic voice
  cachedArabicVoice = cachedVoices.find(v => v.lang.startsWith('ar'));
  
  if (cachedArabicVoice) {
    console.log('✅ Arabic voice found:', cachedArabicVoice.name, cachedArabicVoice.lang);
  } else {
    console.warn('⚠️ No Arabic voice installed on this system. Will use default system voice.');
    // Log all available voices for debugging
    cachedVoices.forEach(v => console.log('  Available voice:', v.name, v.lang));
  }
}

// Load voices now (works in Firefox)
loadVoices();

// Chrome/Edge load voices asynchronously - listen for the event
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}

// The single reliable function to speak text out loud
function speakText(text, onEndCallback) {
  if (!('speechSynthesis' in window)) {
    alert('عذراً، محرك التحدث الصوتي غير مدعوم في متصفحك. يرجى تجربة Google Chrome.');
    return;
  }
  
  try {
    // Cancel any pending speech first
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    
    // CRITICAL: Always set voice and lang from our cached data
    if (cachedArabicVoice) {
      utterance.voice = cachedArabicVoice;
      utterance.lang = cachedArabicVoice.lang;
      console.log('Speaking with Arabic voice:', cachedArabicVoice.name);
    } else {
      // No Arabic voice? Use default system voice with English lang
      // This ensures Chrome does NOT silently discard the utterance
      utterance.lang = 'en-US';
      console.log('Speaking with default system voice (no Arabic voice installed)');
    }
    
    utterance.onstart = () => {
      console.log('🔊 Speech started');
      if (voiceIndicatorText) voiceIndicatorText.textContent = 'جاري التنبيه الصوتي...';
      if (voiceIndicator) voiceIndicator.classList.remove('hidden');
    };
    
    utterance.onend = () => {
      console.log('🔊 Speech ended');
      if (voiceIndicator) voiceIndicator.classList.add('hidden');
      if (typeof onEndCallback === 'function') onEndCallback();
    };
    
    utterance.onerror = (err) => {
      console.error('🔊 Speech error:', err.error);
      if (voiceIndicator) voiceIndicator.classList.add('hidden');
    };
    
    // Chromium needs a small delay after cancel() before speak()
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
      console.log('🔊 Speech queued:', text.substring(0, 50) + '...');
    }, 150);
    
  } catch (e) {
    console.error('speakText failure:', e);
  }
}

function playVoiceReminder(task) {
  // 1. Synthesize bell chime (100% reliable and offline-first!)
  playFallbackNotificationSound();

  // 2. Play secondary local alarm sound if loaded
  try {
    if (alarmSound) {
      alarmSound.currentTime = 0;
      alarmSound.play().catch(e => console.warn("Local audio playback blocked:", e));
    }
  } catch (error) {
    console.warn("Could not play alarm:", error);
  }

  // 3. Speak the task name
  const cleanTitle = task.title.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
  speakText(`تنبيه: حان وقت القيام بمهمة: ${cleanTitle}`);
}

// Expose playVoiceReminderById globally so inline onclick handlers can call it
window.playVoiceReminderById = function(id) {
  try {
    const task = tasks.find(t => t.id === id);
    if (task) {
      console.log('Replaying voice reminder for:', task.title);
      playVoiceReminder(task);
    } else {
      console.warn('Task not found for voice playback:', id);
    }
  } catch (e) {
    console.error('Failed to trigger voice reminder:', e);
  }
};

// Listen to voices population in case they load asynchronously
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    console.log('SpeechSynthesis voices updated in background.');
  };
}

function checkReminders() {
  try {
    const now = new Date();
    let stateChanged = false;

    tasks.forEach((task) => {
      if (!task.completed && !task.reminded && task.reminder) {
        const reminderTime = new Date(task.reminder);
        
        // Match reminder time window
        if (reminderTime <= now && (now - reminderTime) < 60000) {
          task.reminded = true;
          stateChanged = true;
          playVoiceReminder(task);
        }
      }
    });

    if (stateChanged) {
      saveState();
      render();
    }
  } catch (e) {
    console.warn('Reminder checker failed:', e);
  }
}


/* ==========================================================================
   TASK HANDLING ACTIONS
   ========================================================================== */

function handleTaskSubmit(e) {
  try {
    e.preventDefault();
    console.log('جاري معالجة إرسال المهمة الجديدة...');

    if (!taskTitleInput || !taskReminderInput || !taskPrioritySelect || !taskCategorySelect) {
      throw new Error('لم يتم تحميل بعض عناصر الإدخال في الصفحة بشكل صحيح.');
    }

    const title = taskTitleInput.value.trim();
    const desc = taskDescInput ? taskDescInput.value.trim() : '';
    const reminder = taskReminderInput.value;
    const priority = taskPrioritySelect.value;
    const category = taskCategorySelect.value;

    // ACTIVE DIAGNOSTIC ALERTS TO PREVENT SILENT FAILURES
    if (!title) {
      alert('⚠️ عذراً، يرجى كتابة عنوان المهمة أولاً.');
      taskTitleInput.focus();
      return;
    }
    if (!reminder) {
      alert('⚠️ عذراً، يجب تحديد موعد التذكير الصوتي.');
      taskReminderInput.focus();
      return;
    }

    const newTask = {
      id: 'lifeorganizer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title,
      desc,
      reminder,
      priority,
      category,
      completed: false,
      reminded: false,
      createdAt: new Date().toISOString()
    };

    tasks.push(newTask);
    saveState();
    render();

    // Reset fields safely
    taskTitleInput.value = '';
    if (taskDescInput) taskDescInput.value = '';
    setDefaultReminderTime();
    
    console.log('تم حفظ المهمة بنجاح وتحديث الواجهة!');
  } catch (err) {
    console.error('Task submission failure:', err);
    alert('حدث خطأ أثناء حفظ المهمة: ' + err.message);
  }
}

function completeTask(id) {
  try {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const taskEl = document.getElementById(id);
    if (taskEl) {
      taskEl.classList.add('slide-out-fade');
    }

    setTimeout(() => {
      try {
        tasks[taskIndex].completed = true;
        updateStreak();
        saveState();
        render();
      } catch (e) {
        console.error('Failed to move task to completed status:', e);
      }
    }, 280);
  } catch (e) {
    console.error('Complete task failure:', e);
  }
}

function snoozeTask(id) {
  try {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return;

    const currentReminder = new Date(tasks[taskIndex].reminder);
    currentReminder.setMinutes(currentReminder.getMinutes() + 5);
    
    const year = currentReminder.getFullYear();
    const month = String(currentReminder.getMonth() + 1).padStart(2, '0');
    const day = String(currentReminder.getDate()).padStart(2, '0');
    const hours = String(currentReminder.getHours()).padStart(2, '0');
    const minutes = String(currentReminder.getMinutes()).padStart(2, '0');
    
    tasks[taskIndex].reminder = `${year}-${month}-${day}T${hours}:${minutes}`;
    tasks[taskIndex].reminded = false;
    
    saveState();
    render();
  } catch (e) {
    console.error('Snooze task failure:', e);
  }
}

function deleteTask(id) {
  try {
    const taskEl = document.getElementById(id);
    if (taskEl) {
      taskEl.classList.add('slide-out-fade');
    }

    setTimeout(() => {
      try {
        tasks = tasks.filter(t => t.id !== id);
        saveState();
        render();
      } catch (e) {
        console.error('Failed to slice/delete task:', e);
      }
    }, 280);
  } catch (e) {
    console.error('Delete task trigger failure:', e);
  }
}

function clearCompletedArchive() {
  try {
    if (tasks.filter(t => t.completed).length === 0) return;
    
    if (confirm('هل أنت متأكد من رغبتك في تفريغ أرشيف المهام المكتملة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) {
      tasks = tasks.filter(t => !t.completed);
      saveState();
      render();
    }
  } catch (e) {
    console.error('Clear archive failed:', e);
  }
}


/* ==========================================================================
   RENDERING & DASHBOARD GRAPHICS
   ========================================================================== */

function render() {
  try {
    const activeTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    const filterVal = filterPriority ? filterPriority.value : 'all';
    const filteredActiveTasks = activeTasks.filter(task => {
      if (filterVal === 'all') return true;
      return task.priority === filterVal;
    });

    filteredActiveTasks.sort((a, b) => new Date(a.reminder) - new Date(b.reminder));
    completedTasks.sort((a, b) => b.id.localeCompare(a.id));

    renderActiveList(filteredActiveTasks);
    renderCompletedList(completedTasks);
    updateStatistics(activeTasks.length, completedTasks.length);
  } catch (e) {
    console.error('Render pipeline failure:', e);
  }
}

function renderActiveList(activeTasks) {
  if (!activeTasksList) return;
  try {
    activeTasksList.innerHTML = '';
    if (activeBadgeCount) activeBadgeCount.textContent = activeTasks.length.toString();

    if (activeTasks.length === 0) {
      const emptyStateEl = document.getElementById('active-empty-state');
      if (emptyStateEl) {
        emptyStateEl.style.display = 'flex';
        activeTasksList.appendChild(emptyStateEl);
      }
      return;
    }

    activeTasks.forEach((task) => {
      const taskItem = document.createElement('div');
      taskItem.className = `task-item priority-${task.priority}`;
      taskItem.id = task.id;

      const priorityText = { high: '🔴 مرتفعة', medium: '🟡 متوسطة', low: '🟢 منخفضة' }[task.priority] || '🟡 متوسطة';
      const categoryText = {
        work: '🏢 العمل',
        personal: '🏠 شخصي',
        study: '📚 الدراسة',
        health: '💪 صحة ورياضة',
        other: '⚙️ أخرى'
      }[task.category] || '🏠 شخصي';

      const reminderTimeHTML = `<span class="tag tag-reminder"><i data-lucide="bell"></i> تذكير: ${formatDateTimeArabic(task.reminder)}</span>`;
      let countdownHTML = '';
      const now = new Date();
      const reminderDate = new Date(task.reminder);
      
      if (reminderDate <= now) {
        countdownHTML = `<span class="tag tag-priority high animate-float" onclick="playVoiceReminderById('${task.id}')" style="cursor: pointer; user-select: none;" title="اضغط لإعادة تشغيل التنبيه الصوتي"><i data-lucide="volume-2"></i> حان وقت إنجازها! (استمع)</span>`;
      }

      taskItem.innerHTML = `
        <div class="task-item-top">
          <div class="task-item-content">
            <h3 class="task-item-title">${task.title}</h3>
            ${task.desc ? `<p class="task-item-desc">${task.desc}</p>` : ''}
            <div class="task-tags">
              <span class="tag tag-priority ${task.priority}">${priorityText}</span>
              <span class="tag tag-category">${categoryText}</span>
              ${reminderTimeHTML}
              ${countdownHTML}
            </div>
          </div>
          
          <div class="task-actions">
            <button class="task-btn complete-btn" onclick="completeTask('${task.id}')" title="إنجاز ونقل للأرشيف">
              <i data-lucide="check"></i>
            </button>
            <button class="task-btn play-btn" onclick="playVoiceReminderById('${task.id}')" title="استمع للتذكير الصوتي الآن" style="color: var(--primary);">
              <i data-lucide="volume-2"></i>
            </button>
            <button class="task-btn snooze-btn" onclick="snoozeTask('${task.id}')" title="غفوة 5 دقائق للتذكير">
              <i data-lucide="snooze"></i>
            </button>
            <button class="task-btn delete-btn" onclick="deleteTask('${task.id}')" title="حذف المهمة">
              <i data-lucide="trash"></i>
            </button>
          </div>
        </div>
      `;

      activeTasksList.appendChild(taskItem);
    });

    safeCreateIcons();
  } catch (e) {
    console.error('Active list render failure:', e);
  }
}

function renderCompletedList(completedTasks) {
  if (!completedTasksList) return;
  try {
    completedTasksList.innerHTML = '';
    if (completedBadgeCount) completedBadgeCount.textContent = completedTasks.length.toString();

    if (completedTasks.length === 0) {
      const emptyArchiveEl = document.getElementById('completed-empty-state');
      if (emptyArchiveEl) {
        emptyArchiveEl.style.display = 'flex';
        completedTasksList.appendChild(emptyArchiveEl);
      }
      return;
    }

    completedTasks.forEach((task) => {
      const taskItem = document.createElement('div');
      taskItem.className = `task-item completed`;
      taskItem.id = task.id;

      const categoryText = {
        work: '🏢 العمل',
        personal: '🏠 شخصي',
        study: '📚 الدراسة',
        health: '💪 صحة ورياضة',
        other: '⚙️ أخرى'
      }[task.category] || '🏠 شخصي';

      taskItem.innerHTML = `
        <div class="task-item-top">
          <div class="task-item-content">
            <h3 class="task-item-title">${task.title}</h3>
            ${task.desc ? `<p class="task-item-desc">${task.desc}</p>` : ''}
            <div class="task-tags">
              <span class="tag tag-category">${categoryText}</span>
              <span class="tag tag-priority low"><i data-lucide="check-circle"></i> تم الإنجاز بنجاح</span>
            </div>
          </div>
          
          <div class="task-actions">
            <button class="task-btn delete-btn" onclick="deleteTask('${task.id}')" title="حذف نهائي">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
      `;

      completedTasksList.appendChild(taskItem);
    });

    safeCreateIcons();
  } catch (e) {
    console.error('Completed list render failure:', e);
  }
}

function updateStatistics(activeCount, completedCount) {
  try {
    if (statActiveCountEl) statActiveCountEl.textContent = activeCount.toString();
    if (statCompletedCountEl) statCompletedCountEl.textContent = completedCount.toString();
    if (statStreakCountEl) statStreakCountEl.textContent = streakCount.toString();

    const totalTasks = activeCount + completedCount;
    const ratio = totalTasks === 0 ? 0 : Math.round((completedCount / totalTasks) * 100);
    
    if (completionRatioEl) completionRatioEl.textContent = `${ratio}%`;

    if (progressCircle) {
      const offset = 314.159 - (ratio / 100) * 314.159;
      progressCircle.style.strokeDashoffset = offset.toString();
    }

    let levelName = 'مبتدئ ✨';
    let encouragementText = 'ابدأ يومك بنشاط وأضف مهامك لتصل للمستوى التالي! 🚀';

    if (completedCount > 30) {
      levelName = 'بطل الإنتاجية 👑';
      encouragementText = 'لا يصدق! أنت ماكينة إنجاز حقيقية، أداؤك أسطوري ومتميز جداً! 🔥';
    } else if (completedCount > 15) {
      levelName = 'منتج محترف 🏆';
      encouragementText = 'مذهل! أداؤك رائع، لقد أنجزت الكثير، واصل طريقك المتميز! 💪';
    } else if (completedCount > 5) {
      levelName = 'نشيط ⚡';
      encouragementText = 'تقدم ممتاز! أنت تتحرك بثبات وتركيز نحو إنجاز كافة أهدافك. 🌟';
    } else if (completedCount > 0) {
      levelName = 'مكافح 🎯';
      encouragementText = 'بداية رائعة! استمر في إنجاز بقية المهام لتزيد من شعلة إنجازاتك اليومية!';
    }

    if (performanceBadge) performanceBadge.textContent = levelName;
    if (encouragementBar) encouragementBar.textContent = encouragementText;
  } catch (e) {
    console.error('Stats rendering failure:', e);
  }
}
