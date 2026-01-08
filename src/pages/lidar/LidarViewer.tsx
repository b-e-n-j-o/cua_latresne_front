import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const CLASSES_COLORS = {
  1: 0xC8C8C8, 2: 0x8B4513, 3: 0x90EE90, 4: 0x228B22,
  5: 0x006400, 6: 0xDC143C, 9: 0x00BFFF, 17: 0xFFFF00
};

const CLASSES_NAMES = {
  1: 'Non classé', 2: 'Sol', 3: 'Vég. basse', 4: 'Vég. moyenne',
  5: 'Vég. haute', 6: 'Bâtiment', 9: 'Eau', 17: 'Pont'
};

export default function PageNuageLidar() {
  const { insee, section, numero } = useParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const centerRef = useRef<THREE.Vector3 | null>(null);
  const distanceRef = useRef<number>(0);

  useEffect(() => {
    if (!insee || !section || !numero) return;

    let animationId: number;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let renderer: THREE.WebGLRenderer;
    let controls: OrbitControls;

    const init = async () => {
      if (!containerRef.current) {
        setError('Container non initialisé');
        return;
      }

      const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

      try {
        console.log('📡 Chargement métadonnées...');
        
        // 1. Récupérer métadonnées
        const metaResponse = await fetch(
          `${apiBase}/api/lidar/parcelle/${insee}/${section}/${numero}`
        );
        
        if (!metaResponse.ok) {
          throw new Error('Nuage non généré ou introuvable');
        }
        
        const metaData = await metaResponse.json();
        
        if (!metaData.success) {
          throw new Error('Erreur serveur');
        }
        
        setMetadata(metaData);

        // 2. Récupérer points JSON
        console.log('📡 Chargement points...');
        const pointsResponse = await fetch(
          `${apiBase}/api/lidar/parcelle/${insee}/${section}/${numero}/json`
        );
        
        if (!pointsResponse.ok) {
          throw new Error('Erreur chargement points');
        }
        
        const pointsData = await pointsResponse.json();
        console.log(`✅ ${pointsData.count} points chargés`);

        // 3. Setup Three.js
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a1a);

        const container = containerRef.current;
        camera = new THREE.PerspectiveCamera(
          60,
          container.clientWidth / container.clientHeight,
          0.1,
          10000
        );

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.15; // Plus élevé = moins de traînée, plus réactif
        controls.rotateSpeed = 1.0;    // Rotation plus rapide
        controls.panSpeed = 1.0;        // Déplacement plus rapide
        controls.zoomSpeed = 1.2;       // Zoom plus réactif
        controls.minDistance = 10;      // Limite zoom avant
        controls.maxDistance = 5000;    // Limite zoom arrière
        
        // Stocker les références pour les boutons
        controlsRef.current = controls;
        cameraRef.current = camera;

        // 4. Créer nuage de points
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(pointsData.points.length * 3);
        const colors = new Float32Array(pointsData.points.length * 3);
        
        pointsData.points.forEach((pt: any, i: number) => {
          positions[i * 3] = pt.x;
          positions[i * 3 + 1] = pt.y;
          positions[i * 3 + 2] = pt.z;
          
          const color = new THREE.Color(
            CLASSES_COLORS[pt.class as keyof typeof CLASSES_COLORS] || 0xCCCCCC
          );
          colors[i * 3] = color.r;
          colors[i * 3 + 1] = color.g;
          colors[i * 3 + 2] = color.b;
        });

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
          size: 0.5,              // Plus gros pour meilleure visibilité
          vertexColors: true,
          sizeAttenuation: true
        });

        const pointCloud = new THREE.Points(geometry, material);
        scene.add(pointCloud);

        // Centrer caméra
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox!;
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        
        // Stocker pour les boutons
        centerRef.current = center.clone();
        distanceRef.current = distance;
        
        camera.position.set(
          center.x + distance,
          center.y + distance,
          center.z + distance
        );
        controls.target.copy(center);
        controls.update();

        // Grille
        const gridHelper = new THREE.GridHelper(maxDim * 2, 20, 0x444444, 0x222222);
        gridHelper.position.set(center.x, bbox.min.z, center.y);
        scene.add(gridHelper);

        // Axes
        const axesHelper = new THREE.AxesHelper(maxDim / 2);
        axesHelper.position.copy(center);
        scene.add(axesHelper);

        setLoading(false);

        // Animation
        function animate() {
          animationId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        }
        animate();

        // Resize
        const handleResize = () => {
          if (!containerRef.current) return;
          camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
          cancelAnimationFrame(animationId);
          if (renderer) renderer.dispose();
          if (geometry) geometry.dispose();
          if (material) material.dispose();
        };

      } catch (err: any) {
        console.error('❌ Erreur:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    // Petit délai pour s'assurer que le DOM est prêt
    const timer = setTimeout(init, 100);
    return () => clearTimeout(timer);
    
  }, [insee, section, numero]);

  return (
    <div className="relative w-full h-screen bg-gray-900">
      <div ref={containerRef} className="w-full h-full" />
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            Chargement nuage de points...
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-red-500 text-white p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-2">Erreur</h2>
            <p>{error}</p>
          </div>
        </div>
      )}

      {metadata && !loading && !error && (
        <>
          <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white p-4 rounded-lg shadow-xl">
            <h3 className="font-bold text-lg mb-2">
              Parcelle {section} {numero}
            </h3>
            <p className="text-sm text-gray-300">{metadata.parcelle.commune}</p>
            <p className="text-sm text-gray-300">
              {metadata.nuage.nb_points.toLocaleString()} points
            </p>
            <p className="text-sm text-gray-300">
              Surface: {metadata.parcelle.surface_m2.toFixed(0)} m²
            </p>
            <p className="text-sm text-gray-300">
              Altitude: {metadata.nuage.altitude_min.toFixed(1)} - {metadata.nuage.altitude_max.toFixed(1)} m
            </p>
          </div>

          <div className="absolute top-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg shadow-xl">
            <h4 className="font-bold mb-3">Classification LAS</h4>
            {Object.entries(metadata.nuage.classes)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([cls, stats]: [string, any]) => (
                <div key={cls} className="flex items-center gap-3 mb-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ 
                      backgroundColor: `#${CLASSES_COLORS[Number(cls) as keyof typeof CLASSES_COLORS]?.toString(16).padStart(6, '0')}` 
                    }}
                  />
                  <span className="text-sm flex-1">
                    {CLASSES_NAMES[Number(cls) as keyof typeof CLASSES_NAMES]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {stats.percent.toFixed(1)}%
                  </span>
                </div>
              ))}
          </div>

          <div className="absolute bottom-4 left-4 bg-black bg-opacity-80 text-white p-3 rounded-lg text-sm">
            <p className="mb-1">🖱️ Clic gauche + glisser: rotation</p>
            <p className="mb-1">🖱️ Molette: zoom</p>
            <p>🖱️ Clic droit + glisser: déplacement</p>
          </div>

          <div className="absolute bottom-20 right-4 bg-black bg-opacity-80 text-white p-3 rounded-lg space-y-2">
            <button 
              onClick={() => {
                if (controlsRef.current && cameraRef.current && centerRef.current && distanceRef.current) {
                  const center = centerRef.current;
                  const distance = distanceRef.current;
                  cameraRef.current.position.set(
                    center.x + distance,
                    center.y + distance,
                    center.z + distance
                  );
                  controlsRef.current.target.copy(center);
                  controlsRef.current.update();
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition-colors"
            >
              Réinitialiser vue
            </button>
            <button
              onClick={() => {
                if (controlsRef.current && cameraRef.current && centerRef.current && distanceRef.current) {
                  const center = centerRef.current;
                  const distance = distanceRef.current;
                  cameraRef.current.position.set(center.x, center.y + distance, center.z);
                  controlsRef.current.target.copy(center);
                  controlsRef.current.update();
                }
              }}
              className="w-full bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm transition-colors"
            >
              Vue de dessus
            </button>
          </div>
        </>
      )}
    </div>
  );
}