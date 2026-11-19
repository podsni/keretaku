import * as maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import type { Car3DPose, Train3DPose } from './eta';

interface LiveryVisual {
  body: string;
  roof: string;
  stripe1: string;
  stripe2: string;
  windowBand: string;
  accentNose: string;
  metallic?: boolean;
  pantograph?: boolean;
  tank?: boolean;
  container?: boolean;
  flat?: boolean;
  hopper?: boolean;
  box?: boolean;
}

const VISUALS: Record<string, LiveryVisual> = {
  // KAI Indonesian Locomotives & Passenger Coaches (authentic white + KAI orange & navy blue livery)
  cc206: {
    body: '#F5F7FA',
    roof: '#CFD6DF',
    stripe1: '#F7941D',
    stripe2: '#1F3A8A',
    windowBand: '#172030',
    accentNose: '#D7192D',
  },
  cc201: {
    body: '#F5F7FA',
    roof: '#CBD5E1',
    stripe1: '#F7941D',
    stripe2: '#1F3A8A',
    windowBand: '#172030',
    accentNose: '#D7192D',
  },
  coach: {
    body: '#F7F8FA',
    roof: '#D4DAE3',
    stripe1: '#F7941D',
    stripe2: '#1F3A8A',
    windowBand: '#1E293B',
    accentNose: '#F7941D',
  },
  coachP: {
    body: '#E8ECF1',
    roof: '#C4CCD7',
    stripe1: '#F7941D',
    stripe2: '#1F3A8A',
    windowBand: '#334155',
    accentNose: '#F7941D',
  },
  lokal: {
    body: '#F7F8FA',
    roof: '#D4DAE3',
    stripe1: '#F7941D',
    stripe2: '#1E3A8A',
    windowBand: '#1E293B',
    accentNose: '#D7192D',
  },
  argo: {
    body: '#CFD5DE',
    roof: '#B6BFC9',
    stripe1: '#E87722',
    stripe2: '#2B3A4D',
    windowBand: '#111827',
    accentNose: '#E87722',
    metallic: true,
  },
  argoP: {
    body: '#B9C1CC',
    roof: '#9CA6B3',
    stripe1: '#E87722',
    stripe2: '#2B3A4D',
    windowBand: '#334155',
    accentNose: '#E87722',
    metallic: true,
  },
  // Urban Rail EMUs
  krl: {
    body: '#DFE4EB',
    roof: '#C2C9D2',
    stripe1: '#E30A16',
    stripe2: '#FFC20E',
    windowBand: '#1A2332',
    accentNose: '#E30A16',
    metallic: true,
    pantograph: true,
  },
  mrt: {
    body: '#DDE3EA',
    roof: '#C2C9D2',
    stripe1: '#0B3A82',
    stripe2: '#38BDF8',
    windowBand: '#162030',
    accentNose: '#0B3A82',
    metallic: true,
    pantograph: true,
  },
  lrtj: {
    body: '#FFFFFF',
    roof: '#DCE1E8',
    stripe1: '#E8412C',
    stripe2: '#F7A21B',
    windowBand: '#162030',
    accentNose: '#E8412C',
  },
  jbdb: {
    body: '#F3F5F8',
    roof: '#D3D9E2',
    stripe1: '#1E40AF',
    stripe2: '#E30A16',
    windowBand: '#162030',
    accentNose: '#1E40AF',
  },
  whoosh: {
    body: '#FFFFFF',
    roof: '#E5E9EF',
    stripe1: '#D7192D',
    stripe2: '#94A3B8',
    windowBand: '#0F172A',
    accentNose: '#D7192D',
    pantograph: true,
  },
  ea203: {
    body: '#EDF0F4',
    roof: '#CFD6DF',
    stripe1: '#002B5C',
    stripe2: '#F39200',
    windowBand: '#162030',
    accentNose: '#002B5C',
    pantograph: true,
  },
  sky: {
    body: '#FFFFFF',
    roof: '#DCE3EC',
    stripe1: '#1E88E5',
    stripe2: '#90CAF9',
    windowBand: '#162030',
    accentNose: '#1E88E5',
  },
  // Freight Rolling Stock
  ketel: {
    body: '#E2E6EC',
    roof: '#CBD2DC',
    stripe1: '#D7192D',
    stripe2: '#1E293B',
    windowBand: '#1E293B',
    accentNose: '#D7192D',
    tank: true,
  },
  ketelB: {
    body: '#E2E6EC',
    roof: '#CBD2DC',
    stripe1: '#0067B1',
    stripe2: '#1E293B',
    windowBand: '#1E293B',
    accentNose: '#0067B1',
    tank: true,
  },
  ctrA: {
    body: '#1F5FA8',
    roof: '#1A528F',
    stripe1: '#123B66',
    stripe2: '#FFFFFF',
    windowBand: '#123B66',
    accentNose: '#1F5FA8',
    container: true,
  },
  ctrB: {
    body: '#D9631E',
    roof: '#BF5519',
    stripe1: '#8C3D10',
    stripe2: '#FFFFFF',
    windowBand: '#8C3D10',
    accentNose: '#D9631E',
    container: true,
  },
  ctrC: {
    body: '#2E7D4F',
    roof: '#266B43',
    stripe1: '#1A4A2E',
    stripe2: '#FFFFFF',
    windowBand: '#1A4A2E',
    accentNose: '#2E7D4F',
    container: true,
  },
  ctrD: {
    body: '#E4E7EC',
    roof: '#CDD3DC',
    stripe1: '#94A3B8',
    stripe2: '#334155',
    windowBand: '#334155',
    accentNose: '#94A3B8',
    container: true,
  },
  flat: {
    body: '#3B3E44',
    roof: '#2A2C30',
    stripe1: '#55595F',
    stripe2: '#2A2C30',
    windowBand: '#2A2C30',
    accentNose: '#55595F',
    flat: true,
  },
  bagasi: {
    body: '#EEF1F5',
    roof: '#CFD6DF',
    stripe1: '#1F3A8A',
    stripe2: '#F7941D',
    windowBand: '#475569',
    accentNose: '#F7941D',
    box: true,
  },
  tertutup: {
    body: '#7A6A58',
    roof: '#5E5042',
    stripe1: '#4A3F34',
    stripe2: '#A3917D',
    windowBand: '#4A3F34',
    accentNose: '#7A6A58',
    box: true,
  },
  hopper: {
    body: '#7B828B',
    roof: '#5F666F',
    stripe1: '#474D54',
    stripe2: '#A1A8B0',
    windowBand: '#474D54',
    accentNose: '#7B828B',
    hopper: true,
  },
};

