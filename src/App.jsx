import { useState, useEffect, useRef } from "react";

const COLORS = {
  primary: "#0F3D5C",
  primaryLight: "#1A5276",
  accent: "#00AEEF",
  accentDark: "#0090C8",
  success: "#27AE60",
  warning: "#E67E22",
  danger: "#E74C3C",
  bg: "#F0F4F8",
  card: "#FFFFFF",
  text: "#1A2B3C",
  muted: "#6B8CAE",
  border: "#D0DDE8",
};

const patients = [
  { id: "P-2024-001", nom: "MARTIN Bernard", ddn: "12/03/1958", ipp: "HCL-458721", service: "Cardiologie — 3B", heure: "08h30", statut: "alerte", alertes: ["Mutuelle manquante", "Pièce d'identité expirée"], amo: "CPAM Rhône", amc: null, preadmission: false, doublon: false },
  { id: "P-2024-002", nom: "DUPONT Jean", ddn: "12/03/1965", ipp: "HCL-221043", service: "Neurologie — 1G", heure: "09h00", statut: "doublon", alertes: ["Doublon détecté : DUPONT J. né 12/03/1965"], amo: "MSA", amc: "MGEN", preadmission: false, doublon: true, doublonRef: "HCL-221044" },
  { id: "P-2024-003", nom: "BERNARD Sophie", ddn: "28/11/1982", ipp: "HCL-334892", service: "Oncologie — 2A", heure: "09h30", statut: "ok", alertes: [], amo: "CPAM Ain", amc: "Harmonie Mutuelle", preadmission: true, doublon: false },
  { id: "P-2024-004", nom: "PETIT Marie", ddn: "04/07/1945", ipp: "HCL-112233", service: "Gériatrie — 4C", heure: "10h00", statut: "alerte", alertes: ["Bulletin de passage non édité depuis 45 min"], amo: "CARSAT", amc: "Malakoff Humanis", preadmission: true, doublon: false },
  { id: "P-2024-005", nom: "ROUSSEAU Thomas", ddn: "15/09/1991", ipp: "HCL-667788", service: "Chirurgie digestive — 2B", heure: "10h30", statut: "ok", alertes: [], amo: "CPAM Rhône", amc: "Alan", preadmission: true, doublon: false },
];

const kpis = { total: 23, incomplets: 4, doublons: 1, tempsMoyen: "3 min 42 sec", tauxPreAdmission: 78, alertesActives: 3 };
const chatHistory = [{ role: "system", content: "Agent PPA actif — données du jour chargées." }];

