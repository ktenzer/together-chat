const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { Together } = require('together-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory for image storage');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(uploadsDir));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Initialize SQLite database
const dbPath = path.join(__dirname, 'chat.db');
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
  db.get('SELECT COUNT(*) as count FROM platforms', (err, row) => {
    if (err) {
      console.error('Error checking platforms:', err);
      return;
    }
    
    if (row.count === 0) {
      console.log('🚀 No platforms found, creating default platforms...');
      
      const defaultPlatforms = [
        { id: 'together', name: 'Together AI', base_url: 'https://api.together.xyz/v1', is_custom: 0 },
        { id: 'custom', name: 'Custom', base_url: '', is_custom: 1 }
      ];

      const stmt = db.prepare('INSERT OR IGNORE INTO platforms (id, name, base_url, is_custom) VALUES (?, ?, ?, ?)');
      
      defaultPlatforms.forEach(platform => {
        stmt.run(platform.id, platform.name, platform.base_url, platform.is_custom);
      });
      
      stmt.finalize();
      console.log('✅ Default platforms created successfully!');
    }
  });
});

// CRUD routes for platforms
app.get('/api/platforms', (req, res) => {
  db.all('SELECT * FROM platforms ORDER BY name ASC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get Together AI models
app.get('/api/together/models', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('Together models request - Auth header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    
    const apiKey = authHeader.replace('Bearer ', '');
    console.log('Extracted API key length:', apiKey.length);
    
    // Create Together AI client
    const client = new Together({ apiKey: apiKey });
    
    // List models using the SDK
    const models = await client.models.list();
    console.log('Together API response - models count:', models.length);
    
    // Filter for serverless models and sort by name
    const serverlessModels = models
      .filter(model => model.pricing?.input !== undefined) // Has pricing = serverless
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(model => ({
        id: model.id,
        name: model.display_name || model.id,
        type: model.type,
        context_length: model.context_length,
        pricing: model.pricing
      }));
    
    console.log('Filtered models count:', serverlessModels.length);
    res.json(serverlessModels);
  } catch (error) {
    console.error('Error fetching Together models:', error.message);
    console.error('Error details:', error);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      res.status(401).json({ error: 'Invalid Together AI API key. Please check your API key and try again.' });
    } else {
      res.status(500).json({ error: 'Failed to fetch models from Together AI' });
    }
  }
});

app.post('/api/platforms', (req, res) => {
  const { name, base_url } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Platform name is required' });
  }

  const id = uuidv4();
  const isCustom = name.toLowerCase() === 'custom' ? 1 : 0;
  
  db.run(
    'INSERT INTO platforms (id, name, base_url, is_custom) VALUES (?, ?, ?, ?)',
    [id, name, base_url || '', isCustom],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Platform name already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id, name, base_url: base_url || '', is_custom: isCustom });
    }
  );
});

app.put('/api/platforms/:id', (req, res) => {
  const { id } = req.params;
  const { name, base_url } = req.body;
  
  db.run(
    'UPDATE platforms SET name = ?, base_url = ? WHERE id = ?',
    [name, base_url || '', id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Platform name already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Platform not found' });
      }
      res.json({ id, name, base_url: base_url || '' });
    }
  );
});

app.delete('/api/platforms/:id', (req, res) => {
  const { id } = req.params;
  
  // Check if platform is being used by any endpoints
  db.get('SELECT COUNT(*) as count FROM endpoints WHERE platform_id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (row.count > 0) {
      return res.status(400).json({ error: 'Cannot delete platform that is being used by endpoints' });
    }
    
    db.run('DELETE FROM platforms WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Platform not found' });
      }
      res.json({ message: 'Platform deleted successfully' });
    });
  });
});

