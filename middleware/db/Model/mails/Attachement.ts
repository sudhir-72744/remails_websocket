import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  filename: String,
  isBelongstoEMailBody: Boolean,
  mimeType: String,
  data: String,
  size: Number,
});

const Attachements = mongoose.models.attachmentSchema || mongoose.model('Attachements', attachmentSchema);

export default Attachements;