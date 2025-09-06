import { z } from 'genkit';
import { spawn } from 'child_process';
import { ai } from '../src/genkit.js';
import path from 'path';

const stationMap: { [key: string]: { state: string, stationId: string, ftpForecast: string } } = {
  sydney: { state: 'IDN', stationId: '94767', ftpForecast: 'IDN10064.txt' },
  melbourne: { state: 'IDV', stationId: '95936', ftpForecast: 'IDV10450.txt' },
  brisbane: { state: 'IDQ', stationId: '40842', ftpForecast: 'IDQ11295.txt' },
  perth: { state: 'IDW', stationId: '99645', ftpForecast: 'IDW12300.txt' },
  adelaide: { state: 'IDS', stationId: '23000', ftpForecast: 'IDS10034.txt' },
  hobart: { state: 'IDT', stationId: '94970', ftpForecast: 'IDT16710.txt' },
  darwin: { state: 'IDD', stationId: '14015', ftpForecast: 'IDD10299.txt' },
};

// Tool to get Recent data
export const getCurrentWeatherTool = ai.defineTool(
    {
      name: 'getCurrentWeather',
      description: 'Gets the latest weather details for a specific Australian city from the Bureau of Meteorology.',
      inputSchema: z.object({
        location: z.string().describe('The name of the Australian city to get the weather for (e.g., "Sydney", "Melbourne", "Brisbane").'),
      }),
      outputSchema: z.object({
        report: z.string().describe('A formatted string with the latest weather details.'),
      }),
    },
    async (input) => {
      // Sanitize the input location to match the keys in our station map
      const locationKey = input.location.toLowerCase().trim();
      const stationInfo = stationMap[locationKey];
  
      // Check if the location is supported
      if (!stationInfo) {
        return {
          report: `Sorry, I can't find weather for ${input.location}. The supported locations are: ${Object.keys(stationMap).join(', ')}.`,
        };
      }
  
      // Construct the BOM API URL using the station info
      const url = `http://www.bom.gov.au/fwo/${stationInfo.state}60901/${stationInfo.state}60901.${stationInfo.stationId}.json`;
  
      try {
        // Fetch the data from the BOM JSON feed
        const response = await fetch(url);
        console.log('Fetched current weather data');
        // Check for a successful response
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
  
        const data = await response.json();
  
        // Check if the data structure is as expected
        if (!data.observations || !data.observations.data || data.observations.data.length === 0) {
          return { report: `No observation data found for ${input.location}.` };
        }
  
        // Get the latest observation, which is the first object in the data array
        const latestObservation = data.observations.data[0];
        console.log('Latest observation:', latestObservation);
        // Extract key weather details from the observation
        const time = latestObservation.local_date_time_full;
        const temperature = latestObservation.air_temp;
        const windDirection = latestObservation.wind_dir;
        const windSpeed = latestObservation.wind_spd_kmh;
        const humidity = latestObservation.rel_hum;
        const rainSince9am = latestObservation.rain_trace;
  
        // Format the details into a human-readable string
        const weatherReport = `Latest weather for ${input.location} (as of ${time}):\n`
                          + `Temperature: ${temperature}°C\n`
                          + `Wind: ${windDirection} at ${windSpeed} km/h\n`
                          + `Humidity: ${humidity}%\n`
                          + `Rain since 9am: ${rainSince9am} mm`;
        console.log('Fetched current weather data');

        return { report: weatherReport };
  
      } catch (error) {
        // Handle any errors during the fetch or data processing
        console.error(`Failed to fetch weather data: ${error}`);
        return {
          report: `An error occurred while retrieving weather data for ${input.location}. Please try again later.`, 
        };
      }
  }
);

// Tool to fetch BOM forecast from FTP
export const getWeatherForecastTool = ai.defineTool(
  {
    name: 'getWeatherForecast',
    description: 'Gets the latest weather forecast for a specific Australian city using a Python FTP script.',
    inputSchema: z.object({
      location: z.string().describe('The name of the Australian city to get the forecast for (e.g., "Sydney", "Melbourne", "Brisbane").'),
    }),
    outputSchema: z.object({
      forecast: z.string().describe('A formatted string with the latest weather forecast.'),
    }),
  },
  async (input) => {
    const locationKey = input.location.toLowerCase().trim();
    const stationInfo = stationMap[locationKey];
    if (!stationInfo) {
      return {
        forecast: `Sorry, I can't find a forecast for ${input.location}. Supported: ${Object.keys(stationMap).join(', ')}.`, 
      };
    }

    console.log(`Fetching forecast for ${input.location} from FTP...`);
    const ftpFile = stationInfo.ftpForecast;

    return new Promise((resolve, reject) => {
      // Construct an absolute path to the python script to ensure it's found correctly.
      const scriptPath = path.resolve(process.cwd(), 'src', 'python-ftp.py');
      
      console.log(`Running Python script at ${scriptPath} for file ${ftpFile}`);
      const py = spawn('python', [
        scriptPath,
        ftpFile
      ]);

      let output = '';
      let errorOutput = '';

      py.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Python stderr:', data.toString());
      });

      py.stdout.on('data', (data) => {
        output += data.toString();
      });

      // Wait for the stream to end to ensure all data is captured.
      py.stdout.on('end', () => {
        console.log('Python stdout stream ended.');
        // Now that we have all the data, we can resolve inside the 'close' event.
      });

      py.on('error', (err) => {
        console.error('Failed to start Python script:', err);
        return reject(new Error(`Failed to start Python script: ${err.message}`));
      });

      py.on('close', (code) => {
        if (code === 0 && output) {
          console.log('Python script finished successfully.');
          resolve({ forecast: output.trim() });
        } else {
          reject(new Error(`Python script exited with code ${code}: ${errorOutput || 'Unknown error'}`));
        }
      });
    });
  }
);