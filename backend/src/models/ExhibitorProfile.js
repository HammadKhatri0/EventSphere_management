import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    companyName: { type: String, required: true, trim: true, maxlength: 120 },
    tagline: { type: String, trim: true, maxlength: 140, default: '' },
    description: { type: String, trim: true, maxlength: 3000, default: '' },
    logo: String,
    website: { type: String, trim: true, maxlength: 200 },
    categories: [{ type: String, trim: true, maxlength: 60 }],
    contact: {
      email: { type: String, trim: true, lowercase: true, maxlength: 120 },
      phone: { type: String, trim: true, maxlength: 30 },
      address: { type: String, trim: true, maxlength: 200 },
    },
    products: [
      {
        name: { type: String, required: true, trim: true, maxlength: 100 },
        description: { type: String, trim: true, maxlength: 500, default: '' },
        image: String,
      },
    ],
    documents: [
      {
        name: { type: String, trim: true, maxlength: 120 },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    staff: [
      {
        name: { type: String, required: true, trim: true, maxlength: 80 },
        role: { type: String, trim: true, maxlength: 80, default: '' },
        email: { type: String, trim: true, lowercase: true, maxlength: 120 },
        phone: { type: String, trim: true, maxlength: 30 },
      },
    ],
  },
  { timestamps: true }
);

profileSchema.index({ companyName: 'text', description: 'text', 'products.name': 'text', tagline: 'text' });
profileSchema.index({ categories: 1 });

export const ExhibitorProfile = mongoose.model('ExhibitorProfile', profileSchema);
