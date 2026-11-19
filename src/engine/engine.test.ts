import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  Engine,
  addDays,
  dayType,
  fmt,
  dur,
  motion,
  moveAt,
  jakartaClock,
} from './sched';
import {
  computeStopLegSpeeds,
  linesBetweenStations,
  summarizeNetwork,
  unifiedSearch,
} from './analytics';
import {
  buildMapStyle,
  isDarkBasemap,
  jplOsmUrl,
  jplParseRow,
  trainDisplayInfo,
} from './constants';
import {
  compassDirection,
  findNearbyLiveTrains,
  findNearestStations,
  isTrainApproaching,
} from './nearby';
import {
  buildShareUrl,
  describeShareTarget,
  parseDeepLinkHash,
  serializeDeepLinkHash,
} from './deeplink';
import {
  buildConsistSummary,
  formatScheduleDelta,
  projectPointOnSegment,
  snapGpsToTrip,
} from './gps';
import {
  compute3DCameraTarget,
  computeConsist3DPoses,
  computeNextStationEta,
  formatCountdown,
  formatRealCountdown,
} from './eta';
import { STOCK, stockKey } from './stock';
import type { FreightData, JplData, KaiData, NetworkData, TripsData } from './types';

function loadJson<T>(file: string): T {
  const full = path.resolve(process.cwd(), 'public/data', file);
  return JSON.parse(fs.readFileSync(full, 'utf8')) as T;
}

test('time and date utilities handle WIB and day types', () => {
  const clk = jakartaClock(Date.UTC(2026, 9, 12, 0, 30, 0)); // 07:30 WIB on Monday
  assert.equal(clk.date, '2026-10-12');
  assert.equal(Math.floor(clk.sec), 7 * 3600 + 30 * 60);
  assert.equal(addDays('2026-10-12', 1), '2026-10-13');
  assert.equal(dayType('2026-10-12', []), 'weekday');
  assert.equal(dayType('2026-10-11', []), 'weekend');
  assert.equal(dayType('2026-10-12', ['2026-10-12']), 'weekend');
  assert.equal(fmt(7 * 3600 + 35 * 60), '07.35');
  assert.equal(dur(5400), '1 j 30 mnt');
});

test('trapezoidal velocity physics accelerates, cruises, and brakes to exact distance', () => {
  const m = motion(5000, 300, 0.7, 1, 1);
  assert.ok(m.vc > 15 && m.vc < 25);
  assert.equal(moveAt(m, 0).s, 0);
  assert.equal(moveAt(m, 0).v, 0);
  const mid = moveAt(m, 150);
  assert.ok(Math.abs(mid.v - m.vc) < 0.01);
  assert.equal(moveAt(m, 300).s, 5000);
  assert.equal(moveAt(m, 300).v, 0);
});

