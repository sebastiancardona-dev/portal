# Single image = single pipeline slot (project 03): the Spring Boot jar serves
# the built SPA from its classpath alongside /api and /health.
# Build args are stamped by the shared pipeline (sebastiancardona-dev/workflows).

FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ .
RUN npm run build

FROM eclipse-temurin:21-jdk-alpine AS api
WORKDIR /build
COPY api/.mvn .mvn
COPY api/mvnw api/pom.xml ./
RUN ./mvnw -q -B dependency:go-offline
COPY api/src src
COPY --from=web /web/dist src/main/resources/static
# tests run in CI; the image build must be reproducible and fast
RUN ./mvnw -q -B package -DskipTests

FROM eclipse-temurin:21-jre-alpine
ARG VERSION=dev
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
# surfaces on /info via Spring's env info contributor (ecosystem contract)
ENV INFO_APP_VERSION=$VERSION \
    INFO_APP_GIT_SHA=$GIT_SHA \
    INFO_APP_BUILD_TIME=$BUILD_TIME
RUN adduser -D -u 10001 portal
USER 10001
WORKDIR /app
COPY --from=api /build/target/portal-api-*.jar app.jar
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
