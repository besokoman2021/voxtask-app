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

// Request native push notification permission from the user
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      console.log('Notification permission status:', permission);
    });
  }
}

// Show native push notification (Android-optimized with expanded text)
function showNotification(task) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  const cleanTitle = task.title.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "");
  
  const title = 'منظم الحياة - تذكير مهمة';
  const bodyText = 'حان الآن وقت: ' + cleanTitle + (task.desc ? '\n' + task.desc : '');
  
  const options = {
    body: bodyText,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    vibrate: [300, 150, 300, 150, 300],
    tag: 'life-reminder-' + task.id,
    renotify: true,
    silent: false,
    requireInteraction: true,
    actions: [
      { action: 'done', title: 'تم الإنجاز ✅' },
      { action: 'snooze', title: 'تأجيل 5 دقائق ⏰' }
    ]
  };
  
  // Use Service Worker for persistent notifications on Android
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, options);
      console.log('📱 SW Notification sent:', cleanTitle);
    }).catch(err => {
      console.warn('SW notification failed:', err);
      try { new Notification(title, options); } catch(e) {}
    });
  } else {
    try { new Notification(title, options); } catch(e) {}
  }
}

// Show in-app fullscreen alert popup (GUARANTEED to show on Android even without notification permission)
function showInAppAlert(task) {
  // Remove any existing alert first
  const existingAlert = document.getElementById('task-alert-overlay');
  if (existingAlert) existingAlert.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'task-alert-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(10px);
    z-index: 99999;
    display: flex; justify-content: center; align-items: center;
    padding: 20px;
    animation: fadeIn 0.3s ease;
  `;
  
  const card = document.createElement('div');
  card.style.cssText = `
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border: 2px solid rgba(14, 165, 233, 0.4);
    border-radius: 24px;
    padding: 32px 28px;
    max-width: 420px;
    width: 100%;
    text-align: center;
    color: white;
    box-shadow: 0 25px 60px rgba(14, 165, 233, 0.3);
    animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    direction: rtl;
  `;
  
  card.innerHTML = `
    <div style="font-size: 56px; margin-bottom: 16px;">🔔</div>
    <h2 style="font-size: 20px; font-weight: 800; color: #38bdf8; margin-bottom: 8px; line-height: 1.4;">
      تنبيه من منظم الحياة
    </h2>
    <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">حان وقت إنجاز مهمتك</p>
    <div style="
      background: rgba(14, 165, 233, 0.1);
      border: 1px solid rgba(14, 165, 233, 0.25);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
    ">
      <h3 style="font-size: 22px; font-weight: 800; color: white; margin-bottom: 8px; line-height: 1.5;">
        ${task.title}
      </h3>
      ${task.desc ? `<p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">${task.desc}</p>` : ''}
    </div>
    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
      <button id="alert-done-btn" style="
        flex: 1; min-width: 120px; padding: 14px 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white; border: none; border-radius: 12px;
        font-size: 15px; font-weight: 700; cursor: pointer;
        font-family: 'Cairo', sans-serif;
      ">تم الإنجاز ✅</button>
      <button id="alert-snooze-btn" style="
        flex: 1; min-width: 120px; padding: 14px 20px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white; border: none; border-radius: 12px;
        font-size: 15px; font-weight: 700; cursor: pointer;
        font-family: 'Cairo', sans-serif;
      ">تأجيل 5 دقائق ⏰</button>
    </div>
    <button id="alert-close-btn" style="
      margin-top: 16px; padding: 10px 24px;
      background: transparent; color: #64748b;
      border: 1px solid #334155; border-radius: 10px;
      font-size: 13px; cursor: pointer; width: 100%;
      font-family: 'Cairo', sans-serif;
    ">إغلاق التنبيه</button>
  `;
  
  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `;
  document.head.appendChild(style);
  
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  
  // Button handlers
  document.getElementById('alert-done-btn').addEventListener('click', () => {
    overlay.remove();
    completeTask(task.id);
  });
  
  document.getElementById('alert-snooze-btn').addEventListener('click', () => {
    overlay.remove();
    snoozeTask(task.id);
  });
  
  document.getElementById('alert-close-btn').addEventListener('click', () => {
    overlay.remove();
  });
}

// User-triggered test of the audio context & text-to-speech engine
function testSoundAndSpeech() {
  try {
    console.log('إطلاق اختبار الصوت والتنبيه الصوتي...');
    
    // Request permission if not already granted
    requestNotificationPermission();
    
    // 1. Play Synthesized offline chime
    playFallbackNotificationSound();
    
    // 2. Trigger a test push notification
    if ('Notification' in window && Notification.permission === 'granted') {
      showNotification({
        id: 'test_notification',
        title: 'تجربة الإشعارات المكتوبة',
        desc: 'هذا إشعار تجريبي من منظم الحياة للتأكيد على عمل النظام.'
      });
    }
    
    // 3. Show in-app alert as demo
    showInAppAlert({
      id: 'test_alert',
      title: 'هذا تنبيه تجريبي من منظم الحياة',
      desc: 'إذا ظهر هذا التنبيه فإن النظام يعمل بكفاءة تامة! اضغط إغلاق للمتابعة.'
    });
    
    // 4. Fire speech test
    speakText("تنبيه من منظم الحياة. تم تشغيل واختبار نظام التنبيه الصوتي والإشعارات بنجاح.", function() {
      if (!cachedArabicVoice) {
        setTimeout(() => {
          alert('💡 تلميح:\n\nلتفعيل نطق الكلمات بالعربية:\nافتح إعدادات هاتفك ← إمكانية الوصول ← تحويل النص إلى كلام ← اختر محرك Google ← نزّل اللغة العربية.');
        }, 500);
      }
    });
    
  } catch (e) {
    console.error('Test audio failed:', e);
    alert('فشل تشغيل الصوت: ' + e.message);
  }
}

