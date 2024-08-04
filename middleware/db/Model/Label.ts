import mongoose from 'mongoose';

const labelSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  labels: [
    {
      title: { type: String, required: true },
      personal: { type: Boolean, default: false },
      labelColor: { type: String, default: "transparent" },
      domain: { type: Boolean, default: false },
      category: {type:String,required:true},
      personalEmails: { type: [String], default: [] },
      domainEmails: { type: [String], default: [] },
    },
  ],
});

const Label = mongoose.models.Label || mongoose.model('Label', labelSchema);

export default Label;