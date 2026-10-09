import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Keep your provider API key on the server, never in the mobile/web frontend.
// This starter uses an OpenAI-compatible chat completions endpoint.
app.post("/api/chat", async (req, res) => {
  const { message, history = [] } = req.body || {};
  if (!message || typeof message !== "string") return res.status(400).json({ error: "Falta el mensaje." });
  if (!process.env.AI_API_KEY) return res.status(503).json({ error: "Configura AI_API_KEY en el servidor." });
  try {
    const endpoint = process.env.AI_BASE_URL || "https://api.openai.com/v1/chat/completions";
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const safeHistory = Array.isArray(history) ? history.slice(-12).filter(m => ["user", "assistant"].includes(m.role) && typeof m.content === "string").map(m => ({ role: m.role, content: m.content.slice(0, 4000) })) : [];
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Eres Mimo, una mascota virtual amable y responsable. Responde en español, con claridad y calidez. Ayuda a aprender, explica tareas paso a paso y ofrece apoyo empático ante problemas personales sin fingir ser profesional de salud. Si hay peligro inmediato, recomienda buscar a un adulto de confianza o servicios de emergencia locales. No inventes datos; admite cuando no sepas." },
          ...safeHistory
        ],
        temperature: 0.7
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error("AI provider error", response.status, detail.slice(0, 300));
      return res.status(502).json({ error: "El proveedor de IA no pudo responder." });
    }
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) return res.status(502).json({ error: "Respuesta vacía de la IA." });
    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error del servidor de IA." });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Mimo AI backend escuchando en http://localhost:${port}`));
