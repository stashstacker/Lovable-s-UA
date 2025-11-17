
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Polygonal Map Generator</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
    }
  </style>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="importmap">
{
  "imports": {
    "react-dom/": "https://aistudiocdn.com/react-dom@^19.1.1/",
    "react/": "https://aistudiocdn.com/react@^19.1.1/",
    "react": "https://aistudiocdn.com/react@^19.1.1",
    "d3": "https://aistudiocdn.com/d3@^7.9.0",
    "d3-delaunay": "https://aistudiocdn.com/d3-delaunay@^6.0.4"
  }
}
</script>
</head>
<body class="bg-gray-900">
  <div id="root"></div>
  <script type="text/babel" data-type="module">
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Delaunay } from 'd3-delaunay';

// --- From constants.ts ---
const CITY_VIEW_OVERLAY_COLOR = 'rgba(31, 41, 55, 0.75)';
const HOVER_OPACITY_CITY = 0.9;
const DEFAULT_OPACITY_CITY = 0.6;
const HOVER_OPACITY_DISTRICT = 1.0;
const DEFAULT_OPACITY_DISTRICT = 0.8;
const STATE_BORDER_COLOR = 'rgba(255, 255, 255, 0.8)';
const CITY_BORDER_COLOR = 'rgba(255, 255, 255, 0.5)';
const DISTRICT_BORDER_COLOR = 'rgba(255, 255, 255, 0.6)';
const STATE_BORDER_WIDTH = 3;
const CITY_BORDER_WIDTH = 1;
const DISTRICT_BORDER_WIDTH = 1.5;
const MIN_ZOOM = 1;
const MAX_ZOOM = 15;
const ZOOM_SENSITIVITY = 0.001;
const CANONICAL_MAP_WIDTH = 1000;
const CANONICAL_MAP_HEIGHT = 1000;
const NUM_POINTS = 12000;
const NUM_RELAXATIONS = 0;
const KMEANS_MAX_ITERATIONS = 50;
const KMEANS_CONVERGENCE_THRESHOLD = 1;
const TERRAIN_NOISE_SCALE = 2.5;
const ISLAND_FALLOFF_POWER = 2.5;
const LAND_THRESHOLD = 0.25;
const CITY_COLOR_MIN_BRIGHTNESS = 0.3;
const CITY_COLOR_MAX_BRIGHTNESS = 1.0;
const CITY_COLOR_SATURATION_BOOST = 0.2;
const DISTRICT_COLOR_MIN_BRIGHTNESS = 0.2;
const DISTRICT_COLOR_MAX_BRIGHTNESS = 0.6;
const DISTRICT_COLOR_SATURATION_BOOST = 0.1;

