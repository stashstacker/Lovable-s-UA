import { musclesWorker } from './muscles.worker';

// Define a placeholder for TerrainData if it's not defined elsewhere
// This would typically be in a types file.
export interface TerrainData {
    cells: {
        id: number;
        path: string;
        terrainType: 'WATER' | 'LAND';
        biome: string;
    }[];
}


export interface PointOfInterest {
    id: string;
    districtId: number;
    type: 'Landmark' | 'Resource Node';
}
export interface District {
    id: number;
    svgPath: string;
    centroid: [number, number];
}
export interface Ward {
    id: string;
    svgPath: string;
    centroid: [number, number];
    districts: District[];
}
export interface MusclesData {
    terrain: TerrainData;
    wards: Ward[];
    supplyLines: [string, string][];
    pois: PointOfInterest[];
}
export interface KMeansCentroid {
    id: number;
    x: number;
    y: number;
}
export interface KMeansIterationData {
    muscles: { terrain: TerrainData };
    centroids: KMeansCentroid[];
    cellToDistrictMap: Map<number, number>;
}
export type ProgressUpdate = 
    | { type: 'status', message: string }
    | { type: 'iteration', scope: 'wards' | 'districts', muscles: { terrain: TerrainData }, centroids: KMeansCentroid[], cellToDistrictMap: Map<number, number> }
    | { type: 'complete', data: MusclesData };

const workerCode = `(${musclesWorker.toString()})()`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);

export const generateMuscles = (
    settings: { numWards: number, numDistricts: number },
    skeleton: any,
    onProgress: (update: ProgressUpdate) => void
): Promise<{ duration: number }> => {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerUrl);
        const startTime = performance.now();

        const handleWorkerMessage = (event: MessageEvent) => {
            if (event.data.error) {
                reject(new Error(event.data.error));
                worker.terminate();
            } else if (event.data.type === 'complete') {
                onProgress(event.data);
                const endTime = performance.now();
                resolve({ duration: Math.round(endTime - startTime) });
                worker.terminate();
            } else {
                onProgress(event.data);
            }
        };

        worker.addEventListener('message', handleWorkerMessage);
        worker.postMessage({ 
            settings, 
            points: skeleton.points,
            borderCellIndices: skeleton.borderCellIndices,
        });
    });
};
