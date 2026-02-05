# Luisardito Shop - Backend

API REST desarrollada en Node.js para sistema de puntos gamificado con integración de plataformas de streaming (Kick), Discord y sistema de recompensas en tiempo real.

[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-blue)](https://www.mysql.com/)

## Descripción

Sistema completo de gestión de puntos y recompensas para comunidades de streaming. Incluye autenticación OAuth multi-plataforma, bot de chat integrado, leaderboards con rankings históricos, y sistema de administración con gestión de productos, promociones y usuarios.

Proyecto en producción con usuarios activos en https://shop.luisardito.com

## Stack Tecnológico

- Runtime: Node.js 20.x  
- Framework: Express.js  
- Base de Datos: MySQL 8.0 + Sequelize ORM  
- Caché: Redis 7-alpine  
- Autenticación: JWT + OAuth 2.0 (PKCE)  
- Deployment: Docker + GitHub Actions CI/CD  
- Backup: Respaldos automáticos diarios con Git LFS  

## Características Principales

- Sistema de puntos basado en tiempo de visualización en streams  
- Autenticación OAuth con Discord y Kick usando flujo PKCE  
- Bot de chat con comandos personalizables para Kick  
- Leaderboards con snapshots periódicos y rankings históricos  
- Tienda virtual con sistema completo de productos y redenciones  
- Panel de administración para gestión de usuarios, productos y promociones  
- Sistema de notificaciones en tiempo real  
- Respaldos automáticos programados de base de datos  
- Gestión de promociones con fechas de inicio y fin  
- Sistema de permisos basado en roles  

## Deployment con Docker

El proyecto incluye configuración completa de Docker con tres servicios:

- MySQL 8.0: Base de datos relacional con volumes persistentes  
- Redis 7: Sistema de caché para datos frecuentes  
- API Node.js: Aplicación principal con health checks  

Configuración para desarrollo y producción con Docker Compose, incluyendo:

- Volúmenes persistentes para datos  
- Health checks automáticos  
- Logging optimizado para producción  

## CI/CD

Pipeline automatizado mediante GitHub Actions:

- Calidad de Código: Verificación con ESLint en cada push  
- Migraciones: Ejecución automática de migraciones en deployment  
- Deployment: Despliegue automático a VPS al hacer merge a main  
- Backups: Respaldos diarios automáticos a las 3:00 AM con política de retención  

## Esquema de Base de Datos

La aplicación utiliza Sequelize ORM con los siguientes modelos principales:

- Usuario: Cuentas de usuario con puntos y permisos  
- Producto: Productos de la tienda con precios y disponibilidad  
- Redencion: Historial de canjes con seguimiento de estado  
- Promocion: Campañas promocionales con rangos de fechas  
- Leaderboard: Rankings actuales  
- LeaderboardSnapshot: Datos históricos de rankings  
- Notificacion: Sistema de notificaciones para usuarios  

Todas las migraciones están versionadas y son reversibles.

## Seguridad

- Autenticación basada en JWT con generación segura de tokens  
- Flujo OAuth 2.0 PKCE para autenticación de terceros  
- Prevención de inyección SQL mediante Sequelize ORM  
- Configuración de CORS para orígenes confiables  
- Gestión de secretos basada en variables de entorno  
- Mecanismo automático de renovación de tokens  
- Control de acceso basado en roles (RBAC)  

## Rendimiento

- Sistema de caché con Redis para datos accedidos frecuentemente  
- Optimización de consultas de base de datos con índices  
- Connection pooling para MySQL  
- Middleware eficiente de validación de tokens  
- Carga diferida de servicios  

## Licencia

Este software y su código fuente son propiedad exclusiva de NaferJ. Queda estrictamente prohibido el uso, copia, distribución, modificación o publicación sin autorización expresa y por escrito del titular.

## Autor

NaferJ  
GitHub: https://github.com/NaferJ  
Proyecto en Producción: https://shop.luisardito.com

Para el repositorio del frontend, ver luisardito-shop-frontend