test('Engine loads real Java datasets, computes rush-hour trains, departures, CSA routes, and JPL passes', () => {
  const net = loadJson<NetworkData>('network.json');
  const trips = loadJson<TripsData>('trips.json');
  const kai = loadJson<KaiData>('kai.json');
  const freight = loadJson<FreightData>('freight.json');
  const jpl = loadJson<JplData>('jpl.json');

  const engine = new Engine(net, trips, kai);
  engine.addFreight(freight);
  engine.freightOn = () => true;

  const rushClock = { date: '2026-10-12', dow: 1, sec: 7 * 3600 + 30 * 60 };
  const running = engine.running(rushClock);
  assert.ok(running.length > 100, `Expected >100 active trains at 07:30 WIB, got ${running.length}`);

  const summary = summarizeNetwork(engine, running);
  assert.equal(summary.total, running.length);
  assert.ok(summary.byChip.krl > 20);
  assert.ok(summary.byChip.kai > 10);
  assert.ok(summary.fastest !== null && summary.fastest.kmh > 50);

  // Manggarai departures
  const deps = engine.departures('MRI', rushClock, 10);
  assert.ok(deps.length >= 5, 'Expected upcoming departures at Manggarai');
  assert.ok(deps[0].wait <= deps[1].wait);

  // Line timetable grid (Bogor line)
  const grid = engine.lineGrid('krl-b', '2026-10-12', 0);
  assert.ok(grid.trips.length > 50);
  assert.ok(grid.rows.length > 10);

  // Connection Scan Algorithm multi-modal route (Bogor -> Tanah Abang)
  const journeys = engine.plan('BOO', 'THB', '2026-10-12', 7 * 3600 + 30 * 60, 4);
  assert.ok(journeys.length >= 1, 'Expected at least 1 CSA journey from Bogor to Tanah Abang');
  assert.ok(journeys[0].legs.every((l) => !l.trip?.freight), 'Freight trains must never appear in passenger routes');

  // Speed profile computation
  const sampleTrip = running[0].trip;
  const profile = engine.speedProfile(sampleTrip);
  assert.ok(profile.D > 0);
  assert.ok(profile.pts.length > 50);

  // JPL crossing pass prediction & safe parsing across all 4,700+ rows
  for (let i = 0; i < jpl.x.length; i++) {
    const parsed = jplParseRow(jpl, i);
    assert.equal(typeof parsed.osm, 'string');
    const url = jplOsmUrl(parsed.osm);
    assert.ok(url.startsWith('https://www.openstreetmap.org/'));
  }
  const sampleJpl = jplParseRow(jpl, 0);
  assert.ok(sampleJpl.p[0] > 105 && sampleJpl.p[0] < 115);
  const passes = engine.passes(sampleJpl.a, sampleJpl.b, sampleJpl.dA, rushClock, 12 * 3600, 5);
  assert.ok(Array.isArray(passes));

  // Unified search
  const res = unifiedSearch('Manggarai', engine, running, jpl);
  assert.ok(res.stations.some((s) => s.id === 'MRI'));

  // Display info never duplicates Whoosh or KA prefixes
  const whooshLine = engine.lines.get('kcic');
  if (whooshLine) {
    const sampleWhoosh = engine.day('2026-10-12').trips.find((t) => t.line === 'kcic');
    if (sampleWhoosh) {
      const info = trainDisplayInfo(sampleWhoosh, whooshLine);
      assert.ok(!info.name.includes('Whoosh Whoosh'), `Duplicate prefix found: ${info.name}`);
    }
  }
  const bsoLine = engine.lines.get('ka-bst');
  if (bsoLine) {
    const sampleBso = engine.day('2026-10-12').trips.find((t) => t.line === 'ka-bst');
    if (sampleBso) {
      const info = trainDisplayInfo(sampleBso, bsoLine);
      assert.ok(!/^KA /i.test(info.num), `Duplicate KA prefix found in num: ${info.num}`);
    }
  }

  // Stop-to-stop estimated cruise speeds
  const legSpeeds = computeStopLegSpeeds(engine, sampleTrip);
  assert.equal(legSpeeds.length, sampleTrip.sids.length);
  assert.equal(legSpeeds[0], null);
  assert.ok(legSpeeds.some((v) => v !== null && v > 10 && v <= 360));

  // Lines connecting a JPL petak
  const jplLines = linesBetweenStations(engine, sampleJpl.a, sampleJpl.b);
  assert.ok(Array.isArray(jplLines));
});

