import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import toast from "react-hot-toast";

const NODE_W = 150;
const NODE_H = 70;
const H_GAP = 50;
const V_GAP = 120;

function buildGraph(persons, relationships) {
  const nodes = {};
  persons.forEach((p) => {
    nodes[p.id] = { ...p, spouseIds: [], childIds: [], parentIds: [] };
  });
  relationships.forEach((r) => {
    if (r.relationship_type === "parent") {
      if (nodes[r.person1_id]) nodes[r.person1_id].childIds.push(r.person2_id);
      if (nodes[r.person2_id]) nodes[r.person2_id].parentIds.push(r.person1_id);
    }
    if (r.relationship_type === "spouse") {
      if (
        nodes[r.person1_id] &&
        !nodes[r.person1_id].spouseIds.includes(r.person2_id)
      )
        nodes[r.person1_id].spouseIds.push(r.person2_id);
      if (
        nodes[r.person2_id] &&
        !nodes[r.person2_id].spouseIds.includes(r.person1_id)
      )
        nodes[r.person2_id].spouseIds.push(r.person1_id);
    }
  });
  return nodes;
}

function layout(persons, nodes) {
  // Step 1: Assign depth via iterative parent-based BFS
  const depth = {};
  const maxIterations = persons.length + 1;

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    persons.forEach((p) => {
      const parentDepths = nodes[p.id].parentIds
        .map((pId) => depth[pId])
        .filter((d) => d !== undefined);

      if (parentDepths.length > 0) {
        const newDepth = Math.max(...parentDepths) + 1;
        if (depth[p.id] !== newDepth) {
          depth[p.id] = newDepth;
          changed = true;
        }
      } else if (depth[p.id] === undefined) {
        depth[p.id] = 0;
        changed = true;
      }
    });
    if (!changed) break;
  }

  // Step 2: Spouses share same depth as partner
  let changed = true;
  while (changed) {
    changed = false;
    persons.forEach((p) => {
      nodes[p.id].spouseIds.forEach((sId) => {
        const myDepth = depth[p.id] ?? 0;
        const spouseDepth = depth[sId] ?? 0;
        const maxD = Math.max(myDepth, spouseDepth);
        if (depth[p.id] !== maxD) {
          depth[p.id] = maxD;
          changed = true;
        }
        if (depth[sId] !== maxD) {
          depth[sId] = maxD;
          changed = true;
        }
      });
    });
  }

  persons.forEach((p) => {
    if (depth[p.id] === undefined) depth[p.id] = 0;
  });

  // Step 3: Group by generation
  const gens = {};
  persons.forEach((p) => {
    const d = depth[p.id];
    if (!gens[d]) gens[d] = [];
    if (!gens[d].includes(p.id)) gens[d].push(p.id);
  });

  const pos = {};
  const maxGen = Math.max(...Object.values(depth));

  // Step 4: For each generation, build ordered "units"
  // A unit is either [person] or [person, spouse]
  // Siblings are separate units placed consecutively
  for (let g = 0; g <= maxGen; g++) {
    const ids = gens[g] || [];
    const placed = new Set();
    const units = [];

    // First pass: pair people who share children (real couples)
    const sharedChildPairs = new Set();
    ids.forEach((id) => {
      nodes[id].spouseIds.forEach((sId) => {
        if (!ids.includes(sId)) return;
        // Check if they share at least one child
        const idChildren = new Set(nodes[id].childIds);
        const sIdChildren = new Set(nodes[sId].childIds);
        const sharedChild =
          [...idChildren].some((cId) => sIdChildren.has(cId)) ||
          [...idChildren].some((cId) => nodes[cId]?.parentIds.includes(sId)) ||
          [...sIdChildren].some((cId) => nodes[cId]?.parentIds.includes(id));
        if (sharedChild) {
          const key = [id, sId].sort().join("-");
          sharedChildPairs.add(key);
        }
      });
    });

    ids.forEach((id) => {
      if (placed.has(id)) return;
      placed.add(id);
      const unit = [id];

      // Only pair as couple if they share children
      const spouse = nodes[id].spouseIds.find((sId) => {
        if (depth[sId] !== g || placed.has(sId) || !ids.includes(sId))
          return false;
        const key = [id, sId].sort().join("-");
        return sharedChildPairs.has(key);
      });

      if (spouse) {
        placed.add(spouse);
        unit.push(spouse);
      }
      units.push(unit);
    });

    // Second pass: add remaining unpaired spouses as solo units
    ids.forEach((id) => {
      if (placed.has(id)) return;
      placed.add(id);
      units.push([id]);
    });

    // Place units left to right
    let x = 0;
    units.forEach((unit) => {
      if (unit.length === 2) {
        pos[unit[0]] = { x, y: g * (NODE_H + V_GAP) };
        pos[unit[1]] = { x: x + NODE_W + H_GAP, y: g * (NODE_H + V_GAP) };
        x += NODE_W * 2 + H_GAP + H_GAP;
      } else {
        pos[unit[0]] = { x, y: g * (NODE_H + V_GAP) };
        x += NODE_W + H_GAP;
      }
    });
  }

  // Step 5: Center children under their parents
  for (let g = 1; g <= maxGen; g++) {
    const ids = gens[g] || [];
    const assigned = new Set();
    const groups = [];

    ids.forEach((id) => {
      if (assigned.has(id)) return;
      const siblings = ids.filter((otherId) =>
        nodes[id].parentIds.some((pId) =>
          nodes[otherId].parentIds.includes(pId),
        ),
      );
      const group = siblings.length > 0 ? siblings : [id];
      group.forEach((s) => assigned.add(s));
      groups.push(group);
    });

    groups.forEach((group) => {
      const parentIds = [
        ...new Set(group.flatMap((id) => nodes[id].parentIds)),
      ];
      const parentPositions = parentIds.map((pId) => pos[pId]).filter(Boolean);
      if (parentPositions.length === 0) return;

      // Mid X between all parents including spouses
      const allParentXs = parentIds.flatMap((pId) => {
        const pp = pos[pId];
        if (!pp) return [];
        const spouseXs = nodes[pId].spouseIds
          .map((sId) => pos[sId])
          .filter(Boolean)
          .map((sp) => sp.x + NODE_W / 2);
        return [pp.x + NODE_W / 2, ...spouseXs];
      });

      const parentMidX =
        allParentXs.length > 0
          ? allParentXs.reduce((a, b) => a + b, 0) / allParentXs.length
          : parentPositions[0].x + NODE_W / 2;

      // Only reposition actual children (not spouses-in-group)
      const siblingsOnly = group.filter((id) => nodes[id].parentIds.length > 0);
      const totalW =
        siblingsOnly.length * NODE_W + (siblingsOnly.length - 1) * H_GAP;
      const startX = parentMidX - totalW / 2;

      siblingsOnly.forEach((id, i) => {
        const newX = startX + i * (NODE_W + H_GAP);
        pos[id] = { x: newX, y: depth[id] * (NODE_H + V_GAP) };
        // Reposition spouse immediately to right
        nodes[id].spouseIds.forEach((sId) => {
          if (depth[sId] === depth[id]) {
            pos[sId] = { x: newX + NODE_W + H_GAP, y: pos[id].y };
          }
        });
      });
    });
  }

  return pos;
}

