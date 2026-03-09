# ClipVerse

**ClipVerse** is a multimodal video creation tool that lets creators explore **multiple alternate endings for the same short video** using a branching timeline.

Instead of generating a single video output from a script or prompt, ClipVerse allows creators to **branch their video into multiple versions**, experiment with different creative directions, and quickly compare them before choosing the final version.

---

## 🎥 Demo

**Live app:** [clipverse-six.vercel.app](https://clipverse-six.vercel.app)

---

## Problem Statement

This project addresses the **Personalization in Generated Video** challenge from the **OpusClip Multimodal AI Hackathon**.

Today, most AI video generation pipelines produce **one output from a prompt or script**. However, when creating short-form videos, creators often have **multiple ideas for how a scene or ending should look**.

For example:

- A scene might work better with a **different mood or lighting**
- A clip might need **two different endings**
- A creator may want to test **multiple creative directions**

Current workflows require duplicating projects and manually editing several versions of the same video. This makes experimentation slow and makes it difficult to compare ideas side by side.

As a result, creators often settle for the **first generated output instead of exploring better alternatives**.

---

## Why We Picked This Problem

Short-form video creation is highly iterative and creative. When working with AI generation tools, creators frequently want to **explore different visual directions before deciding on the final version**.

However, current systems treat video generation as a **single linear pipeline**, producing only one result.

We saw an opportunity to turn video creation into a more **exploratory process**, where creators can quickly generate and compare multiple possibilities before selecting the best one.

This aligns closely with the hackathon theme of **multimodal AI**, combining language understanding and visual generation to enable interactive video creation.

---

## Solution

ClipVerse introduces the concept of **branching video generation**.

Instead of a single timeline, a video can split into **multiple branches**, each representing a different creative direction.

Creators can:

- Select any frame in the video
- Describe a change using natural language
- Generate a new branch based on that change
- Continue editing each branch independently

Each branch evolves into its own version of the video, allowing creators to explore alternate endings or visual styles.

Creators can then **preview and compare these versions side-by-side**, making it easier to identify the most compelling result.

---

## How It Works

ClipVerse combines multiple AI capabilities:

### Language Models (LLMs)
- Interpret prompts describing changes in scenes or style

### Vision Models (VLMs / Image Models)
- Generate or modify frames based on prompts

### Branching Timeline System
- Maintains alternate versions of the same video

This structure allows creators to **experiment without losing the original version of their work**.

---

## Key Idea

ClipVerse treats video editing like a **multiverse of creative possibilities**.

Instead of committing to one output, creators can explore multiple directions and choose the version that works best.

---

## Impact

By enabling alternate endings and branching timelines, ClipVerse transforms video creation from a **single-output pipeline into an exploratory creative workflow**.

Creators can:

- Experiment more freely
- Compare ideas visually
- Refine their videos faster
