import mongoose from 'mongoose';

const shelterSchema = new mongoose.Schema(
  {
    regionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Region',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      lat: {
        type: Number,
        required: true
      },
      lon: {
        type: Number,
        required: true
      }
    },
    capacity: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

export const Shelter = mongoose.models.Shelter || mongoose.model('Shelter', shelterSchema);
export default Shelter;
