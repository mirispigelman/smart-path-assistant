# Build stage
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
#//RUN npm run build

# Run stage
#//FROM nginx:alpine

#COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5173
CMD ["npm", "run", "dev"]