// CRUD routes for API keys
app.get('/api/api-keys', (req, res) => {
  db.all('SELECT id, name, api_key, created_at FROM api_keys ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/api-keys', (req, res) => {
  const { name, api_key } = req.body;
  
  if (!name || !api_key) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = uuidv4();
  
  db.run(
    'INSERT INTO api_keys (id, name, api_key) VALUES (?, ?, ?)',
    [id, name, api_key],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'API key name already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ id, name });
    }
  );
});

app.put('/api/api-keys/:id', (req, res) => {
  const { id } = req.params;
  const { name, api_key } = req.body;
  
  db.run(
    'UPDATE api_keys SET name = ?, api_key = ? WHERE id = ?',
    [name, api_key, id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'API key name already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }
      res.json({ id, name });
    }
  );
});

app.delete('/api/api-keys/:id', (req, res) => {
  const { id } = req.params;
  
  // Check if API key is being used by any endpoints
  db.get('SELECT COUNT(*) as count FROM endpoints WHERE api_key_id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (row.count > 0) {
      return res.status(400).json({ error: 'Cannot delete API key that is being used by endpoints' });
    }
    
    db.run('DELETE FROM api_keys WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }
      res.json({ message: 'API key deleted successfully' });
    });
  });
});

// CRUD routes for endpoints
app.get('/api/endpoints', (req, res) => {
  db.all(`SELECT e.*, ak.name as api_key_name, p.name as platform_name, p.base_url as platform_base_url, p.is_custom
          FROM endpoints e 
          LEFT JOIN api_keys ak ON e.api_key_id = ak.id 
          LEFT JOIN platforms p ON e.platform_id = p.id
          ORDER BY e.created_at DESC`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/endpoints', (req, res) => {
  const { name, platform_id, custom_base_url, api_key_id, model, model_type = 'text', system_prompt = '', temperature = 0.7 } = req.body;
  
  if (!name || !platform_id || !api_key_id || !model) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = uuidv4();
  
  db.run(
    'INSERT INTO endpoints (id, name, platform_id, custom_base_url, api_key_id, model, model_type, system_prompt, temperature) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, platform_id, custom_base_url || '', api_key_id, model, model_type, system_prompt, temperature],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id, name, platform_id, custom_base_url: custom_base_url || '', api_key_id, model, model_type, system_prompt, temperature });
    }
  );
});

app.put('/api/endpoints/:id', (req, res) => {
  const { id } = req.params;
  const { name, platform_id, custom_base_url, api_key_id, model, model_type, system_prompt, temperature } = req.body;
  
  db.run(
    'UPDATE endpoints SET name = ?, platform_id = ?, custom_base_url = ?, api_key_id = ?, model = ?, model_type = ?, system_prompt = ?, temperature = ? WHERE id = ?',
    [name, platform_id, custom_base_url || '', api_key_id, model, model_type, system_prompt, temperature, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.json({ id, name, platform_id, custom_base_url: custom_base_url || '', api_key_id, model, model_type, system_prompt, temperature });
    }
  );
});

app.delete('/api/endpoints/:id', (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM endpoints WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.json({ message: 'Endpoint deleted successfully' });
  });
});

// Chat sessions routes
app.get('/api/sessions', (req, res) => {
  db.all('SELECT * FROM chat_sessions ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/sessions', (req, res) => {
  const { endpoint_id, name } = req.body;
  
  if (!endpoint_id || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = uuidv4();
  
  db.run(
    'INSERT INTO chat_sessions (id, endpoint_id, name) VALUES (?, ?, ?)',
    [id, endpoint_id, name],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id, endpoint_id, name });
    }
  );
});

app.delete('/api/sessions/:id', (req, res) => {
  const { id } = req.params;
  
  // First delete all messages in the session
  db.run('DELETE FROM chat_messages WHERE session_id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Then delete the session
    db.run('DELETE FROM chat_sessions WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json({ message: 'Session deleted successfully' });
    });
  });
});