const MISTRAL_SYSTEM = `Tu es l'agent PPA (Parcours Patient Augmenté) du démonstrateur HCL. 
Tu assistes les gestionnaires du Bureau des Admissions de l'Hôpital Lyon Sud.
Tu as accès aux données fictives suivantes aujourd'hui :
- 23 patients en cours de traitement
- 4 dossiers incomplets (mutuelle manquante, pièce expirée, bulletin non édité)
- 1 doublon détecté (DUPONT Jean / DUPONT J., né 12/03/1965)
- Temps moyen de traitement : 3 min 42 sec
- Taux de préadmission : 78%
- 3 alertes actives
Réponds en français, de façon concise et professionnelle. Tu es un assistant, pas un remplaçant.
Toutes les données sont FICTIVES — ceci est un démonstrateur.`;

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [chatMessages, setChatMessages] = useState(chatHistory);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [resolvedAlerts, setResolvedAlerts] = useState([]);
  const [fusionStep, setFusionStep] = useState(null);
  const [showPatientList, setShowPatientList] = useState(true);
  const chatEndRef = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const alertPatients = patients.filter(p => p.alertes.length > 0 && !resolvedAlerts.includes(p.id));

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages = [...chatMessages, { role: "user", content: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const apiKey = process.env.REACT_APP_MISTRAL_KEY;
      if (!apiKey) throw new Error("Clé API manquante");
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "mistral-small-latest",
          max_tokens: 1000,
          messages: [
            { role: "system", content: MISTRAL_SYSTEM },
            ...newMessages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "Erreur de réponse.";
      setChatMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages([...newMessages, { role: "assistant", content: "Agent temporairement indisponible. Veuillez réessayer." }]);
    }
    setChatLoading(false);
  };

  const resolveAlert = (id) => setResolvedAlerts(r => [...r, id]);
  const getStatusColor = (statut) => ({ ok: COLORS.success, alerte: COLORS.warning, doublon: COLORS.danger }[statut] || COLORS.muted);
  const getStatusLabel = (statut) => ({ ok: "✓ Validé", alerte: "⚠ Alerte", doublon: "⊘ Doublon" }[statut] || statut);
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}h${String(now.getMinutes()).padStart(2, "0")}`;

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>

      {/* HEADER */}
      <div style={{ background: COLORS.primary, color: "#fff", padding: isMobile ? "10px 16px" : "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: isMobile ? 56 : 64, boxShadow: "0 2px 12px rgba(0,0,0,0.2)", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ background: COLORS.accent, borderRadius: 6, padding: "5px 9px", fontWeight: 800, fontSize: 12, letterSpacing: 1, flexShrink: 0 }}>PPA</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 16, letterSpacing: 0.5 }}>Parcours Patient Augmenté</div>
            {!isMobile && <div style={{ fontSize: 11, opacity: 0.7 }}>Démonstrateur — Bureau des Admissions • Hôpital Lyon Sud</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, background: "rgba(255,255,255,0.08)", borderRadius: 20, padding: "3px 10px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2ECC71", display: "inline-block", boxShadow: "0 0 6px #2ECC71" }} />
            Agent actif
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{timeStr}</div>
          {!isMobile && <div style={{ fontSize: 11, opacity: 0.55, borderLeft: "1px solid rgba(255,255,255,0.2)", paddingLeft: 16 }}>Données 100% fictives</div>}
        </div>
      </div>

      {/* NAV — scrollable sur mobile */}
      <div style={{ background: COLORS.primaryLight, display: "flex", gap: 0, paddingLeft: isMobile ? 8 : 32, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {[
          { id: "dashboard", label: "🗂 Dashboard", badge: kpis.alertesActives },
          { id: "bda", label: "🏥 Accueil BDA" },
          { id: "facturation", label: "📋 Facturation" },
          { id: "agent", label: "🤖 Agent IA" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedPatient(null); setShowPatientList(true); }}
            style={{
              background: activeTab === tab.id ? COLORS.bg : "transparent",
              color: activeTab === tab.id ? COLORS.primary : "rgba(255,255,255,0.8)",
              border: "none",
              padding: isMobile ? "10px 14px" : "12px 24px",
              fontSize: isMobile ? 12 : 13,
              fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: "pointer",
              borderRadius: activeTab === tab.id ? "4px 4px 0 0" : 0,
              marginTop: activeTab === tab.id ? 4 : 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {tab.label}
            {tab.badge > 0 && (
              <span style={{ background: COLORS.danger, color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENU */}
      <div style={{ padding: isMobile ? "16px 12px" : "28px 32px", maxWidth: 1400, margin: "0 auto" }}>

        {/* === DASHBOARD === */}
        {activeTab === "dashboard" && (
          <div>
            {/* KPIs — 2 colonnes sur mobile, 3 sur tablette, 6 sur desktop */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: isMobile ? 10 : 16, marginBottom: isMobile ? 16 : 28 }}>
              {[
                { label: "Patients du jour", value: kpis.total, color: COLORS.primary, icon: "👤" },
                { label: "Dossiers incomplets", value: kpis.incomplets, color: COLORS.warning, icon: "⚠" },
                { label: "Doublons détectés", value: kpis.doublons, color: COLORS.danger, icon: "⊘" },
                { label: "Temps moyen", value: kpis.tempsMoyen, color: COLORS.success, icon: "⏱", small: true },
                { label: "Taux préadmission", value: `${kpis.tauxPreAdmission}%`, color: COLORS.accent, icon: "📊" },
                { label: "Alertes actives", value: alertPatients.length, color: alertPatients.length > 0 ? COLORS.danger : COLORS.success, icon: "🔔" },
              ].map((kpi, i) => (
                <div key={i} style={{ background: COLORS.card, borderRadius: 10, padding: isMobile ? "14px 12px" : "20px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderTop: `4px solid ${kpi.color}` }}>
                  <div style={{ fontSize: isMobile ? 18 : 22, marginBottom: 6 }}>{kpi.icon}</div>
                  <div style={{ fontSize: kpi.small ? (isMobile ? 14 : 18) : (isMobile ? 22 : 28), fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                  <div style={{ fontSize: isMobile ? 10 : 11, color: COLORS.muted, marginTop: 4 }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Barre progression */}
            <div style={{ background: COLORS.card, borderRadius: 12, padding: isMobile ? 14 : 20, marginBottom: isMobile ? 16 : 28, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: isMobile ? 12 : 14 }}>Taux de préadmission — Objectif HCL : 85%</span>
                <span style={{ fontWeight: 800, color: COLORS.accent }}>{kpis.tauxPreAdmission}%</span>
              </div>
              <div style={{ background: COLORS.border, borderRadius: 8, height: 12, overflow: "hidden" }}>
                <div style={{ width: `${kpis.tauxPreAdmission}%`, background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentDark})`, height: "100%", borderRadius: 8 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: COLORS.muted }}>
                <span>0%</span>
                <span style={{ color: COLORS.warning }}>▲ Objectif 85%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Alertes */}
            <div style={{ background: COLORS.card, borderRadius: 12, padding: isMobile ? 14 : 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 15, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                🔔 Alertes actives
                <span style={{ background: alertPatients.length > 0 ? COLORS.danger : COLORS.success, color: "#fff", borderRadius: 10, padding: "2px 10px", fontSize: 12 }}>{alertPatients.length}</span>
              </div>
              {alertPatients.length === 0 && (
                <div style={{ textAlign: "center", padding: 32, color: COLORS.success, fontSize: 14 }}>✓ Aucune alerte active</div>
              )}
              {alertPatients.map(p => (
                <div key={p.id} style={{ padding: isMobile ? "12px" : "14px 16px", borderRadius: 8, marginBottom: 8, background: p.statut === "doublon" ? "#FFF5F5" : "#FFFBF0", border: `1px solid ${p.statut === "doublon" ? "#FFD0D0" : "#FFE8B0"}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{p.statut === "doublon" ? "⊘" : "⚠"}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nom}</div>
                        <div style={{ fontSize: 11, color: COLORS.muted }}>{p.service} — {p.heure}</div>
                        {p.alertes.map((a, i) => (
                          <div key={i} style={{ fontSize: 11, color: p.statut === "doublon" ? COLORS.danger : COLORS.warning, marginTop: 2 }}>→ {a}</div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button onClick={() => { setSelectedPatient(p); setActiveTab("bda"); setShowPatientList(false); }} style={{ background: COLORS.primary, color: "#fff", border: "none", borderRadius: 6, padding: isMobile ? "5px 10px" : "6px 14px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Traiter</button>
                      <button onClick={() => resolveAlert(p.id)} style={{ background: COLORS.border, color: COLORS.text, border: "none", borderRadius: 6, padding: isMobile ? "5px 10px" : "6px 14px", fontSize: 11, cursor: "pointer" }}>Ignorer</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === BDA === */}
        {activeTab === "bda" && (
          <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: "340px 1fr", gap: 20 }}>

            {/* Sur mobile : toggle liste / détail */}
            {isMobile && selectedPatient && (
              <button onClick={() => { setSelectedPatient(null); setShowPatientList(true); }} style={{ background: COLORS.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                ← Retour à la liste
              </button>
            )}

            {/* Liste patients — cachée sur mobile si patient sélectionné */}
            {(!isMobile || !selectedPatient) && (
              <div style={{ background: COLORS.card, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: isMobile ? 16 : 0 }}>
                <div style={{ background: COLORS.primary, color: "#fff", padding: "14px 18px", fontWeight: 700, fontSize: 14 }}>
                  File d'attente — {patients.length} patients
                </div>
                {patients.map(p => (
                  <div
                    key={p.id}
                    onClick={() => { setSelectedPatient(p); setFusionStep(null); }}
                    style={{ padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}`, cursor: "pointer", background: selectedPatient?.id === p.id ? "#EBF5FB" : "#fff", borderLeft: selectedPatient?.id === p.id ? `4px solid ${COLORS.accent}` : "4px solid transparent" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{p.nom}</div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: getStatusColor(resolvedAlerts.includes(p.id) ? "ok" : p.statut), borderRadius: 10, padding: "2px 8px" }}>
                        {getStatusLabel(resolvedAlerts.includes(p.id) ? "ok" : p.statut)}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 3 }}>{p.service} — {p.heure}</div>
                    {p.alertes.length > 0 && !resolvedAlerts.includes(p.id) && (
                      <div style={{ fontSize: 11, color: COLORS.warning, marginTop: 4 }}>⚠ {p.alertes.length} alerte(s)</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Détail patient */}
            {(!isMobile || selectedPatient) && (
              <div>
                {!selectedPatient ? (
                  <div style={{ background: COLORS.card, borderRadius: 12, padding: 48, textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
                    <div style={{ color: COLORS.muted, fontSize: 14 }}>Sélectionnez un patient dans la liste</div>
                  </div>
                ) : (
                  <div style={{ background: COLORS.card, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
                    <div style={{ background: COLORS.primary, color: "#fff", padding: isMobile ? "16px" : "20px 24px", display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", flexDirection: isMobile ? "column" : "row", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: isMobile ? 17 : 20 }}>{selectedPatient.nom}</div>
                        <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>DDN : {selectedPatient.ddn} — IPP : {selectedPatient.ipp}</div>
                      </div>
                      <div style={{ textAlign: isMobile ? "left" : "right" }}>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>Service</div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{selectedPatient.service}</div>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>{selectedPatient.heure}</div>
                      </div>
                    </div>
                    <div style={{ padding: isMobile ? 14 : 24 }}>
                      {selectedPatient.alertes.length > 0 && !resolvedAlerts.includes(selectedPatient.id) && (
                        <div style={{ background: selectedPatient.doublon ? "#FFF5F5" : "#FFFBF0", border: `2px solid ${selectedPatient.doublon ? COLORS.danger : COLORS.warning}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: selectedPatient.doublon ? COLORS.danger : COLORS.warning, marginBottom: 8 }}>
                            {selectedPatient.doublon ? "⊘ DOUBLON DÉTECTÉ — Action requise" : "⚠ ALERTES ACTIVES"}
                          </div>
                          {selectedPatient.alertes.map((a, i) => (
                            <div key={i} style={{ fontSize: 13, color: COLORS.text, marginBottom: 4 }}>• {a}</div>
                          ))}
                          {selectedPatient.doublon && (
                            <div style={{ marginTop: 16 }}>
                              {!fusionStep && (
                                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                  <button onClick={() => setFusionStep("confirm")} style={{ background: COLORS.danger, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>Fusionner les dossiers</button>
                                  <button onClick={() => setFusionStep("nouveau")} style={{ background: COLORS.primary, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Créer nouveau dossier</button>
                                </div>
                              )}
                              {fusionStep === "confirm" && (
                                <div style={{ background: "#FFF0F0", border: `1px solid ${COLORS.danger}`, borderRadius: 8, padding: 14, marginTop: 10 }}>
                                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Confirmer la fusion ?</div>
                                  <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12 }}>IPP {selectedPatient.ipp} sera fusionné avec {selectedPatient.doublonRef}. Cette action sera journalisée.</div>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button onClick={() => { setFusionStep("done"); resolveAlert(selectedPatient.id); }} style={{ background: COLORS.success, color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>✓ Confirmer</button>
                                    <button onClick={() => setFusionStep(null)} style={{ background: COLORS.border, border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>Annuler</button>
                                  </div>
                                </div>
                              )}
                              {fusionStep === "done" && (
                                <div style={{ background: "#F0FFF4", border: `1px solid ${COLORS.success}`, borderRadius: 8, padding: 12, marginTop: 10, fontSize: 13, color: COLORS.success, fontWeight: 700 }}>
                                  ✓ Fusion effectuée — 22 secondes. Action journalisée.
                                </div>
                              )}
                            </div>
                          )}
                          {!selectedPatient.doublon && (
                            <button onClick={() => resolveAlert(selectedPatient.id)} style={{ marginTop: 12, background: COLORS.success, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>✓ Marquer comme traité</button>
                          )}
                        </div>
                      )}
                      {resolvedAlerts.includes(selectedPatient.id) && (
                        <div style={{ background: "#F0FFF4", border: `1px solid ${COLORS.success}`, borderRadius: 10, padding: 12, marginBottom: 20, fontSize: 13, color: COLORS.success, fontWeight: 700 }}>
                          ✓ Dossier validé — Aucune alerte active
                        </div>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                        {[
                          { label: "Couverture AMO", value: selectedPatient.amo, status: "ok", statusLabel: "✓ Validée" },
                          { label: "Couverture AMC", value: selectedPatient.amc || "Non renseignée", status: selectedPatient.amc ? "ok" : "warning", statusLabel: selectedPatient.amc ? "✓ Validée" : "⚠ À compléter" },
                          { label: "Préadmission", value: selectedPatient.preadmission ? "Effectuée" : "Non effectuée", status: selectedPatient.preadmission ? "ok" : "warning", statusLabel: selectedPatient.preadmission ? "✓" : "✗" },
                          { label: "Identitovigilance", value: selectedPatient.doublon ? "Doublon" : "Validée", status: selectedPatient.doublon ? "danger" : "ok", statusLabel: selectedPatient.doublon ? "⊘ Doublon" : "✓ Validée" },
                        ].map((item, i) => (
                          <div key={i} style={{ background: COLORS.bg, borderRadius: 10, padding: 14 }}>
                            <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>{item.label}</div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{item.value}</div>
                            <div style={{ fontSize: 12, color: item.status === "ok" ? COLORS.success : item.status === "danger" ? COLORS.danger : COLORS.warning, marginTop: 4 }}>{item.statusLabel}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 16, background: COLORS.bg, borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Journal d'audit</div>
                        {[
                          { time: "08h12", action: "Dossier créé — préadmission en ligne", agent: "MyHCL" },
                          { time: "08h14", action: "Identitovigilance vérifiée", agent: "Agent PPA" },
                          { time: "08h15", action: selectedPatient.doublon ? "Doublon détecté — action requise" : "Dossier validé AMO/AMC", agent: "Agent PPA" },
                        ].map((log, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 11, flexWrap: "wrap" }}>
                            <span style={{ color: COLORS.muted, minWidth: 40 }}>{log.time}</span>
                            <span style={{ color: COLORS.text, flex: 1 }}>{log.action}</span>
                            <span style={{ color: COLORS.accent }}>{log.agent}</span>
                          </div>
                        ))}
                        {resolvedAlerts.includes(selectedPatient.id) && (
                          <div style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 11, flexWrap: "wrap" }}>
                            <span style={{ color: COLORS.muted, minWidth: 40 }}>{timeStr}</span>
                            <span style={{ color: COLORS.success, flex: 1 }}>Alerte résolue par le gestionnaire</span>
                            <span style={{ color: COLORS.accent }}>Gestionnaire</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* === FACTURATION === */}
        {activeTab === "facturation" && (
          <div>
            <div style={{ background: COLORS.card, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 16 }}>
              <div style={{ background: COLORS.primary, color: "#fff", padding: "14px 16px", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                <span>Suivi facturation — {timeStr}</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>Relances automatiques actives</span>
              </div>
              <div style={{ padding: isMobile ? 12 : 20 }}>
                {[
                  { id: "F-2024-001", patient: "PETIT Marie", service: "Gériatrie 4C", montant: "245,00 €", statut: "bulletin_manquant", delai: "45 min" },
                  { id: "F-2024-002", patient: "MARTIN Bernard", service: "Cardiologie 3B", montant: "312,00 €", statut: "amc_manquante" },
                  { id: "F-2024-003", patient: "BERNARD Sophie", service: "Oncologie 2A", montant: "1 240,00 €", statut: "ok" },
                  { id: "F-2024-004", patient: "ROUSSEAU Thomas", service: "Chirurgie digestive 2B", montant: "890,00 €", statut: "ok" },
                ].map((f, i) => (
                  <div key={i} style={{ padding: "12px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{f.patient}</div>
                        <div style={{ fontSize: 11, color: COLORS.muted }}>{f.id} · {f.service}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{f.montant}</div>
                        {f.statut === "ok" && <div style={{ color: COLORS.success, fontSize: 11, fontWeight: 700 }}>✓ Complet</div>}
                        {f.statut === "bulletin_manquant" && <div style={{ color: COLORS.warning, fontSize: 11, fontWeight: 700 }}>⚠ Bulletin ({f.delai})</div>}
                        {f.statut === "amc_manquante" && <div style={{ color: COLORS.warning, fontSize: 11, fontWeight: 700 }}>⚠ AMC manquante</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: "#FFFBF0", border: `2px solid ${COLORS.warning}`, borderRadius: 12, padding: isMobile ? 14 : 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.warning, marginBottom: 8 }}>⚠ Relance automatique — Bulletin non édité</div>
              <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>
                L'agent a détecté que le bulletin de <strong>PETIT Marie</strong> n'a pas été édité depuis <strong>45 min</strong>.
                Relance envoyée à <strong>09h45</strong>. Escalade cadre si pas d'action avant <strong>10h15</strong>.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <button style={{ background: COLORS.success, color: "#fff", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>✓ Bulletin édité</button>
                <button style={{ background: COLORS.border, border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Escalader au cadre</button>
              </div>
            </div>
          </div>
        )}

        {/* === AGENT IA === */}
        {activeTab === "agent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Chat */}
            <div style={{ background: COLORS.card, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", height: isMobile ? 420 : 500 }}>
              <div style={{ background: COLORS.primary, color: "#fff", padding: "12px 16px", borderRadius: "12px 12px 0 0", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2ECC71", boxShadow: "0 0 6px #2ECC71", display: "inline-block" }} />
                Agent PPA — Assistant gestionnaire
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {chatMessages.filter(m => m.role !== "system").map((m, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "85%", padding: "10px 13px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? COLORS.primary : COLORS.bg, color: m.role === "user" ? "#fff" : COLORS.text, fontSize: 13, lineHeight: 1.5, border: m.role === "assistant" ? `1px solid ${COLORS.border}` : "none" }}>
                      {m.role === "assistant" && <div style={{ fontSize: 10, color: COLORS.accent, fontWeight: 700, marginBottom: 4 }}>Agent PPA</div>}
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ display: "flex", gap: 5, padding: "10px 13px", background: COLORS.bg, borderRadius: 12, width: "fit-content" }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.accent, animation: `bounce 1s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: 12, borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 8 }}>
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendChat()} placeholder="Posez une question..." style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13, outline: "none" }} />
                <button onClick={handleSendChat} disabled={chatLoading} style={{ background: COLORS.primary, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700, opacity: chatLoading ? 0.6 : 1 }}>→</button>
              </div>
            </div>

            {/* Questions suggérées — horizontales sur mobile */}
            <div style={{ background: COLORS.card, borderRadius: 12, padding: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Questions suggérées</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  "Combien de dossiers incomplets ce matin ?",
                  "Quels patients ont une alerte active ?",
                  "Quel est le taux de préadmission ?",
                  "Y a-t-il des doublons détectés ?",
                  "Quel est le temps moyen de traitement ?",
                  "Quels rejets AMO sont probables ?",
                ].map((q, i) => (
                  <button key={i} onClick={() => setChatInput(q)} style={{ padding: "7px 12px", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 20, fontSize: 11, cursor: "pointer", color: COLORS.text }}>
                    {q}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 14, padding: 12, background: "#F0FFF4", borderRadius: 8, border: `1px solid ${COLORS.success}`, fontSize: 11, color: COLORS.muted }}>
                <div style={{ fontWeight: 700, color: COLORS.success, marginBottom: 3 }}>IA française — Mistral</div>
                Modèle souverain, sans transfert de données hors UE. Données fictives.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ textAlign: "center", padding: "16px", fontSize: 10, color: COLORS.muted, borderTop: `1px solid ${COLORS.border}`, marginTop: 24 }}>
        Parcours Patient Augmenté — Démonstrateur fonctionnel • Données 100% fictives • Non connecté aux systèmes HCL
        <br />
        Développé par Olivier Scafi • Orchestration multi-IA : Claude (Anthropic) · Mistral · Copilot · ChatGPT · Meta AI · MiniMax · Deepseek
      </div>

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
