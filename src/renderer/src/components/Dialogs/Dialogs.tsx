import React from 'react';
import Dialog, { ButtonConfig } from './Dialog';
import useStore from '../../store';
import { shallow } from 'zustand/shallow';

const Dialogs: React.FC = () => {
  const activeDialog = useStore(state => state.ui.activeDialog);
  const hideDialog = useStore(state => state.hideDialog);
  const showNotification = useStore(state => state.addNotification);

  if (!activeDialog) {
    return null;
  }

  const renderDialogContent = () => {
    // Default buttons for closing the dialog
    let buttons: ButtonConfig[] = [
      {
        text: 'Close',
        onClick: () => hideDialog(activeDialog.id),
        type: 'secondary',
      },
    ];

    // Customize dialog based on type
    switch (activeDialog.type) {
      case 'alert':
        return {
          title: activeDialog.title || 'Alert',
          content: <p className="text-gray-700">{activeDialog.message}</p>,
          buttons: [
            {
              text: 'OK',
              onClick: () => {
                if (activeDialog.onConfirm) activeDialog.onConfirm();
                hideDialog(activeDialog.id);
              },
              type: 'primary',
            },
          ],
        };

      case 'confirm':
        return {
          title: activeDialog.title || 'Confirm',
          content: <p className="text-gray-700">{activeDialog.message}</p>,
          buttons: [
            {
              text: 'Cancel',
              onClick: () => {
                if (activeDialog.onCancel) activeDialog.onCancel();
                hideDialog(activeDialog.id);
              },
              type: 'secondary',
            },
            {
              text: 'Confirm',
              onClick: () => {
                if (activeDialog.onConfirm) activeDialog.onConfirm();
                hideDialog(activeDialog.id);
              },
              type: 'primary',
            },
          ],
        };

      case 'permission':
        return {
          title: activeDialog.title || 'Permission Required',
          content: (
            <div>
              <p className="text-gray-700 mb-2">{activeDialog.message || 'This app requires additional permissions to function correctly.'}</p>
              <p className="text-gray-600 text-sm">Please click "Open Settings" to grant the necessary permissions.</p>
            </div>
          ),
          buttons: [
            {
              text: 'Cancel',
              onClick: () => {
                if (activeDialog.onCancel) activeDialog.onCancel();
                hideDialog(activeDialog.id);
              },
              type: 'secondary',
            },
            {
              text: 'Open Settings',
              onClick: async () => {
                try {
                  await window.electronAPI.openPrivacySettings();
                  if (activeDialog.onConfirm) activeDialog.onConfirm();
                } catch (error) {
                  console.error('Failed to open privacy settings:', error);
                  showNotification('Failed to open privacy settings', 'error');
                }
                hideDialog(activeDialog.id);
              },
              type: 'primary',
            },
          ],
        };

      case 'serviceSelection':
        const services = activeDialog.data?.services || [];
        return {
          title: activeDialog.title || 'Select Service',
          content: (
            <div>
              <p className="text-gray-700 mb-4">{activeDialog.message || 'Please select a service:'}</p>
              <div className="space-y-2">
                {services.map((service: string, index: number) => (
                  <button
                    key={index}
                    className="w-full text-left px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      if (activeDialog.data?.onSelect) {
                        activeDialog.data.onSelect(service);
                      }
                      hideDialog(activeDialog.id);
                    }}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>
          ),
          buttons: [
            {
              text: 'Cancel',
              onClick: () => {
                if (activeDialog.onCancel) activeDialog.onCancel();
                hideDialog(activeDialog.id);
              },
              type: 'secondary',
            },
          ],
        };

      default:
        return {
          title: activeDialog.title || 'Dialog',
          content: <p className="text-gray-700">{activeDialog.message}</p>,
          buttons,
        };
    }
  };

  const dialogProps = renderDialogContent();

  return (
    <Dialog
      title={dialogProps.title}
      buttons={dialogProps.buttons}
      onClose={() => hideDialog(activeDialog.id)}
    >
      {dialogProps.content}
    </Dialog>
  );
};

export default Dialogs;