// Chat messages routes
app.get('/api/sessions/:sessionId/messages', (req, res) => {
  const { sessionId } = req.params;
  
  db.all(
    'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC',
    [sessionId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Image upload endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  
  res.json({
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
    size: req.file.size,
    mimetype: req.file.mimetype
  });
});

// Helper function to detect image generation models
function isImageGenerationModel(modelName) {
  const imageModels = [
    'flux', 'dall-e', 'midjourney', 'stable-diffusion', 'playground-v2', 
    'stable-diffusion-xl', 'kandinsky', 'imagen', 'firefly'
  ];
  const modelLower = modelName.toLowerCase();
  return imageModels.some(imageModel => modelLower.includes(imageModel));
}

// Helper function to get the appropriate API endpoint
function getApiEndpoint(baseUrl, isImageModel) {
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
async function handleImageGeneration(res, endpoint, baseUrl, message, session_id) {
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
    // Prepare request body for image generation
    let requestBody;
    let targetApiUrl = apiUrl;

    // For Together AI, use their specific format
    if (baseUrl.includes('together')) {
      // Together AI uses /images/generations endpoint with specific format
      targetApiUrl = baseUrl.replace('/v1', '') + '/v1/images/generations';
      requestBody = {
        model: endpoint.model,
        prompt: message,
        width: 1024,
        height: 1024,
        steps: 20,
        n: 1
      };
    } else {
      // OpenAI-compatible format
      requestBody = {
        prompt: message,
        model: endpoint.model,
        n: 1,
        size: "1024x1024",
        response_format: "url"
      };
    }

    console.log('Image generation request body:', JSON.stringify(requestBody, null, 2));
    console.log('Target API URL:', targetApiUrl);

    res.write('PROGRESS:Sending request to image generation API...\n');

    const response = await axios.post(targetApiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${endpoint.api_key}`,
        'Content-Type': 'application/json'
      }
    });

    res.write('PROGRESS:Processing image generation response...\n');
    console.log('Image generation response:', response.data);

    let imageUrl = null;
    let assistantContent = `Generated image: ${message}`;

    // Parse different response formats
    if (response.data.data && response.data.data[0]) {
      // OpenAI format
      imageUrl = response.data.data[0].url || response.data.data[0].b64_json;
    } else if (response.data.output && response.data.output.choices) {
      // Together AI format
      imageUrl = response.data.output.choices[0].image_base64;
    } else if (response.data.images && response.data.images[0]) {
      // Alternative format
      imageUrl = response.data.images[0];
    } else if (response.data.choices && response.data.choices[0]) {
      // Another Together AI format
      imageUrl = response.data.choices[0].image_base64;
    } else {
      console.error('Unexpected image generation response format:', response.data);
      throw new Error('Unexpected image generation response format');
    }

    res.write('PROGRESS:Saving generated image...\n');

    // Handle different image formats
    let savedImagePath = null;
    
    if (imageUrl && imageUrl.startsWith('data:image/')) {
      // Handle base64 image
      const base64Data = imageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
      const filename = `generated-${Date.now()}.png`;
      const filePath = path.join(__dirname, 'uploads', filename);
      
      fs.writeFileSync(filePath, base64Data, 'base64');
      savedImagePath = `/uploads/${filename}`;
      
      console.log(`Saved base64 image to: ${savedImagePath}`);
    } else if (imageUrl && imageUrl.startsWith('http')) {
      // Download image from URL and save locally
      res.write('PROGRESS:Downloading image from URL...\n');
      
      try {
        const imageResponse = await axios({
          method: 'GET',
          url: imageUrl,
          responseType: 'stream'
        });
        
        const filename = `generated-${Date.now()}.png`;
        const filePath = path.join(__dirname, 'uploads', filename);
        
        // Pipe the image data to a file
        const writer = fs.createWriteStream(filePath);
        imageResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        
        savedImagePath = `/uploads/${filename}`;
        console.log(`Downloaded and saved image to: ${savedImagePath}`);
      } catch (downloadError) {
        console.error('Error downloading image:', downloadError);
        // Fallback to storing URL in content
        assistantContent = `Generated image: ${message}\nImage URL: ${imageUrl}`;
      }
    } else if (imageUrl && !imageUrl.startsWith('http')) {
      // Assume it's base64 without data prefix
      const filename = `generated-${Date.now()}.png`;
      const filePath = path.join(__dirname, 'uploads', filename);
      
      fs.writeFileSync(filePath, imageUrl, 'base64');
      savedImagePath = `/uploads/${filename}`;
      
      console.log(`Saved raw base64 image to: ${savedImagePath}`);
    }

    // Save assistant response with image
    const assistantMessageId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO chat_messages (id, session_id, role, content, image_path) VALUES (?, ?, ?, ?, ?)',
        [assistantMessageId, session_id, 'assistant', assistantContent, savedImagePath],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Send completion with image path
    res.write(`COMPLETE:${JSON.stringify({ 
      content: assistantContent,
      image_path: savedImagePath,
      success: true
    })}\n`);
    
    res.end();

  } catch (error) {
    console.error('Image generation error:', error.response?.data || error.message);
    console.error('Full error:', error);
    const errorMessage = error.response?.data?.error?.message || error.message || 'Image generation failed';
    
    // Save error message
    const assistantMessageId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
        [assistantMessageId, session_id, 'assistant', `Error generating image: ${errorMessage}`],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.write(`ERROR:${errorMessage}\n`);
    res.end();
  }
}

// Handle text completion (existing logic)
async function handleTextCompletion(res, endpoint, baseUrl, message, session_id, use_history, userMessageId, image_path) {
  // Prepare messages for API call
  let messages = [];
  
  // Add system message if provided
  if (endpoint.system_prompt) {
    messages.push({
      role: 'system',
      content: endpoint.system_prompt
    });
  }

  // Add chat history if enabled
  if (use_history) {
    const history = await new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM chat_messages WHERE session_id = ? AND id != ? ORDER BY timestamp ASC',
        [session_id, userMessageId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    for (const msg of history) {
      const messageContent = [];
      messageContent.push({ type: 'text', text: msg.content });
      
      if (msg.image_path && msg.role === 'user') {
        const imagePath = path.join(__dirname, msg.image_path.replace('/uploads/', 'uploads/'));
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
  const currentMessageContent = [];
  currentMessageContent.push({ type: 'text', text: message });
  
  if (image_path) {
    const imagePath = path.join(__dirname, image_path.replace('/uploads/', 'uploads/'));
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
  
  const response = await axios.post(
    apiUrl,
    {
      model: endpoint.model,
      messages: messages,
      temperature: endpoint.temperature,
      stream: true
    },
    {
      headers: {
        'Authorization': `Bearer ${endpoint.api_key}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream'
    }
  );

  let assistantResponse = '';

  response.data.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          res.end();
          return;
        }
        
        try {
          const parsed = JSON.parse(data);
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
            const content = parsed.choices[0].delta.content;
            assistantResponse += content;
            res.write(content);
          }
        } catch (e) {
          // Ignore parsing errors for incomplete JSON
        }
      }
    }
  });

  response.data.on('end', () => {
    // Save assistant response
    const assistantMessageId = uuidv4();
    db.run(
      'INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
      [assistantMessageId, session_id, 'assistant', assistantResponse],
      (err) => {
        if (err) console.error('Error saving assistant message:', err);
      }
    );
    
    res.end();
  });

  response.data.on('error', (error) => {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Stream error' });
    } else {
      res.end();
    }
  });
}

