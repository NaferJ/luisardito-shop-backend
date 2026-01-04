/**
 * 📋 EJEMPLO DE RESPUESTA DEL LEADERBOARD CON CONTADOR DE RESET
 *
 * Se ha agregado información sobre el próximo reset del leaderboard
 * en el objeto `meta` de la respuesta.
 */

{
  "success": true,
  "data": [
    {
      "usuario_id": 3,
      "nickname": "NaferJ",
      "display_name": "naferj",
      "puntos": 1018437,
      "max_puntos": 1018437,
      "watchtime_minutes": 245,
      "message_count": 49,
      "position": 1,
      "position_change": 1,
      "change_indicator": "up",
      "is_vip": true,
      "is_subscriber": true,
      "kick_data": {
        "is_subscriber": true,
        "username": "NaferJ"
      },
      "discord_info": {
        "linked": true,
        "id": "459182419719880705",
        "username": "naferj",
        "discriminator": "0"
      },
      "previous_position": 2,
      "previous_points": 722173
    },
    {
      "usuario_id": 15,
      "nickname": "OtroUsuario",
      "display_name": "otro_usuario",
      "puntos": 850000,
      "max_puntos": 875000,
      "watchtime_minutes": 189,
      "message_count": 38,
      "position": 2,
      "position_change": 0,
      "change_indicator": "neutral",
      "is_vip": false,
      "is_subscriber": true,
      "kick_data": { ... },
      "discord_info": null,
      "previous_position": 2,
      "previous_points": 850000
    }
  ],
  "meta": {
    "total": 336,
    "limit": 100,
    "offset": 0,
    "last_update": "2026-01-03T14:30:00Z",
    "next_reset_date": "2026-01-17T14:30:00Z",    // ← ¡NUEVO!
    "days_until_reset": 14,                        // ← ¡NUEVO!
    "hours_until_reset": 336                       // ← ¡NUEVO!
  },
  "user_position": null
}

/**
 * 🎯 NUEVOS CAMPOS EN META:
 *
 * next_reset_date: string (ISO 8601)
 *   - Fecha y hora exacta del próximo reset
 *   - Ejemplo: "2026-01-17T14:30:00Z"
 *   - Se calcula como: último_snapshot + 336 horas
 *
 * days_until_reset: number
 *   - Días restantes hasta el reset (0-14)
 *   - Útil para mostrar "Reinicia en 7 días"
 *   - Se recalcula en cada request
 *
 * hours_until_reset: number
 *   - Horas restantes hasta el reset (0-336)
 *   - Útil para mostrar "Reinicia en 120 horas"
 *   - Más preciso que days_until_reset
 *
 * 📌 NOTA IMPORTANTE:
 * El reset de leaderboard solo afecta a:
 *   - Los indicadores de cambio de posición (up/down/neutral)
 *   - Se comparan contra el nuevo snapshot
 *
 * NO se resetean:
 *   - puntos (saldo actual)
 *   - max_puntos (máximo histórico)
 *   - watchtime_minutes (tiempo de visualización)
 *   - message_count (cantidad de mensajes)
 */

