require('dotenv').config();
const app = require('./app');

const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  console.log(`[TaskFlow] 后端服务已启动: http://localhost:${PORT}`);
  console.log(`[TaskFlow] 环境: ${process.env.NODE_ENV || 'development'}`);
});
