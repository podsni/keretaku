export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface GeoJsonMultiLineString {
  type: 'MultiLineString';
  coordinates: [number, number][][];
}

export type GeoJsonGeometry = GeoJsonPoint | GeoJsonLineString | GeoJsonMultiLineString;

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: GeoJsonGeometry;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export type SystemId =
  | 'krl'
  | 'mrt'
  | 'lrtj'
  | 'jbdb'
  | 'bandara'
  | 'whoosh'
  | 'regional'
  | 'kai'
  | 'barang';

export type SystemFilterId =
  | 'all'
  | 'krl'
  | 'mrt'
  | 'lrt'
  | 'bandara'
  | 'whoosh'
  | 'kai'
  | 'barang';

export type FreightCategory = 'cargo' | 'tanker' | 'parcel' | 'service' | 'trans';

export interface SystemMeta {
  id: SystemId;
  name: string;
  operator: string;
  sched: string;
  src: string;
}

export interface Station {
  id: string;
  name: string;
  lng: number;
  lat: number;
  sys: SystemId[];
  lines?: string[];
  xfer?: string[];
  code?: string;
}

export interface FreqSpec {
  kmh: number;
  dwell: number;
  weekday?: [number, number, number][];
  weekend?: [number, number, number][];
}

export interface Line {
  id: string;
  short: string;
  svc?: string;
  name: string;
  color: string;
  text?: string;
  sys: SystemId;
  stations: string[];
  branches?: string[][];
  sched?: string;
  src?: string;
  fak?: boolean;
  bundle?: string;
  pairs?: string[];
  cat?: FreightCategory;
  vmax?: number;
  freq?: FreqSpec;
  freqDays?: ('weekday' | 'weekend')[];
}

export interface NetworkSegment {
  m?: string;
  c: [number, number][];
}

export interface NetworkData {
  v: number;
  builtAt: string;
  systems: SystemMeta[];
  holidays: string[];
  stations: Station[];
  lines: Line[];
  segs: Record<string, [number, number][]>;
  net: NetworkSegment[];
  tunnels: [number, number][][];
  meta?: {
    krl?: { weekday: string; weekend: string };
    gapeka?: string;
    shiori?: string;
  };
}

export type PackedTrip = [
  string, // id
  string, // line
  string, // head
  string[], // sids
  number[], // dep
  number[] | null, // arr
  number[] | null, // flags
];

export interface TripsData {
  v: number;
  meta?: {
    krl?: { weekday: string; weekend: string };
    gapeka?: string;
    shiori?: string;
  };
  weekday?: PackedTrip[];
  weekend?: PackedTrip[];
  daily?: PackedTrip[];
}

export interface KaiData {
  v: number;
  meta?: TripsData['meta'];
  lines: Line[];
  segs: Record<string, [number, number][]>;
  daily: PackedTrip[];
}

export interface FreightData {
  v: number;
  meta?: TripsData['meta'];
  cats: Record<string, number>;
  lines: Line[];
  stations?: Station[];
  segs: Record<string, [number, number][]>;
  daily: PackedTrip[];
}

export interface MotionProfile {
  D: number;
  T: number;
  vc: number;
  ae: number;
  ta: number;
  tb: number;
}

export interface SpeedLeg {
  i: number;
  D: number;
  T: number;
  avg: number;
  vmax: number;
  straight: boolean;
}

export interface SpeedProfile {
  D: number;
  T: number;
  run: number;
  avg: number;
  runAvg: number;
  vmax: number;
  legs: SpeedLeg[];
  pts: [number, number][];
}

export interface Trip {
  id: string;
  line: string;
  head: string;
  sids: string[];
  dep: number[];
  arr: number[];
  flags: number[];
  est: boolean;
  freight?: boolean;
  start: number;
  end: number;
  date: string;
  type: 'weekday' | 'weekend';
  key: string;
  _vt?: { dep: number[]; arr: number[] };
  _a?: number;
  _m?: MotionProfile[];
  _sp?: SpeedProfile;
}

export interface TrainState {
  kind: 'dwell' | 'run';
  at?: number;
  from?: number;
  next: number | null;
  p: [number, number];
  bearing: number;
  progress: number;
  nextStop?: number;
  v?: number;
  vc?: number;
  d?: number;
}

export interface RunningTrain {
  trip: Trip;
  s: TrainState;
  t: number;
  mid?: [number, number];
}

