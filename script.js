let startTime;
let elapsedTime = 0;
let animationFrameId;
let isRunning = false;
let isListening = false;
let wakeLock = null;
let lastHandledCommand = '';
let lastHandledAt = 0;
let listeningTimeout = null;
let restartTimeout = null;
let shouldKeepListening = false;
let lastRenderedTime = '';

const COMMAND_COOLDOWN_MS = 1200;
const LISTEN_WINDOW_MS = 5000;
const THEME_STORAGE_KEY = 'voice-timer-theme';
const HANDS_FREE_STORAGE_KEY = 'voice-timer-hands-free';

const displayMinutes = document.getElementById('minutes');
const displaySeconds = document.getElementById('seconds');
const displayMilliseconds = document.getElementById('milliseconds');
const startStopBtn = document.getElementById('startStopBtn');
const resetBtn = document.getElementById('resetBtn');
const btnText = document.getElementById('btnText');
const btnIcon = document.getElementById('btnIcon');
const appCard = document.getElementById('appCard');
const debugTranscript = document.getElementById('debugTranscript');
const handsFreeToggle = document.getElementById('handsFreeToggle');
const themeToggle = document.getElementById('themeToggle');
const themePanel = document.getElementById('themePanel');
const themeOptions = document.querySelectorAll('.theme-option');

const playIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const pauseIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

function formatTime(time) {
    const diffInMin = time / (1000 * 60);
    const minutes = Math.floor(diffInMin);
    const diffInSec = (diffInMin - minutes) * 60;
    const seconds = Math.floor(diffInSec);
    const diffInMs = (diffInSec - seconds) * 100;
    const milliseconds = Math.floor(diffInMs);

    return {
        m: minutes.toString().padStart(2, '0'),
        s: seconds.toString().padStart(2, '0'),
        ms: milliseconds.toString().padStart(2, '0')
    };
}

function print(time) {
    const formatted = formatTime(time);
    const nextRenderedTime = `${formatted.m}:${formatted.s}.${formatted.ms}`;

    if (nextRenderedTime === lastRenderedTime) {
        return;
    }

    lastRenderedTime = nextRenderedTime;
    displayMinutes.innerText = formatted.m;
    displaySeconds.innerText = formatted.s;
    displayMilliseconds.innerText = formatted.ms;
}

function tick() {
    elapsedTime = Date.now() - startTime;
    print(elapsedTime);

    if (isRunning) {
        animationFrameId = requestAnimationFrame(tick);
    }
}

function showStart() {
    btnText.innerText = 'Başlat';
    btnIcon.innerHTML = playIcon;
    startStopBtn.classList.remove('btn-danger');
    startStopBtn.classList.add('btn-primary');
}

function showStop() {
    btnText.innerText = 'Durdur';
    btnIcon.innerHTML = pauseIcon;
    startStopBtn.classList.remove('btn-primary');
    startStopBtn.classList.add('btn-danger');
}

function start() {
    if (isRunning) return;

    startTime = Date.now() - elapsedTime;
    showStop();
    isRunning = true;
    appCard.classList.add('running');
    animationFrameId = requestAnimationFrame(tick);
}

function stop() {
    if (!isRunning) return;

    cancelAnimationFrame(animationFrameId);
    showStart();
    isRunning = false;
    appCard.classList.remove('running');
}

function reset() {
    stop();
    elapsedTime = 0;
    lastRenderedTime = '';
    print(elapsedTime);
}

function normalizeTranscript(value) {
    return value
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function detectCommand(normalizedTranscript) {
    const startPatterns = ['bas', 'basla', 'baslat'];
    const stopPatterns = ['dur', 'durdur', 'bitir', 'bitti', 'bekle'];
    const resetPatterns = ['sifirla', 'sifirla tekrar', 'sil bastan'];

    if (startPatterns.some((pattern) => normalizedTranscript.includes(pattern))) {
        return 'start';
    }

    if (stopPatterns.some((pattern) => normalizedTranscript.includes(pattern))) {
        return 'stop';
    }

    if (resetPatterns.some((pattern) => normalizedTranscript.includes(pattern))) {
        return 'reset';
    }

    return '';
}

function handleVoiceCommand(command) {
    const now = Date.now();
    if (!command) return;

    if (lastHandledCommand === command && now - lastHandledAt < COMMAND_COOLDOWN_MS) {
        return;
    }

    lastHandledCommand = command;
    lastHandledAt = now;

    if (command === 'start') {
        start();
        return;
    }

    if (command === 'stop') {
        stop();
        return;
    }

    if (command === 'reset') {
        reset();
    }
}

async function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock !== null) {
        return;
    }

    try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
            wakeLock = null;
        });
    } catch (error) {
        console.error('Wake Lock hatası:', error);
    }
}

async function releaseWakeLock() {
    if (wakeLock === null) {
        return;
    }

    try {
        await wakeLock.release();
    } catch (error) {
        console.error('Wake Lock bırakılırken hata oluştu:', error);
    } finally {
        wakeLock = null;
    }
}

function clearListeningTimeout() {
    if (listeningTimeout !== null) {
        clearTimeout(listeningTimeout);
        listeningTimeout = null;
    }
}

