import mongoose from 'mongoose';

const riskScoreSchema = new mongoose.Schema(
  {
    regionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Region',
      required: true
    },
    floodIdx: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    seismicIdx: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    cyclonIdx: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    composite: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    band: {
      type: String,
      enum: ['Low', 'Moderate', 'High', 'Severe'],
      required: true
    },
    stale: {
      type: Boolean,
      default: false
    },
    explanation: {
      type: String,
      default: null
    },
    computedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index on { regionId: 1, computedAt: -1 } per SPEC.md
riskScoreSchema.index({ regionId: 1, computedAt: -1 });

export const RiskScore = mongoose.models.RiskScore || mongoose.model('RiskScore', riskScoreSchema);
export default RiskScore;
