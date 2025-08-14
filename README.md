### Travel Planning API
A GraphQL API for a travel planning application, providing dynamic city suggestions, weather forecasts, and activity rankings based on weather conditions. Built with Node.js, TypeScript, and Apollo Server, integrating with the Open-Meteo API for geocoding and weather data.
Table of Contents

## Overview
- **Setup Instructions**
- **Project Architecture**
- **Technical Choices**
- **Omissions and Trade-offs**
- **Potential Improvements**
- **Query Examples**

## Overview
This project implements a GraphQL API for a travel planning application, supporting three core features:

Dynamic City Suggestions: Returns city matches based on partial or complete user input using Open-Meteo’s geocoding API, with results cached for performance.
Weather Forecasts: Provides daily weather forecasts (temperature, precipitation, wind speed) for a selected city via Open-Meteo’s forecast API, with retry logic for reliability.
Activity Ranking: Ranks activities (outdoor sightseeing, indoor sightseeing, skiing, surfing) based on weather conditions, using a heuristic-based algorithm.

The API is built with scalability, maintainability, and testability in mind, leveraging TypeScript for type safety (with codegen for schema types), Apollo Server for GraphQL, and Jest/Supertest for comprehensive unit and integration testing. The codebase adheres to best practices, with modular architecture, robust error handling, and in-memory caching to optimize API calls.
Setup Instructions

# Clone the Repository:
``` sh
git clone https://github.com/<your-username>/travel-planning-api.git
cd travel-planning-api
```
# Install Dependencies:
``` sh
npm install
```

Ensure the following key dependencies are installed:

- **axios@1.4.0**
- **axios-retry@3.3.0**
- **lru-cache@10.0.0**
- **apollo-datasource@3.3.2**
- **apollo-server@3.10.0**
- **graphql-query-complexity@0.12.0**
- **dotenv@17.2.1**
- **jest@29.5.0, ts-jest@29.1.0, @types/jest@29.5.0 (dev)**


#### Configure Environment Variables:Create a .env file in the root directory:
```sh
OPEN_METEO_GEOCODING_URL=https://geocoding-api.open-meteo.com/v1
OPEN_METEO_FORECAST_URL=https://api.open-meteo.com/v1
```

### Run the Server:
```sh
npm start
```sh

Access the GraphQL Playground at http://localhost:4000.

#### Run Tests:

Unit tests (28 total: 7 for activityRanking, 9 for OpenMeteoDataSource, 12 for resolvers):npm test

Debug open handles:npm test -- --detectOpenHandles

### Lint and Format Code:
```sh
npm run lint
npm run format
```sh

## Project Architecture
The project follows a modular, layered architecture to ensure separation of concerns, scalability, and testability:

### Presentation Layer (src/index.ts, src/schema/):
index.ts: Initializes Apollo Server, integrating schema, resolvers, and data sources.
schema/types.ts: Defines GraphQL schema (SDL) and generated TypeScript types for City, WeatherForecast, and Activity using codegen.

### Business Logic Layer (src/resolvers/, src/utils/):
resolvers.ts: Orchestrates data fetching for citySuggestions, weatherForecast, and activityRanking queries, with complexity checks.
utils/activityRanking.ts: Implements heuristic-based ranking of activities based on weather conditions.

### Data Access Layer (src/datasources/):
OpenMeteoDataSource.ts: Encapsulates Open-Meteo API calls for geocoding and weather forecasts, using Axios with retry logic (axios-retry) and in-memory caching (lru-cache).

### Testing Layer (tests/):
tests/unit/: Tests individual components:
activityRanking.test.ts: 7 tests for ranking logic (all passing).
OpenMeteoDataSource.test.ts: 9 tests for API calls and caching (fixed undefined cache issue).
resolvers.test.ts: 12 tests for GraphQL resolvers.

### Configuration:
-**.env: Stores API URLs**
- **tsconfig.json: Configures TypeScript with strict mode.**
- **.eslintrc.js, .prettierrc: Enforce code quality and formatting.**
- **jest.config.ts: Configures Jest with ts-jest and 10s timeout.**

This structure supports extensibility, simplifies debugging, and ensures robust testing.

## Technical Choices

Node.js: Stable runtime for backend development.
TypeScript: Ensures type safety with codegen for GraphQL schema types.
Apollo Server: Robust GraphQL server with TypeScript support, plugins for complexity analysis, and GraphQL Playground.
GraphQL: Enables flexible, client-driven queries, reducing over/under-fetching.
Axios: Reliable HTTP client with axios-retry@3.3.0 for handling transient errors (e.g., 429, network issues).
Dotenv: Manages environment variables (dotenv@17.2.1).
Winston: Structured logging for debugging and monitoring.
lru-cache: In-memory caching (lru-cache@10.0.0) for API responses, reducing external calls.
Jest/Supertest: Industry-standard for unit (28 tests) and integration testing, with ts-jest for TypeScript.
Nock: Mocks Open-Meteo API calls for reliable, offline tests.
ESLint/Prettier: Enforce TypeScript best practices and formatting.
ts-node: Runs TypeScript during development.
Jest Fake Timers: Used in OpenMeteoDataSource.test.ts to test cache TTL without real setTimeout.

