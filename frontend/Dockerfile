# Stage 1: Build React app
FROM node:20 AS build

WORKDIR /app

# Pass build arg for VITE_API_URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Install dependencies (npm ci requires package-lock.json)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build   # outputs to /app/dist

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy React build from previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config — make sure it exists relative to build context
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]