function TreeSVG({ persons, nodes, pos, onPersonClick }) {
  const allX = Object.values(pos).map((p) => p.x);
  const allY = Object.values(pos).map((p) => p.y);
  const pad = 60;
  const minX = Math.min(...allX) - pad;
  const minY = Math.min(...allY) - pad;
  const maxX = Math.max(...allX) + NODE_W + pad;
  const maxY = Math.max(...allY) + NODE_H + pad;
  const W = Math.max(maxX - minX, 500);
  const H = Math.max(maxY - minY, 300);

  const lines = [];
  const drawnCouples = new Set();
  const drawnChildren = new Set();

  persons.forEach((p) => {
    const pPos = pos[p.id];
    if (!pPos) return;
    const node = nodes[p.id];

    // Spouse lines
    node.spouseIds.forEach((sId) => {
      const sPos = pos[sId];
      if (!sPos) return;
      const key = [p.id, sId].sort().join("-");
      if (drawnCouples.has(key)) return;
      drawnCouples.add(key);
      lines.push(
        <line
          key={`s-${key}`}
          x1={pPos.x + NODE_W}
          y1={pPos.y + NODE_H / 2}
          x2={sPos.x}
          y2={sPos.y + NODE_H / 2}
          stroke="#e74c3c"
          strokeWidth={2}
          strokeDasharray="6,3"
        />,
      );
    });

    // Parent->child lines
    node.childIds.forEach((cId) => {
      if (drawnChildren.has(cId)) return;
      drawnChildren.add(cId);

      const cNode = nodes[cId];
      const cPos = pos[cId];
      if (!cPos) return;

      const parentPositions = cNode.parentIds
        .map((pId) => pos[pId])
        .filter(Boolean);
      if (parentPositions.length === 0) return;

      const allParentXs = cNode.parentIds.flatMap((pId) => {
        const pp = pos[pId];
        if (!pp) return [];
        const spouseXs = nodes[pId].spouseIds
          .map((sId) => pos[sId])
          .filter(Boolean)
          .map((sp) => sp.x + NODE_W / 2);
        return [pp.x + NODE_W / 2, ...spouseXs];
      });

      const parentMidX =
        allParentXs.length > 0
          ? allParentXs.reduce((a, b) => a + b, 0) / allParentXs.length
          : parentPositions[0].x + NODE_W / 2;

      const topY = parentPositions[0].y + NODE_H;
      const midY = topY + V_GAP / 2;

      const siblings = persons.filter(
        (s) =>
          nodes[s.id].parentIds.some((pId) => cNode.parentIds.includes(pId)) &&
          pos[s.id],
      );

      lines.push(
        <line
          key={`pv-${cId}`}
          x1={parentMidX}
          y1={topY}
          x2={parentMidX}
          y2={midY}
          stroke="#95a5a6"
          strokeWidth={2}
        />,
      );

      if (siblings.length > 1) {
        const xs = siblings.map((s) => pos[s.id].x + NODE_W / 2);
        lines.push(
          <line
            key={`ph-${cId}`}
            x1={Math.min(...xs)}
            y1={midY}
            x2={Math.max(...xs)}
            y2={midY}
            stroke="#95a5a6"
            strokeWidth={2}
          />,
        );
      }

      siblings.forEach((s) => {
        const sPos = pos[s.id];
        if (!sPos) return;
        lines.push(
          <line
            key={`cv-${s.id}-${cId}`}
            x1={sPos.x + NODE_W / 2}
            y1={midY}
            x2={sPos.x + NODE_W / 2}
            y2={sPos.y}
            stroke="#95a5a6"
            strokeWidth={2}
          />,
        );
      });
    });
  });

  return (
    <svg viewBox={`${minX} ${minY} ${W} ${H}`} width="100%" height="100%">
      {lines}
      {persons.map((p) => {
        const pPos = pos[p.id];
        if (!pPos) return null;
        const isFemale = p.gender === "female";
        const bg = isFemale ? "#8e44ad" : "#2c3e50";
        const birthYear = p.birth_date
          ? new Date(p.birth_date).getFullYear()
          : null;
        const fullName = `${p.first_name} ${p.last_name || ""}`.trim();

        return (
          <g
            key={p.id}
            onClick={() => onPersonClick(p.id)}
            style={{ cursor: "pointer" }}>
            <rect
              x={pPos.x}
              y={pPos.y}
              width={NODE_W}
              height={NODE_H}
              rx={8}
              fill={bg}
              stroke="white"
              strokeWidth={2}
            />
            <text
              x={pPos.x + NODE_W / 2}
              y={pPos.y + NODE_H / 2 - (birthYear ? 8 : 0)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={13}
              fontWeight="600">
              {fullName}
            </text>
            {birthYear && (
              <text
                x={pPos.x + NODE_W / 2}
                y={pPos.y + NODE_H / 2 + 12}
                textAnchor="middle"
                fill="#ecf0f1"
                fontSize={11}>
                b. {birthYear}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function TreePage() {
  const [persons, setPersons] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    gender: "male",
    birth_date: "",
    death_date: "",
    bio: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const personsRes = await axios.get("/persons");
      const allPersons = personsRes.data.data;
      setPersons(allPersons);
      const relPromises = allPersons.map((p) =>
        axios.get(`/relationships/${p.id}`).then((r) => r.data.data),
      );
      const allRels = await Promise.all(relPromises);
      const flat = allRels.flat();
      const unique = Array.from(new Map(flat.map((r) => [r.id, r])).values());
      setRelationships(unique);
    } catch (err) {
      toast.error("Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPerson = async () => {
    if (!form.first_name) {
      toast.error("First name required");
      return;
    }
    try {
      await axios.post("/persons", form, {
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Person added");
      setShowModal(false);
      setForm({
        first_name: "",
        last_name: "",
        gender: "male",
        birth_date: "",
        death_date: "",
        bio: "",
      });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed");
    }
  };

  const nodes = buildGraph(persons, relationships);
  const pos = persons.length > 0 ? layout(persons, nodes) : {};

  const filteredPersons = persons.filter((p) =>
    `${p.first_name} ${p.last_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h2 style={s.title}>🌳 My Family Tree</h2>
        <button onClick={() => setShowModal(true)} style={s.btn}>
          + Add Person
        </button>
      </div>

      <input
        style={s.search}
        placeholder="🔍 Search family members..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p style={s.center}>Loading...</p>
      ) : persons.length === 0 ? (
        <div style={s.empty}>
          <p style={{ fontSize: "3rem" }}>🌱</p>
          <p>No family members yet. Click "+ Add Person" to start.</p>
        </div>
      ) : (
        <>
          <div style={s.grid}>
            {filteredPersons.map((p) => (
              <div
                key={p.id}
                style={s.card}
                onClick={() => navigate(`/person/${p.id}`)}>
                <div
                  style={{
                    ...s.avatar,
                    backgroundColor:
                      p.gender === "female" ? "#8e44ad" : "#2c3e50",
                  }}>
                  <span style={s.initials}>
                    {p.first_name[0]}
                    {p.last_name ? p.last_name[0] : ""}
                  </span>
                </div>
                <p style={s.name}>
                  {p.first_name} {p.last_name}
                </p>
                <p style={s.meta}>
                  {p.gender || ""}
                  {p.birth_date
                    ? ` · ${new Date(p.birth_date).getFullYear()}`
                    : ""}
                </p>
              </div>
            ))}
          </div>

          <div style={s.treeSection}>
            <h3 style={s.treeTitle}>Family Tree View</h3>
            <p style={s.treeHint}>
              Scroll to zoom · Drag to pan · Click a person to view profile ·{" "}
              <span style={{ color: "#e74c3c" }}>── spouse</span>
            </p>
            <div
              style={s.treeBox}
              onMouseDown={(e) => {
                setDragging(true);
                setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
              }}
              onMouseMove={(e) => {
                if (dragging)
                  setPan({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y,
                  });
              }}
              onMouseUp={() => setDragging(false)}
              onMouseLeave={() => setDragging(false)}
              onWheel={(e) => {
                e.preventDefault();
                setZoom((z) =>
                  Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)),
                );
              }}>
              <div
                style={{
                  transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                  width: "100%",
                  height: "100%",
                }}>
                <TreeSVG
                  persons={persons}
                  nodes={nodes}
                  pos={pos}
                  onPersonClick={(id) => navigate(`/person/${id}`)}
                />
              </div>
            </div>
            <div style={s.zoomControls}>
              <button
                onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                style={s.zoomBtn}>
                +
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                style={s.zoomBtn}>
                Reset
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
                style={s.zoomBtn}>
                −
              </button>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={s.modalTitle}>Add Family Member</h3>
            {[
              { key: "first_name", label: "First Name *", type: "text" },
              { key: "last_name", label: "Last Name", type: "text" },
              { key: "birth_date", label: "Birth Date", type: "date" },
              { key: "death_date", label: "Death Date", type: "date" },
            ].map(({ key, label, type }) => (
              <div key={key} style={s.field}>
                <label style={s.label}>{label}</label>
                <input
                  style={s.input}
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div style={s.field}>
              <label style={s.label}>Gender</label>
              <select
                style={s.input}
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Bio</label>
              <textarea
                style={{ ...s.input, height: "70px", resize: "vertical" }}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            <div style={s.modalButtons}>
              <button onClick={handleAddPerson} style={s.btn}>
                Save
              </button>
              <button onClick={() => setShowModal(false)} style={s.btnCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container: { padding: "2rem", backgroundColor: "#f0f4f8", minHeight: "90vh" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  title: { color: "#2c3e50", fontSize: "1.8rem", margin: 0 },
  btn: {
    backgroundColor: "#2c3e50",
    color: "white",
    border: "none",
    padding: "0.6rem 1.4rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1rem",
  },
  btnCancel: {
    backgroundColor: "#95a5a6",
    color: "white",
    border: "none",
    padding: "0.6rem 1.4rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "1rem",
  },
  search: {
    width: "100%",
    padding: "0.7rem 1rem",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "1rem",
    marginBottom: "1.5rem",
    boxSizing: "border-box",
    backgroundColor: "white",
  },
  center: { textAlign: "center", marginTop: "3rem", color: "#888" },
  empty: {
    textAlign: "center",
    marginTop: "5rem",
    color: "#555",
    fontSize: "1.1rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "1rem",
    marginBottom: "2rem",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "10px",
    padding: "1.2rem",
    textAlign: "center",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  avatar: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    margin: "0 auto 0.6rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "white", fontSize: "1.3rem", fontWeight: "bold" },
  name: {
    fontWeight: "600",
    color: "#2c3e50",
    margin: "0.2rem 0",
    fontSize: "0.95rem",
  },
  meta: {
    color: "#888",
    fontSize: "0.78rem",
    margin: 0,
    textTransform: "capitalize",
  },
  treeSection: { marginTop: "1rem" },
  treeTitle: { color: "#2c3e50", marginBottom: "0.3rem" },
  treeHint: { color: "#999", fontSize: "0.85rem", marginBottom: "0.5rem" },
  treeBox: {
    backgroundColor: "white",
    borderRadius: "12px",
    height: "600px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    overflow: "hidden",
    cursor: "grab",
    position: "relative",
  },
  zoomControls: {
    display: "flex",
    gap: "0.5rem",
    marginTop: "0.5rem",
    justifyContent: "flex-end",
  },
  zoomBtn: {
    backgroundColor: "#2c3e50",
    color: "white",
    border: "none",
    padding: "0.4rem 0.8rem",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "1rem",
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "white",
    padding: "2rem",
    borderRadius: "10px",
    width: "100%",
    maxWidth: "440px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalTitle: { color: "#2c3e50", marginBottom: "1.2rem" },
  modalButtons: { display: "flex", gap: "1rem", marginTop: "1.2rem" },
  field: { marginBottom: "0.9rem" },
  label: {
    display: "block",
    marginBottom: "0.3rem",
    color: "#444",
    fontSize: "0.88rem",
    fontWeight: "500",
  },
  input: {
    width: "100%",
    padding: "0.6rem",
    borderRadius: "6px",
    border: "1px solid #ddd",
    fontSize: "1rem",
    boxSizing: "border-box",
  },
};
