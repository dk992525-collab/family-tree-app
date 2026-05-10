import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axios";
import toast from "react-hot-toast";

// ─── Layout Constants ───────────────────────────────────────────
const NODE_W = 140;
const NODE_H = 70;
const H_GAP = 60;
const V_GAP = 100;
const COUPLE_GAP = 40;

// ─── Build family map from flat data ────────────────────────────
function buildFamilyMap(persons, relationships) {
  const map = {};
  persons.forEach((p) => {
    map[p.id] = {
      ...p,
      spouseIds: [],
      childIds: [],
      parentIds: [],
      isChild: false,
    };
  });

  relationships.forEach((rel) => {
    if (rel.relationship_type === "parent") {
      if (map[rel.person1_id])
        map[rel.person1_id].childIds.push(rel.person2_id);
      if (map[rel.person2_id]) {
        map[rel.person2_id].parentIds.push(rel.person1_id);
        map[rel.person2_id].isChild = true;
      }
    }
    if (rel.relationship_type === "spouse") {
      if (
        map[rel.person1_id] &&
        !map[rel.person1_id].spouseIds.includes(rel.person2_id)
      )
        map[rel.person1_id].spouseIds.push(rel.person2_id);
      if (
        map[rel.person2_id] &&
        !map[rel.person2_id].spouseIds.includes(rel.person1_id)
      )
        map[rel.person2_id].spouseIds.push(rel.person1_id);
    }
  });

  return map;
}

// ─── Assign generations ─────────────────────────────────────────
function assignGenerations(map) {
  const generations = {};
  const visited = new Set();

  function dfs(id, gen) {
    if (visited.has(id)) return;
    visited.add(id);
    generations[id] = Math.max(generations[id] ?? -Infinity, gen);
    map[id].childIds.forEach((cId) => dfs(cId, gen + 1));
  }

  Object.values(map)
    .filter((p) => !p.isChild)
    .forEach((p) => dfs(p.id, 0));

  // Handle disconnected persons
  Object.keys(map).forEach((id) => {
    if (generations[id] === undefined) generations[id] = 0;
  });

  return generations;
}

// ─── Calculate node positions ───────────────────────────────────
function calculatePositions(persons, map, generations) {
  const genGroups = {};
  Object.entries(generations).forEach(([id, gen]) => {
    if (!genGroups[gen]) genGroups[gen] = [];
    genGroups[gen].push(parseInt(id));
  });

  const positions = {};
  const maxGen = Math.max(...Object.values(generations));

  // Position generation by generation
  for (let gen = 0; gen <= maxGen; gen++) {
    const ids = genGroups[gen] || [];
    // Filter out spouses already positioned
    const roots = ids.filter((id) => !positions[id]);

    let x = 0;
    roots.forEach((id) => {
      const person = map[id];
      positions[id] = { x, y: gen * (NODE_H + V_GAP) };

      // Position spouse next to person
      person.spouseIds.forEach((spouseId) => {
        if (!positions[spouseId]) {
          positions[spouseId] = {
            x: x + NODE_W + COUPLE_GAP,
            y: gen * (NODE_H + V_GAP),
          };
        }
      });

      // Calculate width needed for children
      const allChildren = [
        ...person.childIds,
        ...person.spouseIds.flatMap((sId) => map[sId]?.childIds || []),
      ].filter((v, i, a) => a.indexOf(v) === i);

      const childrenWidth =
        allChildren.length > 0
          ? allChildren.length * (NODE_W + H_GAP) - H_GAP
          : 0;

      const coupleWidth =
        person.spouseIds.length > 0 ? NODE_W * 2 + COUPLE_GAP : NODE_W;

      x += Math.max(coupleWidth, childrenWidth) + H_GAP;
    });
  }

  // Reposition children centered under parents
  for (let gen = 1; gen <= maxGen; gen++) {
    const ids = genGroups[gen] || [];
    ids.forEach((id) => {
      const person = map[id];
      if (person.parentIds.length > 0) {
        const parentPositions = person.parentIds
          .filter((pId) => positions[pId])
          .map((pId) => positions[pId].x);

        if (parentPositions.length > 0) {
          const parentAvgX =
            parentPositions.reduce((a, b) => a + b, 0) / parentPositions.length;
          // Get siblings
          const siblings = ids.filter((sibId) => {
            const sib = map[sibId];
            return sib.parentIds.some((pId) => person.parentIds.includes(pId));
          });
          const sibIndex = siblings.indexOf(id);
          const totalSibWidth = siblings.length * (NODE_W + H_GAP) - H_GAP;
          const startX = parentAvgX + NODE_W / 2 - totalSibWidth / 2;
          positions[id] = {
            x: startX + sibIndex * (NODE_W + H_GAP),
            y: gen * (NODE_H + V_GAP),
          };
        }
      }
    });
  }

  return positions;
}

