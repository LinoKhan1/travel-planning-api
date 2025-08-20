// Importing dependencies for testing the OpenMeteoDataSource class
import { OpenMeteoDataSource } from '../../src/datasources/OpenMeteoDataSource';
import axios from 'axios';
import { LRUCache } from 'lru-cache';
import { City, WeatherForecast } from '../../src/schema/types';

// Mocking axios, axios-retry, and LRUCache to isolate external dependencies
jest.mock('axios');
jest.mock('lru-cache');

// Casting mocked axios and LRUCache to their respective Jest mocked types
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLRUCache = LRUCache as jest.MockedClass<typeof LRUCache>;

// Define mock environment variables for Open-Meteo API URLs
const mockEnv = {
  OPEN_METEO_GEOCODING_URL: 'https://geocoding-api.open-meteo.com/v1',
  OPEN_METEO_FORECAST_URL: 'https://api.open-meteo.com/v1',
};

// Create a mocked Axios instance to be returned by axios.create
const mockedAxiosInstance = {
  get: mockedAxios.get, // Use the same get method as mockedAxios.get
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  },
} as any; // Use 'as any' to satisfy TypeScript, as the mock is partial

// Configure axios.create mock globally to return the mocked instance
mockedAxios.create.mockReturnValue(mockedAxiosInstance);



