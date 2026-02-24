import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import axios, { AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { Together } from 'together-ai';

// Type definitions
interface ApiKey {
  id: string;
  name: string;
  api_key: string;
  created_at: string;
}

interface Platform {
  id: string;
  name: string;
  base_url: string;
  is_custom: boolean;
  created_at: string;
}

interface Endpoint {
  id: string;
  name: string;
  platform_id: string;
  custom_base_url: string;
  api_key_id: string;
  api_key: string;
  model: string;
  model_type: 'text' | 'image';
  system_prompt: string;
  temperature: number;
  created_at: string;
  platform_base_url: string;
  is_custom: boolean;
}

interface ChatSession {
  id: string;
  endpoint_id: string;
  name: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  image_path?: string;
  timestamp: string;
}

interface ChatRequest {
  endpoint_id: string;
  session_id: string | null;
  message: string;
  image_path?: string;
  use_history?: boolean;
  save_to_db?: boolean;
  use_tools?: boolean;
}

interface TogetherModel {
  id: string;
  name: string;
  type: string;
  context_length: number;
  pricing: any;
}

const app = express();
const PORT = process.env.PORT || 3001;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory for image storage');
}

// Path to demo images in frontend public directory
const demoImagesDir = path.join(__dirname, '..', '..', 'frontend', 'public', 'demo-images');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use('/demo-images', express.static(demoImagesDir)); // Serve demo images

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Initialize SQLite database
const dbPath = path.join(__dirname, '..', 'chat.db');
const dbExists = fs.existsSync(dbPath);
const db = new sqlite3.Database(dbPath);

