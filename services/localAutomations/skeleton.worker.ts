declare var d3: any;

export const skeletonWorker = () => {
    self.importScripts(
        "https://cdn.jsdelivr.net/npm/d3-delaunay@6"
    );

    // Perlin Noise implementation for density mapping
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
            const { numPoints, width, height, margin } = event.data;
            const DENSITY_NOISE_SCALE = 3.0;
            
            // 1. Generate non-uniform points using Perlin noise for density
            const densityNoise = new PerlinNoise(Math.random());
            const points = [];
            
            while(points.length < numPoints) {
                const x = margin + Math.random() * (width - margin * 2);
                const y = margin + Math.random() * (height - margin * 2);
                
                const nx = x / width;
                const ny = y / height;
                const density = (densityNoise.noise(nx * DENSITY_NOISE_SCALE, ny * DENSITY_NOISE_SCALE, 0) + 1) / 2;
                
                if (Math.random() < density) {
                    points.push([x, y]);
                }
            }

            // 2. Compute Delaunay and Voronoi
            const delaunay = d3.Delaunay.from(points);
            const voronoi = delaunay.voronoi([0, 0, width, height]);

            // 3. Extract all geometric layers and identify border cells
            const delaunayPath = delaunay.render();
            const voronoiCellPaths = [];
            const borderCellIndices = [];

            for (let i = 0; i < numPoints; i++) {
                const path = voronoi.renderCell(i);
                if (path) {
                    voronoiCellPaths.push(path);
                }
                const polygon = voronoi.cellPolygon(i);
                if (polygon) {
                    for (const vertex of polygon) {
                        if (vertex[0] <= margin || vertex[0] >= width - margin || vertex[1] <= margin || vertex[1] >= height - margin) {
                            borderCellIndices.push(i);
                            break;
                        }
                    }
                }
            }

            self.postMessage({ 
                points,
                delaunayPath,
                voronoiCellPaths,
                borderCellIndices
            });

        } catch (e) {
            self.postMessage({ error: e.message });
        }
    };
};
