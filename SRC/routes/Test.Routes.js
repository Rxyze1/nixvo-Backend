// routes/Test.Route.js
import express from 'express';
import Employee  from '../Models/USER-Auth/Employee-Model.js';
import Portfolio from '../Models/USER-Auth/Employee/PortfolioModel.js';

const router = express.Router();  // ← THIS IS MISSING

router.get('/migrate-portfolio-badges', async (req, res) => {
  try {
    const premiumEmps = await Employee.find({ 'blueVerified.status': true }).select('_id').lean();
    const ids = premiumEmps.map(e => e._id);

    const premiumUpdated = await Portfolio.updateMany(
      { employeeId: { $in: ids } },
      { badgeType: 'premium' }
    );

    const freeUpdated = await Portfolio.updateMany(
      { employeeId: { $nin: ids } },
      { badgeType: 'free' }
    );

    return res.json({
      success: true,
      premiumEmployees: ids.length,
      portfoliosSetToPremium: premiumUpdated.modifiedCount,
      portfoliosSetToFree:    freeUpdated.modifiedCount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;