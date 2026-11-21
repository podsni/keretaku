import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Engine } from '../engine/sched';

maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
import {
  CARZ,
  JCAT,
  LWS,
  SYS_LABEL,
  buildMapStyle,
  chipOf,
  clampSpeedKmh,
  isDarkBasemap,
  trainDisplayInfo,
} from '../engine/constants';
import { CABW, STOCK, cabCanvas, carFeatures, stockKey, spriteCanvas } from '../engine/stock';
import type { MapCameraView } from '../engine/deeplink';
import {
  type Camera3DMode,
  type Train3DPose,
  compute3DCameraTarget,
  computeConsist3DPoses,
} from '../engine/eta';
import { createTrain3DLayer } from '../engine/train3dLayer';
import { getSpecialServiceMeta } from '../engine/javaInsights';
import type {
  ClockState,
  DetailState,
  FreightCategory,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonPoint,
  Journey,
  JplData,
  JplFilter,
  LayerState,
  MapBasemapId,
  RunningTrain,
  SystemFilterId,
  TerminalsData,
} from '../engine/types';

export interface MapCommand {
  type: 'flyTo' | 'fitBounds' | 'zoomIn' | 'zoomOut';
  lng?: number;
  lat?: number;
  zoom?: number;
  bounds?: [[number, number], [number, number]];
  nonce: number;
}

interface MapCanvasProps {
  engine: Engine | null;
  getClock: () => ClockState;
  theme: 'light' | 'dark';
  basemap: MapBasemapId;
  layers: LayerState;
  systemFilter: SystemFilterId;
  freightCats: FreightCategory[];
  jplData: JplData | null;
  jplFilter: JplFilter;
  selectedJplIndex: number | null;
  terminalsData: TerminalsData | null;
  detail: DetailState;
  activeJourney: Journey | null;
  followTrain: boolean;
  threeD: boolean;
  camera3DMode: Camera3DMode;
  underground: boolean;
  pickStationMode: 'from' | 'to' | null;
  userLocation: [number, number] | null;
  command: MapCommand | null;
  onSelectTrain: (id: string, date: string) => void;
  onSelectStation: (id: string) => void;
  onSelectLine: (id: string) => void;
  onSelectJpl: (index: number) => void;
  onStopFollow: () => void;
  onChangeCamera3DMode?: (mode: Camera3DMode) => void;
  onFrameRunning: (running: RunningTrain[]) => void;
  onViewChange?: (view: MapCameraView) => void;
  onMapReady?: () => void;
}

const FC = (features: GeoJsonFeature[] = []): GeoJsonFeatureCollection => ({
  type: 'FeatureCollection',
  features,
});

const TRAIN_HIT_LAYERS = [
  'tr-c',
  'tr-s',
  'tr-ring',
  'tr-t',
  'tr-n',
  'car-hit',
  'car-case',
  'car-body',
  'nose',
  'car-end',
  'car-n',
] as const;

const TRAIN_HIT_LAYER_SET = new Set<string>(TRAIN_HIT_LAYERS);

function buildLineFeatures(engine: Engine): GeoJsonFeatureCollection {
  const feats: GeoJsonFeature[] = [];
  for (const l of engine.allLines()) {
    const ka = l.sys === 'kai' || l.sys === 'regional' || l.sys === 'barang' ? 1 : 0;
    const coordsList: [number, number][][] = [];
    if (l.pairs && l.pairs.length) {
      for (const pair of l.pairs) {
        const [a, b] = pair.split('>');
        if (a && b) {
          const pl = engine.seg(a, b);
          if (pl.coords.length > 1) coordsList.push(pl.coords);
        }
      }
    } else {
      const seqs = [l.stations, ...(l.branches || [])];
      for (const seq of seqs) {
        for (let i = 0; i < seq.length - 1; i++) {
          const pl = engine.seg(seq[i], seq[i + 1]);
          if (pl.coords.length > 1) coordsList.push(pl.coords);
        }
      }
    }
    if (coordsList.length) {
      feats.push({
        type: 'Feature',
        properties: { line: l.id, sys: l.sys, color: l.color, ka, cat: l.cat || '' },
        geometry: { type: 'MultiLineString', coordinates: coordsList },
      });
    }
  }
  return FC(feats);
}

function buildStationFeatures(engine: Engine): GeoJsonFeatureCollection {
  const feats: GeoJsonFeature[] = [];
  for (const s of engine.allStations()) {
    const primaryLine = s.lines?.[0] ? engine.lines.get(s.lines[0]) : undefined;
    const big = (s.lines?.length ?? 0) > 1 || (s.xfer?.length ?? 0) > 0 ? 1 : 0;
    feats.push({
      type: 'Feature',
      properties: {
        id: s.id,
        name: s.name,
        sys: s.sys?.[0] || 'kai',
        color: primaryLine?.color || '#475569',
        big,
      },
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    });
  }
  return FC(feats);
}

function buildJplFeatures(jpl: JplData | null, filter: JplFilter): GeoJsonFeatureCollection {
  if (!jpl) return FC();
  const feats: GeoJsonFeature[] = [];
  for (let i = 0; i < jpl.x.length; i++) {
    const r = jpl.x[i];
    if (filter.cats.length && !filter.cats.includes(r[3])) continue;
    if (filter.daop && r[15] !== filter.daop) continue;
    feats.push({
      type: 'Feature',
      id: i,
      properties: { i, c: r[3] },
      geometry: { type: 'Point', coordinates: [r[1], r[2]] },
    });
  }
  return FC(feats);
}

function buildTerminalFeatures(data: TerminalsData | null): GeoJsonFeatureCollection {
  if (!data) return FC();
  const feats: GeoJsonFeature[] = data.x.map((r, i) => ({
    type: 'Feature',
    id: i,
    properties: { i, kind: r[2], name: r[3], op: r[4], near: r[6], dist: r[7] },
    geometry: { type: 'Point', coordinates: [r[0], r[1]] },
  }));
  return FC(feats);
}

function buildJourneyFeatures(engine: Engine, journey: Journey | null): GeoJsonFeatureCollection {
  if (!journey) return FC();
  const feats: GeoJsonFeature[] = [];
  for (const leg of journey.legs) {
    if (leg.walk) {
      const a = engine.st.get(leg.from);
      const b = engine.st.get(leg.to);
      if (a && b) {
        feats.push({
          type: 'Feature',
          properties: { walk: 1, color: '#475569' },
          geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
        });
      }
    } else if (leg.trip && leg.i !== undefined && leg.j !== undefined) {
      const l = engine.lines.get(leg.trip.line);
      const coords: [number, number][] = [];
      for (let k = leg.i; k < leg.j; k++) {
        const pl = engine.seg(leg.trip.sids[k], leg.trip.sids[k + 1]);
        for (let p = coords.length ? 1 : 0; p < pl.coords.length; p++) {
          coords.push(pl.coords[p]);
        }
      }
      if (coords.length > 1) {
        feats.push({
          type: 'Feature',
          properties: { walk: 0, color: l?.color || '#2563EB' },
          geometry: { type: 'LineString', coordinates: coords },
        });
      }
    }
  }
  return FC(feats);
}

