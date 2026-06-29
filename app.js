// ==========================================================================
// 🎡 Roulette Wheel - Core Logic, 2D Rendering, Sound Synthesis, and Confetti
// ==========================================================================

const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');

// Device pixel ratio for crisp rendering on large projector screens
let dpr = window.devicePixelRatio || 1;

/**
 * Resizes the canvas backing store to match its on-screen (CSS) size,
 * multiplied by the device pixel ratio so the wheel stays sharp when
 * enlarged for a beam projector. Redraws afterwards.
 */
function resizeCanvas() {
  const cssSize = Math.min(canvas.clientWidth, canvas.clientHeight);
  if (cssSize <= 0) return;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  drawWheel();
}
const entryInput = document.getElementById('entryInput');
const entryCountDisplay = document.getElementById('entryCount');
const spinBtn = document.getElementById('spinBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const clearBtn = document.getElementById('clearBtn');
const wheelPointer = document.querySelector('.wheel-pointer');

// Winner Modal elements
const winnerModal = document.getElementById('winnerModal');
const winnerNameDisplay = document.getElementById('winnerName');
const removeWinnerBtn = document.getElementById('removeWinnerBtn');
const closeModalBtn = document.getElementById('closeModalBtn');

// Default initial list for demonstration (처음 로드 시 비어있도록 설정)
const defaultEntries = [];

let entries = [...defaultEntries];
let currentAngle = 0; // Current rotation angle in radians

// Spin physics variables
let isSpinning = false;
let spinVelocity = 0;
const friction = 0.984; // Micro-deceleration for smooth organic drag
const minVelocity = 0.0012; // Threshold to stop spinning
let lastWinnerIndex = null;
let lastSegment = 0; // Tracks slice segment crossings for tick sound synchronization

// Web Audio API Synthesis Context
let audioCtx = null;

/**
 * Initializes the AudioContext lazily on user gesture to conform to browser security
 */
function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

/**
 * Synthesizes a realistic 'Tick' sound using frequency modulation
 */
function playTickSound() {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(620, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.04);
  
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
  
  osc.start();
  osc.stop(audioCtx.currentTime + 0.04);
}

/**
 * Synthesizes a festive arpeggio chime for the winning announcement
 */
function playWinSound() {
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const notes = [261.63, 329.63, 392.00, 523.25];
  
  notes.forEach((freq, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + index * 0.08);
    
    gain.gain.setValueAtTime(0.12, now + index * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.28);
    
    osc.start(now + index * 0.08);
    osc.stop(now + index * 0.08 + 0.3);
  });
}

/**
 * Triggers visual click feedback animation on the pointer needle
 */
function triggerPointerTick() {
  wheelPointer.classList.remove('tick-anim');
  void wheelPointer.offsetWidth; // Force CSS reflow to restart animation
  wheelPointer.classList.add('tick-anim');
}

/**
 * Update the entries array from the textarea input,
 * and redraw the wheel.
 */
function updateEntriesFromInput() {
  if (isSpinning) return;
  
  const text = entryInput.value;
  entries = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  entryCountDisplay.textContent = entries.length;
  drawWheel();
}

/**
 * Draws the roulette wheel on the HTML5 Canvas
 */
