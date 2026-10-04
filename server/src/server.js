import { app } from './app.js';
import { config } from './config.js';

const server = app.listen(config.port, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
});

export default server;