// --- From components/Loader.tsx ---
const Loader = ({ className = 'w-8 h-8' }) => {
  return (
    <div 
      className={`loader border-4 border-gray-600 border-t-cyan-400 rounded-full animate-spin ${className}`}
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

// --- From hooks/useMapSimulation.ts ---
let cachedPoints = null;
const initialSimulationState = {
  points: [], delaunay: null, voronoi: null, cellData: [],
  theme: { biomeColors: {} }, stateGroups: [], stateColors: {},
  cityGroups: [], cityColors: {}, districtGroups: [], districtColors: {},
  biomePaths: new Map(), statePaths: new Map(), cityPaths: new Map(), districtPaths: new Map(),
  landCells: [], hoveredStateId: -1, hoveredCityId: -1, hoveredDistrictId: -1,
};

const workerScript = `
  importScripts(
    "https://d3js.org/d3.v7.min.js",
    "https://d3js.org/d3-delaunay.v6.min.js"
  );
  class PerlinNoise {
    p = new Uint8Array(512);
    constructor(seed) { this.seed(seed); }
    seed(seed) {
      const random = (() => { let s = seed * 233280; return () => (s = (s * 9301 + 49297) % 233280) / 233280; })();
      for (let i = 0; i < 256; i++) this.p[i] = i;
      for (let i = 255; i > 0; i--) { const n = Math.floor((i + 1) * random()); const t = this.p[i]; this.p[i] = this.p[n]; this.p[n] = t; }
      for (let i = 0; i < 256; i++) this.p[i + 256] = this.p[i];
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y, z) {
      const h = hash & 15; const u = h < 8 ? x : y; const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    noise(x, y, z) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
      x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
      const u = this.fade(x), v = this.fade(y), w = this.fade(z);
      const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
      const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;
      return this.lerp(w, this.lerp(v, this.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)), this.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))), this.lerp(v, this.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)), this.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))));
    }
  }
  const generateVoronoiStructure = ({ width, height, NUM_POINTS, NUM_RELAXATIONS }) => {
    let points = Array.from({ length: NUM_POINTS }, () => [Math.random() * width, Math.random() * height]);
    for (let i = 0; i < NUM_RELAXATIONS; i++) {
      const voronoi = d3.Delaunay.from(points).voronoi([0, 0, width, height]);
      points = points.map((p, i) => {
        const polygon = voronoi.cellPolygon(i);
        return polygon ? d3.polygonCentroid(polygon) : p;
      });
    }
    return { points };
  };
  const generateTerritoryPolygons = (groups, sourceVoronoi) => {
      const territoryPolygons = {};
      const groupsMap = new Map();
      groups.forEach((id, i) => { if (id !== -1 && id !== undefined) { if (!groupsMap.has(id)) groupsMap.set(id, []); groupsMap.get(id).push(i); } });
      for (const [id, cells] of groupsMap.entries()) {
          const edgeCounts = new Map();
          for (const cellIndex of cells) {
              const polygon = sourceVoronoi.cellPolygon(cellIndex);
              if (!polygon) continue;
              for (let i = 0; i < polygon.length; i++) {
                  const p1 = polygon[i];
                  const p2 = polygon[(i + 1) % polygon.length];
                  const key = [p1, p2].map(p => p[0].toFixed(5) + ',' + p[1].toFixed(5)).sort().join(':');
                  edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
              }
          }
          const boundaryEdges = [];
          for (const [key, count] of edgeCounts.entries()) {
              if (count === 1) {
                  const [p1Str, p2Str] = key.split(':');
                  boundaryEdges.push([p1Str.split(',').map(Number), p2Str.split(',').map(Number)]);
              }
          }
          const stitchedPolygons = [];
          while (boundaryEdges.length > 0) {
              let [currentP1, currentP2] = boundaryEdges.pop();
              const currentPolygon = [currentP1, currentP2];
              while (true) {
                  let foundNext = false;
                  for (let j = boundaryEdges.length - 1; j >= 0; j--) {
                      const [nextP1, nextP2] = boundaryEdges[j];
                      const p2Str = '' + currentP2[0].toFixed(5) + ',' + currentP2[1].toFixed(5);
                      if (p2Str === '' + nextP1[0].toFixed(5) + ',' + nextP1[1].toFixed(5)) {
                          currentP2 = nextP2;
                          currentPolygon.push(currentP2);
                          boundaryEdges.splice(j, 1);
                          foundNext = true;
                          break;
                      } else if (p2Str === '' + nextP2[0].toFixed(5) + ',' + nextP2[1].toFixed(5)) {
                          currentP2 = nextP1;
                          currentPolygon.push(currentP2);
                          boundaryEdges.splice(j, 1);
                          foundNext = true;
                          break;
                      }
                  }
                  if (!foundNext) break;
              }
              stitchedPolygons.push(currentPolygon);
          }
          territoryPolygons[id] = stitchedPolygons;
      }
      return territoryPolygons;
  };
  const shapeWorld = ({ points, voronoi, mapOptions, width, height, ...config }) => {
    const { theme } = mapOptions;
    const elevationNoise = new PerlinNoise(Math.random());
    const moistureNoise = new PerlinNoise(Math.random() + 1);
    const center = { x: width / 2, y: height / 2 };
    const maxDist = Math.hypot(center.x, center.y);
    const cellData = points.map((p, i) => {
      const polygon = voronoi.cellPolygon(i);
      let isBorderCell = false;
      if (polygon) {
        for (const vertex of polygon) {
          if (vertex[0] <= 1 || vertex[0] >= width - 1 || vertex[1] <= 1 || vertex[1] >= height - 1) {
            isBorderCell = true;
            break;
          }
        }
      } else {
        isBorderCell = true;
      }
      let biome;
      if (isBorderCell) {
        if (theme === 'desert') biome = 'QUICKSAND';
        else if (theme === 'ice') biome = 'FROZEN_SEA';
        else biome = 'OCEAN';
      } else {
        const nx = p[0] / width;
        const ny = p[1] / height;
        let e = (elevationNoise.noise(nx * config.TERRAIN_NOISE_SCALE, ny * config.TERRAIN_NOISE_SCALE, 0) + 1) / 2;
        const falloff = 1 - Math.pow(Math.hypot(p[0] - center.x, p[1] - center.y) / maxDist, config.ISLAND_FALLOFF_POWER);
        e *= falloff;
        let m = (moistureNoise.noise(nx * config.TERRAIN_NOISE_SCALE * 0.8, ny * config.TERRAIN_NOISE_SCALE * 0.8, 0.5) + 1) / 2;
        if (theme === 'default') {
          if (e > config.LAND_THRESHOLD) {
            if (e > 0.6) biome = 'MOUNTAIN';
            else if (m > 0.5) biome = 'FOREST';
            else biome = 'GRASSLAND';
          } else biome = 'OCEAN';
        } else if (theme === 'desert') {
          if (e > config.LAND_THRESHOLD) {
            if (e > 0.55) biome = 'ROCKY';
            else if (m > 0.7) biome = 'OASIS';
            else biome = 'SAND';
          } else biome = 'QUICKSAND';
        } else if (theme === 'ice') {
          if (e > config.LAND_THRESHOLD) {
            if (e > 0.6) biome = 'GLACIER';
            else if (m > 0.4) biome = 'TUNDRA';
            else biome = 'SNOW';
          } else biome = 'FROZEN_SEA';
        } else {
          biome = 'OCEAN';
        }
      }
      return { biome };
    });
    const habitableBiomes = new Set(['GRASSLAND', 'FOREST', 'MOUNTAIN', 'SAND', 'OASIS', 'ROCKY', 'SNOW', 'TUNDRA', 'GLACIER']);
    const landCells = cellData.map((d, i) => habitableBiomes.has(d.biome) ? i : -1).filter(i => i !== -1);
    const biomeGroups = cellData.map(d => d.biome);
    const biomeNames = [...new Set(biomeGroups)];
    const biomeIdMap = new Map(biomeNames.map((name, i) => [name, i]));
    const biomeNumericGroups = biomeGroups.map(name => biomeIdMap.get(name));
    const numericBiomePolygons = generateTerritoryPolygons(biomeNumericGroups, voronoi);
    const biomePolygons = {};
    for (const idStr in numericBiomePolygons) {
        const biomeName = biomeNames[Number(idStr)];
        if (biomeName) biomePolygons[biomeName] = numericBiomePolygons[idStr];
    }
    return { cellData, landCells, biomePolygons };
  };
  const createCivilization = ({ landCells, points, voronoi, mapOptions, ...config }) => {
    const { numCities, numDistrictsPerCity } = mapOptions;
    const stateGroups = new Array(points.length).fill(-1);
    landCells.forEach(i => { stateGroups[i] = 0; });
    const generatePartitions = (parentGroups, numChildren, validPoints, basePoints) => {
        if (!basePoints || basePoints.length === 0 || validPoints.length < numChildren) return [];
        const childGroups = new Array(basePoints.length).fill(-1);
        let childCounter = 0;
        const parents = new Map();
        parentGroups.forEach((parentId, i) => {
            if (parentId !== -1 && validPoints.includes(i)) {
                if (!parents.has(parentId)) parents.set(parentId, []);
                parents.get(parentId).push(i);
            }
        });
        for (const [, parentCells] of parents.entries()) {
            if (parentCells.length < numChildren) continue;
            let centroids = d3.shuffle(parentCells.slice()).slice(0, numChildren).map(i => basePoints[i]);
            for (let iter = 0; iter < config.KMEANS_MAX_ITERATIONS; iter++) {
                const groupSums = Array.from({ length: numChildren }, () => ({ x: 0, y: 0, count: 0 }));
                parentCells.forEach(cellIndex => {
                    const p = basePoints[cellIndex];
                    let closestIndex = 0, minDistance = Infinity;
                    centroids.forEach((c, j) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d < minDistance) { minDistance = d; closestIndex = j; } });
                    const groupSum = groupSums[closestIndex];
                    groupSum.x += p[0]; groupSum.y += p[1]; groupSum.count++;
                });
                let totalMovement = 0;
                const newCentroids = centroids.map((c, i) => {
                    const groupSum = groupSums[i];
                    if (groupSum.count > 0) { const newX = groupSum.x / groupSum.count, newY = groupSum.y / groupSum.count; totalMovement += Math.hypot(c[0] - newX, c[1] - newY); return [newX, newY]; }
                    return c;
                });
                centroids = newCentroids;
                if (totalMovement < config.KMEANS_CONVERGENCE_THRESHOLD) break;
            }
            parentCells.forEach(cellIndex => {
                const p = basePoints[cellIndex];
                let closestIndex = 0, minDistance = Infinity;
                centroids.forEach((c, j) => { const d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d < minDistance) { minDistance = d; closestIndex = j; } });
                childGroups[cellIndex] = childCounter + closestIndex;
            });
            childCounter += numChildren;
        }
        return childGroups;
    };
    let cityGroups = [], districtGroups = [];
    if (landCells.length >= numCities) {
      cityGroups = generatePartitions(stateGroups, numCities, landCells, points);
      districtGroups = generatePartitions(cityGroups, numDistrictsPerCity, landCells, points);
    }
    const statePolygons = generateTerritoryPolygons(stateGroups, voronoi);
    const cityPolygons = generateTerritoryPolygons(cityGroups, voronoi);
    const districtPolygons = generateTerritoryPolygons(districtGroups, voronoi);
    return { stateGroups, cityGroups, districtGroups, territoryPolygons: { statePolygons, cityPolygons, districtPolygons } };
  };
  const generateVisuals = ({ stateGroups, cityGroups, districtGroups, mapOptions, ...config }) => {
    const { theme: themeName } = mapOptions;
    let biomeColors = {};
    if (themeName === 'default') {
      biomeColors = { OCEAN: "#172554", GRASSLAND: "#65a30d", FOREST: "#166534", MOUNTAIN: "#78716c" };
    } else if (themeName === 'desert') {
      biomeColors = { QUICKSAND: "#a16207", SAND: "#fde68a", OASIS: "#16a34a", ROCKY: "#a8a29e" };
    } else if (themeName === 'ice') {
      biomeColors = { FROZEN_SEA: "#38bdf8", SNOW: "#f8fafc", TUNDRA: "#a3bf8c", GLACIER: "#e0f2fe" };
    }
    const theme = { biomeColors };
    const stateColors = {}, cityColors = {}, districtColors = {};
    const baseLandColor = themeName === 'default' ? biomeColors.GRASSLAND : themeName === 'desert' ? biomeColors.SAND : biomeColors.SNOW;
    [...new Set(stateGroups)].filter(id => id !== -1).forEach(id => { stateColors[id] = d3.hsl(baseLandColor).toString(); });
    [...new Set(cityGroups)].filter(id => id !== -1).forEach(cityId => {
      const firstCellIdx = cityGroups.findIndex(id => id === cityId);
      if (firstCellIdx !== -1) {
        const parentStateId = stateGroups[firstCellIdx];
        const baseColor = d3.hsl(stateColors[parentStateId]);
        if (baseColor) {
            const cityColor = baseColor.brighter((config.CITY_COLOR_MIN_BRIGHTNESS ?? 0.3) + Math.random() * ((config.CITY_COLOR_MAX_BRIGHTNESS ?? 1.0) - (config.CITY_COLOR_MIN_BRIGHTNESS ?? 0.3)));
            cityColor.s = Math.min(1, cityColor.s + (Math.random() * (config.CITY_COLOR_SATURATION_BOOST ?? 0.2)));
            cityColors[cityId] = cityColor.toString();
        }
      }
    });
    [...new Set(districtGroups)].filter(id => id !== -1).forEach(districtId => {
      const firstCellIdx = districtGroups.findIndex(id => id === districtId);
      if (firstCellIdx !== -1) {
        const parentCityId = cityGroups[firstCellIdx];
        const baseColor = d3.hsl(cityColors[parentCityId]);
        if(baseColor) {
            const districtColor = baseColor.brighter((config.DISTRICT_COLOR_MIN_BRIGHTNESS ?? 0.2) + Math.random() * ((config.DISTRICT_COLOR_MAX_BRIGHTNESS ?? 0.6) - (config.DISTRICT_COLOR_MIN_BRIGHTNESS ?? 0.2)));
            districtColor.s = Math.min(1, districtColor.s + (Math.random() * (config.DISTRICT_COLOR_SATURATION_BOOST ?? 0.1)));
            districtColors[districtId] = districtColor.toString();
        }
      }
    });
    return { theme, stateColors, cityColors, districtColors };
  };
  self.onmessage = (e) => {
    const { mapOptions, width, height, cachedPoints, generationConfig } = e.data;
    const { foundation, worldShaping, civilization: civilizationConfig, cartography } = generationConfig;
    const structure = cachedPoints ? { points: cachedPoints } : generateVoronoiStructure({ width, height, ...foundation });
    const { points } = structure;
    const delaunay = d3.Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, width, height]);
    const world = shapeWorld({ points, voronoi, mapOptions, width, height, ...worldShaping });
    const civilization = createCivilization({ landCells: world.landCells, points, voronoi, mapOptions, ...civilizationConfig });
    const visuals = generateVisuals({ 
        stateGroups: civilization.stateGroups, 
        cityGroups: civilization.cityGroups, 
        districtGroups: civilization.districtGroups, 
        mapOptions, 
        ...cartography 
    });
    const response = {
        points: points,
        cellData: world.cellData,
        landCells: world.landCells,
        biomePolygons: world.biomePolygons,
        stateGroups: civilization.stateGroups,
        cityGroups: civilization.cityGroups,
        districtGroups: civilization.districtGroups,
        territoryPolygons: civilization.territoryPolygons,
        theme: visuals.theme,
        stateColors: visuals.stateColors,
        cityColors: visuals.cityColors,
        districtColors: visuals.districtColors,
    };
    self.postMessage(response);
  };
`;

function reconstructPaths(polygons) {
    const paths = new Map();
    const keys = Object.keys(polygons);
    const useNumericKeys = keys.length > 0 && keys.every(k => /^\\d+$/.test(k));

    for (const idStr in polygons) {
        if (Object.prototype.hasOwnProperty.call(polygons, idStr)) {
            const key = useNumericKeys ? Number(idStr) : idStr;
            const path = new Path2D();
            const territoryPolygons = polygons[idStr];
            for (const polygon of territoryPolygons) {
                if (polygon.length > 0) {
                    path.moveTo(polygon[0][0], polygon[0][1]);
                    for (let i = 1; i < polygon.length; i++) {
                        path.lineTo(polygon[i][0], polygon[i][1]);
                    }
                    path.closePath();
                }
            }
            paths.set(key, path);
        }
    }
    return paths;
}

const useMapSimulation = ({
  mapOptions,
  generateTrigger,
  setIsLoading,
}) => {
  const [simulationState, setSimulationState] = useState(() => initialSimulationState);
  const workerRef = useRef(null);

  useEffect(() => {
    const blob = new Blob([workerScript], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);
    workerRef.current = worker;
    
    return () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    worker.onmessage = (e) => {
      const { points, territoryPolygons, biomePolygons, ...rest } = e.data;
      
      if (!points || !territoryPolygons || !biomePolygons) {
        console.error("Worker response missing points, territoryPolygons, or biomePolygons data.");
        setIsLoading(false);
        return;
      }
      
      const delaunay = Delaunay.from(points);
      const voronoi = delaunay.voronoi([0, 0, CANONICAL_MAP_WIDTH, CANONICAL_MAP_HEIGHT]);
      
      const biomePaths = reconstructPaths(biomePolygons);
      const statePaths = reconstructPaths(territoryPolygons.statePolygons);
      const cityPaths = reconstructPaths(territoryPolygons.cityPolygons);
      const districtPaths = reconstructPaths(territoryPolygons.districtPolygons);

      setSimulationState({
        ...rest,
        points,
        delaunay,
        voronoi,
        biomePaths,
        statePaths,
        cityPaths,
        districtPaths,
        hoveredStateId: -1,
        hoveredCityId: -1,
        hoveredDistrictId: -1,
      });

      if (!cachedPoints) {
        cachedPoints = points;
      }
      
      setIsLoading(false);
    };

  }, [setIsLoading]);

  useEffect(() => {
    if (generateTrigger === 0) return;
    const worker = workerRef.current;
    if (!worker) return;

    setIsLoading(true);

    const generationConfig = {
      foundation: {
        NUM_POINTS,
        NUM_RELAXATIONS,
      },
      worldShaping: {
        TERRAIN_NOISE_SCALE,
        ISLAND_FALLOFF_POWER,
        LAND_THRESHOLD,
      },
      civilization: {
        KMEANS_MAX_ITERATIONS,
        KMEANS_CONVERGENCE_THRESHOLD,
      },
      cartography: {
        CITY_COLOR_MIN_BRIGHTNESS,
        CITY_COLOR_MAX_BRIGHTNESS,
        CITY_COLOR_SATURATION_BOOST,
        DISTRICT_COLOR_MIN_BRIGHTNESS,
        DISTRICT_COLOR_MAX_BRIGHTNESS,
        DISTRICT_COLOR_SATURATION_BOOST,
      }
    };
    
    const timer = setTimeout(() => {
        worker.postMessage({
          mapOptions,
          width: CANONICAL_MAP_WIDTH,
          height: CANONICAL_MAP_HEIGHT,
          cachedPoints: cachedPoints,
          generationConfig,
        });
    }, 50);

    return () => {
        clearTimeout(timer);
    };
  }, [generateTrigger, mapOptions, setIsLoading]);

  return { simulationState };
};

// --- From components/Controls.tsx ---
const Controls = ({ formOptions, setFormOptions, onGenerateMap, isLoading }) => {
  const handleFormChange = (e) => {
    const { id, value } = e.target;
    if (e.target.type === 'number') {
      const numValue = parseInt(value, 10);
      setFormOptions(prev => ({ ...prev, [id]: isNaN(numValue) ? 0 : numValue }));
    } else {
      setFormOptions(prev => ({ ...prev, [id]: value }));
    }
  };

  const ControlInput = ({ id, label, min, max }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input 
        type="number" 
        id={id} 
        value={formOptions[id]}
        onChange={handleFormChange} 
        min={min} 
        max={max} 
        className="w-full bg-gray-700 text-white border-gray-600 rounded-lg p-2 focus:ring-cyan-500 focus:border-cyan-500 transition" 
      />
    </div>
  );

  return (
    <div className="w-full lg:w-1/4 p-6 border-b lg:border-b-0 lg:border-r border-gray-700 space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">World Theme</h2>
        <div>
          <label htmlFor="theme" className="block text-sm font-medium text-gray-300 mb-1">Map Theme</label>
          <select
            id="theme"
            value={formOptions.theme}
            onChange={handleFormChange}
            className="w-full bg-gray-700 text-white border-gray-600 rounded-lg p-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
          >
            <option value="default">Default</option>
            <option value="desert">Desert</option>
            <option value="ice">Ice World</option>
          </select>
        </div>
      </div>
      <div className="border-t border-gray-700 my-6 -mx-6"></div>
      <div>
        <h2 className="text-lg font-semibold text-gray-200 mb-3">Territory Generation</h2>
        <div className="space-y-4">
          <ControlInput id="numCities" label="Number of Cities" min={1} max={100} />
          <ControlInput id="numDistrictsPerCity" label="Districts per City" min={1} max={20} />
        </div>
      </div>
      <button 
        onClick={onGenerateMap} 
        disabled={isLoading}
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none mt-8"
      >
        {isLoading ? 'Generating...' : 'Generate Map'}
      </button>
    </div>
  );
};

// --- From components/MapCanvas.tsx ---
const MapCanvas = ({
  mapOptions,
  selectedCityId,
  setSelectedCityId,
  generateTrigger,
  setIsLoading,
  isLoading,
  onInteraction
}) => {
  const canvasRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState({ scale: 1, translateX: 0, translateY: 0 });
  const isPanning = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  const { simulationState } = useMapSimulation({
    mapOptions,
    generateTrigger,
    setIsLoading,
  });

  useEffect(() => {
    if (generateTrigger > 0) {
      setSelectedCityId(null);
      setTransform({ scale: 1, translateX: 0, translateY: 0 });
    }
  }, [generateTrigger, setSelectedCityId]);

  const handleResetView = () => {
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  };

  const draw = useCallback(() => {
    const { delaunay, voronoi, theme, biomePaths, statePaths, cityPaths, districtPaths, cityColors, districtColors, hoveredCityId, hoveredDistrictId } = simulationState;
    const canvas = canvasRef.current;
    if (!canvas || !voronoi || !delaunay || !theme) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isCityView = selectedCityId !== null;

    ctx.save();
    
    ctx.translate(transform.translateX, transform.translateY);
    ctx.scale(transform.scale, transform.scale);
    
    const maxBorderWidth = STATE_BORDER_WIDTH;
    const inset = maxBorderWidth / 2;
    const effectiveWidth = canvas.width > inset * 2 ? canvas.width - inset * 2 : 0;
    const effectiveHeight = canvas.height > inset * 2 ? canvas.height - inset * 2 : 0;

    ctx.translate(inset, inset);
    if (effectiveWidth > 0 && effectiveHeight > 0) {
      ctx.scale(effectiveWidth / CANONICAL_MAP_WIDTH, effectiveHeight / CANONICAL_MAP_HEIGHT);
    }
    
    if (biomePaths && theme) {
      for (const [biome, path] of biomePaths.entries()) {
        ctx.fillStyle = theme.biomeColors[biome] || '#1e3a8a';
        ctx.fill(path);
      }
    }
    
    if (isCityView) {
      ctx.fillStyle = CITY_VIEW_OVERLAY_COLOR;
      ctx.fillRect(0, 0, CANONICAL_MAP_WIDTH, CANONICAL_MAP_HEIGHT);

      for (const [districtId, path] of districtPaths.entries()) {
        const firstCellIdx = simulationState.districtGroups.findIndex(id => id === districtId);
        if (firstCellIdx !== -1 && simulationState.cityGroups[firstCellIdx] === selectedCityId) {
          const isHovered = hoveredDistrictId === districtId;
          ctx.globalAlpha = isHovered ? HOVER_OPACITY_DISTRICT : DEFAULT_OPACITY_DISTRICT;
          ctx.fillStyle = districtColors[districtId] || '#333';
          ctx.fill(path);
        }
      }
    } else {
      for (const [cityId, path] of cityPaths.entries()) {
        const isHovered = hoveredCityId === cityId;
        ctx.globalAlpha = isHovered ? HOVER_OPACITY_CITY : DEFAULT_OPACITY_CITY;
        ctx.fillStyle = cityColors[cityId] || '#333';
        ctx.fill(path);
      }
    }
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = STATE_BORDER_COLOR;
    ctx.lineWidth = STATE_BORDER_WIDTH / transform.scale;
    ctx.beginPath();
    for (const path of statePaths.values()) {
        ctx.stroke(path);
    }
    
    if (!isCityView) {
      ctx.strokeStyle = CITY_BORDER_COLOR;
      ctx.lineWidth = CITY_BORDER_WIDTH / transform.scale;
      ctx.beginPath();
      for (const path of cityPaths.values()) {
        ctx.stroke(path);
      }
    } else {
        ctx.strokeStyle = DISTRICT_BORDER_COLOR;
        ctx.lineWidth = DISTRICT_BORDER_WIDTH / transform.scale;
        ctx.beginPath();
        for (const [districtId, path] of districtPaths.entries()) {
            const firstCellIdx = simulationState.districtGroups.findIndex(id => id === districtId);
            if (firstCellIdx !== -1 && simulationState.cityGroups[firstCellIdx] === selectedCityId) {
                ctx.stroke(path);
            }
        }
    }
    
    ctx.restore();

  }, [simulationState, selectedCityId, transform]);
  
  useEffect(() => {
    draw();
  }, [selectedCityId, draw, isLoading, transform]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || !entries.length) return;
      const { width, height } = entries[0].contentRect;
      const size = Math.min(width, height);
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
        setCanvasSize({ width: size, height: size });
        draw();
      }
    });
    resizeObserver.observe(container);

    const rect = container.getBoundingClientRect();
    const initialSize = Math.min(rect.width, rect.height);
    if (initialSize > 0 && canvas.width !== initialSize) {
        canvas.width = initialSize;
        canvas.height = initialSize;
        setCanvasSize({ width: initialSize, height: initialSize });
    }
    
    const getMousePos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const getTransformedMousePos = (e) => {
        const { x, y } = getMousePos(e);

        const maxBorderWidth = STATE_BORDER_WIDTH;
        const inset = maxBorderWidth / 2;
        const effectiveWidth = canvas.width - inset * 2;
        const effectiveHeight = canvas.height - inset * 2;

        const p_screen_x = (x - transform.translateX) / transform.scale;
        const p_screen_y = (y - transform.translateY) / transform.scale;
        
        const p_fit_x = p_screen_x - inset;
        const p_fit_y = p_screen_y - inset;

        const mx = p_fit_x * (CANONICAL_MAP_WIDTH / effectiveWidth);
        const my = p_fit_y * (CANONICAL_MAP_HEIGHT / effectiveHeight);

        return { mx, my };
    };

    const handleWheel = (e) => {
      e.preventDefault();
      const { x, y } = getMousePos(e);
      
      const scaleAmount = 1 - e.deltaY * ZOOM_SENSITIVITY;
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, transform.scale * scaleAmount));
      
      const mouseX = x - transform.translateX;
      const mouseY = y - transform.translateY;
      
      const newTranslateX = transform.translateX - (mouseX * (newScale / transform.scale - 1));
      const newTranslateY = transform.translateY - (mouseY * (newScale / transform.scale - 1));

      setTransform({ scale: newScale, translateX: newTranslateX, translateY: newTranslateY });
    };

    const handleMouseDown = (e) => {
      isPanning.current = true;
      lastMousePosition.current = getMousePos(e);
      canvas.style.cursor = 'grabbing';
    };

    const handleMouseUp = () => {
      isPanning.current = false;
      canvas.style.cursor = 'pointer';
    };

    const handleMouseMove = (e) => {
      if (isPanning.current) {
        const { x, y } = getMousePos(e);
        const dx = x - lastMousePosition.current.x;
        const dy = y - lastMousePosition.current.y;
        setTransform(prev => ({ ...prev, translateX: prev.translateX + dx, translateY: prev.translateY + dy }));
        lastMousePosition.current = { x, y };
      } else {
        const { delaunay, stateGroups, cityGroups, districtGroups } = simulationState;
        if (!delaunay) return;
        const { mx, my } = getTransformedMousePos(e);
        if (mx < 0 || mx > CANONICAL_MAP_WIDTH || my < 0 || my > CANONICAL_MAP_HEIGHT) return;
        const cellIndex = delaunay.find(mx, my);
        simulationState.hoveredStateId = stateGroups[cellIndex] ?? -1;
        simulationState.hoveredCityId = cityGroups[cellIndex] ?? -1;
        simulationState.hoveredDistrictId = districtGroups[cellIndex] ?? -1;
        draw();
      }
    };
    
    const handleClick = (e) => {
      const { delaunay, cityGroups, districtGroups } = simulationState;
      if (!delaunay) return;
      const { mx, my } = getTransformedMousePos(e);
      if (mx < 0 || mx > CANONICAL_MAP_WIDTH || my < 0 || my > CANONICAL_MAP_HEIGHT) return;
      const cellIndex = delaunay.find(mx, my);
      const cityId = cityGroups[cellIndex] ?? -1;
      
      if (selectedCityId === null) {
        if (cityId !== -1) {
          setSelectedCityId(cityId);
          const districtsInCity = districtGroups.filter((dg, i) => cityGroups[i] === cityId);
          const numDistricts = new Set(districtsInCity.filter(d => d !== -1)).size;
          onInteraction(`Selected City ${cityId}. This city contains ${numDistricts} districts. Click again to return to the world map.`);
        }
      } else {
        setSelectedCityId(null);
        onInteraction('Returned to world map view.');
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    
    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [draw, selectedCityId, setSelectedCityId, simulationState, onInteraction, transform]);

  return (
    <div className="w-full lg:w-3/4 p-4 flex items-center justify-center bg-gray-900 relative">
      <canvas ref={canvasRef} className="rounded-lg bg-gray-800 w-full h-full aspect-square max-w-full max-h-full cursor-pointer touch-none"></canvas>
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={handleResetView}
          className="px-3 py-1.5 bg-gray-700/80 hover:bg-gray-600/90 text-white text-sm rounded-md shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
          aria-label="Reset map view"
        >
          Reset View
        </button>
      </div>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-gray-400 bg-gray-900/80 backdrop-blur-sm rounded-lg">
          <Loader className="w-10 h-10" />
          <span>Generating Map...</span>
        </div>
      )}
    </div>
  );
};