// Create tables and initialize data
db.serialize(() => {
  // Platforms table
  db.run(`CREATE TABLE IF NOT EXISTS platforms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    base_url TEXT NOT NULL,
    is_custom BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // API Keys table
  db.run(`CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    api_key TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Endpoints table
  db.run(`CREATE TABLE IF NOT EXISTS endpoints (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform_id TEXT NOT NULL,
    custom_base_url TEXT DEFAULT '',
    api_key_id TEXT NOT NULL,
    model TEXT NOT NULL,
    model_type TEXT DEFAULT 'text',
    system_prompt TEXT DEFAULT '',
    temperature REAL DEFAULT 0.7,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (platform_id) REFERENCES platforms (id),
    FOREIGN KEY (api_key_id) REFERENCES api_keys (id)
  )`);

  // Chat sessions table
  db.run(`CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    endpoint_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (endpoint_id) REFERENCES endpoints (id)
  )`);

  // Chat messages table
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    image_path TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions (id)
  )`);

  // Check if platforms exist, if not create default ones
  db.get('SELECT COUNT(*) as count FROM platforms', (err: Error | null, row: any) => {
    if (err) {
      console.error('Error checking platforms:', err);
      return;
    }
    
    if (row.count === 0) {
      console.log('Creating fresh database with default platforms...');
      
      const defaultPlatforms = [
        { id: 'together', name: 'Together AI', base_url: 'https://api.together.xyz/v1', is_custom: 0 },
        { id: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1', is_custom: 0 },
        { id: 'anthropic', name: 'Anthropic', base_url: 'https://api.anthropic.com/v1', is_custom: 0 },
        { id: 'google', name: 'Google AI', base_url: 'https://generativelanguage.googleapis.com/v1beta', is_custom: 0 },
        { id: 'custom', name: 'Custom', base_url: '', is_custom: 1 }
      ];

      const stmt = db.prepare('INSERT OR IGNORE INTO platforms (id, name, base_url, is_custom) VALUES (?, ?, ?, ?)');
      
      defaultPlatforms.forEach(platform => {
        stmt.run(platform.id, platform.name, platform.base_url, platform.is_custom);
      });
      
      stmt.finalize();
      console.log('Default platforms created successfully!');
    }
  });
});

// API Routes

// Get all platforms
app.get('/api/platforms', (req: Request, res: Response): void => {
  db.all('SELECT * FROM platforms ORDER BY name', (err: Error | null, rows: Platform[]) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get Together AI models
app.get('/api/together/models', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const apiKey = authHeader.replace('Bearer ', '');
    const client = new Together({ apiKey: apiKey });
    
    const models = await client.models.list();
    const serverlessModels = models
      .filter(model => model.pricing?.input !== undefined)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(model => ({
        id: model.id,
        name: model.display_name || model.id,
        type: model.type,
        context_length: model.context_length,
        pricing: model.pricing
      }));

    res.json(serverlessModels);
  } catch (error: any) {
    console.error('Error fetching Together models:', error.message);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      res.status(401).json({ error: 'Invalid Together AI API key. Please check your API key and try again.' });
    } else {
      console.error('Full error:', error);
      res.status(500).json({ error: 'Failed to fetch models from Together AI' });
    }
  }
});

// Get OpenAI models
app.get('/api/openai/models', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const apiKey = authHeader.replace('Bearer ', '');
    
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const models = response.data.data
      .filter((model: any) => model.id.includes('gpt') || model.id.includes('dall-e') || model.id.includes('whisper') || model.id.includes('tts'))
      .sort((a: any, b: any) => a.id.localeCompare(b.id))
      .map((model: any) => ({
        id: model.id,
        name: model.id,
        type: model.id.includes('dall-e') ? 'image' : 'text',
        context_length: null,
        pricing: null
      }));

    res.json(models);
  } catch (error: any) {
    console.error('Error fetching OpenAI models:', error.message);
    
    if (error.response?.status === 401) {
      res.status(401).json({ error: 'Invalid OpenAI API key. Please check your API key and try again.' });
    } else {
      console.error('Full error:', error);
      res.status(500).json({ error: 'Failed to fetch models from OpenAI' });
    }
  }
});

// Get Anthropic models
app.get('/api/anthropic/models', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    // Anthropic doesn't have a public models API, so we'll return their known models
    const models = [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', type: 'text', context_length: 200000, pricing: null },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', type: 'text', context_length: 200000, pricing: null },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', type: 'text', context_length: 200000, pricing: null },
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', type: 'text', context_length: 200000, pricing: null },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', type: 'text', context_length: 200000, pricing: null }
    ];

    res.json(models);
  } catch (error: any) {
    console.error('Error fetching Anthropic models:', error.message);
    res.status(500).json({ error: 'Failed to fetch models from Anthropic' });
  }
});

// Get Google AI models
app.get('/api/google/models', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const apiKey = authHeader.replace('Bearer ', '');
    
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

    const models = response.data.models
      .filter((model: any) => model.name.includes('gemini'))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))
      .map((model: any) => ({
        id: model.name.replace('models/', ''),
        name: model.displayName || model.name.replace('models/', ''),
        type: 'text',
        context_length: null,
        pricing: null
      }));

    res.json(models);
  } catch (error: any) {
    console.error('Error fetching Google AI models:', error.message);
    
    if (error.response?.status === 400 || error.response?.status === 403) {
      res.status(401).json({ error: 'Invalid Google AI API key. Please check your API key and try again.' });
    } else {
      console.error('Full error:', error);
      res.status(500).json({ error: 'Failed to fetch models from Google AI' });
    }
  }
});

// Get all API keys
app.get('/api/api-keys', (req: Request, res: Response) => {
  db.all('SELECT id, name, api_key, created_at FROM api_keys ORDER BY name', (err: Error | null, rows: ApiKey[]) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create API key
app.post('/api/api-keys', (req: Request, res: Response) => {
  const { name, api_key } = req.body;
  const id = uuidv4();
  
  db.run(
    'INSERT INTO api_keys (id, name, api_key) VALUES (?, ?, ?)',
    [id, name, api_key],
    function(err: Error | null) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, name, api_key, created_at: new Date().toISOString() });
    }
  );
});

// Update API key
app.put('/api/api-keys/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, api_key } = req.body;
  
  db.run(
    'UPDATE api_keys SET name = ?, api_key = ? WHERE id = ?',
    [name, api_key, id],
    function(err: Error | null) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, name, api_key, updated: true });
    }
  );
});

// Delete API key
app.delete('/api/api-keys/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  db.run('DELETE FROM api_keys WHERE id = ?', [id], function(err: Error | null) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ deleted: true });
  });
});

// Get all endpoints
app.get('/api/endpoints', (req: Request, res: Response) => {
  const query = `
    SELECT 
      e.*,
      p.base_url as platform_base_url,
      p.is_custom,
      ak.api_key
    FROM endpoints e
    JOIN platforms p ON e.platform_id = p.id
    JOIN api_keys ak ON e.api_key_id = ak.id
    ORDER BY e.name
  `;
  
  db.all(query, (err: Error | null, rows: Endpoint[]) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create endpoint
app.post('/api/endpoints', (req: Request, res: Response) => {
  const { name, platform_id, custom_base_url, api_key_id, model, model_type, system_prompt, temperature } = req.body;
  const id = uuidv4();
  
  db.run(
    'INSERT INTO endpoints (id, name, platform_id, custom_base_url, api_key_id, model, model_type, system_prompt, temperature) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, platform_id, custom_base_url || '', api_key_id, model, model_type || 'text', system_prompt || '', temperature || 0.7],
    function(err: Error | null) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, name, platform_id, custom_base_url, api_key_id, model, model_type, system_prompt, temperature, created_at: new Date().toISOString() });
    }
  );
});

// Update endpoint
app.put('/api/endpoints/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, platform_id, custom_base_url, api_key_id, model, model_type, system_prompt, temperature } = req.body;
  
  db.run(
    'UPDATE endpoints SET name = ?, platform_id = ?, custom_base_url = ?, api_key_id = ?, model = ?, model_type = ?, system_prompt = ?, temperature = ? WHERE id = ?',
    [name, platform_id, custom_base_url || '', api_key_id, model, model_type || 'text', system_prompt || '', temperature || 0.7, id],
    function(err: Error | null) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, name, platform_id, custom_base_url, api_key_id, model, model_type, system_prompt, temperature, updated: true });
    }
  );
});

// Delete endpoint
app.delete('/api/endpoints/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  db.run('DELETE FROM endpoints WHERE id = ?', [id], function(err: Error | null) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ deleted: true });
  });
});

// Get all chat sessions
app.get('/api/sessions', (req: Request, res: Response) => {
  db.all('SELECT * FROM chat_sessions ORDER BY created_at DESC', (err: Error | null, rows: ChatSession[]) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Create chat session
app.post('/api/sessions', (req: Request, res: Response) => {
  const { endpoint_id, name } = req.body;
  const id = uuidv4();
  
  db.run(
    'INSERT INTO chat_sessions (id, endpoint_id, name) VALUES (?, ?, ?)',
    [id, endpoint_id, name],
    function(err: Error | null) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id, endpoint_id, name, created_at: new Date().toISOString() });
    }
  );
});

// Delete chat session
app.delete('/api/sessions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  // Delete session and all its messages
  db.serialize(() => {
    db.run('DELETE FROM chat_messages WHERE session_id = ?', [id]);
    db.run('DELETE FROM chat_sessions WHERE id = ?', [id], function(err: Error | null) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ deleted: true });
    });
  });
});

// Get messages for a session
app.get('/api/sessions/:id/messages', (req: Request, res: Response) => {
  const { id } = req.params;
  
  db.all(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC',
    [id],
    (err: Error | null, rows: ChatMessage[]) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

// Upload image endpoint
app.post('/api/upload', upload.single('image'), (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const imagePath = `/uploads/${req.file.filename}`;
  res.json({ 
    message: 'File uploaded successfully',
    path: imagePath,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size
  });
});

// Mock function to execute tool calls
function executeToolCall(toolName: string, args: any): string {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  switch (toolName) {
    case 'getCurrentWeather':
      const temps = [65, 72, 58, 81, 45, 90, 55, 68];
      const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy', 'clear'];
      const temp = temps[Math.floor(Math.random() * temps.length)];
      const condition = conditions[Math.floor(Math.random() * conditions.length)];
      const unit = args.unit || 'fahrenheit';
      return JSON.stringify({
        location: args.location,
        temperature: temp,
        unit: unit,
        conditions: condition,
        humidity: Math.floor(Math.random() * 40) + 40,
        wind_speed: Math.floor(Math.random() * 20) + 5
      });
      
    case 'getCurrentFlights':
      const airlines = ['United', 'Delta', 'American', 'Southwest', 'JetBlue'];
      const destinations = ['LAX', 'JFK', 'ORD', 'DFW', 'ATL', 'MIA', 'SEA', 'BOS'];
      const flights = [];
      for (let i = 0; i < 5; i++) {
        const airline = airlines[Math.floor(Math.random() * airlines.length)];
        const dest = destinations[Math.floor(Math.random() * destinations.length)];
        const flightNum = Math.floor(Math.random() * 9000) + 1000;
        const hour = Math.floor(Math.random() * 12) + 1;
        const minute = Math.floor(Math.random() * 60);
        flights.push({
          airline: airline,
          flight_number: `${airline.substring(0, 2).toUpperCase()}${flightNum}`,
          destination: dest,
          departure_time: `${hour}:${minute.toString().padStart(2, '0')} PM`,
          gate: `${String.fromCharCode(65 + Math.floor(Math.random() * 5))}${Math.floor(Math.random() * 20) + 1}`,
          status: 'On Time'
        });
      }
      return JSON.stringify({
        airport: args.airport_code,
        flights: flights,
        departure_time_frame: args.departure_time || 'now'
      });
      
    case 'getRestaurantRecommendation':
      const restaurants = [
        { name: 'Sakura Sushi', rating: 4.8, price: '$$$$', specialty: 'Omakase' },
        { name: 'Golden Dragon', rating: 4.6, price: '$$$', specialty: 'Dim Sum' },
        { name: 'La Bella Vista', rating: 4.9, price: '$$$$', specialty: 'Pasta' },
        { name: 'El Mariachi', rating: 4.5, price: '$$', specialty: 'Tacos' },
        { name: 'Le Petit Bistro', rating: 4.7, price: '$$$$$', specialty: 'French Cuisine' }
      ];
      const selectedRestaurants = restaurants.slice(0, 3);
      return JSON.stringify({
        city: args.city,
        cuisine: args.cuisine,
        price_range: args.price_range || 'moderate',
        recommendations: selectedRestaurants
      });
      
    case 'getBestPlacesToLive':
      const cities = [
        { name: 'Austin, TX', score: 92, cost_of_living_index: 115 },
        { name: 'Portland, OR', score: 88, cost_of_living_index: 135 },
        { name: 'Denver, CO', score: 90, cost_of_living_index: 125 },
        { name: 'Raleigh, NC', score: 87, cost_of_living_index: 105 },
        { name: 'Nashville, TN', score: 89, cost_of_living_index: 110 }
      ];
      return JSON.stringify({
        criteria: args.criteria,
        region: args.region || 'USA',
        lifestyle: args.lifestyle || 'urban',
        top_cities: cities
      });
      
    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}

// Helper function to get tool definitions
function getTools() {
  return [
    {
      type: "function",
      function: {
        name: "getCurrentWeather",
        description: "Get the current weather and temperature in a given location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state, e.g. San Francisco, CA",
            },
            unit: {
              type: "string",
              description: "The unit of temperature to return",
              enum: ["celsius", "fahrenheit"]
            },
          },
          required: ["location"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getCurrentFlights",
        description: "Get current flight information and departures from an airport",
        parameters: {
          type: "object",
          properties: {
            airport_code: {
              type: "string",
              description: "The 3-letter airport code, e.g. SFO, JFK, LAX",
            },
            departure_time: {
              type: "string",
              description: "Time frame for departures (now, today, tonight)",
              enum: ["now", "today", "tonight"],
            },
          },
          required: ["airport_code"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getRestaurantRecommendation",
        description: "Get restaurant recommendations for a specific city and cuisine type",
        parameters: {
          type: "object",
          properties: {
            city: {
              type: "string",
              description: "The city to search for restaurants, e.g. New York, Paris, Tokyo",
            },
            cuisine: {
              type: "string",
              description: "Type of cuisine (Italian, Japanese, French, Mexican, etc.)",
            },
            price_range: {
              type: "string",
              description: "Price range preference",
              enum: ["budget", "moderate", "upscale", "fine_dining"],
            },
          },
          required: ["city", "cuisine"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "getBestPlacesToLive",
        description: "Get recommendations for the best places to live based on criteria",
        parameters: {
          type: "object",
          properties: {
            criteria: {
              type: "string",
              description: "What to optimize for (cost of living, weather, jobs, culture, safety, etc.)",
            },
            region: {
              type: "string",
              description: "Geographic region to search (USA, Europe, Asia, worldwide, etc.)",
            },
            lifestyle: {
              type: "string",
              description: "Lifestyle preference (urban, suburban, rural, coastal, mountain)",
            },
          },
          required: ["criteria"],
        },
      },
    },
  ];
}

// Helper function to determine if a model is for image generation
function isImageGenerationModel(modelName: string): boolean {
  const imageModels = [
    'flux', 'dall-e', 'midjourney', 'stable-diffusion', 'playground-v2', 
    'stable-diffusion-xl', 'kandinsky', 'imagen', 'firefly'
  ];
  const modelLower = modelName.toLowerCase();
  return imageModels.some(imageModel => modelLower.includes(imageModel));
}

// Helper function to get the appropriate API endpoint
function getApiEndpoint(baseUrl: string, isImageModel: boolean): string {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  if (isImageModel) {
    // For image generation, try different possible endpoints
    if (cleanBaseUrl.includes('together')) {
      return `${cleanBaseUrl}/images/generations`;
    } else if (cleanBaseUrl.includes('openai')) {
      return `${cleanBaseUrl}/images/generations`;
    } else {
      // Default fallback for other providers
      return cleanBaseUrl.endsWith('/images/generations') ? cleanBaseUrl : `${cleanBaseUrl}/images/generations`;
    }
  } else {
    // For text chat completions
    return cleanBaseUrl.endsWith('/chat/completions') ? cleanBaseUrl : `${cleanBaseUrl}/chat/completions`;
  }
}

// Handle image generation
async function handleImageGeneration(res: Response, endpoint: Endpoint, baseUrl: string, message: string, session_id: string | null, save_to_db: boolean = true): Promise<void> {
  const apiUrl = getApiEndpoint(baseUrl, true);
  console.log(`Using image generation endpoint: ${apiUrl}`);
  console.log(`Image generation model: ${endpoint.model}`);
  console.log(`Image generation prompt: ${message}`);

  // Set up streaming response for progress updates
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Transfer-Encoding': 'chunked',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  // Send initial progress
  res.write('PROGRESS:Initializing image generation...\n');

  try {
    // Prepare request body for image generation based on platform
    let requestBody: any;
    let targetApiUrl = apiUrl;

    // Determine platform based on base URL or endpoint platform
    if (baseUrl.includes('together.xyz')) {
      // Together AI format
      requestBody = {
        model: endpoint.model,
        prompt: message,
        width: 1024,
        height: 1024,
        steps: 20,
        n: 1,
        response_format: "b64_json"
      };
    } else if (baseUrl.includes('openai.com')) {
      // OpenAI format
      requestBody = {
        model: endpoint.model,
        prompt: message,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      };
    } else if (baseUrl.includes('anthropic.com')) {
      // Anthropic doesn't support image generation yet
      throw new Error('Anthropic does not currently support image generation');
    } else if (baseUrl.includes('googleapis.com')) {
      // Google AI doesn't support image generation through this API
      throw new Error('Google AI does not currently support image generation through this API');
    } else {
      // Default to OpenAI format for custom endpoints
      requestBody = {
        model: endpoint.model,
        prompt: message,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      };
    }

    res.write('PROGRESS:Sending request to image generation API...\n');

    const response: AxiosResponse = await axios.post(targetApiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${endpoint.api_key}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minute timeout for image generation
    });

    res.write('PROGRESS:Processing generated image...\n');

    let imageData: string | undefined;
    let assistantContent = `Generated image for: "${message}"`;

    // Handle different response formats
    if (response.data && response.data.data && response.data.data[0]) {
      if (response.data.data[0].b64_json) {
        imageData = response.data.data[0].b64_json;
      } else if (response.data.data[0].url) {
        // If URL is provided, we might need to download it
        const imageResponse = await axios.get(response.data.data[0].url, { responseType: 'arraybuffer' });
        imageData = Buffer.from(imageResponse.data).toString('base64');
      }
    } else if (response.data && response.data.output && response.data.output.choices) {
      // Together AI format
      const choice = response.data.output.choices[0];
      if (choice && choice.image_base64) {
        imageData = choice.image_base64;
      }
    }

    if (!imageData) {
      throw new Error('No image data received from API');
    }

    // Save the image
    const imageBuffer = Buffer.from(imageData, 'base64');
    const filename = `generated-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
    const imagePath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(imagePath, imageBuffer);
    const savedImagePath = `/uploads/${filename}`;

    res.write('PROGRESS:Saving image and response...\n');

    // Save user message (only if save_to_db is true and session_id is provided)
    const userMessageId = uuidv4();
    if (save_to_db && session_id) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
          [userMessageId, session_id, 'user', message],
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Save assistant response with image (only if save_to_db is true and session_id is provided)
    const assistantMessageId = uuidv4();
    if (save_to_db && session_id) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO chat_messages (id, session_id, role, content, image_path) VALUES (?, ?, ?, ?, ?)',
          [assistantMessageId, session_id, 'assistant', assistantContent, savedImagePath],
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    // Send completion with image path
    res.write(`COMPLETE:${JSON.stringify({ 
      content: assistantContent,
      image_path: savedImagePath,
      success: true
    })}\n`);
    
    res.end();

  } catch (error: any) {
    console.error('Image generation error:', error.response?.data || error.message);
    console.error('Full error:', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'Image generation failed';
    
    // Save error message (only if save_to_db is true and session_id is provided)
    const assistantMessageId = uuidv4();
    if (save_to_db && session_id) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
          [assistantMessageId, session_id, 'assistant', `Error generating image: ${errorMessage}`],
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    res.write(`ERROR:${errorMessage}\n`);
    res.end();
  }
}

// Handle text completion
async function handleTextCompletion(res: Response, endpoint: Endpoint, baseUrl: string, message: string, session_id: string | null, use_history: boolean, userMessageId: string, image_path?: string, save_to_db: boolean = true, use_tools: boolean = false): Promise<void> {
  try {
    // Prepare messages for API call
    const messages: any[] = [];
    
    // Check if this is a GPT-5 thinking model (supports streaming with reasoning, no temperature)
    const isGPT5ThinkingModel = endpoint.model.includes('gpt-5');
    
    // Add system message if provided (GPT-5 supports it)
    let systemContent = endpoint.system_prompt || '';
    
    // If tools are enabled, enhance the system prompt
    if (use_tools) {
      const toolsHint = '\n\nYou have access to external functions/tools. When the user asks a question that requires external data (weather, flights, restaurants, places to live), you should call the appropriate function with the correct parameters. The function results will be provided to you, and you should use that information to answer the user\'s question in a natural, conversational way.';
      systemContent = systemContent ? systemContent + toolsHint : 'You are a helpful assistant.' + toolsHint;
    }
    
    if (systemContent) {
      messages.push({
        role: 'system',
        content: systemContent
      });
    }

    // Add chat history if enabled and session_id is provided
    if (use_history && session_id) {
      const history: ChatMessage[] = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM chat_messages WHERE session_id = ? AND id != ? ORDER BY timestamp ASC',
          [session_id, userMessageId],
          (err: Error | null, rows: ChatMessage[]) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      for (const msg of history) {
        const messageContent: any[] = [];
        messageContent.push({ type: 'text', text: msg.content });
        
        if (msg.image_path && msg.role === 'user') {
          let imagePath: string;
          
          // Handle both demo images and uploaded images
          if (msg.image_path.startsWith('/demo-images/')) {
            imagePath = path.join(__dirname, '..', '..', 'frontend', 'public', msg.image_path);
          } else {
            imagePath = path.join(__dirname, '..', msg.image_path.replace('/uploads/', 'uploads/'));
          }
          
          if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
            
            messageContent.push({
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            });
          } else {
            console.warn('Image not found in history at path:', imagePath);
          }
        }

        messages.push({
          role: msg.role,
          content: messageContent.length === 1 ? messageContent[0].text : messageContent
        });
      }
    }

    // Add current user message
    const currentMessageContent: any[] = [];
    currentMessageContent.push({ type: 'text', text: message });
    
    if (image_path) {
      let imagePath: string;
      
      // Handle both demo images and uploaded images
      if (image_path.startsWith('/demo-images/')) {
        imagePath = path.join(__dirname, '..', '..', 'frontend', 'public', image_path);
      } else {
        imagePath = path.join(__dirname, '..', image_path.replace('/uploads/', 'uploads/'));
      }
      
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
        
        currentMessageContent.push({
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64Image}`
          }
        });
      } else {
        console.warn('Image not found at path:', imagePath);
      }
    }

    messages.push({
      role: 'user',
      content: currentMessageContent.length === 1 ? currentMessageContent[0].text : currentMessageContent
    });

    // Set up streaming response
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    const apiUrl = getApiEndpoint(baseUrl, false);
    
    const requestPayload: any = {
      model: endpoint.model,
      messages: messages
    };
    
    // Check if this is Together AI (they handle tool calls differently)
    const isTogetherAI = baseUrl.includes('together.xyz') || baseUrl.includes('together.ai');
    
    // Check if this is a Together AI thinking model (they DO stream, but with thinking tokens first)
    const isTogetherThinkingModel = isTogetherAI && 
                                     (endpoint.model.toLowerCase().includes('think') || 
                                      endpoint.model.toLowerCase().includes('r1') ||
                                      endpoint.model.toLowerCase().includes('cogito'));
    
    // Check if this is a Cogito model (requires special chat_template_kwargs)
    const isCogito = endpoint.model.toLowerCase().includes('cogito');
    
    // GPT-5 and Together AI thinking models don't support temperature
    // GPT-5 supports streaming with reasoning output
    // Together AI thinking models DO support streaming (but not temperature)
    // Together AI models with tools should NOT stream (tool calls come in final response)
    if (!isGPT5ThinkingModel) {
      if (!isTogetherThinkingModel) {
      requestPayload.temperature = endpoint.temperature;
      }
    }
    
    // Enable streaming for all models except Together AI with tools
    if (!(use_tools && isTogetherAI)) {
      requestPayload.stream = true;
    }
    
    // For GPT-5, add reasoning_effort (reasoning is internal, not streamed)
    if (isGPT5ThinkingModel) {
      requestPayload.reasoning_effort = 'medium'; // Balance between speed and quality
    }
    
    // For Cogito models, add chat_template_kwargs to enable thinking
    if (isCogito) {
      requestPayload.chat_template_kwargs = { enable_thinking: true };
    }
    
    // Add tools if use_tools is true
    if (use_tools) {
      requestPayload.tools = getTools();
    }
    
    const inferenceStartTime = performance.now();

    const response: AxiosResponse = await axios.post(
      apiUrl,
      requestPayload,
      {
        headers: {
          'Authorization': `Bearer ${endpoint.api_key}`,
          'Content-Type': 'application/json'
        },
        responseType: (use_tools && isTogetherAI) ? 'json' : 'stream', // Don't stream for Together + tools
        timeout: 300000 // 5 minute timeout for text completion
      }
    );

    // Handle non-streaming response for Together AI with tools only
    // Note: Together AI thinking models DO stream, so they go through the streaming path below
    // Note: GPT-5 models DO stream, so they go through the streaming path below
    if (use_tools && isTogetherAI) {
      const message = response.data.choices?.[0]?.message || {};
      const assistantResponse = message.content || '';
      const toolCallsFromResponse = message.tool_calls || [];
      const usage = response.data.usage || {};
      
      // Check if we have tool calls to process
      if (toolCallsFromResponse.length > 0) {
        // Show the tool calls
        for (const toolCall of toolCallsFromResponse) {
          if (toolCall && toolCall.function) {
            const toolCallText = `\n\n🔧 **Tool Call: ${toolCall.function.name}**\n\`\`\`json\n${toolCall.function.arguments}\n\`\`\`\n`;
            res.write(`data: ${JSON.stringify({
              choices: [{
                delta: { content: toolCallText },
                finish_reason: null
              }]
            })}\n\n`);
          }
        }
        
        // Execute tool calls
        res.write(`data: ${JSON.stringify({
          choices: [{
            delta: { content: '\n\n⚙️ **Executing tool calls...**\n' },
            finish_reason: null
          }]
        })}\n\n`);
        
        const toolMessages: any[] = [];
        for (const toolCall of toolCallsFromResponse) {
          try {
            const args = typeof toolCall.function.arguments === 'string' 
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
            const result = executeToolCall(toolCall.function.name, args);
            
            res.write(`data: ${JSON.stringify({
              choices: [{
                delta: { content: `\n📊 **Tool Result:**\n\`\`\`json\n${result}\n\`\`\`\n` },
                finish_reason: null
              }]
            })}\n\n`);
            
            // Together AI doesn't use tool_call_id in tool messages
            toolMessages.push({
              role: 'tool',
              content: result
            });
          } catch (e) {
            console.error('Error executing tool call:', e);
          }
        }
        
        // Make follow-up request with tool results
        if (toolMessages.length > 0) {
          // Check if this is a model that supports full tool calling flow
          // Some Together AI models (like Llama) don't support assistant->tool message flow
          const supportsToolFlow = endpoint.model.includes('gpt') || 
                                    endpoint.model.includes('arcee') ||
                                    !isTogetherAI; // Non-Together models (OpenAI) support it
          
          if (!supportsToolFlow) {
            // For models that don't support full tool flow, make a simpler follow-up call
            // by adding the tool results as a user message instead of using assistant/tool roles
            res.write(`data: ${JSON.stringify({
              choices: [{
                delta: { content: '\n\n💬 **AI Response:**\n' },
                finish_reason: null
              }]
            })}\n\n`);
            
            // Construct a simple follow-up message with tool results as text
            const toolResultsText = toolMessages.map((tm: any, index: number) => {
              const toolCall = toolCallsFromResponse[index];
              return `Tool: ${toolCall?.function?.name || 'unknown'}\nResult: ${tm.content}`;
            }).join('\n\n');
            
            const simpleFollowUpMessages = [
              ...messages,
              {
                role: 'user',
                content: `Based on the following tool results, please provide a natural language response to my question:\n\n${toolResultsText}`
              }
            ];
            
            const simpleFollowUpPayload: any = {
              model: endpoint.model,
              messages: simpleFollowUpMessages,
              temperature: endpoint.temperature
            };
            
            console.log('Making simple follow-up API call for Llama...');
            
            try {
              const simpleFollowUpResponse: AxiosResponse = await axios.post(
                apiUrl,
                simpleFollowUpPayload,
                {
                  headers: {
                    'Authorization': `Bearer ${endpoint.api_key}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 300000
                }
              );
              
              const finalMessage = simpleFollowUpResponse.data.choices?.[0]?.message?.content || '';
              
              // Stream the final response
              const chunkSize = 50;
              let sentChars = 0;
              
              const sendChunk = () => {
                if (sentChars >= finalMessage.length) {
                  res.write(`data: [DONE]\n\n`);
                  res.end();
                  return;
                }
                
                const chunk = finalMessage.slice(sentChars, sentChars + chunkSize);
                sentChars += chunkSize;
                
                res.write(`data: ${JSON.stringify({
                  choices: [{
                    delta: { content: chunk },
                    finish_reason: null
                  }]
                })}\n\n`);
                
                setTimeout(sendChunk, 50);
              };
              
              sendChunk();
            } catch (error: any) {
              console.error('Simple follow-up call error:', error.message);
              res.write(`data: ${JSON.stringify({
                choices: [{
                  delta: { content: '\n\n❌ Error generating response from tool results.\n' },
                  finish_reason: 'stop'
                }]
              })}\n\n`);
              res.write(`data: [DONE]\n\n`);
              res.end();
            }
            return;
          }
          
          res.write(`data: ${JSON.stringify({
            choices: [{
              delta: { content: '\n\n💬 **AI Response:**\n' },
              finish_reason: null
            }]
          })}\n\n`);
          
          const followUpMessages = [
            ...messages,
            {
              role: 'assistant',
              content: assistantResponse || null,
              tool_calls: toolCallsFromResponse.map((tc: any) => {
                console.log('Processing tool call for follow-up:');
                console.log('  - Name:', tc.function.name);
                console.log('  - Arguments type:', typeof tc.function.arguments);
                console.log('  - Arguments value:', tc.function.arguments);
                
                // Ensure arguments is always a string
                let argsString: string;
                if (typeof tc.function.arguments === 'string') {
                  argsString = tc.function.arguments;
                } else if (typeof tc.function.arguments === 'object') {
                  argsString = JSON.stringify(tc.function.arguments);
                } else {
                  // Fallback for any other type
                  argsString = String(tc.function.arguments);
                }
                
                console.log('  - Final arguments string:', argsString);
                
                return {
                  id: tc.id,
                  type: tc.type || 'function',
                  function: {
                    name: tc.function.name,
                    arguments: argsString
                  }
                };
              })
            },
            ...toolMessages
          ];
          
          const followUpPayload: any = {
            model: endpoint.model,
            messages: followUpMessages,
            temperature: endpoint.temperature
            // Don't include tools in follow-up request
          };
          
          console.log('Making follow-up API call with tool results...');
          console.log('Follow-up payload:', JSON.stringify(followUpPayload, null, 2));
          console.log('Follow-up payload assistant tool_calls:', JSON.stringify(followUpMessages[2]?.tool_calls, null, 2));
          
          const followUpResponse: AxiosResponse = await axios.post(
            apiUrl,
            followUpPayload,
            {
              headers: {
                'Authorization': `Bearer ${endpoint.api_key}`,
                'Content-Type': 'application/json'
              },
              timeout: 300000
            }
          );
          
          const finalMessage = followUpResponse.data.choices?.[0]?.message?.content || '';
          
          // Stream the final response
          const chunkSize = 50;
          let sentChars = 0;
          
          const sendChunk = () => {
            if (sentChars >= finalMessage.length) {
              res.write(`data: [DONE]\n\n`);
              res.end();
              return;
            }
            
            const chunk = finalMessage.slice(sentChars, sentChars + chunkSize);
            sentChars += chunk.length;
            
            res.write(`data: ${JSON.stringify({
              choices: [{
                delta: { content: chunk },
                finish_reason: null
              }]
            })}\n\n`);
            
            setTimeout(sendChunk, 10);
          };
          
          sendChunk();
          return;
        }
      }
      
      // No tool calls, simulate streaming by sending response in chunks
      const chunkSize = 50; // characters per chunk
      let sentChars = 0;
      
      // Function to send chunks with delay
      const sendChunk = () => {
        if (sentChars >= assistantResponse.length) {
          // All chunks sent, send completion signal
          res.write(`data: [DONE]\n\n`);
          res.end();
          
          // Save assistant response (only if save_to_db is true and session_id is provided)
          if (save_to_db && session_id) {
            const assistantMessageId = uuidv4();
            db.run(
              'INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
              [assistantMessageId, session_id, 'assistant', assistantResponse],
              (err: Error | null) => {
                if (err) console.error('Error saving assistant message:', err);
              }
            );
          }
          return;
        }
        
        // Get next chunk
        const chunk = assistantResponse.slice(sentChars, sentChars + chunkSize);
        sentChars += chunk.length;
        
        // Send chunk
        res.write(`data: ${JSON.stringify({
          choices: [{
            delta: { content: chunk },
            finish_reason: null
          }]
        })}\n\n`);
        
        // Schedule next chunk (simulate streaming delay)
        setTimeout(sendChunk, 10); // 10ms delay between chunks for smooth streaming
      };
      
      // Start sending chunks
      sendChunk();
      
      return;
    }

    // Handle streaming response for normal models and Together AI thinking models
    let assistantResponse = '';
    let thinkingContent = '';
    let answerContent = '';
    let isInThinkTag = false;
    let streamEnded = false;
    let buffer = '';
    let contentBuffer = '';
    let toolCalls: any[] = [];
    let toolCallsDisplayed = new Set<number>();
    let finishReason: string | null = null;
    let messageToolCalls: any[] = [];
    let firstThinkingTokenReceived = false;
    let firstContentTokenReceived = false;
    let backendTtftEmitted = false;

    response.data.on('data', (chunk: Buffer) => {
      // Append new data to buffer
      buffer += chunk.toString();
      
      // Split by newlines to get complete lines
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            if (!streamEnded) {
              streamEnded = true;
              // Don't end yet if we have tool calls to process
              if (finishReason !== 'tool_calls') {
              res.write(`data: [DONE]\n\n`);
              res.end();
              }
            }
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0]) {
              const choice = parsed.choices[0];
              const delta = choice.delta;
              const message = choice.message;

              if (!backendTtftEmitted && (delta?.content || delta?.reasoning)) {
                backendTtftEmitted = true;
                const backendTtft = performance.now() - inferenceStartTime;
                res.write(`data: ${JSON.stringify({ type: 'BACKEND_TTFT', ttft: Math.round(backendTtft) })}\n\n`);
              }

              const isThinkingModel = isTogetherThinkingModel;

              // Handle reasoning tokens (separate field for some models like DeepSeek-R1)
              if (delta && delta.reasoning) {
                const reasoning = delta.reasoning;
                assistantResponse += reasoning;
                thinkingContent += reasoning;
                
                // For thinking models, send METRICS on first reasoning token
                if (isThinkingModel && !firstThinkingTokenReceived) {
                  firstThinkingTokenReceived = true;
                  // Send METRICS event to mark first thinking token arrival
                  res.write(`data: ${JSON.stringify({
                    type: 'METRICS',
                    usage: {
                      thinking_tokens_started: true,
                      source: 'reasoning_field'
                    },
                    isThinkingModel: true
                  })}\n\n`);
                }
                
                // Send thinking content with special marker
                res.write(`data: ${JSON.stringify({
                  choices: [{
                    delta: { 
                      content: reasoning,
                      contentType: 'thinking'
                    },
                    finish_reason: null
                  }]
                })}\n\n`);
              }
              
              // Handle regular content from delta
              if (delta && delta.content) {
                let content = delta.content;
              assistantResponse += content;
                
                // For Together AI thinking models, parse <think> tags to separate thinking from answer
                // (GPT-5 uses separate reasoning field, not <think> tags)
                if (isTogetherThinkingModel) {
                  // Add content to buffer to handle tags split across chunks
                  contentBuffer += content;
                  
                  // Check for opening tag in buffer
                  if (contentBuffer.includes('<think>')) {
                    isInThinkTag = true;
                    // Remove everything up to and including the opening tag
                    const thinkIndex = contentBuffer.indexOf('<think>');
                    contentBuffer = contentBuffer.substring(thinkIndex + 7); // 7 = length of '<think>'
                    
                    // For thinking models, send METRICS on first thinking token if not already sent
                    if (!firstThinkingTokenReceived) {
                      firstThinkingTokenReceived = true;
                      res.write(`data: ${JSON.stringify({
                        type: 'METRICS',
                        usage: {
                          thinking_tokens_started: true,
                          source: 'content_think_tag'
                        },
                        isThinkingModel: true
                      })}\n\n`);
                    }
                  }
                  
                  // Check for closing tag in buffer
                  if (contentBuffer.includes('</think>')) {
                    isInThinkTag = false;
                    const closeIndex = contentBuffer.indexOf('</think>');
                    
                    // Everything before </think> is thinking content
                    const thinkPart = contentBuffer.substring(0, closeIndex);
                    if (thinkPart) {
                      thinkingContent += thinkPart;
                      res.write(`data: ${JSON.stringify({
                        choices: [{
                          delta: { 
                            content: thinkPart,
                            contentType: 'thinking'
                          },
                          finish_reason: null
                        }]
                      })}\n\n`);
                    }
                    
                    // Everything after </think> is answer content
                    contentBuffer = contentBuffer.substring(closeIndex + 8); // 8 = length of '</think>'
                    
                    // Send any remaining answer content
                    if (contentBuffer) {
                      answerContent += contentBuffer;
                      res.write(`data: ${JSON.stringify({
                        choices: [{
                          delta: { 
                            content: contentBuffer,
                            contentType: 'answer'
                          },
                          finish_reason: null
                        }]
                      })}\n\n`);
                    }
                    
                    // Clear buffer after processing
                    contentBuffer = '';
                    return;
                  }
                  
                  // If buffer has content and we know what type it is, send it
                  // But keep a small amount in buffer in case </think> is split
                  if (contentBuffer.length > 10) { // Keep last 10 chars in buffer in case of split tag
                    const toSend = contentBuffer.substring(0, contentBuffer.length - 10);
                    contentBuffer = contentBuffer.substring(contentBuffer.length - 10);
                    
                    if (isInThinkTag) {
                      thinkingContent += toSend;
                      res.write(`data: ${JSON.stringify({
                        choices: [{
                          delta: { 
                            content: toSend,
                            contentType: 'thinking'
                          },
                          finish_reason: null
                        }]
                      })}\n\n`);
                    } else {
                      answerContent += toSend;
                      res.write(`data: ${JSON.stringify({
                        choices: [{
                          delta: { 
                            content: toSend,
                            contentType: 'answer'
                          },
                          finish_reason: null
                        }]
                      })}\n\n`);
                    }
                  }
                  return;
                } else {
                  // Non-thinking models: send content normally
                  if (!firstContentTokenReceived) {
                    firstContentTokenReceived = true;
                  }
              res.write(`data: ${JSON.stringify(parsed)}\n\n`);
                }
              }
              
              // Handle tool calls from message object (some models return it this way)
              if (message && message.tool_calls && message.tool_calls.length > 0) {
                messageToolCalls = message.tool_calls;
                
                // Display the tool calls
                for (const toolCall of messageToolCalls) {
                  if (toolCall && toolCall.function) {
                    const toolCallText = `\n\n🔧 **Tool Call: ${toolCall.function.name}**\n\`\`\`json\n${toolCall.function.arguments}\n\`\`\`\n`;
                    res.write(`data: ${JSON.stringify({
                      choices: [{
                        delta: { content: toolCallText },
                        finish_reason: null
                      }]
                    })}\n\n`);
                  }
                }
              }
              
              // Handle tool calls from delta (streaming style)
              if (delta && delta.tool_calls) {
                const toolCallDelta = delta.tool_calls[0];
                if (toolCallDelta) {
                  const index = toolCallDelta.index || 0;
                  
                  // Initialize tool call array if needed
                  if (!toolCalls[index]) {
                    toolCalls[index] = {
                      id: '',
                      type: 'function',
                      function: {
                        name: '',
                        arguments: ''
                      }
                    };
                  }
                  
                  // Update tool call with delta
                  if (toolCallDelta.id) {
                    toolCalls[index].id = toolCallDelta.id;
                  }
                  if (toolCallDelta.function) {
                    if (toolCallDelta.function.name) {
                      toolCalls[index].function.name += toolCallDelta.function.name;
                    }
                    if (toolCallDelta.function.arguments) {
                      toolCalls[index].function.arguments += toolCallDelta.function.arguments;
                    }
                  }
                  
                  // Only display complete tool calls (with name and valid arguments)
                  const toolCall = toolCalls[index];
                  if (toolCall.function.name && 
                      toolCall.function.arguments && 
                      !toolCallsDisplayed.has(index)) {
                    
                    // Try to parse arguments to ensure they're complete
                    try {
                      JSON.parse(toolCall.function.arguments);
                      
                      // Arguments are valid JSON, display the tool call
                      toolCallsDisplayed.add(index);
                      
                      const toolCallText = `\n\n🔧 **Tool Call: ${toolCall.function.name}**\n\`\`\`json\n${toolCall.function.arguments}\n\`\`\`\n`;
                      
                      // Send the tool call as content so it displays in the chat
                      res.write(`data: ${JSON.stringify({
                        choices: [{
                          delta: { content: toolCallText },
                          finish_reason: null
                        }]
                      })}\n\n`);
                    } catch (parseError) {
                      // Arguments not complete yet, continue accumulating
                    }
                  }
                }
              }
              
              // Handle completion with finish_reason
              if (parsed.choices[0].finish_reason) {
                finishReason = parsed.choices[0].finish_reason;
              }
            }
          } catch (e) {
            // Only log if it's not just an empty data field
            if (data && data !== '{}') {
              console.warn('Failed to parse streaming chunk:', data.substring(0, 50), 'Error:', e);
            }
          }
        }
      }
    });

    response.data.on('end', async () => {
      // Flush any remaining content in the buffer
      if (contentBuffer.length > 0) {
        if (isInThinkTag) {
          thinkingContent += contentBuffer;
          res.write(`data: ${JSON.stringify({
            choices: [{
              delta: { 
                content: contentBuffer,
                contentType: 'thinking'
              },
              finish_reason: null
            }]
          })}\n\n`);
        } else {
          answerContent += contentBuffer;
          res.write(`data: ${JSON.stringify({
            choices: [{
              delta: { 
                content: contentBuffer,
                contentType: 'answer'
              },
              finish_reason: null
            }]
          })}\n\n`);
        }
        contentBuffer = '';
      }
      
      // Combine tool calls from both sources (deltas and message object)
      let allToolCalls = [...toolCalls];
      if (messageToolCalls.length > 0) {
        // Prefer message tool calls if they exist (more complete)
        allToolCalls = messageToolCalls;
      }
      
      // Check if we have valid tool calls (regardless of finish_reason, as different models behave differently)
      // Normalize tool calls to ensure arguments is a string
      const normalizedToolCalls = allToolCalls.map(tc => {
        if (!tc || !tc.function) return null;
        
        // Ensure arguments is a string (some models might return it as an object)
        let argsString = tc.function.arguments;
        if (typeof argsString === 'object') {
          argsString = JSON.stringify(argsString);
        }
        
        return {
          ...tc,
          function: {
            ...tc.function,
            arguments: argsString
          }
        };
      }).filter(tc => tc !== null);
      
      const validToolCalls = normalizedToolCalls.filter(tc => tc && tc.function && tc.function.name && tc.function.arguments);
      
      // If we have tool calls, execute them and make a second request
      // Check both finish_reason === 'tool_calls' AND if we actually collected tool calls
      // because some models (like Llama) might not set finish_reason to 'tool_calls'
      if (validToolCalls.length > 0) {
        console.log(`Processing ${validToolCalls.length} tool calls...`);
        
        // Show we're executing the tools
        res.write(`data: ${JSON.stringify({
          choices: [{
            delta: { content: '\n\n⚙️ **Executing tool calls...**\n' },
            finish_reason: null
          }]
        })}\n\n`);
        
        // Execute all tool calls and prepare tool messages
        const toolMessages: any[] = [];
        for (const toolCall of validToolCalls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = executeToolCall(toolCall.function.name, args);
            
            // Show the tool result
            res.write(`data: ${JSON.stringify({
              choices: [{
                delta: { content: `\n📊 **Tool Result:**\n\`\`\`json\n${result}\n\`\`\`\n` },
                finish_reason: null
              }]
            })}\n\n`);
            
              // For Together AI, tool messages don't include tool_call_id
              // For OpenAI, they do - detect based on platform
              const toolMessage: any = {
                role: 'tool',
                content: result
              };
              
              // Only add tool_call_id for non-Together AI platforms (like OpenAI)
              if (!isTogetherAI) {
                toolMessage.tool_call_id = toolCall.id || `call_${Date.now()}_${Math.random()}`;
              }
              
              toolMessages.push(toolMessage);
          } catch (e) {
            console.error('Error executing tool call:', e);
          }
        }
        
        // Make a second API call with the tool results
        if (toolMessages.length > 0) {
          res.write(`data: ${JSON.stringify({
            choices: [{
              delta: { content: '\n\n💬 **AI Response:**\n' },
              finish_reason: null
            }]
          })}\n\n`);
          
          try {
            // Prepare messages including original context and tool results
            const followUpMessages = [
              ...messages,
              {
                role: 'assistant',
                content: assistantResponse || null,
                tool_calls: validToolCalls.map((tc: any) => ({
                  id: tc.id || `call_${Date.now()}_${Math.random()}`,
                  type: 'function',
                  function: {
                    name: tc.function.name,
                    // Ensure arguments is always a string
                    arguments: typeof tc.function.arguments === 'string' 
                      ? tc.function.arguments 
                      : JSON.stringify(tc.function.arguments)
                  }
                }))
              },
              ...toolMessages
            ];
            
            const followUpPayload: any = {
              model: endpoint.model,
              messages: followUpMessages,
              temperature: endpoint.temperature,
              stream: true
              // Don't include tools in follow-up request
            };
            
            console.log('Making follow-up API call with tool results...');
            console.log('Follow-up payload:', JSON.stringify(followUpMessages, null, 2));
            
            const followUpResponse: AxiosResponse = await axios.post(
              apiUrl,
              followUpPayload,
              {
                headers: {
                  'Authorization': `Bearer ${endpoint.api_key}`,
                  'Content-Type': 'application/json'
                },
                responseType: 'stream',
                timeout: 300000
              }
            );
            
            // Stream the follow-up response
            let followUpBuffer = '';
            let followUpEnded = false;
            
            followUpResponse.data.on('data', (chunk: Buffer) => {
              followUpBuffer += chunk.toString();
              const lines = followUpBuffer.split('\n');
              followUpBuffer = lines.pop() || '';
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') {
                    if (!followUpEnded) {
                      followUpEnded = true;
                      res.write(`data: [DONE]\n\n`);
                      res.end();
                    }
                    return;
                  }
                  
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
                      res.write(`data: ${JSON.stringify(parsed)}\n\n`);
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            });
            
            followUpResponse.data.on('end', () => {
              if (!followUpEnded) {
                followUpEnded = true;
                res.write(`data: [DONE]\n\n`);
                res.end();
              }
            });
            
            followUpResponse.data.on('error', (error: Error) => {
              console.error('Follow-up stream error:', error);
              if (!followUpEnded) {
                followUpEnded = true;
                res.write(`data: [DONE]\n\n`);
                res.end();
              }
            });
            
          } catch (error: any) {
            console.error('Error in follow-up request:', error);
            if (error.response) {
              console.error('Error response data:', error.response.data);
              console.error('Error response status:', error.response.status);
            }
            res.write(`data: ${JSON.stringify({
              choices: [{
                delta: { content: '\n\n❌ Error processing tool results.' },
                finish_reason: null
              }]
            })}\n\n`);
            res.write(`data: [DONE]\n\n`);
            res.end();
          }
        } else {
          // No tool messages, just end
          res.write(`data: [DONE]\n\n`);
          res.end();
        }
      } else {
        // No tool calls, save and end normally
      if (save_to_db && session_id) {
        const assistantMessageId = uuidv4();
        db.run(
          'INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
          [assistantMessageId, session_id, 'assistant', assistantResponse],
          (err: Error | null) => {
            if (err) console.error('Error saving assistant message:', err);
          }
        );
      }
      
      // Ensure we always send [DONE] and end the response
      if (!streamEnded && !res.headersSent) {
        streamEnded = true;
        res.write(`data: [DONE]\n\n`);
        res.end();
      } else if (!res.headersSent) {
        res.end();
        }
      }
    });

    response.data.on('error', (error: Error) => {
      console.error('Stream error:', error);
      if (!streamEnded) {
        streamEnded = true;
        if (!res.headersSent) {
          res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Transfer-Encoding': 'chunked',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.write(`ERROR: Stream error: ${error.message}`);
          res.end();
        } else {
          res.end();
        }
      }
    });

    return;

  } catch (error: any) {
    console.error('Text completion error:', error);
    
    // Log the full error response if available
    if (error.response) {
      console.error('Error response status:', error.response.status);
      
      // Try to read the error message from the response data
      let errorData: any = error.response.data;
      if (errorData && typeof errorData.read === 'function') {
        // It's a stream, read it
        const chunks: Buffer[] = [];
        errorData.on('data', (chunk: Buffer) => chunks.push(chunk));
        errorData.on('end', () => {
          const fullData = Buffer.concat(chunks).toString();
          console.error('Error response data (from stream):', fullData);
          try {
            const parsed = JSON.parse(fullData);
            console.error('Parsed error:', JSON.stringify(parsed, null, 2));
          } catch (e) {
            console.error('Could not parse error as JSON');
          }
        });
      } else {
        console.error('Error response data:', errorData);
      }
      console.error('Error response headers:', error.response.headers);
    }
    
    // Create user-friendly error messages
    let errorMessage = 'Sorry, there was an error processing your request.';
    let errorDetails = '';
    
    if (error.response) {
      const status = error.response.status;
      const responseData = error.response.data;
      
      switch (status) {
        case 401:
          errorMessage = '🔑 Authentication Error: Invalid API key.';
          errorDetails = 'Please check your API key in the endpoint configuration.';
          break;
        case 400:
          errorMessage = '⚠️ Invalid Request: There was a problem with your request.';
          if (responseData && responseData.error && responseData.error.message) {
            errorDetails = responseData.error.message;
          } else {
            errorDetails = 'Please check your model name and request parameters.';
          }
          break;
        case 429:
          errorMessage = '🚦 Rate Limit Exceeded: Too many requests.';
          errorDetails = 'Please wait a moment before trying again. Consider upgrading your API plan for higher limits.';
          break;
        case 404:
          errorMessage = '🔍 Model Not Found: The specified model is not available.';
          errorDetails = 'Please check your model name or try a different model.';
          break;
        case 500:
          errorMessage = '🔧 Server Error: The API service is experiencing issues.';
          errorDetails = 'Please try again in a few moments.';
          break;
        default:
          errorMessage = `❌ API Error (${status}): Request failed.`;
          if (responseData && responseData.error && responseData.error.message) {
            errorDetails = responseData.error.message;
          }
      }
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = '🌐 Connection Error: Unable to reach the API server.';
      errorDetails = 'Please check your internet connection and base URL.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = '⏱️ Timeout Error: The request took too long.';
      errorDetails = 'Please try again with a shorter message or check your connection.';
    }
    
    // Send error message to the chat
    const fullErrorMessage = errorDetails ? `${errorMessage}\n\n${errorDetails}` : errorMessage;
    
    if (!res.headersSent) {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
    }
    
    res.write(`ERROR: ${fullErrorMessage}`);
    res.end();
    return;
  }
}

// Get messages for a session
app.get('/api/sessions/:sessionId/messages', (req: Request, res: Response): void => {
  const { sessionId } = req.params;
  
  db.all(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC',
    [sessionId],
    (err: Error | null, rows: ChatMessage[]) => {
      if (err) {
        console.error('Error fetching session messages:', err);
        res.status(500).json({ error: 'Failed to fetch session messages' });
        return;
      }
      res.json(rows);
    }
  );
});

// Chat endpoint
app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
  const { endpoint_id, session_id, message, image_path, use_history = true, save_to_db = true, use_tools = false }: ChatRequest = req.body;
  
  if (!endpoint_id || !message) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    // Get endpoint with platform and API key information
    const endpoint: Endpoint = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          e.*,
          p.base_url as platform_base_url,
          p.is_custom,
          ak.api_key
        FROM endpoints e
        JOIN platforms p ON e.platform_id = p.id
        JOIN api_keys ak ON e.api_key_id = ak.id
        WHERE e.id = ?
      `;
      
      db.get(query, [endpoint_id], (err: Error | null, row: Endpoint) => {
        if (err) reject(err);
        else if (!row) reject(new Error('Endpoint not found'));
        else resolve(row);
      });
    });

    // Determine the actual base URL to use
    const baseUrl = endpoint.is_custom ? endpoint.custom_base_url : endpoint.platform_base_url;
    
    const isImageModel = endpoint.model_type === 'image';

    // Save user message first (only if save_to_db is true and session_id is provided)
    const userMessageId = uuidv4();
    if (save_to_db && session_id) {
      await new Promise<void>((resolve, reject) => {
        db.run(
          'INSERT INTO chat_messages (id, session_id, role, content, image_path) VALUES (?, ?, ?, ?, ?)',
          [userMessageId, session_id, 'user', message, image_path || null],
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    if (isImageModel) {
      // Handle image generation
      await handleImageGeneration(res, endpoint, baseUrl, message, session_id, save_to_db);
    } else {
      // Handle text chat completion
      await handleTextCompletion(res, endpoint, baseUrl, message, session_id, use_history, userMessageId, image_path, save_to_db, use_tools);
    }

  } catch (error: any) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

// API endpoint to get list of demo images
app.get('/api/demo-images', (req: Request, res: Response): void => {
  try {
    // Check if directory exists
    if (!fs.existsSync(demoImagesDir)) {
      console.log('Demo images directory not found at:', demoImagesDir);
      res.json({ images: [] });
      return;
    }
    
    // Read all files from the directory
    const files = fs.readdirSync(demoImagesDir);
    
    // Filter to only image files (jpg, jpeg, png, gif, webp)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const images = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });
    
    console.log(`Found ${images.length} demo images:`, images);
    res.json({ images });
  } catch (error: any) {
    console.error('Error reading demo images:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
