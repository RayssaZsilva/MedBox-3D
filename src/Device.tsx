import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei'
import { memo, useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, CatmullRomCurve3, Group, MathUtils, PerspectiveCamera, SRGBColorSpace, Vector3 } from 'three'
import { caseSize, createHousing, createWell, deckHeight, hingeZ, lcdX, ledZ, panelAngle, panelZ } from './deviceGeometry'
import type { OkButton } from './useOkButton'

type Point = [number, number, number]

type DeviceProps = {
  open: boolean[]
  pending: boolean[]
  internal: boolean
  onLid: (index: number) => void
  lcd: [string, string]
  lcdCursor: number
  onStep: (step: 1 | -1) => void
  okButton: OkButton
}

const slots = [-2.37, -0.79, 0.79, 2.37]
const lids = ['#bd8cde', '#bc89dc', '#bc89dd', '#bf8ee0']
const graphite = '#443151'
const metal = '#b6bdc6'
const brass = '#cba360'
const ledWires = [[18, '#f4a845'], [19, '#df6568'], [17, '#a492ff'], [16, '#7ebdf2']] as const

function Block({ position, size, color, radius = 0, metalness = 0, roughness = 0.47 }: {
  position: Point
  size: Point
  color: string
  radius?: number
  metalness?: number
  roughness?: number
}) {
  const material = <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
  return radius ? <RoundedBox position={position} args={size} radius={radius} smoothness={2}>
    {material}
  </RoundedBox> : <mesh position={position}>
    <boxGeometry args={size} />
    {material}
  </mesh>
}

function Cylinder({ position, radius, height, color, rotation, metalness = 0 }: {
  position: Point
  radius: number
  height: number
  color: string
  rotation?: Point
  metalness?: number
}) {
  return <mesh position={position} rotation={rotation}>
    <cylinderGeometry args={[radius, radius, height, 20]} />
    <meshStandardMaterial color={color} roughness={0.4} metalness={metalness} />
  </mesh>
}

function Label({ lines, position, size, color = '#fff', cursor = -1, background }: {
  lines: string[]
  position: Point
  size: [number, number]
  color?: string
  cursor?: number
  background?: string
}) {
  const content = lines.join('\n')
  const texture = useMemo(() => {
    const rows = content.split('\n')
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const context = canvas.getContext('2d')!
    context.textBaseline = 'middle'
    if (background) {
      context.fillStyle = background
      context.fillRect(0, 0, 512, 256)
    }
    context.fillStyle = color
    if (rows.length === 1) {
      context.textAlign = 'center'
      context.font = `700 ${content.length > 4 ? 65 : 102}px monospace`
      context.fillText(content, 256, 132, 475)
    } else {
      context.font = '700 49px monospace'
      const cell = 28
      rows.forEach((row, line) => {
        const y = 78 + 99 * line
        for (const [index, char] of [...row].entries()) {
          const x = 32 + index * cell
          if (line === 1 && index === cursor) {
            context.fillStyle = color
            context.fillRect(x - 1, y - 25, cell, 50)
            context.fillStyle = '#d0e7ad'
          }
          context.fillText(char, x, y)
          context.fillStyle = color
        }
      })
    }
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    return map
  }, [content, color, cursor, background])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={position}>
    <planeGeometry args={size} />
    <meshBasicMaterial map={texture} transparent={!background} depthWrite={!!background} toneMapped={false} />
  </mesh>
}