function drawWheel() {
  // Logical (CSS-pixel) size; backing store is size * dpr for sharpness
  const size = Math.min(canvas.width, canvas.height) / dpr;
  const scale = size / 500; // 500 is the original design size; scale fonts/elements to match
  const center = size / 2;
  const radius = center - 10 * scale;

  // Reset transform and scale so we can draw in logical pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  if (entries.length === 0) {
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4 * scale;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = `${16 * scale}px Outfit, Noto Sans KR`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('주제를 입력해 주세요', center, center);
    return;
  }

  const arcSize = (2 * Math.PI) / entries.length;

  // 1. Draw slices
  for (let i = 0; i < entries.length; i++) {
    const angle = currentAngle + i * arcSize;
    const hue = (i * (360 / entries.length)) % 360;
    ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, angle, angle + arcSize);
    ctx.lineTo(center, center);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 2. Draw labels
  ctx.save();
  for (let i = 0; i < entries.length; i++) {
    const angle = currentAngle + i * arcSize;
    
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(angle + arcSize / 2);

    ctx.fillStyle = '#ffffff';
    let fontSize = 18;
    if (entries.length > 20) fontSize = 12;
    else if (entries.length > 12) fontSize = 14;
    fontSize *= scale;

    ctx.font = `bold ${fontSize}px Outfit, Noto Sans KR`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4 * scale;
    ctx.shadowOffsetX = 1 * scale;
    ctx.shadowOffsetY = 1 * scale;

    const textX = radius - 30 * scale;
    const maxTextWidth = radius * 0.6;
    
    let text = entries[i];
    if (ctx.measureText(text).width > maxTextWidth) {
      while (ctx.measureText(text + '...').width > maxTextWidth && text.length > 0) {
        text = text.slice(0, -1);
      }
      text += '...';
    }

    ctx.fillText(text, textX, 0);
    ctx.restore();
  }
  ctx.restore();

  // 3. Center Pin
  const pinOuter = 24 * scale;
  const pinInner = 12 * scale;
  ctx.beginPath();
  ctx.arc(center, center, pinOuter, 0, 2 * Math.PI);
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, pinOuter);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.3, '#cbd5e1');
  gradient.addColorStop(1, '#475569');
  ctx.fillStyle = gradient;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 10 * scale;
  ctx.shadowOffsetY = 4 * scale;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(center, center, pinInner, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f172a';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fill();
}

/**
 * Fisher-Yates Shuffle Algorithm to randomize array elements
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Handle shuffle button click
 */
function handleShuffle() {
  if (isSpinning || entries.length <= 1) return;
  shuffleArray(entries);
  entryInput.value = entries.join('\n');
  drawWheel();
}

/**
 * Handle clear button click
 */
function handleClear() {
  if (isSpinning) return;
  entryInput.value = '';
  updateEntriesFromInput();
}

/**
 * Initiates the wheel spinning physics animation
 */
function spinWheel() {
  if (isSpinning || entries.length === 0) return;

  initAudioContext();

  isSpinning = true;
  spinBtn.disabled = true;
  entryInput.disabled = true;
  shuffleBtn.disabled = true;
  clearBtn.disabled = true;

  // Set an initial randomized velocity
  spinVelocity = Math.random() * 0.16 + 0.24; // 0.24 ~ 0.40 radians per frame

  // Initialize tick tracking variables (aligned to 12 o'clock pointer)
  const arcSize = (2 * Math.PI) / entries.length;
  lastSegment = Math.floor((currentAngle + Math.PI / 2) / arcSize);

  animateWheel();
}

/**
 * Game loop for physics animation
 */
function animateWheel() {
  if (spinVelocity > minVelocity) {
    currentAngle += spinVelocity;
    spinVelocity *= friction;

    currentAngle %= (2 * Math.PI);

    // Audio & Visual Tick synchronization (aligned to 12 o'clock pointer)
    const arcSize = (2 * Math.PI) / entries.length;
    const currentSegment = Math.floor((currentAngle + Math.PI / 2) / arcSize);
    
    if (currentSegment !== lastSegment) {
      playTickSound();
      triggerPointerTick();
      lastSegment = currentSegment;
    }

    drawWheel();
    requestAnimationFrame(animateWheel);
  } else {
    finishSpin();
  }
}

/**
 * Determine winner index based on final angle, then show modal
 */
function finishSpin() {
  isSpinning = false;
  
  // Calculate winner index (pointer points at top: 12 o'clock)
  const arcSize = (2 * Math.PI) / entries.length;
  let angleVal = (currentAngle + Math.PI / 2) % (2 * Math.PI);
  if (angleVal < 0) angleVal += 2 * Math.PI;

  const winnerIndex = Math.floor(entries.length - angleVal / arcSize) % entries.length;
  lastWinnerIndex = winnerIndex;
  
  const winner = entries[winnerIndex];

  spinBtn.disabled = false;
  entryInput.disabled = false;
  shuffleBtn.disabled = false;
  clearBtn.disabled = false;

  // Trigger celebration audio and confetti
  playWinSound();
  triggerCelebrationConfetti();

  showWinner(winner);
}

