import { useState } from 'react';

interface FloatingInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  autoFocus?: boolean;
}

export default function FloatingInput({
  label,
  type = 'text',
  value,
  onChange,
  name,
  required,
  autoComplete,
  minLength,
  autoFocus,
}: FloatingInputProps) {
  const [focused, setFocused] = useState(false);

  // Float the label when focused OR when the field has a value
  const floated = focused || value.length > 0;

  return (
    <div style={{ position: 'relative', paddingTop: 20 }}>
      {/* Floating label */}
      <label
        style={{
          position: 'absolute',
          left: 0,
          // Floated: sits at top of the wrapper. Resting: sits at input text level
          top: floated ? 0 : 22,
          fontSize: floated ? 10 : 14,
          fontWeight: floated ? 500 : 400,
          letterSpacing: floated ? '0.7px' : '0px',
          // Accent when actively focused, muted grey when floated but not focused, placeholder grey at rest
          color: floated
            ? focused ? 'var(--sv-accent)' : 'var(--sv-text-3)'
            : 'var(--sv-text-4)',
          textTransform: floated ? 'uppercase' : 'none',
          pointerEvents: 'none',
          transition: 'top 0.18s ease, font-size 0.18s ease, color 0.18s ease, letter-spacing 0.18s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </label>

      {/* Input */}
      <input
        type={type}
        value={value}
        onChange={onChange}
        name={name}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${focused ? 'var(--sv-accent)' : 'var(--sv-border-2)'}`,
          paddingBottom: 10,
          fontSize: 14,
          color: 'var(--sv-text)',
          caretColor: 'var(--sv-accent)',
          outline: 'none',
          transition: 'border-color 0.18s ease',
        }}
      />
    </div>
  );
}