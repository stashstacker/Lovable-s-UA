import { mapGeneratorWorker } from './mapGenerator.worker';
import { Ward } from '../../types';

export interface MapGenerationResult {
    enrichedWards: Ward[];
    connections: [number, number][];
}

// Create a worker from a Blob to avoid build configuration issues.
const workerCode = `(${mapGeneratorWorker.toString()})()`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);

export const generateProceduralMap = (wards: Ward[]): Promise<MapGenerationResult> => {
    return new Promise((resolve, reject) => {
        // A new worker is created for each call to avoid state issues.
        const worker = new Worker(workerUrl);

        const cleanup = () => {
            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
            worker.terminate();
        }

        const handleMessage = (event: MessageEvent) => {
            if (event.data.error) {
                reject(new Error(event.data.error));
            } else {
                resolve(event.data);
            }
            cleanup();
        };

        const handleError = (error: ErrorEvent) => {
            reject(new Error(error.message));
            cleanup();
        };

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);
        
        worker.postMessage({
            wards,
            width: 1000,
            height: 750,
            margin: 10
        });
    });
};
