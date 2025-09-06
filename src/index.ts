import { z } from 'genkit';
import { getCurrentWeatherTool, getWeatherForecastTool } from './bom-tools.js';
import { expressHandler } from '@genkit-ai/express';
import express, { response } from 'express';
import { getEnergyDemandTool } from './energy-tools.js';
import { ai } from './genkit.js';


const dayTypeSchema = z.enum(['weekday', 'weekend']);

const energyReportSchema = z.object({
  summary: z.string().describe('A concise summary of the energy demand prediction'),
  dailyBreakdown: z.array(z.object({
    date: z.string().describe('The date for the forecast (e.g., "2024-07-25")'),
    weather: z.string().describe('A brief description of the weather forecast for the day'),
    maxTempC: z.number().optional().describe('The forecasted maximum temperature in Celsius'),
    predictedDemandMw: z.number().optional().describe('The calculated predicted energy demand in megawatts'),
    insights: z.string().optional().describe('Any additional insights or notes for the day'),
  })),
});

// Define a more lenient schema to parse the raw AI output, allowing numbers to be strings.
const rawEnergyReportSchema = energyReportSchema.extend({
  dailyBreakdown: z.array(z.object({
    date: z.string(),
    weather: z.string(),
    maxTempC: z.any(),
    predictedDemandMw: z.any(),
    insights: z.string().optional(),
  })),
});


export const victoriaEnergyMarketFlow = ai.defineFlow(
  {
    name: 'victoriaEnergyMarketFlow',
    inputSchema: z.object({
      location: z.string(),
      dayType: dayTypeSchema.optional(),
    }),
    outputSchema: energyReportSchema,
  },
  async (input) => {
    console.log('Invoking AI weather agent...');
    const weatherPrompt = ai.definePrompt(
      {
        name: "weatherPrompt",
        tools: [getCurrentWeatherTool, getWeatherForecastTool],
        system: "You are a helpful assistant that provides weather forecasts for {{location}}.",
      },
      "Use the getWeatherForecastTool tool and getCurrentWeatherTool tool to get the weather forecast for {{location}}. Then, provide a summary of the forecast for the next few days based on the tool's output."
    );

    const weatherResponse = await weatherPrompt({ location: input.location });
    const weatherData = weatherResponse.text;

    console.log('Sending Weather data to the AEMO tool...', weatherData);
    const finalReportPrompt = ai.definePrompt(
      {
        output: { schema: rawEnergyReportSchema, format: 'json' },
        name: "reportPrompt",
        tools: [getEnergyDemandTool],
        system: "You are an energy market analyst able to predict energy demand.",
      },
      `Based on the following weather data, generate a professional energy demand report for {{location}}.

      Weather Data:
      {{weatherData}}

      Instructions:
      1. Provide details of the weather forecast for the city of {{location}}.
      2. Use the available tool to get the base energy demand for the region for a '{{dayType}}'.
      3. For each forecasted day, calculate the predicted demand using the formula: Final Demand = Base Demand + ((Max Temperature - 20) * 100). If a max temperature is not available for a day, you must omit the 'predictedDemandMw' field and add a note to the 'insights' field explaining why.
      4. Present the report with a summary, followed by a day-by-day breakdown in JSON format.
      5. IMPORTANT: All numeric fields in the JSON output, like 'maxTempC' and 'predictedDemandMw', must be numbers only, without any units or text.`
    );

    const finalResponse = await finalReportPrompt({
      weatherData,
      location: input.location,
      dayType: input.dayType || 'weekday'
    });

    const rawOutput = finalResponse.output;
    if (!rawOutput) {
      throw new Error("Failed to generate a valid report from the AI model.");
    }

    // Clean and transform the raw output to match the strict schema.
    const cleanedBreakdown = rawOutput.dailyBreakdown.map(day => {
      // Helper function to safely parse a number from any value.
      const parseNumber = (value: any): number | undefined => {
        if (value === null || value === undefined) return undefined;
        const strValue = String(value);
        const match = strValue.match(/-?\d+(\.\d+)?/);
        return match ? parseFloat(match[0]) : undefined;
      };

      return {
        ...day,
        maxTempC: parseNumber(day.maxTempC),
        predictedDemandMw: parseNumber(day.predictedDemandMw),
      };
    });

    const cleanedOutput = { ...rawOutput, dailyBreakdown: cleanedBreakdown };

    // Final validation against the strict schema before returning.
    return energyReportSchema.parse(cleanedOutput);
  }
);

const app = express();
app.use(express.json());

app.post('/get-energy-demand', expressHandler(victoriaEnergyMarketFlow));

app.listen(8080, () => {
  console.log('Express server listening on port 8080');
});