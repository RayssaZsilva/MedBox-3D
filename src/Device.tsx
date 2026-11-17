import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei'
import { memo, useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, CatmullRomCurve3, Group, MathUtils, SRGBColorSpace, Vector3 } from 'three'
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

const slots = [-2.43, -0.81, 0.81, 2.43]
const lids = ['#a989e5', '#a284dc', '#9b79d8', '#9470d4']
const graphite = '#41384f'
const metal = '#b6bdc6'
const brass = '#cba360'
const ledWires = [[18, '#f4a845'], [19, '#df6568'], [17, '#a492ff'], [16, '#7ebdf2']] as const

function Block({ position, size, color, radius = 0, metalness = 0 }: {
  position: Point
  size: Point
  color: string
  radius?: number
  metalness?: number
}) {
  const material = <meshStandardMaterial color={color} roughness={0.47} metalness={metalness} />
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

function Label({ lines, position, size, front = false, color = '#fff', cursor = -1 }: {
  lines: string[]
  position: Point
  size: [number, number]
  front?: boolean
  color?: string
  cursor?: number
}) {
  const content = lines.join('\n')
  const texture = useMemo(() => {
    const rows = content.split('\n')
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const context = canvas.getContext('2d')!
    context.textBaseline = 'middle'
    context.fillStyle = color
    if (rows.length === 1) {
      context.textAlign = 'center'
      context.font = `700 ${content.length > 4 ? 65 : 102}px monospace`
      context.fillText(content, 256, 132, 475)
    } else {
      context.font = '700 44px monospace'
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
  }, [content, color, cursor])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh rotation={front ? [0, 0, 0] : [-Math.PI / 2, 0, 0]} position={position}>
    <planeGeometry args={size} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} />
  </mesh>
}

function Compartment({ index, open, onLid }: { index: number; open: boolean; onLid: () => void }) {
  const hinge = useRef<Group>(null)
  useFrame(({ invalidate }, delta) => {
    if (!hinge.current) return
    const rotation = hinge.current.rotation
    const target = open ? -1.88 : 0
    if (Math.abs(rotation.x - target) < 0.001) {
      rotation.x = target
      return
    }
    rotation.x = MathUtils.damp(rotation.x, target, 9, Math.min(delta, 0.05))
    invalidate()
  })

  return <group position={[slots[index], 0, 0]}>
    <Block position={[0, 0.21, -0.14]} size={[1.56, 0.12, 1.98]} color="#b4a0cc" radius={0.05} />
    {[-0.75, 0.75].map((x) => <Block key={x} position={[x, 0.48, -0.14]}
      size={[0.086, 0.52, 1.98]} color="#d6c7e7" radius={0.031} />)}
    {[-1.07, 0.79].map((z) => <Block key={z} position={[0, 0.48, z]}
      size={[1.54, 0.52, 0.12]} color="#d6c7e7" radius={0.04} />)}
    {[-0.55, 0.55].map((x) => <Cylinder key={x} position={[x, 0.76, -1.09]}
      rotation={[0, 0, Math.PI / 2]} radius={0.071} height={0.27} color={graphite} />)}
    <Cylinder position={[0, 0.76, -1.09]} rotation={[0, 0, Math.PI / 2]}
      radius={0.041} height={1.42} color={metal} metalness={0.55} />
    <group ref={hinge} position={[0, 0.76, -1.09]} onClick={(event) => { event.stopPropagation(); onLid() }}>
      <Block position={[0, 0.026, 0.925]} size={[1.57, 0.16, 1.94]} color={lids[index]} radius={0.074} />
      <Block position={[0, -0.04, 0.925]} size={[1.43, 0.12, 1.76]} color={lids[index]} radius={0.045} />
      <Block position={[0, 0, 1.9]} size={[0.50, 0.105, 0.18]} color="#ded0f2" radius={0.045} />
      <Label lines={[`0${index + 1}`]} position={[0, 0.109, 0.94]} size={[0.72, 0.40]} />
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

const buttonX = [0.55, 1.03, 1.55]
const buttonPins = ['33', '32', '26']
const buttonColors = ['#f4e173', '#e89cba', '#f39c63']

const Electronics = memo(function Electronics() {
  return <group name="Câmara eletrônica inferior">
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
        espPins[pin], [-1.04, -0.29, 0.08 + index * 0.10], [slots[index], -0.26, 0.72 + index * 0.06],
        [slots[index], -0.10, 1.12], [slots[index], 0.18, 1.22],
      ]} />)}
      {buttonPins.map((pin, index) => <Wire key={pin} color={buttonColors[index]} points={[
        espPins[pin], [-2.24, -0.31, 0.60 + index * 0.10], [buttonX[index], -0.30, 0.83 + index * 0.08],
        [buttonX[index], -0.16, 1.19],
      ]} />)}
      {(['21', '22'] as const).map((pin, index) => {
        const junction: Point = [-0.65 + index * 0.14, -0.23, 0.08]
        const color = index === 0 ? '#60d6b2' : '#76acff'
        return <group key={pin} name={index === 0 ? 'I²C SDA GPIO21' : 'I²C SCL GPIO22'}>
          <Wire color={color} points={[espPins[pin], [-1.04, -0.24, 0.08 + index * 0.12], junction]} />
          <Wire color={color} points={[junction, [-0.29, -0.28, -0.07], [0.13 + index * 0.09, -0.34, -0.24]]} />
          <Wire color={color} points={[junction, [-0.77 + index * 0.14, -0.28, 0.66], [-1.12 + index * 0.15, -0.17, 1.18]]} />
        </group>
      })}
      <Wire color="#d493ea" points={[espPins['25'], [-2.33, -0.28, -0.54], [-0.91, -0.26, -0.88], [1.16, -0.40, -0.43]]} />
      <Wire color="#dc6969" points={[espPins.power, [-2.25, -0.38, 0.66], [-0.22, -0.34, 0.51], [0.31, -0.35, -0.24]]} />
      <Wire color="#dc6969" points={[[-0.22, -0.34, 0.51], [-0.44, -0.33, 0.7], [-0.79, -0.15, 1.16]]} />
      <Wire color="#545873" points={[espPins.gnd, [-2.37, -0.40, 0.65], [-0.02, -0.40, 0.54], [1.28, -0.41, -0.42]]} />
      <Wire color="#545873" points={[[0.40, -0.35, -0.24], [0.47, -0.42, 0.22], [-0.02, -0.40, 0.54], [-0.62, -0.17, 1.16]]} />
      {slots.map((x, index) => <Wire key={x} color="#545873" points={[
        [-0.02, -0.40, 0.54], [x + 0.07, -0.34, 0.83 + index * 0.06],
        [x + 0.07, -0.18, 1.08], [x + 0.04, 0.17, 1.20],
      ]} />)}
      {buttonX.map((x, index) => <Wire key={x} color="#545873" points={[
        [-0.02, -0.40, 0.54], [x + 0.05, -0.36, 0.72 + index * 0.09], [x + 0.08, -0.20, 1.18],
      ]} />)}
    </group>
  </group>
})