// ─── SVG Tree Component ─────────────────────────────────────────
function FamilyTreeSVG({ persons, relationships, onPersonClick }) {
  const map = buildFamilyMap(persons, relationships);
  const generations = assignGenerations(map);
  const positions = calculatePositions(persons, map, generations);

  const allX = Object.values(positions).map((p) => p.x);
  const allY = Object.values(positions).map((p) => p.y);
  const minX = Math.min(...allX) - 40;
  const minY = Math.min(...allY) - 40;
  const maxX = Math.max(...allX) + NODE_W + 40;
  const maxY = Math.max(...allY) + NODE_H + 40;
  const svgW = Math.max(maxX - minX, 600);
  const svgH = Math.max(maxY - minY, 400);

  const lines = [];
  const drawn = new Set();

  persons.forEach((p) => {
    const pos = positions[p.id];
    if (!pos) return;
    const person = map[p.id];

    // Draw couple bracket
    person.spouseIds.forEach((spouseId) => {
      const spousePos = positions[spouseId];
      if (!spousePos) return;
      const key = [p.id, spouseId].sort().join("-");
      if (!drawn.has(key)) {
        drawn.add(key);
        const x1 = pos.x + NODE_W;
        const x2 = spousePos.x;
        const y = pos.y + NODE_H / 2;
        lines.push(
          <line
            key={`couple-${key}`}
            x1={x1}
            y1={y}
            x2={x2}
            y2={y}
            stroke="#e74c3c"
            strokeWidth={2}
            strokeDasharray="6,3"
          />,
        );
      }
    });

    // Draw parent-child lines
    const allChildren = [
      ...person.childIds,
      ...person.spouseIds.flatMap((sId) => map[sId]?.childIds || []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    if (allChildren.length > 0) {
      const spouseId = person.spouseIds[0];
      const spousePos = spouseId ? positions[spouseId] : null;

      // Mid point between person and spouse (or just person center)
      const parentMidX = spousePos
        ? (pos.x + NODE_W / 2 + spousePos.x + NODE_W / 2) / 2
        : pos.x + NODE_W / 2;
      const parentBottomY = pos.y + NODE_H;
      const midY = parentBottomY + V_GAP / 2;

      // Vertical line down from parent mid
      lines.push(
        <line
          key={`pv-${p.id}`}
          x1={parentMidX}
          y1={parentBottomY}
          x2={parentMidX}
          y2={midY}
          stroke="#95a5a6"
          strokeWidth={2}
        />,
      );

      if (allChildren.length > 1) {
        const childXs = allChildren
          .map((cId) => positions[cId]?.x + NODE_W / 2)
          .filter(Boolean);
        const hLeft = Math.min(...childXs);
        const hRight = Math.max(...childXs);
        lines.push(
          <line
            key={`ph-${p.id}`}
            x1={hLeft}
            y1={midY}
            x2={hRight}
            y2={midY}
            stroke="#95a5a6"
            strokeWidth={2}
          />,
        );
      }

      allChildren.forEach((cId) => {
        const childPos = positions[cId];
        if (!childPos) return;
        const childTopX = childPos.x + NODE_W / 2;
        lines.push(
          <line
            key={`cv-${p.id}-${cId}`}
            x1={childTopX}
            y1={midY}
            x2={childTopX}
            y2={childPos.y}
            stroke="#95a5a6"
            strokeWidth={2}
          />,
        );
      });
    }
  });

  return (
    <svg
      viewBox={`${minX} ${minY} ${svgW} ${svgH}`}
      width="100%"
      height="100%"
      style={{ fontFamily: "sans-serif" }}>
      {lines}
      {persons.map((p) => {
        const pos = positions[p.id];
        if (!pos) return null;
        const isFemale = p.gender === "female";
        const bgColor = isFemale ? "#8e44ad" : "#2c3e50";
        const birthYear = p.birth_date
          ? new Date(p.birth_date).getFullYear()
          : null;

        return (
          <g
            key={p.id}
            onClick={() => onPersonClick(p.id)}
            style={{ cursor: "pointer" }}>
            <rect
              x={pos.x}
              y={pos.y}
              width={NODE_W}
              height={NODE_H}
              rx={8}
              ry={8}
              fill={bgColor}
              stroke="white"
              strokeWidth={2}
            />
            <text
              x={pos.x + NODE_W / 2}
              y={pos.y + NODE_H / 2 - (birthYear ? 8 : 0)}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={13}
              fontWeight="600">
              {`${p.first_name} ${p.last_name || ""}`.trim()}
            </text>
            {birthYear && (
              <text
                x={pos.x + NODE_W / 2}
                y={pos.y + NODE_H / 2 + 12}
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

// ─── Main Tree Page ─────────────────────────────────────────────
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
      toast.error("Failed to load tree");
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

  const handleMouseDown = (e) => {
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setDragging(false);
  const handleWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  };

  const filteredPersons = persons.filter((p) =>
    `${p.first_name} ${p.last_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>🌳 My Family Tree</h2>
        <button onClick={() => setShowModal(true)} style={styles.btn}>
          + Add Person
        </button>
      </div>

      <input
        style={styles.search}
        placeholder="🔍 Search family members..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p style={styles.center}>Loading...</p>
      ) : persons.length === 0 ? (
        <div style={styles.empty}>
          <p style={{ fontSize: "3rem" }}>🌱</p>
          <p>No family members yet. Click "+ Add Person" to start.</p>
        </div>
      ) : (
        <>
          {/* Person Cards */}
          <div style={styles.grid}>
            {filteredPersons.map((p) => (
              <div
                key={p.id}
                style={styles.card}
                onClick={() => navigate(`/person/${p.id}`)}>
                <div
                  style={{
                    ...styles.avatar,
                    backgroundColor:
                      p.gender === "female" ? "#8e44ad" : "#2c3e50",
                  }}>
                  <span style={styles.initials}>
                    {p.first_name[0]}
                    {p.last_name ? p.last_name[0] : ""}
                  </span>
                </div>
                <p style={styles.name}>
                  {p.first_name} {p.last_name}
                </p>
                <p style={styles.meta}>
                  {p.gender || "Unknown"}
                  {p.birth_date
                    ? ` · ${new Date(p.birth_date).getFullYear()}`
                    : ""}
                </p>
              </div>
            ))}
          </div>

          {/* Custom SVG Tree */}
          <div style={styles.treeSection}>
            <h3 style={styles.treeTitle}>Family Tree View</h3>
            <p style={styles.treeHint}>
              Scroll to zoom · Drag to pan · Click a person to view profile ·{" "}
              <span style={{ color: "#e74c3c" }}>── spouse</span>
            </p>
            <div
              style={styles.treeBox}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}>
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "0 0",
                  width: "100%",
                  height: "100%",
                }}>
                <FamilyTreeSVG
                  persons={persons}
                  relationships={relationships}
                  onPersonClick={(id) => navigate(`/person/${id}`)}
                />
              </div>
            </div>
            <div style={styles.zoomControls}>
              <button
                onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                style={styles.zoomBtn}>
                +
              </button>
              <button onClick={() => setZoom(1)} style={styles.zoomBtn}>
                Reset
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}
                style={styles.zoomBtn}>
                −
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Add Family Member</h3>
            {[
              { key: "first_name", label: "First Name *", type: "text" },
              { key: "last_name", label: "Last Name", type: "text" },
              { key: "birth_date", label: "Birth Date", type: "date" },
              { key: "death_date", label: "Death Date", type: "date" },
            ].map(({ key, label, type }) => (
              <div key={key} style={styles.field}>
                <label style={styles.label}>{label}</label>
                <input
                  style={styles.input}
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div style={styles.field}>
              <label style={styles.label}>Gender</label>
              <select
                style={styles.input}
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Bio</label>
              <textarea
                style={{ ...styles.input, height: "70px", resize: "vertical" }}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            <div style={styles.modalButtons}>
              <button onClick={handleAddPerson} style={styles.btn}>
                Save
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={styles.btnCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
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
