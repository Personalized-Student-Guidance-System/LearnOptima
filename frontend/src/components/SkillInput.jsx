import React, { useState } from 'react';
import { G } from '../design/tokens';

export default function SkillInput({ label, value = [], onChange, placeholder = 'Add a skill and press Enter' }) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange?.([...value, trimmed]);
    setInput('');
  };

  const remove = (item) => {
    onChange?.(value.filter((x) => x !== item));
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label className="field-label" style={{ display: 'block', marginBottom: 6 }}>
          {label}
        </label>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {value.map((item) => (
          <span
            key={item}
            className="badge"
            style={{
              background: G.blueBg,
              color: G.blue,
              border: `1px solid ${G.blueBd}`,
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {item}
            <button
              type="button"
              onClick={() => remove(item)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                color: G.blue,
                fontSize: 14,
                lineHeight: 1,
              }}
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          style={{ flex: 1 }}
        />
        <button type="button" className="btn btn-secondary" onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}