test('deep-link serializer and parser round-trip train, station, line, route, JPL, and camera states', () => {
  // 1. Train deep-link with space in ID, date, JPL layer, and map camera
  const trainUrl = buildShareUrl('https://sepur-live.example/#old=1', {
    train: { id: 'KA 335F', date: '2026-11-19' },
    jplEnabled: true,
    camera: { lat: -7.79247, lng: 112.71938, zoom: 14.0 },
  });
  assert.equal(
    trainUrl,
    'https://sepur-live.example/#train=KA%20335F&td=2026-11-19&jpl=1&@-7.79247,112.71938,14.0',
  );
  const parsedTrain = parseDeepLinkHash(trainUrl.slice(trainUrl.indexOf('#')));
  assert.equal(parsedTrain.trainId, 'KA 335F');
  assert.equal(parsedTrain.trainDate, '2026-11-19');
  assert.equal(parsedTrain.jplEnabled, true);
  assert.deepEqual(parsedTrain.camera, { lat: -7.79247, lng: 112.71938, zoom: 14 });
  assert.equal(parsedTrain.hasTarget, true);

  // 2. Station deep-link
  const stationHash = serializeDeepLinkHash({ station: 'MRI', sys: 'krl' });
  assert.equal(stationHash, '#station=MRI&sys=krl');
  const parsedStation = parseDeepLinkHash(stationHash);
  assert.equal(parsedStation.stationId, 'MRI');
  assert.equal(parsedStation.sys, 'krl');

  // 3. Line deep-link
  const lineHash = serializeDeepLinkHash({ line: 'krl-b' });
  assert.equal(lineHash, '#line=krl-b');
  assert.equal(parseDeepLinkHash(lineHash).lineId, 'krl-b');

  // 4. Route planner deep-link with date and departure time
  const routeHash = serializeDeepLinkHash({
    route: { from: 'BOO', to: 'THB', date: '2026-10-12', sec: 27000 },
  });
  assert.equal(routeHash, '#from=BOO&to=THB&td=2026-10-12&t=27000');
  const parsedRoute = parseDeepLinkHash(routeHash);
  assert.equal(parsedRoute.routeFrom, 'BOO');
  assert.equal(parsedRoute.routeTo, 'THB');
  assert.equal(parsedRoute.trainDate, '2026-10-12');
  assert.equal(parsedRoute.timeSec, 27000);

  // 5. JPL crossing deep-link automatically activates jpl=1
  const jplHash = serializeDeepLinkHash({ jplIndex: 42 });
  assert.equal(jplHash, '#jplIdx=42&jpl=1');
  const parsedJpl = parseDeepLinkHash(jplHash);
  assert.equal(parsedJpl.jplIndex, 42);
  assert.equal(parsedJpl.jplEnabled, true);

  // 6. Descriptions match target type
  assert.ok(describeShareTarget({ train: { id: 'KA 1' } }).includes('kereta'));
  assert.ok(describeShareTarget({ station: 'MRI' }).includes('stasiun'));
  assert.ok(describeShareTarget({ line: 'krl-b' }).includes('jalur'));
  assert.ok(describeShareTarget({ route: { from: 'BOO', to: 'THB' } }).includes('rute'));
  assert.ok(describeShareTarget({ jplIndex: 5 }).includes('JPL'));
  assert.ok(describeShareTarget({}).includes('peta'));

  // 7. Malformed or empty hashes fail safely without throwing
  const bad = parseDeepLinkHash('#train=%E0%A4%A&t=999999&td=not-a-date&sys=invalid&jplIdx=-5&@999,abc,NaN');
  assert.equal(bad.trainId, '%E0%A4%A');
  assert.equal(bad.trainDate, null);
  assert.equal(bad.timeSec, null);
  assert.equal(bad.sys, null);
  assert.equal(bad.jplIndex, null);
  assert.equal(bad.camera, null);
  assert.equal(parseDeepLinkHash('').hasTarget, false);
});

