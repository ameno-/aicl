import { ChevronDown } from 'lucide-react';
import { SmoothDropdown, type DropdownOption, type SmoothDropdownProps } from '../../vendor/uselayouts/smooth-dropdown.tsx';

export type { DropdownOption, SmoothDropdownProps };
export { SmoothDropdown };

export interface ModelPickerProps {
  options: DropdownOption[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  direction?: 'up' | 'down';
  align?: 'start' | 'end';
  disabled?: boolean;
  className?: string;
}

/** SmoothDropdown with a "selected label + chevron" trigger. */
export function ModelPicker({ label = 'Model', ...props }: ModelPickerProps) {
  const selected = props.options.find((o) => o.id === props.value);
  return (
    <SmoothDropdown
      data-fx-component="model-picker"
      label={label}
      width={300}
      {...props}
      trigger={
        <>
          {selected?.icon}
          <span className="truncate">{selected?.label ?? 'Select'}</span>
          <ChevronDown size={14} aria-hidden="true" className="text-muted-foreground" />
        </>
      }
    />
  );
}
