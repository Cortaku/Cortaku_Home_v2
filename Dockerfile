FROM node:22-alpine AS builder
# Needed by the native binaries in Tailwind and Next.js.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
# Not `npm ci`: a plain install fetches the Linux optional dependencies a lock file made on Windows lacks.
RUN npm install --no-audit --no-fund --loglevel=error
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