function clearRestartTimeout() {
    if (restartTimeout !== null) {
        clearTimeout(restartTimeout);
        restartTimeout = null;
    }
}

function applyTheme(themeName) {
    document.body.dataset.theme = themeName;
    localStorage.setItem(THEME_STORAGE_KEY, themeName);

    themeOptions.forEach((option) => {
        option.classList.toggle('active', option.dataset.theme === themeName);
    });
}

function toggleThemePanel() {
    themePanel.classList.toggle('open');
}

function isHandsFreeEnabled() {
    return handsFreeToggle.checked;
}

function persistHandsFreeMode() {
    localStorage.setItem(HANDS_FREE_STORAGE_KEY, isHandsFreeEnabled() ? 'true' : 'false');
}

startStopBtn.addEventListener('click', () => {
    if (isRunning) {
        stop();
    } else {
        start();
    }
});

resetBtn.addEventListener('click', reset);
print(elapsedTime);

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'aurora';
applyTheme(savedTheme);

const savedHandsFreeMode = localStorage.getItem(HANDS_FREE_STORAGE_KEY);
handsFreeToggle.checked = savedHandsFreeMode !== 'false';
persistHandsFreeMode();

themeToggle.addEventListener('click', () => {
    toggleThemePanel();
});

themeOptions.forEach((option) => {
    option.addEventListener('click', () => {
        applyTheme(option.dataset.theme);
        themePanel.classList.remove('open');
    });
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('#themeSwitcher')) {
        themePanel.classList.remove('open');
    }
});

handsFreeToggle.addEventListener('change', () => {
    persistHandsFreeMode();

    if (isHandsFreeEnabled()) {
        if (!isListening && !shouldKeepListening) {
            startListening();
        }
        return;
    }

    if (isListening || shouldKeepListening) {
        stopListening('Tek komut modu');
    }
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
        isListening = true;
        requestWakeLock();
        clearListeningTimeout();
        clearRestartTimeout();

        if (!isHandsFreeEnabled()) {
            listeningTimeout = setTimeout(() => {
                if (isListening) {
                    stopListening('Zaman aşımı');
                }
            }, LISTEN_WINDOW_MS);
        }
    };

    recognition.onresult = (event) => {
        let transcript = '';

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
            transcript += event.results[index][0].transcript;
        }

        const rawTranscript = transcript.trim();
        const normalizedTranscript = normalizeTranscript(rawTranscript);
        const detectedCommand = detectCommand(normalizedTranscript);

        if (debugTranscript) {
            debugTranscript.innerText = rawTranscript ? `Duyulan: "${rawTranscript}"` : '';
        }

        if (event.results[event.results.length - 1].isFinal || detectedCommand) {
            handleVoiceCommand(detectedCommand);

            if (!isHandsFreeEnabled()) {
                stopListening(detectedCommand ? '' : 'Komut anlaşılamadı');
            }
        }
    };

    recognition.onerror = (event) => {
        console.warn('Konuşma tanıma hatası:', event.error);

        if (event.error === 'not-allowed') {
            alert('Mikrofon erişimine izin verilmedi.');
            stopListening('Mikrofon izni yok', true);
            return;
        }

        if (event.error === 'no-speech') {
            stopListening('Ses algılanmadı', true);
            return;
        }

        if (event.error === 'audio-capture') {
            stopListening('Mikrofon bulunamadı', true);
            return;
        }

        stopListening('Hata oluştu', true);
    };

    recognition.onend = () => {
        clearListeningTimeout();
        isListening = false;

        if (shouldKeepListening && isHandsFreeEnabled()) {
            clearRestartTimeout();
            restartTimeout = setTimeout(() => {
                startListening(true);
            }, 250);
            return;
        }

        releaseWakeLock();
    };

    function startListening(isRestart = false) {
        try {
            recognition.continuous = isHandsFreeEnabled();
            shouldKeepListening = true;
            recognition.start();
            if (debugTranscript) {
                debugTranscript.innerText = isHandsFreeEnabled()
                    ? 'Eller serbest mod açık. Komutları söyleyebilirsiniz.'
                    : 'Dinleniyor... Tek bir komut söyleyin.';
            }
        } catch (error) {
            if (error.name !== 'InvalidStateError') {
                console.error('Dinleme başlatılamadı:', error);
                shouldKeepListening = false;
                if (debugTranscript) {
                    debugTranscript.innerText = 'Sesli kontrol başlatılamadı.';
                }
            } else if (isRestart) {
                restartTimeout = setTimeout(() => {
                    startListening(true);
                }, 350);
            }
        }
    }

    function stopListening(message = '', isError = false) {
        const wasListening = isListening;
        shouldKeepListening = false;
        isListening = false;
        clearListeningTimeout();
        clearRestartTimeout();

        if (wasListening) {
            recognition.stop();
        }

        if (debugTranscript) {
            debugTranscript.innerText = isError ? message : '';
        }

        releaseWakeLock();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isListening) {
            requestWakeLock();
        }
    });

    if (isHandsFreeEnabled()) {
        startListening();
    }
}
 else {
    if (debugTranscript) {
        debugTranscript.innerText = 'Tarayıcı ses desteği sunmuyor.';
    }
    handsFreeToggle.checked = false;
    handsFreeToggle.disabled = true;
}