test('GPS-to-track snapping, schedule delta, and consist/stamformasi builder work on real trips', () => {
  const net = loadJson<NetworkData>('network.json');
  const trips = loadJson<TripsData>('trips.json');
  const kai = loadJson<KaiData>('kai.json');
  const engine = new Engine(net, trips, kai);

  // Segment projection clamps cleanly and returns zero distance on exact midpoint
  const proj = projectPointOnSegment([106.85, -6.2], [106.8, -6.2], [106.9, -6.2]);
  assert.ok(Math.abs(proj.t - 0.5) < 0.01);
  assert.ok(proj.distMeters < 5);

  // Snap a real running trip's own position back onto its OSM track -> near-zero off-track & on-time delta
  const clk = { date: '2026-10-12', dow: 1, sec: 7 * 3600 + 30 * 60 };
  const running = engine.running(clk);
  const sample = running.find((r) => r.s.kind === 'run' && r.trip.sids.length >= 4) || running[0];
  const match = snapGpsToTrip(engine, sample.trip, clk, {
    lng: sample.s.p[0],
    lat: sample.s.p[1],
    accuracy: 10,
    speedMps: 20,
    heading: 0,
    timestamp: Date.now(),
  });
  assert.ok(match !== null);
  assert.ok(match.onCorridor);
  assert.ok(match.offTrackMeters < 150, `Expected <150m off-track, got ${match.offTrackMeters}m`);
  assert.equal(match.gpsKmh, 72);
  assert.ok(match.progress >= 0 && match.progress <= 1);

  // Schedule delta formatting
  assert.equal(formatScheduleDelta(20).tone, 'ontime');
  assert.equal(formatScheduleDelta(360).tone, 'late');
  assert.equal(formatScheduleDelta(-300).tone, 'early');

  // Consist / stamformasi builder across KRL, Whoosh, and KA Argo
  const krlLine = engine.lines.get('krl-b');
  if (krlLine) {
    const krlConsist = buildConsistSummary(krlLine);
    assert.equal(krlConsist.totalCars, 12);
    assert.equal(krlConsist.cars[0].isCabFront, true);
    assert.equal(krlConsist.cars[krlConsist.cars.length - 1].isCabRear, true);
    assert.ok(krlConsist.totalLengthM >= 200);
  }
  const whooshLine = engine.lines.get('kcic');
  if (whooshLine) {
    const wConsist = buildConsistSummary(whooshLine);
    assert.equal(wConsist.totalCars, 8);
    assert.equal(wConsist.stockId, 'whoosh');
  }
  const argoLine = [...engine.lines.values()].find((l) => l.sys === 'kai' && /^Argo /.test(l.name));
  if (argoLine) {
    const aConsist = buildConsistSummary(argoLine);
    assert.equal(aConsist.cars[0].isLoco, true);
    assert.equal(aConsist.cars[1].code, 'P');
    assert.ok(aConsist.totalLengthM > 180);
  }
});

test('next-station ETA countdown adjusts for simulation speed and 3D consist poses articulate along track', () => {
  const net = loadJson<NetworkData>('network.json');
  const trips = loadJson<TripsData>('trips.json');
  const kai = loadJson<KaiData>('kai.json');
  const engine = new Engine(net, trips, kai);

  const clk = { date: '2026-10-12', dow: 1, sec: 7 * 3600 + 30 * 60 };
  const running = engine.running(clk);
  const sample = running.find((r) => r.s.kind === 'run' && r.trip.sids.length >= 4) || running[0];
  const line = engine.lines.get(sample.trip.line)!;

  // Countdown formatting
  assert.equal(formatCountdown(462), '07:42');
  assert.equal(formatCountdown(3665), '1j 01:05');
  assert.equal(formatRealCountdown(8.2), '8 dtk');
  assert.equal(formatRealCountdown(75), '1m 15d');

  // Schedule ETA at 1x vs 60x vs paused
  const eta1x = computeNextStationEta({
    engine,
    trip: sample.trip,
    t: clk.sec,
    state: sample.s,
    simSpeed: 1,
    simPaused: false,
  });
  const eta60x = computeNextStationEta({
    engine,
    trip: sample.trip,
    t: clk.sec,
    state: sample.s,
    simSpeed: 60,
    simPaused: false,
  });
  const etaPaused = computeNextStationEta({
    engine,
    trip: sample.trip,
    t: clk.sec,
    state: sample.s,
    simSpeed: 60,
    simPaused: true,
  });

  assert.equal(eta1x.status, 'running');
  assert.ok(eta1x.remainingSimSec > 0);
  assert.equal(eta1x.remainingRealSec, eta1x.remainingSimSec);
  assert.ok(eta60x.remainingRealSec !== null);
  assert.ok(Math.abs(eta60x.remainingRealSec - eta1x.remainingSimSec / 60) < 0.01);
  assert.equal(etaPaused.remainingRealSec, null);
  assert.ok(eta1x.distanceMeters > 0);
  assert.ok(eta1x.legProgress >= 0 && eta1x.legProgress <= 1);

  // Articulated 3D consist poses along real track polyline
  const sk = stockKey(line);
  const trail = engine.trail(sample.trip, sample.s, STOCK[sk].len + 20);
  const poses = computeConsist3DPoses(trail, sk, sample.s.bearing);
  assert.equal(poses.length, STOCK[sk].cars.length);
  assert.ok(poses.every((p) => Number.isFinite(p.bearingDeg) && p.lengthM > 0));

  // 3D camera presets
  const sideCam = compute3DCameraTarget(sample.s.p, 90, 'side', 0, 140);
  assert.ok(sideCam !== null);
  assert.equal(sideCam.bearing, 180);
  assert.ok(sideCam.pitch >= 60);
  assert.ok(sideCam.zoom >= 17);
  assert.equal(compute3DCameraTarget(sample.s.p, 90, 'free', 0, 140), null);
});

