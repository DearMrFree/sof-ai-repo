"use client"

import { useRef, useMemo, useState, useEffect, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Html, Stars, useTexture } from "@react-three/drei"
import * as THREE from "three"
import { ArrowRight, Building2, Users, Globe2, TrendingUp } from "lucide-react"
import Link from "next/link"

// Client location data with lat/lng coordinates
const clientLocations = [
  // Bay Area - Core Market
  { name: "Stanford University", lat: 37.4275, lng: -122.1697, type: "corporate", value: "$2.4M" },
  { name: "Atherton Estates", lat: 37.4613, lng: -122.1978, type: "residential", value: "47 Clients" },
  { name: "Palo Alto", lat: 37.4419, lng: -122.143, type: "residential", value: "89 Clients" },
  { name: "Menlo Park", lat: 37.4529, lng: -122.1817, type: "corporate", value: "$1.8M" },
  { name: "Los Altos Hills", lat: 37.3796, lng: -122.1375, type: "residential", value: "34 Clients" },
  { name: "Woodside", lat: 37.4299, lng: -122.2539, type: "residential", value: "28 Clients" },
  { name: "Hillsborough", lat: 37.5741, lng: -122.3794, type: "residential", value: "52 Clients" },
  { name: "San Francisco", lat: 37.7749, lng: -122.4194, type: "corporate", value: "$3.1M" },
  
  // Extended California
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, type: "corporate", value: "$1.2M" },
  { name: "Beverly Hills", lat: 34.0736, lng: -118.4004, type: "residential", value: "23 Clients" },
  { name: "San Diego", lat: 32.7157, lng: -117.1611, type: "residential", value: "18 Clients" },
  
  // National Presence
  { name: "New York", lat: 40.7128, lng: -74.006, type: "corporate", value: "$2.8M" },
  { name: "The Hamptons", lat: 40.9176, lng: -72.3424, type: "residential", value: "12 Clients" },
  { name: "Miami", lat: 25.7617, lng: -80.1918, type: "residential", value: "31 Clients" },
  { name: "Palm Beach", lat: 26.7056, lng: -80.0364, type: "residential", value: "15 Clients" },
  { name: "Chicago", lat: 41.8781, lng: -87.6298, type: "corporate", value: "$890K" },
  { name: "Seattle", lat: 47.6062, lng: -122.3321, type: "corporate", value: "$1.1M" },
  { name: "Austin", lat: 30.2672, lng: -97.7431, type: "corporate", value: "$720K" },
  { name: "Denver", lat: 39.7392, lng: -104.9903, type: "residential", value: "24 Clients" },
  { name: "Phoenix", lat: 33.4484, lng: -112.074, type: "residential", value: "19 Clients" },
  
  // International Corporate
  { name: "London", lat: 51.5074, lng: -0.1278, type: "corporate", value: "$1.5M" },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, type: "corporate", value: "$980K" },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, type: "corporate", value: "$1.3M" },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503, type: "corporate", value: "$1.1M" },
  { name: "Hong Kong", lat: 22.3193, lng: 114.1694, type: "corporate", value: "$870K" },
  { name: "Sydney", lat: -33.8688, lng: 151.2093, type: "corporate", value: "$640K" },
  { name: "Vancouver", lat: 49.2827, lng: -123.1207, type: "residential", value: "16 Clients" },
  { name: "Monaco", lat: 43.7384, lng: 7.4246, type: "residential", value: "8 Clients" },
  { name: "Zurich", lat: 47.3769, lng: 8.5417, type: "corporate", value: "$520K" },
]

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)
  return new THREE.Vector3(x, y, z)
}

