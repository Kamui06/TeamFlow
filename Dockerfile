FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
COPY src ./src
RUN chmod +x gradlew && ./gradlew --no-daemon bootJar -x test \
 && cp $(ls build/libs/*.jar | grep -v -- '-plain.jar') /app/app.jar

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/app.jar app.jar
ENV JAVA_TOOL_OPTIONS="-Xmx350m"
ENTRYPOINT ["java", "-Dspring.profiles.active=prod", "-jar", "app.jar"]