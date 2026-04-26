const cron = require('cron');
const axios = require('axios');
const Task = require('../models/Task');
const BurnoutLog = require('../models/BurnoutLog');
const StudentProfile = require('../models/StudentProfile');
const DynamicRoadmap = require('../models/DynamicRoadmap');
const AcademicEvent = require('../models/AcademicEvent');
const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const { orchestrateDailyForUser } = require('./centralPlannerOrchestrator');

class AgentOrchestrator {
  constructor(io) {
    this.io = io; // Socket.io for UI push
    this.cronJob = new cron.CronJob('0 8 * * *', this.dailyOrchestrate.bind(this)); // 8AM daily
  }

  async dailyOrchestrate() {
    console.log('[Orchestrator] Daily agent run started');
    
    // Batch process recent active users (last 7d logs)
    const recentUsers = await BurnoutLog.distinct('userId', {
      date: { $gte: new Date(Date.now() - 7*24*60*60*1000) }
    }).limit(50); // Scale limit

    for (const userId of recentUsers) {
      try {
        await this.orchestrateUser(userId);
      } catch (err) {
        console.error(`[Orchestrator] User ${userId} failed:`, err.message);
      }
    }
  }

  async orchestrateUser(userId) {
    const result = await orchestrateDailyForUser({
      userId,
      trigger: 'scheduled',
    });
    const action = result.burnoutLevel;
    const riskScore = result.burnoutScore;
    this.io.to(userId.toString()).emit('agent-update', {
      action,
      riskScore,
      changes: `Central orchestrator: shifted ${result.decisions.overdueShifted + result.decisions.capacityShifted}, DSA ${result.decisions.dsaTasksCreated}, syllabus ${result.decisions.syllabusTasksCreated}`,
      timestamp: new Date()
    });
    console.log(`[Orchestrator] User ${userId}: centralized run complete (risk:${riskScore})`);
  }

  start() {
    this.cronJob.start();
    console.log('[Orchestrator] Cron started (8AM daily)');
  }

  stop() {
    this.cronJob.stop();
  }
}

module.exports = AgentOrchestrator;
