import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Reads a theme token ("258 90% 66%") as a THREE.Color. */
function tokenColor(name: string, fallback: string): THREE.Color {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const m = raw.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  return new THREE.Color().setStyle(m ? `hsl(${m[1]}, ${m[2]}%, ${m[3]}%)` : fallback);
}

/** A soft round sprite texture for glows and particles. */
function glowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Props {
  /** How busy the system is (active runs): more pulses travel the links. */
  activity?: number;
  /** Agent nodes orbiting the core. */
  nodes?: number;
  className?: string;
}

/**
 * The orchestration core: a wireframe icosahedron "brain" with agent nodes
 * orbiting on tilted rings, links from the core to each agent, and pulses
 * travelling along them (one per unit of activity). Colours come from the
 * theme tokens and follow light/dark. Rendering pauses when off-screen or the
 * tab is hidden; with prefers-reduced-motion it draws a single still frame.
 */
export default function OrchestrationCore({ activity = 2, nodes = 7, className }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef(activity);
  activityRef.current = activity;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      mount.dataset.webgl = "unavailable";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.6, 10.5);
    camera.lookAt(0, 0, 0);

    const root = new THREE.Group();
    scene.add(root);
    const glow = glowTexture();
    const disposables: Array<{ dispose(): void }> = [glow];
    const track = <T extends { dispose(): void }>(o: T) => (disposables.push(o), o);

    const isDark = () => document.documentElement.classList.contains("dark");
    const palette = () => ({
      primary: tokenColor("--primary", "#8b5cf6"),
      info: tokenColor("--info", "#22d3ee"),
      success: tokenColor("--success", "#34d399"),
      muted: tokenColor("--muted-foreground", "#9299a8"),
    });
    let colors = palette();
    const blending = () => (isDark() ? THREE.AdditiveBlending : THREE.NormalBlending);

    // ── Core ──────────────────────────────────────────────────────────────
    const coreGeo = track(new THREE.IcosahedronGeometry(1.25, 1));
    const coreEdges = track(new THREE.EdgesGeometry(coreGeo));
    const coreLineMat = track(new THREE.LineBasicMaterial({ color: colors.primary, transparent: true, opacity: 0.85 }));
    const coreLines = new THREE.LineSegments(coreEdges, coreLineMat);
    const innerMat = track(
      new THREE.MeshBasicMaterial({ color: colors.primary, transparent: true, opacity: 0.12, depthWrite: false }),
    );
    const inner = new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.05, 2)), innerMat);
    const shellMat = track(
      new THREE.MeshBasicMaterial({ color: colors.info, wireframe: true, transparent: true, opacity: 0.08, depthWrite: false }),
    );
    const shell = new THREE.Mesh(track(new THREE.IcosahedronGeometry(1.75, 2)), shellMat);
    const coreGlowMat = track(
      new THREE.SpriteMaterial({ map: glow, color: colors.primary, transparent: true, opacity: 0.55, depthWrite: false, blending: blending() }),
    );
    const coreGlow = new THREE.Sprite(coreGlowMat);
    coreGlow.scale.setScalar(5.2);
    const core = new THREE.Group();
    core.add(coreGlow, inner, coreLines, shell);
    root.add(core);

    // ── Orbit rings ──────────────────────────────────────────────────────
    const ringDefs = [
      { r: 2.6, tilt: new THREE.Euler(1.25, 0.2, 0) },
      { r: 3.35, tilt: new THREE.Euler(1.05, -0.55, 0.3) },
      { r: 4.05, tilt: new THREE.Euler(1.45, 0.65, -0.2) },
    ];
    const ringMats: THREE.LineBasicMaterial[] = [];
    const rings = ringDefs.map((def, i) => {
      const pts = new THREE.EllipseCurve(0, 0, def.r, def.r, 0, Math.PI * 2).getPoints(160);
      const geo = track(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, 0))));
      const mat = track(new THREE.LineBasicMaterial({ color: i === 1 ? colors.info : colors.primary, transparent: true, opacity: 0.18 }));
      ringMats.push(mat);
      const line = new THREE.LineLoop(geo, mat);
      const g = new THREE.Group();
      g.rotation.copy(def.tilt);
      g.add(line);
      root.add(g);
      return g;
    });

    // ── Agent nodes ──────────────────────────────────────────────────────
    const nodeGeo = track(new THREE.IcosahedronGeometry(0.13, 1));
    const agents = Array.from({ length: nodes }, (_, i) => {
      const ring = rings[i % rings.length];
      const tone = i % 3 === 0 ? "info" : i % 3 === 1 ? "primary" : "success";
      const mat = track(new THREE.MeshBasicMaterial({ color: colors[tone] }));
      const mesh = new THREE.Mesh(nodeGeo, mat);
      const halo = new THREE.Sprite(
        track(new THREE.SpriteMaterial({ map: glow, color: colors[tone], transparent: true, opacity: 0.8, depthWrite: false, blending: blending() })),
      );
      halo.scale.setScalar(0.9);
      mesh.add(halo);
      ring.add(mesh);
      return {
        mesh,
        halo,
        tone,
        ring: ringDefs[i % rings.length],
        angle: (i / nodes) * Math.PI * 2 + i * 0.7,
        speed: (0.09 + (i % 4) * 0.035) * (i % 2 ? -1 : 1),
        world: new THREE.Vector3(),
      };
    });

    // ── Links core → agents (updated each frame) ─────────────────────────
    const linkPositions = new Float32Array(nodes * 2 * 3);
    const linkGeo = track(new THREE.BufferGeometry());
    linkGeo.setAttribute("position", new THREE.BufferAttribute(linkPositions, 3));
    const linkMat = track(new THREE.LineBasicMaterial({ color: colors.primary, transparent: true, opacity: 0.22 }));
    root.add(new THREE.LineSegments(linkGeo, linkMat));

    // ── Pulses travelling along links ────────────────────────────────────
    const MAX_PULSES = 14;
    const pulses = Array.from({ length: MAX_PULSES }, (_, i) => {
      const mat = track(
        new THREE.SpriteMaterial({ map: glow, color: colors.info, transparent: true, opacity: 0, depthWrite: false, blending: blending() }),
      );
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(0.42);
      root.add(s);
      return { sprite: s, mat, agent: i % nodes, t: Math.random(), speed: 0.35 + Math.random() * 0.35, outbound: i % 2 === 0 };
    });

    // ── Particle field ───────────────────────────────────────────────────
    const COUNT = 520;
    const starPos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const r = 5.5 + Math.random() * 6;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos.set([r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th) * 0.6, r * Math.cos(ph)], i * 3);
    }
    const starGeo = track(new THREE.BufferGeometry());
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = track(
      new THREE.PointsMaterial({ map: glow, color: colors.muted, size: 0.09, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true }),
    );
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ── Theme changes recolour everything ────────────────────────────────
    const recolor = () => {
      colors = palette();
      const dark = isDark();
      coreLineMat.color.copy(colors.primary);
      innerMat.color.copy(colors.primary);
      shellMat.color.copy(colors.info);
      coreGlowMat.color.copy(colors.primary);
      coreGlowMat.opacity = dark ? 0.55 : 0.28;
      linkMat.color.copy(colors.primary);
      starMat.color.copy(colors.muted);
      starMat.opacity = dark ? 0.55 : 0.35;
      ringMats.forEach((m, i) => m.color.copy(i === 1 ? colors.info : colors.primary));
      for (const a of agents) {
        (a.mesh.material as THREE.MeshBasicMaterial).color.copy(colors[a.tone as keyof typeof colors]);
        a.halo.material.color.copy(colors[a.tone as keyof typeof colors]);
      }
      for (const m of [coreGlowMat, ...agents.map((a) => a.halo.material), ...pulses.map((p) => p.mat)]) {
        m.blending = blending();
        m.needsUpdate = true;
      }
    };
    recolor();
    // Redraw at once (not on the next frame): a theme switch animates from a
    // snapshot taken right after the class changes.
    const themeObserver = new MutationObserver(() => {
      recolor();
      renderer.render(scene, camera);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // ── Sizing, pointer parallax, visibility ─────────────────────────────
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      // Keep the whole constellation in frame on narrow containers.
      camera.position.z = w / h < 1 ? 10.5 / Math.max(w / h, 0.55) : 10.5;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const pointer = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      const r = mount.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    io.observe(mount);
    const onVisibility = () => !document.hidden && start();
    document.addEventListener("visibilitychange", onVisibility);

    // ── Animation ────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let frame = 0;
    let running = false;
    const tmp = new THREE.Vector3();

    const step = (dt: number, t: number) => {
      core.rotation.y += dt * 0.25;
      core.rotation.x = Math.sin(t * 0.3) * 0.18;
      shell.rotation.y -= dt * 0.12;
      const breathe = 1 + Math.sin(t * 1.6) * 0.04;
      inner.scale.setScalar(breathe);
      coreGlow.scale.setScalar(5.2 * (1 + Math.sin(t * 1.6) * 0.06));

      for (const a of agents) {
        a.angle += dt * a.speed;
        a.mesh.position.set(Math.cos(a.angle) * a.ring.r, Math.sin(a.angle) * a.ring.r, 0);
        a.mesh.getWorldPosition(a.world);
        root.worldToLocal(a.world);
        a.halo.scale.setScalar(0.8 + Math.sin(t * 2 + a.angle) * 0.12);
      }
      agents.forEach((a, i) => {
        linkPositions.set([0, 0, 0, a.world.x, a.world.y, a.world.z], i * 6);
      });
      linkGeo.attributes.position.needsUpdate = true;

      const active = Math.min(MAX_PULSES, 3 + Math.max(0, Math.round(activityRef.current)) * 2);
      pulses.forEach((p, i) => {
        if (i >= active) {
          p.mat.opacity = Math.max(0, p.mat.opacity - dt * 2);
          return;
        }
        p.t += dt * p.speed;
        if (p.t >= 1) {
          p.t = 0;
          p.agent = Math.floor(Math.random() * agents.length);
          p.outbound = !p.outbound;
        }
        const target = agents[p.agent].world;
        const k = p.outbound ? p.t : 1 - p.t;
        tmp.set(0, 0, 0).lerp(target, k);
        p.sprite.position.copy(tmp);
        p.mat.color.copy(p.outbound ? colors.info : colors.success);
        p.mat.opacity = Math.sin(Math.PI * p.t) * (isDark() ? 0.95 : 0.7);
      });

      stars.rotation.y += dt * 0.012;
      root.rotation.y += (pointer.x * 0.35 - root.rotation.y) * Math.min(1, dt * 2.5);
      root.rotation.x += (pointer.y * 0.2 - root.rotation.x) * Math.min(1, dt * 2.5);
    };

    const loop = () => {
      if (!running) return;
      if (!visible || document.hidden) {
        running = false;
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.05);
      step(dt, clock.elapsedTime);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    function start() {
      if (running || reduceMotion) return;
      running = true;
      clock.getDelta();
      frame = requestAnimationFrame(loop);
    }

    // Always draw one frame (the still image for reduced motion).
    step(0.016, 1.2);
    renderer.render(scene, camera);
    start();

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const d of disposables) d.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [nodes]);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
