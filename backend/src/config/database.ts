import path from 'path';
import fs from 'fs';

export const config = {
  database: {
    path: process.env.DATABASE_PATH || path.join(process.cwd(), 'database', 'gold_billing.db'),
    ensureDir: () => {
      const dbDir = path.dirname(config.database.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    }
  },
  server: {
    port: process.env.PORT || 3001,
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  },
  app: {
    name: process.env.APP_NAME || 'Vannamiyal Thangamaligai',
    version: process.env.APP_VERSION || '1.0.0'
  }
};
