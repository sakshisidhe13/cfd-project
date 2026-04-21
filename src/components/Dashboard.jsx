import { useState, useEffect, useRef, createContext, useContext } from "react";

// const PALETTE = { coupled: "#c4b5fd", piso: "#f9a8d4", simple: "#fde68a" };
// const PALETTE = { coupled: "#c4b5fd", piso: "#ec4899", simple: "#fde68a" };
// const PALETTE = { coupled: "#7c3aed", piso: "#ec4899", simple: "#eab308" };
const PALETTE = { coupled: "#7c3aed", piso: "#3b82f6", simple: "#ec4899" };

function makeColors(dark) {
  return {
    ...PALETTE,
    bg:          dark ? "#0d1017" : "#ffffff",
    bgSecondary: dark ? "#161b26" : "#f8f9fb",
    bgTertiary:  dark ? "#1e2435" : "#f1f3f6",
    border:      dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)",
    text:        dark ? "#dde2f0" : "#111318",
    textMuted:   dark ? "#6b7799" : "#6b7280",
  };
}

const MESH_IMG = "/images/mesh.png";
const SKEW_IMG = "/images/skewness.png";

const ThemeCtx = createContext({ dark: false, C: makeColors(false) });
const useTheme = () => useContext(ThemeCtx);

const SOLVERS = ["coupled", "piso", "simple"];
const LOCATION_FILE_KEYS = { d: "d", "3d": "3d", "5d": "5d", "13d": "end" };

function parseVelocityFile(raw) {
  const times = [];
  const values = [];
  const lines = raw.split(/\r?\n/);

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('"') || trimmed.startsWith("(")) return;

    const cols = trimmed.split(/\s+/);
    if (cols.length < 3) return;

    const velocity = Number.parseFloat(cols[1]);
    const flowTime = Number.parseFloat(cols[2]);
    if (!Number.isFinite(velocity) || !Number.isFinite(flowTime)) return;

    values.push(velocity);
    times.push(flowTime);
  });

  return { times, values };
}