function Compartment({ index, open, onLid }: { index: number; open: boolean; onLid: () => void }) {
  const hinge = useRef<Group>(null)
  const well = useMemo(createWell, [])
  useEffect(() => () => Object.values(well).forEach((geometry) => geometry.dispose()), [well])
  const hingeY = 0.74
  const hingeRotation: Point = [0, 0, Math.PI / 2]

  useFrame(({ invalidate }, delta) => {
    if (!hinge.current) return
    const rotation = hinge.current.rotation
    const target = open ? -MathUtils.degToRad(108) : 0
    if (Math.abs(rotation.x - target) < 0.001) {
      rotation.x = target
      return
    }
    rotation.x = MathUtils.damp(rotation.x, target, 9, Math.min(delta, 0.05))
    invalidate()
  })

  return <group name={`Compartimento 0${index + 1}`} position={[slots[index], 0, 0]}>
    {Object.entries(well).map(([part, geometry]) => <mesh key={part} geometry={geometry}>
      <meshStandardMaterial color="#dfccec" roughness={0.57} />
    </mesh>)}
    {[-0.37, 0.37].map((x) => <group key={x}>
      <Block position={[x, 0.67, hingeZ]} size={[0.24, 0.10, 0.19]} color={graphite} radius={0.035} />
      <Cylinder position={[x, hingeY, hingeZ]} rotation={hingeRotation}
        radius={0.090} height={0.24} color="#694482" />
    </group>)}
    <Cylinder position={[0, hingeY, hingeZ]} rotation={hingeRotation}
      radius={0.035} height={1.00} color={metal} metalness={0.52} />
    <group ref={hinge} name={`Tampa 0${index + 1}`} position={[0, hingeY, hingeZ]}
      onClick={(event) => { event.stopPropagation(); onLid() }}>
      <Cylinder position={[0, 0, 0]} rotation={hingeRotation} radius={0.087} height={0.50} color={lids[index]} />
      <Block position={[0, 0.035, 1.46]} size={[1.525, 0.21, 2.89]} color={lids[index]} radius={0.102} roughness={0.33} />
      <Block position={[0, -0.083, 1.46]} size={[1.35, 0.07, 2.72]} color="#a874c8" radius={0.033} />
      <Block position={[0, -0.008, 2.899]} size={[0.42, 0.12, 0.15]} color="#b37bd4" radius={0.057} />
      <Block position={[0, 0.141, 1.45]} size={[0.60, 0.012, 0.48]} color="#edcff4" radius={0.005} />
      <Label lines={[`0${index + 1}`]} position={[0, 0.149, 1.45]} size={[0.72, 0.56]} color="#5b287d" />
    </group>
  </group>
}

const espPins: Record<string, Point> = {
  '18': [-1.33, -0.35, -0.35], '19': [-1.33, -0.35, -0.25],
  '17': [-1.33, -0.35, -0.15], '16': [-1.33, -0.35, -0.05],
  '21': [-1.33, -0.35, 0.05], '22': [-1.33, -0.35, 0.15],
  '25': [-2.03, -0.35, -0.25], '26': [-2.03, -0.35, -0.15],
  '32': [-2.03, -0.35, -0.05], '33': [-2.03, -0.35, 0.05],
  gnd: [-2.03, -0.35, 0.25], power: [-2.03, -0.35, 0.35],
}

function Wire({ color, points }: { color: string; points: Point[] }) {
  const curve = useMemo(() => new CatmullRomCurve3(points.map((point) => new Vector3(...point))), [points])
  return <mesh>
    <tubeGeometry args={[curve, 30, 0.016, 6, false]} />
    <meshStandardMaterial color={color} roughness={0.6} />
  </mesh>
}

const buttonX = [0.56, 1.43, 2.30]
const buttonPins = ['33', '32', '26']
const buttonColors = ['#f4e173', '#e89cba', '#f39c63']

function panelLead(x: number): Point[] {
  return [[x, -0.32, 1.18], [x, -0.18, panelZ], [x, deckHeight(panelZ) - 0.105, panelZ]]
}

