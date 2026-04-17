import express from 'express';
import mongoose from 'mongoose';

export const UpdateRouter = express.Router();

const AppVersion = mongoose.models.AppVersion || mongoose.model('AppVersion', new mongoose.Schema({
  version: String,
  force: Boolean,
  message: String,
  features: [String],
  link: String
}, { timestamps: true }));

// App calls this
UpdateRouter.get('/check', async (req, res) => {
  const config = await AppVersion.findOne().sort({ createdAt: -1 });
  if (!config) return res.json({ update: false });
  const userV = (req.query.v || "0").split('.').map(Number);
  const newV = config.version.split('.').map(Number);
  const isNew = newV[0] > userV[0] || (newV[0] === userV[0] && newV[1] > userV[1]) || (newV[0] === userV[0] && newV[1] === userV[1] && newV[2] > userV[2]);
  res.json({ update: isNew, force: config.force, message: config.message, features: config.features, link: config.link, newVersion: config.version });
});

// You call this from Postman/Website to push update
// You call this from Postman/Website to push update
UpdateRouter.post('/set', async (req, res) => {
  try {
    await AppVersion.create({ 
      version: req.body.version, 
      force: req.body.force, 
      message: req.body.message, 
      features: req.body.features, 
      link: req.body.link 
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default UpdateRouter;