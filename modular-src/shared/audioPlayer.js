// ============================================================================
// shared/audioPlayer.js — the plain HTML5 <audio> controls used wherever the
// app plays a simple audio clip inline (Church Resources, By the Book,
// Core-D, and TW Bible Course sessions alike): play/pause, skip forward or
// back, the scrub bar, and the elapsed/total time display. Every function
// here is completely self-contained -- no imports, no cross-module state,
// just plain DOM element lookups by a shared id convention
// (audio-player-N / play-btn-N / progress-N / time-N) -- which is why this
// was a safe, simple extraction with none of the circular-dependency
// wrinkles the other shared/ modules needed.
// ============================================================================

export function togglePlay(i) {
  const audio = document.getElementById(`audio-player-${i}`);
  const btn = document.getElementById(`play-btn-${i}`);
  if (audio.paused) {
    audio.play();
    btn.textContent = '❚❚';
  } else {
    audio.pause();
    btn.textContent = '▶';
  }
}

export function resetPlayButton(i) {
  const btn = document.getElementById(`play-btn-${i}`);
  if (btn) btn.textContent = '▶';
}

export function skipAudio(elementId, seconds) {
  const audio = document.getElementById(elementId);
  if (audio) {
    audio.currentTime = Math.min(Math.max(audio.currentTime + seconds, 0), audio.duration);
  }
}

export function updateProgress(i) {
  const audio = document.getElementById(`audio-player-${i}`);
  const progress = document.getElementById(`progress-${i}`);
  const timeDisplay = document.getElementById(`time-${i}`);
  if (audio && audio.duration) {
    progress.value = (audio.currentTime / audio.duration) * 100;
    timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  }
}

export function seekAudio(i, value) {
  const audio = document.getElementById(`audio-player-${i}`);
  if (audio && audio.duration) {
    audio.currentTime = (value / 100) * audio.duration;
  }
}

export function initAudio(i) {
  const audio = document.getElementById(`audio-player-${i}`);
  const timeDisplay = document.getElementById(`time-${i}`);
  if (audio && audio.duration) {
    timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
  }
}

export function formatTime(seconds) {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}