app.post('/api/chat', async (req, res) => {
  const { endpoint_id, session_id, message, image_path, use_history = true } = req.body;
  
  if (!endpoint_id || !session_id || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get endpoint configuration with API key and platform
    const endpoint = await new Promise((resolve, reject) => {
      db.get(`SELECT e.*, ak.api_key, p.base_url as platform_base_url, p.is_custom
              FROM endpoints e 
              JOIN api_keys ak ON e.api_key_id = ak.id 
              JOIN platforms p ON e.platform_id = p.id
              WHERE e.id = ?`, [endpoint_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    // Determine the actual base URL to use
    const baseUrl = endpoint.is_custom ? endpoint.custom_base_url : endpoint.platform_base_url;
    
          // Check if this is an image generation model
          const isImageModel = endpoint.model_type === 'image';
          console.log(`Model: ${endpoint.model}, Model Type: ${endpoint.model_type}, IsImageModel: ${isImageModel}`);

    // Save user message
    const userMessageId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO chat_messages (id, session_id, role, content, image_path) VALUES (?, ?, ?, ?, ?)',
        [userMessageId, session_id, 'user', message, image_path],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    if (isImageModel) {
      // Handle image generation
      await handleImageGeneration(res, endpoint, baseUrl, message, session_id);
    } else {
            // Handle text chat completion
            await handleTextCompletion(res, endpoint, baseUrl, message, session_id, use_history, userMessageId, image_path);
    }

  } catch (error) {
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
