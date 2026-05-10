import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Tree from "react-d3-tree";
import axios from "../api/axios";
import toast from "react-hot-toast";

// Build proper hierarchy from persons + relationships
function buildHierarchy(persons, relationships) {
  if (persons.length === 0) return null;

  const personMap = {};
  persons.forEach((p) => {
    personMap[p.id] = { ...p, childIds: [], spouseIds: [], isChild: false };
  });

  relationships.forEach((rel) => {
    if (rel.relationship_type === "parent") {
      // person1 is parent, person2 is child
      const parent = personMap[rel.person1_id];
      const child = personMap[rel.person2_id];
      if (parent && child) {
        if (!parent.childIds.includes(rel.person2_id)) {
          parent.childIds.push(rel.person2_id);
        }
        child.isChild = true;
      }
    }
    if (rel.relationship_type === "spouse") {
      const p1 = personMap[rel.person1_id];
      const p2 = personMap[rel.person2_id];
      if (p1 && p2) {
        if (!p1.spouseIds.includes(rel.person2_id))
          p1.spouseIds.push(rel.person2_id);
        if (!p2.spouseIds.includes(rel.person1_id))
          p2.spouseIds.push(rel.person1_id);
      }
    }
  });

  // Root = person who is not a child of anyone
  const roots = persons.filter((p) => !personMap[p.id].isChild);
  const root = roots.length > 0 ? roots[0] : persons[0];

  function buildNode(personId, visited = new Set()) {
    if (visited.has(personId)) return null;
    visited.add(personId);

    const person = personMap[personId];
    if (!person) return null;

    const birthYear = person.birth_date
      ? new Date(person.birth_date).getFullYear()
      : null;
    const deathYear = person.death_date
      ? new Date(person.death_date).getFullYear()
      : null;
    const dates = birthYear
      ? deathYear
        ? `${birthYear}—${deathYear}`
        : `b.${birthYear}`
      : "";

    const node = {
      name: `${person.first_name} ${person.last_name || ""}`.trim(),
      attributes: { ...(dates && { dates }) },
      personId: person.id,
      gender: person.gender,
      children: [],
    };

    // Add spouses as child nodes at same visual level
    person.spouseIds.forEach((spouseId) => {
      if (!visited.has(spouseId)) {
        visited.add(spouseId);
        const spouse = personMap[spouseId];
        if (!spouse) return;

        const sBirth = spouse.birth_date
          ? new Date(spouse.birth_date).getFullYear()
          : null;
        const sDeath = spouse.death_date
          ? new Date(spouse.death_date).getFullYear()
          : null;
        const sDates = sBirth
          ? sDeath
            ? `${sBirth}—${sDeath}`
            : `b.${sBirth}`
          : "";

        const spouseNode = {
          name: `${spouse.first_name} ${spouse.last_name || ""}`.trim(),
          attributes: { ...(sDates && { dates: sDates }), role: "♥ Spouse" },
          personId: spouse.id,
          gender: spouse.gender,
          children: [],
        };

        // Spouse's children
        // Spouse's children - only add children not already in current person's children
        spouse.childIds.forEach((cId) => {
          if (!person.childIds.includes(cId)) {
            const childNode = buildNode(cId, new Set(visited));
            if (childNode) spouseNode.children.push(childNode);
          }
        });

        node.children.push(spouseNode);
      }
    });

    // Current person's children
    person.childIds.forEach((cId) => {
      if (!visited.has(cId)) {
        const childNode = buildNode(cId, new Set(visited));
        if (childNode) node.children.push(childNode);
      }
    });

    return node;
  }

  return buildNode(root.id);
}

