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
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label className="field-label" style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
          {label}
        </label>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {value.map((item) => (
          <span
            key={item}
            className="badge"
            style={{
              background: G.blueBg,
              color: G.blue,
              border: `1px solid ${G.blueBd}`,
              padding: '4px 8px',
              borderRadius: 5,
              fontSize: 11,
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
                fontSize: 12,
                lineHeight: 1,
              }}
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          style={{ flex: 1, fontSize: 13 }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={add} style={{ padding: '8px 12px' }}>
          Add
        </button>
      </div>
    </div>
  );
}
