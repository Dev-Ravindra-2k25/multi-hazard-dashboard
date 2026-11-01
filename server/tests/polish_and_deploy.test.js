import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app.js';
import { validateStartupConfig, getAllowedOrigins } from '../src/config.js';

describe('Slice 12: Server Hardening (Production Error Handler, Startup Validation, CORS)', () => {
  describe('1. Startup Configuration Validation (validateStartupConfig)', () => {
    it('throws error when MONGODB_URI is missing', () => {
      expect(() => {
        validateStartupConfig({ MONGODB_URI: '' });
      }).toThrow('MONGODB_URI is missing');

      expect(() => {
        validateStartupConfig({});
      }).toThrow('MONGODB_URI is missing');
    });

    it('rejects a short JWT_SECRET (< 32 characters) in production', () => {
      expect(() => {
        validateStartupConfig({
          MONGODB_URI: 'mongodb://localhost:27017/hazard_dashboard',
          NODE_ENV: 'production',
          JWT_SECRET: 'short_key_under_32_characters'
        });
      }).toThrow('JWT_SECRET must be at least 32 characters in production');
    });

    it('accepts a valid JWT_SECRET (>= 32 characters) in production', () => {
      expect(() => {
        validateStartupConfig({
          MONGODB_URI: 'mongodb://localhost:27017/hazard_dashboard',
          NODE_ENV: 'production',
          JWT_SECRET: 'supersecretjwtkey_that_is_at_least_32_chars_long'
        });
      }).not.toThrow();
    });

    it('does not require 32+ characters for JWT_SECRET in development/test', () => {
      expect(() => {
        validateStartupConfig({
          MONGODB_URI: 'mongodb://localhost:27017/hazard_dashboard',
          NODE_ENV: 'development',
          JWT_SECRET: 'devsecret'
        });
      }).not.toThrow();
    });
  });

  describe('2. Production Error Handler', () => {
    let originalEnv;
    let prodApp;

    beforeAll(() => {
      originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      prodApp = createApp((app) => {
        app.get('/api/test-server-error', (req, res, next) => {
          const err = new Error('Database password leak: secret123 in /var/db/internal.js');
          err.status = 500;
          next(err);
        });

        app.get('/api/test-client-error', (req, res, next) => {
          const err = new Error('Invalid query filter format');
          err.status = 400;
          next(err);
        });
      });
    });

    afterAll(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('hides stack traces and returns generic message for 500 errors in production', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(prodApp).get('/api/test-server-error');

      expect(res.statusCode).toBe(500);
      expect(res.body).toHaveProperty('error', 'Internal Server Error');
      expect(res.body).not.toHaveProperty('stack');
      expect(JSON.stringify(res.body)).not.toContain('secret123');

      consoleErrorSpy.mockRestore();
    });

    it('returns client-friendly message without stack trace for 400 errors in production', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(prodApp).get('/api/test-client-error');

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid query filter format');
      expect(res.body).not.toHaveProperty('stack');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('3. CORS Origin Restriction', () => {
    let app;

    beforeAll(() => {
      process.env.CLIENT_ORIGIN = 'https://dashboard.hazard.gov.in';
      app = createApp();
    });

    it('blocks an unknown origin and returns 403', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-hacker-site.org');

      expect(res.statusCode).toBe(403);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();

      consoleErrorSpy.mockRestore();
    });

    it('allows configured origin in CLIENT_ORIGIN', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://dashboard.hazard.gov.in');

      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('https://dashboard.hazard.gov.in');
    });

    it('allows localhost:5173 when not in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const devApp = createApp();
      const res = await request(devApp)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.statusCode).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');

      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});