const Electronics = memo(function Electronics() {
  return <group name="Câmara eletrônica inferior">
    <group position={[0, deckHeight(panelZ), panelZ]} rotation={[panelAngle, 0, 0]}>
      <Block position={[lcdX, -0.13, 0]} size={[2.14, 0.08, 0.64]} color="#2b6751" radius={0.028} />
      {buttonX.map((x) => <Block key={x} position={[x, -0.13, 0]} size={[0.36, 0.09, 0.34]}
        color="#262334" radius={0.026} />)}
    </group>
    <group name="ESP32">
      <Block position={[-1.68, -0.45, -0.17]} size={[0.83, 0.06, 1.25]} color="#202933" radius={0.03} />
      <Block position={[-1.68, -0.39, -0.34]} size={[0.49, 0.08, 0.48]} color={metal} radius={0.025} metalness={0.4} />
      <Label lines={['ESP32']} position={[-1.68, -0.347, -0.34]} size={[0.48, 0.28]} color="#25303c" />
      <Block position={[-1.68, -0.39, 0.41]} size={[0.25, 0.10, 0.19]} color={metal} radius={0.018} metalness={0.55} />
      <Block position={[-1.68, -0.384, 0.49]} size={[0.16, 0.045, 0.025]} color="#20242b" />
      {[-2.03, -1.33].map((x) => <group key={x}>
        <Block position={[x, -0.398, 0]} size={[0.105, 0.06, 0.98]} color="#14171d" />
        {Array.from({ length: 9 }, (_, index) => <Cylinder key={index} position={[x, -0.355, -0.45 + 0.1 * index]}
          radius={0.019} height={0.06} color={brass} metalness={0.5} />)}
      </group>)}
    </group>
    <group name="RTC DS1307">
      <Block position={[-0.05, -0.44, -0.43]} size={[0.93, 0.07, 0.66]} color="#2b7971" radius={0.035} />
      <Cylinder position={[-0.20, -0.38, -0.43]} radius={0.235} height={0.084} color="#232934" />
      <Cylinder position={[-0.20, -0.33, -0.43]} radius={0.197} height={0.046} color={metal} metalness={0.65} />
      <Block position={[0.20, -0.37, -0.49]} size={[0.18, 0.065, 0.24]} color="#252a34" />
      <Label lines={['DS1307']} position={[-0.05, -0.38, -0.16]} size={[0.65, 0.19]} />
      {[0.13, 0.22, 0.31, 0.40].map((x) => <Cylinder key={x} position={[x, -0.37, -0.24]}
        radius={0.021} height={0.065} color={brass} metalness={0.5} />)}
    </group>
    <group name="Buzzer GPIO25">
      <Cylinder position={[1.21, -0.36, -0.42]} radius={0.29} height={0.22} color="#21222b" />
      <Cylinder position={[1.21, -0.246, -0.42]} radius={0.07} height={0.01} color="#0b0d13" />
      <Label lines={['BUZZER']} position={[1.21, -0.249, -0.76]} size={[0.72, 0.24]} color="#ede5f5" />
    </group>
    <group name="Chicote de sinais">
      {ledWires.map(([pin, color], index) => <Wire key={pin} color={color} points={[
        espPins[pin], [-1.04, -0.29, 0.08 + index * 0.10], [slots[index], -0.30, 0.81 + index * 0.045],
        [slots[index], 0.16, ledZ], [slots[index], deckHeight(ledZ) - 0.055, ledZ],
      ]} />)}
      {buttonPins.map((pin, index) => <Wire key={pin} color={buttonColors[index]} points={[
        espPins[pin], [-2.24, -0.37, 0.40 + index * 0.08], [buttonX[index], -0.34, 0.73 + index * 0.09],
        ...panelLead(buttonX[index]),
      ]} />)}
      {(['21', '22'] as const).map((pin, index) => {
        const junction: Point = [-0.65 + index * 0.14, -0.23, 0.08]
        const color = index === 0 ? '#60d6b2' : '#76acff'
        return <group key={pin} name={index === 0 ? 'I²C SDA GPIO21' : 'I²C SCL GPIO22'}>
          <Wire color={color} points={[espPins[pin], [-1.04, -0.24, 0.08 + index * 0.12], junction]} />
          <Wire color={color} points={[junction, [-0.29, -0.28, -0.07], [0.13 + index * 0.09, -0.34, -0.24]]} />
          <Wire color={color} points={[junction, [-0.94 + index * 0.14, -0.32, 0.78], ...panelLead(lcdX - 0.26 + index * 0.14)]} />
        </group>
      })}
      <Wire color="#d493ea" points={[espPins['25'], [-2.33, -0.28, -0.54], [-0.91, -0.26, -0.88], [1.16, -0.40, -0.43]]} />
      <Wire color="#dc6969" points={[espPins.power, [-2.25, -0.38, 0.66], [-0.22, -0.34, 0.51], [0.31, -0.35, -0.24]]} />
      <Wire color="#dc6969" points={[[-0.22, -0.34, 0.51], [lcdX + 0.02, -0.36, 0.88], ...panelLead(lcdX + 0.02)]} />
      <Wire color="#545873" points={[espPins.gnd, [-2.37, -0.40, 0.65], [-0.02, -0.40, 0.54], [1.28, -0.41, -0.42]]} />
      <Wire color="#545873" points={[[0.40, -0.35, -0.24], [0.47, -0.42, 0.22], [-0.02, -0.40, 0.54], [lcdX + 0.16, -0.37, 0.92], ...panelLead(lcdX + 0.16)]} />
      {slots.map((x, index) => <Wire key={x} color="#545873" points={[
        [-0.02, -0.40, 0.54], [x + 0.07, -0.38, 0.79 + index * 0.045],
        [x + 0.07, 0.07, ledZ], [x + 0.05, deckHeight(ledZ) - 0.055, ledZ],
      ]} />)}
      {buttonX.map((x, index) => <Wire key={x} color="#545873" points={[
        [-0.02, -0.40, 0.54], [x + 0.05, -0.38, 0.74 + index * 0.075], ...panelLead(x + 0.08),
      ]} />)}
    </group>
  </group>
})

