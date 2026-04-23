let startTime;
let elapsedTime = 0;
let timerInterval;
let isRunning = false;

const displayMinutes = document.getElementById('minutes');
const displaySeconds = document.getElementById('seconds');
const displayMilliseconds = document.getElementById('milliseconds');
const startStopBtn = document.getElementById('startStopBtn');
const resetBtn = document.getElementById('resetBtn');
const btnText = document.getElementById('btnText');
const btnIcon = document.getElementById('btnIcon');
const appCard = document.getElementById('appCard');
const debugTranscript = document.getElementById('debugTranscript');

// Icons
const playIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const pauseIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

function formatTime(time) {
    let diffInMin = time / (1000 * 60);
    let m = Math.floor(diffInMin);

    let diffInSec = (diffInMin - m) * 60;
    let s = Math.floor(diffInSec);

    let diffInMs = (diffInSec - s) * 100;
    let ms = Math.floor(diffInMs);

    return {
        m: m.toString().padStart(2, '0'),
        s: s.toString().padStart(2, '0'),
        ms: ms.toString().padStart(2, '0')
    };
}

function print(time) {
    const formatted = formatTime(time);
    displayMinutes.innerText = formatted.m;
    displaySeconds.innerText = formatted.s;
    displayMilliseconds.innerText = formatted.ms;
}

function start() {
    if (isRunning) return;
    startTime = Date.now() - elapsedTime;
    timerInterval = setInterval(function printTime() {
        elapsedTime = Date.now() - startTime;
        print(elapsedTime);
    }, 10);
    showStop();
    isRunning = true;
    appCard.classList.add('running');
}

function stop() {
    if (!isRunning) return;
    clearInterval(timerInterval);
    showStart();
    isRunning = false;
    appCard.classList.remove('running');
}

function reset() {
    stop();
    elapsedTime = 0;
    print(elapsedTime);
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
    startStopBtn.classList.add('btn-danger');
    // Note: btn-danger isn't in CSS yet, let's add a style for it or keep it simple
}

startStopBtn.addEventListener('click', () => {
    if (isRunning) stop();
    else start();
});

resetBtn.addEventListener('click', reset);

// --- Voice Recognition ---
const voiceToggle = document.getElementById('voiceToggle');
const voiceStatusText = document.getElementById('voiceStatus');
let isListening = false;
let wakeLock = null;

// Screen Wake Lock Function
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Ekran Kilidi (Wake Lock) Aktif');
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.continuous = true;
    recognition.interimResults = true; // Anlık algılamayı açarak gecikmeyi sıfıra indiriyoruz

    recognition.onstart = () => {
        isListening = true;
        voiceToggle.classList.add('active');
        voiceStatusText.innerText = 'Sesli Kontrol: Aktif (Dinliyor)';
        requestWakeLock();
    };

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        transcript = transcript.toLowerCase().trim();
        console.log('Algılanan:', transcript);
        if (debugTranscript) debugTranscript.innerText = 'Duyulan: "' + transcript + '"';

        // Multiple variations for better detection
        if (transcript.includes('başla') || transcript.includes('başlat')) {
            start();
        } else if (transcript.includes('bitti') || transcript.includes('bitir') || transcript.includes('dur') || transcript.includes('durdur')) {
            stop();
        } else if (transcript.includes('sıfırla')) {
            reset();
        }
    };

    recognition.onerror = (event) => {
        console.warn('Konuşma Tanıma Hatası:', event.error);
        if (event.error === 'not-allowed') {
            alert('Mikrofon erişimine izin verilmedi.');
            stopListening();
        }
    };

    recognition.onend = () => {
        // Automatically restart if it was supposed to be listening
        if (isListening) {
            console.log('Bağlantı kesildi, yeniden bağlanıyor...');
            setTimeout(() => recognition.start(), 100);
        }
    };

    function startListening() {
        try {
            recognition.start();
        } catch (e) {
            console.error('Başlatma hatası:', e);
            // If already started, just ensure state is correct
            isListening = true;
            voiceToggle.classList.add('active');
        }
    }

    function stopListening() {
        isListening = false;
        recognition.stop();
        voiceToggle.classList.remove('active');
        voiceStatusText.innerText = 'Sesli Kontrol: Kapalı';
        
        if (wakeLock !== null) {
            wakeLock.release().then(() => {
                wakeLock = null;
            });
        }
    }

    voiceToggle.addEventListener('click', () => {
        if (isListening) stopListening();
        else startListening();
    });

} else {
    voiceStatusText.innerText = 'Tarayıcı Ses Desteklemiyor';
    voiceToggle.style.opacity = '0.5';
    voiceToggle.style.pointerEvents = 'none';
}
