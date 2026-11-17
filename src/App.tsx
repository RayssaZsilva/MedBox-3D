import { useEffect, useReducer, useRef, useState } from 'react'
import { Device } from './Device'
import { changeDigit, formatClock, initialClock, MINUTE, parseTimes, STORAGE_KEY, updateClock } from './medbox'

function readTimes() {
  try {
    return parseTimes(localStorage.getItem(STORAGE_KEY))
  } catch {
    return parseTimes(null)
  }
}

function playAlarm(context: AudioContext) {
  const start = context.currentTime
  for (const [offset, frequency] of [[0, 880], [0.24, 1046], [0.48, 880]]) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const time = start + offset
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.001, time)
    gain.gain.exponentialRampToValueAtTime(0.12, time + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.17)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(time)
    oscillator.stop(time + 0.18)
  }
}

export function App() {
  const [times, setTimes] = useState(readTimes)
  const [clock, dispatch] = useReducer(updateClock, times, (saved) => initialClock(Date.now(), saved))
  const [selected, setSelected] = useState(0)
  const [edit, setEdit] = useState<{ text: string; digit: number } | null>(null)
  const [open, setOpen] = useState(() => times.map(() => false))
  const [internal, setInternal] = useState(false)
  const [sound, setSound] = useState(false)
  const [note, setNote] = useState('')
  const audio = useRef<AudioContext | null>(null)
  const active = clock.pending.some(Boolean)
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
    playAlarm(context)
    const interval = window.setInterval(() => playAlarm(context), 2600)
    return () => window.clearInterval(interval)
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

  function select(index: number) {
    setSelected(index)
    setEdit(null)
    setNote('')
  }

  function move(step: 1 | -1) {
    if (edit) setEdit({ ...edit, text: changeDigit(edit.text, edit.digit, step) })
    else select((selected + step + times.length) % times.length)
  }

  function ok() {
    if (!edit) {
      setNote('')
      setEdit({ text: times[selected], digit: 0 })
      return
    }
    if (edit.digit < 3) {
      setEdit({ ...edit, digit: edit.digit + 1 })
      return
    }
    const next = times.map((time, index) => index === selected ? edit.text : time)
    setTimes(next)
    setEdit(null)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setNote('Horário salvo neste navegador.')
    } catch {
      setNote('Horário atualizado apenas nesta sessão.')
    }
  }

  function toggleLid(index: number) {
    setOpen((current) => current.map((value, slot) => slot === index ? !value : value))
  }

  function advance(minutes: number) {
    dispatch({ type: 'advance', value: minutes * MINUTE, times })
  }

  function nextAlarm() {
    const [hour, minute, second] = clockText.split(':').map(Number)
    const now = hour * 60 + minute
    const remaining = times.map((time) => {
      const [h, m] = time.split(':').map(Number)
      return (h * 60 + m - now + 1440) % 1440 || 1440
    })
    dispatch({ type: 'advance', value: Math.min(...remaining) * MINUTE - second * 1000, times })
  }

  const digitIndex = edit ? [0, 1, 3, 4][edit.digit] : -1
  const lcdTop = edit ? `AJUSTAR DOSE 0${selected + 1}` : `DOSE 0${selected + 1}   ${clock.pending[selected] ? 'ALERTA' : 'PRONTO'}`
  const lcdBottom = `HORA  ${edit?.text ?? times[selected]}`

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
            <Device open={open} pending={clock.pending} internal={internal} onLid={toggleLid}
              lcd={[lcdTop, lcdBottom]} onButton={(button) => button === 0 ? move(-1) : button === 1 ? move(1) : ok()} />
            <span className="scene-hint">Arraste para girar · Role ou pince para ampliar</span>
          </div>
          <div className="lid-controls">{open.map((isOpen, index) => <button key={index}
            aria-pressed={isOpen || internal} disabled={internal} onClick={() => toggleLid(index)}>
            <span>0{index + 1}</span> {isOpen || internal ? 'Aberta' : 'Fechada'}
          </button>)}</div>
        </section>
        <section className="card panel" aria-labelledby="panel-title">
          <div className="card-head"><div><h2 id="panel-title">Painel de controle</h2><p>Configure o horário de cada dose.</p></div></div>
          <div className="console">
            <div className="lcd" aria-label="LCD de 16 colunas e 2 linhas">
              <div>{lcdTop.padEnd(16)}</div>
              <div>{lcdBottom.padEnd(16).split('').map((character, index) =>
                <span key={index} className={index === 6 + digitIndex && edit ? 'cursor' : undefined}>{character}</span>)}</div>
            </div>
            <div className="keys">
              <button aria-label="Menos" onClick={() => move(-1)}>−</button>
              <button aria-label="Mais" onClick={() => move(1)}>+</button>
              <button className="ok" onClick={ok}>OK</button>
            </div>
          </div>
          <div className="panel-help">{edit ? `Dígito ${edit.digit + 1} de 4 · +/− altera · OK ${edit.digit === 3 ? 'salva' : 'avança'}` : '+/− seleciona a dose · OK edita o horário'}
            {edit && <button className="link-button" onClick={() => setEdit(null)}>Cancelar</button>}
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
        <div className="schedule-head"><div><h2 id="schedule-title">Horários dos medicamentos</h2><p>Selecione uma dose para editar ou confirme quando o LED acender.</p></div>
          <p className="feedback" role="status">{note || (active ? `${clock.pending.filter(Boolean).length} dose(s) aguardando confirmação` : '')}</p>
        </div>
        <div className="schedule-grid">{times.map((time, index) => <article key={index} className={`dose ${selected === index ? 'selected' : ''}`}>
          <button className="dose-select" aria-pressed={selected === index} onClick={() => select(index)}>
            <span className="dose-label"><span className="number">0{index + 1}</span> Dose {index + 1}</span>
            <span className={`dot ${clock.pending[index] ? 'alert' : ''}`} aria-label={clock.pending[index] ? 'Alerta ativo' : 'Sem alerta'} />
            <strong>{time}</strong>
          </button>
          <button className="confirm" disabled={!clock.pending[index]} onClick={() => dispatch({ type: 'confirm', index })}>Confirmar dose {index + 1}</button>
        </article>)}</div>
      </section>
    </main>
  </div>
}