// Test suite for OpenMeteoDataSource class
describe('OpenMeteoDataSource', () => {
  let dataSource: OpenMeteoDataSource;
  let mockCache: jest.Mocked<LRUCache<string, City[] | WeatherForecast[]>>;
  // Store original process.env to restore after each test
  let originalEnv: NodeJS.ProcessEnv;

  // Setup before each test case
  beforeEach(() => {
    // Clear all mocks to ensure a clean state for each test
    jest.clearAllMocks();
    // Store the original process.env to restore later
    originalEnv = { ...process.env };
    // Mock process.env with the test-specific environment variables
    process.env = { ...mockEnv };
    // Initialize mockCache with mocked get/set methods and static max/ttl properties
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      max: 1000,
      ttl: 1000 * 60 * 60,
    } as unknown as jest.Mocked<LRUCache<string, City[] | WeatherForecast[], unknown>>;
    // Mock LRUCache constructor to return mockCache, aligning with the specific types used in OpenMeteoDataSource
    mockedLRUCache.mockImplementation(
      (_options: LRUCache.Options<any, any, any>) =>
        mockCache as unknown as LRUCache<{}, {}, unknown>
    );
    // Create a fresh instance of OpenMeteoDataSource for each test
    dataSource = new OpenMeteoDataSource();
  });

  // Cleanup after each test case
  afterEach(() => {
    // Restore the original process.env to prevent test pollution
    process.env = originalEnv;
  });

  // Test suite for constructor initialization
  describe('constructor', () => {
    // Test case: Verify Axios client is initialized with correct configuration
    it('initializes Axios client with correct configuration', () => {
      // Assert that axios.create is called with the expected baseURL and timeout
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://geocoding-api.open-meteo.com/v1', // Matches OPEN_METEO_GEOCODING_URL
        timeout: 5000, // Matches the 5-second timeout in OpenMeteoDataSource
      });
    });

    // Test case: Verify LRU cache is initialized with correct settings
    it('initializes LRU cache with correct settings', () => {
      // Assert that LRUCache is instantiated with max=1000 and ttl=1 hour
      expect(mockedLRUCache).toHaveBeenCalledWith({
        max: 1000, // Matches the cache size limit in OpenMeteoDataSource
        ttl: 1000 * 60 * 60, // Matches the 1-hour TTL in OpenMeteoDataSource
      });
    });
  });

  // Test suite for searchCities method
  describe('searchCities', () => {
    // Mock response for a successful geocoding API call
    const mockGeocodingResponse = {
      results: [
        {
          id: 1,
          name: 'London',
          latitude: 51.5074,
          longitude: -0.1278,
          country: 'UK',
          population: 9000000,
        },
      ],
    };

    // Expected output after mapping the mock response to City type
    const expectedCities: City[] = [
      {
        id: '1', // ID is converted to string as per OpenMeteoDataSource mapping
        name: 'London',
        latitude: 51.5074,
        longitude: -0.1278,
        country: 'UK',
        population: 9000000,
      },
    ];

    // Test case: Verify successful city fetching and mapping
    it('fetches and maps cities correctly', async () => {
      // Mock a successful Axios response with mockGeocodingResponse
      mockedAxios.get.mockResolvedValue({
        data: mockGeocodingResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/search',
          headers: {},
          method: 'get',
        },
      });
      // Call searchCities with query 'London' and limit 10
      const result = await dataSource.searchCities('London', 10);
      // Assert that axios.get was called with the correct endpoint and parameters
      expect(mockedAxios.get).toHaveBeenCalledWith('/search', {
        params: { name: 'London', count: 10, language: 'en' },
      });
      // Assert that the response is correctly mapped to City objects
      expect(result).toEqual(expectedCities);
      // Assert that the result is cached with the correct key
      expect(mockCache.set).toHaveBeenCalledWith('city:London:10', expectedCities);
    });

    // Test case: Verify cached results are returned without API call
    it('returns cached results for same query and limit', async () => {
      // Mock cache to return expectedCities for the cache key
      mockCache.get.mockReturnValue(expectedCities);
      // Call searchCities with the same query and limit
      const result = await dataSource.searchCities('London', 10);
      // Assert that cache.get was called with the correct key
      expect(mockCache.get).toHaveBeenCalledWith('city:London:10');
      // Assert that no API call was made
      expect(mockedAxios.get).not.toHaveBeenCalled();
      // Assert that the cached result is returned
      expect(result).toEqual(expectedCities);
    });

    // Test case: Verify handling of empty API results
    it('handles empty results', async () => {
      // Mock an Axios response with empty results
      mockedAxios.get.mockResolvedValue({
        data: { results: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/search',
          headers: {},
          method: 'get',
        },
      });
      // Call searchCities with a query that yields no results
      const result = await dataSource.searchCities('Unknown', 10);
      // Assert that an empty array is returned
      expect(result).toEqual([]);
      // Assert that the empty result is cached
      expect(mockCache.set).toHaveBeenCalledWith('city:Unknown:10', []);
    });

    // Test case: Verify handling of special characters in query
    it('handles special characters in query', async () => {
      // Mock a successful Axios response with mockGeocodingResponse
      mockedAxios.get.mockResolvedValue({
        data: mockGeocodingResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/search',
          headers: {},
          method: 'get',
        },
      });
      // Call searchCities with a query containing special characters
      await dataSource.searchCities('São Paulo', 5);
      // Assert that axios.get was called with correctly encoded parameters
      expect(mockedAxios.get).toHaveBeenCalledWith('/search', {
        params: { name: 'São Paulo', count: 5, language: 'en' },
      });
    });

  
  });

  // Test suite for getWeatherForecast method
  describe('getWeatherForecast', () => {
    // Mock response for a successful weather forecast API call
    const mockWeatherResponse = {
      daily: {
        time: ['2025-08-21'],
        temperature_2m_max: [25],
        temperature_2m_min: [15],
        precipitation_sum: [0],
        wind_speed_10m_max: [10],
      },
    };

    // Expected output after mapping the mock response to WeatherForecast type
    const expectedForecasts: WeatherForecast[] = [
      {
        date: '2025-08-21',
        temperatureMax: 25,
        temperatureMin: 15,
        precipitationSum: 0,
        windSpeedMax: 10,
      },
    ];

    // Test case: Verify successful forecast fetching and mapping
    it('fetches and maps forecasts correctly', async () => {
      // Mock a successful Axios response with mockWeatherResponse
      mockedAxios.get.mockResolvedValue({
        data: mockWeatherResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/forecast',
          headers: {},
          method: 'get',
        },
      });
      // Call getWeatherForecast with valid coordinates and forecast days
      const result = await dataSource.getWeatherForecast(51.5074, -0.1278, 7);
      // Assert that axios.get was called with the correct endpoint and parameters
      expect(mockedAxios.get).toHaveBeenCalledWith('/forecast', {
        baseURL: 'https://api.open-meteo.com/v1',
        params: {
          latitude: 51.5074,
          longitude: -0.1278,
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
          timezone: 'auto',
          forecast_days: 7,
        },
      });
      // Assert that the response is correctly mapped to WeatherForecast objects
      expect(result).toEqual(expectedForecasts);
      // Assert that the result is cached with the correct key
      expect(mockCache.set).toHaveBeenCalledWith('forecast:51.5074:-0.1278:7', expectedForecasts);
    });

    // Test case: Verify cached results are returned without API call
    it('returns cached results for same parameters', async () => {
      // Mock cache to return expectedForecasts for the cache key
      mockCache.get.mockReturnValue(expectedForecasts);
      // Call getWeatherForecast with the same parameters
      const result = await dataSource.getWeatherForecast(51.5074, -0.1278, 7);
      // Assert that cache.get was called with the correct key
      expect(mockCache.get).toHaveBeenCalledWith('forecast:51.5074:-0.1278:7');
      // Assert that no API call was made
      expect(mockedAxios.get).not.toHaveBeenCalled();
      // Assert that the cached result is returned
      expect(result).toEqual(expectedForecasts);
    });

    // Test case: Verify handling of invalid latitude
    it('handles invalid latitude', async () => {
      // Mock an Axios error response for invalid latitude (400 Bad Request)
      mockedAxios.get.mockRejectedValue({
        response: {
          status: 400,
          statusText: 'Bad Request',
          headers: {},
          config: { url: '/forecast', headers: {}, method: 'get' },
        },
      });
      // Assert that getWeatherForecast throws an error for invalid latitude
      await expect(dataSource.getWeatherForecast(91, -0.1278, 7)).rejects.toThrow('Failed to fetch weather forecast:');
    });

    // Test case: Verify handling of zero forecast days
    it('handles zero forecast days', async () => {
      // Mock an Axios response with empty daily arrays
      mockedAxios.get.mockResolvedValue({
        data: {
          daily: {
            time: [],
            temperature_2m_max: [],
            temperature_2m_min: [],
            precipitation_sum: [],
            wind_speed_10m_max: [],
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {
          url: '/forecast',
          headers: {},
          method: 'get',
        },
      });
      // Call getWeatherForecast with zero forecast days
      const result = await dataSource.getWeatherForecast(51.5074, -0.1278, 0);
      // Assert that an empty array is returned
      expect(result).toEqual([]);
      // Assert that the empty result is cached
      expect(mockCache.set).toHaveBeenCalledWith('forecast:51.5074:-0.1278:0', []);
    });
  });
});