function Enclosure() {
  const housing = useMemo(createHousing, [])
  useEffect(() => () => Object.values(housing).forEach((geometry) => geometry.dispose()), [housing])
  return <group name="Corpo integrado">
    {Object.entries(housing).map(([part, geometry]) => <mesh key={part} geometry={geometry}>
      <meshStandardMaterial color={part === 'frontDeck' ? '#563969' : '#493057'}
        roughness={part === 'frontDeck' ? 0.47 : 0.39} />
    </mesh>)}
  </group>
}

function TopPanel({ lcd, lcdCursor, onStep, okButton }: DeviceProps) {
  return <group name="Painel superior frontal" position={[0, deckHeight(panelZ), panelZ]} rotation={[panelAngle, 0, 0]}>
    <Block position={[lcdX, -0.027, 0]} size={[2.30, 0.075, 0.75]} color="#232029" radius={0.036} />
    <Block position={[lcdX, 0.014, 0]} size={[2.11, 0.019, 0.60]} color="#a8c697" radius={0.009} />
    <Label lines={lcd} cursor={lcdCursor} position={[lcdX, 0.026, 0]}
      size={[1.99, 0.54]} color="#23442c" background="#bddea6" />
    {buttonX.map((x, index) => {
      const ok = index === 2
      return <group key={x} position={[x, 0, 0]} name={ok ? 'Botão OK' : undefined}>
        {/* The hit area stays fixed while the visible key moves on press. */}
        <mesh position={[0, 0.029, 0]}
          onClick={(event) => { event.stopPropagation(); if (!ok) onStep(index === 0 ? -1 : 1) }}
          onPointerDown={ok ? (event) => {
            if (event.nativeEvent.isPrimary && event.nativeEvent.button === 0) okButton.press()
          } : undefined}
          onPointerUp={ok ? (event) => {
            if (event.nativeEvent.isPrimary && event.nativeEvent.button === 0) okButton.release()
          } : undefined}
          onPointerCancel={ok ? okButton.cancel : undefined}
          onPointerOut={ok ? okButton.cancel : undefined}>
          <boxGeometry args={[0.65, 0.12, 0.49]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        <group position={[0, ok && okButton.pressed ? -0.005 : 0.029, 0]}>
          <Block position={[0, 0, 0]} size={[0.65, 0.12, 0.49]} color="#d59ce8" radius={0.057} roughness={0.30} />
          <Label lines={[['−', '+', 'OK'][index]]} position={[0, 0.062, 0]} size={[0.60, 0.54]} color="#3b2053" />
        </group>
      </group>
    })}
  </group>
}

function FrontLeds({ pending }: { pending: boolean[] }) {
  return <group name="LEDs frontais">
    {slots.map((x, index) => <group key={x} name={`LED GPIO${ledWires[index][0]}`}
      position={[x, deckHeight(ledZ), ledZ]} rotation={[panelAngle, 0, 0]}>
      <Block position={[0, 0.002, 0]} size={[0.19, 0.045, 0.095]} radius={0.022} color="#351d42" />
      <Block position={[0, 0.025, 0]} size={[0.142, 0.036, 0.064]} radius={0.017} color="#481629" roughness={0.23} />
      <mesh position={[0, 0.039, 0]}>
        <sphereGeometry args={[0.052, 18, 12]} />
        <meshStandardMaterial color={pending[index] ? '#ff5555' : '#722034'}
          emissive={pending[index] ? '#ff1622' : '#000000'} emissiveIntensity={pending[index] ? 2.2 : 0} roughness={0.22} />
      </mesh>
      {pending[index] && <pointLight color="#ff202b" intensity={0.10} distance={0.38} position={[0, 0.12, 0.015]} />}
    </group>)}
  </group>
}

const serviceHinge: Point = [0, 0.65, -1.99]

function Model(props: DeviceProps) {
  const tray = useRef<Group>(null)
  useFrame(({ invalidate }, delta) => {
    if (!tray.current) return
    const goal = props.internal ? -1.06 : 0
    if (Math.abs(tray.current.rotation.x - goal) < 0.001) {
      tray.current.rotation.x = goal
      return
    }
    tray.current.rotation.x = MathUtils.damp(tray.current.rotation.x, goal, 8, Math.min(delta, 0.05))
    invalidate()
  })
  return <group>
    <Enclosure />
    {props.internal && <Electronics />}
    <FrontLeds pending={props.pending} />
    <TopPanel {...props} />
    {[-2.99, 2.99].map((x) => <Cylinder key={x} position={[x, serviceHinge[1], serviceHinge[2] - 0.04]}
      radius={0.062} height={0.31} color={graphite} rotation={[0, 0, Math.PI / 2]} />)}
    <group ref={tray} position={serviceHinge} name="Bandeja articulada">
      <group position={[0, -serviceHinge[1], -serviceHinge[2]]}>
        <Block position={[0, 0.235, -0.542]} size={[6.23, 0.10, 2.84]} color="#795a8e" radius={0.045} />
        {[-2.99, 2.99].map((x) => <Block key={x} position={[x, 0.54, -1.94]} size={[0.21, 0.23, 0.19]}
          color={graphite} radius={0.035} />)}
        {props.open.map((open, index) => <Compartment key={index} index={index} open={open}
          onLid={() => props.onLid(index)} />)}
      </group>
    </group>
  </group>
}

function DeviceFraming({ expanded, internal }: { expanded: boolean; internal: boolean }) {
  useFrame(({ camera, size, invalidate }, delta) => {
    if (!(camera instanceof PerspectiveCamera)) return
    const compactViewport = Math.min(1, size.width / (size.height * 1.22))
    const zoom = compactViewport * (internal ? 0.80 : expanded ? 0.79 : 1)
    if (camera.zoom === zoom) return
    const next = MathUtils.damp(camera.zoom, zoom, 8, Math.min(delta, 0.05))
    camera.zoom = Math.abs(zoom - next) < 0.002 ? zoom : next
    camera.updateProjectionMatrix()
    if (camera.zoom !== zoom) invalidate()
  })
  return null
}

export function Device(props: DeviceProps) {
  return <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [-4.2, 7.4, 7.05], fov: 39 }}
    fallback={<p className="webgl-fallback">A visualização 3D precisa de WebGL. Os controles continuam disponíveis.</p>}>
    <ambientLight intensity={1.12} />
    <directionalLight position={[-4, 8, 6]} intensity={2.20} color="#fff3ed" />
    <directionalLight position={[5, 3, -6]} intensity={1.18} color="#d8c6ff" />
    <DeviceFraming expanded={props.open.some(Boolean)} internal={props.internal} />
    <Model {...props} />
    <ContactShadows frames={1} position={[0, caseSize.bottom - 0.01, 0]} scale={13} resolution={256} blur={2.8} opacity={0.51} far={5} />
    <OrbitControls target={[0, 0.29, 0.03]} enablePan={false} minDistance={6} maxDistance={17}
      maxPolarAngle={Math.PI / 2.12} makeDefault />
  </Canvas>
}
