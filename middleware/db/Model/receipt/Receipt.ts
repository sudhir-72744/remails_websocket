import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema({
  GUID: {
    type: String,
    required: true,
    unique: true,
  },
  status:{
    type:Boolean,
    default:false
  }

}, {
  timestamps: true, // Adds createdAt and updatedAt fields
});

const Receipt = mongoose.models.Receipt || mongoose.model('Receipt', receiptSchema);

export default Receipt;
