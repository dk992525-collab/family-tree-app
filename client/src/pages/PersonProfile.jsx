import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "../api/axios";
import toast from "react-hot-toast";

const getSavedType = (type) => {
  if (["father", "mother"].includes(type)) return "parent";
  if (["husband", "wife"].includes(type)) return "spouse";
  if (["brother", "sister"].includes(type)) return "sibling";
  return null;
};

export default function PersonProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [relationships, setRelationships] = useState([]);
  const [persons, setPersons] = useState([]);
  const [editing, setEditing] = useState(false);
  const [showRelModal, setShowRelModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({});
  const [photoFile, setPhotoFile] = useState(null);
  const [relForm, setRelForm] = useState({
    person2_id: "",
    relationship_type: "father",
  });

  const fetchAll = async () => {
    try {
      const [personRes, relRes, personsRes] = await Promise.all([
        axios.get(`/persons/${id}`),
        axios.get(`/relationships/${id}`),
        axios.get("/persons"),
      ]);
      setPerson(personRes.data.data);
      setForm(personRes.data.data);
      setRelationships(relRes.data.data);
      setPersons(personsRes.data.data.filter((p) => p.id !== parseInt(id)));
    } catch (err) {
      toast.error("Failed to load person");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [id]);

  const handleUpdate = async () => {
    try {
      const formData = new FormData();
      Object.keys(form).forEach((key) => {
        if (form[key] !== null && form[key] !== undefined) {
          formData.append(key, form[key]);
        }
      });
      if (photoFile) formData.append("photo", photoFile);

      const res = await axios.put(`/persons/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPerson(res.data.data);
      setEditing(false);
      setPhotoFile(null);
      toast.success("Updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.error || "Update failed");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this person? This cannot be undone.")) return;
    try {
      await axios.delete(`/persons/${id}`);
      toast.success("Person deleted");
      navigate("/tree");
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const handleAddRelationship = async () => {
    if (!relForm.person2_id) {
      toast.error("Please select a person");
      return;
    }

    const isChild = ["son", "daughter"].includes(relForm.relationship_type);
    const savedType = isChild
      ? "parent"
      : getSavedType(relForm.relationship_type);

    if (!savedType) {
      toast.error("Invalid relationship type");
      return;
    }

    try {
      await axios.post("/relationships", {
        person1_id: isChild ? parseInt(relForm.person2_id) : parseInt(id),
        person2_id: isChild ? parseInt(id) : parseInt(relForm.person2_id),
        relationship_type: savedType,
      });
      toast.success("Relationship added");
      setShowRelModal(false);
      setRelForm({ person2_id: "", relationship_type: "father" });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to add relationship");
    }
  };

  const handleDeleteRelationship = async (relId) => {
    if (!window.confirm("Remove this relationship?")) return;
    try {
      await axios.delete(`/relationships/${relId}`);
      toast.success("Relationship removed");
      fetchAll();
    } catch (err) {
      toast.error("Failed to remove relationship");
    }
  };

  const getRelationshipLabel = (rel) => {
    const isP1 = rel.person1_id === parseInt(id);
    const type = rel.relationship_type;
    if (type === "spouse") return "💑 Spouse";
    if (type === "sibling") return "👫 Sibling";
    if (type === "parent") {
      return isP1 ? "👶 Child" : "👨‍👩‍👧 Parent";
    }
    return type;
  };

  if (loading) return <p style={styles.center}>Loading...</p>;
  if (!person) return <p style={styles.center}>Person not found</p>;

  const baseUrl =
    import.meta.env.VITE_API_URL?.replace("/api", "") ||
    "http://localhost:5000";

  return (
    <div style={styles.container}>
      <button onClick={() => navigate("/tree")} style={styles.back}>
        ← Back to Tree
      </button>

      <div style={styles.card}>
        <div style={styles.photoSection}>
          <div style={styles.avatar}>
            {person.photo_url ? (
              <img
                src={`${baseUrl}${person.photo_url}`}
                style={styles.photo}
                alt=""
              />
            ) : (
              <span style={styles.initials}>
                {person.first_name[0]}
                {person.last_name ? person.last_name[0] : ""}
              </span>
            )}
          </div>
          {editing && (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files[0])}
              style={{ marginTop: "0.5rem" }}
            />
          )}
        </div>

        {editing ? (
          <div style={styles.editForm}>
            {[
              { key: "first_name", label: "First Name", type: "text" },
              { key: "last_name", label: "Last Name", type: "text" },
              { key: "birth_date", label: "Birth Date", type: "date" },
              { key: "death_date", label: "Death Date", type: "date" },
            ].map(({ key, label, type }) => (
              <div key={key} style={styles.field}>
                <label style={styles.label}>{label}</label>
                <input
                  style={styles.input}
                  type={type}
                  value={
                    form[key]
                      ? type === "date"
                        ? form[key].split("T")[0]
                        : form[key]
                      : ""
                  }
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div style={styles.field}>
              <label style={styles.label}>Gender</label>
              <select
                style={styles.input}
                value={form.gender || "male"}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Bio</label>
              <textarea
                style={{ ...styles.input, height: "80px" }}
                value={form.bio || ""}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            <div style={styles.btnRow}>
              <button onClick={handleUpdate} style={styles.btn}>
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                style={styles.btnCancel}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.info}>
            <h2 style={styles.name}>
              {person.first_name} {person.last_name}
            </h2>
            <p style={styles.detail}>
              <strong>Gender:</strong> {person.gender || "Not specified"}
            </p>
            <p style={styles.detail}>
              <strong>Born:</strong>{" "}
              {person.birth_date
                ? new Date(person.birth_date).toLocaleDateString()
                : "Unknown"}
            </p>
            {person.death_date && (
              <p style={styles.detail}>
                <strong>Died:</strong>{" "}
                {new Date(person.death_date).toLocaleDateString()}
              </p>
            )}
            {person.bio && <p style={styles.bio}>{person.bio}</p>}
            <div style={styles.btnRow}>
              <button onClick={() => setEditing(true)} style={styles.btn}>
                Edit
              </button>
              <button onClick={handleDelete} style={styles.btnDelete}>
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Relationships */}
      <div style={styles.relSection}>
        <div style={styles.relHeader}>
          <h3 style={styles.relTitle}>Relationships</h3>
          <button onClick={() => setShowRelModal(true)} style={styles.btn}>
            + Add
          </button>
        </div>
        {relationships.length === 0 ? (
          <p style={styles.noRel}>No relationships added yet.</p>
        ) : (
          relationships.map((rel) => {
            const isP1 = rel.person1_id === parseInt(id);
            const relName = isP1
              ? `${rel.person2_first} ${rel.person2_last}`
              : `${rel.person1_first} ${rel.person1_last}`;
            const relatedId = isP1 ? rel.person2_id : rel.person1_id;
            return (
              <div key={rel.id} style={styles.relCard}>
                <div>
                  <span style={styles.relType}>
                    {getRelationshipLabel(rel)}
                  </span>
                  <span
                    style={styles.relName}
                    onClick={() => navigate(`/person/${relatedId}`)}>
                    {relName}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteRelationship(rel.id)}
                  style={styles.btnRemove}>
                  Remove
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Add Relationship Modal */}
      {showRelModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Add Relationship</h3>
            <div style={styles.field}>
              <label style={styles.label}>Relationship Type</label>
              <select
                style={styles.input}
                value={relForm.relationship_type}
                onChange={(e) =>
                  setRelForm({ ...relForm, relationship_type: e.target.value })
                }>
                <optgroup label="👨‍👩‍👧 Parents">
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                </optgroup>
                <optgroup label="💑 Spouse">
                  <option value="husband">Husband</option>
                  <option value="wife">Wife</option>
                </optgroup>
                <optgroup label="👫 Siblings">
                  <option value="brother">Brother</option>
                  <option value="sister">Sister</option>
                </optgroup>
                <optgroup label="👶 Children">
                  <option value="son">Son</option>
                  <option value="daughter">Daughter</option>
                </optgroup>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Person</label>
              <select
                style={styles.input}
                value={relForm.person2_id}
                onChange={(e) =>
                  setRelForm({ ...relForm, person2_id: e.target.value })
                }>
                <option value="">Select a person</option>
                {persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.btnRow}>
              <button onClick={handleAddRelationship} style={styles.btn}>
                Save
              </button>
              <button
                onClick={() => setShowRelModal(false)}
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
  center: { textAlign: "center", marginTop: "3rem" },
  back: {
    backgroundColor: "transparent",
    border: "none",
    color: "#2c3e50",
    cursor: "pointer",
    fontSize: "1rem",
    marginBottom: "1rem",
    padding: 0,
  },
  card: {
    backgroundColor: "white",
    borderRadius: "8px",
    padding: "2rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    marginBottom: "2rem",
    display: "flex",
    gap: "2rem",
    flexWrap: "wrap",
  },
  photoSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  avatar: {
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    backgroundColor: "#2c3e50",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: { color: "white", fontSize: "2rem", fontWeight: "bold" },
  photo: { width: "100%", height: "100%", objectFit: "cover" },
  info: { flex: 1 },
  editForm: { flex: 1 },
  name: { color: "#2c3e50", marginBottom: "1rem" },
  detail: { color: "#444", marginBottom: "0.4rem" },
  bio: { color: "#555", fontStyle: "italic", marginTop: "0.8rem" },
  btnRow: { display: "flex", gap: "1rem", marginTop: "1rem" },
  btn: {
    backgroundColor: "#2c3e50",
    color: "white",
    border: "none",
    padding: "0.6rem 1.4rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.95rem",
  },
  btnCancel: {
    backgroundColor: "#95a5a6",
    color: "white",
    border: "none",
    padding: "0.6rem 1.4rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.95rem",
  },
  btnDelete: {
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    padding: "0.6rem 1.4rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.95rem",
  },
  btnRemove: {
    backgroundColor: "transparent",
    color: "#e74c3c",
    border: "1px solid #e74c3c",
    padding: "0.3rem 0.8rem",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  field: { marginBottom: "0.8rem" },
  label: {
    display: "block",
    marginBottom: "0.3rem",
    color: "#444",
    fontSize: "0.9rem",
  },
  input: {
    width: "100%",
    padding: "0.6rem",
    borderRadius: "4px",
    border: "1px solid #ccc",
    fontSize: "1rem",
    boxSizing: "border-box",
  },
  relSection: {
    backgroundColor: "white",
    borderRadius: "8px",
    padding: "1.5rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  relHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  relTitle: { color: "#2c3e50", margin: 0 },
  noRel: { color: "#888" },
  relCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.8rem",
    borderRadius: "6px",
    backgroundColor: "#f8f9fa",
    marginBottom: "0.5rem",
  },
  relType: {
    backgroundColor: "#2c3e50",
    color: "white",
    padding: "0.2rem 0.6rem",
    borderRadius: "4px",
    fontSize: "0.8rem",
    marginRight: "0.8rem",
  },
  relName: {
    color: "#2c3e50",
    cursor: "pointer",
    fontWeight: "500",
    textDecoration: "underline",
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
    borderRadius: "8px",
    width: "100%",
    maxWidth: "400px",
  },
  modalTitle: { color: "#2c3e50", marginBottom: "1rem" },
};