function FrontPanel({ lcd, lcdCursor, onStep, okButton, pending }: DeviceProps) {
  return <group name="Painel frontal">
    <Block position={[0, -0.16, 1.23]} size={[6.60, 0.70, 0.17]} color="#625477" radius={0.07} />
    <Block position={[-0.82, -0.155, 1.327]} size={[1.72, 0.46, 0.084]} color="#282b31" radius={0.039} />
    <Block position={[-0.82, -0.155, 1.373]} size={[1.48, 0.34, 0.017]} color="#bedca2" radius={0.026} />
    <Label lines={lcd} cursor={lcdCursor} position={[-0.82, -0.155, 1.384]}
      size={[1.43, 0.31]} color="#25403a" front />
    {buttonX.map((x, index) => {
      const ok = index === 2
      return <group key={x} position={[x, -0.154, 1.36]}
        onClick={(event) => { event.stopPropagation(); if (!ok) onStep(index === 0 ? -1 : 1) }}
        onPointerDown={ok ? (event) => {
          if (event.nativeEvent.isPrimary && event.nativeEvent.button === 0) okButton.press()
        } : undefined}
        onPointerUp={ok ? (event) => {
          if (event.nativeEvent.isPrimary && event.nativeEvent.button === 0) okButton.release()
        } : undefined}
        onPointerCancel={ok ? okButton.cancel : undefined}
        onPointerOut={ok ? okButton.cancel : undefined}>
        <Block position={[0, 0, 0]} size={[0.34, 0.31, 0.10]} color={graphite} radius={0.051} />
        <group position={[0, 0, ok && okButton.pressed ? 0.04 : 0.067]}>
          <Block position={[0, 0, 0]} size={[0.27, 0.24, 0.08]} color="#a385d1" radius={0.046} />
          <Label lines={[['−', '+', 'OK'][index]]} position={[0, 0, 0.042]}
            size={[0.28, 0.26]} front />
        </group>
      </group>
    })}
    {slots.map((x, index) => <group key={x} position={[x, 0.17, 1.18]} name={`LED GPIO${ledWires[index][0]}`}>
      <Cylinder position={[0, 0.04, 0]} radius={0.091} height={0.047} color={graphite} />
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.061, 15, 10]} />
        <meshStandardMaterial color={pending[index] ? '#ffd48e' : '#87737b'}
          emissive={pending[index] ? '#ff962f' : '#000'} emissiveIntensity={1.3} roughness={0.22} />
      </mesh>
    </group>)}
  </group>
}

