const app = require('./app');
const { initializeDatabase } = require('./config/db');

const port = Number(process.env.PORT || 3000);

if (require.main === module) {
  initializeDatabase().then((state) => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Backend server listening on port ${port}`);

      if (state.ready) {
        console.log(
          `MySQL connected: ${state.config.host}:${state.config.port}/${state.config.database}`
        );
      } else {
        console.warn(state.error);
      }
    });
  });
}

module.exports = app;
