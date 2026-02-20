# Usamos una imagen base ligera de Node.js
FROM node:20-slim

# INSTALACIÓN DE DEPENDENCIAS DE SISTEMA (CRÍTICO)
# GraphicsMagick y Ghostscript son necesarios para que librerías como 'pdf2pic'
# puedan renderizar el PDF como una imagen (JPG/PNG) pixel por pixel.
RUN apt-get update && apt-get install -y \
    graphicsmagick \
    ghostscript \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Configuración del directorio de trabajo
WORKDIR /app

# Copiamos el package.json
COPY package*.json ./

# Instalación de dependencias de Node
RUN npm i --only=production
RUN npm install -g typescript tsx

# Copiamos el código fuente
COPY . .

# Variables de entorno por defecto (serán sobreescritas por Railway)
ENV NODE_ENV=production

# Comando de inicio del worker
CMD ["npx", "tsx", "src/index.ts"]
