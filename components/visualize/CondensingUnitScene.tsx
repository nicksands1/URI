"use client";

// Three.js scene for the Trenton TQZA020L8HS2DE air-cooled condensing unit.
//
// Geometry is schematic/generic per docs/DECISIONS.md D-037: the catalog
// gives part numbers, ratings, connection sizes, and overall cabinet
// dimensions (used for the cabinet's real L/W/H proportions below) - it
// does not give internal CAD geometry, so the scroll compressor, coil,
// receiver, etc. are built to be functionally/topologically correct
// (real component types, real flow order) but are illustrative shapes,
// not manufacturer drawings. Every *number* shown elsewhere in this
// feature (SpecPanel) is cited back to the catalog separately from this
// component, which only renders geometry.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TQZA020L8HS2DE } from "@/lib/domain/visualization/condensingUnitData";

export type ComponentKey =
  | "cabinet"
  | "fan"
  | "condenserCoil"
  | "compressor"
  | "receiver"
  | "filterDrier"
  | "sightGlass"
  | "accumulator"
  | "suctionValve"
  | "liquidValve";

export interface ComponentInfo {
  key: ComponentKey;
  label: string;
}

export const COMPONENT_LIST: ComponentInfo[] = [
  { key: "compressor", label: "Copeland scroll compressor" },
  { key: "condenserCoil", label: "Condenser coil (fin/tube)" },
  { key: "fan", label: "Condenser fan (top discharge)" },
  { key: "receiver", label: "Liquid receiver (11 lb cap.)" },
  { key: "filterDrier", label: "Sealed liquid line filter drier" },
  { key: "sightGlass", label: "Sight glass" },
  { key: "accumulator", label: "Suction accumulator" },
  { key: "suctionValve", label: "Suction service valve (7/8 in)" },
  { key: "liquidValve", label: "Liquid service valve (3/8 in)" },
];

// Flow states, matching CLAUDE.md's requested color-coded pressure/phase
// legend. A condensing unit only performs compression + condensation -
// expansion (TXV) and evaporation happen at a remote evaporator coil that
// is outside this catalog part number, shown as dashed lines leaving frame.
const COLOR = {
  hpVapor: 0xff4d3d, // compressor discharge -> condenser inlet
  hpLiquid: 0xffb020, // condenser outlet -> receiver -> drier -> liquid line out
  lpVapor: 0x4da8ff, // suction line in -> accumulator -> compressor inlet
  copper: 0xb5651d,
  cabinet: 0xb9c2cc,
  cabinetEdge: 0x5b6672,
};

function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(10,14,20,0.85)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#3d4a5f";
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e6e9ee";
  ctx.font = "28px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 16);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.1, 0.275, 1);
  sprite.renderOrder = 999;
  return sprite;
}

function tubeAlong(points: THREE.Vector3[], radius: number, color: number, opacity = 1) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 64, radius, 8, false);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.4, transparent: opacity < 1, opacity });
  return new THREE.Mesh(geo, mat);
}

interface FlowPath {
  curve: THREE.CatmullRomCurve3;
  color: number;
  particleCount: number;
  speedScale: number;
}

