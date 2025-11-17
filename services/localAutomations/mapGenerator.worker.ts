// This function contains the entire worker logic. It will be converted to a string and run in a Blob.

// The d3 library is loaded via importScripts, making it available on the global scope within the worker.
declare var d3: any;

export const mapGeneratorWorker = () => {
    // Since this is a worker, we must manually import scripts.
    // The main app loads these via script tags, but workers have a separate scope.
    self.importScripts(
        "https://cdn.jsdelivr.net/npm/d3-delaunay@6",
        "https://d3js.org/d3-polygon.v3.min.js"
    );

    self.onmessage = (event) => {
        try {
            const { wards, width, height, margin } = event.data;
            const allDistricts = wards.flatMap(w => w.districts);
            const numDistricts = allDistricts.length;
            const NUM_CELLS = 12000;
            const K_MEANS_ITERATIONS = 5;

            // 1. Generate the 12,000 cell points (the "scaffolding")
            const cellPoints = Array.from({ length: NUM_CELLS }, (_, i) => ({
                id: i,
                x: margin + Math.random() * (width - margin * 2),
                y: margin + Math.random() * (height - margin * 2),
            }));

            // 2. K-Means Clustering to assign cells to districts
            //    a. Initialize centroids randomly
            let districtCentroids = allDistricts.map(d => ({
                districtId: d.id,
                x: margin + Math.random() * (width - margin * 2),
                y: margin + Math.random() * (height - margin * 2),
            }));

            let cellToDistrictMap = new Map<number, number>();

            //    b. Iterate to refine clusters
            for (let i = 0; i < K_MEANS_ITERATIONS; i++) {
                // Assign each cell to the nearest centroid
                cellPoints.forEach(p => {
                    let minDist = Infinity;
                    let closestDistrictId = -1;
                    districtCentroids.forEach(c => {
                        const dist = Math.hypot(p.x - c.x, p.y - c.y);
                        if (dist < minDist) {
                            minDist = dist;
                            closestDistrictId = c.districtId;
                        }
                    });
                    cellToDistrictMap.set(p.id, closestDistrictId);
                });

                // Recalculate centroids
                const clusters = new Map<number, { x_sum: number, y_sum: number, count: number }>();
                allDistricts.forEach(d => clusters.set(d.id, { x_sum: 0, y_sum: 0, count: 0 }));

                cellPoints.forEach(p => {
                    const districtId = cellToDistrictMap.get(p.id);
                    if (districtId !== undefined) {
                        const cluster = clusters.get(districtId);
                        cluster.x_sum += p.x;
                        cluster.y_sum += p.y;
                        cluster.count++;
                    }
                });

                districtCentroids = districtCentroids.map(c => {
                    const cluster = clusters.get(c.districtId);
                    if (cluster && cluster.count > 0) {
                        return { ...c, x: cluster.x_sum / cluster.count, y: cluster.y_sum / cluster.count };
                    }
                    return c; // Keep old centroid if cluster is empty
                });
            }

            // 3. Compute Voronoi diagram from the 12,000 cell points
            const delaunay = d3.Delaunay.from(cellPoints.map(p => [p.x, p.y]));
            const voronoi = delaunay.voronoi([0, 0, width, height]);

            // 4. Stitch polygons to get district and ward outlines
            const getOutline = (cellIds) => {
                if (!cellIds || cellIds.size === 0) return null;
        
                const edgeCounts = new Map();
                
                // 1. Count all edges of all cells in the territory
                cellIds.forEach(cellIndex => {
                    const polygon = voronoi.cellPolygon(cellIndex);
                    if (!polygon) return;
                    for (let i = 0; i < polygon.length; i++) {
                        const p1 = polygon[i];
                        const p2 = polygon[(i + 1) % polygon.length];
                        const key = [p1, p2].map(p => p[0].toFixed(5) + ',' + p[1].toFixed(5)).sort().join(':');
                        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
                    }
                });
        
                // 2. Find the boundary edges (those that only appear once)
                const boundaryEdges = [];
                for (const [key, count] of edgeCounts.entries()) {
                    if (count === 1) {
                        const [p1Str, p2Str] = key.split(':');
                        boundaryEdges.push([p1Str.split(',').map(Number), p2Str.split(',').map(Number)]);
                    }
                }
        
                if (boundaryEdges.length === 0) return null;
        
                // 3. Stitch the boundary edges into one or more closed polygons
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
                
                // 4. Convert the stitched polygons into an SVG path string
                const pathData = stitchedPolygons.map(polygon => {
                    if (polygon.length === 0) return '';
                    const start = `M${polygon[0][0]},${polygon[0][1]}`;
                    const lines = polygon.slice(1).map(p => `L${p[0]},${p[1]}`).join('');
                    return `${start}${lines}Z`;
                }).join(' ');
                
                return pathData;
            };

            const districtCellSets = new Map<number, Set<number>>();
            allDistricts.forEach(d => districtCellSets.set(d.id, new Set()));
            cellToDistrictMap.forEach((districtId, cellId) => {
                districtCellSets.get(districtId)?.add(cellId);
            });
            
            allDistricts.forEach(d => {
                d.svgPath = getOutline(districtCellSets.get(d.id));
                d.centroid = [districtCentroids.find(c => c.districtId === d.id).x, districtCentroids.find(c => c.districtId === d.id).y];
            });
            
            wards.forEach(w => {
                const wardCellIds = new Set<number>();
                w.districts.forEach(d => {
                    districtCellSets.get(d.id)?.forEach(cellId => wardCellIds.add(cellId));
                });
                w.svgPath = getOutline(wardCellIds);
            });

            // 5. Calculate connections
            const connections = new Set<string>();
            for (let i = 0; i < NUM_CELLS; i++) {
                const dist1Id = cellToDistrictMap.get(i);
                for (const neighborIdx of voronoi.neighbors(i)) {
                    const dist2Id = cellToDistrictMap.get(neighborIdx);
                    if (dist1Id !== undefined && dist2Id !== undefined && dist1Id !== dist2Id) {
                        const key = [dist1Id, dist2Id].sort((a,b) => a-b).join('-');
                        connections.add(key);
                    }
                }
            }
            const connectionArray = Array.from(connections).map(key => key.split('-').map(Number) as [number, number]);

            // 6. Send final data back to main thread
            self.postMessage({
                enrichedWards: wards,
                connections: connectionArray
            });

        } catch (e) {
            self.postMessage({ error: e.message });
        }
    };
};