// --- From App.tsx ---
function App() {
  const [mapOptions, setMapOptions] = useState({ theme: 'default', numCities: 20, numDistrictsPerCity: 15 });
  const [formOptions, setFormOptions] = useState({ theme: 'default', numCities: 20, numDistrictsPerCity: 15 });
  const [selectedCityId, setSelectedCityId] = useState(null);
  const [generateTrigger, setGenerateTrigger] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [a11yMessage, setA11yMessage] = useState('');

  const handleGenerateMap = () => {
    setMapOptions(formOptions);
    setGenerateTrigger(c => c + 1);
  };

  return (
    <div className="bg-gray-900 text-white flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-7xl bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <header className="p-6 bg-gray-900/50 border-b border-gray-700">
          <h1 className="text-2xl font-bold text-cyan-400">Polygonal Map Generator</h1>
          <p className="text-gray-400 mt-1">A procedural world map generator using Voronoi diagrams.</p>
        </header>
        <main className="flex flex-col lg:flex-row" style={{ minHeight: '80vh' }}>
          <Controls
            formOptions={formOptions}
            setFormOptions={setFormOptions}
            onGenerateMap={handleGenerateMap}
            isLoading={isLoading}
          />
          <MapCanvas
            mapOptions={mapOptions}
            selectedCityId={selectedCityId}
            setSelectedCityId={setSelectedCityId}
            generateTrigger={generateTrigger}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            onInteraction={setA11yMessage}
          />
        </main>
      </div>
      <div className="sr-only" aria-live="polite">{a11yMessage}</div>
    </div>
  );
}

// --- From index.tsx ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
  </script>
</body>
</html>
