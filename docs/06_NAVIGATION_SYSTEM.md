# 06. Navigation & Voice Guidance System

Once the A* algorithm has returned a unified path, the frontend takes over orchestration. The route must be broken down into human-manageable chunks, especially when navigating massive multi-floor buildings.

**Standardized Calibration Status:**
- **Calibration mechanism**: IMPLEMENTED.
- **Physical calibration values for the current maps**: NOT YET VALIDATED.

**Therefore:**
- the software supports conversion to metres;
- the current maps cannot yet be assumed to be metrically accurate;
- current distance thresholds/voice lookaheads should be treated as calibration-dependent.

## 1. Multi-Floor Navigation Manager

The raw A* response is a flat array of nodes crossing multiple floors. The `MultiFloorNavigationManager` processes this data linearly.

### 1.1. Segment Slicing
- It iterates through the array, hunting for nodes typed as `STAIRCASE` or `LIFT`.
- When a transition is found, it "slices" the path into a `FloorSegment`.
- A 3-floor journey will be sliced into 3 distinct `FloorSegment` objects.
- **Why?** We only load one SVG map into the DOM at a time to preserve memory. By slicing the route, the UI knows exactly when to unmount Floor 1 and mount Floor 2.

### 1.2. The Checkpoint Transition
When the user approaches a `STAIRCASE` or `LIFT` node, the system enters an `AT_CHECKPOINT` state at a strict radius of **0.8 metres**.
- The tracking engine pauses background updates.
- The UI prompts the user to physically navigate the vertical transition (e.g. climbing the stairs or taking the elevator).
- The user clicks the UI to confirm they have reached the new floor, seamlessly mounting the next SVG map layout and unmounting the previous floor.

## 2. Predictive Voice Engine (Hysteresis)

To avoid spamming the user with overlapping audio instructions ("Turn left! Turn left! Turn left!"), the `PredictiveVoiceEngine` utilizes a robust 3-phase hysteresis execution block based on dynamic speed estimation.

### 2.1. Dynamic Speed-Scaled Triggers
The engine continuously calculates `effectiveSpeed` (metres per second) to scale the distance thresholds dynamically. It executes three rigid, latching phases:

1. **PREVIEW Phase**: "In X metres, turn left" (triggered at `previewTimeSeconds` ahead of the node).
2. **PREPARATION Phase**: "In X metres, bear left" (triggered at `preparationTimeSeconds`).
3. **IMMEDIATE Phase**: "Turn left now" (triggered at `immediateTimeSeconds`, typically ~1.5 seconds before the node).

Each maneuver tracks its own `announcedPhases` Set internally. Once a phase is announced, it is latched and never spoken again for that specific node, guaranteeing zero spam.

### 2.2. Adaptive Rerouting Logic
If the user ignores the voice and deviates off the path, the `MultiFloorNavigationManager` triggers a backend recalculation while retaining their `accessProfile`.
- The `handleRecalculatedRoute()` method intercepts the new path.
- **Identical Node Fallback**: If the new path suggests returning to the *exact same* transition node as before, the voice engine dynamically parses the node type and correctly announces: *"Please return to the assigned staircase."* (or elevator). This fallback avoids incorrectly misidentifying lifts as staircases.
- **Optimal Seamless Switch**: If the new path objectively finds a *faster* transition node (e.g., you walk toward a staircase instead of the assigned lift), the engine announces: *"Rerouting: Take the staircase to Floor 2."* The system seamlessly incorporates the user's organic path without forcing them backward.
