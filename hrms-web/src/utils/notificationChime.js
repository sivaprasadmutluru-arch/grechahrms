/** A quiet, original two-note chime; no downloaded audio or media permissions. */
export function createNotificationChime(getConstructor = () => window.AudioContext || window.webkitAudioContext) {
  let context
  return {
    async unlock() {
      try {
        const Constructor = getConstructor()
        if (!Constructor) return false
        context ||= new Constructor()
        if (context.state === 'suspended') await context.resume()
        return context.state === 'running'
      } catch { return false }
    },
    play() {
      if (!context || context.state !== 'running') return false
      try {
        const start = context.currentTime
        for (const [offset, frequency] of [[0, 660], [0.22, 880]]) {
          const tone = context.createOscillator()
          const volume = context.createGain()
          tone.type = 'sine'
          tone.frequency.setValueAtTime(frequency, start + offset)
          volume.gain.setValueAtTime(0, start + offset)
          volume.gain.linearRampToValueAtTime(0.08, start + offset + 0.015)
          volume.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.32)
          tone.connect(volume)
          volume.connect(context.destination)
          tone.onended = () => { tone.disconnect(); volume.disconnect() }
          tone.start(start + offset)
          tone.stop(start + offset + 0.34)
        }
        return true
      } catch { return false }
    },
  }
}

export const notificationChime = createNotificationChime()

export function readSoundPreference(storage, userId) {
  try {
    const value = storage.getItem(`grecha.notificationSound:${userId}`)
    return value === 'on' || value === 'off' ? value : null
  } catch { return null }
}