These choices prioritize performance, developer experience, and alignment with the project’s requirements.

## Omissions and Trade-offs

Omitted Redis: Used lru-cache for simplicity, as deployment isn’t required. Trade-off: Less suitable for distributed systems but sufficient for moderate load (1000 req/min).
Omitted Authentication: Not required by the assessment. Trade-off: Limits user-specific features but simplifies implementation.
Simplified Activity Ranking: Heuristic-based algorithm (temperature, precipitation, wind speed) instead of machine learning. Trade-off: Less precise but faster to implement.
Limited City Filters: Basic pagination (limit/offset) without advanced filters (e.g., by country). Trade-off: Reduced flexibility but meets core requirements.
Fixed Cache Issue: Resolved undefined cache error in OpenMeteoDataSource by mocking lru-cache and ensuring constructor initialization. Trade-off: Added test complexity but ensured reliability.
Worker Process Warning: Fixed by using Jest fake timers in OpenMeteoDataSource.test.ts. Trade-off: Simplified testing but requires careful timer management.

## Potential Improvements

Distributed Caching: Integrate Redis for scalable, persistent caching.
Query Complexity Limits: Use Apollo plugins to prevent complex query attacks.
Enhanced Ranking: Incorporate machine learning or user preferences for better activity rankings.
Additional Features: Add mutations for saving travel plans or filters for city suggestions.
Monitoring: Integrate Prometheus for metrics and advanced logging.
Integration Tests: Expand tests/integration/ with more end-to-end scenarios.
Schema Extensions: Add types/queries for hotel recommendations or travel itineraries.

## Query Examples
Below are sample GraphQL queries for the implemented features, using the schema defined in src/schema/types.ts.
1. City Suggestions
```sh
Search for cities matching "Paris" with pagination:
query {
  citySuggestions(query: "Paris", limit: 2, offset: 0) {
    id
    name
    latitude
    longitude
    country
    population
  }
}
```
Example Response:
```sh
{
  "data": {
    "citySuggestions": [
      {
        "id": "123",
        "name": "Paris",
        "latitude": 48.85341,
        "longitude": 2.3488,
        "country": "France",
        "population": 2165423
      },
      {
        "id": "124",
        "name": "Paris, TX",
        "latitude": 33.66094,
        "longitude": -95.55551,
        "country": "USA",
        "population": 24782
      }
    ]
  }
}
```
2. Weather Forecast
Get a 3-day weather forecast for Paris, France:
```sh
query {
  weatherForecast(cityLatitude: 48.85341, cityLongitude: 2.3488, forecastDays: 3) {
    date
    temperatureMax
    temperatureMin
    precipitationSum
    windSpeedMax
  }
}
```
Example Response:
```sh
{
  "data": {
    "weatherForecast": [
      {
        "date": "2025-08-15",
        "temperatureMax": 25.5,
        "temperatureMin": 15.5,
        "precipitationSum": 0,
        "windSpeedMax": 14.5
      },
      {
        "date": "2025-08-16",
        "temperatureMax": 26.0,
        "temperatureMin": 16.0,
        "precipitationSum": 2.0,
        "windSpeedMax": 12.0
      },
      {
        "date": "2025-08-17",
        "temperatureMax": 24.5,
        "temperatureMin": 14.5,
        "precipitationSum": 0,
        "windSpeedMax": 13.5
      }
    ]
  }
}
```
3. Activity Ranking
Rank activities for Paris, France based on a 1-day forecast:
```sh
query {
  activityRanking(cityLatitude: 48.85341, cityLongitude: 2.3488, forecastDays: 1) {
    type
    rank
    suitabilityScore
  }
}
```
Example Response:
```sh
{
  "data": {
    "activityRanking": [
      {
        "type": "OUTDOOR_SIGHTSEEING",
        "rank": 1,
        "suitabilityScore": 0.9
      },
      {
        "type": "INDOOR_SIGHTSEEING",
        "rank": 2,
        "suitabilityScore": 0.7
      },
      {
        "type": "SKIING",
        "rank": 3,
        "suitabilityScore": 0.2
      },
      {
        "type": "SURFING",
        "rank": 4,
        "suitabilityScore": 0.1
      }
    ]
  }
```
}
