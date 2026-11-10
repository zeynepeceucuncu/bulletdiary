FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
COPY src src
RUN mvn -B package
FROM eclipse-temurin:21-jre
COPY --from=build /src/target/backend-0.1.0.jar /app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
