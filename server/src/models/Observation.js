import mongoose from 'mongoose';

const observationSchema = new mongoose.Schema(
  {
    regionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Region',
      required: true,
      index: true
    },
    source: {
      type: String,
      enum: ['weather', 'seismic', 'river'],
      required: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    fetchedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

export const Observation = mongoose.models.Observation || mongoose.model('Observation', observationSchema);
export default Observation;