export function CondensingUnitScene(props: {
  cutaway: boolean;
  showLabels: boolean;
  speed: number; // 0 = paused
  isolated: ComponentKey | null;
  onSelectComponent: (key: ComponentKey | null) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    cabinetSolid: THREE.Object3D[];
    componentGroups: Partial<Record<ComponentKey, THREE.Group>>;
    labelSprites: THREE.Sprite[];
    flows: FlowPath[];
    particles: THREE.Mesh[];
  }>({ cabinetSolid: [], componentGroups: {}, labelSprites: [], flows: [], particles: [] });

  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f14);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(3.6, 2.7, 4.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.1, 0);
    controls.minDistance = 2.5;
    controls.maxDistance = 12;

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(5, 8, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(8, 32),
      new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Real cabinet proportions from the catalog table (D-035): L18.75 x
    // W48.13 x H29.25 in, scaled to a manageable scene unit (1 unit ≈ 12in).
    const spec = TQZA020L8HS2DE;
    const SCALE = 1 / 12;
    const boxL = spec.dimensionsIn.l * SCALE; // depth
    const boxW = spec.dimensionsIn.w * SCALE; // width
    const boxH = spec.dimensionsIn.h * SCALE; // height

    const cabinetGroup = new THREE.Group();
    scene.add(cabinetGroup);

    const wireframe = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(boxW, boxH, boxL)),
      new THREE.LineBasicMaterial({ color: COLOR.cabinetEdge })
    );
    wireframe.position.y = boxH / 2;
    cabinetGroup.add(wireframe);

    const cabinetMat = new THREE.MeshStandardMaterial({ color: COLOR.cabinet, roughness: 0.6, metalness: 0.3 });
    const panelThickness = 0.03;
    const solidPanels: THREE.Object3D[] = [];
    function addPanel(w: number, h: number, d: number, x: number, y: number, z: number) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cabinetMat);
      m.position.set(x, y, z);
      cabinetGroup.add(m);
      solidPanels.push(m);
    }
    // back, left, right, bottom, front (front hidden in cutaway)
    addPanel(boxW, boxH, panelThickness, 0, boxH / 2, -boxL / 2);
    addPanel(panelThickness, boxH, boxL, -boxW / 2, boxH / 2, 0);
    addPanel(panelThickness, boxH, boxL, boxW / 2, boxH / 2, 0);
    addPanel(boxW, panelThickness, boxL, 0, 0, 0);
    const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, panelThickness), cabinetMat);
    frontPanel.position.set(0, boxH / 2, boxL / 2);
    cabinetGroup.add(frontPanel);
    solidPanels.push(frontPanel);

    // Top panel with a circular cutout for the fan grille. Without this,
    // an elevated orbit camera looks straight down through an open top
    // regardless of the front panel's visibility, making "cutaway" a
    // no-op - this is what actually gates the interior view.
    const fanHoleRadius = boxW * 0.34;
    const topShape = new THREE.Shape();
    topShape.moveTo(-boxW / 2, -boxL / 2);
    topShape.lineTo(boxW / 2, -boxL / 2);
    topShape.lineTo(boxW / 2, boxL / 2);
    topShape.lineTo(-boxW / 2, boxL / 2);
    topShape.closePath();
    const fanHole = new THREE.Path();
    fanHole.absellipse(0, 0, fanHoleRadius, fanHoleRadius, 0, Math.PI * 2, false, 0);
    topShape.holes.push(fanHole);
    const topPanel = new THREE.Mesh(
      new THREE.ExtrudeGeometry(topShape, { depth: panelThickness, bevelEnabled: false }),
      cabinetMat
    );
    topPanel.rotation.x = -Math.PI / 2;
    topPanel.position.set(0, boxH, 0);
    cabinetGroup.add(topPanel);
    solidPanels.push(topPanel);

    stateRef.current.cabinetSolid = solidPanels;

    // Top fan grille + rotating blades (top-discharge outdoor unit)
    const fanGroup = new THREE.Group();
    fanGroup.userData.componentKey = "fan";
    fanGroup.position.set(0, boxH + 0.02, 0);
    const grille = new THREE.Mesh(
      new THREE.TorusGeometry(boxW * 0.32, 0.03, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0x2a2f36, metalness: 0.7, roughness: 0.4 })
    );
    grille.rotation.x = Math.PI / 2;
    fanGroup.add(grille);
    const bladeHub = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(boxW * 0.28, 0.015, 0.09),
        new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.5, roughness: 0.5 })
      );
      blade.position.x = boxW * 0.14;
      blade.rotation.y = (i * Math.PI) / 2;
      bladeHub.add(blade);
    }
    fanGroup.add(bladeHub);
    fanGroup.userData.bladeHub = bladeHub;
    cabinetGroup.add(fanGroup);

    // Interior components, positioned within the cabinet footprint.
    const interior = new THREE.Group();
    cabinetGroup.add(interior);

    function group(k: ComponentKey) {
      const g = new THREE.Group();
      g.userData.componentKey = k;
      interior.add(g);
      stateRef.current.componentGroups[k] = g;
      return g;
    }

    // Condenser coil block beneath the fan: rows of thin tubes + a
    // translucent fin-pack box (schematic, not literal fin count - D-037).
    const coilGroup = group("condenserCoil");
    const coilBoxMat = new THREE.MeshStandardMaterial({ color: 0xaab4bd, transparent: true, opacity: 0.18, roughness: 0.9 });
    coilBoxMat.userData.baseOpacity = 0.18;
    const coilBox = new THREE.Mesh(new THREE.BoxGeometry(boxW * 0.75, boxH * 0.55, boxL * 0.7), coilBoxMat);
    coilBox.position.y = boxH * 0.55;
    coilGroup.add(coilBox);
    for (let row = 0; row < 6; row++) {
      const tube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, boxW * 0.7, 10),
        new THREE.MeshStandardMaterial({ color: COLOR.copper, metalness: 0.7, roughness: 0.3 })
      );
      tube.rotation.z = Math.PI / 2;
      tube.position.set(0, boxH * 0.32 + row * (boxH * 0.42) / 6, boxL * 0.15 - row * 0.02);
      coilGroup.add(tube);
    }

    // Compressor: capsule "dome" body + terminal box, low in the cabinet.
    const compGroup = group("compressor");
    const compBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(boxW * 0.13, boxH * 0.22, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x24262b, metalness: 0.55, roughness: 0.45 })
    );
    compBody.position.set(-boxW * 0.22, boxH * 0.22, -boxL * 0.1);
    compGroup.add(compBody);
    const terminalBox = new THREE.Mesh(
      new THREE.BoxGeometry(boxW * 0.1, boxH * 0.08, boxL * 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.4, roughness: 0.5 })
    );
    terminalBox.position.set(-boxW * 0.32, boxH * 0.18, -boxL * 0.1);
    compGroup.add(terminalBox);
    // Orbiting scroll indicator - schematic representation of scroll motion.
    const orbitIndicator = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10),
      new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0x552d00, emissiveIntensity: 0.6 })
    );
    compGroup.add(orbitIndicator);
    compGroup.userData.orbitIndicator = orbitIndicator;
    compGroup.userData.orbitCenter = compBody.position.clone().add(new THREE.Vector3(0, boxH * 0.22, 0));

    // Receiver: horizontal tank.
    const recvGroup = group("receiver");
    const recv = new THREE.Mesh(
      new THREE.CapsuleGeometry(boxL * 0.09, boxW * 0.28, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.6, roughness: 0.35 })
    );
    recv.rotation.z = Math.PI / 2;
    recv.position.set(boxW * 0.18, boxH * 0.18, boxL * 0.22);
    recvGroup.add(recv);

    // Filter drier + sight glass, inline on the liquid path.
    const drierGroup = group("filterDrier");
    const drier = new THREE.Mesh(
      new THREE.CylinderGeometry(boxL * 0.045, boxL * 0.045, boxW * 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0xcfd6dc, metalness: 0.5, roughness: 0.4 })
    );
    drier.rotation.z = Math.PI / 2;
    drier.position.set(boxW * 0.02, boxH * 0.12, boxL * 0.3);
    drierGroup.add(drier);

    const sightGroup = group("sightGlass");
    const sightBody = new THREE.Mesh(
      new THREE.CylinderGeometry(boxL * 0.035, boxL * 0.035, boxW * 0.05, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.6, roughness: 0.3 })
    );
    sightBody.rotation.z = Math.PI / 2;
    sightBody.position.set(-boxW * 0.08, boxH * 0.12, boxL * 0.3);
    sightGroup.add(sightBody);
    const sightWindow = new THREE.Mesh(
      new THREE.CircleGeometry(boxL * 0.03, 16),
      new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xffb020, emissiveIntensity: 0.5 })
    );
    sightWindow.position.set(-boxW * 0.08, boxH * 0.12, boxL * 0.34);
    sightGroup.add(sightWindow);

    // Suction accumulator: vertical cylinder near compressor suction.
    const accGroup = group("accumulator");
    const acc = new THREE.Mesh(
      new THREE.CylinderGeometry(boxL * 0.06, boxL * 0.06, boxH * 0.32, 12),
      new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.55, roughness: 0.4 })
    );
    acc.position.set(-boxW * 0.4, boxH * 0.2, boxL * 0.15);
    accGroup.add(acc);

    // Service valves on the cabinet face, at real connection sizes'
    // relative proportions (schematic short cylinders).
    const suctionValveGroup = group("suctionValve");
    const suctionValve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: COLOR.copper, metalness: 0.7, roughness: 0.3 })
    );
    suctionValve.rotation.x = Math.PI / 2;
    suctionValve.position.set(boxW * 0.42, boxH * 0.15, boxL / 2 + 0.05);
    suctionValveGroup.add(suctionValve);

    const liquidValveGroup = group("liquidValve");
    const liquidValve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: COLOR.copper, metalness: 0.7, roughness: 0.3 })
    );
    liquidValve.rotation.x = Math.PI / 2;
    liquidValve.position.set(boxW * 0.42, boxH * 0.28, boxL / 2 + 0.05);
    liquidValveGroup.add(liquidValve);

    // Tubing (copper, visual only - flow color carried by particles).
    const compTop = new THREE.Vector3(-boxW * 0.22, boxH * 0.34, -boxL * 0.1);
    const coilInlet = new THREE.Vector3(boxW * 0.35, boxH * 0.55, boxL * 0.15);
    const coilOutlet = new THREE.Vector3(boxW * 0.35, boxH * 0.4, -boxL * 0.15);
    const recvIn = recv.position.clone();
    const drierPos = drier.position.clone();
    const sightPos = sightWindow.position.clone();
    const liquidValvePos = liquidValve.position.clone();
    const suctionValvePos = suctionValve.position.clone();
    const accTop = acc.position.clone().add(new THREE.Vector3(0, boxH * 0.16, 0));
    const compSuction = compBody.position.clone().add(new THREE.Vector3(0, 0, -boxL * 0.1));

    interior.add(tubeAlong([compTop, coilInlet], 0.035, COLOR.copper));
    interior.add(tubeAlong([coilOutlet, recvIn], 0.03, COLOR.copper));
    interior.add(tubeAlong([recvIn, drierPos], 0.025, COLOR.copper));
    interior.add(tubeAlong([drierPos, sightPos], 0.02, COLOR.copper));
    interior.add(tubeAlong([sightPos, liquidValvePos], 0.02, COLOR.copper));
    interior.add(tubeAlong([suctionValvePos, accTop], 0.045, COLOR.copper));
    interior.add(tubeAlong([accTop, compSuction], 0.045, COLOR.copper));

    // Off-frame lines to the remote evaporator (outside this catalog part).
    const liquidOut = liquidValvePos.clone().add(new THREE.Vector3(1.4, 0, 0));
    const suctionIn = suctionValvePos.clone().add(new THREE.Vector3(1.4, 0, 0));
    const dashedMat = new THREE.LineDashedMaterial({ color: 0x8b96a5, dashSize: 0.08, gapSize: 0.05 });
    const liquidOutLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([liquidValvePos, liquidOut]),
      dashedMat
    );
    liquidOutLine.computeLineDistances();
    const suctionInLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([suctionValvePos, suctionIn]),
      dashedMat
    );
    suctionInLine.computeLineDistances();
    interior.add(liquidOutLine, suctionInLine);

    // Flow particle paths.
    const flows: FlowPath[] = [
      { curve: new THREE.CatmullRomCurve3([compTop, coilInlet]), color: COLOR.hpVapor, particleCount: 3, speedScale: 1 },
      { curve: new THREE.CatmullRomCurve3([coilInlet, coilOutlet]), color: COLOR.hpVapor, particleCount: 3, speedScale: 0.7 },
      {
        curve: new THREE.CatmullRomCurve3([coilOutlet, recvIn, drierPos, sightPos, liquidValvePos, liquidOut]),
        color: COLOR.hpLiquid,
        particleCount: 4,
        speedScale: 1,
      },
      {
        curve: new THREE.CatmullRomCurve3([suctionIn, suctionValvePos, accTop, compSuction]),
        color: COLOR.lpVapor,
        particleCount: 4,
        speedScale: 1,
      },
    ];
    const particleGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const particles: THREE.Mesh[] = [];
    flows.forEach((flow) => {
      for (let i = 0; i < flow.particleCount; i++) {
        const mat = new THREE.MeshStandardMaterial({
          color: flow.color,
          emissive: flow.color,
          emissiveIntensity: 0.8,
        });
        const p = new THREE.Mesh(particleGeo, mat);
        p.userData.flowIndex = flows.indexOf(flow);
        p.userData.phase = i / flow.particleCount;
        interior.add(p);
        particles.push(p);
      }
    });
    stateRef.current.flows = flows;
    stateRef.current.particles = particles;

    // Labels.
    const labelSpecs: [ComponentKey, THREE.Vector3][] = [
      ["compressor", compBody.position.clone().add(new THREE.Vector3(0.55, 0.15, 0))],
      ["condenserCoil", new THREE.Vector3(0, boxH * 1.02, boxL * 0.35)],
      ["fan", new THREE.Vector3(0, boxH + 0.55, -boxL * 0.1)],
      ["receiver", recv.position.clone().add(new THREE.Vector3(0.15, 0.4, 0.1))],
      ["filterDrier", drierPos.clone().add(new THREE.Vector3(-0.05, 0.55, 0))],
      ["sightGlass", sightPos.clone().add(new THREE.Vector3(-0.15, -0.4, 0))],
      ["accumulator", acc.position.clone().add(new THREE.Vector3(-0.55, 0.65, 0.15))],
      ["suctionValve", suctionValvePos.clone().add(new THREE.Vector3(0.75, 0.45, 0))],
      ["liquidValve", liquidValvePos.clone().add(new THREE.Vector3(0.75, -0.55, 0))],
    ];
    const labels: THREE.Sprite[] = [];
    labelSpecs.forEach(([key, pos]) => {
      const info = COMPONENT_LIST.find((c) => c.key === key)!;
      const sprite = makeLabelSprite(info.label);
      sprite.position.copy(pos);
      interior.add(sprite);
      labels.push(sprite);
    });
    stateRef.current.labelSprites = labels;

    // Raycasting for click-to-isolate.
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    function onClick(ev: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interior.children, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && !obj.userData.componentKey) obj = obj.parent;
        if (obj?.userData.componentKey) {
          propsRef.current.onSelectComponent(obj.userData.componentKey as ComponentKey);
          return;
        }
      }
      propsRef.current.onSelectComponent(null);
    }
    renderer.domElement.addEventListener("click", onClick);

    let raf = 0;
    const clock = new THREE.Clock();
    function animate() {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const { cutaway, showLabels, speed, isolated } = propsRef.current;

      solidPanels.forEach((p) => {
        p.visible = !(cutaway && (p === frontPanel || p === topPanel));
      });

      bladeHub.rotation.y += dt * 6 * speed;

      const comp = stateRef.current.componentGroups.compressor!;
      const orbitCenter: THREE.Vector3 = comp.userData.orbitCenter;
      const t = performance.now() / 1000;
      const orbitR = 0.045;
      orbitIndicator.position.set(
        orbitCenter.x + Math.cos(t * 8 * speed) * orbitR,
        orbitCenter.y,
        orbitCenter.z + Math.sin(t * 8 * speed) * orbitR
      );

      particles.forEach((p) => {
        const flow = flows[p.userData.flowIndex as number];
        if (!flow) return;
        const progress = (t * 0.25 * speed * flow.speedScale + p.userData.phase) % 1;
        const pos = flow.curve.getPointAt(progress);
        p.position.copy(pos);
        p.visible = speed > 0;
      });

      labels.forEach((l) => (l.visible = showLabels));

      Object.entries(stateRef.current.componentGroups).forEach(([k, g]) => {
        const dim = isolated !== null && isolated !== k;
        g!.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
          if (!mat) return;
          mat.transparent = true;
          mat.opacity = dim ? 0.1 : (mat.userData.baseOpacity as number | undefined) ?? 1;
        });
      });
      // Particle flow markers dim along with their source/destination
      // components isn't tracked per-particle - keep them at full brightness
      // regardless of isolation so the cycle stays legible while inspecting
      // one part.
      particles.forEach((p) => {
        (p.material as THREE.MeshStandardMaterial).opacity = 1;
        (p.material as THREE.MeshStandardMaterial).transparent = false;
      });

      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
