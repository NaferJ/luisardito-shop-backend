/**
 * Sistema de logging centralizado con control por variable de entorno
 * Los logs de debug pueden desactivarse en producción sin afectar errores críticos
 */

const isDevelopment = process.env.NODE_ENV !== 'production';
const isDebugEnabled = process.env.DEBUG_LOGS === 'true';

// Determinar si deben mostrarse los logs de debug
const shouldLog = isDevelopment || isDebugEnabled;

/**
 * Logger principal con diferentes niveles
 */
const logger = {
    /**
     * Logs informativos - pueden desactivarse en producción
     */
    info: (...args) => {
        if (shouldLog) {
            console.log(...args);
        }
    },

    /**
     * Logs de advertencia - pueden desactivarse en producción
     */
    warn: (...args) => {
        if (shouldLog) {
            console.warn(...args);
        }
    },

    /**
     * Logs de error - SIEMPRE se registran (críticos)
     */
    error: (...args) => {
        console.error(...args);
    },

    /**
     * Logs de debug - solo en desarrollo o cuando DEBUG_LOGS=true
     */
    debug: (...args) => {
        if (shouldLog) {
            console.log('[DEBUG]', ...args);
        }
    }
};

module.exports = logger;