function Model(props: DeviceProps) {
  const tray = useRef<Group>(null)
  useFrame(({ invalidate }, delta) => {
    if (!tray.current) return
    const { position } = tray.current
    const y = props.internal ? 1.05 : 0
    const z = props.internal ? -1.35 : 0
    if (Math.abs(position.y - y) + Math.abs(position.z - z) < 0.002) {
      position.set(0, y, z)
      return
    }
    position.y = MathUtils.damp(position.y, y, 8, Math.min(delta, 0.05))
    position.z = MathUtils.damp(position.z, z, 8, Math.min(delta, 0.05))
    invalidate()
  })
  return <group>
    <Block position={[0, -0.55, 0]} size={[6.65, 0.19, 2.65]} color={graphite} radius={0.09} />
    {[-3.26, 3.26].map((x) => <Block key={x} position={[x, -0.13, 0]} size={[0.15, 0.68, 2.56]}
      color={graphite} radius={0.065} />)}
    <Block position={[0, -0.13, -1.22]} size={[6.53, 0.68, 0.145]} color={graphite} radius={0.06} />
    {props.internal && <Electronics />}
    <FrontPanel {...props} />
    <group ref={tray} name="Bandeja de medicamentos">
      <Block position={[0, 0.14, -0.12]} size={[6.51, 0.17, 2.22]} color="#9d84ba" radius={0.073} />
      {props.open.map((open, index) => <Compartment key={index} index={index} open={open}
        onLid={() => props.onLid(index)} />)}
    </group>
  </group>
}

export function Device(props: DeviceProps) {
  return <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ position: [4.1, 5.9, 10.25], fov: 42 }}
    fallback={<p className="webgl-fallback">A visualização 3D precisa de WebGL. Os controles continuam disponíveis.</p>}>
    <ambientLight intensity={1.3} />
    <directionalLight position={[-4, 8, 6]} intensity={2.0} color="#fff3ed" />
    <directionalLight position={[5, 3, -6]} intensity={1.05} color="#d8c6ff" />
    <Model {...props} />
    <ContactShadows frames={1} position={[0, -0.655, 0]} scale={13} resolution={256} blur={2.8} opacity={0.39} far={5} />
    <OrbitControls target={[0, 0.34, -0.32]} enablePan={false} minDistance={6} maxDistance={17}
      maxPolarAngle={Math.PI / 2.12} makeDefault />
  </Canvas>
}
