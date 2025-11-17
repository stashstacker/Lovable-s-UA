
declare var d3: any;

export const scaffoldWorker = () => {
    // Since this is a worker, we must manually import scripts.
    self.importScripts(
        "https://cdn.jsdelivr.net/npm/d3-delaunay@6"
    );

    self.onmessage = (event) => {
        try {
            const { numPoints, width, height, margin } = event.data;

            // 1. Generate random seed points
            const points = Array.from({ length: numPoints }, () => [
                margin + Math.random() * (width - margin * 2),
                margin + Math.random() * (height - margin * 2)
            ]);

            // 2. Compute Voronoi diagram
            const delaunay = d3.Delaunay.from(points);
            const voronoi = delaunay.voronoi([0, 0, width, height]);

            // 3. Extract cell polygons as SVG paths
            const cellPaths: string[] = [];
            for (let i = 0; i < numPoints; i++) {
                const path = voronoi.renderCell(i);
                if (path) {
                    cellPaths.push(path);
                }
            }

            self.postMessage({ cells: cellPaths });

        } catch (e: any) {
            self.postMessage({ error: e.message });
        }
    };
};
