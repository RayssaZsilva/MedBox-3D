import { useEffect, useReducer, useRef, useState } from 'react'
import { Device } from './Device'
import {
  CONFIRMATION_MS, CONFIRMATIONS_KEY, confirmationQueue, formatClock, initialClock, MINUTE, nextDoseTime,
  parseConfirmations, parseSchedule, STORAGE_KEY, updateClock, updateMenu,
} from './medbox'
import type { MenuState } from './medbox'
import { useOkButton } from './useOkButton'

function readSchedule() {
  try {
    return parseSchedule(localStorage.getItem(STORAGE_KEY))
  } catch {
    return parseSchedule(null)
  }
}

function readConfirmations() {
  try {
    return parseConfirmations(localStorage.getItem(CONFIRMATIONS_KEY))
  } catch {
    return {}
  }
}

function playAlarm(context: AudioContext, output: AudioNode) {
  const start = context.currentTime
  for (const [offset, frequency] of [[0, 880], [0.24, 1046], [0.48, 880]]) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const time = start + offset
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(0.12, time + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.17)
    oscillator.connect(gain).connect(output)
    oscillator.start(time)
    oscillator.stop(time + 0.18)
  }
}

export function App() {
  const [menu, menuDispatch] = useReducer(updateMenu, null, (): MenuState => ({
    ...readSchedule(),
    selected: 0,
    mode: { kind: 'normal' },
  }))
  const { times, order, selected, mode } = menu
  const previousTimes = useRef(times)
  const [clock, dispatch] = useReducer(updateClock, times, (saved) =>
    initialClock(Date.now(), saved, readConfirmations()))
  const [confirmation, setConfirmation] = useState<number | null>(null)
  const [open, setOpen] = useState(() => times.map(() => false))
  const [internal, setInternal] = useState(false)
  const [sound, setSound] = useState(false)
  const [note, setNote] = useState('')
  const audio = useRef<AudioContext | null>(null)
  const queue = confirmationQueue(clock.pending, order)
  const currentDose = queue[0]
  const active = queue.length > 0
  const displayedDose = mode.kind === 'normal' ? currentDose ?? selected : selected
  const clockText = formatClock(clock.now)

  useEffect(() => {
    if (clock.test) return
    const tick = () => dispatch({ type: 'tick', value: Date.now(), times })
    const interval = window.setInterval(tick, 250)
    return () => window.clearInterval(interval)
  }, [clock.test, times])

  useEffect(() => {
    if (!sound || !active || !audio.current) return
    const context = audio.current
    const output = context.createGain()
    output.connect(context.destination)
    playAlarm(context, output)
    const interval = window.setInterval(() => playAlarm(context, output), 2600)
    return () => {
      output.disconnect()
      window.clearInterval(interval)
    }
  }, [active, sound])

  useEffect(() => () => { void audio.current?.close(); audio.current = null }, [])

  async function toggleSound() {
    try {
      if (sound) {
        await audio.current?.suspend()
        setSound(false)
      } else {
        audio.current ??= new AudioContext()
        await audio.current.resume()
        setSound(true)
      }
      setNote('')
    } catch {
      setNote('Não foi possível ativar o áudio neste navegador.')
    }
  }

  useEffect(() => {
    if (previousTimes.current === times) return
    previousTimes.current = times
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ times, order }))
      setNote('Horário salvo neste navegador.')
    } catch {
      setNote('Horário atualizado apenas nesta sessão.')
    }
  }, [times, order])

  useEffect(() => {
    if (!clock.lastConfirmation) return
    setConfirmation(clock.lastConfirmation.index)
    try {
      localStorage.setItem(CONFIRMATIONS_KEY, JSON.stringify(clock.confirmed))
    } catch {
      // The reducer still retains confirmations for this session.
    }
    const timer = window.setTimeout(() => setConfirmation(null), CONFIRMATION_MS)
    return () => window.clearTimeout(timer)
  }, [clock.confirmed, clock.lastConfirmation])

  function confirmDose(index?: number) {
    dispatch(index === undefined ? { type: 'confirm-next', order } : { type: 'confirm', index })
  }

  function select(index: number) {
    if (mode.kind !== 'normal') setConfirmation(null)
    menuDispatch({ type: 'select', index })
    setNote('')
  }

  function move(step: 1 | -1) {
    if (mode.kind !== 'normal') setConfirmation(null)
    menuDispatch({ type: 'move', step })
  }

  function shortOk() {
    if (mode.kind === 'normal') {
      confirmDose()
      return
    }
    setConfirmation(null)
    menuDispatch({ type: 'ok' })
  }

  const okButton = useOkButton(shortOk, () => {
    if (mode.kind !== 'normal') return
    setConfirmation(null)
    setNote('')
    menuDispatch({ type: 'hold-ok' })
  })

  function toggleLid(index: number) {
    setOpen((current) => current.map((value, slot) => slot === index ? !value : value))
  }

  function advance(minutes: number) {
    dispatch({ type: 'advance', value: minutes * MINUTE, times })
  }

  function nextAlarm() {
    const next = nextDoseTime(clock.now, times, clock.confirmed)
    dispatch({ type: 'advance', value: next - clock.now, times })
  }

  const digitIndex = confirmation === null && mode.kind === 'digito' ? 6 + [0, 1, 3, 4][mode.digit] : -1
  const lcdTop = confirmation !== null ? 'MEDICAMENTO OK' : {
    normal: `DOSE 0${displayedDose + 1}   ${active ? 'ALERTA' : 'PRONTO'}`,
    selecionar: `SELECIONE DOSE ${selected + 1}`,
    digito: `AJUSTAR DOSE 0${selected + 1}`,
  }[mode.kind]
  const lcdBottom = confirmation !== null
    ? `COMPARTIMENTO ${confirmation + 1}`
    : `HORA  ${mode.kind === 'digito' ? mode.draft : times[displayedDose]}`
  const help = {
    normal: 'Segure OK por 3 s para configurar · Toque para confirmar a primeira dose da fila',
    selecionar: '+/− seleciona a dose · OK edita o horário',
    digito: mode.kind === 'digito'
      ? `Dígito ${mode.digit + 1} de 4 · +/− altera · OK ${mode.digit === 3 ? 'salva' : 'avança'}`
      : '',
  }[mode.kind]

  return <div className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-icon" aria-hidden="true">✚</span><div><strong>MEDBOX</strong><small>SIMULADOR VIRTUAL 3D</small></div><span className="version">1.0</span></div>
      <button className="sound" aria-pressed={sound} onClick={() => void toggleSound()}><span className={sound ? 'dot on' : 'dot'} />{sound ? 'Som ativado' : 'Ativar som'}</button>
    </header>
    <main>
      <div className="intro">
        <div><h1>Simulador MEDBOX<span>.</span></h1><p>Programe seus horários e teste os alertas da caixa de medicamentos.</p></div>
        <div className="clock"><span>{clock.test ? 'RELÓGIO DE TESTE' : 'HORÁRIO ATUAL'}</span><time>{clockText}</time></div>
      </div>
      <div className="workspace">
        <section className="card scene-card" aria-labelledby="scene-title">
          <div className="card-head"><div><h2 id="scene-title">Dispositivo 3D</h2><p>Explore a caixa e seus componentes.</p></div>
            <div className="segments" aria-label="Vista do dispositivo">
              <button aria-pressed={!internal} onClick={() => setInternal(false)}>Externa</button>
              <button aria-pressed={internal} onClick={() => setInternal(true)}>Interna</button>
            </div>
          </div>
          <div className="scene">
            <Device open={open} pending={clock.pending.map(Boolean)} internal={internal} onLid={toggleLid}
              lcd={[lcdTop, lcdBottom]} lcdCursor={digitIndex} onStep={move} okButton={okButton} />
            <span className="scene-hint">{internal ? 'Bandeja articulada · Câmara inferior' : 'Arraste para girar · Role ou pince para ampliar'}</span>
          </div>
          <div className="lid-controls">{open.map((isOpen, index) => <button key={index}
            aria-pressed={isOpen} onClick={() => toggleLid(index)}>
            <span>0{index + 1}</span> {isOpen ? 'Aberta' : 'Fechada'}
          </button>)}</div>
          {internal && <p className="wiring-note">
            ESP32 · DS1307 · Buzzer GPIO25 · I²C SDA 21 / SCL 22<br />
            LEDs 18 / 19 / 17 / 16 · Botões + 32 / − 33 / OK 26
          </p>}
        </section>
        <section className="card panel" aria-labelledby="panel-title">
          <div className="card-head"><div><h2 id="panel-title">Painel de controle</h2><p>Configure o horário de cada dose.</p></div></div>
          <div className="console">
            <div className="lcd" aria-label="LCD de 16 colunas e 2 linhas">
              <div>{lcdTop.padEnd(16)}</div>
              <div>{lcdBottom.padEnd(16).split('').map((character, index) =>
                <span key={index} className={index === digitIndex ? 'cursor' : undefined}>{character}</span>)}</div>
            </div>
            <div className="keys">
              <button aria-label="Menos" onClick={() => move(-1)}>−</button>
              <button aria-label="Mais" onClick={() => move(1)}>+</button>
              <button className="ok" data-pressed={okButton.pressed} aria-describedby="panel-help"
                onPointerDown={(event) => { if (event.isPrimary && event.button === 0) okButton.press() }}
                onPointerUp={(event) => { if (event.isPrimary && event.button === 0) okButton.release() }}
                onPointerLeave={okButton.cancel} onPointerCancel={okButton.cancel} onBlur={okButton.cancel}
                onKeyDown={(event) => {
                  if (event.key !== ' ' && event.key !== 'Enter') return
                  event.preventDefault()
                  if (!event.repeat) okButton.press()
                }}
                onKeyUp={(event) => {
                  if (event.key !== ' ' && event.key !== 'Enter') return
                  event.preventDefault()
                  okButton.release()
                }}
                onClick={(event) => { if (event.detail === 0) shortOk() }}>OK</button>
            </div>
          </div>
          <div className="panel-help" id="panel-help">{help}
            {mode.kind !== 'normal' && <button className="link-button" onClick={() => menuDispatch({ type: 'cancel' })}>Cancelar</button>}
          </div>
          <div className="test-controls">
            <div className="test-head"><div><h3>Modo de teste</h3><p>Avance o relógio virtual e simule alertas.</p></div>
              <button className="switch" role="switch" aria-label="Modo de teste" aria-checked={clock.test}
                onClick={() => dispatch({ type: 'toggle', now: Date.now() })}><span /></button>
            </div>
            {clock.test && <div className="advance"><button onClick={() => advance(1)}>+1 min</button><button onClick={() => advance(60)}>+1 h</button><button onClick={nextAlarm}>Próximo alerta</button></div>}
          </div>
        </section>
      </div>
      <section className="schedule" aria-labelledby="schedule-title">
        <div className="schedule-head"><div><h2 id="schedule-title">Horários dos medicamentos</h2><p>Selecione uma dose no menu de configuração ou confirme quando o LED acender.</p></div>
          <p className="feedback" role="status">{note || (active ? `${queue.length} dose(s) aguardando confirmação` : '')}</p>
        </div>
        <div className="schedule-grid">{times.map((time, index) => <article key={index} className={`dose ${displayedDose === index ? 'selected' : ''}`}>
          <button className="dose-select" aria-pressed={displayedDose === index} onClick={() => select(index)}>
            <span className="dose-label"><span className="number">0{index + 1}</span> Dose {index + 1}</span>
            <span className={`dot ${clock.pending[index] ? 'alert' : ''}`} aria-label={clock.pending[index] ? 'Alerta ativo' : 'Sem alerta'} />
            <strong>{time}</strong>
          </button>
          <button className="confirm" disabled={!clock.pending[index]} onClick={() => confirmDose(index)}>Confirmar dose {index + 1}</button>
        </article>)}</div>
      </section>
    </main>
  </div>
}
