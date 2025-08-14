import { rankActivities } from '../../src/utils/activityRanking';
import { mean } from 'lodash';
import { WeatherForecast, Activity, ActivityType } from '../../src/schema/types';

// Mocking lodash mean function
jest.mock('lodash');
const mockedMean = mean as jest.MockedFunction<typeof mean>;

describe('rankActivities', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should return Activity[] with correct ranks and scores for warm, dry weather', async () => {
    // Mock weather data: Paris, warm and dry (25.5°C, 0 mm precip, 14.5 km/h wind)
    const mockForecast: WeatherForecast[] = [
      { date: '2025-08-15', temperatureMax: 26.5, temperatureMin: 24.5, precipitationSum: 0, windSpeedMax: 14.5 },
    ];
    // Mock mean calculations
    mockedMean
      .mockReturnValueOnce(25.5) // avgTemp = (26.5 + 24.5) / 2
      .mockReturnValueOnce(0) // avgPrecip
      .mockReturnValueOnce(14.5); // avgWind

    const result = rankActivities(mockForecast);

    expect(result).toEqual([
      { type: ActivityType.OutdoorSightseeing, rank: 1, suitabilityScore: 0.9 }, // Warm, dry
      { type: ActivityType.IndoorSightseeing, rank: 2, suitabilityScore: 0.3 }, // Low precip
      { type: ActivityType.Surfing, rank: 3, suitabilityScore: 0.2 }, // Wind not optimal
      { type: ActivityType.Skiing, rank: 4, suitabilityScore: 0.1 }, // Not cold
    ]);
    expect(mockedMean).toHaveBeenCalledTimes(3);
  });

  it('should return Activity[] with correct ranks for cold, snowy weather', async () => {
    // Mock weather data: Cold, snowy (0°C, 5 mm precip, 10 km/h wind)
    const mockForecast: WeatherForecast[] = [
      { date: '2025-08-15', temperatureMax: 2, temperatureMin: -2, precipitationSum: 5, windSpeedMax: 10 },
    ];
    // Mock mean calculations
    mockedMean
      .mockReturnValueOnce(0) // avgTemp = (2 + -2) / 2
      .mockReturnValueOnce(5) // avgPrecip
      .mockReturnValueOnce(10); // avgWind

    const result = rankActivities(mockForecast);

    expect(result).toEqual([
      { type: ActivityType.Skiing, rank: 1, suitabilityScore: 0.9 }, // Cold, snowy
      { type: ActivityType.IndoorSightseeing, rank: 2, suitabilityScore: 0.8 }, // High precip
      { type: ActivityType.Surfing, rank: 3, suitabilityScore: 0.2 }, // Not windy
      { type: ActivityType.OutdoorSightseeing, rank: 4, suitabilityScore: 0.2 }, // Cold, wet
    ]);
    expect(mockedMean).toHaveBeenCalledTimes(3);
  });

  it('should return Activity[] with correct ranks for warm, windy weather', async () => {
    // Mock weather data: Warm, windy (25°C, 1 mm precip, 20 km/h wind)
    const mockForecast: WeatherForecast[] = [
      { date: '2025-08-15', temperatureMax: 27, temperatureMin: 23, precipitationSum: 1, windSpeedMax: 20 },
    ];
    // Mock mean calculations
    mockedMean
      .mockReturnValueOnce(25) // avgTemp = (27 + 23) / 2
      .mockReturnValueOnce(1) // avgPrecip
      .mockReturnValueOnce(20); // avgWind

    const result = rankActivities(mockForecast);

    expect(result).toEqual([
      { type: ActivityType.OutdoorSightseeing, rank: 1, suitabilityScore: 0.9 }, // Warm, low precip
      { type: ActivityType.Surfing, rank: 2, suitabilityScore: 0.7 }, // Warm, optimal wind
      { type: ActivityType.IndoorSightseeing, rank: 3, suitabilityScore: 0.3 }, // Low precip
      { type: ActivityType.Skiing, rank: 4, suitabilityScore: 0.1 }, // Not cold
    ]);
    expect(mockedMean).toHaveBeenCalledTimes(3);
  });

  it('should return Activity[] with correct ranks for rainy weather', async () => {
    // Mock weather data: Moderate temp, rainy (15°C, 5 mm precip, 10 km/h wind)
    const mockForecast: WeatherForecast[] = [
      { date: '2025-08-15', temperatureMax: 17, temperatureMin: 13, precipitationSum: 5, windSpeedMax: 10 },
    ];
    // Mock mean calculations
    mockedMean
      .mockReturnValueOnce(15) // avgTemp = (17 + 13) / 2
      .mockReturnValueOnce(5) // avgPrecip
      .mockReturnValueOnce(10); // avgWind

    const result = rankActivities(mockForecast);

    expect(result).toEqual([
      { type: ActivityType.IndoorSightseeing, rank: 1, suitabilityScore: 0.8 }, // High precip
      { type: ActivityType.Surfing, rank: 2, suitabilityScore: 0.2 }, // Not windy
      { type: ActivityType.OutdoorSightseeing, rank: 3, suitabilityScore: 0.2 }, // Rainy
      { type: ActivityType.Skiing, rank: 4, suitabilityScore: 0.1 }, // Not cold
    ]);
    expect(mockedMean).toHaveBeenCalledTimes(3);
  });

  it('should handle empty forecast array', async () => {
    // Mock empty forecast
    const mockForecast: WeatherForecast[] = [];
    // Mock mean to handle empty arrays
    mockedMean.mockReturnValue(0); // Default for empty arrays

    const result = rankActivities(mockForecast);

    expect(result).toEqual([
      { type: ActivityType.IndoorSightseeing, rank: 1, suitabilityScore: 0.3 },
      { type: ActivityType.Surfing, rank: 2, suitabilityScore: 0.2 },
      { type: ActivityType.OutdoorSightseeing, rank: 3, suitabilityScore: 0.2 },
      { type: ActivityType.Skiing, rank: 4, suitabilityScore: 0.1 },
    ]);
    expect(mockedMean).toHaveBeenCalledTimes(3);
  });

  it('should handle extreme temperatures', async () => {
    // Mock weather data: Extremely hot (40°C, 0 mm precip, 10 km/h wind)
    const mockForecast: WeatherForecast[] = [
      { date: '2025-08-15', temperatureMax: 42, temperatureMin: 38, precipitationSum: 0, windSpeedMax: 10 },
    ];
    // Mock mean calculations
    mockedMean
      .mockReturnValueOnce(40) // avgTemp = (42 + 38) / 2
      .mockReturnValueOnce(0) // avgPrecip
      .mockReturnValueOnce(10); // avgWind

    const result = rankActivities(mockForecast);

    expect(result).toEqual([
      { type: ActivityType.IndoorSightseeing, rank: 1, suitabilityScore: 0.3 }, // Not rainy
      { type: ActivityType.Surfing, rank: 2, suitabilityScore: 0.2 }, // Not windy
      { type: ActivityType.OutdoorSightseeing, rank: 3, suitabilityScore: 0.2 }, // Too hot
      { type: ActivityType.Skiing, rank: 4, suitabilityScore: 0.1 }, // Not cold
    ]);
    expect(mockedMean).toHaveBeenCalledTimes(3);
  });

  it('should include all ActivityType values with ranks 1–4 and scores 0–1', async () => {
    // Mock weather data: Moderate conditions
    const mockForecast: WeatherForecast[] = [
      { date: '2025-08-15', temperatureMax: 20, temperatureMin: 10, precipitationSum: 1, windSpeedMax: 15 },
    ];
    // Mock mean calculations
    mockedMean
      .mockReturnValueOnce(15) // avgTemp = (20 + 10) / 2
      .mockReturnValueOnce(1) // avgPrecip
      .mockReturnValueOnce(15); // avgWind

    const result = rankActivities(mockForecast);

    const expectedTypes = [
      ActivityType.Skiing,
      ActivityType.Surfing,
      ActivityType.IndoorSightseeing,
      ActivityType.OutdoorSightseeing,
    ];
    expect(result.map(a => a.type)).toEqual(expect.arrayContaining(expectedTypes));
    expect(result).toHaveLength(4);
    expect(result.every(a => a.rank >= 1 && a.rank <= 4)).toBe(true);
    expect(result.every(a => a.suitabilityScore >= 0 && a.suitabilityScore <= 1)).toBe(true);
    expect(new Set(result.map(a => a.rank)).size).toBe(4); // Unique ranks
  });
});
