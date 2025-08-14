// Importing required dependencies for activity ranking logic
import { mean } from 'lodash';
import { Activity, ActivityType, WeatherForecast } from '../schema/types';

// Defining the ActivityScore interface for scoring activities
// Associates an activity type with its calculated suitability score
interface ActivityScore {
  type: ActivityType; // Activity type from the schema enum
  score: number;      // Suitability score between 0 and 1
}

// Defining the rankActivities function to compute activity rankings
// Takes weather forecasts and returns ranked activities based on weather conditions
export function rankActivities(forecasts: WeatherForecast[]): Activity[] {
  // Calculating average temperature across forecast days
  // Averages the midpoint of max and min temperatures for each day
  const avgTemp = mean(forecasts.map(f => (f.temperatureMax + f.temperatureMin) / 2));
  
  // Calculating average precipitation across forecast days
  const avgPrecip = mean(forecasts.map(f => f.precipitationSum));
  
  // Calculating average wind speed across forecast days
  const avgWind = mean(forecasts.map(f => f.windSpeedMax));

  // Defining suitability scores for each activity based on weather conditions
  const scores: ActivityScore[] = [
    {
      type: ActivityType.Skiing,
      // Assigning high score for cold temperatures and precipitation (snow)
      score: avgTemp < 5 && avgPrecip > 0 ? 0.9 : 0.1,
    },
    {
      type: ActivityType.Surfing,
      // Assigning moderate score for warm temperatures and optimal wind speeds
      // Lower score unless conditions are suitable for coastal areas
      score: avgTemp > 20 && avgWind >= 15 && avgWind <= 30 ? 0.7 : 0.2,
    },
    {
      type: ActivityType.IndoorSightseeing,
      // Assigning higher score for rainy weather, favoring indoor activities
      score: avgPrecip > 2 ? 0.8 : 0.3,
    },
    {
      type: ActivityType.OutdoorSightseeing,
      // Assigning high score for warm, dry weather suitable for outdoor exploration
      score: avgTemp >= 15 && avgTemp <= 30 && avgPrecip < 2 ? 0.9 : 0.2,
    },
  ];

  // Sorting activities by score (descending) and mapping to Activity type
  // Assigns ranks (1 to 4) based on sorted order
  const rankedActivities = scores
    .sort((a, b) => b.score - a.score)
    .map((activity, index) => ({
      type: activity.type,
      rank: index + 1,
      suitabilityScore: activity.score,
    }));

  // Returning the ranked list of activities
  return rankedActivities;
}