// Individual location marker
function LocationMarker({ 
  location, 
  radius, 
  isActive, 
  onSelect 
}: { 
  location: typeof clientLocations[0]
  radius: number
  isActive: boolean
  onSelect: () => void
}) {
  const position = useMemo(
    () => latLngToVector3(location.lat, location.lng, radius),
    [location.lat, location.lng, radius]
  )
  const markerRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  
  const isCorporate = location.type === "corporate"
  const baseColor = isCorporate ? "#c9a227" : "#7a6c3a"
  
  useFrame((state) => {
    if (markerRef.current) {
      const scale = hovered || isActive ? 1.5 : 1
      markerRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1)
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.02
      const pulseScale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.2
      if (isActive) {
        ringRef.current.scale.lerp(new THREE.Vector3(pulseScale, pulseScale, 1), 0.1)
      }
    }
  })
  
  return (
    <group position={position}>
      {/* Main marker */}
      <mesh
        ref={markerRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={hovered || isActive ? 2 : 0.8}
        />
      </mesh>
      
      {/* Pulse ring for active/hovered */}
      {(hovered || isActive) && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.05, 0.07, 32]} />
          <meshBasicMaterial color={baseColor} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      
      {/* Info tooltip */}
      {(hovered || isActive) && (
        <Html
          position={[0, 0.15, 0]}
          center
          style={{
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          <div className="bg-foreground/95 backdrop-blur-sm px-4 py-2 text-background text-sm animate-fade-in">
            <div className="flex items-center gap-2">
              {isCorporate ? (
                <Building2 size={12} className="text-primary" />
              ) : (
                <Users size={12} className="text-primary" />
              )}
              <span className="font-serif font-medium">{location.name}</span>
            </div>
            <div className="text-xs text-background/70 mt-1">
              {isCorporate ? "Corporate Contract" : "Private Clients"}: {location.value}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// Connection arcs between locations
function ConnectionArcs({ locations, radius }: { locations: typeof clientLocations; radius: number }) {
  const arcsRef = useRef<THREE.Group>(null)
  
  // Create arcs from Stanford (HQ) to major locations
  const arcs = useMemo(() => {
    const stanford = locations[0]
    const majorLocations = locations.filter((_, i) => i !== 0 && i % 3 === 0)
    
    return majorLocations.map((loc) => {
      const start = latLngToVector3(stanford.lat, stanford.lng, radius)
      const end = latLngToVector3(loc.lat, loc.lng, radius)
      
      // Create curved arc
      const mid = start.clone().add(end).multiplyScalar(0.5)
      mid.normalize().multiplyScalar(radius * 1.3)
      
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      const points = curve.getPoints(50)
      const geometry = new THREE.BufferGeometry().setFromPoints(points)
      
      return { geometry, key: `${stanford.name}-${loc.name}` }
    })
  }, [locations, radius])
  
  useFrame((state) => {
    if (arcsRef.current) {
      arcsRef.current.children.forEach((child, i) => {
        if (child instanceof THREE.Line) {
          const material = child.material as THREE.LineBasicMaterial
          material.opacity = 0.15 + Math.sin(state.clock.elapsedTime * 0.5 + i * 0.5) * 0.1
        }
      })
    }
  })
  
  return (
    <group ref={arcsRef}>
      {arcs.map((arc) => (
        <line key={arc.key} geometry={arc.geometry}>
          <lineBasicMaterial color="#c9a227" transparent opacity={0.2} />
        </line>
      ))}
    </group>
  )
}

// Main globe component
function Globe({ activeLocation, setActiveLocation }: { 
  activeLocation: number | null
  setActiveLocation: (index: number | null) => void 
}) {
  const globeRef = useRef<THREE.Mesh>(null)
  const atmosphereRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const radius = 2
  
  const texture = useTexture("/assets/3d/texture_earth.jpg")
  
  useFrame((state) => {
    if (globeRef.current && activeLocation === null) {
      globeRef.current.rotation.y += 0.001
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += 0.0005
    }
  })
  
  // Position camera to show Bay Area initially
  useEffect(() => {
    camera.position.set(3, 1.5, 3)
    camera.lookAt(0, 0, 0)
  }, [camera])
  
  return (
    <>
      {/* Globe */}
      <mesh ref={globeRef} onClick={() => setActiveLocation(null)}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      
      {/* Atmosphere glow */}
      <mesh ref={atmosphereRef} scale={1.05}>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial
          color="#c9a227"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Location markers */}
      {clientLocations.map((location, index) => (
        <LocationMarker
          key={location.name}
          location={location}
          radius={radius + 0.02}
          isActive={activeLocation === index}
          onSelect={() => setActiveLocation(index)}
        />
      ))}
      
      {/* Connection arcs */}
      <ConnectionArcs locations={clientLocations} radius={radius} />
    </>
  )
}

// Loading component
function GlobeLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-16 h-16 border-2 border-primary/30 border-t-primary animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground text-sm tracking-wide">Loading Global Presence...</p>
      </div>
    </div>
  )
}

// Stats panel
function StatsPanel() {
  const stats = [
    { label: "Countries", value: "12", icon: Globe2 },
    { label: "Corporate Clients", value: "156", icon: Building2 },
    { label: "Private Clients", value: "2,500+", icon: Users },
    { label: "Total Contract Value", value: "$18.4M", icon: TrendingUp },
  ]
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div
          key={stat.label}
          className="bg-card border border-border p-5 animate-fade-in-up"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <stat.icon size={20} className="text-primary mb-3" />
          <p className="font-serif text-2xl lg:text-3xl text-foreground">{stat.value}</p>
          <p className="text-xs tracking-widest text-muted-foreground uppercase mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}

// Location list panel
function LocationList({ 
  activeLocation, 
  setActiveLocation 
}: { 
  activeLocation: number | null
  setActiveLocation: (index: number | null) => void 
}) {
  const corporateLocations = clientLocations.filter(l => l.type === "corporate")
  const residentialLocations = clientLocations.filter(l => l.type === "residential")
  
  return (
    <div className="bg-card border border-border h-full overflow-hidden flex flex-col">
      <div className="p-5 border-b border-border">
        <h3 className="font-serif text-lg text-foreground">Client Locations</h3>
        <p className="text-xs text-muted-foreground mt-1">Click markers to explore</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Building2 size={14} className="text-primary" />
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Corporate</span>
          </div>
          <div className="space-y-1">
            {corporateLocations.map((loc) => {
              const index = clientLocations.indexOf(loc)
              return (
                <button
                  key={loc.name}
                  onClick={() => setActiveLocation(activeLocation === index ? null : index)}
                  className={`w-full text-left px-3 py-2 text-sm transition-all duration-200 flex items-center justify-between ${
                    activeLocation === index 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary text-foreground"
                  }`}
                >
                  <span>{loc.name}</span>
                  <span className={`text-xs ${activeLocation === index ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {loc.value}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-accent" />
            <span className="text-xs tracking-widest text-muted-foreground uppercase">Private Clients</span>
          </div>
          <div className="space-y-1">
            {residentialLocations.slice(0, 8).map((loc) => {
              const index = clientLocations.indexOf(loc)
              return (
                <button
                  key={loc.name}
                  onClick={() => setActiveLocation(activeLocation === index ? null : index)}
                  className={`w-full text-left px-3 py-2 text-sm transition-all duration-200 flex items-center justify-between ${
                    activeLocation === index 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary text-foreground"
                  }`}
                >
                  <span>{loc.name}</span>
                  <span className={`text-xs ${activeLocation === index ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {loc.value}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// Main export component
export function GlobalPresenceGlobe() {
  const [activeLocation, setActiveLocation] = useState<number | null>(null)
  
  return (
    <section id="global-presence" className="py-24 lg:py-32 bg-background">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-16 max-w-3xl">
          <span className="text-xs tracking-widest text-primary uppercase mb-4 block animate-fade-in">
            Our Reach
          </span>
          <h2 className="font-serif text-4xl lg:text-5xl xl:text-6xl text-foreground mb-6 animate-fade-in-up text-balance">
            A Global Network of Distinction
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed animate-fade-in-up animation-delay-200">
            From the estates of Atherton to the penthouses of Manhattan, our white-glove services 
            extend across continents. We serve discerning clients and leading corporations wherever 
            excellence is demanded.
          </p>
        </div>
        
        {/* Stats */}
        <div className="mb-12">
          <StatsPanel />
        </div>
        
        {/* Globe and List */}
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 mb-12">
          {/* 3D Globe */}
          <div className="bg-foreground aspect-square lg:aspect-auto lg:h-[600px] relative overflow-hidden">
            <Suspense fallback={<GlobeLoader />}>
              <Canvas
                camera={{ position: [4, 2, 4], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
              >
                <color attach="background" args={["#1a1915"]} />
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 3, 5]} intensity={1} />
                <pointLight position={[-5, -3, -5]} intensity={0.3} color="#c9a227" />
                
                <Stars radius={100} depth={50} count={3000} factor={4} fade speed={1} />
                
                <Globe activeLocation={activeLocation} setActiveLocation={setActiveLocation} />
                
                <OrbitControls
                  enableZoom={true}
                  enablePan={false}
                  minDistance={3.5}
                  maxDistance={8}
                  autoRotate={activeLocation === null}
                  autoRotateSpeed={0.3}
                  dampingFactor={0.05}
                />
              </Canvas>
            </Suspense>
            
            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex items-center gap-6 text-background/80 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#c9a227] rounded-full" />
                <span>Corporate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#7a6c3a] rounded-full" />
                <span>Private</span>
              </div>
            </div>
            
            {/* Instructions */}
            <div className="absolute top-4 right-4 text-background/50 text-xs">
              Drag to rotate | Scroll to zoom
            </div>
          </div>
          
          {/* Location List */}
          <LocationList activeLocation={activeLocation} setActiveLocation={setActiveLocation} />
        </div>
        
        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-8 border-t border-border">
          <div>
            <p className="font-serif text-xl text-foreground">Ready to Join Our Global Clientele?</p>
            <p className="text-muted-foreground text-sm mt-1">
              Experience the service that executives and estates worldwide trust.
            </p>
          </div>
          <Link
            href="/quote"
            className="group flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground text-sm tracking-wide hover:bg-primary/90 transition-all duration-300"
          >
            <span>Request a Consultation</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  )
}
