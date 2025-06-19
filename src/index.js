import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://camerachatbackend-production.up.railway.app';
const PORT = process.env.PORT || 8080;

// Store active connections and test data
const activeConnections = new Map();
const testUsers = new Map();
const testChats = new Map();

// Initialize Express app for testing interface
const app = express();
app.use(cors());
app.use(express.json());

// MCP Server Implementation
class ESPStreamCloudMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'espstreamcloud-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // Authentication Tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'register_user',
            description: 'Register a new user in the ESPStreamCloud system',
            inputSchema: {
              type: 'object',
              properties: {
                username: { type: 'string', description: 'Username for the new account' },
                password: { type: 'string', description: 'Password for the new account' }
              },
              required: ['username', 'password']
            }
          },
          {
            name: 'login_user',
            description: 'Login an existing user and get JWT token',
            inputSchema: {
              type: 'object',
              properties: {
                username: { type: 'string', description: 'Username to login' },
                password: { type: 'string', description: 'Password for the account' }
              },
              required: ['username', 'password']
            }
          },
          {
            name: 'send_chat_request',
            description: 'Send a chat request to another user',
            inputSchema: {
              type: 'object',
              properties: {
                receiverUsername: { type: 'string', description: 'Username of the user to send request to' },
                senderToken: { type: 'string', description: 'JWT token of the sender' }
              },
              required: ['receiverUsername', 'senderToken']
            }
          },
          {
            name: 'get_chat_requests',
            description: 'Get pending chat requests for a user',
            inputSchema: {
              type: 'object',
              properties: {
                token: { type: 'string', description: 'JWT token of the user' }
              },
              required: ['token']
            }
          },
          {
            name: 'respond_to_chat_request',
            description: 'Accept or reject a chat request',
            inputSchema: {
              type: 'object',
              properties: {
                requestId: { type: 'string', description: 'ID of the chat request' },
                accepted: { type: 'boolean', description: 'Whether to accept or reject the request' },
                token: { type: 'string', description: 'JWT token of the responder' }
              },
              required: ['requestId', 'accepted', 'token']
            }
          },
          {
            name: 'join_chat_room',
            description: 'Join a chat room and start video streaming',
            inputSchema: {
              type: 'object',
              properties: {
                roomId: { type: 'string', description: 'Chat room ID to join' },
                token: { type: 'string', description: 'JWT token of the user' }
              },
              required: ['roomId', 'token']
            }
          },
          {
            name: 'test_stream_frame',
            description: 'Test sending a video frame to the streaming API',
            inputSchema: {
              type: 'object',
              properties: {
                userId: { type: 'string', description: 'User ID for the stream' },
                token: { type: 'string', description: 'JWT token of the user' },
                frameData: { type: 'string', description: 'Base64 encoded frame data' }
              },
              required: ['userId', 'token', 'frameData']
            }
          },
          {
            name: 'get_system_status',
            description: 'Get overall system status and health',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'register_user':
            return await this.registerUser(args);
          case 'login_user':
            return await this.loginUser(args);
          case 'send_chat_request':
            return await this.sendChatRequest(args);
          case 'get_chat_requests':
            return await this.getChatRequests(args);
          case 'respond_to_chat_request':
            return await this.respondToChatRequest(args);
          case 'join_chat_room':
            return await this.joinChatRoom(args);
          case 'test_stream_frame':
            return await this.testStreamFrame(args);
          case 'get_system_status':
            return await this.getSystemStatus(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async registerUser(args) {
    const { username, password } = args;
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        username,
        password
      });

      const token = response.data.token;
      testUsers.set(username, { token, password });

      return {
        content: [
          {
            type: 'text',
            text: `User ${username} registered successfully. Token: ${token.substring(0, 20)}...`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Registration failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async loginUser(args) {
    const { username, password } = args;
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        username,
        password
      });

      const token = response.data.token;
      testUsers.set(username, { token, password });

      return {
        content: [
          {
            type: 'text',
            text: `User ${username} logged in successfully. Token: ${token.substring(0, 20)}...`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Login failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async sendChatRequest(args) {
    const { receiverUsername, senderToken } = args;
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/chat/request`, {
        receiverUsername
      }, {
        headers: {
          'Authorization': `Bearer ${senderToken}`
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: `Chat request sent to ${receiverUsername}. Request ID: ${response.data.requestId}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Chat request failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async getChatRequests(args) {
    const { token } = args;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/chat/requests`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const requests = response.data;
      const requestList = requests.map(req => 
        `ID: ${req.id}, From: ${req.sender_username}, Status: ${req.status}`
      ).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Chat requests:\n${requestList || 'No pending requests'}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get chat requests: ${error.response?.data?.error || error.message}`);
    }
  }

  async respondToChatRequest(args) {
    const { requestId, accepted, token } = args;
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/chat/respond`, {
        requestId,
        accepted
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: `Chat request ${accepted ? 'accepted' : 'rejected'}. ${response.data.message}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to respond to chat request: ${error.response?.data?.error || error.message}`);
    }
  }

  async joinChatRoom(args) {
    const { roomId, token } = args;
    
    try {
      // Create WebSocket connection
      const ws = new WebSocket(`${API_BASE_URL.replace('https', 'wss')}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return new Promise((resolve, reject) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'join_chat',
            room: roomId
          }));

          activeConnections.set(roomId, ws);

          resolve({
            content: [
              {
                type: 'text',
                text: `Successfully joined chat room: ${roomId}`
              }
            ]
          });
        });

        ws.on('error', (error) => {
          reject(new Error(`WebSocket connection failed: ${error.message}`));
        });

        setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 5000);
      });
    } catch (error) {
      throw new Error(`Failed to join chat room: ${error.message}`);
    }
  }

  async testStreamFrame(args) {
    const { userId, token, frameData } = args;
    
    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(frameData, 'base64');
      
      const response = await axios.post(`${API_BASE_URL}/api/stream/${userId}`, buffer, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'image/jpeg'
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: `Frame sent successfully. Response: ${response.data.message}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to send frame: ${error.response?.data?.error || error.message}`);
    }
  }

  async getSystemStatus(args) {
    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/health`);
      
      const status = {
        apiHealth: healthResponse.data,
        activeConnections: activeConnections.size,
        testUsers: testUsers.size,
        testChats: testChats.size,
        timestamp: new Date().toISOString()
      };

      return {
        content: [
          {
            type: 'text',
            text: `System Status:\n${JSON.stringify(status, null, 2)}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get system status: ${error.message}`);
    }
  }

  async run() {
    // For Railway deployment, we need to serve the Express app
    // The MCP protocol server will run in the background
    console.log('MCP Server started');
  }
}

// Express routes for testing interface
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'espstreamcloud-mcp-server',
    timestamp: new Date().toISOString()
  });
});

app.get('/test-users', (req, res) => {
  const users = Array.from(testUsers.entries()).map(([username, data]) => ({
    username,
    token: data.token.substring(0, 20) + '...'
  }));
  res.json(users);
});

app.get('/active-connections', (req, res) => {
  const connections = Array.from(activeConnections.keys());
  res.json(connections);
});

app.post('/test/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
      username,
      password
    });
    
    testUsers.set(username, { token: response.data.token, password });
    res.json({ success: true, token: response.data.token });
  } catch (error) {
    res.status(400).json({ error: error.response?.data?.error || error.message });
  }
});

app.post('/test/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      username,
      password
    });
    
    testUsers.set(username, { token: response.data.token, password });
    res.json({ success: true, token: response.data.token });
  } catch (error) {
    res.status(400).json({ error: error.response?.data?.error || error.message });
  }
});

// Serve static files from public directory
app.use(express.static('public'));

// Start Express app for testing interface
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`Testing interface available at http://localhost:${PORT}/web-interface.html`);
  console.log(`API Base URL: ${API_BASE_URL}`);
}); 