import React from 'react';

interface TimePickerProps {
  value: string;          // "08:30"
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export function TimePicker({ value, onChange, label, required, disabled }: TimePickerProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type="time"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      />
    </div>
  );
}