function getVisual(liv: string): LiveryVisual {
  return VISUALS[liv] || VISUALS.coach;
}

/** Generate a crisp procedural side texture for coaches/EMUs with windows, doors & KAI livery stripes. */
function createCoachSideTexture(
  liv: string,
  vis: LiveryVisual,
  isGenerator: boolean,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;

  // Base body paint
  g.fillStyle = vis.body;
  g.fillRect(0, 0, w, h);

  // Subtle top eaves shadow & lower skirt crease
  g.fillStyle = 'rgba(15, 23, 42, 0.08)';
  g.fillRect(0, 0, w, 10);
  g.fillStyle = 'rgba(15, 23, 42, 0.14)';
  g.fillRect(0, h - 14, w, 14);

  // Lower horizontal livery stripes (KAI orange & blue ribbon)
  g.fillStyle = vis.stripe1;
  g.fillRect(0, h - 34, w, 13);
  g.fillStyle = vis.stripe2;
  g.fillRect(0, h - 21, w, 9);

  if (liv === 'whoosh') {
    // Sleek crimson diagonal speed swoosh
    g.fillStyle = vis.stripe1;
    g.fillRect(0, h - 38, w, 10);
    g.fillStyle = '#0F172A';
    g.fillRect(14, 34, w - 28, 36);
  }

  // Side doors near ends (or center doors for KRL/MRT/LRT)
  const isUrban =
    liv === 'krl' || liv === 'mrt' || liv === 'lrtj' || liv === 'jbdb' || liv === 'ea203' || liv === 'sky';

  if (isGenerator || vis.box) {
    // Generator / baggage car ventilation louvers + small service windows
    g.fillStyle = '#475569';
    for (let x = 36; x < w - 50; x += 58) {
      g.fillRect(x, 30, 40, 42);
      g.fillStyle = '#64748B';
      for (let y = 34; y < 70; y += 5) {
        g.fillRect(x + 3, y, 34, 2);
      }
      g.fillStyle = '#475569';
    }
  } else if (isUrban) {
    // Urban EMU: 4 pairs of sliding doors + panoramic dark windows between them
    const doorXs = [44, 166, 294, 418];
    for (const dx of doorXs) {
      g.fillStyle = 'rgba(15, 23, 42, 0.12)';
      g.fillRect(dx - 2, 16, 44, h - 26);
      g.fillStyle = vis.body;
      g.fillRect(dx, 18, 40, h - 28);
      // Door glass
      g.fillStyle = vis.windowBand;
      g.fillRect(dx + 4, 26, 14, 40);
      g.fillRect(dx + 22, 26, 14, 40);
      // Center seam
      g.fillStyle = 'rgba(15, 23, 42, 0.35)';
      g.fillRect(dx + 19, 18, 2, h - 28);
    }
    // Windows between doors
    const winSpans: [number, number][] = [
      [94, 62],
      [216, 68],
      [344, 64],
    ];
    for (const [wx, ww] of winSpans) {
      g.fillStyle = vis.windowBand;
      g.fillRect(wx, 28, ww, 38);
      // Specular glass highlight
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(wx + 3, 30, ww - 6, 8);
      // Center mullion
      g.fillStyle = '#94A3B8';
      g.fillRect(wx + ww * 0.5 - 1, 28, 2, 38);
    }
  } else {
    // KAI Intercity / Local Coach: end doors + 8 crisp passenger windows in dark ribbon
    // End entrance doors
    for (const dx of [10, w - 38]) {
      g.fillStyle = 'rgba(15, 23, 42, 0.14)';
      g.fillRect(dx, 18, 28, h - 28);
      g.fillStyle = vis.body;
      g.fillRect(dx + 2, 20, 24, h - 30);
      g.fillStyle = vis.windowBand;
      g.fillRect(dx + 6, 30, 16, 26);
      g.fillStyle = vis.stripe1;
      g.fillRect(dx + 2, h - 34, 24, 13);
      g.fillStyle = vis.stripe2;
      g.fillRect(dx + 2, h - 21, 24, 9);
    }

    // Continuous dark window mask band (authentic KAI New Image / Stainless Steel look!)
    g.fillStyle = '#273244';
    g.fillRect(48, 26, w - 96, 42);

    // Individual glossy tinted windows with frames
    const winCount = 8;
    const startX = 56;
    const totalW = w - 112;
    const step = totalW / winCount;
    for (let i = 0; i < winCount; i++) {
      const wx = startX + i * step + 3;
      const ww = step - 7;
      g.fillStyle = '#0F172A';
      g.fillRect(wx, 30, ww, 34);
      // Glass sky sheen
      g.fillStyle = 'rgba(148, 197, 255, 0.22)';
      g.fillRect(wx + 2, 32, ww - 4, 9);
      // Warm subtle interior glow hint
      g.fillStyle = 'rgba(254, 243, 199, 0.12)';
      g.fillRect(wx + 2, 48, ww - 4, 13);
    }

    // Subtle stainless-steel horizontal corrugation for Argo coaches
    if (vis.metallic) {
      g.fillStyle = 'rgba(255, 255, 255, 0.18)';
      for (let y = 74; y < h - 36; y += 5) {
        g.fillRect(46, y, w - 92, 1.5);
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

/** Generate a procedural side texture for KAI CC201 / CC206 locomotives. */
function createLocoSideTexture(liv: string, vis: LiveryVisual, maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;

  g.fillStyle = vis.body;
  g.fillRect(0, 0, w, h);

  // KAI dynamic chevron / angled orange & navy stripe along engine hood
  g.fillStyle = vis.stripe1;
  g.fillRect(0, h - 42, w, 18);
  g.fillStyle = vis.stripe2;
  g.fillRect(0, h - 24, w, 12);

  // Diagonal KAI accent flash near the cab
  g.fillStyle = vis.stripe1;
  g.beginPath();
  g.moveTo(w * 0.64, h - 42);
  g.lineTo(w * 0.72, 18);
  g.lineTo(w * 0.79, 18);
  g.lineTo(w * 0.71, h - 42);
  g.closePath();
  g.fill();

  g.fillStyle = vis.stripe2;
  g.beginPath();
  g.moveTo(w * 0.72, h - 24);
  g.lineTo(w * 0.80, 18);
  g.lineTo(w * 0.84, 18);
  g.lineTo(w * 0.76, h - 24);
  g.closePath();
  g.fill();

  // Engine radiator grilles along rear hood
  g.fillStyle = '#64748B';
  for (let x = 28; x < w * 0.54; x += 48) {
    g.fillRect(x, 22, 34, 44);
    g.fillStyle = '#334155';
    for (let y = 26; y < 64; y += 5) {
      g.fillRect(x + 3, y, 28, 2);
    }
    g.fillStyle = '#64748B';
  }

  // Cab side window near front
  g.fillStyle = '#0F172A';
  g.fillRect(w * 0.84, 24, 54, 34);
  g.fillStyle = 'rgba(186, 230, 253, 0.28)';
  g.fillRect(w * 0.84 + 3, 27, 48, 9);

  // Red front bumper trim on CC201/CC206
  if (liv === 'cc201' || liv === 'cc206') {
    g.fillStyle = vis.accentNose;
    g.fillRect(w - 18, h - 44, 18, 36);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

interface ResourcePool {
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  textures: THREE.Texture[];
  sideTexCache: Map<string, THREE.CanvasTexture>;
  matCache: Map<string, THREE.Material>;
  unitGeoCache: Map<string, THREE.BufferGeometry>;
}

function createPool(): ResourcePool {
  return {
    geometries: [],
    materials: [],
    textures: [],
    sideTexCache: new Map(),
    matCache: new Map(),
    unitGeoCache: new Map(),
  };
}

function disposePool(pool: ResourcePool) {
  for (const g of pool.geometries) g.dispose();
  for (const m of pool.materials) m.dispose();
  for (const t of pool.textures) t.dispose();
  pool.geometries.length = 0;
  pool.materials.length = 0;
  pool.textures.length = 0;
  pool.sideTexCache.clear();
  pool.matCache.clear();
  pool.unitGeoCache.clear();
}

function getBoxGeo(pool: ResourcePool, w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `box_${w.toFixed(2)}_${h.toFixed(2)}_${d.toFixed(2)}`;
  let g = pool.unitGeoCache.get(key) as THREE.BoxGeometry | undefined;
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    pool.unitGeoCache.set(key, g);
    pool.geometries.push(g);
  }
  return g;
}

function getCylGeo(pool: ResourcePool, r: number, len: number, segs = 12): THREE.CylinderGeometry {
  const key = `cyl_${r.toFixed(2)}_${len.toFixed(2)}_${segs}`;
  let g = pool.unitGeoCache.get(key) as THREE.CylinderGeometry | undefined;
  if (!g) {
    g = new THREE.CylinderGeometry(r, r, len, segs);
    pool.unitGeoCache.set(key, g);
    pool.geometries.push(g);
  }
  return g;
}

function getStdMat(
  pool: ResourcePool,
  key: string,
  params: THREE.MeshStandardMaterialParameters,
): THREE.MeshLambertMaterial {
  let m = pool.matCache.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    const opts: THREE.MeshLambertMaterialParameters = {
      transparent: params.transparent ?? false,
      opacity: params.opacity ?? 1,
      depthWrite: params.depthWrite ?? true,
    };
    if (params.color !== undefined) opts.color = params.color;
    if (params.map !== undefined) opts.map = params.map;
    if (params.emissive !== undefined) opts.emissive = params.emissive;
    if (params.emissiveIntensity !== undefined) opts.emissiveIntensity = params.emissiveIntensity;
    m = new THREE.MeshLambertMaterial(opts);
    pool.matCache.set(key, m);
    pool.materials.push(m);
  }
  return m;
}

/** Add twin realistic bogies + axles + contact shadow under any car, sitting flush on y=0. */
function addUnderframeAndBogies(
  group: THREE.Group,
  pool: ResourcePool,
  width: number,
  length: number,
  bodyBottomY: number,
) {
  const chassisMat = getStdMat(pool, 'chassis', {
    color: '#1E232B',
    roughness: 0.85,
    metalness: 0.25,
  });
  const bogieMat = getStdMat(pool, 'bogie', {
    color: '#12161D',
    roughness: 0.65,
    metalness: 0.5,
  });
  const wheelMat = getStdMat(pool, 'wheel', {
    color: '#3B424D',
    roughness: 0.4,
    metalness: 0.8,
  });
  const shadowMat = getStdMat(pool, 'contact_shadow', {
    color: '#090D16',
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });

  // Grounded contact shadow directly at rail height (y = 0.04m)
  const shadow = new THREE.Mesh(getBoxGeo(pool, width + 0.55, 0.02, length + 0.4), shadowMat);
  shadow.position.set(0, 0.04, 0);
  group.add(shadow);

  // Main underframe beam
  const beam = new THREE.Mesh(getBoxGeo(pool, width * 0.86, 0.34, length * 0.96), chassisMat);
  beam.position.set(0, bodyBottomY - 0.16, 0);
  group.add(beam);

  // Underfloor equipment box in center
  const equip = new THREE.Mesh(getBoxGeo(pool, width * 0.68, 0.42, Math.min(4.8, length * 0.28)), chassisMat);
  equip.position.set(0, bodyBottomY - 0.38, 0);
  group.add(equip);

  // Twin bogie trucks positioned at +/- 31% of length
  const bogieZ = Math.max(2.2, length * 0.31);
  const wheelGeo = getCylGeo(pool, 0.42, width * 0.78, 10);
  for (const sign of [-1, 1]) {
    const zPos = sign * bogieZ;
    const frame = new THREE.Mesh(getBoxGeo(pool, width * 0.78, 0.46, 2.7), bogieMat);
    frame.position.set(0, 0.52, zPos);
    group.add(frame);

    for (const axOff of [-0.9, 0.9]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.42, zPos + axOff);
      group.add(wheel);
    }
  }
}

/** Build a composite multi-part 3D Indonesian locomotive (CC201 / CC206) facing +Z. */
function buildLocomotiveGroup(
  pool: ResourcePool,
  car: Car3DPose,
  vis: LiveryVisual,
  maxAnisotropy: number,
): THREE.Group {
  const g = new THREE.Group();
  const W = 2.95;
  const L = car.lengthM;
  const baseY = 1.05;

  addUnderframeAndBogies(g, pool, W, L, baseY);

  const bodyMat = getStdMat(pool, `body_${car.liv}`, {
    color: vis.body,
    roughness: 0.36,
    metalness: 0.16,
  });
  const roofMat = getStdMat(pool, `roof_${car.liv}`, {
    color: vis.roof,
    roughness: 0.55,
    metalness: 0.22,
  });
  const redPilotMat = getStdMat(pool, `pilot_${vis.accentNose}`, {
    color: vis.accentNose,
    roughness: 0.42,
    metalness: 0.15,
  });
  const orangeMat = getStdMat(pool, `s1_${car.liv}`, {
    color: vis.stripe1,
    roughness: 0.38,
    metalness: 0.12,
  });
  const blueMat = getStdMat(pool, `s2_${car.liv}`, {
    color: vis.stripe2,
    roughness: 0.38,
    metalness: 0.15,
  });
  const glassMat = getStdMat(pool, 'cab_glass', {
    color: '#111A2B',
    roughness: 0.12,
    metalness: 0.72,
  });
  const darkMetalMat = getStdMat(pool, 'dark_metal', {
    color: '#374151',
    roughness: 0.6,
    metalness: 0.45,
  });
  const headlightMat = getStdMat(pool, 'headlight', {
    color: '#FFF8C5',
    emissive: '#FFE885',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  // Side texture for locomotive flanks
  const texKey = `loco_${car.liv}`;
  let sideTex = pool.sideTexCache.get(texKey);
  if (!sideTex) {
    sideTex = createLocoSideTexture(car.liv, vis, maxAnisotropy);
    pool.sideTexCache.set(texKey, sideTex);
    pool.textures.push(sideTex);
  }
  const sideMat = getStdMat(pool, `mat_${texKey}`, {
    map: sideTex,
    roughness: 0.38,
    metalness: 0.14,
  });

  // 1. Main engine hood + dual/single cab body
  const hoodLen = L * 0.88;
  const hoodH = 2.48;
  const hoodMats = [sideMat, sideMat, roofMat, bodyMat, bodyMat, bodyMat];
  const mainBody = new THREE.Mesh(getBoxGeo(pool, W, hoodH, hoodLen), hoodMats);
  mainBody.position.set(0, baseY + hoodH * 0.5, -L * 0.03);
  g.add(mainBody);

  // 2. Iconic sloped front cab / short nose (CC206 dual-cab or CC201 short-hood nose)
  const noseLen = L * 0.14;
  const noseH = car.liv === 'cc201' ? 1.55 : 2.15;
  const nose = new THREE.Mesh(getBoxGeo(pool, W * 0.94, noseH, noseLen), bodyMat);
  nose.position.set(0, baseY + noseH * 0.5, L * 0.42);
  g.add(nose);

  // Orange & blue wraparound nose stripes
  const noseOrange = new THREE.Mesh(getBoxGeo(pool, W * 0.96, 0.44, noseLen + 0.06), orangeMat);
  noseOrange.position.set(0, baseY + 0.65, L * 0.42);
  g.add(noseOrange);
  const noseBlue = new THREE.Mesh(getBoxGeo(pool, W * 0.96, 0.26, noseLen + 0.06), blueMat);
  noseBlue.position.set(0, baseY + 0.3, L * 0.42);
  g.add(noseBlue);

  // 3. Raised cab roof + sloped panoramic front windshield
  const cabRoof = new THREE.Mesh(getBoxGeo(pool, W * 0.96, 0.32, L * 0.9), roofMat);
  cabRoof.position.set(0, baseY + hoodH + 0.16, -L * 0.03);
  g.add(cabRoof);

  const frontWindshield = new THREE.Mesh(getBoxGeo(pool, W * 0.78, 0.72, 0.2), glassMat);
  frontWindshield.position.set(0, baseY + hoodH - 0.52, L * 0.415);
  frontWindshield.rotation.x = -0.18;
  g.add(frontWindshield);

  // 4. Prominent Red Front Cowcatcher / Pilot Skirt (exact visual signature of KAI locos!)
  const frontPilot = new THREE.Mesh(getBoxGeo(pool, W * 0.98, 0.62, 0.85), redPilotMat);
  frontPilot.position.set(0, baseY - 0.22, L * 0.485);
  g.add(frontPilot);

  const rearPilot = new THREE.Mesh(getBoxGeo(pool, W * 0.94, 0.46, 0.42), redPilotMat);
  rearPilot.position.set(0, baseY - 0.22, -L * 0.49);
  g.add(rearPilot);

  // 5. Rooftop mechanical details (exhaust stack, radiator fan pods, cab AC)
  const rad1 = new THREE.Mesh(getBoxGeo(pool, W * 0.62, 0.28, 2.2), darkMetalMat);
  rad1.position.set(0, baseY + hoodH + 0.42, -L * 0.22);
  g.add(rad1);

  const exhaust = new THREE.Mesh(getBoxGeo(pool, 0.68, 0.34, 1.05), darkMetalMat);
  exhaust.position.set(0, baseY + hoodH + 0.45, L * 0.05);
  g.add(exhaust);

  const cabAc = new THREE.Mesh(getBoxGeo(pool, 1.35, 0.24, 1.1), roofMat);
  cabAc.position.set(0, baseY + hoodH + 0.4, L * 0.27);
  g.add(cabAc);

  // 6. Glowing dual headlights + upper center beam
  for (const sx of [-0.75, 0.75]) {
    const hl = new THREE.Mesh(getBoxGeo(pool, 0.32, 0.24, 0.12), headlightMat);
    hl.position.set(sx, baseY + 0.82, L * 0.495);
    g.add(hl);
  }
  const topBeam = new THREE.Mesh(getBoxGeo(pool, 0.42, 0.2, 0.12), headlightMat);
  topBeam.position.set(0, baseY + hoodH - 0.14, L * 0.42);
  g.add(topBeam);

  return g;
}

/** Build a composite multi-part 3D passenger coach, EMU car, or Whoosh high-speed car facing +Z. */
function buildPassengerCarGroup(
  pool: ResourcePool,
  car: Car3DPose,
  vis: LiveryVisual,
  maxAnisotropy: number,
): THREE.Group {
  const g = new THREE.Group();
  const isWhoosh = car.liv === 'whoosh';
  const W = isWhoosh ? 3.25 : 2.95;
  const L = car.lengthM;
  const baseY = 1.02;
  const bodyH = isWhoosh ? 2.55 : 2.42;

  addUnderframeAndBogies(g, pool, W, L, baseY);

  const isGenerator = car.liv === 'coachP' || car.liv === 'argoP';
  const texKey = `coach_${car.liv}`;
  let sideTex = pool.sideTexCache.get(texKey);
  if (!sideTex) {
    sideTex = createCoachSideTexture(car.liv, vis, isGenerator, maxAnisotropy);
    pool.sideTexCache.set(texKey, sideTex);
    pool.textures.push(sideTex);
  }

  const sideMat = getStdMat(pool, `mat_${texKey}`, {
    map: sideTex,
    roughness: vis.metallic ? 0.28 : 0.38,
    metalness: vis.metallic ? 0.48 : 0.12,
  });
  const endMat = getStdMat(pool, `end_${car.liv}`, {
    color: vis.body,
    roughness: vis.metallic ? 0.3 : 0.4,
    metalness: vis.metallic ? 0.45 : 0.12,
  });
  const roofMat = getStdMat(pool, `roof_${car.liv}`, {
    color: vis.roof,
    roughness: 0.52,
    metalness: vis.metallic ? 0.35 : 0.18,
  });
  const acMat = getStdMat(pool, 'roof_ac', {
    color: '#94A3B8',
    roughness: 0.55,
    metalness: 0.3,
  });
  const gangwayMat = getStdMat(pool, 'gangway', {
    color: '#1E242E',
    roughness: 0.85,
    metalness: 0.1,
  });
  const glassMat = getStdMat(pool, 'cab_glass', {
    color: '#0F172A',
    roughness: 0.1,
    metalness: 0.78,
  });

  // Main carbody shell (with side textures on +X / -X faces!)
  const noseLen = isWhoosh && car.cab ? 6.2 : car.cab ? 1.15 : 0;
  const bodyLen = Math.max(4, L - noseLen);
  const bodyZ = car.cab === 'f' ? -noseLen * 0.5 : car.cab === 'r' ? noseLen * 0.5 : 0;

  const boxMats = [sideMat, sideMat, roofMat, endMat, endMat, endMat];
  const shell = new THREE.Mesh(getBoxGeo(pool, W, bodyH, bodyLen), boxMats);
  shell.position.set(0, baseY + bodyH * 0.5, bodyZ);
  g.add(shell);

  // Crowned rounded roof cap
  const roofCap = new THREE.Mesh(getBoxGeo(pool, W * 0.86, 0.26, bodyLen * 0.98), roofMat);
  roofCap.position.set(0, baseY + bodyH + 0.13, bodyZ);
  g.add(roofCap);

  // Twin rooftop AC condenser pods (characteristic silhouette of KAI & KRL coaches!)
  for (const zOff of [-bodyLen * 0.26, bodyLen * 0.26]) {
    const ac = new THREE.Mesh(getBoxGeo(pool, W * 0.58, 0.24, Math.min(2.8, bodyLen * 0.18)), acMat);
    ac.position.set(0, baseY + bodyH + 0.34, bodyZ + zOff);
    g.add(ac);
  }

  // Pantograph frame on alternate electric cars
  if (vis.pantograph && car.index % 2 === 1) {
    const pantoMat = getStdMat(pool, 'panto', { color: '#475569', roughness: 0.45, metalness: 0.65 });
    const base = new THREE.Mesh(getBoxGeo(pool, 1.35, 0.14, 1.4), pantoMat);
    base.position.set(0, baseY + bodyH + 0.34, bodyZ);
    g.add(base);
    const arm = new THREE.Mesh(getBoxGeo(pool, 0.12, 0.72, 1.1), pantoMat);
    arm.position.set(0, baseY + bodyH + 0.72, bodyZ);
    arm.rotation.x = 0.45;
    g.add(arm);
    const pan = new THREE.Mesh(getBoxGeo(pool, 1.65, 0.08, 0.22), pantoMat);
    pan.position.set(0, baseY + bodyH + 1.05, bodyZ + 0.15);
    g.add(pan);
  }

  // Inter-car dark accordion gangways at non-cab ends
  if (car.cab !== 'f') {
    const gwF = new THREE.Mesh(getBoxGeo(pool, W * 0.58, bodyH * 0.82, 0.55), gangwayMat);
    gwF.position.set(0, baseY + bodyH * 0.46, L * 0.5 + 0.18);
    g.add(gwF);
  }
  if (car.cab !== 'r') {
    const gwR = new THREE.Mesh(getBoxGeo(pool, W * 0.58, bodyH * 0.82, 0.55), gangwayMat);
    gwR.position.set(0, baseY + bodyH * 0.46, -L * 0.5 - 0.18);
    g.add(gwR);
  }

  // Aerodynamic nose / EMU cab end
  if (car.cab) {
    const dir = car.cab === 'f' ? 1 : -1;
    const accentMat = getStdMat(pool, `accent_${car.liv}`, {
      color: vis.accentNose,
      roughness: 0.32,
      metalness: 0.2,
    });
    const lightMat = getStdMat(pool, car.cab === 'f' ? 'headlight' : 'taillight', {
      color: car.cab === 'f' ? '#FFF8C5' : '#FF2A36',
      emissive: car.cab === 'f' ? '#FFE885' : '#E11D48',
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });

    if (isWhoosh) {
      // Multi-stage tapered high-speed bullet nose
      const seg1 = new THREE.Mesh(getBoxGeo(pool, W * 0.92, bodyH * 0.82, noseLen * 0.52), endMat);
      seg1.position.set(0, baseY + bodyH * 0.41, dir * (L * 0.5 - noseLen * 0.74));
      g.add(seg1);

      const seg2 = new THREE.Mesh(getBoxGeo(pool, W * 0.72, bodyH * 0.52, noseLen * 0.48), endMat);
      seg2.position.set(0, baseY + bodyH * 0.26, dir * (L * 0.5 - noseLen * 0.28));
      g.add(seg2);

      const tip = new THREE.Mesh(getBoxGeo(pool, W * 0.46, bodyH * 0.3, noseLen * 0.22), accentMat);
      tip.position.set(0, baseY + 0.42, dir * (L * 0.5 - noseLen * 0.08));
      g.add(tip);

      // Swept dark cockpit visor
      const visor = new THREE.Mesh(getBoxGeo(pool, W * 0.78, 0.64, noseLen * 0.34), glassMat);
      visor.position.set(0, baseY + bodyH * 0.72, dir * (L * 0.5 - noseLen * 0.62));
      visor.rotation.x = dir * -0.35;
      g.add(visor);
    } else {
      // Sleek EMU cab front (KRL, MRT, LRT, Bandara)
      const cabBlock = new THREE.Mesh(getBoxGeo(pool, W * 0.96, bodyH * 0.96, noseLen), accentMat);
      cabBlock.position.set(0, baseY + bodyH * 0.48, dir * (L * 0.5 - noseLen * 0.5));
      g.add(cabBlock);

      const ws = new THREE.Mesh(getBoxGeo(pool, W * 0.8, 0.86, 0.2), glassMat);
      ws.position.set(0, baseY + bodyH * 0.66, dir * (L * 0.5 - 0.06));
      ws.rotation.x = dir * -0.12;
      g.add(ws);

      for (const sx of [-0.82, 0.82]) {
        const lamp = new THREE.Mesh(getBoxGeo(pool, 0.3, 0.2, 0.14), lightMat);
        lamp.position.set(sx, baseY + 0.52, dir * (L * 0.5 + 0.02));
        g.add(lamp);
      }
    }
  }

  return g;
}

/** Build composite 3D freight wagons (tanker cylinders, intermodal containers, flatcars, hoppers). */
function buildFreightCarGroup(pool: ResourcePool, car: Car3DPose, vis: LiveryVisual): THREE.Group {
  const g = new THREE.Group();
  const W = 2.78;
  const L = car.lengthM;
  const baseY = 0.98;

  addUnderframeAndBogies(g, pool, W, L, baseY);

  const deckMat = getStdMat(pool, 'freight_deck', {
    color: '#2B303A',
    roughness: 0.78,
    metalness: 0.35,
  });
  const bodyMat = getStdMat(pool, `fbody_${car.liv}`, {
    color: vis.body,
    roughness: vis.tank ? 0.35 : 0.6,
    metalness: vis.tank ? 0.45 : 0.2,
  });
  const stripeMat = getStdMat(pool, `fstripe_${car.liv}`, {
    color: vis.stripe1,
    roughness: 0.5,
    metalness: 0.2,
  });

  // Flatcar deck
  const deck = new THREE.Mesh(getBoxGeo(pool, W, 0.26, L * 0.96), deckMat);
  deck.position.set(0, baseY + 0.13, 0);
  g.add(deck);

  if (vis.tank) {
    // Cylindrical fuel/chemical tanker drum + top hatch dome
    const drum = new THREE.Mesh(getCylGeo(pool, 1.15, L * 0.84, 14), bodyMat);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, baseY + 1.42, 0);
    g.add(drum);

    const band = new THREE.Mesh(getCylGeo(pool, 1.17, L * 0.18, 14), stripeMat);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, baseY + 1.42, 0);
    g.add(band);

    const dome = new THREE.Mesh(getCylGeo(pool, 0.42, 0.38, 10), deckMat);
    dome.position.set(0, baseY + 2.62, 0);
    g.add(dome);
  } else if (vis.container) {
    // Intermodal ISO shipping container on flatcar
    const ctr = new THREE.Mesh(getBoxGeo(pool, W * 0.9, 2.38, L * 0.84), bodyMat);
    ctr.position.set(0, baseY + 0.26 + 1.19, 0);
    g.add(ctr);
    // Container end doors trim
    const rib = new THREE.Mesh(getBoxGeo(pool, W * 0.92, 0.22, L * 0.86), stripeMat);
    rib.position.set(0, baseY + 2.48, 0);
    g.add(rib);
  } else if (!vis.flat) {
    // Boxcar / Hopper wagon
    const box = new THREE.Mesh(getBoxGeo(pool, W * 0.92, 2.2, L * 0.88), bodyMat);
    box.position.set(0, baseY + 0.26 + 1.1, 0);
    g.add(box);
    const roof = new THREE.Mesh(getBoxGeo(pool, W * 0.86, 0.22, L * 0.86), stripeMat);
    roof.position.set(0, baseY + 2.52, 0);
    g.add(roof);
  }

  return g;
}

function buildCarGroup(
  pool: ResourcePool,
  car: Car3DPose,
  maxAnisotropy: number,
): THREE.Group {
  const vis = getVisual(car.liv);
  if (car.loco) return buildLocomotiveGroup(pool, car, vis, maxAnisotropy);
  if (vis.tank || vis.container || vis.flat || vis.hopper || vis.box) {
    return buildFreightCarGroup(pool, car, vis);
  }
  return buildPassengerCarGroup(pool, car, vis, maxAnisotropy);
}

// Pre-allocated math helpers outside render loop (zero per-frame GC)
const _mvp = new THREE.Matrix4();
const _localMat = new THREE.Matrix4();
const _rotX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
const _scaleVec = new THREE.Vector3();
const _transMat = new THREE.Matrix4();
const _scaleMat = new THREE.Matrix4();
const _railForward = new THREE.Vector3();

/**
 * Create a MapLibre GL 3D Custom Layer powered by Three.js that renders
 * realistic articulated multi-part 3D Indonesian trains and track sleepers directly on the map.
 */
export function createTrain3DLayer(
  getPoses: () => Train3DPose[],
  getTheme: () => 'light' | 'dark',
): maplibregl.CustomLayerInterface {
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.Camera | null = null;
  let keyLight: THREE.DirectionalLight | null = null;
  let hemiLight: THREE.HemisphereLight | null = null;
  let trainsRoot: THREE.Group | null = null;
  let railsRoot: THREE.Group | null = null;
  let pool: ResourcePool | null = null;
  let maxAnisotropy = 4;

  // Cache assembled train car groups keyed by `${trainId}|${stockKey}` so meshes aren't rebuilt every frame
  const trainMeshCache = new Map<string, THREE.Group[]>();

  // Reusable 3D sleeper/rail/ballast pool for the selected train's immediate track bed
  const sleeperMeshes: THREE.Mesh[] = [];
  const railSegmentMeshes: THREE.Mesh[] = [];
  const ballastMeshes: THREE.Mesh[] = [];

  return {
    id: 'trains-3d',
    type: 'custom',
    renderingMode: '3d',

    onAdd(map: maplibregl.Map, gl: WebGL2RenderingContext) {
      pool = createPool();
      scene = new THREE.Scene();
      camera = new THREE.Camera();

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 4);

      // Bright daylight studio-outdoor rig so white/orange/blue/red liveries read vividly from EVERY camera angle
      const ambient = new THREE.AmbientLight('#FFFFFF', 0.95);
      scene.add(ambient);

      hemiLight = new THREE.HemisphereLight('#FFFFFF', '#94A3B8', 1.15);
      scene.add(hemiLight);

      keyLight = new THREE.DirectionalLight('#FFFBF0', 1.15);
      keyLight.position.set(60, 130, 80);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight('#EEF6FF', 0.85);
      fillLight.position.set(-70, 95, -65);
      scene.add(fillLight);

      railsRoot = new THREE.Group();
      trainsRoot = new THREE.Group();
      scene.add(railsRoot);
      scene.add(trainsRoot);

      // Pre-allocate ballast, sleeper & twin rail strip meshes for smooth curve rendering under tracked train
      const ballastGeo = getBoxGeo(pool, 3.6, 0.03, 1);
      const ballastMat = getStdMat(pool, 'rail_ballast', {
        color: '#9CA3AF',
        roughness: 1,
        metalness: 0,
      });
      const sleeperGeo = getBoxGeo(pool, 2.55, 0.08, 0.28);
      const sleeperMat = getStdMat(pool, 'rail_sleeper', {
        color: '#57534E',
        roughness: 0.92,
        metalness: 0.05,
      });
      const railGeo = getBoxGeo(pool, 0.11, 0.12, 1);
      const railMat = getStdMat(pool, 'rail_steel', {
        color: '#CBD5E1',
        roughness: 0.35,
        metalness: 0.78,
      });

      for (let i = 0; i < 64; i++) {
        const bm = new THREE.Mesh(ballastGeo, ballastMat);
        bm.visible = false;
        railsRoot.add(bm);
        ballastMeshes.push(bm);
      }
      for (let i = 0; i < 240; i++) {
        const sm = new THREE.Mesh(sleeperGeo, sleeperMat);
        sm.visible = false;
        railsRoot.add(sm);
        sleeperMeshes.push(sm);
      }
      for (let i = 0; i < 128; i++) {
        const rm = new THREE.Mesh(railGeo, railMat);
        rm.visible = false;
        railsRoot.add(rm);
        railSegmentMeshes.push(rm);
      }
    },

    render(_gl: WebGL2RenderingContext, options: maplibregl.CustomRenderMethodInput) {
      if (!renderer || !scene || !camera || !trainsRoot || !railsRoot || !pool) return;

      const poses = getPoses();
      if (!poses.length) return;

      // Pick local meter origin at the selected train (or first visible train) to eliminate float32 jitter
      const anchorTrain = poses.find((p) => p.selected) || poses[0];
      const origin = maplibregl.MercatorCoordinate.fromLngLat(anchorTrain.headLngLat, 0);
      const meterScale = origin.meterInMercatorCoordinateUnits();
      if (!Number.isFinite(meterScale) || meterScale <= 0) return;

      // Adapt ambient brightness subtly for dark vs light basemap
      const isDark = getTheme() === 'dark';
      if (hemiLight) hemiLight.intensity = isDark ? 0.95 : 1.15;
      if (keyLight) keyLight.intensity = isDark ? 1.0 : 1.2;

      // Sync active train meshes
      const activeKeys = new Set<string>();
      for (const tr of poses) {
        const cacheKey = `${tr.id}|${tr.stockKey}|${tr.cars.length}`;
        activeKeys.add(cacheKey);

        let carGroups = trainMeshCache.get(cacheKey);
        if (!carGroups) {
          carGroups = tr.cars.map((car) => {
            const grp = buildCarGroup(pool!, car, maxAnisotropy);
            // Subtle rail-twin cross-section scale so windows, livery & bogies read heroically at zoom 18
            grp.scale.set(1.22, 1.26, 1.0);
            trainsRoot!.add(grp);
            return grp;
          });
          trainMeshCache.set(cacheKey, carGroups);
        }

        for (let i = 0; i < tr.cars.length && i < carGroups.length; i++) {
          const car = tr.cars[i];
          const grp = carGroups[i];
          const mc = maplibregl.MercatorCoordinate.fromLngLat(car.centerLngLat, 0);
          const x = (mc.x - origin.x) / meterScale;
          const z = -(mc.y - origin.y) / meterScale;

          grp.visible = true;
          grp.position.set(x, 0.1, z);
          grp.rotation.set(0, (car.bearingDeg * Math.PI) / 180, 0);
        }
      }

      // Hide any cached trains no longer in view (and evict if cache grows large)
      for (const [k, groups] of trainMeshCache.entries()) {
        if (!activeKeys.has(k)) {
          if (trainMeshCache.size > 24) {
            for (const grp of groups) trainsRoot.remove(grp);
            trainMeshCache.delete(k);
          } else {
            for (const grp of groups) grp.visible = false;
          }
        }
      }

      // Render crisp 3D ballast bed, sleepers & twin steel rails along anchor train + 80m ahead of locomotive
      let sleeperIdx = 0;
      let railIdx = 0;
      let ballastIdx = 0;
      const trail = anchorTrain.trailCoords;
      const trackPts: [number, number][] = [];
      if (trail.length >= 2) {
        // Extrapolate 80m straight ahead of train nose along heading so rails visibly lead ahead of the loco!
        const head = anchorTrain.headLngLat;
        const brRad = (anchorTrain.bearingDeg * Math.PI) / 180;
        const cosLat = Math.max(0.1, Math.cos((head[1] * Math.PI) / 180));
        const aheadLng = head[0] + (Math.sin(brRad) * 80) / (111320 * cosLat);
        const aheadLat = head[1] + (Math.cos(brRad) * 80) / 111320;
        trackPts.push([aheadLng, aheadLat], ...trail);
      }
      if (trackPts.length >= 2) {
        for (let i = 0; i < trackPts.length - 1 && railIdx + 1 < railSegmentMeshes.length; i++) {
          const mcA = maplibregl.MercatorCoordinate.fromLngLat(trackPts[i], 0);
          const mcB = maplibregl.MercatorCoordinate.fromLngLat(trackPts[i + 1], 0);
          const ax = (mcA.x - origin.x) / meterScale;
          const az = -(mcA.y - origin.y) / meterScale;
          const bx = (mcB.x - origin.x) / meterScale;
          const bz = -(mcB.y - origin.y) / meterScale;

          const dx = bx - ax;
          const dz = bz - az;
          const segLen = Math.hypot(dx, dz);
          if (segLen < 0.25) continue;

          const yaw = Math.atan2(dx, dz);
          const mx = (ax + bx) * 0.5;
          const mz = (az + bz) * 0.5;
          const halfGauge = anchorTrain.stockKey === 'whoosh' || anchorTrain.stockKey === 'jbdb' || anchorTrain.stockKey === 'lrtj' ? 0.86 : 0.68;
          const px = (dz / segLen) * halfGauge;
          const pz = (-dx / segLen) * halfGauge;

          if (ballastIdx < ballastMeshes.length) {
            const bm = ballastMeshes[ballastIdx++];
            bm.visible = true;
            bm.position.set(mx, 0.015, mz);
            bm.rotation.set(0, yaw, 0);
            bm.scale.set(1, 1, segLen + 0.3);
          }

          const rLeft = railSegmentMeshes[railIdx++];
          rLeft.visible = true;
          rLeft.position.set(mx + px, 0.075, mz + pz);
          rLeft.rotation.set(0, yaw, 0);
          rLeft.scale.set(1, 1, segLen + 0.15);

          const rRight = railSegmentMeshes[railIdx++];
          rRight.visible = true;
          rRight.position.set(mx - px, 0.075, mz - pz);
          rRight.rotation.set(0, yaw, 0);
          rRight.scale.set(1, 1, segLen + 0.15);

          const step = 1.6;
          const count = Math.floor(segLen / step);
          _railForward.set(dx / segLen, 0, dz / segLen);
          for (let s = 0; s <= count && sleeperIdx < sleeperMeshes.length; s++) {
            const dist = Math.min(segLen, s * step);
            const sm = sleeperMeshes[sleeperIdx++];
            sm.visible = true;
            sm.position.set(ax + _railForward.x * dist, 0.04, az + _railForward.z * dist);
            sm.rotation.set(0, yaw, 0);
          }
        }
      }
      for (let i = ballastIdx; i < ballastMeshes.length; i++) ballastMeshes[i].visible = false;
      for (let i = sleeperIdx; i < sleeperMeshes.length; i++) sleeperMeshes[i].visible = false;
      for (let i = railIdx; i < railSegmentMeshes.length; i++) railSegmentMeshes[i].visible = false;

      // Build camera projection matrix: MapLibre Mercator MVP * (Translate(origin) * Scale(meterScale) * RotateX(π/2))
      _transMat.makeTranslation(origin.x, origin.y, origin.z);
      _scaleVec.set(meterScale, meterScale, meterScale);
      _scaleMat.makeScale(_scaleVec.x, _scaleVec.y, _scaleVec.z);
      _localMat.copy(_transMat).multiply(_scaleMat).multiply(_rotX);

      _mvp.fromArray(options.defaultProjectionData.mainMatrix as number[]);
      camera.projectionMatrix.copy(_mvp).multiply(_localMat);

      renderer.resetState();
      renderer.render(scene, camera);
    },

    onRemove() {
      trainMeshCache.clear();
      ballastMeshes.length = 0;
      sleeperMeshes.length = 0;
      railSegmentMeshes.length = 0;
      if (pool) {
        disposePool(pool);
        pool = null;
      }
      if (renderer) {
        renderer.dispose();
        renderer = null;
      }
      scene = null;
      camera = null;
      trainsRoot = null;
      railsRoot = null;
    },
  };
}
