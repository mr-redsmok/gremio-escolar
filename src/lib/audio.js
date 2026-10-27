let contexto = null

function obterContexto() {
  if (typeof window === 'undefined') return null
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!contexto) contexto = new AudioCtx()
  if (contexto.state === 'suspended') {
    contexto.resume().catch(() => {})
  }
  return contexto
}

function tocar(frequencia, duracao = 0.08, tipo = 'sine', volume = 0.035) {
  const ctx = obterContexto()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = tipo
  osc.frequency.value = frequencia
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracao)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duracao)
}

export function tocarTecla() {
  tocar(880, 0.06, 'sine', 0.025)
}

export function tocarBranco() {
  tocar(620, 0.09, 'sine', 0.03)
}

export function tocarConfirmacao() {
  tocar(880, 0.1, 'sine', 0.04)
  setTimeout(() => tocar(1175, 0.14, 'sine', 0.04), 110)
}

export function tocarErro() {
  tocar(220, 0.18, 'square', 0.03)
}

export function tocarFim() {
  tocar(880, 0.12, 'sine', 0.04)
  setTimeout(() => tocar(1108, 0.12, 'sine', 0.04), 130)
  setTimeout(() => tocar(1318, 0.22, 'sine', 0.04), 260)
}
