
import { scaffoldWorker } from './scaffold.worker';

export interface ScaffoldDataResult {
    cells: string[];
}

// Create a worker from a Blob to avoid build configuration issues.
const workerCode = `(${scaffoldWorker.toString()})()`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);
const worker = new Worker(workerUrl);

export const generateScaffold = (numPoints: number): Promise<ScaffoldDataResult> => {
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
            margin: 10 // A small margin
        });
    });
};
