# Assets del Proyecto

Esta carpeta contiene recursos estáticos como imágenes, banners, etc.

## Imágenes

- `discordbanner.jpg`: Banner para el comando !discord con degradado morado

## Cómo configurar el banner con Cloudinary

### 🚀 Método Recomendado: Usar tu sistema existente

Como ya tienes Cloudinary configurado en el frontend:

1. **Sube tu banner** desde tu frontend a Cloudinary (como haces con otras imágenes)
2. **Copia la URL** que devuelve Cloudinary
3. **Agrega al .env**:
   ```bash
   DISCORD_BANNER_URL=https://res.cloudinary.com/tu-cloud/image/upload/v1234567890/banner-morado.jpg
   ```
4. **Reinicia el servidor**

### 📁 Método Alternativo: Archivo Local

Si tienes un dominio público:

1. **Coloca tu imagen** en `assets/images/discordbanner.jpg`
2. **Asegúrate** de que `https://tu-dominio.com` sea accesible
3. **La URL se genera automáticamente**

## Especificaciones del Banner

- **Nombre del archivo**: `discordbanner.jpg`
- **Formato**: JPG (recomendado para degradados)
- **Tamaño recomendado**: 800x200px
- **Contenido**: Degradado morado #9B59B6 → #7C3AED → #581C87
- **Dirección**: De abajo hacia arriba

## Solución de problemas

- **Banner no aparece**: Verifica que la URL de Cloudinary sea pública y accesible
- **Color incorrecto**: El embed usa color morado (#9B59B6)
- **Miembros incorrectos**: Verifica `DISCORD_BOT_TOKEN` y `DISCORD_GUILD_ID`