function buildSelectedTrainRoute(
  engine: Engine,
  detail: DetailState,
  clk: ClockState,
): GeoJsonFeatureCollection {
  if (!detail || detail.type !== 'train') return FC();
  const found = engine.find(detail.id, clk, detail.date);
  if (!found) return FC();
  const trip = found.trip;
  const line = engine.lines.get(trip.line);
  const color = line?.color || '#2563EB';
  const coords: [number, number][] = [];
  for (let i = 0; i < trip.sids.length - 1; i++) {
    const pl = engine.seg(trip.sids[i], trip.sids[i + 1]);
    for (let p = coords.length ? 1 : 0; p < pl.coords.length; p++) {
      coords.push(pl.coords[p]);
    }
  }
  const feats: GeoJsonFeature[] = [];
  if (coords.length > 1) {
    feats.push({
      type: 'Feature',
      properties: { kind: 'line', color },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }
  for (let i = 0; i < trip.sids.length; i++) {
    if (!(trip.flags[i] & 1)) continue;
    const st = engine.st.get(trip.sids[i]);
    if (!st) continue;
    feats.push({
      type: 'Feature',
      properties: { kind: 'stop', color, name: st.name },
      geometry: { type: 'Point', coordinates: [st.lng, st.lat] },
    });
  }
  return FC(feats);
}

function buildSelectedJplFeature(
  jpl: JplData | null,
  idx: number | null,
): GeoJsonFeatureCollection {
  if (!jpl || idx === null || idx < 0 || idx >= jpl.x.length) return FC();
  const r = jpl.x[idx];
  return FC([
    {
      type: 'Feature',
      properties: { i: idx },
      geometry: { type: 'Point', coordinates: [r[1], r[2]] },
    },
  ]);
}

export function MapCanvas({
  engine,
  getClock,
  theme,
  basemap,
  layers,
  systemFilter,
  freightCats,
  jplData,
  jplFilter,
  selectedJplIndex,
  terminalsData,
  detail,
  activeJourney,
  followTrain,
  threeD,
  camera3DMode,
  underground,
  pickStationMode,
  userLocation,
  command,
  onSelectTrain,
  onSelectStation,
  onSelectLine,
  onSelectJpl,
  onStopFollow,
  onChangeCamera3DMode,
  onFrameRunning,
  onViewChange,
  onMapReady,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const loadedBasemapRef = useRef<MapBasemapId | null>(null);
  const layersReadyRef = useRef(false);
  const hadCarsRef = useRef(false);
  const active3DModelsRef = useRef(false);
  const poses3DRef = useRef<Train3DPose[]>([]);
  const camera3DLockUntilRef = useRef(0);
  const bearingsRef = useRef(new Map<string, number>());
  const visibleTrainsRef = useRef<
    { id: string; date: string; p: [number, number]; dim: number }[]
  >([]);

  // Keep latest props in refs so MapLibre event listeners & rAF never tear down the map
  const stateRef = useRef({
    engine,
    getClock,
    theme,
    basemap,
    layers,
    systemFilter,
    freightCats,
    jplData,
    jplFilter,
    selectedJplIndex,
    terminalsData,
    detail,
    activeJourney,
    followTrain,
    threeD,
    camera3DMode,
    underground,
    pickStationMode,
    userLocation,
    onSelectTrain,
    onSelectStation,
    onSelectLine,
    onSelectJpl,
    onStopFollow,
    onChangeCamera3DMode,
    onFrameRunning,
    onViewChange,
    onMapReady,
  });
  stateRef.current = {
    engine,
    getClock,
    theme,
    basemap,
    layers,
    systemFilter,
    freightCats,
    jplData,
    jplFilter,
    selectedJplIndex,
    terminalsData,
    detail,
    activeJourney,
    followTrain,
    threeD,
    camera3DMode,
    underground,
    pickStationMode,
    userLocation,
    onSelectTrain,
    onSelectStation,
    onSelectLine,
    onSelectJpl,
    onStopFollow,
    onChangeCamera3DMode,
    onFrameRunning,
    onViewChange,
    onMapReady,
  };

  const applyLayerVisibility = (map: maplibregl.Map) => {
    if (!layersReadyRef.current || !map.getLayer('lines')) return;
    const { layers: L, underground: ug, threeD: d3 } = stateRef.current;
    const sysOn = (Object.keys(SYS_LABEL) as Array<keyof typeof SYS_LABEL>).filter((k) => L[k]);
    const f: maplibregl.FilterSpecification = ['in', ['get', 'sys'], ['literal', sysOn]];
    map.setFilter('lines', f);
    map.setFilter('lines-case', f);
    map.setFilter('st-c', f);
    map.setFilter('st-l', f);

    const setVis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    };
    setVis('st-c', L.stations);
    setVis('st-l', L.stations && L.labels);
    setVis('net', L.net);
    setVis('tr-t', L.labels);
    setVis('tun', ug);
    setVis('b3d', d3);
    for (const id of ['jpl-cl', 'jpl-cn', 'jpl-p', 'jpl-x']) setVis(id, L.jpl);
    for (const id of ['term-c', 'term-l']) setVis(id, L.terminals);
  };

  const setupCustomLayers = (map: maplibregl.Map) => {
    const {
      engine: E,
      basemap: bm,
      jplData: jp,
      jplFilter: jf,
      terminalsData: td,
      activeJourney: aj,
      userLocation: ul,
    } = stateRef.current;
    if (!E) return;

    const isDark = isDarkBasemap(bm);
    const isSatellite = bm === 'satellite' || bm === 'hybrid';
    const fontRegular = bm === 'dark' ? ['Open Sans Regular'] : ['Noto Sans Regular'];
    const fontBold = bm === 'dark' ? ['Open Sans Bold'] : ['Noto Sans Bold'];
    const dpr = Math.max(2, Math.min(3, Math.ceil(window.devicePixelRatio || 1)));
    for (const k of Object.keys(STOCK)) {
      for (const rear of [false, true]) {
        const imgId = (rear ? 'tail-' : 'cab-') + k;
        if (!map.hasImage(imgId)) {
          const cb = cabCanvas(k, rear, dpr);
          const ctx = cb.canvas.getContext('2d')!;
          map.addImage(imgId, ctx.getImageData(0, 0, cb.canvas.width, cb.canvas.height), { pixelRatio: dpr });
        }
      }
      const spId = 'tr-' + k;
      if (!map.hasImage(spId)) {
        const sp = spriteCanvas(k, dpr);
        const ctx = sp.canvas.getContext('2d')!;
        map.addImage(spId, ctx.getImageData(0, 0, sp.canvas.width, sp.canvas.height), { pixelRatio: dpr });
      }
    }

    const beforeSymbol = map.getStyle()?.layers?.find((l: { type: string }) => l.type === 'symbol')?.id;

    // 1. Track network backdrop
    if (!map.getSource('net')) {
      map.addSource('net', {
        type: 'geojson',
        data: FC(
          E.net.net.map((n) => ({
            type: 'Feature',
            properties: { m: n.m || '' },
            geometry: { type: 'LineString', coordinates: n.c },
          })),
        ) as unknown as maplibregl.GeoJSONSourceSpecification['data'],
      });
    }
    if (!map.getLayer('net')) {
      map.addLayer(
        {
          id: 'net',
          type: 'line',
          source: 'net',
          paint: {
            'line-color': isSatellite ? 'rgba(226, 232, 240, 0.52)' : isDark ? '#334155' : '#CBD5E1',
            'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.7, 12, 1.8, 16, 3.2],
          },
        },
        beforeSymbol,
      );
    }

    // 2. 3D Buildings (from vector basemap if available)
    const styleSources = (map.getStyle()?.sources || {}) as Record<string, { type?: string }>;
    const vsrcEntry = Object.entries(styleSources).find(([, s]) => s.type === 'vector');
    if (vsrcEntry && !map.getLayer('b3d')) {
      map.addLayer(
        {
          id: 'b3d',
          type: 'fill-extrusion',
          source: vsrcEntry[0],
          'source-layer': 'building',
          minzoom: 13,
          layout: { visibility: stateRef.current.threeD ? 'visible' : 'none' },
          paint: {
            'fill-extrusion-color': isDark ? '#1E293B' : '#CBD5E1',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 10],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.78,
          },
        },
        'net',
      );
    }

    // 3. Tunnels
    if (!map.getSource('tun')) {
      map.addSource('tun', {
        type: 'geojson',
        data: FC(
          (E.net.tunnels || []).map((c) => ({
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: c },
          })),
        ),
      });
    }
    if (!map.getLayer('tun')) {
      map.addLayer({
        id: 'tun',
        type: 'line',
        source: 'tun',
        layout: { visibility: stateRef.current.underground ? 'visible' : 'none' },
        paint: {
          'line-color': isDark ? '#38BDF8' : '#0F172A',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 16, 7],
          'line-dasharray': [1.4, 0.9],
          'line-opacity': 0.85,
        },
      });
    }

    // 4. Railway lines
    if (!map.getSource('lines')) {
      map.addSource('lines', { type: 'geojson', data: buildLineFeatures(E) });
    }
    const kaW = (a: number, b: number): maplibregl.ExpressionSpecification => ['case', ['==', ['get', 'ka'], 1], a, b];
    if (!map.getLayer('lines-case')) {
      map.addLayer({
        id: 'lines-case',
        type: 'line',
        source: 'lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': isDark ? '#0F172A' : '#FFFFFF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, kaW(1.8, 2.8), 14, kaW(6, 9)],
        },
      });
    }
    if (!map.getLayer('lines')) {
      map.addLayer({
        id: 'lines',
        type: 'line',
        source: 'lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, kaW(1.1, 1.8), 14, kaW(3.5, 5.5)],
          'line-opacity': kaW(0.62, 0.92),
        },
      });
    }

    // 5. Planned route highlight
    if (!map.getSource('route')) {
      map.addSource('route', { type: 'geojson', data: buildJourneyFeatures(E, aj) });
    }
    if (!map.getLayer('route-case')) {
      map.addLayer({
        id: 'route-case',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'walk'], 0],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': isDark ? '#F8FAFC' : '#0F172A',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5.5, 14, 11],
          'line-opacity': 0.85,
        },
      });
    }
    if (!map.getLayer('route')) {
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'walk'], 0],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3.2, 14, 7],
        },
      });
    }
    if (!map.getLayer('route-walk')) {
      map.addLayer({
        id: 'route-walk',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'walk'], 1],
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': isDark ? '#E2E8F0' : '#334155',
          'line-width': 3.5,
          'line-dasharray': [0.8, 1.5],
        },
      });
    }

    // 5b. Selected Train Route Highlight
    if (!map.getSource('sel-route')) {
      map.addSource('sel-route', {
        type: 'geojson',
        data: buildSelectedTrainRoute(E, stateRef.current.detail, stateRef.current.getClock()),
      });
    }
    if (!map.getLayer('sel-route-case')) {
      map.addLayer({
        id: 'sel-route-case',
        type: 'line',
        source: 'sel-route',
        filter: ['==', ['get', 'kind'], 'line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': isDark ? '#F8FAFC' : '#0F172A',
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4.8, 14, 10],
          'line-opacity': 0.72,
        },
      });
    }
    if (!map.getLayer('sel-route')) {
      map.addLayer({
        id: 'sel-route',
        type: 'line',
        source: 'sel-route',
        filter: ['==', ['get', 'kind'], 'line'],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.8, 14, 6.5],
        },
      });
    }
    if (!map.getLayer('sel-stops')) {
      map.addLayer({
        id: 'sel-stops',
        type: 'circle',
        source: 'sel-route',
        filter: ['==', ['get', 'kind'], 'stop'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3.5, 13, 6.5],
          'circle-color': '#FFFFFF',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 2.5,
        },
      });
    }

    // 6. Stations
    if (!map.getSource('stations')) {
      map.addSource('stations', { type: 'geojson', data: buildStationFeatures(E) });
    }
    if (!map.getLayer('st-c')) {
      map.addLayer({
        id: 'st-c',
        type: 'circle',
        source: 'stations',
        minzoom: 7,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9,
            ['case', ['==', ['get', 'big'], 1], 3.8, 2.5],
            14,
            ['case', ['==', ['get', 'big'], 1], 8, 6],
          ],
          'circle-color': isDark ? '#0F172A' : '#FFFFFF',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 1.5, 14, 2.6],
        },
      });
    }
    if (!map.getLayer('st-l')) {
      map.addLayer({
        id: 'st-l',
        type: 'symbol',
        source: 'stations',
        minzoom: 11.4,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': fontRegular,
          'text-size': 11.5,
          'text-offset': [0, 1.15],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': isDark ? '#F8FAFC' : '#1E293B',
          'text-halo-color': isDark ? '#0F172A' : '#FFFFFF',
          'text-halo-width': isSatellite ? 2.1 : 1.8,
        },
      });
    }

    // 7. Freight terminals
    if (!map.getSource('terminals')) {
      map.addSource('terminals', { type: 'geojson', data: buildTerminalFeatures(td) });
    }
    if (!map.getLayer('term-c')) {
      map.addLayer({
        id: 'term-c',
        type: 'circle',
        source: 'terminals',
        layout: { visibility: stateRef.current.layers.terminals ? 'visible' : 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 4, 13, 8],
          'circle-color': ['match', ['get', 'kind'], 'fuel', '#DC2626', 'yard', '#475569', '#D97706'],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.8,
        },
      });
    }
    if (!map.getLayer('term-l')) {
      map.addLayer({
        id: 'term-l',
        type: 'symbol',
        source: 'terminals',
        minzoom: 11,
        layout: {
          visibility: stateRef.current.layers.terminals ? 'visible' : 'none',
          'text-field': ['get', 'name'],
          'text-font': fontRegular,
          'text-size': 10.5,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': isDark ? '#FDE68A' : '#92400E',
          'text-halo-color': isDark ? '#0F172A' : '#FFFFFF',
          'text-halo-width': 1.8,
        },
      });
    }

    // 8. JPL Level Crossings (Clustered)
    if (!map.getSource('jpl')) {
      map.addSource('jpl', {
        type: 'geojson',
        data: buildJplFeatures(jp, jf),
        cluster: true,
        clusterRadius: 42,
        clusterMaxZoom: 12,
      });
    }
    const jplColorExpr = [
      'match',
      ['get', 'c'],
      ...Object.entries(JCAT).flatMap(([k, v]) => [k, v[1]]),
      '#64748B',
    ] as unknown as maplibregl.ExpressionSpecification;
    if (!map.getLayer('jpl-cl')) {
      map.addLayer({
        id: 'jpl-cl',
        type: 'circle',
        source: 'jpl',
        filter: ['has', 'point_count'],
        layout: { visibility: stateRef.current.layers.jpl ? 'visible' : 'none' },
        paint: {
          'circle-color': '#FACC15',
          'circle-opacity': 0.94,
          'circle-stroke-color': '#0F172A',
          'circle-stroke-width': 1.5,
          'circle-radius': ['step', ['get', 'point_count'], 11, 20, 14, 100, 18, 500, 22],
        },
      });
    }
    if (!map.getLayer('jpl-cn')) {
      map.addLayer({
        id: 'jpl-cn',
        type: 'symbol',
        source: 'jpl',
        filter: ['has', 'point_count'],
        layout: {
          visibility: stateRef.current.layers.jpl ? 'visible' : 'none',
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': fontBold,
          'text-size': 11,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#0F172A' },
      });
    }
    if (!map.getLayer('jpl-p')) {
      map.addLayer({
        id: 'jpl-p',
        type: 'circle',
        source: 'jpl',
        filter: ['!', ['has', 'point_count']],
        layout: { visibility: stateRef.current.layers.jpl ? 'visible' : 'none' },
        paint: {
          'circle-color': jplColorExpr,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.8, 14, 6.5, 17, 9.5],
          'circle-stroke-color': ['match', ['get', 'c'], ['fly', 'under'], '#FACC15', '#FFFFFF'],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 2],
        },
      });
    }
    if (!map.getLayer('jpl-x')) {
      map.addLayer({
        id: 'jpl-x',
        type: 'symbol',
        source: 'jpl',
        minzoom: 14,
        filter: ['!', ['has', 'point_count']],
        layout: {
          visibility: stateRef.current.layers.jpl ? 'visible' : 'none',
          'text-field': ['match', ['get', 'c'], 'fly', '▲', 'under', '▼', 'tutup', '–', '×'],
          'text-font': fontBold,
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 17, 14],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#FFFFFF' },
      });
    }

    // Selected JPL focus ring
    if (!map.getSource('jpl-sel')) {
      map.addSource('jpl-sel', {
        type: 'geojson',
        data: buildSelectedJplFeature(jp, stateRef.current.selectedJplIndex),
      });
    }
    if (!map.getLayer('jpl-sel-ring')) {
      map.addLayer({
        id: 'jpl-sel-ring',
        type: 'circle',
        source: 'jpl-sel',
        paint: {
          'circle-radius': 15,
          'circle-color': '#F59E0B',
          'circle-opacity': 0.25,
          'circle-stroke-color': '#F59E0B',
          'circle-stroke-width': 2.5,
        },
      });
    }

    // 9. Trains (low-zoom sprites + high-zoom individual cars)
    if (!map.getSource('trains')) map.addSource('trains', { type: 'geojson', data: FC() });
    if (!map.getSource('cars')) map.addSource('cars', { type: 'geojson', data: FC() });

    const op = (o: number): maplibregl.ExpressionSpecification => ['case', ['==', ['get', 'dim'], 1], o * 0.28, o];
    const lw = (f: number | maplibregl.ExpressionSpecification, add = 0): maplibregl.ExpressionSpecification => [
      'interpolate',
      ['exponential', 2],
      ['zoom'],
      ...LWS.flatMap(([zz, w]) => [
        zz,
        typeof f === 'number'
          ? w * f + add
          : add
            ? (['+', ['*', w, f], add] as maplibregl.ExpressionSpecification)
            : (['*', w, f] as maplibregl.ExpressionSpecification),
      ]),
    ];
    const isR = (r: string): maplibregl.ExpressionSpecification => ['==', ['get', 'r'], r];

    const ensureLayer = (spec: maplibregl.AddLayerObject) => {
      if (!map.getLayer(spec.id)) map.addLayer(spec);
    };

    ensureLayer({
      id: 'tr-halo',
      type: 'circle',
      source: 'trains',
      maxzoom: CARZ,
      filter: ['==', ['get', 'sel'], 1],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 14, 12, 24],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.32,
      },
    });
    ensureLayer({
      id: 'tr-ring',
      type: 'circle',
      source: 'trains',
      maxzoom: CARZ,
      filter: ['==', ['get', 'dim'], 0],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4.5, 9, 7, 12, 10.5, 14, 12],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.25,
        'circle-stroke-color': ['get', 'color'],
        'circle-stroke-width': 1.5,
        'circle-stroke-opacity': 0.9,
      },
    });
    ensureLayer({
      id: 'tr-s',
      type: 'symbol',
      source: 'trains',
      maxzoom: CARZ,
      layout: {
        'icon-image': ['concat', 'tr-', ['get', 'k']],
        'icon-rotate': ['get', 'b'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'symbol-sort-key': ['get', 'sk'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.38, 9, 0.54, 11, 0.68, CARZ, 0.88],
      },
      paint: { 'icon-opacity': op(1) },
    });
    ensureLayer({
      id: 'car-glow',
      type: 'line',
      source: 'cars',
      minzoom: CARZ,
      filter: ['all', ['==', ['get', 'sel'], 1], ['any', isR('car'), isR('nose')]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': lw(2.6), 'line-opacity': 0.45, 'line-blur': 2 },
    });
    ensureLayer({
      id: 'car-case',
      type: 'line',
      source: 'cars',
      minzoom: CARZ,
      filter: isR('car'),
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': '#1d1d22', 'line-width': lw(1, 1.6), 'line-opacity': op(1) },
    });
    ensureLayer({
      id: 'nose-case',
      type: 'line',
      source: 'cars',
      minzoom: CARZ,
      filter: isR('nose'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#1d1d22', 'line-width': lw(['get', 'nw'], 1.6), 'line-opacity': op(1) },
    });
    ensureLayer({
      id: 'car-body',
      type: 'line',
      source: 'cars',
      minzoom: CARZ,
      filter: isR('car'),
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'b'], 'line-width': lw(1), 'line-opacity': op(1) },
    });
    ensureLayer({
      id: 'nose',
      type: 'line',
      source: 'cars',
      minzoom: CARZ,
      filter: isR('nose'),
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'c'], 'line-width': lw(['get', 'nw']), 'line-opacity': op(1) },
    });
    ensureLayer({
      id: 'car-s1',
      type: 'line',
      source: 'cars',
      minzoom: CARZ,
      filter: isR('car'),
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': ['get', 's1'], 'line-width': lw(0.42), 'line-opacity': op(1) },
    });
    ensureLayer({
      id: 'car-s2',
      type: 'line',
      source: 'cars',
      minzoom: CARZ,
      filter: isR('car'),
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': ['get', 's2'], 'line-width': lw(0.12), 'line-opacity': op(1) },
    });
    ensureLayer({
      id: 'car-end',
      type: 'symbol',
      source: 'cars',
      minzoom: CARZ,
      filter: ['any', isR('cab'), isR('tail')],
      layout: {
        'icon-image': ['get', 'ci'],
        'icon-rotate': ['get', 'b'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-anchor': 'top',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['exponential', 2], ['zoom'], ...LWS.flatMap(([zz, w]) => [zz, w / CABW])],
      },
      paint: { 'icon-opacity': op(1) },
    });
    // True 3D articulated trains rendered directly in MapLibre WebGL space via Three.js
    if (!map.getLayer('trains-3d')) {
      map.addLayer(
        createTrain3DLayer(
          () => poses3DRef.current,
          () => (stateRef.current.basemap === 'dark' ? 'dark' : 'light'),
          () => stateRef.current.getClock().sec,
        ),
      );
    }
    ensureLayer({
      id: 'car-n',
      type: 'symbol',
      source: 'cars',
      minzoom: CARZ,
      filter: ['all', isR('cab'), ['!=', ['get', 'nm'], '']],
      layout: {
        'text-field': ['get', 'nm'],
        'text-font': fontBold,
        'text-size': 12,
        'text-radial-offset': 1.4,
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-justify': 'auto',
        'text-max-width': 16,
        'text-optional': true,
        'text-padding': 3,
        'symbol-sort-key': ['get', 'sk'],
      },
      paint: {
        'text-color': isDark ? '#F8FAFC' : '#0F172A',
        'text-halo-color': isDark ? '#0F172A' : '#FFFFFF',
        'text-halo-width': 2.2,
      },
    });
    ensureLayer({
      id: 'car-hit',
      type: 'line',
      source: 'cars',
      minzoom: CARZ,
      filter: ['any', isR('car'), isR('nose')],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#000000',
        'line-width': lw(2.4, 16),
        'line-opacity': 0.001,
      },
    });
    ensureLayer({
      id: 'tr-c',
      type: 'circle',
      source: 'trains',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 14, 10, 18, 14, 22, 17, 26],
        'circle-color': '#000000',
        'circle-opacity': 0.001,
      },
    });
    ensureLayer({
      id: 'tr-t',
      type: 'symbol',
      source: 'trains',
      minzoom: 10.5,
      maxzoom: CARZ,
      filter: ['==', ['get', 'dim'], 0],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': fontBold,
        'text-size': ['interpolate', ['linear'], ['zoom'], 10.5, 8.5, 14, 10],
        'text-radial-offset': 1.25,
        'text-variable-anchor': ['right', 'left', 'top', 'bottom'],
        'text-optional': true,
        'symbol-sort-key': ['get', 'sk'],
        'text-padding': 1,
      },
      paint: { 'text-color': ['get', 'tc'], 'text-halo-color': ['get', 'color'], 'text-halo-width': 2.4 },
    });
    ensureLayer({
      id: 'tr-n',
      type: 'symbol',
      source: 'trains',
      maxzoom: CARZ,
      layout: {
        'text-field': ['get', 'nm'],
        'text-font': fontBold,
        'text-size': 11.5,
        'text-radial-offset': 1.6,
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
        'text-justify': 'auto',
        'text-max-width': 16,
        'text-optional': true,
        'text-padding': 3,
        'symbol-sort-key': ['get', 'sk'],
      },
      paint: {
        'text-color': isDark ? '#F8FAFC' : '#0F172A',
        'text-halo-color': isDark ? '#0F172A' : '#FFFFFF',
        'text-halo-width': 2.2,
      },
    });

    // 10. User geolocation marker + accuracy halo
    if (!map.getSource('me')) {
      map.addSource('me', {
        type: 'geojson',
        data: ul ? FC([{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: ul } }]) : FC(),
      });
    }
    if (!map.getLayer('me-ring')) {
      map.addLayer({
        id: 'me-ring',
        type: 'circle',
        source: 'me',
        paint: {
          'circle-radius': 18,
          'circle-color': '#3B82F6',
          'circle-opacity': 0.22,
          'circle-stroke-color': '#60A5FA',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.7,
        },
      });
    }
    if (!map.getLayer('me')) {
      map.addLayer({
        id: 'me',
        type: 'circle',
        source: 'me',
        paint: {
          'circle-radius': 7,
          'circle-color': '#2563EB',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 3,
        },
      });
    }

    layersReadyRef.current = true;
    applyLayerVisibility(map);
    stateRef.current.onMapReady?.();
  };

  // Mount MapLibre once when engine is ready
  useEffect(() => {
    if (!engine || !containerRef.current || mapRef.current) return;

    const initialBasemap = stateRef.current.basemap;
    loadedBasemapRef.current = initialBasemap;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(initialBasemap),
      center: [106.835, -6.235],
      zoom: window.innerWidth < 768 ? 9.7 : 10.6,
      attributionControl: { compact: true },
      maxPitch: 78,
      maxZoom: 20,
      dragRotate: true,
    });
    mapRef.current = map;

    const hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      maxWidth: '260px',
    });

    map.on('style.load', () => {
      layersReadyRef.current = false;
      setupCustomLayers(map);
    });

    map.on('styleimagemissing', (e) => {
      const id = e.id;
      if (!id || map.hasImage(id)) return;
      const dpr = Math.max(2, Math.min(3, Math.ceil(window.devicePixelRatio || 1)));
      if (id.startsWith('tr-')) {
        const k = id.slice(3);
        if (k in STOCK) {
          const sp = spriteCanvas(k, dpr);
          const ctx = sp.canvas.getContext('2d');
          if (ctx) map.addImage(id, ctx.getImageData(0, 0, sp.canvas.width, sp.canvas.height), { pixelRatio: dpr });
        }
      } else if (id.startsWith('cab-') || id.startsWith('tail-')) {
        const rear = id.startsWith('tail-');
        const k = id.slice(rear ? 5 : 4);
        if (k in STOCK) {
          const cb = cabCanvas(k, rear, dpr);
          const ctx = cb.canvas.getContext('2d');
          if (ctx) map.addImage(id, ctx.getImageData(0, 0, cb.canvas.width, cb.canvas.height), { pixelRatio: dpr });
        }
      }
    });

    const interactiveLayers = [...TRAIN_HIT_LAYERS, 'st-c', 'lines', 'jpl-p', 'jpl-x', 'jpl-cl'];
    for (const lid of interactiveLayers) {
      map.on('mouseenter', lid, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', lid, () => {
        map.getCanvas().style.cursor = '';
      });
    }

    let lastHoverTs = 0;
    let lastHoverKey = '';
    const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    const handleHover = (e: maplibregl.MapLayerMouseEvent) => {
      if (isCoarsePointer) return;
      const nowMs = performance.now();
      if (nowMs - lastHoverTs < 48) {
        hoverPopup.setLngLat(e.lngLat);
        return;
      }
      lastHoverTs = nowMs;

      const f = e.features?.[0];
      const E = stateRef.current.engine;
      if (!f || !E) return;
      const date = String(f.properties?.date || '');
      const id = String(f.properties?.id || '');
      const trip = E.day(date).byId.get(id);
      if (!trip) return;
      const line = E.lines.get(trip.line);
      const info = trainDisplayInfo(trip, line);
      const clk = stateRef.current.getClock();
      const t = clk.sec + (trip.date === clk.date ? 0 : 86400);
      const st = E.state(trip, t);
      const kmh = st?.kind === 'run' ? `${clampSpeedKmh(st.v ?? 0, line)} km/j` : 'Berhenti di stasiun';
      const isDark = stateRef.current.theme === 'dark';
      const hoverKey = `${id}|${kmh}|${isDark ? 'd' : 'l'}`;

      hoverPopup.setLngLat(e.lngLat);
      if (hoverKey !== lastHoverKey) {
        lastHoverKey = hoverKey;
        const bg = isDark ? '#0f172a' : '#ffffff';
        const fg = isDark ? '#f8fafc' : '#0f172a';
        const sub = isDark ? '#94a3b8' : '#475569';
        const border = isDark ? '#334155' : '#e2e8f0';
        hoverPopup.setHTML(
          `<div style="background:${bg};color:${fg};border:1px solid ${border};padding:8px 10px;border-radius:10px;font-size:12px;line-height:1.35;">
            <div style="display:flex;align-items:center;gap:6px;font-weight:700;">
              <span style="width:8px;height:8px;border-radius:999px;background:${line?.color || '#2563eb'};flex-shrink:0;"></span>
              <span>${info.name}</span>
            </div>
            <div style="color:${sub};margin-top:2px;font-size:11px;">KA ${info.num} · tujuan ${trip.head}</div>
            <div style="color:${sub};margin-top:2px;font-family:JetBrains Mono,monospace;font-size:11px;">${kmh} · klik untuk detail</div>
          </div>`,
        );
      }
      if (!hoverPopup.isOpen()) hoverPopup.addTo(map);
    };

    for (const lid of TRAIN_HIT_LAYERS) {
      map.on('mousemove', lid, handleHover);
      map.on('mouseleave', lid, () => {
        lastHoverKey = '';
        hoverPopup.remove();
      });
    }

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      lastHoverKey = '';
      hoverPopup.remove();
      const isTouch = window.innerWidth < 768 || isCoarsePointer;
      const padPx = isTouch ? 22 : 14;
      const bb: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - padPx, e.point.y - padPx],
        [e.point.x + padPx, e.point.y + padPx],
      ];
      const activeLayers = [...TRAIN_HIT_LAYERS, 'st-c', 'lines']
        .concat(stateRef.current.layers.jpl ? ['jpl-p', 'jpl-x', 'jpl-cl'] : [])
        .filter((id) => Boolean(map.getLayer(id)));
      const hits = map.queryRenderedFeatures(bb, { layers: activeLayers });

      // Prefer non-dimmed trains if multiple overlap
      const trHits = hits.filter((x: maplibregl.MapGeoJSONFeature) => TRAIN_HIT_LAYER_SET.has(x.layer.id));
      let tr = trHits.find((x: maplibregl.MapGeoJSONFeature) => Number(x.properties?.dim) === 0) || trHits[0];

      // Screen-space proximity fallback for fast-moving trains or touch taps
      let fallbackTrain: { id: string; date: string } | null = null;
      if (!tr && visibleTrainsRef.current.length) {
        const maxDist = isTouch ? 30 : 20;
        let bestDist = maxDist;
        for (const cand of visibleTrainsRef.current) {
          const sp = map.project(cand.p);
          const d = Math.hypot(sp.x - e.point.x, sp.y - e.point.y);
          const penalty = cand.dim ? 6 : 0;
          if (d + penalty < bestDist) {
            bestDist = d + penalty;
            fallbackTrain = { id: cand.id, date: cand.date };
          }
        }
      }

      const st = hits.find((x: maplibregl.MapGeoJSONFeature) => x.layer.id === 'st-c');
      const ln = hits.find((x: maplibregl.MapGeoJSONFeature) => x.layer.id === 'lines');
      const jp = hits.find((x: maplibregl.MapGeoJSONFeature) => x.layer.id === 'jpl-p' || x.layer.id === 'jpl-x');
      const jc = hits.find((x: maplibregl.MapGeoJSONFeature) => x.layer.id === 'jpl-cl');

      if (stateRef.current.pickStationMode && st) {
        stateRef.current.onSelectStation(String(st.properties?.id || ''));
        return;
      }
      if (tr) {
        stateRef.current.onSelectTrain(String(tr.properties?.id || ''), String(tr.properties?.date || ''));
        return;
      }
      if (fallbackTrain) {
        stateRef.current.onSelectTrain(fallbackTrain.id, fallbackTrain.date);
        return;
      }
      if (jc) {
        const src = map.getSource('jpl') as maplibregl.GeoJSONSource | undefined;
        const cid = Number(jc.properties?.cluster_id);
        if (src && Number.isFinite(cid)) {
          src
            .getClusterExpansionZoom(cid)
            .then((z: number) => {
              const coords = (jc.geometry as unknown as GeoJsonPoint).coordinates;
              map.easeTo({ center: coords, zoom: z + 0.6, duration: 420 });
            })
            .catch(() => {});
        }
        return;
      }
      if (jp && stateRef.current.jplData) {
        stateRef.current.onSelectJpl(Number(jp.properties?.i));
      } else if (st) {
        stateRef.current.onSelectStation(String(st.properties?.id || ''));
      } else if (ln) {
        stateRef.current.onSelectLine(String(ln.properties?.line || ''));
      }
    });

    map.on('dragstart', (e: maplibregl.MapLibreEvent<MouseEvent | TouchEvent | undefined>) => {
      if (!e.originalEvent) return;
      if (stateRef.current.followTrain) stateRef.current.onStopFollow();
      if (stateRef.current.threeD && stateRef.current.camera3DMode !== 'free') {
        stateRef.current.onChangeCamera3DMode?.('free');
      }
    });
    map.on('rotatestart', (e: maplibregl.MapLibreEvent<MouseEvent | TouchEvent | undefined>) => {
      if (!e.originalEvent) return;
      if (stateRef.current.threeD && stateRef.current.camera3DMode !== 'free') {
        stateRef.current.onChangeCamera3DMode?.('free');
      }
    });

    const emitCameraView = () => {
      const c = map.getCenter();
      stateRef.current.onViewChange?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() });
    };
    map.on('moveend', emitCameraView);
    map.once('load', emitCameraView);

    // Adaptive animation loop (smooth 30-60fps on desktop, gentle under CPU/software WebGL, 0% when idle/paused)
    let rafId = 0;
    let act: { trip: import('../engine/types').Trip; off: number }[] = [];
    let actT = 0;
    let actKey = '';
    let lastFrame = 0;
    let lastReport = 0;
    let lastFrameSig = '';
    let frameCost = 6;
    let fpsCap = 45;

    const tickFrame = (now: number) => {
      rafId = requestAnimationFrame(tickFrame);
      const st = stateRef.current;
      const E = st.engine;
      if (!E || !layersReadyRef.current || document.hidden || !map.getSource('trains')) return;

      const z = map.getZoom();
      const target = Math.min(fpsCap, z < 7.5 ? 6 : z < 9.5 ? 18 : 40);
      if (now - lastFrame < 1000 / target - 2) return;
      lastFrame = now;

      const clk = st.getClock();
      const selTrainId = st.detail?.type === 'train' ? st.detail.id : null;
      const selLineId = st.detail?.type === 'line' ? st.detail.id : null;
      const b = map.getBounds();
      const pad = 0.1;
      const west = b.getWest() - pad;
      const east = b.getEast() + pad;
      const south = b.getSouth() - pad;
      const north = b.getNorth() + pad;
      const z13 = z >= 12.6;
      const showCars = z >= CARZ;
      const use3DTrains = st.threeD && z >= 14.2;

      const frameSig = `${clk.date}|${Math.floor(clk.sec * 12)}|${selTrainId || ''}|${selLineId || ''}|${st.systemFilter}|${st.activeJourney ? st.activeJourney.dep : ''}|${showCars ? 1 : 0}|${use3DTrains ? 1 : 0}|${st.camera3DMode}|${z13 ? 1 : 0}|${E.kai ? 1 : 0}${E.fr ? 1 : 0}|${st.layers.barang ? st.freightCats.length : 0}|${Math.round(west * 40)},${Math.round(south * 40)},${Math.round(east * 40)},${Math.round(north * 40)}`;
      if (frameSig === lastFrameSig && !use3DTrains && now - lastReport < 1500) return;
      lastFrameSig = frameSig;

      // Hide flat 2D car paint layers when rendering true 3D Three.js rolling stock (keep car-n labels & car-hit clickable!)
      if (active3DModelsRef.current !== use3DTrains) {
        active3DModelsRef.current = use3DTrains;
        const vis2d = use3DTrains ? 'none' : 'visible';
        for (const lid of ['car-glow', 'car-case', 'nose-case', 'car-body', 'nose', 'car-s1', 'car-s2', 'car-end']) {
          if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', vis2d);
        }
        // Soften thick 2D colored route lines right beneath the 3D sleepers & twin steel rails
        if (map.getLayer('sel-route-line')) {
          map.setPaintProperty('sel-route-line', 'line-opacity', use3DTrains ? 0.22 : 0.92);
        }
        if (map.getLayer('lines')) {
          map.setPaintProperty('lines', 'line-opacity', use3DTrains ? 0.28 : 0.88);
        }
      }

      const t0 = performance.now();
      const key = clk.date + (E.kai ? 'k' : '') + (E.fr ? 'f' : '');
      if (now - actT > 1200 || key !== actKey) {
        act = E.active(clk);
        actT = now;
        actKey = key;
      }
      const running = E.running(clk, act);

      if (now - lastReport > 1200 || lastReport === 0) {
        lastReport = now;
        st.onFrameRunning(running);
      }

      const journeyTripIds = st.activeJourney
        ? new Set(st.activeJourney.legs.filter((l) => !l.walk && l.trip).map((l) => l.trip!.id))
        : null;

      const feats: GeoJsonFeature[] = [];
      const carFeats: GeoJsonFeature[] = [];
      const poses3D: Train3DPose[] = [];
      const visibleCandidates: { id: string; date: string; p: [number, number]; dim: number }[] = [];
      const mpp = (156543.03 * Math.cos((map.getCenter().lat * Math.PI) / 180)) / 2 ** z;
      const gap = Math.min(3, Math.max(0.5, mpp * 1.1));
      let selRun: RunningTrain | null = null;
      let selBearing = 0;
      let selConsistLen = 140;

      for (const r of running) {
        const line = E.lines.get(r.trip.line);
        if (!line || !st.layers[line.sys]) continue;
        if (line.sys === 'barang' && line.cat && !st.freightCats.includes(line.cat)) continue;

        const [x, y] = r.s.p;
        const isSel = r.trip.id === selTrainId;
        if (isSel) selRun = r;
        if (!isSel && (x < west || x > east || y < south || y > north)) continue;

        const mv = r.s.kind === 'run' ? 1 : 0;
        let br = r.s.bearing;
        if (mv) bearingsRef.current.set(r.trip.key, br);
        else br = bearingsRef.current.get(r.trip.key) ?? 0;

        const dim =
          (st.systemFilter !== 'all' && chipOf(line.sys) !== st.systemFilter) ||
          (selLineId && r.trip.line !== selLineId) ||
          (journeyTripIds && !journeyTripIds.has(r.trip.id))
            ? 1
            : 0;

        const k = stockKey(line);
        const sp = STOCK[k];
        if (isSel) {
          selBearing = br;
          selConsistLen = sp.len;
        }
        const disp = trainDisplayInfo(r.trip, line);
        const lbl = isSel || (z13 && !dim) ? disp.label : '';
        const props = { id: r.trip.id, date: r.trip.date, color: line.color, sel: isSel ? 1 : 0, dim };

        let pt = r.s.p;
        if (showCars) {
          const sc = Math.max(1, (26 * mpp) / sp.len);
          const tr = E.trail(r.trip, r.s, sp.len * sc + 1);
          if (sc > 1) {
            for (let i = 0; i < tr.cum.length; i++) tr.cum[i] /= sc;
          }
          pt = carFeatures(k, tr, { ...props, nm: lbl, sk: isSel ? 0 : dim ? 2 : 1 }, gap / sc, carFeats);
        }

        if (use3DTrains && (isSel || (!dim && poses3D.length < 10))) {
          const trail3D = E.trail(r.trip, r.s, sp.len + (isSel ? 90 : 12));
          const cars3D = computeConsist3DPoses(trail3D, k, br);
          const spMeta = getSpecialServiceMeta(line);
          poses3D.push({
            id: r.trip.id,
            date: r.trip.date,
            label: disp.label,
            stockKey: k,
            lineColor: line.color,
            selected: isSel,
            specialCar: spMeta?.specialCar ?? null,
            headLngLat: r.s.p,
            bearingDeg: br,
            speedKmh: mv ? clampSpeedKmh(r.s.v ?? 0, line) : 0,
            trailCoords: trail3D.pts,
            cars: cars3D,
          });
        }

        visibleCandidates.push({ id: r.trip.id, date: r.trip.date, p: pt, dim });

        feats.push({
          type: 'Feature',
          properties: {
            ...props,
            k,
            tc: line.text || '#ffffff',
            label: line.short.length > 3 ? '' : line.short,
            nm: lbl,
            sk: isSel ? 0 : dim ? 2 : 1,
            mv,
            b: br,
          },
          geometry: { type: 'Point', coordinates: pt },
        });
      }

      visibleTrainsRef.current = visibleCandidates;
      poses3DRef.current = use3DTrains ? poses3D : [];
      feats.sort((a, b) => Number(a.properties?.sel) - Number(b.properties?.sel) || Number(b.properties?.dim) - Number(a.properties?.dim));
      (map.getSource('trains') as maplibregl.GeoJSONSource | undefined)?.setData(FC(feats));
      if (showCars || hadCarsRef.current) {
        (map.getSource('cars') as maplibregl.GeoJSONSource | undefined)?.setData(FC(carFeats));
      }
      hadCarsRef.current = showCars;

      // Smooth 3D camera tracking for selected train in 3D view presets
      if (st.threeD && selRun && st.camera3DMode !== 'free' && now > camera3DLockUntilRef.current && !map.isMoving()) {
        const camTarget = compute3DCameraTarget(
          selRun.s.p,
          selBearing,
          st.camera3DMode,
          now / 1000,
          selConsistLen,
        );
        if (camTarget) {
          const curCenter = map.getCenter();
          const curBrg = map.getBearing();
          const curPitch = map.getPitch();
          const lerp = 0.16;
          // Shortest angular interpolation for bearing
          let dBrg = ((camTarget.bearing - curBrg + 540) % 360) - 180;
          if (Math.abs(dBrg) < 0.05) dBrg = 0;
          const isMobile = window.innerWidth < 768;
          map.jumpTo({
            center: [
              curCenter.lng + (camTarget.center[0] - curCenter.lng) * lerp,
              curCenter.lat + (camTarget.center[1] - curCenter.lat) * lerp,
            ],
            bearing: curBrg + dBrg * 0.1,
            pitch: curPitch + (camTarget.pitch - curPitch) * 0.1,
            padding: isMobile
              ? { top: 235, bottom: 180, left: 12, right: 12 }
              : { top: 150, bottom: 90, left: 400, right: 56 },
          });
        }
      } else if (st.followTrain && selRun && !map.isMoving()) {
        map.jumpTo({ center: selRun.s.p });
      }

      if (use3DTrains && poses3D.length > 0) {
        map.triggerRepaint();
      }

      frameCost = frameCost * 0.9 + (performance.now() - t0) * 0.1;
      fpsCap = frameCost > 18 ? 10 : frameCost > 10 ? 22 : 45;
    };

    rafId = requestAnimationFrame(tickFrame);

    return () => {
      cancelAnimationFrame(rafId);
      hoverPopup.remove();
      poses3DRef.current = [];
      map.remove();
      mapRef.current = null;
      layersReadyRef.current = false;
    };
  }, [engine]);

  // Switch basemap style cleanly on basemap mode change (light / dark / satellite / hybrid)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loadedBasemapRef.current === basemap) return;
    loadedBasemapRef.current = basemap;
    layersReadyRef.current = false;
    active3DModelsRef.current = false;
    map.setStyle(buildMapStyle(basemap), { diff: false });
  }, [basemap]);

  // Refresh line/station sources if engine bundles (KAI / Freight) finish loading
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !engine || !layersReadyRef.current) return;
    (map.getSource('lines') as maplibregl.GeoJSONSource | undefined)?.setData(buildLineFeatures(engine));
    (map.getSource('stations') as maplibregl.GeoJSONSource | undefined)?.setData(buildStationFeatures(engine));
  }, [engine, engine?.kai, engine?.fr]);

  // Layer visibility & 3D / Underground toggles
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    applyLayerVisibility(map);
  }, [layers, underground, threeD]);

  // Smooth camera transition when toggling 3D mode or switching 3D camera presets
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!threeD) {
      poses3DRef.current = [];
      if (active3DModelsRef.current) {
        active3DModelsRef.current = false;
        for (const lid of ['car-glow', 'car-case', 'nose-case', 'car-body', 'nose', 'car-s1', 'car-s2', 'car-end']) {
          if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', 'visible');
        }
        if (map.getLayer('sel-route-line')) map.setPaintProperty('sel-route-line', 'line-opacity', 0.92);
        if (map.getLayer('lines')) map.setPaintProperty('lines', 'line-opacity', 0.88);
      }
      const nextZoom = map.getZoom() > 15.8 ? 14.5 : map.getZoom();
      map.easeTo({
        pitch: 0,
        bearing: 0,
        zoom: nextZoom,
        padding: { top: 0, bottom: 0, left: 0, right: 0 },
        duration: 500,
      });
      return;
    }

    // If a train is currently selected, swoop smoothly into the active 3D camera preset!
    const E = stateRef.current.engine;
    const det = stateRef.current.detail;
    if (E && det?.type === 'train' && camera3DMode !== 'free') {
      const found = E.find(det.id, stateRef.current.getClock(), det.date);
      if (found) {
        const st = E.state(found.trip, found.t);
        const line = E.lines.get(found.trip.line);
        if (st && line) {
          const br = st.kind === 'run' ? st.bearing : (bearingsRef.current.get(found.trip.key) ?? 0);
          const k = stockKey(line);
          const target = compute3DCameraTarget(
            st.p,
            br,
            camera3DMode,
            performance.now() / 1000,
            STOCK[k].len,
          );
          if (target) {
            const isMobile = window.innerWidth < 768;
            camera3DLockUntilRef.current = performance.now() + 760;
            map.easeTo({
              center: target.center,
              zoom: target.zoom,
              pitch: target.pitch,
              bearing: target.bearing,
              padding: isMobile
                ? { top: 235, bottom: 180, left: 12, right: 12 }
                : { top: 150, bottom: 90, left: 400, right: 56 },
              duration: 700,
              essential: true,
            });
            return;
          }
        }
      }
    }

    map.easeTo({ pitch: 58, duration: 480 });
  }, [threeD, camera3DMode, detail]);

  // JPL GeoJSON updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    (map.getSource('jpl') as maplibregl.GeoJSONSource | undefined)?.setData(buildJplFeatures(jplData, jplFilter));
  }, [jplData, jplFilter]);

  // Terminals GeoJSON updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    (map.getSource('terminals') as maplibregl.GeoJSONSource | undefined)?.setData(buildTerminalFeatures(terminalsData));
  }, [terminalsData]);

  // Selected train route overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !engine || !layersReadyRef.current) return;
    (map.getSource('sel-route') as maplibregl.GeoJSONSource | undefined)?.setData(
      buildSelectedTrainRoute(engine, detail, getClock()),
    );
  }, [engine, detail, getClock]);

  // Selected JPL ring overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    (map.getSource('jpl-sel') as maplibregl.GeoJSONSource | undefined)?.setData(
      buildSelectedJplFeature(jplData, selectedJplIndex),
    );
  }, [jplData, selectedJplIndex]);

  // Journey route overlay
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !engine || !layersReadyRef.current) return;
    (map.getSource('route') as maplibregl.GeoJSONSource | undefined)?.setData(buildJourneyFeatures(engine, activeJourney));
  }, [engine, activeJourney]);

  // User location dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    const src = map.getSource('me') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(
      userLocation
        ? FC([{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: userLocation } }])
        : FC(),
    );
  }, [userLocation]);

  // Execute camera commands
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !command) return;
    const isMobile = window.innerWidth < 768;
    if (command.type === 'flyTo' && command.lng !== undefined && command.lat !== undefined) {
      map.flyTo({
        center: [command.lng, command.lat],
        zoom: command.zoom ?? map.getZoom(),
        padding: isMobile ? { top: 88, bottom: 260, left: 16, right: 56 } : { top: 64, bottom: 96, left: 0, right: 56 },
        duration: 600,
        essential: true,
      });
    } else if (command.type === 'fitBounds' && command.bounds) {
      map.fitBounds(command.bounds, {
        padding: isMobile
          ? { top: 96, right: 56, bottom: 300, left: 24 }
          : { top: 84, right: 72, bottom: 112, left: 420 },
        maxZoom: 14,
        duration: 650,
      });
    } else if (command.type === 'zoomIn') {
      map.zoomIn({ duration: 240 });
    } else if (command.type === 'zoomOut') {
      map.zoomOut({ duration: 240 });
    }
  }, [command]);

  return (
    <div
      ref={containerRef}
      data-testid="sepur-map-canvas"
      className="h-full w-full relative bg-slate-100 dark:bg-slate-950"
    />
  );
}
