# Mimo — Tamagotchi inteligente (starter)

Aplicación inicial en React + Vite, preparada para web móvil/PWA y empaquetado Android con Capacitor. Incluye la imagen del gato enviada como mascota predeterminada, cuidados, nivel/XP/monedas, cambio local de imagen, minijuego sencillo, chat con historial, respuestas offline básicas y puntos de integración para Google/Firebase y un proveedor de IA.

> Es un proyecto inicial funcional, no una app ya publicada. Para habilitar sincronización entre dispositivos y chat de IA real hay que configurar servicios externos. No subas `.env` ni claves secretas al repositorio.

## Requisitos
- Node.js 20 o superior
- npm
- Cuenta Google/Firebase para iniciar sesión y guardar progreso
- Una clave de un proveedor de IA compatible con la API Chat Completions
- Para Android: Android Studio y Android SDK

## 1. Instalar y ejecutar la web
```bash
npm install
cp .env.example .env
npm run dev
```
Abre la dirección local que Vite muestra. Sin configurar Firebase, la app funciona como invitado y guarda estado/historial en el almacenamiento local del navegador. Sin servidor IA, el chat online muestra un error de configuración; las respuestas offline básicas sí están incluidas.

## 2. Configurar Firebase / Gmail
1. Crea un proyecto en https://console.firebase.google.com/
2. Añade una aplicación Web y copia sus valores a `.env` (`VITE_FIREBASE_*`).
3. En Authentication → Sign-in method, activa **Google**.
4. En Authentication → Settings → Authorized domains, añade tu dominio local y el dominio real donde publiques.
5. Crea una base Firestore.
6. Publica reglas de Firestore seguras para que cada usuario solo lea/escriba `users/{uid}` si `request.auth.uid == uid`. Ejemplo inicial:
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
7. Reinicia Vite tras editar `.env`.

**Importante:** el código actual guarda mascota e historial en un documento de Firestore. Para producción conviene mover el historial a una subcolección paginada y validar tamaño/tipos. La imagen personalizada se guarda localmente como data URL; para sincronizarla entre dispositivos, habilita Firebase Storage, sube el archivo y guarda su URL en el perfil. Añade reglas de Storage por usuario y límites de tamaño/MIME.

## 3. Activar IA online
El frontend llama a `/api/chat`. Despliega `server/index.js` en un servidor Node (por ejemplo un servicio de hosting Node) y configura en el servidor:
- `AI_API_KEY`: clave privada del proveedor
- `AI_BASE_URL`: endpoint compatible (por defecto API Chat Completions)
- `AI_MODEL`: modelo disponible en tu cuenta

Para desarrollo local, ejecuta el servidor en otra terminal:
```bash
npm run server
```
El backend escucha por defecto en el puerto 8787. Configura un proxy de desarrollo de Vite hacia `http://localhost:8787` para `/api`, o usa el mismo dominio/proxy al desplegar. Nunca pongas la clave de IA en el frontend. Antes de publicar, añade autenticación al endpoint, rate limiting, límites de gasto y protección contra abuso. La API puede tener costes.

## 4. Android
Primero construye la web:
```bash
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
En Android Studio, prueba en un emulador o dispositivo. Después configura el nombre, iconos, permisos y firma de publicación. La carpeta `android/` se genera localmente y no está incluida en este ZIP.

Para usar Google Sign-In nativo en producción, el popup web puede no ser la mejor experiencia en Android. Configura Firebase Authentication con el flujo recomendado para Capacitor/nativo y los SHA-1/SHA-256 del certificado; puede requerir un plugin de autenticación nativa y cambios en `src/firebase.js`.

## 5. Modo sin internet
`public/sw.js` cachea el shell de la PWA y la imagen por defecto. La mascota, estado, historial y respuestas básicas funcionan sin conexión en el mismo dispositivo. La IA avanzada y la sincronización en la nube necesitan internet. Los cambios offline se guardan localmente; este starter no implementa una cola robusta de sincronización/conflictos.

Para probar offline: publica o sirve la app por HTTPS, ábrela una vez con internet y luego activa modo avión. Los service workers requieren localhost o HTTPS.

## Estructura
- `src/main.jsx`: pantallas Mascota, Chat, Juegos, Historial y Cuenta
- `src/firebase.js`: configuración Firebase/Google
- `src/style.css`: diseño adaptable a celular
- `server/index.js`: endpoint privado de IA
- `public/gato-pixel.png`: imagen inicial enviada por el usuario
- `public/sw.js`: caché offline básica

## Antes de publicarla
- Configurar Firebase Auth, Firestore y Storage
- Configurar y asegurar backend de IA
- Añadir sincronización offline con resolución de conflictos
- Validar imágenes pixel art (el starter acepta imágenes en general y limita a 2 MB; la detección de estilo aún no está implementada)
- Añadir eliminación/exportación de datos, política de privacidad y controles parentales/seguridad apropiados
- Revisar accesibilidad, pruebas y publicación Play Store
