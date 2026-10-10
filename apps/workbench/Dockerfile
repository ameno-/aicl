FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
# --legacy-peer-deps: rivetkit@2.3.26 declares an optional peer eventsource@^4
# while its own @modelcontextprotocol/sdk dep needs eventsource@^3; npm ci's
# peer validation rejects that lockfile (npm >= 10.9.9), so skip peer wiring.
RUN npm ci --legacy-peer-deps

COPY tsconfig.json ./
COPY src ./src
COPY nasir ./nasir

# rivetkit is plain TS that node strips types from at runtime.
CMD ["node", "--experimental-strip-types", "--no-warnings", "src/server.ts"]
