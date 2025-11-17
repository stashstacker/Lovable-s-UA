import React from 'react';
import { WorldEvent } from '../types';
import { AlertTriangleIcon, TrendingUpIcon, TrendingDownIcon } from './icons';

interface WorldEventsDisplayProps {
  worldEvents: WorldEvent[];
}

const getEventAppearance = (eventId: WorldEvent['id']) => {
  switch (eventId) {
    case 'police_crackdown':
      return {
        icon: <AlertTriangleIcon className="w-5 h-5" />,
        colorClasses: 'bg-red-900/50 border-red-700/60 text-red-200',
      };
    case 'economic_boom':
      return {
        icon: <TrendingUpIcon className="w-5 h-5" />,
        colorClasses: 'bg-green-900/50 border-green-700/60 text-green-200',
      };
    case 'recession':
      return {
        icon: <TrendingDownIcon className="w-5 h-5" />,
        colorClasses: 'bg-blue-900/50 border-blue-700/60 text-blue-200',
      };
    default:
      return {
        icon: null,
        colorClasses: 'bg-gray-900/50 border-gray-700/60 text-gray-200',
      };
  }
};

export const WorldEventsDisplay: React.FC<WorldEventsDisplayProps> = ({ worldEvents }) => {
  const activeEvents = worldEvents.filter(event => event.isActive);

  if (activeEvents.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      {activeEvents.map(event => {
        const { icon, colorClasses } = getEventAppearance(event.id);
        const durationDays = Math.floor(event.duration / 24);
        const durationHours = event.duration % 24;

        return (
          <div 
            key={event.id}
            className={`flex items-start space-x-4 p-3 rounded-lg border backdrop-blur-sm ${colorClasses}`}
            role="alert"
          >
            <div className="flex-shrink-0 mt-0.5">{icon}</div>
            <div className="flex-grow">
              <p className="font-bold">{event.name}</p>
              <p className="text-sm opacity-90">{event.description}</p>
            </div>
            <div className="flex-shrink-0 text-sm font-mono whitespace-nowrap">
                Time Remaining: {durationDays}d {durationHours}h
            </div>
          </div>
        );
      })}
    </div>
  );
};