/**
 * Display the winning popup modal
 */
function showWinner(winnerName) {
  winnerNameDisplay.textContent = winnerName;
  winnerModal.classList.remove('hidden');
}

/**
 * Closes the winner modal
 */
function closeWinnerModal() {
  winnerModal.classList.add('hidden');
}

/**
 * Removes the last winner from the list and syncs textarea
 */
function removeLastWinner() {
  if (lastWinnerIndex !== null && lastWinnerIndex >= 0 && lastWinnerIndex < entries.length) {
    entries.splice(lastWinnerIndex, 1);
    entryInput.value = entries.join('\n');
    entryCountDisplay.textContent = entries.length;
    lastWinnerIndex = null;
    drawWheel();
  }
  closeWinnerModal();
}

/**
 * Triggers confetti blast using canvas-confetti library
 */
function triggerCelebrationConfetti() {
  if (typeof confetti === 'function') {
    // Left burst
    confetti({
      particleCount: 80,
      angle: 60,
      spread: 55,
      origin: { x: 0 }
    });
    // Right burst
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 55,
      origin: { x: 1 }
    });
  }
}

const presetSelect = document.getElementById('presetSelect');

const presets = {
  preset1: [
    '취미', '여행', '수련회', '꿈', '음식', '학교', '숲', '이상형', 
    '휴식', '건강', '운동', '영화', '스트레스', '추억', '정리', 
    '드라마', '책', '유튜브', '동물', '자유주제'
  ]
};

/**
 * Handle preset selection change
 */
function handlePresetChange() {
  if (isSpinning) return;
  const selectedPreset = presetSelect.value;
  if (selectedPreset && presets[selectedPreset]) {
    entries = [...presets[selectedPreset]];
    entryInput.value = entries.join('\n');
    entryCountDisplay.textContent = entries.length;
    drawWheel();
  }
}

const presentBtn = document.getElementById('presentBtn');
const exitPresentBtn = document.getElementById('exitPresentBtn');
const presentShuffleBtn = document.getElementById('presentShuffleBtn');

/**
 * Enters presentation mode: hides input panel, enlarges the wheel to fill
 * the screen, and tries to go fullscreen for beam projector display.
 */
function enterPresentationMode() {
  document.body.classList.add('presentation-mode');
  // Try fullscreen (ignored if the browser blocks it without a gesture)
  if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
  // Resize after layout has updated to the new larger wrapper
  requestAnimationFrame(resizeCanvas);
}

/**
 * Exits presentation mode and returns to the normal editing layout.
 */
function exitPresentationMode() {
  document.body.classList.remove('presentation-mode');
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  requestAnimationFrame(resizeCanvas);
}

/**
 * Initialize application
 */
function init() {
  entryInput.value = defaultEntries.join('\n');
  entryCountDisplay.textContent = defaultEntries.length;
  
  // Register event listeners
  entryInput.addEventListener('input', updateEntriesFromInput);
  shuffleBtn.addEventListener('click', handleShuffle);
  clearBtn.addEventListener('click', handleClear);
  spinBtn.addEventListener('click', spinWheel);
  presetSelect.addEventListener('change', handlePresetChange);

  // Winner modal event listeners
  removeWinnerBtn.addEventListener('click', removeLastWinner);
  closeModalBtn.addEventListener('click', closeWinnerModal);

  // Presentation (projector) mode listeners
  presentBtn.addEventListener('click', enterPresentationMode);
  exitPresentBtn.addEventListener('click', exitPresentationMode);
  presentShuffleBtn.addEventListener('click', handleShuffle);
  // ESC key also exits presentation mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('presentation-mode')) {
      exitPresentationMode();
    }
  });

  // Keep the canvas resolution in sync with its on-screen size
  window.addEventListener('resize', resizeCanvas);

  // Warm-up AudioContext on document body click
  document.body.addEventListener('click', initAudioContext, { once: true });

  resizeCanvas();
}

// Start Application
init();
