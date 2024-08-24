import mongoose from 'mongoose';

// Define a schema for individual email addresses with name and email
const addressSchema = new mongoose.Schema({
  name: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    required: true,
  }
});

// Define a schema for user mailbox addresses
const userMailBoxAddressSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
  },
  fromAddresses: {
    type: [addressSchema],  // Array of address objects
    required: true,
  },
  toAddresses: {
    type: [addressSchema],  // Array of address objects
    required: true,
  },
  metaAddresses: {
    type: [addressSchema],  // Array of address objects
    required: true,
  },
  lastFetchTime: {
    type: Date,
    default: Date.now,
  }
});

// Ensure model creation with proper name and export
const UserMailBoxAddress = mongoose.models.UserMailBoxAddress || mongoose.model('UserMailBoxAddress', userMailBoxAddressSchema);

export default UserMailBoxAddress;
