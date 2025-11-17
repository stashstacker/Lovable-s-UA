import React from 'react';
import { UsageMetadata } from '../types';
import { CpuIcon } from './icons';

interface TokenCountDisplayProps {
  usage?: UsageMetadata | null;
}

export const TokenCountDisplay: React.FC<TokenCountDisplayProps> = ({ usage }) => {
  if (!usage) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900/80 backdrop-blur-md text-white text-xs font-mono p-3 rounded-lg border border-yellow-800/50 shadow-lg z-50">
      <div className="flex items-center space-x-2 mb-2">
        <CpuIcon className="w-4 h-4 text-cyan-400" />
        <span className="font-bold text-yellow-300">Last API Call</span>
      </div>
      <div className="space-y-1">
        <p>Prompt: <span className="text-gray-300">{(usage.promptTokenCount ?? 0).toLocaleString()} tokens</span></p>
        <p>Output: <span className="text-gray-300">{(usage.candidatesTokenCount ?? 0).toLocaleString()} tokens</span></p>
        <p className="border-t border-gray-700 mt-1 pt-1">Total: <span className="font-bold text-yellow-200">{(usage.totalTokenCount ?? 0).toLocaleString()} tokens</span></p>
      </div>
    </div>
  );
};