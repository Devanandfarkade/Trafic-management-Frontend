import React, { useState } from 'react';
import { RightSideDialog } from './RightSideDialog';
import { useTheme } from '../Settings/themeUtils';
import { Button } from './Button';
import { Select } from './Select';

export const ScheduleReportDialog = ({ visible, onHide, reportName }) => {
  const { themeUtils } = useTheme();
  
  const [formData, setFormData] = useState({
    frequency: 'Daily',
    time: '09:00',
    deliveryMethod: 'Email',
    recipients: '',
    format: 'PDF',
  });

  const handleSave = () => {
    // Simulated save
    onHide();
  };

  return (
    <RightSideDialog
      visible={visible}
      onHide={onHide}
      header={`Schedule Report: ${reportName}`}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto hide-scrollbar p-6 space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-lg font-bold border-b pb-2" style={{ color: themeUtils.getTextColor(true), borderColor: themeUtils.getBorderColor() }}>Schedule Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: themeUtils.getTextColor(true) }}>Frequency <span className="text-red-500">*</span></label>
                <Select
                  className="w-full"
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  options={[
                    { label: 'Daily', value: 'Daily' },
                    { label: 'Weekly', value: 'Weekly' },
                    { label: 'Monthly', value: 'Monthly' },
                    { label: 'Quarterly', value: 'Quarterly' }
                  ]}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: themeUtils.getTextColor(true) }}>Time of Day</label>
                <input 
                  type="time" 
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ backgroundColor: themeUtils.getBgColor('input'), borderColor: themeUtils.getBorderColor(), color: themeUtils.getTextColor(true) }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold border-b pb-2" style={{ color: themeUtils.getTextColor(true), borderColor: themeUtils.getBorderColor() }}>Delivery Options</h3>
            
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: themeUtils.getTextColor(true) }}>Delivery Method <span className="text-red-500">*</span></label>
                <Select
                  className="w-full"
                  value={formData.deliveryMethod}
                  onChange={(e) => setFormData({ ...formData, deliveryMethod: e.target.value })}
                  options={[
                    { label: 'Email', value: 'Email' },
                    { label: 'Download Center', value: 'Download Center' },
                    { label: 'System Notifications', value: 'System Notifications' }
                  ]}
                />
              </div>

              {formData.deliveryMethod === 'Email' && (
                <div>
                  <label className="text-sm font-medium mb-1 block" style={{ color: themeUtils.getTextColor(true) }}>Email Recipients <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    placeholder="Enter email addresses separated by commas"
                    value={formData.recipients}
                    onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ backgroundColor: themeUtils.getBgColor('input'), borderColor: themeUtils.getBorderColor(), color: themeUtils.getTextColor(true) }}
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: themeUtils.getTextColor(true) }}>Report Format</label>
                <Select
                  className="w-full"
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  options={[
                    { label: 'PDF Document', value: 'PDF' },
                    { label: 'Excel Spreadsheet', value: 'Excel' },
                    { label: 'CSV File', value: 'CSV' }
                  ]}
                />
              </div>
            </div>
          </div>
          
        </div>

        <div className="p-4 border-t flex justify-end gap-2" style={{ backgroundColor: themeUtils.getBgColor('card'), borderColor: themeUtils.getBorderColor() }}>
          <Button variant="danger" onClick={onHide} >Cancel</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave}>
            Save Schedule
          </Button>
        </div>
      </div>
    </RightSideDialog>
  );
};
