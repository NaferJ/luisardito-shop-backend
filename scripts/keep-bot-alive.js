// keep-bot-alive.js
const kickBotService = require("./src/services/kickBot.service");

async function keepBotAlive() {
  try {
    console.log("🤖 [KEEP-ALIVE] Iniciando mantenimiento del bot...");

    // Forzar resolución del token (esto lo renueva si es necesario)
    const token = await kickBotService.resolveAccessToken();

    if (!token) {
      console.error("❌ [KEEP-ALIVE] No se pudo obtener token válido");
      return false;
    }

    console.log("✅ [KEEP-ALIVE] Token válido obtenido/renovado");

    // Opcional: Enviar un mensaje de "ping" invisible o de mantenimiento
    // Solo si quieres confirmar que el envío funciona
    const testMessage = null; // Cambia a un mensaje si quieres probar envío

    if (testMessage) {
      const result = await kickBotService.sendMessage(testMessage);
      if (result.ok) {
        console.log("✅ [KEEP-ALIVE] Mensaje de prueba enviado correctamente");
      } else {
        console.log(
          "⚠️ [KEEP-ALIVE] Token válido pero envío falló:",
          result.error
        );
      }
    }

    console.log("🎉 [KEEP-ALIVE] Mantenimiento completado exitosamente");
    return true;
  } catch (error) {
    console.error("❌ [KEEP-ALIVE] Error en mantenimiento:", error.message);
    return false;
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  keepBotAlive()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Error fatal:", error);
      process.exit(1);
    });
}

module.exports = keepBotAlive;
