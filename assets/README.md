# Assets del Proyecto

Esta carpeta contiene recursos estáticos como imágenes, banners, etc.

## Imágenes

- `discordbanner.jpg`: Banner para el comando !discord con degradado morado

## Cómo configurar el banner

### Opción 1: URL Externa (Recomendado)
Para que Discord pueda acceder al banner desde cualquier lugar:

1. **Sube tu imagen** a un servicio externo (Imgur, Discord CDN, etc.)
2. **Configura la variable de entorno**:
   ```bash
   # En desarrollo (.env)
   DISCORD_BANNER_URL=https://i.imgur.com/tu-banner.jpg

   # En producción
   DISCORD_BANNER_URL=https://tu-cdn.com/banner.jpg
   ```

### Opción 2: Archivo Local
Solo funciona si tu servidor es accesible públicamente:

1. **Coloca tu imagen** en `assets/images/discordbanner.jpg`
2. **Asegúrate** de que tu dominio sea accesible desde internet
3. **La URL se genera automáticamente** como `https://tu-dominio.com/assets/images/discordbanner.jpg`

## Especificaciones del Banner

- **Nombre del archivo**: `discordbanner.jpg`
- **Ubicación**: `assets/images/discordbanner.jpg`
- **Formato**: JPG (recomendado para banners con degradados)
- **Tamaño recomendado**: 800x200px
- **Contenido**: Degradado morado de abajo hacia arriba
- **Colores sugeridos**: #9B59B6 → #7C3AED → #581C87

## Solución de problemas

- **Banner no aparece**: Verifica que la URL sea accesible desde internet
- **Color incorrecto**: El embed usa color morado (#9B59B6)
- **Miembros incorrectos**: Verifica configuración de `DISCORD_BOT_TOKEN` y `DISCORD_GUILD_ID`