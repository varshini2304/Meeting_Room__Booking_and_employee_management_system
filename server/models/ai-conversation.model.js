import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "tool"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    toolCallId: {
      type: String,
      default: null,
    },
    toolName: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const aiConversationSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userRole: {
      type: String,
      enum: ["employee", "manager"],
      default: "employee",
    },
    branch: {
      type: String,
      default: "",
      trim: true,
    },

    // Rolling conversation history (strictly capped at 20 messages)
    messages: {
      type: [messageSchema],
      default: [],
    },

    // State Tracking
    currentIntent: {
      type: String,
      default: null,
    },
    extractedParams: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    pendingIntentId: {
      type: String,
      default: null,
    },
    turnCount: {
      type: Number,
      default: 0,
    },

    // Session Inactivity Lifecycle
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    // Rolling 30-minute inactivity TTL
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 60 * 1000), // now + 30m
    },
  },
  { timestamps: true }
);

aiConversationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

aiConversationSchema.index({ userId: 1, lastActiveAt: -1 });

/**
 * Appends a message, enforces the strict 20-message rolling window limit,
 * increments turn count, and refreshes the rolling 30-minute expiration TTL.
 *
 * @param {Object} message - { role, content, toolCallId?, toolName? }
 */
aiConversationSchema.methods.addMessage = function (message) {
  this.messages.push(message);
  if (this.messages.length > 20) {
    this.messages = this.messages.slice(-20);
  }
  this.turnCount += 1;
  this.lastActiveAt = new Date();
  this.expiresAt = new Date(Date.now() + 30 * 60 * 1000); // refresh 30-min rolling TTL
};

export const AIConversation = mongoose.model("AIConversation", aiConversationSchema);