// Custom node renderer
function renderCustomNode({ nodeDatum, onNodeClick }) {
  const isFemale = nodeDatum.gender === "female";
  const bgColor = isFemale ? "#8e44ad" : "#2c3e50";
  const isSpouse = nodeDatum.attributes?.role?.includes("Spouse");

  return (
    <g onClick={() => onNodeClick(nodeDatum)} style={{ cursor: "pointer" }}>
      {/* Node circle */}
      <circle
        r={28}
        fill={isSpouse ? "#c0392b" : bgColor}
        stroke="white"
        strokeWidth={3}
      />

      {/* Initials */}
      <text
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fontWeight="bold">
        {nodeDatum.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </text>

      {/* Name below node */}
      <text
        fill="#2c3e50"
        textAnchor="middle"
        y={42}
        fontSize={12}
        fontWeight="600">
        {nodeDatum.name}
      </text>

      {/* Dates */}
      {nodeDatum.attributes?.dates && (
        <text fill="#888" textAnchor="middle" y={57} fontSize={10}>
          {nodeDatum.attributes.dates}
        </text>
      )}

      {/* Spouse label */}
      {isSpouse && (
        <text fill="#c0392b" textAnchor="middle" y={70} fontSize={10}>
          ♥ spouse
        </text>
      )}
    </g>
  );
}

export default function TreePage() {
  const [persons, setPersons] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [treeData, setTreeData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
      const [personsRes, relsRes] = await Promise.all([
        axios.get("/persons"),
        // axios.get("/relationships/all").catch(() => ({ data: { data: [] } })),
      ]);

      const allPersons = personsRes.data.data;
      setPersons(allPersons);

      // Fetch relationships for each person
      const relPromises = allPersons.map((p) =>
        axios.get(`/relationships/${p.id}`).then((r) => r.data.data),
      );
      const allRels = await Promise.all(relPromises);
      const flatRels = allRels.flat();

      // Deduplicate by id
      const uniqueRels = Array.from(
        new Map(flatRels.map((r) => [r.id, r])).values(),
      );
      setRelationships(uniqueRels);
      console.log("relationships:", uniqueRels);
      const tree = buildHierarchy(allPersons, uniqueRels);
      setTreeData(tree);
    } catch (err) {
      toast.error("Failed to load tree");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPerson = async () => {
    if (!form.first_name) {
      toast.error("First name is required");
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
      toast.error(err.response?.data?.error || "Failed to add person");
    }
  };

  const filteredPersons = persons.filter((p) =>
    `${p.first_name} ${p.last_name || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>🌳 My Family Tree</h2>
        <button onClick={() => setShowModal(true)} style={styles.btn}>
          + Add Person
        </button>
      </div>

      {/* Search */}
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
          <p>No family members yet.</p>
          <p>Click "+ Add Person" to start building your tree.</p>
        </div>
      ) : (
        <>
          {/* Person Cards Grid */}
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
                  {p.photo_url ? (
                    <img
                      src={`http://localhost:5000${p.photo_url}`}
                      style={styles.photo}
                      alt=""
                    />
                  ) : (
                    <span style={styles.initials}>
                      {p.first_name[0]}
                      {p.last_name ? p.last_name[0] : ""}
                    </span>
                  )}
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

          {/* Tree Visualization */}
          {treeData && (
            <div style={styles.treeSection}>
              <h3 style={styles.treeTitle}>Family Tree View</h3>
              <p style={styles.treeHint}>
                Scroll to zoom · Drag to pan · Click a person to view profile
              </p>
              <div style={styles.treeBox}>
                <Tree
                  data={treeData}
                  orientation="horizontal"
                  translate={{ x: 80, y: 300 }}
                  nodeSize={{ x: 220, y: 140 }}
                  separation={{ siblings: 1.2, nonSiblings: 1.8 }}
                  renderCustomNodeElement={(rd3tProps) =>
                    renderCustomNode({
                      ...rd3tProps,
                      onNodeClick: (nodeDatum) =>
                        navigate(`/person/${nodeDatum.personId}`),
                    })
                  }
                  pathFunc="step"
                  zoom={0.8}
                  scaleExtent={{ min: 0.3, max: 2 }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Person Modal */}
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
    transition: "transform 0.15s",
    ":hover": { transform: "translateY(-2px)" },
  },
  avatar: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    margin: "0 auto 0.6rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: { color: "white", fontSize: "1.3rem", fontWeight: "bold" },
  photo: { width: "100%", height: "100%", objectFit: "cover" },
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
  treeHint: { color: "#999", fontSize: "0.85rem", marginBottom: "1rem" },
  treeBox: {
    backgroundColor: "white",
    borderRadius: "12px",
    height: "600px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
    overflow: "hidden",
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
  modalTitle: { color: "#2c3e50", marginBottom: "1.2rem", fontSize: "1.2rem" },
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
