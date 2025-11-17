import { skeletonWorker } from './skeleton.worker';

export interface SkeletonData {
    points: [number, number][];
    delaunayPath: string;
    voronoiCellPaths: string[];
    borderCellIndices: number[];
}

export interface SkeletonResult {
    data: SkeletonData;
    duration: number;
}

const workerCode = `(${skeletonWorker.toString()})()`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);
const worker = new Worker(workerUrl);

export const generateSkeleton = (numPoints: number): Promise<SkeletonResult> => {
    return new Promise((resolve, reject) => {
        const startTime = performance.now();

        const handleWorkerMessage = (event: MessageEvent) => {
            const endTime = performance.now();
            if (event.data.error) {
                reject(new Error(event.data.error));
            } else {
                resolve({
                    data: event.data,
                    duration: Math.round(endTime - startTime)
                });
            }
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
