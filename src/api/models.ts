import mongoose from "mongoose";
import { topicSeeds } from "./seed.js";

const topicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    order: { type: Number, required: true },
    targetCount: { type: Number, required: true },
    description: { type: String, required: true },
    accent: { type: String, required: true },
  },
  { timestamps: true }
);

const problemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: "Topic", required: true },
    platformName: { type: String, required: true },
    platformUrl: { type: String, required: true },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Easy",
    },
    status: {
      type: String,
      enum: ["unsolved", "solved", "revisit", "skipped"],
      default: "unsolved",
    },
    shortNote: { type: String, default: "" },
    longNote: { type: String, default: "" },
    revisionCount: { type: Number, default: 0 },
    solvedAt: { type: Date },
    revisitAt: { type: Date },
    tags: [{ type: String }],
    priority: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

problemSchema.index({ title: "text", shortNote: "text", longNote: "text", platformName: "text" });

export const Topic = mongoose.model("Topic", topicSchema);
export const Problem = mongoose.model("Problem", problemSchema);
export { topicSeeds };

