/**
 * Utilidad para formatear minutos de watchtime a un formato legible
 * Convierte minutos a: años, meses, días, horas, minutos
 */

function formatWatchtime(minutes) {
    if (!minutes || minutes === 0) return '0 min'

    const totalMinutes = Math.round(minutes)

    // Si es menor a 60 minutos, mostrar solo minutos
    if (totalMinutes < 60) {
        return `${totalMinutes} min`
    }

    // Si es menor a 24 horas, mostrar horas y minutos
    if (totalMinutes < 60 * 24) {
        const hours = Math.floor(totalMinutes / 60)
        const mins = Math.round(totalMinutes % 60)
        return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
    }

    // Si es menor a 7 días, mostrar días y horas
    if (totalMinutes < 60 * 24 * 7) {
        const days = Math.floor(totalMinutes / (60 * 24))
        const remainingMinutes = totalMinutes % (60 * 24)
        const hours = Math.round(remainingMinutes / 60)
        return hours > 0 ? `${days}d ${hours}h` : `${days}d`
    }

    // Si es menor a 30 días, mostrar semanas y días
    if (totalMinutes < 60 * 24 * 30) {
        const weeks = Math.floor(totalMinutes / (60 * 24 * 7))
        const remainingMinutes = totalMinutes % (60 * 24 * 7)
        const days = Math.round(remainingMinutes / (60 * 24))
        return days > 0 ? `${weeks}s ${days}d` : `${weeks}s`
    }

    // Si es menor a 365 días, mostrar meses y días
    if (totalMinutes < 60 * 24 * 365) {
        const months = Math.floor(totalMinutes / (60 * 24 * 30))
        const remainingMinutes = totalMinutes % (60 * 24 * 30)
        const days = Math.round(remainingMinutes / (60 * 24))
        return days > 0 ? `${months}m ${days}d` : `${months}m`
    }

    // Si es 365 días o más, mostrar años y meses
    const years = Math.floor(totalMinutes / (60 * 24 * 365))
    const remainingMinutes = totalMinutes % (60 * 24 * 365)
    const months = Math.round(remainingMinutes / (60 * 24 * 30))
    return months > 0 ? `${years}a ${months}m` : `${years}a`
}

module.exports = formatWatchtime

