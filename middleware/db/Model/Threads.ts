import mongoose from 'mongoose';
import Attachements from './mails/Attachement';


const ThreadSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  thread:[
    {
      threadId:{ type: String, required: true },
      emails: [
        {
          id: { type: String, required: true },
          threadId: { type: String, required: true },
          senderName: { type: [String], default: [] },
          senderEmail: { type: [String], default: [] },
          receiverName: { type: [String], default: [] },
          receiverEmail: { type: [String], default: [] },
          CcNames: { type: [String], default: [] },
          BccNames: { type: [String], default: [] },
          CcEmail: { type: [String], default: [] },
          BCcEmail: { type: [String], default: [] },
          replyToName: { type: String, default: '' },
          replyToEmail: { type: String, default: '' },
          snippet: { type: String, default: '' },
          subject: { type: String, default: '' },
          htmlBody: { type: String, default: '' },
          textBody: { type: String, default: '' },
          hasAttachments: { type: Boolean, default: false },
          isRead: { type: Boolean, default: false },
          isPrioritized: { type: Boolean, default: false },
          date: { type: Date, default: Date.now },
          labels: { type: [String], default: [] },
          attachments: [Attachements.schema] // Reference the Attachment schema here
        }
      ]
    }
  ]
});

const Thread = mongoose.models.ThreadSchema || mongoose.model('Thread', ThreadSchema);

export default Thread;