/* ==========================================================================
   CENTRALIZED SPEECH ENGINE
   - Prioritizes Egyptian Arabic (ar-EG) male voices
   - Lower pitch for masculine sound
   - Slower rate for clearer Arabic reading
   ========================================================================== */

// Global voice cache - populated when browser finishes loading voices
let cachedVoices = [];
let cachedArabicVoice = null;

// Initialize voice cache immediately and on change
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  cachedVoices = window.speechSynthesis.getVoices();
  console.log('Loaded TTS voices count:', cachedVoices.length);
  
  // Find all Arabic voices
  const arabicVoices = cachedVoices.filter(v => v.lang.toLowerCase().startsWith('ar'));
  
  // Log all Arabic voices for debugging
  if (arabicVoices.length > 0) {
    console.log('🔍 Available Arabic voices:');
    arabicVoices.forEach(v => console.log(`   - "${v.name}" | lang: ${v.lang} | local: ${v.localService}`));
  }
  
  if (arabicVoices.length > 0) {
    // STEP 1: Look for Egyptian Arabic (ar-EG) voices first
    const egyptianVoices = arabicVoices.filter(v => v.lang.toLowerCase() === 'ar-eg');
    
    // STEP 2: Male voice keywords (covers Windows, macOS, Android, Chrome OS)
    const maleKeywords = [
      'naayf', 'maged', 'tarik',  // Apple/macOS male Arabic voices
      'hadi',                       // Google male Arabic voice
      'male',                       // Generic male tag
      'ahmad', 'ahmed',             // Common male Arabic voice names
      'omar', 'ali', 'youssef',    // Other possible male voice names
      'majed', 'fahad', 'khalid'   // Microsoft & Samsung male voices
    ];
    
    // Try to find a male Egyptian voice first (best case)
    let selectedVoice = null;
    
    if (egyptianVoices.length > 0) {
      const maleEgyptian = egyptianVoices.find(v => 
        maleKeywords.some(kw => v.name.toLowerCase().includes(kw))
      );
      if (maleEgyptian) {
        selectedVoice = maleEgyptian;
        console.log('✅ Male Egyptian Arabic voice found!', maleEgyptian.name);
      } else {
        // Use any Egyptian voice (even if female - better accent)
        selectedVoice = egyptianVoices[0];
        console.log('✅ Egyptian Arabic voice selected (accent priority):', selectedVoice.name);
      }
    }
    
    // If no Egyptian voice, try to find any male Arabic voice
    if (!selectedVoice) {
      const maleArabic = arabicVoices.find(v => 
        maleKeywords.some(kw => v.name.toLowerCase().includes(kw))
      );
      if (maleArabic) {
        selectedVoice = maleArabic;
        console.log('✅ Male Arabic voice found:', maleArabic.name, maleArabic.lang);
      }
    }
    
    // Last fallback: any Arabic voice
    if (!selectedVoice) {
      selectedVoice = arabicVoices[0];
      console.log('✅ Fallback Arabic voice selected:', selectedVoice.name, selectedVoice.lang);
    }
    
    cachedArabicVoice = selectedVoice;
  } else {
    cachedArabicVoice = null;
    console.warn('⚠️ No Arabic voice installed. Will use default system voice.');
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
    
    // CRITICAL: Always set voice and lang from our cached data
    if (cachedArabicVoice) {
      utterance.voice = cachedArabicVoice;
      utterance.lang = cachedArabicVoice.lang;
      // Lower pitch = deeper/masculine voice, slower rate = clearer Arabic reading
      utterance.rate = 0.85;
      utterance.pitch = 0.75;
      utterance.volume = 1.0;
      console.log('Speaking with Arabic voice:', cachedArabicVoice.name, '| pitch: 0.75 (masculine) | rate: 0.85 (clear)');
    } else {
      // No Arabic voice? Use default system voice
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.pitch = 0.8;
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
  // 1. Show native push notification (for lock screen / notification shade)
  showNotification(task);

  // 2. Show in-app fullscreen alert popup (GUARANTEED visible)
  showInAppAlert(task);

  // 3. Synthesize bell chime
  playFallbackNotificationSound();

  // 4. Play secondary local alarm sound if loaded
  try {
    if (alarmSound) {
      alarmSound.currentTime = 0;
      alarmSound.play().catch(e => console.warn("Local audio playback blocked:", e));
    }
  } catch (error) {
    console.warn("Could not play alarm:", error);
  }

  // 5. Speak the task name out loud
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
    
    // Request permission on task save
    requestNotificationPermission();

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
