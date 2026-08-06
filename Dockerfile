# Etapa 1: build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: servir con nginx
FROM nginx:alpine

# Generamos la configuración de nginx directamente aquí,
# sin depender de un archivo externo
RUN rm /etc/nginx/conf.d/default.conf
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location /api/ {\n\
        proxy_pass https://proyectocarniceria-production.up.railway.app/api/;\n\
        proxy_set_header Host proyectocarniceria-production.up.railway.app;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto $scheme;\n\
        proxy_ssl_server_name on;\n\
    }\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist/FrontCarniceria/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]