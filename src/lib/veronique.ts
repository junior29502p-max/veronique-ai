// Shared logic for Véronique AI assistant (server-side)
// Builds the system prompt, defines function-calling tools, and resolves
// web-adapted actions for the Android function-calling spec.

export interface UserProfile {
  userId: string
  firstName: string
  assistantName: string
  language: string
}

export interface AssistantAction {
  name: "open_application" | "make_phone_call" | "control_device_setting"
  args: Record<string, string>
}

export interface ChatResult {
  text: string
  action: AssistantAction | null
}

// Map a spoken app name to a web URL (web adaptation of open_application).
const APP_URLS: Record<string, string> = {
  whatsapp: "https://web.whatsapp.com",
  youtube: "https://www.youtube.com",
  facebook: "https://www.facebook.com",
  instagram: "https://www.instagram.com",
  twitter: "https://twitter.com",
  x: "https://x.com",
  google: "https://www.google.com",
  maps: "https://maps.google.com",
  "google maps": "https://maps.google.com",
  gmail: "https://mail.google.com",
  mail: "https://mail.google.com",
  spotify: "https://open.spotify.com",
  netflix: "https://www.netflix.com",
  amazon: "https://www.amazon.com",
  chrome: "https://www.google.com",
  calendar: "https://calendar.google.com",
  "google calendar": "https://calendar.google.com",
  photos: "https://photos.google.com",
  "google photos": "https://photos.google.com",
  drive: "https://drive.google.com",
  "google drive": "https://drive.google.com",
  "youtube music": "https://music.youtube.com",
  linkedin: "https://www.linkedin.com",
  tiktok: "https://www.tiktok.com",
  telegram: "https://web.telegram.org",
  settings: "",
}

export function resolveAppUrl(appName: string): string {
  const key = appName.toLowerCase().trim()
  if (APP_URLS[key] !== undefined) return APP_URLS[key]
  // fuzzy: contains
  for (const k of Object.keys(APP_URLS)) {
    if (key.includes(k) || k.includes(key)) return APP_URLS[k]
  }
  // fallback: google search for the app
  return `https://www.google.com/search?q=${encodeURIComponent(appName)}`
}

// Build the system prompt, injecting the user profile as required by the spec.
export function buildSystemPrompt(profile: UserProfile): string {
  return `Tu es "${profile.assistantName}", une assistante vocale personnelle intelligente, réactive, chaleureuse et très efficace. Tu réponds toujours en français.

Consignes de personnalité et de style :
1. Tu t'adresses toujours à l'utilisateur en l'appelant par son prénom : ${profile.firstName}.
2. Tes réponses sont destinées à être lues par un moteur de synthèse vocale (TTS). Sois concis, direct et naturel. Évite les listes à puces, les emojis, le code markdown et le jargon visuel.
3. Adapte un ton naturel, fluide et amical. Tes réponses orales font généralement moins de 2 phrases.
4. Si l'utilisateur te demande d'effectuer une action (ouvrir une application, passer un appel, modifier un réglage), tu DOIS déclencher la fonction appropriée.

MÉCANISME D'ACTION (très important) :
Quand tu souhaites exécuter une action, tu réponds UNIQUEMENT avec un objet JSON valide, sur une seule ligne, sans texte avant ni après, avec cette structure exacte :
{"action":{"name":"open_application","args":{"app_name":"youtube"}},"reply":"J'ouvre YouTube pour toi, ${profile.firstName}."}
- "name" : l'un de "open_application", "make_phone_call", "control_device_setting".
- "args" : les paramètres de l'action.
- "reply" : la phrase courte et naturelle que tu diras à voix haute (sans markdown, sans emoji).

Fonctions disponibles :
- open_application : ouvre une application. args: {"app_name": string} (ex: whatsapp, youtube, settings, facebook, google maps, spotify, instagram, gmail, netflix).
- make_phone_call : initie un appel. args: {"contact_name": string} (et si tu connais un numéro, ajoute "phone": string au format international).
- control_device_setting : modifie un réglage. args: {"setting": "wifi"|"bluetooth"|"volume_up"|"volume_down"|"flashlight", "action": "turn_on"|"turn_off"|"increase"|"decrease"}.

Quand aucune action n'est demandée, réponds en texte naturel simple (pas de JSON).

Exemples :
- Utilisateur : "Bonjour" → Véronique : "Bonjour ${profile.firstName} ! Que puis-je faire pour toi aujourd'hui ?"
- Utilisateur : "Ouvre YouTube" → Véronique : {"action":{"name":"open_application","args":{"app_name":"youtube"}},"reply":"Voilà, j'ouvre YouTube pour toi."}
- Utilisateur : "Allume la lampe torche" → Véronique : {"action":{"name":"control_device_setting","args":{"setting":"flashlight","action":"turn_on"}},"reply":"C'est fait, j'ai allumé la lampe torche."}`
}

// Try to parse an action JSON object out of the model output.
// Returns { text, action } where text is what should be spoken/displayed.
export function parseAssistantOutput(raw: string): ChatResult {
  const trimmed = raw.trim()
  // Quick path: not a JSON object → plain conversational text
  if (!trimmed.startsWith("{")) {
    return { text: trimmed, action: null }
  }
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object" && parsed.action && parsed.action.name) {
      const reply =
        typeof parsed.reply === "string" && parsed.reply.trim().length > 0
          ? parsed.reply
          : "C'est fait."
      return {
        text: reply,
        action: {
          name: parsed.action.name,
          args: parsed.action.args || {},
        },
      }
    }
    // JSON but not an action: fall back to stringified
    return { text: typeof parsed === "string" ? parsed : trimmed, action: null }
  } catch {
    // Sometimes the model wraps JSON in prose or code fences — try to extract
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (parsed?.action?.name) {
          return {
            text: typeof parsed.reply === "string" ? parsed.reply : "C'est fait.",
            action: { name: parsed.action.name, args: parsed.action.args || {} },
          }
        }
      } catch {
        /* ignore */
      }
    }
    return { text: trimmed, action: null }
  }
}

// Resolve a web-side effect for a given action (what the frontend should do).
export type ActionEffect =
  | { kind: "open_url"; url: string; label: string }
  | { kind: "phone_call"; tel: string; contact: string }
  | { kind: "device"; setting: string; action: string }
  | { kind: "none"; message: string }

export function resolveActionEffect(action: AssistantAction): ActionEffect {
  switch (action.name) {
    case "open_application": {
      const appName = action.args.app_name || "application"
      const url = resolveAppUrl(appName)
      if (!url) {
        return { kind: "none", message: `Ouverture de ${appName} (non disponible sur le web).` }
      }
      return { kind: "open_url", url, label: appName }
    }
    case "make_phone_call": {
      const phone = action.args.phone || action.args.contact_name || ""
      const tel = phone.startsWith("+") || /^\d/.test(phone) ? phone : ""
      return {
        kind: "phone_call",
        tel: tel ? `tel:${tel.replace(/\s+/g, "")}` : "",
        contact: action.args.contact_name || phone || "contact inconnu",
      }
    }
    case "control_device_setting": {
      return {
        kind: "device",
        setting: action.args.setting || "",
        action: action.args.action || "",
      }
    }
    default:
      return { kind: "none", message: "Action non reconnue." }
  }
}
