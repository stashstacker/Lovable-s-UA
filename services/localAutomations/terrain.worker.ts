declare var d3: any;

export const terrainWorker = () => {
    self.importScripts(
        "https://cdn.jsdelivr.net/npm/d3-delaunay@6"
    );

    // Simple pseudo-random number generator for deterministic noise
    let elevationSeed = 1;
    function randomElevation() {
        const x = Math.sin(elevationSeed++) * 10000;
        return x - Math.floor(x);
    }

    function makeElevationNoise2D() {
        const perm: number[] = [];
        while (perm.length < 256) { perm.push(Math.floor(randomElevation() * 256)); }
        function noise(x: number, y: number) {
            const ix = Math.floor(x) & 255;
            const iy = Math.floor(y) & 255;
            return perm[(ix + perm[iy]) & 255] / 255;
        }
        return noise;
    }
    
    let densitySeed = 5000;
    function randomDensity() {
        const x = Math.sin(densitySeed++) * 10000;
        return x - Math.floor(x);
    }

    function makeDensityNoise2D() {
        const perm: number[] = [];
        while (perm.length < 256) { perm.push(Math.floor(randomDensity() * 256)); }
        function noise(x: number, y: number) {
            const ix = Math.floor(x) & 255;
            const iy = Math.floor(y) & 255;
            return perm[(ix + perm[iy]) & 255] / 255;
        }
        return noise;
    }


    self.onmessage = (event) => {
        try {
            const { numPoints, width, height, margin } = event.data;
            elevationSeed = numPoints;
            const elevationNoise = makeElevationNoise2D();
            densitySeed = numPoints * 2;
            const densityNoise = makeDensityNoise2D();

            const points = Array.from({ length: numPoints }, () => [
                margin + randomElevation() * (width - margin * 2),
                margin + randomElevation() * (height - margin * 2)
            ]);

            const delaunay = d3.Delaunay.from(points);
            const voronoi = delaunay.voronoi([0, 0, width, height]);
            
            const cells = [];
            const centerX = width / 2;
            const centerY = height / 2;
            const maxDist = Math.hypot(centerX - margin, centerY - margin);

            for (let i = 0; i < numPoints; i++) {
                const path = voronoi.renderCell(i);
                if (!path) continue;
                
                const point = points[i];
                const dx = point[0] - centerX;
                const dy = point[1] - centerY;

                const distFromCenter = Math.hypot(dx, dy);
                const islandFalloff = (distFromCenter / maxDist) ** 1.5;
                const elevationNoiseValue = elevationNoise(point[0] / 100, point[1] / 100) * 0.4;
                const elevation = 0.5 + elevationNoiseValue - islandFalloff;

                let terrainType;
                let biome;

                if (elevation < 0.25) {
                    terrainType = 'WATER';
                    biome = 'OCEAN';
                } else {
                    terrainType = 'LAND';
                    const density = densityNoise(point[0] / 50, point[1] / 50);

                    if (elevation > 0.6) {
                        biome = 'GOVERNMENT';
                    } else if (elevation < 0.30) {
                        biome = 'DOCKS';
                    } else if (density > 0.75) {
                        biome = 'FINANCIAL';
                    } else if (density > 0.6) {
                        biome = 'ENTERTAINMENT';
                    } else if (density < 0.3) {
                        biome = 'SLUMS';
                    } else if (density < 0.5) {
                        biome = 'INDUSTRIAL';
                    } else {
                        biome = 'RESIDENTIAL';
                    }
                }

                cells.push({
                    id: i,
                    path: path,
                    terrainType: terrainType,
                    biome: biome,
                });
            }

            self.postMessage({ cells });

        } catch (e: any) {
            self.postMessage({ error: e.message });
        }
    };
};