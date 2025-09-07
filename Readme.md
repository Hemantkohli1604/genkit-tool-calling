# Genkit Tool Calling

This project demonstrates the "tool-calling" capabilities of Google's Genkit framework. It showcases how a generative AI model can use tools to interact with external systems. 

In this case we are using two prompts:

1. weatherPrompt: This prompt uses the "getCurrentWeatherTool" and "getWeatherForecastTool" from "bom-tools.ts" to get the current weather and forecast for next 7 days from an external source (HTTP and FTP).
2. reportPrompt: This prompt uses the "getEnergyDemandTool" from "energy-tools.ts" (Simulated) to predict the demand based on weather.

## Solution Diagram

![Tool Calling Overview Diagram](tool-calling-overview.png "Tool Calling Overview Diagram")

## Overview

Tool-calling allows you to make your Large Language Models (LLMs) more powerful by giving them the ability to call external functions or APIs. This enables them to fetch real-time information, interact with databases, or perform actions in other systems.

This example project is set up to potentially interact with:

*   **A HTTP Endpoint:** For Current weather in JSON Format.
*   **An Anonymous FTP Location:** For Weather Forecast.
*   **A Simulated output:** For Enenrgy Demand Calculation.

Express Framework is used to publish the API endpoints POST /get-energy-demand.

## Prerequisites

Before you begin, ensure you have the following:

*   [Node.js](https://nodejs.org/) (LTS version recommended)  
*   As a perquisite follow the steps mentioned in https://genkit.dev/docs/get-started/#configure-your-model-api-key to get a free API key from Google AI studio.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Hemantkohli1604/genkit-tool-calling.git
    cd genkit-tool-calling
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

4.  **Configure Environment Variables:**

    Get your API key from [Google AI studio] https://aistudio.google.com/apikey.

    Once you have a key, set the GEMINI_API_KEY environment variable:
    ```bash
    export GEMINI_API_KEY=<your API key>
    ```

## Running the Application


### Genkit UI

To start the application with genkit UI, run:

```bash
npm run build
npm run genkit:ui
```

This will likely start the Genkit developer UI, where you can interact with the defined flows and see how the model calls the configured tools.

### 2. Run as Standalone Application

To start the application without the Genkit UI, run:

```bash
npm run build
npm start
```

## Execute the Flow

To execute the flow initiate a POST request to the application.

```bash

curl --location 'http://127.0.0.1:8080/get-energy-demand' \
--header 'Content-Type: application/json' \
--data '{
    "data": {
        "location": "Melbourne",
        "dayType": "weekday"
    }
}'

```

## Known Issue

1. The BOM anonymous FTP endpoint sometimes times out, this will give a python error saying "FTP connection Failed". This happens as BOM might rate limit the requests. For demo pourpose reinitiate the POST call. 

*Python stderr: FTP connection or operation failed: [WinError 10060] A connection attempt failed because the connected party did not properly respond after a period of time, or established connection failed because connected host has failed to respond*



2. The application takes some time to initialize and might cause a restart to express server. This is still being worked upon.