test('nearby live trains radar, approaching vector detection, nearest stations, and switchable basemaps work accurately', () => {
  const net = loadJson<NetworkData>('network.json');
  const trips = loadJson<TripsData>('trips.json');
  const kai = loadJson<KaiData>('kai.json');
  const freight = loadJson<FreightData>('freight.json');
  const engine = new Engine(net, trips, kai);
  engine.addFreight(freight);
  engine.freightOn = () => true;

  // Compass direction checks
  assert.equal(compassDirection([106.85, -6.21], [106.85, -6.15]).code, 'U');
  assert.equal(compassDirection([106.85, -6.21], [106.95, -6.21]).code, 'T');
  assert.equal(compassDirection([106.85, -6.21], [106.85, -6.30]).code, 'S');
  assert.equal(compassDirection([106.85, -6.21], [106.75, -6.21]).code, 'B');

  // Approaching vector detection: train south of observer heading North (0 deg) is approaching; heading South (180 deg) is moving away
  assert.equal(isTrainApproaching([106.85, -6.25], 0, [106.85, -6.21]), true);
  assert.equal(isTrainApproaching([106.85, -6.25], 180, [106.85, -6.21]), false);

  // Nearest stations to Manggarai coordinates
  const clk = { date: '2026-10-12', dow: 1, sec: 7 * 3600 + 30 * 60 };
  const mriCoord: [number, number] = [106.8502, -6.2099];
  const nearSt = findNearestStations(engine, mriCoord, clk, 3);
  assert.equal(nearSt.length, 3);
  assert.equal(nearSt[0].station.id, 'MRI');
  assert.ok(nearSt[0].distanceMeters < 200);
  assert.ok(nearSt[0].nextDeparture !== null);

  // Nearby live trains ranked ascending by distance
  const running = engine.running(clk);
  const nearAll = findNearbyLiveTrains(engine, running, mriCoord, { limit: 8 });
  assert.equal(nearAll.length, 8);
  for (let i = 1; i < nearAll.length; i++) {
    assert.ok(nearAll[i].distanceMeters >= nearAll[i - 1].distanceMeters);
  }
  const nearIntercity = findNearbyLiveTrains(engine, running, mriCoord, {
    category: 'intercity',
    limit: 5,
  });
  assert.ok(nearIntercity.length > 0);
  assert.ok(nearIntercity.every((t) => t.category === 'intercity'));

  // Basemap styles for all 4 modes
  assert.equal(isDarkBasemap('light'), false);
  assert.equal(isDarkBasemap('dark'), true);
  assert.equal(isDarkBasemap('satellite'), true);
  assert.equal(isDarkBasemap('hybrid'), true);

  assert.equal(typeof buildMapStyle('light'), 'string');
  assert.equal(typeof buildMapStyle('dark'), 'string');

  const satStyle = buildMapStyle('satellite');
  assert.equal(typeof satStyle, 'object');
  if (typeof satStyle === 'object') {
    assert.ok(satStyle.glyphs?.includes('openfreemap.org'));
    assert.ok('esri-sat' in satStyle.sources);
    assert.equal('esri-labels' in satStyle.sources, false);
  }

  const hybStyle = buildMapStyle('hybrid');
  assert.equal(typeof hybStyle, 'object');
  if (typeof hybStyle === 'object') {
    assert.ok('esri-sat' in hybStyle.sources);
    assert.ok('esri-labels' in hybStyle.sources);
  }
});




