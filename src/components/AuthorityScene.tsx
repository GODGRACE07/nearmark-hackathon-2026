import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function AuthorityScene() {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      host.classList.add('scene-fallback');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 8.8);

    scene.add(new THREE.AmbientLight(0xc7f6aa, 1.2));
    const key = new THREE.PointLight(0xc6ff68, 34, 20);
    key.position.set(3.4, 2.5, 4);
    scene.add(key);
    const warm = new THREE.PointLight(0xff6d57, 16, 14);
    warm.position.set(-3, -2, 2);
    scene.add(warm);

    const root = new THREE.Group();
    scene.add(root);

    const coreGeometry = new THREE.IcosahedronGeometry(1.34, 3);
    const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x17271d, metalness: 0.62, roughness: 0.3, transparent: true, opacity: 0.9, flatShading: true });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    root.add(core);

    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.38, 2)), new THREE.LineBasicMaterial({ color: 0xc8fa70, transparent: true, opacity: 0.55 }));
    root.add(wire);

    const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.88, 2), new THREE.MeshBasicMaterial({ color: 0xc3f56c, wireframe: true, transparent: true, opacity: 0.16 }));
    root.add(inner);

    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xff745d, transparent: true, opacity: 0.72, wireframe: true });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.009, 6, 180), ringMaterial);
    ringA.rotation.x = 1.04;
    ringA.rotation.y = -0.24;
    root.add(ringA);
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(2.34, 0.008, 6, 180), new THREE.MeshBasicMaterial({ color: 0xb4a5ff, transparent: true, opacity: 0.35, wireframe: true }));
    ringB.rotation.x = -0.66;
    ringB.rotation.y = 0.7;
    root.add(ringB);

    const points: THREE.Vector3[] = [];
    const nodeGeometry = new THREE.SphereGeometry(0.045, 10, 10);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0xd9ff91 });
    for (let i = 0; i < 26; i++) {
      const phi = Math.acos(-1 + (2 * i) / 26);
      const theta = Math.sqrt(26 * Math.PI) * phi;
      const p = new THREE.Vector3(Math.cos(theta) * Math.sin(phi), Math.sin(theta) * Math.sin(phi), Math.cos(phi)).multiplyScalar(1.46 + (i % 3) * 0.04);
      points.push(p);
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.position.copy(p);
      root.add(node);
    }
    const linePositions: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const nearest = points.map((p, j) => ({ j, d: p.distanceTo(points[i]) })).filter(x => x.j !== i).sort((a, b) => a.d - b.d).slice(0, 2);
      nearest.forEach(n => { linePositions.push(...points[i].toArray(), ...points[n.j].toArray()); });
    }
    const graph = new THREE.BufferGeometry();
    graph.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    root.add(new THREE.LineSegments(graph, new THREE.LineBasicMaterial({ color: 0x8dae78, transparent: true, opacity: 0.21 })));

    const dustCount = 180;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 9;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 7;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xc8e9a4, size: 0.014, transparent: true, opacity: 0.5 }));
    scene.add(dust);

    let pointerX = 0;
    let pointerY = 0;
    let raf = 0;
    let visible = true;
    let frame = 0;
    const onPointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 0.45;
      pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 0.34;
    };
    const onLeave = () => { pointerX = 0; pointerY = 0; };
    host.addEventListener('pointermove', onPointer);
    host.addEventListener('pointerleave', onLeave);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !reduceMotion && !raf) animate(); });
    observer.observe(host);
    const resizeObserver = new ResizeObserver(() => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(host);

    const renderFrame = () => {
      renderer.render(scene, camera);
    };
    const animate = () => {
      if (!visible || reduceMotion) { renderFrame(); return; }
      raf = requestAnimationFrame(animate);
      frame += 1;
      root.rotation.y += 0.0018;
      root.rotation.x += (pointerY - root.rotation.x) * 0.012;
      root.rotation.z += (pointerX - root.rotation.z) * 0.012;
      ringA.rotation.z += 0.0015;
      ringB.rotation.y -= 0.0011;
      dust.rotation.y += 0.00025;
      const pulse = 1 + Math.sin(frame * 0.018) * 0.012;
      core.scale.setScalar(pulse);
      renderFrame();
    };
    if (reduceMotion) renderFrame(); else animate();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect(); resizeObserver.disconnect();
      host.removeEventListener('pointermove', onPointer); host.removeEventListener('pointerleave', onLeave);
      coreGeometry.dispose(); coreMaterial.dispose(); nodeGeometry.dispose(); nodeMaterial.dispose();
      graph.dispose(); dustGeometry.dispose(); renderer.dispose();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
          object.geometry?.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach(m => m.dispose()); else material?.dispose();
        }
      });
      renderer.domElement.remove();
    };
  }, []);

  return <div className="authority-scene" ref={mount} aria-label="Animated three-dimensional network of agent permissions and security checks" role="img"><div className="scene-glow"/><div className="scene-fallback-mark">NM</div></div>;
}