async function fetchVelocityFile(solver, location) {
  const key = LOCATION_FILE_KEYS[location] || location;
  const candidateFiles = [`vel_${key}.out`, `velocity_${key}.out`];
  const basePath = "final-files";
  let lastError = null;

  for (const file of candidateFiles) {
    const path = `${basePath}/${solver}/${file}`;
    try {
      const res = await fetch(encodeURI(path));
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
      return await res.text();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`Unable to read velocity file for ${solver}/${location}`);
}

async function loadVelocityDataByLocation(location) {
  const loaded = await Promise.all(
    SOLVERS.map(async solver => {
      const content = await fetchVelocityFile(solver, location);
      const parsed = parseVelocityFile(content);
      return [solver, parsed];
    })
  );

  const bySolver = Object.fromEntries(loaded);
  const times = bySolver.coupled?.times || bySolver.piso?.times || bySolver.simple?.times || [];
  return {
    times,
    data: {
      coupled: bySolver.coupled?.values || [],
      piso: bySolver.piso?.values || [],
      simple: bySolver.simple?.values || [],
    },
  };
}

const SOLVER_DATA = {
  d:    { coupled: { stab: 0.5700, tau: 0.0157, rise: 0.0024 }, piso: { stab: 0.5693, tau: 0.0159, rise: 0.0024 }, simple: { stab: 0.5656, tau: 0.0163, rise: 0.0026 } },
  "3d": { coupled: { stab: 0.5709, tau: 0.0170, rise: 0.0009 }, piso: { stab: 0.5697, tau: 0.0172, rise: 0.0010 }, simple: { stab: 0.5656, tau: 0.0163, rise: 0.0009 } },
  "5d": { coupled: { stab: 0.5738, tau: 0.0181, rise: 0.0009 }, piso: { stab: 0.5722, tau: 0.0182, rise: 0.0009 }, simple: { stab: 0.5684, tau: 0.0150, rise: 0.0008 } },
  "13d":{ coupled: { stab: 0.5698, tau: 0.0225, rise: 0.0018 }, piso: { stab: 0.5698, tau: 0.0209, rise: 0.0015 }, simple: { stab: 0.5664, tau: 0.0216, rise: 0.0016 } },
};

const ITERATIONS = { coupled: 10180, piso: 11570, simple: 13075 };
const ERROR_DATA  = { simple: { tau: 7.27, rise: 7.64 }, piso: { tau: 2.53, rise: 6.945 } };

const videoMap = {
  piso: "/videos/piso.mp4",
  simple: "/videos/simple.mp4",
  coupled: "/videos/coupled.mp4"
};

const NAV = [
  { id: "overview",    icon: "◈", label: "Overview" },
  { id: "geometry",    icon: "⬡", label: "Geometry & Mesh" },
  { id: "transient",   icon: "↗", label: "Transient Analysis" },
  { id: "performance", icon: "⚡", label: "Performance" },
  { id: "accuracy",    icon: "◎", label: "Accuracy" },
  { id: "insights",    icon: "★", label: "Key Insights" },
  { id: "animations",  icon: "▶", label: "Velocity Animations" },
];

/* ─── ATOMS ─── */

function KpiCard({ label, value, unit, sub, color }) {
  const { C } = useTheme();
  return (
    <div style={{ background: C.bgSecondary, borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${color || C.coupled}`, transition: "background 0.25s" }}>
      <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6, fontFamily: "monospace" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 600, color: C.text, fontFamily: "monospace" }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: C.textMuted }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SolverBadge({ solver }) {
  const { C } = useTheme();
  const col = { coupled: C.coupled, piso: C.piso, simple: C.simple }[solver];
  const lbl = { coupled: "COUPLED", piso: "PISO", simple: "SIMPLE" }[solver];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, fontFamily: "monospace", letterSpacing: "0.06em", background: col + "22", color: col, border: `1px solid ${col}44` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: col }} />
      {lbl}
    </span>
  );
}

/* ─── CHARTS ─── */

function VelocityChart({ location, activeSolvers, velocityData }) {
  const { C } = useTheme();
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart || !velocityData) return;
    const { times, data } = velocityData;
    const labels = times.map((t, i) => i % 10 === 0 ? t.toFixed(2) : "");
    const solverDash = { coupled: [6, 3], piso: [6, 3], simple: [6, 3] };
    const solverCols = { coupled: C.coupled, piso: C.piso, simple: C.simple };
    const datasets = ["coupled", "piso", "simple"].filter(s => activeSolvers.includes(s)).map(s => ({
      label: s.toUpperCase(), data: data[s], borderColor: solverCols[s],
      borderWidth: s === "coupled" ? 2.5 : 1.8, borderDash: solverDash[s], pointRadius: 0, tension: 0,
    }));
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(canvasRef.current, {
      type: "line", data: { labels, datasets },
      options: {
        animation: false,
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} m/s` } } },
        scales: {
          x: { ticks: { color: C.textMuted, font: { family: "monospace", size: 10 }, autoSkip: true, maxTicksLimit: 10, maxRotation: 0 }, grid: { color: C.border }, title: { display: true, text: "Time (s)", color: C.textMuted, font: { size: 11 } } },
          y: { ticks: { color: C.textMuted, font: { family: "monospace", size: 10 } }, grid: { color: C.border }, title: { display: true, text: "Velocity (m/s)", color: C.textMuted, font: { size: 11 } } },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [activeSolvers, C, velocityData]);

  return (
    <div style={{ position: "relative", width: "100%", height: 260 }}>
      <canvas ref={canvasRef} role="img" aria-label={`Velocity vs time at ${location}`}>Velocity profiles</canvas>
    </div>
  );
}

function BarChart({ labels, datasets, title, yLabel, height = 220 }) {
  const { C } = useTheme();
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new window.Chart(canvasRef.current, {
      type: "bar",
      data: { labels, datasets: datasets.map(d => ({ ...d, borderRadius: 5, borderSkipped: false })) },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: "index" } },
        scales: {
          x: { ticks: { color: C.textMuted, font: { size: 11 } }, grid: { display: false } },
          y: { ticks: { color: C.textMuted, font: { family: "monospace", size: 10 } }, grid: { color: C.border }, title: { display: !!yLabel, text: yLabel, color: C.textMuted, font: { size: 11 } } },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [labels, datasets, C]);

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <canvas ref={canvasRef} role="img" aria-label={title}>{title}</canvas>
    </div>
  );
}

/* ─── PLUME PHASE DIAGRAM ─── */

