
import React from 'react';
import { GameEvent } from '../types';
import { XIcon, ShieldIcon, UsersIcon, InfoIcon } from './icons';

interface EventLogModalProps {
  events: GameEvent[];
  onClose: () => void;
}

const getIconForType = (type: GameEvent['type']) => {
    const props = { className: "w-5 h-5 flex-shrink-0" };
    switch(type) {
        case 'success': return <ShieldIcon {...props} color="#4ade80" />;
        case 'warning': return <UsersIcon {...props} color="#f87171" />;
        case 'info':
        default:
            return <InfoIcon {...props} color="#60a5fa" />;
    }
}

export const EventLogModal: React.FC<EventLogModalProps> = ({ events, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-gray-900 border-2 border-yellow-800/50 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-yellow-900/60 flex-shrink-0">
          <h2 className="font-title text-xl text-yellow-300">Event Chronicle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
          </button>
        </header>
        <div className="p-6 overflow-y-auto">
          <div className="space-y-4">
            {events.length === 0 && <p className="text-gray-500 text-center italic py-8">The city is quiet.</p>}
            {[...events].reverse().map(event => (
              <div key={event.id} className="flex items-start space-x-4 text-sm">
                <div className="font-mono text-xs text-gray-500 text-right">
                  <span>{event.timestamp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  <br/>
                  <span className="opacity-80">{event.timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <div className="flex-shrink-0 pt-0.5">{getIconForType(event.type)}</div>
                <div className="flex-grow">
                  <p className="text-gray-300">{event.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
       <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
