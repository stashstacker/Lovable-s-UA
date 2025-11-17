

import React, { useState, useEffect } from 'react';
import { Notification } from '../types';
import { ShieldIcon, UsersIcon, XIcon, InfoIcon } from './icons';
import { Button } from './Button';

interface NotificationItemProps {
  notification: Notification;
  onClear: (id: number) => void;
  onClick: (notification: Notification) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClear, onClick }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timerIn = setTimeout(() => setVisible(true), 10);

        const timerClear = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onClear(notification.id), 500); // Allow fade-out animation
        }, 5000);

        return () => {
            clearTimeout(timerIn);
            clearTimeout(timerClear);
        };
    }, [notification.id, onClear]);
    
    const appearance = {
        success: { icon: <ShieldIcon className="w-5 h-5 text-green-400" />, color: '#4ade80' },
        warning: { icon: <UsersIcon className="w-5 h-5 text-red-400" />, color: '#f87171' },
        info: { icon: <InfoIcon className="w-5 h-5 text-blue-400" />, color: '#60a5fa' },
    }[notification.type || 'info'];

    const hasAction = !!notification.relatedView;

    return (
        <div 
            onClick={() => hasAction && onClick(notification)}
            className={`w-full max-w-sm bg-gray-900/80 backdrop-blur-md border-l-4 rounded-r-lg shadow-2xl p-4 flex items-start space-x-3 transition-all duration-500 ease-in-out ${
                visible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
            } ${hasAction ? 'cursor-pointer hover:bg-gray-800' : ''}`}
            style={{ borderColor: appearance.color }}
        >
            <div className="flex-shrink-0 mt-0.5">{appearance.icon}</div>
            <p className="text-sm text-gray-200 flex-grow">{notification.message}</p>
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    setVisible(false);
                    setTimeout(() => onClear(notification.id), 500);
                }} 
                className="flex-shrink-0 text-gray-500 hover:text-white"
            >
                <XIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

interface NotificationLogProps {
  notifications: Notification[];
  onClear: (id: number) => void;
  onClearAll: () => void;
  onClick: (notification: Notification) => void;
}

export const NotificationLog: React.FC<NotificationLogProps> = ({ notifications, onClear, onClearAll, onClick }) => {
  const visibleNotifications = notifications.slice(0, 4); // Show max 4 at a time

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-24 left-4 z-50 w-full max-w-sm">
      {notifications.length > 1 && (
         <div className="flex justify-end mb-2">
            <Button size="sm" variant="secondary" onClick={onClearAll}>
                Clear All ({notifications.length})
            </Button>
         </div>
      )}
      <div className="space-y-3">
        {visibleNotifications.map(notification => (
          <NotificationItem 
              key={notification.id} 
              notification={notification} 
              onClear={onClear}
              onClick={onClick}
          />
        ))}
      </div>
    </div>
  );
};
