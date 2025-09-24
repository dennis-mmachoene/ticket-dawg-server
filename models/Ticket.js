const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  ticketID: {
    type: String,
    required: true,
    unique: true,
  },
  qrCode: { type: String, required: true, unique: true },
  email: { type: String, default: null, lowercase: true },
  status: { type: String, enum: ["unused", "sent", "used"], default: "unused" },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  issuedAt: {
    type: Date,
    default: null,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
});

ticketSchema.index({ qrCode: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ email: 1 });

module.exports = mongoose.model("Ticket", ticketSchema);
