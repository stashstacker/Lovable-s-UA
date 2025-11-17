// This file contains the entire worker logic. It will be converted to a string and run in a Blob.
declare var d3: any;

export const musclesWorker = () => {
    // Since this is a worker, we must manually import scripts.
    self.importScripts(
        "https://cdn.jsdelivr.net/npm/d3-delaunay@6",
        "https://d3js.org/d3-polygon.v3.min.js"
    );

    // Perlin Noise implementation for terrain generation
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

    self.onmessage = (event) => {
        try {
            const { settings, points, borderCellIndices } = event.data;
            const { numWards, numDistricts } = settings;
            const width = 1000;
            const height = 750;
            const K_MEANS_ITERATIONS = 5;
            const terrainPoints = points;
            const NUM_TERRAIN_CELLS = terrainPoints.length;
            const TERRAIN_NOISE_SCALE = 2.5;
            const ISLAND_FALLOFF_POWER = 2.0; // Lowered for more gentle coasts
            const LAND_THRESHOLD = 0.25;

            const borderCellSet = new Set(borderCellIndices);

            // ===== 1. TERRAIN GENERATION =====
            self.postMessage({ type: 'status', message: 'Carving landmass...' });
            const elevationNoise = new PerlinNoise(Math.random());
            const shapeNoise = new PerlinNoise(Math.random() + 50); // New noise for overall shape

            const terrainDelaunay = d3.Delaunay.from(terrainPoints);
            const terrainVoronoi = terrainDelaunay.voronoi([0, 0, width, height]);

            const terrainCells = [];
            const landCells = []; // This will contain only land cells for clustering

            const centerX = width / 2;
            const centerY = height / 2;
            const maxDist = Math.hypot(centerX, centerY);

            for (let i = 0; i < NUM_TERRAIN_CELLS; i++) {
                const path = terrainVoronoi.renderCell(i);
                if (!path) continue;
                
                const point = terrainPoints[i];
                let terrainType;

                if (borderCellSet.has(i)) {
                    terrainType = 'WATER';
                } else {
                    const nx = point[0] / width;
                    const ny = point[1] / height;
                    
                    // Base elevation noise for terrain details
                    let e = (elevationNoise.noise(nx * TERRAIN_NOISE_SCALE, ny * TERRAIN_NOISE_SCALE, 0) + 1) / 2;

                    // Low-frequency noise to distort the island shape, creating bays and peninsulas
                    const shapeNoiseValue = (shapeNoise.noise(nx * 0.8, ny * 0.8, 0.5) + 1) / 2;
                    
                    // Calculate distance from center and apply distortion
                    const distFromCenter = Math.hypot(point[0] - centerX, point[1] - centerY);
                    const distortedDist = distFromCenter * (1 - (shapeNoiseValue * 0.5)); // Distort distance by up to 25% inwards

                    const falloff = 1 - Math.pow(distortedDist / maxDist, ISLAND_FALLOFF_POWER);
                    e *= falloff;

                    terrainType = e > LAND_THRESHOLD ? 'LAND' : 'WATER';
                }
                
                const biome = terrainType === 'WATER' ? 'OCEAN' : 'GRASSLAND';

                const cell = {
                    id: i,
                    path: path,
                    point: point,
                    terrainType: terrainType,
                    biome: biome,
                };
                terrainCells.push(cell);
                
                if (terrainType === 'LAND') {
                    landCells.push(cell);
                }
            }

            const terrainData = { cells: terrainCells.map(({id, path, terrainType, biome}) => ({id, path, terrainType, biome})) };

            // ===== 2. DISTRICT CLUSTERING (K-MEANS) =====
            self.postMessage({ type: 'status', message: 'Forming districts...' });
            let districtCentroids = Array.from({ length: numDistricts }, (_, i) => {
                const randomLandCell = landCells[Math.floor(Math.random() * landCells.length)];
                return { id: i, x: randomLandCell.point[0], y: randomLandCell.point[1] };
            });

            let cellToDistrictMap = new Map();

            for (let i = 0; i < K_MEANS_ITERATIONS; i++) {
                landCells.forEach(p => {
                    let minDist = Infinity;
                    let closestDistrictId = -1;
                    districtCentroids.forEach(c => {
                        const dist = Math.hypot(p.point[0] - c.x, p.point[1] - c.y);
                        if (dist < minDist) {
                            minDist = dist;
                            closestDistrictId = c.id;
                        }
                    });
                    cellToDistrictMap.set(p.id, closestDistrictId);
                });

                const clusters = new Map();
                districtCentroids.forEach(c => clusters.set(c.id, { x_sum: 0, y_sum: 0, count: 0 }));
                landCells.forEach(p => {
                    const districtId = cellToDistrictMap.get(p.id);
                    if (districtId !== undefined) {
                        const cluster = clusters.get(districtId);
                        cluster.x_sum += p.point[0];
                        cluster.y_sum += p.point[1];
                        cluster.count++;
                    }
                });
                districtCentroids = districtCentroids.map(c => {
                    const cluster = clusters.get(c.id);
                    return (cluster && cluster.count > 0) ? { ...c, x: cluster.x_sum / cluster.count, y: cluster.y_sum / cluster.count } : c;
                });
                self.postMessage({ type: 'iteration', scope: 'districts', muscles: { terrain: terrainData }, centroids: districtCentroids, cellToDistrictMap: new Map(cellToDistrictMap) });
            }
            
            // ===== 3. GEOMETRY STITCHING =====
            self.postMessage({ type: 'status', message: 'Drawing borders...' });
            
            const getOutline = (cellIds) => {
                if (!cellIds || cellIds.size === 0) return null;
        
                const edgeCounts = new Map();
                
                cellIds.forEach(cellId => {
                    const polygon = terrainVoronoi.cellPolygon(cellId);
                    if (!polygon) return;
                    for (let i = 0; i < polygon.length; i++) {
                        const p1 = polygon[i];
                        const p2 = polygon[(i + 1) % polygon.length];
                        const key = [p1, p2].map(p => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).sort().join(':');
                        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
                    }
                });
        
                const boundaryEdges = [];
                for (const [key, count] of edgeCounts.entries()) {
                    if (count === 1) {
                        const [p1Str, p2Str] = key.split(':');
                        boundaryEdges.push([
                            p1Str.split(',').map(Number),
                            p2Str.split(',').map(Number)
                        ]);
                    }
                }
        
                if (boundaryEdges.length === 0) return null;
        
                const stitchedPolygons = [];
                while (boundaryEdges.length > 0) {
                    let [currentP1, currentP2] = boundaryEdges.pop();
                    const currentPolygon = [currentP1, currentP2];
        
                    while (true) {
                        let foundNext = false;
                        for (let j = boundaryEdges.length - 1; j >= 0; j--) {
                            const [nextP1, nextP2] = boundaryEdges[j];
                            const p2Str = `${currentP2[0].toFixed(5)},${currentP2[1].toFixed(5)}`;
        
                            if (p2Str === `${nextP1[0].toFixed(5)},${nextP1[1].toFixed(5)}`) {
                                currentP2 = nextP2;
                                currentPolygon.push(currentP2);
                                boundaryEdges.splice(j, 1);
                                foundNext = true;
                                break;
                            } else if (p2Str === `${nextP2[0].toFixed(5)},${nextP2[1].toFixed(5)}`) {
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
        
                const pathData = stitchedPolygons.map(polygon => {
                    if (polygon.length === 0) return '';
                    const start = `M${polygon[0][0]},${polygon[0][1]}`;
                    const lines = polygon.slice(1).map(p => `L${p[0]},${p[1]}`).join('');
                    return `${start}${lines}Z`;
                }).join(' ');
                
                return pathData;
            };

            const districtCellSets = new Map();
            districtCentroids.forEach(c => districtCellSets.set(c.id, new Set()));
            cellToDistrictMap.forEach((districtId, cellId) => {
                districtCellSets.get(districtId)?.add(cellId);
            });
            
            const districts = districtCentroids.map(c => ({
                id: c.id,
                svgPath: getOutline(districtCellSets.get(c.id)),
                centroid: [c.x, c.y]
            }));

            // ===== 4. WARD CLUSTERING =====
            self.postMessage({ type: 'status', message: 'Forming wards...' });
            let wardCentroids = Array.from({ length: numWards }, (_, i) => {
                const randomDistrict = districts[Math.floor(Math.random() * districts.length)];
                return { id: `ward-${i}`, x: randomDistrict.centroid[0], y: randomDistrict.centroid[1] };
            });

            let districtToWardMap = new Map();
            for (let i = 0; i < K_MEANS_ITERATIONS; i++) {
                districts.forEach(d => {
                    let minDist = Infinity;
                    let closestWardId = '';
                    wardCentroids.forEach(c => {
                        const dist = Math.hypot(d.centroid[0] - c.x, d.centroid[1] - c.y);
                        if (dist < minDist) {
                            minDist = dist;
                            closestWardId = c.id;
                        }
                    });
                    districtToWardMap.set(d.id, closestWardId);
                });
                const wardClusters = new Map();
                wardCentroids.forEach(c => wardClusters.set(c.id, { x_sum: 0, y_sum: 0, count: 0 }));
                districts.forEach(d => {
                    const wardId = districtToWardMap.get(d.id);
                    if (wardId) {
                        const cluster = wardClusters.get(wardId);
                        cluster.x_sum += d.centroid[0];
                        cluster.y_sum += d.centroid[1];
                        cluster.count++;
                    }
                });
                wardCentroids = wardCentroids.map(c => {
                    const cluster = wardClusters.get(c.id);
                    return (cluster && cluster.count > 0) ? { ...c, x: cluster.x_sum / cluster.count, y: cluster.y_sum / cluster.count } : c;
                });
            }

            const wards = wardCentroids.map(c => {
                const wardDistricts = districts.filter(d => districtToWardMap.get(d.id) === c.id);
                const wardCellIds = new Set();
                wardDistricts.forEach(d => {
                    districtCellSets.get(d.id)?.forEach(cellId => wardCellIds.add(cellId));
                });
                return {
                    id: c.id,
                    svgPath: getOutline(wardCellIds),
                    centroid: [c.x, c.y],
                    districts: wardDistricts
                };
            });
            
            // ===== 5. FINAL ASSEMBLY =====
            self.postMessage({ type: 'status', message: 'Finalizing...' });

            const wardDelaunay = d3.Delaunay.from(wards.map(w => w.centroid));
            
            const supplyLineEdges = [];
            const { triangles, halfedges } = wardDelaunay;
            for (let e = 0; e < triangles.length; e++) {
                if (e < halfedges[e]) { 
                    const p1_idx = triangles[e];
                    const p2_idx = triangles[(e % 3 === 2) ? e - 2 : e + 1];
                    supplyLineEdges.push([p1_idx, p2_idx]);
                }
            }
            const supplyLines = supplyLineEdges.map(([i, j]) => [wards[i].id, wards[j].id]);

            const pois = districts.filter(() => Math.random() < 0.1).map(d => ({
                id: `poi-${d.id}`,
                districtId: d.id,
                type: Math.random() < 0.5 ? 'Landmark' : 'Resource Node'
            }));

            const finalData = {
                terrain: terrainData,
                wards,
                supplyLines,
                pois
            };

            self.postMessage({ type: 'complete', data: finalData });

        } catch (e) {
            self.postMessage({ error: e.message });
        }
    };
};
