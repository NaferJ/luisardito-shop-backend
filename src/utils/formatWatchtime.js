/**
 * Utilidad para formatear minutos de watchtime a un formato legible
 * Convierte minutos a las unidades más relevantes: años, meses, semanas, días, horas, minutos
 * Siempre muestra las 2 unidades más significativas
 */

function formatWatchtime(minutes) {
    if (!minutes || minutes === 0) return '0 min'

    const totalMinutes = Math.round(minutes)

    // Calcular todas las unidades
    const years = Math.floor(totalMinutes / (60 * 24 * 365))
    let remaining = totalMinutes % (60 * 24 * 365)

    const months = Math.floor(remaining / (60 * 24 * 30))
    remaining = remaining % (60 * 24 * 30)

    const weeks = Math.floor(remaining / (60 * 24 * 7))
    remaining = remaining % (60 * 24 * 7)

    const days = Math.floor(remaining / (60 * 24))
    remaining = remaining % (60 * 24)

    const hours = Math.floor(remaining / 60)
    const mins = remaining % 60

    // Construir la respuesta mostrando las 2 unidades más significativas
    const parts = []

    if (years > 0) {
        parts.push(`${years}a`)
        if (months > 0) {
            parts.push(`${months}m`)
            if (days > 0) {
                parts.push(`${days}d`)
                if (hours > 0) parts.push(`${hours}h`)
            } else if (hours > 0) {
                parts.push(`${hours}h`)
            }
        } else if (weeks > 0) {
            parts.push(`${weeks}s`)
        }
    } else if (months > 0) {
        parts.push(`${months}m`)
        if (days > 0) {
            parts.push(`${days}d`)
            if (hours > 0) parts.push(`${hours}h`)
        } else if (hours > 0) {
            parts.push(`${hours}h`)
        }
    } else if (weeks > 0) {
        parts.push(`${weeks}s`)
        if (days > 0) {
            parts.push(`${days}d`)
            if (hours > 0) parts.push(`${hours}h`)
        } else if (hours > 0) {
            parts.push(`${hours}h`)
        }
    } else if (days > 0) {
        parts.push(`${days}d`)
        if (hours > 0) parts.push(`${hours}h`)
    } else if (hours > 0) {
        parts.push(`${hours}h`)
        if (mins > 0) parts.push(`${mins}min`)
    } else {
        parts.push(`${mins}min`)
    }

    return parts.join(' ')
}

module.exports = formatWatchtime

