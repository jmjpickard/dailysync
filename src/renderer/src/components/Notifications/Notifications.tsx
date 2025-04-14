import React from 'react';
import Notification from './Notification';
import useStore from '../../store';
import { shallow } from 'zustand/shallow';

const Notifications: React.FC = () => {
  const notifications = useStore(state => state.ui.notifications);
  const removeNotification = useStore(state => state.removeNotification);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          id={notification.id}
          type={notification.type}
          message={notification.message}
          duration={notification.duration}
          onDismiss={removeNotification}
        />
      ))}
    </div>
  );
};

export default Notifications;