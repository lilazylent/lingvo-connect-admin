"use client";

import { Children, isValidElement, useId, type ReactNode } from "react";
import { Select as Primitive } from "@base-ui/react/select";

type OptionProps = { value?: string; children: ReactNode; disabled?: boolean };
type SelectionChange = { target: { value: string } };

// Preserve the existing value-only callback shape, not a synthetic DOM event.
// <option> children are descriptors: no native option popup is rendered.
export function Select({ label, children, value, onChange, disabled, hint, error, hideLabel = false, name }: {
  label: string; children: ReactNode; value: string;
  onChange: (selection: SelectionChange) => void;
  disabled?: boolean; hint?: string; error?: string; hideLabel?: boolean; name?: string;
}) {
  const id = useId();
  const options = Children.toArray(children).filter(isValidElement<OptionProps>).map((child) => ({
    value: String(child.props.value ?? child.props.children),
    label: child.props.children,
    disabled: child.props.disabled,
  }));
  return <div className={`field ${hideLabel ? "field--compact" : ""}`}>
    <span className={hideLabel ? "sr-only" : "field__label"} id={`${id}-label`}>{label}</span>
    <Primitive.Root value={value} items={options} disabled={disabled} name={name}
      onValueChange={(next) => { if (next !== null && next !== value) onChange({ target: { value: next } }); }}>
      <Primitive.Trigger className={`input select-trigger ${error ? "input--error" : ""}`}
        aria-labelledby={`${id}-label`} aria-invalid={Boolean(error)} aria-describedby={hint || error ? `${id}-help` : undefined}>
        <Primitive.Value /><Primitive.Icon className="select-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" width="16" height="16" fill="none"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.3" /></svg></Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Positioner sideOffset={6} align="start" alignItemWithTrigger={false} className="select-positioner">
          <Primitive.Popup className="select-popup">
            <Primitive.ScrollUpArrow className="select-scroll" aria-hidden="true">↑</Primitive.ScrollUpArrow>
            <Primitive.List>
              {options.map((option) => <Primitive.Item key={option.value} value={option.value} disabled={option.disabled} className="select-option">
                <Primitive.ItemText>{option.label}</Primitive.ItemText>
                <Primitive.ItemIndicator className="select-check" aria-hidden="true">✓</Primitive.ItemIndicator>
              </Primitive.Item>)}
            </Primitive.List>
            <Primitive.ScrollDownArrow className="select-scroll" aria-hidden="true">↓</Primitive.ScrollDownArrow>
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
    {(hint || error) && <span id={`${id}-help`} className={error ? "field__error" : "field__hint"}>{error || hint}</span>}
  </div>;
}
