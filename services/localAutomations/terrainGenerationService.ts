import { terrainWorker } from './terrain.worker';

export type TerrainType = 'WATER' | 'LAND';
export type Biome = 'OCEAN' | 'DOCKS' | 'INDUSTRIAL' | 'SLUMS' | 'RESIDENTIAL' | 'ENTERTAINMENT' | 'FINANCIAL' | 'GOVERNMENT';


export interface CellData {
    id: number;
    path: string;
    terrainType: TerrainType;
    biome: Biome;
}

export interface TerrainData {
    cells: CellData[];
}

// Create a worker from a Blob to avoid build configuration issues.
const workerCode = `(${terrainWorker.toString()})()`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);
const worker = new Worker(workerUrl);

export const generateTerrain = (numPoints: number): Promise<TerrainData> => {
    return new Promise((resolve, reject) => {
        const handleWorkerMessage = (event: MessageEvent) => {
            if (event.data.error) {
                reject(new Error(event.data.error));
            } else {
                resolve(event.data);
            }
            // Clean up the event listener after the promise is settled
            worker.removeEventListener('message', handleWorkerMessage);
        };

        worker.addEventListener('message', handleWorkerMessage);
        
        worker.postMessage({
            numPoints,
            width: 1000,
            height: 750,
            margin: 10
        });
    });
};