export interface ClockState {
  date: string;
  dow: number;
  sec: number;
}

export interface DepartureItem {
  trip: Trip;
  i: number;
  dep: number;
  wait: number;
}

export interface StationDayRow {
  trip: Trip;
  i: number;
  dep: number;
  arr: number;
  terminates: boolean;
  origin: boolean;
}

export interface LineGridRow {
  sid: string;
  cells: (number | undefined)[];
}

export interface JourneyLeg {
  walk?: boolean;
  from: string;
  to: string;
  dep: number;
  arr: number;
  dur?: number;
  trip?: Trip;
  i?: number;
  j?: number;
  off?: number;
}

export interface Journey {
  legs: JourneyLeg[];
  dep: number;
  arr: number;
  transfers: number;
  date: string;
}

export interface JplPass {
  trip: Trip;
  at: number;
  dt: number;
  v: number;
  toward: string;
}

export type JplRawRow = [
  number | string, // 0 osm
  number, // 1 lng
  number, // 2 lat
  string, // 3 cat
  number, // 4 flags
  string, // 5 barrier
  string, // 6 road
  string, // 7 ref
  string, // 8 segA
  string, // 9 segB
  number, // 10 m_from_A
  number, // 11 seg_len
  string | number | null, // 12 km
  string, // 13 highway
  string, // 14 name
  string, // 15 daop
  number | null, // 16 tracks
  number, // 17 conf
  string, // 18 src
  number, // 19 photo index
  string, // 20 mapillary
  number, // 21 osm_nodes
];

export type JplPhotoRow = [
  string, // file
  string, // thumb
  number, // w
  number, // h
  string, // author
  string, // licence
  string, // licenceUrl
  string, // page
  number, // dist_m
  string, // via
  string, // date
];

export interface JplData {
  v: number;
  builtAt: string;
  src: string;
  stats: Record<string, number>;
  daop: Record<string, Record<string, number> & { all: number }>;
  photos: JplPhotoRow[];
  x: JplRawRow[];
}

export interface JplItem {
  i: number;
  osm: string;
  p: [number, number];
  cat: string;
  light: boolean;
  bell: boolean;
  sup: boolean;
  noLight: boolean;
  noBell: boolean;
  dInf: boolean;
  barrier: string;
  road: string;
  ref: string;
  a: string;
  b: string;
  dA: number;
  L: number;
  km: string | null;
  hw: string;
  name: string;
  daop: string;
  tracks: number | null;
  conf: number;
  src: string;
  ph: JplPhotoRow | null;
  mly: string;
  nodes: number;
}

export type TerminalRawRow = [
  number, // lng
  number, // lat
  string, // type: cargo | fuel | yard
  string, // name
  string, // operator
  string, // osm
  string, // near station
  number, // dist m
];

export interface TerminalsData {
  v: number;
  src: string;
  x: TerminalRawRow[];
}

export interface FleetEntry {
  img: string;
  model: string;
  caption: string;
  author: string;
  license: string;
  licenseUrl: string;
  source: string;
  title: string;
}

export type FleetMap = Record<string, FleetEntry>;

export interface StationExtraEntry {
  wd?: string;
  daop?: string;
  km?: string;
  wp?: string;
  img?: {
    f: string;
    t: string;
    w: number;
    h: number;
    p: string;
    a: string;
    l: string;
    lu: string;
  };
}

export interface StationsExtraData {
  v: number;
  src: string;
  stats: Record<string, number>;
  s: Record<string, StationExtraEntry>;
}

export interface LayerState {
  krl: boolean;
  mrt: boolean;
  lrtj: boolean;
  jbdb: boolean;
  bandara: boolean;
  whoosh: boolean;
  regional: boolean;
  kai: boolean;
  barang: boolean;
  jpl: boolean;
  terminals: boolean;
  stations: boolean;
  net: boolean;
  labels: boolean;
}

export interface JplFilter {
  cats: string[];
  daop: string;
}

export type SidebarTab = 'beranda' | 'jalur' | 'rute' | 'stasiun';

export type DetailState =
  | null
  | { type: 'train'; id: string; date: string }
  | { type: 'station'; id: string }
  | { type: 'line'; id: string }
  | { type: 'jpl'; index: number };

export type MapBasemapId = 'light' | 'dark' | 'satellite' | 'hybrid';

export interface RegionPreset {
  id: string;
  label: string;
  lng: number;
  lat: number;
  zoom: number;
}

