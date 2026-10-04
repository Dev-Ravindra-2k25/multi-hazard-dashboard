import mongoose from 'mongoose';

const alertSchema = new mongoose.Schema(
  {
    regionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Region',
      required: true,
      index: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['auto', 'manual'],
      required: true
    },
    band: {
      type: String,
      enum: ['Low', 'Moderate', 'High', 'Severe'],
      default: null
    },
    issuedBy: {
      type: String,
      default: 'system',
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const Alert = mongoose.models.Alert || mongoose.model('Alert', alertSchema);
export default Alert;
