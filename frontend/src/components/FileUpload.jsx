import React, { useRef, useState } from 'react';
import { G } from '../design/tokens';

export default function FileUpload({ label, accept, value, onChange, error }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handleFile = (file) => {
    if (!file) return;
    onChange?.(file);
  };

  return (
    <div style={{ marginBottom: 14 }}>
      {label && (
        <label className="field-label" style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
          {label}
        </label>
      )}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const file = e.dataTransfer.files?.[0];
          handleFile(file);
        }}
        style={{
          border: `2px dashed ${error ? G.red : drag ? G.blue : G.border}`,
          borderRadius: 8,
          padding: 18,
          textAlign: 'center',
          background: drag ? G.blueBg : G.bg2,
          cursor: 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={(e) => handleFile(e.target.files?.[0])}
          style={{ display: 'none' }}
        />
        {value ? (
          <div style={{ fontSize: 12, color: G.text, fontWeight: 500 }}>
            ✓ {value.name}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
            <div style={{ fontSize: 12, color: G.text2 }}>
              Drop file or click to browse
            </div>
            {accept && (
              <div style={{ fontSize: 10, color: G.text3, marginTop: 3 }}>{accept}</div>
            )}
          </>
        )}
      </div>
      {error && (
        <div style={{ fontSize: 11, color: G.red, marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}
