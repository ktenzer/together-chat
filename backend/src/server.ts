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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

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
async function handleTextCompletion(res: Response, endpoint: Endpoint, baseUrl: string, message: string, session_id: string | null, use_history: boolean, userMessageId: string, image_path?: string, save_to_db: boolean = true): Promise<void> {
  try {
    // Prepare messages for API call
    const messages: any[] = [];
    
    // Add system message if provided
    if (endpoint.system_prompt) {
      messages.push({
        role: 'system',
        content: endpoint.system_prompt
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
          const imagePath = path.join(__dirname, '..', msg.image_path.replace('/uploads/', 'uploads/'));
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
      const imagePath = path.join(__dirname, '..', image_path.replace('/uploads/', 'uploads/'));
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

    // Make API call with streaming
    const apiUrl = getApiEndpoint(baseUrl, false);
    console.log('Making API call to:', apiUrl);
    
    const requestPayload: any = {
      model: endpoint.model,
      messages: messages,
      temperature: endpoint.temperature,
      stream: true
    };
    
    // Remove max_tokens limitation - let tokens be unlimited
    
    console.log('Request payload:', requestPayload);
    
    const response: AxiosResponse = await axios.post(
      apiUrl,
      requestPayload,
      {
        headers: {
          'Authorization': `Bearer ${endpoint.api_key}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream',
        timeout: 300000 // 5 minute timeout for text completion
      }
    );

    console.log('API response status:', response.status);
    console.log('API response headers:', response.headers);

    let assistantResponse = '';
    let streamEnded = false;

    response.data.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            if (!streamEnded) {
              streamEnded = true;
              res.write(`data: [DONE]\n\n`);
              res.end();
            }
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
              const content = parsed.choices[0].delta.content;
              assistantResponse += content;
              res.write(`data: ${JSON.stringify(parsed)}\n\n`);
            } else if (parsed.choices && parsed.choices[0] && parsed.choices[0].finish_reason) {
              // Handle completion with finish_reason (some APIs use this instead of [DONE])
              console.log('Stream finished with reason:', parsed.choices[0].finish_reason);
              if (!streamEnded) {
                streamEnded = true;
                res.write(`data: [DONE]\n\n`);
                res.end();
              }
              return;
            }
          } catch (e) {
            // Ignore parsing errors for incomplete JSON
            console.warn('Failed to parse streaming chunk:', data, 'Error:', e);
          }
        }
      }
    });

    response.data.on('end', () => {
      console.log('Stream ended. Total response length:', assistantResponse.length);
      
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
      
      // Ensure we always send [DONE] and end the response
      if (!streamEnded && !res.headersSent) {
        streamEnded = true;
        res.write(`data: [DONE]\n\n`);
        res.end();
      } else if (!res.headersSent) {
        res.end();
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
  const { endpoint_id, session_id, message, image_path, use_history = true, save_to_db = true }: ChatRequest = req.body;
  
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
    
    console.log('=== CHAT REQUEST DEBUG ===');
    console.log('Endpoint ID:', endpoint_id);
    console.log('Endpoint name:', endpoint.name);
    console.log('Platform ID:', endpoint.platform_id);
    console.log('Is custom platform:', endpoint.is_custom);
    console.log('Platform base URL:', endpoint.platform_base_url);
    console.log('Custom base URL:', endpoint.custom_base_url);
    console.log('Final base URL:', baseUrl);
    console.log('Model:', endpoint.model);
    console.log('Model type:', endpoint.model_type);
    console.log('API key available:', !!endpoint.api_key);
    console.log('=========================');

    const isImageModel = endpoint.model_type === 'image';
    
    console.log(`Model: ${endpoint.model}, Model Type: ${endpoint.model_type}, IsImageModel: ${isImageModel}`);

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
      await handleTextCompletion(res, endpoint, baseUrl, message, session_id, use_history, userMessageId, image_path, save_to_db);
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

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
