import { OpenMeteoDataSource } from '../../src/datasources/OpenMeteoDataSource';
import nock from 'nock';
import { City, WeatherForecast } from '../../src/schema/types';
import { LRUCache } from 'lru-cache';

// Mock environment variables
process.env.OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1';
process.env.OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1';

describe('OpenMeteoDataSource', () => {
  let dataSource: OpenMeteoDataSource;

  beforeEach(() => {
    // Initialize data source
    dataSource = new OpenMeteoDataSource();
    // Clear cache for isolation
    (dataSource as any).cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 60,
    });
    // Use fake timers for TTL
    jest.useFakeTimers();
    // Prevent real network requests
    nock.disableNetConnect();
  });

  afterEach(() => {
    // Clean up mocks and timers
    nock.cleanAll();
    nock.enableNetConnect();
    jest.runAllTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize Axios client and LRU cache', async () => {
      expect(dataSource['client']).toBeDefined();
      expect(dataSource['client'].defaults.baseURL).toBe('https://geocoding-api.open-meteo.com/v1');
      expect(dataSource['cache']).toBeInstanceOf(LRUCache);
      expect(dataSource['cache'].max).toBe(1000);
    }, 10000);
  });

  describe('searchCities', () => {
    it('should fetch and return cities for a valid query', async () => {
      const mockResponse = {
        results: [
          {
            id: 2988507,
            name: 'Paris',
            latitude: 48.85341,
            longitude: 2.3488,
            country: 'France',
            population: 2138551,
          },
        ],
      };
      nock('https://geocoding-api.open-meteo.com')
        .get('/v1/search')
        .query({ name: 'Paris', count: '2', language: 'en' })
        .reply(200, mockResponse);

      const result = await dataSource.searchCities('Paris', 2);
      const expected: City[] = [
        {
          id: '2988507',
          name: 'Paris',
          latitude: 48.85341,
          longitude: 2.3488,
          country: 'France',
          population: 2138551,
        },
      ];
      expect(result).toEqual(expected);
      expect(dataSource['cache'].get('city:Paris:2')).toEqual(expected);
      expect(nock.pendingMocks().length).toBe(0);
    }, 10000);

    it('should return cached cities if available', async () => {
      const cachedCities: City[] = [
        {
          id: '2988507',
          name: 'Paris',
          latitude: 48.85341,
          longitude: 2.3488,
          country: 'France',
          population: 2138551,
        },
      ];
      dataSource['cache'].set('city:Paris:2', cachedCities);

      const result = await dataSource.searchCities('Paris', 2);
      expect(result).toEqual(cachedCities);
      expect(nock.pendingMocks().length).toBe(0);
    }, 10000);

    it('should return empty array for no results and cache it', async () => {
      nock('https://geocoding-api.open-meteo.com')
        .get('/v1/search')
        .query({ name: 'NonExistent', count: '2', language: 'en' })
        .reply(200, { results: [] });

      const result = await dataSource.searchCities('NonExistent', 2);
      expect(result).toEqual([]);
      expect(dataSource['cache'].get('city:NonExistent:2')).toEqual([]);
      expect(nock.pendingMocks().length).toBe(0);
    }, 10000);

    it('should throw error for network failure', async () => {
      nock('https://geocoding-api.open-meteo.com')
        .get('/v1/search')
        .query({ name: 'Paris', count: '2', language: 'en' })
        .replyWithError({ message: 'Network Error', code: 'ECONNABORTED' });

      await expect(dataSource.searchCities('Paris', 2)).rejects.toThrow('Failed to fetch cities: Network Error');
      expect(nock.pendingMocks().length).toBe(0);
    }, 10000);
  });

  describe('getWeatherForecast', () => {
    it('should fetch and return weather forecast for valid coordinates', async () => {
      const mockResponse = {
        daily: {
          time: ['2025-08-14'],
          temperature_2m_max: [25.5],
          temperature_2m_min: [15.5],
          precipitation_sum: [0],
          wind_speed_10m_max: [14.5],
        },
      };
      nock('https://api.open-meteo.com')
        .get('/v1/forecast')
        .query({
          latitude: '48.85341',
          longitude: '2.3488',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
          timezone: 'auto',
          forecast_days: '1',
        })
        .reply(200, mockResponse);

      const result = await dataSource.getWeatherForecast(48.85341, 2.3488, 1);
      const expected: WeatherForecast[] = [
        {
          date: '2025-08-14',
          temperatureMax: 25.5,
          temperatureMin: 15.5,
          precipitationSum: 0,
          windSpeedMax: 14.5,
        },
      ];
      expect(result).toEqual(expected);
      expect(dataSource['cache'].get('forecast:48.85341:2.3488:1')).toEqual(expected);
      expect(nock.pendingMocks().length).toBe(0);
    }, 10000);

    it('should return cached forecast if available', async () => {
      const cachedForecast: WeatherForecast[] = [
        {
          date: '2025-08-14',
          temperatureMax: 25.5,
          temperatureMin: 15.5,
          precipitationSum: 0,
          windSpeedMax: 14.5,
        },
      ];
      dataSource['cache'].set('forecast:48.85341:2.3488:1', cachedForecast);

      const result = await dataSource.getWeatherForecast(48.85341, 2.3488, 1);
      expect(result).toEqual(cachedForecast);
      expect(nock.pendingMocks().length).toBe(0);
    }, 10000);

    it('should throw error for invalid coordinates', async () => {
      nock('https://api.open-meteo.com')
        .get('/v1/forecast')
        .query({
          latitude: '999',
          longitude: '2.3488',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
          timezone: 'auto',
          forecast_days: '1',
        })
        .reply(400, { error: 'Invalid latitude' });

      await expect(dataSource.getWeatherForecast(999, 2.3488, 1)).rejects.toThrow('Failed to fetch weather forecast: Request failed with status code 400');
      expect(nock.pendingMocks().length).toBe(0);
    }, 10000);

    it('should retry on 429 rate limit and succeed', async () => {
      nock('https://api.open-meteo.com')
        .get('/v1/forecast')
        .query({
          latitude: '48.85341',
          longitude: '2.3488',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
          timezone: 'auto',
          forecast_days: '1',
        })
        .times(2)
        .reply(429, { error: 'Too many requests' })
        .get('/v1/forecast')
        .query({
          latitude: '48.85341',
          longitude: '2.3488',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
          timezone: 'auto',
          forecast_days: '1',
        })
        .reply(200, {
          daily: {
            time: ['2025-08-14'],
            temperature_2m_max: [25.5],
            temperature_2m_min: [15.5],
            precipitation_sum: [0],
            wind_speed_10m_max: [14.5],
          },
        });

      const result = await dataSource.getWeatherForecast(48.85341, 2.3488, 1);
      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('2025-08-14');
      expect(nock.pendingMocks().length).toBe(0);
    }, 15000);

    it('should handle cache TTL expiration', async () => {
      const cachedForecast: WeatherForecast[] = [
        {
          date: '2025-08-14',
          temperatureMax: 25.5,
          temperatureMin: 15.5,
          precipitationSum: 0,
          windSpeedMax: 14.5,
        },
      ];
      dataSource['cache'].set('forecast:48.85341:2.3488:1', cachedForecast, { ttl: 1000 });

      // Advance time and run timers
      jest.advanceTimersByTime(2000);
      jest.runAllTimers();

      nock('https://api.open-meteo.com')
        .get('/v1/forecast')
        .query({
          latitude: '48.85341',
          longitude: '2.3488',
          daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
          timezone: 'auto',
          forecast_days: '1',
        })
        .reply(200, {
          daily: {
            time: ['2025-08-14'],
            temperature_2m_max: [26.0],
            temperature_2m_min: [16.0],
            precipitation_sum: [1.0],
            wind_speed_10m_max: [15.0],
          },
        });

      const result = await dataSource.getWeatherForecast(48.85341, 2.3488, 1);
      expect(result[0].temperatureMax).toBe(26.0);
      expect(nock.pendingMocks().length).toBe(0);
    }, 10000);
  });
});