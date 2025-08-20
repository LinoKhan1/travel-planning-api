// Importing dependencies for testing resolvers
import { resolvers } from '../../src/resolvers/resolvers';
import { ApolloError } from 'apollo-server';
import { OpenMeteoDataSource } from '../../src/datasources/OpenMeteoDataSource';
import { rankActivities } from '../../src/utils/activityRanking';
import { getComplexity } from 'graphql-query-complexity';
import {
  City,
  WeatherForecast,
  Activity,
  ActivityType,
} from '../../src/schema/types';
import { DocumentNode, GraphQLSchema } from 'graphql';

// Mocking dependencies to isolate resolver logic
jest.mock('../../src/datasources/OpenMeteoDataSource');
jest.mock('../../src/utils/activityRanking');
jest.mock('graphql-query-complexity');

// Mocked getComplexity function
const mockedGetComplexity = getComplexity as jest.MockedFunction<
  typeof getComplexity
>;

// Mocked rankActivities function
const mockedRankActivities = rankActivities as jest.MockedFunction<
  typeof rankActivities
>;

// Test suite for GraphQL resolvers
describe('Resolvers', () => {
  // Mock context with dataSources
  let mockContext: {
    dataSources: { openMeteo: jest.Mocked<OpenMeteoDataSource> };
  };
  let mockInfo: { schema: GraphQLSchema; operation: DocumentNode };

  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Initialize mock context with mocked OpenMeteoDataSource
    mockContext = {
      dataSources: {
        openMeteo: {
          searchCities: jest.fn<Promise<City[]>, [string, number]>(),
          getWeatherForecast: jest.fn<
            Promise<WeatherForecast[]>,
            [number, number, number]
          >(),
        } as unknown as jest.Mocked<OpenMeteoDataSource>,
      },
    };
    // Mock GraphQL info object
    mockInfo = {
      schema: {} as GraphQLSchema,
      operation: {} as DocumentNode,
    };
  });

  // Test suite for Query.citySuggestions
  describe('Query.citySuggestions', () => {
    // Mock city data
    const mockCities: City[] = [
      {
        id: '1',
        name: 'London',
        latitude: 51.5074,
        longitude: -0.1278,
        country: 'UK',
        population: 9000000,
      },
      {
        id: '2',
        name: 'London, ON',
        latitude: 42.9849,
        longitude: -81.2453,
        country: 'CA',
        population: 400000,
      },
    ];

    // Happy path: Fetch and paginate cities
    it('fetches and paginates cities correctly', async () => {
      mockContext.dataSources.openMeteo.searchCities.mockResolvedValue(
        mockCities
      );
      mockedGetComplexity.mockReturnValue(500); // Complexity below threshold
      const citySuggestionsResolver = resolvers.Query!
        .citySuggestions as jest.MockedFunction<any>;
      const result = await citySuggestionsResolver(
        undefined,
        { query: 'London', limit: 1, offset: 1 },
        mockContext,
        mockInfo
      );

      expect(
        mockContext.dataSources.openMeteo.searchCities
      ).toHaveBeenCalledWith('London', 2); // limit + offset
      expect(mockedGetComplexity).toHaveBeenCalledWith({
        schema: mockInfo.schema,
        query: mockInfo.operation,
        variables: { query: 'London', limit: 1, offset: 1 },
        estimators: expect.any(Array),
      });
      expect(result).toEqual([mockCities[1]]); // Paginated slice
    });

    // Edge case: Zero limit
    it('handles zero limit', async () => {
      mockContext.dataSources.openMeteo.searchCities.mockResolvedValue(
        mockCities
      );
      mockedGetComplexity.mockReturnValue(500);
      const citySuggestionsResolver = resolvers.Query!
        .citySuggestions as jest.MockedFunction<any>;
      const result = await citySuggestionsResolver(
        undefined,
        { query: 'London', limit: 0, offset: 0 },
        mockContext,
        mockInfo
      );
      expect(
        mockContext.dataSources.openMeteo.searchCities
      ).toHaveBeenCalledWith('London', 0);
      expect(result).toEqual([]);
    });

    // Edge case: High offset
    it('handles high offset beyond available cities', async () => {
      mockContext.dataSources.openMeteo.searchCities.mockResolvedValue(
        mockCities
      );
      mockedGetComplexity.mockReturnValue(500);
      const citySuggestionsResolver = resolvers.Query!
        .citySuggestions as jest.MockedFunction<any>;
      const result = await citySuggestionsResolver(
        undefined,
        { query: 'London', limit: 1, offset: 10 },
        mockContext,
        mockInfo
      );
      expect(
        mockContext.dataSources.openMeteo.searchCities
      ).toHaveBeenCalledWith('London', 11);
      expect(result).toEqual([]);
    });

    // Error case: Empty results
    it('throws NOT_FOUND error for empty results', async () => {
      mockContext.dataSources.openMeteo.searchCities.mockResolvedValue([]);
      mockedGetComplexity.mockReturnValue(500);

      await expect(
        (resolvers.Query!.citySuggestions as Function)(
          undefined,
          { query: 'Unknown', limit: 10, offset: 0 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError('City search failed: No cities found for the given query', 'NOT_FOUND')
      );
    });

    // Error case: Data source error
    it('throws SEARCH_FAILED error when searchCities fails', async () => {
      mockContext.dataSources.openMeteo.searchCities.mockRejectedValue(
        new Error('API error')
      );
      mockedGetComplexity.mockReturnValue(500);
      await expect(
        (resolvers.Query!.citySuggestions as Function)(
          undefined,
          { query: 'London', limit: 10, offset: 0 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError('City search failed: API error', 'SEARCH_FAILED')
      );
    });

    // Complexity check: Exceeds threshold
    it('throws COMPLEXITY_EXCEEDED error for high complexity', async () => {
      mockedGetComplexity.mockReturnValue(1001);
      await expect(
        (resolvers.Query!.citySuggestions as Function)(
          undefined,
          { query: 'London', limit: 10, offset: 0 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError(
          'Query too complex: 1001 exceeds limit of 1000',
          'COMPLEXITY_EXCEEDED'
        )
      );
      expect(
        mockContext.dataSources.openMeteo.searchCities
      ).not.toHaveBeenCalled();
    });
  });

  // Test suite for Query.weatherForecast
  describe('Query.weatherForecast', () => {
    // Mock forecast data
    const mockForecast: WeatherForecast[] = [
      {
        date: '2025-08-21',
        temperatureMax: 25,
        temperatureMin: 15,
        precipitationSum: 0,
        windSpeedMax: 10,
      },
    ];

    // Happy path: Fetch forecast
    it('fetches weather forecast correctly', async () => {
      mockContext.dataSources.openMeteo.getWeatherForecast.mockResolvedValue(
        mockForecast
      );
      mockedGetComplexity.mockReturnValue(500);
      const weatherForecastResolver = resolvers.Query!
        .weatherForecast as jest.MockedFunction<any>;
      const result = await weatherForecastResolver(
        undefined,
        { cityLatitude: 51.5074, cityLongitude: -0.1278, forecastDays: 7 },
        mockContext,
        mockInfo
      );
      expect(
        mockContext.dataSources.openMeteo.getWeatherForecast
      ).toHaveBeenCalledWith(51.5074, -0.1278, 7);
      expect(mockedGetComplexity).toHaveBeenCalledWith({
        schema: mockInfo.schema,
        query: mockInfo.operation,
        variables: {
          cityLatitude: 51.5074,
          cityLongitude: -0.1278,
          forecastDays: 7,
        },
        estimators: expect.any(Array),
      });
      expect(result).toEqual(mockForecast);
    });

    // Edge case: Zero forecast days
    it('handles zero forecast days', async () => {
      mockContext.dataSources.openMeteo.getWeatherForecast.mockResolvedValue(
        []
      );
      mockedGetComplexity.mockReturnValue(500);
      await expect(
        (resolvers.Query!.weatherForecast! as Function)(
          undefined,
          { cityLatitude: 51.5074, cityLongitude: -0.1278, forecastDays: 0 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError('Weather forecast failed: No weather forecast available', 'NO_FORECAST')
      );
    });

    // Error case: Invalid latitude
    it('throws FORECAST_FAILED error for invalid latitude', async () => {
      mockContext.dataSources.openMeteo.getWeatherForecast.mockRejectedValue(
        new Error('Invalid latitude')
      );
      mockedGetComplexity.mockReturnValue(500);
      await expect(
        (resolvers.Query!.weatherForecast! as Function)(
          undefined,
          { cityLatitude: 91, cityLongitude: -0.1278, forecastDays: 7 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError(
          'Weather forecast failed: Invalid latitude',
          'FORECAST_FAILED'
        )
      );
    });

    // Error case: Empty forecast
    it('throws NO_FORECAST error for empty forecast', async () => {
      mockContext.dataSources.openMeteo.getWeatherForecast.mockResolvedValue(
        []
      );
      mockedGetComplexity.mockReturnValue(500);
      await expect(
        (resolvers.Query!.weatherForecast! as Function)(
          undefined,
          { cityLatitude: 51.5074, cityLongitude: -0.1278, forecastDays: 7 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError('Weather forecast failed: No weather forecast available', 'NO_FORECAST')
      );
    });

    // Complexity check: Exceeds threshold
    it('throws COMPLEXITY_EXCEEDED error for high complexity', async () => {
      mockedGetComplexity.mockReturnValue(1001);
      await expect(
        (resolvers.Query!.weatherForecast! as Function)(
          undefined,
          { cityLatitude: 51.5074, cityLongitude: -0.1278, forecastDays: 7 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError(
          'Query too complex: 1001 exceeds limit of 1000',
          'COMPLEXITY_EXCEEDED'
        )
      );
      expect(
        mockContext.dataSources.openMeteo.getWeatherForecast
      ).not.toHaveBeenCalled();
    });
  });

  // Test suite for Query.activityRanking
  describe('Query.activityRanking', () => {
    // Mock forecast and ranked activities
    const mockForecast: WeatherForecast[] = [
      {
        date: '2025-08-21',
        temperatureMax: 25,
        temperatureMin: 15,
        precipitationSum: 0,
        windSpeedMax: 10,
      },
    ];
    const mockRankedActivities: Activity[] = [
      {
        rank: 1,
        suitabilityScore: 0.9,
        type: ActivityType.OutdoorSightseeing, // Hiking outdoors
        __typename: 'Activity',
      },
      {
        rank: 2,
        suitabilityScore: 0.8,
        type: ActivityType.IndoorSightseeing, // Museums, galleries
        __typename: 'Activity',
      },
      {
        rank: 3,
        suitabilityScore: 0.7,
        type: ActivityType.Skiing, // Cold/snow conditions
        __typename: 'Activity',
      },
      {
        rank: 4,
        suitabilityScore: 0.6,
        type: ActivityType.Surfing, // Warm/coastal conditions
        __typename: 'Activity',
      },
    ];

    // Happy path: Fetch and rank activities
    it('fetches and ranks activities correctly', async () => {
      mockContext.dataSources.openMeteo.getWeatherForecast.mockResolvedValue(
        mockForecast
      );
      mockedRankActivities.mockReturnValue(mockRankedActivities);
      mockedGetComplexity.mockReturnValue(500);
      const activityRankingResolver = resolvers.Query!
        .activityRanking as jest.MockedFunction<any>;
      const result = await activityRankingResolver(
        undefined,
        { cityLatitude: 51.5074, cityLongitude: -0.1278, forecastDays: 7 },
        mockContext,
        mockInfo
      );
      expect(
        mockContext.dataSources.openMeteo.getWeatherForecast
      ).toHaveBeenCalledWith(51.5074, -0.1278, 7);
      expect(mockedRankActivities).toHaveBeenCalledWith(mockForecast);
      expect(mockedGetComplexity).toHaveBeenCalledWith({
        schema: mockInfo.schema,
        query: mockInfo.operation,
        variables: {
          cityLatitude: 51.5074,
          cityLongitude: -0.1278,
          forecastDays: 7,
        },
        estimators: expect.any(Array),
      });
      expect(result).toEqual(mockRankedActivities);
    });

    // Edge case: Zero forecast days
    it('throws NO_FORECAST error for empty forecast', async () => {
      mockContext.dataSources.openMeteo.getWeatherForecast.mockResolvedValue(
        []
      );
      mockedGetComplexity.mockReturnValue(500);
      await expect(
        (resolvers.Query!.activityRanking! as Function)(
          undefined,
          { cityLatitude: 51.5074, cityLongitude: -0.1278, forecastDays: 0 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError(
          'Activity ranking failed: No weather forecast available for ranking',
          'NO_FORECAST'
        )
      );
      expect(mockedRankActivities).not.toHaveBeenCalled();
    });

    // Error case: Data source error
    it('throws RANKING_FAILED error when getWeatherForecast fails', async () => {
      mockContext.dataSources.openMeteo.getWeatherForecast.mockRejectedValue(
        new Error('API error')
      );
      mockedGetComplexity.mockReturnValue(500);
      await expect(
        (resolvers.Query!.activityRanking! as Function)(
          undefined,
          { cityLatitude: 51.5074, cityLongitude: -0.1278, forecastDays: 7 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError('Activity ranking failed: API error', 'RANKING_FAILED')
      );
      expect(mockedRankActivities).not.toHaveBeenCalled();
    });

    // Error case: rankActivities error
    it('throws RANKING_FAILED error when rankActivities fails', async () => {
      mockContext.dataSources.openMeteo.getWeatherForecast.mockResolvedValue(
        mockForecast
      );
      mockedRankActivities.mockImplementation(() => {
        throw new Error('Ranking error');
      });
      mockedGetComplexity.mockReturnValue(500);
      await expect(
        (resolvers.Query!.activityRanking! as Function)(
          undefined,
          { cityLatitude: 51.5074, cityLongitude: -0.1278, forecastDays: 7 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError(
          'Activity ranking failed: Ranking error',
          'RANKING_FAILED'
        )
      );
    });

    // Complexity check: Exceeds threshold
    it('throws COMPLEXITY_EXCEEDED error for high complexity', async () => {
      mockedGetComplexity.mockReturnValue(1001);
      await expect(
        (resolvers.Query!.activityRanking! as Function)(
          undefined,
          { cityLatitude: 51.5074, cityLongitude: -0.1278, forecastDays: 7 },
          mockContext,
          mockInfo
        )
      ).rejects.toThrow(
        new ApolloError(
          'Query too complex: 1001 exceeds limit of 1000',
          'COMPLEXITY_EXCEEDED'
        )
      );
      expect(
        mockContext.dataSources.openMeteo.getWeatherForecast
      ).not.toHaveBeenCalled();
      expect(mockedRankActivities).not.toHaveBeenCalled();
    });
  });
});
