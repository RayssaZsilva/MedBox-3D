import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Group, MathUtils, SRGBColorSpace } from 'three'

type DeviceProps = {
  open: boolean[]
  pending: boolean[]
  internal: boolean
  onLid: (index: number) => void
  lcd: [string, string]
  onButton: (index: number) => void
}

const purple = '#9a79db'
const lidColors = ['#a989e5', '#a284dc', '#9b79d8', '#9470d4']

function Block({ position, size, color, radius = 0.04 }: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  radius?: number
}) {
  return <RoundedBox position={position} args={size} radius={radius} smoothness={3}>
    <meshStandardMaterial color={color} roughness={0.46} />
  </RoundedBox>
}

function Label({ text, position, size, color = '#ffffff' }: {
  text: string
  position: [number, number, number]
  size: [number, number]
  color?: string
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const context = canvas.getContext('2d')!
    context.font = text.length > 4 ? '700 44px monospace' : '700 88px monospace'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = color
    context.fillText(text, 256, 132, 480)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    return map
  }, [text, color])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={position}>
    <planeGeometry args={size} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} />
  </mesh>
}

function Electronics() {
  return <group>
    <Block position={[0, 0.24, 0.25]} size={[1.16, 0.08, 1.28]} color="#276b5e" />
    <Block position={[0, 0.33, 0.2]} size={[0.37, 0.12, 0.4]} color="#29313b" />
    {Array.from({ length: 6 }, (_, index) => (
      <group key={index} position={[0, 0.3, 0.02 + index * 0.08]}>
        <Block position={[-0.33, 0, 0]} size={[0.18, 0.035, 0.035]} color="#e0ad62" />
        <Block position={[0.33, 0, 0]} size={[0.18, 0.035, 0.035]} color="#e0ad62" />
      </group>
    ))}
    <Block position={[0.36, 0.32, 0.7]} size={[0.23, 0.12, 0.22]} color="#c7ccd1" />
    <mesh position={[-0.37, 0.33, 0.68]}>
      <cylinderGeometry args={[0.12, 0.12, 0.13, 24]} />
      <meshStandardMaterial color="#252635" />
    </mesh>
  </group>
}

function Compartment({ index, open, pending, internal, onLid }: {
  index: number
  open: boolean
  pending: boolean
  internal: boolean
  onLid: () => void
}) {
  const hinge = useRef<Group>(null)
  useFrame(({ clock }, delta) => {
    if (hinge.current) {
      hinge.current.rotation.x = MathUtils.damp(hinge.current.rotation.x, open || internal ? -1.72 : 0, 8, delta)
    }
    if (led.current) led.current.visible = !pending || Math.sin(clock.elapsedTime * 8) > -0.35
  })
  const led = useRef<Group>(null)

  return <group position={[(index - 1.5) * 1.62, 0, 0]}>
    <Block position={[0, 0.2, 0.3]} size={[1.51, 0.13, 1.76]} color="#62528b" />
    {[-0.71, 0.71].map((x) => <Block key={x} position={[x, 0.42, 0.3]} size={[0.12, 0.55, 1.83]} color="#cfbee9" />)}
    {[-0.55, 1.15].map((z) => <Block key={z} position={[0, 0.42, z]} size={[1.54, 0.55, 0.14]} color="#cbb8e8" />)}
    {internal ? <Electronics /> : <group rotation={[0, -0.48, 0]} position={[0.09, 0.32, 0.48]}>
      <Block position={[-0.18, 0, 0]} size={[0.32, 0.13, 0.23]} color="#fff0d7" radius={0.07} />
      <Block position={[0.10, 0, 0]} size={[0.29, 0.13, 0.23]} color={lidColors[index]} radius={0.07} />
    </group>}
    <group ref={hinge} position={[0, 0.71, -0.57]} onClick={(event) => { event.stopPropagation(); onLid() }}>
      <Block position={[0, 0.01, 0.87]} size={[1.53, 0.17, 1.8]} color={lidColors[index]} radius={0.08} />
      <Block position={[0, 0.035, 1.77]} size={[0.53, 0.11, 0.16]} color="#d7c5f4" />
      <Label position={[0, 0.1, 0.88]} size={[0.96, 0.48]} text={`0${index + 1}`} />
    </group>
    <group ref={led} position={[0, 0.29, 1.25]}>
      <mesh>
        <sphereGeometry args={[0.067, 16, 12]} />
        <meshStandardMaterial color={pending ? '#ffc074' : '#655185'} emissive={pending ? '#ff8c30' : '#000000'} emissiveIntensity={1.4} />
      </mesh>
    </group>
  </group>
}

function Model(props: DeviceProps) {
  return <group position={[0, 0, -0.12]}>
    <Block position={[0, 0.08, 0]} size={[6.65, 0.35, 2.68]} color="#4a3d67" radius={0.15} />
    <Block position={[0, 0.29, -0.94]} size={[6.65, 0.44, 0.72]} color="#6e5996" radius={0.14} />
    <Block position={[0, 0.52, -0.94]} size={[1.48, 0.075, 0.43]} color="#283337" />
    <Block position={[0, 0.562, -0.94]} size={[1.24, 0.035, 0.28]} color="#bddeac" />
    {props.lcd.map((line, index) => <Label key={index} position={[0, 0.583, -1.001 + 0.12 * index]}
      size={[1.2, 0.47]} color="#284c36" text={line} />)}
    {[-1.55, 1.28, 1.64].map((x, index) =>
      <group key={x} onClick={(event) => { event.stopPropagation(); props.onButton(index) }}>
        <Block position={[x, 0.54, -0.94]} size={[0.23, 0.09, 0.24]} color={purple} />
        <Label position={[x, 0.589, -0.94]} size={[0.32, 0.22]} text={['−', '+', 'OK'][index]} />
      </group>)}
    {props.open.map((open, index) => <Compartment key={index} index={index} open={open}
      pending={props.pending[index]} internal={props.internal} onLid={() => props.onLid(index)} />)}
  </group>
}

export function Device(props: DeviceProps) {
  return <Canvas dpr={[1, 1.6]} camera={{ position: [4.5, 5.1, 8.4], fov: 43 }}
    fallback={<p className="webgl-fallback">A visualização 3D precisa de WebGL. Os controles continuam disponíveis.</p>}>
    <ambientLight intensity={1.45} />
    <directionalLight position={[-4, 8, 6]} intensity={2.2} color="#fff3ed" />
    <directionalLight position={[5, 3, -6]} intensity={1.05} color="#d8c6ff" />
    <Model {...props} />
    <ContactShadows position={[0, -0.105, 0]} scale={13} resolution={256} blur={2.7} opacity={0.42} far={5} />
    <OrbitControls target={[0, 0.32, 0]} enablePan={false} minDistance={6} maxDistance={15}
      maxPolarAngle={Math.PI / 2.25} makeDefault />
  </Canvas>
}
