module.exports = async function aiAtmosphere(req, res) {
  req.url = '/api/vk?cron=atmosphere';
  return require('./vk')(req, res);
};