function PlumePhaseDiagram({ phase }) {
  const { C } = useTheme();
  const phases = [
    { id: "ignition",      label: "Ignition",      desc: "Rapid pressure buildup, highly unsteady flow from stagnant state", color: C.simple,  icon: "⚡" },
    { id: "acceleration",  label: "Acceleration",   desc: "Flow accelerates; jet forms and propagates downstream",           color: "#a855f7",  icon: "↗" },
    { id: "stabilization", label: "Stabilization",  desc: "Velocity, pressure and temperature approach steady-state (~0.57s)", color: C.piso,   icon: "◎" },
  ];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {phases.map(p => (
        <div
          key={p.id}
          style={{
            flex: "1 1 180px",
            padding: "14px 16px",
            borderRadius: 10,
            background: phase === p.id ? p.color + "18" : C.bgSecondary,
            border: `1.5px solid ${phase === p.id ? p.color : C.border}`,
            // transition: "all 0.3s",
            opacity: phase && phase !== p.id ? 0.5 : 1,
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 6 }}>{p.icon}</div>
          <div style={{ fontWeight: 600, fontSize: 13, color: p.color, marginBottom: 4, fontFamily: "monospace" }}>{p.label}</div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{p.desc}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── NOZZLE SCHEMATIC ─── */

function NozzleSchematic() {
  const { C } = useTheme();
  return (
    <svg viewBox="0 0 500 160" style={{ width: "100%", maxWidth: 500, display: "block" }} role="img" aria-label="CD nozzle schematic">
      <title>CD Nozzle Schematic</title>
      <path d="M 20 40 L 180 68 L 180 92 L 20 120 Z" fill="#86efac" stroke="#4ade80" strokeWidth="1.2" />
      <path d="M 180 68 L 320 62 L 320 98 L 180 92 Z" fill={C.coupled + "30"} stroke={C.border} strokeWidth="1" />
      <text x="100" y="85" textAnchor="middle" fontSize="11" fill={C.textMuted} fontFamily="monospace">Converging</text>
      <text x="100" y="97" textAnchor="middle" fontSize="9"  fill={C.textMuted} fontFamily="monospace">100mm</text>
      <line x1="180" y1="55" x2="180" y2="108" stroke={C.coupled} strokeWidth="1.5" strokeDasharray="4,2" />
      <text x="180" y="48" textAnchor="middle" fontSize="10" fill={C.coupled} fontFamily="monospace" fontWeight="600">Throat</text>
      <text x="180" y="118" textAnchor="middle" fontSize="9" fill={C.textMuted} fontFamily="monospace">Ø28mm</text>
      <text x="250" y="85" textAnchor="middle" fontSize="11" fill={C.textMuted} fontFamily="monospace">Diverging</text>
      <text x="250" y="97" textAnchor="middle" fontSize="9"  fill={C.textMuted} fontFamily="monospace">120mm</text>
      <line x1="320" y1="52" x2="380" y2="52" stroke={C.border} strokeWidth="1" strokeDasharray="2,2" />
      <line x1="320" y1="108" x2="380" y2="108" stroke={C.border} strokeWidth="1" strokeDasharray="2,2" />
      {["d", "3d", "5d", "13d"].map((loc, i) => {
        const x = 330 + i * 38;
        return (
          <g key={loc}>
            <line x1={x} y1={52} x2={x} y2={108} stroke={C.piso} strokeWidth="1" strokeDasharray="3,2" strokeOpacity="0.6" />
            <text x={x} y={45} textAnchor="middle" fontSize="9" fill={C.piso} fontFamily="monospace">{loc}</text>
          </g>
        );
      })}
      <text x="20"  y="135" fontSize="10" fill={C.textMuted} fontFamily="monospace">Inlet diameter 40mm</text>
      <text x="310" y="135" fontSize="10" fill={C.textMuted} fontFamily="monospace">Outlet diameter 30mm</text>
      <text x="260" y="155" fontSize="9"  fill={C.textMuted} fontFamily="monospace">Probe locations →</text>
    </svg>
  );
}

/* ─── DATA TABLE ─── */

function DataTable({ location }) {
  const { C } = useTheme();
  const d = SOLVER_DATA[location];
  const cols = { coupled: C.coupled, piso: C.piso, simple: C.simple };
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
        <thead>
          <tr style={{ background: C.bgTertiary }}>
            {["Solver", "Stab. Time (s)", "τ (s)", "Rise Time (s)"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: C.textMuted, fontWeight: 500, fontSize: 11, letterSpacing: "0.05em", borderBottom: `1px solid ${C.border}` }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {["coupled","piso","simple"].map((s, i) => (
            <tr key={s} style={{ background: i % 2 === 0 ? "transparent" : C.bgTertiary }}>
              <td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}` }}><SolverBadge solver={s} /></td>
              {["stab","tau","rise"].map(k => (
                <td key={k} style={{ padding: "8px 12px", color: cols[s], borderBottom: `1px solid ${C.border}`, fontWeight: s === "coupled" ? 600 : 400 }}>{d[s][k].toFixed(4)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── THEME TOGGLE ─── */

function ThemeToggle() {
  const { dark, C, toggle } = useTheme();
  return (
    <button onClick={toggle} title={dark ? "Switch to light mode" : "Switch to dark mode"} style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      padding: "7px 12px", borderRadius: 20, border: `1px solid ${C.border}`,
      background: C.bgTertiary, color: C.textMuted, cursor: "pointer",
      fontSize: 12, fontFamily: "monospace", transition: "all 0.2s", width: "100%",
    }}>
      <span style={{ fontSize: 14 }}>{dark ? "☀" : "☾"}</span>
      {dark ? "Light mode" : "Dark mode"}
    </button>
  );
}

/* ─── ROOT DASHBOARD ─── */
function AnimationsSection() {
  const { C } = useTheme();
  const [activeVid, setActiveVid] = useState("coupled");
  const [playing, setPlaying]     = useState(true);
  const vidRef = useRef(null);

  const solvers = [
    { id:"coupled", label:"Coupled", col: C.coupled, desc:"Reference solution — strong pressure-velocity coupling, fastest convergence." },
    { id:"piso",    label:"PISO",    col: C.piso,    desc:"Non-iterative per time step — captures sharp transients with high temporal resolution." },
    { id:"simple",  label:"SIMPLE",  col: C.simple,  desc:"Iterative corrections — smoother contours due to numerical diffusion, slightly damped transients." },
  ];

  const active = solvers.find(s => s.id === activeVid);

  const handleSolverSwitch = (id) => {
    setActiveVid(id);
    setPlaying(true);
  };

  const togglePlay = () => {
    if (!vidRef.current) return;
    if (vidRef.current.paused) { vidRef.current.play(); setPlaying(true); }
    else { vidRef.current.pause(); setPlaying(false); }
  };

  return (
    <div>
      {/* Solver selector tabs */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        {solvers.map(s => (
          <button key={s.id} onClick={() => handleSolverSwitch(s.id)} style={{
            flex:"1 1 120px", padding:"10px 16px", borderRadius:10,
            border:`1.5px solid ${activeVid===s.id ? s.col : C.border}`,
            background: activeVid===s.id ? s.col+"18" : C.bgSecondary,
            color: activeVid===s.id ? s.col : C.textMuted,
            cursor:"pointer", transition:"all 0.2s",
            display:"flex", flexDirection:"column", alignItems:"center", gap:4,
          }}>
            <span style={{ fontSize:18 }}>{activeVid===s.id && playing ? "⏸" : "▶"}</span>
            <span style={{ fontSize:12, fontWeight:600, fontFamily:"monospace" }}>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Active solver info badge */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14, padding:"10px 14px", borderRadius:8, background:active.col+"12", border:`1px solid ${active.col}33` }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:active.col, flexShrink:0 }} />
        <span style={{ fontSize:12, color:active.col, fontFamily:"monospace", fontWeight:600 }}>{active.label.toUpperCase()}</span>
        <span style={{ fontSize:12, color:C.textMuted }}>—</span>
        <span style={{ fontSize:12, color:C.textMuted }}>{active.desc}</span>
      </div>

      {/* Main video player */}
      <div style={{ position:"relative", borderRadius:12, overflow:"hidden", border:`1.5px solid ${active.col}55`, background:"#000", marginBottom:14 }}>
        <video
          key={activeVid}
          ref={vidRef}
          src={videoMap[activeVid]}
          autoPlay
          loop
          muted
          playsInline
          style={{ width:"100%", display:"block", maxHeight:420, objectFit:"contain" }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"8px 14px", background:"linear-gradient(transparent,rgba(0,0,0,0.65))", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={togglePlay} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:6, padding:"5px 12px", color:"#fff", cursor:"pointer", fontSize:13, fontFamily:"monospace" }}>
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.6)", fontFamily:"monospace", letterSpacing:"0.06em" }}>
            VELOCITY CONTOUR · {active.label.toUpperCase()} SOLVER · 10ms PULSE
          </span>
        </div>
      </div>

      {/* All three thumbnails side by side */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, color:C.textMuted, fontFamily:"monospace", letterSpacing:"0.06em", marginBottom:10 }}>ALL SOLVERS — SIMULTANEOUS VIEW</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
          {solvers.map(s => (
            <div key={s.id} onClick={() => handleSolverSwitch(s.id)} style={{ cursor:"pointer", borderRadius:8, overflow:"hidden", border:`1.5px solid ${activeVid===s.id ? s.col : C.border}`, transition:"border-color 0.2s", position:"relative" }}>
              <video src={videoMap[s.id]} autoPlay loop muted playsInline style={{ width:"100%", display:"block", objectFit:"cover", height:110 }} />
              <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"4px 8px", background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:s.col }} />
                <span style={{ fontSize:10, color:"#fff", fontFamily:"monospace", fontWeight:600 }}>{s.label.toUpperCase()}</span>
              </div>
              {activeVid===s.id && (
                <div style={{ position:"absolute", top:6, right:6, background:s.col, borderRadius:4, padding:"2px 6px", fontSize:9, color:"#fff", fontFamily:"monospace", fontWeight:700 }}>ACTIVE</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


export default function Dashboard() {
  const [dark, setDark]                   = useState(false);
  const [section, setSection]             = useState("overview");
  const [location, setLocation]           = useState("d");
  const [activeSolvers, setActiveSolvers] = useState(["coupled", "piso", "simple"]);
  const [plumePhase, setPlumePhase]       = useState(null);
  const [chartReady, setChartReady]       = useState(false);
  const [velocityData, setVelocityData]   = useState(null);
  const [velocityError, setVelocityError] = useState("");

  const C = makeColors(dark);
  const ctx = { dark, C, toggle: () => setDark(d => !d) };

  /* load Chart.js once */
  useEffect(() => {
    if (window.Chart) { setChartReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload = () => setChartReady(true);
    document.head.appendChild(s);
  }, []);

  /* plume phase controlled manually (no animation) */
  useEffect(() => {
    if (section !== "transient") {
      setPlumePhase(null);
    }
  }, [section]);

  /* load measured velocity vs time from provided files */
  useEffect(() => {
    let cancelled = false;
    setVelocityError("");
    setVelocityData(null);

    loadVelocityDataByLocation(location)
      .then((nextData) => {
        if (!cancelled) setVelocityData(nextData);
      })
      .catch((err) => {
        if (cancelled) return;
        setVelocityError(`Failed to load velocity data for ${location.toUpperCase()}: ${err?.message || "Unknown error"}`);
      });

    return () => { cancelled = true; };
  }, [location]);

  const toggleSolver = s => setActiveSolvers(prev =>
    prev.includes(s) ? prev.length > 1 ? prev.filter(x => x !== s) : prev : [...prev, s]
  );

  /* shared panel style (must be inside render so C is current) */
  const panel      = { background: C.bgSecondary, borderRadius: 10, padding: 16, border: `1px solid ${C.border}`, marginBottom: 16, transition: "background 0.25s" };
  const panelLabel = { fontSize: 11, fontFamily: "monospace", color: C.textMuted, marginBottom: 12, letterSpacing: "0.06em" };

  return (
    <ThemeCtx.Provider value={ctx}>
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif", background: C.bg, color: C.text, transition: "background 0.25s, color 0.25s" }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width: 210, flexShrink: 0, borderRight: `1px solid ${C.border}`, padding: "20px 0", display: "flex", flexDirection: "column", gap: 2, background: C.bgSecondary, position: "sticky", top: 0, height: "100vh", overflowY: "auto", transition: "background 0.25s" }}>
          {/* header */}
          <div style={{ padding: "0 20px 18px", borderBottom: `1px solid ${C.border}`, marginBottom: 8 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.1em", color: C.textMuted, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 4 }}>AA374 · CFD</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.4 }}>RCS Thruster<br />Solver Benchmark</div>
          </div>
          {/* nav items */}
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 20px",
              background: section === n.id ? C.coupled + "18" : "transparent",
              border: "none", borderLeft: `2px solid ${section === n.id ? C.coupled : "transparent"}`,
              color: section === n.id ? C.coupled : C.textMuted,
              cursor: "pointer", fontSize: 13, textAlign: "left", transition: "all 0.15s",
            }}>
              <span style={{ fontSize: 14, opacity: 0.8 }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
          {/* footer: toggle + meta */}
          <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 10 }}>
            <ThemeToggle />
            <div style={{ fontSize: 10, color: C.textMuted, fontFamily: "monospace", lineHeight: 1.6 }}>ANSYS Fluent · SST k-ω<br />10ms Pulse Simulation</div>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px",width:"100%", maxWidth: "100%" }}>

          {/* OVERVIEW */}
          {section === "overview" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 6 }}>SOLVER BENCHMARKING</div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: C.text }}>RCS Thruster Pulse Start-up</h1>
                <p style={{ color: C.textMuted, fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
                  Transient CFD comparison of PISO, SIMPLE, and COUPLED pressure-velocity solvers for a 10 ms pulse in a 2D axisymmetric De Laval nozzle.
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
                <KpiCard label="Stab. Time"    value="~0.57"  unit="s"  sub="All solvers"    color={C.coupled} />
                <KpiCard label="τ — PISO"      value="0.0172" unit="s"  sub="at 3d location" color={C.piso} />
                <KpiCard label="τ — SIMPLE"    value="0.0163" unit="s"  sub="at 3d location" color={C.simple} />
                <KpiCard label="Nozzle Length" value="220"    unit="mm" sub="CD nozzle"       color="#a855f7" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div style={panel}>
                  <div style={panelLabel}>SOLVER LEGEND</div>
                  {[["coupled","Reference (Coupled)","Strong P-V coupling"],["piso","PISO","Non-iterative transient"],["simple","SIMPLE","Iterative corrections"]].map(([s,name,desc]) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 28, height: 3, background: {coupled:C.coupled,piso:C.piso,simple:C.simple}[s], borderRadius: 2 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={panel}>
                  <div style={panelLabel}>SIMULATION CONFIG</div>
                  {[["Fluid","Air (Ideal Gas)"],["Turbulence","SST k-ω"],["Inlet","10 kPa, 10 ms pulse"],["Outlet","0 Pa (space)"],["Wall","No-slip"],["Op. Pressure","101325 Pa"]].map(([k,v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                      <span style={{ color: C.textMuted }}>{k}</span>
                      <span style={{ fontFamily: "monospace", color: C.text }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={panel}>
                <div style={panelLabel}>NOZZLE SCHEMATIC</div>
                <NozzleSchematic />
              </div>
            </div>
          )}

          {/* GEOMETRY */}
          {section === "geometry" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, color: C.text }}>Geometry & Mesh</h2>
              {/* ── Row 1: parameters + mesh quality stats ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div style={panel}>
                  <div style={panelLabel}>2D NOZZLE PARAMETERS</div>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    {[["Total length","220 mm"],["Inlet diameter","40 mm"],["Outlet diameter","30 mm"],["Throat diameter","28 mm"],["Converging length","100 mm"],["Diverging length","120 mm"]].map(([k,v],i) => (
                      <tr key={k} style={{ background: i%2===0?"transparent":C.bgTertiary }}>
                        <td style={{ padding:"6px 8px", color:C.textMuted }}>{k}</td>
                        <td style={{ padding:"6px 8px", fontFamily:"monospace", color:C.text, fontWeight:500 }}>{v}</td>
                      </tr>
                    ))}
                  </table>
                </div>
                <div style={panel}>
                  <div style={panelLabel}>MESH QUALITY SUMMARY</div>
                  {[["Mesh type","Structured"],["Element types","Quad4 + Tri3"],["Refinement","Throat + nozzle exit"],["Quality","High — low skewness"],["Symmetry","2D axisymmetric"]].map(([k,v]) => (
                    <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:8, borderBottom:`1px solid ${C.border}`, paddingBottom:6 }}>
                      <span style={{ color:C.textMuted }}>{k}</span>
                      <span style={{ color:C.text, fontFamily:"monospace" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* ── Row 4: Nozzle schematic ── */}
              <div style={panel}>
                <div style={panelLabel}>NOZZLE SCHEMATIC WITH PROBE LOCATIONS</div>
                <NozzleSchematic />
              </div>

              {/* ── Row 2: Mesh image ── */}
              <div style={panel}>
                <div style={panelLabel}>NOZZLE MESH — ANSYS FLUENT</div>
                <div style={{ borderRadius:8, overflow:"hidden", border:`1px solid ${C.border}`, marginBottom:12 }}>
                  <img
                    src={MESH_IMG}
                    alt="Structured mesh of the 2D axisymmetric converging-diverging nozzle"
                    style={{ width:"100%", display:"block", objectFit:"contain", maxHeight:280 }}
                  />
                </div>
                <div style={{ fontSize:12, color:C.textMuted, lineHeight:1.6 }}>
                  Structured quadrilateral mesh of the 2D axisymmetric De Laval nozzle. Mesh refinement is applied near the throat and nozzle exit to accurately resolve steep velocity and pressure gradients in those regions.
                </div>
              </div>

              {/* ── Row 3: Skewness plot + conclusions ── */}
              <div style={panel}>
                <div style={panelLabel}>ELEMENT SKEWNESS DISTRIBUTION</div>
                {/* Full-width plot */}
                <div style={{ borderRadius:8, overflow:"hidden", border:`1px solid ${C.border}`, marginBottom:16 }}>
                  <img
                    src={SKEW_IMG}
                    alt="Skewness distribution histogram showing Tri3 and Quad4 elements vs Element Metrics"
                    style={{ width:"100%", display:"block", objectFit:"contain" }}
                  />
                </div>
                {/* Conclusions below */}
                <div style={{ fontSize:11, color:C.textMuted, fontFamily:"monospace", letterSpacing:"0.06em", marginBottom:10 }}>KEY OBSERVATIONS</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
                  {[
                    { icon:"◉", color:C.piso,     text:"Most elements concentrated at very low skewness (~0 to 0.05), indicating near-perfect element quality." },
                    { icon:"◎", color:C.coupled,  text:"Very few elements extend toward ~0.1 skewness — only a small fraction near the throat curvature." },
                    { icon:"○", color:C.textMuted, text:"Almost no elements in the high skewness range (>0.3), confirming mesh suitability for accurate CFD." },
                  ].map(({icon,color,text}) => (
                    <div key={text} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"10px 12px", borderRadius:8, background:C.bgTertiary, border:`1px solid ${C.border}` }}>
                      <span style={{ color, fontSize:14, flexShrink:0, marginTop:1 }}>{icon}</span>
                      <span style={{ fontSize:12, color:C.textMuted, lineHeight:1.6 }}>{text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding:"8px 12px", borderRadius:8, background:C.piso+"12", border:`1px solid ${C.piso}33` }}>
                  <div style={{ fontSize:11, fontWeight:600, color:C.piso, fontFamily:"monospace", marginBottom:3 }}>VERDICT</div>
                  <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.6 }}>High-quality mesh — acceptable for pressure-based transient CFD simulations.</div>
                </div>
              </div>
            </div>
          )}

          {/* TRANSIENT */}
          {section === "transient" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: C.text }}>Transient Analysis</h2>
              <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 20 }}>Velocity vs time at probe locations downstream of nozzle exit.</p>
              <div style={{ marginBottom: 20 }}>
                <div style={panelLabel}>PLUME STABILIZATION PHASES</div>
                <PlumePhaseDiagram phase={plumePhase} />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: C.textMuted }}>Probe location:</div>
                {["d","3d","5d","13d"].map(loc => (
                  <button key={loc} onClick={() => setLocation(loc)} style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${location===loc?C.coupled:C.border}`, background:location===loc?C.coupled+"18":"transparent", color:location===loc?C.coupled:C.textMuted, cursor:"pointer", fontSize:12, fontFamily:"monospace", transition:"all 0.15s" }}>{loc}</button>
                ))}
                <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
                  {["coupled","piso","simple"].map(s => {
                    const col={coupled:C.coupled,piso:C.piso,simple:C.simple}[s];
                    const on=activeSolvers.includes(s);
                    return <button key={s} onClick={()=>toggleSolver(s)} style={{ padding:"4px 12px", borderRadius:20, fontSize:11, fontFamily:"monospace", cursor:"pointer", border:`1px solid ${on?col:C.border}`, background:on?col+"20":"transparent", color:on?col:C.textMuted, opacity:on?1:0.5, transition:"all 0.15s" }}>{s.toUpperCase()}</button>;
                  })}
                </div>
              </div>
              <div style={panel}>
                {velocityError && (
                  <div style={{ color: C.simple, fontSize: 12, fontFamily: "monospace" }}>{velocityError}</div>
                )}
                {!velocityError && !velocityData && (
                  <div style={{ color: C.textMuted, fontSize: 12, fontFamily: "monospace" }}>Loading velocity data...</div>
                )}
                {chartReady && velocityData && (
                  <VelocityChart location={location} activeSolvers={activeSolvers} velocityData={velocityData} />
                )}
              </div>
              <div style={panel}>
                <div style={panelLabel}>DATA TABLE — LOCATION: {location.toUpperCase()}</div>
                <DataTable location={location} />
              </div>
            </div>
          )}

          {/* PERFORMANCE */}
          {section === "performance" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: C.text }}>Computational Performance</h2>
              <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 20 }}>Iteration counts required for convergence across solver schemes.</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
                <KpiCard label="COUPLED iterations" value={ITERATIONS.coupled.toLocaleString()} color={C.coupled} sub="Fewest — reference" />
                <KpiCard label="PISO iterations"    value={ITERATIONS.piso.toLocaleString()}    color={C.piso}    sub="+13.7% vs coupled" />
                <KpiCard label="SIMPLE iterations"  value={ITERATIONS.simple.toLocaleString()}  color={C.simple}  sub="+28.4% vs coupled" />
              </div>
              <div style={panel}>
                <div style={panelLabel}>ITERATION COUNT COMPARISON</div>
                {chartReady && <BarChart title="Solver iteration count" labels={["COUPLED","PISO","SIMPLE"]} yLabel="Iterations" datasets={[{ label:"Iterations", data:[ITERATIONS.coupled,ITERATIONS.piso,ITERATIONS.simple], backgroundColor:[C.coupled+"cc",C.piso+"cc",C.simple+"cc"], borderColor:[C.coupled,C.piso,C.simple], borderWidth:1.5 }]} />}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                {[
                  { title:"Coupled",  col:C.coupled, pros:["Fewest iterations","Fastest convergence","Strong P-V coupling"], cons:["Higher memory/step"] },
                  { title:"PISO",     col:C.piso,    pros:["Non-iterative/step","Good transient res.","Fewer iters than SIMPLE"], cons:["Needs small Δt"] },
                  { title:"SIMPLE",   col:C.simple,  pros:["Numerically stable","Robust for larger Δt"], cons:["Most iterations","Numerical diffusion","Smooths transients"] },
                ].map(({title,col,pros,cons}) => (
                  <div key={title} style={{ background:C.bgSecondary, borderRadius:10, padding:14, border:`1px solid ${C.border}`, borderTop:`2.5px solid ${col}` }}>
                    <div style={{ fontWeight:600, fontSize:13, marginBottom:10, color:C.text }}>{title}</div>
                    {pros.map(p=><div key={p} style={{ fontSize:11, color:C.piso, marginBottom:4 }}>✓ {p}</div>)}
                    {cons.map(c=><div key={c} style={{ fontSize:11, color:C.simple, marginBottom:4 }}>✗ {c}</div>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACCURACY */}
          {section === "accuracy" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: C.text }}>Accuracy Assessment</h2>
              <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 20 }}>Percentage error vs COUPLED reference solver.</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12, marginBottom:20 }}>
                <KpiCard label="PISO τ error"           value="2.53%"  color={C.piso}   sub="vs coupled reference" />
                <KpiCard label="SIMPLE τ error"         value="7.27%"  color={C.simple} sub="vs coupled reference" />
                <KpiCard label="PISO rise time error"   value="6.945%"  color={C.piso}   sub="vs coupled reference" />
                <KpiCard label="SIMPLE rise time error" value="7.64%" color={C.simple} sub="vs coupled reference" />
              </div>
              <div style={panel}>
                <div style={panelLabel}>TIME CONSTANT (τ) ERROR</div>
                {chartReady && <BarChart title="Time constant error" labels={["PISO","SIMPLE"]} yLabel="% Error" height={200} datasets={[{ label:"τ Error (%)", data:[ERROR_DATA.piso.tau,ERROR_DATA.simple.tau], backgroundColor:[C.piso+"cc",C.simple+"cc"], borderColor:[C.piso,C.simple], borderWidth:1.5 }]} />}
              </div>
              <div style={panel}>
                <div style={panelLabel}>RISE TIME ERROR</div>
                {chartReady && <BarChart title="Rise time error" labels={["PISO","SIMPLE"]} yLabel="% Error" height={200} datasets={[{ label:"Rise Time Error (%)", data:[ERROR_DATA.piso.rise,ERROR_DATA.simple.rise], backgroundColor:[C.piso+"cc",C.simple+"cc"], borderColor:[C.piso,C.simple], borderWidth:1.5 }]} />}
              </div>
              <div style={panel}>
                <div style={panelLabel}>ACCURACY SUMMARY TABLE</div>
                <table style={{ width:"100%", fontSize:12, borderCollapse:"collapse", fontFamily:"monospace" }}>
                  <thead>
                    <tr style={{ background:C.bgTertiary }}>
                      {["Metric","SIMPLE vs Coupled","PISO vs Coupled"].map(h=>(
                        <th key={h} style={{ padding:"8px 12px", textAlign:"left", color:C.textMuted, fontWeight:500, fontSize:11, borderBottom:`1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[["Stabilization Time","0.8095%","0.153%"],["Time Constant (τ)","7.27%","2.53%"],["Rise Time","7.64%","6.946%"]].map(([metric,s,p],i)=>(
                      <tr key={metric} style={{ background:i%2===0?"transparent":C.bgTertiary }}>
                        <td style={{ padding:"8px 12px", color:C.text, borderBottom:`1px solid ${C.border}` }}>{metric}</td>
                        <td style={{ padding:"8px 12px", color:s==="~0%"?C.piso:C.simple, borderBottom:`1px solid ${C.border}` }}>{s}</td>
                        <td style={{ padding:"8px 12px", color:C.piso, borderBottom:`1px solid ${C.border}` }}>{p}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INSIGHTS */}
          {section === "insights" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: C.text }}>Key Insights</h2>
              <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 24 }}>Summary findings from the RCS thruster transient solver benchmark study.</p>
              <div style={{ display:"flex", flexDirection:"column", gap:14, marginBottom:28 }}>
                {[
                  { color:C.piso,   icon:"★", title:"PISO is the optimal solver for short transient RCS simulations", body:"PISO achieves τ error of only 1.95% and rise time error of 8.57% vs the coupled reference, while requiring fewer iterations than SIMPLE. Its non-iterative nature per time step makes it well-suited for resolving rapid 10 ms pulse dynamics." },
                  { color:C.simple, icon:"◈", title:"SIMPLE is stable but computationally expensive for pulses", body:"SIMPLE requires 13,075 iterations — 28% more than COUPLED — and shows 44.83% rise time error. Its iterative pressure-velocity corrections introduce numerical diffusion that smooths sharp transients, making it less suitable for short-pulse RCS applications." },
                  { color:C.coupled,icon:"◎", title:"All solvers agree on stabilization time (~0.57 s)", body:"Regardless of solver choice, the exhaust plume stabilizes within approximately 0.57 s across all probe locations (D, 3D, 5D, 13D). This confirms the rapid response characteristic of RCS thrusters and validates all three pressure-based schemes for gross plume behavior." },
                  { color:"#a855f7",icon:"⬡", title:"Subsonic regime enables stable pressure-based solving", body:"The nozzle geometry and operating conditions were deliberately chosen for subsonic flow (no normal shocks), which ensures convergence of all three pressure-based transient solvers. Supersonic RCS applications would require density-based solvers." },
                ].map(({color,icon,title,body})=>(
                  <div key={title} style={{ background:C.bgSecondary, borderRadius:10, padding:"18px 20px", border:`1px solid ${C.border}`, borderLeft:`4px solid ${color}` }}>
                    <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                      <span style={{ fontSize:18, color, flexShrink:0, marginTop:2 }}>{icon}</span>
                      <div>
                        <div style={{ fontWeight:600, fontSize:14, marginBottom:6, color:C.text }}>{title}</div>
                        <div style={{ fontSize:13, color:C.textMuted, lineHeight:1.65 }}>{body}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={panel}>
                <div style={panelLabel}>EXTENSIONS & FUTURE WORK</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {[
                    ["Real-time Integration","Stream live ANSYS Fluent/OpenFOAM residuals and velocity data via REST API into this dashboard for live monitoring."],
                    ["ML Surrogate Model","Train a PINN or CNN on flow snapshots to predict stabilization time from nozzle geometry and inlet conditions."],
                    ["3D Simulation Overlay","Extend to full 3D with slice-plane visualization using VTK.js or ParaView Glance for interactive contour browsing."],
                    ["Uncertainty Quantification","Apply Monte Carlo or polynomial chaos expansion to quantify sensitivity of plume stabilization to inlet pressure uncertainty."],
                  ].map(([title,desc])=>(
                    <div key={title} style={{ padding:"12px 14px", background:C.bgTertiary, borderRadius:8, border:`1px solid ${C.border}` }}>
                      <div style={{ fontWeight:500, fontSize:12, marginBottom:5, color:C.text }}>{title}</div>
                      <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.6 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VELOCITY ANIMATIONS */}
          {section === "animations" && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "monospace", letterSpacing: "0.08em", marginBottom: 6 }}>CFD FLOW VISUALISATION</div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: C.text }}>Velocity Contour Animations</h2>
                <p style={{ color: C.textMuted, fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
                  Transient velocity contour evolution during the 10 ms RCS thruster pulse start-up. Each animation shows the full plume development — ignition through stabilisation — for one solver scheme.
                </p>
              </div>

              {/* Side-by-side toggle strip */}
              <AnimationsSection />
            </div>
          )}

        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
