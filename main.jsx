import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, firebaseReady, googleLogin, googleLogout } from "./firebase";
import "./style.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}

const DEFAULT_PET = "/gato-pixel.png";
const DEFAULT_STATE = { name: "Mimo", image: DEFAULT_PET, hunger: 24, energy: 82, happiness: 76, xp: 15, coins: 20, lastVisit: Date.now() };
const OFFLINE_REPLIES = [
  { keys: ["hola", "hey", "buenas"], answer: "¡Miau, hola! 🐾 ¿Qué hacemos hoy?" },
  { keys: ["tarea", "deber", "matemática", "matematicas"], answer: "¡Te ayudo! 📚 Sin internet puedo darte consejos básicos. Para resolver una tarea paso a paso, vuelve a conectarte." },
  { keys: ["triste", "problema", "mal", "preocup"], answer: "Siento que estés pasando por eso. 💚 Puedes respirar despacio, escribir lo que sientes y hablar con alguien de confianza. Si quieres, cuéntame más cuando vuelva internet." },
  { keys: ["jugar", "juego"], answer: "¡Vamos a jugar! 🎮 Abre la pestaña Juegos y elige uno." },
  { keys: ["gracias"], answer: "¡De nada! Siempre estoy aquí para acompañarte. 🐱" }
];
function offlineAnswer(text) {
  const found = OFFLINE_REPLIES.find(item => item.keys.some(key => text.toLowerCase().includes(key)));
  return found?.answer || "Ahora estoy en modo sin internet. 🐾 Puedo acompañarte, jugar y responder algunas cosas básicas. Para una respuesta más completa, conéctate a internet.";
}
function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("pet");
  const [pet, setPet] = useState(() => JSON.parse(localStorage.getItem("mimo-pet") || "null") || DEFAULT_STATE);
  const [chats, setChats] = useState(() => JSON.parse(localStorage.getItem("mimo-chats") || "[]"));
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [gameScore, setGameScore] = useState(0);
  const online = typeof navigator !== "undefined" && navigator.onLine;
  const [isOnline, setIsOnline] = useState(online);
  const level = Math.floor(pet.xp / 100) + 1;

  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => {
    localStorage.setItem("mimo-pet", JSON.stringify(pet));
    localStorage.setItem("mimo-chats", JSON.stringify(chats));
  }, [pet, chats]);
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, async current => {
      setUser(current);
      if (current && db) {
        try {
          const snap = await getDoc(doc(db, "users", current.uid));
          if (snap.exists()) {
            const saved = snap.data();
            if (saved.pet) setPet(saved.pet);
            if (saved.chats) setChats(saved.chats);
          }
        } catch (e) { setNotice("No pude cargar tus datos en la nube. Revisa tu conexión y permisos."); }
      }
    });
  }, []);
  async function saveCloud(nextPet = pet, nextChats = chats) {
    if (!user || !db) return;
    try { await setDoc(doc(db, "users", user.uid), { pet: nextPet, chats: nextChats, updatedAt: Date.now() }, { merge: true }); }
    catch { setNotice("No se pudo sincronizar. Tus datos siguen guardados en este dispositivo."); }
  }
  function updatePet(patch) {
    setPet(prev => {
      const next = { ...prev, ...patch };
      if (user) setTimeout(() => saveCloud(next, chats), 0);
      return next;
    });
  }
  async function sendMessage(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const userMsg = { role: "user", content: text, time: Date.now() };
    const next = [...chats, userMsg];
    setChats(next); setDraft(""); setBusy(true);
    let answer;
    if (navigator.onLine) {
      try {
        const response = await fetch("/api/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history: next.slice(-12).map(m => ({ role: m.role, content: m.content })) })
        });
        if (!response.ok) throw new Error("AI backend unavailable");
        const data = await response.json();
        answer = data.reply;
      } catch {
        answer = "No pude conectar con la IA ahora mismo. Puedes seguir usando las funciones básicas o revisar la configuración del servidor.";
      }
    } else answer = offlineAnswer(text);
    const finalChats = [...next, { role: "assistant", content: answer, time: Date.now() }];
    setChats(finalChats); setBusy(false);
    updatePet({ happiness: Math.min(100, pet.happiness + 3), xp: pet.xp + 2 });
    await saveCloud(pet, finalChats);
  }
  async function login() {
    try { await googleLogin(); setNotice("Sesión iniciada."); }
    catch (e) { setNotice(e.message || "No se pudo iniciar sesión."); }
  }
  async function changeImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setNotice("Elige un archivo de imagen."); return; }
    if (file.size > 2 * 1024 * 1024) { setNotice("La imagen debe pesar menos de 2 MB."); return; }
    // Local data URL works offline. For cloud sync, use Firebase Storage in the next production step.
    const reader = new FileReader();
    reader.onload = () => {
      updatePet({ image: reader.result });
      setNotice("¡Nueva mascota guardada en este dispositivo! Para sincronizar imágenes entre dispositivos, configura Firebase Storage.");
    };
    reader.readAsDataURL(file);
  }
  function care(action) {
    let patch = {};
    if (action === "feed") { patch = { hunger: Math.max(0, pet.hunger - 28), happiness: Math.min(100, pet.happiness + 4), xp: pet.xp + 5 }; setNotice("¡Ñam! Tu mascota ha comido. 🍎"); }
    if (action === "play") { patch = { hunger: Math.min(100, pet.hunger + 8), energy: Math.max(0, pet.energy - 12), happiness: Math.min(100, pet.happiness + 12), xp: pet.xp + 10, coins: pet.coins + 2 }; setNotice("¡Qué divertido! Ganaste 2 monedas."); }
    if (action === "sleep") { patch = { energy: Math.min(100, pet.energy + 30), hunger: Math.min(100, pet.hunger + 5) }; setNotice("Zzz... Mimo recuperó energía."); }
    updatePet(patch);
  }
  function playMemory() {
    const won = Math.random() > 0.35;
    if (won) { setGameScore(s => s + 1); updatePet({ xp: pet.xp + 12, coins: pet.coins + 5, happiness: Math.min(100, pet.happiness + 8), energy: Math.max(0, pet.energy - 8) }); setNotice("¡Ganaste! +12 XP y +5 monedas 🎉"); }
    else setNotice("¡Casi! Inténtalo otra vez. 🐾");
  }
  const recent = useMemo(() => chats.slice(-3).reverse(), [chats]);
  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-icon">🐾</div><div><strong>Pet Assistant</strong><small>Tu Tamagotchi inteligente</small></div></div>
      <div className={`connection ${isOnline ? "online" : "offline"}`}><span/> {isOnline ? "Con internet" : "Sin internet"}</div>
    </header>
    {notice && <button className="notice" onClick={() => setNotice("")}>{notice} <span>×</span></button>}
    <main>
      {tab === "pet" && <section className="panel pet-panel">
        <div className="section-heading"><div><p className="eyebrow">TU COMPAÑERO</p><h1>Hola, {user?.displayName?.split(" ")[0] || "amigo"} 👋</h1></div><div className="level">NIVEL {level}</div></div>
        <div className="pet-stage">
          <div className="sparkle sparkle-one">✦</div><div className="sparkle sparkle-two">✧</div>
          <img src={pet.image || DEFAULT_PET} alt="Tu mascota pixel art" className="pet-image"/>
          <div className="speech">{pet.energy < 25 ? "Tengo sueño... 💤" : pet.hunger > 70 ? "Tengo hambre 🥺" : "¡Qué bueno verte! ♡"}</div>
        </div>
        <div className="pet-name-row"><div><h2>{pet.name}</h2><p>Tu pequeña compañera digital</p></div><label className="upload-button">Cambiar imagen<input type="file" accept="image/*" onChange={changeImage} hidden/></label></div>
        <div className="xp-row"><span>Experiencia</span><b>{pet.xp % 100}/100 XP</b></div><div className="progress"><div style={{width:`${pet.xp % 100}%`}}/></div>
        <div className="stats">
          <Stat icon="🍎" label="Hambre" value={pet.hunger} inverse/>
          <Stat icon="⚡" label="Energía" value={pet.energy}/>
          <Stat icon="💚" label="Felicidad" value={pet.happiness}/>
        </div>
        <div className="care-actions">
          <button onClick={() => care("feed")}><span>🍎</span>Alimentar</button><button onClick={() => care("play")}><span>🧶</span>Jugar</button><button onClick={() => care("sleep")}><span>🌙</span>Dormir</button>
        </div>
        <div className="coin-row"><span>🪙 {pet.coins} monedas</span><span>💬 {chats.length} mensajes</span></div>
      </section>}
      {tab === "chat" && <section className="panel chat-panel">
        <div className="section-heading"><div><p className="eyebrow">HABLEMOS</p><h1>Chat con Mimo</h1></div><span className="online-pill">{isOnline ? "IA online" : "Modo básico"}</span></div>
        <p className="muted">Puedes preguntarme sobre tareas, información o contarme lo que te preocupa.</p>
        <div className="chat-history" aria-live="polite">
          {chats.length === 0 && <div className="empty-chat"><div>🐈‍⬛</div><h3>¡Empecemos a conversar!</h3><p>Escribe tu primera pregunta abajo.</p><div className="suggestions"><button onClick={() => setDraft("Ayúdame con una tarea de matemáticas")}>📚 Ayuda con tareas</button><button onClick={() => setDraft("Necesito un consejo para un problema personal")}>💚 Un consejo</button></div></div>}
          {chats.map((m, i) => <div className={`message ${m.role === "user" ? "mine" : "theirs"}`} key={i}><div className="message-avatar">{m.role === "user" ? "🙂" : "🐈‍⬛"}</div><div className="message-content"><div className="message-author">{m.role === "user" ? "Tú" : "Mimo"}</div><p>{m.content}</p><time>{new Date(m.time || Date.now()).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</time></div></div>)}
          {busy && <div className="typing">Mimo está pensando<span>…</span></div>}
        </div>
        <form className="composer" onSubmit={sendMessage}><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Escribe tu mensaje..." rows="2"/><button type="submit" disabled={busy || !draft.trim()} aria-label="Enviar">➤</button></form>
        <div className="chat-foot">{isOnline ? "Las respuestas avanzadas necesitan el servidor de IA configurado." : "Sin conexión: respuestas básicas disponibles."}<button onClick={() => setTab("history")}>Ver conversación completa ↗</button></div>
      </section>}
      {tab === "history" && <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">TUS RECUERDOS</p><h1>Conversación completa</h1></div><span className="count-pill">{chats.length}</span></div>
        {chats.length === 0 ? <div className="empty-chat"><div>📖</div><h3>Aún no hay mensajes</h3><p>Cuando hables con Mimo, aparecerán aquí.</p><button className="primary" onClick={() => setTab("chat")}>Empezar a hablar</button></div> : <><div className="history-list">{chats.map((m,i)=><div className={`message ${m.role==="user"?"mine":"theirs"}`} key={i}><div className="message-avatar">{m.role==="user"?"🙂":"🐈‍⬛"}</div><div className="message-content"><div className="message-author">{m.role==="user"?"Tú":"Mimo"} · {new Date(m.time||Date.now()).toLocaleString()}</div><p>{m.content}</p></div></div>)}</div><button className="secondary full" onClick={() => { if(confirm("¿Borrar todo el historial?")) {setChats([]);saveCloud(pet,[]);} }}>Borrar historial</button></>}
      </section>}
      {tab === "games" && <section className="panel">
        <div className="section-heading"><div><p className="eyebrow">DIVERSIÓN</p><h1>Juegos con Mimo</h1></div><div className="level">🪙 {pet.coins}</div></div>
        <div className="game-card"><div className="game-art">🧠<span>✨</span></div><div className="game-copy"><h2>¡Suerte gatuna!</h2><p>Prueba tu suerte: si ganas, consigues experiencia y monedas para tu mascota.</p><button className="primary" onClick={playMemory}>Jugar una ronda</button><small>Rondas ganadas: {gameScore}</small></div></div>
        <div className="game-card"><div className="game-art blue">🐾</div><div className="game-copy"><h2>Entrenamiento rápido</h2><p>Haz una sesión de juego para subir la felicidad de Mimo.</p><button className="secondary" onClick={() => care("play")}>Entrenar (+XP)</button></div></div>
        <p className="muted">Más minijuegos se pueden añadir en siguientes versiones.</p>
      </section>}
      {tab === "account" && <section className="panel">
        <p className="eyebrow">TU PERFIL</p><h1>Cuenta y guardado</h1>
        <div className="account-card"><div className="avatar">{user?.photoURL ? <img src={user.photoURL} alt="Perfil"/> : "🙂"}</div><div><h2>{user?.displayName || "Invitado"}</h2><p>{user?.email || "Inicia sesión para guardar en la nube"}</p></div></div>
        {user ? <><div className="success-box">✓ Sesión iniciada. Intentaremos sincronizar mascota e historial con tu cuenta.</div><button className="secondary full" onClick={() => googleLogout()}>Cerrar sesión</button></> : <><p className="muted">Inicia sesión con Google para sincronizar tu progreso entre dispositivos. Sin iniciar sesión, se guarda localmente.</p><button className="primary full" onClick={login}>🔐 Continuar con Google</button>{!firebaseReady && <p className="config-warning">Falta configurar Firebase en el archivo .env. Mira el README para activarlo.</p>}</>}
        <div className="privacy-note"><strong>Privacidad</strong><p>Evita escribir contraseñas o datos muy privados en el chat. Configura las reglas de Firestore antes de publicar la aplicación.</p></div>
      </section>}
    </main>
    <nav className="bottom-nav">
      <NavItem active={tab==="pet"} onClick={() => setTab("pet")} icon="🐾" label="Mascota"/>
      <NavItem active={tab==="chat"} onClick={() => setTab("chat")} icon="💬" label="Chat"/>
      <NavItem active={tab==="games"} onClick={() => setTab("games")} icon="🎮" label="Juegos"/>
      <NavItem active={tab==="history"} onClick={() => setTab("history")} icon="📖" label="Historial"/>
      <NavItem active={tab==="account"} onClick={() => setTab("account")} icon="👤" label="Cuenta"/>
    </nav>
  </div>;
}
function Stat({icon,label,value,inverse=false}) { return <div className="stat"><div className="stat-top"><span>{icon}</span><b>{value}%</b></div><label>{label}</label><div className="mini-progress"><div className={inverse?"hunger":""} style={{width:`${value}%`}}/></div></div>; }
function NavItem({active,onClick,icon,label}) { return <button className={`nav-item ${active?"active":""}`} onClick={onClick}><span>{icon}</span><small>{label}</small></button>; }
createRoot(document.getElementById("root")).render(<App/>);
