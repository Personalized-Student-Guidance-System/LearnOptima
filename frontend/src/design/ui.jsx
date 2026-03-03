import React from 'react';
import { G, ICONS } from './tokens';

export const Ic = ({ path, size = 14, color = "currentColor", sw = 1.6, fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {Array.isArray(path) ? path.map((p, i) => <path key={i} d={p} />) : <path d={path} />}
  </svg>
);

export const Badge = ({ label, color = "default" }) => {
  const map = {
    default: { bg: G.bg2,      text: G.text2,   bd: G.border },
    blue:    { bg: G.blueBg,   text: G.blue,    bd: G.blueBd },
    green:   { bg: G.greenBg,  text: G.green,   bd: G.greenBd },
    amber:   { bg: G.amberBg,  text: G.amber,   bd: G.amberBd },
    red:     { bg: G.redBg,    text: G.red,     bd: G.redBd },
    purple:  { bg: G.purpleBg, text: G.purple,  bd: G.purpleBd },
  };
  const s = map[color] || map.default;
  return (
    <span className="badge" style={{ background: s.bg, color: s.text, border: `1px solid ${s.bd}` }}>
      {label}
    </span>
  );
};

export const StatCard = ({ label, value, delta, unit = "", color = "blue", icon, sub }) => {
  const colorMap = { blue: G.blue, green: G.green, amber: G.amber, red: G.red, purple: G.purple };
  const c = colorMap[color] || G.blue;
  return (
    <div className="card card-md" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: G.text2 }}>{label}</span>
        {icon && (
          <div style={{ width: 30, height: 30, borderRadius: 6, background: c + "12", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ic path={ICONS[icon]} size={14} color={c} />
          </div>
        )}
      </div>
      <div className="count-in" style={{ fontWeight: 700, fontSize: 28, color: G.text, lineHeight: 1, letterSpacing: "-0.02em" }}>
        {value}<span style={{ fontSize: 16, color: G.text2, fontWeight: 500 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: G.text3 }}>{sub}</div>}
      {delta !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <Ic path={ICONS.trend} size={11} color={delta >= 0 ? G.green : G.red} />
          <span style={{ color: delta >= 0 ? G.green : G.red, fontWeight: 600 }}>{delta >= 0 ? "+" : ""}{delta}%</span>
          <span style={{ color: G.text3 }}>vs last week</span>
        </div>
      )}
    </div>
  );
};

export const SectionHeader = ({ title, subtitle, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: G.text, letterSpacing: "-0.01em" }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 12, color: G.text3, marginTop: 2 }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const ProgressRow = ({ label, value, max = 100, color = G.blue, right }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: G.text }}>{label}</span>
      <span style={{ fontSize: 12, color: G.text2 }}>{right || `${value}%`}</span>
    </div>
    <div className="progress-track">
      <div className="progress-bar" style={{ width: `${(value / max) * 100}%`, background: color }} />
    </div>
  </div>
);

export const Spinner = ({ color = "white", size = 13 }) => (
  <div style={{
    width: size, height: size,
    border: `2px solid ${color}`,
    borderTopColor: "transparent",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    flexShrink: 0,
  }} />
);